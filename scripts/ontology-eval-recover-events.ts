/** Recover safe persisted events for failed runs into a separate immutable sidecar. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const [rawPath, outputPath] = process.argv.slice(2);
if (!rawPath || !outputPath || rawPath === outputPath)
  throw new Error("usage: ontology-eval-recover-events <raw.jsonl> <new-sidecar.json>");
if (
  execFileSync("docker", ["port", "supabase_db_ontology-eval-36", "5432/tcp"], {
    encoding: "utf8",
  }).trim() !== "127.0.0.1:55322"
)
  throw new Error("dedicated_loopback_required");
const rawBytes = readFileSync(rawPath);
const rows = rawBytes
  .toString()
  .trim()
  .split("\n")
  .map(
    (line) => JSON.parse(line) as { id?: string; arm?: string; failure?: string; runId?: string },
  );
const failures = rows.filter((row) => row.failure && row.runId);
const recovered = failures.map((row) => {
  if (!/^[0-9a-f-]{36}$/i.test(row.runId!)) throw new Error("invalid_run_id");
  const sql = `select jsonb_build_object('runId',r.id,'runStatus',r.status,'errorCode',r.error_code,'job',(select jsonb_build_object('status',j.status,'attempts',j.attempts,'lastError',j.last_error) from job_queue j where j.payload->>'runId'=r.id::text limit 1),'events',(select coalesce(jsonb_agg(jsonb_build_object('event_type',e.event_type,'payload',case when e.event_type='tool_started' then jsonb_build_object('tool',e.payload->>'tool','toolCallId',e.payload->>'toolCallId') else e.payload end) order by e.sequence),'[]'::jsonb) from ai_agent_run_events e where e.run_id=r.id and e.event_type in ('tool_started','usage_reported'))) from ai_workbench_runs r where r.id='${row.runId}'::uuid`;
  const value = execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_ontology-eval-36",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atc",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
  if (!value) throw new Error("run_receipt_missing");
  return { id: row.id, arm: row.arm, ...JSON.parse(value) };
});
writeFileSync(
  outputPath,
  `${JSON.stringify({ rawPath: resolve(rawPath), rawSha256: createHash("sha256").update(rawBytes).digest("hex"), capturedAt: new Date().toISOString(), recovered }, null, 2)}\n`,
  { flag: "wx", mode: 0o600 },
);
