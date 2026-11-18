#!/usr/bin/env bash
# Dedicated local Supabase for #36. Run from a disposable checkout with no .env.local.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
stack="${ONTOLOGY_EVAL_STACK_DIR:-$HOME/ontology-eval-36-stack}"
network="ontology-eval-36-loopback"
cli="${SUPABASE_CLI:-supabase}"
cli="$(command -v "$cli")" || { echo "Supabase CLI not found" >&2; exit 1; }
case "${1:-}" in
  start)
    [[ "$stack" = /* && "$stack" != "$root" && ! -e "$stack" ]] || { echo "Use a new absolute stack directory outside the checkout" >&2; exit 1; }
    [[ ! -e "$root/.env.local" && ! -e "$root/.env.e2e" ]] || { echo "Disposable checkout must not contain existing env files" >&2; exit 1; }
    [[ "$("$cli" --version 2>/dev/null | head -1)" == "2.117.0" ]] || { echo "Supabase CLI 2.117.0 required" >&2; exit 1; }
    if docker network inspect "$network" >/dev/null 2>&1 || docker inspect supabase_db_ontology-eval-36 >/dev/null 2>&1; then
      echo "Dedicated eval network or container already exists; refusing to reuse it" >&2; exit 1
    fi
    mkdir -p "$stack/supabase/migrations" "$stack/supabase/templates" "$stack/bin"
    cp "$root/supabase/config.toml" "$stack/supabase/config.toml"
    cp -R "$root/supabase/templates/." "$stack/supabase/templates/"
    python3 - "$stack/supabase/config.toml" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text().replace('project_id = "pi-native-crm"','project_id = "ontology-eval-36"').replace('5432','5532').replace('http://localhost:3000','http://localhost:3107').replace('http://localhost:3001','http://localhost:3107'); p.write_text(s)
PY
    docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$network" >/dev/null
    "$cli" start --workdir "$stack" --network-id "$network" >/dev/null 2>&1 || { echo "Supabase start failed; inspect the dedicated stack" >&2; exit 1; }
    if [[ "$(docker port supabase_db_ontology-eval-36 5432/tcp)" != "127.0.0.1:55322" || "$(docker port supabase_kong_ontology-eval-36 8000/tcp)" != "127.0.0.1:55321" ]]; then
      "$cli" stop --workdir "$stack" --network-id "$network" >/dev/null 2>&1 || true
      echo "Stack was not loopback-only; it has been stopped" >&2; exit 1
    fi
    docker exec -i supabase_db_ontology-eval-36 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema public;
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;
SQL
    docker exec -i supabase_db_ontology-eval-36 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/baseline.sql" >/dev/null
    # A private wrapper makes the existing generator select this exact stack.
    printf '#!/usr/bin/env bash\nexec %q "$@" --workdir %q --network-id %q\n' "$cli" "$stack" "$network" > "$stack/bin/supabase"
    chmod 700 "$stack/bin/supabase"
    (cd "$root" && PATH="$stack/bin:$PATH" E2E_PORT=3107 pnpm e2e:env)
    printf '\nOPENROUTER_BASE_URL=http://127.0.0.1:3425/v1\n' >> "$root/.env.e2e"
    chmod 600 "$root/.env.e2e"
    echo "Dedicated stack ready; install dependencies and seed E2E identities before the fixture."
    ;;
  stop)
    [[ -f "$stack/supabase/config.toml" ]] || { echo "Dedicated stack configuration missing" >&2; exit 1; }
    "$cli" stop --workdir "$stack" --network-id "$network" >/dev/null
    docker network rm "$network" >/dev/null 2>&1 || true
    ;;
  *) echo "usage: scripts/ontology-eval-stack.sh start|stop" >&2; exit 2 ;;
esac
