/** Actual planner/contract checks against the disposable control DB, never the live eval DB. */
import pg from "pg";
import { execFileSync } from "node:child_process";
import { executeWithIdentity } from "@/lib/ontology/read-plan-internal";
import { planQuery } from "@/lib/ontology/query-plan";
import { getOntology } from "@/lib/ontology/versions";
import { validateOntology } from "@/lib/ontology/contract";

const [kind, mutation] = process.argv.slice(2);
if (
  !["relation", "tenant", "certification"].includes(kind ?? "") ||
  !["normal", "mutated"].includes(mutation ?? "")
)
  throw new Error(
    "usage: ontology-eval-mutation-check relation|tenant|certification normal|mutated",
  );
const url = new URL(process.env.SUPABASE_DB_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55322")
  throw new Error("dedicated_loopback_required");
if (
  execFileSync("docker", ["port", "supabase_db_ontology-eval-36", "5432/tcp"], {
    encoding: "utf8",
  }).trim() !== "127.0.0.1:55322"
)
  throw new Error("control_stack_required");
url.pathname = "/ontology_eval_control_36";
const pool = new pg.Pool({ connectionString: url.href, max: 2 });
async function main() {
  if (kind === "certification") {
    const catalog = getOntology("1.0.0");
    if (mutation === "mutated") {
      const metric = catalog.metrics.find((item) => item.id === "high_value")!;
      metric.origin = "model";
      metric.status = "certified";
    }
    validateOntology(catalog);
    return;
  }
  const result = await pool.query<{ org: string; actor: string }>(
    `select o.id org, u.id actor from public.organizations o cross join auth.users u where o.slug='e2e-test-org' and u.email='e2e-manager@pi-native.test'`,
  );
  const identity = result.rows[0];
  if (!identity) throw new Error("synthetic_identity_missing");
  const org =
    kind === "tenant" && mutation === "mutated"
      ? "36000000-0000-4000-8000-000000000002"
      : identity.org;
  const plan = planQuery(
    kind === "relation" ? "Quais tarefas sem prazo?" : "Quais negócios estão abertos?",
  );
  if (!plan) throw new Error("plan_missing");
  const observed = await executeWithIdentity(pool, plan, {
    userId: identity.actor,
    organizationId: org,
    aal: "aal1",
  });
  const ids = observed.rows.map((row) => row.id);
  if (
    kind === "relation" &&
    (!ids.includes("36000006-0000-4000-8000-000000000001") ||
      ids.includes("36000006-0000-4000-8000-000000000002") ||
      !observed.receipt.partial)
  )
    throw new Error("relation_assertion_failed");
  if (
    kind === "tenant" &&
    (!ids.includes("36000004-0000-4000-8000-000000000001") ||
      ids.includes("36000004-0000-4000-8000-000000000009"))
  )
    throw new Error("tenant_assertion_failed");
}
main()
  .then(() => {
    process.stdout.write("check_pass\n");
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "check_failed"}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
