function syncFamilyInsightToggleButtons(
  familySurface: HTMLElement | null,
  state: ExplorerState,
  setFamilyInsightToggleButton: (btn: Element, expanded: boolean) => void
): void {
  if (!familySurface) return;
  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-insight-toggle]"), function (toggleBtn: Element) {
    var isExpanded = state.expandedFamilyInsight === (toggleBtn.getAttribute("data-insight-toggle") || "");
    setFamilyInsightToggleButton(toggleBtn, isExpanded);
  });
}

function removeInlineFamilyInsightRows(
  familySurface: HTMLElement | null,
  exceptFamily?: string
): void {
  if (!familySurface) return;
  Array.prototype.forEach.call(familySurface.querySelectorAll("tr.family-inline-insight-row"), function (insightRow: Element) {
    var rowFamily = insightRow.getAttribute("data-family") || "";
    if (exceptFamily && rowFamily === exceptFamily) return;
    if (insightRow.parentNode) insightRow.parentNode.removeChild(insightRow);
  });
}

function inlineFamilyInsightRowForFamily(
  familySurface: HTMLElement | null,
  family: string
): Element | null {
  if (!familySurface || !family) return null;
  var match: Element | null = null;
  Array.prototype.forEach.call(familySurface.querySelectorAll("tr.family-inline-insight-row"), function (insightRow: Element) {
    if (match) return;
    if ((insightRow.getAttribute("data-family") || "") === family) {
      match = insightRow;
    }
  });
  return match;
}

function bindInsightPanelActions(
  row: Element | null,
  focusFamily: (family: string) => void,
  openEvidence: (endpointId: string) => void
): void {
  if (!row) return;
  Array.prototype.forEach.call(row.querySelectorAll("button[data-focus-family]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var family = btn.getAttribute("data-focus-family") || "";
      if (!family) return;
      focusFamily(family);
    });
  });
  Array.prototype.forEach.call(row.querySelectorAll("button[data-open-evidence-id]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-open-evidence-id") || "";
      if (!endpointId) return;
      openEvidence(endpointId);
    });
  });
}

function toggleFamilyInsightInline(options: {
  familySurface: HTMLElement | null;
  state: ExplorerState;
  button: Element | null;
  family: string;
  captureBackState: () => void;
  familySummaries: () => any[];
  familyInsightRowHtml: (family: any) => string;
  bindInsightPanelActions: (row: Element | null) => void;
  setFamilyInsightToggleButton: (btn: Element, expanded: boolean) => void;
}): void {
  var familySurface = options.familySurface;
  var state = options.state;
  var btn = options.button;
  var family = options.family;

  if (!familySurface || !btn || !family) return;
  var row = btn.closest('tr.family-row[data-family-row="true"]');
  if (!row) return;

  var openInlineRow = inlineFamilyInsightRowForFamily(familySurface, family);
  var alreadyOpen = state.expandedFamilyInsight === family && !!openInlineRow;

  if (alreadyOpen) {
    state.expandedFamilyInsight = "";
    if (openInlineRow && openInlineRow.parentNode) openInlineRow.parentNode.removeChild(openInlineRow);
    removeInlineFamilyInsightRows(familySurface);
    syncFamilyInsightToggleButtons(familySurface, state, options.setFamilyInsightToggleButton);
    return;
  }

  options.captureBackState();
  removeInlineFamilyInsightRows(familySurface);

  var summaries = options.familySummaries();
  var match = summaries.find(function (f) {
    return (f && (f.family || "unlabeled family")) === family;
  });
  if (!match) {
    state.expandedFamilyInsight = "";
    syncFamilyInsightToggleButtons(familySurface, state, options.setFamilyInsightToggleButton);
    return;
  }

  state.expandedFamilyInsight = family;
  syncFamilyInsightToggleButtons(familySurface, state, options.setFamilyInsightToggleButton);
  if (openInlineRow && openInlineRow.parentNode) {
    openInlineRow.parentNode.removeChild(openInlineRow);
  }
  row.insertAdjacentHTML("afterend", options.familyInsightRowHtml(match));

  var inserted = row.nextElementSibling;
  if (inserted && inserted.classList && inserted.classList.contains("family-inline-insight-row")) {
    options.bindInsightPanelActions(inserted);
  }
}
