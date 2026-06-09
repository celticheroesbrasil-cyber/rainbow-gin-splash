import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const QuoteInput = z.object({
  cep: z.string().regex(/^\d{8}$/),
  items: z.array(z.object({
    sku: z.string(),
    qty: z.number().int().positive(),
    weight: z.number().positive(), // kg por unidade
    price: z.number().positive(),
  })).min(1),
});

export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((input) => QuoteInput.parse(input))
  .handler(async ({ data }) => {
    const token = process.env.ENVIA_TOKEN;
    const sellerCep = process.env.FRENET_SELLER_CEP;
    if (!token || !sellerCep) throw new Error("envia.com não configurado");

    // cache lookup
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cartHash = data.items.map((i) => `${i.sku}x${i.qty}`).sort().join("|");
    const { data: cached } = await supabaseAdmin
      .from("shipping_quotes")
      .select("quotes, fetched_at")
      .eq("cep", data.cep)
      .eq("cart_hash", cartHash)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cachedQuotes = Array.isArray(cached?.quotes)
      ? cached.quotes as Array<{ service: string; name: string; price: number; days: number }>
      : [];

    if (cachedQuotes.length > 0 && Date.now() - new Date(cached!.fetched_at).getTime() < 24 * 3600 * 1000) {
      return { quotes: cachedQuotes };
    }

    const totalWeight = data.items.reduce((s, i) => s + i.weight * i.qty, 0);
    const totalValue = data.items.reduce((s, i) => s + i.price * i.qty, 0);

    // envia.com exige city/state em origem e destino — busca via ViaCEP
    async function viaCep(cep: string) {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const j = await r.json() as { localidade?: string; uf?: string; erro?: boolean };
        if (j.erro) return null;
        return { city: j.localidade ?? "", state: j.uf ?? "" };
      } catch {
        return null;
      }
    }
    const [originLoc, destLoc] = await Promise.all([viaCep(sellerCep), viaCep(data.cep)]);
    if (!originLoc || !originLoc.city) {
      console.error("envia.com origem inválida", sellerCep);
      return { quotes: [], error: "CEP de origem inválido na configuração da loja." };
    }
    if (!destLoc || !destLoc.city) {
      return { quotes: [], error: "CEP de destino não encontrado." };
    }

    // envia.com Rate API: https://docs.envia.com/
    // Uma caixa única consolidando todos os itens (mais barato e simples).
    const baseBody = {
      origin: {
        country: "BR",
        postalCode: sellerCep,
        city: originLoc.city,
        state: originLoc.state,
      },
      destination: {
        country: "BR",
        postalCode: data.cep,
        city: destLoc.city,
        state: destLoc.state,
      },
      packages: [
        {
          content: "Bebidas",
          amount: 1,
          type: "box",
          weight: Math.max(0.3, Number(totalWeight.toFixed(3))),
          insurance: totalValue,
          declaredValue: totalValue,
          weightUnit: "KG",
          lengthUnit: "CM",
          dimensions: { length: 25, width: 20, height: 30 },
        },
      ],
      settings: { currency: "BRL" },
    };

    async function requestRate(payload: object) {
      return fetch("https://api.envia.com/ship/rate/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    }

    type RateItem = {
      carrier?: string;
      carrierDescription?: string;
      service?: string;
      serviceDescription?: string;
      totalPrice?: number;
      deliveryEstimate?: number | string;
      deliveryDate?: string;
    };
    type RateResp = {
      meta?: string;
      error?: { code?: number; description?: string; message?: string };
      data?: RateItem[];
      message?: string;
    };

    // envia.com exige shipment.carrier; consulta várias em paralelo e junta.
    const carriers = ["correios", "jadlog", "loggi", "total", "azul-cargo", "braspress", "latam-cargo"];
    const results = await Promise.all(
      carriers.map(async (carrier) => {
        try {
          const r = await requestRate({ ...baseBody, shipment: { type: 1, carrier } });
          const txt = await r.text();
          if (!r.ok) {
            console.warn(`envia.com ${carrier} http`, r.status, txt);
            return [] as RateItem[];
          }
          const j = JSON.parse(txt) as RateResp;
          if (j.error) {
            console.warn(`envia.com ${carrier} err`, j.error.message);
            return [] as RateItem[];
          }
          return j.data ?? [];
        } catch (e) {
          console.warn(`envia.com ${carrier} threw`, e);
          return [] as RateItem[];
        }
      })
    );
    const allItems = results.flat();

    if (allItems.length === 0) {
      console.error("envia.com nenhuma transportadora retornou", JSON.stringify({ carriers, cep: data.cep }));
      return { quotes: [], error: "Nenhuma transportadora atende este CEP." };
    }

    const quotes = allItems
      .map((s) => ({
        service: `${s.carrier ?? "envia"}-${s.service ?? ""}`.toLowerCase(),
        name: `${s.carrierDescription ?? s.carrier ?? ""} ${s.serviceDescription ?? s.service ?? ""}`.trim(),
        price: Number(s.totalPrice ?? 0),
        days: typeof s.deliveryEstimate === "number"
          ? s.deliveryEstimate
          : parseInt(String(s.deliveryEstimate ?? "0"), 10) || 0,
      }))
      .filter((q) => q.price > 0)
      .sort((a, b) => a.price - b.price);

    if (quotes.length === 0) {
      console.error("envia.com cotações filtradas sem preço", JSON.stringify(json));
      return { quotes: [], error: "Nenhuma transportadora retornou opções para este CEP." };
    }

    await supabaseAdmin.from("shipping_quotes").insert({ cep: data.cep, cart_hash: cartHash, quotes });

    return { quotes };
  });
