# api-doctor

Static analysis CLI for OpenAPI 3 specs. Parses specs locally, runs deterministic rules, and reports issues in human-readable or JSON format. No network calls, no AI.

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

### `analyze`

Runs quality rules against a spec and reports issues grouped by severity.

```sh
# default output — one line per finding + summary
go run . analyze --spec ./adminapi.json

# verbose — adds technical detail to each finding
go run . analyze --spec ./adminapi.json --verbose

# machine-readable JSON for CI
go run . analyze --spec ./adminapi.json --json
```

**Output modes:**

| Mode | What you get |
|---|---|
| default | severity, rule code, endpoint, one-line "Why it matters" explanation |
| `--verbose` | everything above plus the exact detection message per finding |
| `--json` | structured JSON with all fields, suitable for piping or artifact storage |

**Rules:**

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

**Real-spec result (Shopware admin API, 1036 operations):** 153 warnings — including `generic-object-request` on `/_action/system-config`, `weak-action-follow-up-linkage` on three order state transition endpoints, and dozens of `likely-missing-enum` hits across the spec.

---

### `workflows`

Infers multi-step call sequences by pattern-matching paths and response shapes. Groups results by workflow category.

```sh
# default output — 3 representative examples per category
go run . workflows --spec ./adminapi.json

# verbose — all inferred workflows
go run . workflows --spec ./adminapi.json --verbose

# JSON
go run . workflows --spec ./adminapi.json --json
```

Default output shows up to 3 representative examples per category with a count of hidden extras; `--verbose` shows all of them.

**Inferred workflow types:** `Create To Detail`, `List To Detail`, `Action To Detail`, `Accepted To Tracking`.

**Real-spec result (Shopware admin API, 1036 operations):** 277 workflows inferred — 137 create→detail, 137 list→detail, 3 action→detail (all three on order/delivery/transaction state transitions).

---

### `diff`

Compares two spec versions and flags deterministic breaking changes. Exits non-zero if any changes are found, making it usable in CI.

```sh
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json

# JSON output
go run . diff --old ./adminapi-v1.json --new ./adminapi-v2.json --json
```

**Checks:**

| Check | What it detects |
|---|---|
| `removed-path` | an entire path was removed |
| `removed-operation` | an HTTP method was removed from a path |
| `removed-response-status-code` | a documented response code no longer appears |
| `removed-response-field` | a field was removed from a response schema |
| `removed-request-field` | a field was removed from a request body schema |
| `field-became-required` | an optional response field became required |
| `enum-value-removed` | a valid enum value was removed |

**Real-spec result (Shopware admin API, two consecutive releases):** 1 breaking change — `POST /_action/sync` dropped `request[].filter` from its request body schema. Clients that pass `filter` in bulk sync calls can no longer rely on the field being accepted.

---

## Current Capabilities

- Parses OpenAPI 3 JSON specs with no external dependencies
- Runs 11 analysis rules (7 per-op, 4 cross-op) deterministically
- Infers workflow sequences from path and response shape patterns
- Detects 7 categories of breaking change across two spec versions
- All three commands support `--json` for CI or downstream tooling
- `analyze` and `diff` exit non-zero when issues are found

## Current Limitations

- **No `$ref` resolution** — schemas behind `$ref` are skipped by all rules and diff checks; most production specs use components heavily, so effective coverage is partial
- **JSON content type only** — only `application/json` request/response bodies are inspected
- **No path-parameter or header diff** — removed path parameters, renamed parameters, and required-header changes are not detected
- **No severity filter flag** — no `--level error` to suppress warnings in CI; all findings are always emitted
- **YAML not supported** — only JSON spec files are parsed
