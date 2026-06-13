import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  cartCreate,
  cartFetch,
  cartLineRemove,
  cartLineUpdate,
  cartLinesAdd,
  type ShopifyCartLine,
} from "@/lib/shopify-cart";

type AddInput = Omit<ShopifyCartLine, "lineId">;

interface CartState {
  items: ShopifyCartLine[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: AddInput) => Promise<void>;
  updateQuantity: (variantId: string, qty: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const existing = items.find((i) => i.variantId === item.variantId);
        set({ isLoading: true });
        try {
          if (!cartId) {
            const created = await cartCreate(item.variantId, item.quantity);
            if (created) {
              set({
                cartId: created.cartId,
                checkoutUrl: created.checkoutUrl,
                items: [{ ...item, lineId: created.lineId }],
              });
            }
            return;
          }
          if (existing) {
            const newQty = existing.quantity + item.quantity;
            const r = await cartLineUpdate(cartId, existing.lineId, newQty);
            if ("cartNotFound" in r && r.cartNotFound) return clearCart();
            set({
              items: get().items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: newQty } : i)),
              checkoutUrl: r.checkoutUrl ?? get().checkoutUrl,
            });
            return;
          }
          const r = await cartLinesAdd(cartId, item.variantId, item.quantity);
          if ("cartNotFound" in r && r.cartNotFound) return clearCart();
          if ("lineId" in r && r.lineId) {
            set({
              items: [...get().items, { ...item, lineId: r.lineId }],
              checkoutUrl: r.checkoutUrl ?? get().checkoutUrl,
            });
          }
        } catch (e) {
          console.error("addItem failed", e);
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, qty) => {
        if (qty <= 0) return get().removeItem(variantId);
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item || !cartId) return;
        set({ isLoading: true });
        try {
          const r = await cartLineUpdate(cartId, item.lineId, qty);
          if ("cartNotFound" in r && r.cartNotFound) return clearCart();
          set({
            items: get().items.map((i) => (i.variantId === variantId ? { ...i, quantity: qty } : i)),
            checkoutUrl: r.checkoutUrl ?? get().checkoutUrl,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item || !cartId) return;
        set({ isLoading: true });
        try {
          const r = await cartLineRemove(cartId, item.lineId);
          if ("cartNotFound" in r && r.cartNotFound) return clearCart();
          const next = get().items.filter((i) => i.variantId !== variantId);
          if (next.length === 0) clearCart();
          else set({ items: next, checkoutUrl: r.checkoutUrl ?? get().checkoutUrl });
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const cart = await cartFetch(cartId);
          if (cart === null) return;
          if (cart.totalQuantity === 0) clearCart();
        } catch (e) {
          console.error("syncCart failed", e);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "berainbow-shopify-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, cartId: s.cartId, checkoutUrl: s.checkoutUrl }),
    },
  ),
);