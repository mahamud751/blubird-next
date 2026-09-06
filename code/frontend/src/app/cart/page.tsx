"use client";
import Link from "next/link";
import { StoreHeader } from "@/components/StoreHeader";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/api";

export default function CartPage() { const cart = useCart(); const shipping = cart.subtotal >= 7500 ? 0 : 795;
  return <><StoreHeader/><main className="page-wrap narrow"><nav className="checkout-steps"><b>1 <span>Cart</span></b><i/><span>2 <em>Checkout</em></span><i/><span>3 <em>Confirmation</em></span></nav><div className="page-heading"><div><p className="section-kicker">Your basket</p><h1>Shopping cart</h1></div><span>{cart.count} {cart.count === 1 ? "item" : "items"}</span></div>
    {!cart.items.length ? <div className="empty-state"><div>🛒</div><h2>Your cart is empty</h2><p>Explore the collection and add something you love.</p><Link href="/" className="btn-primary">Continue shopping</Link></div> : <div className="commerce-layout"><section className="cart-list">{cart.items.map(({product,quantity}) => <article className="cart-item" key={product.id}><Link href={`/product/${product.id}`}><img src={product.image_url} alt={product.name}/></Link><div><p className="product-category">{product.category}</p><Link href={`/product/${product.id}`}><h2>{product.name}</h2></Link><p>{product.sku} · {product.stock} available</p><div className="qty-step"><button onClick={() => cart.update(product.id,quantity-1)}>−</button><span>{quantity}</span><button onClick={() => cart.update(product.id,quantity+1)}>+</button></div></div><aside><b>{money(product.price_cents*quantity)}</b><button onClick={() => cart.remove(product.id)}>Remove</button></aside></article>)}</section><aside className="order-summary"><h2>Order summary</h2><p><span>Subtotal</span><b>{money(cart.subtotal)}</b></p><p><span>Delivery</span><b>{shipping ? money(shipping) : "Free"}</b></p><hr/><p className="summary-total"><span>Total</span><b>{money(cart.subtotal+shipping)}</b></p><Link href="/checkout" className="btn-primary">Proceed to checkout →</Link><Link href="/">← Continue shopping</Link><small>🔒 Secure checkout · Easy returns</small></aside></div>}
  </main></>;
}
