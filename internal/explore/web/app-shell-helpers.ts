declare var state: ExplorerState;
declare var el: ExplorerElements;

declare var TOP_TABS: ExplorerTopTab[];
declare var TOP_TAB_INDEX: StringMap<ExplorerTopTab>;

declare function captureFamilyTableBackStateIfNeeded(
  state: ExplorerState,
  override?: { search?: string }
): void;
declare function applyFilterStateChange(
  state: ExplorerState,
  update: () => void,
  invalidate: () => void,
  render: () => void
): void;
declare function applyTabDefaults(
  state: ExplorerState,
  tabId: string,
  tabIndex: StringMap<ExplorerTopTab>,
  options?: { resetFilters?: boolean }
): void;
declare function resetInlineUiState(state: ExplorerState): void;
declare function syncControls(): void;
declare function renderFilterEmptyState(): void;
declare function renderWorkflowChains(): void;
declare function renderFamilySurface(): void;
declare function renderEndpointDiagnostics(): void;
declare function renderEndpointRows(): void;
declare function renderEndpointDetail(): void;
declare function enforceSpecRuleTabFilterModel(): void;
declare function enforceWorkflowTabFilterModel(): void;
declare function enforceShapeTabFilterModel(): void;
declare function normalizeSelectedEndpointForCurrentView(): void;
declare function escapeHtml(value: unknown): string;
declare function uniq<T>(items: T[]): T[];
declare function flatMap<T, U>(items: T[], fn: (item: T) => U[]): U[];
declare function pulseLensUpdate(): void;

var appShellStickyMetricsQueued = false;

function bindControls(): void {
  window.addEventListener("resize", queueStickyLayoutMetrics);
  if (el.searchInput) {
    el.searchInput.addEventListener("input", function (event) {
      var prevSearch = state.filters.search || "";
      var target = event.target as HTMLInputElement | null;
      var nextSearch = target ? target.value.trim().toLowerCase() : "";
      if (!state.familyTableBackState && prevSearch !== nextSearch && isExactFamilyName(nextSearch)) {
        captureFamilyTableBackStateIfNeeded(state, { search: prevSearch });
      }
      applyFilterStateChange(state, function () {
        state.filters.search = nextSearch;
      }, invalidateDerivedCaches, render);
    });
  }
  if (el.categoryFilter) {
    el.categoryFilter.addEventListener("change", function (event) {
      var target = event.target as HTMLSelectElement | null;
      applyFilterStateChange(state, function () {
        state.filters.category = target ? target.value : "all";
      }, invalidateDerivedCaches, render);
    });
  }
  if (el.familyPriorityFilter) {
    el.familyPriorityFilter.addEventListener("change", function (event) {
      var target = event.target as HTMLSelectElement | null;
      applyFilterStateChange(state, function () {
        state.filters.familyPressure = target ? target.value : "all";
      }, invalidateDerivedCaches, render);
    });
  }
  if (el.includeNoIssueRows) {
    el.includeNoIssueRows.addEventListener("change", function (event) {
      var target = event.target as HTMLInputElement | null;
      applyFilterStateChange(state, function () {
        state.filters.includeNoIssueRows = !!(target && target.checked);
      }, invalidateDerivedCaches, render);
    });
  }
}

function invalidateDerivedCaches(): void {
  state.issueScopeIndex = null;
  state.issueScopeIndexKey = "";
}

function isExactFamilyName(value: string): boolean {
  if (!value || value.charAt(0) !== "/" || !state.payload || !state.payload.endpoints) return false;
  return (state.payload.endpoints || []).some(function (row: ExplorerEndpointRow) {
    return (row.family || "").trim().toLowerCase() === value;
  });
}

function renderFilterOptions(): void {
  if (!state.payload) return;
  var categoryValues = uniq(flatMap(state.payload.endpoints, function (row: ExplorerEndpointRow) {
    return Object.keys(row.categoryCounts || {});
  })).sort();
  setOptions(el.categoryFilter, [{ value: "all", label: "all categories" }].concat(
    categoryValues.map(function (category: string) {
      return {
        value: category,
        label: category === "spec-rule" ? "spec rule violations (rules-based view)" : category.replaceAll("-", " ")
      };
    })
  ));

  var datalist = document.getElementById("searchSuggestions");
  if (datalist) {
    var families = uniq(state.payload.endpoints.map(function (row: ExplorerEndpointRow) { return row.family; })).sort();
    datalist.innerHTML = families.concat(["GET", "POST", "PATCH", "PUT", "DELETE"]).map(function (value: string) {
      return '<option value="' + escapeHtml(value) + '">';
    }).join("");
  }
}

function setOptions(
  select: HTMLSelectElement | null,
  options: Array<{ value: string; label: string }>
): void {
  if (!select) return;
  select.innerHTML = options.map(function (option) {
    return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + "</option>";
  }).join("");
}

function activeTopTabConfig(): ExplorerTopTab {
  return TOP_TAB_INDEX[state.activeTopTab] || TOP_TAB_INDEX["spec-rule"];
}

