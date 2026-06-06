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
    const token = process.env.FRENET_TOKEN;
    const sellerCep = process.env.FRENET_SELLER_CEP;
    if (!token || !sellerCep) throw new Error("Frenet não configurado");

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

    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 24 * 3600 * 1000) {
      return { quotes: cached.quotes as Array<{ service: string; name: string; price: number; days: number }> };
    }

    const totalWeight = data.items.reduce((s, i) => s + i.weight * i.qty, 0);
    const totalValue = data.items.reduce((s, i) => s + i.price * i.qty, 0);

    const body = {
      SellerCEP: sellerCep,
      RecipientCEP: data.cep,
      ShipmentInvoiceValue: totalValue,
      ShippingItemArray: data.items.map((i) => ({
        Height: 28,
        Length: 10,
        Width: 10,
        Weight: i.weight,
        Quantity: i.qty,
        SKU: i.sku,
      })),
      RecipientCountry: "BR",
    };

    const res = await fetch("https://api.frenet.com.br/shipping/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "token": token,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Frenet error", res.status, await res.text());
      return { quotes: [] as Array<{ service: string; name: string; price: number; days: number }>, error: "Frete indisponível" };
    }

    const json = await res.json() as { ShippingSevicesArray?: Array<{ ServiceCode: string; ServiceDescription: string; Carrier: string; ShippingPrice: string; DeliveryTime: string; Error: boolean; Msg?: string }> };

    const quotes = (json.ShippingSevicesArray ?? [])
      .filter((s) => !s.Error)
      .map((s) => ({
        service: s.ServiceCode,
        name: `${s.Carrier} ${s.ServiceDescription}`.trim(),
        price: parseFloat(String(s.ShippingPrice).replace(",", ".")),
        days: parseInt(s.DeliveryTime, 10),
      }))
      .filter((q) => q.price > 0)
      .sort((a, b) => a.price - b.price);

    await supabaseAdmin.from("shipping_quotes").insert({ cep: data.cep, cart_hash: cartHash, quotes });

    return { quotes };
  });
