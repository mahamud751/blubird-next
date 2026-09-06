"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Health, ImportReport } from "@/lib/types";
import { StoreHeader } from "@/components/StoreHeader";

const SAMPLES = [
  { href: "http://127.0.0.1:8000/sample-catalogs/import_catalog.json", label: "JSON feed" },
  { href: "http://127.0.0.1:8000/sample-catalogs/import_catalog.csv", label: "CSV feed" },
  { href: "http://127.0.0.1:8000/sample-catalogs/import_catalog.html", label: "HTML feed" },
  { href: "https://dummyjson.com/products", label: "DummyJSON" },
];

export default function OperatorPage() {
  const [url, setUrl] = useState("http://127.0.0.1:8000/sample-catalogs/import_catalog.json");
  const [dryRun, setDryRun] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api<Health>("/health").then(setHealth).catch(() => setHealth(null));
  }, [report]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("Fetching catalog…");
    setReport(null);
    try {
      const data = await api<ImportReport>("/api/v1/operator/imports", {
        method: "POST",
        body: JSON.stringify({ url, dry_run: dryRun }),
      });
      setReport(data);
      setStatus(
        data.dry_run
          ? `Dry run · ${data.source} · ${data.counts.created} new, ${data.counts.updated} updates, ${data.counts.skipped} skipped`
          : `Imported · ${data.source} · ${data.counts.created} created, ${data.counts.updated} updated, ${data.counts.skipped} skipped`,
      );
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StoreHeader active="operator" />

      <section className="relative overflow-hidden bg-espresso px-[5vw] py-16 text-cream">
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.26em] text-brass-soft">Studio</p>
        <h1 className="max-w-[16ch] text-[clamp(2.6rem,6vw,5rem)] leading-[0.95]">
          Operator import
        </h1>
        <p className="mt-5 max-w-xl text-[1.05rem] font-light leading-relaxed text-[#d7cec0]">
          Point at a catalog that already exists. JSON, CSV, and HTML tables or product cards are accepted. Upsert is by SKU — nothing else is deleted.
        </p>
      </section>

      <main className="px-[5vw] py-12">
        {health ? (
          <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Products", health.products, "Live SKUs"],
              ["Customers", health.customers, "Known accounts"],
              ["Orders", health.orders, "Placed & paid"],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="border border-line bg-cream/40 px-6 py-6">
                <div className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">{label}</div>
                <div className="serif mt-2 text-5xl leading-none">{value}</div>
                <div className="mt-3 text-[0.8rem] text-muted">{hint}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={onSubmit} className="border border-line bg-cream/40 p-7">
            <h2 className="text-3xl">Fetch a feed</h2>
            <p className="mt-2 mb-6 text-[0.95rem] leading-relaxed text-muted">
              Leave dry run on for a first look. Public smoke: DummyJSON. Local samples are served from this process.
            </p>
            <label className="grid gap-2 text-[0.75rem] uppercase tracking-[0.14em] text-muted">
              Catalog URL
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="rounded-none border border-line bg-surface px-4 py-3 text-[0.95rem] tracking-normal text-ink outline-none focus:border-espresso"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.href}
                  type="button"
                  className="chip"
                  onClick={() => setUrl(s.href)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="mt-6 flex items-center gap-3 text-[0.95rem]">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 accent-espresso"
              />
              Dry run — parse only, do not write
            </label>
            <button type="submit" className="btn-primary mt-8" disabled={busy}>
              {busy ? "Importing…" : "Run import"}
            </button>
            {status ? <p className="mt-5 text-[0.95rem] text-brass">{status}</p> : null}
          </form>

          <div>
            <h2 className="text-3xl">Report</h2>
            {!report ? (
              <p className="mt-4 text-muted">Results appear here after a fetch.</p>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["Created", report.counts.created],
                    ["Updated", report.counts.updated],
                    ["Skipped", report.counts.skipped],
                  ].map(([label, n]) => (
                    <div key={String(label)} className="bg-espresso px-4 py-4 text-cream">
                      <div className="text-[0.65rem] uppercase tracking-[0.16em] text-brass-soft">{label}</div>
                      <div className="serif mt-1 text-3xl">{n}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[0.8rem] uppercase tracking-[0.12em] text-muted">
                  Source {report.source}
                  {report.dry_run ? " · dry run" : ""}
                </p>
                {report.created.length ? (
                  <p className="mt-3 text-[0.9rem]">
                    <span className="text-muted">New SKUs </span>
                    {report.created.join(", ")}
                  </p>
                ) : null}
                {report.updated.length ? (
                  <p className="mt-2 text-[0.9rem]">
                    <span className="text-muted">Updated </span>
                    {report.updated.join(", ")}
                  </p>
                ) : null}
                <pre className="mt-5 max-h-72 overflow-auto bg-espresso p-4 text-[0.75rem] leading-relaxed text-[#efe7d8]">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
