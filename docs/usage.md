# Usage Guide

This page explains each api-doctor command in a simple, practical way.

## Start here in 2 minutes

```sh
cd ~/api-doctor
go run . analyze --spec ./adminapi.json
go run . explore --spec ./adminapi.json
```

Use `analyze` for deterministic baseline output, then use `explore` as the primary interactive triage surface.

## Explorer vs CLI

- Explorer (`explore`): primary way to inspect the three lenses, family clusters, endpoint evidence, and workflow context.
  - Clean information hierarchy: lens choice → family overview → expand endpoints → inline endpoint workspace
  - No redundant explanations; each section builds on the previous without repetition
  - Top-level navigation is fixed to 3 primary lenses: Spec rule violations, Workflow burden, Shape burden
  - Endpoint workspaces render inline under the selected endpoint row (summary + grouped deviations everywhere, plus lens-relevant supporting diagnostics)
  - Top shortcut/lens cards use subtle per-lens pastel tinting for fast visual distinction; reset remains a separate neutral utility control
- CLI (`analyze`, `workflows`, `diff`): canonical deterministic engine for local scripts, CI, and machine-readable outputs.
- TUI (`tui`): secondary terminal read-only view of the same deterministic data.

## Current analyzer signals (practical framing)

api-doctor organizes findings around complementary views, accessible via top tabs and the Category filter:

**Rules-based view** (spec-rule violations):
- Findings backed by explicit OpenAPI rule language (REQUIRED/MUST vs SHOULD/RECOMMENDED)
- What: normative spec rule risk
- When to use: validating against OpenAPI spec compliance

**Guidance views** (three burden lenses):

1. **Workflow burden**: responses that create hidden follow-up complexity
   - Key signals: weak follow-up linkage, hidden prerequisite burden, weak outcome guidance
   - What: where call chains hide next-step requirements or identifiers
   - When to use: improving state-change flow reliability across steps

2. **Shape burden**: responses that feel too generic or storage-shaped
   - Key signals: snapshot-heavy response, deep nesting, duplicated state, incidental/internal-field exposure
   - What: where responses are too broad or backend-focused rather than task-focused
   - When to use: tightening response contracts toward client needs

3. **Consistency/drift** (supporting perspective): related endpoints that diverge in naming, path patterns, or response shape
   - Key signals: parameter naming drift, path style drift, outcome wording drift, response shape drift
   - What: where similar operations stop feeling interchangeable
   - Where it lives now: endpoint workspaces (Consistency / drift) and supporting context where relevant

Each view is isolated and independent. Endpoint-local consistency inspection remains available in endpoint workspaces rather than as a competing top-level destination.

Scope reminder:

- Primary target today: Shopware Admin API OpenAPI spec
- Included in that scope: Admin API action routes and Sync-related routes present in that spec
- Broader API support should not be assumed unless validated in this repository
- Store API support is not claimed here

## Local Usage Setup (Important)

When developing locally, run commands from the project root (the directory that contains `go.mod`).

Why this matters:

- `go run . ...`, `go build ./...`, and `go test ./...` are module-aware commands.
- If you run them outside this repo root (for example from `~`), they fail because Go cannot find the module.

Two supported local usage patterns:

### 1) Run from the repo root

```sh
cd ~/api-doctor
go run . analyze --spec ./adminapi.json
go run . workflows --spec ./adminapi.json
go run . explore --spec ./adminapi.json
go run . tui --spec ./adminapi.json
```

### 2) Build a local binary first

```sh
cd ~/api-doctor
go build -o api-doctor .
./api-doctor analyze --spec ./adminapi.json
./api-doctor explore --spec ./adminapi.json
./api-doctor tui --spec ./adminapi.json
```

This is documentation for local development usage only. Packaging and external tool integration are optional and not required for the workflows above.

## 5-Minute Paths By Role

### External developer: chain calls and avoid hidden follow-up traps

1. Run `go run . workflows --spec ./adminapi.json` to see likely route sequences.
2. Run `go run . explore --spec ./adminapi.json`.
3. Open Endpoints and inspect your target endpoint detail.
4. Read `Likely next calls`, `Required identifiers`, and `Linkage status`.
5. Open Issue categories and check rows marked `[consistency]` for naming/shape mismatch traps.

### Internal API owner/team: find highest workflow burden, consistency, and change-risk problems

