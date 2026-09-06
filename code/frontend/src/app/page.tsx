"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import type { ChatTurn, ChatResponse, Customer, Order, Product, ProductList } from "@/lib/types";
import { StoreHeader } from "@/components/StoreHeader";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { findVisualMatches } from "@/lib/image-search";

export default function StorefrontPage() {
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [priceLimit, setPriceLimit] = useState("");
  const [sort, setSort] = useState("featured");
  const [visualIds, setVisualIds] = useState<number[] | null>(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [imageSearching, setImageSearching] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [buyStatus, setBuyStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; text: string; meta?: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [assistantReady, setAssistantReady] = useState(false);
  const [assistantModel, setAssistantModel] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((item) => {
      const hay = `${item.name} ${item.description} ${item.sku} ${item.category}`.toLowerCase();
      return (!q || hay.includes(q)) && (!category || item.category === category) && (!stockOnly || item.stock > 0) && (!priceLimit || item.price_cents <= Number(priceLimit)) && (!visualIds || visualIds.includes(item.id));
    });
    if (visualIds) filtered.sort((a,b) => visualIds.indexOf(a.id)-visualIds.indexOf(b.id));
    else if (sort === "price-low") filtered.sort((a,b)=>a.price_cents-b.price_cents);
    else if (sort === "price-high") filtered.sort((a,b)=>b.price_cents-a.price_cents);
    else if (sort === "name") filtered.sort((a,b)=>a.name.localeCompare(b.name));
    return filtered;
  }, [products, query, category, stockOnly, priceLimit, sort, visualIds]);

  const currentCustomer = customers.find((c) => String(c.id) === customerId);

  const loadAll = useCallback(async (preferredId?: string) => {
    const [productPage, customerRows] = await Promise.all([
      api<ProductList>("/api/v1/products?limit=100"),
      api<Customer[]>("/api/v1/customers"),
    ]);
    setProducts(productPage.items);
    setCustomers(customerRows);
    const nextId = preferredId || customerId || (customerRows[0] ? String(customerRows[0].id) : "");
    if (nextId) setCustomerId(nextId);
  }, [customerId]);

  useEffect(() => {
    // Data is intentionally loaded once when the client storefront mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll()
      .catch((err: Error) => setLoadError(`Could not load catalog: ${err.message}`))
      .finally(() => setLoading(false));
    api<{ assistant?: boolean; model?: string | null }>("/health")
      .then((h) => {
        setAssistantReady(Boolean(h.assistant));
        setAssistantModel(h.model ?? null);
      })
      .catch(() => setAssistantReady(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const syncSearch = (event: Event) => setQuery((event as CustomEvent<string>).detail);
    const showMessage = (event: Event) => setSearchMessage((event as CustomEvent<string>).detail);
    const imageSearch = async (event: Event) => {
      const file = (event as CustomEvent<File>).detail; setImageSearching(true); setSearchMessage(`Analyzing ${file.name}…`); setQuery("");
      try { const matches = await findVisualMatches(file, products); const useful = matches.filter((match) => match.score >= .2).slice(0,6); setVisualIds((useful.length ? useful : matches.slice(0,4)).map((match) => match.id)); setSearchMessage(`Showing the closest visual matches for ${file.name}`); document.querySelector("#catalog")?.scrollIntoView({ behavior:"smooth" }); }
      catch (err) { setSearchMessage((err as Error).message); }
      finally { setImageSearching(false); }
    };
    window.addEventListener("store-search", syncSearch);
    window.addEventListener("store-search-message", showMessage);
    window.addEventListener("store-image-search", imageSearch);
    return () => { window.removeEventListener("store-search", syncSearch); window.removeEventListener("store-search-message", showMessage); window.removeEventListener("store-image-search", imageSearch); };
  }, [products]);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        setChatOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  async function placeOrder() {
    if (!selected || !currentCustomer) return;
    setBuyStatus("");
    try {
      const order = await api<Order>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: currentCustomer.id,
          items: [{ product_id: selected.id, quantity: qty }],
        }),
      });
      setBuyStatus(`Order #${order.id} placed · ${money(order.total_cents)}`);
      await loadAll(customerId);
      const fresh = (await api<ProductList>("/api/v1/products?limit=100")).items.find((p) => p.id === selected.id);
      if (fresh) setSelected(fresh);
    } catch (err) {
      setBuyStatus((err as Error).message);
    }
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatError("");
    setChatInput("");
    setChatLog((log) => [...log, { role: "user", text: message }]);
    setChatBusy(true);
    try {
      const response = await api<ChatResponse>("/api/v1/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          history,
          session_id: sessionId,
          customer_email: currentCustomer?.email,
        }),
      });
      setSessionId(response.session_id);
      const used = (response.tools_used || []).join(", ");
      setChatLog((log) => [...log, { role: "assistant", text: response.reply, meta: used || undefined }]);
      const next: ChatTurn[] = [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: response.reply },
      ];
      setHistory(next.length > 16 ? next.slice(next.length - 16) : next);
      await loadAll(customerId);
    } catch (err) {
      setChatError((err as Error).message);
    } finally {
      setChatBusy(false);
    }
  }

  function openProduct(item: Product) {
    setSelected(item);
    setQty(1);
    setBuyStatus("");
  }

  return (
    <>
      <StoreHeader
        active="shop"
        customers={customers}
        customerId={customerId}
        onCustomer={setCustomerId}
      />

      <section className="hero-stage" aria-label="Studio still life">
        <img
          src="/static/hero.jpg"
          alt="A quiet oak desk with a mug, lamp, notebook, and headphones"
        />
        <div className="hero-veil" />
        <div className="hero-copy">
          <p className="hero-kicker"><span>●</span> Everyday essentials, ready to ship</p>
          <h1>Better finds.<br/><span>Brighter days.</span></h1>
          <p>Discover useful, well-made goods with live stock, clear pricing, and friendly support whenever you need it.</p>
          <div className="hero-buttons"><a href="#catalog" className="btn-primary">Shop collection</a><button type="button" onClick={() => setChatOpen(true)} className="btn-light">Ask an expert <span>→</span></button></div>
          <div className="hero-stats"><span><b>12</b> curated products</span><span><b>Live</b> inventory</span><span><b>Fast</b> ordering</span></div>
        </div>
      </section>

      <main id="catalog" className="px-[5vw] pb-8 pt-14">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Popular picks</p>
            <h2 className="section-title">Explore our latest products</h2>
          </div>
          <p className="catalog-note">
            {shown.length} {shown.length === 1 ? "piece" : "pieces"}
            {category ? ` in ${category}` : ""}. Click any item to place an order as{" "}
            <span className="text-ink">{currentCustomer?.name ?? "a customer"}</span>.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU, or material"
            className="catalog-search"
          />
          <div className="category-chips">
            <button type="button" className={`chip ${category === "" ? "on" : ""}`} onClick={() => setCategory("")}>
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`chip ${category === cat ? "on" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="advanced-filters">
          <div><span>Filter results</span><label><input type="checkbox" checked={stockOnly} onChange={(e)=>setStockOnly(e.target.checked)}/> In stock only</label></div>
          <label>Price<select value={priceLimit} onChange={(e)=>setPriceLimit(e.target.value)}><option value="">Any price</option><option value="2500">Under $25</option><option value="5000">Under $50</option><option value="10000">Under $100</option></select></label>
          <label>Sort by<select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Product name</option></select></label>
          {(query || category || stockOnly || priceLimit || visualIds) ? <button onClick={()=>{setQuery("");setCategory("");setStockOnly(false);setPriceLimit("");setVisualIds(null);setSearchMessage("");}}>Clear all</button> : null}
        </div>
        {searchMessage ? <div className={`search-message ${imageSearching ? "loading" : ""}`}><span>{imageSearching ? "◌" : visualIds ? "◎" : "ⓘ"}</span>{searchMessage}{visualIds ? <button onClick={()=>{setVisualIds(null);setSearchMessage("")}}>Remove image search</button>:null}</div> : null}

        {loadError ? <p className="mb-6 text-brass">{loadError}</p> : null}

        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-ivory-2" />
                <div className="mt-4 h-3 w-16 bg-ivory-2" />
                <div className="mt-3 h-5 w-40 bg-ivory-2" />
              </div>
            ))}
          </div>
        ) : (
          <section className="product-grid" aria-live="polite">
            {shown.map((item) => (
              <article key={item.id} className="product-tile" onClick={() => openProduct(item)}>
                <div className="frame">
                  {item.image_url ? <img src={item.image_url} alt={item.name} /> : null}
                  <span className={`stock-badge ${item.stock > 0 ? "" : "out"}`}>{item.stock > 0 ? "In stock" : "Sold out"}</span>
                </div>
                <div className="mt-4">
                  <div className="product-category">{item.category}</div>
                  <h3>{item.name}</h3>
                  <div className="mt-2 flex items-baseline justify-between gap-3 text-[0.92rem]">
                    <span className="product-price">{money(item.price_cents)}</span>
                    <span className="text-[0.78rem] text-muted">
                      {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
                    </span>
                  </div>
                  <Link href={`/product/${item.id}`} className="card-details" onClick={(event) => event.stopPropagation()}>Product details <span>→</span></Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {selected ? (
        <>
          <div className="drawer-backdrop" onClick={() => setSelected(null)} />
          <aside className="drawer-panel" aria-label={selected.name}>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-5 top-4 z-10 cursor-pointer border-0 bg-transparent text-3xl leading-none text-muted"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            {selected.image_url ? (
              <img src={selected.image_url} alt={selected.name} className="block aspect-[4/5] w-full object-cover" />
            ) : null}
            <div className="px-7 pb-10 pt-6">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-brass">
                {selected.category} · {selected.sku}
              </p>
              <h2 className="mt-2 text-[2.35rem] leading-[1.05]">{selected.name}</h2>
              <p className="mt-4 text-[1.02rem] font-light leading-relaxed text-muted">{selected.description}</p>
              <div className="mt-6 flex items-baseline justify-between">
                <p className="serif text-3xl">{money(selected.price_cents)}</p>
                <p className="text-[0.8rem] uppercase tracking-[0.12em] text-muted">
                  {selected.stock > 0 ? `${selected.stock} available` : "Out of stock"}
                </p>
              </div>
              <div className="mt-7 flex items-center gap-3">
                <div className="qty-step">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={selected.stock <= 0 || qty <= 1}
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <span>{qty}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={selected.stock <= 0 || qty >= selected.stock}
                    onClick={() => setQty((n) => Math.min(selected.stock, n + 1))}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={selected.stock <= 0}
                  onClick={placeOrder}
                >
                  {selected.stock > 0 ? "Place order" : "Out of stock"}
                </button>
              </div>
              <button type="button" className="btn-secondary mt-3 w-full" disabled={selected.stock <= 0} onClick={() => { cart.add(selected, qty); setBuyStatus(`${qty} added to your cart`); }}>Add to cart</button>
              {buyStatus ? <p className="mt-4 text-[0.92rem] text-brass">{buyStatus}</p> : null}
            </div>
          </aside>
        </>
      ) : null}

      <div className="chat-dock" id="chat">
        {chatOpen ? (
          <div className="chat-panel mb-3" aria-label="Shop assistant">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-xl font-black leading-none">Blubird assistant</p>
                <p className="mt-1 text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                  {assistantReady
                    ? `Live catalog · ${assistantModel ?? "model ready"}`
                    : "Set GEMINI_API_KEY on the API"}
                </p>
              </div>
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent text-2xl text-muted"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
            <div className="flex max-h-[22rem] min-h-[12rem] flex-col gap-3 overflow-auto px-4 py-4">
              {chatLog.length === 0 ? (
                <p className="text-[0.92rem] leading-relaxed text-muted">
                  Ask about insulation, kettle capacity, or Ada’s last order. Replies come from live stock and prices.
                </p>
              ) : null}
              {chatLog.map((bubble, i) => (
                <div key={i} className={`bubble ${bubble.role}`}>
                  {bubble.text}
                  {bubble.meta ? (
                    <div className="mt-2 text-[0.62rem] uppercase tracking-[0.1em] opacity-70">{bubble.meta}</div>
                  ) : null}
                </div>
              ))}
            </div>
            <form onSubmit={sendChat} className="flex gap-2 border-t border-line p-3">
              <label className="sr-only" htmlFor="chat-input">
                Message
              </label>
              <input
                id="chat-input"
                maxLength={2000}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Does the rain shell have insulation?"
                required
                className="flex-1 rounded-full border border-line bg-ivory px-4 py-2.5 outline-none"
              />
              <button className="btn-primary px-4 py-2.5" type="submit" disabled={chatBusy}>
                {chatBusy ? "…" : "Send"}
              </button>
            </form>
            {chatError ? <p className="px-4 pb-3 text-[0.85rem] text-brass">{chatError}</p> : null}
          </div>
        ) : null}
        <button type="button" className="chat-fab" onClick={() => setChatOpen((open) => !open)}>
          <span className="chat-spark">✦</span>
          {chatOpen ? "Close" : "Need help?"}
        </button>
      </div>
    </>
  );
}
