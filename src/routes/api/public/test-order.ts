import { createFileRoute } from "@tanstack/react-router";
import { createOrder, payOrder } from "@/lib/checkout.functions";
import { createShopifyOrderFromSupabase } from "@/lib/shopify-orders.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/test-order")({
  server: {
    handlers: {
      POST: async () => {
        try {
          process.env.SITE_URL = "https://rainbow-gin-splash.lovable.app";
          const created = await createOrder({
            data: {
              customer: {
                email: "teste@beberainbow.com.br",
                cpf: "12345678909",
                nome: "Pedido Teste",
                telefone: `119${Math.floor(10000000 + Math.random() * 89999999)}`,
              },
              address: {
                cep: "01310100",
                rua: "Av Paulista",
                numero: "1000",
                complemento: "",
                bairro: "Bela Vista",
                cidade: "São Paulo",
                uf: "SP",
              },
              items: [{ sku: "GIN-BE-RAINBOW-200ML-1UN", title: "Gin Bë Rainbow 200ml", qty: 1, unit_price: 39.9 }],
              shipping: { service: "envia-pac", name: "Correios PAC", price: 25, days: 7 },
            },
          });

          const paid = await payOrder({
            data: { orderId: created.orderId, method: "pix" },
          });

          // Force mark as paid + push to Shopify (test only)
          await supabaseAdmin.from("orders").update({ status: "paid" }).eq("id", created.orderId);
          const shopify = await createShopifyOrderFromSupabase(created.orderId, paid.paymentId);

          return Response.json({ ok: true, created, paid, shopify });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});