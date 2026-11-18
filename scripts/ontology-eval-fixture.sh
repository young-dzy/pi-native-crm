#!/usr/bin/env bash
# Synthetic fixture on the dedicated local stack only; never reads .env files.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
container="supabase_db_ontology-eval-36"
binding="$(docker port "$container" 5432/tcp)"
if [[ "$binding" != "127.0.0.1:55322" ]]; then
  echo "Refusing non-isolated ontology eval database binding" >&2
  exit 1
fi
case "${1:-}" in
  seed|oracle|negative-controls)
    docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At < "$root/tests/fixtures/ontology-eval/$1.sql"
    ;;
  *) echo "usage: scripts/ontology-eval-fixture.sh seed|oracle|negative-controls" >&2; exit 2 ;;
esac
