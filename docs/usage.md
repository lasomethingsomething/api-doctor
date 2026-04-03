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

- Explorer (`explore`): primary way to inspect burden lenses, family clusters, endpoint evidence, and workflow context.
  - Clean information hierarchy: lens choice → family overview → endpoint list with guidance → detail evidence
  - No redundant explanations; each section builds on the previous without repetition
  - Support for four view types: spec-rule violations (rules-based view), workflow burden, shape burden, consistency (all guidance views)
   - Top shortcut/lens cards use subtle per-lens pastel tinting for fast visual distinction; reset remains a separate neutral utility control
- CLI (`analyze`, `workflows`, `diff`): canonical deterministic engine for local scripts, CI, and machine-readable outputs.
- TUI (`tui`): secondary terminal read-only view of the same deterministic data.

## Current analyzer signals (practical framing)

api-doctor organizes findings around four complementary views, accessible via category and burden filters:

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

3. **Consistency**: related endpoints that diverge in naming, path patterns, or response shape
   - Key signals: parameter naming drift, path style drift, outcome wording drift, response shape drift
   - What: where similar operations stop feeling interchangeable
   - When to use: ensuring API surface cohesion across related routes

Each view is isolated and independent. Selecting a category or burden filter will sync the view appropriately—for example, choosing workflow burden automatically switches the category filter to workflow-burden view.

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

- **Workflow burden lens**: family cards highlight hidden token handoff, weak outcome guidance, brittle sequencing, and auth/header spread. Workflow chains show burden summary chips ordered by impact — the primary (most-affected) burden chip is visually emphasized; secondary burdens are shown compactly.
- **Shape burden lens**: family cards distinguish the dominant local shape problem for each family (snapshot-heavy, deep nesting, duplicated state, or internal-field domination) with a specific sentence per card rather than a generic label. The primary shape signal chip is highlighted; secondary chips are de-emphasized.
- **Consistency lens**: family cards surface parameter naming drift, path-style drift, and response-shape divergence across related routes.
- **Spec-rule view**: a separate aggregate table lists normative rule findings by level and breadth, distinct from the burden card system.

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
