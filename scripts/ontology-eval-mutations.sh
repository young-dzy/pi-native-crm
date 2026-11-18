#!/usr/bin/env bash
# Requires the separately cloned ontology_eval_control_36 database and generated test environment.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
container="supabase_db_ontology-eval-36"
[[ "$(docker port "$container" 5432/tcp)" == "127.0.0.1:55322" ]] || { echo "dedicated loopback stack required" >&2; exit 1; }
[[ "$(docker exec "$container" psql -U postgres -d postgres -Atc "select count(*) from pg_database where datname='ontology_eval_control_36'")" == 1 ]] || { echo "control database required" >&2; exit 1; }
restore_relation() {
  docker exec "$container" psql -U postgres -d ontology_eval_control_36 -v ON_ERROR_STOP=1 -q -c "update crm_tasks set contact_id='36000003-0000-4000-8000-000000000001' where id='36000006-0000-4000-8000-000000000001'" >/dev/null
}
trap restore_relation EXIT
check() { pnpm exec tsx "$root/scripts/ontology-eval-mutation-check.ts" "$1" "$2"; }
for kind in relation tenant certification; do check "$kind" normal; done
docker exec "$container" psql -U postgres -d ontology_eval_control_36 -v ON_ERROR_STOP=1 -q -c "update crm_tasks set contact_id='36000003-0000-4000-8000-000000000003' where id='36000006-0000-4000-8000-000000000001'" >/dev/null
if check relation mutated; then echo "relation mutation escaped" >&2; exit 1; fi
echo "relation_mutated_exit=1"
restore_relation
check relation normal
echo "relation_restored_exit=0"
for kind in tenant certification; do
  if check "$kind" mutated; then echo "$kind mutation escaped" >&2; exit 1; fi
  echo "${kind}_mutated_exit=1"
  check "$kind" normal
  echo "${kind}_restored_exit=0"
done
