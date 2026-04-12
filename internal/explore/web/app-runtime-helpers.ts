declare var state: ExplorerState;
declare var el: ExplorerElements;
declare function captureFamilyTableBackStateIfNeeded(
  state: ExplorerState,
  override?: { search?: string }
): void;
declare function clearCurrentLens(): void;
declare function familyPressureByFamily(rows: ExplorerEndpointRow[]): StringMap<string>;
declare function humanFamilyLabel(name: string): string;
declare function lensFindingCountForRow(row: ExplorerEndpointRow | null | undefined): number;
declare function payloadEndpointDetails(): StringMap<ExplorerEndpointDetail>;
declare function priorityRank(priority: string): number;
declare function pulseLensUpdate(): void;
declare function render(): void;
declare function renderEndpointDetail(): void;
declare function renderEndpointDiagnostics(): void;
declare function renderFamilySurface(): void;
declare function restoreFamilyTableBackState(state: ExplorerState): void;
declare function syncSelectedEndpointHighlight(): void;
declare function syncWorkflowStepSelectionHighlight(): void;
declare function formatFilterSummaryHtml(): string;

function appRuntimeSyncControls(): void {
  el.searchInput.value = state.filters.search;
  el.categoryFilter.value = state.filters.category;
  el.familyPriorityFilter.value = state.filters.familyPressure;
  el.includeNoIssueRows.checked = state.filters.includeNoIssueRows;

  el.categoryFilter.disabled = false;
  el.categoryFilter.removeAttribute('title');

  var categoryField = el.categoryFilter ? el.categoryFilter.closest('.field') : null;
  if (categoryField) {
    categoryField.classList.remove('field-hidden-by-lens');
    categoryField.setAttribute('aria-hidden', 'false');
  }

  if (el.lensControlHint) {
    el.lensControlHint.innerHTML = formatFilterSummaryHtml();
  }
}

function appRuntimeEndpointRowForId(endpointId: string): ExplorerEndpointRow | null {
  if (!endpointId || !state.payload || !state.payload.endpoints) return null;
  return (state.payload.endpoints || []).find(function (row) {
    return row && row.id === endpointId;
  }) || null;
}

function appRuntimeEndpointDetailForId(endpointId: string): ExplorerEndpointDetail | null {
  if (!endpointId || !state.payload) return null;
  var details = payloadEndpointDetails();
  if (details && details[endpointId]) return details[endpointId];
  var row = appRuntimeEndpointRowForId(endpointId);
  if (!row) return null;
  return {
    endpoint: row,
    findings: [],
    relatedWorkflows: [],
    relatedChains: [],
    relatedDiff: []
  } as ExplorerEndpointDetail;
}

function appRuntimeSelectEndpointForInspector(endpointId: string, subTab?: string): void {
  if (!endpointId) return;
  if (state.activeTopTab === 'workflow'
      && state.workflowChainFocusEndpointIds
      && state.workflowChainFocusEndpointIds.length
      && state.workflowChainFocusEndpointIds.indexOf(endpointId) === -1) {
    state.workflowChainFocusChainId = '';
    state.workflowChainFocusEndpointIds = [];
  }
  state.inspectingEndpointId = endpointId;
  state.selectedEndpointId = endpointId;
  state.userSelectedEndpoint = true;
  state.inspectPlacementHint = 'nested';

  var detailForFocus = appRuntimeEndpointDetailForId(endpointId);
  var endpointForFocus = detailForFocus && detailForFocus.endpoint ? detailForFocus.endpoint : appRuntimeEndpointRowForId(endpointId);
  var familyForFocus = endpointForFocus ? (endpointForFocus.family || '') : '';
  if (familyForFocus) {
    captureFamilyTableBackStateIfNeeded(state);
    state.expandedFamily = familyForFocus;
    if (state.expandedFamilyInsight && state.expandedFamilyInsight !== familyForFocus) {
      state.expandedFamilyInsight = '';
    }
  }

  state.endpointDiagnosticsSubTab = (typeof subTab === 'string' && subTab)
    ? subTab
    : (state.endpointDiagnosticsSubTab || 'summary');

  renderFamilySurface();
  renderEndpointDiagnostics();
  renderEndpointDetail();
  syncSelectedEndpointHighlight();
  syncWorkflowStepSelectionHighlight();

  requestAnimationFrame(function () {
    state.inspectingEndpointId = '';
    renderFamilySurface();
    renderEndpointDiagnostics();
  });
}

