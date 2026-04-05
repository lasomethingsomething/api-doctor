# api-doctor

api-doctor analyzes the Shopware Admin API OpenAPI spec for workflow burden, contract shape, consistency drift, spec-rule risk, and change risk, then helps you inspect concrete evidence in a local Explorer UI.

## Quick start

Prerequisites:
- Go 1.21+
- A local Shopware Admin API spec JSON file (example: ./adminapi.json)

From the repo root:

```sh
go mod tidy
go build ./...
go test ./...
```

Run a first analysis:

```sh
go run . analyze --spec ./adminapi.json
```

Open the primary interactive surface:

```sh
go run . explore --spec ./adminapi.json
```

Then open:

- http://127.0.0.1:7777/

## Open the Explorer (primary interactive surface)

Launch:

```sh
go run . explore --spec ./adminapi.json
```

Optional diff context:

```sh
go run . explore --spec ./adminapi.json --base ./adminapi-v1.json --head ./adminapi-v2.json
```

How to use it quickly:
1. Click one of the three top-level lenses/tabs: **Contract Issues**, **Workflow Guidance**, or **Response Shape**.
2. Each top-level lens uses its own accent styling intentionally (focus/CTA/scope cues), while severity/error styling remains reserved for actual errors and warnings.
3. Use the **Current filters** bar under the filter row to confirm scope quickly; when filters match nothing, it shows concrete next actions.
4. Use the **Family investigation clusters** section as the primary entry point — expand a family via the **Endpoints** count, and toggle **Family Insight** by clicking the family name.
5. In the expanded endpoints table, click an endpoint **Path** to open its inline workspace (Summary, Grouped deviations, and supporting diagnostics). Click again to close.
6. Use the top-right **View payload** button to inspect the raw analyzer output backing the UI.

## Explorer vs CLI (quick decision)

- Explorer: primary triage surface for family/workflow/endpoint drill-down and fix-first inspection.
- CLI analyze/workflows/diff: canonical deterministic engine for local scripts, CI, and machine-readable output.
- TUI: secondary terminal-first read-only surface over the same deterministic data.

## Common commands

```sh
go run . analyze --spec ./adminapi.json
go run . workflows --spec ./adminapi.json
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json
go run . explore --spec ./adminapi.json
go run . tui --spec ./adminapi.json
```

Command roles:
- analyze: one-spec burden and contract review with fix-first summaries
- workflows: inferred single-step and multi-step call chains
- diff: breaking-change risk between two spec versions
- explore: primary browser-based triage and evidence drill-down
- tui: secondary read-only terminal triage

## What api-doctor helps you find

- Spec-rule risk: OpenAPI-normative rule findings (REQUIRED/RECOMMENDED evidence)
- Workflow burden: where call chains hide next-step requirements
- Contract shape burden: where responses are too generic or storage-shaped
- Consistency drift: where related endpoints diverge in naming/path/shape
- Change risk: where spec-to-spec changes can break clients
- Fix-first priorities: deterministic starting points for remediation

Current workflow/shape heuristics include:
- snapshot-heavy-response — card text: "Returns full model state rather than task-scoped fields."
- deeply-nested-response-structure — card text: "Response nesting may complicate client traversal."
- duplicated-state-response — card text: "State appears repeated across multiple response fields."
- incidental-internal-field-exposure — card text: "Internal or audit fields appear to dominate the contract."
- weak-outcome-next-action-guidance

Explorer currently emphasizes:
- three top-level primary lenses only: Spec rule violations, Workflow burden, Shape burden
- endpoint inspection as an inline workspace beneath the selected endpoint row (no detached inspector panel)
- workflow step narratives with explicit "What changed", "Authoritative now", and "Next valid action"
- first-class trap guidance with concise "What happened", "Easy to miss", and "Do next" actions
- compact current-contract vs workflow-first contract comparison in Workflow/Shape endpoint summaries

Recent UI clarity improvements:
- Lens accent styling is isolated per top-level tab (no cross-tab leakage).
- Family headers and empty/no-match states are intentionally concise: one scope sentence + only real actions.
- Contract Issues filter no-match state includes a prescriptive "Why this happened" + "Try one of these" block.
- Header utility action **View payload** opens the raw analyzer output backing the view.

## What this is (and is not)

api-doctor is not primarily a generic linting tool or docs browser.

It is a deterministic, spec-only analyzer for improving the Shopware Admin API toward JSON/OpenAPI as the source of truth.

What it is not:
- Runtime traffic analysis
- Production behavior tracing
- A replacement for runtime validation and integration tests

## Evidence boundaries (important)

- Local-only: no network calls, no AI calls
- Spec-only: findings come from OpenAPI JSON, not observed runtime behavior
- Findings are evidence-based hints for contract/workflow review, not proofs of runtime failures

## Current scope

Current validated scope is intentionally narrow:
- Primary target: Shopware Admin API OpenAPI spec
- Included: Admin API action routes in that spec
- Store API support is not provided yet
- Broader API support should not be assumed unless validated in this repository

## Local developer workflows

### Run from repo root

```sh
cd ~/api-doctor
go run . analyze --spec ./adminapi.json
go run . workflows --spec ./adminapi.json
go run . explore --spec ./adminapi.json
go run . tui --spec ./adminapi.json
```

### Build a local binary first

```sh
cd ~/api-doctor
go build -o api-doctor .
./api-doctor analyze --spec ./adminapi.json
./api-doctor explore --spec ./adminapi.json
./api-doctor tui --spec ./adminapi.json
```

## TUI (secondary surface)

Use TUI when you want terminal-first review, but treat it as secondary to Explorer.

```sh
go run . tui --spec ./adminapi.json
```

Optional diff data in TUI:

```sh
go run . tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json
```

## More detailed command usage

See docs/usage.md for expanded command examples and walkthroughs.

---

## What’s New (April 2026)

- **Explicit Trap Callouts:**
  - Hidden workflow and shape traps (e.g., context handoff, hidden dependencies, weak next-action modeling, runtime-taught rules, deep nesting, duplicated state, internal field exposure, brittle flows, and outcome-hiding responses) are now surfaced directly in both endpoint and family detail views.
  - Each trap is visually distinct, developer-focused, and includes “why devs lose time here.”
- **Product-Fit Checklist:**
  - [x] Storage-shaped vs task-shaped responses
  - [x] Hidden dependencies
  - [x] Weak next-action modeling
  - [x] Token/context handoff pain
  - [x] Runtime-taught rules
  - [x] Deep nesting and duplicated state
  - [x] Internal/incidental field exposure
  - [x] Brittle multi-step flows
  - [x] Response shapes that hide the main outcome
- **All previous evidence, findings, and diagnostics are preserved and visible.**
- See [docs/usage.md](docs/usage.md) for practical workflow and shape pain mapping.

---
