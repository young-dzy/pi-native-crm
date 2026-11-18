import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; value: Record<string, unknown> }>,
  mode: "draft" as "draft" | "new" | "old_default",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let fields = "";
      const builder = {
        select: (value: string) => {
          fields = value;
          return builder;
        },
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (value: Record<string, unknown>) => {
          fixture.writes.push({ table, value });
          return builder;
        },
        insert: (value: Record<string, unknown>) => {
          fixture.writes.push({ table, value });
          return builder;
        },
        maybeSingle: async () => {
          if (table === "organizations")
            return {
              data: { settings: { llm: { provider: "openrouter", default_model: "test" } } },
              error: null,
            };
          if (table === "ai_agents")
            return { data: { id: "agent", builtin_revision: 0 }, error: null };
          if (table === "ai_models")
            return { data: { supports_tools: true, deprecated_at: null }, error: null };
          if (table === "ai_agent_versions" && fields.includes("version_number"))
            return {
              data:
                fixture.mode !== "new"
                  ? {
                      id: "draft",
                      status: "draft",
                      version_number: 1,
                      system_prompt: "custom",
                      tool_ids:
                        fixture.mode === "old_default"
                          ? [
                              "crm_search_contacts",
                              "crm_get_contact",
                              "crm_list_leads",
                              "crm_get_lead",
                              "crm_list_conversations",
                              "crm_get_conversation_history",
                              "crm_search_knowledge",
                              "crm_get_org_memory",
                            ]
                          : ["custom_tool"],
                      knowledge_source_ids: [],
                      max_steps: 1,
                      token_budget: 1,
                      cost_budget_cents: 1,
                    }
                  : null,
              error: null,
            };
          return { data: null, error: null };
        },
        then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
      };
      return builder;
    },
  }),
}));
import { ensureBuiltinAgents } from "./ensure-builtins";

beforeEach(() => {
  fixture.writes = [];
  fixture.mode = "draft";
});

it("synchronizes existing builtin drafts with the canonical tool set", async () => {
  await ensureBuiltinAgents("org");
  const drafts = fixture.writes.filter((write) => write.table === "ai_agent_versions");
  expect(drafts.length).toBe(4);
  expect(drafts[0]!.value.tool_ids).toEqual(
    expect.arrayContaining([
      "ontology_search_terms",
      "ontology_check_answerable",
      "ontology_query",
    ]),
  );
});

it("includes all three ontology tools in the default drafts of the three CRM agents", async () => {
  fixture.mode = "new";
  await ensureBuiltinAgents("org");
  const versions = fixture.writes.filter((write) => write.table === "ai_agent_versions");
  expect(versions).toHaveLength(4);
  for (const index of [0, 1, 3]) {
    expect(versions[index]!.value.tool_ids).toEqual(
      expect.arrayContaining([
        "ontology_search_terms",
        "ontology_check_answerable",
        "ontology_query",
      ]),
    );
  }
});
