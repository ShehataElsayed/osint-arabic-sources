# Live-test coverage: which path each result actually covers

The assistant has two question-answering paths in the worker. The UI calls
mode `ask` (askAssistant). Mode `ask_ef` (askEvidenceFirst) is an experimental
evidence-first pipeline not wired to the UI.

| Live result (2026-10-25) | Path covered | Covers the UI path? |
|---|---|---|
| ef4-q1 Red Sea: decision=answer, 4/6 claims verified (manually confirmed against sources) | ask_ef | NO |
| Q2 diagnostics (insufficient x3, synthesis timeout, truncated JSON) and their fixes (150s timeout, fail-closed salvage) | ask_ef | NO (fixes ported to `ask` draft call 2026-10-25, not live-validated) |
| Mode `ask` (the UI path) | none this cycle | - |

Offline contract coverage instead: tests/contract-ui.cjs renders REAL worker
(mode `ask`) JSON through the REAL assistant page for
answer / insufficient-unsupported_claims / insufficient-no_checkable_claims /
busy, asserting the UI state matches each worker label. Fixture-based; not a
substitute for live validation of `ask` after quota reset.

Architecture decision (pending owner confirmation): keep the UI on mode `ask`
- it produces the long-form detailed answers the user asked for, and its
verification/rewrite/grounding layers are the mature ones. ask_ef stays an
experimental endpoint; do not switch the UI to it without live validation.

## What remains distinct between `ask` and `ask_ef` (2026-10-25)

Parity so far is timeout/robustness + response-contract ONLY. The
architectures still differ materially:

| Aspect | `ask` (UI path) | `ask_ef` (experimental) |
|---|---|---|
| Draft origin | model's own knowledge + named sources | constrained synthesis from retrieved passages ONLY |
| Source acquisition | model-named sources opened/repaired + free discovery | planner queries -> Exa discovery |
| Verification | post-hoc claim checks + guarded rewrite + marker re-derivation | per-sentence verification before display |
| Richness | long-form structured answers (user requirement) | thinner, abstains more readily |
| Live validation this cycle | NONE | ef4-q1 (4/6 claims verified), Q2 diagnostics |

Explicitly NOT proven: the scripted-fixture `answer` scenario in
tests/contract-ui.cjs proves only that real worker JSON renders correctly in
the UI. It is NOT evidence that `ask` delivers detailed, source-supported
answers on live services. That requires the live validation plan below.

## Next live validation plan (within verified free limits)

Constraints: OpenRouter free tier ~50 req/day SHARED across all pipeline
stages and steps (provider counter lags the local ledger); 3 requests remain
today and are frozen; Exa ~13 used of the free credit. Each `ask` question
spends ~5-8 OpenRouter calls (draft, translate, rewrite, rewrite_claims,
critic, extras) and up to ~4 Exa searches.

After the OpenRouter daily reset (midnight UTC), ONE bounded run:
1. Mode `ask`, one known-answer question with stable sources (reuse the Red
   Sea question for comparability with ef4-q1). MODEL_CALL_BUDGET=10,
   deadline 240s. Expect <=8 OpenRouter + <=4 Exa calls.
2. Record raw JSON + ledger to /tmp artifacts; verify: draft completes
   without timeout (150s fix effective), no salvage needed or salvage
   correctly tail-trimmed, decision + insufficient_reason labeling sane,
   claims verified against sources manually like ef4-q1.
3. Report: live validation of the UI path, or precise failure diagnosis.
No retries beyond the one run without owner direction; no paid fallback ever.
