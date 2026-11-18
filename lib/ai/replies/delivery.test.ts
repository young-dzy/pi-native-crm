import { describe, expect, it, vi } from "vitest";
import type { Queryable } from "@/lib/agent-engine/queue/queue";
import { StaleServiceBoundaryError } from "@/lib/atendimento/fronteira";
import { assertApprovedReplyPg } from "./delivery";

const ID = "11111111-1111-4111-8111-111111111111";
const claim = {
  organizationId: ID,
  jobId: ID,
  jobClaim: { worker_id: "worker-a", acquired_at: "2026-10-16T00:00:00.000Z" },
};

function policy(contextCurrent: boolean) {
  return {
    current: true,
    context_current: contextCurrent,
    contact_id: ID,
    conversation_id: ID,
    channel_session_id: ID,
    draft_id: ID,
    body: "报价如下",
    agent_id: ID,
  };
}

describe("approved reply delivery while a Mission send is paused", () => {
  it("refuses the provider call when the current send policy is no longer valid", async () => {
    const query = vi.fn(async () => ({ rows: [{ policy: policy(false) }] }));
    await expect(
      assertApprovedReplyPg({ query } as unknown as Queryable, claim),
    ).rejects.toBeInstanceOf(StaleServiceBoundaryError);
    expect(query).toHaveBeenCalledWith("select fn_reply_delivery_policy($1,$2,$3,$4) as policy", [
      ID,
      ID,
      "worker-a",
      "2026-10-16T00:00:00.000Z",
    ]);
  });

  it("returns the approved body only while the send policy still authorizes it", async () => {
    const query = vi.fn(async () => ({ rows: [{ policy: policy(true) }] }));
    await expect(
      assertApprovedReplyPg({ query } as unknown as Queryable, claim),
    ).resolves.toMatchObject({ context_current: true, body: "报价如下" });
  });
});