1. Run `go run . analyze --spec ./adminapi.json`.
2. Open `go run . explore --spec ./adminapi.json`.
3. Read Overview `Fix first (deterministic snapshot)` to get immediate priorities.
4. Use Hotspots for high-priority endpoint families and repeated issue categories.
5. Use Issue categories detail for consistency categories and affected endpoint examples.

### PM/stakeholder: get a quick current-state summary for planning

1. Run `go run . analyze --spec ./adminapi.json`.
2. Capture total findings, severity split, and top fix-first areas.
3. Open `go run . explore --spec ./adminapi.json` and read Overview totals plus `Fix first` lines.
4. Check Workflows totals for single-step and multi-step usability signal.
5. If comparing releases, run `go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json`.

## April 2026: DX Trap Guidance & Product-Fit

api-doctor now surfaces:
- Storage-shaped vs task-shaped responses
- Hidden dependencies and implicit prerequisites
- Weak or absent next-action modeling
- Token/context handoff pain (context invalidation, cart loss, access key confusion)
- Runtime-taught rules (schema gaps, behavioral rules only learned at runtime)
- Deep nesting and duplicated state
- Internal/incidental field exposure
- Brittle multi-step flows
- Responses that hide the main outcome

**Where to find these:**
- Endpoint row detail (expand for explicit trap callouts)
- Endpoint workspace (inline under the selected endpoint row, with workflow chain context where relevant)
- Family insight panels (summarized per family)

**All previous evidence, findings, and diagnostics are preserved.**

### Product-fit audit notes

Implementation checklist:
- Keep the Workflow lens centered on handoff burden: required IDs, tokens, auth/context spread, and what the next valid call is.
- Keep the Shape lens centered on task outcome visibility: storage-shaped payloads, deep nesting, duplicated state, internal-field exposure, and outcome-first redesign hints.
- Preserve the full evidence path for every surfaced trap: lead summary, grouped deviations, OpenAPI grounding, workflow-chain context, and consistency/drift context where relevant.
- Avoid replacing workflow language with schema-only language. The primary question should stay: "can a caller safely continue the task from this response?"
- Add regression coverage whenever detail surfaces are consolidated so preservation claims are verified by tests, not only by UI comments.

Still-missing capabilities:
- No first-class field-level handoff model yet. The explorer infers hidden dependencies from findings and wording, but it does not show a deterministic "this response field feeds that next request field" map.
- No explicit runtime-vs-contract split for "runtime-taught rules". The tool can flag likely burden, but it cannot prove whether the rule is undocumented runtime behavior or merely weak schema design.
- No end-to-end state machine for brittle flows. Inferred chains are useful, but they do not yet model required/optional branches, failure exits, retries, or async polling lifecycles as first-class workflow objects.
- No dedicated token/context lifecycle view. Token/context handoff is surfaced in summaries and chain clues, but not as a single inspectable artifact showing where context is created, mutated, invalidated, and consumed.
- No full screenshot-based visual test suite for the explorer UI. There is regression coverage for key explorer behaviors (filters, inline endpoint workspace interactions, and tab-surface invariants), but it is DOM/assertion based.

Preservation confirmation:
- Existing displayed information appears preserved in the current consolidated explorer. Grouped deviations, OpenAPI grounding, spec-rule details, cleaner-contract guidance, consistency/drift context, workflow-chain context, and shape interpretation still have rendered homes in the inline endpoint workspace and supporting sections.
- Current preservation evidence is implementation-based, not just narrative: see the consolidation mapping comment in `internal/explore/web/app.js` and the inline workspace tabs/drawers that render each prior surface.

---

## 1) Analyze

### What it does

analyze reads one Shopware Admin API spec and reports workflow burden, contract-shape burden, consistency drift, and spec-rule risk with evidence-first summaries.

It focuses on:

- Spec-rule risk signals (normative OpenAPI rule findings)
- Workflow burden signals (where common call sequences are hard to follow)
- Contract-shape burden signals (where response contracts are hard to use for next steps)
- Consistency drift across related endpoints and routes
- Diff-oriented change risk when comparing versions

It is spec-only analysis: it works from the OpenAPI document and does not observe live runtime behavior.

### Why you would use it

Use analyze when you want a quick, practical triage view of one spec file.

Good moments to run it:

- Before sharing a spec with your team
- Before releasing a new API version
- After making edits to endpoint schemas

