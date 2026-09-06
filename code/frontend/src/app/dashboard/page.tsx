"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreHeader } from "@/components/StoreHeader";
import { api, money } from "@/lib/api";
import type { Customer, Order } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("blubird-customer");
    if (!id) { router.replace("/login"); return; }
    Promise.all([api<Customer>(`/api/v1/customers/${id}`), api<Order[]>(`/api/v1/customers/${id}/orders`)])
      .then(([account, history]) => { setCustomer(account); setOrders(history); })
      .catch(() => { localStorage.removeItem("blubird-customer"); router.replace("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  function signOut() { localStorage.removeItem("blubird-customer"); router.push("/login"); }
  if (loading || !customer) return <><StoreHeader/><main className="page-wrap"><div className="detail-skeleton"/></main></>;
  const totalSpent = orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.total_cents, 0);
  const activeOrders = orders.filter((order) => order.status === "placed" || order.status === "paid").length;

  return <><StoreHeader/><main className="page-wrap dashboard-page">
    <section className="dashboard-welcome"><div><p className="section-kicker">My account</p><h1>Hello, {customer.name.split(" ")[0]}!</h1><p>Manage your orders and continue discovering products you’ll love.</p></div><button onClick={signOut}>Sign out</button></section>
    <section className="dashboard-stats"><article><span>Orders placed</span><b>{orders.length}</b><small>All-time orders</small></article><article><span>Active orders</span><b>{activeOrders}</b><small>Currently processing</small></article><article><span>Total purchased</span><b>{money(totalSpent)}</b><small>Excluding cancellations</small></article></section>
    <div className="dashboard-grid"><section className="dashboard-panel"><header><div><p className="section-kicker">Recent activity</p><h2>Latest orders</h2></div><Link href="/orders">View all →</Link></header>{orders.length ? orders.slice(0,3).map((order) => <Link href="/orders" className="dashboard-order" key={order.id}><div><b>Order #{order.id}</b><span>{new Date(order.created_at).toLocaleDateString()} · {order.items.length} items</span></div><strong>{money(order.total_cents)}</strong><span className={`status-pill ${order.status}`}>{order.status}</span></Link>) : <div className="dashboard-empty"><p>No orders yet.</p><Link href="/">Start shopping</Link></div>}</section>
      <aside className="dashboard-side"><section><p className="section-kicker">Profile</p><h2>{customer.name}</h2><p>{customer.email}</p><small>Customer since {new Date(customer.created_at).toLocaleDateString()}</small></section><nav><Link href="/">Browse products <span>→</span></Link><Link href="/cart">Shopping cart <span>→</span></Link><Link href="/orders">Order history <span>→</span></Link><Link href="/operator">Store operator <span>→</span></Link></nav></aside>
    </div>
  </main></>;
}
