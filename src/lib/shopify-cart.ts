import { storefrontApiRequest } from "./shopify";

export type ShopifyCartLine = {
  lineId: string;
  variantId: string;
  variantTitle: string;
  productTitle: string;
  productImage?: string;
  quantity: number;
  price: { amount: string; currencyCode: string };
};

function formatCheckoutUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("channel", "online_store");
    return u.toString();
  } catch {
    return url;
  }
}

function isCartNotFound(userErrors: Array<{ message: string }>): boolean {
  return userErrors.some((e) => /cart not found|does not exist/i.test(e.message));
}

const CART_QUERY = `
  query Cart($id: ID!) {
    cart(id: $id) { id totalQuantity checkoutUrl }
  }
`;

const CART_CREATE = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id checkoutUrl
        lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id checkoutUrl
        lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`;

const CART_LINES_UPDATE = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

const CART_LINES_REMOVE = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

type CartGql = {
  id: string;
  checkoutUrl: string;
  lines: { edges: Array<{ node: { id: string; quantity: number; merchandise: { id: string } } }> };
};

export async function cartCreate(variantId: string, quantity: number) {
  const data = await storefrontApiRequest<{ cartCreate: { cart: CartGql | null; userErrors: Array<{ message: string }> } }>(
    CART_CREATE,
    { input: { lines: [{ merchandiseId: variantId, quantity }] } },
  );
  const result = data?.data?.cartCreate;
  if (!result || result.userErrors?.length) return null;
  const cart = result.cart;
  if (!cart) return null;
  const lineId = cart.lines.edges.find((e) => e.node.merchandise.id === variantId)?.node.id;
  if (!lineId) return null;
  return { cartId: cart.id, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl), lineId };
}

export async function cartLinesAdd(cartId: string, variantId: string, quantity: number) {
  const data = await storefrontApiRequest<{ cartLinesAdd: { cart: CartGql | null; userErrors: Array<{ message: string }> } }>(
    CART_LINES_ADD,
    { cartId, lines: [{ merchandiseId: variantId, quantity }] },
  );
  const result = data?.data?.cartLinesAdd;
  const errs = result?.userErrors ?? [];
  if (isCartNotFound(errs)) return { cartNotFound: true as const };
  if (errs.length) return { error: errs[0].message };
  const cart = result?.cart;
  if (!cart) return { error: "Falha ao adicionar" };
  const lineId = cart.lines.edges.find((e) => e.node.merchandise.id === variantId)?.node.id;
  return { lineId, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl) };
}

export async function cartLineUpdate(cartId: string, lineId: string, quantity: number) {
  const data = await storefrontApiRequest<{ cartLinesUpdate: { cart: { checkoutUrl: string } | null; userErrors: Array<{ message: string }> } }>(
    CART_LINES_UPDATE,
    { cartId, lines: [{ id: lineId, quantity }] },
  );
  const errs = data?.data?.cartLinesUpdate?.userErrors ?? [];
  if (isCartNotFound(errs)) return { cartNotFound: true as const };
  if (errs.length) return { error: errs[0].message };
  return { checkoutUrl: data?.data?.cartLinesUpdate?.cart?.checkoutUrl ? formatCheckoutUrl(data.data.cartLinesUpdate.cart.checkoutUrl) : undefined };
}

export async function cartLineRemove(cartId: string, lineId: string) {
  const data = await storefrontApiRequest<{ cartLinesRemove: { cart: { checkoutUrl: string } | null; userErrors: Array<{ message: string }> } }>(
    CART_LINES_REMOVE,
    { cartId, lineIds: [lineId] },
  );
  const errs = data?.data?.cartLinesRemove?.userErrors ?? [];
  if (isCartNotFound(errs)) return { cartNotFound: true as const };
  if (errs.length) return { error: errs[0].message };
  return { checkoutUrl: data?.data?.cartLinesRemove?.cart?.checkoutUrl ? formatCheckoutUrl(data.data.cartLinesRemove.cart.checkoutUrl) : undefined };
}

export async function cartFetch(cartId: string) {
  const data = await storefrontApiRequest<{ cart: { id: string; totalQuantity: number; checkoutUrl: string } | null }>(
    CART_QUERY,
    { id: cartId },
  );
  return data?.data?.cart ?? null;
}