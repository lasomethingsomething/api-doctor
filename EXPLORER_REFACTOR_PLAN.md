# Explorer Refactor: Evidence-Driven, Spec-Grounded Design

Historical planning note:

- This document captures a prior design exploration pass.
- Current canonical product framing is in [README.md](README.md) and [docs/usage.md](docs/usage.md).
- If wording conflicts, prefer the canonical docs.

## 1. EVIDENCE SIGNAL INVENTORY

### Existing Signals (Already in Payload)

**Typing/Contract Weakness:**
- `generic-object-request` / `generic-object-response` (rule)
- `likely-missing-enum` (rule)
- `missing-request-schema` / `missing-response-schema` (rule)
- `weak-array-items-schema` (rule)
- Category: `typing` (explorer already groups)

**Response Contract / Workflow Guidance:**
- `contract-shape-workflow-guidance-burden` (rule) — snapshot-heavy responses
- `prerequisite-task-burden` (rule) — hidden dependencies
- Category: `contract-shape` (explorer burden filter)

**Workflow Linkage Weakness:**
- `weak-follow-up-linkage` (rule) — POST response should enable next GET
- `weak-list-detail-linkage` (rule) — list does not clearly link to detail
- `weak-accepted-tracking-linkage` (rule) — 202 Accepted doesn't expose tracker ID
- `weak-action-follow-up-linkage` (rule) — action endpoint result linkage weak
- Category: `workflow-burden` (explorer burden filter)

**Consistency/Drift:**
- `inconsistent-response-shape` (rule) — shape varies across methods/paths
- `detail-path-parameter-name-drift` (rule) — detail ID parameter has inconsistent name
- `endpoint-path-style-drift` (rule) — path style inconsistent in endpoint family
- `sibling-path-shape-drift` (rule) — sibling endpoints have shape drift
- Category: `consistency` (explorer burden filter)

**Change Risk / Deprecation:**
- `deprecated-operation` (rule)
- Category: `change-risk` (explorer uses)

**Endpoint Priority/Pressure:**
- `priority` field (high/medium/low) — computed in payload builder
- `findings` count — issue count per endpoint
- Family-level pressure — can be computed from endpoint priorities

### Signals That Could Be Improved (Not Yet Explored)

