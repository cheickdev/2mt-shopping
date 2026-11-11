"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { track, CURRENCY } from "@/lib/pixel";

export interface CartItem {
  key: string; // productId + "|" + (variantId | variant)
  productId: string;
  slug: string;
  name: string;
  price: number; // FCFA
  image: string | null;
  variant: string;
  variantId?: string | null;
  quantity: number;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  total: number;
  ready: boolean;
  add: (item: Omit<CartItem, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const STORAGE = "2mt_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Chargement depuis le navigateur au montage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* stockage indisponible : on part d'un panier vide */
    }
    setReady(true);
  }, []);

  // Sauvegarde a chaque changement.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, "key">) => {
    const key = item.productId + "|" + (item.variantId ?? item.variant);
    track("AddToCart", {
      content_ids: [item.productId],
      content_name: item.name,
      content_type: "product",
      value: item.price * item.quantity,
      currency: CURRENCY,
    });
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + item.quantity } : i));
      }
      return [...prev, { ...item, key }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: Math.max(0, qty) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);

  const value: CartCtx = { items, count, total, ready, add, setQty, remove, clear };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart doit etre utilise dans <CartProvider>");
  return ctx;
}