function appRuntimeScopedRows(rows: ExplorerEndpointRow[]): ExplorerEndpointRow[] {
  return rows.filter(function (row) {
    if (state.filters.search) {
      var hay = (row.method + ' ' + row.path + ' ' + (row.family || '')).toLowerCase();
      if (hay.indexOf(state.filters.search) === -1) return false;
    }
    return true;
  });
}

function appRuntimeRowsInScopeAll(): ExplorerEndpointRow[] {
  var counts: StringMap<number> = {};
  var focusMap: StringMap<boolean> | null = null;
  if (state.workflowChainFocusEndpointIds && state.workflowChainFocusEndpointIds.length) {
    focusMap = {};
    state.workflowChainFocusEndpointIds.forEach(function (endpointId) {
      if (!endpointId) return;
      focusMap![endpointId] = true;
    });
  }
  function lensCount(row: ExplorerEndpointRow): number {
    if (!row || !row.id) return 0;
    if (counts[row.id] !== undefined) return counts[row.id];
    counts[row.id] = lensFindingCountForRow(row);
    return counts[row.id];
  }

  var rows = appRuntimeScopedRows((state.payload && state.payload.endpoints) ? state.payload.endpoints : []);
  var requiresEvidenceSlice = (state.filters.category !== 'all')
    || state.activeTopTab === 'workflow'
    || state.activeTopTab === 'shape';
  if (requiresEvidenceSlice) {
    rows = rows.filter(function (row) {
      if (lensCount(row) > 0) return true;
      return !!(focusMap && focusMap[row.id]);
    });
  }

  if (state.filters.familyPressure !== 'all') {
    var pressureMap = familyPressureByFamily(rows);
    rows = rows.filter(function (row) {
      var key = row.family || 'unlabeled family';
      return pressureMap[key] === state.filters.familyPressure;
    });
  }

  return rows;
}

function appRuntimeFilteredRows(): ExplorerEndpointRow[] {
  var counts: StringMap<number> = {};
  function lensCount(row: ExplorerEndpointRow): number {
    if (!row || !row.id) return 0;
    if (counts[row.id] !== undefined) return counts[row.id];
    counts[row.id] = lensFindingCountForRow(row);
    return counts[row.id];
  }

  var rows = appRuntimeRowsInScopeAll();
  if (!state.filters.includeNoIssueRows) {
    rows = rows.filter(function (row) { return lensCount(row) > 0; });
  }

  rows.sort(function (a, b) {
    if (priorityRank(a.priority || '') !== priorityRank(b.priority || '')) return priorityRank(a.priority || '') - priorityRank(b.priority || '');
    var aCount = lensCount(a);
    var bCount = lensCount(b);
    if (aCount !== bCount) return bCount - aCount;
    return a.path.localeCompare(b.path);
  });

  return rows;
}

function appRuntimeFirstEvidenceEndpointId(rows: ExplorerEndpointRow[]): string {
  var found = (rows || []).find(function (row) { return lensFindingCountForRow(row) > 0; });
  return found ? found.id : (rows[0] ? rows[0].id : '');
}

function appRuntimeFirstVisibleEndpointId(rows: ExplorerEndpointRow[]): string {
  if (!rows || !rows.length) return '';
  var withEvidence = rows.find(function (row) { return lensFindingCountForRow(row) > 0; });
  return withEvidence ? withEvidence.id : rows[0].id;
}

function appRuntimeRowDominantIssue(row: ExplorerEndpointRow): { label: string; code: string } {
  var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
  var detail = endpointDetails[row.id];
  var findings = detail ? findingsForActiveLens(detail.findings || []) : [];
  if (!detail || !findings.length) {
    return { label: 'No direct issue evidence', code: 'n/a' };
  }

  var first = findings[0];
  return {
    label: uiIssueDimensionForFinding(first.code || '', first.category || '', first.burdenFocus || ''),
    code: first.code || 'n/a'
  };
}

