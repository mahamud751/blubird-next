import Link from "next/link";

export function StoreFooter() {
  return <footer className="store-footer">
    <div className="footer-main">
      <section className="footer-brand">
        <Link href="/" className="brand"><span className="brand-mark">B<span /></span><span className="brand-word">Blu<span>bird</span></span></Link>
        <p>Thoughtful products, live inventory, and friendly support—all in one bright place.</p>
        <div className="footer-socials"><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">◎</a><a href="#" aria-label="X">𝕏</a></div>
      </section>
      <nav><h2>Shop</h2><Link href="/">All products</Link><Link href="/#catalog">Popular picks</Link><Link href="/cart">Shopping cart</Link><Link href="/checkout">Checkout</Link></nav>
      <nav><h2>My account</h2><Link href="/dashboard">Dashboard</Link><Link href="/orders">Order history</Link><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></nav>
      <nav><h2>Platform</h2><Link href="/operator">Store operator</Link><a href="/docs" target="_blank" rel="noreferrer">API documentation ↗</a><a href="mailto:support@blubird.store">Contact support</a><span>Dhaka, Bangladesh</span></nav>
    </div>
    <div className="footer-bottom"><p>© {new Date().getFullYear()} Blubird. All rights reserved.</p><div><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Returns</a></div><p className="footer-secure">🔒 Secure shopping</p></div>
  </footer>;
}
