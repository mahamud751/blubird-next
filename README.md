# Field & Wren

Take-home for BluBird Interactive, rebuilt as **Next.js 16.3.3 + NestJS + Prisma + PostgreSQL**. Four tasks, `task-0` through `task-3`. Demo merchant: **Field & Wren**, a twelve-product shop. Prices are integer cents. Customer identity is email.

## How to run

The single command is in [RUN.md](RUN.md):

```bash
./start.sh
```

Then open http://127.0.0.1:3000 (storefront), http://127.0.0.1:3000/operator (bulk import), http://127.0.0.1:8000/docs (Swagger / OpenAPI).

Public repository: [REPO_URL.txt](REPO_URL.txt).

Seed catalog, three customers (`ada@example.com`, `sam@example.com`, `kai@example.com`), and two orders load automatically from `fixtures/` when the product table is empty.

## Stack

| Layer | Choice |
| --- | --- |
| Storefront | Next.js **16.3.3** (App Router, React 19, Tailwind 4) |
| API | NestJS 11 on Express |
| ORM | Prisma 6 |
| Database | PostgreSQL 16, local on `127.0.0.1:5433` |
| Docs | Swagger UI at `/docs` |
| Assistant | xAI `grok-4.6` via the OpenAI-compatible API |

## Task 0 — Foundation

HTTP API plus a storefront.

| Resource | What you can do |
| --- | --- |
| Products | list (search / category / in-stock), get, create, patch |
| Customers | list, get, create, list orders |
| Orders | place, get, cancel (restores stock) |

Invariants:

- Unique SKU, unique customer email (stored lowercase)
- `price_cents >= 0`, `stock >= 0`, quantity 1–99, at most 20 lines
- Orders snapshot SKU, name, and unit price; later catalog edits do not rewrite history
- Stock decrements with `UPDATE ... WHERE stock >= qty` so a concurrent oversell fails instead of going negative
- Duplicate lines in one request are merged before the stock check
- Cancel is blocked once an order is shipped or already cancelled

## Task 1 — Catalog assistant

`POST /api/v1/assistant/chat` answers questions from the live product table.

- Small catalogs (≤ 20 SKUs) are sent in full, ranked by lexical overlap. Larger catalogs send the top 12 matches.
- Product text is HTML-escaped inside `<catalog>`. The system prompt treats that block as untrusted data.
- History may only contain `user` and `assistant` turns. A `system` role is rejected.
- No model key → `503 MODEL_UNAVAILABLE`. Tests inject a fake client and never call the network.

## Task 2 — Search, orders, and checkout in chat

The same chat endpoint grows tools. The server executes them. The model never writes stock or prices.

| Tool | Effect |
| --- | --- |
| `search_products` / `get_product` | live catalog |
| `list_my_orders` / `get_order` | only the identified customer's orders |
| `quote_order` | prices from the database; does not write |
| `place_order` | writes only when `confirm` is exactly `true` |

Identity is the `customer_email` field on the HTTP body. `get_order` for another customer returns `NOT_YOURS` with no line items. Extra tool fields such as `unit_price_cents` are ignored.

The storefront sends the selected customer's email with every chat turn. Demo as Ada to see her existing paid order.

## Task 3 — Operator import from a URL

`POST /api/v1/operator/imports` with `{"url": "...", "dry_run": true|false}`.

Accepted shapes: JSON list or `{products|items|data: [...]}` (including DummyJSON), CSV with a header row, HTML tables, and HTML product cards (`data-sku`, `.product`). Upsert is by SKU. Import is additive; SKUs that are not in the file are left alone.

Bundled feeds, also served from this process:

- http://127.0.0.1:8000/sample-catalogs/import_catalog.json
- http://127.0.0.1:8000/sample-catalogs/import_catalog.csv
- http://127.0.0.1:8000/sample-catalogs/import_catalog.html

Public smoke URL: `https://dummyjson.com/products` (dry-run first).

Fetch policy:

- `http` / `https` only; credentials in the URL are rejected
- DNS is resolved and private, loopback, link-local, and multicast addresses are refused
- `169.254.169.254` and cloud metadata hostnames are refused even if named in the allowlist
- Redirects are followed at most three times and re-checked
- Body cap 2 MB, 500 products, 12 s timeout
- `IMPORT_ALLOWED_HOSTS` (default `127.0.0.1,localhost`) is the only way to import the bundled sample feeds during a local demo

## Assumptions

- PostgreSQL is the system of record. The assignment is about shape and behavior; a single local instance is enough.
- One currency in the seed catalog (USD). The column exists so an importer can carry other ISO codes.
- A customer must already exist before an order is placed. There is no guest checkout.
- `price` without a `_cents` suffix is treated as dollars (`19.99` → 1999). `price_cents` is integer cents.
- The HTML importer is best-effort over tables and common product-card markup, not a general browser.
- Time is self-reported in this file.

## Exclusions

- Payments, tax, shipping addresses, carts, sessions, operator login
- Streaming chat
- Replacing the whole catalog from a feed (import is upsert-by-SKU, not a sync)
- Headless Chrome for JavaScript-only storefronts

## Incomplete work

None of the four tasks is stubbed. Residual risk: DNS rebinding against a public hostname that later resolves private. The importer re-validates each redirect hop but does not pin the IP on the TCP connection.

## Third-party services

| Provider | Purpose | Task |
| --- | --- | --- |
| Local PostgreSQL 16 | durable catalog / orders | 0 |
| Google Fonts (Newsreader, Public Sans) via `next/font` | storefront type | 0+, optional; fonts self-host at build time |
| xAI (`https://api.x.ai/v1`, model `grok-4.6`) | assistant | 1–2 |
| DummyJSON (`https://dummyjson.com/products`) | optional public import demo | 3, optional |

Any OpenAI-compatible key works (`OPENAI_API_KEY` + `OPENAI_BASE_URL`). The default is xAI via `XAI_API_KEY`. Model keys are not committed; they are not placed in `.env` either (the zip guideline reserves `.env` for non-model keys such as `DATABASE_URL`).

## Tests

```bash
cd code/backend
npm test
```

The suite includes adversarial cases: SQL injected into search, oversell, prompt injection, poisoned product descriptions, foreign-order reads, invented tool prices, `file://` and metadata URLs, redirect-to-metadata, and oversized import bodies.

## Time spent

- Task 0: 2 h 40 m (NestJS + Prisma + Next.js storefront)
- Task 1: 1 h 20 m
- Task 2: 1 h 45 m
- Task 3: 2 h 05 m
- Total: 7 h 50 m (under the 12 h envelope; these are the real times)

## Layout

```
REPO_URL.txt
README.md
RUN.md
start.sh
docker-compose.yml
fixtures/          seed data and sample import feeds
tests/             Jest + Supertest, including adversarial cases
transcripts/       raw assistant logs with tool output, one file per task
code/backend/     NestJS + Prisma
code/frontend/     Next.js 16.3.3 storefront
```