### One example command

```sh
go run . analyze --spec ./adminapi.json
```

### What kind of output to expect

You get findings grouped by severity plus practical fix-first summaries that stay grounded in spec evidence.

By default, output is text.
You can also choose markdown or JSON with --format.

---

## 2) Workflows

### What it does

workflows infers likely endpoint flows from the spec.

In plain words, it tries to show common API journeys, such as:

- List to detail
- Create to detail
- Action to follow-up

It also includes selected multi-step chains.

### Why you would use it

Use workflows when you want to understand whether the API looks easy to use as a sequence of calls.

Good moments to run it:

- When reviewing endpoint naming and shape consistency
- When checking if follow-up links feel clear
- When discussing API usability with backend and frontend teams

### One example command

```sh
go run . workflows --spec ./adminapi.json
```

### What kind of output to expect

You get a summary of inferred workflow patterns and counts.

In verbose mode, you get more detail.
JSON output includes complete structured workflow and chain data.

---

## 3) Diff

### What it does

diff compares two Shopware Admin API spec versions.

It flags breaking changes such as removed paths, removed operations, and removed fields.

### Why you would use it

Use diff before upgrading clients or publishing a new version.

Good moments to run it:

- In release checks
- In CI before merge
- When validating that a change is backward compatible

### One example command

```sh
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json
```

### What kind of output to expect

You get a list of detected breaking changes and a summary count.

If breaking changes are found, the command exits with a non-zero status code.
That makes it useful in CI pipelines.

---

## 4) Explore

### What it does

explore starts a lightweight local browser UI as the primary interactive analysis surface.

It uses the same deterministic analysis/workflow/diff data already produced by the CLI engine, then normalizes that data once server-side for interactive browsing.

The Explorer UI is organized around burden lenses:

- **Workflow Guidance lens**: family cards and workflow chains highlight hidden token/context handoff, weak outcome guidance, brittle sequencing, and auth/header spread. Workflow steps include explicit "What changed", "Authoritative now", "Next valid action", and trap guidance.
- **Response Shape lens**: family cards and endpoint workspaces emphasize storage-shaped DX burden (snapshot-heavy responses, deep nesting, duplicated state, internal-field exposure, unclear source-of-truth, weak outcome/next-action framing).
- **Contract Issues lens**: rules-based normative findings with explicit REQUIRED/MUST vs SHOULD/RECOMMENDED framing, plus supporting consistency drift.

Consistency/drift remains available as a supporting perspective (including a dedicated Consistency / drift endpoint workspace tab), not as a competing top-level primary lens.

Explorer UI clarity goals:
- Each top-level lens uses its own accent styling intentionally (focus/CTA/scope cues only).
- Family headers and empty/no-match cards are designed to be scannable: one scope sentence + only real recovery actions.
- The filter row is followed by a compact **Current filters** bar; when the current combination matches nothing (especially in Contract Issues), the UI explains why and offers specific recovery actions.
- The header utility action **View payload** opens the raw analyzer payload backing the Explorer UI.

### Why you would use it

Use explore when you want fast local triage and drill-down with searchable/filterable endpoint and workflow views.

Good moments to run it:

- Daily local analysis review
- Team triage sessions on burden/consistency/risk hotspots
- Follow-up investigation after `analyze`/`workflows` summaries

### Launch command

```sh
go run . explore --spec ./adminapi.json
```

Then open:

- http://127.0.0.1:7777/

Optional diff context in explore:

```sh
go run . explore --spec ./adminapi.json --base ./adminapi-v1.json --head ./adminapi-v2.json
```

### First-pass constraints

- Binds to `127.0.0.1` only
- Single-page UI
- No client-side routing
- No persistence layer
- No websocket/live reload

---

## 5) TUI (secondary)

### What it does

tui opens a read-only terminal surface over the same deterministic CLI analysis/workflow/diff outputs.

### Why you would use it

Use tui for quick local terminal triage. Treat Explorer as the primary interactive surface.

### Launch command

```sh
go run . tui --spec ./adminapi.json
```

Optional diff data:

```sh
go run . tui --spec ./adminapi.json --old ./adminapi-v1.json --new ./adminapi-v2.json
```

### Current limitations

- Read-only only
- Secondary surface compared with Explorer
- Uses existing analyzer/workflow/diff outputs only
