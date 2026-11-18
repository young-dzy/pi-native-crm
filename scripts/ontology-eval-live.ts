/** Opt-in, isolated Workbench A/B. Never loads the oracle or rubric. */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { lerCreds } from "../tests/e2e/helpers/login-admin";
import { generateTotp, msUntilNextTotpWindow } from "../tests/e2e/utils/totp";
import { runWorkbenchStartJob } from "@/lib/ai/agents/workbench-start-job";
import { completeJob, failJob, type JobRow } from "@/lib/agent-engine/queue/queue";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { verifyFixture } from "@/lib/ontology/eval/verify-fixture";

const model = "codex/gpt-6-luna";
const oldTools = [
  "crm_search_contacts",
  "crm_get_contact",
  "crm_list_leads",
  "crm_get_lead",
  "crm_list_conversations",
  "crm_get_conversation_history",
  "crm_search_knowledge",
  "crm_get_org_memory",
];
const ontologyTools = [
  "ontology_search_terms",
  "ontology_check_answerable",
  "ontology_query",
  "ontology_describe_action",
  "ontology_describe_outcome",
];
const dbUrl = new URL(process.env.SUPABASE_DB_URL ?? "");
const apiUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
const gateway = new URL(process.env.OPENROUTER_BASE_URL ?? "");
for (const url of [dbUrl, apiUrl, appUrl, gateway]) {
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("loopback_required");
}
if (gateway.port !== "3425") throw new Error("approved_magpie_gateway_required");
if (dbUrl.port !== "55322" || apiUrl.port !== "55321" || appUrl.port !== "3107")
  throw new Error("dedicated_eval_ports_required");
const output = process.env.ONTOLOGY_EVAL_OUTPUT;
if (!output) throw new Error("ONTOLOGY_EVAL_OUTPUT_required");
if (existsSync(output)) throw new Error("output_already_exists");
const limit = Number(process.env.ONTOLOGY_EVAL_LIMIT ?? "44");
if (!Number.isInteger(limit) || limit < 1 || limit > 44) throw new Error("invalid_limit");
const questionBytes = readFileSync("tests/fixtures/ontology-eval/questions.json");
const manifestBytes = readFileSync("tests/fixtures/ontology-eval/manifest.json");
const manifest = JSON.parse(manifestBytes.toString()) as {
  seed: number;
  fixture_files_sha256: Record<string, string>;
};
const questionsHash = createHash("sha256").update(questionBytes).digest("hex");
if (manifest.seed !== 36 || manifest.fixture_files_sha256["questions.json"] !== questionsHash)
  throw new Error("question_manifest_mismatch");
const questions = JSON.parse(questionBytes.toString()) as {
  cases: Array<{ id: string; identity: string; question: string }>;
};
if (questions.cases.length !== 44) throw new Error("frozen_44_required");
const selectedIds = process.env.ONTOLOGY_EVAL_CASES?.split(",")
  .map((id) => id.trim())
  .filter(Boolean);
if (
  selectedIds &&
  (selectedIds.length === 0 ||
    new Set(selectedIds).size !== selectedIds.length ||
    selectedIds.some((id) => !questions.cases.some((item) => item.id === id)))
)
  throw new Error("invalid_case_selection");
const selectedCases = questions.cases
  .map((question, index) => ({ question, index }))
  .filter(({ question }) => !selectedIds || selectedIds.includes(question.id))
  .slice(0, limit);
