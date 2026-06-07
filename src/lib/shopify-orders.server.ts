import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SHOP_DOMAIN = "pfrsaq-kn.myshopify.com";
const API_VERSION = "2025-07";

async function findExistingShopifyOrder(token: string, orderId: string) {
  const res = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      query: `query ExistingOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
            }
          }
        }
      }`,
      variables: { query: `tag:supabase-${orderId}` },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify lookup ${res.status}: ${text}`);
  }

  const json = await res.json() as {
    data?: { orders?: { edges?: Array<{ node?: { id?: string; name?: string } }> } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join("; "));
  }

  return json.data?.orders?.edges?.[0]?.node;
}

export async function createShopifyOrderFromSupabase(orderId: string, mpPaymentId: string) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN ?? process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) {
    console.error("SHOPIFY_ACCESS_TOKEN missing");
    return;
  }

  const existingOrder = await findExistingShopifyOrder(token, orderId);
  if (existingOrder?.id) {
    console.log("Shopify order already exists", existingOrder.id, existingOrder.name);
    return existingOrder;
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, subtotal, shipping_cost, shipping_service, total, customer_id, address_id")
    .eq("id", orderId)
    .single();
  if (error || !order) {
    console.error("Order not found", orderId, error);
    return;
  }

  const [{ data: customer }, { data: address }, { data: items }] = await Promise.all([
    supabaseAdmin.from("customers").select("nome, email, telefone, cpf").eq("id", order.customer_id).single(),
    supabaseAdmin.from("addresses").select("cep, rua, numero, complemento, bairro, cidade, uf").eq("id", order.address_id).single(),
    supabaseAdmin.from("order_items").select("sku, title, qty, unit_price").eq("order_id", orderId),
  ]);

  if (!customer || !address || !items?.length) {
    console.error("Missing order details", { customer, address, items });
    return;
  }

  const [firstName, ...rest] = (customer.nome ?? "").trim().split(" ");
  const lastName = rest.join(" ") || "-";

  const shippingAddress = {
    first_name: firstName || "Cliente",
    last_name: lastName,
    address1: `${address.rua}, ${address.numero}`,
    address2: address.complemento ?? "",
    city: address.cidade,
    province: address.uf,
    country: "Brazil",
    country_code: "BR",
    zip: address.cep,
    phone: customer.telefone ?? "",
  };

  const orderPayload = {
    order: {
      email: customer.email,
      phone: customer.telefone ?? undefined,
      financial_status: "paid",
      currency: "BRL",
      tags: `mp-${mpPaymentId},supabase-${orderId}`,
      note: `Pago via Mercado Pago (payment ${mpPaymentId}). CPF: ${customer.cpf ?? "n/d"}`,
      send_receipt: false,
      send_fulfillment_receipt: false,
      inventory_behaviour: "decrement_obeying_policy",
      customer: {
        first_name: firstName || "Cliente",
        last_name: lastName,
        email: customer.email,
        phone: customer.telefone ?? undefined,
      },
      billing_address: shippingAddress,
      shipping_address: shippingAddress,
      line_items: items.map((it) => ({
        title: it.title,
        sku: it.sku,
        quantity: it.qty,
        price: Number(it.unit_price).toFixed(2),
        requires_shipping: true,
      })),
      shipping_lines: order.shipping_cost && Number(order.shipping_cost) > 0
        ? [{
            title: order.shipping_service ?? "Frete",
            price: Number(order.shipping_cost).toFixed(2),
            code: order.shipping_service ?? "frenet",
          }]
        : [],
      transactions: [{
        kind: "sale",
        status: "success",
        amount: Number(order.total).toFixed(2),
        gateway: "mercado_pago",
      }],
    },
  };

  const res = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/orders.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Shopify order create error", res.status, text);
    throw new Error(`Shopify ${res.status}: ${text}`);
  }

  const json = await res.json();
  console.log("Shopify order created", json?.order?.id, json?.order?.name);
  return json;
}