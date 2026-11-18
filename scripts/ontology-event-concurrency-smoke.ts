/** Real Supabase/PG stress, including Mission cancellation; no model call or CRM write. */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { appendWorkbenchEvent, type CrmAgentEventType } from "@/lib/ai/agents/workbench-events";

async function main() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.hostname !== "127.0.0.1" || url.port !== "55321")
    throw new Error("dedicated_loopback_required");
  const admin = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "e2e-test-org")
    .single();
  if (orgError || !org) throw new Error("synthetic_org_missing");
  const { data: agent, error: agentError } = await admin
    .from("ai_agents")
    .select("id")
    .eq("organization_id", org.id)
    .eq("builtin_key", "crm_intelligence")
    .single();
  if (agentError || !agent) throw new Error("synthetic_agent_missing");
  const { data: member, error: memberError } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", org.id)
    .eq("role", "manager")
    .is("revoked_at", null)
    .single();
  if (memberError || !member) throw new Error("synthetic_manager_missing");
  const missionId = randomUUID(),
    runId = randomUUID();
  const mission = await admin.from("ai_missions").insert({
    id: missionId,
    organization_id: org.id,
    lead_id: "36000004-0000-4000-8000-000000000001",
    actor_user_id: member.user_id,
    goal: "synthetic concurrency control",
    acceptance_criteria: "synthetic",
    status: "running",
  });
  if (mission.error) throw new Error("control_mission_create_failed");
  const inserted = await admin.from("ai_workbench_runs").insert({
    id: runId,
    organization_id: org.id,
    agent_id: agent.id,
    actor_user_id: member.user_id,
    mission_id: missionId,
    task: "synthetic event concurrency control",
    mode: "inspect",
    status: "running",
  });
  if (inserted.error) throw new Error("control_run_create_failed");
  const calls = Array.from({ length: 16 }, (_, index) => {
    const type: CrmAgentEventType =
      index === 14
        ? "human_confirmation_received"
        : index === 15
          ? "run_completed"
          : "tool_started";
    return appendWorkbenchEvent(admin, {
      organizationId: org.id,
      runId,
      type,
      payload: {
        tool: index % 2 ? "ontology_query" : "crm_list_leads",
        toolCallId: String(index),
        actorUserId: member.user_id,
        status: "completed",
        apiKey: "never-record-synthetic-secret",
        rawMessage: "never-record-synthetic-body",
      },
    });
  });
  const cancellation = admin.rpc("fn_cancel_ai_mission", {
    p_org: org.id,
    p_mission: missionId,
    p_actor: member.user_id,
    p_reason: "synthetic control",
  });
  const [sequences, cancelled] = await Promise.all([Promise.all(calls), cancellation]);
  if (cancelled.error || cancelled.data !== "cancelled") throw new Error("cancel_failed");
  const persisted = await admin
    .from("ai_agent_run_events")
    .select("sequence,event_type,payload")
    .eq("organization_id", org.id)
    .eq("run_id", runId)
    .order("sequence");
  const expected = Array.from({ length: 17 }, (_, index) => index + 1);
  if (
    persisted.error ||
    JSON.stringify(persisted.data?.map((item) => item.sequence)) !== JSON.stringify(expected) ||
    new Set(sequences).size !== 16 ||
    persisted.data?.filter((item) => item.event_type === "run_cancelled").length !== 1 ||
    JSON.stringify(persisted.data).includes("never-record-synthetic")
  )
    throw new Error("event_sequence_or_redaction_failed");
  const status = await admin
    .from("ai_workbench_runs")
    .select("status")
    .eq("organization_id", org.id)
    .eq("id", runId)
    .single();
  if (status.error || status.data?.status !== "cancelled") throw new Error("cancel_state_failed");
  let denied = false;
  try {
    await appendWorkbenchEvent(admin, {
      organizationId: randomUUID(),
      runId,
      type: "tool_started",
    });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error("wrong_tenant_not_rejected");
  const next = await appendWorkbenchEvent(admin, {
    organizationId: org.id,
    runId,
    type: "tool_started",
    payload: { tool: "synthetic_after_error" },
  });
  if (next !== 18) throw new Error("event_after_error_failed");
  process.stdout.write(
    `${JSON.stringify({ runId, missionId, concurrentAppends: sequences.length, cancellationEvents: 1, contiguousThrough: next, wrongTenantRejected: denied, redaction: "pass", result: "pass" })}\n`,
  );
}
void main().catch((error: unknown) => {
  const safe =
    error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "unclassified";
  process.stderr.write(`event_concurrency_smoke_failed:${safe}\n`);
  process.exitCode = 1;
});
