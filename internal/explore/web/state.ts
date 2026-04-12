function createEmptyFilters(): ExplorerFilters {
  return {
    search: "",
    category: "all",
    familyPressure: "all",
    includeNoIssueRows: false
  };
}

function createInitialExplorerState(): ExplorerState {
  return {
    payload: null,
    selectedEndpointId: "",
    userSelectedEndpoint: false,
    activeTopTab: "spec-rule",
    endpointDiagnosticsSubTab: "summary",
    expandedFamily: "",
    expandedFamilyInsight: "",
    expandedFamilySignals: {},
    expandedEndpointInsightIds: {},
    expandedEndpointRowFindings: {},
    inspectingEndpointId: "",
    inspectPlacementHint: "",
    shapeWorkspaceCollapsed: false,
    issueScopeIndex: null,
    issueScopeIndexKey: "",
    familyTableShowAll: false,
    workflowChainsOpen: true,
    workflowChainFocusChainId: "",
    workflowChainFocusEndpointIds: [],
    inspectorWorkflowContextOpen: null,
    familyTableBackState: null,
    familyTableSort: {
      key: "default",
      direction: "asc"
    },
    detailEvidenceOpenForId: "",
    filters: createEmptyFilters()
  };
}

function createExplorerElements(doc: Document): ExplorerElements {
  return {
    runContext: doc.getElementById("runContext"),
    quickActions: doc.getElementById("quickActions"),
    resetControl: doc.getElementById("resetControl"),
    searchInput: doc.getElementById("searchInput") as HTMLInputElement | null,
    categoryFilter: doc.getElementById("categoryFilter") as HTMLSelectElement | null,
    familyPriorityFilter: doc.getElementById("familyPriorityFilter") as HTMLSelectElement | null,
    includeNoIssueRows: doc.getElementById("includeNoIssueRows") as HTMLInputElement | null,
    lensControlHint: doc.getElementById("lensControlHint"),
    filterEmptyState: doc.getElementById("filterEmptyState"),
    familySurfaceHelp: doc.getElementById("familySurfaceHelp"),
    familySurfaceContext: doc.getElementById("familySurfaceContext"),
    familySurface: doc.getElementById("familySurface"),
    workflowSection: doc.getElementById("workflowSection"),
    workflowHelp: doc.getElementById("workflowHelp"),
    workflowChains: doc.getElementById("workflowChains"),
    listContext: doc.getElementById("listContext"),
    endpointRows: doc.getElementById("endpointRows"),
    detailHelp: doc.getElementById("detailHelp"),
    endpointDetail: doc.getElementById("endpointDetail")
  };
}
