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
1. Click one of the three top-level lenses/tabs: **Spec rule violations**, **Workflow burden**, or **Shape burden**.
2. In the top shortcut row, each lens card uses a subtle pastel tint so lens intent is visually distinct at a glance; the reset control remains a separate utility control.
3. Use the **Family investigation clusters** section as the primary entry point — each card explains why that family appears in the current view.
4. Use **Endpoint diagnostics** as the persistent selected-endpoint inspection surface across all three lenses.
5. In Workflow and Shape lenses, use inspector Summary for burden framing, Exact evidence for grouped messages, and supporting consistency/drift context where relevant.
6. Use **Call chain diagnostics and continuity** in Workflow burden when you need step-by-step sequence context and trap guidance.

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

## Main surfaces

- CLI engine (canonical): analyze, workflows, diff, and machine-readable output
- Explorer (primary): interactive family triage plus Endpoint diagnostics for selected-endpoint inspection
- TUI (secondary): compact terminal triage over the same deterministic data

## What api-doctor helps you find

- Spec-rule risk: OpenAPI-normative rule findings (REQUIRED/RECOMMENDED evidence)
- Workflow burden: where call chains hide next-step requirements
- Contract shape burden: where responses are too generic or storage-shaped
- Consistency drift: supporting inspector/evidence perspective showing where related endpoints diverge in naming/path/shape
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
- persistent Endpoint diagnostics inspector as the main selected-endpoint surface
- workflow step narratives with explicit "What changed", "Authoritative now", and "Next valid action"
- first-class trap guidance with concise "What happened", "Easy to miss", and "Do next" actions
- compact current-contract vs workflow-first contract comparison in Workflow/Shape inspector summaries

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
