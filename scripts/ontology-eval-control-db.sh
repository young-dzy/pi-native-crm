#!/usr/bin/env bash
# Create a disposable DB copy for destructive negative controls; never touch the live eval database.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
container="supabase_db_ontology-eval-36"
db="ontology_eval_control_36"
[[ "$(docker port "$container" 5432/tcp)" == "127.0.0.1:55322" ]] || { echo "dedicated loopback stack required" >&2; exit 1; }
[[ "$(docker exec "$container" psql -U postgres -d postgres -Atc "select count(*) from pg_database where datname='$db'")" == 0 ]] || { echo "control database exists; refusing to overwrite" >&2; exit 1; }
log="$(mktemp -t ontology-control-restore.XXXXXX)"
chmod 600 "$log"
trap 'rm -f "$log"; docker exec "$container" rm -f /tmp/ontology-eval-control.dump >/dev/null 2>&1 || true' EXIT
docker exec "$container" pg_dump -U postgres -Fc --no-owner --no-acl -f /tmp/ontology-eval-control.dump postgres
docker exec "$container" createdb -U postgres -T template0 "$db"
if docker exec "$container" pg_restore -U postgres --no-owner --no-acl -d "$db" /tmp/ontology-eval-control.dump >"$log" 2>&1; then
  echo "control_restore_exit=0"
else
  # This Supabase image refuses these two unrelated internal objects to postgres.
  errors="$(grep -c '^pg_restore: error:' "$log" || true)"
  if [[ "$errors" != 2 ]] || ! grep -q 'permission denied to set parameter "log_min_messages"' "$log" || ! grep -q 'permission denied for table secrets' "$log"; then
    echo "Unexpected restore failure; control DB retained for inspection" >&2; exit 1
  fi
  echo "control_restore_partial=2_known_internal_permission_errors"
fi
docker exec -i "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20261114100000_0412_ontology_read_role.sql" >/dev/null
echo "control_grants_applied; run ontology-eval-mutations.sh to verify the planner"