function appRuntimeApplyRecoveryAction(action: string): void {
  if (action === 'clear-search') {
    state.filters.search = '';
  } else if (action === 'reset-category') {
    state.filters.category = 'all';
    state.familyTableShowAll = false;
  } else if (action === 'show-all-matching-families') {
    state.filters.search = '';
    state.filters.category = 'all';
    state.filters.familyPressure = 'all';
    state.filters.includeNoIssueRows = false;
    state.familyTableShowAll = true;
    state.familyTableBackState = null;
    state.expandedFamily = '';
    state.expandedFamilyInsight = '';
    state.expandedEndpointInsightIds = {};
    state.expandedEndpointRowFindings = {};
    state.detailEvidenceOpenForId = '';
  } else if (action === 'back-to-all-families') {
    restoreFamilyTableBackState(state);
  } else if (action === 'back-to-family-table') {
    restoreFamilyTableBackState(state);
  } else if (action === 'show-all-families') {
    state.familyTableShowAll = true;
  } else if (action === 'show-all-workflows') {
    state.filters.search = '';
    state.filters.category = 'all';
    state.filters.familyPressure = 'all';
  } else if (action === 'include-no-issue-rows') {
    state.filters.includeNoIssueRows = true;
  } else if (action === 'clear-table-filters') {
    state.filters.search = '';
    state.filters.category = 'all';
    state.filters.familyPressure = 'all';
    state.filters.includeNoIssueRows = false;
    state.familyTableShowAll = false;
    state.familyTableBackState = null;
    state.expandedFamily = '';
    state.expandedFamilyInsight = '';
    state.expandedEndpointInsightIds = {};
    state.expandedEndpointRowFindings = {};
    state.detailEvidenceOpenForId = '';
  } else if (action === 'clear-current-lens') {
    if (state.activeTopTab === 'spec-rule') {
      state.filters.search = '';
      state.filters.category = 'spec-rule';
      state.filters.familyPressure = 'all';
      state.filters.includeNoIssueRows = false;
      state.familyTableBackState = null;
      state.expandedFamily = '';
      state.expandedFamilyInsight = '';
      state.expandedEndpointInsightIds = {};
      state.detailEvidenceOpenForId = '';
      state.familyTableShowAll = false;
      state.endpointDiagnosticsSubTab = 'exact';
      state.selectedEndpointId = '';
    } else {
      clearCurrentLens();
      return;
    }
  }

  if (state.activeTopTab === 'shape') {
    state.endpointDiagnosticsSubTab = 'summary';
  }

  state.selectedEndpointId = '';
  state.userSelectedEndpoint = false;
  state.detailEvidenceOpenForId = '';
  render();
  pulseLensUpdate();
}

function appRuntimeHumanFamilyLabel(name: string): string {
  if (!name) return 'unlabeled family';
  if (name === '/aggregate') return '/aggregate (cross-resource utility)';
  return name;
}

function appRuntimeDimensionCleanerHint(dimension: string): string {
  switch (dimension) {
    case 'typing/enum weakness':
      return 'Declare explicit enum values for finite value sets; avoid bare strings with no schema constraints.';
    case 'shape / storage-style response weakness':
      return 'Return a compact outcome payload focused on the client\'s next action, not a storage snapshot.';
    case 'hidden dependency / linkage burden':
      return 'Expose prerequisite identifier/state in the parent response so the next call can be formed without extra negotiation.';
    case 'workflow outcome weakness':
      return 'Include a tracking ID or a direct link to the created/updated resource in every action/202 response.';
    case 'shape / nesting complexity':
      return 'Declare typed item schemas on all array properties; avoid generic object/empty items schemas.';
    case 'internal/incidental fields':
      return 'Move join columns, audit timestamps, and storage-internal IDs out of public response schemas.';
    case 'consistency drift':
      return 'Align path parameter names and response field names across sibling endpoints operating on the same resource.';
    case 'change-risk clues':
      return 'Add deprecation notices and migration guidance before removing or changing visible behaviour.';
    default:
      return 'Replace generic response objects with named request/response components and name the exact fields clients must read.';
  }
}
