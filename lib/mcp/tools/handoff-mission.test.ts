import { beforeEach, expect, it, vi } from "vitest";
import { crmRequestHumanHandoff } from "./handoff";
import { triggerHandoff } from "@/lib/ai/handoff/orchestrator";
import { beginServiceAtOrigin } from "@/lib/atendimento/origem";

vi.mock("@/lib/ai/handoff/orchestrator", () => ({ triggerHandoff: vi.fn() }));
vi.mock("@/lib/atendimento/origem", () => ({ beginServiceAtOrigin: vi.fn(), assertServiceBoundarySupabase: vi.fn() }));
const input = { conversation_id: "conversation", reason: "requested_human", urgency: "normal" as const };
function context(leadContact: string) {
  const rows: Record<string, unknown> = {
    conversations: { id: "conversation", organization_id: "org", contact_id: "contact", channel_session_id: "channel" },
    ai_workbench_runs: { mission_id: "mission" }, ai_missions: { lead_id: "selected-lead" },
    crm_leads: { id: "selected-lead", contact_id: leadContact },
  };
  const filters: Array<[string, string, unknown]> = [];
  return { filters, ctx: { organizationId: "org", actor: { type: "user", id: "user" },
    ontologyRuntime: { workbenchRunId: "run" }, supabase: { from(table: string) {
      const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return q; },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) };
      return q;
    } } } as never };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(beginServiceAtOrigin).mockResolvedValue({ conversation_id: "conversation" } as never);
  vi.mocked(triggerHandoff).mockResolvedValue({ triggered: false, reason: "idempotent_5s" });
});
it("binds the handoff activity to the selected Mission lead rather than selecting the newest", async () => {
  const fixture = context("contact");
  await crmRequestHumanHandoff.handler(input, fixture.ctx);
  expect(triggerHandoff).toHaveBeenCalledWith(expect.objectContaining({ leadId: "selected-lead" }));
  expect(fixture.filters).toContainEqual(["crm_leads", "organization_id", "org"]);
  expect(fixture.filters).toContainEqual(["crm_leads", "id", "selected-lead"]);
});
it("rejects a changed contact before any handoff or service boundary", async () => {
  await expect(crmRequestHumanHandoff.handler(input, context("other").ctx)).rejects.toThrow("handoff_mission_scope_mismatch");
  expect(beginServiceAtOrigin).not.toHaveBeenCalled();
  expect(triggerHandoff).not.toHaveBeenCalled();
});

function contactContext(candidates: Array<Record<string, unknown>>) {
  const ctx = context("contact").ctx as { supabase: { from: (table: string) => unknown } };
  const prior = ctx.supabase.from;
  ctx.supabase.from = (table: string) => {
    if (table !== "crm_leads") return prior(table);
    const q = { select: () => q, eq: () => q, limit: async () => ({ data: candidates, error: null }) };
    return q;
  };
  delete (ctx as { ontologyRuntime?: unknown }).ontologyRuntime;
  return ctx as never;
}
const candidate = (id: string) => ({ id, organization_id: "org", pipeline_id: "pipe", status: "open", last_activity_at: null, created_at: "2026-01-01T00:00:00Z" });
it("preserves contact handoff when no lead exists and routes a single open lead", async () => {
  const none = await crmRequestHumanHandoff.handler(input, contactContext([]));
  expect(none).toMatchObject({ lead_resolution: "no_open_lead" });
  expect(triggerHandoff).toHaveBeenLastCalledWith(expect.objectContaining({ leadId: null }));
  const one = await crmRequestHumanHandoff.handler(input, contactContext([candidate("one")]));
  expect(one).toMatchObject({ lead_resolution: "resolved" });
  expect(triggerHandoff).toHaveBeenLastCalledWith(expect.objectContaining({ leadId: "one" }));
});
it("preserves contact handoff without attaching it to an arbitrary open lead", async () => {
  const result = await crmRequestHumanHandoff.handler(input, contactContext([candidate("one"), candidate("two")]));
  expect(result).toMatchObject({ lead_resolution: "ambiguous" });
  expect(triggerHandoff).toHaveBeenLastCalledWith(expect.objectContaining({ leadId: null }));
});
