import { expect, it, vi } from "vitest";
import { pickToolsFromMcp } from "./tools";
import type { McpContext } from "@/lib/mcp/types";
import type { McpAuthResult } from "@/lib/mcp/auth";
vi.mock("@/lib/mcp/audit", () => ({ auditMcpToolCall: vi.fn() }));

it("exposes denied semantic capabilities as degraded observations in the same tool call", async () => {
  const ctx = {
    organizationId: "org",
    role: "ai_operator",
    actor: { type: "ai_agent", id: "run", agent_id: "agent" },
    apiTokenId: "token",
    requestId: "run",
    supabase: {},
  } as unknown as McpContext;
  const auth = {
    organizationId: "org",
    role: "ai_operator",
    actor: ctx.actor,
    apiTokenId: "token",
    scopes: [],
  } as McpAuthResult;
  const tools = pickToolsFromMcp({
    supabase: ctx.supabase,
    ctx,
    auth,
    toolIds: ["ontology_query"],
    handoffToolEnabled: false,
    pipelineIds: [],
    handoffSignal: { triggered: false },
  });
  const result = await tools.ontology_query!.execute!(
    { question: "quais negócios estão abertos?" },
    { toolCallId: "call", messages: [], context: {}, abortSignal: new AbortController().signal },
  );
  expect(result).toMatchObject({
    kind: "ontology_observation",
    status: "unanswerable",
    degraded: true,
    missing: ["Acesso semântico recusado."],
  });
});
