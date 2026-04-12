declare var state: ExplorerState;
declare var el: ExplorerElements;

declare function bindRecoveryButtons(container: ParentNode | null): void;
declare function buildFindingGroupKeyFromContext(finding: ExplorerFinding, context: OpenAPIContext): string;
declare function buildIssueScopeIndex(
  rows: ExplorerEndpointRow[],
  endpointDetails: StringMap<ExplorerEndpointDetail> | null,
  findingsForLens: (findings: ExplorerFinding[]) => ExplorerFinding[],
  groupKeyForFinding: (finding: ExplorerFinding) => string
): IssueScopeIndex;
declare function createEmptyFilters(): ExplorerFilters;
declare function deriveIssueScopeLabelForKey(groupKey: string, familyName: string, index: IssueScopeIndex): string;
declare function escapeHtml(value: unknown): string;
declare function extractOpenAPIContext(finding: ExplorerFinding): OpenAPIContext;
declare function familySummaries(): ExplorerFamilySummary[];
declare function familySummariesRaw(): ExplorerFamilySummary[];
declare function filteredRows(): ExplorerEndpointRow[];
declare function findingsForActiveLens(findings: ExplorerFinding[]): ExplorerFinding[];
declare function rowsInScopeAll(): ExplorerEndpointRow[];

function viewScopeEnforceSpecRuleTabFilterModel(): void {
  if (state.activeTopTab !== 'spec-rule') return;

  if (state.endpointDiagnosticsSubTab !== 'exact'
      && state.endpointDiagnosticsSubTab !== 'consistency'
      && state.endpointDiagnosticsSubTab !== 'cleaner'
      && state.endpointDiagnosticsSubTab !== 'summary') {
    state.endpointDiagnosticsSubTab = 'exact';
  }

  var specRows = filteredRows();
  if (!specRows.length) {
    state.selectedEndpointId = '';
    state.detailEvidenceOpenForId = '';
    return;
  }

  if (state.selectedEndpointId && !specRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
    state.selectedEndpointId = '';
    state.detailEvidenceOpenForId = '';
  }
}

function viewScopeEnforceWorkflowTabFilterModel(): void {
  if (state.activeTopTab !== 'workflow') return;

  if (state.endpointDiagnosticsSubTab === 'consistency' || state.endpointDiagnosticsSubTab === 'cleaner') {
    state.endpointDiagnosticsSubTab = 'summary';
  }

  if (state.filters.category === 'spec-rule' || state.filters.category === 'contract-shape') {
    state.filters.category = 'all';
  }

  var workflowRows = filteredRows();
  if (!workflowRows.length) {
    state.selectedEndpointId = '';
    state.detailEvidenceOpenForId = '';
    return;
  }

  if (state.selectedEndpointId && !workflowRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
    state.selectedEndpointId = '';
    state.detailEvidenceOpenForId = '';
  }
}

function viewScopeEnforceShapeTabFilterModel(): void {
  if (state.activeTopTab !== 'shape') return;

  if (state.endpointDiagnosticsSubTab === 'consistency') {
    state.endpointDiagnosticsSubTab = 'summary';
  }

  if (state.filters.category === 'spec-rule' || state.filters.category === 'workflow-burden') {
    state.filters.category = 'all';
  }

  var shapeRows = filteredRows();
  if (!shapeRows.length) {
    state.selectedEndpointId = '';
    state.detailEvidenceOpenForId = '';
    state.endpointDiagnosticsSubTab = 'summary';
    return;
  }

  if (state.selectedEndpointId && !shapeRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
    state.selectedEndpointId = '';
    state.detailEvidenceOpenForId = '';
    state.endpointDiagnosticsSubTab = 'summary';
  }
}

function viewScopeNormalizeSelectedEndpointForCurrentView(): void {
  var rows = filteredRows();

  if (!rows.length) {
    state.selectedEndpointId = '';
    return;
  }

  if (state.selectedEndpointId && !rows.some(function (row) { return row.id === state.selectedEndpointId; })) {
    state.selectedEndpointId = '';
  }
}

function viewScopePayloadEndpointDetails(): StringMap<ExplorerEndpointDetail> {
  return state.payload && state.payload.endpointDetails
    ? state.payload.endpointDetails
    : {};
}

function viewScopePayloadWorkflowChains(): ExplorerWorkflowChain[] {
  return state.payload && state.payload.workflows && state.payload.workflows.chains
    ? state.payload.workflows.chains
    : [];
}

function viewScopeLensFindingCountForRow(row: ExplorerEndpointRow | null | undefined): number {
  if (!row || !row.id || !state.payload || !state.payload.endpointDetails) return 0;
  var detail = viewScopePayloadEndpointDetails()[row.id];
  if (detail && detail.findings) {
    return findingsForActiveLens(detail.findings || []).length;
  }

  var categoryCounts = row.categoryCounts || {};
  var category = state.filters.category || 'all';
  var base = row.findings || 0;
  if (category !== 'all') {
    base = categoryCounts[category] || 0;
  }
  return base;
}

