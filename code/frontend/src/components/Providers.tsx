"use client";
import { CartProvider } from "@/lib/cart";
export function Providers({ children }: { children: React.ReactNode }) { return <CartProvider>{children}</CartProvider>; }
