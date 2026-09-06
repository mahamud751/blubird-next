import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { StoreFooter } from "@/components/StoreFooter";

export const metadata: Metadata = {
  title: "Blubird | Shop smarter",
  description: "A modern marketplace with live stock, easy ordering, and helpful product support.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="site-shell min-h-full bg-ivory text-ink"><Providers>{children}<StoreFooter /></Providers></body>
    </html>
  );
}
