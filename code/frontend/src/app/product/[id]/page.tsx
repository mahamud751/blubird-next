"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StoreHeader } from "@/components/StoreHeader";
import { api, money } from "@/lib/api";
import type { Product, ProductList } from "@/lib/types";
import { useCart } from "@/lib/cart";

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const cart = useCart();
  const [product, setProduct] = useState<Product | null>(null); const [related, setRelated] = useState<Product[]>([]); const [qty, setQty] = useState(1); const [error, setError] = useState(""); const [added, setAdded] = useState(false);
  useEffect(() => { api<Product>(`/api/v1/products/${id}`).then((item) => { setProduct(item); return api<ProductList>(`/api/v1/products?category=${encodeURIComponent(item.category)}&limit=5`); }).then((data) => setRelated(data.items.filter((item) => String(item.id) !== id).slice(0,4))).catch((err: Error) => setError(err.message)); }, [id]);
  if (error) return <><StoreHeader/><div className="empty-state"><h1>Product not found</h1><p>{error}</p><Link href="/">Return to catalog</Link></div></>;
  if (!product) return <><StoreHeader/><div className="page-wrap"><div className="detail-skeleton"/></div></>;
  const attributes = Object.entries(product.attributes || {});
  return <><StoreHeader/><main className="page-wrap"><nav className="breadcrumbs"><Link href="/">Home</Link><span>›</span><Link href={`/?category=${product.category}`}>{product.category}</Link><span>›</span><span>{product.name}</span></nav>
    <section className="product-detail">
      <div className="product-gallery"><span className="detail-stock">{product.stock > 0 ? "✓ In stock" : "Out of stock"}</span>{product.image_url ? <img src={product.image_url} alt={product.name}/> : null}</div>
      <div className="product-info"><p className="section-kicker">{product.category} · {product.sku}</p><h1>{product.name}</h1><div className="rating">★★★★★ <span>4.9 · 32 reviews</span></div><p className="detail-price">{money(product.price_cents, product.currency)}</p><p className="detail-description">{product.description}</p>
        <div className="benefit-grid"><span><b>✓</b> Quality checked</span><span><b>↻</b> Easy returns</span><span><b>♢</b> Secure checkout</span></div>
        <div className="purchase-row"><div className="qty-step"><button onClick={() => setQty(Math.max(1,qty-1))}>−</button><span>{qty}</span><button onClick={() => setQty(Math.min(product.stock,qty+1))}>+</button></div><button className="btn-primary" disabled={!product.stock} onClick={() => { cart.add(product,qty); setAdded(true); }}>{added ? "Added to cart ✓" : "Add to cart"}</button></div>
        {added ? <Link href="/cart" className="checkout-link">View cart and checkout →</Link> : null}
        <div className="delivery-card"><b>Free standard delivery</b><span>Estimated arrival in 3–5 business days</span></div>
      </div>
    </section>
    <section className="product-tabs"><div><h2>Product details</h2><p>{product.description}</p></div><div><h2>Specifications</h2>{attributes.length ? <dl>{attributes.map(([key,value]) => <div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{String(value)}</dd></div>)}</dl> : <p>SKU {product.sku}<br/>Category {product.category}<br/>Current stock {product.stock}</p>}</div></section>
    {related.length ? <section className="related"><p className="section-kicker">You may also like</p><h2>More from {product.category}</h2><div className="related-grid">{related.map((item) => <Link key={item.id} href={`/product/${item.id}`}><img src={item.image_url} alt={item.name}/><b>{item.name}</b><span>{money(item.price_cents)}</span></Link>)}</div></section> : null}
  </main></>;
}
