import { createFileRoute } from "@tanstack/react-router";

const SHOP = "pfrsaq-kn.myshopify.com";
const V = "2025-07";

async function fetchOrder(token: string, name: string) {
  const url = `https://${SHOP}/admin/api/${V}/orders.json?name=${encodeURIComponent(name)}&status=any&limit=1`;
  const r = await fetch(url, { headers: { "X-Shopify-Access-Token": token } });
  const j = await r.json();
  return j?.orders?.[0] ?? null;
}

export const Route = createFileRoute("/api/public/debug-orders")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env.SHOPIFY_ADMIN_TOKEN ?? process.env.SHOPIFY_ACCESS_TOKEN;
        if (!token) return Response.json({ error: "no token" }, { status: 500 });
        const [o1009, o1010] = await Promise.all([
          fetchOrder(token, "#1009"),
          fetchOrder(token, "#1010"),
        ]);
        const pick = (o: any) => o && {
          id: o.id, name: o.name, source_name: o.source_name, app_id: o.app_id,
          location_id: o.location_id, financial_status: o.financial_status,
          fulfillment_status: o.fulfillment_status, test: o.test,
          gateway: o.gateway, payment_gateway_names: o.payment_gateway_names,
          tags: o.tags, confirmed: o.confirmed, processed_at: o.processed_at,
          customer_id: o.customer?.id, contact_email: o.contact_email,
          email: o.email, phone: o.phone,
          inventory_behaviour: o.inventory_behaviour,
          line_items: o.line_items?.map((li: any) => ({
            sku: li.sku, variant_id: li.variant_id, product_id: li.product_id,
            fulfillment_service: li.fulfillment_service, requires_shipping: li.requires_shipping,
            fulfillment_status: li.fulfillment_status, quantity: li.quantity,
          })),
          shipping_lines: o.shipping_lines?.map((s: any) => ({ title: s.title, source: s.source, code: s.code, price: s.price })),
          fulfillments: o.fulfillments,
        };
        return Response.json({ o1009: pick(o1009), o1010: pick(o1010) });
      },
    },
  },
});