- **Nesting complexity** — deep `$schema references or array-of-array patterns (currently not explicitly signaled)
- **Internal/incidental fields** — fields like `_id`, `internalState` (not yet explicitly detected)
- **Duplicated state / repeated branches** — multiple fields with same semantic meaning (not yet flagged)
- **State client must keep aligned** — explicit prerequisite lookups, opaque identifier counts (inferrable but not yet surfaced)

---

## 2. EVIDENCE DIMENSION TAXONOMY

**Core dimensions the explorer should surface:**

1. **Typing / Enum Weakness**
   - Missing enum constraints or generic object types
   - Client must guess field values
   - Rules: `likely-missing-enum`, `generic-object-*`
   - Impact: client confusion, runtime errors

2. **Response Contract Weakness**
   - Missing explicit fields, snapshot-heavy patterns, storage shape not task-shaped
   - Client cannot clearly identify outcome or next operation
   - Rules: `contract-shape-workflow-guidance-burden`, `missing-response-schema`
   - Impact: client must infer or guess, fail-silent risks

3. **Hidden Next-Step Dependencies**
   - Response doesn't expose prerequisite lookups or next-step handles
   - Client must discover IDs from other endpoints or context
   - Rules: `prerequisite-task-burden`, `weak-follow-up-linkage`, `weak-list-detail-linkage`, `weak-accepted-tracking-linkage`
   - Impact: workflow completion burden, hidden coupling

4. **Weak Workflow Outcome Modeling**
   - Result/state not clearly surfaced (e.g., 202 Accepted with no tracking ID)
   - Action endpoints don't link to state-change verification
   - Rules: weak-*-linkage family
   - Impact: client cannot confirm completion, workflow ambiguity

5. **Storage-Shaped / Snapshot-Heavy Responses**
   - Response exposes internal/snapshot state rather than task outcome
   - Multiple unrelated fields mixed
   - Rules: `contract-shape-workflow-guidance-burden`
   - Impact: client bloat, unclear task boundary, brittleness

6. **Internal / Incidental Field Exposure**
   - Fields like `_internal`, `system_state`, `debug_info` visible to client
   - Client couples to impl details
   - Rules: (not yet explicit, but can be inferred from naming)
   - Impact: API fragility, unavoidable coupling

7. **Consistency Drift**
   - Response shape varies across endpoints, methods, or siblings
   - Path style inconsistent
   - Parameter naming drifts
   - Rules: `inconsistent-response-shape`, `*-drift` family
   - Impact: client must handle multiple shapes, errors in generation

8. **Change-Risk Clues**
   - Deprecated endpoints, planned removals
   - Rules: `deprecated-operation`
   - Impact: migration urgency

9. **Nesting Complexity** (not yet fully explicit)
   - Deep or recursive structures, array-of-array patterns
   - Rules: (can infer from `weak-array-items-schema`)
   - Impact: schema parsing complexity, client code generation bloat

---

## 3. PAGE STRUCTURE & FLOW

### Current State
- Launch cards (4) at top → apply filter/lens
- Presets list (fix-first) → apply specific pre-learned lens
- Family/workflow panel → explore related families + workflow patterns
- Endpoint list → filtered view with scores and counts
- Detail panel → issue messages + related workflows/chains

### Proposed State

**More explicit evidence-grounding. Clearer action flow.**

```
┌─────────────────────────────────────────────────────────────────┐
│  [ Action Launch Area ]                                          │
│  • "Inspect highest-burden family" → load family + rep endpoint │
│  • "Filter by issue dimension" → all endpoints with that burden  │
│  • "Check workflow linkage issues" → workflow-burden filter      │
│  • "Scan for change risk" → deprecated + high-impact            │
│  Clear, consequence-driven CTA buttons.                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [ Investigation Preset Lenses ]                                │
│  • Priority queue (fix-first) — pre-learned important combos    │
│  Clicking applies lens + selects most-evidence endpoint         │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────┬─────────────────────────────────────┐
│ EVIDENCE INVESTIGATION     │ ENDPOINT DETAIL INSPECTION           │
│ ────────────────────────   │ ───────────────────────────────────  │
│ [ Evidence Scope / State ] │ [ Selected endpoint metadata ]       │
│                            │                                      │
│ [ Family/Cluster Panel ]   │ [ Dominant Issue Dimensions]        │
│  Families ranked by:       │  Stacked bars or chips showing:     │
│  - Total findings          │  - Typing weakness (2 issues)      │
│  - Issue dimension mix     │  - Contract weakness (3 issues)    │
│  - Pressure (h/m/l)        │  - Workflow linkage (1 issue)      │
│  - Flow pattern            │                                      │
│                            │ [ Exact Issue Messages ]            │
│  Click family:             │  Expandable list of findings        │
│  - Load family's evidence  │  Each shows severity, code, msg     │
│  - Select rep endpoint     │  Expanded state shows:              │
│  - Filter list to family   │   - What to examine in spec         │
│                            │   - Related workflow context        │
│ [ Evidence Filter Control] │   - Why this impacts client        │
│  • Dimension toggling      │                                      │
│  • Severity level          │ [ Related Workflows ]               │
│  • Category/burden         │  Flow pairs with this endpoint      │
│  • Finding-count threshold │                                      │
│                            │ [ Related Endpoint Families ]       │
│ [ Endpoint Evidence List ] │  Chains and multi-step patterns     │
│  Rows show:               │                                      │
│  - Method + path          │ [ Change-Risk Evidence ]            │
│  - Family chip            │  Deprecation, related diffs         │
│  - Dominant issue dims    │                                      │
│  - Issue count            │                                      │
│  - Pressure badge         │                                      │
│                            │                                      │
│  Sort options:            │                                      │
│  - By pressure (default)  │                                      │
│  - By issue count         │                                      │
│  - Alphabetically         │                                      │
│                            │                                      │
│  Click row:              │                                      │
│  - Jump to detail        │                                      │
│  - Show all issues       │                                      │
│  - Show workflows        │                                      │
└────────────────────────────┴─────────────────────────────────────┘
```

### Key Design Decisions

1. **Launch area is action-driven, not card-heavy**
   - Each CTA has a clear consequence
   - User understands what will happen before clicking
   - No vague generic scores

2. **Family/cluster exploration is visual and grouped**
   - Families ranked by findings + evidence dimension mix
   - Clear family pressure derived from endpoint priorities
   - Can see workflow patterns inferred
   - Click loads representative endpoint → filters family

3. **Evidence list is dimension-first**
   - Dominant issue dimensions shown before score
   - Clicking a row shows all issues + exact spec-grounded messages
   - Related workflows visible (enables context)

4. **Detail panel is evidence-centric**
   - Top section: dimension summary (stacked view, not just list)
   - Middle section: exact issue messages with spec guidance
   - Related workflows + chains for context
   - Change-risk signals included

5. **Investigation state is integrated**
   - Clearly labels what is being investigated and why
   - Shows consequences (how many endpoints match, what changed)
   - Paired with affected section (filters tied to list, dimension toggles tied to detail, family clicks tied to both)

---

## 4. MAPPING RULES TO EVIDENCE DIMENSIONS

| Dimension | Rule Codes Involved | Can Explorer-Side Group? |
|-----------|-------------------|------------------------|
| Typing/Enum | `likely-missing-enum`, `generic-object-*` | Yes, category-based |
| Response Contract | `contract-shape-workflow-guidance-burden`, `missing-response-schema`, `missing-request-schema` | Yes, burden + category |
| Hidden Dependencies | `prerequisite-task-burden` | Yes, burden-focused |
| Weak Workflow Outcome | `weak-follow-up-linkage`, `weak-list-detail-linkage`, `weak-accepted-tracking-linkage`, `weak-action-follow-up-linkage` | Yes, rule-family grouping |
| Storage-Shaped | `contract-shape-workflow-guidance-burden` | Yes, burden-focused |
| Internal Fields | (not yet explicit, infer from naming) | Partial—naming heuristics only |
| Consistency Drift | `inconsistent-response-shape`, `*-drift` rules | Yes, rule-family grouping |
| Change Risk | `deprecated-operation` | Yes, category-based |
| Nesting Complexity | (infer from `weak-array-items-schema`) | Partial—weak signal |

---

## 5. IMPLEMENTATION SCOPE

### No Analyzer Changes
Explorer-side grouping is sufficient. All evidence dimensions are achievable from existing rule codes + category signals.

### Explorer Changes
1. **Evidence taxonomy:** Add explicit dimension labels and descriptions
2. **Launch area:** Reframe CTAs as action-consequence pairs, remove weak summary cards
3. **Family panel:** Add dimension chip rendering, improve pressure labeling
4. **Endpoint list:** Surface dominant dimensions instead of just counts
5. **Detail panel:** Add dimension summary block, show evidence basis for each issue
6. **Investigation state:** Integrate with sections it affects, clarify consequences
7. **CSS:** Dimension chips, stacked bar styling (optional visual enhancements)

### Testing
- Run analyzer on real spec (adminapi.json) to validate dimension grouping
- Verify all 17 rule codes map to at least one dimension
- Check that dimension summaries are meaningful (not empty or contradictory)

---

## VALIDATION QUESTIONS

Before implementation, confirm:

1. **Evidence dimensions**: Are the 9 dimensions above the right set for this API context?
2. **Launch area**: Should weak summary cards (families, patterns, etc.) be replaced entirely, or merged with launch CTAs?
3. **Family panel visual treatment**: Is dimension chip display (top-3 per family) sufficient, or should we add stacked bar for dimension mix?
4. **Nesting complexity**: Should we infer from `weak-array-items-schema` signal, or defer that dimension until a clearer rule exists?
5. **Internal fields**: Should we include a heuristic (field name contains `_` or `internal`), or skip this dimension until explicit rule exists?

---

## IMPLEMENTATION ORDER

If approved:

1. Update `issueDimensionForFinding()` to be authoritative dimension taxonomy
2. Add dimension summaries to endpoint detail (dimension mix block)
3. Reframe launch cards as action CTAs with clearer language
4. Update investigation state integration (tie to sections)
5. Enhance family panel with dimension chips
6. Update endpoint list to show dominant dimension more prominently
7. Add spec-grounded "what to examine" hints in detail panel
8. Test against adminapi.json
9. Commit with clear message about spec-grounding and evidence taxonomy
