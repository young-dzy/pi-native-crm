/** Summarize saved predictions and separately attributed independent judgements. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";
import { z } from "zod";
import { summarizeCases, type ScoredCase } from "@/lib/ontology/eval/metrics";
import { verifyManifest } from "@/lib/ontology/eval/verify-fixture";

type Raw = {
  kind?: string;
  manifestSha256?: string;
  id?: string;
  arm?: string;
  identity?: string;
  httpStatus?: number;
  latencyMs?: number;
  failure?: string;
  runId?: string;
  prediction?: {
    status?: string;
    events?: Array<{ event_type: string; payload: Record<string, unknown> }>;
  };
};
const annotationSchema = z
  .object({
    id: z.string(),
    arm: z.enum(["A", "B"]),
    expectedAnswerable: z.boolean(),
    response: z.enum(["full", "partial", "refused"]).nullable(),
    conceptCorrect: z.boolean().nullable(),
    resultCorrect: z.boolean().nullable(),
    targetCorrect: z.boolean().nullable(),
    evidenceComplete: z.boolean().nullable(),
    actionOutcomeCorrect: z.boolean().nullable(),
    authorizationViolation: z.boolean().nullable(),
    latencyMs: z.number().nonnegative().nullable(),
    inputTokens: z.number().nonnegative().nullable(),
    outputTokens: z.number().nonnegative().nullable(),
    retries: z.number().nonnegative().nullable(),
    reviewer_kind: z.enum(["sql", "codex", "human"]),
    reviewer_model: z.string().nullable(),
    rubric_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    oracle_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    reason: z.string().trim().min(1),
  })
  .strict()
  .refine((item) => item.reviewer_kind !== "codex" || Boolean(item.reviewer_model))
  .refine((item) => item.reviewer_kind !== "sql" || Boolean(item.oracle_sha256));
type Annotation = ScoredCase & z.infer<typeof annotationSchema>;
const [rawPath, outputPath, annotationsPath, sidecarPath] = process.argv.slice(2);
const sourcePath = (path: string) => {
  const absolute = resolve(path);
  const local = relative(process.cwd(), absolute);
  return local && !local.startsWith("../") && local !== ".." ? local : absolute;
};
if (!rawPath || !outputPath || rawPath === outputPath)
  throw new Error(
    "usage: ontology-eval-report <raw.jsonl> <new-report.json> [independent-annotations.json] [failed-events.json]",
  );
const rawBytes = readFileSync(rawPath);
const records = rawBytes
  .toString()
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Raw);
const metadata = records.filter((item) => item.kind === "metadata");
if (metadata.length !== 1) throw new Error("one_metadata_record_required");
const verifiedManifest = verifyManifest(process.cwd());
if (metadata[0]?.manifestSha256 !== verifiedManifest.manifestSha256)
  throw new Error("raw_manifest_mismatch");
const raw = records.filter((item) => item.id && item.arm);
const scoreable = (item: Raw) =>
  item.httpStatus === 201 &&
  !item.failure &&
  ["completed", "partial"].includes(item.prediction?.status ?? "");
const keys = raw.map((item) => `${item.id}:${item.arm}`);
if (new Set(keys).size !== keys.length) throw new Error("duplicate_predictions");
const sidecarBytes = sidecarPath ? readFileSync(sidecarPath) : null;
const sidecar = sidecarBytes
  ? z
      .object({
        rawPath: z.string(),
        rawSha256: z.string(),
        capturedAt: z.string(),
        recovered: z.array(
          z.object({
            id: z.string(),
            arm: z.string(),
            runId: z.string(),
            runStatus: z.string(),
            errorCode: z.string().nullable(),
            job: z.unknown(),
            events: z.array(
              z.object({ event_type: z.string(), payload: z.record(z.string(), z.unknown()) }),
            ),
          }),
        ),
      })
      .parse(JSON.parse(sidecarBytes.toString()))
  : null;
if (
  sidecar &&
  (sidecar.rawSha256 !== createHash("sha256").update(rawBytes).digest("hex") ||
    new Set(sidecar.recovered.map((item) => `${item.id}:${item.arm}`)).size !==
      sidecar.recovered.length ||
    sidecar.recovered.some(
      (item) =>
        !raw.some(
          (row) =>
            row.id === item.id && row.arm === item.arm && row.runId === item.runId && row.failure,
        ),
    ))
)
  throw new Error("invalid_sidecar");
const annotationBytes = annotationsPath ? readFileSync(annotationsPath) : null;
const annotations: Annotation[] = annotationBytes
  ? z.array(annotationSchema).parse(JSON.parse(annotationBytes.toString()))
  : [];
const rubricHash = createHash("sha256")
  .update(readFileSync("tests/fixtures/ontology-eval/rubric.json"))
  .digest("hex");
const questions = JSON.parse(
  readFileSync("tests/fixtures/ontology-eval/questions.json", "utf8"),
) as {
  cases: Array<{ id: string; oracle: string }>;
};
const rubric = JSON.parse(readFileSync("tests/fixtures/ontology-eval/rubric.json", "utf8")) as {
  rubrics: Record<string, { answerable: boolean }>;
};
const fullAnswerable = (id: string) => {
  const item = questions.cases.find((entry) => entry.id === id);
  if (!item) throw new Error("unknown_case");
  const explicit = rubric.rubrics[item.oracle]?.answerable;
  return explicit ?? !["cross_tenant", "task_contact_scope"].includes(item.oracle);
};
const oracleHash = createHash("sha256")
  .update(readFileSync("tests/fixtures/ontology-eval/oracle.sql"))
  .digest("hex");
if (
  new Set(annotations.map((item) => `${item.id}:${item.arm}`)).size !== annotations.length ||
  annotations.some(
    (item) =>
      item.rubric_sha256 !== rubricHash ||
      item.expectedAnswerable !== fullAnswerable(item.id) ||
      (item.reviewer_kind === "sql" && item.oracle_sha256 !== oracleHash) ||
      !raw.some((row) => row.id === item.id && row.arm === item.arm && scoreable(row)),
  )
)
  throw new Error("invalid_annotation_keys");
const reports = Object.fromEntries(
  ["A", "B"].map((arm) => {
    const rows = raw.filter((item) => item.arm === arm);
    const modelRows = rows.filter((item) => item.httpStatus === 201 || item.runId);
    const eventsFor = (item: Raw) =>
      item.prediction?.events ??
      sidecar?.recovered.find((entry) => entry.id === item.id && entry.arm === item.arm)?.events;
    const usage = modelRows.map(
      (item) =>
        eventsFor(item)?.find((event) => event.event_type === "usage_reported")?.payload ?? null,
    );
    const toolCounts: Record<string, number> = {};
    const ontologyCases = new Set<string>();
    const evidenceRows = rows.filter((item) => Array.isArray(eventsFor(item)));
    for (const item of evidenceRows) {
      for (const event of eventsFor(item) ?? []) {
        const name = event.event_type === "tool_started" ? event.payload.tool : null;
        if (typeof name !== "string") continue;
        toolCounts[name] = (toolCounts[name] ?? 0) + 1;
        if (name.startsWith("ontology_") && item.id) ontologyCases.add(item.id);
      }
    }
    const latencies = modelRows
      .map((item) => item.latencyMs)
      .filter((value): value is number => typeof value === "number" && value >= 0)
      .sort((a, b) => a - b);
    const percentile = (p: number) =>
      latencies.length ? latencies[Math.ceil(p * latencies.length) - 1] : null;
    return [
      arm,
      {
        records: rows.length,
        createdRuns: modelRows.length,
        entry403: rows.filter((item) => item.httpStatus === 403).length,
        failed: rows.filter(
          (item) =>
            item.failure ||
            (item.httpStatus !== 201 && item.httpStatus !== 403) ||
            item.prediction?.status === "failed",
        ).length,
        statuses: modelRows.map((item) => ({
          id: item.id,
          status: item.prediction?.status ?? "unknown",
        })),
        latencyMs: { measured: latencies.length, p50: percentile(0.5), p95: percentile(0.95) },
        usage: usage.map((item, index) => ({
          id: modelRows[index]?.id,
          inputTokens: item?.inputTokens ?? null,
          outputTokens: item?.outputTokens ?? null,
          calls: item?.calls ?? null,
        })),
        toolSelection: {
          observedRuns: evidenceRows.length,
          missingRunEvidence:
            rows.filter((item) => item.httpStatus === 201 || item.failure).length -
            evidenceRows.length,
          calls: toolCounts,
          ontologyCases: [...ontologyCases].sort(),
        },
        cost: "unknown",
        retries: { runner: 0, tool: "unmeasured", provider: "unmeasured" },
        reviewed: summarizeCases(annotations.filter((item) => item.arm === arm)),
      },
    ];
  }),
);
const pairs = [...new Set(annotations.map((item) => item.id))].flatMap((id) => {
  const a = annotations.find((item) => item.id === id && item.arm === "A");
  const b = annotations.find((item) => item.id === id && item.arm === "B");
  return a && b ? [{ id, a, b }] : [];
});
const pairedDimensions = Object.fromEntries(
  (
    [
      "conceptCorrect",
      "resultCorrect",
      "targetCorrect",
      "evidenceComplete",
      "actionOutcomeCorrect",
    ] as const
  ).map((field) => {
    const measured = pairs.filter(({ a, b }) => a[field] !== null && b[field] !== null);
    return [
      field,
      {
        measured: measured.length,
        bothPass: measured.filter(({ a, b }) => a[field] && b[field]).length,
        onlyA: measured.filter(({ a, b }) => a[field] && !b[field]).length,
        onlyB: measured.filter(({ a, b }) => !a[field] && b[field]).length,
        bothFail: measured.filter(({ a, b }) => !a[field] && !b[field]).length,
      },
    ];
  }),
);
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      metadata: metadata[0],
      sources: {
        raw: {
          path: sourcePath(rawPath),
          sha256: createHash("sha256").update(rawBytes).digest("hex"),
        },
        annotations:
          annotationBytes && annotationsPath
            ? {
                path: sourcePath(annotationsPath),
                sha256: createHash("sha256").update(annotationBytes).digest("hex"),
              }
            : null,
        failedEvents:
          sidecarBytes && sidecarPath
            ? {
                path: sourcePath(sidecarPath),
                sha256: createHash("sha256").update(sidecarBytes).digest("hex"),
              }
            : null,
        manifestSha256: verifiedManifest.manifestSha256,
      },
      annotationProvenance: annotations.map(
        ({ id, arm, reviewer_kind, reviewer_model, rubric_sha256, oracle_sha256, reason }) => ({
          id,
          arm,
          reviewer_kind,
          reviewer_model,
          rubric_sha256,
          oracle_sha256,
          reason,
        }),
      ),
      paired: { completeReviewedPairs: pairs.length, dimensions: pairedDimensions },
      reports,
      modelUnreviewed: raw.filter(scoreable).length - annotations.length,
    },
    null,
    2,
  )}\n`,
  { flag: "wx", mode: 0o600 },
);
