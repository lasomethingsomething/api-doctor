function clearEndpointSelectionState(state: ExplorerState): void {
  state.selectedEndpointId = "";
  state.userSelectedEndpoint = false;
  state.detailEvidenceOpenForId = "";
}

function applyFilterStateChange(
  state: ExplorerState,
  mutate: () => void,
  invalidateDerivedCaches: () => void,
  render: () => void
): void {
  mutate();
  clearEndpointSelectionState(state);
  invalidateDerivedCaches();
  state.familyTableShowAll = false;
  render();
}

function resetInlineUiState(state: ExplorerState): void {
  state.expandedFamily = "";
  state.expandedFamilyInsight = "";
  state.expandedFamilySignals = {};
  state.expandedEndpointInsightIds = {};
  state.expandedEndpointRowFindings = {};
  state.inspectingEndpointId = "";
  state.inspectPlacementHint = "";
  state.selectedEndpointId = "";
  state.userSelectedEndpoint = false;
  state.detailEvidenceOpenForId = "";
  state.workflowChainFocusChainId = "";
  state.workflowChainFocusEndpointIds = [];
  state.familyTableBackState = null;
}

function applyTabDefaults(
  state: ExplorerState,
  tabId: string,
  topTabIndex: { [key: string]: ExplorerTopTab },
  options?: { resetFilters?: boolean }
): void {
  var cfg = topTabIndex[tabId] || topTabIndex["spec-rule"];
  var opts = options || {};
  state.activeTopTab = cfg.id;
  state.endpointDiagnosticsSubTab = cfg.defaultSubTab;
  if (opts.resetFilters !== false) {
    state.filters.search = "";
    state.filters.category = cfg.defaultCategory;
    state.filters.familyPressure = "all";
    state.filters.includeNoIssueRows = false;
  }
}
