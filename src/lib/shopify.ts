const SHOPIFY_DOMAIN = "pfrsaq-kn.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";
const SHOPIFY_STOREFRONT_TOKEN = "428a14673683823067460d8d11656ca5";
const SHOPIFY_URL = `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

const MAIN_PRODUCT_HANDLE = "gin-be-rainbow-200ml";

export type ShopifyVariant = {
  id: string;
  title: string;
  sku: string | null;
  qty: number;
  unitPrice: number;
  price: number;
  oldPrice: number | null;
  weightKg: number;
  available: boolean;
};

export type ShopifyImage = { url: string; alt: string };

export type MainProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
};

const QUERY = /* GraphQL */ `
  query MainProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      descriptionHtml
      images(first: 12) {
        edges { node { url altText } }
      }
      variants(first: 20) {
        edges {
          node {
            id
            title
            sku
            availableForSale
            weight
            weightUnit
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

type GqlVariant = {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  weight: number | null;
  weightUnit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
};

function toKg(weight: number | null, unit: string): number {
  if (!weight) return 0.4;
  switch (unit) {
    case "KILOGRAMS": return weight;
    case "GRAMS": return weight / 1000;
    case "POUNDS": return weight * 0.453592;
    case "OUNCES": return weight * 0.0283495;
    default: return weight / 1000;
  }
}

function parseQty(title: string): number {
  const m = title.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

export async function fetchMainProduct(): Promise<MainProduct | null> {
  const res = await fetch(SHOPIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query: QUERY, variables: { handle: MAIN_PRODUCT_HANDLE } }),
  });
  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
  const json = await res.json() as {
    data?: {
      product: null | {
        id: string; title: string; handle: string; descriptionHtml: string;
        images: { edges: Array<{ node: { url: string; altText: string | null } }> };
        variants: { edges: Array<{ node: GqlVariant }> };
      };
    };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join("; "));
  const p = json.data?.product;
  if (!p) return null;

  const variants: ShopifyVariant[] = p.variants.edges.map(({ node }) => {
    const price = parseFloat(node.price.amount);
    const oldPrice = node.compareAtPrice ? parseFloat(node.compareAtPrice.amount) : null;
    const qty = parseQty(node.title);
    return {
      id: node.id,
      title: node.title,
      sku: node.sku,
      qty,
      unitPrice: qty > 0 ? price / qty : price,
      price,
      oldPrice,
      weightKg: toKg(node.weight, node.weightUnit),
      available: node.availableForSale,
    };
  });

  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.descriptionHtml,
    images: p.images.edges.map((e) => ({ url: e.node.url, alt: e.node.altText ?? p.title })),
    variants,
  };
}

import { queryOptions } from "@tanstack/react-query";
export const mainProductQuery = queryOptions({
  queryKey: ["shopify", "product", MAIN_PRODUCT_HANDLE],
  queryFn: fetchMainProduct,
  staleTime: 60_000,
});