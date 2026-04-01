# api-doctor

Static analysis CLI for Shopware Admin API OpenAPI 3 specs. Parses specs locally, runs deterministic rules, and reports findings in text, Markdown, or JSON. No network calls, no AI.

## Prerequisites

- Go 1.21+
- A local Shopware Admin API OpenAPI spec file (JSON)

Current validated scope:
- Primary target today: Shopware Admin API OpenAPI spec
- Included in that scope: Admin API action routes and Sync-related routes present in that spec
- Broader API support should not be implied unless validated in this repository

## Install

```sh
go mod tidy
go build ./...
go test ./...
```

Optional local install:

```sh
go install .
```

## Quickstart

```sh
# analyze a Shopware Admin API spec
go run . analyze --spec ./adminapi.json

# workflows summary for the same spec
go run . workflows --spec ./adminapi.json

# compare two Shopware Admin API spec versions
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json
```

## Common commands

```sh
# analyze (text default)
go run . analyze --spec ./adminapi.json

# analyze (markdown/json)
go run . analyze --spec ./adminapi.json --format markdown
go run . analyze --spec ./adminapi.json --format json

# workflows (text default)
go run . workflows --spec ./adminapi.json

# workflows (verbose)
go run . workflows --spec ./adminapi.json --verbose

# diff between two Admin API spec versions
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json
```

---

## Commands

### analyze

Runs deterministic quality checks against a spec and reports findings grouped by severity. Also computes endpoint quality scores.

```sh
# text (default)
go run . analyze --spec ./adminapi.json

# text with technical detail
go run . analyze --spec ./adminapi.json --verbose

# markdown
go run . analyze --spec ./adminapi.json --format markdown

# json
go run . analyze --spec ./adminapi.json --format json
```

Unified output flag: `--format text|markdown|json`.

Endpoint scoring dimensions (1-5):

| Dimension | Measures | Typical Penalties |
|---|---|---|
| Schema Completeness | request/response shape clarity | generic objects, weak linkage |
| Client Generation Quality | strong typing for generated clients | likely-missing-enum, generic objects |
| Versioning Safety | safe evolution risk | deprecated operations |

Rules:

| Rule | Kind | Severity |
|---|---|---|
| `missing-request-schema` | per-op | error |
| `missing-response-schema` | per-op | error |
| `generic-object-request` | per-op | warning |
| `generic-object-response` | per-op | warning |
| `weak-array-items-schema` | per-op | warning |
| `likely-missing-enum` | per-op | warning |
| `deprecated-operation` | per-op | warning |
| `weak-follow-up-linkage` | cross-op | warning |
| `weak-list-detail-linkage` | cross-op | warning |
| `weak-accepted-tracking-linkage` | cross-op | warning |
| `weak-action-follow-up-linkage` | cross-op | warning |

Real-spec proof points (Shopware admin API, 1036 operations):
- 153 warnings, 0 errors
- Dominant signal: `weak-follow-up-linkage` (137)
- Endpoint quality summary: Schema Completeness 50% excellent / 50% good; Client Generation Quality 100% excellent; Versioning Safety 99% excellent (1 deprecated)

---

### workflows

Infers deterministic workflow relationships from path and response-shape signals, including pairwise edges and selected multi-step chains.

```sh
# text (default)
go run . workflows --spec ./adminapi.json

# verbose
go run . workflows --spec ./adminapi.json --verbose

# markdown
go run . workflows --spec ./adminapi.json --format markdown

# json
go run . workflows --spec ./adminapi.json --format json
```

Unified output flag: `--format text|markdown|json`.

Output behavior:
- Default text and Markdown keep pairwise workflows as the primary section.
- Default text and Markdown show only stronger chain signals and hide noisier CRUD-heavy chain lists.
- `--verbose` expands chain detail in text output.
- JSON remains complete and includes all chains with summaries and scores.

Workflow scoring dimensions (1-5):
- UI Independence
- Schema Completeness
- Client Generation Quality

Chain scoring dimensions (1-5):
- UI Independence
- Schema Completeness
- Client Generation Quality

Chain score model:
- deterministic "worst-step plus continuity penalty"
- chain explanation includes worst-step context and continuity penalty reason(s)

Inferred workflow types:
- Create To Detail
- List To Detail
- Action To Detail
- Accepted To Tracking

Real-spec proof points:
- 277 workflows inferred: 137 create to detail, 137 list to detail, 3 action to detail
- Common score pattern: 4/4/5
- 139 multi-step chains inferred after tightening (instead of near-universal extension)
- chain score summary on real spec: list-detail-update ~3/4/5, stronger action/media chains surfaced in default output
- dominant weakness remains self-describing linkage clarity (`weak-follow-up-linkage`)

---

### diff

Compares two specs and reports deterministic breaking changes. Exits non-zero when breaking changes are found.

```sh
# text (default)
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json

# markdown
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json --format markdown

# json
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json --format json
```

Unified output flag: `--format text|markdown|json`.

Checks:

| Check | What it detects |
|---|---|
| `removed-path` | a path was removed |
| `removed-operation` | a method was removed from a path |
| `removed-response-status-code` | a documented response code was removed |
| `removed-response-field` | a response field was removed |
| `removed-request-field` | a request field was removed |
| `field-became-required` | an optional response field became required |
| `enum-value-removed` | an enum value was removed |

Real-spec proof point:
- 1 breaking change detected: `POST /_action/sync` removed `request[].filter`

---

## Current Capabilities

- Deterministic analysis, workflow inference, and spec diffing
- Unified output format on all commands: `--format text|markdown|json`
- Endpoint scoring integrated into analyze
- Workflow scoring integrated into workflows
- Multi-step chain inference integrated into workflows (additive to pairwise workflows)
- CI-friendly non-zero exits for analyze (errors) and diff (breaking changes)

## Current Limitations

- No `$ref` resolution, so coverage is partial on component-heavy specs
- Multi-step chain inference is intentionally conservative and currently limited to a small set of deterministic chain families
- Analysis currently focuses on JSON media type schemas
- YAML parsing is not currently supported

## Next Milestone

- TUI phase: interactive navigation of findings, workflow/chain signals, and score summaries without changing deterministic inference logic.
