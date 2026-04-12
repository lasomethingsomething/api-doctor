type StringMap<T> = { [key: string]: T };

interface OpenAPIContext {
  primaryLabel: string;
  primaryValue: string;
  mediaType: string;
  statusCode: string;
  parameterKind: string;
  parameterNames: string;
  statusCodes?: string[];
}

interface ExplorerFinding {
  code?: string;
  category?: string;
  burdenFocus?: string;
  severity?: string;
  message?: string;
  evidenceType?: string;
  specRuleId?: string;
  normativeLevel?: string;
  specSource?: string;
}

interface ExplorerEndpointRow {
  id: string;
  method: string;
  path: string;
  family?: string;
  findings?: number;
  priority?: string;
  burdenFocuses?: string[];
  categoryCounts?: StringMap<number>;
  [key: string]: unknown;
}

interface ExplorerWorkflowChain {
  id?: string;
  chainId?: string;
  kind?: string;
  summary?: string;
  reason?: string;
  endpointIds: string[];
  [key: string]: unknown;
}

interface ExplorerWorkflowReference {
  endpointId?: string;
  label?: string;
  [key: string]: unknown;
}

interface ExplorerDiffEntry {
  label?: string;
  message?: string;
  [key: string]: unknown;
}

interface ExplorerEndpointDetail {
  endpoint: ExplorerEndpointRow;
  findings: ExplorerFinding[];
  relatedWorkflows?: ExplorerWorkflowReference[];
  relatedChains?: ExplorerWorkflowChain[];
  relatedDiff?: ExplorerDiffEntry[];
  [key: string]: unknown;
}

interface ExplorerFamilySummary {
  family: string;
  pressure: string;
  findings?: number;
  endpoints?: number;
  workflowChainKeys?: StringMap<boolean>;
  workflowChainCount?: number;
  priorityCounts?: StringMap<number>;
  burdenCounts?: StringMap<number>;
  dimensionCounts?: StringMap<number>;
  workflowSignalCounts?: StringMap<number>;
  shapeSignalCounts?: StringMap<number>;
  contractSignalCounts?: StringMap<number>;
  consistencySignalCounts?: StringMap<number>;
  dominantBurden?: string;
  topDimensions?: string[];
  [key: string]: unknown;
}

interface IssueGroup {
  groupKey: string;
  code: string;
  severity: string;
  dimension: string;
  context: OpenAPIContext;
  messages: string[];
  count: number;
  preview: string;
  impact: string;
  inspectHint: string;
  title: string;
  isSpecRule: boolean;
  specRuleId: string;
  normativeLevel: string;
  specSource: string;
}

interface ContractImprovementItem {
  change: string;
  where: string;
  inspect?: string;
  why: string;
}

interface ShapePainSignal {
  code: string;
  label: string;
  pain: string;
  example: string;
  callerNeeded: string;
  notice: string;
  recommendedChange: string;
  icon: string;
}

interface ShapeSignalTotals {
  deep: number;
  internal: number;
  dup: number;
  snapshot: number;
  source: number;
  outcome: number;
  nextAction: number;
}

interface WorkflowDependencyClues {
  prereq: string[];
  establish: string[];
  nextNeeds: string[];
  hidden: string[];
}

interface WorkflowTrapGuidance {
  id: string;
  title: string;
  happened: string;
  whyMissed: string;
  next: string;
}

interface WorkflowStepNarrative {
  callDoes: string;
  changesAfter: string;
  requiredState: string;
  nextAction: string;
  traps: string[];
}

interface WorkflowWarningBadge {
  type: string;
  count: number;
  label: string;
}

interface WorkflowTransitionCue {
  kind: string;
  label: string;
}

interface WorkflowBurdenSummaryItem {
  key: string;
  label: string;
  why: string;
  steps: number[];
}

interface WorkflowKindGroup {
  kind: string;
  chains: ExplorerWorkflowChain[];
}

interface FamilyInsightPoints {
  current: string[];
  cleaner: string[];
  evidence: string[];
}

interface ExplorerFamilyRankedSummary {
  dominantSignals: string[];
  driver: string;
  driverLabel: string;
  driverFocus: string;
  primaryRisk: string;
  dxParts: string[];
  dxReasons: string[];
  dxConsequence: string;
  recommendedAction: string;
}

interface ExplorerFamilyInsightModel {
  leadRow: ExplorerEndpointRow;
  detail: ExplorerEndpointDetail;
  groups: IssueGroup[];
  topGroup: IssueGroup | null;
  topContext: OpenAPIContext | null;
  points: FamilyInsightPoints;
  workflowLines: string[];
}

interface IssueScopeIndex {
  keyToEndpointIds: StringMap<StringMap<boolean>>;
  keyToFamilies: StringMap<StringMap<boolean>>;
  keyFamilyToEndpointIds: StringMap<StringMap<boolean>>;
}

interface SpecRuleAggregateGroup {
  ruleId: string;
  normativeLevel: string;
  specSource: string;
  severity: string;
  occurrences: number;
  endpointCount: number;
  summary: string;
  isApiWide?: boolean;
  _seen?: StringMap<boolean>;
}

function createEmptyOpenAPIContext(): OpenAPIContext {
  return {
    primaryLabel: "",
    primaryValue: "",
    mediaType: "",
    statusCode: "",
    parameterKind: "",
    parameterNames: ""
  };
}

function createEmptyEndpointRow(): ExplorerEndpointRow {
  return {
    id: "",
    method: "",
    path: ""
  };
}

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
  payload: ExplorerPayload | null;
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
  issueScopeIndex: IssueScopeIndex | null;
  issueScopeIndexKey: string;
  familyTableShowAll: boolean;
  workflowChainsOpen: boolean;
  workflowChainFocusChainId: string;
  workflowChainFocusEndpointIds: string[];
  inspectorWorkflowContextOpen: boolean | null;
  familyTableBackState: ExplorerFamilyBackState | null;
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

interface ExplorerWorkflowPayload {
  chains: ExplorerWorkflowChain[];
  [key: string]: unknown;
}

interface ExplorerPayload {
  endpoints: ExplorerEndpointRow[];
  endpointDetails: StringMap<ExplorerEndpointDetail>;
  workflows: ExplorerWorkflowPayload;
  run: StringMap<unknown>;
  [key: string]: unknown;
}
