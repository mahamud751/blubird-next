#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PGHOST="${POSTGRES_HOST:-127.0.0.1}"
PGPORT="${POSTGRES_PORT:-5433}"
PGUSER="${POSTGRES_USER:-blubird}"
PGPASSWORD="${POSTGRES_PASSWORD:-blubird}"
PGDATABASE="${POSTGRES_DB:-fieldwren}"
export PGPASSWORD
export DATABASE_URL="${DATABASE_URL:-postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?schema=public}"
export FIXTURES_DIR="${FIXTURES_DIR:-$ROOT/fixtures}"
export SEED_ON_START="${SEED_ON_START:-true}"
export PORT="${PORT:-8000}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://127.0.0.1:3000}"
export IMPORT_ALLOWED_HOSTS="${IMPORT_ALLOWED_HOSTS:-127.0.0.1,localhost}"

ensure_postgres() {
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
    echo "PostgreSQL already accepting connections on ${PGHOST}:${PGPORT}"
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "Starting PostgreSQL with docker compose on port ${PGPORT}…"
    docker compose up -d db
    for _ in $(seq 1 30); do
      if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
        return
      fi
      sleep 1
    done
  fi

  PG_BIN="$(dirname "$(command -v postgres || true)")"
  if [[ -z "$PG_BIN" || ! -x "$PG_BIN/postgres" ]]; then
    PG_BIN="/opt/homebrew/opt/postgresql@16/bin"
  fi
  if [[ ! -x "$PG_BIN/initdb" ]]; then
    echo "PostgreSQL is not reachable on ${PGHOST}:${PGPORT} and no local postgres/docker was found." >&2
    echo "Start Postgres yourself and set DATABASE_URL, or start Docker Desktop and re-run." >&2
    exit 1
  fi

  DATA_DIR="${PGDATA_DIR:-$HOME/.blubird-pgdata}"
  mkdir -p "$DATA_DIR"
  if [[ ! -f "$DATA_DIR/PG_VERSION" ]]; then
    echo "Initializing local PostgreSQL cluster in $DATA_DIR"
    "$PG_BIN/initdb" -D "$DATA_DIR" --username="$PGUSER" --auth=trust --no-locale --encoding=UTF8
    cat >> "$DATA_DIR/postgresql.conf" <<EOF
port = ${PGPORT}
listen_addresses = '127.0.0.1'
unix_socket_directories = '$DATA_DIR/socket'
EOF
    mkdir -p "$DATA_DIR/socket"
    cat > "$DATA_DIR/pg_hba.conf" <<'EOF'
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
EOF
  fi
  echo "Starting local PostgreSQL on ${PGHOST}:${PGPORT}"
  "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" -o "-p ${PGPORT} -h 127.0.0.1" start || true
  for _ in $(seq 1 20); do
    if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
      return
    fi
    sleep 0.5
  done
  echo "Could not start PostgreSQL. See $DATA_DIR/server.log" >&2
  exit 1
}

ensure_postgres

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE DATABASE ${PGDATABASE}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${PGDATABASE}')\gexec
SELECT 'CREATE DATABASE fieldwren_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fieldwren_test')\gexec
SQL

echo "Installing API dependencies…"
(cd "$ROOT/code/backend" && npm install)

echo "Installing storefront dependencies…"
(cd "$ROOT/code/frontend" && npm install)

echo "Prisma generate + migrate + seed…"
(
  cd "$ROOT/code/backend"
  export DATABASE_URL
  export FIXTURES_DIR
  npx prisma generate
  npx prisma migrate deploy
  npm run seed
)

API_LOG="$ROOT/code/backend/.api.log"
WEB_LOG="$ROOT/code/frontend/.web.log"
cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo "Field & Wren storefront → http://127.0.0.1:3000"
echo "Operator                → http://127.0.0.1:3000/operator"
echo "API                     → http://127.0.0.1:8000"
echo "OpenAPI / Swagger       → http://127.0.0.1:8000/docs"
echo "Health                  → http://127.0.0.1:8000/health"

(
  cd "$ROOT/code/backend"
  export DATABASE_URL FIXTURES_DIR SEED_ON_START PORT FRONTEND_ORIGIN IMPORT_ALLOWED_HOSTS
  set -a
  # shellcheck disable=SC1091
  [ -f .env ] && . ./.env
  set +a
  npx nest start --watch
) >"$API_LOG" 2>&1 &
API_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:${PORT}/health" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API failed to start. Last log:" >&2
    tail -40 "$API_LOG" >&2
    exit 1
  fi
  sleep 0.5
done

(
  cd "$ROOT/code/frontend"
  export API_ORIGIN="http://127.0.0.1:${PORT}"
  npx next dev --hostname 127.0.0.1 --port 3000
) >"$WEB_LOG" 2>&1 &
WEB_PID=$!

wait "$API_PID" "$WEB_PID"
