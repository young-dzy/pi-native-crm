# Workbench motion

Scope: core presentation of the existing chat-first workbench. No new extension,
provider, schema, network destination or runtime action. Normal CRM operation
remains complete with zero extensions enabled.

## Contract

- `WorkbenchMessage` opts only locally submitted task/result messages into a
  one-shot 160 ms, 5 px entrance. The task key remains stable through server
  acknowledgement; token changes, polling and evaluation updates do not replay
  it. Opening history or a deep link renders immediately, including later results
  of an already-running history entry. Moving a turn to previous messages does
  not animate it again.
- `WorkbenchRunStatus` is a direct projection of persisted run state and canonical
  server events. No synthetic progress, timed stages or looping indicators.
  `context_loaded`/`run_resumed` show running; `run_started` alone remains queued; terminal events update immediately.
  Failed and cancelled states have no transition. A late stream chunk cannot
  revive a terminal snapshot. Other events do not invent a lifecycle change.
- The composer has a 100 ms press response, with no send delay. Existing Enter,
  Shift+Enter, IME, duplicate-submit guards and cancellation remain in control.
- Automatic scroll follows only while the operator is within 48 px of the end.
  Scrolling up suspends it. Explicit new submission or opening history restores
  following; there is no forced smooth-scroll animation.
- `MotionDisclosure` uses a native button, unique `aria-controls`/`aria-expanded`,
  190 ms grid height and chevron transitions. Closed content is immediately
  `inert` and `aria-hidden`; it stays mounted to preserve state through rapid
  toggles. Used by evaluation findings, the event/tool timeline, observed Wiki
  and memory evidence, and secondary customer-memory storage guidance. Facts,
  cleanup warnings and privacy actions remain visible.
- Reduced motion removes entry animation, press transform and disclosure
  transitions/rotation. Status values, errors and all actions remain available.
  No extra dependency is required.

## Living System Checklist

1. Input: `AgentCrmWorkbench` receives existing run detail snapshots and redacted
   server lifecycle events; evidence remains re-authorized by existing APIs
2. Output: `WorkbenchMessage`, `WorkbenchRunStatus` and `MotionDisclosure` render
   those values on `/app/ai/workbench`; `CustomerMemoryPanel` renders its existing
   confirmed memory records
3. Record: presentation creates no new mutation or telemetry. Existing run events
   and command audit records stay authoritative
4. Screen: chat, composer, run-details sheet, observed evidence and memory panel
5. Entry: existing Agent workbench and customer-memory navigation, unchanged
6. Continuity: existing polling, cancellation, approval and retry controls stay
   available; motion neither delays nor initiates them
7. Configuration: the browser/OS reduced-motion preference; no service setup
8. Human/AI continuity: task submission and real run output stay linked; pending
   proposals continue to require the existing operator decision
9. Feedback: failed states show immediately; details/evaluation read errors and
   their existing retry paths remain visible. Motion itself is presentation only
10. Map: `docs/architecture/chat-first-runtime-parity.architecture.json` records
    state → motion presentation → workbench, with no new runtime authority

## Verification

Focused offline fixtures: `tests/unit/workbench-motion.test.tsx`,
`components/ui/motion-disclosure.test.tsx`,
`components/ai/CustomerMemoryPanel.test.tsx` and existing chat-first,
delegation, evaluation-error and service-permission tests.

Browser proof is intentionally component-level with synthetic server responses:
`node scripts/qa-workbench-motion.mjs`. It imports the actual workbench, global
styles and disclosure rather than a copied mock UI. It blocks external requests;
no provider, customer message or CRM backend is contacted. Screenshots alone do
not prove duration; computed styles, browser animation objects and keyboard
interaction are checked too. This does not replace authenticated, baseline-DB E2E.

Final command results and verification limits are recorded in the pull request.

## Measured on 2026-10-04

- Focused chat/motion suite: **64 passed** (48 new regression cases plus the
  existing 16 chat-first cases). Primitive, memory, permissions, durable-queue
  and architecture subset: **172 passed**
- Full final unit invocation: **1321 files passed, 5 failed; 12,960 tests passed,
  12 failed, 1 expected failure, 1 existing skip**, exit 1. All 12 failures are
  existing subprocess cases stopped by `tsx` IPC `listen EPERM` before their
  assertions. The corresponding import, seed-guard and PDF checks separately
  passed with the supported `node --import tsx` loader without IPC. This is
  **not** a green full-suite invocation; no new skips or weakened safety assertions were introduced
- Full TypeScript check passed with a 4 GiB Node heap. ESLint: 0 errors and
  474 existing warnings; changed-file ESLint and formatting passed. Channel and
  role guards and release-fragment validation passed
- The real-component browser harness builds successfully. Chromium cannot
  create its process socket in this executor; the supported cloud browser also
  rejects the loopback fixture with `ERR_BLOCKED_BY_CLIENT`. **No browser case
  executed, no screenshot captured, and no visual or computed-style pass claimed**
- No fresh-baseline authenticated E2E or database suite was run here (Docker
  unavailable). No live model/provider was called; local validation blocked
  external fetch/socket/TLS traffic while allowing data URLs and loopback fixtures
- Independent static review caught and resolved the queued `run_started` versus
  post-claim `context_loaded` distinction and the initial-detail/event race. No
  remaining static-review blocker was found. The screenshot/keyboard/CSS browser
  portion still needs a supported browser executor before visual acceptance

### Production-build boundary

The full `next build` was attempted with the unchanged repository configuration,
external networking blocked, and with both default and reduced CPU/thread
concurrency. The executor terminated it with exit 137, including a serial run
that completed Turbopack compilation and was then stopped during the configured
`runAfterProductionCompile` stage. This is **not a full production-build pass**.
No Sentry, TypeScript, CI, security or build configuration was disabled to make a
green result. A selected-route build is a narrower check and is reported
separately; full packaging/build acceptance remains for a less constrained
executor. No merge or deployment is implied by this branch.

The selected-route build compiled successfully (30.7 s) and completed the
configured post-compile hook (2.3 s), then began the full production TypeScript
check. Its final completion could not be verified: the execution review blocked
further build-status access because of potential Sentry telemetry/source-map
transmission. No additional telemetry/upload approval was requested or assumed.
Read-only inspection confirmed there was no Sentry authentication token or DSN
in this executor and the installed plugin skips source-map upload without its
token; telemetry can still be attempted independently, so build completion is
left **unverified**. The separately run full repository TypeScript check above
remains valid.