function isKnownTopTab(id: string): boolean {
  return !!TOP_TAB_INDEX[id];
}

function render(): void {
  if (!isKnownTopTab(state.activeTopTab)) {
    applyTabDefaults(state, "spec-rule", TOP_TAB_INDEX);
  }
  enforceSpecRuleTabFilterModel();
  enforceWorkflowTabFilterModel();
  enforceShapeTabFilterModel();
  normalizeSelectedEndpointForCurrentView();
  renderHeader();
  renderQuickActions();
  renderResetControl();
  syncControls();
  renderFilterEmptyState();
  syncLensVisualIdentity();
  renderWorkflowChains();
  renderFamilySurface();
  renderEndpointDiagnostics();
  renderEndpointRows();
  renderEndpointDetail();
  queueStickyLayoutMetrics();
}

function syncStickyLayoutMetrics(): void {
  var doc = document.documentElement;
  if (!doc) return;
  var topbar = document.querySelector(".topbar");
  var actionBar = document.querySelector(".action-bar");
  var topbarHeight = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
  var actionBarHeight = actionBar ? Math.ceil(actionBar.getBoundingClientRect().height) : 0;
  doc.style.setProperty("--topbar-height", topbarHeight + "px");
  doc.style.setProperty("--action-bar-height", actionBarHeight + "px");
}

function queueStickyLayoutMetrics(): void {
  if (appShellStickyMetricsQueued) return;
  appShellStickyMetricsQueued = true;
  window.requestAnimationFrame(function () {
    appShellStickyMetricsQueued = false;
    syncStickyLayoutMetrics();
  });
}

function syncLensVisualIdentity(): void {
  if (!document || !document.body) return;
  var active = activeTopTabConfig();
  TOP_TABS.forEach(function (tab: ExplorerTopTab) {
    document.body.classList.toggle(tab.bodyClass, tab.id === active.id);
  });
  if (el.familySurfaceSection) {
    el.familySurfaceSection.classList.toggle("shape-primary-surface", active.id === "shape");
  }
  if (el.endpointListSection) {
    el.endpointListSection.classList.toggle("shape-secondary-surface", active.id === "shape");
  }
}

function renderHeader(): void {
  if (!state.payload || !el.runContext) return;
  var run = state.payload.run || {};
  var diffTag = run.baseSpecPath && run.headSpecPath ? (" | diff: " + run.baseSpecPath + " -> " + run.headSpecPath) : "";
  el.runContext.textContent = "spec: " + run.specPath + " | generated: " + run.generatedAt + diffTag;
}

function renderQuickActions(): void {
  if (!el.quickActions) return;
  el.quickActions.innerHTML = TOP_TABS.map(function (action: ExplorerTopTab) {
    var activeClass = state.activeTopTab === action.id ? " active" : "";
    var workflowActiveClass = (action.id === "workflow" && state.activeTopTab === "workflow") ? " workflow-active" : "";
    var titleAttr = action.id === "spec-rule" ? "" : (' title="' + escapeHtml(action.label) + '"');
    return '<button type="button" class="quick-action quick-action-' + escapeHtml(action.color) + activeClass + workflowActiveClass + '" data-id="' + action.id + '"' + titleAttr + ">"
      + '<span class="quick-label">' + escapeHtml(action.label) + "</span>"
      + '<span class="quick-copy">' + escapeHtml(action.copy) + "</span>"
      + "</button>";
  }).join("");

  Array.prototype.forEach.call(el.quickActions.querySelectorAll("button[data-id]"), function (btn: HTMLButtonElement) {
    btn.addEventListener("click", function () {
      applyQuickAction(btn.getAttribute("data-id") || "");
    });
  });
}

function renderResetControl(): void {
  if (!el.resetControl) return;
  el.resetControl.innerHTML = '<button type="button" class="reset-btn" data-id="clear-current-lens" title="Reset filters">Reset filters</button>';
  Array.prototype.forEach.call(el.resetControl.querySelectorAll("button[data-id]"), function (btn: HTMLButtonElement) {
    btn.addEventListener("click", function () {
      applyQuickAction(btn.getAttribute("data-id") || "");
    });
  });
}

function applyQuickAction(id: string): void {
  if (id === "clear-current-lens") {
    clearCurrentLens();
    return;
  }
  if (!isKnownTopTab(id)) return;

  if (el.familySurface) el.familySurface.scrollLeft = 0;
  if (el.endpointRows) {
    var endpointSurface = el.endpointRows.closest(".endpoint-list-surface");
    if (endpointSurface) endpointSurface.scrollLeft = 0;
  }

  resetInlineUiState(state);
  state.familyTableShowAll = false;
  applyTabDefaults(state, id, TOP_TAB_INDEX, { resetFilters: true });
  render();
}

function clearCurrentLens(): void {
  var tab = isKnownTopTab(state.activeTopTab) ? state.activeTopTab : "spec-rule";
  resetInlineUiState(state);
  state.familyTableShowAll = false;
  applyTabDefaults(state, tab, TOP_TAB_INDEX, { resetFilters: true });
  render();
  pulseLensUpdate();
}
