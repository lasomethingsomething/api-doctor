function bindFamilySurfaceEndpointInteractions(options: {
  familySurface: HTMLElement | null;
  state: ExplorerState;
  captureBackState: () => void;
  renderFamilySurface: () => void;
  renderEndpointDiagnostics: () => void;
  renderEndpointDetail: () => void;
  syncSelectedEndpointHighlight: () => void;
  syncWorkflowStepSelectionHighlight: () => void;
  selectEndpointForInspector: (endpointId: string, subTab?: string) => void;
  focusFamily: (family: string) => void;
}): void {
  var familySurface = options.familySurface;
  var state = options.state;
  if (!familySurface) return;

  function collapseSelectedEndpointInline(): void {
    state.selectedEndpointId = "";
    state.userSelectedEndpoint = false;
    state.inspectingEndpointId = "";
    state.detailEvidenceOpenForId = "";
    options.renderFamilySurface();
    options.renderEndpointDiagnostics();
  }

  function openExactEvidence(endpointId: string): void {
    state.inspectPlacementHint = "nested";
    state.detailEvidenceOpenForId = endpointId;
    options.selectEndpointForInspector(endpointId, "exact");
    options.syncWorkflowStepSelectionHighlight();
  }

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-expand-endpoints]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var family = btn.getAttribute("data-expand-endpoints") || "";
      if (!family) return;
      options.captureBackState();
      var nextExpandedFamily = (state.expandedFamily === family) ? "" : family;
      state.expandedFamily = nextExpandedFamily;
      if (nextExpandedFamily && state.expandedFamilyInsight && state.expandedFamilyInsight !== nextExpandedFamily) {
        state.expandedFamilyInsight = "";
      }
      clearEndpointSelectionState(state);
      state.expandedEndpointInsightIds = {};
      state.expandedEndpointRowFindings = {};
      options.renderFamilySurface();
      options.renderEndpointDiagnostics();
      options.renderEndpointDetail();
      options.syncSelectedEndpointHighlight();
    });
    var expanded = state.expandedFamily === (btn.getAttribute("data-expand-endpoints") || "");
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-expand-signals]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var family = btn.getAttribute("data-expand-signals") || "";
      if (!family) return;
      if (!state.expandedFamilySignals) state.expandedFamilySignals = {};
      if (state.expandedFamilySignals[family]) {
        delete state.expandedFamilySignals[family];
      } else {
        state.expandedFamilySignals[family] = true;
      }
      options.renderFamilySurface();
    });
    var expanded = !!(state.expandedFamilySignals && state.expandedFamilySignals[(btn.getAttribute("data-expand-signals") || "")]);
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-inspect-top-endpoint]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-inspect-top-endpoint") || "";
      if (!endpointId) return;
      options.selectEndpointForInspector(endpointId);
    });
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-endpoint-insight-toggle]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-endpoint-insight-toggle") || "";
      if (!endpointId) return;
      if (state.expandedEndpointInsightIds[endpointId]) {
        delete state.expandedEndpointInsightIds[endpointId];
      } else {
        state.expandedEndpointInsightIds[endpointId] = true;
      }
      options.renderFamilySurface();
    });

    var endpointExpanded = !!state.expandedEndpointInsightIds[(btn.getAttribute("data-endpoint-insight-toggle") || "")];
    btn.setAttribute("aria-expanded", endpointExpanded ? "true" : "false");
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-toggle-row-findings]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-toggle-row-findings") || "";
      if (!endpointId) return;
      if (state.expandedEndpointRowFindings[endpointId]) {
        delete state.expandedEndpointRowFindings[endpointId];
      } else {
        state.expandedEndpointRowFindings[endpointId] = true;
      }
      options.renderFamilySurface();
      options.syncSelectedEndpointHighlight();
    });
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-focus-endpoint]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-focus-endpoint") || "";
      if (!endpointId) return;
      if (state.selectedEndpointId === endpointId && state.userSelectedEndpoint) {
        collapseSelectedEndpointInline();
        return;
      }
      state.inspectPlacementHint = "nested";
      options.selectEndpointForInspector(endpointId);
    });
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-focus-family]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var family = btn.getAttribute("data-focus-family") || "";
      options.focusFamily(family);
    });
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-open-evidence-id]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-open-evidence-id") || "";
      if (!endpointId) return;
      openExactEvidence(endpointId);
    });
  });

  Array.prototype.forEach.call(familySurface.querySelectorAll(".nested-endpoint-row[data-endpoint-id]"), function (tr: Element) {
    tr.addEventListener("click", function () {
      var endpointId = tr.getAttribute("data-endpoint-id") || "";
      if (!endpointId) return;
      if (state.selectedEndpointId === endpointId && state.userSelectedEndpoint) {
        collapseSelectedEndpointInline();
        return;
      }
      state.inspectPlacementHint = "nested";
      options.selectEndpointForInspector(endpointId);
    });
  });
}
