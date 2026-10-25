# Abstention reasons (`insufficient_reason`) across NewsRAG surfaces

When a question gets `decision: "insufficient"`, the cause matters: a service
failure is not an evidence gap, and neither proves the information does not
exist. Each surface therefore labels *why* it abstained. The vocabularies are
deliberately per-surface — they are related, not one shared contract — because
the pipelines abstain at different stages.

## Worker mode `ask` (live assistant path)

- `no_checkable_claims` — the draft formed but no checkable claims could be
  extracted (model omitted them and the fallback extraction failed). A
  processing limitation; the evidence was never even tested.
- `unsupported_claims` — claims were extracted and checked, and opened sources
  did not support them (including the rewrite-failure degradation).

A draft-stage service failure never reaches a decision: the mode returns
`{"error":"busy"|"upstream"}` instead, which the UI shows as a service problem.

## Worker mode `ask_ef` (evidence-first experimental path)

- `no_relevant_passages` — opened pages held no passage relevant enough to
  synthesize from.
- `generation_failed` — the synthesis call failed/timed out before any draft
  existed (also covers internal budget skips).
- `unsupported_claims` — a draft existed but verified sentences did not.

## Python library `assist()`

- `draft_unusable` — generation/parse failure (including token-truncation
  salvage finding nothing complete).
- `no_checkable_claims` — draft parsed but listed no checkable claims.
- `unsupported_claims` — claims checked, corpus did not support them.

`Answer.ask()` (the simpler API) has no reason field: it distinguishes the
cases in its message text ("No matching evidence in this corpus." vs
"Evidence retrieved; no generator configured.") and a generator exception
propagates rather than masquerading as an abstention.

## Mapping for consumers

Do not map reasons across surfaces 1:1; in particular the library's
`no_checkable_claims` is NOT the worker's `no_relevant_passages` (the first
never ran support checks; the second ran retrieval and found nothing useful).
The safe cross-surface grouping is:

| Group                         | ask            | ask_ef                 | library assist()     |
|-------------------------------|----------------|------------------------|----------------------|
| Processing/service failure    | no_checkable_claims (+ error responses) | generation_failed | draft_unusable, no_checkable_claims |
| Evidence-driven abstention    | unsupported_claims | no_relevant_passages, unsupported_claims | unsupported_claims |

`insufficient_reason` is additive and optional: older backends and
answer/extractive decisions omit it; consumers must handle its absence
(fallback copy already does).
