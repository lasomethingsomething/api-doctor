(function () {
		  var state = {
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
		    detachedInspectorVisible: false,
		    shapeWorkspaceCollapsed: false,
			    issueScopeIndex: null,
			    issueScopeIndexKey: "",
			    familyTableShowAll: false,
			    workflowChainsOpen: true,
			    inspectorWorkflowContextOpen: null,
	    familyTableBackState: null,
	    familyTableSort: {
	      key: 'default',
	      direction: 'asc'
	    },
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
    filterEmptyState: document.getElementById("filterEmptyState"),
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
		      // Default to no selected endpoint. Selection should be user-driven via "Inspect endpoint"
		      // so row highlighting never sticks to an arbitrary auto-picked row.
		      state.selectedEndpointId = "";
		      state.userSelectedEndpoint = false;
		      bindControls();
		      renderFilterOptions();
		      render();
		    });

			  function bindControls() {
			    el.searchInput.addEventListener("input", function (e) {
			      var prevSearch = state.filters.search || "";
			      var nextSearch = e.target.value.trim().toLowerCase();
		      // If the user manually narrows to an exact family name, treat it as a drill-in
		      // and enable "Back to all families" to restore the prior search.
		      if (!state.familyTableBackState && prevSearch !== nextSearch && isExactFamilyName(nextSearch)) {
		        captureFamilyTableBackStateIfNeeded({ search: prevSearch });
		      }
			      state.filters.search = nextSearch;
			      // Search/filter changes should clear the previous selection highlight immediately.
			      state.selectedEndpointId = '';
			      state.userSelectedEndpoint = false;
			      state.detailEvidenceOpenForId = '';
			      invalidateDerivedCaches();
			      state.familyTableShowAll = false;
			      render();
			    });
			    el.categoryFilter.addEventListener("change", function (e) {
			      state.filters.category = e.target.value;
		      normalizeLensFilters('category');
		      state.selectedEndpointId = '';
		      state.userSelectedEndpoint = false;
		      state.detailEvidenceOpenForId = '';
		      invalidateDerivedCaches();
		      state.familyTableShowAll = false;
		      render();
		    });
		    el.burdenFilter.addEventListener("change", function (e) {
		      state.filters.burden = e.target.value;
		      normalizeLensFilters('burden');
		      state.selectedEndpointId = '';
		      state.userSelectedEndpoint = false;
		      state.detailEvidenceOpenForId = '';
		      invalidateDerivedCaches();
		      state.familyTableShowAll = false;
		      render();
		    });
		    el.familyPriorityFilter.addEventListener("change", function (e) {
		      state.filters.familyPressure = e.target.value;
		      state.selectedEndpointId = '';
		      state.userSelectedEndpoint = false;
		      state.detailEvidenceOpenForId = '';
		      invalidateDerivedCaches();
		      state.familyTableShowAll = false;
		      render();
		    });
		    el.includeNoIssueRows.addEventListener("change", function (e) {
		      state.filters.includeNoIssueRows = e.target.checked;
		      state.selectedEndpointId = '';
		      state.userSelectedEndpoint = false;
		      state.detailEvidenceOpenForId = '';
		      invalidateDerivedCaches();
		      state.familyTableShowAll = false;
		      render();
		    });
		  }

		  function invalidateDerivedCaches() {
		    // Filters change what "in-scope" findings mean. Clear cached derived state so
		    // tables/inspector always re-derive from the current filter values.
		    state.issueScopeIndex = null;
		    state.issueScopeIndexKey = '';
		  }

		  function isExactFamilyName(value) {
		    if (!value) return false;
		    if (value.charAt(0) !== '/') return false;
		    if (!state.payload || !state.payload.endpoints) return false;
		    return (state.payload.endpoints || []).some(function (row) {
		      return (row.family || '').trim().toLowerCase() === value;
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
      { value: "workflow-burden", label: "workflow guidance" },
      { value: "contract-shape", label: "response shape" }
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
	    renderFilterEmptyState();
	    syncLensVisualIdentity();
	    renderWorkflowChains();
	    renderFamilySurface();
	    renderEndpointDiagnostics();
	    renderEndpointRows();
	    renderEndpointDetail();
	  }

  function enforceSpecRuleTabFilterModel() {
    if (state.activeTopTab !== 'spec-rule') return;

    if (state.endpointDiagnosticsSubTab !== 'exact'
        && state.endpointDiagnosticsSubTab !== 'consistency'
        && state.endpointDiagnosticsSubTab !== 'cleaner'
        && state.endpointDiagnosticsSubTab !== 'summary') {
      state.endpointDiagnosticsSubTab = 'exact';
    }

    var specRows = filteredRows();
    if (!specRows.length) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      return;
    }

    if (state.selectedEndpointId && !specRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      // Do not auto-pick a new endpoint in this tab. Selection is user-driven via "Inspect endpoint".
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
    }
  }

  function enforceWorkflowTabFilterModel() {
    if (state.activeTopTab !== 'workflow') return;

    if (state.endpointDiagnosticsSubTab === 'consistency' || state.endpointDiagnosticsSubTab === 'cleaner') {
      state.endpointDiagnosticsSubTab = 'summary';
    }

    // Workflow Guidance is continuity-focused. Keep filters aligned so we don't
    // drift into rules-based or response-shape redesign surfaces.
    if (state.filters.category === 'spec-rule' || state.filters.category === 'contract-shape') {
      state.filters.category = 'all';
    }
    // Keep the tab anchored on continuity burden signals.
    state.filters.burden = 'workflow-burden';

    var workflowRows = selectionRowsForActiveView();
    if (!workflowRows.length) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      return;
    }

    if (state.selectedEndpointId && !workflowRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
    }
  }

  function enforceShapeTabFilterModel() {
    if (state.activeTopTab !== 'shape') return;

    if (state.endpointDiagnosticsSubTab === 'consistency') {
      state.endpointDiagnosticsSubTab = 'summary';
    }

    // Response Shape is contract-design focused. Keep filters aligned so we don't
    // drift into rules-based or workflow continuity-only surfaces.
    if (state.filters.category === 'spec-rule' || state.filters.category === 'workflow-burden') {
      state.filters.category = 'all';
    }
    state.filters.burden = 'contract-shape';

    var shapeRows = selectionRowsForActiveView();
    if (!shapeRows.length) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      state.endpointDiagnosticsSubTab = 'summary';
      return;
    }

    if (state.selectedEndpointId && !shapeRows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = '';
      state.detailEvidenceOpenForId = '';
      state.endpointDiagnosticsSubTab = 'summary';
    }
  }

	  function syncLensVisualIdentity() {
	    if (!document || !document.body) return;
	    var shapeActive = state.activeTopTab === 'shape';
	    var workflowActive = state.activeTopTab === 'workflow';
	    var specActive = state.activeTopTab === 'spec-rule';
	    document.body.classList.toggle('lens-shape', shapeActive);
	    document.body.classList.toggle('lens-workflow', workflowActive);
	    document.body.classList.toggle('lens-spec-rule', specActive);

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

    if (state.selectedEndpointId && !rows.some(function (row) { return row.id === state.selectedEndpointId; })) {
      // Do not auto-pick a different endpoint. If selection is no longer valid, clear it.
      state.selectedEndpointId = '';
    }
  }

  function renderHeader() {
    var run = state.payload.run || {};
    var diffTag = run.baseSpecPath && run.headSpecPath ? (' | diff: ' + run.baseSpecPath + ' -> ' + run.headSpecPath) : '';
    el.runContext.textContent = 'spec: ' + run.specPath + ' | generated: ' + run.generatedAt + diffTag;
  }

	  function renderQuickActions() {
	    var actions = [
	      { id: "spec-rule", label: "Contract Issues", copy: "OpenAPI rule violations (REQUIRED vs SHOULD) and consistency drift", color: 'spec-rule' },
	      { id: "workflow", label: "Workflow Guidance", copy: "Inferred call chains, continuity burden, hidden dependencies, and sequencing traps", color: 'workflow' },
	      { id: "shape", label: "Response Shape", copy: "Storage-shaped responses, duplicated state, internal fields, and workflow-first redesign guidance", color: 'shape' }
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

    // Switching tabs should never inherit horizontal scroll from a previous (wider) table.
    // This prevents the FAMILY column from rendering partially off-screen (left-clipped).
    if (el.familySurface) el.familySurface.scrollLeft = 0;
    if (el.endpointRows) {
      var endpointSurface = el.endpointRows.closest('.endpoint-list-surface');
      if (endpointSurface) endpointSurface.scrollLeft = 0;
    }

    state.activeTopTab = id;
    state.expandedFamily = "";
    state.expandedFamilyInsight = "";
    state.expandedEndpointInsightIds = {};
    state.expandedEndpointRowFindings = {};
    state.detailEvidenceOpenForId = '';
    // Switching tabs should never keep a stale selected-row highlight from the prior tab.
    state.selectedEndpointId = '';
    state.userSelectedEndpoint = false;

    state.filters.includeNoIssueRows = false;
    state.filters.familyPressure = "all";

    if (id === "spec-rule") {
      state.filters.search = "";
      state.filters.category = "spec-rule";
      state.filters.burden = "all";
      state.endpointDiagnosticsSubTab = "exact";
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

    render();

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

  function isConsistencyDriftFinding(finding) {
    if (!finding) return false;
    var code = finding.code || '';
    return code === 'detail-path-parameter-name-drift'
      || code === 'endpoint-path-style-drift'
      || code === 'sibling-path-shape-drift'
      || code === 'inconsistent-response-shape'
      || code === 'inconsistent-response-shape-family'
      || code === 'inconsistent-response-shapes'
      || code === 'inconsistent-response-shapes-family'
      || (finding.burdenFocus || '') === 'consistency';
  }

  function isWorkflowContinuityFinding(finding) {
    if (!finding) return false;
    if (isSpecRuleFinding(finding)) return false;
    if ((finding.burdenFocus || '') === 'workflow-burden') return true;
    var code = finding.code || '';
    if (code === 'prerequisite-task-burden') return true;
    if (code === 'weak-list-detail-linkage') return true;
    if (code === 'weak-follow-up-linkage') return true;
    if (code === 'weak-action-follow-up-linkage') return true;
    if (code === 'weak-accepted-tracking-linkage') return true;
    if (code === 'weak-outcome-next-action-guidance') return true;
    // Token/context risks: allow explicit auth/context burden notes to remain visible in this tab.
    var msg = (finding.message || '').toLowerCase();
    if (/token|bearer|authorization|api[-\s]?key|auth|header|context transfer|handoff/.test(msg)) return true;
    return false;
  }

  function isResponseShapeFinding(finding) {
    if (!finding) return false;
    if (isSpecRuleFinding(finding)) return false;
    // Keep Response Shape focused on storage-shaped vs task-shaped contract design.
    // Do not admit generic workflow chaining/traps (those belong in Workflow Guidance).
    var code = finding.code || '';
    return code === 'deeply-nested-response-structure'
      || code === 'duplicated-state-response'
      || code === 'incidental-internal-field-exposure'
      || code === 'snapshot-heavy-response'
      || code === 'contract-shape-workflow-guidance-burden'
      || code === 'weak-outcome-next-action-guidance';
  }

  function isSpecRuleFinding(finding) {
    if (!finding) return false;
    return finding.evidenceType === 'spec-rule' || (finding.category || '') === 'spec-rule';
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
		    var out = all;

		    // Contract Issues: strictly rules + required-vs-should guidance + consistency drift.
		    // Do not allow workflow-chain or response-shape redesign guidance to leak into this tab.
		    if (state.activeTopTab === 'spec-rule') {
		      out = out.filter(function (f) {
		        return isSpecRuleFinding(f) || isConsistencyDriftFinding(f);
		      });
		    }

		    // Workflow Guidance: only inferred chain/continuity burden signals.
		    // Do not admit generic contract-rule clustering or response-shape redesign guidance here.
		    if (state.activeTopTab === 'workflow') {
		      out = out.filter(isWorkflowContinuityFinding);
		    }

		    // Response Shape: only shape-focused design burdens (storage-shaped vs task-shaped).
		    if (state.activeTopTab === 'shape') {
		      out = out.filter(isResponseShapeFinding);
		    }

		    // When the burden filter is set to "contract-shape", apply the shape-scoped
		    // heuristic filter so we do not pollute the view with unrelated findings.
		    if (state.filters.burden === 'contract-shape') {
		      out = out.filter(isShapeScopedFinding);
		    }

		    // Category filter narrows to a specific finding category (including spec-rule).
		    if (state.filters.category && state.filters.category !== 'all') {
		      if (state.filters.category === 'spec-rule') {
		        out = out.filter(function (f) {
		          // In the Contract Issues tab, "spec-rule" means "spec-rule + drift" as the
		          // tab's explicit scope includes consistency drift by default.
		          if (state.activeTopTab === 'spec-rule') {
		            return isSpecRuleFinding(f) || isConsistencyDriftFinding(f);
		          }
		          return isSpecRuleFinding(f);
		        });
		      } else {
		        out = out.filter(function (f) {
		          if (!f) return false;
		          return (f.category || '') === state.filters.category;
	        });
	      }
	    }

	    // Burden filter narrows to findings attached to that burden focus. For
	    // "contract-shape" we already applied the stronger code-based scoping.
		    if (state.activeTopTab !== 'workflow' && state.filters.burden && state.filters.burden !== 'all' && state.filters.burden !== 'contract-shape') {
		      out = out.filter(function (f) {
		        return !!f && (f.burdenFocus || '') === state.filters.burden;
		      });
		    }

		    return out;
		  }

	  function lensFindingCountForRow(row) {
	    if (!row || !row.id || !state.payload || !state.payload.endpointDetails) return 0;
	    var detail = state.payload.endpointDetails[row.id];
	    if (detail && detail.findings) {
	      return findingsForActiveLens(detail.findings || []).length;
	    }

	    // Fallback when endpointDetails is missing. Prefer the table row's precomputed
	    // counts so rows remain visible and Inspect can still open the inspector.
	    var categoryCounts = row.categoryCounts || {};
	    var category = state.filters.category || 'all';
	    var burden = state.filters.burden || 'all';

	    var base = (row.findings || 0);
	    if (category !== 'all') {
	      base = categoryCounts[category] || 0;
	    }

	    if (burden !== 'all') {
	      // If the endpoint doesn't even claim this burden focus, treat as out of lens.
	      if ((row.burdenFocuses || []).indexOf(burden) === -1) return 0;
	      // When category is "all", use burden category counts (when present) as a better approximation.
	      if (category === 'all') {
	        base = Math.max(base, categoryCounts[burden] || 0);
	      }
	    }

	    return base;
	  }

	  function hasValidSelectedEndpointInCurrentView() {
	    if (!state.selectedEndpointId) return false;
	    // Validate against the current scope (not just evidence-only rows) so Inspect
	    // does not silently fail when endpointDetails is missing or when the endpoint
	    // is selected via an expansion/chain.
	    return rowsInScopeAll().some(function (row) {
	      return row.id === state.selectedEndpointId;
	    });
	  }

		  function selectionRowsForActiveView() {
		    return filteredRows();
		  }

	  function issueScopeIndexCacheKey() {
	    var f = state.filters || {};
	    return [
	      state.activeTopTab,
	      f.search || '',
	      f.category || '',
	      f.burden || '',
	      f.familyPressure || '',
	      f.includeNoIssueRows ? '1' : '0'
	    ].join('|');
	  }

	  function findingGroupKey(finding) {
	    if (!finding) return '';
	    if (finding.evidenceType === 'spec-rule' && finding.specRuleId) {
	      return 'spec-rule|' + finding.specRuleId;
	    }
	    var context = extractOpenAPIContext(finding);
	    return [finding.code || '', context.primaryLabel || '', context.primaryValue || '', context.mediaType || '', context.statusCode || ''].join('|');
	  }

	  function buildIssueScopeIndexForCurrentView() {
	    var rows = selectionRowsForActiveView();
	    var index = {
	      keyToEndpointIds: {},
	      keyToFamilies: {},
	      keyFamilyToEndpointIds: {}
	    };

	    rows.forEach(function (row) {
	      var family = row.family || 'unlabeled family';
	      var detail = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails[row.id] : null;
	      if (!detail || !detail.findings) return;
	      var findings = findingsForActiveLens(detail.findings || []);
	      if (!findings.length) return;

	      findings.forEach(function (finding) {
	        var key = findingGroupKey(finding);
	        if (!key) return;

	        if (!index.keyToEndpointIds[key]) index.keyToEndpointIds[key] = {};
	        index.keyToEndpointIds[key][row.id] = true;

	        if (!index.keyToFamilies[key]) index.keyToFamilies[key] = {};
	        index.keyToFamilies[key][family] = true;

	        var famKey = key + '||' + family;
	        if (!index.keyFamilyToEndpointIds[famKey]) index.keyFamilyToEndpointIds[famKey] = {};
	        index.keyFamilyToEndpointIds[famKey][row.id] = true;
	      });
	    });

	    return index;
	  }

	  function getIssueScopeIndex() {
	    var key = issueScopeIndexCacheKey();
	    if (state.issueScopeIndex && state.issueScopeIndexKey === key) {
	      return state.issueScopeIndex;
	    }
	    state.issueScopeIndex = buildIssueScopeIndexForCurrentView();
	    state.issueScopeIndexKey = key;
	    return state.issueScopeIndex;
	  }

	  function issueScopeLabelForKey(groupKey, familyName) {
	    if (!groupKey) return 'Endpoint only';
	    var idx = getIssueScopeIndex();
	    var endpoints = idx.keyToEndpointIds[groupKey] || {};
	    var endpointCount = Object.keys(endpoints).length;
	    if (endpointCount <= 1) return 'Endpoint only';
	    var families = idx.keyToFamilies[groupKey] || {};
	    var familyCount = Object.keys(families).length;
	    if (familyCount > 1) return 'Repeated across current view';
	    var famKey = groupKey + '||' + (familyName || 'unlabeled family');
	    var famEndpoints = idx.keyFamilyToEndpointIds[famKey] || {};
	    if (Object.keys(famEndpoints).length > 1) return 'Repeated across family';
	    return 'Repeated across current view';
	  }

  function renderEndpointDiagnosticsEmptyState() {
    var families = familySummaries();
    if (!families.length) {
      return '<div class="empty">'
        + '<strong>Nothing to inspect yet</strong>'
        + '<p class="subtle">No families match the current filters, so no endpoint can be selected. Widen the filters above to continue.</p>'
        + '</div>';
    }
    return '<div class="empty">'
      + '<p class="subtle">Select an endpoint from an expanded family row above to inspect summary, evidence, drift, and contract improvements.</p>'
      + '</div>';
  }

	  function evidenceSectionTitleForActiveLens() {
	    if (state.activeTopTab === 'workflow') return 'Evidence of workflow continuity risk';
	    if (state.activeTopTab === 'shape') return 'Evidence of response-shape burden';
	    return 'Evidence of contract violations';
	  }

	  function evidenceGroupsSummaryLabel(groupCount) {
	    var count = (typeof groupCount === 'number' && isFinite(groupCount)) ? groupCount : 0;
	    return evidenceSectionTitleForActiveLens() + ' (' + count + ' by schema field and issue type)';
	  }

	  function evidenceGroupsGroupingBasisCopy() {
	    return 'Grouped by schema field and issue type.';
	  }

  function exactEvidenceTargetLabel() {
    if (state.activeTopTab === 'workflow') return 'Workflow-context evidence';
    if (state.activeTopTab === 'shape') return 'Shape burden evidence';
    return 'Exact contract evidence';
  }

	  function exactEvidenceTabLabelWithCount() {
	    var label = exactEvidenceTargetLabel();
	    var detail = state.selectedEndpointId ? endpointDetailForId(state.selectedEndpointId) : null;
	    if (!detail || !detail.findings) return label;
	    var groups = groupFindings(findingsForActiveLens(detail.findings || []));
	    var count = groups.length || 0;
	    return label + ' (' + count + ' group' + (count === 1 ? '' : 's') + ')';
	  }

	  function exactEvidenceGroupsSummaryLabel(groupCount) {
	    var count = (typeof groupCount === 'number' && isFinite(groupCount)) ? groupCount : 0;
	    return exactEvidenceTargetLabel() + ' (' + count + ' by schema field and issue type)';
	  }

	  function fullExactEvidenceClosedLabel(groupCount) {
	    var count = (typeof groupCount === 'number' && isFinite(groupCount)) ? groupCount : 0;
	    var unit = count === 1 ? 'group' : 'groups';
	    return 'Open full exact evidence (' + count + ' ' + unit + ')';
	  }

	  function fullExactEvidenceOpenLabel() {
	    return 'Hide full exact evidence';
	  }

		  function renderFullExactEvidenceDrawer(groups, options) {
		    var opts = options || {};
		    var endpoint = opts.endpoint || {};
		    var familyName = opts.familyName || '';
		    var openAttr = opts.open ? ' open' : '';
		    var groupCount = (groups || []).length || 0;
		    var titleLabel = exactEvidenceGroupsSummaryLabel(groupCount);
		    var closeControl = '<div class="details-close-row">'
		      + '<button type="button" class="tertiary-action details-close-btn" data-close-details="1" aria-label="Hide evidence" title="Hide evidence">Hide evidence</button>'
		      + '</div>';

		    var commonScope = '';
		    if (groups && groups.length > 1) {
		      var scopeLabels = groups.map(function (g) {
		        return issueScopeLabelForKey((g && g.groupKey) ? g.groupKey : '', familyName);
		      });
		      commonScope = scopeLabels[0] || '';
		      for (var i = 1; i < scopeLabels.length; i++) {
		        if (scopeLabels[i] !== commonScope) {
		          commonScope = '';
		          break;
		        }
		      }
		    }
		    var scopeLine = commonScope
		      ? '<p class="subtle detail-section-copy detail-section-copy-scope"><strong>Scope:</strong> ' + escapeHtml(commonScope) + '</p>'
		      : '';

		    return '<details class="detail-evidence-drawer" data-full-exact-evidence="1"' + openAttr + '>'
		      + '<summary><span class="evidence-drawer-title">' + escapeHtml(titleLabel) + '</span></summary>'
		      + '<section class="detail-section detail-section-tight">'
		      + closeControl
		      + '  <p class="subtle detail-section-copy">' + escapeHtml(evidenceGroupsGroupingBasisCopy()) + '</p>'
		      + scopeLine
		      + (groups || []).map(function (group, index) {
		          return renderIssueGroup(group, index, { familyName: familyName, endpoint: endpoint, commonScopeLabel: commonScope });
		        }).join('')
		      + '</section>'
		      + '</details>';
		  }

	  function renderEndpointDiagnosticsTabs() {
	    var tabs = [
	      { id: 'summary', label: 'Endpoint summary', description: 'what is wrong and why it matters' },
	      { id: 'exact', label: exactEvidenceTabLabelWithCount(), description: 'grouped instances with explicit evidence target and schema grounding' },
      { id: 'consistency', label: 'Consistency / drift', description: 'sibling-route comparison' },
      { id: 'cleaner', label: 'Contract improvements', description: 'concrete response and schema changes' }
    ];
    var activeTab = tabs.find(function (tab) {
      return tab.id === state.endpointDiagnosticsSubTab;
    }) || tabs[0];

    return '<div class="endpoint-diag-tabs-wrap">'
      + '<div class="endpoint-diag-tabs">'
      + tabs.map(function (tab) {
          var active = state.endpointDiagnosticsSubTab === tab.id ? ' active' : '';
          return '<button type="button" class="endpoint-diag-tab' + active + '" data-endpoint-subtab="' + tab.id + '">' + escapeHtml(tab.label) + '</button>';
        }).join('')
      + '</div>'
      + '<p class="endpoint-diag-tab-description">' + escapeHtml(activeTab.description) + '</p>'
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
    var openApiPills = renderOpenAPIContextPills(topContext, true);
    var specGrounding = topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '';
    var groundingBits = '';
    if (openApiPills) {
      groundingBits += '<span class="grounding-label">OpenAPI location cues (when available)</span>' + openApiPills;
    }
    if (specGrounding) {
      groundingBits += specGrounding;
    }
    var groundingHtml = groundingBits
      ? ('    <div class="lead-finding-grounding">' + groundingBits + '</div>')
      : '';

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
      + groundingHtml
      + '  </div>'
      + '</div>'
      + '</div>';
  }

	  function renderWorkflowChainContextForEndpoint(detail) {
    // Renders the step-by-step inferred endpoint chain in which this endpoint appears.
    // Highlights the current endpoint's position and shows purpose, state/context, traps, and next action for each step.
    var endpoint = detail.endpoint || {};
    var endpointId = endpoint.id || state.selectedEndpointId;
    var relatedChains = detail.relatedChains || [];
    
    if (!relatedChains.length) return '';

    // Use the primary chain or the one with the highest burden score
    var primaryChain = relatedChains[0];
    var steps = primaryChain.endpointIds || [];
    var currentStepIndex = steps.indexOf(endpointId);
    var roles = parseChainRoles(primaryChain.summary, steps.length);

    var taskLabel = chainTaskLabel(primaryChain);
    var chainKindLabel = kindGroupLabel(primaryChain.kind || 'workflow');
    
    var stepElements = steps.map(function (eid, stepIdx) {
      var nextEid = stepIdx < (steps.length - 1) ? steps[stepIdx + 1] : '';
      var isCurrent = (stepIdx === currentStepIndex);
      var isAfterCurrent = (stepIdx > currentStepIndex);
      var detail = state.payload.endpointDetails[eid];
      if (!detail) return '';
      
      var ep = detail.endpoint;
      var findings = detail.findings || [];
      var role = roles[stepIdx] || '';
      var nextEp = nextEid ? state.payload.endpointDetails[nextEid] : null;
      var nextRole = roles[stepIdx + 1] || '';
      
      return renderInspectorWorkflowChainStep(eid, stepIdx, steps.length, role, nextEid, nextRole, isCurrent, isAfterCurrent, findings, ep, nextEp ? nextEp.endpoint : null);
    }).join('');

    var html = '<div class="workflow-chain-context-card">'
      + '<div class="workflow-chain-context-header">'
      + '<p class="workflow-chain-kicker">' + escapeHtml(chainKindLabel) + '</p>'
      + '<p class="workflow-chain-task"><strong>' + escapeHtml(taskLabel) + '</strong>'
      + ' <span class="workflow-chain-meta">' + steps.length + ' steps</span></p>'
      + '</div>'
      + '<div class="workflow-chain-steps-container">'
      + stepElements
      + '</div>'
      + '</div>';

    return html;
  }

  function renderInspectorWorkflowChainStep(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel, isCurrent, isAfterCurrent, findings, endpoint, nextEndpoint) {
    // Render a single step in the inferred workflow chain within the inspector.
    // This is a compact view relative to renderWorkflowStep but focuses on guiding developers through the sequence.
    
    var method = endpoint.method || '';
    var path = endpoint.path || '';
    var isLast = stepIndex === (totalSteps - 1);
    
    // Extract key constraint findings for this step
    var shapeFindings = findings.filter(function (f) {
      return f.code === 'contract-shape-workflow-guidance-burden';
    });
    var linkageFindings = findings.filter(function (f) {
      return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
    });
    var prerequisiteFindings = findings.filter(function (f) {
      return f.code === 'prerequisite-task-burden';
    });

	    // Build state/context and trap guidance
	    var dependencyClues = buildWorkflowDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
	    var trapGuidance = collectTrapGuidance(endpoint, findings, dependencyClues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
	    var narrative = summarizeWorkflowStepNarrative(endpoint, roleLabel, nextEndpoint, dependencyClues, findings, linkageFindings, prerequisiteFindings, isLast);

	    // Build reduced trap guidance (show only top 1 for brevity)
	    var trapHtml = '';
	    if (trapGuidance.length) {
	      trapHtml = '<div class="inspector-chain-step-trap">'
	        + '<span class="trap-icon">Trap</span>'
	        + '<span class="trap-text"><strong>Common hidden traps:</strong> ' + escapeHtml(trapGuidance[0].title || trapGuidance[0].happened || trapGuidance[0].id) + '</span>'
	        + '</div>';
	    }

    // Build warnings badges
    var warnings = [];
    if (shapeFindings.length) warnings.push('storage-shaped response');
    if (linkageFindings.length) warnings.push('missing next-step ID');
    if (prerequisiteFindings.length) warnings.push('hidden dependency');
    var warningHtml = warnings.length
      ? '<div class="inspector-chain-step-warnings">' + warnings.join(', ') + '</div>'
      : '';

    // Build the step node
    var roleSlug = roleLabel ? roleLabel.toLowerCase().replace(/[^a-z]/g, '') : '';
    var humanRole = roleLabel ? humanizeStepRole(roleLabel) : 'Step ' + (stepIndex + 1);
    
    var currentClass = isCurrent ? ' inspector-chain-step-current' : (isAfterCurrent ? ' inspector-chain-step-future' : '');
    
	    var html = '<div class="inspector-chain-step' + currentClass + '" data-chain-step-id="' + escapeHtml(endpointId) + '">'
	      + '<div class="inspector-chain-step-number">' + (stepIndex + 1) + '</div>'
	      + '<div class="inspector-chain-step-content">'
	      + '<div class="inspector-chain-step-role">' + escapeHtml(humanRole) + '</div>'
	      + '<div class="inspector-chain-step-endpoint"><strong>' + escapeHtml(method + ' ' + path) + '</strong></div>'
	      + '<div class="inspector-chain-step-purpose"><span class="label">What this call does:</span> ' + escapeHtml(narrative.callDoes) + '</div>'
	      + '<div class="inspector-chain-step-state"><span class="label">What you need before calling it:</span> ' + escapeHtml(narrative.requiredState || 'none explicitly defined') + '</div>'
	      + '<div class="inspector-chain-step-change"><span class="label">What changes after it succeeds:</span> ' + escapeHtml(narrative.changesAfter || '') + '</div>'
	      + (narrative.nextAction ? '<div class="inspector-chain-step-next"><span class="label">What to call next:</span> ' + escapeHtml(narrative.nextAction) + '</div>' : '')
	      + (warningHtml ? warningHtml : '')
	      + (trapHtml ? trapHtml : '')
	      + '</div>'
	      + '</div>';

    return html;
	  }

	  function pickPrimaryWorkflowChainForEndpoint(detail) {
	    var endpoint = (detail && detail.endpoint) ? detail.endpoint : {};
	    var endpointId = endpoint.id || state.selectedEndpointId || '';
	    var chains = (detail && detail.relatedChains) ? detail.relatedChains : [];
	    if (!endpointId || !chains.length) return null;

	    // Prefer the chain with the highest burden score that actually contains this endpoint.
	    var candidates = chains.filter(function (c) {
	      var ids = (c && c.endpointIds) ? c.endpointIds : [];
	      return ids.indexOf(endpointId) >= 0;
	    });
	    if (!candidates.length) return null;

	    candidates.sort(function (a, b) {
	      var as = chainBurdenScore(a || {});
	      var bs = chainBurdenScore(b || {});
	      if (as !== bs) return bs - as;
	      var al = (a && a.endpointIds) ? a.endpointIds.length : 0;
	      var bl = (b && b.endpointIds) ? b.endpointIds.length : 0;
	      if (al !== bl) return bl - al;
	      return String((a && a.kind) || '').localeCompare(String((b && b.kind) || ''));
	    });
	    return candidates[0] || null;
	  }

	  function renderWorkflowStepWorkspace(detail) {
	    var endpoint = (detail && detail.endpoint) ? detail.endpoint : {};
	    var endpointId = endpoint.id || state.selectedEndpointId || '';
	    var chain = pickPrimaryWorkflowChainForEndpoint(detail);
	    if (!endpointId) return '';

	    var steps = chain ? (chain.endpointIds || []) : [];
	    var roles = chain ? parseChainRoles(chain.summary, steps.length) : [];
	    var idx = chain ? steps.indexOf(endpointId) : -1;

	    var findings = findingsForActiveLens((detail && detail.findings) ? detail.findings : []);
	    var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : '';
	    var nextDetail = nextEndpointId ? endpointDetailForId(nextEndpointId) : null;
	    var nextEndpoint = nextDetail ? nextDetail.endpoint : null;

	    var linkageFindings = (detail.findings || []).filter(function (f) {
	      return f && (f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance');
	    });
	    var prerequisiteFindings = (detail.findings || []).filter(function (f) {
	      return f && f.code === 'prerequisite-task-burden';
	    });

	    var clues = buildWorkflowDependencyClues(endpoint, detail.findings || [], Math.max(0, idx), Math.max(1, steps.length || 1), roles[idx] || '', nextEndpoint, roles[idx + 1] || '', linkageFindings, prerequisiteFindings);
	    var narrative = summarizeWorkflowStepNarrative(endpoint, roles[idx] || '', nextEndpoint, clues, detail.findings || [], linkageFindings, prerequisiteFindings, idx >= 0 ? (idx === (steps.length - 1)) : false);

	    var hiddenHandoff = (clues.hidden && clues.hidden.length)
	      ? clues.hidden.slice(0, 2).join(' | ')
	      : (linkageFindings.length
	          ? 'This response does not clearly surface the identifier/context the next step needs.'
	          : 'No obvious hidden handoff signal was detected for this step in the current lens.');

	    var contractFailed = linkageFindings.length
	      ? ('The contract does not make the next-step dependency explicit. It should return the next-step ID/context in an obvious field and document what the next call needs.')
	      : (prerequisiteFindings.length
	          ? 'The contract implies prerequisites without modeling them explicitly (clients must learn ordering at runtime).'
	          : 'The contract burden here is primarily about sequence clarity and context transfer, not a single missing field.');

	    var stepLabel = (idx >= 0 && steps.length) ? ('Step ' + (idx + 1) + ' of ' + steps.length) : 'Current step';
	    var kind = chain && chain.kind ? String(chain.kind).replace(/-/g, ' to ') : 'workflow';
	    var stepPrefix = (chain && steps.length) ? (stepLabel + ' — ' + kind + ' — ') : '';
	    var nextActionFallback = nextEndpoint
	      ? (nextEndpoint.method + ' ' + nextEndpoint.path)
	      : (chain && steps.length ? 'No next step was inferred for this chain.' : 'Expand endpoints in this family and inspect the next likely call.');

	    return '<div class="family-insight-card workflow-step-workspace">'
	      + '<p class="insight-kicker">Workflow step workspace</p>'
	      + '<ul class="family-top-evidence">'
	      + '<li><strong>Current step:</strong> ' + escapeHtml(stepPrefix + endpoint.method + ' ' + endpoint.path) + '</li>'
	      + '<li><strong>What this step needs:</strong> ' + escapeHtml(narrative.requiredState || 'No explicit prerequisites are visible in the contract; treat prior context as required.') + '</li>'
	      + '<li><strong>Hidden handoff/context dependency:</strong> ' + escapeHtml(hiddenHandoff) + '</li>'
	      + '<li><strong>What to call next:</strong> ' + escapeHtml(narrative.nextAction || nextActionFallback) + '</li>'
	      + '<li><strong>Where the contract failed to communicate it:</strong> ' + escapeHtml(contractFailed) + '</li>'
	      + '</ul>'
	      + '</div>';
	  }

		  function renderEndpointDiagnosticsWorkflowSummary(detail) {
		    var endpoint = detail.endpoint || {};
		    var findings = findingsForActiveLens(detail.findings || []);
		    var groups = groupFindings(findings);
		    var topGroup = groups[0] || null;
	    var chainCount = (detail.relatedChains || []).length;
	    var signalSummary = summarizeWorkflowHeaderSignals(detail);
	    var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false);
	    var guidanceHtml = renderTrapGuidanceList(guidance, {
	      title: 'Workflow trap guidance',
	      className: 'inspector-trap-guidance',
	      limit: 3
	    });

	    // Render inferred workflow chain context as first-class section
	    var chainContextHtml = renderWorkflowChainContextForEndpoint(detail);

			    return '<div class="endpoint-diag-pane">'
			      + chainContextHtml
			      + '<div class="family-insight-card">'
		      + '<p class="insight-kicker">Workflow continuity evidence</p>'
		      + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> '
	      + (chainCount ? ('appears in ' + chainCount + ' workflow chain' + (chainCount === 1 ? '' : 's')) : 'is not currently linked to an inferred chain')
	      + ' and is prioritized here for continuity burden signals.</p>'
	      + '<ul class="family-top-evidence">'
	      + '<li><strong>Primary continuity signals:</strong> ' + escapeHtml(signalSummary.replace(/^primary continuity signals:\s*/i, '')) + '.</li>'
	      + '<li><strong>Why this matters to a client:</strong> When the contract does not expose next-step IDs/context, clients must guess, store hidden state, or add extra reads between calls.</li>'
		      + '</ul>'
				      + guidanceHtml
				      + '</div>'
				      + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: endpoint.family || '', open: false })
			      + '</div>';
			  }

  function renderCommonWorkflowJourneys(chains) {
    // Render guidance for common workflow journey patterns found in the API.
    // This is the "problem-finding version of a docs guide" that helps developers
    // understand where the contract fails to guide them through common workflows.
    var allChains = (chains && chains.length) ? chains : (state.payload.workflows.chains || []);
    if (!allChains.length) return '';

    // Group chains by kind to identify common journey patterns
    var byKind = {};
    allChains.forEach(function (chain) {
      var kind = chain.kind || 'workflow';
      if (!byKind[kind]) byKind[kind] = [];
      byKind[kind].push(chain);
    });

    // Focus on the most common journey types (those with multiple chains or high burden)
    var journeyPatterns = Object.keys(byKind)
      .map(function (kind) {
        var chains = byKind[kind];
        var totalBurden = chains.reduce(function (s, c) { return s + chainBurdenScore(c); }, 0);
        return { kind: kind, chains: chains, totalBurden: totalBurden };
      })
      .filter(function (j) { return j.totalBurden > 0; })
      .sort(function (a, b) { return b.totalBurden - a.totalBurden; })
      .slice(0, 4); // Show top 4 journey patterns

    if (!journeyPatterns.length) return '';

    var journeyHtml = journeyPatterns.map(function (pattern) {
      return renderWorkflowJourneyGuidance(pattern.kind, pattern.chains);
    }).join('');

	    return '<div class="workflow-journeys-section">'
	      + '<div class="workflow-journeys-header">'
	      + '<p class="workflow-journeys-kicker">Common workflow journeys</p>'
	      + '<p class="workflow-journeys-copy">Problem-finding guide for developers. Identifies where the contract fails to guide you through each workflow and what a workflow-first contract must expose.</p>'
	      + '</div>'
	      + journeyHtml
	      + '</div>';
	  }

  function renderWorkflowJourneyGuidance(kind, chains) {
    // Render detailed guidance for a specific workflow journey pattern.
    // Shows: current problems (hidden prereqs, fragile transitions, learned rules)
    // and what the contract should expose.
    var label = kindGroupLabel(kind);
    var totalBurden = chains.reduce(function (s, c) { return s + chainBurdenScore(c); }, 0);
    var chainCount = chains.length;

    // Analyze the chain(s) to extract problems and expected contract changes
    var analysis = analyzeWorkflowPattern(kind, chains);

    var burdenLabel = totalBurden === 1 ? 'issue' : 'issues';
    var chainLabel = chainCount === 1 ? 'chain' : 'chains';

    return '<details class="workflow-journey-card">'
      + '<summary class="workflow-journey-summary">'
      + '<span class="journey-label">' + escapeHtml(label) + '</span>'
      + '<span class="journey-meta">' + chainCount + ' ' + chainLabel + ' · ' + totalBurden + ' burden ' + burdenLabel + '</span>'
      + '</summary>'
      + '<div class="workflow-journey-body">'
      + renderWorkflowJourneyProblems(analysis.problems)
      + renderWorkflowJourneyContractGaps(analysis.contractGaps)
      + renderWorkflowJourneyProposal(kind, analysis)
      + '</div>'
      + '</details>';
  }

  function analyzeWorkflowPattern(kind, chains) {
    // Deep analysis of a workflow pattern to identify DX problems and contract gaps.
    var allProblems = [];
    var allTokens = [];
    var allContext = [];
    var allHiddenDeps = [];
    var allLearnedRules = [];
    var contractGaps = {};

    chains.forEach(function (chain) {
      var steps = chain.endpointIds || [];
      var roles = parseChainRoles(chain.summary, steps.length);
      var summary = collectWorkflowBurdenSummary(chain, roles);

      summary.forEach(function (burden) {
        if (allProblems.indexOf(burden.label) === -1) {
          allProblems.push(burden.label);
        }
      });

      steps.forEach(function (endpointId, idx) {
        var detail = state.payload.endpointDetails[endpointId];
        if (!detail) return;
        var endpoint = detail.endpoint || {};
        var findings = detail.findings || [];
        var role = roles[idx] || '';
        var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : '';
        var nextDetail = nextEndpointId ? state.payload.endpointDetails[nextEndpointId] : null;
        var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
        var nextRole = roles[idx + 1] || '';

        var linkageFindings = findings.filter(function (f) {
          return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
        });
        var prerequisiteFindings = findings.filter(function (f) {
          return f.code === 'prerequisite-task-burden';
        });
        var clues = buildWorkflowDependencyClues(endpoint, findings, idx, steps.length, role, nextEndpoint, nextRole, linkageFindings, prerequisiteFindings);

        // Extract token/context changes
        if (/(auth|token|session|context)/i.test((clues.establish || []).join(' '))) {
          allTokens.push(role + ' establishes context/token');
        }
        if (/(auth|token|header|context)/i.test((clues.nextNeeds || []).join(' '))) {
          allContext.push('step ' + (idx + 1) + ' needs ' + (clues.nextNeeds[0] || 'context'));
        }

        // Track hidden dependencies
        if ((clues.hidden || []).length) {
          clues.hidden.forEach(function (h) {
            allHiddenDeps.push(h);
          });
        }
        if (prerequisiteFindings.length) {
          allHiddenDeps.push(humanizeStepRole(role) + ' depends on prior state');
        }

        // Identify learned rules (fragile assumptions)
        if (endpoint.path.indexOf('{') > -1 && idx > 0) {
          allLearnedRules.push('Step ' + (idx + 1) + ' path requires resource ID from prior response');
        }
        if ((clues.prereq || []).some(function (p) { return /prior state|earlier|mutation/i.test(p); })) {
          allLearnedRules.push('Step ' + (idx + 1) + ' depends on mutations from earlier steps');
        }

        // Identify contract gaps
        if (linkageFindings.length && !contractGaps.missing_next_action) {
          contractGaps.missing_next_action = true;
        }
        if (!endpoint.description || endpoint.description.length < 20) {
          contractGaps.weak_guidance = true;
        }
        if ((clues.hidden || []).length > 0) {
          contractGaps.hidden_context = true;
        }
      });
    });

    return {
      problems: allProblems.slice(0, 3),
      tokens: allTokens,
      context: allContext,
      hiddenDeps: allHiddenDeps.slice(0, 3),
      learnedRules: allLearnedRules.slice(0, 3),
      contractGaps: contractGaps
    };
  }

  function renderWorkflowJourneyProblems(problems) {
    if (!problems || !problems.length) return '';
    return '<div class="journey-problems">'
      + '<p class="journey-section-kicker">DX problems in this journey</p>'
      + '<ul class="journey-problem-list">'
      + problems.map(function (problem) {
          return '<li><strong>' + escapeHtml(problem) + '</strong></li>';
        }).join('')
      + '</ul>'
      + '</div>';
  }

  function renderWorkflowJourneyContractGaps(gaps) {
    if (!gaps || Object.keys(gaps).length === 0) return '';
    var items = [];
    if (gaps.missing_next_action) {
      items.push('<li><strong>Missing next action:</strong> Add <code>nextAction</code> (plus required IDs/links) to responses so the next step is explicit.</li>');
    }
    if (gaps.hidden_context) {
      items.push('<li><strong>Hidden context:</strong> Expose authoritative state and requiredContext fields needed for the next step.</li>');
    }
    if (gaps.weak_guidance) {
      items.push('<li><strong>Weak guidance:</strong> Add endpoint descriptions that state purpose, prerequisites, and continuation requirements.</li>');
    }
    if (!items.length) return '';
    return '<div class="journey-gaps">'
      + '<p class="journey-section-kicker">Contract gaps</p>'
      + '<ul class="journey-gap-list">'
      + items.join('')
      + '</ul>'
      + '</div>';
  }

  function renderWorkflowJourneyProposal(kind, analysis) {
    // Propose concrete workflow-first contract edits for this journey.
    var proposals = [];

    if (kind.indexOf('create') !== -1) {
      proposals.push('For POST responses, include the new resource ID and minimal authoritative state in the body.');
      proposals.push('Indicate completion vs follow-up required (and name the follow-up action/state).');
    }
    if (kind.indexOf('update') !== -1 || kind.indexOf('detail') !== -1) {
      proposals.push('For PATCH/PUT responses, return an explicit outcome summary and the authoritative state fields.');
      proposals.push('For every mutation, include <code>nextAction</code> (or <code>nextActions</code>) describing the next valid step.');
    }
    if (kind.indexOf('action') !== -1) {
      proposals.push('For action endpoints, return outcome state (not a request echo) in the success payload.');
      proposals.push('Return follow-up requirements: which endpoint to call next and which ID/state to carry forward.');
    }
    if (kind.indexOf('follow-up') !== -1) {
      proposals.push('Accept identifiers returned by prior steps (do not require extra lookup to form the call).');
      proposals.push('Return completion vs next required state change explicitly in the response.');
    }
    if (kind.indexOf('list') !== -1) {
      proposals.push('Return pagination context (<code>limit</code>/<code>offset</code>/<code>total</code> or equivalent).');
      proposals.push('Include minimal list-item detail needed to decide whether to fetch full details.');
    }

    if (analysis.hiddenDeps && analysis.hiddenDeps.length) {
      proposals.push('Expose prerequisite IDs/state in responses (do not require inferred prior state).');
    }
    if (analysis.learnedRules && analysis.learnedRules.length) {
      proposals.push('Add descriptions documenting sequencing rules and where path parameters come from (for example: "use id from step 2 response").');
    }

    if (!proposals.length) return '';

    return '<div class="journey-proposal">'
      + '<p class="journey-section-kicker">Workflow-first contract edits</p>'
      + '<ul class="journey-proposal-list">'
      + proposals.slice(0, 4).map(function (proposal) {
          return '<li>' + escapeHtml(proposal) + '</li>';
        }).join('')
      + '</ul>'
      + '</div>';
  }

	  function renderEndpointDiagnosticsShapeSummary(detail) {
	    var endpoint = detail.endpoint || {};
	    var findings = findingsForActiveLens(detail.findings || []);
	    var groups = groupFindings(findings);
	    var topGroup = groups[0] || null;
	    var topContext = topGroup ? topGroup.context : {};
    var shapeTotals = collectShapeSignalTotalsForDetail(detail);

    // Pain signals — organized around developer pain, not schema categories
    var painSignals = collectShapePainSignals(endpoint, findings);
    var painHtml = renderShapePainSignals(painSignals);

    // Comparison is always visible — not hidden in a details element
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

    // Compact numeric profile badge row
    var activeSignalCodes = painSignals.map(function (s) { return s.code; });
    var profileItems = [
      { key: 'deep', label: 'deep nesting', val: shapeTotals.deep },
      { key: 'dup',  label: 'duplicated state', val: shapeTotals.dup },
      { key: 'internal-fields', label: 'internal fields', val: shapeTotals.internal },
      { key: 'snapshot-heavy', label: 'snapshot-heavy', val: shapeTotals.snapshot },
      { key: 'missing-outcome', label: 'missing outcome', val: shapeTotals.outcome },
      { key: 'missing-next-action', label: 'missing next action', val: shapeTotals.nextAction }
    ].filter(function (item) { return item.val > 0; });

    var profileHtml = profileItems.length
      ? '<div class="shape-profile-row">'
          + profileItems.map(function (item) {
              return '<span class="shape-profile-chip">'
                + '<strong>' + item.val + '</strong> ' + escapeHtml(item.label)
                + '</span>';
            }).join('')
          + '</div>'
      : '';

    // Top schema locations (compact, supporting)
    var locationHighlights = topOpenAPIHighlights(groups).slice(0, 3);
    var locationHtml = locationHighlights.length
      ? '<p class="shape-location-hint">Schema locations with most signals: '
          + locationHighlights.map(function (l) { return '<code>' + escapeHtml(l) + '</code>'; }).join(' · ')
          + '</p>'
      : '';

    // Lead issue as collapsible fallback when no pain signals fire
    var noSignalsHtml = !painSignals.length
      ? '<div class="family-insight-card">'
          + '<p class="insight-kicker">Endpoint-local shape evidence</p>'
          + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> has '
          + findings.length + ' shape finding' + (findings.length === 1 ? '' : 's')
          + ' grouped into ' + groups.length + ' cluster' + (groups.length === 1 ? '' : 's')
          + '. No specific pain-signal pattern matched in this slice — use response-shape burden evidence below for the raw grouped messages.</p>'
          + (topGroup
              ? '<p class="subtle"><strong>Lead cluster:</strong> ' + escapeHtml(formatIssueGroupCountLabel(topGroup)) + '</p>'
              : '')
          + '</div>'
      : '';

	    return '<div class="endpoint-diag-pane">'
      + '<div class="shape-summary-intro">'
      + '<p class="shape-summary-kicker">Why this response is hard to use</p>'
      + '<p class="shape-summary-head"><strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong> — '
      + (painSignals.length
          ? escapeHtml(painSignals.length + ' active DX pain signal' + (painSignals.length === 1 ? '' : 's') + ' detected')
          : 'shape signals present — see profile below')
      + '</p>'
      + profileHtml
      + locationHtml
      + '</div>'
	      + noSignalsHtml
	      + painHtml
	      + comparisonHtml
	      + guidanceHtml
	      + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: endpoint.family || '', open: false })
	      + '</div>';
	  }

				  function renderEndpointDiagnosticsExact(detail) {
				    var findings = findingsForActiveLens(detail.findings || []);
				    var endpoint = detail.endpoint || {};
				    var familyName = endpoint.family || '';
				    var groups = groupFindings(findings);
				    var moreCount = groups.length - 1;
				    var openDrawer = state.detailEvidenceOpenForId === state.selectedEndpointId;

					    return '<div class="endpoint-diag-pane">'
					      + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: familyName, open: openDrawer })
			      + renderInspectorGroundingAndFlowContext(detail)
			      + '</div>';
			  }

		  function renderInspectorGroundingAndFlowContext(detail) {
		    var specRuleTabActive = state.activeTopTab === 'spec-rule';
		    var workflowTabActive = state.activeTopTab === 'workflow';
		    var endpoint = detail.endpoint || {};
		    var findings = findingsForActiveLens(detail.findings || []);
		    var groups = groupFindings(findings);
		    var topGroup = groups[0] || null;
		    var topContext = topGroup ? topGroup.context : {};
		    var chainContext = (workflowTabActive && !specRuleTabActive)
		      ? buildChainContext(detail.relatedChains || [], endpoint.id || state.selectedEndpointId, state.payload.endpointDetails)
		      : '';
		    var scopeFamilyName = endpoint.family || '';
		    var scopeLabel = topGroup ? issueScopeLabelForKey(topGroup.groupKey || '', scopeFamilyName) : '';
		    var inspectTarget = topGroup ? (inspectTargetForGroup(topGroup, endpoint) || topGroup.inspectHint || '') : '';
		    var schemaClues = topOpenAPIHighlights(groups).slice(0, 4);
	    var openApiPills = renderOpenAPIContextPills(topContext, true);
	    var specGrounding = topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '';
	    var groundingHtml = (openApiPills || specGrounding)
	      ? ('<div class="family-insight-grounding">' + openApiPills + specGrounding + '</div>')
	      : '';

	    var leadMessage = topGroup && topGroup.messages && topGroup.messages[0]
	      ? topGroup.messages[0]
	      : (findings[0] && findings[0].message ? findings[0].message : 'No issue message extracted.');
	    var whyMatters = topGroup && topGroup.impact
	      ? topGroup.impact
	      : (topGroup ? dimensionImpact(topGroup.dimension) : 'Why-it-matters context was not available for this endpoint.');
	    var schemaClueHtml = schemaClues.length
	      ? ('<p class="subtle grounding-clues"><strong>Schema clues:</strong> '
	          + schemaClues.map(function (l) { return '<code>' + escapeHtml(l) + '</code>'; }).join(' · ')
	          + '</p>')
	      : '<p class="subtle grounding-clues"><strong>Schema clues:</strong> No stable OpenAPI location hint was extracted from the grouped messages.</p>';
	    var summaryGrid = '<div class="grounding-summary-grid">'
	      + '<div class="grounding-summary-item"><span class="grounding-summary-label">Evidence target</span><span class="grounding-summary-value">' + escapeHtml(exactEvidenceTargetLabel()) + '</span></div>'
	      + (scopeLabel ? ('<div class="grounding-summary-item"><span class="grounding-summary-label">Scope</span><span class="grounding-summary-value">' + escapeHtml(scopeLabel) + '</span></div>') : '')
	      + (inspectTarget ? ('<div class="grounding-summary-item grounding-summary-item-wide"><span class="grounding-summary-label">Inspect in schema</span><span class="grounding-summary-value"><code>' + escapeHtml(inspectTarget) + '</code></span></div>') : '')
	      + '</div>';

		    var schemaSection = '<section class="detail-section detail-section-tight">'
		      + '<h3>Schema grounding</h3>'
		      + '<div class="family-insight-card">'
		      + summaryGrid
		      + '<p class="family-insight-lead-message">' + escapeHtml(leadMessage) + '</p>'
	      + schemaClueHtml
	      + '<p class="subtle grounding-why"><strong>Why it matters:</strong> ' + escapeHtml(whyMatters) + '</p>'
	      + (groundingHtml ? groundingHtml : '<p class="subtle">No OpenAPI location cues or spec-rule grounding were available for the lead message.</p>')
		      + '</div>'
		      + '</section>';

		    var workflowSection = '';
		    if (workflowTabActive && !specRuleTabActive) {
		      workflowSection = chainContext
		        ? '<section class="detail-section detail-section-tight"><h3>Workflow context</h3>' + chainContext + '</section>'
		        : '<section class="detail-section detail-section-tight"><h3>Workflow context</h3>'
		            + '<p class="subtle">No inferred workflow chain includes this endpoint in the current view. If this endpoint participates in a multi-step client flow, that linkage is not being exposed clearly by the contract signals we extracted.</p>'
		            + '</section>';
		    }

			    return '<details class="detail-evidence-drawer">'
			      + '<summary>' + ((specRuleTabActive || !workflowTabActive) ? 'Schema grounding' : 'Schema grounding and workflow context') + '</summary>'
			      + '<div class="details-close-row"><button type="button" class="tertiary-action details-close-btn" data-close-details="1" aria-label="Hide grounding" title="Hide grounding">Hide grounding</button></div>'
			      + schemaSection
			      + workflowSection
			      + '</details>';
			  }

	  function renderInspectorContentMap() {
	    var workflowTabActive = state.activeTopTab === 'workflow';
	    var shapeTabActive = state.activeTopTab === 'shape';
	    var mapping = workflowTabActive
	      ? 'Workflow Guidance inspector: Continuity summary = step-position context, hidden deps, traps. Workflow-context evidence = grouped messages + flow context.'
	    : shapeTabActive
	      ? 'Response Shape inspector: Shape pain = per-signal DX analysis + caller-needed. Contract improvements = exact response/schema edits. Shape burden evidence = raw grouped messages.'
	      : 'Contract Issues inspector: OpenAPI rule violations (REQUIRED vs SHOULD) + consistency drift. Exact contract evidence = grouped rule instances with schema grounding.';
	    // If the content is only a single sentence/line of helper text, do not use an accordion.
	    // Accordions are reserved for materially more content (payload fragments, before/after examples, multi-part guidance).
	    return '<p class="subtle inspector-content-map-inline"><strong>Inspector scope:</strong> ' + escapeHtml(mapping) + '</p>';
	  }

  function renderEndpointDiagnosticsCleaner(detail) {
    var findings = findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || {};
    var shapeTabActive = state.activeTopTab === 'shape';
    var improvementItems = buildContractImprovementItems(detail, findings);
    var painSignals = collectShapePainSignals(endpoint, findings);
    var signalSummaryHtml = painSignals.length
      ? '<div class="cleaner-signal-summary">'
          + painSignals.map(function (s) {
              return '<span class="cleaner-signal-chip">'
                + s.icon + ' ' + escapeHtml(s.label)
                + '</span>';
            }).join('')
          + '</div>'
      : '';

		    if (improvementItems.length) {
		      return '<div class="endpoint-diag-pane">'
		        + signalSummaryHtml
		        + '<section class="detail-section detail-section-tight contract-improvements-list">'
		        + '<h3>Contract improvements</h3>'
		        + '<p class="subtle detail-section-copy">Concrete response/schema edits for <strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>.</p>'
		        + '<div class="contract-improvements-items">'
		        + improvementItems.map(function (item) {
		            var inspect = item.inspect || item.where || '';
		            return '<article class="contract-improvement-item">'
		              + '<p><strong>Change:</strong> ' + escapeHtml(item.change) + '</p>'
	              + '<p><strong>Where:</strong> ' + escapeHtml(item.where) + '</p>'
	              + (inspect ? ('<p><strong>Inspect in schema:</strong> ' + escapeHtml(inspect) + '</p>') : '')
	              + '<p><strong>Why:</strong> ' + escapeHtml(item.why) + '</p>'
	              + '</article>';
	          }).join('')
	        + '</div>'
	        + '</section>'
	        + '</div>';
	    }

    return '<div class="endpoint-diag-pane">'
      + signalSummaryHtml
      + '<p class="subtle">No concrete response or schema edit could be derived from the current findings.</p>'
      + '</div>';
  }

  function buildContractImprovementItems(detail, findings) {
    var endpoint = (detail && detail.endpoint) || {};
    var items = [];
    var seen = {};

    (findings || []).forEach(function (finding) {
      var item = contractImprovementItemForFinding(finding, endpoint);
      if (!item) return;
      var key = [item.change, item.where, item.why].join('|');
      if (seen[key]) return;
      seen[key] = true;
      items.push(item);
    });

    return items.slice(0, 6);
  }

	  function describeImprovementWhere(context, fallback) {
	    if (!context) return fallback;
	    if (context.primaryLabel && context.primaryValue) {
	      return context.primaryLabel + ' ' + context.primaryValue;
	    }
	    if (context.primaryLabel && context.statusCode) {
	      return context.primaryLabel + ' for response ' + context.statusCode;
	    }
	    if (context.primaryLabel) {
	      return context.primaryLabel;
	    }
	    return fallback;
	  }

	  function openApiOperationPointer(endpoint) {
	    if (!endpoint || !endpoint.method || !endpoint.path) return '';
	    return 'paths["' + endpoint.path + '"].' + String(endpoint.method).toLowerCase();
	  }

	  function openApiResponseObjectPointer(endpoint, statusCode) {
	    var op = openApiOperationPointer(endpoint);
	    if (!op) return '';
	    if (statusCode) return op + '.responses["' + statusCode + '"]';
	    return op + '.responses';
	  }

	  function openApiResponseSchemaPointer(endpoint, context) {
	    var base = openApiResponseObjectPointer(endpoint, context && context.statusCode ? context.statusCode : '');
	    if (!base) return '';
	    if (context && context.mediaType) {
	      return base + '.content["' + context.mediaType + '"].schema';
	    }
	    return base + '.content[mediaType].schema';
	  }

	  function openApiRequestSchemaPointer(endpoint, context) {
	    var op = openApiOperationPointer(endpoint);
	    if (!op) return '';
	    if (context && context.mediaType) {
	      return op + '.requestBody.content["' + context.mediaType + '"].schema';
	    }
	    return op + '.requestBody.content[mediaType].schema';
	  }

	  function formatWhereWithOpenAPITarget(endpoint, context, opts) {
	    var options = opts || {};
	    var kind = options.kind || '';
	    var pointer = '';
	    var suffix = '';

	    if (kind === 'response-description') {
	      pointer = openApiResponseObjectPointer(endpoint, context && context.statusCode ? context.statusCode : '');
	      pointer = pointer ? (pointer + '.description') : '';
	    } else if (kind === 'operation-id') {
	      pointer = openApiOperationPointer(endpoint);
	      pointer = pointer ? (pointer + '.operationId') : '';
	    } else if (kind === 'request-schema') {
	      pointer = openApiRequestSchemaPointer(endpoint, context || {});
	    } else if (kind === 'request-field') {
	      pointer = openApiRequestSchemaPointer(endpoint, context || {});
	      if (context && context.primaryValue) suffix = ' (field: ' + context.primaryValue + ')';
	    } else if (kind === 'path-params') {
	      pointer = openApiOperationPointer(endpoint);
	      pointer = pointer ? (pointer + '.parameters') : '';
	      if (context && (context.parameterNames || context.primaryValue)) {
	        suffix = ' (path params: ' + (context.parameterNames || context.primaryValue) + ')';
	      }
	    } else if (kind === 'response-object') {
	      pointer = openApiResponseObjectPointer(endpoint, context && context.statusCode ? context.statusCode : '');
	    } else if (kind === 'response-field') {
	      pointer = openApiResponseSchemaPointer(endpoint, context || {});
	      if (context && context.primaryValue) suffix = ' (field: ' + context.primaryValue + ')';
	    } else {
	      pointer = openApiResponseSchemaPointer(endpoint, context || {});
	      if (context && context.primaryLabel === 'Request schema') pointer = openApiRequestSchemaPointer(endpoint, context || {});
	      if (context && context.primaryLabel === 'Request schema field') {
	        pointer = openApiRequestSchemaPointer(endpoint, context || {});
	        if (context.primaryValue) suffix = ' (field: ' + context.primaryValue + ')';
	      }
	      if (context && context.primaryLabel === 'Path parameter') {
	        pointer = openApiOperationPointer(endpoint);
	        pointer = pointer ? (pointer + '.parameters') : '';
	        if (context.primaryValue) suffix = ' (path params: ' + context.primaryValue + ')';
	      }
	    }

	    if (!pointer) {
	      var fallback = (endpoint && endpoint.method && endpoint.path) ? ('operation ' + endpoint.method + ' ' + endpoint.path) : 'this endpoint';
	      return fallback;
	    }
	    return 'OpenAPI: ' + pointer + suffix;
	  }

	  function contractImprovementItemForFinding(finding, endpoint) {
	    var code = finding.code || '';
	    var context = extractOpenAPIContext(finding);
	    var endpointLabel = (endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : 'this endpoint';
    var statusOrMedia = [];
    if (context.statusCode) statusOrMedia.push('response ' + context.statusCode);
    if (context.mediaType) statusOrMedia.push(context.mediaType);
    var responseTarget = statusOrMedia.length
      ? statusOrMedia.join(' ')
      : 'the response schema for ' + endpointLabel;
	    var responseFieldTarget = context.primaryValue
	      ? 'response schema field ' + context.primaryValue
	      : responseTarget;

	    if (finding.evidenceType === 'spec-rule') {
	      var ruleId = finding.specRuleId || code;
	      if (ruleId === 'OAS-RESPONSE-DESCRIPTION-REQUIRED') {
	        var target = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-description' });
	        return {
	          change: 'Add a non-empty `description` to the Response Object.',
	          where: target,
	          inspect: target,
	          why: SPEC_RULE_WHY[ruleId] || 'Docs and generated clients need response semantics to remain clear.'
	        };
	      }
	      if (ruleId === 'OAS-OPERATION-ID-UNIQUE') {
	        var opTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'operation-id' });
	        return {
	          change: 'Rename `operationId` to a unique value (no duplicates across the spec).',
	          where: opTarget,
	          inspect: opTarget,
	          why: SPEC_RULE_WHY[ruleId] || 'Tooling that keys by operationId can break when IDs collide.'
	        };
	      }
	      if (ruleId === 'OAS-NO-SUCCESS-RESPONSE') {
	        var successTarget = openApiResponseObjectPointer(endpoint, '200');
	        var inspectTarget = successTarget ? ('OpenAPI: ' + successTarget + '.content[mediaType].schema') : endpointLabel;
	        return {
	          change: 'Add at least one 2xx success response with an explicit schema (typically `200`).',
	          where: inspectTarget,
	          inspect: inspectTarget,
	          why: SPEC_RULE_WHY[ruleId] || 'Clients cannot know the happy-path shape without a declared success response.'
	        };
	      }
	      if (ruleId === 'OAS-GET-REQUEST-BODY') {
	        var requestBodyTarget = openApiOperationPointer(endpoint);
	        var requestInspect = requestBodyTarget ? ('OpenAPI: ' + requestBodyTarget + '.requestBody') : endpointLabel;
	        return {
	          change: 'Remove the request body from this GET/HEAD operation (move inputs to query params or change to POST).',
	          where: requestInspect,
	          inspect: requestInspect,
	          why: SPEC_RULE_WHY[ruleId] || 'HTTP intermediaries and tooling may drop or mishandle GET bodies.'
	        };
	      }
	      if (ruleId === 'OAS-204-HAS-CONTENT') {
	        var noContentTarget = openApiResponseObjectPointer(endpoint, '204');
	        var noContentInspect = noContentTarget ? ('OpenAPI: ' + noContentTarget + '.content') : endpointLabel;
	        return {
	          change: 'Remove response content/schema from the 204 response (204 must not include a body).',
	          where: noContentInspect,
	          inspect: noContentInspect,
	          why: SPEC_RULE_WHY[ruleId] || 'Clients may mis-handle responses when 204 contradicts a response body.'
	        };
	      }
	    }

	    if (code === 'missing-response-schema') {
	      var responseSchemaTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
	      return {
	        change: 'Define an explicit response schema instead of leaving this response untyped.',
	        where: responseSchemaTarget,
	        inspect: responseSchemaTarget,
	        why: 'Clients can generate typed models, validate the payload, and stop guessing which fields are safe to read.'
	      };
	    }
	    if (code === 'generic-object-response') {
	      var genericTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
	      return {
	        change: 'Replace the generic object response with a named schema that lists the actual fields returned.',
	        where: genericTarget,
	        inspect: genericTarget,
	        why: 'Clients can code against documented fields instead of probing the payload at runtime.'
	      };
	    }
	    if (code === 'weak-array-items-schema') {
	      var itemsTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-field' });
	      return {
	        change: 'Define the array item schema with named properties instead of leaving items generic.',
	        where: itemsTarget,
	        inspect: itemsTarget,
	        why: 'Clients can iterate over collection items with stable field names and fewer defensive null checks.'
	      };
	    }
	    if (code === 'deeply-nested-response-structure') {
	      var nestedTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
	      return {
	        change: 'Promote the task outcome and handoff fields to the top level of the response instead of burying them in nested objects.',
	        where: nestedTarget,
	        inspect: nestedTarget,
	        why: 'Clients can find the result and next-step data quickly without walking a deep object tree.'
	      };
	    }
	    if (code === 'duplicated-state-response') {
	      var dupTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
	      return {
	        change: 'Remove duplicate state copies and keep one authoritative representation of the resource state.',
	        where: dupTarget,
	        inspect: dupTarget,
	        why: 'Clients stop choosing between conflicting copies of the same state and reduce silent drift bugs.'
	      };
	    }
	    if (code === 'incidental-internal-field-exposure') {
	      var internalField = context.primaryValue || '';
	      var internalTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: internalField ? 'response-field' : 'response-schema' });
	      return {
	        change: internalField
	          ? ('Remove `' + internalField + '` from the public response schema (or move it behind an explicitly internal component).')
	          : 'Remove incidental internal fields from the public response schema (or move them behind an explicitly internal component).',
	        where: internalTarget,
	        inspect: internalTarget,
	        why: 'Clients see the fields they actually need for the task instead of relying on internal data that may change without notice.'
	      };
	    }
	    if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
	      var followUpTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-field' });
	      return {
	        change: 'Add an explicit follow-up field that names the next endpoint or returns the handoff identifier needed for the next call.',
	        where: followUpTarget,
	        inspect: followUpTarget,
	        why: 'Clients can continue the workflow without reverse-engineering which identifier to carry forward.'
	      };
	    }
	    if (code === 'weak-outcome-next-action-guidance') {
	      var outcomeTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
	      return {
	        change: 'Add explicit outcome and next-action fields to the response contract.',
	        where: outcomeTarget,
	        inspect: outcomeTarget,
	        why: 'Clients can tell what changed and what operation is valid next without reading docs or guessing from status alone.'
	      };
	    }
	    if (code === 'prerequisite-task-burden') {
	      var prereqTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: (context.primaryLabel && context.primaryLabel.indexOf('Request') === 0) ? 'request-schema' : 'path-params' });
	      return {
	        change: 'Document prerequisite inputs as explicit request fields or required parameters instead of leaving them implicit.',
	        where: prereqTarget,
	        inspect: prereqTarget,
	        why: 'Clients learn which prior state is mandatory before calling the endpoint and fail less often in multi-step flows.'
	      };
	    }
	    if (code === 'detail-path-parameter-name-drift') {
	      var paramTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'path-params' });
	      return {
	        change: 'Rename the path parameter so it matches the family’s dominant parameter naming pattern.',
	        where: paramTarget,
	        inspect: paramTarget,
	        why: 'Clients can reuse route builders and stop maintaining endpoint-specific parameter aliases.'
	      };
	    }
	    if (code === 'endpoint-path-style-drift' || code === 'sibling-path-shape-drift') {
	      var pathTarget = 'OpenAPI: paths["' + (endpoint.path || '') + '"]';
	      return {
	        change: 'Normalize this route shape so it matches sibling endpoints for the same resource workflow.',
	        where: pathTarget,
	        inspect: pathTarget,
	        why: 'Clients can predict sibling routes and compose calls without one-off path rules.'
	      };
	    }
	    if (code === 'inconsistent-response-shape' || code === 'inconsistent-response-shape-family' || code === 'inconsistent-response-shapes' || code === 'inconsistent-response-shapes-family') {
	      var alignTarget = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
	      return {
	        change: 'Align this response schema with sibling endpoints so the same concept is returned under the same field structure.',
	        where: alignTarget,
	        inspect: alignTarget,
	        why: 'Clients can share parsing code across sibling routes instead of branching on endpoint-specific payload shapes.'
	      };
	    }
	    if (code === 'missing-request-schema') {
	      var requestSchema = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'request-schema' });
	      return {
	        change: 'Define the request body schema and mark the required fields explicitly.',
	        where: requestSchema,
	        inspect: requestSchema,
	        why: 'Clients can construct valid requests without trial-and-error against server validation.'
	      };
	    }
	    if (code === 'generic-object-request') {
	      var reqObj = formatWhereWithOpenAPITarget(endpoint, context, { kind: 'request-schema' });
	      return {
	        change: 'Replace the generic request object with a named request schema that lists supported fields.',
	        where: reqObj,
	        inspect: reqObj,
	        why: 'Clients know which inputs are accepted and can generate typed request builders.'
	      };
	    }
	    if (code === 'likely-missing-enum') {
	      var msg = finding.message || '';
	      var enumField = (msg.match(/property '([^']+)'/) || msg.match(/field '([^']+)'/));
	      var field = enumField ? enumField[1] : (context.primaryValue || '');
	      var ctx = Object.assign({}, context);
	      if (!ctx.primaryValue && field) ctx.primaryValue = field;
	      var enumTarget = formatWhereWithOpenAPITarget(endpoint, ctx, { kind: field ? 'response-field' : 'response-schema' });
	      return {
	        change: field
	          ? ('Declare explicit enum values for `' + field + '` (avoid bare string with no constraints).')
	          : 'Declare explicit enum values for finite value sets (avoid bare string with no constraints).',
	        where: enumTarget,
	        inspect: enumTarget,
	        why: 'Clients can validate inputs/outputs and avoid silent breakage when servers start rejecting or introducing new string variants.'
	      };
	    }
	    return null;
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
	          ? '<details class="detail-evidence-drawer">'
	            + '<summary>Consistency evidence (' + consistencyFindings.length + ')</summary>'
	            + '<ul class="family-top-evidence">'
	            + consistencyFindings.slice(0, 8).map(function (f) { return '<li><strong>' + escapeHtml(f.code || 'consistency') + ':</strong> ' + escapeHtml(f.message || '') + '</li>'; }).join('')
	            + '</ul>'
	            + '</details>'
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

    el.categoryFilter.disabled = false;
    el.burdenFilter.disabled = false;
    el.categoryFilter.removeAttribute('title');
    el.burdenFilter.removeAttribute('title');

    var categoryField = el.categoryFilter ? el.categoryFilter.closest('.field') : null;
    var burdenField = el.burdenFilter ? el.burdenFilter.closest('.field') : null;
    if (categoryField) {
      categoryField.classList.remove('field-hidden-by-lens');
      categoryField.setAttribute('aria-hidden', 'false');
    }
    if (burdenField) {
      burdenField.classList.remove('field-hidden-by-lens');
      burdenField.setAttribute('aria-hidden', 'false');
    }

	    if (el.lensControlHint) {
	      el.lensControlHint.innerHTML = formatFilterSummaryHtml();
	    }
	  }

  function clearCurrentLens() {
    var tab = state.activeTopTab;
    if (tab !== 'spec-rule' && tab !== 'workflow' && tab !== 'shape') tab = 'spec-rule';

    state.expandedFamily = "";
    state.expandedFamilyInsight = "";
    state.expandedEndpointInsightIds = {};
    state.expandedEndpointRowFindings = {};
    state.inspectingEndpointId = "";
    state.familyTableShowAll = false;
    state.detailEvidenceOpenForId = "";
    state.filters.search = "";
    state.filters.familyPressure = "all";
    state.filters.includeNoIssueRows = false;

	    // Reset filters within the currently active top-level tab only.
	    // Never change the active tab as a side effect of reset.
    if (tab === 'spec-rule') {
      state.filters.category = 'spec-rule';
      state.filters.burden = 'all';
      state.endpointDiagnosticsSubTab = 'exact';
    } else if (tab === 'workflow') {
      state.filters.category = 'all';
      state.filters.burden = 'workflow-burden';
      state.endpointDiagnosticsSubTab = 'summary';
    } else if (tab === 'shape') {
      state.filters.category = 'all';
      state.filters.burden = 'contract-shape';
      state.endpointDiagnosticsSubTab = 'summary';
    }

		    // Reset should not silently pick a selected endpoint. Let users choose via "Inspect endpoint".
		    state.selectedEndpointId = '';
		    state.userSelectedEndpoint = false;

		    render();
		    pulseLensUpdate();
		  }

		  function focusFamilySurface(family) {
		    if (!family) return;

	    captureFamilyTableBackStateIfNeeded();
	    state.filters.search = family.trim().toLowerCase();
		    state.familyTableShowAll = false;
		    state.detailEvidenceOpenForId = '';
		    // Keep endpoint selection separate from family expansion/focus. If the current
		    // selection falls out of view, clear it rather than jumping to a new endpoint.
		    var rows = filteredRows();
		    if (state.selectedEndpointId && !rows.some(function (r) { return (r && r.id) === state.selectedEndpointId; })) {
		      state.selectedEndpointId = '';
		    }
		    render();
		  }

	  function hasFamilyScopeActive() {
	    return !!state.filters.search
	      || state.filters.familyPressure !== 'all'
	      || !!state.expandedFamily
	      || !!state.expandedFamilyInsight
	      || Object.keys(state.expandedEndpointInsightIds || {}).length > 0;
	  }

	  function hasFamilyDrillActive() {
	    // Back affordance should appear when the user has drilled into a specific family
	    // surface (focus search / expanded endpoints / insight).
	    if (state.familyTableBackState) return true;
	    if (state.expandedFamily) return true;
	    if (state.expandedFamilyInsight) return true;
	    if (Object.keys(state.expandedEndpointInsightIds || {}).length > 0) return true;
	    // Heuristic: exact-family search looks like a drill even if we missed capture.
	    return isExactFamilyName((state.filters.search || '').trim().toLowerCase());
	  }

	  function cloneJSON(obj) {
	    try { return JSON.parse(JSON.stringify(obj || {})); } catch (e) { return {}; }
	  }

	  function captureFamilyTableBackStateIfNeeded(overrides) {
	    if (state.familyTableBackState) return;
	    var o = overrides || {};
	    state.familyTableBackState = {
	      search: (typeof o.search === 'string') ? o.search : (state.filters.search || ''),
	      familyTableShowAll: !!state.familyTableShowAll,
	      expandedFamily: state.expandedFamily || '',
	      expandedFamilyInsight: state.expandedFamilyInsight || '',
	      expandedEndpointInsightIds: cloneJSON(state.expandedEndpointInsightIds || {}),
	      expandedEndpointRowFindings: cloneJSON(state.expandedEndpointRowFindings || {}),
	      detailEvidenceOpenForId: state.detailEvidenceOpenForId || ''
	    };
	  }

		  function restoreFamilyTableBackState() {
		    if (!state.familyTableBackState) {
		      // Best-effort: clear drill-only expansions without touching the filter controls.
		      state.expandedFamily = '';
		      state.expandedFamilyInsight = '';
		      state.expandedEndpointInsightIds = {};
		      state.expandedEndpointRowFindings = {};
		      state.detailEvidenceOpenForId = '';
		      return;
		    }
		    var s = state.familyTableBackState;
		    state.filters.search = s.search || '';
		    state.familyTableShowAll = !!s.familyTableShowAll;
		    state.expandedFamily = s.expandedFamily || '';
		    state.expandedFamilyInsight = s.expandedFamilyInsight || '';
		    state.expandedEndpointInsightIds = s.expandedEndpointInsightIds || {};
		    state.expandedEndpointRowFindings = s.expandedEndpointRowFindings || {};
		    state.detailEvidenceOpenForId = s.detailEvidenceOpenForId || '';

		    // Single-expand policy: never restore a state that expands multiple different
		    // families at once (endpoints vs insight). If a stale snapshot contains both,
		    // keep the endpoints expansion (primary drill path) and drop the mismatched insight.
		    if (state.expandedFamily && state.expandedFamilyInsight && state.expandedFamily !== state.expandedFamilyInsight) {
		      state.expandedFamilyInsight = '';
		    }
		    state.familyTableBackState = null;
		  }

  function isElementOffscreen(node) {
    if (!node) return false;
    var rect = node.getBoundingClientRect();
    return rect.bottom <= 0 || rect.top >= (window.innerHeight || document.documentElement.clientHeight || 0);
  }

		  function revealInspectorIfNeeded() {
		    // Scroll only when the workspace is actually outside the viewport.
		    // Prefer the inline inspector mount (keeps ownership connected to the row).
		    var inlineMount = findInlineInspectorMount(state.selectedEndpointId);
		    var header = inlineMount
		      ? (inlineMount.querySelector('.inspector-workspace-head') || inlineMount)
		      : (el.endpointDiagnosticsSection ? (el.endpointDiagnosticsSection.querySelector('.section-heading') || el.endpointDiagnosticsSection) : null);
		    if (!header) return;
		    if (!isElementOffscreen(header)) return;
		    header.scrollIntoView({ behavior: 'smooth', block: 'start' });
		  }

				  function selectEndpointForInspector(endpointId, subTab) {
				    if (!endpointId) return;
				    state.inspectingEndpointId = endpointId;
				    state.selectedEndpointId = endpointId;
				    state.userSelectedEndpoint = true;
			    // Always keep the workspace attached to the family surface:
			    // expand the owning family and render the inspector inline beneath that family's
			    // nested endpoint table (never as a detached lower-page module).
			    state.inspectPlacementHint = 'nested';
			    var detailForFocus = endpointDetailForId(endpointId);
			    var endpointForFocus = detailForFocus && detailForFocus.endpoint ? detailForFocus.endpoint : endpointRowForId(endpointId);
			    var familyForFocus = endpointForFocus ? (endpointForFocus.family || '') : '';
			    if (familyForFocus) {
			      captureFamilyTableBackStateIfNeeded();
			      state.expandedFamily = familyForFocus;
			      if (state.expandedFamilyInsight && state.expandedFamilyInsight !== familyForFocus) {
			        state.expandedFamilyInsight = '';
			      }
			    }
			    // Preserve the currently active inspector tab unless a caller explicitly sets one.
			    state.endpointDiagnosticsSubTab = (typeof subTab === 'string' && subTab)
			      ? subTab
			      : (state.endpointDiagnosticsSubTab || 'summary');
		    renderFamilySurface();
		    renderEndpointDiagnostics();
		    renderEndpointDetail();
		    syncSelectedEndpointHighlight();
	    syncWorkflowStepSelectionHighlight();
		    revealInspectorIfNeeded();
					    requestAnimationFrame(function () {
					      state.inspectingEndpointId = '';
					      renderFamilySurface();
					      renderEndpointDiagnostics();
					    });
					  }

	  function endpointRowForId(endpointId) {
	    if (!endpointId || !state.payload || !state.payload.endpoints) return null;
	    return (state.payload.endpoints || []).find(function (row) {
	      return row && row.id === endpointId;
	    }) || null;
	  }

	  function endpointDetailForId(endpointId) {
	    if (!endpointId || !state.payload) return null;
	    var details = state.payload.endpointDetails || {};
	    if (details && details[endpointId]) return details[endpointId];
	    var row = endpointRowForId(endpointId);
	    if (!row) return null;
	    // Fallback so Inspect never "does nothing" when endpointDetails is missing.
	    return {
	      endpoint: row,
	      findings: [],
	      relatedWorkflows: [],
	      relatedChains: [],
	      relatedDiff: []
	    };
	  }

		  function renderFamilySurface() {
		    // Keep the family surface framing aligned with the active lens so the Workflow
		    // tab does not read like a generic contract-clustering table.
		    var familySection = el.familySurface ? el.familySurface.closest('.section') : null;
		    if (familySection) {
		      var heading = familySection.querySelector('.section-heading h2');
		      var eyebrow = familySection.querySelector('.section-heading .eyebrow');
		      if (state.activeTopTab === 'workflow') {
		        if (eyebrow) eyebrow.textContent = 'Workflow surface';
		        if (heading) heading.textContent = 'Workflow continuity clusters';
		      } else if (state.activeTopTab === 'shape') {
		        if (eyebrow) eyebrow.textContent = 'Response Shape surface';
		        if (heading) heading.textContent = 'Response-shape investigation clusters';
		      } else {
		        if (eyebrow) eyebrow.textContent = 'Contract surface';
		        if (heading) heading.textContent = 'Family investigation clusters';
		      }
		    }

		    var summaries = familySummaries();
		    var lensContext = buildFamilySurfaceContext(summaries);
		    var visibleFamilies = {};
	    summaries.forEach(function (family) {
	      visibleFamilies[family.family || 'unlabeled family'] = true;
	    });

	    // Single-expand policy: expanding a new family collapses any previously expanded family.
	    // `expandedFamily` drives the nested endpoints table, while `expandedFamilyInsight` drives
	    // the inline insight panel. We do not support multi-expand across different families.
	    if (state.expandedFamily && state.expandedFamilyInsight && state.expandedFamily !== state.expandedFamilyInsight) {
	      state.expandedFamilyInsight = '';
	    }
	    if (state.expandedFamily && !visibleFamilies[state.expandedFamily]) {
	      state.expandedFamily = "";
	    }
	    if (state.expandedFamilyInsight && !visibleFamilies[state.expandedFamilyInsight]) {
	      state.expandedFamilyInsight = "";
    }

    if (!summaries.length) {
      el.familySurfaceHelp.textContent = state.activeTopTab === 'shape'
        ? 'Response Shape: no families currently expose shape-heavy evidence in this slice.'
        : '';
      el.familySurfaceContext.innerHTML = lensContext;
      bindRecoveryButtons(el.familySurfaceContext);
      var hasWidenAction = !!(state.filters.search
        || state.filters.category !== 'all'
        || state.filters.burden !== 'all'
        || state.filters.familyPressure !== 'all'
        || state.filters.includeNoIssueRows
        || state.familyTableBackState);
      // Contract Issues no-match recovery belongs in the single empty-state block under the filter bar.
      // Keep the surface body minimal so we do not duplicate guidance in multiple panels.
      var recovery = (state.activeTopTab === 'spec-rule') ? '' : (hasWidenAction ? renderRecoveryActions(['clear-table-filters']) : '');
      el.familySurface.innerHTML = '<div class="empty">'
        + '<strong>No matching families.</strong>'
        + '<p class="subtle">No families match the current scope.' + (state.activeTopTab === 'spec-rule' ? ' Use the suggestions above to widen filters.' : (hasWidenAction ? ' Clear table filters to widen the view.' : '')) + '</p>'
        + recovery
        + '</div>';
      bindRecoveryButtons(el.familySurface);
      return;
    }

    el.familySurfaceHelp.textContent = familySurfaceHelpCopy();
    el.familySurfaceContext.innerHTML = lensContext;
    bindRecoveryButtons(el.familySurfaceContext);
    var tableHtml = renderFamilyTableView(summaries);

    el.familySurface.innerHTML = tableHtml;
    bindRecoveryButtons(el.familySurface);
    Array.prototype.forEach.call(el.familySurface.querySelectorAll('button[data-family-sort]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var sortKey = btn.getAttribute('data-family-sort') || 'default';
        if (state.familyTableSort.key === sortKey) {
          state.familyTableSort.direction = state.familyTableSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          state.familyTableSort.key = sortKey;
          state.familyTableSort.direction = 'asc';
        }
        renderFamilySurface();
      });
    });

			    // Insight toggle button handling
			    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-insight-toggle]"), function (btn) {
			      btn.addEventListener("click", function (event) {
			        event.preventDefault();
			        event.stopPropagation();
			        var family = btn.getAttribute("data-insight-toggle") || "";
			        if (!family) return;
			        captureFamilyTableBackStateIfNeeded();
			        var nextFamilyInsight = (state.expandedFamilyInsight === family) ? "" : family;
			        state.expandedFamilyInsight = nextFamilyInsight;
			        if (nextFamilyInsight) {
			          state.expandedFamily = family;
			        }
			        // Expanding/collapsing a family is a new "active row" intent. Clear any prior
			        // selected endpoint so blue selection does not stick to an unrelated row.
			        state.selectedEndpointId = '';
			        state.userSelectedEndpoint = false;
			        state.detailEvidenceOpenForId = '';
			        state.expandedEndpointInsightIds = {};
			        state.expandedEndpointRowFindings = {};
			        renderFamilySurface();
			        renderEndpointDiagnostics();
			        renderEndpointDetail();
			        syncSelectedEndpointHighlight();

			        // "Show insight" should take the user to the family insight workspace.
			        if (nextFamilyInsight) {
			          requestAnimationFrame(function () {
			            var row = el.familySurface
			              ? el.familySurface.querySelector('tr.family-inline-insight-row[data-family="' + family + '"]')
			              : null;
			            var target = row ? (row.querySelector('.family-row-insight') || row) : null;
			            if (target && target.scrollIntoView) {
			              target.scrollIntoView({ block: 'center', behavior: 'smooth' });
			            }
			          });
			        }
			      });
			      var isExpanded = state.expandedFamilyInsight === (btn.getAttribute("data-insight-toggle") || "");
			      btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
			    });

			    // Endpoints expand button handling
			    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-expand-endpoints]"), function (btn) {
			      btn.addEventListener("click", function (event) {
			        event.preventDefault();
			        event.stopPropagation();
			        var family = btn.getAttribute("data-expand-endpoints") || "";
			        if (!family) return;
			        captureFamilyTableBackStateIfNeeded();
			        var nextExpandedFamily = (state.expandedFamily === family) ? "" : family;
			        state.expandedFamily = nextExpandedFamily;
			        if (nextExpandedFamily && state.expandedFamilyInsight && state.expandedFamilyInsight !== nextExpandedFamily) {
			          state.expandedFamilyInsight = '';
			        }
			        // Treat endpoint expansion/collapse as a family-level selection change.
			        // Clear endpoint selection so the highlight follows the user's active family intent.
			        state.selectedEndpointId = '';
			        state.userSelectedEndpoint = false;
			        state.detailEvidenceOpenForId = '';
			        state.expandedEndpointInsightIds = {};
			        state.expandedEndpointRowFindings = {};
			        renderFamilySurface();
			        renderEndpointDiagnostics();
			        renderEndpointDetail();
			        syncSelectedEndpointHighlight();
			      });
			      var expanded = state.expandedFamily === (btn.getAttribute("data-expand-endpoints") || "");
			      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			    });

			    // Inline signal expansion (Response Shape)
			    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-expand-signals]"), function (btn) {
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
			        var x = window.scrollX || 0;
			        var y = window.scrollY || 0;
			        renderFamilySurface();
			        requestAnimationFrame(function () {
			          requestAnimationFrame(function () {
			            window.scrollTo(x, y);
			          });
			        });
			      });
			      var expanded = !!(state.expandedFamilySignals && state.expandedFamilySignals[(btn.getAttribute("data-expand-signals") || "")]);
			      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			    });

	    Array.prototype.forEach.call(el.familySurface.querySelectorAll('button[data-inspect-top-endpoint]'), function (btn) {
	      btn.addEventListener('click', function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        var endpointId = btn.getAttribute('data-inspect-top-endpoint') || '';
	        if (!endpointId) return;
	        selectEndpointForInspector(endpointId);
	      });
	    });

    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-endpoint-insight-toggle]"), function (btn) {
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
        renderFamilySurface();
      });

      var endpointExpanded = !!state.expandedEndpointInsightIds[(btn.getAttribute("data-endpoint-insight-toggle") || "")];
      btn.setAttribute('aria-expanded', endpointExpanded ? 'true' : 'false');
    });

	    Array.prototype.forEach.call(el.familySurface.querySelectorAll('button[data-toggle-row-findings]'), function (btn) {
	      btn.addEventListener('click', function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        var endpointId = btn.getAttribute('data-toggle-row-findings') || '';
	        if (!endpointId) return;
	        if (state.expandedEndpointRowFindings[endpointId]) {
	          delete state.expandedEndpointRowFindings[endpointId];
	        } else {
	          state.expandedEndpointRowFindings[endpointId] = true;
	        }
	        var x = window.scrollX || 0;
	        var y = window.scrollY || 0;
	        renderFamilySurface();
	        requestAnimationFrame(function () {
	          requestAnimationFrame(function () {
	            window.scrollTo(x, y);
	          });
	        });
	        syncSelectedEndpointHighlight();
	      });
	    });

	    // Focus endpoint buttons in expansion
			    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-focus-endpoint]"), function (btn) {
			      btn.addEventListener("click", function (event) {
			        event.preventDefault();
			        event.stopPropagation();
			        var endpointId = btn.getAttribute("data-focus-endpoint") || "";
			        if (!endpointId) return;
		        state.inspectPlacementHint = 'nested';
		        selectEndpointForInspector(endpointId);
			      });
			    });

    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-focus-family]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var family = btn.getAttribute("data-focus-family") || "";
        focusFamilySurface(family);
      });
    });

			    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-open-evidence-id]"), function (btn) {
			      btn.addEventListener("click", function (event) {
		        event.preventDefault();
		        event.stopPropagation();
		        var endpointId = btn.getAttribute("data-open-evidence-id") || "";
		        if (!endpointId) return;
		        state.inspectPlacementHint = 'nested';
		        state.detailEvidenceOpenForId = endpointId;
		        // Clicking a finding-count / evidence CTA must always open the matching evidence groups.
		        selectEndpointForInspector(endpointId, 'exact');
		        syncWorkflowStepSelectionHighlight();
		      });
			    });

		    // Make nested endpoint rows clickable for quick triage into the inspector.
		    Array.prototype.forEach.call(el.familySurface.querySelectorAll(".nested-endpoint-row[data-endpoint-id]"), function (tr) {
		      tr.addEventListener("click", function () {
		        var endpointId = tr.getAttribute("data-endpoint-id") || "";
		        if (!endpointId) return;
		        state.inspectPlacementHint = 'nested';
		        selectEndpointForInspector(endpointId);
		      });
		    });

	    // If the inspector is rendered as a detached workspace (fallback), provide explicit
	    // navigation so users never feel lost.
	    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-jump-to-workspace]"), function (btn) {
	      btn.addEventListener("click", function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        if (!el.endpointDiagnosticsSection) return;
	        var header = el.endpointDiagnosticsSection.querySelector('.section-heading') || el.endpointDiagnosticsSection;
	        header.scrollIntoView({ behavior: 'smooth', block: 'start' });
	      });
	    });
	    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-return-to-row]"), function (btn) {
	      btn.addEventListener("click", function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        var endpointId = btn.getAttribute("data-return-to-row") || "";
	        if (!endpointId) return;
	        var row = el.familySurface.querySelector('.nested-endpoint-row[data-endpoint-id="' + endpointId + '"]') || el.familySurface.querySelector('tr[data-endpoint-id="' + endpointId + '"]');
	        if (!row) return;
	        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
	      });
	    });

	  }

	  function activeFamilyScopeLabel() {
	    var scope = [];
	    scope.push('tab: ' + (state.activeTopTab === 'spec-rule'
	      ? 'contract issues'
	      : state.activeTopTab === 'workflow'
	      ? 'workflow guidance'
	      : 'response shape'));
	    scope.push('category: ' + (state.filters.category === 'all' ? 'all categories' : state.filters.category.replaceAll('-', ' ')));
	    scope.push('burden: ' + (state.filters.burden === 'all' ? 'all burdens' : state.filters.burden.replaceAll('-', ' ')));
	    scope.push('family pressure: ' + (state.filters.familyPressure === 'all' ? 'all tiers' : state.filters.familyPressure));
	    if (state.filters.search) {
	      scope.push('search: "' + state.filters.search + '"');
	    }
	    scope.push('no-issue rows: ' + (state.filters.includeNoIssueRows ? 'included' : 'excluded'));
	    return scope.join(' | ');
	  }

	  function activeTopTabLabel() {
	    if (state.activeTopTab === 'workflow') return 'Workflow Guidance';
	    if (state.activeTopTab === 'shape') return 'Response Shape';
	    return 'Contract Issues';
	  }

  function formatScopeValue(value, fallback) {
    if (value === undefined || value === null) return fallback;
    var v = String(value);
    if (!v) return fallback;
    return v;
  }

  function formatFilterSummaryHtml() {
    var search = state.filters.search ? state.filters.search : '';
    var searchLabel = search ? '<code>' + escapeHtml(search) + '</code>' : '<span class="filter-summary-muted">none</span>';
    var categoryLabel = (state.filters.category === 'all')
      ? '<span class="filter-summary-muted">all</span>'
      : '<code>' + escapeHtml(state.filters.category.replaceAll('-', ' ')) + '</code>';
    var burdenLabel = (state.filters.burden === 'all')
      ? '<span class="filter-summary-muted">all</span>'
      : '<code>' + escapeHtml(state.filters.burden.replaceAll('-', ' ')) + '</code>';
    var pressureLabel = (state.filters.familyPressure === 'all')
      ? '<span class="filter-summary-muted">all</span>'
      : '<code>' + escapeHtml(state.filters.familyPressure) + '</code>';
    var noIssueLabel = state.filters.includeNoIssueRows ? '<code>shown</code>' : '<code>hidden</code>';

    return '<strong>Current filters:</strong> '
      + 'Search ' + searchLabel
      + ' <span class="filter-summary-dot">·</span> Category ' + categoryLabel
      + ' <span class="filter-summary-dot">·</span> Burden ' + burdenLabel
      + ' <span class="filter-summary-dot">·</span> Family pressure ' + pressureLabel
      + ' <span class="filter-summary-dot">·</span> No-issue rows ' + noIssueLabel;
  }

  function renderFilterEmptyState() {
    if (!el.filterEmptyState) return;
    el.filterEmptyState.innerHTML = '';

    // Only show this prescriptive empty state for the Contract Issues lens.
    if (state.activeTopTab !== 'spec-rule') return;

    var families = familySummaries();
    var rows = filteredRows();
    if (families.length || rows.length) return;

    var actions = '<div class="filter-empty-actions">'
      + '<button type="button" class="secondary-action" data-recovery-action="clear-search">Clear search</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="reset-category">Reset category</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="show-all-matching-families">Show all matching families</button>'
      + (!state.filters.includeNoIssueRows ? '<button type="button" class="secondary-action" data-recovery-action="include-no-issue-rows">Include no-issue rows</button>' : '')
      + '</div>';

    el.filterEmptyState.innerHTML = '<section class="filter-empty-panel" aria-label="No matching families">'
      + '<p class="filter-empty-title"><strong>No matching families</strong></p>'
      + '<p class="filter-empty-lead">No contract-issue families match the current filter combination.</p>'
      + '<p class="filter-empty-subtitle"><strong>Why this happened</strong></p>'
      + '<ul class="filter-empty-bullets">'
      + '<li>Your current search/category filter is narrower than the available evidence in this slice.</li>'
      + '</ul>'
      + '<p class="filter-empty-subtitle"><strong>Try one of these</strong></p>'
      + actions
      + '</section>';

    bindRecoveryButtons(el.filterEmptyState);
  }

		  function renderActiveScopeStrip(options) {
		    var opts = options || {};
		    var dense = opts.dense !== false;
		    var search = state.filters.search ? ('"' + state.filters.search + '"') : 'none';
		    var category = state.filters.category === 'all'
		      ? 'all'
		      : (state.filters.category || '').replaceAll('-', ' ');
		    var burden = state.filters.burden === 'all'
		      ? 'all'
		      : (state.filters.burden || '').replaceAll('-', ' ');
		    var pressure = state.filters.familyPressure === 'all'
		      ? 'all'
		      : state.filters.familyPressure;
		    var noIssue = state.filters.includeNoIssueRows ? 'included' : 'excluded';
		    var line = activeTopTabLabel() + ' scope: '
		      + 'search ' + search + ', '
		      + 'category ' + category + ', '
		      + 'burden ' + burden + ', '
		      + 'family pressure ' + pressure + ', '
		      + 'no-issue rows ' + noIssue + '.';

		    return '<div class="active-scope-strip' + (dense ? ' is-dense' : '') + '" role="status" aria-label="Active scope">'
		      + '<p class="active-scope-text" title="' + escapeHtml(line) + '">' + escapeHtml(line) + '</p>'
		      + '</div>';
		  }

	  function renderWhatToDoNextBlock(endpoint, findings, options) {
	    var opts = options || {};
	    var maxItems = typeof opts.maxItems === 'number' ? opts.maxItems : 2;
	    var endpointLabel = (endpoint && endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : '';

	    var actions = collectConcreteNextActions(endpoint || {}, findings || []);
	    if (!actions.length) return '';
	    actions = actions.slice(0, Math.max(1, maxItems));

	    var headline = 'What to do next';
	    var lead = opts.leadCopy || 'Pick one of these concrete changes and apply it directly in the OpenAPI contract.';

	    return '<section class="next-actions-block" aria-label="' + escapeHtml(headline) + '">'
	      + '<p class="next-actions-title">' + escapeHtml(headline) + '</p>'
	      + (lead ? '<p class="subtle next-actions-lead">' + escapeHtml(lead) + '</p>' : '')
	      + '<ul class="next-actions-list">'
	      + actions.map(function (a) { return '<li>' + escapeHtml(a) + '</li>'; }).join('')
	      + '</ul>'
	      + (endpointLabel && opts.showEndpointLabel ? '<p class="subtle next-actions-endpoint">' + escapeHtml(endpointLabel) + '</p>' : '')
	      + '</section>';
	  }

			  function renderInspectorWorkspaceHeader(detail, findings, options) {
			    var opts = options || {};
			    var endpoint = (detail && detail.endpoint) ? detail.endpoint : {};
			    // Keep the inspector header to a single clean line: method/path + issue count.
			    // Deeper interpretation belongs inside the tabs below, not in the header chrome.
			    var lensFindings = Array.isArray(findings) ? findings : findingsForActiveLens(findings || []);
			    var countLabel = lensFindings.length + ' issue' + (lensFindings.length === 1 ? '' : 's');
			    var endpointLabel = (((endpoint.method || '').toUpperCase() + ' ' + (endpoint.path || '')).trim());
			    var collapseTarget = String(opts.collapseTarget || '');
			    var collapsed = !!opts.collapsed;
			    var collapseBtn = collapseTarget
			      ? ('<button type="button" class="tertiary-action workspace-collapse-toggle"'
			          + ' data-workspace-collapse-toggle="' + escapeHtml(collapseTarget) + '"'
			          + ' aria-expanded="' + (collapsed ? 'false' : 'true') + '"'
			          + ' data-open-label="Collapse" data-closed-label="Expand"'
			          + ' title="' + escapeHtml(collapsed ? 'Expand workspace' : 'Collapse workspace') + '">'
			          + escapeHtml(collapsed ? 'Expand' : 'Collapse')
			          + '</button>')
			      : '';

			    return '<div class="inspector-workspace-head">'
			      + '<div class="inspector-identity-row">'
			      + '<div class="inspector-selected-line">'
			      + '<code class="inspector-endpoint-code">' + escapeHtml(endpointLabel) + '</code>'
			      + '<span class="inspector-issue-count" aria-label="' + escapeHtml(countLabel) + '">' + escapeHtml(countLabel) + '</span>'
			      + '</div>'
			      + collapseBtn
			      + '</div>'
			      + '</div>';
			  }

	  function collectConcreteNextActions(endpoint, findings) {
	    var actions = [];
	    var seen = {};

	    function push(action) {
	      if (!action) return;
	      var key = action.trim().toLowerCase();
	      if (!key || seen[key]) return;
	      seen[key] = true;
	      actions.push(action);
	    }

	    var endpointLabel = (endpoint && endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : 'this endpoint';
	    var lensFindings = findingsForActiveLens(findings || []);

	    // 1) Spec-rule: missing Response Object descriptions → call out exact response codes.
	    var missingDescCodes = {};
	    lensFindings.forEach(function (finding) {
	      if (!finding || finding.evidenceType !== 'spec-rule') return;
	      var ruleId = finding.specRuleId || finding.code || '';
	      if (ruleId !== 'OAS-RESPONSE-DESCRIPTION-REQUIRED') return;
	      var ctx = extractOpenAPIContext(finding);
	      if (ctx && ctx.statusCode) missingDescCodes[ctx.statusCode] = true;
	    });
	    var descCodes = Object.keys(missingDescCodes).sort();
	    if (descCodes.length) {
	      push('Add missing response descriptions for responses ' + descCodes.join('/') + ' on ' + endpointLabel + '.');
	    }

	    // 2) Likely missing enum values.
	    var enumField = '';
	    lensFindings.some(function (finding) {
	      if (!finding) return false;
	      if ((finding.code || '') !== 'likely-missing-enum') return false;
	      var msg = finding.message || '';
	      var match = msg.match(/property '([^']+)'/) || msg.match(/field '([^']+)'/);
	      enumField = match ? match[1] : (extractOpenAPIContext(finding).primaryValue || '');
	      return true;
	    });
	    if (enumField) {
	      push('Declare enum values for ' + enumField + '.');
	    }

	    // 3) Workflow continuity: nextAction/context/handoff fields.
	    var hasNextAction = lensFindings.some(function (f) {
	      var c = (f && f.code) ? f.code : '';
	      return c === 'weak-outcome-next-action-guidance'
	        || c === 'weak-follow-up-linkage'
	        || c === 'weak-action-follow-up-linkage'
	        || c === 'weak-accepted-tracking-linkage'
	        || c === 'prerequisite-task-burden';
	    });
	    if (hasNextAction) {
	      push('Expose `nextAction` and required context/handoff identifiers explicitly in the response.');
	    }

	    // 4) Fallback: use the top contract improvement items (already concrete + targeted).
	    if (actions.length < 1) {
	      var items = buildContractImprovementItems({ endpoint: endpoint }, lensFindings);
	      items.slice(0, 2).forEach(function (item) {
	        if (!item || !item.change) return;
	        push(item.change + (item.where ? (' (Where: ' + item.where + ')') : ''));
	      });
	    }

	    return actions;
	  }

	  function familySurfaceHelpCopy() {
	    var burden = state.filters.burden;
	    if (burden === 'workflow-burden') {
	      return 'Families ranked by workflow burden in the current slice: hidden dependencies, brittle sequencing, missing handoff IDs, and weak next-step cues.';
	    }
    if (burden === 'contract-shape') {
      return 'Families ranked by response-shape burden in the current slice: deep nesting, duplicated state, incidental/internal fields, and snapshot-heavy responses.';
    }
    return state.activeTopTab === 'shape'
      ? 'Response Shape: families ranked by shape friction for the current slice.'
      : state.activeTopTab === 'workflow'
      ? 'Workflow Guidance: families ranked by visible workflow pressure for the current slice.'
      : 'Contract Issues: families ranked by visible contract evidence for the current slice.';
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
	      el.workflowChains.innerHTML = renderWorkflowChainsDrawer(renderWorkflowEmptyState('absent'), 0);
	      bindWorkflowChainsDrawerToggle();
	      return;
	    }

    var visibleRows = filteredRows();
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
    rowsInScopeAll().forEach(function (row) {
      scopedByID[row.id] = true;
    });
    var scopedChains = allChains.filter(function (chain) {
      return (chain.endpointIds || []).some(function (eid) {
        return !!scopedByID[eid];
      });
    });

    el.workflowSection.style.display = 'block';

    var chainSource = filteredChains.length ? filteredChains : scopedChains;
    var workflowGuideHtml = renderWorkflowGuideSection(chainSource);
    var journeyGuidanceHtml = renderCommonWorkflowJourneys(chainSource);

	    if (filteredChains.length) {
	      el.workflowHelp.textContent = 'Docs-style inferred flow guide for the current lens. Selecting a step scopes the family and endpoint evidence below to the matching API surface.';
	      var groups = groupChainsByKind(filteredChains);
	      el.workflowChains.innerHTML = renderWorkflowChainsDrawer(workflowGuideHtml + journeyGuidanceHtml + groups.map(renderWorkflowKindGroup).join(''), filteredChains.length);
	      bindWorkflowStepInteractions();
	      syncWorkflowStepSelectionHighlight();
	      bindWorkflowChainsDrawerToggle();
	      return;
	    }

	    if (scopedChains.length) {
	      el.workflowHelp.textContent = 'No chains overlap the current evidence-only slice. Showing inferred call chains from scoped endpoints so the sequence remains visible.';
	      var scopedGroups = groupChainsByKind(scopedChains);
	      el.workflowChains.innerHTML = renderWorkflowChainsDrawer(workflowGuideHtml + journeyGuidanceHtml + '<div class="workflow-no-match">'
	        + '<p class="workflow-empty-title"><strong>Call chain surface restored for this lens</strong></p>'
	        + '<p class="workflow-empty-copy">Visible issue rows are currently too narrow for direct chain overlap, so this section keeps the inferred sequence visible from the scoped endpoint set.</p>'
	        + renderRecoveryActions(['show-all-workflows'])
	        + '</div>'
	        + scopedGroups.map(renderWorkflowKindGroup).join(''), scopedChains.length);
	      bindRecoveryButtons(el.workflowChains);
	      bindWorkflowStepInteractions();
	      syncWorkflowStepSelectionHighlight();
	      bindWorkflowChainsDrawerToggle();
	      return;
	    }

	    el.workflowHelp.textContent = '';
	    el.workflowChains.innerHTML = renderWorkflowChainsDrawer(workflowGuideHtml + journeyGuidanceHtml + renderWorkflowEmptyState('filtered'), 0);
	    bindRecoveryButtons(el.workflowChains);
	    bindWorkflowChainsDrawerToggle();
	  }

		  function renderWorkflowChainsDrawer(innerHtml, chainCount) {
		    var count = (typeof chainCount === 'number' && isFinite(chainCount)) ? chainCount : 0;
		    var countLabel = count
		      ? (count + ' chain' + (count === 1 ? '' : 's') + ' in view')
		      : 'no chains in view';
		    var openAttr = state.workflowChainsOpen ? ' open' : '';

		    return '<details class="workflow-chains-drawer"' + openAttr + ' data-workflow-chains-drawer="1">'
		      + '<summary class="workflow-chains-drawer-summary">'
		      + '<strong>Workflow chain view</strong>'
		      + '<span class="workflow-chains-drawer-meta">' + escapeHtml(countLabel) + '</span>'
		      + '</summary>'
		      + '<div class="workflow-chains-drawer-body">'
		      + '<div class="details-close-row details-close-row-tight"><button type="button" class="tertiary-action details-close-btn" data-close-details="1" aria-label="Hide workflow chain view" title="Hide workflow chain view">Hide workflow chain view</button></div>'
		      + innerHtml
		      + '</div>'
		      + '</details>';
		  }

		  function bindWorkflowChainsDrawerToggle() {
		    var drawer = el.workflowChains ? el.workflowChains.querySelector('[data-workflow-chains-drawer]') : null;
		    if (!drawer) return;
		    drawer.addEventListener('toggle', function () {
		      state.workflowChainsOpen = !!drawer.open;
		    });

		    // Ensure the in-panel close action works (Hide workflow chain view).
		    Array.prototype.forEach.call(drawer.querySelectorAll('button[data-close-details]'), function (btn) {
		      if (btn.__closeDetailsBound) return;
		      btn.__closeDetailsBound = true;
		      btn.addEventListener('click', function (event) {
		        event.preventDefault();
		        event.stopPropagation();
		        drawer.open = false;
		      });
		    });
		  }

	  function renderWorkflowGuideSection(chains) {
	    var sourceChains = (chains || []).slice();
	    if (!sourceChains.length) return '';

    var featured = sourceChains.slice().sort(function (a, b) {
      var burdenDiff = chainBurdenScore(b) - chainBurdenScore(a);
      if (burdenDiff !== 0) return burdenDiff;
      return (b.endpointIds || []).length - (a.endpointIds || []).length;
    }).slice(0, 3);

    if (!featured.length) return '';

	    return '<section class="workflow-guide-section">'
	      + '<div class="workflow-guide-header">'
	      + '<h3 class="workflow-guide-title">Common API call paths and where they break</h3>'
	      + '<p class="workflow-guide-copy">Follow the inferred steps in order. Each step shows the endpoint, purpose, required state or context, hidden dependency or trap, and likely next action so the contract burden is visible like a flow guide, not a flat endpoint list.</p>'
	      + '</div>'
	      + '<div class="workflow-guide-cards">'
	      + featured.map(function (chain, index) {
          return renderWorkflowGuideCard(chain, index === 0);
        }).join('')
      + '</div>'
      + '</section>';
  }

  function renderWorkflowGuideCard(chain, isLead) {
    var roles = parseChainRoles(chain.summary, (chain.endpointIds || []).length);
    var burdenSummary = renderWorkflowBurdenSummary(chain, roles);
    var leadClass = isLead ? ' workflow-guide-card-lead' : '';
    var reasonHtml = chain.reason
      ? '<p class="workflow-guide-reason"><strong>Why this path exists:</strong> ' + escapeHtml(chain.reason) + '</p>'
      : '';

    return '<article class="workflow-guide-card' + leadClass + '">'
      + '<div class="workflow-guide-card-head">'
      + '<p class="workflow-guide-card-kicker">' + escapeHtml(kindGroupLabel(chain.kind || 'workflow')) + '</p>'
      + '<div class="workflow-guide-card-meta">'
      + '<strong>' + escapeHtml(chainTaskLabel(chain)) + '</strong>'
      + '<span>' + escapeHtml((chain.endpointIds || []).length + ' steps') + '</span>'
      + '<span>' + escapeHtml(chainBurdenScore(chain) + ' burden signals') + '</span>'
      + '</div>'
      + '</div>'
      + reasonHtml
      + burdenSummary
      + '<div class="workflow-guide-chain">'
      + renderWorkflowChain(chain, true)
      + '</div>'
      + '</article>';
  }

  function bindWorkflowStepInteractions() {
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('[data-step-id]'), function (elem) {
      elem.addEventListener('click', function () {
        var endpointId = elem.getAttribute('data-step-id') || '';
        if (!endpointId) return;
        var detail = state.payload.endpointDetails[endpointId];
        var family = detail && detail.endpoint ? (detail.endpoint.family || '') : '';
        state.selectedEndpointId = endpointId;
        state.endpointDiagnosticsSubTab = 'summary';
        if (family) {
          focusFamilySurface(family);
          return;
        }
        renderEndpointRows();
        renderEndpointDiagnostics();
        renderEndpointDetail();
        syncWorkflowStepSelectionHighlight();
      });
    });

    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('[data-step-open-evidence]'), function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var endpointId = btn.getAttribute('data-step-open-evidence') || '';
        if (!endpointId) return;
        var detail = state.payload.endpointDetails[endpointId];
        var family = detail && detail.endpoint ? (detail.endpoint.family || '') : '';
        state.selectedEndpointId = endpointId;
        state.endpointDiagnosticsSubTab = 'exact';
        state.detailEvidenceOpenForId = endpointId;
        if (family) {
          focusFamilySurface(family);
          state.endpointDiagnosticsSubTab = 'exact';
          state.detailEvidenceOpenForId = endpointId;
          return;
        }
        renderEndpointRows();
        renderEndpointDiagnostics();
        renderEndpointDetail();
        syncWorkflowStepSelectionHighlight();
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
        + '<p class="workflow-empty-title"><strong>No inferred workflow chains</strong></p>'
        + '<p class="workflow-empty-copy">This spec currently reads as isolated endpoints rather than a linked call sequence, so there is nothing to expand in this section.</p>'
        + '<p class="workflow-empty-note">That is a final state for this spec, not a filter mismatch.</p>'
        + '</div>';
    }

    if (!filteredRows().length) {
      return '<div class="workflow-no-match">'
        + '<p class="workflow-empty-title"><strong>No workflows match the current scope</strong></p>'
        + '<p class="workflow-empty-copy">Clear filters or show all workflow patterns to widen the view.</p>'
        + renderRecoveryActions(['show-all-workflows'])
        + '</div>';
	    }

    return '<div class="workflow-no-match">'
      + '<p class="workflow-empty-title"><strong>No workflows match the current scope</strong></p>'
      + '<p class="workflow-empty-copy">Show all workflow patterns to widen this section without changing tabs.</p>'
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
    return KIND_GROUP_LABEL[kind] || kind.replace(/-/g, ' to ');
  }

  function chainTaskLabel(chain) {
    var roles = parseChainRoles(chain.summary);
    if (roles.length >= 2) {
      var first = humanizeStepRole(roles[0]);
      var last = humanizeStepRole(roles[roles.length - 1]);
      if (first && last && first !== last) {
        return first + ' to ' + last;
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
        return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
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
    var hasShapeOutcomeSignals = false;

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
	      changed = 'creates new server-side state (response should expose the new identifier/status)';
	    } else if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
	      changed = 'mutates server-side state (response should expose the outcome and updated authoritative fields)';
	    } else {
	      changed = 'returns current state for downstream steps (response should expose the fields needed for the next call)';
	    }

    var requiredState = '';
    if ((clues.prereq || []).length) {
      requiredState = clues.prereq[0];
    } else if ((clues.nextNeeds || []).length) {
      requiredState = clues.nextNeeds[0];
    } else if (/(token|context|authorization|header|access\s*key|api[-\s]?key)/i.test(messages)) {
      requiredState = 'auth/context token in response or headers';
    } else if (/(identifier|id|tracking)/i.test(messages) || /(\{[^}]+\})/.test(endpoint.path || '')) {
      requiredState = 'resource identifier carried forward from an earlier response';
    } else if (/cart|order|customer/.test(path)) {
      requiredState = 'current ' + (path.indexOf('cart') !== -1 ? 'cart' : (path.indexOf('order') !== -1 ? 'order' : 'customer')) + ' state';
    } else {
      requiredState = 'response state needed by downstream calls';
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
    // Response-shape critiques live in the Response Shape tab. Workflow Guidance stays
    // focused on chaining/continuity burden (handoffs, next steps, context transfer).

	    return {
	      callDoes: callDoes,
	      changesAfter: changed,
	      requiredState: requiredState,
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

    var linkageFindings = findings.filter(function (f) {
      return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
    });

    var prerequisiteFindings = findings.filter(function (f) {
      return f.code === 'prerequisite-task-burden';
    });

    var isLast = stepIndex === (totalSteps - 1);

    var warnings = [];
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
	      + '<div class="step-narrative-row"><span class="step-narrative-label">What this call does</span><span class="step-narrative-value">' + escapeHtml(narrative.callDoes) + '</span></div>'
	      + '<div class="step-narrative-row"><span class="step-narrative-label">What you need before calling it</span><span class="step-narrative-value">' + escapeHtml(narrative.requiredState) + '</span></div>'
	      + '<div class="step-narrative-row"><span class="step-narrative-label">What changes after it succeeds</span><span class="step-narrative-value">' + escapeHtml(narrative.changesAfter || '') + '</span></div>'
	      + '<div class="step-narrative-row"><span class="step-narrative-label">What to call next</span><span class="step-narrative-value">' + escapeHtml(narrative.nextAction) + '</span></div>'
	      + '</div>';
	    var trapHtml = renderTrapGuidanceList(trapGuidance, {
	      title: 'Common hidden traps',
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

  var SPEC_RULE_WHY = {
    'OAS-RESPONSE-DESCRIPTION-REQUIRED': 'Docs and generated clients lose intent when response semantics are missing.',
    'OAS-OPERATION-ID-UNIQUE':           'Client generation and tooling can break when operationId collides.',
    'OAS-NO-SUCCESS-RESPONSE':           'Clients cannot rely on a success contract when 2xx responses are undefined.',
    'OAS-GET-REQUEST-BODY':              'Tooling and intermediaries may drop or mishandle GET request bodies.',
    'OAS-204-HAS-CONTENT':               'Clients may mis-handle responses when 204 contradicts a response body.'
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
        + 'This issue appears in most visible endpoints, so it is likely a broad contract problem, not a one-off.'
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

  function renderSpecRuleBanner(ruleGroups, totalEndpoints) {
    if (!ruleGroups || !ruleGroups.length) return '';
    var top = ruleGroups[0];
    var summary = top.summary || (SPEC_RULE_SUMMARY[top.ruleId] || top.ruleId);
    var more = ruleGroups.length > 1 ? (' (and ' + (ruleGroups.length - 1) + ' more)') : '';
    var severityLabel = (top.severity || 'info').toUpperCase();
    var level = top.normativeLevel || '';
    var affected = (top.endpointCount || 0) + '/' + (totalEndpoints || 0);
    var why = SPEC_RULE_WHY[top.ruleId] || 'Improves spec validity and makes tooling and client integrations more reliable.';

    return '<div class="spec-rule-banner">'
      + '<div class="spec-rule-banner-field">'
      + '<span class="spec-rule-banner-label">Rule</span>'
      + '<span class="spec-rule-banner-value"><code>' + escapeHtml(top.ruleId) + '</code> <span class="spec-rule-banner-summary">' + escapeHtml(summary) + more + '</span></span>'
      + '</div>'
      + '<div class="spec-rule-banner-field">'
      + '<span class="spec-rule-banner-label">Severity</span>'
      + '<span class="spec-rule-banner-value"><span class="spec-rule-severity sev-' + escapeHtml((top.severity || 'info')) + '">' + escapeHtml(severityLabel) + '</span>'
      + (level ? (' <span class="spec-norm-badge ' + ((level === 'REQUIRED' || level === 'MUST' || level === 'MUST NOT') ? 'spec-level-must' : 'spec-level-should') + '">' + escapeHtml(level) + '</span>') : '')
      + '</span>'
      + '</div>'
      + '<div class="spec-rule-banner-field">'
      + '<span class="spec-rule-banner-label">Affected endpoints</span>'
      + '<span class="spec-rule-banner-value">' + escapeHtml(affected) + '</span>'
      + '</div>'
      + '<div class="spec-rule-banner-field">'
      + '<span class="spec-rule-banner-label">Why it matters</span>'
      + '<span class="spec-rule-banner-value">' + escapeHtml(why) + '</span>'
      + '</div>'
      + '</div>';
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

  function sumSignalCounts(map) {
    return Object.keys(map || {}).reduce(function (sum, key) {
      return sum + (map[key] || 0);
    }, 0);
  }

  function pickFamilyDominantDriver(family) {
    var workflowScore = sumSignalCounts(family.workflowSignalCounts || {});
    var shapeScore = sumSignalCounts(family.shapeSignalCounts || {});
    var contractScore = sumSignalCounts(family.consistencySignalCounts || {});

    Object.keys(family.burdenCounts || {}).forEach(function (key) {
      if (key !== 'workflow-burden' && key !== 'contract-shape') {
        contractScore += family.burdenCounts[key] || 0;
      }
    });

    // The UI "Driver" badge collapses shape + contract consistency into Contract-driven.
    // Mixed means both workflow and contract-shaped pressures are meaningfully present.
    var contractishScore = contractScore + shapeScore;
    var top = Math.max(workflowScore, contractishScore);
    var second = Math.min(workflowScore, contractishScore);
    var mixed = top > 0 && second > 0 && (second / top) >= 0.6;

    // Use signalKey to decide which signal family to pull dominant signals/focus from.
    var contractSignalKey = (shapeScore >= contractScore && shapeScore > 0) ? 'shape' : 'contract';

	    if (mixed) {
	      return { key: 'mixed', label: 'Mixed driver', signalKey: (workflowScore >= contractishScore ? 'workflow' : contractSignalKey), score: top };
	    }
	    if (workflowScore >= contractishScore) {
	      return { key: 'workflow', label: 'Mostly workflow driven', signalKey: 'workflow', score: workflowScore };
	    }
	    return { key: 'contract', label: 'Mostly contract driven', signalKey: contractSignalKey, score: contractishScore };
	  }

  function familyDominantSignalsForDriver(family, driverKey) {
    if (driverKey === 'workflow') {
      return sortedSignalLabels(family.workflowSignalCounts || {}, 2);
    }
    if (driverKey === 'shape') {
      return sortedSignalLabels(family.shapeSignalCounts || {}, 2);
    }
    var contractSignals = sortedSignalLabels(family.consistencySignalCounts || {}, 2);
    if (contractSignals.length) return contractSignals;
    return (family.topDimensions || []).slice(0, 2);
  }

  function familyDxSignalFragment(signal) {
    var map = {
      'hidden token/context handoff appears likely': 'handoff context is implicit',
      'next step not clearly exposed': 'next actions are implicit',
      'sequencing appears brittle': 'workflow sequencing feels brittle',
      'auth/header burden spread across steps': 'auth/header requirements are scattered',
      'response appears snapshot-heavy': 'snapshot-heavy payloads bury the outcome',
      'deep nesting appears likely': 'deep nesting dominates response reading',
      'duplicated state appears likely': 'state appears duplicated across fields',
      'incidental/internal fields appear to dominate': 'internal fields dominate responses',
      'source-of-truth fields are unclear': 'source-of-truth fields are ambiguous',
      'outcome framing is easy to miss': 'outcome framing is weak',
      'next action is weakly exposed': 'next actions are implicit',
      'parameter naming drift appears likely': 'parameter naming drifts across related endpoints',
      'path style drift appears likely': 'path patterns drift across related endpoints',
      'response shape drift appears likely': 'response shapes drift across related endpoints',
      'outcome modeled differently across similar endpoints': 'outcome wording drifts across related endpoints'
    };
    return map[signal] || humanizeSignalLabel(signal).toLowerCase();
  }

  function toSentenceCase(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

			  function familyRecommendedAction(driverKey, dominantSignals) {
			    var signals = dominantSignals || [];
			    var s0 = (signals[0] || '').toLowerCase();
			    var s1 = (signals[1] || '').toLowerCase();
			    var blob = (s0 + ' | ' + s1).trim();

			    if (driverKey === 'workflow') {
			      if (/description/.test(blob)) return 'Add missing response descriptions';
			      if (/enum|typing|weak typing/.test(blob)) return 'Declare missing enums';
			      if (/token|context handoff|handoff context|next step|next action|implicit|handoff/.test(blob)) return 'Expose nextAction and required context';
			      if (/sequencing|brittle|prerequisite/.test(blob)) return 'Expose prerequisites and required ordering cues';
			      if (/auth\/header|auth|header/.test(blob)) return 'Expose auth/header requirements in schema and errors';
			      return 'Expose nextAction and required context';
			    }

			    if (driverKey === 'shape') {
			      if (/description/.test(blob)) return 'Add missing response descriptions';
			      if (/enum|typing|weak typing/.test(blob)) return 'Declare missing enums';
			      if (/snapshot-heavy|storage-shaped|outcome|next action/.test(blob)) return 'Expose nextAction and required context';
			      if (/deep nesting/.test(blob)) return 'Move outcome and handoff IDs to top-level fields';
			      if (/duplicated state/.test(blob)) return 'Remove duplicated state; keep one canonical field';
			      if (/internal fields|incidental/.test(blob)) return 'Move internal fields out of default payloads';
			      return 'Expose nextAction and required context';
			    }

			    // Contract / drift driver
			    if (/description/.test(blob)) return 'Add missing response descriptions';
			    if (/enum|typing|weak typing/.test(blob)) return 'Declare missing enums';
			    if (/parameter naming/.test(blob)) {
			      return 'Normalize parameter naming across sibling endpoints';
			    }
			    if (/path style|path patterns/.test(blob)) {
			      return 'Align path templates across sibling routes';
			    }
			    if (/response shape drift|response shapes drift/.test(blob)) {
			      return 'Align response schemas across sibling endpoints';
			    }
			    return 'Normalize contract patterns across sibling endpoints';
			  }

	  function familyPrimaryRisk(driverKey, dominantSignals) {
	    var signals = dominantSignals || [];
	    var s0 = (signals[0] || '').toLowerCase();
	    var s1 = (signals[1] || '').toLowerCase();
	    var blob = (s0 + ' | ' + s1).trim();

	    if (driverKey === 'workflow') {
	      if (/handoff context|token\/context/.test(blob)) return 'Hidden handoff context (workflow breaks between calls)';
	      if (/auth\/header|auth|header/.test(blob)) return 'Auth/context requirements are scattered across steps';
	      if (/sequencing|brittle/.test(blob)) return 'Brittle sequencing (implicit prerequisites and ordering)';
	      if (/next step|next action|implicit/.test(blob)) return 'Next step is not visible (clients stall after success)';
	      return 'Workflow continuity risk (missing explicit handoffs and next steps)';
	    }

	    if (driverKey === 'shape') {
	      if (/deep nesting/.test(blob)) return 'Deep nesting hides the outcome and handoff fields';
	      if (/duplicated state/.test(blob)) return 'Duplicated state creates ambiguity about what is authoritative';
	      if (/internal fields|incidental/.test(blob)) return 'Incidental/internal fields encourage brittle client coupling';
	      if (/snapshot-heavy|storage-shaped/.test(blob)) return 'Storage-shaped payload buries task outcome and next action';
	      if (/enum|weak typing|typing/.test(blob)) return 'Weak typing (missing enums/constraints) increases client guesswork';
	      return 'Response-shape burden (hard to parse and hard to hand off)';
	    }

	    if (/parameter naming/.test(blob)) return 'Parameter naming drift breaks reuse across sibling routes';
	    if (/path style|path patterns/.test(blob)) return 'Path template drift makes route composition unpredictable';
	    if (/response shape drift|response shapes drift/.test(blob)) return 'Response shape drift forces per-endpoint parsing branches';
	    return 'Contract drift across similar endpoints (inconsistent patterns and meanings)';
	  }

	  function familyDriverFocus(driverKey, dominantSignals) {
	    var signals = (dominantSignals || []).map(function (s) { return (s || '').toLowerCase(); });
	    var blob = signals.join(' | ');
	    if (driverKey === 'workflow') {
	      if (/handoff/.test(blob)) return 'Focus: handoff context + IDs';
	      if (/next step|next action/.test(blob)) return 'Focus: next step visibility';
	      if (/sequencing|brittle/.test(blob)) return 'Focus: prerequisites + ordering';
	      return 'Focus: continuity signals';
	    }
	    if (driverKey === 'shape') {
	      if (/deep nesting/.test(blob)) return 'Focus: deep nesting';
	      if (/snapshot-heavy/.test(blob)) return 'Focus: snapshot-heavy responses';
	      if (/duplicated state/.test(blob)) return 'Focus: duplicated state';
	      if (/internal/.test(blob)) return 'Focus: internal fields';
	      return 'Focus: response shape';
	    }
	    if (/parameter naming/.test(blob)) return 'Focus: parameter consistency';
	    if (/path style/.test(blob)) return 'Focus: route shape consistency';
	    if (/response shape drift/.test(blob)) return 'Focus: response consistency';
	    return 'Focus: sibling consistency';
	  }

		  function renderFamilyTableClamp(text, className) {
		    var value = text || '—';
		    return '<div class="' + className + '" title="' + escapeHtml(value) + '">' + escapeHtml(value) + '</div>';
		  }

		  function familyTopSignalLabelForRow(family, ranked) {
		    var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
		    var top = items.length ? items[0] : '';
		    return top ? humanizeSignalLabel(top) : '—';
		  }

		  function familyRecommendedNextClick(family, ranked) {
		    // Keep this stable, one-line, and action-oriented. Avoid prose blocks.
		    if ((family && family.endpoints) || (family && family.endpoints === 0)) {
		      return 'Click Endpoints count to expand, then Inspect endpoint';
		    }
		    return 'Expand endpoints, then Inspect endpoint';
		  }

			  function familySignalItemsForActiveLens(family, ranked) {
			    var activeBurden = state.filters.burden;
			    // Workflow Guidance must always read as continuity-first.
			    if (state.activeTopTab === 'workflow') {
			      return sortedSignalLabels(family.workflowSignalCounts || {}, 50);
			    }
			    if (activeBurden === 'workflow-burden') return sortedSignalLabels(family.workflowSignalCounts || {}, 50);
			    if (activeBurden === 'contract-shape') return sortedSignalLabels(family.shapeSignalCounts || {}, 50);
			    if (activeBurden === 'consistency') return sortedSignalLabels(family.consistencySignalCounts || {}, 50);
		    var dims = (family.topDimensions || []).slice();
		    if (dims.length) return dims;
		    return (ranked && ranked.dominantSignals) ? ranked.dominantSignals.slice() : [];
		  }

			  function renderFamilyDominantSignalsCell(family, ranked) {
			    var activeBurden = state.filters.burden;
			    var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
			    if (!items.length) {
		      if (activeBurden === 'workflow-burden') items = ['missing next action'];
		      else if (activeBurden === 'contract-shape') items = ['storage-shaped response'];
		      else if (activeBurden === 'consistency') items = ['path/param drift'];
		      else items = ['mixed contract signals'];
			    }

		    var familyName = (family && family.family) ? family.family : 'unlabeled family';
		    var inlineExpand = state.activeTopTab === 'shape';
		    var expanded = inlineExpand && !!(state.expandedFamilySignals && state.expandedFamilySignals[familyName]);

		    // Response Shape: default to 2 "primary" chips, but inline-render up to 2 extra
		    // signals (total 3–4) to avoid pointless interaction cost. Only collapse when
		    // 3+ are hidden (total 5+).
		    //
		    // Other tabs keep the legacy behavior: show all when 3 or fewer, else clamp.
		    var visibleCount;
		    if (inlineExpand) {
		      visibleCount = expanded ? items.length : (items.length <= 4 ? items.length : 2);
		    } else {
		      visibleCount = items.length <= 3 ? items.length : 2;
		    }
		    var visible = items.slice(0, visibleCount);
		    var hidden = items.slice(visibleCount);
		    var visibleChips = visible.map(function (c, i) {
		      var cls = i === 0 ? 'chip chip-primary family-signal-chip' : 'chip chip-secondary family-signal-chip';
		      var label = humanizeSignalLabel(c);
		      return '<span class="' + cls + '" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">' + escapeHtml(label) + '</span></span>';
		    }).join('');

		    var hiddenChips = hidden.map(function (c) {
		      var label = humanizeSignalLabel(c);
		      return '<span class="chip chip-secondary family-signal-chip" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">' + escapeHtml(label) + '</span></span>';
		    }).join('');

		    var more = '';
		    if (inlineExpand && items.length > 4) {
		      var label = expanded ? 'Hide extra signals' : ('Show ' + hidden.length + ' more');
		      more = '<button type="button" class="tertiary-action family-signal-expand" data-expand-signals="' + escapeHtml(familyName) + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">'
		        + escapeHtml(label)
		        + '</button>';
		    }

		    return '<div class="family-signal-cell">'
		      + '<div class="chips family-signal-chips">' + visibleChips + (expanded ? hiddenChips : '') + '</div>'
		      + more
		      + '</div>';
		  }

			  function renderFamilyTopSignalCell(family, ranked) {
			    var activeBurden = state.filters.burden;
			    var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
			    if (!items.length) {
		      if (activeBurden === 'workflow-burden') items = ['missing next action'];
		      else if (activeBurden === 'contract-shape') items = ['storage-shaped response'];
		      else if (activeBurden === 'consistency') items = ['path/param drift'];
		      else items = ['mixed contract signals'];
			    }

			    var familyName = (family && family.family) ? family.family : 'unlabeled family';
			    var inlineExpand = state.activeTopTab === 'shape';
			    var expanded = inlineExpand && !!(state.expandedFamilySignals && state.expandedFamilySignals[familyName]);

			    // Response Shape: default to 2 "primary" chips, but inline-render up to 2 extra
			    // signals (total 3–4). Only collapse when 3+ are hidden (total 5+).
			    //
			    // Other tabs keep the legacy behavior: show all when 3 or fewer, else clamp.
			    var visibleCount;
			    if (inlineExpand) {
			      visibleCount = expanded ? items.length : (items.length <= 4 ? items.length : 2);
			    } else {
			      visibleCount = items.length <= 3 ? items.length : 2;
			    }
			    var visible = items.slice(0, visibleCount).map(function (raw, idx) {
			      var label = raw ? humanizeSignalLabel(raw) : '—';
			      var cls = idx === 0 ? 'chip chip-primary family-signal-chip' : 'chip chip-secondary family-signal-chip';
			      return '<span class="' + cls + '" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">' + escapeHtml(label) + '</span></span>';
			    }).join('');
			    var hidden = items.slice(visibleCount);

		    var hiddenChips = hidden.map(function (c) {
		      var label = humanizeSignalLabel(c);
		      return '<span class="chip chip-secondary family-signal-chip" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">' + escapeHtml(label) + '</span></span>';
		    }).join('');

			    var more = '';
			    if (inlineExpand && items.length > 4) {
			      var label = expanded ? 'Hide extra signals' : ('Show ' + hidden.length + ' more');
			      more = '<button type="button" class="tertiary-action family-signal-expand" data-expand-signals="' + escapeHtml(familyName) + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">'
			        + escapeHtml(label)
			        + '</button>';
			    }

		    return '<div class="family-signal-cell family-top-signal-cell">'
		      + '<div class="chips family-signal-chips">' + visible + (expanded ? hiddenChips : '') + '</div>'
		      + more
		      + '</div>';
		  }

		  function bestEndpointIdForFamily(familyName) {
		    if (!familyName) return '';
		    var rows = filteredRows().filter(function (row) {
		      return (row.family || 'unlabeled family') === familyName;
		    });
		    if (!rows.length) return '';

		    var best = null;
		    rows.forEach(function (row) {
		      var detail = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails[row.id] : null;
		      var lens = detail ? findingsForActiveLens(detail.findings || []) : [];
		      var count = lens.length;
		      var severity = dominantSeverity(lens);
		      var score = (count * 10) + Math.max(0, 3 - severityPriority(severity));
		      if (!best || score > best.score) {
		        best = { id: row.id, score: score };
		      }
		    });
		    return best ? best.id : rows[0].id;
		  }

			  function renderFamilyRecommendedNextClickCell(family, ranked, options) {
			    var opts = options || {};
			    var familyName = family.family || 'unlabeled family';
			    var endpointsExpanded = !!opts.endpointsExpanded;
			    var insightExpanded = !!opts.insightExpanded;

		    // Keep this compact and action-first. Avoid repeating counts already in columns.
		    if (!family || typeof family.endpoints !== 'number' || family.endpoints <= 0) {
		      return '<span class="subtle">No endpoints in view</span>';
		    }

    var copy = endpointsExpanded
      ? 'Use Hide endpoints in the expanded section header to collapse the endpoint list; use Show insight for the family summary.'
      : 'Click the endpoint count to review endpoint rows; use Show insight for the family summary.';

    return '<div class="family-next-click-cell">'
      + '<p class="family-next-click-copy">' + escapeHtml(copy) + '</p>'
      + '<div class="family-next-click-actions">'
      + '<button type="button" class="tertiary-action family-next-click-btn" data-insight-toggle="' + escapeHtml(familyName) + '" aria-expanded="' + (insightExpanded ? 'true' : 'false') + '" title="Open the family insight panel">' + (insightExpanded ? 'Hide insight' : 'Show insight') + '</button>'
      + '</div>'
      + '</div>';
			  }

			  function buildFamilyRankedSummary(family) {
			    var driver = pickFamilyDominantDriver(family);
			    if (state.activeTopTab === 'workflow') {
			      // Workflow Guidance should read as continuity-first; keep Driver aligned so
			      // rows do not look like generic contract clustering in this tab.
			      driver = { key: 'workflow', label: 'Workflow-driven', signalKey: 'workflow', score: driver.score || 0 };
			    }
			    if (state.activeTopTab === 'shape') {
			      // Response Shape should be shape-first; avoid generic contract clustering framing.
			      driver = { key: 'shape', label: 'Shape-driven', signalKey: 'shape', score: driver.score || 0 };
			    }
			    var dominantSignals = familyDominantSignalsForDriver(family, driver.signalKey || driver.key);

    var dxSignals = dominantSignals.slice();
    if (state.activeTopTab === 'shape') {
      // Caller-burden should reflect the strongest shape signals, not just the top two.
      dxSignals = sortedSignalLabels((family && family.shapeSignalCounts) ? family.shapeSignalCounts : {}, 6);
    }
    var dxReasons = uniq(dxSignals.map(function (s) { return familyDxSignalFragment(s); }).filter(Boolean));
    var dxParts = dxReasons.slice(0, 2);
    var dxConsequence = '';
    if (dxParts.length === 0) {
      dxConsequence = 'Contract clarity is uneven, so similar operations may still teach different integration habits.';
    } else if (dxParts.length === 1) {
      dxConsequence = toSentenceCase(dxParts[0]) + '.';
    } else {
      dxConsequence = toSentenceCase(dxParts[0]) + ' and ' + dxParts[1] + '.';
    }

		    return {
		      dominantSignals: dominantSignals,
		      driver: driver.key,
		      driverLabel: driver.label,
		      driverFocus: familyDriverFocus(driver.signalKey || driver.key, dominantSignals),
		      primaryRisk: familyPrimaryRisk(driver.key, dominantSignals),
		      dxParts: dxParts,
		      dxReasons: dxReasons,
		      dxConsequence: dxConsequence,
		      recommendedAction: familyRecommendedAction(driver.key, dominantSignals)
		    };
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
      return (row.family || 'unlabeled family') === key && lensFindingCountForRow(row) > 0;
    });
    if (rows.length) return rows;

    return rowsInScopeAll().filter(function (row) {
      return (row.family || 'unlabeled family') === key && lensFindingCountForRow(row) > 0;
    });
  }

  function pickFamilyLeadRow(rows) {
    if (!rows || !rows.length) return null;
    var selected = rows.find(function (row) { return row.id === state.selectedEndpointId; });
    if (selected) return selected;
    return rows.slice().sort(function (a, b) {
      if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
      var aCount = lensFindingCountForRow(a);
      var bCount = lensFindingCountForRow(b);
      if (aCount !== bCount) return bCount - aCount;
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
      var kind = chain.kind ? chain.kind.replaceAll('-', ' to ') : 'workflow';
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

  function familyInsightModel(familyName, preferredEndpointId) {
    var rows = familyRowsInView(familyName);
    var leadRow = null;
    if (preferredEndpointId) {
      leadRow = rows.find(function (row) { return row.id === preferredEndpointId; }) || null;
    }
    if (!leadRow) {
      leadRow = pickFamilyLeadRow(rows);
    }
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

		  function renderFamilyInsightPanel(family, preferredEndpointId) {
		    var model = familyInsightModel(family.family || 'unlabeled family', preferredEndpointId || '');
		    if (!model) {
		      return '<div class="family-insight-panel">'
		        + '<p class="subtle">No evidence-bearing endpoint is currently available for this family in the current view.</p>'
		        + '</div>';
		    }

	    var rankedFamily = buildFamilyRankedSummary(family || {});
	    var lead = model.topGroup;
	    var leadEndpoint = model.detail && model.detail.endpoint ? model.detail.endpoint : model.leadRow;
	    var leadFindings = (model.detail && model.detail.findings) ? model.detail.findings : [];
		    var workflowTabActive = state.activeTopTab === 'workflow';
		    var shapeTabActive = state.activeTopTab === 'shape';
		    var specRuleTabActive = state.activeTopTab === 'spec-rule';
		    var workflowTrapGuidance = workflowTabActive
		      ? collectTrapGuidance(leadEndpoint, leadFindings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false)
		      : [];
		    var primaryProblemText = lead && lead.messages[0] ? lead.messages[0] : 'No direct issue text is available for this endpoint.';
		    var whyMattersText = lead && lead.impact
		      ? lead.impact
		      : (specRuleTabActive
		          ? 'This violates an explicit OpenAPI rule expectation, which breaks client tooling and increases integration risk.'
		          : 'Clients may need extra guesswork, follow-up reads, or runtime knowledge because the contract does not guide the next step clearly.');
			    var recommendedChangeText = lead
			      ? dimensionCleanerHint(lead.dimension)
			      : (specRuleTabActive
			          ? 'Fix the OpenAPI rule violation at the referenced schema/response location.'
			          : 'Return an outcome-first response with explicit nextAction and handoff IDs.');

	    var insightEndpointLabel = model.leadRow.method + ' ' + model.leadRow.path;

	    // Build 4 blocks in a strict, readable order:
	    // 1) What is the main problem
	    // 2) Why it matters to clients
	    // 3) What to change in the contract
	    // 4) Open full endpoint evidence

	    var lensFindings = findingsForActiveLens((model.detail && model.detail.findings) ? model.detail.findings : []);
	    var improvementItems = buildContractImprovementItems(model.detail || {}, lensFindings);
	    var topEvidence = model.groups.slice(0, 3);

		    var groundingHtml = '<div class="expansion-grounding">'
		      + renderOpenAPIContextPills(model.topContext || {}, true)
		      + (lead && lead.isSpecRule ? renderSpecRuleGroundingForGroup(lead) : '')
		      + '</div>';

		    var problemBlock = '<div class="expansion-section expansion-problem">'
		      + '<p class="expansion-section-title">Lead issue</p>'
		      + '<p class="expansion-text">' + escapeHtml(primaryProblemText) + '</p>'
		      + groundingHtml
		      + '</div>';

	    var clientEffectText = (rankedFamily && rankedFamily.dxConsequence) ? rankedFamily.dxConsequence : '';
		    var trapHtml = (workflowTabActive && workflowTrapGuidance.length)
		      ? ('<div class="expansion-subblock">'
		        + '<p class="expansion-text"><strong>Common traps:</strong></p>'
		        + renderTrapGuidanceList(workflowTrapGuidance, { title: '', className: '', limit: 2 })
		        + '</div>')
		      : '';
	    var workflowContextHtml = (workflowTabActive && model.workflowLines.length)
	      ? ('<div class="expansion-subblock">'
	        + '<p class="expansion-text"><strong>Workflow context:</strong></p>'
	        + '<ul class="expansion-workflow-list">' + model.workflowLines.slice(0, 4).map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('') + '</ul>'
	        + '</div>')
	      : '';

		    var clientBlock = '<div class="expansion-section expansion-client-impact">'
		      + '<p class="expansion-section-title">Why it matters</p>'
		      + '<p class="expansion-text">' + escapeHtml(whyMattersText) + '</p>'
		      + (clientEffectText ? ('<p class="expansion-text"><strong>Client effect:</strong> ' + escapeHtml(clientEffectText) + '</p>') : '')
		      + trapHtml
		      + workflowContextHtml
		      + '</div>';

	    var changeItemsHtml = improvementItems.length
	      ? '<div class="expansion-contract-items">'
	        + improvementItems.slice(0, 3).map(function (item) {
	          var inspect = item.inspect || item.where || '';
	          return '<div class="expansion-contract-item">'
	            + '<p class="expansion-text"><strong>Change:</strong> ' + escapeHtml(item.change) + '</p>'
	            + '<p class="expansion-text"><strong>Where:</strong> ' + escapeHtml(item.where) + '</p>'
		            + (inspect ? ('<p class="expansion-text"><strong>Inspect in schema:</strong> ' + escapeHtml(inspect) + '</p>') : '')
	            + '<p class="expansion-text"><strong>Why:</strong> ' + escapeHtml(item.why) + '</p>'
	            + '</div>';
	        }).join('')
	        + '</div>'
	      : '<p class="expansion-text"><strong>Recommended change:</strong> ' + escapeHtml(recommendedChangeText) + '</p>'
	          + '<p class="expansion-text"><strong>Where:</strong> ' + escapeHtml(formatWhereWithOpenAPITarget(leadEndpoint, model.topContext || {}, {})) + '</p>';

	    var shapeComparisonHtml = (shapeTabActive && (model.points.current.length || model.points.cleaner.length))
	      ? ('<div class="expansion-subblock">'
	        + '<p class="expansion-text"><strong>Current vs improved (illustrative):</strong></p>'
	        + '<div class="expansion-cleaner-comparison">'
	        + '<div><strong>Current</strong><ul>' + (model.points.current.length ? model.points.current.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') : '<li class="subtle">Storage-shaped, mixed outcome.</li>') + '</ul></div>'
	        + '<div><strong>Improved</strong><ul>' + (model.points.cleaner.length ? model.points.cleaner.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') : '<li class="subtle">Task-shaped, outcome-first.</li>') + '</ul></div>'
	        + '</div>'
	        + '</div>')
	      : '';

		    var recommendedAction = (rankedFamily && rankedFamily.recommendedAction) ? rankedFamily.recommendedAction : '';
		    var actionLine = recommendedAction
		      ? ('<p class="expansion-text"><strong>Recommended action:</strong> ' + escapeHtml(recommendedAction) + '</p>')
		      : '';
		    var changeBlock = '<div class="expansion-section expansion-contract-change">'
		      + '<p class="expansion-section-title">Recommended action</p>'
		      + actionLine
		      + renderWhatToDoNextBlock(leadEndpoint, lensFindings, { maxItems: 2, leadCopy: '' })
		      + changeItemsHtml
		      + shapeComparisonHtml
		      + '</div>';

	    var evidenceListHtml = topEvidence.length
	      ? ('<ul class="expansion-evidence-list">'
	        + topEvidence.map(function (group) { return '<li>' + escapeHtml(formatIssueGroupCountLabel(group)) + '</li>'; }).join('')
	        + '</ul>')
	      : '<p class="subtle">No grouped evidence was available for this endpoint in the current view.</p>';

		    var evidenceActions = '<div class="expansion-actions expansion-actions-inline">'
		      + '<button type="button" class="secondary-action" data-open-evidence-id="' + escapeHtml(model.leadRow.id) + '">Open exact evidence groups</button>'
		      + '<button type="button" class="secondary-action" data-focus-family="' + escapeHtml(family.family) + '">Filter to family in list</button>'
		      + '</div>';

			    var evidenceBlock = '<div class="expansion-section expansion-open-evidence">'
			      + '<p class="expansion-section-title">Evidence groups</p>'
			      + '<p class="subtle">Grouped by schema field and issue type. Open exact evidence groups for the selected endpoint to inspect instances and schema grounding.</p>'
			      + evidenceListHtml
			      + evidenceActions
			      + '</div>';

		    var sections = [problemBlock, clientBlock, changeBlock, evidenceBlock];
	
			    return '<div class="family-insight-panel">'
			      + '<div class="expansion-header">'
			      + '<button type="button" class="expansion-collapse-chevron" data-insight-toggle="' + escapeHtml(family.family) + '" title="Hide insight" aria-label="Hide insight">'
			      + '<span class="expansion-chevron" aria-hidden="true"></span>'
			      + '</button>'
			      + '<div class="expansion-header-title">'
			      + '<strong>' + escapeHtml(insightEndpointLabel) + '</strong>'
			      + '<span class="expansion-secondary-label"> | Family Insight</span>'
			      + '</div>'
			      + '<div class="expansion-header-actions">'
			      + '<button type="button" class="secondary-action insight-toggle insight-toggle-inline" data-insight-toggle="' + escapeHtml(family.family) + '">Hide insight</button>'
			      + '</div>'
			      + '</div>'
			      + '<div class="expansion-sections expansion-sections-ordered">'
			      + sections.join('')
			      + '</div>'
		      + '</div>';
		  }

	  function familyTableColumnsForActiveTab() {
	    // Each top tab has its own primary surface framing. Preserve shared mechanics
	    // (filters, expansions, Inspect), but do not reuse Contract Issues framing unchanged.
	    var workflow = state.activeTopTab === 'workflow';
	    var shape = state.activeTopTab === 'shape';

	    function severityMixHeaderHtml() {
	      return '<span class="th-title">Severity mix</span>'
	        + '<span class="th-helper" title="Counts are endpoints in this family with in-scope findings at each severity (High/Med/Low).">endpoint counts</span>';
	    }

	    function endpointsHeaderHtml() {
	      return '<span class="th-title">Endpoints</span>'
	        + '<span class="th-helper" title="Click the endpoint count in a row to expand inline endpoints. Use Inspect endpoint in the nested table to open diagnostics.">click count to expand</span>';
	    }

	    var cols = [
	      {
	        key: 'family',
	        thClass: 'family-col-name',
	        th: 'Family',
	        tdClass: 'family-col-name',
	        render: function (family, ctx) {
	          var familyName = ctx.familyName;
	          return '<span class="selected-pill" aria-hidden="true">Selected</span>'
	            + '<strong title="' + escapeHtml(humanFamilyLabel(familyName)) + '">' + escapeHtml(humanFamilyLabel(familyName)) + '</strong>'
	            + pressureBadge(family.pressure, 'pressure-badge');
	        }
	      },
	      {
	        key: 'priority',
	        thClass: 'family-col-priority',
	        thHtml: (workflow || shape) ? severityMixHeaderHtml() : '',
	        th: (workflow || shape) ? '' : 'Priority',
	        tdClass: 'family-col-priority',
	        render: function (family) {
	          return renderFamilyPriorityCountStack(family.priorityCounts || {});
	        }
	      },
	      {
	        key: 'endpoints',
	        thClass: 'family-col-endpoints',
	        thAttrs: ' title="Click the endpoint count in a row to expand inline endpoints. Use Inspect endpoint in the nested table to open diagnostics."',
	        thHtml: endpointsHeaderHtml(),
	        tdClass: 'family-col-endpoints',
	        render: function (family, ctx) {
	          var familyName = ctx.familyName;
	          var endpointsExpanded = state.expandedFamily === familyName;
	          return '<button type="button" class="endpoints-expand' + (endpointsExpanded ? ' is-expanded' : '') + '" data-expand-endpoints="' + escapeHtml(familyName) + '" title="' + escapeHtml(endpointsExpanded ? 'Hide endpoints in this family' : 'Show endpoints in this family') + '" aria-label="' + escapeHtml(endpointsExpanded ? 'Hide endpoints in this family' : 'Show endpoints in this family') + '">'
	            + '<span class="endpoints-expand-count">' + family.endpoints + '</span>'
	            + '<span class="endpoints-expand-chevron" aria-hidden="true"></span>'
	            + '</button>';
	        }
	      },
	      {
	        key: 'signals',
	        thClass: 'family-col-top-signal',
	        th: workflow ? 'Continuity signals' : (shape ? 'Shape signals' : 'Top signal'),
	        tdClass: 'family-col-top-signal',
	        render: function (family, ctx) {
	          return renderFamilyTopSignalCell(family, ctx.ranked);
	        }
	      }
	    ];

	    if (!workflow && !shape) {
	      cols.splice(3, 0, {
	        key: 'issues',
	        thClass: 'family-col-issues',
	        th: 'Issues',
	        tdClass: 'family-col-issues',
	        render: function (family) { return String(family.findings || 0); }
	      });
	      cols.push({
	        key: 'driver',
	        thClass: 'family-col-driver',
	        thHtml: (function () {
	          var driverSortActive = state.familyTableSort && state.familyTableSort.key === 'driver';
	          var driverSortDirection = driverSortActive ? state.familyTableSort.direction : 'asc';
	          var driverSortIndicator = driverSortActive ? (driverSortDirection === 'asc' ? ' ↑' : ' ↓') : '';
	          return '<button type="button" class="family-sort-button' + (driverSortActive ? ' is-active' : '') + '" data-family-sort="driver" aria-label="Sort by driver">Driver' + driverSortIndicator + '</button>';
	        })(),
	        tdClass: 'family-col-driver',
	        render: function (family, ctx) {
	          var ranked = ctx.ranked || {};
	          return '<div class="family-driver-cell">'
	            + '<span class="family-driver-chip family-driver-' + escapeHtml(ranked.driver) + '" title="' + escapeHtml('Driver: ' + ranked.driverLabel) + '">' + escapeHtml(ranked.driverLabel) + '</span>'
	            + '<div class="family-driver-focus" title="' + escapeHtml(ranked.driverFocus || '') + '">' + escapeHtml(ranked.driverFocus || '') + '</div>'
	            + '</div>';
	        }
	      });
	    }

	    cols.push({
	      key: 'risk',
	      thClass: 'family-col-primary-risk',
	      th: workflow ? 'Main continuity risk' : (shape ? 'Main shape burden' : 'Primary risk'),
	      tdClass: 'family-col-primary-risk',
	      render: function (family, ctx) {
	        var ranked = ctx.ranked || {};
	        var primaryRisk = ranked.primaryRisk || (ranked.driver === 'workflow'
	          ? 'workflow continuity risk'
	          : ranked.driver === 'shape'
	          ? 'response-shape burden'
	          : 'contract drift risk');
	        return renderFamilyTableClamp(primaryRisk, 'family-table-clamp family-table-clamp-3 family-table-clamp-risk');
	      }
	    });

	      cols.push({
	        key: 'impact',
	        thClass: 'family-col-client-effect',
	        th: workflow ? 'Client impact in flow' : (shape ? 'Caller burden' : 'Client effect'),
	        tdClass: 'family-col-client-effect',
	        render: function (family, ctx) {
	          var ranked = ctx.ranked || {};
	          var repeatCount = (ctx.dxCounts && ranked.dxConsequence) ? (ctx.dxCounts[ranked.dxConsequence] || 0) : 0;
	        var val = shape ? renderCallerBurdenCellValue(ranked) : renderDxConsequenceCellValue(ranked, repeatCount);
	        return renderFamilyClientEffectCell(val);
	        }
	      });

	    cols.push({
	      key: 'next',
	      thClass: 'family-col-next-click',
	      th: 'Recommended next click',
	      tdClass: 'family-col-next-click',
	      render: function (family, ctx) {
	        var familyName = ctx.familyName;
	        var insightExpanded = state.expandedFamilyInsight === familyName;
	        var endpointsExpanded = state.expandedFamily === familyName;
	        return renderFamilyRecommendedNextClickCell(family, ctx.ranked, { insightExpanded: insightExpanded, endpointsExpanded: endpointsExpanded });
	      }
	    });

	    return cols;
	  }

	  function familyTableColumnCountForActiveTab() {
	    return familyTableColumnsForActiveTab().length;
	  }

	  function renderFamilyTableColGroup(cols) {
	    if (!cols || !cols.length) return '';
	    return '<colgroup>' + cols.map(function (col) {
	      var klass = col.tdClass || col.thClass || '';
	      return '<col' + (klass ? (' class="' + escapeHtml(klass) + '"') : '') + '>';
	    }).join('') + '</colgroup>';
	  }

	  function renderFamilyTableView(summaries) {
	    if (!summaries.length) {
	      return '';
	    }

	    function focusedFamilyNameFromSummaries(items) {
	      // Prefer explicit expansions, then an exact family-name match from search.
	      if (state.expandedFamily) return state.expandedFamily;
	      if (state.expandedFamilyInsight) return state.expandedFamilyInsight;
	      var search = (state.filters.search || '').trim().toLowerCase();
	      if (!search) return '';
	      // Avoid misleading "focus" labels for searches like "GET" or "order".
	      if (search.charAt(0) !== '/') return '';
	      var match = (items || []).find(function (f) {
	        return ((f.family || '').trim().toLowerCase() === search);
	      });
	      return match ? (match.family || '') : '';
	    }

		    var scoped = hasFamilyScopeActive();
		    var drilled = hasFamilyDrillActive();
		    var focusedFamily = focusedFamilyNameFromSummaries(summaries);
		    var backControl = drilled
		      ? '<div class="family-table-backbar">'
		          + '<button type="button" class="secondary-action family-table-back" data-recovery-action="back-to-all-families">Back to all families</button>'
		        + '</div>'
		      : '';
	    var focusLabel = focusedFamily
	      ? '<p class="family-table-focusline" role="status" aria-label="Focused family">'
	          + '<strong>Focused family:</strong> ' + escapeHtml(focusedFamily) + '.'
	        + '</p>'
	      : '';
	    var cols = familyTableColumnsForActiveTab();
	    var colCount = cols.length;

    var rankedByFamily = {};
    var dxConsequenceCounts = {};
    summaries.forEach(function (family) {
      var key = family.family || 'unlabeled family';
      var ranked = buildFamilyRankedSummary(family);
      rankedByFamily[key] = ranked;
      var dx = ranked.dxConsequence || '';
      dxConsequenceCounts[dx] = (dxConsequenceCounts[dx] || 0) + 1;
    });

	    var rows = [];
	    summaries.forEach(function (family) {
	      var key = family.family || 'unlabeled family';
	      rows.push(renderFamilyTableRow(family, { ranked: rankedByFamily[key], dxCounts: dxConsequenceCounts, columns: cols }));
	      var expansionHtml = renderFamilyEndpointExpansion(family);
      if (expansionHtml) {
        rows.push(expansionHtml);
      }
      var familyInsightRow = renderFamilyInlineInsightRow(family);
      if (familyInsightRow) {
        rows.push(familyInsightRow);
      }
	    });

		    return '<div class="family-table-shell' + (drilled ? ' family-table-shell-scoped' : '') + (focusedFamily ? ' family-table-shell-has-focus' : '') + '">'
		      + focusLabel
		      + backControl
		      + '<table class="family-table">'
	      + renderFamilyTableColGroup(cols)
	      + '<thead class="family-table-head">'
	      + '<tr>'
		      + cols.map(function (col) {
		          var klass = col.thClass ? (' class="' + col.thClass + '"') : '';
		          var attrs = col.thAttrs || '';
		          var label = col.thHtml ? col.thHtml : escapeHtml(col.th || '');
		          return '<th' + klass + attrs + '>' + label + '</th>';
		        }).join('')
	      + '</tr>'
	      + '</thead>'
	      + '<tbody>'
	      + rows.join('')
	      + '</tbody>'
      + '</table>'
      + '</div>';
  }

			  function renderFamilyTableRow(family, options) {
			    options = options || {};
			    var familyName = family.family || 'unlabeled family';
			    var ranked = options.ranked || buildFamilyRankedSummary(family);
			    var expandedClass = state.expandedFamily === familyName ? ' is-expanded' : '';
			    var search = (state.filters.search || '').trim().toLowerCase();
			    var isFocused = (search && search.charAt(0) === '/' && familyName.trim().toLowerCase() === search)
			      || state.expandedFamily === familyName
		      || state.expandedFamilyInsight === familyName;
		    var focusedClass = isFocused ? ' row-focused' : '';

		    var workflowFamilyActiveClass = (state.activeTopTab === 'workflow' && state.expandedFamily === familyName)
		      ? ' family-row-workflow-active'
		      : '';
	    var cols = options.columns || [];
	    var ctx = {
	      familyName: familyName,
	      ranked: ranked,
	      dxCounts: options.dxCounts || {}
	    };

			    return '<tr class="family-row pressure-' + family.pressure + expandedClass + focusedClass + workflowFamilyActiveClass + '" data-family="' + escapeHtml(family.family) + '" data-family-row="true" data-driver="' + escapeHtml(ranked.driver || 'contract') + '">'
			      + cols.map(function (col) {
			          var tdClass = col.tdClass ? (' class="' + col.tdClass + '"') : '';
			          var extra = (col.key === 'family') ? (' data-focus-family-cell="' + escapeHtml(familyName) + '"') : '';
			          return '<td' + tdClass + extra + '>' + (col.render ? col.render(family, ctx) : '') + '</td>';
			        }).join('')
	      + '</tr>';
	  }

	  function renderDxConsequenceCellValue(ranked, repeatCount) {
	    var DX_REPEAT_THRESHOLD = 4;
	    var consequence = (ranked && ranked.dxConsequence) ? ranked.dxConsequence : '';
	    if (!consequence) {
      return { html: false, value: '—' };
    }

    if (repeatCount >= DX_REPEAT_THRESHOLD) {
      var parts = (ranked.dxParts && ranked.dxParts.length) ? ranked.dxParts : [consequence.replace(/\.$/, '')];
      var label = parts[0] || consequence.replace(/\.$/, '');
      // Only add a count suffix when it materially changes triage (avoid noisy "(+1)").
      if (parts.length > 2) {
        label = label + ' (+' + (parts.length - 1) + ')';
      }
      return {
        html: true,
        value: '<span class="chip chip-secondary family-dx-chip" title="' + escapeHtml(consequence) + '">' + escapeHtml(label) + '</span>'
      };
    }

	    return { html: false, value: consequence };
	  }

	  function renderCallerBurdenCellValue(ranked) {
	    var reasons = (ranked && ranked.dxReasons && ranked.dxReasons.length)
	      ? ranked.dxReasons.slice()
	      : ((ranked && ranked.dxParts && ranked.dxParts.length) ? ranked.dxParts.slice() : []);
	    reasons = uniq((reasons || []).filter(Boolean));
	    if (!reasons.length) return { html: false, value: '—' };

	    var primary = reasons[0] || '';
	    var secondary = reasons[1] || '';
	    var hidden = reasons.slice(1);

	    if (reasons.length === 1) {
	      return {
	        html: true,
	        value: '<div class="caller-burden-cell">'
	          + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
	            + escapeHtml(primary)
	          + '</span>'
	        + '</div>'
	      };
	    }

	    if (reasons.length === 2) {
	      return {
	        html: true,
	        value: '<div class="caller-burden-cell">'
	          + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
	            + escapeHtml(primary)
	          + '</span>'
	          + '<span class="chip chip-secondary caller-burden-chip" title="' + escapeHtml(secondary) + '">'
	            + escapeHtml(secondary)
	          + '</span>'
	        + '</div>'
	      };
	    }

	    // 3+ reasons: show the first reason in full, and collapse the rest behind "+N more"
	    // only when N >= 2 (i.e., 3+ total).
	    var moreCount = hidden.length;
	    var moreTitle = hidden.join('; ');
	    return {
	      html: true,
	      value: '<div class="caller-burden-cell">'
	        + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
	          + escapeHtml(primary)
	        + '</span>'
	        + '<span class="chip chip-secondary caller-burden-chip caller-burden-more" title="' + escapeHtml(moreTitle) + '">+' + String(moreCount) + ' more</span>'
	      + '</div>'
	    };
	  }

	  function renderFamilyClientEffectCell(effect) {
	    var e = effect || { html: false, value: '—' };
	    if (e.html) {
	      return '<div class="family-client-effect-chipwrap">' + e.value + '</div>';
	    }
	    return renderFamilyTableClamp(e.value || '—', 'family-table-clamp family-table-clamp-3 family-table-clamp-effect');
	  }

  function renderFamilyPriorityCountStack(priorityCounts) {
    var counts = priorityCounts || {};

    // Workflow Guidance + Response Shape treat this column as a compact "Pressure mix"
    // surface. Keep it one-line to avoid inflating row height.
    if (state.activeTopTab === 'workflow' || state.activeTopTab === 'shape') {
      var h = counts.high || 0;
      var m = counts.medium || 0;
      var l = counts.low || 0;
      var title = 'Severity mix (endpoint counts): High ' + h + ', Medium ' + m + ', Low ' + l + '. Counts are endpoints in this family with in-scope findings at each severity.';
      function chip(key, shortLabel, value) {
        return '<span class="pressure-mix-chip mix-' + escapeHtml(key) + '" title="' + escapeHtml(shortLabel + ': ' + value + ' endpoints') + '">'
          + '<span class="pressure-mix-label">' + escapeHtml(shortLabel) + '</span>'
          + '<span class="pressure-mix-count">' + String(value) + '</span>'
          + '</span>';
      }
      return '<div class="pressure-mix-inline" title="' + escapeHtml(title) + '">'
        + chip('high', 'High', h)
        + chip('medium', 'Med', m)
        + chip('low', 'Low', l)
        + '</div>';
    }

    var items = [
      { key: 'high', label: 'High:' },
      { key: 'medium', label: 'Medium:' },
      { key: 'low', label: 'Low:' }
    ];
    var lines = items.filter(function (item) {
      return (counts[item.key] || 0) > 0;
    }).map(function (item) {
      var val = counts[item.key] || 0;
      return '<div class="family-priority-line" title="' + escapeHtml(item.label.replace(':', '') + ': ' + val) + '">'
        + '<span class="family-priority-chip priority-' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + '</span>'
        + '<span class="family-priority-count">' + val + '</span>'
        + '</div>';
    }).join('');

    if (!lines) return '<span class="subtle">—</span>';
    return '<div class="family-priority-stack">' + lines + '</div>';
  }

  function renderFamilyInlineInsightRow(family) {
    var familyName = family.family || 'unlabeled family';
    if (state.expandedFamilyInsight !== familyName) {
      return '';
    }

    return '<tr class="family-expansion-row family-inline-insight-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="' + escapeHtml(family.family) + '">'
      + '<td colspan="' + String(familyTableColumnCountForActiveTab()) + '" class="family-expansion-cell">'
      + '<div class="family-row-insight">'
      + renderFamilyInsightPanel(family)
      + '</div>'
      + '</td>'
      + '</tr>';
  }

	  function renderFamilyEndpointExpansion(family) {
	    var familyName = family.family || 'unlabeled family';
	    var expanded = state.expandedFamily === familyName;

    // Skip rendering if not expanded
    if (!expanded) {
      return '';
    }

	    var familyLabel = humanFamilyLabel(familyName);
	    var familyHeader = '<p class="family-endpoint-table-title">Endpoints in <code>' + escapeHtml(familyLabel) + '</code> family</p>';
	    var backToTableControl = '';
	    if (hasFamilyDrillActive()) {
	      backToTableControl = '<button type="button" class="secondary-action family-endpoint-back"'
	        + ' data-recovery-action="back-to-family-table"'
	        + ' aria-label="Back to family table" title="Back to family table">'
	        + 'Back to family table'
	        + '</button>';
	    }
	    var collapseControl = '<button type="button" class="tertiary-action family-endpoint-toggle" data-expand-endpoints="' + escapeHtml(familyName) + '" aria-label="Hide endpoints" title="Hide endpoints">'
	      + '<span class="family-endpoint-toggle-label">Hide endpoints</span>'
	      + '<span class="family-endpoint-toggle-chevron" aria-hidden="true"></span>'
	      + '</button>';
	    var headerActions = '<div class="family-endpoint-table-actions">'
	      + backToTableControl
	      + collapseControl
	      + '</div>';
	    var headerRow = '<div class="family-endpoint-table-header-row">'
	      + familyHeader
	      + headerActions
	      + '</div>';
    var endpointsInFamily = filteredRows().filter(function (ep) {
      return (ep.family || 'unlabeled family') === familyName;
    });

	    if (!endpointsInFamily.length) {
	      return '<tr class="family-expansion-row family-endpoint-table-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="' + escapeHtml(family.family) + '">'
	        + '<td colspan="' + String(familyTableColumnCountForActiveTab()) + '" class="family-expansion-cell">'
	        + '<div class="family-endpoint-table-shell">'
	        + '<div class="empty inline-empty family-inline-empty">'
	        + '<section class="family-endpoint-table-section" aria-label="' + escapeHtml('Endpoints in ' + familyLabel + ' family') + '">'
	        + headerRow
	        + '<strong>No endpoint rows match this family in the current lens.</strong>'
	        + '<p class="subtle">Widen the current filters or include endpoints without issues to repopulate this family-owned endpoint table.</p>'
	        + '</section>'
	        + '</div>'
	        + '</div>'
	        + '</td>'
	        + '</tr>';
	    }

    var nestedRows = endpointsInFamily.map(function (ep) {
      var detail = state.payload.endpointDetails[ep.id];
      var findings = detail ? findingsForActiveLens(detail.findings || []) : [];
      var groups = groupFindings(findings);
      var topGroup = groups[0] || null;
      var html = renderEndpointRow(ep, {
        familyName: familyName,
        inlineTable: true
      });

      if (state.expandedEndpointInsightIds[ep.id]) {
        var topMsg = topGroup && topGroup.messages && topGroup.messages[0]
          ? topGroup.messages[0]
          : (findings[0] && findings[0].message ? findings[0].message : 'No issue message extracted.');
        var severity = dominantSeverity(findings);
        var why = topGroup && topGroup.impact
          ? topGroup.impact
          : 'Clients may need extra guesswork or follow-up reads because the contract does not make the next step or safe fields obvious.';
        var evidenceItems = groups.slice(0, 2).map(function (g) {
          var title = evidenceGroupTitleLine(g);
          var count = g.count || 0;
          return '<li>'
            + '<span class="preview-evidence-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>'
            + '<span class="preview-evidence-count">' + count + ' instance' + (count === 1 ? '' : 's') + '</span>'
            + '</li>';
        }).join('');
        var evidenceList = evidenceItems
          ? '<ul class="preview-evidence-list">' + evidenceItems + '</ul>'
          : '<p class="subtle">No grouped evidence was available for this endpoint in the current view.</p>';

        html += '<tr class="nested-endpoint-preview-row" data-family="' + escapeHtml(family.family) + '" data-endpoint-id="' + escapeHtml(ep.id) + '">'
          + '<td colspan="6" class="nested-endpoint-preview-cell">'
          + '<div class="nested-endpoint-preview">'
          + '<div class="nested-endpoint-preview-grid">'
          + '<div class="nested-endpoint-preview-block">'
          + '<p class="nested-endpoint-preview-label">Primary issue</p>'
          + '<div class="nested-endpoint-preview-value">'
          + (findings.length ? severityBadge(severity) : '')
          + '<span class="nested-endpoint-preview-text" title="' + escapeHtml(topMsg) + '">' + escapeHtml(topMsg) + '</span>'
          + '</div>'
          + '</div>'
          + '<div class="nested-endpoint-preview-block">'
          + '<p class="nested-endpoint-preview-label">Why it matters</p>'
          + '<p class="nested-endpoint-preview-why">' + escapeHtml(why) + '</p>'
          + '</div>'
          + '<div class="nested-endpoint-preview-block">'
          + '<p class="nested-endpoint-preview-label">Top evidence groups</p>'
          + evidenceList
          + '</div>'
          + '</div>'
          + '<div class="nested-endpoint-preview-actions">'
          + '<button type="button" class="tertiary-action" data-open-evidence-id="' + escapeHtml(ep.id) + '">Open exact evidence</button>'
          + '<button type="button" class="tertiary-action" data-focus-endpoint="' + escapeHtml(ep.id) + '">Inspect endpoint</button>'
          + '</div>'
          + '</div>'
          + '</td>'
          + '</tr>';
      }

      return html;
    }).join('');

	    return '<tr class="family-expansion-row family-endpoint-table-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="' + escapeHtml(family.family) + '">'
	      + '<td colspan="' + String(familyTableColumnCountForActiveTab()) + '" class="family-expansion-cell">'
	      + '<div class="family-endpoint-table-shell">'
	      + '<section class="family-endpoint-table-section" aria-label="' + escapeHtml('Endpoints in ' + familyLabel + ' family') + '">'
	      + '<div class="family-endpoint-table-header">'
	      + headerRow
	      + '<p class="eyebrow">' + escapeHtml(evidenceSectionTitleForActiveLens()) + '</p>'
	      + '<p class="subtle">Endpoint rows stay attached to this family so the ownership and investigation flow stay together.</p>'
	      + '</div>'
      + '<table class="nested-endpoint-table">'
      + '<colgroup>'
      + '<col class="nested-col-path">'
      + '<col class="nested-col-method">'
      + '<col class="nested-col-issue">'
      + '<col class="nested-col-severity">'
      + '<col class="nested-col-instance">'
      + '<col class="nested-col-actions">'
      + '</colgroup>'
      + '<thead>'
      + '<tr>'
      + '<th>Path</th>'
      + '<th>Method</th>'
      + '<th>Primary issue</th>'
      + '<th>Severity</th>'
      + '<th>Instance count</th>'
      + '<th class="nested-endpoint-actions-col">Actions</th>'
      + '</tr>'
      + '</thead>'
      + '<tbody>'
      + nestedRows
      + '</tbody>'
      + '</table>'
	      + '<div class="family-endpoint-table-footer"><span class="subtle">End of endpoints in <code>' + escapeHtml(familyLabel) + '</code> family.</span></div>'
	      + '</section>'
	      + '</div>'
	      + '</td>'
	      + '</tr>';
	  }

	  function buildFamilySurfaceContext(summaries) {
	    var visibleFamilies = summaries.length;
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

    var hasNarrowing = !!(state.filters.search
      || state.filters.category !== 'all'
      || state.filters.burden !== 'all'
      || state.filters.familyPressure !== 'all'
      || state.filters.includeNoIssueRows
      || state.familyTableBackState);

    var summaryLine = '';
    if (!totalInLens) {
      summaryLine = 'No families match the current scope.';
    } else if (showingTruncated) {
      summaryLine = 'Showing ' + visibleFamilies + ' of ' + familiesInPressureTier + ' matching families (' + specTotal + ' total in spec).';
    } else {
      summaryLine = 'Showing ' + visibleFamilies + ' matching famil' + (visibleFamilies === 1 ? 'y' : 'ies') + ' (' + specTotal + ' total in spec).';
    }

    var actionButtons = [];
    if (showingTruncated && !state.familyTableShowAll) {
      actionButtons.push('<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all families in current scope</button>');
    }
    if (hasNarrowing) {
      actionButtons.push('<button type="button" class="secondary-action" data-recovery-action="clear-table-filters">Clear table filters</button>');
    }
    var actionsHtml = actionButtons.length
      ? ('<div class="context-actions">' + actionButtons.join('') + '</div>')
      : '';

    var copy = '<div class="context-block family-context-block">';
    copy += '<p class="context-summary">' + escapeHtml(summaryLine) + '</p>';
    if (state.activeTopTab === 'shape' && summaries && summaries.length) {
      var shapeTotals = collectShapeSignalTotals(summaries);
      copy += '<p class="context-summary context-summary-shape"><strong>Shape focus:</strong> ' + escapeHtml(shapeTotals.summary) + '.</p>';
    }
    copy += actionsHtml;
    copy += '</div>';
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
	    var counts = {};
	    function lensCount(row) {
	      if (!row || !row.id) return 0;
	      if (counts[row.id] !== undefined) return counts[row.id];
	      counts[row.id] = lensFindingCountForRow(row);
	      return counts[row.id];
	    }

	    var lensLocked = state.filters.category !== 'all' || state.filters.burden !== 'all';
	    var rows = scopedRows(state.payload.endpoints || []);
	    if (lensLocked) {
	      rows = rows.filter(function (row) { return lensCount(row) > 0; });
	    }
	    var byFamily = {};

		    rows.forEach(function (row) {
	      var inScopeFindings = lensCount(row);
	      var hasEvidence = inScopeFindings > 0;
	      if (!hasEvidence && !state.filters.includeNoIssueRows) return;

	      var key = row.family || "unlabeled family";
		      if (!byFamily[key]) {
		        byFamily[key] = {
	          family: key,
	          findings: 0,
	          endpoints: 0,
	          workflowChainKeys: {},
	          workflowChainCount: 0,
	          priorityCounts: { high: 0, medium: 0, low: 0 },
	          burdenCounts: {},
	          dimensionCounts: {},
	          workflowSignalCounts: {},
	          shapeSignalCounts: {},
	          consistencySignalCounts: {}
	        };
		      }

	      var item = byFamily[key];
	      item.findings += inScopeFindings;
	      item.endpoints += 1;
	      item.priorityCounts[row.priority] = (item.priorityCounts[row.priority] || 0) + 1;

	      var burdenWeight = hasEvidence ? inScopeFindings : 1;
	      (row.burdenFocuses || []).forEach(function (focus) {
	        item.burdenCounts[focus] = (item.burdenCounts[focus] || 0) + burdenWeight;
	      });

		      var detail = state.payload.endpointDetails[row.id];
		      if (detail) {
		        // Track which workflow chains this family participates in so Workflow Guidance
		        // can rank rows by continuity burden and chain membership (not generic pressure).
		        if (detail.relatedChains && detail.relatedChains.length) {
		          detail.relatedChains.forEach(function (chain) {
		            var ids = (chain && chain.endpointIds) ? chain.endpointIds : [];
		            if (!ids.length) return;
		            var kind = (chain && chain.kind) ? String(chain.kind) : 'workflow';
		            var chainKey = kind + '|' + ids.join(',');
		            item.workflowChainKeys[chainKey] = true;
		          });
		          item.workflowChainCount = Object.keys(item.workflowChainKeys).length;
		        }
		      }
		      if (detail && detail.findings) {
		        var lensFindings = findingsForActiveLens(detail.findings || []);
		        lensFindings.forEach(function (finding) {
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
	      // Workflow Guidance: rank by workflow continuity burden and chain membership,
	      // not by generic endpoint pressure counts.
	      if (state.activeTopTab === 'workflow') {
	        var aScore = sumSignalCounts(a.workflowSignalCounts || {});
	        var bScore = sumSignalCounts(b.workflowSignalCounts || {});
	        if (aScore !== bScore) return bScore - aScore;
	        if ((a.workflowChainCount || 0) !== (b.workflowChainCount || 0)) return (b.workflowChainCount || 0) - (a.workflowChainCount || 0);
	        if (a.findings !== b.findings) return b.findings - a.findings;
	        if (priorityRank(a.pressure) !== priorityRank(b.pressure)) return priorityRank(a.pressure) - priorityRank(b.pressure);
	        return a.family.localeCompare(b.family);
	      }

	      if (priorityRank(a.pressure) !== priorityRank(b.pressure)) return priorityRank(a.pressure) - priorityRank(b.pressure);
	      if (a.findings !== b.findings) return b.findings - a.findings;
	      return a.family.localeCompare(b.family);
	    });
	  }

  function familySummaries() {
    var families = familySummariesRaw().filter(function (family) {
      return state.filters.familyPressure === "all" || family.pressure === state.filters.familyPressure;
    });

    if (state.familyTableSort && state.familyTableSort.key === 'driver') {
      var driverRank = { contract: 0, mixed: 1, workflow: 2 };
      families.sort(function (a, b) {
        var aDriver = buildFamilyRankedSummary(a).driver;
        var bDriver = buildFamilyRankedSummary(b).driver;
        var rankDiff = (driverRank[aDriver] || 9) - (driverRank[bDriver] || 9);
        if (rankDiff !== 0) {
          return state.familyTableSort.direction === 'asc' ? rankDiff : -rankDiff;
        }
        if (a.findings !== b.findings) return b.findings - a.findings;
        return a.family.localeCompare(b.family);
      });
    }

    return state.familyTableShowAll ? families : families.slice(0, 24);
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

			  function renderEndpointRows() {
			    if (!el.endpointRows || !el.listContext) {
			      return;
			    }
		    // The investigation flow is now: filters -> family table -> inline endpoints -> inline inspector.
		    // Avoid a detached "endpoint evidence" module far below the family table.
		    var listSection = el.endpointRows ? el.endpointRows.closest('.section') : null;
		    if (listSection) {
		      listSection.style.display = 'none';
		    }
		    return;

		    var rows = filteredRows();
		    var total = rowsInScopeAll().length;
		    var evidenceListTitle = evidenceSectionTitleForActiveLens();

    // Keep section heading in sync with the active tab
    var listHeading = listSection ? listSection.querySelector('#endpointListHeading') : null;
    var listEyebrow = listSection ? listSection.querySelector('.section-heading .eyebrow') : null;
    var evidenceHeader = listSection ? listSection.querySelector('thead th:nth-child(3)') : null;
    if (listHeading) {
      listHeading.textContent = state.activeTopTab === 'workflow'
        ? 'Workflow Guidance — endpoint evidence'
        : state.activeTopTab === 'shape'
        ? 'Response Shape — endpoint evidence'
        : 'Contract Issues — endpoint evidence';
    }
    if (listEyebrow) {
      listEyebrow.textContent = evidenceListTitle;
    }
    if (evidenceHeader) {
      evidenceHeader.textContent = evidenceListTitle;
    }

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
		      // Never auto-pick a different endpoint. If filters invalidate selection,
		      // clear it and let the user pick via "Inspect endpoint".
		      state.selectedEndpointId = '';
		    }

    el.endpointRows.innerHTML = rows.map(function (row) {
      return renderEndpointRow(row);
    }).join("");

			    Array.prototype.forEach.call(el.endpointRows.querySelectorAll("tr[data-id]"), function (tr) {
			      tr.addEventListener("click", function () {
			        selectEndpointForInspector(tr.getAttribute("data-id") || "");
			      });
			    });

			    Array.prototype.forEach.call(el.endpointRows.querySelectorAll('.severity-badge.is-interactive'), function (badge) {
			      badge.addEventListener('click', function (event) {
			        event.preventDefault();
			        event.stopPropagation();
			        var row = badge.closest('tr[data-id]');
			        if (!row) return;
		        var endpointId = row.getAttribute('data-id') || "";
		        if (!endpointId) return;
		        state.detailEvidenceOpenForId = endpointId;
		        selectEndpointForInspector(endpointId, 'exact');
		      });
		      badge.addEventListener('keydown', function (event) {
		        if (event.key !== 'Enter' && event.key !== ' ') return;
		        event.preventDefault();
		        badge.click();
		      });
		    });

		    Array.prototype.forEach.call(el.endpointRows.querySelectorAll("button[data-focus-endpoint]"), function (btn) {
		      btn.addEventListener("click", function (event) {
		        event.preventDefault();
		        event.stopPropagation();
		        var endpointId = btn.getAttribute("data-focus-endpoint") || "";
		        if (!endpointId) return;
		        selectEndpointForInspector(endpointId);
		      });
		    });

		    Array.prototype.forEach.call(el.endpointRows.querySelectorAll('button[data-toggle-row-findings]'), function (btn) {
		      btn.addEventListener('click', function (event) {
		        event.preventDefault();
	        event.stopPropagation();
	        var endpointId = btn.getAttribute('data-toggle-row-findings') || '';
	        if (!endpointId) return;
	        if (state.expandedEndpointRowFindings[endpointId]) {
	          delete state.expandedEndpointRowFindings[endpointId];
	        } else {
	          state.expandedEndpointRowFindings[endpointId] = true;
	        }
	        var x = window.scrollX || 0;
	        var y = window.scrollY || 0;
	        renderEndpointRows();
	        requestAnimationFrame(function () {
	          requestAnimationFrame(function () {
	            window.scrollTo(x, y);
	          });
	        });
	      });
	    });
  }

				  function renderEndpointRow(row, options) {
				    options = options || {};
		    var detail = state.payload.endpointDetails[row.id] || { findings: [] };
		    var lensFindings = findingsForActiveLens(detail.findings || []);
		    var firstFinding = lensFindings[0] || null;
	    var scopeFamilyName = row.family || 'unlabeled family';
	    var primaryScope = firstFinding ? issueScopeLabelForKey(findingGroupKey(firstFinding), scopeFamilyName) : '';
	    var selected = row.id === state.selectedEndpointId ? "active" : "";
	    var intent = endpointIntentCue(row.method, row.path);
	    var workflowTabActive = state.activeTopTab === 'workflow';
	    var shapeTabActive = state.activeTopTab === 'shape';
    var severity = dominantSeverity(lensFindings);
    var groups = groupFindings(lensFindings);
    var topGroup = groups[0] || null;
    var topIssueLabel = firstFinding ? (firstFinding.message || 'No direct issue evidence') : 'No direct issue evidence';
    var instanceCount = lensFindings.length;
    var firstContext = firstFinding ? extractOpenAPIContext(firstFinding) : null;
    var contextLine = firstContext ? renderOpenAPIContextPills(firstContext, true) : '<span class="context-inline subtle">OpenAPI location is not clear from the top message.</span>';
		    var additionalFindings = lensFindings.slice(1);
		    var additionalCount = additionalFindings.length;
		    var additionalOpen = !!state.expandedEndpointRowFindings[row.id];
		    var additionalFindingsControl = additionalCount
		      ? '<button type="button" class="row-additional-findings-toggle" data-toggle-row-findings="' + escapeHtml(row.id) + '" aria-expanded="' + (additionalOpen ? 'true' : 'false') + '">' + (additionalOpen ? 'Hide ' : 'Show ') + additionalCount + ' additional finding' + (additionalCount === 1 ? '' : 's') + '</button>'
		      : '';
		    var additionalFindingsList = additionalCount && additionalOpen
		      ? (function () {
		          var scopes = additionalFindings.map(function (finding) {
		            return issueScopeLabelForKey(findingGroupKey(finding), scopeFamilyName);
		          });
		          var common = scopes[0] || '';
		          for (var i = 1; i < scopes.length; i++) {
		            if (scopes[i] !== common) { common = ''; break; }
		          }
		          // Reduce repetitive "Scope: ..." lines inside each finding row.
		          // If all additional findings share the same scope, show it once (or not at all
		          // if it matches the primary finding scope already visible in the row header).
		          var headerScopeLine = '';
		          if (common && common !== primaryScope) {
		            headerScopeLine = '<p class="row-additional-findings-scope"><strong>Scope:</strong> ' + escapeHtml(common) + '</p>';
		          }
		          return '<div class="row-additional-findings-list">'
		            + headerScopeLine
		            + additionalFindings.map(function (finding) {
		                var scope = issueScopeLabelForKey(findingGroupKey(finding), scopeFamilyName);
		                var findingContext = renderOpenAPIContextPills(extractOpenAPIContext(finding), true);
		                var scopeLine = '';
		                if (!common && scope && scope !== primaryScope) {
		                  scopeLine = '<p class="row-additional-finding-scope"><strong>Scope:</strong> ' + escapeHtml(scope) + '</p>';
		                }
		                return '<div class="row-additional-finding-item">'
		                  + '<p class="row-additional-finding-message">' + escapeHtml(finding.message || 'No issue message extracted.') + '</p>'
		                  + scopeLine
		                  + '<div class="row-additional-finding-context">' + findingContext + '</div>'
		                  + '</div>';
		              }).join('')
		            + '</div>';
		        })()
		      : '';
	    var additionalFindingsRowInline = additionalFindingsList
	      ? '<tr class="nested-endpoint-findings-row" data-endpoint-id="' + escapeHtml(row.id) + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
	          + '<td colspan="6" class="nested-endpoint-findings-cell">'
	          + additionalFindingsList
	          + '</td>'
	        + '</tr>'
	      : '';
	    var inspectLoading = state.inspectingEndpointId === row.id;
	    var inspectSelected = state.selectedEndpointId === row.id && !inspectLoading;
    var inspectButtonClass = 'tertiary-action endpoint-inspect-action'
      + (inspectLoading ? ' is-loading' : '')
      + (inspectSelected ? ' is-selected' : '');
    var inspectButtonLabel = inspectLoading
      ? 'Inspecting...'
      : (inspectSelected ? 'Selected' : 'Inspect endpoint');
	    var rowClasses = (options.inlineTable ? 'nested-endpoint-row ' : '') + selected + ' row-pressure-' + row.priority + (additionalOpen ? ' findings-expanded' : '');

			    if (options.inlineTable) {
		      var endpointIdentityTitle = escapeHtml(((row.method || '').toUpperCase() + ' ' + (row.path || '') + ' — ' + intent).trim());
		      var scopeBadge = primaryScope
		        ? '<span class="row-issue-scope-pill" title="' + escapeHtml('Scope: ' + primaryScope) + '"><strong>Scope:</strong> ' + escapeHtml(primaryScope) + '</span>'
		        : '';
			      var rowHtml = '<tr class="' + rowClasses.trim() + '" data-id="' + row.id + '" data-endpoint-id="' + row.id + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
		        + '<td class="nested-endpoint-path-cell">'
		        + '<div class="endpoint-row-main">'
		        + '<strong title="' + endpointIdentityTitle + '">' + escapeHtml(row.path) + '</strong>'
		        + '</div>'
		        + '</td>'
		        + '<td class="nested-endpoint-method-cell"><span class="endpoint-method-chip">' + escapeHtml((row.method || '').toUpperCase()) + '</span></td>'
		        + '<td class="nested-endpoint-issue-cell">'
		        + '<div class="nested-endpoint-issue-top">'
		        + '<div class="nested-endpoint-primary-issue" title="' + escapeHtml(topIssueLabel) + '">' + escapeHtml(topIssueLabel) + '</div>'
		        + scopeBadge
		        + (additionalFindingsControl ? '<div class="nested-endpoint-issue-actions">' + additionalFindingsControl + '</div>' : '')
		        + '</div>'
		        + '</td>'
			        + '<td class="nested-endpoint-severity-cell">' + (firstFinding ? severityBadgeEvidenceCTA(severity, row.id) : '<span class="subtle">No issue</span>') + '</td>'
			        + '<td class="nested-endpoint-instance-cell"><button type="button" class="instance-count-chip is-interactive" data-open-evidence-id="' + escapeHtml(row.id) + '" title="Open exact evidence groups" aria-label="Open exact evidence groups">' + instanceCount + ' instance' + (instanceCount === 1 ? '' : 's') + '</button></td>'
			        + '<td class="nested-endpoint-actions-cell">'
			        + '<div class="nested-endpoint-actions">'
			        + '<span class="selected-pill endpoint-selected-pill" aria-hidden="true">Selected</span>'
			        + '<button type="button" class="' + inspectButtonClass + '" data-focus-endpoint="' + escapeHtml(row.id) + '" aria-pressed="' + (inspectSelected ? 'true' : 'false') + '" aria-busy="' + (inspectLoading ? 'true' : 'false') + '">' + inspectButtonLabel + '</button>'
			        + '<button type="button" class="tertiary-action endpoint-insight-toggle" data-endpoint-insight-toggle="' + escapeHtml(row.id) + '">' + (state.expandedEndpointInsightIds[row.id] ? 'Hide preview' : 'Preview') + '</button>'
			        + '</div>'
		        + '</td>'
		        + '</tr>';
			      var inspectorInlineRowNested = (row.id === state.selectedEndpointId && state.inspectPlacementHint === 'nested')
			        ? renderInlineInspectorMountRow(row.id, 6, 'nested')
			        : '';
			      var workspaceAnchorRow = '';
			      if (row.id === state.selectedEndpointId && state.detachedInspectorVisible) {
			        workspaceAnchorRow = '<tr class="workspace-anchor-row" data-endpoint-id="' + escapeHtml(row.id) + '">'
			          + '<td colspan="6" class="workspace-anchor-cell">'
			          + '<div class="workspace-nav-anchor" role="status" aria-label="Workspace navigation">'
			          + '<div class="workspace-nav-label">Viewing workspace for: <code>' + escapeHtml(((row.method || '').toUpperCase() + ' ' + (row.path || '')).trim()) + '</code></div>'
			          + '<div class="workspace-nav-actions">'
			          + '<button type="button" class="secondary-action" data-jump-to-workspace="1">Jump to workspace</button>'
			          + '<button type="button" class="tertiary-action" data-return-to-row="' + escapeHtml(row.id) + '">Return to row</button>'
			          + '</div>'
			          + '</div>'
			          + '</td>'
			          + '</tr>';
			      }
			      return rowHtml + additionalFindingsRowInline + workspaceAnchorRow + inspectorInlineRowNested;
			    }

			    var baseRow = '<tr class="' + rowClasses.trim() + '" data-id="' + row.id + '" data-endpoint-id="' + row.id + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
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
      + '<div class="row-cause-label">' + escapeHtml(rowDominantIssue(row).label) + '</div>'
      + '</td>'
			      + '<td>'
			      + '<div class="row-primary-issue-head">'
			      + (firstFinding ? severityBadgeInteractive(severity) : '')
			      + (firstFinding ? ('<span class="row-issue-scope-pill" title="' + escapeHtml('Scope: ' + primaryScope) + '"><strong>Scope:</strong> ' + escapeHtml(primaryScope) + '</span>') : '')
			      + additionalFindingsControl
			      + '</div>'
			      + '<div class="message-line">' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '</div>'
		      + '<div class="context-inline-wrap">' + contextLine + '</div>'
		      + '<div class="row-inline-actions">'
		      + '<button type="button" class="' + inspectButtonClass + '" data-focus-endpoint="' + escapeHtml(row.id) + '" aria-pressed="' + (inspectSelected ? 'true' : 'false') + '" aria-busy="' + (inspectLoading ? 'true' : 'false') + '">' + inspectButtonLabel + '</button>'
		      + '</div>'
		      + '</td>'
		      + '</tr>';

			    var additionalFindingsRow = additionalFindingsList
			      ? '<tr class="endpoint-row-findings-row" data-endpoint-id="' + escapeHtml(row.id) + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
			          + '<td colspan="3" class="endpoint-row-findings-cell">'
			          + additionalFindingsList
			          + '</td>'
			        + '</tr>'
			      : '';

			    var inspectorInlineRow = (row.id === state.selectedEndpointId && state.inspectPlacementHint === 'endpoint-list')
			      ? renderInlineInspectorMountRow(row.id, 3, 'endpoint-list')
			      : '';

			    return baseRow + additionalFindingsRow + inspectorInlineRow;
			  }

	  function renderInlineInspectorMountRow(endpointId, colSpan, variant) {
	    var v = variant || 'nested';
	    return '<tr class="inline-inspector-row inline-inspector-row-' + escapeHtml(v) + '" data-inline-inspector-row="1" data-endpoint-id="' + escapeHtml(endpointId) + '">'
	      + '<td colspan="' + String(colSpan || 1) + '" class="inline-inspector-cell">'
	      + '<div class="inline-inspector-shell inline-inspector-shell-' + escapeHtml(v) + '" data-inline-inspector-mount="1" data-inline-endpoint-id="' + escapeHtml(endpointId) + '"></div>'
	      + '</td>'
	      + '</tr>';
	  }

	  function findInlineInspectorMount(endpointId) {
	    if (!endpointId) return null;
	    var mounts = document.querySelectorAll('[data-inline-inspector-mount="1"]');
	    for (var i = 0; i < mounts.length; i++) {
	      if ((mounts[i].getAttribute('data-inline-endpoint-id') || '') === endpointId) {
	        return mounts[i];
	      }
	    }
	    return null;
	  }

			  function buildEndpointDiagnosticsBody(detail, findings) {
		    var endpoint = (detail && detail.endpoint) ? detail.endpoint : {};
		    var workflowTabActive = state.activeTopTab === 'workflow';
		    var shapeTabActive = state.activeTopTab === 'shape';
		    var specRuleTabActive = state.activeTopTab === 'spec-rule';
		    var relatedChains = (detail && detail.relatedChains) ? detail.relatedChains : [];

			    var body = '';
			    var collapseTarget = shapeTabActive ? 'shape-workspace' : '';
			    body += renderInspectorWorkspaceHeader(detail, findings, {
			      collapseTarget: collapseTarget,
			      collapsed: shapeTabActive ? !!state.shapeWorkspaceCollapsed : false
			    });

			    var workspaceBodyClass = 'inspector-workspace-body'
			      + (shapeTabActive && state.shapeWorkspaceCollapsed ? ' is-collapsed' : '');
			    var workspaceBodyAttr = collapseTarget
			      ? (' data-workspace-collapse-target="' + escapeHtml(collapseTarget) + '"')
			      : '';
			    body += '<div class="' + workspaceBodyClass + '"' + workspaceBodyAttr + '>';

			    // Workflow Guidance must foreground step-specific continuity guidance first.
			    // This keeps the workspace from reading like generic contract-rule output.
			    if (workflowTabActive) {
			      body += renderWorkflowStepWorkspace(detail);
			    }

			    // Compact cross-tab workflow link: when an endpoint belongs to a chain, surface a
			    // minimal affordance to jump into Workflow Guidance without dragging chain content
			    // into Contract Issues / Response Shape.
			    if (!workflowTabActive && relatedChains.length) {
		      var primary = relatedChains[0] || {};
		      var steps = primary.endpointIds || [];
		      var idx = state.selectedEndpointId ? steps.indexOf(state.selectedEndpointId) : -1;
		      var stepLabel = (idx >= 0 && steps.length)
		        ? ('Step ' + (idx + 1) + ' of ' + steps.length)
		        : (steps.length ? (steps.length + ' steps') : 'in chain');
		      var linkTitle = 'Workflow chain available';
		      var linkCopy = 'This endpoint participates in an inferred call sequence. Open the step-by-step chain to see purpose, required context, traps, and likely next actions.';
		      body += '<section class="workflow-chain-link-card" aria-label="' + escapeHtml(linkTitle) + '">'
		        + '<div class="workflow-chain-link-row">'
		        + '<p class="workflow-chain-link-title"><strong>' + escapeHtml(linkTitle) + '</strong> <span class="subtle">' + escapeHtml(stepLabel) + '</span></p>'
		        + '<button type="button" class="secondary-action" data-open-workflow-chain="1" title="Open Workflow Guidance chain view">Open chain in Workflow Guidance</button>'
		        + '</div>'
		        + '<p class="subtle workflow-chain-link-copy">' + escapeHtml(linkCopy) + '</p>'
		        + '</section>';
			    }
			    if (findings && findings.length) {
			      body += renderWhatToDoNextBlock(endpoint, findings, { maxItems: 2, showEndpointLabel: false });
			    }
			    if (workflowTabActive) {
			      body += renderWorkflowDiagnosticsFrame(detail);
		    }

		    // Workflow chain/handoff context only belongs in Workflow Guidance.
		    if (workflowTabActive && state.endpointDiagnosticsSubTab !== 'summary') {
		      body += renderInspectorWorkflowContextSupport(detail, { defaultOpen: true });
		    }

	    body += renderInspectorContentMap();
	    body += renderEndpointDiagnosticsTabs();
	    if (!findings || !findings.length) {
	      body += renderEndpointDiagnosticsEmptyState();
	    } else if (state.endpointDiagnosticsSubTab === 'exact') {
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

	    body += '</div>';
	    return body;
	  }

		  function bindEndpointDiagnosticsInteractions(container) {
		    if (!container) return;

		    var workflowContextDrawer = container.querySelector('[data-inspector-workflow-context]');
		    if (workflowContextDrawer) {
		      workflowContextDrawer.addEventListener('toggle', function () {
		        state.inspectorWorkflowContextOpen = !!workflowContextDrawer.open;
		      });
		    }

		    var workspaceCollapseBtn = container.querySelector('button[data-workspace-collapse-toggle]');
		    if (workspaceCollapseBtn && !workspaceCollapseBtn.__workspaceCollapseBound) {
		      workspaceCollapseBtn.__workspaceCollapseBound = true;
		      var target = workspaceCollapseBtn.getAttribute('data-workspace-collapse-toggle') || '';
		      var workspaceBody = target
		        ? container.querySelector('[data-workspace-collapse-target="' + target + '"]')
		        : null;
		      var openLabel = workspaceCollapseBtn.getAttribute('data-open-label') || 'Collapse';
		      var closedLabel = workspaceCollapseBtn.getAttribute('data-closed-label') || 'Expand';

		      function syncWorkspaceCollapseUi(collapsed) {
		        if (!workspaceBody) return;
		        workspaceBody.classList.toggle('is-collapsed', !!collapsed);
		        workspaceCollapseBtn.textContent = collapsed ? closedLabel : openLabel;
		        workspaceCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
		        workspaceCollapseBtn.title = collapsed ? 'Expand workspace' : 'Collapse workspace';
		      }

		      // Ensure DOM reflects state on first bind.
		      if (state.activeTopTab === 'shape' && target === 'shape-workspace') {
		        syncWorkspaceCollapseUi(!!state.shapeWorkspaceCollapsed);
		      }

		      workspaceCollapseBtn.addEventListener('click', function (event) {
		        event.preventDefault();
		        event.stopPropagation();
		        if (!workspaceBody) return;
		        var nextCollapsed = !workspaceBody.classList.contains('is-collapsed');
		        if (state.activeTopTab === 'shape' && target === 'shape-workspace') {
		          state.shapeWorkspaceCollapsed = nextCollapsed;
		        }
		        syncWorkspaceCollapseUi(nextCollapsed);
		      });
		    }

		    Array.prototype.forEach.call(container.querySelectorAll('details.detail-evidence-drawer'), function (drawer) {
		      var labelNode = drawer.querySelector('[data-evidence-drawer-label]');
		      if (!labelNode) return;
		      function syncLabel() {
		        var openLabel = labelNode.getAttribute('data-open-label') || 'Hide full exact evidence';
		        var closedLabel = labelNode.getAttribute('data-closed-label') || 'Open full exact evidence';
		        labelNode.textContent = drawer.open ? openLabel : closedLabel;
		      }
		      syncLabel();
		      drawer.addEventListener('toggle', syncLabel);
		    });

		    // Close buttons inside expandable drawers. We keep the close action inside the
		    // expanded visual block so users never have to guess how to reverse the open state.
		    Array.prototype.forEach.call(container.querySelectorAll('button[data-close-details]'), function (btn) {
		      if (btn.__closeDetailsBound) return;
		      btn.__closeDetailsBound = true;
		      btn.addEventListener('click', function (event) {
		        event.preventDefault();
		        event.stopPropagation();
		        var details = null;
		        if (btn.closest) {
		          details = btn.closest('details');
		        } else {
		          var node = btn.parentNode;
		          while (node && node.tagName !== 'DETAILS') node = node.parentNode;
		          details = node;
		        }
		        if (details) details.open = false;
		        if (details && details.getAttribute && details.getAttribute('data-full-exact-evidence')) {
		          state.detailEvidenceOpenForId = '';
		        }
		      });
		    });

		    var fullEvidenceDrawer = container.querySelector('details[data-full-exact-evidence]');
		    if (fullEvidenceDrawer && !fullEvidenceDrawer.__fullEvidenceBound) {
		      fullEvidenceDrawer.__fullEvidenceBound = true;
		      fullEvidenceDrawer.addEventListener('toggle', function () {
		        state.detailEvidenceOpenForId = fullEvidenceDrawer.open ? (state.selectedEndpointId || '') : '';
		      });
		    }

		    Array.prototype.forEach.call(container.querySelectorAll('button[data-open-workflow-chain]'), function (btn) {
		      btn.addEventListener('click', function (event) {
		        event.preventDefault();
		        event.stopPropagation();
		        var endpointId = state.selectedEndpointId || '';
		        var detail = endpointId ? endpointDetailForId(endpointId) : null;
		        var endpoint = detail && detail.endpoint ? detail.endpoint : null;
		        var family = endpoint ? (endpoint.family || '') : '';

		        // Switch tabs without clearing the user's current search/family pressure context.
		        state.activeTopTab = 'workflow';
		        state.filters.category = 'all';
		        state.filters.burden = 'workflow-burden';
		        state.endpointDiagnosticsSubTab = 'summary';
		        state.workflowChainsOpen = true;

		        // Keep the selected endpoint and keep the family table anchored to its owner.
		        if (family) {
		          state.expandedFamily = family;
		          state.expandedFamilyInsight = '';
		        }
		        render();
		        syncWorkflowStepSelectionHighlight();
		      });
		    });

		    Array.prototype.forEach.call(container.querySelectorAll('button[data-endpoint-subtab]'), function (btn) {
		      btn.addEventListener('click', function () {
		        state.endpointDiagnosticsSubTab = btn.getAttribute('data-endpoint-subtab') || 'summary';
		        renderEndpointDiagnostics();
	      });
	    });

			    Array.prototype.forEach.call(container.querySelectorAll('[data-chain-step-id]'), function (elem) {
			      elem.addEventListener('click', function () {
			        var endpointId = elem.getAttribute('data-chain-step-id') || '';
			        if (!endpointId) return;
			        // Always attach workflow chain selections to the family surface.
			        // Do not jump the user down to a detached endpoint list/inspector module.
			        selectEndpointForInspector(endpointId, 'summary');
			      });
			    });
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

    var heading = burdenLens === 'consistency'
      ? 'Most common differences in this view:'
      : 'Most common in this slice:';
    var parts = signals.slice(0, 4).map(function (signal) {
      var label = burdenLens === 'consistency' ? humanizeSignalLabel(signal.label) : signal.label;
      return label + ' (' + signal.count + ')';
    }).filter(Boolean);

    return '<div class="burden-dynamic-signals">'
      + '<p class="burden-dynamic-signals-line"><strong>' + escapeHtml(heading) + '</strong> ' + escapeHtml(parts.join(', ')) + '.</p>'
      + '</div>';
  }

	  function buildListContext(matches, total) {
	    var lens = [];
	    if (state.filters.search) lens.push('\u201c' + state.filters.search + '\u201d');
	    if (state.filters.category === 'spec-rule' && state.activeTopTab !== 'spec-rule') lens.push('rules-based view: spec rule');
	    else if (state.filters.category !== "all") lens.push('category: ' + state.filters.category.replaceAll("-", " "));
	    if (state.filters.burden !== "all") lens.push('guidance view: ' + state.filters.burden.replaceAll("-", " "));
	    if (state.filters.familyPressure !== "all") lens.push('pressure: ' + state.filters.familyPressure);

    var mode = state.filters.includeNoIssueRows ? 'all rows' : 'evidence-only';
    var visibleRows = filteredRows();
    var burdenExplanation = '';
	    if (state.filters.category === 'spec-rule' && state.activeTopTab !== 'spec-rule') {
	      var ruleGroups = aggregateSpecRuleFindings(filteredRows());
	      var ruleBanner = renderSpecRuleBanner(ruleGroups, visibleRows.length);
	      burdenExplanation = '<div class="burden-explanation spec-rule-explanation">'
	        + ruleBanner
	        + '<details class="spec-rule-details">'
        + '<summary>Show rule details</summary>'
        + '<p class="subtle spec-rule-details-copy"><strong>Contract Issues</strong> \u2014 findings backed by explicit OpenAPI rule language. REQUIRED / MUST violations are <strong>errors</strong>; SHOULD / RECOMMENDED concerns are <strong>warnings</strong>.</p>'
        + renderSpecRuleAggregate(ruleGroups)
        + '</details>'
        + '</div>';
    } else if (state.filters.burden === 'workflow-burden') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
        + '<strong>Workflow Guidance</strong> — family cards highlight cross-step continuity pressure that makes real call paths harder to complete safely.'
        + '<ul>'
        + '<li>Hidden token/context/header dependencies appear across steps.</li>'
        + '<li>Sequencing suggests brittle handoffs where the next required step is not clearly exposed.</li>'
        + '<li>Outcome guidance appears weak, so callers likely infer what to do next.</li>'
        + '<li>Endpoint rows are supporting evidence; use the endpoint inspector to inspect exact continuity breakpoints.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'workflow-burden')
        + '</div>';
    } else if (state.filters.burden === 'contract-shape') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
        + '<strong>Response Shape</strong> — diagnoses real DX cost from storage-shaped payloads, not backend graph completeness.'
        + '<ul>'
        + '<li>Diagnose deep nesting, duplicated state, snapshot-heavy payloads, internal-field exposure, and unclear source-of-truth fields.</li>'
        + '<li>Diagnose missing outcome framing and missing next-action cues in shape-heavy responses.</li>'
        + '<li>Use row message + OpenAPI location pills and the endpoint inspector to inspect concrete schema locations for each burden.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'contract-shape')
        + '</div>';
    }
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var guide = matches > 0
      ? (workflowTabActive
          ? 'Use family cards for family-level pattern summary; use the endpoint inspector for continuity diagnosis; use workflow continuity risk evidence for grouped issue text.'
        : shapeTabActive
        ? 'Family cards are the primary Response Shape triage surface. Use this list to pick which endpoint to inspect next for shape pain.'
          : 'Click any row to see exact issue text and OpenAPI location cues. Cards summarize why each endpoint appears in this Contract Issues view.')
      : 'No rows match. Use the family no-match recovery above to widen the view.';

    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var actionsHtml = (matches > 0 && !workflowTabActive && !shapeTabActive)
      ? '<div class="context-actions">'
        + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all families in current scope</button>'
        + '<button type="button" class="secondary-action" data-recovery-action="clear-table-filters">Clear table filters</button>'
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
	        addTheme('storage-shaped vs task-shaped', 'Storage-shaped payload dominates the response surface.', 'Return a task-shaped response: lead with outcome, authoritative state, and handoff fields.');
	        addTheme('graph dump vs explicit outcome', 'Graph-style payload forces readers to infer what changed.', 'Add an explicit outcome block: state what changed and whether the step is complete.');
	      }
	      if (code === 'incidental-internal-field-exposure' || /internal|incidental|audit|raw id/.test(msg)) {
	        addTheme('internal state vs domain-level state', 'Internal/storage fields dominate over domain-level state.', 'Move internal/storage fields out of the default payload; keep domain-level state primary.');
	      }
	      if (code === 'duplicated-state-response' || /duplicate|duplicated|source of truth|authoritative/.test(msg)) {
	        addTheme('duplicated state vs single source of truth', 'Duplicated state appears across branches with unclear source-of-truth.', 'Expose one authoritative state field as the single source of truth.');
	      }
	      if (code === 'weak-outcome-next-action-guidance' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
	        addTheme('missing next action vs explicit next action', 'Next action is missing or weakly modeled in the response.', 'Include nextAction plus the required id/link for the next call.');
	      }
	      if (code === 'prerequisite-task-burden' || /prerequisite|prior state|hidden dependency|handoff|implicit/.test(msg)) {
	        addTheme('hidden dependency vs surfaced prerequisite / handoff', 'Prerequisite/handoff dependency is implicit and easy to miss.', 'Return prerequisite state and handoff fields explicitly in the response.');
	      }
	    });

	    var path = ((endpoint && endpoint.path) || '').toLowerCase();
	    if (/order|cart|checkout|payment/.test(path)) {
	      pushUnique(improved, 'Return domain-level outcome status (order/cart/payment state), not a backend object dump.');
	    }

	    if (!themes.length) {
	      addTheme(
	        'storage-shaped vs task-shaped',
	        'Current shape requires readers to infer intent from broad payload structure.',
	        'Return outcome, authoritative state, and nextAction explicitly.'
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
        pushUnique(cleaner, 'Return task outcome and authoritative state first.');
      }
      if (code === 'deeply-nested-response-structure') {
        pushUnique(current, 'Deep nesting hides outcome meaning.');
        pushUnique(cleaner, 'Move outcome and nextAction near the top of the response.');
      }
      if (code === 'duplicated-state-response') {
        pushUnique(current, 'Repeated state adds scan noise and obscures source-of-truth.');
        pushUnique(cleaner, 'Expose one authoritative state field; remove repeated snapshots.');
      }
      if (code === 'incidental-internal-field-exposure') {
        pushUnique(current, 'Incidental internal fields crowd outcome visibility.');
        pushUnique(cleaner, 'Move internal linkage/audit fields out of the default success payload.');
      }
      if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
        pushUnique(current, 'Next step is weakly signaled.');
        pushUnique(cleaner, 'Include nextAction and the handoff ID/link needed for the next call.');
      }
      if (code === 'weak-outcome-next-action-guidance') {
        pushUnique(current, 'Outcome and next action framing is weak.');
        pushUnique(cleaner, 'Return explicit outcome and nextAction fields in the response.');
      }
      if (code === 'prerequisite-task-burden') {
        pushUnique(current, 'Hidden prerequisites are doing too much work.');
        pushUnique(cleaner, 'Return prerequisite state/IDs explicitly so the step can be formed deterministically.');
      }
      if (code === 'generic-object-response' || code === 'weak-array-items-schema') {
        pushUnique(current, 'Generic shape weakens handoff meaning.');
        pushUnique(cleaner, 'Replace generic objects with named properties and typed array item schemas.');
      }
    });

    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    if (/login|auth|session|register/.test(path)) {
      pushUnique(cleaner, 'Return one authoritative auth/context token field for follow-up calls.');
    }
    if (/customer/.test(path)) {
      pushUnique(cleaner, 'Return reusable customer identifiers/links needed for follow-up calls.');
    }
    if (/cart/.test(path)) {
      pushUnique(cleaner, 'Return cart outcome plus minimal handoff fields (IDs/links) in the response.');
    }
    if (/order/.test(path)) {
      pushUnique(cleaner, 'Return order outcome plus nextAction(s) in the response.');
    }
    if (/payment|checkout/.test(path)) {
      pushUnique(cleaner, 'Return payment outcome meaning plus the authoritative transaction state.');
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
      : '<p class="subtle">Return outcome-first payloads with authoritative context and explicit nextAction.</p>';

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
		    var familyName = endpoint.family || '';
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
	        + '<summary>Why this matters' + (cleanerHint ? ' and what to change in the contract' : '') + '</summary>'
	        + '<div class="lead-finding-notes-body">'
	        + (topGroup.impact ? '<p class="lead-finding-impact"><strong>Why this is problematic:</strong> ' + escapeHtml(topGroup.impact) + '</p>' : '')
	        + (cleanerHint ? '<p class="lead-finding-cleaner"><strong>Direct contract edit:</strong> ' + escapeHtml(cleanerHint) + '</p>' : '')
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

			    html += renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: familyName, open: openDrawer });

    if (chainContext) {
      html += chainContext;
    }

    return html;
  }

		  function syncSelectedEndpointHighlight() {
		    if (!el.familySurface) return;

		    // Clear all selected states
		    Array.prototype.forEach.call(el.familySurface.querySelectorAll('.family-row.row-selected, .endpoint-subrow.row-selected, .nested-endpoint-row.row-selected'), function (row) {
		      row.classList.remove('row-selected');
		    });
		    Array.prototype.forEach.call(el.familySurface.querySelectorAll('tr[data-family-row="true"].row-has-selected-child'), function (row) {
		      row.classList.remove('row-has-selected-child');
		    });

	    // Expanded rows get a subtle structural highlight via `.is-expanded`.
	    // Selection is reserved for an explicitly inspected endpoint (stronger highlight).
	    if (!state.selectedEndpointId) return;

	    var selectedDetail = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails[state.selectedEndpointId] : null;
	    var selectedFamilyName = selectedDetail && selectedDetail.endpoint ? (selectedDetail.endpoint.family || '') : '';

    // Apply the selected-row background to only the currently active row:
    // 1) If the selected endpoint row is rendered (expanded), highlight that.
    // 2) Otherwise, fall back to highlighting the family row so selection is still visible.
	    var selectedSubrow = el.familySurface.querySelector('.nested-endpoint-row[data-endpoint-id="' + state.selectedEndpointId + '"], .endpoint-subrow[data-endpoint-id="' + state.selectedEndpointId + '"]');
	    if (selectedSubrow) {
	      selectedSubrow.classList.add('row-selected');
	      // Keep family ownership visible even when the endpoint row is the only tinted selection.
	      var ownerFamily = selectedSubrow.getAttribute('data-family') || selectedFamilyName;
	      if (ownerFamily) {
	        var ownerRow = el.familySurface.querySelector('tr[data-family="' + ownerFamily + '"][data-family-row="true"]');
	        if (ownerRow) ownerRow.classList.add('row-has-selected-child');
	      }
	      return;
	    }
    if (selectedFamilyName) {
      var familyRow = el.familySurface.querySelector('tr[data-family="' + selectedFamilyName + '"][data-family-row="true"]');
      if (familyRow) familyRow.classList.add('row-selected');
    }
  }

		  function endpointHasWorkflowBurden(detail) {
	    if (state.activeTopTab !== 'workflow') return false;
	    if (!detail) return false;
	    if ((detail.relatedChains || []).length) return true;
	    var findings = detail.findings || [];
	    return findings.some(function (f) {
      if (!f) return false;
      if (f.burdenFocus === 'workflow-burden') return true;
      var code = f.code || '';
      return code === 'prerequisite-task-burden'
        || code === 'weak-follow-up-linkage'
        || code === 'weak-action-follow-up-linkage'
        || code === 'weak-accepted-tracking-linkage'
        || code === 'weak-outcome-next-action-guidance'
        || code === 'contract-shape-workflow-guidance-burden';
    });
  }

	  function renderInspectorWorkflowContextSupport(detail, options) {
	    var opts = options || {};
	    if (!endpointHasWorkflowBurden(detail)) return '';

    var chainCount = (detail.relatedChains || []).length;
    var hasChain = chainCount > 0;
    var summaryMeta = hasChain
      ? (chainCount + ' chain' + (chainCount === 1 ? '' : 's'))
      : 'no inferred chain';

    var defaultOpen = !!opts.defaultOpen;
    var open = (typeof state.inspectorWorkflowContextOpen === 'boolean')
      ? state.inspectorWorkflowContextOpen
      : defaultOpen;
	    var openAttr = open ? ' open' : '';
	    var bodyHtml = hasChain
	      ? renderWorkflowChainContextForEndpoint(detail)
	      : '<div class="family-insight-card"><p class="subtle">Workflow burden signals exist for this endpoint, but it is not currently linked to an inferred call chain in this payload.</p></div>';

	    return '<details class="detail-evidence-drawer inspector-workflow-context-drawer"' + openAttr + ' data-inspector-workflow-context="1">'
	      + '<summary>Workflow chain context (' + escapeHtml(summaryMeta) + ')</summary>'
	      + '<div class="workspace-section-body">'
	      + '<p class="subtle">Use this when the contract forces hidden handoffs or unclear next steps. Click a step to inspect that endpoint.</p>'
	      + bodyHtml
	      + '</div>'
	      + '</details>';
	  }

	  function renderEndpointDiagnostics() {
    // ============================================================================
    // CONTENT PRESERVATION AUDIT & MAPPING
    // ============================================================================
    // This function consolidates all detail content from the old right-hand and
    // lower detail surfaces. The following checklist ensures NO CONTENT WAS LOST.
    //
    // OLD SURFACE CONTENT -> NEW LOCATION MAPPING:
    // ============================================================================
    //
    // 1. GROUPED EXACT EVIDENCE
    //    Old: Right panel, "Exact evidence" section (expandable)
    //    New: Tab "Exact evidence" -> renderEndpointDiagnosticsExact()
    //         All findings grouped by location/type in collapsible <details>
    //         First 2 group open by default, rest collapsible
    //    ✓ PRESERVED: Full grouped structure maintained
    //
    // 2. OPENAPI GROUNDING / LOCATION CUES
    //    Old: Right panel, "Endpoint grounding" section
    //    New: Multiple locations:
    //         a) Spec-rule Summary -> renderOpenAPIContextPills() in detail hero
    //         b) All tabs "Exact evidence" -> renderInspectorGroundingAndFlowContext()
    //            Shows context pills + spec rule grounding
    //    ✓ PRESERVED: Complete grounding with location mappings intact
    //
    // 3. WHY THIS MATTERS (Issue descriptions & context)
    //    Old: Right panel, issue descriptions and "Why it matters" blurbs
    //    New: Multiple locations:
    //         a) Workflow Summary: "Why this endpoint matters in flow" bullet
    //         b) Shape Summary: "endpoint-local shape DX burden" explanation
    //         c) Each tab shows lead issue message with context
    //         d) Grouped evidence shows full "why it matters" text from messages
    //    ✓ PRESERVED: All explanatory context shown in appropriate summary sections
    //
    // 4. INSPECT IN SPEC / NORMATIVE DETAILS
    //    Old: Right panel, spec rule grounding links/details
    //    New: a) Exact evidence tab -> renderSpecRuleGroundingForGroup()
    //            Shows rule ID, normative level, spec source, location
    //         b) Grounding section -> Full normative details preserved
    //    ✓ PRESERVED: All spec rule grounding accessible via exact evidence tab
    //
    // 5. CLEANER CONTRACT EMPHASIS / IMPROVEMENTS
    //    Old: Right panel, "Cleaner contract" tab (was a separate tab)
    //    New: a) Shape lens: Tab "Cleaner shape emphasis" 
    //            -> renderEndpointDiagnosticsCleaner()
    //            Shows improved vs current response patterns
    //         b) Spec-rule lens: Tab "Cleaner contract emphasis"
    //            -> renderEndpointDiagnosticsCleaner()
    //    ✓ PRESERVED: Both lenses still have dedicated cleaner emphasis tab
    //
    // 6. CONSISTENCY / DRIFT CONTEXT
    //    Old: Right panel, "Consistency" tab with drift analysis
    //    New: a) Spec-rule lens: Tab "Consistency / drift"
    //            -> renderEndpointDiagnosticsConsistency()
    //            Shows drift bullets + evidence drawer + sibling comparisons
    //         b) Shape lens: Consistency support card in Shape Summary
    //            Shows highest-impact 3 drift signals compactly
    //    ✓ PRESERVED: Full consistency tab for spec-rule, card summary for shape
    //
    // 7. WORKFLOW CONTEXT (continuity signals, chain info)
    //    Old: Right panel, workflow-specific context section
    //    New: a) Workflow Summary shows:
    //            - Chain membership ("appears in X workflow chains")
    //            - Primary continuity signals
	    //         b) Exact evidence "Schema grounding and workflow context" drawer shows:
    //            - Full chain context with handoff analysis
    //            - Step-by-step flow explanation
    //    ✓ PRESERVED: All workflow context in summary + collapsible flow details
    //
    // 8. SHAPE INTERPRETATION (profile metrics, burden explanation)
    //    Old: Right panel, shape-specific view with metrics
    //    New: Tab "Shape summary" -> renderEndpointDiagnosticsShapeSummary()
    //         Shows:
    //         - Complete shape profile (deep/internal/dup/snapshot/source/outcome/nextAction)
    //         - Evidence grouping count and top groups
    //         - Location highlights (primary schema locations to inspect)
    //         - Collapsible lead issue with grounding
    //    ✓ PRESERVED: All metrics and interpretation in dedicated shape summary
    //
    // 9. SUPPORTING SIBLING COMPARISONS
    //    Old: Right panel (consistency tab), "Sibling endpoints" list
    //    New: Tab "Consistency / drift" -> renderEndpointDiagnosticsConsistency()
    //         Shows up to 6 sibling endpoints in "For comparison" section
    //    ✓ PRESERVED: Same sibling list accessible in consistency tab
    //
    // 10. GROUPED ISSUE CLUSTERS / COUNTS
    //     Old: Right panel, evidence grouped by location/type with counts
    //     New: Multiple locations:
    //          a) Summary panels show group counts and top group titles
    //          b) Exact evidence tab shows all groups with full messages
    //             Count displayed in tab label: "Exact evidence (3 groups)"
    //          c) Shape summary shows "grouped into X clusters"
    //    ✓ PRESERVED: All grouping counts visible in summaries + exact tab
    //
    // TRAP GUIDANCE (added content, not lost)
    //    New: Now visible in all lens summaries:
    //         - Workflow Summary: "Workflow trap guidance" section
    //         - Shape Summary: "Shape trap guidance" section
    //    ✓ ENHANCED: First-class trap guidance in all lenses
    //
    // CONTRACT COMPARISON (added content, not lost)
    //    New: Now visible in workflow/shape summaries:
    //         "Current contract shape vs workflow-first contract shape"
    //    ✓ ENHANCED: Explicit comparison in inspector summaries
    //
    // ============================================================================
    // EXPANDABLE SECTIONS GUARANTEE
    // ============================================================================
    // Content NOT shown by default is available via <details> tags:
    //   - Lead issue context (workflow/shape summaries)
    //   - Full exact evidence groups
    //   - Grounding and flow context
    //   - Consistency evidence
    // All are INLINE within the diagnostics panel (no jump elsewhere).
    //
    // ============================================================================

		    if (!el.endpointDiagnosticsSection) return;

		    var workflowTabActive = state.activeTopTab === 'workflow';
		    var shapeTabActive = state.activeTopTab === 'shape';
		    var inlineMount = findInlineInspectorMount(state.selectedEndpointId);
		    // Never render a detached bottom inspector module. The inspector mounts inline beneath
		    // the selected endpoint row inside the family surface.
		    el.endpointDiagnosticsSection.style.display = 'none';
		    el.endpointDiagnosticsBody.innerHTML = '';
		    el.endpointDiagnosticsHelp.textContent = '';
		    state.detachedInspectorVisible = false;

		    // Fallback: if we cannot find an inline mount, render a detached workspace below the
		    // family table (and provide a sticky in-flow anchor beneath the selected row).
		    // Inline placement is preferred and should normally be used.
		    var useDetached = !inlineMount;
		    if (useDetached) {
		      inlineMount = el.endpointDiagnosticsBody;
		      el.endpointDiagnosticsSection.style.display = 'block';
		      state.detachedInspectorVisible = true;
		    }
		    var diagnosticsTitle = el.endpointDiagnosticsSection.querySelector('h2');
		    if (diagnosticsTitle) {
		      diagnosticsTitle.textContent = workflowTabActive
		        ? 'Workflow Guidance — endpoint continuity inspector'
	        : shapeTabActive
	        ? 'Response Shape — endpoint pain inspector'
	        : 'Contract Issues — endpoint inspector';
	    }
	    var diagnosticsEyebrow = el.endpointDiagnosticsSection ? el.endpointDiagnosticsSection.querySelector('.section-heading .eyebrow') : null;
	    if (diagnosticsEyebrow) {
	      diagnosticsEyebrow.textContent = 'Endpoint inspector';
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

		    var detail = state.selectedEndpointId ? endpointDetailForId(state.selectedEndpointId) : null;
		    var hasValidSelection = !!detail && hasValidSelectedEndpointInCurrentView();
		    document.body.classList.toggle('has-endpoint-selection', hasValidSelection);

			    if (!hasValidSelection) {
			      inlineMount.innerHTML = renderEndpointDiagnosticsEmptyState();
			      bindEndpointDiagnosticsInteractions(inlineMount);
			      syncSelectedEndpointHighlight();
			      return;
			    }

	    syncSelectedEndpointHighlight();

		    var endpoint = detail.endpoint || {};
		    var findings = findingsForActiveLens((detail.findings || []));
			    // Keep the inspector chrome stable: selected endpoint identity is shown in the
			    // inspector header block itself (method/path + issue count). Avoid mixing in a
			    // second "helper" line that can go stale across selection/filter changes.
			    el.endpointDiagnosticsHelp.textContent = '';

					    var body = buildEndpointDiagnosticsBody(detail, findings);
					    inlineMount.innerHTML = body;
					    bindEndpointDiagnosticsInteractions(inlineMount);
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

  // ---------------------------------------------------------------------------
  // SHAPE BURDEN: pain-signal analysis
  // Maps real finding codes → developer pain, concrete examples, caller-needed
  // ---------------------------------------------------------------------------

	  function collectShapePainSignals(endpoint, findings) {
	    var path = ((endpoint && endpoint.path) || '').toLowerCase();
	    var method = ((endpoint && endpoint.method) || '').toUpperCase();
	    var signals = [];

    function hasCode(code) {
      return findings.some(function (f) { return (f.code || '') === code; });
    }
    function hasMsgMatch(re) {
      return findings.some(function (f) { return re.test((f.message || '').toLowerCase()); });
    }

    // Derive commerce workflow context from path
    var isOrder    = /\/order/.test(path);
    var isCart     = /\/cart/.test(path);
    var isPayment  = /\/payment|\/checkout/.test(path);
    var isProduct  = /\/product/.test(path);
    var isCustomer = /\/customer/.test(path);
    var isAuth     = /\/login|\/auth|\/session|\/register/.test(path);
    var isAction   = path.indexOf('/_action/') !== -1;
    var isMutation = method === 'POST' || method === 'PATCH' || method === 'PUT';

	    // 1. Deep nesting
	    if (hasCode('deeply-nested-response-structure') || hasMsgMatch(/nested|deep/)) {
      var nestEx = isOrder
        ? 'An order creation response returns the full order graph: lineItems[].product.media[].thumbnails.url alongside billing/shipping addresses, all at equal depth. The "did my order succeed?" answer is buried 3–4 levels down in a structure meant for the database, not the client.'
        : isCart
        ? 'Cart mutation returns the full cart snapshot. The updated price the developer actually needs requires traversing lineItems[] to unitPrice to gross, while product thumbnails and nested options sit at the same depth.'
        : 'The response nests outcome data inside multiple levels of objects or arrays, placing immediately-relevant fields (status, id, next action) at the same depth as incidental configuration data.';
      var nestNeeded = isOrder
        ? '{ "orderId": "…", "status": "open", "paymentRequired": true, "paymentUrl": "…" }'
        : isCart
        ? '{ "token": "…", "itemCount": 3, "total": { "gross": 99.95, "currency": "EUR" }, "nextAction": "checkout" }'
        : 'A flat outcome block with changed state and next action near the top, not buried inside nested objects.';
	      signals.push({
	        code: 'deep-nesting',
	        label: 'Deep nesting hides outcome meaning',
	        pain: 'Developers must traverse multiple nesting levels to reach what actually changed. Access paths like response.lineItems[0].product.price.gross become fragile — a schema change at any level silently breaks the client. The fields needed for the next API call may require 4+ chained property lookups.',
	        example: nestEx,
	        callerNeeded: nestNeeded,
	        notice: 'Outcome IDs/status/nextAction are not top-level, so callers must traverse incidental branches to continue the workflow.',
	        recommendedChange: 'Flatten outcome and nextAction fields near the top level (or add a dedicated outcome block) so clients can read the result without deep traversal.',
	        icon: 'Depth'
	      });
	    }

    // 2. Storage-shaped / snapshot-heavy
    if (hasCode('snapshot-heavy-response') || hasCode('contract-shape-workflow-guidance-burden') || hasMsgMatch(/snapshot|storage|model structure|full model/)) {
      var snapEx = isOrder || isPayment
        ? 'POST /order returns the full persisted entity: internal tracking fields, all audit timestamps, every configuration object, every address format — when the developer only needed to know: order was created, here\'s your ID and payment URL. The "created" confirmation is on equal footing with versionId and autoIncrement.'
        : isCart
        ? 'PATCH /line-item returns the full cart snapshot including product metadata, nested shipping options, and pricing rules — when the developer only needed to confirm the line item was added and see the updated total.'
        : 'The response mirrors the internal storage model rather than summarising the task outcome. Outcome-critical fields (status, authoritative ID, next step) are equally weighted with internal bookkeeping.';
      var snapNeeded = isOrder
        ? '{ "id": "…", "orderNumber": "10001", "status": "open", "paymentUrl": "/payment/handle/…", "confirmationRequired": false }'
        : isCart
        ? '{ "token": "…", "gross": 99.95, "net": 84.00, "tax": 15.95, "currency": "EUR", "itemCount": 3 }'
        : 'A compact outcome-first payload: status, authoritative identifiers, and next action close to the top level with incidental fields omitted.';
	      signals.push({
	        code: 'snapshot-heavy',
	        label: 'Storage-shaped response — the database model mirrors back',
	        pain: 'The response reflects what the server stores rather than what the caller needs next. Developers must reverse-engineer which fields are authoritative, which are incidental, and what the operation actually changed. Onboarding cost multiplies because there is no contract-level hint about purpose — developers read the whole object hoping to find the relevant fragment.',
	        example: snapEx,
	        callerNeeded: snapNeeded,
	        notice: 'The success outcome is not foregrounded; storage/internal fields compete visually with the task result.',
	        recommendedChange: 'Return a compact outcome-first payload (ids, status, nextActions) and move full snapshots behind explicit follow-up endpoints.',
	        icon: 'Snapshot'
	      });
	    }

    // 3. Duplicated state
    if (hasCode('duplicated-state-response') || hasMsgMatch(/duplicate|source of truth|authoritative/)) {
      var dupEx = isOrder
        ? 'order.status, order.stateMachineState.name, and order.stateMachineState.technicalName all appear in the same response and express the same concept. If any diverge (due to cache lag or partial write), the developer has no contract-based way to decide which is authoritative.'
        : 'The same conceptual state appears under multiple keys in the response — for example price appearing in both lineItem.price and lineItem.unitPrice.gross — with no documented source-of-truth.';
      var dupNeeded = isOrder
        ? 'A single explicit status field. If state machine detail is needed separately, expose it as a sub-resource: { "status": "open", "stateDetail": "/order/{id}/state" }'
        : 'One canonical field name mapped to one authoritative value. Derived representations removed or explicitly labelled as read-only views.';
	      signals.push({
	        code: 'duplicated-state',
	        label: 'Duplicated state — no clear source of truth',
	        pain: "When the same concept appears under multiple keys, developers pick one and rely on it. When those values diverge in production (cache lag, eventual consistency, partial update), the bug is silent until a customer notices. Client code that picked the \"wrong\" duplicate is correct until the day it isn't.",
	        example: dupEx,
	        callerNeeded: dupNeeded,
	        notice: 'The same domain concept is represented multiple ways with no contract hint about which field is authoritative.',
	        recommendedChange: 'Pick one canonical field for the concept (status/total/etc), remove duplicates, and if derived views must remain, label them explicitly as derived/read-only.',
	        icon: 'State'
	      });
	    }

    // 4. Incidental internal fields
    if (hasCode('incidental-internal-field-exposure') || hasMsgMatch(/internal|incidental|audit|raw id/)) {
      var intEx = isOrder || isProduct
        ? 'The order response includes fields like createdById, updatedAt, versionId, autoIncrement, childCount, and raw UUID join columns alongside the orderNumber, status, and total that the developer actually uses. Every internal field adds cognitive load and becomes a silent coupling surface.'
        : isCustomer
        ? 'Customer detail includes internal fields like legacyEncoderKey, versionId, and raw storage IDs. Developers who key off these create coupling to the backend\'s storage layer, not the domain model.'
        : 'Storage-level identifiers, audit timestamps, and backend join columns appear alongside domain-level response data at equal depth.';
      var intNeeded = isOrder
        ? 'Domain fields only: { "id": "…", "orderNumber": "…", "customerId": "…", "status": "…", "total": { "gross": …, "currency": "…" } }'
        : 'Only fields that carry domain meaning or are needed for the next API call. Internal/audit fields behind a separate admin-scoped endpoint if tooling genuinely needs them.';
	      signals.push({
	        code: 'internal-fields',
	        label: 'Incidental internal fields crowd out domain meaning',
	        pain: "Internal fields force developers to figure out which fields matter. They become accidental documentation targets: once a developer couples client code to versionId or autoIncrement, those fields can't be renamed without a breaking change. The contract grows stickier in the wrong direction.",
	        example: intEx,
	        callerNeeded: intNeeded,
	        notice: 'Backend/audit/join fields appear alongside domain fields at equal depth, encouraging accidental coupling.',
	        recommendedChange: 'Remove internal/audit fields from the default success payload (or move them to explicitly internal components/endpoints) and keep only domain + workflow-handoff fields.',
	        icon: 'Internal'
	      });
	    }

    // 5. Missing outcome framing
    if (hasCode('weak-outcome-next-action-guidance') || hasMsgMatch(/outcome|what changed|result mean/)) {
      var outEx = isPayment
        ? "POST /handle-payment returns 200 but the body doesn't indicate whether payment was accepted, deferred, or requires redirect. The developer writes a secondary GET to confirm state — a round-trip the contract could have eliminated."
        : isAction
        ? 'An /_action/ endpoint returns 200 with data but no outcome framing. Was the action applied? Is it pending? Does the caller need to poll? The developer must infer this from context or read docs each time.'
        : isMutation
        ? "A mutation (POST/PATCH/PUT) returns the resource but doesn't clearly distinguish between 'I applied your changes immediately' and 'I queued them' or 'this requires a follow-up confirmation step'."
        : 'The response contains populated fields but no framing that contextualises the result. Success vs partial success vs async acceptance look the same to the caller.';
      var outNeeded = isPayment
        ? '{ "outcome": "redirect_required", "redirectUrl": "…", "transactionId": "…", "pollFor": "transaction.status" }'
        : isAction
        ? '{ "outcome": "accepted", "appliedNow": false, "transitionTo": "in_progress", "followUp": "/order/{id}/state" }'
        : '{ "applied": true, "status": "confirmed", "nextAction": null } — or for async: { "accepted": true, "pendingConfirmation": true, "confirmUrl": "…" }';
		      signals.push({
		        code: 'missing-outcome',
		        label: 'Missing outcome framing — caller must infer what happened',
		        pain: "Without explicit outcome framing, developers write defensive code that checks 3–4 fields to infer state. 'Did it work?' becomes a runtime question that needs a contract-level answer. Integration tests grow complex because they must mock guesses rather than trust explicit outcome fields.",
		        example: outEx,
		        callerNeeded: outNeeded,
		        notice: 'Success/accepted/pending outcomes look the same; clients must poll or do follow-up reads to confirm what happened.',
		        recommendedChange: 'Add explicit outcome fields (applied/accepted/pending, status, trackingId/confirmUrl) so clients can continue without reverse-engineering.',
		        icon: 'Outcome'
		      });
	    }

    // 6. Missing next-action cues
    if (hasCode('weak-follow-up-linkage') || hasCode('weak-action-follow-up-linkage') || hasCode('weak-accepted-tracking-linkage') || hasMsgMatch(/next[-\s]?step|follow[-\s]?up|tracking/)) {
	      var nextEx = isOrder
        ? "POST /order succeeds but the response doesn't include a payment URL, whether confirmation is needed, or any indication of required customer steps. The developer reads the API docs or asks in Slack to learn these rules — then hard-codes assumptions that can break when the payment provider changes."
	        : isCart
	        ? "PATCH /cart returns the updated cart but doesn't indicate whether the cart is now ready for checkout or if there are blockers (e.g., shipping method not selected, item now out of stock). The developer polls or adds defensive checks."
	        : 'The operation completes but the response does not expose what the next call needs to be, which ID to carry forward, or whether additional steps are required before the workflow continues.';
      var nextNeeded = isOrder
        ? '{ "orderId": "…", "status": "open", "nextActions": [{ "type": "payment", "url": "…", "required": true }] }'
        : isCart
        ? '{ "token": "…", "readyForCheckout": false, "blockers": [{ "type": "shippingMethod", "message": "Select a shipping method to continue" }] }'
        : 'An explicit nextAction field or _links object that guides the caller to the next step without requiring out-of-band documentation.';
	      signals.push({
	        code: 'missing-next-action',
	        label: 'Missing next-action cues — handoff requires reading docs',
	        pain: "Without next-step cues, developers learn the call sequence from documentation, Slack questions, or reverse-engineering prior implementations. This multiplies per-developer integration time and produces brittle hard-coded assumptions about workflow sequencing — assumptions that break when the workflow changes.",
	        example: nextEx,
	        callerNeeded: nextNeeded,
	        notice: 'The response does not name the next valid operation or provide the identifier/linkage needed for the next step.',
	        recommendedChange: 'Expose `nextActions` (or `_links`) with the next endpoint(s), required context, and handoff IDs so the workflow can be chained deterministically.',
	        icon: 'Next'
	      });
	    }

    return signals;
  }

	  function renderShapePainSignals(signals) {
	    if (!signals || !signals.length) return '';

	    function sentenceCount(text) {
	      if (!text) return 0;
	      var t = String(text).trim();
	      if (!t) return 0;
	      var parts = t.split(/[.!?]+/).map(function (p) { return p.trim(); }).filter(Boolean);
	      return parts.length || 1;
	    }

	    function firstSentence(text) {
	      if (!text) return '';
	      var t = String(text).trim();
	      if (!t) return '';
	      var m = t.match(/^(.+?[.!?])(\s|$)/);
	      return m ? m[1].trim() : t;
	    }

	    function renderConcreteExample(signal) {
	      // Every expandable example must include three explicit parts:
	      // 1) What is shown in the current payload (pattern)
	      // 2) Why this is burdensome for the caller
	      // 3) What an improved task-shaped contract would surface instead
	      var current = (signal.example || '').trim();
	      var burden = (signal.notice || '').trim() || firstSentence(signal.pain || '');
	      var improved = (signal.callerNeeded || '').trim();
	      var change = (signal.recommendedChange || '').trim();

	      // Build the 3-part content (always explicit, even when not expandable).
	      var blocks = [];
	      blocks.push('<div class="shape-example-item">'
	        + '<span class="shape-example-label">Current payload shows</span>'
	        + '<p class="shape-example-text">' + escapeHtml(current || 'A storage-shaped response pattern where the outcome is not foregrounded.') + '</p>'
	        + '</div>');
	      blocks.push('<div class="shape-example-item">'
	        + '<span class="shape-example-label">Why this burdens the caller</span>'
	        + '<p class="shape-example-text">' + escapeHtml(burden || 'The caller must infer outcome meaning, traverse deep state, or carry hidden context into the next step.') + '</p>'
	        + '</div>');

	      var improvedBody = '';
	      if (improved) {
	        improvedBody += '<pre class="shape-example-code"><code>' + escapeHtml(improved) + '</code></pre>';
	      } else {
	        improvedBody += '<p class="shape-example-text">Return an outcome-first payload with explicit nextAction/context fields.</p>';
	      }
	      if (change) {
	        improvedBody += '<p class="shape-example-text"><strong>Contract change:</strong> ' + escapeHtml(change) + '</p>';
	      }
	      blocks.push('<div class="shape-example-item">'
	        + '<span class="shape-example-label">Improved task-shaped contract would surface</span>'
	        + improvedBody
	        + '</div>');

	      // Keep accordions only when they reveal materially more than one-line filler
	      // (payload fragments, before/after examples, multi-part guidance).
	      var material = false;
	      if (improved) material = true; // code fragment is always material
	      if (!material && current && sentenceCount(current) > 1) material = true;
	      if (!material && change && change.length > 90) material = true;
	      if (!material && (String(current).length + String(burden).length + String(improved).length + String(change).length) > 260) material = true;

	      if (!material) {
	        return '<div class="shape-example-inline-block">'
	          + '<p class="subtle"><strong>Concrete example:</strong></p>'
	          + '<div class="shape-example-grid">' + blocks.join('') + '</div>'
	          + '</div>';
	      }

	      return '<details class="shape-pain-detail">'
	        + '<summary>Concrete example</summary>'
	        + '<div class="shape-example-grid">' + blocks.join('') + '</div>'
	        + '</details>';
	    }

	    return '<div class="shape-pain-signals">'
	      + signals.map(function (signal) {
	          return '<div class="shape-pain-signal">'
	            + '<div class="shape-pain-signal-header">'
	            + '<span class="shape-pain-icon">' + signal.icon + '</span>'
	            + '<strong class="shape-pain-label">' + escapeHtml(signal.label) + '</strong>'
	            + '</div>'
	            + '<p class="shape-pain-why">' + escapeHtml(signal.pain) + '</p>'
	            + renderConcreteExample(signal)
	            + '</div>';
	        }).join('')
	      + '</div>';
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
      var kind = chain.kind ? chain.kind.replaceAll('-', ' to ') : 'workflow';

      html += '<div class="chain-context-block">'
        + '<div class="chain-position-banner">Step ' + stepNum + ' of ' + totalSteps + ' — ' + escapeHtml(kind) + '</div>';

      if (hasPrev) {
        var prevId = chain.endpointIds[stepIndex - 1];
        var prevDetail = endpointDetails[prevId];
        if (prevDetail) {
          html += '<div class="chain-step-info prev-step">'
            + '<p class="chain-step-label">Came from</p>'
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
            + '<p class="chain-step-label">Leads to</p>'
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

	  function severityWord(severity) {
	    var s = (severity || '').toLowerCase();
	    if (s === 'error') return 'Error';
	    if (s === 'warning' || s === 'warn') return 'Warning';
	    if (s === 'info') return 'Info';
	    return 'Info';
	  }

	  function evidenceGroupTitleLine(group) {
	    if (!group) return 'Info — issue';
	    var sev = severityWord(group.severity);
	    var raw = group.title || '';
	    var parts = raw.split(' | ');
	    var fieldPart = parts.length > 1 ? parts[0] : '';
	    var issueType = parts.length > 1 ? parts.slice(1).join(' | ') : raw;

	    // Prefer a stable, short "issue type" for spec-rule groups.
	    if (group.isSpecRule) {
	      issueType = group.dimension || (group.specRuleId ? ('spec-rule ' + group.specRuleId) : 'spec-rule');
	    } else {
	      issueType = group.dimension || issueType || 'issue';
	    }

	    var field = fieldPart;
	    if (!field && group.context) {
	      if (group.context.primaryValue) {
	        field = group.context.primaryValue;
	      } else if (group.context.statusCode) {
	        field = 'response ' + group.context.statusCode;
	      } else if (group.context.primaryLabel) {
	        field = group.context.primaryLabel;
	      }
	    }

	    var line = sev + ' — ' + issueType;
	    if (field) line += ' — ' + field;
	    return line;
	  }

	  function inspectTargetForGroup(group, endpoint) {
	    if (!group) return '';
	    var ctx = group.context || {};

	    if (group.isSpecRule) {
	      var ruleId = group.specRuleId || '';
	      if (ruleId === 'OAS-RESPONSE-DESCRIPTION-REQUIRED') {
	        return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'response-description' });
	      }
	      if (ruleId === 'OAS-OPERATION-ID-UNIQUE') {
	        return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'operation-id' });
	      }
	      if (ruleId === 'OAS-NO-SUCCESS-RESPONSE') {
	        var target = openApiResponseObjectPointer(endpoint, '200');
	        return target ? ('OpenAPI: ' + target + '.content[mediaType].schema') : '';
	      }
	      if (ruleId === 'OAS-GET-REQUEST-BODY') {
	        var op = openApiOperationPointer(endpoint);
	        return op ? ('OpenAPI: ' + op + '.requestBody') : '';
	      }
	      if (ruleId === 'OAS-204-HAS-CONTENT') {
	        var noContent = openApiResponseObjectPointer(endpoint, '204');
	        return noContent ? ('OpenAPI: ' + noContent + '.content') : '';
	      }
	      // Fall back to the response object/schema location when possible.
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'response-object' });
	    }

	    if (ctx.primaryLabel === 'Response schema field') {
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'response-field' });
	    }
	    if (ctx.primaryLabel === 'Request schema field') {
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'request-field' });
	    }
	    if (ctx.primaryLabel === 'Response schema') {
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'response-schema' });
	    }
	    if (ctx.primaryLabel === 'Request schema') {
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'request-schema' });
	    }
	    if (ctx.primaryLabel === 'Path parameter') {
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'path-params' });
	    }
	    if (ctx.primaryLabel === 'Response Object') {
	      return formatWhereWithOpenAPITarget(endpoint, ctx, { kind: 'response-object' });
	    }
	    return formatWhereWithOpenAPITarget(endpoint, ctx, {});
	  }

		  function renderIssueGroup(group, index, options) {
		    options = options || {};
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
	    var openAPI = renderOpenAPIContextPills(group.context, true);
	    var specGrounding = group.isSpecRule ? renderSpecRuleGroundingForGroup(group) : '';
	    var openAPIMeta = openAPI
	      ? ('  <div class="issue-group-meta"><span class="grounding-label">OpenAPI location cues (when available)</span>' + openAPI + '</div>')
	      : '';

			    var rawTitle = group.title || 'Grouped issue';
			    var count = group.count || 0;
			    var unit = count === 1 ? 'instance' : 'instances';
			    var scopeFamilyName = options.familyName || '';
			    var scopeLabel = issueScopeLabelForKey(group.groupKey || '', scopeFamilyName);
			    var commonScopeLabel = options.commonScopeLabel || '';
			    var showScopeInline = !commonScopeLabel || scopeLabel !== commonScopeLabel;
			    var scopePill = '<span class="issue-group-scope-pill" title="' + escapeHtml('Scope: ' + scopeLabel) + '"><strong>Scope:</strong> ' + escapeHtml(scopeLabel) + '</span>';
			    var titleLine = evidenceGroupTitleLine(group);
			    var titleHtml = '<span class="issue-group-titleline" title="' + escapeHtml(titleLine) + '">' + escapeHtml(titleLine) + '</span>';
			    var inspectTarget = inspectTargetForGroup(group, options.endpoint || null) || group.inspectHint || '';

				    return '<details class="issue-group'
			      + (index > 0 ? ' issue-group-secondary' : '')
			      + (group.isSpecRule ? ' issue-group-spec-rule' : '')
		      + '"' + openAttr + '>'
		      + '<summary>'
		      + '<span class="issue-toggle-indicator"></span>'
		      + severityBadge(group.severity)
			      + '<span class="issue-group-title">'
		      + titleHtml
		      + '<span class="issue-group-count-inline">' + count + ' ' + unit + '</span>'
		      + (showScopeInline ? scopePill : '')
		      + '</span>'
		      + '</summary>'
		      + '<div class="issue-group-body">'
		      + '  <div class="issue-messages">'
		      + '    <ul>' + messageList + '</ul>'
		      + '  </div>'
		      + expandMore
		      + specGrounding
		      + openAPIMeta
		      + (showScopeInline ? ('  <p class="issue-scope-line"><strong>Scope:</strong> ' + escapeHtml(scopeLabel) + '</p>') : '')
		      + (inspectTarget ? ('  <p class="issue-inspect-hint"><strong>Inspect in schema:</strong> ' + escapeHtml(inspectTarget) + '</p>') : '')
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
	          groupKey: key,
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

	    var responseMissingDescription = /^Response ([0-9]{3}) is missing a description/.exec(message);
	    if (responseMissingDescription) {
	      context.primaryLabel = 'Response Object';
	      context.statusCode = responseMissingDescription[1];
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

  function formatIssueGroupCountLabel(group) {
    if (!group) return 'No grouped issue label available';
    var baseTitle = group.title || 'Grouped issue';
    var count = group.count || 0;
    var unit = count === 1 ? 'instance' : 'instances';
    return baseTitle + ' — ' + count + ' ' + unit + ' on this endpoint';
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
	      return true;
	    });
	  }

	  function rowsInScopeAll() {
	    // All endpoints that match the current "lens" filters (search/category/burden/family pressure),
	    // regardless of evidence-only vs include-no-issue mode.
	    var counts = {};
	    function lensCount(row) {
	      if (!row || !row.id) return 0;
	      if (counts[row.id] !== undefined) return counts[row.id];
	      counts[row.id] = lensFindingCountForRow(row);
	      return counts[row.id];
	    }

	    var rows = scopedRows(state.payload.endpoints || []);

	    // Category/burden lenses define an "issue-carrying" slice. Endpoints with no in-lens
	    // findings should not be treated as matching that lens.
	    if (state.filters.category !== 'all' || state.filters.burden !== 'all') {
	      rows = rows.filter(function (row) { return lensCount(row) > 0; });
	    }

	    if (state.filters.familyPressure !== 'all') {
	      var pressureMap = familyPressureByFamily(rows);
	      rows = rows.filter(function (row) {
	        var key = row.family || 'unlabeled family';
	        return pressureMap[key] === state.filters.familyPressure;
	      });
	    }

	    return rows;
	  }

	  function filteredRows() {
	    var counts = {};
	    function lensCount(row) {
	      if (!row || !row.id) return 0;
	      if (counts[row.id] !== undefined) return counts[row.id];
	      counts[row.id] = lensFindingCountForRow(row);
	      return counts[row.id];
	    }

	    var rows = rowsInScopeAll();

	    // Evidence-only mode must be based on *in-scope* findings, not total findings,
	    // otherwise category/burden changes can leave stale "issue counts" visible.
	    if (!state.filters.includeNoIssueRows) {
	      rows = rows.filter(function (row) { return lensCount(row) > 0; });
	    }

	    rows.sort(function (a, b) {
	      if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
	      var aCount = lensCount(a);
	      var bCount = lensCount(b);
	      if (aCount !== bCount) return bCount - aCount;
	      return a.path.localeCompare(b.path);
	    });

	    return rows;
	  }

	  function firstEvidenceEndpointId(rows) {
	    var found = (rows || []).find(function (row) { return lensFindingCountForRow(row) > 0; });
	    return found ? found.id : (rows[0] ? rows[0].id : '');
	  }

	  function firstVisibleEndpointId(rows) {
	    if (!rows || !rows.length) return '';
	    var withEvidence = rows.find(function (row) { return lensFindingCountForRow(row) > 0; });
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
	    // Static severity label (non-interactive). Use severityBadgeInteractive when the pill
	    // is intended to act as a control.
	    return '<span class="severity-badge severity-' + escapeHtml(severity) + '" title="' + escapeHtml('Severity: ' + String(severity || '').toUpperCase()) + '">'
	      + '<span class="severity-icon">' + escapeHtml(severityIcon(severity)) + '</span>'
	      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
	      + '</span>';
	  }

		  function severityBadgeInteractive(severity) {
		    return '<span class="severity-badge severity-' + escapeHtml(severity) + ' is-interactive" role="button" tabindex="0" title="Open exact evidence for this endpoint">'
		      + '<span class="severity-icon">' + escapeHtml(severityIcon(severity)) + '</span>'
		      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
		      + '</span>';
		  }

		  function severityBadgeEvidenceCTA(severity, endpointId) {
		    if (!severity) return '';
		    if (!endpointId) return severityBadge(severity);
		    return '<button type="button" class="severity-badge severity-' + escapeHtml(severity) + ' is-interactive" data-open-evidence-id="' + escapeHtml(endpointId) + '" aria-label="Open exact evidence groups" title="Open exact evidence groups">'
		      + '<span class="severity-icon" aria-hidden="true">' + escapeHtml(severityIcon(severity)) + '</span>'
		      + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
		      + '</button>';
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
		    } else if (action === 'reset-category') {
		      state.filters.category = 'all';
		      state.familyTableShowAll = false;
		    } else if (action === 'show-all-matching-families') {
		      state.filters.search = '';
		      state.filters.category = 'all';
		      state.filters.burden = 'all';
		      state.filters.familyPressure = 'all';
		      state.filters.includeNoIssueRows = false;
		      state.familyTableShowAll = true;
		      state.familyTableBackState = null;
		      state.expandedFamily = '';
		      state.expandedFamilyInsight = '';
		      state.expandedEndpointInsightIds = {};
		      state.expandedEndpointRowFindings = {};
		      state.detailEvidenceOpenForId = '';
		    } else if (action === 'back-to-all-families') {
	      restoreFamilyTableBackState();
	    } else if (action === 'back-to-family-table') {
	      // Return to the family table surface without changing the active tab or clearing filters.
	      // This collapses family/endpoint drill expansions and restores the prior pre-drill table state when available.
	      restoreFamilyTableBackState();
	    } else if (action === 'reset-burden') {
	      state.filters.burden = 'all';
	      state.filters.category = 'all';
	      state.familyTableShowAll = false;
	    } else if (action === 'show-all-families') {
      state.familyTableShowAll = true;
    } else if (action === 'show-all-workflows') {
      state.filters.search = '';
      state.filters.category = 'all';
      state.filters.burden = 'all';
      state.filters.familyPressure = 'all';
    } else if (action === 'include-no-issue-rows') {
      state.filters.includeNoIssueRows = true;
	    } else if (action === 'clear-table-filters') {
	      state.filters.search = '';
	      state.filters.category = 'all';
	      state.filters.burden = 'all';
	      state.filters.familyPressure = 'all';
	      state.filters.includeNoIssueRows = false;
	      state.familyTableShowAll = false;
	      state.familyTableBackState = null;
	      state.expandedFamily = '';
	      state.expandedFamilyInsight = '';
	      state.expandedEndpointInsightIds = {};
	      state.expandedEndpointRowFindings = {};
	      state.detailEvidenceOpenForId = '';
	    } else if (action === 'clear-current-lens') {
	      if (state.activeTopTab === 'spec-rule') {
	        state.filters.search = '';
	        state.filters.category = 'spec-rule';
	        state.filters.burden = 'all';
	        state.filters.familyPressure = 'all';
	        state.filters.includeNoIssueRows = false;
	        state.familyTableBackState = null;
	        state.expandedFamily = '';
	        state.expandedFamilyInsight = '';
	        state.expandedEndpointInsightIds = {};
	        state.detailEvidenceOpenForId = '';
	        state.familyTableShowAll = false;
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

	    // Recovery actions adjust scope; do not auto-select an endpoint (avoids stale blue row state).
	    state.selectedEndpointId = '';
	    state.userSelectedEndpoint = false;
	    state.detailEvidenceOpenForId = '';
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
    if (action === 'back-to-all-families') return 'Back to all families';
    if (action === 'back-to-family-table') return 'Back to family table';
    if (action === 'clear-search') return 'Clear search';
    if (action === 'reset-category') return 'Reset category';
    if (action === 'show-all-matching-families') return 'Show all matching families';
    if (action === 'reset-burden') return 'Reset burden';
    if (action === 'show-all-families') return 'Show all families in current scope';
    if (action === 'clear-table-filters') return 'Clear table filters';
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
        return 'Inspect in schema: the location referenced by the issue message, then tighten the contract.';
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
	        return 'Declare explicit enum values for finite value sets; avoid bare strings with no schema constraints.';
	      case 'shape / storage-style response weakness':
	        return 'Return a compact outcome payload focused on the client\'s next action, not a storage snapshot.';
	      case 'hidden dependency / linkage burden':
	        return 'Expose prerequisite identifier/state in the parent response so the next call can be formed without extra negotiation.';
	      case 'workflow outcome weakness':
	        return 'Include a tracking ID or a direct link to the created/updated resource in every action/202 response.';
	      case 'shape / nesting complexity':
	        return 'Declare typed item schemas on all array properties; avoid generic object/empty items schemas.';
	      case 'internal/incidental fields':
	        return 'Move join columns, audit timestamps, and storage-internal IDs out of public response schemas.';
	      case 'consistency drift':
	        return 'Align path parameter names and response field names across sibling endpoints operating on the same resource.';
	      case 'change-risk clues':
	        return 'Add deprecation notices and migration guidance before removing or changing visible behaviour.';
	      default:
	        return 'Replace generic response objects with named request/response components and name the exact fields clients must read.';
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
