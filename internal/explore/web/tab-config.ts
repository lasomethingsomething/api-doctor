var TOP_TABS: ExplorerTopTab[] = [
  {
    id: "spec-rule",
    label: "Contract Issues",
    copy: "OpenAPI rule violations (REQUIRED vs SHOULD) and consistency drift",
    color: "spec-rule",
    bodyClass: "lens-spec-rule",
    defaultCategory: "spec-rule",
    defaultSubTab: "exact",
    familyEyebrow: "Contract surface",
    familyHeading: "Family investigation clusters",
    familyHelp: "Families cluster contract-rule and consistency problems so you can expand evidence inline without leaving the main table.",
    emptyHelp: "",
    signalHeader: "Top signal",
    riskHeader: "Primary risk",
    clientEffectHeader: "Client effect"
  },
  {
    id: "workflow",
    label: "Workflow Guidance",
    copy: "Inferred call chains, continuity burden, hidden dependencies, and sequencing traps",
    color: "workflow",
    bodyClass: "lens-workflow",
    defaultCategory: "all",
    defaultSubTab: "summary",
    familyEyebrow: "Workflow surface",
    familyHeading: "Workflow continuity clusters",
    familyHelp: "Families stay in one shared table, but this tab ranks them by continuity burden, traps, and hidden handoff costs.",
    emptyHelp: "",
    signalHeader: "Continuity signals",
    riskHeader: "Main continuity risk",
    clientEffectHeader: "Client impact in flow"
  },
  {
    id: "shape",
    label: "Response Shape",
    copy: "Storage-shaped responses, duplicated state, internal fields, and workflow-first redesign guidance",
    color: "shape",
    bodyClass: "lens-shape",
    defaultCategory: "all",
    defaultSubTab: "summary",
    familyEyebrow: "Response Shape surface",
    familyHeading: "Response-shape investigation clusters",
    familyHelp: "Families stay in the same shared table pattern while this tab swaps in shape-specific burden, caller cost, and redesign guidance.",
    emptyHelp: "Response Shape: no families currently expose shape-heavy evidence in this slice.",
    signalHeader: "Shape signals",
    riskHeader: "Main response-shape risk",
    clientEffectHeader: "Client effect"
  }
];

var TOP_TAB_INDEX = TOP_TABS.reduce(function (acc: { [key: string]: ExplorerTopTab }, tab: ExplorerTopTab) {
  acc[tab.id] = tab;
  return acc;
}, {});
