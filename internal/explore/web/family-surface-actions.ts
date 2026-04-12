function cloneJSONValue<T>(obj: T, fallback: T): T {
  try {
    return JSON.parse(JSON.stringify(obj || fallback));
  } catch (e) {
    return fallback;
  }
}

function hasFamilyScopeActive(state: ExplorerState): boolean {
  return !!state.filters.search
    || state.filters.familyPressure !== "all"
    || !!state.expandedFamily
    || !!state.expandedFamilyInsight
    || Object.keys(state.expandedEndpointInsightIds || {}).length > 0;
}

function hasFamilyDrillActive(
  state: ExplorerState,
  isExactFamilyName: (value: string) => boolean
): boolean {
  if (state.familyTableBackState) return true;
  if (state.expandedFamily) return true;
  if (state.expandedFamilyInsight) return true;
  if (Object.keys(state.expandedEndpointInsightIds || {}).length > 0) return true;
  return isExactFamilyName((state.filters.search || "").trim().toLowerCase());
}

function captureFamilyTableBackStateIfNeeded(
  state: ExplorerState,
  overrides?: { search?: string }
): void {
  if (state.familyTableBackState) return;
  var o = overrides || {};
  state.familyTableBackState = {
    search: (typeof o.search === "string") ? o.search : (state.filters.search || ""),
    familyTableShowAll: !!state.familyTableShowAll,
    expandedFamily: state.expandedFamily || "",
    expandedFamilyInsight: state.expandedFamilyInsight || "",
    expandedEndpointInsightIds: cloneJSONValue(state.expandedEndpointInsightIds || {}, {}),
    expandedEndpointRowFindings: cloneJSONValue(state.expandedEndpointRowFindings || {}, {}),
    detailEvidenceOpenForId: state.detailEvidenceOpenForId || ""
  } as ExplorerFamilyBackState;
}

function restoreFamilyTableBackState(state: ExplorerState): void {
  if (!state.familyTableBackState) {
    state.expandedFamily = "";
    state.expandedFamilyInsight = "";
    state.expandedEndpointInsightIds = {};
    state.expandedEndpointRowFindings = {};
    state.detailEvidenceOpenForId = "";
    return;
  }

  var s = state.familyTableBackState as ExplorerFamilyBackState;
  state.filters.search = s.search || "";
  state.familyTableShowAll = !!s.familyTableShowAll;
  state.expandedFamily = s.expandedFamily || "";
  state.expandedFamilyInsight = s.expandedFamilyInsight || "";
  state.expandedEndpointInsightIds = s.expandedEndpointInsightIds || {};
  state.expandedEndpointRowFindings = s.expandedEndpointRowFindings || {};
  state.detailEvidenceOpenForId = s.detailEvidenceOpenForId || "";

  if (state.expandedFamily && state.expandedFamilyInsight && state.expandedFamily !== state.expandedFamilyInsight) {
    state.expandedFamilyInsight = "";
  }
  state.familyTableBackState = null;
}

function focusFamilySurface(
  state: ExplorerState,
  family: string,
  filteredRows: () => ExplorerEndpointRow[],
  render: () => void
): void {
  if (!family) return;

  captureFamilyTableBackStateIfNeeded(state);
  state.filters.search = family.trim().toLowerCase();
  state.familyTableShowAll = false;
  clearEndpointSelectionState(state);

  var rows = filteredRows();
  if (state.selectedEndpointId && !rows.some(function (r) { return (r && r.id) === state.selectedEndpointId; })) {
    clearEndpointSelectionState(state);
  }

  render();
}
