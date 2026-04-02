# api-doctor - Real-Spec Analysis Checkpoint

Spec: Shopware Admin API (`adminapi.json`)
Operations analyzed: 1036
Scope: stable tool state with validated endpoint scoring, validated single-step workflow scoring, validated multi-step chain scoring, and diff validation
Date: April 2026

---

## Endpoint Quality Summary

Scoring results across all endpoints:

| Dimension | Excellent (5) | Good (4) | Fair (3) | Poor (<=2) |
|---|---|---|---|---|
| Schema Completeness | 518 (50%) | 518 (50%) | 0 | 0 |
| Client Generation Quality | 1036 (100%) | 0 | 0 | 0 |
| Versioning Safety | 1035 (99%) | 0 | 0 | 1 |

Interpretation:
- Endpoint scoring is validated and stable
- Schema Completeness is the dominant quality bottleneck
- Client Generation and Versioning are generally strong, with one deprecated-operation penalty

---

## Workflow Scoring Summary

Workflow inference and scoring are validated and stable.

Workflow output behavior (current):
- Single-step workflows remain and are still reported/scored as the baseline signal.
- Multi-step chains are inferred additively from deterministic continuity rules.
- Chain scoring is deterministic and explainable: worst-step plus continuity penalty.
- Default text/Markdown output surfaces stronger chains and hides noisier CRUD-heavy chain families by default.
- JSON keeps the full inferred chain set (with chain summaries and score details) for complete downstream analysis.

Inferred workflows:
- 277 total
- 137 Create To Detail
- 137 List To Detail
- 3 Action To Detail

Inferred multi-step chains:
- 139 total after tightening (down from near-universal extension)
- dominant chain family still list-detail-update, but surfaced output prioritizes stronger action/media chain signals

Observed scoring profile:
- Most workflows score 4/4/5 (UI Independence / Schema Completeness / Client Generation Quality)
- The dominant weakness is schema linkage clarity, not client generation ability

---

## Dominant Signal

Top analysis signal: `weak-follow-up-linkage` with 137 hits.

Why it matters:
- Many responses do not clearly expose the identifier needed for the next obvious detail call
- SDK and automation flows must rely on conventions or external docs rather than schema-declared linkage
- This directly explains why schema-related scoring often does not reach 5/5 in inferred workflows
- This remains the dominant weakness even after adding multi-step chains and chain scoring

---

## Action-Transition Verification Weakness

`weak-action-follow-up-linkage` appears on 3 state-transition endpoints:
- `POST /_action/order/{orderId}/state/{transition}`
- `POST /_action/order_delivery/{orderDeliveryId}/state/{transition}`
- `POST /_action/order_transaction/{orderTransactionId}/state/{transition}`

Interpretation:
- The path indicates the target resource, but the response does not clearly expose resulting state or a strong follow-up verification pointer
- Action workflows are inferable, but response contracts remain weak for verification ergonomics

---

## Diff Proof Point

Validated real diff finding:
- `POST /_action/sync` removed `request[].filter` from request-body schema

Why this matters:
- Confirms the diff engine catches production-relevant breaking changes
- Demonstrates detection works for nested array field removals

---

## Current Constraints

- No `$ref` resolution yet, so referenced component schemas are not fully analyzed in scoring/rule checks
- Multi-step chain inference remains intentionally conservative and limited to small deterministic families

---

## Current TUI Status

Interactive TUI is available and read-only.

Current TUI coverage:
- Overview with severity and workflow/path totals
- Hotspots with ranked priority areas
- Endpoints with issues/quality/priority labels and sort toggle
- Issue categories with structured detail and endpoint jump
- Workflows with single-step and multi-step pattern summaries
- Diff guidance when not launched with --old and --new, or diff summary when both are provided

TUI constraints:
- keep current deterministic analyzers/inference unchanged
- prioritize navigation, triage speed, and developer ergonomics over new inference complexity
