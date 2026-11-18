"use client";

import { useEffect, useState, type ReactNode } from "react";

/** A message is eligible only when its run was submitted in this conversation.
 * Keep its React key stable through acknowledgement, polling and token updates.
 * The captured flag plus animation-end cleanup prevents history/rerender replay.
 */
export function WorkbenchMessage({
  animate,
  kind,
  children,
}: {
  animate: boolean;
  kind: "task" | "result";
  children: ReactNode;
}) {
  const [entering, setEntering] = useState(animate);
  useEffect(() => {
    if (!entering || typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (preference.matches) setEntering(false);
    };
    // CSS suppresses motion immediately; consume the entry on the next frame
    // so turning reduced motion off later cannot replay an old message.
    const frame = requestAnimationFrame(onChange);
    preference.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", onChange);
    };
  }, [entering]);
  const Tag = kind === "task" ? "p" : "article";
  return (
    <Tag
      data-workbench-message={kind}
      data-entering={entering || undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setEntering(false);
      }}
      className={
        kind === "task"
          ? "workbench-message ml-auto w-fit max-w-[90%] rounded-xl bg-muted px-4 py-3 text-sm break-words whitespace-pre-wrap"
          : "workbench-message rounded-lg bg-surface p-4 text-sm leading-6 break-words whitespace-pre-wrap"
      }
    >
      {children}
    </Tag>
  );
}

/** No timer, progress estimate or intermediate success state: the value is the
 * persisted run status or a canonical lifecycle event received from the server.
 */
export function WorkbenchRunStatus({ status }: { status: string }) {
  return (
    <span
      data-run-status={status}
      className="workbench-run-status inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-medium"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      运行状态：{status}
    </span>
  );
}

export function statusFromWorkbenchEvent(eventType: string): string | undefined {
  switch (eventType) {
    // run_started is the POST acknowledgement while the record is still queued.
    // The worker emits context_loaded only after claiming the persisted run.
    case "context_loaded":
    case "run_resumed":
      return "running";
    case "run_completed":
      return "completed";
    case "run_partial":
      return "partial";
    case "run_failed":
      return "failed";
    case "run_cancelled":
      return "cancelled";
    default:
      return undefined;
  }
}

/** Detail endpoints read the run and then its events. A worker can advance in
 * between those reads; reconcile only active snapshots, never a confirmed
 * terminal state; only promote queued to running, so old execution events
 * cannot replay over a newer human-approval gate.
 */
export function statusFromWorkbenchSnapshot(
  status: string,
  events: ReadonlyArray<{ event_type: string }>,
): string {
  const terminal = ["completed", "partial", "failed", "cancelled"];
  if (terminal.includes(status)) return status;
  for (const event of events) {
    const next = statusFromWorkbenchEvent(event.event_type);
    if (next && terminal.includes(next)) return next;
  }
  return status === "queued" &&
    events.some((event) => statusFromWorkbenchEvent(event.event_type) === "running")
    ? "running"
    : status;
}
