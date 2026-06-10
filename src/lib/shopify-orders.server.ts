import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SHOP_DOMAIN = "pfrsaq-kn.myshopify.com";
const API_VERSION = "2025-07";
const STOREFRONT_TOKEN = "428a14673683823067460d8d11656ca5";

async function findExistingShopifyOrder(token: string, tag: string) {
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
      variables: { query: `tag:${tag}` },
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

async function resolveVariantIdsBySku(token: string, skus: string[]) {
  const map = new Map<string, { variantId: number; productId: number }>();
  const uniqueSkus = Array.from(new Set(skus.filter(Boolean)));
  if (uniqueSkus.length === 0) return map;

  // Use Storefront API (the Admin token doesn't have read_products scope).
  const query = uniqueSkus.map((sku) => `sku:${JSON.stringify(sku)}`).join(" OR ");

  const res = await fetch(`https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: `query ProductsBySku($query: String!) {
        products(first: 20, query: $query) {
          edges {
            node {
              id
              variants(first: 100) {
                edges { node { id sku } }
              }
            }
          }
        }
      }`,
      variables: { query },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify variant lookup ${res.status}: ${text}`);
  }

  const json = await res.json() as {
    data?: { products?: { edges?: Array<{ node?: { id?: string; variants?: { edges?: Array<{ node?: { id?: string; sku?: string } }> } } }> } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const products = json.data?.products?.edges ?? [];
  const wanted = new Set(uniqueSkus);
  for (const pe of products) {
    const productId = Number((pe.node?.id ?? "").split("/").pop());
    const variants = pe.node?.variants?.edges ?? [];
    for (const ve of variants) {
      const vn = ve.node;
      if (!vn?.sku || !vn.id) continue;
      if (!wanted.has(vn.sku)) continue;
      const variantId = Number(vn.id.split("/").pop());
      if (!variantId) continue;
      if (!map.has(vn.sku)) map.set(vn.sku, { variantId, productId });
    }
  }

  return map;
}

function toShopifyPhone(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function getOrderSyncTag(orderId: string) {
  return `lb-${orderId.replace(/-/g, "").slice(0, 24)}`;
}

export async function createShopifyOrderFromSupabase(orderId: string, mpPaymentId: string) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN ?? process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) {
    console.error("SHOPIFY_ACCESS_TOKEN missing");
    return;
  }

  const syncTag = getOrderSyncTag(orderId);
  const existingOrder = await findExistingShopifyOrder(token, syncTag);
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

  const variantMap = await resolveVariantIdsBySku(token, items.map((it) => it.sku));
  const missingSku = items.find((it) => !variantMap.get(it.sku));
  if (missingSku) {
    console.error("SKU sem variant_id no Shopify", missingSku.sku);
    throw new Error(`SKU não encontrado no Shopify: ${missingSku.sku}`);
  }

  const [firstName, ...rest] = (customer.nome ?? "").trim().split(" ");
  const lastName = rest.join(" ") || "-";
  const normalizedPhone = toShopifyPhone(customer.telefone);

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
    phone: normalizedPhone,
  };

  const noteAttributes = [
    { name: "CPF", value: customer.cpf ?? "" },
    { name: "Documento", value: customer.cpf ?? "" },
    { name: "Pedido Interno", value: orderId },
    { name: "Pagamento ID", value: mpPaymentId },
    { name: "Método de Envio", value: order.shipping_service ?? "" },
  ].filter((attribute) => attribute.value);

  const graphqlAddress = {
    firstName: firstName || "Cliente",
    lastName: lastName,
    address1: `${address.rua}, ${address.numero}`,
    address2: address.complemento ?? "",
    city: address.cidade,
    provinceCode: address.uf,
    countryCode: "BR",
    zip: address.cep,
    phone: normalizedPhone,
  };

  const shippingLines = order.shipping_cost && Number(order.shipping_cost) > 0
    ? (() => {
        const raw = order.shipping_service ?? "";
        const [slug] = raw.includes(":") ? raw.split(":") : [raw];
        const [carrier, ...rest] = slug.split("-");
        const service = rest.join("-");
        const carrierLc = (carrier || "envia").toLowerCase();
        const serviceLc = (service || "").toLowerCase();
        const code = service ? `${carrierLc}_${serviceLc}` : carrierLc;
        const title = `[Envia BR] ${carrierLc}${serviceLc ? " " + serviceLc : ""}`.trim();

        return [{
          title,
          code,
          source: "envia",
          priceSet: {
            shopMoney: {
              amount: Number(order.shipping_cost).toFixed(2),
              currencyCode: "BRL",
            },
          },
        }];
      })()
    : [];

  const orderInput = {
    email: customer.email,
    phone: normalizedPhone,
    sourceName: "shopify",
    sourceIdentifier: orderId,
    note: `Pago via Mercado Pago (payment ${mpPaymentId}). Pedido interno: ${orderId}. CPF: ${customer.cpf ?? "n/d"}`,
    customAttributes: noteAttributes.map((attribute) => ({
      key: attribute.name,
      value: attribute.value,
    })),
    financialStatus: "PAID",
    fulfillmentStatus: "UNFULFILLED",
    currency: "BRL",
    presentmentCurrency: "BRL",
    tags: [syncTag],
    customer: {
      toUpsert: {
        email: customer.email,
        firstName: firstName || "Cliente",
        lastName,
        phone: normalizedPhone,
        note: customer.cpf ? `CPF: ${customer.cpf}` : undefined,
      },
    },
    billingAddress: graphqlAddress,
    shippingAddress: graphqlAddress,
    lineItems: items.map((it) => {
      const ids = variantMap.get(it.sku)!;
      return {
        variantId: `gid://shopify/ProductVariant/${ids.variantId}`,
        productId: `gid://shopify/Product/${ids.productId}`,
        title: it.title,
        sku: it.sku,
        quantity: it.qty,
        priceSet: {
          shopMoney: {
            amount: Number(it.unit_price).toFixed(2),
            currencyCode: "BRL",
          },
        },
        requiresShipping: true,
        taxable: true,
        fulfillmentService: "manual",
      };
    }),
    shippingLines,
    transactions: [{
      kind: "SALE",
      status: "SUCCESS",
      gateway: "mercado_pago",
      amountSet: {
        shopMoney: {
          amount: Number(order.total).toFixed(2),
          currencyCode: "BRL",
        },
      },
    }],
  };

  const res = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      query: `mutation CreateOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          userErrors {
            field
            message
          }
          order {
            id
            name
            sourceName
            sourceIdentifier
            displayFinancialStatus
            displayFulfillmentStatus
            customAttributes {
              key
              value
            }
          }
        }
      }`,
      variables: {
        order: orderInput,
        options: {
          inventoryBehaviour: "DECREMENT_IGNORING_POLICY",
          sendReceipt: false,
          sendFulfillmentReceipt: false,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Shopify order create error", res.status, text);
    throw new Error(`Shopify ${res.status}: ${text}`);
  }

  const json = await res.json() as {
    data?: {
      orderCreate?: {
        order?: { id?: string; name?: string };
        userErrors?: Array<{ field?: string[]; message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join("; "));
  }

  if (json.data?.orderCreate?.userErrors?.length) {
    throw new Error(json.data.orderCreate.userErrors.map((error) => error.message).join("; "));
  }

  console.log("Shopify order created", json.data?.orderCreate?.order?.id, json.data?.orderCreate?.order?.name);
  return json;
}