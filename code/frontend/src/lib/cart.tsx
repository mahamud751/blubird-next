"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";

export type CartItem = { product: Product; quantity: number };
type CartContextValue = {
  items: CartItem[]; count: number; subtotal: number;
  add: (product: Product, quantity?: number) => void;
  update: (productId: number, quantity: number) => void;
  remove: (productId: number) => void; clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { queueMicrotask(() => { try { setItems(JSON.parse(localStorage.getItem("blubird-cart") || "[]")); } catch {} setReady(true); }); }, []);
  useEffect(() => { if (ready) localStorage.setItem("blubird-cart", JSON.stringify(items)); }, [items, ready]);
  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0),
    add(product, quantity = 1) { setItems((current) => current.some((item) => item.product.id === product.id) ? current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(product.stock, item.quantity + quantity) } : item) : [...current, { product, quantity: Math.min(product.stock, quantity) }]); },
    update(productId, quantity) { setItems((current) => current.map((item) => item.product.id === productId ? { ...item, quantity: Math.max(1, Math.min(item.product.stock, quantity)) } : item)); },
    remove(productId) { setItems((current) => current.filter((item) => item.product.id !== productId)); },
    clear() { setItems([]); },
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() { const value = useContext(CartContext); if (!value) throw new Error("useCart must be used within CartProvider"); return value; }
