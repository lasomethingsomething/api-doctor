var TOP_TABS: ExplorerTopTab[] = [
  {
    id: "spec-rule",
    label: "Contract Problems",
    copy: "Schema/runtime mismatch, undocumented rules, weak typing, and inconsistent HTTP semantics",
    color: "spec-rule",
    bodyClass: "lens-spec-rule",
    defaultCategory: "all",
    defaultSubTab: "exact",
    familyEyebrow: "Contract surface",
    familyHeading: "Contract-problem families",
    familyHelp: "Families group contract problems so you can expand evidence inline without leaving the main table.",
    emptyHelp: "",
    signalHeader: "Top signal",
    riskHeader: "Primary risk",
    clientEffectHeader: "Client effect"
  },
  {
    id: "workflow",
    label: "Workflow Problems",
    copy: "Hidden prerequisites, brittle sequences, missing next steps, and hard-to-carry context",
    color: "workflow",
    bodyClass: "lens-workflow",
    defaultCategory: "all",
    defaultSubTab: "summary",
    familyEyebrow: "Workflow problems",
    familyHeading: "Workflow-problem families",
    familyHelp: "Families stay in one shared table, but this tab ranks where developers can get stuck between calls, handoffs, and hidden prerequisites. Expand a family and open its Workflow sequence guide for the clearest step-by-step path.",
    emptyHelp: "",
    signalHeader: "Lead workflow signal",
    riskHeader: "Why this is hard",
    clientEffectHeader: "Recommended fix direction"
  },
  {
    id: "shape",
    label: "Response Shape Problems",
    copy: "Storage-shaped payloads, duplicated state, incidental fields, and weak outcome framing",
    color: "shape",
    bodyClass: "lens-shape",
    defaultCategory: "all",
    defaultSubTab: "summary",
    familyEyebrow: "Response-shape problems",
    familyHeading: "Response-shape families",
    familyHelp: "Families stay in the same shared table pattern while this tab highlights storage-shaped payloads, duplicated state, and weak outcome framing.",
    emptyHelp: "Response Shape Problems: no families currently expose shape-heavy evidence in this slice.",
    signalHeader: "Shape signals",
    riskHeader: "Main response-shape risk",
    clientEffectHeader: "Client effect"
  }
];

var TOP_TAB_INDEX = TOP_TABS.reduce(function (acc: { [key: string]: ExplorerTopTab }, tab: ExplorerTopTab) {
  acc[tab.id] = tab;
  return acc;
}, {});
