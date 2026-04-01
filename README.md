# api-doctor

Static analysis CLI for OpenAPI 3 specs. Parses specs locally, runs deterministic rules, and reports findings in text, Markdown, or JSON. No network calls, no AI.

## Build and Run

```sh
go mod tidy
go build ./...
go test ./...
```

```sh
# run directly without installing
go run . <command> [flags]
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

Infers pairwise workflow patterns from path and response-shape signals.

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

Workflow scoring dimensions (1-5):
- UI Independence
- Schema Completeness
- Client Generation Quality

Inferred workflow types:
- Create To Detail
- List To Detail
- Action To Detail
- Accepted To Tracking

Real-spec proof points:
- 277 workflows inferred: 137 create to detail, 137 list to detail, 3 action to detail
- Common score pattern: 4/4/5

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
- CI-friendly non-zero exits for analyze (errors) and diff (breaking changes)

## Current Limitations

- No `$ref` resolution, so coverage is partial on component-heavy specs
- Workflow inference is pairwise (no richer multi-step chain inference yet)
- Analysis currently focuses on JSON media type schemas
- YAML parsing is not currently supported
