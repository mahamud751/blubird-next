"use client";

import Link from "next/link";
import type { Customer } from "@/lib/types";
import { useCart } from "@/lib/cart";
import { useEffect, useRef, useState } from "react";

type Props = { active?: "shop" | "operator"; customers?: Customer[]; customerId?: string; onCustomer?: (id: string) => void };

function Icon({ name }: { name: "grid" | "cart" | "user" | "search" | "globe" | "camera" | "mic" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    cart: <><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z"/><circle cx="12" cy="13" r="3.5"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M9 22h6"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function StoreHeader({ active = "shop" }: Props) {
  const { count } = useCart();
  const [signedIn, setSignedIn] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { queueMicrotask(() => setSignedIn(Boolean(localStorage.getItem("blubird-customer")))); }, []);
  const publishSearch = (value: string) => { setSearchValue(value); window.dispatchEvent(new CustomEvent("store-search", { detail: value })); };
  const publishImage = (file?: File) => { if (file) window.dispatchEvent(new CustomEvent("store-image-search", { detail: file })); };
  const startVoice = () => {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => { lang: string; interimResults: boolean; start(): void; onresult: (event: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void } }).SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; start(): void; onresult: (event: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void } }).webkitSpeechRecognition;
    if (!SpeechRecognition) { window.dispatchEvent(new CustomEvent("store-search-message", { detail: "Voice search is not supported by this browser." })); return; }
    const recognition = new SpeechRecognition(); recognition.lang = "en-US"; recognition.interimResults = false; setListening(true);
    recognition.onresult = (event) => publishSearch(event.results[0][0].transcript); recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); window.dispatchEvent(new CustomEvent("store-search-message", { detail: "I couldn't hear that. Please try again." })); }; recognition.start();
  };
  return <>
    <header className="store-header">
      <div className="header-row">
        <Link href="/" className="brand" aria-label="Blubird home"><span className="brand-mark">B<span /></span><span className="brand-word">Blu<span>bird</span></span></Link>
        {active === "shop" ? <div className="header-search"><input type="search" value={searchValue} placeholder="Search products, codes, categories…" onChange={(e) => publishSearch(e.target.value)}/><input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={(e) => publishImage(e.target.files?.[0])}/><button className="search-tool" type="button" title="Search by image" aria-label="Search by image" onClick={() => fileRef.current?.click()}><Icon name="camera"/></button><button className={`search-tool ${listening ? "listening" : ""}`} type="button" title="Voice search" aria-label="Voice search" onClick={startVoice}><Icon name="mic"/></button><button className="search-submit" type="button" aria-label="Search"><Icon name="search"/><span>Search</span></button></div> : <div />}
        <nav className="header-actions">
          <Link href="/" className={active === "shop" ? "active" : ""}><Icon name="grid"/><span>Catalog</span></Link>
          <a href="/docs" target="_blank" rel="noreferrer" className="api-docs-link"><i>{"{}"}</i><span>API Docs</span></a>
          <Link href="/cart" className="cart-link"><Icon name="cart"/><span className="desktop-label">Cart</span>{count > 0 ? <b>{count}</b> : null}</Link>
          {signedIn ? <Link href="/dashboard"><Icon name="user"/><span>Dashboard</span></Link> : <Link href="/login"><Icon name="user"/><span>Login</span></Link>}
        </nav>
      </div>
      {active === "shop" ? <div className="mobile-search"><input type="search" value={searchValue} placeholder="Search products or codes…" onChange={(e) => publishSearch(e.target.value)}/><button className="search-tool" type="button" aria-label="Search by image" onClick={() => fileRef.current?.click()}><Icon name="camera"/></button><button className={`search-tool ${listening ? "listening" : ""}`} type="button" aria-label="Voice search" onClick={startVoice}><Icon name="mic"/></button><button className="search-submit" type="button" aria-label="Search"><Icon name="search"/></button></div> : null}
    </header>
    {active === "shop" ? <div className="trust-strip"><span><b>✓</b> Verified stock</span><span><b>70/30</b> flexible payment</span><span><Icon name="globe"/> Reliable delivery</span><span>Simple returns</span></div> : null}
  </>;
}
