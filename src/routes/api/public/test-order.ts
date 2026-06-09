import { createFileRoute } from "@tanstack/react-router";
import { createOrder, payOrder } from "@/lib/checkout.functions";

export const Route = createFileRoute("/api/public/test-order")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const created = await createOrder({
            data: {
              customer: {
                email: "teste@beberainbow.com.br",
                cpf: "12345678909",
                nome: "Pedido Teste",
                telefone: "11999999999",
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
              items: [{ sku: "GIN-200-1", title: "Gin Bë Rainbow 200ml", qty: 1, unit_price: 59.9 }],
              shipping: { service: "envia-pac", name: "Correios PAC", price: 25, days: 7 },
            },
          });

          const paid = await payOrder({
            data: { orderId: created.orderId, method: "pix" },
          });

          return Response.json({ ok: true, created, paid });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});