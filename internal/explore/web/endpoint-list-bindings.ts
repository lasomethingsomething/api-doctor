function bindEndpointListInteractions(options: {
  endpointRows: HTMLElement | null;
  state: ExplorerState;
  renderEndpointRows: () => void;
  renderEndpointDiagnostics: () => void;
  selectEndpointForInspector: (endpointId: string, subTab?: string) => void;
}): void {
  var endpointRows = options.endpointRows;
  var state = options.state;
  if (!endpointRows) return;

  Array.prototype.forEach.call(endpointRows.querySelectorAll("tr[data-id]"), function (tr: Element) {
    tr.addEventListener("click", function () {
      options.selectEndpointForInspector(tr.getAttribute("data-id") || "");
    });
  });

  Array.prototype.forEach.call(endpointRows.querySelectorAll(".severity-badge.is-interactive"), function (badge: Element) {
    badge.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var row = badge.closest("tr[data-id]");
      if (!row) return;
      var endpointId = row.getAttribute("data-id") || "";
      if (!endpointId) return;
      state.detailEvidenceOpenForId = endpointId;
      options.selectEndpointForInspector(endpointId, "exact");
    });
    badge.addEventListener("keydown", function (event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      (badge as HTMLElement).click();
    });
  });

  Array.prototype.forEach.call(endpointRows.querySelectorAll("button[data-focus-endpoint]"), function (btn: Element) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var endpointId = btn.getAttribute("data-focus-endpoint") || "";
      if (!endpointId) return;
      options.selectEndpointForInspector(endpointId);
    });
  });

  Array.prototype.forEach.call(endpointRows.querySelectorAll("button[data-toggle-row-findings]"), function (btn: Element) {
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
      options.renderEndpointRows();
    });
  });
}
