(function () {
  var state = {
    payload: null,
    selectedEndpointId: "",
    activeTopTab: "spec-rule",
    endpointDiagnosticsSubTab: "summary",
    expandedFamily: "",
    detailEvidenceOpenForId: "",
    filters: {
      search: "",
      category: "all",
      burden: "all",
      familyPressure: "all",
      includeNoIssueRows: false
    }
  };

  var el = {
    runContext: document.getElementById("runContext"),
    quickActions: document.getElementById("quickActions"),
    resetControl: document.getElementById("resetControl"),
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    burdenFilter: document.getElementById("burdenFilter"),
    familyPriorityFilter: document.getElementById("familyPriorityFilter"),
    includeNoIssueRows: document.getElementById("includeNoIssueRows"),
    lensControlHint: document.getElementById("lensControlHint"),
    endpointDiagnosticsSection: document.getElementById("endpointDiagnosticsSection"),
    endpointDiagnosticsHelp: document.getElementById("endpointDiagnosticsHelp"),
    endpointDiagnosticsBody: document.getElementById("endpointDiagnosticsBody"),
    familySurfaceHelp: document.getElementById("familySurfaceHelp"),
    familySurfaceContext: document.getElementById("familySurfaceContext"),
    familySurface: document.getElementById("familySurface"),
    workflowSection: document.getElementById("workflowSection"),
    workflowHelp: document.getElementById("workflowHelp"),
    workflowChains: document.getElementById("workflowChains"),
    listContext: document.getElementById("listContext"),
    endpointRows: document.getElementById("endpointRows"),
    detailHelp: document.getElementById("detailHelp"),
    endpointDetail: document.getElementById("endpointDetail")
  };

  el.familySurfaceSection = el.familySurface ? el.familySurface.closest('.section') : null;
  el.endpointListSection = el.endpointRows ? el.endpointRows.closest('.section') : null;

  fetch("/api/payload")
    .then(function (res) { return res.json(); })
    .then(function (payload) {
      state.payload = payload;
      state.selectedEndpointId = firstEvidenceEndpointId(payload.endpoints || []);
      bindControls();
      renderFilterOptions();
      render();
    });

  function bindControls() {
    el.searchInput.addEventListener("input", function (e) {
      state.filters.search = e.target.value.trim().toLowerCase();
      render();
    });
    el.categoryFilter.addEventListener("change", function (e) {
      state.filters.category = e.target.value;
      normalizeLensFilters('category');
      render();
    });
    el.burdenFilter.addEventListener("change", function (e) {
      state.filters.burden = e.target.value;
      normalizeLensFilters('burden');
      render();
    });
    el.familyPriorityFilter.addEventListener("change", function (e) {
      state.filters.familyPressure = e.target.value;
      render();
    });
    el.includeNoIssueRows.addEventListener("change", function (e) {
      state.filters.includeNoIssueRows = e.target.checked;
      render();
    });
  }

  function normalizeLensFilters(changed) {
    var category = state.filters.category;
    var burden = state.filters.burden;
    var heuristicTracks = {
      'workflow-burden': true,
      'contract-shape': true
    };

    if (category === 'spec-rule' && burden !== 'all') {
      if (changed === 'burden' && heuristicTracks[burden]) {
        state.filters.category = burden;
      } else {
        state.filters.burden = 'all';
      }
      return;
    }

    if (burden === 'all' || category === 'all') return;
    if (!heuristicTracks[category] || !heuristicTracks[burden] || category === burden) return;

    if (changed === 'burden') {
      state.filters.category = burden;
      return;
    }

    state.filters.burden = category;
  }

  function renderFilterOptions() {
    var categoryValues = uniq(flatMap(state.payload.endpoints, function (row) {
      return Object.keys(row.categoryCounts || {});
    })).sort();
    setOptions(el.categoryFilter, [{ value: "all", label: "all categories" }].concat(
      categoryValues.map(function (c) {
        return { value: c, label: c === 'spec-rule' ? 'spec rule violations (rules-based view)' : c.replaceAll("-", " ") };
      })
    ));

    setOptions(el.burdenFilter, [
      { value: "all", label: "all burdens" },
      { value: "workflow-burden", label: "workflow burden (guidance view)" },
      { value: "contract-shape", label: "shape burden (guidance view)" }
    ]);

    var datalist = document.getElementById("searchSuggestions");
    if (datalist) {
      var families = uniq(state.payload.endpoints.map(function (row) { return row.family; })).sort();
      datalist.innerHTML = families.concat(["GET", "POST", "PATCH", "PUT", "DELETE"]).map(function (v) {
        return '<option value="' + escapeHtml(v) + '">';
      }).join("");
    }
  }

  function setOptions(select, options) {
    select.innerHTML = options.map(function (opt) {
      return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + '</option>';
    }).join("");
  }

  function render() {
    if (state.activeTopTab !== 'spec-rule' && state.activeTopTab !== 'workflow' && state.activeTopTab !== 'shape') {
      state.activeTopTab = 'spec-rule';
    }
    enforceSpecRuleTabFilterModel();
    enforceWorkflowTabFilterModel();
    enforceShapeTabFilterModel();
    normalizeSelectedEndpointForCurrentView();
    renderHeader();
    renderQuickActions();
    renderResetControl();
    syncControls();
    syncLensVisualIdentity();
    renderEndpointDiagnostics();
    renderFamilySurface();
    renderWorkflowChains();
    renderEndpointRows();
    renderEndpointDetail();
  }

  function enforceSpecRuleTabFilterModel() {
    if (state.activeTopTab !== 'spec-rule') return;

    if (state.filters.category !== 'spec-rule') {
      state.filters.category = 'spec-rule';
    }
    if (state.filters.burden !== 'all') {
      state.filters.burden = 'all';
    }
    if (state.endpointDiagnosticsSubTab !== 'exact') {
      state.endpointDiagnosticsSubTab = 'exact';
    }

    var specRows = filteredRows();
    if (!specRows.length) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      return;
    }

    if (!state.selectedEndpointId || !specRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(specRows);
      state.detailEvidenceOpenForId = '';
    }
  }

  function enforceWorkflowTabFilterModel() {
    if (state.activeTopTab !== 'workflow') return;

    if (state.filters.category !== 'all') {
      state.filters.category = 'all';
    }
    if (state.filters.burden !== 'workflow-burden') {
      state.filters.burden = 'workflow-burden';
    }
    if (state.endpointDiagnosticsSubTab === 'consistency' || state.endpointDiagnosticsSubTab === 'cleaner') {
      state.endpointDiagnosticsSubTab = 'summary';
    }

    var workflowRows = selectionRowsForActiveView();
    if (!workflowRows.length) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      return;
    }

    if (!state.selectedEndpointId || !workflowRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(workflowRows);
      state.detailEvidenceOpenForId = '';
    }
  }

  function enforceShapeTabFilterModel() {
    if (state.activeTopTab !== 'shape') return;

    if (state.filters.category !== 'all') {
      state.filters.category = 'all';
    }
    if (state.filters.burden !== 'contract-shape') {
      state.filters.burden = 'contract-shape';
    }
    if (state.endpointDiagnosticsSubTab === 'consistency') {
      state.endpointDiagnosticsSubTab = 'summary';
    }

    var shapeRows = selectionRowsForActiveView();
    if (!shapeRows.length) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      state.endpointDiagnosticsSubTab = 'summary';
      return;
    }

    if (!state.selectedEndpointId || !shapeRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(shapeRows);
      state.detailEvidenceOpenForId = '';
      state.endpointDiagnosticsSubTab = 'summary';
    }
  }

  function syncLensVisualIdentity() {
    if (!document || !document.body) return;
    var shapeActive = state.activeTopTab === 'shape';
    document.body.classList.toggle('lens-shape', shapeActive);

    if (el.familySurfaceSection) {
      el.familySurfaceSection.classList.toggle('shape-primary-surface', shapeActive);
    }
    if (el.endpointDiagnosticsSection) {
      el.endpointDiagnosticsSection.classList.toggle('shape-secondary-surface', shapeActive);
    }
    if (el.endpointListSection) {
      el.endpointListSection.classList.toggle('shape-secondary-surface', shapeActive);
    }
  }

  function normalizeSelectedEndpointForCurrentView() {
    var rows = selectionRowsForActiveView();

    if (!rows.length) {
      state.selectedEndpointId = "";
      return;
    }

    if (!state.selectedEndpointId || !rows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(rows);
    }
  }

  function renderHeader() {
    var run = state.payload.run || {};
    var diffTag = run.baseSpecPath && run.headSpecPath ? (' | diff: ' + run.baseSpecPath + ' -> ' + run.headSpecPath) : '';
    el.runContext.textContent = 'spec: ' + run.specPath + ' | generated: ' + run.generatedAt + diffTag;
  }

  function renderQuickActions() {
    var actions = [
      { id: "spec-rule", label: "Spec rule violations", copy: "OpenAPI MUST/SHOULD issues backed by explicit rule language", color: 'spec-rule' },
      { id: "workflow", label: "Workflow burden", copy: "Missing next-step IDs or continuity context across call chains", color: 'workflow' },
      { id: "shape", label: "Shape burden", copy: "Storage-shaped responses hide outcome, next action, and authoritative state", color: 'shape' }
    ];

    el.quickActions.innerHTML = actions.map(function (action) {
      var activeClass = state.activeTopTab === action.id ? ' active' : '';
      var workflowActiveClass = (action.id === 'workflow' && state.activeTopTab === 'workflow') ? ' workflow-active' : '';
      var titleAttr = action.id === 'spec-rule' ? '' : ' title="' + escapeHtml(action.label) + '"';
      return '<button type="button" class="quick-action quick-action-' + escapeHtml(action.color) + activeClass + workflowActiveClass + '" data-id="' + action.id + '"' + titleAttr + '>' 
        + '<span class="quick-label">' + escapeHtml(action.label) + '</span>'
        + '<span class="quick-copy">' + escapeHtml(action.copy) + '</span>'
        + '</button>';
    }).join("");

    Array.prototype.forEach.call(el.quickActions.querySelectorAll("button[data-id]"), function (btn) {
      btn.addEventListener("click", function () {
        applyQuickAction(btn.getAttribute("data-id"));
      });
    });
  }

  function renderResetControl() {
    el.resetControl.innerHTML = '<button type="button" class="reset-btn" data-id="clear-current-lens" title="Reset filters">Reset filters</button>'

    Array.prototype.forEach.call(el.resetControl.querySelectorAll("button[data-id]"), function (btn) {
      btn.addEventListener("click", function () {
        applyQuickAction(btn.getAttribute("data-id"), "");
      });
    });
  }

  function applyQuickAction(id) {
    if (id === "clear-current-lens") {
      clearCurrentLens();
      return;
    }

    state.activeTopTab = id;

    state.filters.includeNoIssueRows = false;
    state.filters.familyPressure = "all";

    if (id === "spec-rule") {
      state.filters.search = "";
      state.filters.category = "spec-rule";
      state.filters.burden = "all";
    } else if (id === "workflow") {
      state.filters.search = "";
      state.filters.category = "all";
      state.filters.burden = "workflow-burden";
      state.endpointDiagnosticsSubTab = "summary";
    } else if (id === "shape") {
      state.filters.search = "";
      state.filters.category = "all";
      state.filters.burden = "contract-shape";
      state.endpointDiagnosticsSubTab = "summary";
    }

    var visible = filteredRows();
    if (!state.selectedEndpointId || !visible.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(visible);
    }
    render();

  }

  function scrollToEndpointDiagnostics() {
    if (!el.endpointDiagnosticsSection) return;
    setTimeout(function () {
      el.endpointDiagnosticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      markInteractionDestination(el.endpointDiagnosticsSection);
    }, 40);
  }

  function markInteractionDestination(node) {
    if (!node) return;
    node.classList.remove('interaction-target-highlight');
    void node.offsetWidth;
    node.classList.add('interaction-target-highlight');

    if (typeof node.focus === 'function') {
      if (!node.hasAttribute('tabindex')) {
        node.setAttribute('tabindex', '-1');
      }
      try {
        node.focus({ preventScroll: true });
      } catch (_err) {
        node.focus();
      }
    }
  }

  function markExactEvidenceDestination() {
    if (!el.endpointDiagnosticsBody) return;
    var drawer = el.endpointDiagnosticsBody.querySelector('.detail-evidence-drawer');
    if (!drawer) return;
    if (!drawer.hasAttribute('open')) {
      drawer.setAttribute('open', 'open');
    }
    markInteractionDestination(drawer);
  }

  function scrollToEndpointDiagnosticsIfNeededForSpecRuleRows() {
    if (!el.endpointDiagnosticsSection) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = el.endpointDiagnosticsSection.getBoundingClientRect();
        var topbar = document.querySelector('.topbar');
        var topOffset = topbar ? (topbar.offsetHeight + 10) : 12;
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var preferredTopMin = topOffset;
        var preferredTopMax = Math.max(topOffset + 4, Math.round(viewportHeight * 0.42));
        var topAlreadyInStableRange = rect.top >= preferredTopMin && rect.top <= preferredTopMax;

        if (topAlreadyInStableRange) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        var targetY = window.scrollY + rect.top - topOffset;
        if (Math.abs(targetY - window.scrollY) < 4) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        setTimeout(function () {
          markInteractionDestination(el.endpointDiagnosticsSection);
        }, 220);
      });
    });
  }

  function scrollToEndpointDiagnosticsIfNeededForWorkflowRows() {
    if (!el.endpointDiagnosticsSection) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = el.endpointDiagnosticsSection.getBoundingClientRect();
        var topbar = document.querySelector('.topbar');
        var topOffset = topbar ? (topbar.offsetHeight + 10) : 12;
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var preferredTopMin = topOffset;
        var preferredTopMax = Math.max(topOffset + 4, Math.round(viewportHeight * 0.45));
        var topAlreadyInStableRange = rect.top >= preferredTopMin && rect.top <= preferredTopMax;

        if (topAlreadyInStableRange) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        var targetY = window.scrollY + rect.top - topOffset;
        if (Math.abs(targetY - window.scrollY) < 4) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        setTimeout(function () {
          markInteractionDestination(el.endpointDiagnosticsSection);
        }, 220);
      });
    });
  }

  function scrollToEndpointDiagnosticsIfNeededForShapeRows() {
    if (!el.endpointDiagnosticsSection) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = el.endpointDiagnosticsSection.getBoundingClientRect();
        var topbar = document.querySelector('.topbar');
        var topOffset = topbar ? (topbar.offsetHeight + 10) : 12;
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var preferredTopMin = topOffset;
        var preferredTopMax = Math.max(topOffset + 4, Math.round(viewportHeight * 0.48));
        var topAlreadyInStableRange = rect.top >= preferredTopMin && rect.top <= preferredTopMax;

        if (topAlreadyInStableRange) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        var targetY = window.scrollY + rect.top - topOffset;
        if (Math.abs(targetY - window.scrollY) < 4) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        setTimeout(function () {
          markInteractionDestination(el.endpointDiagnosticsSection);
        }, 220);
      });
    });
  }

  function scrollToEndpointDiagnosticsForWorkflowAffordance() {
    if (!el.endpointDiagnosticsSection) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = el.endpointDiagnosticsSection.getBoundingClientRect();
        var topbar = document.querySelector('.topbar');
        var topOffset = topbar ? (topbar.offsetHeight + 10) : 12;
        var targetY = window.scrollY + rect.top - topOffset;

        if (Math.abs(targetY - window.scrollY) < 4) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          return;
        }

        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        setTimeout(function () {
          markInteractionDestination(el.endpointDiagnosticsSection);
        }, 220);
      });
    });
  }

  function focusWorkflowExactEvidenceTarget() {
    if (!el.endpointDiagnosticsSection || !el.endpointDiagnosticsBody) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var target = el.endpointDiagnosticsBody.querySelector('.detail-evidence-drawer');
        if (target && !target.hasAttribute('open')) {
          target.setAttribute('open', 'open');
        }

        var anchor = target || el.endpointDiagnosticsSection;
        var rect = anchor.getBoundingClientRect();
        var topbar = document.querySelector('.topbar');
        var topOffset = topbar ? (topbar.offsetHeight + 10) : 12;
        var targetY = window.scrollY + rect.top - topOffset;

        if (Math.abs(targetY - window.scrollY) < 4) {
          markInteractionDestination(el.endpointDiagnosticsSection);
          if (target) markInteractionDestination(target);
          return;
        }

        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        setTimeout(function () {
          markInteractionDestination(el.endpointDiagnosticsSection);
          if (target) markInteractionDestination(target);
        }, 220);
      });
    });
  }

  function scrollToEndpointListIfNeeded() {
    if (!el.endpointRows) return;
    var listSection = el.endpointRows.closest('.section');
    if (!listSection) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = listSection.getBoundingClientRect();
        var topbar = document.querySelector('.topbar');
        var topOffset = topbar ? (topbar.offsetHeight + 10) : 12;
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var preferredTopMin = topOffset;
        var preferredTopMax = Math.max(topOffset + 4, Math.round(viewportHeight * 0.55));
        var topAlreadyInStableRange = rect.top >= preferredTopMin && rect.top <= preferredTopMax;

        if (topAlreadyInStableRange) {
          markInteractionDestination(listSection);
          return;
        }

        var targetY = window.scrollY + rect.top - topOffset;
        if (Math.abs(targetY - window.scrollY) < 4) {
          markInteractionDestination(listSection);
          return;
        }

        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        setTimeout(function () {
          markInteractionDestination(listSection);
        }, 220);
      });
    });
  }

  function consistencyFindingsForDetail(findings) {
    var consistencyCodes = {
      'detail-path-parameter-name-drift': true,
      'endpoint-path-style-drift': true,
      'sibling-path-shape-drift': true,
      'inconsistent-response-shape': true,
      'inconsistent-response-shape-family': true,
      'inconsistent-response-shapes': true,
      'inconsistent-response-shapes-family': true
    };
    return (findings || []).filter(function (f) {
      return !!consistencyCodes[f.code || ''];
    });
  }

  function isShapeScopedFinding(finding) {
    if (!finding) return false;
    if (finding.evidenceType === 'spec-rule') return false;
    if ((finding.burdenFocus || '') === 'contract-shape') return true;

    var code = finding.code || '';
    return code === 'contract-shape-workflow-guidance-burden'
      || code === 'snapshot-heavy-response'
      || code === 'deeply-nested-response-structure'
      || code === 'duplicated-state-response'
      || code === 'incidental-internal-field-exposure'
      || code === 'prerequisite-task-burden'
      || code === 'weak-outcome-next-action-guidance'
      || code === 'weak-follow-up-linkage'
      || code === 'weak-action-follow-up-linkage'
      || code === 'weak-accepted-tracking-linkage'
      || code === 'generic-object-response'
      || code === 'weak-array-items-schema';
  }

  function findingsForActiveLens(findings) {
    var all = findings || [];
    if (state.activeTopTab !== 'shape') return all;
    return all.filter(isShapeScopedFinding);
  }

  function hasValidSelectedEndpointInCurrentView() {
    if (!state.selectedEndpointId) return false;
    return selectionRowsForActiveView().some(function (row) {
      return row.id === state.selectedEndpointId;
    });
  }

  function selectionRowsForActiveView() {
    if (state.activeTopTab === 'workflow') {
      return workflowScopedRows();
    }
    return filteredRows();
  }

  function renderEndpointDiagnosticsEmptyState() {
    return '<div class="empty">'
      + '<strong>No endpoint selected for the current view.</strong>'
      + '<p class="subtle">Select a family insight action or an endpoint row to inspect summary, exact evidence, consistency/drift, and cleaner contract emphasis here. If nothing matches, use the family no-match recovery above.</p>'
      + '</div>';
  }

  function renderEndpointDiagnosticsTabs() {
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var tabs = workflowTabActive
      ? [
          { id: 'summary', label: 'Summary' },
          { id: 'exact', label: 'Exact evidence' }
        ]
      : shapeTabActive
      ? [
          { id: 'summary', label: 'Shape summary' },
          { id: 'cleaner', label: 'Cleaner shape emphasis' },
          { id: 'exact', label: 'Exact evidence' }
        ]
      : [
          { id: 'summary', label: 'Summary' },
          { id: 'exact', label: 'Exact evidence' },
          { id: 'consistency', label: 'Consistency / drift' },
          { id: 'cleaner', label: 'Cleaner contract emphasis' }
        ];

    return '<div class="endpoint-diag-tabs">'
      + tabs.map(function (tab) {
          var active = state.endpointDiagnosticsSubTab === tab.id ? ' active' : '';
          return '<button type="button" class="endpoint-diag-tab' + active + '" data-endpoint-subtab="' + tab.id + '">' + escapeHtml(tab.label) + '</button>';
        }).join('')
      + '</div>';
  }

  function renderEndpointDiagnosticsSummary(detail) {
    var findings = findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || {};
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var topContext = topGroup ? topGroup.context : {};
    var severity = dominantSeverity(findings);
    var contextBadge = buildContextTypeBadge(topContext);

    return '<div class="endpoint-diag-pane">'
      + '<div class="detail-hero pressure-' + endpoint.priority + '">'
      + '  <div class="detail-hero-head">'
      + '    <div>'
      + '      <strong class="detail-path">' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
      + '      <div class="detail-subline">' + escapeHtml(endpointIntentCue(endpoint.method, endpoint.path)) + ' | ' + escapeHtml(humanFamilyLabel(endpoint.family)) + '</div>'
      + '    </div>'
      + '    <div class="detail-badges">'
      +        pressureBadge(endpoint.priority, 'pressure')
      +        severityBadge(severity)
      + '    </div>'
      + '  </div>'
      + '  <div class="lead-finding">'
      + '    <div class="lead-finding-head">' + contextBadge + '</div>'
      + '    <p class="lead-finding-message">' + escapeHtml(topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.') + '</p>'
      + '    <div class="lead-finding-grounding">'
      + '      <span class="grounding-label">OpenAPI location cues (when available)</span>'
      +        renderOpenAPIContextPills(topContext, false)
      +        (topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '')
      +    '</div>'
      + '  </div>'
      + '</div>'
      + '</div>';
  }

  function renderEndpointDiagnosticsWorkflowSummary(detail) {
    var endpoint = detail.endpoint || {};
    var findings = detail.findings || [];
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var chainCount = (detail.relatedChains || []).length;
    var signalSummary = summarizeWorkflowHeaderSignals(detail);
    var comparisonHtml = renderInspectorContractShapeComparison(detail, findings, {
      title: 'Current contract shape vs workflow-first contract shape',
      context: 'workflow'
    });
    var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false);
    var guidanceHtml = renderTrapGuidanceList(guidance, {
      title: 'Workflow trap guidance',
      className: 'inspector-trap-guidance',
      limit: 3
    });
    var consistencySupportHtml = renderConsistencySupportCard(detail, {
      title: 'Consistency / drift (supporting view)',
      emptyText: 'No clear drift signal is attached to this endpoint in the current evidence.'
    });

    return '<div class="endpoint-diag-pane">'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">Workflow burden priority</p>'
      + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> '
      + (chainCount ? ('appears in ' + chainCount + ' workflow chain' + (chainCount === 1 ? '' : 's')) : 'is not currently linked to an inferred chain')
      + ' and is prioritized here for continuity risk signals.</p>'
      + '<ul class="family-top-evidence">'
      + '<li><strong>Primary continuity signals:</strong> ' + escapeHtml(signalSummary.replace(/^primary continuity signals:\s*/i, '')) + '.</li>'
      + '<li><strong>Why this endpoint matters in flow:</strong> It can force extra client tracking when next-step requirements or context handoffs are implicit.</li>'
      + '</ul>'
      + consistencySupportHtml
      + comparisonHtml
      + guidanceHtml
      + '</div>'
      + '<details class="detail-evidence-drawer">'
      + '<summary>Open generic lead-issue context</summary>'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">Lead issue (secondary context)</p>'
      + '<p class="family-insight-lead-message">' + escapeHtml(topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.') + '</p>'
      + '</div>'
      + '</details>'
      + '</div>';
  }

  function renderEndpointDiagnosticsShapeSummary(detail) {
    var endpoint = detail.endpoint || {};
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var topContext = topGroup ? topGroup.context : {};
    var shapeTotals = collectShapeSignalTotalsForDetail(detail);
    var comparisonHtml = renderInspectorContractShapeComparison(detail, findings, {
      title: 'Current contract shape vs workflow-first contract shape',
      context: 'shape'
    });
    var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false);
    var guidanceHtml = renderTrapGuidanceList(guidance, {
      title: 'Shape trap guidance',
      className: 'inspector-trap-guidance',
      limit: 3
    });
    var consistencySupportHtml = renderConsistencySupportCard(detail, {
      title: 'Consistency / drift (supporting view)',
      emptyText: 'No clear drift signal is attached to this endpoint in the current evidence.'
    });

    var topDimensions = groups.slice(0, 3).map(function (group) {
      return group.title;
    });
    var locationHighlights = topOpenAPIHighlights(groups).slice(0, 3);
    var profileParts = [
      'deep nesting: ' + shapeTotals.deep,
      'internal fields: ' + shapeTotals.internal,
      'duplicated state: ' + shapeTotals.dup,
      'snapshot-heavy: ' + shapeTotals.snapshot,
      'unclear source-of-truth: ' + shapeTotals.source,
      'missing outcome framing: ' + shapeTotals.outcome,
      'missing next-action cues: ' + shapeTotals.nextAction
    ];
    var bullets = [];
    bullets.push('Endpoint-local evidence: ' + findings.length + ' shape finding' + (findings.length === 1 ? '' : 's') + ' grouped into ' + groups.length + ' evidence cluster' + (groups.length === 1 ? '' : 's') + '.');
    if (topGroup) {
      bullets.push('Most concentrated local shape issue: ' + topGroup.title + ' (' + topGroup.count + ').');
    }
    if (locationHighlights.length) {
      bullets.push('Primary schema locations to inspect next: ' + locationHighlights.join(' | ') + '.');
    }
    if (!topGroup && !locationHighlights.length) {
      bullets.push('Shape evidence is limited in this endpoint slice; use Exact evidence to inspect remaining grouped messages.');
    }

    return '<div class="endpoint-diag-pane">'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">Endpoint-local shape DX profile</p>'
      + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> is inspected for response shape DX burden: where backend graph detail hides outcome meaning, next actions, and authoritative state.</p>'
      + '<p class="subtle"><strong>Shape profile:</strong> ' + escapeHtml(profileParts.join(' | ')) + '.</p>'
      + '<ul class="family-top-evidence">'
      + bullets.map(function (line) {
          return '<li>' + escapeHtml(line) + '</li>';
        }).join('')
      + '</ul>'
      + consistencySupportHtml
      + comparisonHtml
      + guidanceHtml
      + '</div>'
      + '<details class="detail-evidence-drawer">'
      + '<summary>Open shape lead-issue context</summary>'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">Lead shape issue</p>'
      + '<p class="family-insight-lead-message">' + escapeHtml(topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No shape-specific issue message extracted.') + '</p>'
      + '<div class="family-insight-grounding">'
      + renderOpenAPIContextPills(topContext, true)
      + '</div>'
      + (topDimensions.length
          ? '<p class="subtle"><strong>Top shape dimensions in this endpoint:</strong> ' + escapeHtml(topDimensions.join(', ')) + '.</p>'
          : '')
      + '</div>'
      + '</details>'
      + '</div>';
  }

  function renderEndpointDiagnosticsExact(detail) {
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var moreCount = groups.length - 1;
    var openDrawer = state.detailEvidenceOpenForId === state.selectedEndpointId;
    if (openDrawer) state.detailEvidenceOpenForId = '';

    return '<div class="endpoint-diag-pane">'
      + '<details class="detail-evidence-drawer"' + (openDrawer ? ' open' : '') + '>'
      + '<summary>Open full exact evidence' + (groups.length ? ' (' + groups.length + ' groups)' : '') + '</summary>'
      + '<section class="detail-section detail-section-tight">'
      + '  <h3>Exact issue evidence</h3>'
      + '  <p class="subtle detail-section-copy">Grouped by location and type. First two groups start open.'
      + (moreCount > 0 ? ' ' + moreCount + ' additional group' + (moreCount > 1 ? 's' : '') + ' follow the lead issue below.' : '')
      + '</p>'
      + groups.map(function (group, index) {
            return renderIssueGroup(group, index);
          }).join('')
      + '</section>'
      + '</details>'
      + renderInspectorGroundingAndFlowContext(detail)
      + '</div>';
  }

  function renderInspectorGroundingAndFlowContext(detail) {
    var endpoint = detail.endpoint || {};
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var topContext = topGroup ? topGroup.context : {};
    var chainContext = buildChainContext(detail.relatedChains || [], endpoint.id || state.selectedEndpointId, state.payload.endpointDetails);

    return '<details class="detail-evidence-drawer">'
      + '<summary>Open grounding and flow context</summary>'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">Endpoint grounding</p>'
      + '<p class="family-insight-lead-message">' + escapeHtml(topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.') + '</p>'
      + '<div class="family-insight-grounding">'
      + renderOpenAPIContextPills(topContext, false)
      + (topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '')
      + '</div>'
      + '</div>'
      + (chainContext
          ? '<section class="detail-section detail-section-tight"><h3>Flow context</h3>' + chainContext + '</section>'
          : '')
      + '</details>';
  }

  function renderInspectorContentMap() {
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var mapping = workflowTabActive
      ? 'Inspector map: Workflow summary = cross-step continuity interpretation. Exact evidence = grouped messages + grounding + flow context.'
      : shapeTabActive
      ? 'Inspector map: Shape summary = endpoint-local schema interpretation. Exact evidence = grouped messages + grounding + flow context. Cleaner shape emphasis = endpoint-local improvement guidance.'
      : 'Inspector map: Summary = lead interpretation + grounding. Exact evidence = grouped messages + grounding + flow context. Consistency/drift and Cleaner contract emphasis remain in their own tabs.';
    return '<p class="subtle inspector-content-map">' + escapeHtml(mapping) + '</p>';
  }

  function renderEndpointDiagnosticsCleaner(detail) {
    var findings = findingsForActiveLens(detail.findings || []);
    var topGroup = groupFindings(findings)[0] || null;
    var cleaner = renderWorkflowShapedExample(detail, findings);
    if (cleaner) {
      return '<div class="endpoint-diag-pane">' + cleaner + '</div>';
    }

    var shapeTabActive = state.activeTopTab === 'shape';

    return '<div class="endpoint-diag-pane">'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">' + escapeHtml(shapeTabActive ? 'Cleaner shape emphasis' : 'Cleaner contract emphasis') + '</p>'
      + '<p class="subtle">' + escapeHtml(topGroup && topGroup.dimension
          ? dimensionCleanerHint(topGroup.dimension)
          : (shapeTabActive
              ? 'No cleaner shape-emphasis signals are available for this endpoint in the current shape view.'
              : 'No cleaner contract emphasis signals are available for this endpoint in the current view.')) + '</p>'
      + '</div>'
      + '</div>';
  }

  function renderEndpointDiagnosticsConsistency(detail) {
    var endpoint = detail.endpoint || {};
    var findings = detail.findings || [];
    var consistencyFindings = consistencyFindingsForDetail(findings);
    var siblings = (state.payload.endpoints || []).filter(function (row) {
      return row.id !== state.selectedEndpointId && (row.family || 'unlabeled family') === (endpoint.family || 'unlabeled family');
    }).slice(0, 6);

    var codesSeen = {};
    consistencyFindings.forEach(function (f) {
      codesSeen[f.code || ''] = true;
    });

    var driftBullets = [];
    if (codesSeen['detail-path-parameter-name-drift']) driftBullets.push('Parameter naming drift detected for this endpoint.');
    if (codesSeen['endpoint-path-style-drift'] || codesSeen['sibling-path-shape-drift']) driftBullets.push('Path style drift detected against sibling routes.');
    if (codesSeen['inconsistent-response-shape'] || codesSeen['inconsistent-response-shape-family'] || codesSeen['inconsistent-response-shapes'] || codesSeen['inconsistent-response-shapes-family']) driftBullets.push('Response shape/outcome drift detected in related endpoints.');

    return '<div class="endpoint-diag-pane">'
      + '<div class="family-insight-card">'
      + '<p class="insight-kicker">Consistency / drift for selected endpoint</p>'
      + '<p class="subtle">Selection context: ' + escapeHtml(endpoint.method + ' ' + endpoint.path) + ' | ' + escapeHtml(humanFamilyLabel(endpoint.family)) + '</p>'
      + (driftBullets.length
          ? '<ul class="family-top-evidence">' + driftBullets.map(function (b) { return '<li>' + escapeHtml(b) + '</li>'; }).join('') + '</ul>'
          : '<p class="subtle">No direct consistency drift findings are attached to this endpoint in the current view.</p>')
      + (consistencyFindings.length
          ? '<details class="detail-evidence-drawer"><summary>Open consistency evidence (' + consistencyFindings.length + ')</summary><ul class="family-top-evidence">'
            + consistencyFindings.slice(0, 8).map(function (f) { return '<li><strong>' + escapeHtml(f.code || 'consistency') + ':</strong> ' + escapeHtml(f.message || '') + '</li>'; }).join('')
            + '</ul></details>'
          : '')
      + (siblings.length
          ? '<p class="insight-kicker endpoint-diag-subkicker">Sibling endpoints for comparison</p><ul class="family-workflow-context">'
            + siblings.map(function (s) { return '<li>' + escapeHtml(s.method + ' ' + s.path) + '</li>'; }).join('')
            + '</ul>'
          : '<p class="subtle">No sibling endpoints available in this family for drift comparison.</p>')
      + '</div>'
      + '</div>';
  }

  function renderConsistencySupportCard(detail, options) {
    var opts = options || {};
    var endpoint = (detail && detail.endpoint) || {};
    var consistencyFindings = consistencyFindingsForDetail((detail && detail.findings) || []);
    var lines = [];
    var codesSeen = {};
    consistencyFindings.forEach(function (f) {
      codesSeen[f.code || ''] = true;
    });

    if (codesSeen['detail-path-parameter-name-drift']) lines.push('Parameter naming drift vs sibling routes.');
    if (codesSeen['endpoint-path-style-drift'] || codesSeen['sibling-path-shape-drift']) lines.push('Path style drift against related endpoints.');
    if (codesSeen['inconsistent-response-shape'] || codesSeen['inconsistent-response-shape-family'] || codesSeen['inconsistent-response-shapes'] || codesSeen['inconsistent-response-shapes-family']) {
      lines.push('Response shape or outcome wording drift across similar operations.');
    }

    var body = lines.length
      ? '<ul class="family-top-evidence">' + lines.slice(0, 3).map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('') + '</ul>'
      : '<p class="subtle">' + escapeHtml(opts.emptyText || 'No direct consistency/drift signal is attached to this endpoint.') + '</p>';

    return '<div class="family-insight-card">'
      + '<p class="insight-kicker">' + escapeHtml(opts.title || 'Consistency / drift (supporting view)') + '</p>'
      + '<p class="subtle">' + escapeHtml(endpoint.method + ' ' + endpoint.path) + ' keeps drift analysis available as supporting context, not a primary navigation path.</p>'
      + body
      + '</div>';
  }

  function syncControls() {
    var specRuleTabActive = state.activeTopTab === 'spec-rule';
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var lockGuidanceControls = specRuleTabActive || workflowTabActive || shapeTabActive;

    el.searchInput.value = state.filters.search;
    el.categoryFilter.value = state.filters.category;
    el.burdenFilter.value = state.filters.burden;
    el.familyPriorityFilter.value = state.filters.familyPressure;
    el.includeNoIssueRows.checked = state.filters.includeNoIssueRows;

    el.categoryFilter.disabled = lockGuidanceControls;
    el.burdenFilter.disabled = lockGuidanceControls;
    if (specRuleTabActive) {
      el.categoryFilter.title = 'Locked in Spec rule violations: category is fixed to spec-rule.';
      el.burdenFilter.title = 'Locked in Spec rule violations: burden is fixed to all burdens.';
    } else if (workflowTabActive) {
      el.categoryFilter.title = 'Locked in Workflow burden: category is fixed to all categories.';
      el.burdenFilter.title = 'Locked in Workflow burden: burden is fixed to workflow-burden.';
    } else if (shapeTabActive) {
      el.categoryFilter.title = 'Locked in Shape burden: category is fixed to all categories.';
      el.burdenFilter.title = 'Locked in Shape burden: burden is fixed to contract-shape.';
    } else {
      el.categoryFilter.removeAttribute('title');
      el.burdenFilter.removeAttribute('title');
    }

    var categoryField = el.categoryFilter ? el.categoryFilter.closest('.field') : null;
    var burdenField = el.burdenFilter ? el.burdenFilter.closest('.field') : null;
    var hideRedundantSpecializedLensFields = lockGuidanceControls;
    if (categoryField) {
      categoryField.classList.toggle('field-hidden-by-lens', hideRedundantSpecializedLensFields);
      categoryField.setAttribute('aria-hidden', hideRedundantSpecializedLensFields ? 'true' : 'false');
    }
    if (burdenField) {
      burdenField.classList.toggle('field-hidden-by-lens', hideRedundantSpecializedLensFields);
      burdenField.setAttribute('aria-hidden', hideRedundantSpecializedLensFields ? 'true' : 'false');
    }

    if (el.lensControlHint) {
      var hint = '';
      if (specRuleTabActive) {
        hint = 'Spec rule violations is set by the top tab. Category and Burden selectors are fixed here so Search, Family pressure, and row-inclusion controls remain active.';
      } else if (workflowTabActive) {
        hint = 'Workflow burden is set by the top tab. This lens focuses on cross-step continuity risk, so Category and Burden stay fixed while Search, Family pressure, and row-inclusion controls remain active.';
      } else if (shapeTabActive) {
        hint = 'Shape burden is set by the top tab. This lens focuses on endpoint-local schema clarity, so Category and Burden stay fixed while Search, Family pressure, and row-inclusion controls remain active.';
      }
      el.lensControlHint.textContent = hint;
      el.lensControlHint.style.display = hint ? 'block' : 'none';
    }
  }

  function clearCurrentLens() {
    state.activeTopTab = "spec-rule";
    state.endpointDiagnosticsSubTab = "summary";
    state.expandedFamily = "";
    state.detailEvidenceOpenForId = "";
    state.filters.search = "";
    state.filters.category = "all";
    state.filters.burden = "all";
    state.filters.familyPressure = "all";
    state.filters.includeNoIssueRows = false;
    state.selectedEndpointId = firstEvidenceEndpointId(state.payload.endpoints || []);
    render();
    pulseLensUpdate();
  }

  function renderFamilySurface() {
    var summaries = familySummaries();
    var lensContext = buildFamilySurfaceContext(summaries);
    var visibleFamilies = {};
    summaries.forEach(function (family) {
      visibleFamilies[family.family || 'unlabeled family'] = true;
    });
    if (state.expandedFamily && !visibleFamilies[state.expandedFamily]) {
      state.expandedFamily = "";
    }

    if (!summaries.length) {
      el.familySurfaceHelp.textContent = state.activeTopTab === 'shape'
        ? 'Shape Burden lens: no families currently expose shape-heavy evidence in this slice.'
        : '';
      el.familySurfaceContext.innerHTML = lensContext;
      bindRecoveryButtons(el.familySurfaceContext);
      var shapeTabActive = state.activeTopTab === 'shape';
      el.familySurface.innerHTML = '<div class="empty">'
        + '<strong>No matching families.</strong>'
        + '<p class="subtle">'
        + escapeHtml(shapeTabActive
            ? 'The current filters removed every family. Use the recovery controls in the family context block above to widen this view.'
            : 'The current filters removed every family. Use the buttons below to widen the view.')
        + '</p>'
        + (shapeTabActive ? '' : renderRecoveryActions(["clear-search", "reset-burden", "show-all-families", "clear-current-lens"]))
        + '</div>';
      if (!shapeTabActive) {
        bindRecoveryButtons(el.familySurface);
      }
      return;
    }

    el.familySurfaceHelp.textContent = state.activeTopTab === 'shape'
      ? 'Shape Burden lens: families are ranked by response-shape friction such as deep nesting, duplicated state, incidental/internal fields, and snapshot-heavy responses.'
      : '';
    el.familySurfaceContext.innerHTML = lensContext;
    bindRecoveryButtons(el.familySurfaceContext);
    Array.prototype.forEach.call(el.familySurfaceContext.querySelectorAll('[data-focus-top-family]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var family = btn.getAttribute('data-focus-top-family') || '';
        if (!family) return;
        state.filters.search = family.trim().toLowerCase();
        state.filters.includeNoIssueRows = false;
        state.detailEvidenceOpenForId = '';
        if (state.activeTopTab === 'spec-rule') {
          state.filters.category = 'spec-rule';
          state.filters.burden = 'all';
          state.filters.familyPressure = 'all';
          state.endpointDiagnosticsSubTab = 'exact';
        } else if (state.activeTopTab === 'workflow') {
          state.filters.category = 'all';
          state.filters.burden = 'workflow-burden';
          state.filters.familyPressure = 'all';
          state.endpointDiagnosticsSubTab = 'summary';
        } else if (state.activeTopTab === 'shape') {
          state.filters.category = 'all';
          state.filters.burden = 'contract-shape';
          state.filters.familyPressure = 'all';
          state.endpointDiagnosticsSubTab = 'summary';
        }
        state.selectedEndpointId = firstVisibleEndpointId(filteredRows());
        render();
        scrollToEndpointListIfNeeded();
        markInteractionDestination(el.endpointListSection || (el.endpointRows ? el.endpointRows.closest('.section') : null));
      });
    });
    var cardsHtml = summaries.map(function (family) {
      return renderFamilyCard(family);
    }).join("");

    el.familySurface.innerHTML = cardsHtml;

    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-insight-toggle]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var family = btn.getAttribute("data-insight-toggle") || "";
        state.expandedFamily = (state.expandedFamily === family) ? "" : family;
        renderFamilySurface();
      });
      var isExpanded = state.expandedFamily === (btn.getAttribute("data-insight-toggle") || "");
      btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    Array.prototype.forEach.call(el.familySurface.querySelectorAll('button[data-insight-close]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        state.expandedFamily = '';
        renderFamilySurface();
      });
    });

    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-focus-family]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var family = btn.getAttribute("data-focus-family") || "";
        if (!family) return;
        state.filters.search = family.trim().toLowerCase();
        state.filters.includeNoIssueRows = false;
        state.detailEvidenceOpenForId = '';

        if (state.activeTopTab === 'spec-rule') {
          state.filters.category = 'spec-rule';
          state.filters.burden = 'all';
          state.filters.familyPressure = 'all';
          state.endpointDiagnosticsSubTab = 'exact';
        } else if (state.activeTopTab === 'workflow') {
          state.filters.category = 'all';
          state.filters.burden = 'workflow-burden';
          state.filters.familyPressure = 'all';
          state.endpointDiagnosticsSubTab = 'summary';
        } else if (state.activeTopTab === 'shape') {
          state.filters.category = 'all';
          state.filters.burden = 'contract-shape';
          state.filters.familyPressure = 'all';
          state.endpointDiagnosticsSubTab = 'summary';
        }

        state.selectedEndpointId = firstVisibleEndpointId(filteredRows());
        render();
        scrollToEndpointListIfNeeded();
        markInteractionDestination(el.endpointListSection || (el.endpointRows ? el.endpointRows.closest('.section') : null));
      });
    });

    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-open-evidence-id]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var endpointId = btn.getAttribute("data-open-evidence-id") || "";
        if (!endpointId) return;
        state.selectedEndpointId = endpointId;
        state.detailEvidenceOpenForId = endpointId;
        if (state.activeTopTab === 'workflow' || state.activeTopTab === 'shape') {
          state.endpointDiagnosticsSubTab = 'exact';
        }
        renderEndpointRows();
        renderEndpointDiagnostics();
        renderEndpointDetail();
        syncWorkflowStepSelectionHighlight();
        if (state.activeTopTab === 'workflow') {
          markExactEvidenceDestination();
          focusWorkflowExactEvidenceTarget();
        } else if (state.activeTopTab === 'shape') {
          markExactEvidenceDestination();
          focusWorkflowExactEvidenceTarget();
        } else {
          markExactEvidenceDestination();
          scrollToEndpointDiagnostics();
        }
      });
    });
  }

  function renderWorkflowChains() {
    if (state.activeTopTab !== 'workflow') {
      el.workflowSection.style.display = 'none';
      el.workflowHelp.textContent = '';
      el.workflowChains.innerHTML = '';
      return;
    }

    var allChains = state.payload.workflows.chains || [];
    if (!allChains.length) {
      el.workflowSection.style.display = 'block';
      el.workflowHelp.textContent = '';
      el.workflowChains.innerHTML = renderWorkflowEmptyState('absent');
      return;
    }

    var visibleRows = workflowScopedRows();
    var visibleByID = {};
    visibleRows.forEach(function (row) {
      visibleByID[row.id] = true;
    });
    var filteredChains = allChains.filter(function (chain) {
      return (chain.endpointIds || []).some(function (eid) {
        return !!visibleByID[eid];
      });
    });

    var scopedByID = {};
    scopedRows(state.payload.endpoints || []).forEach(function (row) {
      scopedByID[row.id] = true;
    });
    var scopedChains = allChains.filter(function (chain) {
      return (chain.endpointIds || []).some(function (eid) {
        return !!scopedByID[eid];
      });
    });

    el.workflowSection.style.display = 'block';

    if (filteredChains.length) {
      el.workflowHelp.textContent = 'Step-by-step call chain surface for the current lens. Selecting a step updates Endpoint diagnostics and exact evidence for that endpoint.';
      var groups = groupChainsByKind(filteredChains);
      el.workflowChains.innerHTML = groups.map(renderWorkflowKindGroup).join('');
      bindWorkflowStepInteractions();
      syncWorkflowStepSelectionHighlight();
      return;
    }

    if (scopedChains.length) {
      el.workflowHelp.textContent = 'No chains overlap the current evidence-only slice. Showing inferred call chains from scoped endpoints so the sequence remains visible.';
      var scopedGroups = groupChainsByKind(scopedChains);
      el.workflowChains.innerHTML = '<div class="workflow-no-match">'
        + '<p class="workflow-empty-kicker">Workflow view</p>'
        + '<p class="workflow-empty-title"><strong>Call chain surface restored for this lens</strong></p>'
        + '<p class="workflow-empty-copy">Visible issue rows are currently too narrow for direct chain overlap, so this section keeps the inferred sequence visible from the scoped endpoint set.</p>'
        + renderRecoveryActions(['show-all-workflows'])
        + '</div>'
        + scopedGroups.map(renderWorkflowKindGroup).join('');
      bindRecoveryButtons(el.workflowChains);
      bindWorkflowStepInteractions();
      syncWorkflowStepSelectionHighlight();
      return;
    }

    el.workflowHelp.textContent = '';
    el.workflowChains.innerHTML = renderWorkflowEmptyState('filtered');
    bindRecoveryButtons(el.workflowChains);
  }

  function bindWorkflowStepInteractions() {
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('[data-step-id]'), function (elem) {
      elem.addEventListener('click', function () {
        state.selectedEndpointId = elem.getAttribute('data-step-id');
        renderEndpointRows();
        renderEndpointDiagnostics();
        renderEndpointDetail();
        syncWorkflowStepSelectionHighlight();
        markInteractionDestination(el.endpointDiagnosticsSection);
        scrollToEndpointDiagnostics();
      });
    });

    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('[data-step-open-evidence]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var endpointId = btn.getAttribute('data-step-open-evidence') || '';
        if (!endpointId) return;
        state.selectedEndpointId = endpointId;
        state.endpointDiagnosticsSubTab = 'exact';
        state.detailEvidenceOpenForId = endpointId;
        renderEndpointRows();
        renderEndpointDiagnostics();
        renderEndpointDetail();
        syncWorkflowStepSelectionHighlight();
        markExactEvidenceDestination();
        focusWorkflowExactEvidenceTarget();
      });
    });
  }

  function syncWorkflowStepSelectionHighlight() {
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('.step-box'), function (box) {
      box.classList.remove('step-active');
    });
    if (!state.selectedEndpointId) return;
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('[data-step-id]'), function (elem) {
      if ((elem.getAttribute('data-step-id') || '') !== state.selectedEndpointId) return;
      var box = elem.querySelector('.step-box');
      if (box) box.classList.add('step-active');
    });
  }

  function renderWorkflowEmptyState(mode) {
    if (mode === 'absent') {
      return '<div class="workflow-no-match workflow-no-match-final">'
        + '<p class="workflow-empty-kicker">Workflow view</p>'
        + '<p class="workflow-empty-title"><strong>No inferred workflow chains</strong></p>'
        + '<p class="workflow-empty-copy">This spec currently reads as isolated endpoints rather than a linked call sequence, so there is nothing to expand in this section.</p>'
        + '<p class="workflow-empty-note">That is a final state for this spec, not a filter mismatch.</p>'
        + '</div>';
    }

    if (!filteredRows().length) {
      return '<div class="workflow-no-match">'
        + '<p class="workflow-empty-kicker">Workflow view</p>'
        + '<p class="workflow-empty-title"><strong>No workflows in the current view</strong></p>'
        + '<p class="workflow-empty-copy">This follows the current no-match filter state. Use the family section recovery above to widen the view.</p>'
        + '</div>';
    }

    return '<div class="workflow-no-match">'
      + '<p class="workflow-empty-kicker">Workflow view</p>'
      + '<p class="workflow-empty-title"><strong>No workflows in the current view</strong></p>'
      + '<p class="workflow-empty-copy">The active filters removed visible call chains. Use show-all workflows if you only want to widen workflow scope.</p>'
      + renderRecoveryActions(['show-all-workflows'])
      + '</div>';
  }

  function groupChainsByKind(chains) {
    var byKind = {};
    chains.forEach(function (chain) {
      var kind = chain.kind || 'workflow';
      if (!byKind[kind]) byKind[kind] = [];
      byKind[kind].push(chain);
    });

    return Object.keys(byKind).map(function (kind) {
      var kindChains = byKind[kind].slice();
      kindChains.sort(function (a, b) { return chainBurdenScore(b) - chainBurdenScore(a); });
      return { kind: kind, chains: kindChains };
    }).sort(function (a, b) {
      var aScore = a.chains.reduce(function (s, c) { return s + chainBurdenScore(c); }, 0);
      var bScore = b.chains.reduce(function (s, c) { return s + chainBurdenScore(c); }, 0);
      return bScore - aScore;
    });
  }

  function chainBurdenScore(chain) {
    return (chain.endpointIds || []).reduce(function (total, eid) {
      var d = state.payload.endpointDetails[eid];
      if (!d) return total;
      return total + (d.findings || []).filter(function (f) {
        return f.burdenFocus === 'workflow-burden';
      }).length;
    }, 0);
  }

  function parseChainRoles(summary, count) {
    if (!summary) return [];
    var parts = summary.split(' -> ');
    return parts.map(function (part) {
      var i = part.indexOf(': ');
      return i >= 0 ? part.substring(0, i) : '';
    });
  }

  function humanizeStepRole(roleSlug) {
    var map = {
      'list':        'browse list',
      'search':      'search / filter',
      'detail':      'load item',
      'create':      'create',
      'update':      'update',
      'delete':      'delete',
      'action':      'trigger action',
      'checkout':    'checkout',
      'payment':     'handle payment',
      'auth':        'authenticate',
      'login':       'authenticate',
      'register':    'register',
      'submit':      'submit',
      'confirm':     'confirm',
      'follow-up':   'follow up',
      'followup':    'follow up',
      'cancel':      'cancel',
      'upload':      'upload',
      'download':    'download',
      'refresh':     'refresh',
      'poll':        'poll status'
    };
    if (!roleSlug) return '';
    var slug = roleSlug.toLowerCase();
    return map[slug] || slug.replace(/-/g, ' ');
  }

  var KIND_GROUP_LABEL = {
    'list-detail':             'Browse then inspect',
    'list-detail-update':      'Browse, inspect, and update',
    'list-detail-action':      'Browse, inspect, and act',
    'list-detail-create':      'Browse, inspect, and create',
    'create-detail':           'Create then inspect',
    'create-detail-update':    'Create then refine',
    'create-detail-action':    'Create then act',
    'action-follow-up':        'Act and follow up',
    'media-detail-follow-up':  'Upload then follow up',
    'order-detail-action':     'Submit then confirm'
  };

  function kindGroupLabel(kind) {
    return KIND_GROUP_LABEL[kind] || kind.replace(/-/g, ' → ');
  }

  function chainTaskLabel(chain) {
    var roles = parseChainRoles(chain.summary);
    if (roles.length >= 2) {
      var first = humanizeStepRole(roles[0]);
      var last = humanizeStepRole(roles[roles.length - 1]);
      if (first && last && first !== last) {
        return first + ' → ' + last;
      }
    }
    return chainResourceLabel(chain);
  }

  function chainResourceLabel(chain) {
    var ids = chain.endpointIds || [];
    var detail = ids.length ? state.payload.endpointDetails[ids[0]] : null;
    if (!detail) return chain.kind || 'workflow';
    var segs = detail.endpoint.path.split('/').filter(function (p) { return p && !p.startsWith('{'); });
    return segs.length ? segs[segs.length - 1] : detail.endpoint.path;
  }

  function formatWorkflowStepRefs(indices) {
    if (!indices || !indices.length) return '';
    var sorted = indices.slice().sort(function (a, b) { return a - b; });
    var labels = sorted.map(function (n) { return String(n + 1); });
    return 'shows up in step' + (labels.length > 1 ? 's ' : ' ') + labels.join(', ');
  }

  function collectWorkflowBurdenSummary(chain, roles) {
    var steps = chain.endpointIds || [];
    var burdens = {
      hidden: { key: 'hidden', label: 'hidden token/context handoff', why: 'does not clearly expose what the next call needs', steps: [] },
      outcome: { key: 'outcome', label: 'weak outcome guidance', why: 'outcome is weakly signaled for later calls', steps: [] },
      sequence: { key: 'sequence', label: 'sequencing appears brittle', why: 'later calls likely depend on implicit prior state', steps: [] },
      auth: { key: 'auth', label: 'auth/context/header burden', why: 'auth or context requirements appear spread across steps', steps: [] }
    };

    steps.forEach(function (endpointId, idx) {
      var detail = state.payload.endpointDetails[endpointId];
      if (!detail) return;
      var endpoint = detail.endpoint || {};
      var findings = detail.findings || [];
      var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : '';
      var nextDetail = nextEndpointId ? state.payload.endpointDetails[nextEndpointId] : null;
      var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
      var role = roles[idx] || '';
      var nextRole = roles[idx + 1] || '';
      var linkageFindings = findings.filter(function (f) {
        return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
      });
      var prerequisiteFindings = findings.filter(function (f) {
        return f.code === 'prerequisite-task-burden';
      });
      var clues = buildWorkflowDependencyClues(endpoint, findings, idx, steps.length, role, nextEndpoint, nextRole, linkageFindings, prerequisiteFindings);
      var joined = (clues.prereq || []).concat(clues.establish || [], clues.nextNeeds || [], clues.hidden || []).join(' | ').toLowerCase();

      if ((clues.hidden || []).length || prerequisiteFindings.length) {
        if (burdens.hidden.steps.indexOf(idx) === -1) burdens.hidden.steps.push(idx);
      }
      if (findings.some(function (f) {
        return f.code === 'contract-shape-workflow-guidance-burden' || f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
      })) {
        if (burdens.outcome.steps.indexOf(idx) === -1) burdens.outcome.steps.push(idx);
      }
      if ((clues.hidden || []).length || (clues.prereq || []).some(function (c) { return /prior state|earlier step|mutation|lookup/i.test(c); })) {
        if (burdens.sequence.steps.indexOf(idx) === -1) burdens.sequence.steps.push(idx);
      }
      if (/(auth|header|token|context|access\s*key|api[-\s]?key)/i.test(joined)) {
        if (burdens.auth.steps.indexOf(idx) === -1) burdens.auth.steps.push(idx);
      }
    });

    var priorityOrder = ['hidden', 'outcome', 'auth', 'sequence'];
    return Object.keys(burdens)
      .map(function (k) { return burdens[k]; })
      .filter(function (b) { return b.steps.length > 0; })
      .sort(function (a, b) {
        if (b.steps.length !== a.steps.length) return b.steps.length - a.steps.length;
        return priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key);
      });
  }

  function renderWorkflowBurdenSummary(chain, roles) {
    var items = collectWorkflowBurdenSummary(chain, roles);
    if (!items.length) return '';
    var html = items.map(function (item, idx) {
      var priorityCls = idx === 0 ? ' workflow-burden-primary' : ' workflow-burden-secondary';
      return '<span class="workflow-burden-item workflow-burden-' + item.key + priorityCls + '">'
        + '<strong>' + escapeHtml(item.label) + '</strong>'
        + '<em>' + escapeHtml(formatWorkflowStepRefs(item.steps)) + '</em>'
        + '<span>' + escapeHtml(item.why) + '</span>'
        + '</span>';
    }).join('');
    return '<div class="workflow-burden-summary">' + html + '</div>';
  }

  function renderWorkflowKindGroup(group) {
    var kindLabel = kindGroupLabel(group.kind);
    var count = group.chains.length;
    var countBadge = count > 1 ? '<span class="kind-chain-count">' + count + ' chains</span>' : '';

    var primaryHtml = renderWorkflowChain(group.chains[0], true);
    var secondaryHtml = group.chains.slice(1).map(function (chain) {
      return renderWorkflowChain(chain, false);
    }).join('');

    return '<div class="workflow-kind-group">'
      + '<div class="workflow-kind-header">'
      + '<strong>' + escapeHtml(kindLabel) + '</strong>'
      + countBadge
      + '</div>'
      + primaryHtml
      + secondaryHtml
      + '</div>';
  }

  function renderWorkflowChain(chain, isPrimary) {
    var steps = chain.endpointIds || [];
    var roles = parseChainRoles(chain.summary, steps.length);
    var burdenScore = chainBurdenScore(chain);
    var burdenBadge = burdenScore > 0
      ? '<span class="chain-burden-count">' + burdenScore + ' burden issue' + (burdenScore === 1 ? '' : 's') + '</span>'
      : '';
    var resourceLabel = chainResourceLabel(chain);

    var stepElements = steps.map(function (endpointId, idx) {
      var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : '';
      return renderWorkflowStep(endpointId, idx, steps.length, roles[idx] || '', nextEndpointId, roles[idx + 1] || '');
    }).join('');

    var taskLabel = chainTaskLabel(chain);

    var burdenSummary = renderWorkflowBurdenSummary(chain, roles);
    var stepsAndReason = burdenSummary
      + '<div class="workflow-steps">' + stepElements + '</div>'
      + (chain.reason ? '<div class="workflow-reason">' + escapeHtml(chain.reason) + '</div>' : '');

    if (isPrimary) {
      return '<div class="workflow-chain">'
        + '<div class="chain-resource-label">'
        + '<span class="chain-resource-name">' + escapeHtml(taskLabel) + '</span>'
        + '<span class="chain-step-count">' + steps.length + ' steps</span>'
        + burdenBadge
        + '</div>'
        + stepsAndReason
        + '</div>';
    }
    return '<details class="workflow-chain-compact">'
      + '<summary>'
      + '<span class="chain-compact-resource">' + escapeHtml(taskLabel) + '</span>'
      + '<span class="chain-compact-steps">' + steps.length + ' steps</span>'
      + burdenBadge
      + '</summary>'
      + '<div class="workflow-chain-compact-body">'
      + stepsAndReason
      + '</div>'
      + '</details>';
  }

  function addUniqueClue(list, text) {
    if (!text) return;
    if (list.indexOf(text) === -1) list.push(text);
  }

  function firstClues(list, limit) {
    return (list || []).slice(0, limit);
  }

  function renderWorkflowDependencyClues(clues) {
    if (!clues) return '';
    var prereq = firstClues(clues.prereq, 2);
    var establish = firstClues(clues.establish, 2);
    var nextNeeds = firstClues(clues.nextNeeds, 2);
    var hidden = firstClues(clues.hidden, 2);
    if (!prereq.length && !establish.length && !nextNeeds.length && !hidden.length) return '';

    function clueRow(label, items, klass, icon) {
      if (!items.length) return '';
      return '<div class="step-clue-row ' + klass + '">'
        + '<span class="step-clue-label"><span class="step-clue-icon">' + icon + '</span>' + label + '</span>'
        + '<span class="step-clue-text">' + escapeHtml(items.join(' | ')) + '</span>'
        + '</div>';
    }

    return '<div class="step-dependency-clues">'
      + clueRow('Depends on', prereq, 'step-clue-prereq', '\u25cb')
      + clueRow('Appears to establish', establish, 'step-clue-establish', '\u25b8')
      + clueRow('Next step likely needs', nextNeeds, 'step-clue-next', '\u2192')
      + clueRow('Not clearly exposed', hidden, 'step-clue-hidden', '!')
      + '</div>';
  }

  function inferWorkflowCueSubject(text) {
    if (!text) return '';

    if (/(auth|bearer|authorization|access\s*key|api[-\s]?key|auth\/header)/.test(text)) return 'auth header';
    if (/(token|context)/.test(text)) return 'context token';
    if (/(payment|transaction)/.test(text)) return 'payment';
    if (/order identity/.test(text)) return 'order id';
    if (/cart/.test(text) && /(identity|identifier|selected resource context)/.test(text)) return 'cart id';
    if (/customer/.test(text) && /(identity|identifier)/.test(text)) return 'customer id';
    if (/order/.test(text) && /(state|changed state|prior state|authoritative state|order context)/.test(text)) return 'order state';
    if (/cart/.test(text) && /(state|changed state|prior state|authoritative state|cart context)/.test(text)) return 'cart state';
    if (/customer/.test(text) && /(state|context)/.test(text)) return 'customer context';
    if (/(action|lookup)/.test(text)) return 'action prerequisite';
    if (/(identifier|header)/.test(text)) return 'id/header';
    if (/(state transition|changed state|prior state|authoritative state)/.test(text)) return 'state change';

    return '';
  }

  function inferWorkflowTransitionCue(clues, roleLabel) {
    var prereq = clues && clues.prereq ? clues.prereq : [];
    var establish = clues && clues.establish ? clues.establish : [];
    var nextNeeds = clues && clues.nextNeeds ? clues.nextNeeds : [];
    var hidden = clues && clues.hidden ? clues.hidden : [];
    var role = (roleLabel || '').toLowerCase();
    var allText = (prereq.concat(establish, nextNeeds, hidden)).join(' | ').toLowerCase();
    var handoffText = (establish.concat(nextNeeds)).join(' | ').toLowerCase();
    var subject = inferWorkflowCueSubject(allText);
    var handoffSubject = inferWorkflowCueSubject(handoffText) || subject;

    // Derive the most specific applicable label from available clue text,
    // including when hidden signals are present.
    if (/(auth|bearer|authorization|access\s*key|api[-\s]?key)/.test(allText)) {
      return { kind: 'context', label: hidden.length ? 'auth header dependency' : 'auth header handoff' };
    }
    if (/(token|context)/.test(allText)) {
      return { kind: 'context', label: hidden.length ? 'context token dependency' : 'context token handoff' };
    }
    if (/(order identity|order state|order context)/.test(allText)) {
      return { kind: 'state', label: 'order identity handoff' };
    }
    if (/(cart|order|customer)/.test(allText) && hidden.length) {
      if (subject === 'order state' || subject === 'cart state' || subject === 'customer context') {
        return { kind: 'state', label: subject + ' dependency' };
      }
      if (subject === 'order id' || subject === 'cart id' || subject === 'customer id') {
        return { kind: 'state', label: subject + ' dependency' };
      }
      return { kind: 'state', label: 'resource state dependency' };
    }
    if (/(cart|order|customer|state)/.test(handoffText) || role === 'action' || role === 'update') {
      if (handoffSubject === 'order id' || handoffSubject === 'cart id' || handoffSubject === 'customer id') {
        return { kind: 'state', label: handoffSubject + ' handoff' };
      }
      if (handoffSubject === 'order state' || handoffSubject === 'cart state' || handoffSubject === 'customer context') {
        return { kind: 'state', label: handoffSubject + ' handoff' };
      }
      return { kind: 'state', label: 'state change handoff' };
    }
    if (/(payment|follow-up|follow up|transaction)/.test(allText) || role === 'payment' || role === 'checkout') {
      if (/transaction/.test(allText)) {
        return { kind: 'followup', label: hidden.length ? 'transaction follow-up' : 'transaction handoff' };
      }
      return { kind: 'followup', label: hidden.length ? 'payment follow-up' : 'payment handoff' };
    }
    if (hidden.length) {
      if (subject === 'action prerequisite') return { kind: 'weak', label: 'action prerequisite' };
      if (subject === 'id/header') return { kind: 'weak', label: 'hidden id/header' };
      if (subject === 'state change') return { kind: 'weak', label: 'hidden state handoff' };
      if (prereq.length) return { kind: 'weak', label: 'prior state handoff' };
      return { kind: 'weak', label: 'hidden handoff' };
    }
    if (prereq.length) {
      if (subject === 'action prerequisite') return { kind: 'prereq', label: 'action prerequisite' };
      if (subject === 'order state' || subject === 'cart state' || subject === 'customer context') {
        return { kind: 'prereq', label: subject + ' dependency' };
      }
      return { kind: 'prereq', label: 'prior state dependency' };
    }
    return null;
  }

  function buildWorkflowDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings) {
    var clues = { prereq: [], establish: [], nextNeeds: [], hidden: [] };
    var path = (endpoint.path || '').toLowerCase();
    var method = (endpoint.method || '').toUpperCase();
    var role = (roleLabel || '').toLowerCase();
    var nextPath = nextEndpoint ? (nextEndpoint.path || '').toLowerCase() : '';
    var nextMethod = nextEndpoint ? (nextEndpoint.method || '').toUpperCase() : '';
    var nextRole = (nextRoleLabel || '').toLowerCase();
    var isLast = stepIndex === (totalSteps - 1);
    var messages = (findings || []).map(function (f) { return f.message || ''; }).join(' | ');

    if (stepIndex > 0 && (role === 'action' || role === 'update' || role === 'delete' || role === 'checkout' || role === 'payment' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
      addUniqueClue(clues.prereq, 'appears to require prior state from an earlier step');
    }
    if (/(header|authorization|bearer|access\s*key|api[-\s]?key|token|context)/i.test(messages)) {
      addUniqueClue(clues.prereq, 'appears to require auth/header or context token');
    }
    if (path.indexOf('/_action/') !== -1 || role === 'action') {
      addUniqueClue(clues.prereq, 'appears to require an earlier mutation or lookup');
    }
    if ((path.indexOf('cart') !== -1 || path.indexOf('order') !== -1 || path.indexOf('customer') !== -1) && stepIndex > 0) {
      addUniqueClue(clues.prereq, 'suggests dependency on prior cart/customer/order context');
    }

    if (path.indexOf('auth') !== -1 || path.indexOf('login') !== -1 || path.indexOf('session') !== -1 || path.indexOf('register') !== -1) {
      addUniqueClue(clues.establish, 'appears to establish auth context');
    }
    if (path.indexOf('customer') !== -1 && (method === 'POST' || role === 'create' || role === 'register' || role === 'login')) {
      addUniqueClue(clues.establish, 'appears to establish customer context');
    }
    if (/(token|context)/i.test(messages)) {
      addUniqueClue(clues.establish, 'appears to establish or store context token');
    }
    if (path.indexOf('cart') !== -1 && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
      addUniqueClue(clues.establish, 'appears to mutate cart state');
    }
    if (path.indexOf('order') !== -1 && method === 'POST') {
      addUniqueClue(clues.establish, 'appears to create order identity');
    }
    if (path.indexOf('payment') !== -1 || role === 'payment' || role === 'checkout') {
      addUniqueClue(clues.establish, 'appears to trigger payment follow-up');
    }
    if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      addUniqueClue(clues.establish, 'likely changes authoritative state for later calls');
    }

    if (!isLast && nextEndpoint) {
      if (/(token|context)/i.test(messages)) {
        addUniqueClue(clues.nextNeeds, 'next step likely needs context token');
      }
      if (/(header|authorization|bearer|access\s*key|api[-\s]?key)/i.test(messages)) {
        addUniqueClue(clues.nextNeeds, 'next step likely needs auth or access header');
      }
      if (nextPath.indexOf('{') !== -1 || nextRole === 'detail') {
        addUniqueClue(clues.nextNeeds, 'next step likely needs cart/customer/order identity');
      }
      if (nextMethod === 'PATCH' || nextMethod === 'PUT' || nextMethod === 'DELETE' || nextRole === 'action') {
        addUniqueClue(clues.nextNeeds, 'next step likely depends on changed state from this step');
      }
      if (nextPath.indexOf('payment') !== -1 || nextRole === 'payment' || nextRole === 'checkout') {
        addUniqueClue(clues.nextNeeds, 'next step likely depends on prior order or transaction state');
      }
      if (nextPath.indexOf('/_action/') !== -1) {
        addUniqueClue(clues.nextNeeds, 'next step likely needs action/context prerequisites');
      }
      if (!clues.nextNeeds.length && method === 'GET') {
        addUniqueClue(clues.nextNeeds, 'next step likely needs selected resource context');
      }
    }

    if (linkageFindings.length) {
      addUniqueClue(clues.hidden, 'does not clearly expose next required identifier or header');
      addUniqueClue(clues.hidden, 'does not clearly expose authoritative token or context');
      addUniqueClue(clues.hidden, isLast
        ? 'follow-up step appears brittle from contract alone'
        : 'next required state appears implicit in the contract');
    }
    if (prerequisiteFindings.length) {
      addUniqueClue(clues.hidden, 'likely depends on prior state transition not clearly modeled');
    }
    if (/(follow[-\s]?up|next[-\s]?step|tracking|identifier)/i.test(messages) && !isLast) {
      addUniqueClue(clues.hidden, 'suggests dependency on data not clearly surfaced in response fields');
    }

    return clues;
  }

  function collectTrapGuidance(endpoint, findings, clues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast) {
    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    var nextPath = ((nextEndpoint && nextEndpoint.path) || '').toLowerCase();
    var role = (roleLabel || '').toLowerCase();
    var messages = (findings || []).map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');
    var cluesText = ((clues && clues.prereq) || []).concat((clues && clues.establish) || [], (clues && clues.nextNeeds) || [], (clues && clues.hidden) || []).join(' | ').toLowerCase();
    var traps = [];

    function addTrap(id, title, happened, whyMissed, next) {
      if (traps.some(function (t) { return t.id === id; })) return;
      traps.push({ id: id, title: title, happened: happened, whyMissed: whyMissed, next: next });
    }

    var loginOrRegister = /login|register|auth|session/.test(path);
    var hasTokenContextSignals = /(token|context|authorization|bearer|auth)/.test(messages + ' | ' + cluesText);
    var hasAccessKeySignals = /(sw-access-key|access\s*key|api[-\s]?key)/.test(messages + ' | ' + cluesText);
    var hasLinkageSignals = (linkageFindings || []).length > 0 || /(next[-\s]?step|follow[-\s]?up|tracking|identifier|handoff)/.test(messages + ' | ' + cluesText);
    var hasPrereqSignals = (prerequisiteFindings || []).length > 0 || ((clues && clues.prereq) || []).length > 0;
    var hasShapeOutcomeSignals = (findings || []).some(function (f) {
      var code = f.code || '';
      return code === 'contract-shape-workflow-guidance-burden'
        || code === 'snapshot-heavy-response'
        || code === 'incidental-internal-field-exposure'
        || code === 'duplicated-state-response';
    });

    if (loginOrRegister && hasTokenContextSignals) {
      addTrap(
        'context-token-replacement-after-login-register',
        'Context token replacement after login/register',
        'This step can replace the active context/auth token.',
        'Contract responses often do not clearly mark prior context as stale.',
        'Treat previous token/context as invalid and persist the new token before downstream calls.'
      );
    }

    if (/(cart)/.test(path + ' ' + nextPath) && hasTokenContextSignals) {
      addTrap(
        'cart-loss-after-context-change',
        'Cart loss after context change',
        'Changing context can detach or invalidate the active cart reference.',
        'Cart continuity is usually implicit, not modeled as an explicit invalidation rule.',
        'Reload cart identity after context change, then continue checkout/update calls.'
      );
    }

    if (/(store-api|store api|session|ephemeral)/.test(path + ' ' + messages + ' ' + cluesText) && hasTokenContextSignals) {
      addTrap(
        'ephemeral-store-api-context',
        'Ephemeral Store API context',
        'Store API context appears ephemeral across requests.',
        'TTL/replacement behavior is commonly omitted from explicit contract fields.',
        'Read context token freshness per step and add retry/recovery for expired context.'
      );
    }

    if (hasAccessKeySignals && hasTokenContextSignals) {
      addTrap(
        'sw-access-key-vs-auth-token-confusion',
        'sw-access-key vs auth token confusion',
        'Both sw-access-key and auth/context token requirements appear in this flow.',
        'Contract text can blur static key responsibilities vs per-session token handoff.',
        'Document precedence and send each credential explicitly where required; fail fast on mismatch.'
      );
    }

    if (hasPrereqSignals) {
      addTrap(
        'hidden-prerequisites-before-step-valid',
        'Hidden prerequisites before a step is valid',
        'This step appears to require hidden prerequisite state before it is valid.',
        'Required prior state/identifier is implied rather than explicitly modeled.',
        'Surface prerequisite state in previous responses or add explicit precondition fields.'
      );
    }

    if (hasPrereqSignals || hasLinkageSignals) {
      addTrap(
        'runtime-taught-rule-contract-did-not',
        'Runtime taught me the rule, contract did not',
        'A behavioral rule is likely learned only at runtime, not from contract shape.',
        'The schema does not provide enough explicit guardrails to predict the failure upfront.',
        'Add explicit outcome/status/constraint fields so clients can validate before the next call.'
      );
    }

    if (hasLinkageSignals || isLast) {
      addTrap(
        'weak-or-absent-next-step-modeling',
        'Weak or absent next-step modeling',
        'Next-step modeling is weak or absent for this response.',
        'There is no single explicit next-action/handoff field to follow safely.',
        'Return nextAction plus required identifier/link in the response contract.'
      );
    }

    if (hasShapeOutcomeSignals || /internal|snapshot|storage|model structure/.test(messages)) {
      addTrap(
        'backend-internal-state-exposed-not-workflow-outcomes',
        'Backend internal state exposed instead of workflow outcomes',
        'Response emphasizes backend internal/storage state over workflow outcome.',
        'Large snapshots look informative but hide completion meaning and next action.',
        'Return compact outcome, authoritative state, and next action near top-level fields.'
      );
    }

    return traps;
  }

  function renderTrapGuidanceList(traps, options) {
    var opts = options || {};
    var list = (traps || []).slice(0, opts.limit || 3);
    if (!list.length) return '';
    var title = opts.title || 'Trap guidance';
    var cls = opts.className || 'trap-guidance';
    return '<section class="' + cls + '">'
      + '<p class="insight-kicker">' + escapeHtml(title) + '</p>'
      + '<ul class="trap-guidance-list">'
      + list.map(function (trap) {
          return '<li class="trap-guidance-item">'
            + '<p><strong>Trap:</strong> ' + escapeHtml(trap.title || trap.id) + '</p>'
            + '<p><strong>What happened:</strong> ' + escapeHtml(trap.happened) + '</p>'
            + '<p><strong>Easy to miss:</strong> ' + escapeHtml(trap.whyMissed) + '</p>'
            + '<p><strong>Do next:</strong> ' + escapeHtml(trap.next) + '</p>'
            + '</li>';
        }).join('')
      + '</ul>'
      + '</section>';
  }

  function summarizeWorkflowStepNarrative(endpoint, roleLabel, nextEndpoint, clues, findings, linkageFindings, prerequisiteFindings, isLast) {
    var path = (endpoint.path || '').toLowerCase();
    var method = (endpoint.method || '').toUpperCase();
    var role = (roleLabel || '').toLowerCase();
    var nextPath = nextEndpoint ? ((nextEndpoint.path || '').toLowerCase()) : '';
    var messages = (findings || []).map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');

    var callDoes = endpointIntentCue(method, endpoint.path || '');
    if (role) {
      callDoes = humanizeStepRole(role) + ' (' + callDoes + ')';
    }

    var changed = '';
    if ((clues.establish || []).length) {
      changed = clues.establish[0];
    } else if (method === 'POST') {
      changed = 'likely creates new workflow state';
    } else if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      changed = 'likely mutates existing workflow state';
    } else {
      changed = 'returns current state for downstream steps';
    }

    var authoritative = '';
    if (/(token|context|authorization|header|access\s*key|api[-\s]?key)/i.test(messages)) {
      authoritative = 'auth/context token in response or headers';
    } else if (/(identifier|id|tracking)/i.test(messages) || /(\{[^}]+\})/.test(endpoint.path || '')) {
      authoritative = 'resource identifier for the next step';
    } else if (/cart|order|customer/.test(path)) {
      authoritative = 'updated ' + (path.indexOf('cart') !== -1 ? 'cart' : (path.indexOf('order') !== -1 ? 'order' : 'customer')) + ' state';
    } else {
      authoritative = 'response state needed by subsequent calls';
    }

    var nextAction = '';
    if (isLast) {
      nextAction = 'confirm outcome or poll if asynchronous';
    } else if (nextEndpoint) {
      nextAction = endpointIntentCue(nextEndpoint.method || '', nextEndpoint.path || '') + ' via ' + (nextEndpoint.method || '') + ' ' + (nextEndpoint.path || '');
      if ((clues.nextNeeds || []).length) {
        nextAction += ' (needs: ' + clues.nextNeeds[0] + ')';
      }
    } else {
      nextAction = 'follow-up step not inferred';
    }

    var traps = [];
    if ((/login|register|auth|session/.test(path)) && /(token|context|authorization|header|access\s*key|api[-\s]?key)/i.test(messages)) {
      traps.push('token/context replacement after login/register');
    }
    if (/cart/.test(path + ' ' + nextPath) && /(token|context|customer|auth)/i.test(messages + ' | ' + (clues.hidden || []).join(' | '))) {
      traps.push('cart invalidation after context change');
    }
    if (prerequisiteFindings.length || (clues.prereq || []).length) {
      traps.push('hidden prerequisites');
    }
    if ((/payment|checkout/.test(path) || role === 'payment' || role === 'checkout') && (isLast || linkageFindings.length || /(next[-\s]?step|follow[-\s]?up)/i.test(messages))) {
      traps.push('ambiguous payment next steps');
    }
    if (linkageFindings.length || /(identifier|tracking|handoff)/i.test(messages)) {
      traps.push('weak handoff identifiers');
    }
    if ((findings || []).some(function (f) {
      return f.code === 'contract-shape-workflow-guidance-burden' || f.code === 'snapshot-heavy-response';
    })) {
      traps.push('snapshot-heavy responses instead of task-shaped outcomes');
    }

    return {
      callDoes: callDoes,
      changed: changed,
      authoritative: authoritative,
      nextAction: nextAction,
      traps: uniq(traps)
    };
  }

  function renderWorkflowStep(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel) {
    var detail = state.payload.endpointDetails[endpointId];
    if (!detail) return '';

    var endpoint = detail.endpoint;
    var findings = detail.findings || [];
    var nextDetail = nextEndpointId ? state.payload.endpointDetails[nextEndpointId] : null;
    var nextEndpoint = nextDetail ? nextDetail.endpoint : null;

    var shapeFindings = findings.filter(function (f) {
      return f.code === 'contract-shape-workflow-guidance-burden';
    });

    var linkageFindings = findings.filter(function (f) {
      return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
    });

    var prerequisiteFindings = findings.filter(function (f) {
      return f.code === 'prerequisite-task-burden';
    });

    var isLast = stepIndex === (totalSteps - 1);

    var warnings = [];
    if (shapeFindings.length) warnings.push({ type: 'shape', count: shapeFindings.length, label: 'storage-shaped response' });
    if (linkageFindings.length) warnings.push({ type: 'linkage', count: linkageFindings.length, label: 'missing follow-up ID' });
    if (prerequisiteFindings.length) warnings.push({ type: 'prerequisite', count: prerequisiteFindings.length, label: 'hidden dependency' });

    var continuityBurden = '';
    if (isLast && linkageFindings.length) {
      continuityBurden = '<p class="workflow-burden-note"><strong>Workflow ends weakly:</strong> The response does not clearly expose the outcome or required next-step identifier. Clients may need manual confirmation or polling.</p>';
    } else if (!isLast && linkageFindings.length) {
      continuityBurden = '<p class="workflow-burden-note"><strong>Continuity burden:</strong> This step does not clearly expose the identifier or state needed for the next step. Clients must track or fetch separately.</p>';
    }

    var warningBadges = warnings.map(function (warning) {
      return '<span class="workflow-warning-badge workflow-warning-' + warning.type + '">'
        + '<strong>' + warning.count + '</strong> ' + warning.label
        + '</span>';
    }).join('');

    var dependencyClues = buildWorkflowDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
    var dependencyHtml = renderWorkflowDependencyClues(dependencyClues);

    var roleSlug = roleLabel ? roleLabel.toLowerCase().replace(/[^a-z]/g, '') : '';
    var humanRole = roleLabel ? humanizeStepRole(roleLabel) : '';
    var roleHtml = humanRole
      ? '<span class="step-role-pill step-role-' + escapeHtml(roleSlug) + '">' + escapeHtml(humanRole) + '</span>'
      : '<span class="step-number">Step ' + (stepIndex + 1) + ' of ' + totalSteps + '</span>';

    var transitionCue = inferWorkflowTransitionCue(dependencyClues, roleLabel);
    var narrative = summarizeWorkflowStepNarrative(endpoint, roleLabel, nextEndpoint, dependencyClues, findings, linkageFindings, prerequisiteFindings, isLast);
    var trapGuidance = collectTrapGuidance(endpoint, findings, dependencyClues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
    var narrativeHtml = '<div class="step-narrative">'
      + '<div class="step-narrative-row"><span class="step-narrative-label">Call does</span><span class="step-narrative-value">' + escapeHtml(narrative.callDoes) + '</span></div>'
      + '<div class="step-narrative-row"><span class="step-narrative-label">What changed</span><span class="step-narrative-value">' + escapeHtml(narrative.changed) + '</span></div>'
      + '<div class="step-narrative-row"><span class="step-narrative-label">Authoritative now</span><span class="step-narrative-value">' + escapeHtml(narrative.authoritative) + '</span></div>'
      + '<div class="step-narrative-row"><span class="step-narrative-label">Next valid action</span><span class="step-narrative-value">' + escapeHtml(narrative.nextAction) + '</span></div>'
      + '</div>';
    var trapHtml = renderTrapGuidanceList(trapGuidance, {
      title: 'Trap guidance',
      className: 'step-trap-guidance',
      limit: 2
    });
    var arrow = '';
    if (!isLast) {
      var connectorClass = transitionCue ? (' workflow-connector-' + transitionCue.kind) : '';
      var arrowClass = transitionCue && transitionCue.kind === 'weak' ? ' workflow-arrow-weak' : '';
      var cueHtml = transitionCue
        ? '<span class="workflow-transition-chip workflow-transition-' + transitionCue.kind + '">' + escapeHtml(transitionCue.label) + '</span>'
        : '';
      arrow = '<div class="workflow-connector' + connectorClass + '">'
        + '<div class="workflow-arrow' + arrowClass + '">\u2192</div>'
        + cueHtml
        + '</div>';
    }

    return '<div class="workflow-step" data-step-id="' + escapeHtml(endpointId) + '">'
      + '<div class="step-box">'
      + roleHtml
      + '<div class="step-endpoint">'
      + '<strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
      + '</div>'
      + narrativeHtml
      + (dependencyHtml || '')
      + trapHtml
      + (warningBadges ? '<div class="step-warnings">' + warningBadges + '</div>' : '')
      + (continuityBurden || '')
      + '<div class="step-actions">'
      + '<button type="button" class="secondary-action step-open-evidence" data-step-open-evidence="' + escapeHtml(endpointId) + '">Open endpoint evidence</button>'
      + '</div>'
      + '<span class="step-inspect-hint">\u2197 inspect detail: exact issue text</span>'
      + '</div>'
      + arrow
      + '</div>';
  }

  var BURDEN_DIM_CHIP = {
    'workflow outcome weakness': 'missing next action',
    'hidden dependency / linkage burden': 'hidden dependency',
    'shape / storage-style response weakness': 'storage-shaped response',
    'shape / nesting complexity': 'deep nesting',
    'internal/incidental fields': 'incidental fields',
    'typing/enum weakness': 'weak typing',
    'consistency drift': 'path/param drift',
    'change-risk clues': 'change risk'
  };

  // Short human-readable summaries for each spec-rule ID.
  // Used in the aggregate table and as the group title in the detail pane.
  var SPEC_RULE_SUMMARY = {
    'OAS-RESPONSE-DESCRIPTION-REQUIRED': 'Response Object is missing the required "description" field',
    'OAS-OPERATION-ID-UNIQUE':           'operationId must be unique across all operations',
    'OAS-NO-SUCCESS-RESPONSE':           'Operation should define at least one 2xx success response',
    'OAS-GET-REQUEST-BODY':              'GET/HEAD operations should not define a request body',
    'OAS-204-HAS-CONTENT':               '204 No Content response should not define a response body'
  };

  // Build a priority-sorted array of rule groups from the visible endpoint rows.
  // Returns objects: { ruleId, normativeLevel, specSource, severity, occurrences, endpointCount, summary }
  function aggregateSpecRuleFindings(rows) {
    var totalEndpoints = rows.length;
    var byRule = {};
    rows.forEach(function (row) {
      var detail = state.payload.endpointDetails[row.id];
      if (!detail) return;
      (detail.findings || []).forEach(function (finding) {
        if (finding.evidenceType !== 'spec-rule') return;
        var ruleId = finding.specRuleId || finding.code;
        if (!byRule[ruleId]) {
          byRule[ruleId] = {
            ruleId: ruleId,
            normativeLevel: finding.normativeLevel || '',
            specSource: finding.specSource || '',
            severity: finding.severity || 'info',
            occurrences: 0,
            endpointCount: 0,
            _seen: {},
            summary: SPEC_RULE_SUMMARY[ruleId] || ruleId.replace(/^OAS-/, '').replace(/-/g, ' ').toLowerCase()
          };
        }
        byRule[ruleId].occurrences++;
        if (!byRule[ruleId]._seen[row.id]) {
          byRule[ruleId]._seen[row.id] = true;
          byRule[ruleId].endpointCount++;
        }
      });
    });
    // API-wide threshold: >= 80% of the visible endpoints affected by this rule.
    var API_WIDE_THRESHOLD = 0.8;
    // Priority: REQUIRED/MUST first, then SHOULD/RECOMMENDED; within level sort by endpoint breadth.
    var normPriority = { 'REQUIRED': 0, 'MUST': 0, 'MUST NOT': 0, 'SHOULD NOT': 1, 'SHOULD': 1, 'RECOMMENDED': 2 };
    return Object.keys(byRule).map(function (k) {
      var rule = byRule[k];
      rule.isApiWide = totalEndpoints > 0 && (rule.endpointCount / totalEndpoints) >= API_WIDE_THRESHOLD;
      return rule;
    }).sort(function (a, b) {
      var aP = normPriority[a.normativeLevel] !== undefined ? normPriority[a.normativeLevel] : 3;
      var bP = normPriority[b.normativeLevel] !== undefined ? normPriority[b.normativeLevel] : 3;
      if (aP !== bP) return aP - bP;
      if (b.endpointCount !== a.endpointCount) return b.endpointCount - a.endpointCount;
      return b.occurrences - a.occurrences;
    });
  }

  // Render a compact priority-sorted table of spec-rule groups.
  // API-wide patterns (>= 80% of visible endpoints) are separated into a
  // distinct sub-table above concentrated/localized rules.
  function renderSpecRuleAggregate(ruleGroups) {
    if (!ruleGroups.length) {
      return '<p class="subtle">No spec-rule findings are visible in the current view.</p>';
    }
    var apiWide = ruleGroups.filter(function (r) { return r.isApiWide; });
    var localized = ruleGroups.filter(function (r) { return !r.isApiWide; });

    function buildTableRows(rules) {
      return rules.map(function (rule) {
        var levelClass = (rule.normativeLevel === 'REQUIRED' || rule.normativeLevel === 'MUST' || rule.normativeLevel === 'MUST NOT')
          ? 'spec-level-must' : 'spec-level-should';
        var endpointNote = rule.endpointCount === 1 ? '1 endpoint' : rule.endpointCount + ' endpoints';
        return '<tr class="spec-agg-row">'
          + '<td class="spec-agg-id"><code>' + escapeHtml(rule.ruleId) + '</code><div class="spec-agg-summary">' + escapeHtml(rule.summary) + '</div></td>'
          + '<td class="spec-agg-level"><span class="spec-norm-badge ' + levelClass + '">' + escapeHtml(rule.normativeLevel) + '</span></td>'
          + '<td class="spec-agg-count">' + rule.occurrences + '</td>'
          + '<td class="spec-agg-scope">' + escapeHtml(endpointNote) + '</td>'
          + '</tr>';
      }).join('');
    }

    var html = '<div class="spec-rule-aggregate">';

    if (apiWide.length) {
      html += '<div class="spec-agg-section spec-agg-apiwide">'
        + '<p class="spec-agg-section-label">'
        + '\u26a0\ufe0f Widespread patterns \u2014 affects \u226580\u0025 of visible endpoints. '
        + 'These reflect a consistent gap across the whole API, not a local hotspot.'
        + '</p>'
        + '<table class="spec-agg-table"><thead><tr>'
        + '<th>Rule ID &amp; summary</th><th>Level</th><th>Count</th><th>Scope</th>'
        + '</tr></thead><tbody>' + buildTableRows(apiWide) + '</tbody></table>'
        + '</div>';
    }

    if (localized.length) {
      html += '<div class="spec-agg-section">'
        + (apiWide.length
            ? '<p class="spec-agg-section-label">Concentrated issues \u2014 affects a smaller share of endpoints. Easier to fix endpoint\u2011by\u2011endpoint.</p>'
            : '<p class="spec-agg-label">Sorted by normative level, then breadth of impact. Click an endpoint row to inspect instances.</p>')
        + '<table class="spec-agg-table"><thead><tr>'
        + '<th>Rule ID &amp; summary</th><th>Level</th><th>Count</th><th>Scope</th>'
        + '</tr></thead><tbody>' + buildTableRows(localized) + '</tbody></table>'
        + '</div>';
    }

    html += '<p class="spec-agg-footer">Click any endpoint row to see its exact instances with normative grounding.</p>';
    html += '</div>';
    return html;
  }

  function familyBurdenWhyText(family) {
    var burden = state.filters.burden;
    var topSignals = topFamilyBurdenSignals(family, burden, 2);
    if (burden === 'workflow-burden') {
      var dominant = topSignals[0] || '';
      var secondary = topSignals[1] ? ' Also: ' + humanizeSignalLabel(topSignals[1]) + '.' : '';
      var workflowSentences = {
        'hidden token/context handoff appears likely': 'Hidden token/context requirements across call chain.',
        'next step not clearly exposed': 'Next-step requirements or identifiers not clearly exposed.',
        'sequencing appears brittle': 'Call sequence depends on tracking implicit prior state.',
        'auth/header burden spread across steps': 'Auth/header context spread unevenly across steps.'
      };
      var lead = workflowSentences[dominant] || 'Potential workflow sequencing or follow-up linkage issues.';
      return lead + secondary;
    }
    if (burden === 'contract-shape') {
      var dominant = topSignals[0] || '';
      var secondary = topSignals[1] ? ' Also: ' + humanizeSignalLabel(topSignals[1]) + '.' : '';
      var shapeSentences = {
        'response appears snapshot-heavy': 'Snapshot-heavy payload hides the golden-path outcome under backend graph detail.',
        'deep nesting appears likely': 'Deeply nested objects hide the primary outcome and next-action meaning.',
        'duplicated state appears likely': 'Repeated state creates reading noise and weakens source-of-truth clarity.',
        'incidental/internal fields appear to dominate': 'Internal/audit fields crowd the response and distract from task completion.',
        'source-of-truth fields are unclear': 'Multiple state representations make the authoritative source-of-truth unclear.',
        'outcome framing is easy to miss': 'Outcome framing is weak, so callers cannot confirm what changed quickly.',
        'next action is weakly exposed': 'Next valid action is weakly exposed in the response contract.'
      };
      var lead = shapeSentences[dominant] || 'Response schema appears storage-shaped rather than task-oriented.';
      return lead + secondary;
    }
    if (burden === 'consistency') {
      var dominant = topSignals[0] || '';
      var secondary = topSignals[1] ? ' Also: ' + humanizeSignalLabel(topSignals[1]) + '.' : '';
      var consistencySentences = {
        'parameter naming drift appears likely': 'Similar routes use different parameter names for the same idea.',
        'path style drift appears likely': 'Similar routes use different path patterns for similar actions.',
        'outcome modeled differently across similar endpoints': 'Similar actions describe the result differently.',
        'response shape drift appears likely': 'Similar endpoints return different response shapes.'
      };
      var lead = consistencySentences[dominant] || 'Similar operations drift in names, paths, or response shape.';
      return lead + secondary;
    }
    var allDimensions = (family.topDimensions || []).slice(0, 2);
    if (allDimensions.length) {
      return 'Shows ' + allDimensions.join(' and ') + '.';
    }
    return 'Family across ' + family.endpoints + ' endpoint' + (family.endpoints === 1 ? '' : 's') + '.';
  }

  function bumpFamilySignal(map, label) {
    map[label] = (map[label] || 0) + 1;
  }

  function sortedSignalLabels(map, limit) {
    return Object.keys(map || {})
      .map(function (label) { return { label: label, count: map[label] || 0 }; })
      .sort(function (a, b) {
        if (a.count !== b.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, limit || 3)
      .map(function (entry) { return entry.label; });
  }

  function topFamilyBurdenSignals(family, burden, limit) {
    if (!family) return [];
    if (burden === 'workflow-burden') return sortedSignalLabels(family.workflowSignalCounts || {}, limit || 3);
    if (burden === 'contract-shape') return sortedSignalLabels(family.shapeSignalCounts || {}, limit || 3);
    if (burden === 'consistency') return sortedSignalLabels(family.consistencySignalCounts || {}, limit || 3);
    return [];
  }

  function familyRowsInView(familyName) {
    var key = familyName || 'unlabeled family';
    var rows = filteredRows().filter(function (row) {
      return (row.family || 'unlabeled family') === key && row.findings > 0;
    });
    if (rows.length) return rows;

    return scopedRows(state.payload.endpoints || []).filter(function (row) {
      return (row.family || 'unlabeled family') === key && row.findings > 0;
    });
  }

  function pickFamilyLeadRow(rows) {
    if (!rows || !rows.length) return null;
    var selected = rows.find(function (row) { return row.id === state.selectedEndpointId; });
    if (selected) return selected;
    return rows.slice().sort(function (a, b) {
      if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
      if (a.findings !== b.findings) return b.findings - a.findings;
      return (a.path || '').localeCompare(b.path || '');
    })[0] || null;
  }

  function collectCompactWorkflowContext(relatedChains, endpointId, endpointDetails) {
    if (!relatedChains || !relatedChains.length) return [];
    var lines = [];

    relatedChains.slice(0, 2).forEach(function (chain) {
      var stepIndex = (chain.endpointIds || []).indexOf(endpointId);
      if (stepIndex < 0) return;
      var parts = [];
      var totalSteps = (chain.endpointIds || []).length;
      var kind = chain.kind ? chain.kind.replaceAll('-', ' → ') : 'workflow';
      parts.push('Step ' + (stepIndex + 1) + ' of ' + totalSteps + ' in ' + kind + '.');

      if (stepIndex > 0) {
        var prevDetail = endpointDetails[chain.endpointIds[stepIndex - 1]];
        if (prevDetail && prevDetail.endpoint) {
          parts.push('Comes from ' + prevDetail.endpoint.method + ' ' + prevDetail.endpoint.path + '.');
        }
      }
      if (stepIndex < totalSteps - 1) {
        var nextDetail = endpointDetails[chain.endpointIds[stepIndex + 1]];
        if (nextDetail && nextDetail.endpoint) {
          parts.push('Leads to ' + nextDetail.endpoint.method + ' ' + nextDetail.endpoint.path + '.');
        }
      }

      lines.push(parts.join(' '));
    });

    return lines;
  }

  function familyInsightModel(familyName) {
    var rows = familyRowsInView(familyName);
    var leadRow = pickFamilyLeadRow(rows);
    if (!leadRow) return null;

    var detail = state.payload.endpointDetails[leadRow.id] || { findings: [], endpoint: leadRow };
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var topContext = topGroup ? topGroup.context : null;
    var points = hasWorkflowShapedExampleSignals(findings)
      ? collectWorkflowShapedExamplePoints(detail.endpoint || leadRow, findings)
      : { current: [], cleaner: [], evidence: [] };

    return {
      leadRow: leadRow,
      detail: detail,
      groups: groups,
      topGroup: topGroup,
      topContext: topContext,
      points: points,
      workflowLines: collectCompactWorkflowContext(detail.relatedChains || [], leadRow.id, state.payload.endpointDetails)
    };
  }

  function renderFamilyInsightPanel(family) {
    var model = familyInsightModel(family.family || 'unlabeled family');
    if (!model) {
      return '<div class="family-insight-panel">'
        + '<p class="subtle">No evidence-bearing endpoint is currently available for this family in the current view.</p>'
        + '</div>';
    }

    var lead = model.topGroup;
    var leadEndpoint = model.detail && model.detail.endpoint ? model.detail.endpoint : model.leadRow;
    var leadFindings = (model.detail && model.detail.findings) ? model.detail.findings : [];
    var workflowTrapGuidance = collectTrapGuidance(leadEndpoint, leadFindings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false);
    var workflowTrapCard = workflowTrapGuidance.length
      ? '<div class="family-insight-card">' + renderTrapGuidanceList(workflowTrapGuidance, { title: 'Trap guidance for this endpoint', className: 'card-trap-guidance', limit: 2 }) + '</div>'
      : '';

    var cleanerHtml = (model.points.current.length || model.points.cleaner.length)
      ? '<div class="family-insight-card">'
        + '<p class="insight-kicker">Current vs improved contract shape (illustrative)</p>'
        + '<div class="family-cleaner-grid">'
        + '<div><strong>Current storage-shaped response</strong><ul>' + (model.points.current.length ? model.points.current.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') : '<li>Current response shape is mixed and outcome-first intent is weak.</li>') + '</ul></div>'
        + '<div><strong>Improved task-shaped response</strong><ul>' + (model.points.cleaner.length ? model.points.cleaner.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') : '<li>Prioritize outcome, next action, and authoritative state first.</li>') + '</ul></div>'
        + '</div>'
        + '</div>'
      : '';

    var topEvidence = model.groups.slice(0, 2);
    var evidenceHtml = '<div class="family-insight-card">'
      + '<p class="insight-kicker">Top evidence</p>'
      + '<ul class="family-top-evidence">'
      + (topEvidence.length
          ? topEvidence.map(function (group) {
              return '<li><strong>' + escapeHtml(group.title) + '</strong> <span class="subtle">(' + group.count + ')</span></li>';
            }).join('')
          : '<li class="subtle">No grouped issue evidence found for this endpoint.</li>')
      + '</ul>'
      + '</div>';

    var workflowHtml = model.workflowLines.length
      ? '<div class="family-insight-card">'
        + '<p class="insight-kicker">Workflow context</p>'
        + '<ul class="family-workflow-context">'
        + model.workflowLines.map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('')
        + '</ul>'
        + '</div>'
      : '';

    var workflowTabActive = state.activeTopTab === 'workflow';

    var leadHtml = '';
    if (workflowTabActive) {
      leadHtml = '<div class="family-insight-card">'
        + '<p class="insight-kicker">What this expansion adds</p>'
        + '<p class="subtle">Endpoint-level preview for this family. Use this panel for scoped grouped evidence/context previews, then jump to Endpoint diagnostics for continuity diagnosis and exact grouped text.</p>'
        + '<details class="detail-evidence-drawer">'
        + '<summary>Open exact lead issue text</summary>'
        + (lead
            ? '<p class="family-insight-lead-message">' + escapeHtml(lead.messages[0] || 'No issue message extracted.') + '</p>'
              + '<div class="family-insight-grounding">'
              + renderOpenAPIContextPills(model.topContext || {}, true)
              + (lead.isSpecRule ? renderSpecRuleGroundingForGroup(lead) : '')
              + '</div>'
            : '<p class="subtle">No direct issue text is available for this endpoint.</p>')
        + '</details>'
        + '</div>';
    } else {
      leadHtml = lead
        ? '<div class="family-insight-card">'
          + '<p class="insight-kicker">Lead issue</p>'
          + '<p class="family-insight-lead-message">' + escapeHtml(lead.messages[0] || 'No issue message extracted.') + '</p>'
          + '<div class="family-insight-grounding">'
          + renderOpenAPIContextPills(model.topContext || {}, true)
          + (lead.isSpecRule ? renderSpecRuleGroundingForGroup(lead) : '')
          + '</div>'
          + '</div>'
        : '<div class="family-insight-card"><p class="insight-kicker">Lead issue</p><p class="subtle">No direct issue text is available for this endpoint.</p></div>';
    }

    var compactWorkflowDetailHtml = '';
    if (workflowTabActive) {
      var detailSections = [];
      detailSections.push('<details class="detail-evidence-drawer">'
        + '<summary>Open family-level grouped evidence preview</summary>'
        + evidenceHtml
        + '</details>');
      if (workflowHtml) {
        detailSections.push('<details class="detail-evidence-drawer">'
          + '<summary>Open family-level workflow context preview</summary>'
          + workflowHtml
          + '</details>');
      }
      if (workflowTrapCard) {
        detailSections.push(workflowTrapCard);
      }
      detailSections.push('<p class="subtle">Workflow continuity diagnosis and exact grouped text live in Endpoint diagnostics and the evidence list below.</p>');
      compactWorkflowDetailHtml = detailSections.join('');
    }

    var insightEndpointLabel = model.leadRow.method + ' ' + model.leadRow.path;
    var insightHeadHtml = (state.activeTopTab === 'spec-rule' || workflowTabActive)
      ? '<strong>' + escapeHtml(insightEndpointLabel + ' | Insight endpoint') + '</strong>'
      : '<strong>' + escapeHtml(insightEndpointLabel) + '</strong><span class="subtle">Insight endpoint</span>';
    var closeActionHtml = workflowTabActive
      ? '<button type="button" class="secondary-action" data-insight-close="true">Close insight</button>'
      : '';

    return '<div class="family-insight-panel">'
      + '<div class="family-insight-head">'
      + insightHeadHtml
      + '</div>'
      + leadHtml
      + (workflowTabActive ? compactWorkflowDetailHtml : (cleanerHtml + evidenceHtml + workflowHtml))
      + '<div class="family-insight-actions">'
      + closeActionHtml
      + '<button type="button" class="secondary-action" data-open-evidence-id="' + escapeHtml(model.leadRow.id) + '">Open full exact evidence</button>'
      + '<button type="button" class="secondary-action" data-focus-family="' + escapeHtml(family.family) + '">Focus family in endpoint list</button>'
      + '</div>'
      + '</div>';
  }

  function renderFamilyCard(family) {
    var activeBurden = state.filters.burden;
    var whyText = familyBurdenWhyText(family);
    var familyName = family.family || 'unlabeled family';
    var expanded = state.expandedFamily === familyName;
    var workflowFamilyActiveClass = (state.activeTopTab === 'workflow' && expanded) ? ' family-card-workflow-active' : '';

    var chipItems;
    if (activeBurden !== 'all') {
      chipItems = topFamilyBurdenSignals(family, activeBurden, 2);
      if (!chipItems.length) {
        if (activeBurden === 'workflow-burden') chipItems = ['missing next action'];
        else if (activeBurden === 'contract-shape') chipItems = ['storage-shaped response'];
        else chipItems = ['path/param drift'];
      }
    } else {
      chipItems = (family.topDimensions || []).slice(0, 2);
    }
    var chipsHtml = (activeBurden === 'contract-shape' || activeBurden === 'consistency')
      ? chipItems.map(function (c, i) {
          var cls = i === 0 ? 'chip chip-primary' : 'chip chip-secondary';
          return '<span class="' + cls + '">' + escapeHtml(humanizeSignalLabel(c)) + '</span>';
        }).join('')
      : chipItems.map(function (c) { return '<span class="chip">' + escapeHtml(c) + '</span>'; }).join('');

    var priorityHint = '';
    var high = family.priorityCounts.high || 0;
    var medium = family.priorityCounts.medium || 0;
    if (high > 0) {
      priorityHint = high + ' high priority';
    } else if (medium > 0) {
      priorityHint = medium + ' medium priority';
    }

    var insightHtml = expanded
      ? '<div class="family-card-insight" data-family-card-insight="' + escapeHtml(familyName) + '">' + renderFamilyInsightPanel(family) + '</div>'
      : '';

    return '<article class="family-card pressure-' + family.pressure + (expanded ? ' family-card-expanded' : '') + workflowFamilyActiveClass + '" data-family="' + escapeHtml(family.family) + '">'
      + '<div class="family-head">'
      + '<strong>' + escapeHtml(humanFamilyLabel(family.family)) + '</strong>'
      + pressureBadge(family.pressure, 'pressure')
      + '</div>'
      + '<p class="family-stat">' + family.findings + ' issue' + (family.findings === 1 ? '' : 's') + ' across ' + family.endpoints + ' endpoint' + (family.endpoints === 1 ? '' : 's') + (priorityHint ? ' — ' + priorityHint : '') + '</p>'
      + '<p class="family-burden-why">' + escapeHtml(whyText) + '</p>'
      + (chipsHtml ? '<div class="chips">' + chipsHtml + '</div>' : '')
      + '<div class="family-card-actions">'
      + '<button type="button" class="secondary-action" data-insight-toggle="' + escapeHtml(familyName) + '">' + (expanded ? 'Hide insight' : 'Show insight') + '</button>'
      + '</div>'
        + insightHtml
      + '</article>';
  }

  function buildFamilySurfaceContext(summaries) {
    var visibleFamilies = summaries.length;
    var lensActive = state.filters.search || state.filters.category !== 'all' || state.filters.burden !== 'all' || state.filters.familyPressure !== 'all';
    var allFamiliesInLens = familySummariesRaw();
    var totalInLens = allFamiliesInLens.length;

    // Spec total: all distinct family labels across every endpoint, no filters applied.
    var specTotal = new Set((state.payload.endpoints || []).map(function (r) {
      return r.family || 'unlabeled family';
    })).size;

    // Pressure-tier count: how many of the lens families belong to the selected tier.
    // When pressure = 'all', all lens families qualify.
    var familiesInPressureTier = state.filters.familyPressure === 'all'
      ? totalInLens
      : allFamiliesInLens.filter(function (family) { return family.pressure === state.filters.familyPressure; }).length;

    var showingTruncated = visibleFamilies < familiesInPressureTier;

    var tierLabel = state.filters.familyPressure === 'all' ? 'all tiers' : state.filters.familyPressure + ' tier';
    var topFamilyName = summaries.length ? (summaries[0].family || 'unlabeled family') : '';

    var copy = '<div class="context-block family-context-block">';
    copy += '<ul class="count-semantics">';
      + '<li><strong>Families in spec:</strong> ' + specTotal + ' (all distinct family labels, no filters)</li>'
      + '<li><strong>Matching search / category / burden:</strong> ' + totalInLens + ' (families with at least one endpoint carrying matching issues in the current view)</li>'
      + '<li><strong>In ' + tierLabel + ':</strong> ' + familiesInPressureTier + ' (of those ' + totalInLens + ')</li>'
      + '<li><strong>Cards shown:</strong> ' + visibleFamilies + (showingTruncated ? ' — top 24 of ' + familiesInPressureTier + ' (' + (familiesInPressureTier - visibleFamilies) + ' not shown)' : '') + '</li>'
      + '</ul>';
    copy += '<div class="context-actions">'
      + (topFamilyName
          ? '<button type="button" class="secondary-action" data-focus-top-family="' + escapeHtml(topFamilyName) + '">Focus top family</button>'
          : '')
      + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all matching families</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="clear-current-lens">Clear lens</button>'
      + '</div>'
      + '</div>';

    if (state.activeTopTab === 'shape') {
      var shapeTotals = collectShapeSignalTotals(summaries);
      copy += '<div class="context-block shape-lens-context">'
        + '<p><strong>Shape burden focus in this slice:</strong> ' + escapeHtml(shapeTotals.summary) + '</p>'
        + '<ul class="count-semantics">'
        + '<li><strong>Deep nesting:</strong> ' + shapeTotals.deep + '</li>'
        + '<li><strong>Internal/incidental fields:</strong> ' + shapeTotals.internal + '</li>'
        + '<li><strong>Duplicated state:</strong> ' + shapeTotals.dup + '</li>'
        + '<li><strong>Snapshot-heavy responses:</strong> ' + shapeTotals.snapshot + '</li>'
        + '<li><strong>Unclear source-of-truth fields:</strong> ' + shapeTotals.source + '</li>'
        + '<li><strong>Missing outcome framing:</strong> ' + shapeTotals.outcome + '</li>'
        + '<li><strong>Missing next-actions:</strong> ' + shapeTotals.nextAction + '</li>'
        + '</ul>'
        + '</div>';
    }

    return copy;
  }

  function collectShapeSignalTotals(summaries) {
    var totals = {
      deep: 0,
      internal: 0,
      dup: 0,
      snapshot: 0,
      source: 0,
      outcome: 0,
      nextAction: 0
    };

    (summaries || []).forEach(function (family) {
      var map = family.shapeSignalCounts || {};
      totals.snapshot += map['response appears snapshot-heavy'] || 0;
      totals.deep += map['deep nesting appears likely'] || 0;
      totals.dup += map['duplicated state appears likely'] || 0;
      totals.internal += map['incidental/internal fields appear to dominate'] || 0;
      totals.source += map['source-of-truth fields are unclear'] || 0;
      totals.outcome += map['outcome framing is easy to miss'] || 0;
      totals.nextAction += map['next action is weakly exposed'] || 0;
    });

    var highlights = [];
    if (totals.snapshot > 0) highlights.push('snapshot-heavy');
    if (totals.deep > 0) highlights.push('deep nesting');
    if (totals.dup > 0) highlights.push('duplicated state');
    if (totals.internal > 0) highlights.push('internal fields');
    if (totals.source > 0) highlights.push('unclear source-of-truth');
    if (totals.outcome > 0) highlights.push('missing outcome framing');
    if (totals.nextAction > 0) highlights.push('missing next-action cues');

    return {
      deep: totals.deep,
      internal: totals.internal,
      dup: totals.dup,
      snapshot: totals.snapshot,
      source: totals.source,
      outcome: totals.outcome,
      nextAction: totals.nextAction,
      summary: highlights.length
        ? ('highest recurring shape signals: ' + highlights.join(', '))
        : 'no dominant shape signal extracted from current families'
    };
  }

  function familyScopeReason() {
    if (state.filters.search) {
      return 'The current search matches a specific family or endpoint pattern, so the family list is narrower.';
    }
    if (state.filters.category !== 'all' || state.filters.burden !== 'all') {
      return 'Category or burden filters removed families that do not carry matching issues.';
    }
    if (state.filters.familyPressure !== 'all') {
      return 'The family pressure filter is showing only families at the chosen urgency level.';
    }
    return 'No extra family narrowing is active; this is the broader matching family view.';
  }

  function familySummariesRaw() {
    var rows = scopedRows(state.payload.endpoints || []);
    var byFamily = {};

    rows.forEach(function (row) {
      var hasEvidence = row.findings > 0;
      if (!hasEvidence && !state.filters.includeNoIssueRows) return;

      var key = row.family || "unlabeled family";
      if (!byFamily[key]) {
        byFamily[key] = {
          family: key,
          findings: 0,
          endpoints: 0,
          priorityCounts: { high: 0, medium: 0, low: 0 },
          burdenCounts: {},
          dimensionCounts: {},
          workflowSignalCounts: {},
          shapeSignalCounts: {},
          consistencySignalCounts: {}
        };
      }

      var item = byFamily[key];
      item.findings += row.findings;
      item.endpoints += 1;
      item.priorityCounts[row.priority] = (item.priorityCounts[row.priority] || 0) + 1;

      (row.burdenFocuses || []).forEach(function (focus) {
        item.burdenCounts[focus] = (item.burdenCounts[focus] || 0) + (row.findings > 0 ? row.findings : 1);
      });

      var detail = state.payload.endpointDetails[row.id];
      if (detail && detail.findings) {
        detail.findings.forEach(function (finding) {
          var dimension = issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus);
          item.dimensionCounts[dimension] = (item.dimensionCounts[dimension] || 0) + 1;

          var code = finding.code || '';
          var msg = (finding.message || '').toLowerCase();

          // Do not let spec-rule findings contaminate heuristic burden signal counts.
          if (finding.evidenceType === 'spec-rule') return;

          if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || code === 'weak-outcome-next-action-guidance' || code === 'prerequisite-task-burden') {
            bumpFamilySignal(item.workflowSignalCounts, 'hidden token/context handoff appears likely');
          }
          if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || code === 'weak-outcome-next-action-guidance' || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
            bumpFamilySignal(item.workflowSignalCounts, 'next step not clearly exposed');
          }
          if (code === 'prerequisite-task-burden' || /prior state|earlier|sequence|brittle/.test(msg)) {
            bumpFamilySignal(item.workflowSignalCounts, 'sequencing appears brittle');
          }
          if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
            bumpFamilySignal(item.workflowSignalCounts, 'auth/header burden spread across steps');
          }

          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || /snapshot|storage|model structure/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'response appears snapshot-heavy');
          }
          if (code === 'deeply-nested-response-structure' || dimension === 'shape / nesting complexity' || /nested|deep/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'deep nesting appears likely');
          }
          if (code === 'duplicated-state-response' || /duplicate|duplicated/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'duplicated state appears likely');
          }
          if (code === 'incidental-internal-field-exposure' || dimension === 'internal/incidental fields' || /internal|incidental|audit|raw id/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'incidental/internal fields appear to dominate');
          }
          if (code === 'duplicated-state-response' || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'source-of-truth fields are unclear');
          }
          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || code === 'weak-outcome-next-action-guidance' || /outcome|what changed|result meaning/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'outcome framing is easy to miss');
          }
          if (code === 'weak-outcome-next-action-guidance' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
            bumpFamilySignal(item.shapeSignalCounts, 'next action is weakly exposed');
          }

          if (code === 'detail-path-parameter-name-drift') {
            bumpFamilySignal(item.consistencySignalCounts, 'parameter naming drift appears likely');
          }
          if (code === 'endpoint-path-style-drift' || code === 'sibling-path-shape-drift') {
            bumpFamilySignal(item.consistencySignalCounts, 'path style drift appears likely');
          }
          if (code === 'inconsistent-response-shape' || code === 'inconsistent-response-shape-family' || code === 'inconsistent-response-shapes' || code === 'inconsistent-response-shapes-family') {
            bumpFamilySignal(item.consistencySignalCounts, 'outcome modeled differently across similar endpoints');
            bumpFamilySignal(item.consistencySignalCounts, 'response shape drift appears likely');
          }
        });
      }
    });

    return Object.values(byFamily).map(function (family) {
      var dominantBurden = Object.entries(family.burdenCounts).sort(function (a, b) { return b[1] - a[1]; });
      var dimensions = Object.entries(family.dimensionCounts).sort(function (a, b) { return b[1] - a[1]; });
      family.pressure = familyPressureLabel(family.priorityCounts);
      family.dominantBurden = dominantBurden.length ? dominantBurden[0][0].replaceAll("-", " ") : "mixed";
      family.topDimensions = dimensions.slice(0, 3).map(function (entry) { return entry[0]; });
      return family;
    }).sort(function (a, b) {
      if (priorityRank(a.pressure) !== priorityRank(b.pressure)) return priorityRank(a.pressure) - priorityRank(b.pressure);
      if (a.findings !== b.findings) return b.findings - a.findings;
      return a.family.localeCompare(b.family);
    });
  }

  function familySummaries() {
    return familySummariesRaw().filter(function (family) {
      return state.filters.familyPressure === "all" || family.pressure === state.filters.familyPressure;
    }).slice(0, 24);
  }

  function familyPressureByFamily(rows) {
    var byFamily = {};
    rows.forEach(function (row) {
      var key = row.family || "unlabeled family";
      if (!byFamily[key]) byFamily[key] = { high: 0, medium: 0, low: 0 };
      byFamily[key][row.priority] = (byFamily[key][row.priority] || 0) + 1;
    });

    var output = {};
    Object.keys(byFamily).forEach(function (key) {
      output[key] = familyPressureLabel(byFamily[key]);
    });
    return output;
  }

  function workflowScopedRows() {
    var rows = scopedRows(state.payload.endpoints || []).filter(function (row) {
      return state.filters.includeNoIssueRows || row.findings > 0;
    });

    if (state.filters.familyPressure === 'all') return rows;

    var pressureMap = familyPressureByFamily(rows);
    return rows.filter(function (row) {
      var key = row.family || 'unlabeled family';
      return pressureMap[key] === state.filters.familyPressure;
    });
  }

  function renderEndpointRows() {
    var rows = filteredRows();
    var total = scopedRows(state.payload.endpoints || []).length;
    var listSection = el.endpointRows ? el.endpointRows.closest('.section') : null;

    if (listSection) {
      if (state.activeTopTab === 'workflow') {
        listSection.classList.add('endpoint-list-workflow-secondary');
        listSection.classList.remove('endpoint-list-shape-secondary');
      } else if (state.activeTopTab === 'shape') {
        listSection.classList.add('endpoint-list-shape-secondary');
        listSection.classList.remove('endpoint-list-workflow-secondary');
      } else {
        listSection.classList.remove('endpoint-list-workflow-secondary');
        listSection.classList.remove('endpoint-list-shape-secondary');
      }
    }

    el.listContext.innerHTML = buildListContext(rows.length, total);
    bindRecoveryButtons(el.listContext);

    if (!rows.length) {
      state.selectedEndpointId = "";
      el.endpointRows.innerHTML = '<tr><td colspan="3">'
        + '<div class="empty inline-empty">'
        + '<strong>No endpoints match this view.</strong>'
        + '<p class="subtle">No endpoints with matching issues are left after the current filters. Use the family no-match recovery above to reset this view.</p>'
        + '</div>'
        + '</td></tr>';
      return;
    }

    if (!rows.find(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(rows);
    }

    el.endpointRows.innerHTML = rows.map(function (row) {
      return renderEndpointRow(row);
    }).join("");

    function handleEndpointRowSelection(endpointId, options) {
      var opts = options || {};
      if (!endpointId) return;
      state.selectedEndpointId = endpointId;
      renderEndpointRows();
      renderEndpointDiagnostics();
      renderEndpointDetail();
      syncWorkflowStepSelectionHighlight();
      if (opts.showExactEvidence) {
        markExactEvidenceDestination();
      } else {
        markInteractionDestination(el.endpointDiagnosticsSection);
      }
      if (opts.skipScroll) return;
      if (state.activeTopTab === 'spec-rule') {
        scrollToEndpointDiagnosticsIfNeededForSpecRuleRows();
      } else if (state.activeTopTab === 'workflow') {
        scrollToEndpointDiagnosticsIfNeededForWorkflowRows();
      } else if (state.activeTopTab === 'shape') {
        scrollToEndpointDiagnosticsIfNeededForShapeRows();
      }
    }

    Array.prototype.forEach.call(el.endpointRows.querySelectorAll("tr[data-id]"), function (tr) {
      tr.addEventListener("click", function () {
        handleEndpointRowSelection(tr.getAttribute("data-id"));
      });
    });

    Array.prototype.forEach.call(el.endpointRows.querySelectorAll('.severity-badge'), function (badge) {
      badge.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var row = badge.closest('tr[data-id]');
        if (!row) return;
        handleEndpointRowSelection(row.getAttribute('data-id'), {
          skipScroll: state.activeTopTab === 'workflow' || state.activeTopTab === 'shape'
        });
      });
      badge.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        badge.click();
      });
    });

    Array.prototype.forEach.call(el.endpointRows.querySelectorAll('.row-next-step'), function (hint) {
      hint.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var row = hint.closest('tr[data-id]');
        if (!row) return;
        var endpointId = row.getAttribute('data-id');
        if (!endpointId) return;
        if (state.activeTopTab === 'workflow') {
          state.endpointDiagnosticsSubTab = 'exact';
          state.detailEvidenceOpenForId = endpointId;
          handleEndpointRowSelection(endpointId, { skipScroll: true, showExactEvidence: true });
          focusWorkflowExactEvidenceTarget();
          return;
        }
        if (state.activeTopTab === 'shape') {
          state.endpointDiagnosticsSubTab = 'exact';
          state.detailEvidenceOpenForId = endpointId;
          handleEndpointRowSelection(endpointId, { skipScroll: true, showExactEvidence: true });
          focusWorkflowExactEvidenceTarget();
          return;
        }
        handleEndpointRowSelection(endpointId);
      });
    });
  }

  function renderEndpointRow(row) {
    var detail = state.payload.endpointDetails[row.id] || { findings: [] };
    var lensFindings = findingsForActiveLens(detail.findings || []);
    var firstFinding = lensFindings[0] || null;
    var dominant = rowDominantIssue(row);
    var selected = row.id === state.selectedEndpointId ? "active" : "";
    var intent = endpointIntentCue(row.method, row.path);
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var severity = dominantSeverity(lensFindings);
    var firstContext = firstFinding ? extractOpenAPIContext(firstFinding) : null;
    var contextLine = firstContext ? renderOpenAPIContextPills(firstContext, true) : '<span class="context-inline subtle">OpenAPI location is not clear from the top message.</span>';

    return '<tr class="' + selected + ' row-pressure-' + row.priority + '" data-id="' + row.id + '">'
      + '<td>'
      + '<div class="endpoint-row-main">'
      + '<strong>' + escapeHtml(row.method + ' ' + row.path) + '</strong>'
      + '<div class="endpoint-row-meta">'
      + '<span class="intent-cue">' + escapeHtml(intent) + '</span>'
      + '<span class="subtle">' + escapeHtml(humanFamilyLabel(row.family)) + '</span>'
      + '</div>'
      + '</div>'
      + '</td>'
      + '<td>'
      + '<div class="row-cause">' + pressureBadge(row.priority, 'pressure') + '</div>'
      + '<div class="row-cause-label">' + escapeHtml(dominant.label) + '</div>'
      + '</td>'
      + '<td>'
      + (firstFinding ? severityBadge(severity) : '')
      + '<div class="message-line">' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '</div>'
      + '<div class="context-inline-wrap">' + contextLine + '</div>'
        + '<div class="row-next-step">' + escapeHtml(workflowTabActive
            ? 'Select row for endpoint-level workflow diagnostics'
            : (shapeTabActive
                ? 'Select row for endpoint-local shape evidence drill-down'
                : 'Select row to update Endpoint diagnostics')) + '</div>'
      + '</td>'
      + '</tr>';
  }

  function bumpCounter(map, key) {
    map[key] = (map[key] || 0) + 1;
  }

  function collectDynamicBurdenSignals(rows, burdenLens) {
    var counts = {};

    rows.forEach(function (row) {
      var detail = state.payload.endpointDetails[row.id];
      if (!detail || !detail.findings) return;

      detail.findings.forEach(function (finding) {
        var code = finding.code || '';
        var msg = (finding.message || '').toLowerCase();
        var dim = issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus);

        if (burdenLens === 'workflow-burden') {
          if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || code === 'weak-outcome-next-action-guidance' || code === 'prerequisite-task-burden') {
            bumpCounter(counts, 'hidden context/token handoff');
          }
          if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || code === 'weak-outcome-next-action-guidance' || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
            bumpCounter(counts, 'next required step is not clearly exposed');
          }
          if (code === 'prerequisite-task-burden' || /prior state|earlier|prerequisite|lookup/.test(msg)) {
            bumpCounter(counts, 'workflow sequence feels brittle');
          }
          if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
            bumpCounter(counts, 'auth/header/context requirements spread across calls');
          }
        }

        if (burdenLens === 'contract-shape') {
          if (code === 'deeply-nested-response-structure' || dim === 'shape / nesting complexity' || /nested|deep/.test(msg)) {
            bumpCounter(counts, 'deep nesting shows up often in this view');
          }
          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || /snapshot|storage|model structure/.test(msg)) {
            bumpCounter(counts, 'snapshot-style state shows up often');
          }
          if (code === 'duplicated-state-response' || /duplicate|duplicated/.test(msg)) {
            bumpCounter(counts, 'similar state appears repeated across response branches');
          }
          if (code === 'incidental-internal-field-exposure' || dim === 'internal/incidental fields' || /internal|incidental|audit|raw id/.test(msg)) {
            bumpCounter(counts, 'incidental/internal fields show up often');
          }
          if (code === 'duplicated-state-response' || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) {
            bumpCounter(counts, 'source-of-truth fields are unclear');
          }
          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || code === 'weak-outcome-next-action-guidance' || /outcome|what changed|result meaning/.test(msg)) {
            bumpCounter(counts, 'outcome framing is easy to miss');
          }
          if (code === 'weak-outcome-next-action-guidance' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
            bumpCounter(counts, 'next action is weakly exposed');
          }
          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || dim === 'workflow outcome weakness' || /outcome|next action/.test(msg)) {
            bumpCounter(counts, 'task outcome / next action is easy to miss');
          }
        }

        if (burdenLens === 'consistency') {
          if (code === 'detail-path-parameter-name-drift') {
            bumpCounter(counts, 'parameter names differ');
          }
          if (code === 'endpoint-path-style-drift' || code === 'sibling-path-shape-drift') {
            bumpCounter(counts, 'path patterns differ');
          }
          if (code === 'inconsistent-response-shape' || code === 'inconsistent-response-shape-family' || code === 'inconsistent-response-shapes' || code === 'inconsistent-response-shapes-family') {
            bumpCounter(counts, 'response shapes differ');
            bumpCounter(counts, 'outcome wording differs');
          }
        }
      });
    });

    return Object.keys(counts)
      .map(function (label) { return { label: label, count: counts[label] }; })
      .sort(function (a, b) {
        if (a.count !== b.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 4);
  }

  function renderDynamicBurdenSignals(rows, burdenLens) {
    var signals = collectDynamicBurdenSignals(rows, burdenLens);
    if (!signals.length) return '';

    var chips = signals.map(function (signal) {
      var label = burdenLens === 'consistency' ? humanizeSignalLabel(signal.label) : signal.label;
      return '<span class="chip">' + escapeHtml(label) + ' (' + signal.count + ')</span>';
    }).join('');

    var heading = burdenLens === 'consistency' ? 'Most common differences in this view:' : 'Most common in this slice:';

    return '<div class="burden-dynamic-signals">'
      + '<strong>' + escapeHtml(heading) + '</strong>'
      + '<div class="chips">' + chips + '</div>'
      + '</div>';
  }

  function buildListContext(matches, total) {
    var lens = [];
    if (state.filters.search) lens.push('\u201c' + state.filters.search + '\u201d');
    if (state.filters.category === 'spec-rule') lens.push('rules-based view: spec rule');
    else if (state.filters.category !== "all") lens.push('category: ' + state.filters.category.replaceAll("-", " "));
    if (state.filters.burden !== "all") lens.push('guidance view: ' + state.filters.burden.replaceAll("-", " "));
    if (state.filters.familyPressure !== "all") lens.push('pressure: ' + state.filters.familyPressure);

    var mode = state.filters.includeNoIssueRows ? 'all rows' : 'evidence-only';
    var visibleRows = filteredRows();
    var burdenExplanation = '';
    if (state.filters.category === 'spec-rule') {
      var ruleGroups = aggregateSpecRuleFindings(filteredRows());
      burdenExplanation = '<div class="burden-explanation spec-rule-explanation">'
        + '<span class="evidence-track-label evidence-track-normative">Rules-based view</span>'
        + '<strong>Spec rule violations</strong> \u2014 findings backed by explicit OpenAPI rule language. '
        + 'REQUIRED / MUST violations are <strong>errors</strong>; SHOULD / RECOMMENDED concerns are <strong>warnings</strong>.'
        + renderSpecRuleAggregate(ruleGroups)
        + '</div>';
    } else if (state.filters.burden === 'workflow-burden') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
        + '<strong>Workflow burden</strong> — family cards highlight cross-step continuity pressure that makes real call paths harder to complete safely.'
        + '<ul>'
        + '<li>Hidden token/context/header dependencies appear across steps.</li>'
        + '<li>Sequencing suggests brittle handoffs where the next required step is not clearly exposed.</li>'
        + '<li>Outcome guidance appears weak, so callers likely infer what to do next.</li>'
        + '<li>Endpoint rows are supporting evidence; use Endpoint diagnostics to inspect exact continuity breakpoints.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'workflow-burden')
        + '</div>';
    } else if (state.filters.burden === 'contract-shape') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
        + '<strong>Endpoint drill-down for Shape burden</strong> — this lens diagnoses real DX cost from storage-shaped payloads, not backend graph completeness.'
        + '<ul>'
        + '<li>Diagnose deep nesting, duplicated state, snapshot-heavy payloads, internal-field exposure, and unclear source-of-truth fields.</li>'
        + '<li>Diagnose missing outcome framing and missing next-action cues in shape-heavy responses.</li>'
        + '<li>Use row message + OpenAPI location pills and Endpoint diagnostics to inspect concrete schema locations for each burden.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'contract-shape')
        + '</div>';
    }
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var guide = matches > 0
      ? (workflowTabActive
          ? 'Use family cards for family-level pattern summary; use Endpoint diagnostics for endpoint continuity diagnosis; use Exact evidence for grouped issue text.'
        : shapeTabActive
        ? 'Family cards are the primary shape triage surface. Use this list as endpoint-level drill-down to pick exactly which endpoint diagnostics to inspect next.'
          : 'Click any row to see exact issue text and OpenAPI location cues. Card text summarizes why each endpoint appears in this view.')
      : 'No rows match. Use the family no-match recovery above to widen the view.';

    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var actionsHtml = (matches > 0 && !workflowTabActive && !shapeTabActive)
      ? '<div class="context-actions">'
        + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all matching families</button>'
        + '<button type="button" class="secondary-action" data-recovery-action="clear-current-lens">Clear lens</button>'
        + '</div>'
      : '';

    return '<div class="context-block compact-context-block">'
      + '<p><strong>' + matches + ' / ' + total + '</strong> endpoints \u2014 ' + escapeHtml(mode)
      + (lens.length ? ' | filtered by: ' + escapeHtml(lens.join(', ')) : '') + '</p>'
      + burdenExplanation
      + '<p class="subtle">' + escapeHtml(guide) + '</p>'
      + actionsHtml
      + '</div>';
  }

  function hasWorkflowShapedExampleSignals(findings) {
    return (findings || []).some(function (f) {
      var code = f.code || '';
        if (code === 'contract-shape-workflow-guidance-burden' ||
          code === 'snapshot-heavy-response' ||
          code === 'duplicated-state-response' ||
          code === 'incidental-internal-field-exposure' ||
          code === 'deeply-nested-response-structure' ||
          code === 'prerequisite-task-burden' ||
          code === 'weak-follow-up-linkage' ||
          code === 'weak-action-follow-up-linkage' ||
          code === 'weak-accepted-tracking-linkage' ||
          code === 'generic-object-response' ||
          code === 'weak-array-items-schema') {
        return true;
      }
      var msg = (f.message || '').toLowerCase();
      return /follow[-\s]?up|next[-\s]?step|tracking|identifier|token|context|header|nested|snapshot|internal|source of truth|authoritative|outcome|what changed/.test(msg);
    });
  }

  function collectInspectorContractComparisonPoints(endpoint, findings) {
    var current = [];
    var improved = [];
    var themes = [];

    function pushUnique(list, text) {
      if (list.indexOf(text) === -1) list.push(text);
    }

    function addTheme(theme, currentText, improvedText) {
      if (themes.indexOf(theme) === -1) themes.push(theme);
      pushUnique(current, currentText);
      pushUnique(improved, improvedText);
    }

    (findings || []).forEach(function (f) {
      var code = f.code || '';
      var msg = (f.message || '').toLowerCase();

      if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || /snapshot|storage|model structure|full model/.test(msg)) {
        addTheme('storage-shaped vs task-shaped', 'Storage-shaped payload dominates the response surface.', 'Task-shaped response leads with outcome, authoritative state, and handoff fields.');
        addTheme('graph dump vs explicit outcome', 'Graph-style payload forces readers to infer what changed.', 'Explicit outcome block states what changed and whether the step is complete.');
      }
      if (code === 'incidental-internal-field-exposure' || /internal|incidental|audit|raw id/.test(msg)) {
        addTheme('internal state vs domain-level state', 'Internal/storage fields dominate over domain-level state.', 'Domain-level state and user-visible meaning stay primary; internal fields are hidden.');
      }
      if (code === 'duplicated-state-response' || /duplicate|duplicated|source of truth|authoritative/.test(msg)) {
        addTheme('duplicated state vs single source of truth', 'Duplicated state appears across branches with unclear source-of-truth.', 'One authoritative state field is used as the single source-of-truth.');
      }
      if (code === 'weak-outcome-next-action-guidance' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
        addTheme('missing next action vs explicit next action', 'Next action is missing or weakly modeled in the response.', 'Response includes explicit nextAction plus required id/link for the next call.');
      }
      if (code === 'prerequisite-task-burden' || /prerequisite|prior state|hidden dependency|handoff|implicit/.test(msg)) {
        addTheme('hidden dependency vs surfaced prerequisite / handoff', 'Prerequisite/handoff dependency is implicit and easy to miss.', 'Response surfaces prerequisite state and handoff contract explicitly.');
      }
    });

    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    if (/order|cart|checkout|payment/.test(path)) {
      pushUnique(improved, 'Outcome status is domain-level (for example order/cart/payment state), not backend object dump.');
    }

    if (!themes.length) {
      addTheme(
        'storage-shaped vs task-shaped',
        'Current shape requires readers to infer intent from broad payload structure.',
        'Workflow-first shape states outcome, authoritative state, and next action explicitly.'
      );
    }

    return {
      themes: themes,
      current: current.slice(0, 4),
      improved: improved.slice(0, 4)
    };
  }

  function renderInspectorContractShapeComparison(detail, findingsOverride, options) {
    var opts = options || {};
    var endpoint = (detail && detail.endpoint) || {};
    var findings = findingsOverride || findingsForActiveLens((detail && detail.findings) || []);
    var points = collectInspectorContractComparisonPoints(endpoint, findings);
    var title = opts.title || 'Current contract shape vs workflow-first contract shape';
    var themeLine = points.themes.length ? points.themes.join(' | ') : 'storage-shaped vs task-shaped';

    return '<section class="inspector-contract-compare">'
      + '<h3>' + escapeHtml(title) + '</h3>'
      + '<p class="inspector-contract-compare-note"><strong>Themes:</strong> ' + escapeHtml(themeLine) + '</p>'
      + '<div class="inspector-contract-compare-grid">'
      + '  <div class="inspector-contract-compare-col">'
      + '    <h4>Current contract shape</h4>'
      + '    <ul>' + points.current.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      + '  </div>'
      + '  <div class="inspector-contract-compare-col">'
      + '    <h4>Workflow-first contract shape</h4>'
      + '    <ul>' + points.improved.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      + '  </div>'
      + '</div>'
      + '</section>';
  }

  function collectWorkflowShapedExamplePoints(endpoint, findings) {
    var current = [];
    var cleaner = [];
    var evidence = [];

    function pushUnique(list, text) {
      if (list.indexOf(text) === -1) list.push(text);
    }

    (findings || []).forEach(function (f) {
      var code = f.code || '';
      if (evidence.indexOf(code) === -1) evidence.push(code);

      if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response') {
        pushUnique(current, 'Storage/model structure dominates the response.');
        pushUnique(cleaner, 'Put task outcome and authoritative state first.');
      }
      if (code === 'deeply-nested-response-structure') {
        pushUnique(current, 'Deep nesting hides outcome meaning.');
        pushUnique(cleaner, 'Keep outcome and next action near the top.');
      }
      if (code === 'duplicated-state-response') {
        pushUnique(current, 'Repeated state adds scan noise and obscures source-of-truth.');
        pushUnique(cleaner, 'Show one authoritative state view instead of repeated snapshots.');
      }
      if (code === 'incidental-internal-field-exposure') {
        pushUnique(current, 'Incidental internal fields crowd outcome visibility.');
        pushUnique(cleaner, 'Keep only handoff-relevant fields visible.');
      }
      if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
        pushUnique(current, 'Next step is weakly signaled.');
        pushUnique(cleaner, 'Make the next action and handoff ID explicit.');
      }
      if (code === 'weak-outcome-next-action-guidance') {
        pushUnique(current, 'Outcome and next action framing is weak.');
        pushUnique(cleaner, 'State the outcome and next valid action explicitly.');
      }
      if (code === 'prerequisite-task-burden') {
        pushUnique(current, 'Hidden prerequisites are doing too much work.');
        pushUnique(cleaner, 'Clarify prerequisite context for this step.');
      }
      if (code === 'generic-object-response' || code === 'weak-array-items-schema') {
        pushUnique(current, 'Generic shape weakens handoff meaning.');
        pushUnique(cleaner, 'Keep only handoff-critical state.');
      }
    });

    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    if (/login|auth|session|register/.test(path)) {
      pushUnique(cleaner, 'Illustrative: make the auth/context token clearly authoritative.');
    }
    if (/customer/.test(path)) {
      pushUnique(cleaner, 'Illustrative: keep customer context clearly reusable.');
    }
    if (/cart/.test(path)) {
      pushUnique(cleaner, 'Illustrative: show cart state change plus minimal handoff fields.');
    }
    if (/order/.test(path)) {
      pushUnique(cleaner, 'Illustrative: show order outcome and next valid actions.');
    }
    if (/payment|checkout/.test(path)) {
      pushUnique(cleaner, 'Illustrative: show payment meaning and authoritative transaction state.');
    }

    return {
      current: current.slice(0, 2),
      cleaner: cleaner.slice(0, 3),
      evidence: evidence.slice(0, 4)
    };
  }

  function renderWorkflowShapedExample(detail, findingsOverride) {
    var findings = findingsOverride || findingsForActiveLens(detail.findings || []);
    if (!hasWorkflowShapedExampleSignals(findings)) return '';

    var points = collectWorkflowShapedExamplePoints(detail.endpoint || {}, findings);
    if (!points.current.length && !points.cleaner.length) return '';

    var currentHtml = points.current.length
      ? '<ul>' + points.current.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '<p class="subtle">Current storage-shaped emphasis appears mixed; handoff meaning is not consistently clear.</p>';
    var cleanerHtml = points.cleaner.length
      ? '<ul>' + points.cleaner.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '<p class="subtle">Improved task-shaped emphasis would prioritize task outcome, authoritative context, and next action clarity.</p>';

    var evidenceHint = points.evidence.length
      ? '<p class="workflow-example-evidence"><strong>Signals:</strong> ' + escapeHtml(points.evidence.join(', ')) + '</p>'
      : '';

    return '<section class="workflow-example-block">'
      + '<h3>Current storage-shaped vs improved task-shaped response (illustrative)</h3>'
      + '<p class="workflow-example-note">Illustrative only — not a generated replacement or runtime guarantee.</p>'
      + '<div class="workflow-example-grid">'
      + '  <div class="workflow-example-col">'
      + '    <h4>Current storage-shaped response</h4>'
      +      currentHtml
      + '  </div>'
      + '  <div class="workflow-example-col">'
      + '    <h4>Improved task-shaped response</h4>'
      +      cleanerHtml
      + '  </div>'
      + '</div>'
      + evidenceHint
      + '</section>';
  }

  function renderEndpointInspectionContent(detail, options) {
    var opts = options || {};
    var findings = findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || {};
    var groups = groupFindings(findings);
    var severity = dominantSeverity(findings);
    var topGroup = groups[0] || null;
    var groupedFindingsCount = groups.length;
    var relatedChains = detail.relatedChains || [];
    var chainContext = buildChainContext(relatedChains, endpoint.id || state.selectedEndpointId, state.payload.endpointDetails);

    var topMsg = topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.';
    var topContext = topGroup ? topGroup.context : {};
    var contextBadge = buildContextTypeBadge(topContext);
    var cleanerHint = topGroup ? dimensionCleanerHint(topGroup.dimension) : '';
    var moreCount = groupedFindingsCount - 1;
    var leadNotes = '';

    if (topGroup && (topGroup.impact || cleanerHint)) {
      leadNotes = '<details class="lead-finding-notes">'
        + '<summary>Why this matters' + (cleanerHint ? ' and what cleaner contract emphasis would do' : '') + '</summary>'
        + '<div class="lead-finding-notes-body">'
        + (topGroup.impact ? '<p class="lead-finding-impact"><strong>Why this is problematic:</strong> ' + escapeHtml(topGroup.impact) + '</p>' : '')
        + (cleanerHint ? '<p class="lead-finding-cleaner"><strong>Cleaner contract would:</strong> ' + escapeHtml(cleanerHint) + '</p>' : '')
        + '</div>'
        + '</details>';
    }

    var workflowExample = renderWorkflowShapedExample(detail, findings);
    var openDrawer = !!opts.openEvidence;

    var html = ''
      + '<div class="detail-hero pressure-' + endpoint.priority + '">'
      + '  <div class="detail-hero-head">'
      + '    <div>'
      + '      <strong class="detail-path">' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
      + '      <div class="detail-subline">' + escapeHtml(endpointIntentCue(endpoint.method, endpoint.path)) + ' | ' + escapeHtml(humanFamilyLabel(endpoint.family)) + '</div>'
      + '    </div>'
      + '    <div class="detail-badges">'
      +        pressureBadge(endpoint.priority, 'pressure')
      +        severityBadge(severity)
      + '    </div>'
      + '  </div>'
      + '  <div class="lead-finding">'
      + '    <div class="lead-finding-head">'
      +        contextBadge
      + '    </div>'
      + '    <p class="lead-finding-message">' + escapeHtml(topMsg) + '</p>'
      + '    <div class="lead-finding-grounding">'
      + '      <span class="grounding-label">OpenAPI location cues (when available)</span>'
      +        renderOpenAPIContextPills(topContext, false)
      +        (topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '')
      +    '</div>'
      + leadNotes
      + '  </div>'
      + '</div>';

    if (workflowExample) {
      html += workflowExample;
    }

    html += '<details class="detail-evidence-drawer"' + (openDrawer ? ' open' : '') + '>'
      + '<summary>Open full exact evidence' + (groups.length ? ' (' + groups.length + ' groups)' : '') + '</summary>'
      + '<section class="detail-section detail-section-tight">'
      + '  <h3>Exact issue evidence</h3>'
      + '  <p class="subtle detail-section-copy">Grouped by location and type. First two groups start open.'
      + (moreCount > 0 ? ' ' + moreCount + ' additional group' + (moreCount > 1 ? 's' : '') + ' follow the lead issue below.' : '')
      + '</p>'
      + groups.map(function (group, index) {
            return renderIssueGroup(group, index);
          }).join('')
      + '</section>'
      + '</details>';

    if (chainContext) {
      html += chainContext;
    }

    return html;
  }

  function renderEndpointDiagnostics() {
    if (!el.endpointDiagnosticsSection) return;
    el.endpointDiagnosticsSection.style.display = 'block';

    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    if (workflowTabActive && state.endpointDiagnosticsSubTab !== 'summary' && state.endpointDiagnosticsSubTab !== 'exact') {
      state.endpointDiagnosticsSubTab = 'summary';
    }
    if (shapeTabActive && state.endpointDiagnosticsSubTab === 'consistency') {
      state.endpointDiagnosticsSubTab = 'summary';
    }
    var diagnosticsTitle = el.endpointDiagnosticsSection.querySelector('h2');
    if (diagnosticsTitle) {
      diagnosticsTitle.textContent = workflowTabActive
        ? 'Workflow endpoint continuity diagnostics'
        : shapeTabActive
        ? 'Shape burden endpoint diagnostics'
        : 'Selected endpoint inspection';
    }
    if (workflowTabActive) {
      el.endpointDiagnosticsSection.classList.add('endpoint-diagnostics-workflow-compact');
    } else {
      el.endpointDiagnosticsSection.classList.remove('endpoint-diagnostics-workflow-compact');
    }
    if (shapeTabActive) {
      el.endpointDiagnosticsSection.classList.add('endpoint-diagnostics-shape-compact');
    } else {
      el.endpointDiagnosticsSection.classList.remove('endpoint-diagnostics-shape-compact');
    }

    var detail = state.selectedEndpointId ? state.payload.endpointDetails[state.selectedEndpointId] : null;
    var hasValidSelection = !!detail && hasValidSelectedEndpointInCurrentView();

    if (shapeTabActive && !hasValidSelection && state.endpointDiagnosticsSubTab !== 'summary') {
      state.endpointDiagnosticsSubTab = 'summary';
    }

    if (!hasValidSelection) {
      el.endpointDiagnosticsSection.classList.add('endpoint-diagnostics-secondary');
      el.endpointDiagnosticsHelp.textContent = workflowTabActive
        ? 'Workflow-first diagnostics activates when you select a visible endpoint in the current workflow slice.'
        : shapeTabActive
        ? 'Shape-first diagnostics activates when you select a visible endpoint in the current shape slice.'
        : 'Endpoint diagnostics is available when you select a visible endpoint.';
      el.endpointDiagnosticsBody.innerHTML = '<div class="endpoint-diag-standby">'
        + '<strong>No active endpoint selection.</strong>'
        + '<p class="subtle">'
        + (workflowTabActive
          ? 'Select a workflow endpoint to inspect next-step gaps, hidden handoff fields, auth/context burden, and sequencing risk.'
          : shapeTabActive
          ? 'Select a shape endpoint to inspect deep nesting, duplicated state, internal field exposure, and snapshot-heavy response burden.'
          : 'Browse families first. Select a family insight action or endpoint row to open full diagnostics.')
        + '</p>'
        + '</div>';
      return;
    }

    el.endpointDiagnosticsSection.classList.remove('endpoint-diagnostics-secondary');

    var endpoint = detail.endpoint || {};
    var findings = findingsForActiveLens(detail.findings || []);
    if (workflowTabActive) {
      var chainCount = (detail.relatedChains || []).length;
      var workflowSignalSummary = summarizeWorkflowHeaderSignals(detail);
      el.endpointDiagnosticsHelp.textContent = 'Workflow focus: ' + endpoint.method + ' ' + endpoint.path
        + (findings.length ? ' | ' + findings.length + ' issue' + (findings.length === 1 ? '' : 's') : ' | no direct issue messages in current view')
        + (chainCount ? ' | appears in ' + chainCount + ' workflow chain' + (chainCount === 1 ? '' : 's') : ' | not currently linked to an inferred chain')
        + ' | ' + workflowSignalSummary;
    } else if (shapeTabActive) {
      var shapeTotals = collectShapeSignalTotalsForDetail(detail);
      var shapeGroups = groupFindings(findingsForActiveLens(detail.findings || []));
      el.endpointDiagnosticsHelp.textContent = 'Shape focus: ' + endpoint.method + ' ' + endpoint.path
        + (findings.length ? ' | ' + findings.length + ' shape finding' + (findings.length === 1 ? '' : 's') : ' | no direct issue messages in current view')
        + (shapeGroups.length ? ' | ' + shapeGroups.length + ' grouped shape clusters' : '')
        + ' | profile ' + shapeTotals.deep + '/' + shapeTotals.internal + '/' + shapeTotals.dup + '/' + shapeTotals.snapshot + ' (deep/internal/dup/snapshot)';
    } else {
      el.endpointDiagnosticsHelp.textContent = 'Current selection: ' + endpoint.method + ' ' + endpoint.path + (findings.length ? ' | ' + findings.length + ' issue' + (findings.length === 1 ? '' : 's') : ' | no direct issue messages in current view');
    }

    if (!findings.length) {
      var emptyPrefix = workflowTabActive ? renderWorkflowDiagnosticsFrame(detail) : '';
      el.endpointDiagnosticsBody.innerHTML = emptyPrefix + '<div class="empty">'
        + '<strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
        + '<p class="subtle">'
        + escapeHtml(shapeTabActive
            ? 'This endpoint is selected, but there is no direct shape-burden issue text in the current shape slice.'
            : 'This endpoint is selected, but there is no direct issue text in the current view.')
        + '</p>'
        + '</div>';
      return;
    }

    var body = '';
    if (workflowTabActive) {
      body += renderWorkflowDiagnosticsFrame(detail);
    }

    body += renderInspectorContentMap();
    body += renderEndpointDiagnosticsTabs();
    if (state.endpointDiagnosticsSubTab === 'exact') {
      body += renderEndpointDiagnosticsExact(detail);
    } else if (state.endpointDiagnosticsSubTab === 'consistency') {
      body += renderEndpointDiagnosticsConsistency(detail);
    } else if (state.endpointDiagnosticsSubTab === 'cleaner') {
      body += renderEndpointDiagnosticsCleaner(detail);
    } else {
      body += workflowTabActive
        ? renderEndpointDiagnosticsWorkflowSummary(detail)
        : (shapeTabActive ? renderEndpointDiagnosticsShapeSummary(detail) : renderEndpointDiagnosticsSummary(detail));
    }

    el.endpointDiagnosticsBody.innerHTML = body;

    Array.prototype.forEach.call(el.endpointDiagnosticsBody.querySelectorAll('button[data-endpoint-subtab]'), function (btn) {
      btn.addEventListener('click', function () {
        state.endpointDiagnosticsSubTab = btn.getAttribute('data-endpoint-subtab') || 'summary';
        renderEndpointDiagnostics();
      });
    });
  }

  function summarizeWorkflowHeaderSignals(detail) {
    var findings = (detail && detail.findings) || [];
    var messages = findings.map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');

    function hasCode(codes) {
      return findings.some(function (f) { return codes.indexOf(f.code || '') !== -1; });
    }

    var labels = [];
    if (hasCode(['weak-follow-up-linkage', 'weak-action-follow-up-linkage', 'weak-accepted-tracking-linkage', 'weak-outcome-next-action-guidance'])
      || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed/.test(messages)) {
      labels.push('next-step gap');
    }
    if (hasCode(['weak-follow-up-linkage', 'weak-action-follow-up-linkage', 'weak-accepted-tracking-linkage'])
      || /handoff|identifier|tracking|hidden/.test(messages)) {
      labels.push('hidden handoff');
    }
    if (/auth|authorization|bearer|token|header|context|access\s*key|api[-\s]?key/.test(messages)) {
      labels.push('auth/context burden');
    }
    if (hasCode(['prerequisite-task-burden'])
      || /prior state|earlier|sequence|prerequisite|brittle/.test(messages)) {
      labels.push('sequencing burden');
    }

    if (!labels.length) return 'workflow continuity signals are limited for this endpoint';
    return 'primary continuity signals: ' + labels.join(', ');
  }

  function collectShapeSignalTotalsForDetail(detail) {
    var findings = findingsForActiveLens((detail && detail.findings) || []);
    var totals = {
      deep: 0,
      internal: 0,
      dup: 0,
      snapshot: 0,
      source: 0,
      outcome: 0,
      nextAction: 0
    };

    findings.forEach(function (f) {
      var code = f.code || '';
      var msg = (f.message || '').toLowerCase();
      if (code === 'deeply-nested-response-structure' || /nested|deep/.test(msg)) totals.deep += 1;
      if (code === 'incidental-internal-field-exposure' || /internal|incidental|audit|raw id/.test(msg)) totals.internal += 1;
      if (code === 'duplicated-state-response' || /duplicate|duplicated/.test(msg)) totals.dup += 1;
      if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || /snapshot|storage|model structure/.test(msg)) totals.snapshot += 1;
      if (code === 'duplicated-state-response' || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) totals.source += 1;
      if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || code === 'weak-outcome-next-action-guidance' || /outcome|what changed|result meaning/.test(msg)) totals.outcome += 1;
      if (code === 'weak-outcome-next-action-guidance' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) totals.nextAction += 1;
    });

    return totals;
  }

  function renderWorkflowDiagnosticsFrame(detail) {
    var findings = detail.findings || [];
    var messages = findings.map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');

    function hasCode(codes) {
      return findings.some(function (f) { return codes.indexOf(f.code || '') !== -1; });
    }

    var hasNextStepGap = hasCode(['weak-follow-up-linkage', 'weak-action-follow-up-linkage', 'weak-accepted-tracking-linkage', 'weak-outcome-next-action-guidance'])
      || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed/.test(messages);
    var hasHiddenHandoff = hasCode(['weak-follow-up-linkage', 'weak-action-follow-up-linkage', 'weak-accepted-tracking-linkage'])
      || /handoff|identifier|tracking|hidden/.test(messages);
    var hasAuthContextBurden = /auth|authorization|bearer|token|header|context|access\s*key|api[-\s]?key/.test(messages);
    var hasSequencingBurden = hasCode(['prerequisite-task-burden'])
      || /prior state|earlier|sequence|prerequisite|brittle/.test(messages);

    var activeSignals = [];
    if (hasNextStepGap) activeSignals.push('Next-step gap is signaled: follow-up requirement is not clearly exposed.');
    if (hasHiddenHandoff) activeSignals.push('Hidden handoff burden is signaled: identifier/context transfer appears implicit.');
    if (hasAuthContextBurden) activeSignals.push('Auth/header/context burden is signaled across messages for this endpoint.');
    if (hasSequencingBurden) activeSignals.push('Sequencing burden is signaled: this step appears to depend on prior state setup.');

    var signalList = activeSignals.length
      ? activeSignals.map(function (text) { return '<li>' + escapeHtml(text) + '</li>'; }).join('')
      : '<li>No explicit workflow continuity burden signal is attached to this endpoint in the current workflow slice.</li>';

    return '<div class="family-insight-card">'
      + '<p class="insight-kicker">Workflow-first diagnostics framing</p>'
      + '<p class="subtle">This panel is focused on continuity burden for this endpoint inside call chains: what the next step needs, what state is hidden, and where sequencing may be brittle.</p>'
      + '<ul class="family-top-evidence">'
      + signalList
      + '</ul>'
      + '</div>';
  }

  function renderEndpointDetail() {
    if (!el.endpointDetail) return;
    var pane = el.endpointDetail.closest('.detail-pane');
    if (pane) {
      pane.style.display = 'none';
      pane.setAttribute('aria-hidden', 'true');
    }
    if (el.detailHelp) {
      el.detailHelp.textContent = '';
    }
    el.endpointDetail.innerHTML = '';
  }

  function buildChainContext(relatedChains, endpointId, endpointDetails) {
    if (!relatedChains || !relatedChains.length) return '';

    var html = '<section class="detail-chain-context">';

    relatedChains.forEach(function (chain) {
      var stepIndex = chain.endpointIds.indexOf(endpointId);
      if (stepIndex < 0) return;

      var totalSteps = chain.endpointIds.length;
      var stepNum = stepIndex + 1;
      var hasPrev = stepIndex > 0;
      var hasNext = stepIndex < totalSteps - 1;
      var kind = chain.kind ? chain.kind.replaceAll('-', ' → ') : 'workflow';

      html += '<div class="chain-context-block">'
        + '<div class="chain-position-banner">Step ' + stepNum + ' of ' + totalSteps + ' — ' + escapeHtml(kind) + '</div>';

      if (hasPrev) {
        var prevId = chain.endpointIds[stepIndex - 1];
        var prevDetail = endpointDetails[prevId];
        if (prevDetail) {
          html += '<div class="chain-step-info prev-step">'
            + '<p class="chain-step-label">← Came from</p>'
            + '<strong>' + escapeHtml(prevDetail.endpoint.method + ' ' + prevDetail.endpoint.path) + '</strong>'
            + '<p class="subtle">That step\'s response provides context or identifiers used here.</p>'
            + '</div>';
        }
      }

      if (hasNext) {
        var nextId = chain.endpointIds[stepIndex + 1];
        var nextDetail = endpointDetails[nextId];
        if (nextDetail) {
          var nextNeeds = describeNextStepNeeds(chain.endpointIds[stepIndex], nextDetail);
          html += '<div class="chain-step-info next-step">'
            + '<p class="chain-step-label">→ Leads to</p>'
            + '<strong>' + escapeHtml(nextDetail.endpoint.method + ' ' + nextDetail.endpoint.path) + '</strong>'
            + '<p class="subtle">' + escapeHtml(nextNeeds) + '</p>'
            + '</div>';
        }
      }

      html += '</div>';
    });

    html += '</section>';
    return html;
  }

  function describeNextStepNeeds(fromId, toDetail) {
    var toPath = toDetail.endpoint.path;
    if (toPath.indexOf('{') !== -1) {
      return 'This step needs to extract an identifier from ' + humanizeObjectName(toPath.split('/').pop().replace(/{|}/g, '')) + ' and pass it forward.';
    }
    return 'The next step needs context or identifiers from this response to proceed. Check the response schema for required IDs.';
  }

  // Render normative grounding block from a group object (aggregated by specRuleId).
  // Shows "N instances" instead of a specific location when the group has many messages.
  function renderSpecRuleGroundingForGroup(group) {
    if (!group.isSpecRule || !group.specRuleId) return '';
    var levelClass = (group.normativeLevel === 'REQUIRED' || group.normativeLevel === 'MUST' || group.normativeLevel === 'MUST NOT')
      ? 'spec-level-must' : 'spec-level-should';
    var locationNote = group.count > 1
      ? '<span class="spec-location">' + group.count + ' instances on this endpoint</span>'
      : '';
    return '<div class="spec-rule-grounding">'
      + '<span class="spec-rule-id">' + escapeHtml(group.specRuleId) + '</span>'
      + '<span class="spec-norm-badge ' + levelClass + '">' + escapeHtml(group.normativeLevel || '') + '</span>'
      + '<span class="spec-source">' + escapeHtml(group.specSource || '') + '</span>'
      + locationNote
      + '</div>';
  }

  function renderIssueGroup(group, index) {
    var openAttr = index < 2 ? ' open' : '';
    var CAP = 3; // max visible instances for spec-rule groups
    var visibleMsgs = (group.isSpecRule && group.messages.length > CAP)
      ? group.messages.slice(0, CAP) : group.messages;
    var hiddenCount = group.messages.length - visibleMsgs.length;
    var messageList = visibleMsgs.map(function (message) {
      return '<li>' + escapeHtml(message) + '</li>';
    }).join('');
    var expandMore = hiddenCount > 0
      ? '<details class="spec-rule-expand"><summary class="spec-rule-expand-toggle">+' + hiddenCount + ' more instances</summary>'
        + '<ul>' + group.messages.slice(CAP).map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') + '</ul>'
        + '</details>'
      : '';
    var openAPI = renderOpenAPIContextPills(group.context, false);
    var countSuffix = group.count > 1 ? '<span class="issue-group-count">\u00d7' + group.count + '</span>' : '';
    var specGrounding = group.isSpecRule ? renderSpecRuleGroundingForGroup(group) : '';

    return '<details class="issue-group' + (group.isSpecRule ? ' issue-group-spec-rule' : '') + '"' + openAttr + '>'
      + '<summary>'
      + '<span class="issue-toggle-indicator"></span>'
      + severityBadge(group.severity)
      + '<span class="issue-group-title">' + escapeHtml(group.title) + '</span>'
      + countSuffix
      + '</summary>'
      + '<div class="issue-group-body">'
      + '  <div class="issue-messages">'
      + '    <ul>' + messageList + '</ul>'
      + '  </div>'
      + expandMore
      + specGrounding
      + '  <div class="issue-group-meta"><span class="grounding-label">OpenAPI location cues (when available)</span>' + openAPI + '</div>'
      + '  <p class="issue-inspect-hint"><strong>Inspect in spec:</strong> ' + escapeHtml(group.inspectHint) + '</p>'
      + '  <p class="issue-impact"><strong>Why it matters:</strong> ' + escapeHtml(group.impact) + '</p>'
      + '</div>'
      + '</details>';
  }

  function groupFindings(findings) {
    var groups = {};

    findings.forEach(function (finding) {
      var context = extractOpenAPIContext(finding);
      var isSpecRule = finding.evidenceType === 'spec-rule';
      // Spec-rule findings are grouped by rule ID to avoid flooding the detail
      // pane with near-identical per-response-code violations.
      var key = (isSpecRule && finding.specRuleId)
        ? ('spec-rule|' + finding.specRuleId)
        : [finding.code || '', context.primaryLabel || '', context.primaryValue || '', context.mediaType || '', context.statusCode || ''].join('|');

      if (!groups[key]) {
        groups[key] = {
          code: finding.code || 'n/a',
          severity: finding.severity || 'info',
          dimension: issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus),
          context: context,
          messages: [],
          count: 0,
          preview: finding.message || '',
          impact: dimensionImpact(issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus)),
          inspectHint: findingExamineHint(finding.code, finding.message),
          // Spec-rule groups use the stable rule summary as title; heuristic groups
          // use the message-derived title as before.
          title: (isSpecRule && finding.specRuleId)
            ? (SPEC_RULE_SUMMARY[finding.specRuleId] || finding.specRuleId.replace(/^OAS-/, '').replace(/-/g, ' '))
            : formatIssueGroupTitle(finding, context),
          isSpecRule: isSpecRule,
          specRuleId: isSpecRule ? (finding.specRuleId || '') : '',
          normativeLevel: isSpecRule ? (finding.normativeLevel || '') : '',
          specSource: isSpecRule ? (finding.specSource || '') : ''
        };
      }

      groups[key].messages.push(finding.message || '');
      groups[key].count += 1;
      if (severityPriority(finding.severity) < severityPriority(groups[key].severity)) {
        groups[key].severity = finding.severity;
      }
    });

    return Object.values(groups).sort(function (a, b) {
      if (severityPriority(a.severity) !== severityPriority(b.severity)) {
        return severityPriority(a.severity) - severityPriority(b.severity);
      }
      if (a.count !== b.count) return b.count - a.count;
      return a.title.localeCompare(b.title);
    });
  }

  function extractOpenAPIContext(finding) {
    var message = finding.message || '';
    var context = {
      primaryLabel: '',
      primaryValue: '',
      mediaType: '',
      statusCode: '',
      parameterKind: '',
      parameterNames: ''
    };

    var mediaType = /media type '([^']+)'/.exec(message);
    if (mediaType) context.mediaType = mediaType[1];

    var responseMissingSchema = /^Response ([0-9]{3}) has no schema for media type/.exec(message);
    if (responseMissingSchema) {
      context.primaryLabel = 'Response schema';
      context.statusCode = responseMissingSchema[1];
    }

    var requestMissingSchema = /^Request body has no schema for media type/.exec(message);
    if (requestMissingSchema) {
      context.primaryLabel = 'Request schema';
    }

    var requestField = /^Request schema property '([^']+)'/.exec(message);
    if (requestField) {
      context.primaryLabel = 'Request schema field';
      context.primaryValue = requestField[1];
    }

    var responseField = /^Response schema property '([^']+)'/.exec(message);
    if (responseField) {
      context.primaryLabel = 'Response schema field';
      context.primaryValue = responseField[1];
    }

    var requestArray = /^Request body array has missing or overly generic items schema/.exec(message);
    if (requestArray) {
      context.primaryLabel = 'Request schema field';
      context.primaryValue = 'array items';
    }

    var responseArray = /^Response array has missing or overly generic items schema/.exec(message);
    if (responseArray) {
      context.primaryLabel = 'Response schema field';
      context.primaryValue = 'array items';
    }

    var followUpCandidates = /related detail endpoint\(s\): (.+)$/.exec(message);
    if (followUpCandidates) {
      context.primaryLabel = 'Response schema field';
      context.primaryValue = followUpCandidates[1];
    }

    var responseItemField = /response item schema does not clearly expose an '([^']+)'/.exec(message);
    if (responseItemField) {
      context.primaryLabel = 'Response schema field';
      context.primaryValue = responseItemField[1];
    }

    var trackingField = /tracking identifier such as (.+)$/.exec(message);
    if (trackingField) {
      context.primaryLabel = 'Response schema field';
      context.primaryValue = trackingField[1];
      context.statusCode = context.statusCode || '202';
    }

    var pathParameters = /parameter names: (.+)$/.exec(message);
    if (pathParameters) {
      context.primaryLabel = 'Path parameter';
      context.primaryValue = pathParameters[1];
      context.parameterKind = 'path';
      context.parameterNames = pathParameters[1];
    }

    if (!context.primaryLabel) {
      if (finding.code === 'generic-object-request' || finding.code === 'missing-request-schema') {
        context.primaryLabel = 'Request schema';
      } else if (finding.code === 'generic-object-response' || finding.code === 'missing-response-schema' || finding.code === 'contract-shape-workflow-guidance-burden' || finding.code === 'snapshot-heavy-response' || finding.code === 'deeply-nested-response-structure' || finding.code === 'duplicated-state-response' || finding.code === 'incidental-internal-field-exposure' || finding.code === 'weak-outcome-next-action-guidance') {
        context.primaryLabel = 'Response schema';
      } else if (finding.code === 'detail-path-parameter-name-drift' || finding.code === 'endpoint-path-style-drift' || finding.code === 'sibling-path-shape-drift') {
        context.primaryLabel = 'Path parameter';
      } else if (finding.code === 'prerequisite-task-burden') {
        context.primaryLabel = 'Request parameter set';
      }
    }

    return context;
  }

  function renderOpenAPIContextPills(context, compact) {
    var pills = [];
    if (context.primaryLabel && context.primaryValue) {
      pills.push('<span class="openapi-pill"><strong>' + escapeHtml(context.primaryLabel) + ':</strong> ' + escapeHtml(context.primaryValue) + '</span>');
    } else if (context.primaryLabel) {
      pills.push('<span class="openapi-pill"><strong>' + escapeHtml(context.primaryLabel) + '</strong></span>');
    }
    if (context.statusCode) {
      pills.push('<span class="openapi-pill"><strong>Response code:</strong> ' + escapeHtml(context.statusCode) + '</span>');
    }
    if (context.mediaType) {
      pills.push('<span class="openapi-pill"><strong>Media type:</strong> ' + escapeHtml(context.mediaType) + '</span>');
    }

    if (!pills.length) {
      return compact ? '' : '<span class="openapi-pill subtle">OpenAPI location not derivable from this message.</span>';
    }

    return pills.join('');
  }

  function formatIssueGroupTitle(finding, context) {
    var dimension = issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus);
    if (context.primaryLabel === 'Request schema field' || context.primaryLabel === 'Response schema field' || context.primaryLabel === 'Path parameter') {
      return context.primaryValue ? context.primaryValue + ' | ' + dimension : dimension;
    }
    return dimension;
  }

  function topFieldPaths(groups) {
    return uniq(groups.map(function (group) {
      if (!group.context) return '';
      if (group.context.primaryLabel === 'Request schema field' || group.context.primaryLabel === 'Response schema field' || group.context.primaryLabel === 'Path parameter') {
        return group.context.primaryValue;
      }
      return '';
    })).slice(0, 6);
  }

  function topOpenAPIHighlights(groups) {
    var highlights = [];
    groups.forEach(function (group) {
      if (group.context && group.context.primaryLabel) {
        if (group.context.primaryValue) {
          highlights.push(group.context.primaryLabel + ': ' + group.context.primaryValue);
        } else {
          highlights.push(group.context.primaryLabel);
        }
      }
      if (group.context && group.context.mediaType) {
        highlights.push('Media type: ' + group.context.mediaType);
      }
    });
    return uniq(highlights).slice(0, 6);
  }

  function scopedRows(rows) {
    return rows.filter(function (row) {
      if (state.filters.search) {
        var hay = (row.method + ' ' + row.path + ' ' + (row.family || '')).toLowerCase();
        if (hay.indexOf(state.filters.search) === -1) return false;
      }
      if (state.filters.category !== 'all' && !((row.categoryCounts || {})[state.filters.category] > 0)) return false;
      if (state.filters.burden !== 'all' && (row.burdenFocuses || []).indexOf(state.filters.burden) === -1) return false;
      return true;
    });
  }

  function filteredRows() {
    var rows = scopedRows(state.payload.endpoints || []).filter(function (row) {
      return state.filters.includeNoIssueRows || row.findings > 0;
    });

    rows.sort(function (a, b) {
      if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
      if (a.findings !== b.findings) return b.findings - a.findings;
      return a.path.localeCompare(b.path);
    });

    return rows;
  }

  function firstEvidenceEndpointId(rows) {
    var found = (rows || []).find(function (row) { return row.findings > 0; });
    return found ? found.id : (rows[0] ? rows[0].id : '');
  }

  function firstVisibleEndpointId(rows) {
    if (!rows || !rows.length) return '';
    var withEvidence = rows.find(function (row) { return row.findings > 0; });
    return withEvidence ? withEvidence.id : rows[0].id;
  }

  function rowDominantIssue(row) {
    var detail = state.payload.endpointDetails[row.id];
    var findings = detail ? findingsForActiveLens(detail.findings || []) : [];
    if (!detail || !findings.length) {
      return { label: 'No direct issue evidence', code: 'n/a' };
    }

    var first = findings[0];
    return {
      label: issueDimensionForFinding(first.code, first.category, first.burdenFocus),
      code: first.code
    };
  }

  function dominantSeverity(findings) {
    if ((findings || []).some(function (finding) { return finding.severity === 'error'; })) return 'error';
    if ((findings || []).some(function (finding) { return finding.severity === 'warning'; })) return 'warning';
    return 'info';
  }

  function severityPriority(severity) {
    if (severity === 'error') return 0;
    if (severity === 'warning') return 1;
    return 2;
  }

  function severityBadge(severity) {
    return '<span class="severity-badge severity-' + escapeHtml(severity) + '" role="button" tabindex="0" title="Select row and update Endpoint diagnostics">'
      + '<span class="severity-icon">' + escapeHtml(severityIcon(severity)) + '</span>'
      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
      + '</span>';
  }

  function severityIcon(severity) {
    if (severity === 'error') return 'x';
    if (severity === 'warning') return '!';
    return 'i';
  }

  function pressureBadge(priority, kind) {
    var label = (priority || 'low').toUpperCase();
    return '<span class="pressure-badge pressure-' + escapeHtml(priority || 'low') + ' ' + escapeHtml(kind || '') + '">' + label + '</span>';
  }

  function endpointIntentCue(method, path) {
    var segments = String(path || '').split('/').filter(Boolean);
    var staticSegments = segments.filter(function (segment) {
      return segment.indexOf('{') === -1 && segment.indexOf('}') === -1;
    });
    var objectName = staticSegments.length ? staticSegments[staticSegments.length - 1] : 'resource';
    var parentName = staticSegments.length > 1 ? staticSegments[staticSegments.length - 2] : objectName;
    objectName = humanizeObjectName(objectName);
    parentName = humanizeObjectName(parentName);

    if (method === 'GET') {
      if (segments.length && segments[segments.length - 1].indexOf('{') !== -1) return 'get ' + singularize(parentName);
      if (objectName === 'search') return 'search ' + singularize(parentName);
      return 'list ' + objectName;
    }
    if (method === 'POST') {
      if (segments.length > 1 && segments[segments.length - 1].indexOf('{') === -1 && staticSegments.length > 1) {
        return humanizeObjectName(staticSegments[staticSegments.length - 1]) + ' ' + singularize(parentName);
      }
      return 'create ' + singularize(objectName);
    }
    if (method === 'PATCH' || method === 'PUT') {
      return 'update ' + singularize(parentName);
    }
    if (method === 'DELETE') {
      return 'delete ' + singularize(parentName);
    }
    return method.toLowerCase() + ' ' + singularize(objectName);
  }

  function humanizeObjectName(value) {
    if (!value) return 'resource';
    return value.replaceAll('-', ' ').replaceAll('_', ' ');
  }

  function singularize(value) {
    if (!value) return value;
    if (value.endsWith('ies')) return value.slice(0, -3) + 'y';
    if (value.endsWith('s') && value.length > 1) return value.slice(0, -1);
    return value;
  }

  function humanizeSignalLabel(signal) {
    var map = {
      'snapshot-heavy-response': 'snapshot-heavy',
      'deeply-nested-response-structure': 'deeply-nested',
      'duplicated-state-response': 'duplicated state',
      'incidental-internal-field-exposure': 'incidental fields',
      'weak-outcome-next-action-guidance': 'weak guidance',
      'missing-next-action': 'missing next-action',
      'storage-shaped-response': 'storage-shaped',
      'response appears snapshot-heavy': 'snapshot-heavy',
      'deep nesting appears likely': 'deep nesting',
      'duplicated state appears likely': 'duplicated state',
      'incidental/internal fields appear to dominate': 'internal fields',
      'source-of-truth fields are unclear': 'unclear source-of-truth',
      'outcome framing is easy to miss': 'missing outcome framing',
      'next action is weakly exposed': 'missing next-action cues',
      'hidden token/context handoff appears likely': 'hidden handoff',
      'next step not clearly exposed': 'unclear next-step',
      'sequencing appears brittle': 'brittle sequencing',
      'auth/header burden spread across steps': 'auth/header spread',
      'parameter naming drift appears likely': 'parameter name drift',
      'path style drift appears likely': 'path style drift',
      'response shape drift appears likely': 'response shape drift',
      'outcome modeled differently across similar endpoints': 'outcome mismatch',
      'parameter names differ': 'parameter name drift',
      'path patterns differ': 'path pattern drift',
      'response shapes differ': 'response shape drift',
      'outcome wording differs': 'outcome mismatch'
    };
    return map[signal] || signal.replaceAll('-', ' ');
  }

  function renderRecoveryActions(actions) {
    return '<div class="recovery-actions">' + actions.map(function (action) {
      return '<button type="button" class="secondary-action" data-recovery-action="' + escapeHtml(action) + '">' + escapeHtml(recoveryLabel(action)) + '</button>';
    }).join('') + '</div>';
  }

  function bindRecoveryButtons(container) {
    if (!container) return;
    Array.prototype.forEach.call(container.querySelectorAll('[data-recovery-action]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        applyRecoveryAction(btn.getAttribute('data-recovery-action'));
      });
    });
  }

  function applyRecoveryAction(action) {
    if (action === 'clear-search') {
      state.filters.search = '';
    } else if (action === 'reset-burden') {
      state.filters.burden = 'all';
      state.filters.category = 'all';
    } else if (action === 'show-all-families') {
      state.filters.search = '';
      state.filters.familyPressure = 'all';
      state.expandedFamily = '';

      if (state.activeTopTab === 'spec-rule') {
        state.activeTopTab = 'spec-rule';
        state.filters.category = 'spec-rule';
        state.filters.burden = 'all';
        state.filters.includeNoIssueRows = false;
        state.endpointDiagnosticsSubTab = 'exact';
        state.detailEvidenceOpenForId = '';
      }
    } else if (action === 'show-all-workflows') {
      state.filters.search = '';
      state.filters.category = 'all';
      state.filters.burden = 'all';
      state.filters.familyPressure = 'all';
    } else if (action === 'include-no-issue-rows') {
      state.filters.includeNoIssueRows = true;
    } else if (action === 'clear-current-lens') {
      if (state.activeTopTab === 'spec-rule') {
        state.activeTopTab = 'spec-rule';
        state.filters.search = '';
        state.filters.category = 'spec-rule';
        state.filters.burden = 'all';
        state.filters.familyPressure = 'all';
        state.filters.includeNoIssueRows = false;
        state.expandedFamily = '';
        state.detailEvidenceOpenForId = '';
        state.endpointDiagnosticsSubTab = 'exact';
        state.selectedEndpointId = '';
      } else {
        clearCurrentLens();
        return;
      }
    }

    if (state.activeTopTab === 'shape') {
      state.endpointDiagnosticsSubTab = 'summary';
    }

    state.selectedEndpointId = firstVisibleEndpointId(filteredRows());
    render();
    pulseLensUpdate();
  }

  function pulseLensUpdate() {
    [el.familySurfaceContext, el.listContext, el.workflowSection].forEach(function (node) {
      if (!node) return;
      node.classList.remove('lens-updated');
      void node.offsetWidth;
      node.classList.add('lens-updated');
    });
  }

  function recoveryLabel(action) {
    if (action === 'clear-search') return 'Clear search';
    if (action === 'reset-burden') return 'Reset burden';
    if (action === 'show-all-families') return 'Show all matching families';
    if (action === 'show-all-workflows') return 'Show all workflow patterns';
    if (action === 'include-no-issue-rows') return 'Include no-issue rows';
    return 'Reset current view';
  }

  function issueDimensionForFinding(code, category, burdenFocus) {
    if (!code) return category ? category.replaceAll('-', ' ') : 'other issues';
    if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response') return 'shape / storage-style response weakness';
    if (code === 'duplicated-state-response') return 'shape / duplicated state exposure';
    if (code === 'incidental-internal-field-exposure') return 'internal/incidental fields';
    if (code === 'deeply-nested-response-structure') return 'shape / nesting complexity';
    if (code === 'prerequisite-task-burden') return 'hidden dependency / linkage burden';
    if (code === 'weak-list-detail-linkage' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
      return 'workflow outcome weakness';
    }
    if (code === 'weak-outcome-next-action-guidance') return 'workflow outcome weakness';
    if (code === 'weak-array-items-schema') return 'shape / nesting complexity';
    if (code === 'internal-incidental-field') return 'internal/incidental fields';
    if (code === 'sibling-path-shape-drift' || code === 'endpoint-path-style-drift' || code === 'detail-path-parameter-name-drift') return 'consistency drift';
    if (code === 'likely-missing-enum' || code === 'generic-object-request' || code === 'generic-object-response') return 'typing/enum weakness';
    if ((category || '') === 'change-risk') return 'change-risk clues';
    if ((burdenFocus || '') === 'workflow-burden') return 'hidden dependency / linkage burden';
    if ((burdenFocus || '') === 'contract-shape') return 'shape / storage-style response weakness';
    if ((burdenFocus || '') === 'consistency') return 'consistency drift';
    return (category || 'other issues').replaceAll('-', ' ');
  }

  function dimensionImpact(dimension) {
    switch (dimension) {
      case 'typing/enum weakness':
        return 'Clients cannot type-check valid values reliably, increasing runtime integration errors.';
      case 'shape / storage-style response weakness':
        return 'Clients must issue follow-up reads to confirm outcome, adding latency and uncertainty.';
      case 'hidden dependency / linkage burden':
        return 'Multi-step flows become fragile because required IDs/state are not surfaced directly.';
      case 'workflow outcome weakness':
        return 'Clients cannot confirm completion or next step cleanly after action/accepted responses.';
      case 'shape / nesting complexity':
        return 'Nested or weak shape contracts complicate generated models and parsing logic.';
      case 'shape / duplicated state exposure':
        return 'Repeated state across branches increases scan noise and can obscure the primary outcome.';
      case 'internal/incidental fields':
        return 'Leaking internal fields couples clients to implementation details.';
      case 'consistency drift':
        return 'Inconsistent path or payload patterns increase learning and maintenance cost.';
      case 'change-risk clues':
        return 'Deprecated or unstable paths can break existing client flows without migration planning.';
      default:
        return 'This evidence suggests avoidable client burden in the contract.';
    }
  }

  function findingExamineHint(code, message) {
    switch (code) {
      case 'weak-list-detail-linkage':
      case 'weak-follow-up-linkage': {
        var missingField = (message || '').match(/\(no ([^)]+)\)/);
        var field = missingField ? missingField[1] : 'an id field';
        return 'Add ' + field + ' to the response schema so the next request can be formed directly.';
      }
      case 'weak-action-follow-up-linkage':
        return 'Add state or resource identifier in the action response so clients can confirm outcome without guessing.';
      case 'weak-accepted-tracking-linkage':
        return 'Add tracking URL or task ID in the 202 response body to support deterministic polling.';
      case 'weak-outcome-next-action-guidance':
        return 'Add explicit outcome/status and next-step handoff fields so callers can safely continue the workflow.';
      case 'likely-missing-enum': {
        var enumField = (message || '').match(/property '([^']+)'/);
        return 'Declare enum values for ' + (enumField ? enumField[1] : 'the property') + ' in schema.';
      }
      case 'prerequisite-task-burden':
        return 'Expose prerequisite identifier/state in parent response or simplify required task linkage.';
      case 'contract-shape-workflow-guidance-burden':
      case 'snapshot-heavy-response':
        return 'Return a compact outcome payload with explicit status/link rather than a full snapshot.';
      case 'deeply-nested-response-structure':
        return 'Flatten the response so outcome and next-action fields are visible near the top level.';
      case 'duplicated-state-response':
        return 'Reduce repeated branch snapshots and keep one authoritative outcome-oriented state view.';
      case 'incidental-internal-field-exposure':
        return 'Hide backend-oriented metadata fields and keep only workflow-handoff-relevant response fields.';
      case 'sibling-path-shape-drift':
      case 'endpoint-path-style-drift':
      case 'detail-path-parameter-name-drift':
        return 'Align path parameter names and response shapes across sibling endpoints.';
      case 'generic-object-request':
        return 'Replace the generic request object with explicit named properties.';
      case 'generic-object-response':
        return 'Replace the generic response object with explicit named properties.';
      case 'internal-incidental-field':
        return 'Hide internal or incidental fields from the public response schema.';
      default:
        return 'Inspect the schema section referenced by the issue message and tighten the contract.';
    }
  }

  function buildContextTypeBadge(context) {
    var label = context.primaryLabel || '';
    var text = '';
    if (label.indexOf('Request') !== -1) {
      text = 'Request';
    } else if (label.indexOf('Response') !== -1) {
      text = context.statusCode ? 'Response ' + context.statusCode : 'Response';
    } else if (label.indexOf('Path') !== -1) {
      text = 'Path';
    }
    if (!text) return '';
    return '<span class="context-type-badge">' + escapeHtml(text) + '</span>';
  }

  function dimensionCleanerHint(dimension) {
    switch (dimension) {
      case 'typing/enum weakness':
        return 'declare explicit enum values for finite value sets; avoid bare string with no schema constraints';
      case 'shape / storage-style response weakness':
        return 'return a compact outcome payload focused on the client\'s next action, not a storage snapshot';
      case 'hidden dependency / linkage burden':
        return 'expose the prerequisite identifier or state directly in the parent response so the next call can be formed without extra negotiation';
      case 'workflow outcome weakness':
        return 'include a tracking ID or direct link to the created/updated resource in every action or 202 Accepted response';
      case 'shape / nesting complexity':
        return 'declare typed item schemas on all array properties; avoid generic object or empty items schema';
      case 'internal/incidental fields':
        return 'strip join columns, audit timestamps, and storage-internal IDs from public response schemas';
      case 'consistency drift':
        return 'align path parameter names and response field names across sibling endpoints operating on the same resource';
      case 'change-risk clues':
        return 'add deprecation notices and migration guidance before removing or changing visible behaviour';
      default:
        return 'tighten the schema to names and shapes that directly serve the client\'s operations, not the server\'s storage model';
    }
  }

  function familyPressureLabel(priorityCounts) {
    var high = priorityCounts.high || 0;
    var medium = priorityCounts.medium || 0;
    if (high >= 3) return 'high';
    if (high > 0 || medium >= 3) return 'medium';
    return 'low';
  }

  function summarizeIssueDimensions(findings) {
    var counts = {};
    findings.forEach(function (finding) {
      var label = issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus);
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 6)
      .map(function (entry) { return { label: entry[0], count: entry[1] }; });
  }

  function topFamilyByFindings(rows) {
    if (!rows || !rows.length) return { name: 'none', findings: 0 };
    var counts = {};
    rows.forEach(function (row) {
      counts[row.family] = (counts[row.family] || 0) + row.findings;
    });
    var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    return ranked.length ? { name: ranked[0][0], findings: ranked[0][1] } : { name: 'none', findings: 0 };
  }

  function humanFamilyLabel(name) {
    if (!name) return 'unlabeled family';
    if (name === '/aggregate') return '/aggregate (cross-resource utility)';
    return name;
  }

  function renderChipList(items, emptyText) {
    if (!items || !items.length) return '<p class="subtle">' + escapeHtml(emptyText) + '</p>';
    return '<div class="chips">' + items.map(function (item) {
      return '<span class="chip">' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
  }

  function renderBulletList(items, emptyText) {
    if (!items || !items.length) return '<p class="subtle">' + escapeHtml(emptyText) + '</p>';
    return '<ul>' + items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
  }

  function renderOpenAPISummary(items) {
    if (!items || !items.length) {
      return '<p class="subtle">OpenAPI location is only available where the message exposes request, response, field, or media-type detail.</p>';
    }
    return '<div class="openapi-summary-list">' + items.map(function (item) {
      return '<span class="openapi-pill">' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
  }

  function priorityRank(priority) {
    if (priority === 'high') return 0;
    if (priority === 'medium') return 1;
    return 2;
  }

  function uniq(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  function flatMap(items, fn) {
    return items.reduce(function (acc, item) { return acc.concat(fn(item)); }, []);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
