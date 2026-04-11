type StringMap<T> = { [key: string]: T };

interface ExplorerFilters {
  search: string;
  category: string;
  familyPressure: string;
  includeNoIssueRows: boolean;
}

interface ExplorerFamilyTableSort {
  key: string;
  direction: string;
}

interface ExplorerTopTab {
  id: string;
  label: string;
  copy: string;
  color: string;
  bodyClass: string;
  defaultCategory: string;
  defaultSubTab: string;
  familyEyebrow: string;
  familyHeading: string;
  familyHelp: string;
  emptyHelp: string;
  signalHeader: string;
  riskHeader: string;
  clientEffectHeader: string;
}

interface ExplorerState {
  payload: any;
  selectedEndpointId: string;
  userSelectedEndpoint: boolean;
  activeTopTab: string;
  endpointDiagnosticsSubTab: string;
  expandedFamily: string;
  expandedFamilyInsight: string;
  expandedFamilySignals: StringMap<boolean>;
  expandedEndpointInsightIds: StringMap<boolean>;
  expandedEndpointRowFindings: StringMap<boolean>;
  inspectingEndpointId: string;
  inspectPlacementHint: string;
  shapeWorkspaceCollapsed: boolean;
  issueScopeIndex: any;
  issueScopeIndexKey: string;
  familyTableShowAll: boolean;
  workflowChainsOpen: boolean;
  workflowChainFocusChainId: string;
  workflowChainFocusEndpointIds: string[];
  inspectorWorkflowContextOpen: string | null;
  familyTableBackState: any;
  familyTableSort: ExplorerFamilyTableSort;
  detailEvidenceOpenForId: string;
  filters: ExplorerFilters;
}

interface ExplorerFamilyBackState {
  search: string;
  familyTableShowAll: boolean;
  expandedFamily: string;
  expandedFamilyInsight: string;
  expandedEndpointInsightIds: StringMap<boolean>;
  expandedEndpointRowFindings: StringMap<boolean>;
  detailEvidenceOpenForId: string;
}

interface ExplorerElements {
  runContext: HTMLElement | null;
  quickActions: HTMLElement | null;
  resetControl: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  categoryFilter: HTMLSelectElement | null;
  familyPriorityFilter: HTMLSelectElement | null;
  includeNoIssueRows: HTMLInputElement | null;
  lensControlHint: HTMLElement | null;
  filterEmptyState: HTMLElement | null;
  familySurfaceHelp: HTMLElement | null;
  familySurfaceContext: HTMLElement | null;
  familySurface: HTMLElement | null;
  workflowSection: HTMLElement | null;
  workflowHelp: HTMLElement | null;
  workflowChains: HTMLElement | null;
  listContext: HTMLElement | null;
  endpointRows: HTMLElement | null;
  detailHelp: HTMLElement | null;
  endpointDetail: HTMLElement | null;
  familySurfaceSection?: Element | null;
  endpointListSection?: Element | null;
}