function viewScopeHasValidSelectedEndpointInCurrentView(): boolean {
  if (!state.selectedEndpointId) return false;
  return rowsInScopeAll().some(function (row) {
    return row.id === state.selectedEndpointId;
  });
}

function viewScopeSelectionRowsForActiveView(): ExplorerEndpointRow[] {
  return filteredRows();
}

function viewScopeIssueScopeIndexCacheKey(): string {
  var f = state.filters || createEmptyFilters();
  return [
    state.activeTopTab,
    f.search || '',
    f.category || '',
    f.familyPressure || '',
    f.includeNoIssueRows ? '1' : '0'
  ].join('|');
}

function viewScopeFindingGroupKey(finding: ExplorerFinding): string {
  return buildFindingGroupKeyFromContext(finding, extractOpenAPIContext(finding));
}

function viewScopeBuildIssueScopeIndexForCurrentView(): IssueScopeIndex {
  return buildIssueScopeIndex(
    viewScopeSelectionRowsForActiveView(),
    state.payload ? viewScopePayloadEndpointDetails() : null,
    findingsForActiveLens,
    viewScopeFindingGroupKey
  );
}

function viewScopeGetIssueScopeIndex(): IssueScopeIndex {
  var key = viewScopeIssueScopeIndexCacheKey();
  if (state.issueScopeIndex && state.issueScopeIndexKey === key) {
    return state.issueScopeIndex;
  }
  state.issueScopeIndex = viewScopeBuildIssueScopeIndexForCurrentView();
  state.issueScopeIndexKey = key;
  return state.issueScopeIndex;
}

function viewScopeIssueScopeLabelForKey(groupKey: string, familyName: string): string {
  return deriveIssueScopeLabelForKey(groupKey, familyName, viewScopeGetIssueScopeIndex());
}

function viewScopeFormatScopeValue(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  var text = String(value);
  if (!text) return fallback;
  return text;
}

function viewScopeFormatFilterSummaryHtml(): string {
  var families = familySummariesRaw().filter(function (family) {
    return state.filters.familyPressure === 'all' || family.pressure === state.filters.familyPressure;
  });
  var total = families.length || 0;
  var shown = state.familyTableShowAll ? total : Math.min(24, total);

  if (total === 0) {
    return '<strong>No families match the current filters.</strong>';
  }

  var lens = state.activeTopTab === 'workflow'
    ? 'workflow guidance burden'
    : state.activeTopTab === 'shape'
    ? 'response-shape burden'
    : 'contract issues';

  var prefix = state.activeTopTab === 'workflow'
    ? '<strong>Workflow Guidance:</strong> '
    : state.activeTopTab === 'shape'
    ? '<strong>Response Shape:</strong> '
    : '<strong>Contract Issues:</strong> ';

  if (state.activeTopTab === 'workflow'
      && state.workflowChainFocusEndpointIds
      && state.workflowChainFocusEndpointIds.length) {
    return prefix + 'Showing the selected chain\u2019s steps and their continuity signals.';
  }

  if (shown < total) {
    return prefix + 'Showing top ' + shown + ' of ' + total + ' families with ' + escapeHtml(lens) + '.';
  }
  return prefix + 'Showing ' + total + ' famil' + (total === 1 ? 'y' : 'ies') + ' with ' + escapeHtml(lens) + '.';
}

function viewScopeRenderFilterEmptyState(): void {
  if (!el.filterEmptyState) return;
  el.filterEmptyState.innerHTML = '';

  if (state.activeTopTab !== 'spec-rule') return;

  var families = familySummaries();
  var rows = filteredRows();
  if (families.length || rows.length) return;

  var primaryAction = '';
  var primaryLabel = '';
  var why = '';
  if (state.filters.search) {
    primaryAction = 'clear-search';
    primaryLabel = 'Clear search';
    why = 'The current search is narrower than the available contract-issue evidence in this slice.';
  } else if (state.filters.category !== 'all' && state.filters.category !== 'spec-rule') {
    primaryAction = 'reset-category';
    primaryLabel = 'Reset category';
    why = 'The selected category has no matching contract-issue families in this slice.';
  } else if (state.filters.familyPressure !== 'all') {
    primaryAction = 'clear-table-filters';
    primaryLabel = 'Show all family priorities';
    why = 'The selected family priority tier hides all contract-issue families in this slice.';
  } else {
    primaryAction = 'clear-table-filters';
    primaryLabel = 'Clear table filters';
    why = 'The current filter combination is narrower than the available contract-issue evidence in this slice.';
  }

  var actionHtml = '<div class="filter-empty-actions">'
    + '<button type="button" class="primary-action" data-recovery-action="' + escapeHtml(primaryAction) + '">' + escapeHtml(primaryLabel) + '</button>'
    + '</div>';

  el.filterEmptyState.innerHTML = '<section class="filter-empty-panel" aria-label="No matching families">'
    + '<p class="filter-empty-title"><strong>No matching families</strong></p>'
    + '<p class="filter-empty-lead">No contract-issue families match the current filters.</p>'
    + '<p class="subtle">' + escapeHtml(why) + '</p>'
    + actionHtml
    + '</section>';

  bindRecoveryButtons(el.filterEmptyState);
}
