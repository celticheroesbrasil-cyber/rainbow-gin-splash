import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { syncMercadoPagoPayment } from "@/lib/payments.server";

export const Route = createFileRoute("/api/public/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        const webhookSecret = process.env.MP_WEBHOOK_SECRET;
        if (!accessToken) return new Response("Not configured", { status: 500 });

        const rawBody = await request.text();
        const url = new URL(request.url);
        const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
        const xRequestId = request.headers.get("x-request-id") ?? "";
        const xSignature = request.headers.get("x-signature") ?? "";

        // Validate signature only if secret configured (MP "Chave secreta")
        if (webhookSecret) {
          const parts = Object.fromEntries(
            xSignature.split(",").map((kv) => {
              const [k, v] = kv.split("=");
              return [k?.trim(), v?.trim()];
            }),
          );
          const ts = parts["ts"];
          const v1 = parts["v1"];
          if (!ts || !v1 || !dataId) {
            return new Response("Invalid signature payload", { status: 401 });
          }
          const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
          const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
          const a = Buffer.from(expected);
          const b = Buffer.from(v1);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: { type?: string; action?: string; data?: { id?: string } } = {};
        try { payload = JSON.parse(rawBody); } catch { /* MP can send empty body sometimes */ }

        const paymentId = payload?.data?.id ?? dataId;
        if (!paymentId) return new Response("ok");

        try {
          await syncMercadoPagoPayment(paymentId);
        } catch (error) {
          console.error("MP fetch failed", error);
          return new Response("ok"); // ack to avoid retries storm; we'll get re-notified
        }

        return new Response("ok");
      },
    },
  },
});
