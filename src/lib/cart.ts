// Simple cart in localStorage. Single-product store for now.
export type CartItem = {
  sku: string;
  title: string;
  qty: number;
  unit_price: number;
  weight: number; // kg
};

const KEY = "berainbow_cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function setCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart:update"));
}

export function clearCart() { setCart([]); }
