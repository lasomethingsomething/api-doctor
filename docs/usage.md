# Usage Guide

This page explains each api-doctor command in a simple, practical way.

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

analyze reads one Shopware Admin API spec and reports workflow burden and contract-shape findings with evidence-first summaries.

It focuses on:

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
