# AGENTS.md

## Goal
This repo builds an API explorer that helps identify:
1. contract problems,
2. workflow problems,
3. response-shape problems

The UI must optimize for:
- fast scanning
- clear inline expansion
- no duplicate controls
- no jumpy scroll behavior
- no hidden or clipped columns
- no content loss during refactors

## UI rules
- Prefer table/row layouts over card walls
- Expansions must open directly under the triggering row
- Clicking the same trigger again must close the same expansion
- No dead controls
- No duplicate expand/collapse controls for the same content
- No repeated filter-summary text if the filters are already visible
- No bottom detached inspector panel unless explicitly required
- Keep all existing useful evidence and workflow-chain information

## Interaction rules
- No auto-scroll unless the user clicked a clearly labeled jump action
- Preserve current tab when resetting filters
- Only one row/family selection highlight at a time
- Expanded content must remain visually attached to its source row

## Testing rules
Before finishing, always run:
- relevant unit/regression tests
- any UI snapshot/visual tests available
- at minimum, verify no new clipped columns, duplicate headers, or broken toggles

## Output rules
When completing a task:
1. list exact files changed
2. summarize behavior change
3. note any regression risks
4. confirm tests run
