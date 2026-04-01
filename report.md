# api-doctor — Real-Spec Findings Report

**Spec:** Shopware Admin API (`adminapi.json`)
**Operations analyzed:** 1036
**Tool:** api-doctor `analyze` command, all 11 rules

---

## Summary

| Rule | Hits | Severity |
|---|---|---|
| `weak-follow-up-linkage` | 137 | warning |
| `generic-object-response` | 5 | warning |
| `likely-missing-enum` | 4 | warning |
| `weak-action-follow-up-linkage` | 3 | warning |
| `generic-object-request` | 2 | warning |
| `weak-accepted-tracking-linkage` | 1 | warning |
| `deprecated-operation` | 1 | warning |

No errors. All findings are warnings. Total: 153 issues across 1036 operations.

---

## Findings

### 1. `weak-follow-up-linkage` — 137 operations (dominant signal)

The largest finding by count. For 137 operations (~13% of the spec), the response schema does not clearly expose a resource ID or follow-up link at the schema level. A generated client cannot reliably chain `POST /x → GET /x/{id}` using only the declared schema — it has to infer the correct field by convention or read documentation.

The `workflows` command infers 274 create→detail and list→detail sequences from path shape and visible ID fields, but those inferences rely on structural pattern matching, not on the schema itself making the linkage explicit. Any operation in this group is one schema refactor away from breaking generated SDK workflows.

---

### 2. `generic-object-response` — Theme API (3 endpoints)

All three theme action endpoints declare their 200 response as a schema-less generic object:

- `PATCH /_action/theme/{themeId}`
- `POST /_action/theme/{themeId}/assign/{salesChannelId}`
- `PATCH /_action/theme/{themeId}/reset`

Generated clients receive `map[string]any` or equivalent. There is no typed return shape. Any properties the API returns are invisible to code generation and can change silently.

Two additional generic object responses outside the theme area:
- `GET /consents` (200)
- `GET /oauth/sso/code` (200)

---

### 3. `generic-object-request` — System Config (2 endpoints)

Both write endpoints for system configuration accept a generic object with no declared properties:

- `POST /_action/system-config`
- `POST /_action/system-config/batch`

Generated request builders have no typed shape to work from. Callers must read documentation or source to know what the request body should contain. There is no machine-readable contract for valid keys.

---

### 4. `likely-missing-enum` — 4 fields across 3 areas

Fields that appear enum-like by name convention but have no `enum` constraint in the schema:

| Field | Direction | Endpoint |
|---|---|---|
| `[].type` | request | `POST /_action/order/document/{documentTypeName}/create` |
| `mapping[].type` | request | `POST /_action/order/{orderId}/order-address` |
| `checks[].status` | response | `GET /_info/system-health-check` |
| `stats.messageTypeStats[].type` | response | `GET /_info/message-stats.json` |

Generated clients produce `string` for these fields. Valid values are undeclared, so callers have no machine-readable contract. Any value change is invisible to linting and breaking-change detection.

---

### 5. `weak-accepted-tracking-linkage` — 1 endpoint

`POST /_action/app-system/secret/rotate` returns HTTP 202 Accepted with no JSON body. There is no job ID, status URL, or any tracking identifier in the response schema. A generated client has no way to confirm or poll for completion.

---

### 6. `deprecated-operation` — 1 endpoint

`GET /_info/queue.json` is marked deprecated in the spec. It will be included in generated SDKs unless the generator is explicitly configured to omit deprecated operations. Callers using generated clients may be using an endpoint that could be removed without a major version bump.

---

### 7. `weak-action-follow-up-linkage` — 3 endpoints

The three order state transition endpoints do not make follow-up verification obvious from the response schema alone:

- `POST /_action/order/{orderId}/state/{transition}`
- `POST /_action/order_delivery/{orderDeliveryId}/state/{transition}`
- `POST /_action/order_transaction/{orderTransactionId}/state/{transition}`

The path carries the resource ID and a corresponding detail endpoint exists, but the response does not expose the resulting state or a direct follow-up link. Tool-inferred workflows cover this gap, but generated clients working from the schema alone can't verify the transition result without out-of-band knowledge.

---

## $ref Limitation

The current analysis skips all schemas resolved via `$ref`. The Shopware Admin API uses component references heavily — the majority of entity CRUD operations reference shared schemas in `#/components/schemas/`. This means:

- All findings above come from the minority of operations with inline schemas.
- `generic-object-response`, `likely-missing-enum`, `removed-request-field`, and `field-became-required` counts are all understated.
- The diff command's `removed-request-field` and `removed-response-field` checks only fire on inline schemas.

---

## Least Self-Describing Workflow Types

The weakest workflow patterns in the current Shopware Admin API analysis are Create To Detail and List To Detail. Together they account for 274 of 277 inferred workflows, and they align with the dominant weak-follow-up-linkage signal. In these flows, the response schema often does not clearly expose the identifier or follow-up linkage needed for the next obvious detail call. That weakens generated SDK ergonomics and makes client chaining depend more on convention, hard-coded path knowledge, or external documentation than on the schema itself.

Action To Detail is also somewhat weak, but in a narrower way: a small number of state-transition endpoints do not clearly expose the resulting state in the success response, making verification workflows less self-describing.

Accepted To Tracking currently shows only a limited weakness signal in the inferred set: one async endpoint lacks a tracking identifier in its 202 Accepted response. That is worth noting, but it is a smaller and less dominant issue than the create/detail and list/detail linkage gap.

---

## Diff Report: Version-to-Version Breaking Changes

When analyzing Shopware Admin API from an older release to the current version, the `diff` command detected **1 real breaking change**:

**`POST /_action/sync` — `request[].filter` removed**

The bulk sync endpoint previously accepted a `filter` property on each item in the request body array. In the new version, that field no longer appears in the schema.

**Impact:** Clients that pass a `filter` when syncing items will have the field silently ignored (or rejected, depending on validation strictness). This is a breaking change for any client that:
- Reads the old schema and generates code that includes `filter` in sync requests
- Relies on the server accepting the `filter` parameter for server-side searching within each sync batch

**Root cause:** Either the field was intentionally removed and callers need updating, or it was accidentally dropped from the component schema definition (likely during the `$ref` refactoring mentioned in the schema analysis).

This finding demonstrates that `diff` successfully catches real breaking changes in production API upgrades, even when changes are subtle (field removals in nested array schemas).

---
