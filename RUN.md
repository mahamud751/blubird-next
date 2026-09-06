# Run

From a clean clone or unzip, with Node 20+ and PostgreSQL 16 on `PATH` (Homebrew `postgresql@16` is fine). Docker is optional.

```bash
./start.sh
```

That single command:

1. Reuses or starts a local PostgreSQL on `127.0.0.1:5433`
2. Creates the `fieldwren` database if needed
3. Installs API and storefront dependencies
4. Runs Prisma migrations and seeds the catalog from `fixtures/`
5. Serves the NestJS API at [http://127.0.0.1:8000](http://127.0.0.1:8000) and the Next.js 16.3.3 storefront at [http://127.0.0.1:3000](http://127.0.0.1:3000)

Open:

- Storefront: http://127.0.0.1:3000
- Operator import: http://127.0.0.1:3000/operator
- OpenAPI / Swagger: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

The catalog, three customers, and two orders are already present. No extra database step is required.

## Local database

| | |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `5433` (5432 is often taken by other Postgres installs) |
| User | `blubird` |
| Password | `blubird` |
| Database | `fieldwren` |
| URL | `postgresql://blubird:blubird@127.0.0.1:5433/fieldwren?schema=public` |

Override with `DATABASE_URL` if you already have a server. A `docker-compose.yml` is included if you prefer a containerized Postgres on the same port.

Demo customers: `ada@example.com`, `sam@example.com`, `kai@example.com`. Choose Ada in the storefront to see a paid order. Paste `http://127.0.0.1:8000/sample-catalogs/import_catalog.json` on the operator page; leave dry-run on for a first look.

Stop with Ctrl+C. Deleting the `fieldwren` database and running `./start.sh` again reseeds from fixtures.

## Tests

```bash
cd code/backend
npx prisma migrate deploy
# uses fieldwren_test
TEST_DATABASE_URL="postgresql://blubird:blubird@127.0.0.1:5433/fieldwren_test?schema=public" npm test
```

Or from the repo root after `./start.sh` has installed dependencies:

```bash
cd code/backend && npm test
```

## Model key (tasks 1–3)

The shop assistant reads a model key from `code/backend/.env` (never `NEXT_PUBLIC_*`). Gemini is the default if present:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-lite-latest
```

xAI or any OpenAI-compatible key still works:

```bash
export XAI_API_KEY=...
./start.sh
```

The Next.js storefront calls `/api/v1/assistant/chat` on the Nest API. The key stays on the server.

The foundation API (task 0) runs without a key.