const admin = createClient(apiUrl.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const pool = new pg.Pool({ connectionString: dbUrl.href, max: 2 });
const app = appUrl.origin;
const write = (value: unknown) =>
  appendFileSync(output, `${JSON.stringify(value)}\n`, { mode: 0o600 });

async function api(page: Page, method: "get" | "post" | "patch", path: string, data?: unknown) {
  const response = await page.request[method](
    `${app}${path}`,
    data === undefined ? undefined : { data },
  );
  const body = await response.json();
  if (!response.ok())
    throw new Error(
      `api_${method}_${path.split("/").slice(-1)[0]}_${response.status()}_${body?.error?.code ?? "failed"}`,
    );
  return body.data;
}
async function loginRole(page: Page, role: string) {
  const creds = lerCreds();
  await page.goto(`${app}/login`);
  await page.locator("#email").fill(creds.users[role]!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /登录|Entrar/ }).click();
  await page.waitForURL(/\/app(?:\/|$)/, { timeout: 45_000 });
}
async function executeJob(runId: string, orgId: string) {
  const workerId = `ontology-eval-${randomUUID()}`;
  const result = await pool.query<JobRow>(
    `update job_queue j set status='running', locked_by=$1, locked_at=now(), attempts=attempts+1
    from ai_workbench_runs r join organizations o on o.id=r.organization_id
    where j.organization_id=r.organization_id and r.organization_id=$2 and o.slug='e2e-test-org'
      and j.payload->>'runId'=r.id::text and r.id=$3 and r.mode='inspect' and r.status='queued'
      and j.status='pending' and j.kind='workbench_start' returning j.*,j.locked_at::text as claim_acquired_at`,
    [workerId, orgId, runId],
  );
  const job = result.rows[0];
  if (!job || result.rows.length !== 1) throw new Error("isolated_job_not_claimed");
  try {
    await runWorkbenchStartJob(job, pool, workerId);
    await completeJob(pool, job.id, workerId, undefined, job.claim_acquired_at);
  } catch (error: unknown) {
    await failJob(pool, job.id, workerId, new Error("ontology_eval_failed"), job.claim_acquired_at);
    const known =
      error instanceof Error &&
      [
        "ontology_forbidden",
        "ontology_timeout",
        "ontology_cancelled",
        "ontology_read_failed",
      ].includes(error.message)
        ? error.message
        : "worker_unknown";
    throw new Error(known);
  }
}
let stage = "setup";
async function main() {
  const fixtureVerification = verifyFixture(process.cwd());
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id,settings")
    .eq("slug", "e2e-test-org")
    .single();
  if (orgError || !org) throw new Error("synthetic_org_missing");
  const clean = await pool.query<{ counts: Record<string, number> }>(
    `select json_build_object(
    'workbenchRuns',(select count(*) from ai_workbench_runs where organization_id=$1),
    'agentRuns',(select count(*) from ai_agent_runs where organization_id=$1),
    'missions',(select count(*) from ai_missions where organization_id=$1),
    'orgPointers',(select count(*) from org_memory_pointers where organization_id=$1),
    'orgVersions',(select count(*) from org_memory_versions where organization_id=$1),
    'orgEntries',(select count(*) from org_memory_entries where organization_id=$1),
    'customerMemories',(select count(*) from ai_customer_memories where organization_id=$1),
    'memoryCandidates',(select count(*) from ai_customer_memory_candidates where organization_id=$1),
    'knowledgeSources',(select count(*) from ai_knowledge_sources where organization_id=$1)) as counts`,
    [org.id],
  );
  const contextCounts = clean.rows[0]?.counts;
  if (!contextCounts || Object.values(contextCounts).some((count) => Number(count) !== 0))
    throw new Error("synthetic_context_not_clean");
  const identities = await pool.query<{ role: string; user_id: string }>(
    `select m.role,m.user_id
    from public.user_organizations m join auth.users u on u.id=m.user_id
    where m.organization_id=$1 and m.revoked_at is null and
      ((m.role='manager' and u.email='e2e-manager@pi-native.test') or
       (m.role='agent' and u.email='e2e-agent@pi-native.test') or
       (m.role='viewer' and u.email='e2e-viewer@pi-native.test'))`,
    [org.id],
  );
  if (identities.rows.length !== 3 || new Set(identities.rows.map((item) => item.role)).size !== 3)
    throw new Error("synthetic_identity_mismatch");
  const identityBindings = Object.fromEntries(
    identities.rows.map((item) => [item.role, item.user_id]),
  );
  const fixtureCheck = await admin
    .from("crm_leads")
    .select("id")
    .eq("organization_id", org.id)
    .eq("id", "36000004-0000-4000-8000-000000000001")
    .maybeSingle();
  if (fixtureCheck.error || !fixtureCheck.data) throw new Error("synthetic_fixture_missing");
  const creds = JSON.parse(readFileSync(".e2e-creds.json", "utf8")) as {
    org_id: string;
    followup_agent_fixtures: { channel_session_id: string };
  };
  if (creds.org_id !== org.id) throw new Error("synthetic_org_mismatch");
  const orgId = org.id as string;
  const { data: membership } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "admin")
    .is("revoked_at", null)
    .limit(1)
    .single();
  if (!membership) throw new Error("synthetic_admin_missing");
  const modelRow = await admin.from("ai_models").upsert(
    {
      provider: "openrouter",
      model_id: model,
      display_name: "Magpie synthetic evaluation",
      supports_tools: true,
      input_price_per_million_cents: null,
      output_price_per_million_cents: null,
    },
    { onConflict: "provider,model_id" },
  );
  if (modelRow.error) throw new Error("model_setup_failed");
  const settings = org.settings as Record<string, unknown>;
  if (
    (
      await admin
        .from("organizations")
        .update({
          settings: { ...settings, llm: { provider: "openrouter", default_model: model } },
        })
        .eq("id", orgId)
    ).error
  )
    throw new Error("org_setup_failed");
  if (
    (
      await admin
        .from("channel_sessions")
        .update({ status: "WORKING" })
        .eq("organization_id", orgId)
        .eq("id", creds.followup_agent_fixtures.channel_session_id)
    ).error
  )
    throw new Error("session_setup_failed");
  const key = Buffer.from(process.env.AI_CRED_AES_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("test_cipher_key_missing");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  // The gateway accepts this local placeholder; no upstream secret is copied.
  const ciphertext = Buffer.concat([cipher.update("local-magpie-placeholder"), cipher.final()]);
  const { data: credential, error: credentialError } = await admin
    .from("ai_provider_credentials")
    .insert({
      organization_id: orgId,
      provider: "openrouter",
      label: `eval-${randomUUID()}`,
      api_key_encrypted: `\\x${ciphertext.toString("hex")}`,
      api_key_iv: `\\x${iv.toString("hex")}`,
      api_key_tag: `\\x${cipher.getAuthTag().toString("hex")}`,
      api_key_last4: "lder",
      is_active: true,
      validated_at: new Date().toISOString(),
      created_by: membership.user_id,
    })
    .select("id")
    .single();
  if (credentialError || !credential) throw new Error("test_credential_setup_failed");
  stage = "browser_launch";
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const adminPage = await browser.newPage({ baseURL: app });
    stage = "admin_login";
    try {
      const testCreds = lerCreds();
      await adminPage.goto("/login");
      await adminPage.locator("#email").fill(testCreds.users.admin!.email);
      await adminPage.locator("#password").fill(testCreds.password);
      await adminPage.getByRole("button", { name: /登录|entrar/i }).click();
      await adminPage.waitForURL(/\/login\/mfa/, { timeout: 30_000 });
      if (!testCreds.admin_totp?.secret) throw new Error("synthetic_mfa_missing");
      if (msUntilNextTotpWindow() < 3000)
        await adminPage.waitForTimeout(msUntilNextTotpWindow() + 300);
      await adminPage.locator('input[aria-label="Dígito 1"], input[aria-label="数字 1"]').click();
      await adminPage.keyboard.type(generateTotp(testCreds.admin_totp.secret), { delay: 40 });
      await adminPage.waitForURL(/\/app(?:\/|$)/, { timeout: 30_000 });
    } catch {
      process.stderr.write(`admin_login_path=${new URL(adminPage.url()).pathname}\n`);
      throw new Error("admin_login_failed");
    }
    stage = "list_builtins";
    const agents = (await api(adminPage, "get", "/api/v1/ai/agents")) as Array<{
      id: string;
      builtin_key: string;
    }>;
    const builtin = agents.find((agent) => agent.builtin_key === "crm_intelligence");
    if (!builtin) throw new Error("builtin_missing");
    const armIds: Record<string, string> = {};
    for (const arm of ["A", "B"]) {
      stage = `copy_${arm}`;
      const copy = (await api(
        adminPage,
        "post",
        `/api/v1/ai/agents/${builtin.id}/copy-builtin`,
      )) as { agent: { id: string }; version: { id: string } };
      const agentId = copy.agent.id,
        versionId = copy.version.id;
      stage = `rename_${arm}`;
      await api(adminPage, "patch", `/api/v1/ai/agents/${agentId}`, {
        name: `Ontology eval ${arm} ${randomUUID()}`,
      });
      stage = `configure_${arm}`;
      await api(adminPage, "patch", `/api/v1/ai/agents/${agentId}/versions/${versionId}`, {
        provider: "openrouter",
        model,
        credential_id: credential.id,
        channel_session_id: creds.followup_agent_fixtures.channel_session_id,
        tool_ids: arm === "A" ? oldTools : [...oldTools, ...ontologyTools],
        max_steps: 8,
        token_budget: 32000,
        cost_budget_cents: 50,
      });
      stage = `publish_${arm}`;
      await api(adminPage, "post", `/api/v1/ai/agents/${agentId}/publish`, {
        version_id: versionId,
      });
      armIds[arm] = agentId;
    }
    const pages: Record<string, Page> = {};
    for (const role of ["manager", "agent", "viewer"]) {
      stage = `login_${role}`;
      const page = await browser.newPage({ baseURL: app });
      await loginRole(page, role);
      pages[role] = page;
    }
    write({
      kind: "metadata",
      runtimeCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      harnessCommit: execFileSync("git", ["-C", join(__dirname, ".."), "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      node: process.version,
      postgres:
        (await pool.query<{ server_version: string }>("show server_version")).rows[0]
          ?.server_version ?? null,
      seed: 36,
      manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
      fixtureVerification,
      initialContextCounts: contextCounts,
      organizationId: org.id,
      identityBindings,
      questionsSha256: questionsHash,
      model,
      gateway: gateway.origin,
      provider: "openrouter",
      maxSteps: 8,
      tokenBudget: 32000,
      temperature: "provider_default",
      cost: "unknown",
      oldTools,
      ontologyTools,
      agentIds: armIds,
      limit,
      selectedCaseIds: selectedCases.map(({ question }) => question.id),
      orderPolicy: "seed36-alternate-AB-BA",
      concurrentPairs: 2,
    });
    const runPair = async (question: (typeof questions.cases)[number], index: number) => {
      const order = index % 2 === 0 ? ["A", "B"] : ["B", "A"];
      for (const [position, arm] of order.entries()) {
        const role = question.identity.split("_")[0]!;
        const page = pages[role]!;
        const started = Date.now();
        let runId: string | undefined;
        let httpStatus: number | undefined;
        let failureStage = "request";
        try {
          const response = await page.request.post(`${app}/api/v1/ai/workbench/runs`, {
            data: {
              agentId: armIds[arm],
              task: question.question,
              mode: "inspect",
              collaboration: "disabled",
              ...(question.id === "21"
                ? { scope: { pipelineId: "36000001-0000-4000-8000-000000000001" } }
                : {}),
            },
          });
          httpStatus = response.status();
          const body = await response.json();
          if (!response.ok()) {
            write({
              id: question.id,
              arm,
              identity: question.identity,
              order: position + 1,
              startedAt: new Date(started).toISOString(),
              httpStatus: response.status(),
              response: body,
              latencyMs: Date.now() - started,
              usage: null,
              retries: null,
            });
            continue;
          }
          runId = body.data.run_id as string;
          failureStage = "worker";
          await executeJob(runId, orgId);
          failureStage = "read_run";
          const detail = await api(page, "get", `/api/v1/ai/workbench/runs/${runId}`);
          write({
            id: question.id,
            arm,
            identity: question.identity,
            order: position + 1,
            startedAt: new Date(started).toISOString(),
            runId,
            httpStatus: response.status(),
            prediction: detail,
            latencyMs: Date.now() - started,
            retries: null,
          });
        } catch (error: unknown) {
          let prediction: unknown = null;
          if (runId) {
            try {
              prediction = await api(page, "get", `/api/v1/ai/workbench/runs/${runId}`);
            } catch {
              /* Diagnostic read is optional. */
            }
          }
          const failureCode =
            error instanceof Error &&
            [
              "ontology_forbidden",
              "ontology_timeout",
              "ontology_cancelled",
              "ontology_read_failed",
              "worker_unknown",
              "isolated_job_not_claimed",
            ].includes(error.message)
              ? error.message
              : "unclassified";
          write({
            id: question.id,
            arm,
            identity: question.identity,
            order: position + 1,
            startedAt: new Date(started).toISOString(),
            ...(runId ? { runId } : {}),
            ...(httpStatus ? { httpStatus } : {}),
            prediction,
            failure: failureStage,
            failureCode,
            latencyMs: Date.now() - started,
            usage: null,
            retries: null,
          });
        }
      }
    };
    for (let index = 0; index < selectedCases.length; index += 2) {
      await Promise.all(
        selectedCases
          .slice(index, index + 2)
          .map(({ question, index: originalIndex }) => runPair(question, originalIndex)),
      );
    }
  } finally {
    await browser.close();
    await pool.end();
    await getRequestPool().end();
  }
}
void main().catch(async (error: unknown) => {
  const safeCode =
    error instanceof Error &&
    (/^api_(get|post|patch)_[a-z0-9-]+_\d{3}_[a-z0-9_]+$/i.test(error.message) ||
      [
        "synthetic_context_not_clean",
        "fixture_hash_mismatch",
        "fixture_oracle_mismatch",
        "fixture_snapshot_mismatch",
        "fixture_cardinality_mismatch",
      ].includes(error.message))
      ? error.message
      : "unclassified";
  process.stderr.write(
    `ontology_eval_setup_failed at ${stage}: ${safeCode}; no provider details or credentials logged\n`,
  );
  process.exitCode = 1;
  await Promise.allSettled([pool.end(), getRequestPool().end()]);
});
