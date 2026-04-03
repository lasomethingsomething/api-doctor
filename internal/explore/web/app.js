(function () {
  var state = {
    payload: null,
    selectedEndpointId: "",
    selectionSource: "default",
    selectedFindingIdx: -1,
    fixFirstActiveId: null,
    familyPressure: "all",
    filters: { search: "", severity: "all", category: "all", burden: "all", findingsOnly: false, sortBy: "priority" }
  };

  var el = {
    runContext: document.getElementById("runContext"),
    summaryHelp: document.getElementById("summaryHelp"),
    summaryCards: document.getElementById("summaryCards"),
    fixFirstHelp: document.getElementById("fixFirstHelp"),
    fixFirstList: document.getElementById("fixFirstList"),
      fixFirstContext: document.getElementById("fixFirstContext"),
    investigationState: document.getElementById("investigationState"),
    searchInput: document.getElementById("searchInput"),
    severityFilter: document.getElementById("severityFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    burdenFilter: document.getElementById("burdenFilter"),
    hasFindingsOnly: document.getElementById("hasFindingsOnly"),
    familyPriorityFilter: document.getElementById("familyPriorityFilter"),
    sortBy: document.getElementById("sortBy"),
    endpointRows: document.getElementById("endpointRows"),
    evidenceScope: document.getElementById("evidenceScope"),
    searchInsight: document.getElementById("searchInsight"),
    rankingCue: document.getElementById("rankingCue"),
    detailHelp: document.getElementById("detailHelp"),
    endpointDetail: document.getElementById("endpointDetail"),
    workflowHelp: document.getElementById("workflowHelp"),
    workflowPanel: document.getElementById("workflowPanel")
  };

  fetch("/api/payload").then(function (res) { return res.json(); }).then(function (payload) {
    state.payload = payload;
    state.selectedEndpointId = payload.endpoints[0] ? payload.endpoints[0].id : "";
    bindControls();
    renderFilters();
    render();
  });

  function bindControls() {
    el.searchInput.addEventListener("input", function (e) { state.filters.search = e.target.value.trim().toLowerCase(); render(); });
    el.severityFilter.addEventListener("change", function (e) { state.filters.severity = e.target.value; render(); });
    el.categoryFilter.addEventListener("change", function (e) { state.filters.category = e.target.value; render(); });
    el.burdenFilter.addEventListener("change", function (e) { state.filters.burden = e.target.value; render(); });
    el.hasFindingsOnly.addEventListener("change", function (e) { state.filters.findingsOnly = e.target.checked; render(); });
    el.sortBy.addEventListener("change", function (e) { state.filters.sortBy = e.target.value; render(); });
    if (el.familyPriorityFilter) {
      el.familyPriorityFilter.addEventListener("change", function (e) {
        state.familyPressure = e.target.value;
        renderWorkflowPanel();
      });
    }
  }

  function syncControls() {
    el.searchInput.value = state.filters.search;
    el.severityFilter.value = state.filters.severity;
    el.categoryFilter.value = state.filters.category;
    el.burdenFilter.value = state.filters.burden;
    el.hasFindingsOnly.checked = state.filters.findingsOnly;
    el.sortBy.value = state.filters.sortBy;
    if (el.familyPriorityFilter) {
      el.familyPriorityFilter.value = state.familyPressure;
    }
  }

  function renderFilters() {
    setOptions(el.severityFilter, [
      { value: "all", label: "severity: all" },
      { value: "error", label: "severity: error" },
      { value: "warning", label: "severity: warning" },
      { value: "info", label: "severity: info" }
    ]);
    var categories = uniq(flatMap(state.payload.endpoints, function (row) { return Object.keys(row.categoryCounts || {}); })).sort();
    setOptions(el.categoryFilter, [{ value: "all", label: "category: all" }].concat(categories.map(function (c) {
      return { value: c, label: "category: " + c.replaceAll("-", " ") };
    })));
    setOptions(el.burdenFilter, [
      { value: "all", label: "burden focus: all" },
      { value: "workflow-burden", label: "burden focus: hidden next-step dependencies" },
      { value: "contract-shape", label: "burden focus: storage-shaped responses" },
      { value: "consistency", label: "burden focus: consistency" }
    ]);
    var datalist = document.getElementById('searchSuggestions');
    if (datalist) {
      var families = uniq(state.payload.endpoints.map(function (row) { return row.family; })).sort();
      datalist.innerHTML = families.concat(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).map(function (v) { return '<option value="' + escapeHtml(v) + '">'; }).join('');
    }
  }

  function setOptions(select, options) {
    select.innerHTML = options.map(function (opt) {
      if (typeof opt === "string") {
        return '<option value="' + opt + '">' + opt + '</option>';
      }
      return '<option value="' + opt.value + '">' + opt.label + '</option>';
    }).join("");
  }

  function render() {
    renderHeader();
    renderSummary();
    renderInvestigationState();
    renderFixFirst();
    renderFixFirstContext();
    renderEndpointRows();
    renderEndpointDetail();
    renderWorkflowPanel();
  }

  function renderHeader() {
    var run = state.payload.run;
    var diffTag = run.baseSpecPath && run.headSpecPath ? (' | diff: ' + run.baseSpecPath + ' -> ' + run.headSpecPath) : '';
    el.runContext.textContent = 'spec: ' + run.specPath + ' | generated: ' + run.generatedAt + diffTag;
    if (el.summaryHelp) {
      el.summaryHelp.textContent = 'Choose a launch action, inspect families by pressure and issue dimensions, then drill into endpoint messages for concrete fixes.';
    }
  }

  function renderInvestigationState() {
    if (!el.investigationState) return;
    
    var context = buildInvestigationContext();
    if (!context) {
      el.investigationState.innerHTML = '';
      return;
    }

    var clearButton = '<button class="investigation-clear" aria-label="Clear investigation context">✕</button>';
    var html = '<div class="investigation-inner">'
      + '<div class="investigation-label">' + context.what + '</div>'
      + '<div class="investigation-type">' + context.type + '</div>'
      + '<div class="investigation-why">' + context.why + '</div>'
      + '<div class="investigation-action">' + context.action + '</div>'
      + clearButton
      + '</div>';
    
    el.investigationState.innerHTML = html;
    
    var clearBtn = el.investigationState.querySelector('.investigation-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.filters = { search: '', severity: 'all', category: 'all', burden: 'all', findingsOnly: false, sortBy: 'priority' };
        state.fixFirstActiveId = null;
        state.familyPressure = 'all';
        state.selectedEndpointId = '';
        state.selectedFindingIdx = -1;
        state.selectionSource = 'default';
        syncControls();
        render();
      });
    }
  }

  function buildInvestigationContext() {
    if (state.fixFirstActiveId) {
      var item = state.payload.fixFirst.find(function (x) { return x.id === state.fixFirstActiveId; });
      if (item) {
        var rows = filteredRows();
        var matchCount = rows.length;
        return {
          what: 'Investigating: ' + item.label,
          type: 'Preset lens',
          why: item.description,
          action: 'Showing ' + matchCount + ' endpoint' + (matchCount === 1 ? '' : 's') + ' in this lens. Click a row to inspect or click ✕ to reset.'
        };
      }
    }

    // If we're viewing a specific family/workflow from the burden map
    if (state.selectionSource === 'family-workflow' && state.selectedEndpointId) {
      var detail = state.payload.endpointDetails[state.selectedEndpointId];
      if (detail) {
        var endpoint = detail.endpoint;
        return {
          what: 'Exploring from: ' + (endpoint.family || 'unknown family'),
          type: 'Family / pattern jump',
          why: 'You clicked a family or inferred multi-step pattern. This endpoint is representative evidence from that context.',
          action: 'Inspect the evidence below, then use related workflow/family context to explore connected patterns.'
        };
      }
    }

    if (state.selectionSource === 'summary-launch') {
      var launchRows = filteredRows();
      return {
        what: 'Investigating launch focus from top cards',
        type: 'Guided launch action',
        why: 'A launch card applied a lens to reduce scanning and route you to evidence-first endpoints.',
        action: 'List now shows ' + launchRows.length + ' matching endpoints. Detail shows the selected endpoint\'s exact issue messages. Use ✕ to reset.'
      };
    }

    // If we have an active search filter
    if (state.filters.search) {
      var matchCount = filteredRows().length;
      return {
        what: 'Search active: "' + escapeHtml(state.filters.search) + '"',
        type: 'Text search narrowing',
        why: 'You are searching for path, method, or family patterns.',
        action: 'Found ' + matchCount + ' matching endpoint' + (matchCount === 1 ? '' : 's') + '. Click a row to inspect or clear the search to reset.'
      };
    }

    if (state.familyPressure !== 'all') {
      return {
        what: 'Family pressure filter: ' + state.familyPressure,
        type: 'Family-first scope',
        why: 'The family explorer is narrowed by pressure tier so you can inspect high/medium/low families separately.',
        action: 'Choose a family row to load representative endpoint evidence. Clear with ✕ to restore all families.'
      };
    }

    // If we have category or burden filters applied
    if (state.filters.category !== 'all' || state.filters.burden !== 'all') {
      var bits = [];
      if (state.filters.category !== 'all') bits.push('category: ' + state.filters.category.replaceAll('-', ' '));
      if (state.filters.burden !== 'all') bits.push('burden: ' + state.filters.burden.replaceAll('-', ' '));
      var matchCount = filteredRows().length;
      return {
        what: 'Lens applied: ' + bits.join(' + '),
        type: 'Investigation filter',
        why: 'You are narrowing the evidence view to specific types of issues.',
        action: 'Found ' + matchCount + ' endpoint' + (matchCount === 1 ? '' : 's') + ' with these characteristics. Click a row to inspect.'
      };
    }

    if (state.selectionSource === 'endpoint-list' && state.selectedEndpointId) {
      return {
        what: 'Inspecting endpoint evidence detail',
        type: 'Endpoint-level inspection',
        why: 'You selected a specific endpoint row to move from family-level context to exact issue messages.',
        action: 'Detail panel now shows dominant dimensions, concrete issue messages, and next checks. Use ✕ to clear context.'
      };
    }

    return null;
  }

  function applyLaunchAction(action, topFamilyName, burdenCode) {
    state.selectedFindingIdx = -1;
    state.fixFirstActiveId = null;
    if (action === 'launch-family' && topFamilyName) {
      state.filters.search = topFamilyName.toLowerCase();
      state.filters.findingsOnly = true;
      state.filters.sortBy = 'findings';
      state.selectionSource = 'summary-launch';
    } else if (action === 'launch-burden' && burdenCode) {
      state.filters.burden = burdenCode;
      state.filters.findingsOnly = true;
      state.filters.sortBy = 'priority';
      state.selectionSource = 'summary-launch';
    } else if (action === 'launch-high') {
      state.filters.findingsOnly = true;
      state.filters.sortBy = 'priority';
      state.selectionSource = 'summary-launch';
    } else if (action === 'launch-workflows') {
      state.filters.burden = 'workflow-burden';
      state.filters.findingsOnly = true;
      state.filters.sortBy = 'findings';
      state.selectionSource = 'summary-launch';
    }
    syncControls();
    state.selectedEndpointId = firstVisibleEndpointId(filteredRows(), { preferFindings: true });
    render();
  }

  function renderSummary() {
    var s = state.payload.summary;
    var rows = state.payload.endpoints || [];
    var highPriorityCount = rows.filter(function (r) { return r.priority === "high"; }).length;
    var topFamily = topFamilyByFindings(rows);
    var topWorkflowKind = topWorkflowFamily(state.payload.workflows || {});
    var burdenCode = dominantBurdenCode(rows);
    var withFindings = s.endpointsWithIssue || 0;
    var pct = s.endpointsAnalyzed > 0 ? Math.round(100 * withFindings / s.endpointsAnalyzed) : 0;
    var cards = [
      {
        id: "launch-family",
        label: "Family to inspect first",
        value: humanFamilyLabel(topFamily.name),
        meta: topFamily.note + " Click to load endpoints in this family and start with highest-pressure evidence.",
        tone: "tone-trust",
        cta: "Inspect family"
      },
      {
        id: "launch-burden",
        label: "Most common issue dimension",
        value: burdenLabel(burdenCode),
        meta: burdenDescription(burdenCode) + " Click to filter endpoint evidence to this dimension.",
        tone: "tone-workflow",
        cta: "Filter by dimension"
      },
      {
        id: "launch-high",
        label: "High-pressure endpoints",
        value: highPriorityCount + (highPriorityCount === 1 ? " endpoint" : " endpoints"),
        meta: pct + "% of analyzed endpoints (" + withFindings + "/" + s.endpointsAnalyzed + ") have at least one issue. Click to focus list on high-pressure endpoints.",
        tone: "tone-fix",
        cta: "Focus high pressure"
      },
      {
        id: "launch-workflows",
        label: "Inferred multi-step patterns",
        value: s.workflowsInferred + " step-pairs \u00b7 " + s.chainsInferred + " chains",
        meta: "Pattern inference is based on path shapes/ID usage, not runtime traces. Dominant handoff: " + topWorkflowKind + ". Click to focus workflow-linkage issues.",
        tone: "tone-family",
        cta: "Inspect linkage issues"
      }
    ];
    el.summaryCards.innerHTML = cards.map(function (card) {
      return '<article class="card ' + card.tone + '" data-action="' + card.id + '"><p class="card-label">' + card.label + '</p><p class="card-value">' + card.value + '</p><p class="card-meta">' + card.meta + '</p><button class="summary-cta" data-action="' + card.id + '">' + card.cta + '</button></article>';
    }).join("");

    Array.prototype.forEach.call(el.summaryCards.querySelectorAll('.card[data-action]'), function (node) {
      node.addEventListener('click', function (evt) {
        var action = node.getAttribute('data-action');
        applyLaunchAction(action, topFamily.name, burdenCode);
      });
    });
  }

  function renderFixFirst() {
    var rows = state.payload.endpoints || [];
    var topFamily = topFamilyByFindings(rows);
    var topWorkflowKind = topWorkflowFamily(state.payload.workflows || {});
    if (el.fixFirstHelp) {
      el.fixFirstHelp.textContent = 'Use these presets to apply a focused lens, then inspect endpoint evidence messages. Top family concentration: ' + humanFamilyLabel(topFamily.name) + '. Dominant workflow kind: ' + topWorkflowKind + '.';
    }
    el.fixFirstList.innerHTML = state.payload.fixFirst.map(function (item) {
      var rank = fixFirstRank(item.id);
      var meaning = fixFirstMeaning(item.id);
      return '<button class="fix-item" data-id="' + item.id + '"><span class="fix-rank">' + rank + '</span><span class="fix-copy"><strong>' + item.label + '</strong><span class="fix-value">' + item.value + '</span><span class="fix-desc">' + item.description + '</span>' + (meaning ? '<span class="fix-meaning">' + meaning + '</span>' : '') + '</span></button>';
    }).join("");
    Array.prototype.forEach.call(el.fixFirstList.querySelectorAll("button"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var item = state.payload.fixFirst.find(function (x) { return x.id === id; });
        if (!item) return;
        state.filters.severity = item.filter.severity || "all";
        state.filters.category = item.filter.category || "all";
        state.filters.burden = item.filter.burdenFocus || "all";
        state.filters.search = item.filter.query || "";
        state.filters.findingsOnly = item.id !== 'families';
        state.filters.sortBy = item.id === 'families' ? 'findings' : 'priority';
        state.selectionSource = "fix-first";
        state.fixFirstActiveId = id;
        state.selectedFindingIdx = -1;
        syncControls();
        state.selectedEndpointId = firstVisibleEndpointId(filteredRows(), { preferFindings: true });
        render();
      });
    });
  }

  function renderEndpointRows() {
    var rows = filteredRows();
    if (el.evidenceScope) {
      var scopeText = rows.length + ' endpoint' + (rows.length === 1 ? '' : 's') + ' match current lens' + formatLensSuffix(state.filters) + '.';
      if (state.filters.search && rows.length > 0) {
        var famCounts = {};
        rows.forEach(function (r) { famCounts[r.family] = (famCounts[r.family] || 0) + 1; });
        var famEntries = Object.entries(famCounts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4);
        var famTotal = Object.keys(famCounts).length;
        scopeText += ' ' + famTotal + ' ' + (famTotal === 1 ? 'family' : 'families') + ': ' + famEntries.map(function (e) { return e[0] + '\u00a0(' + e[1] + ')'; }).join(', ') + '.';
      }
      el.evidenceScope.textContent = scopeText;
    }
    if (el.searchInsight) {
      var insight = '';
      if (state.filters.search) {
        var families = uniq(rows.map(function (r) { return r.family; }));
        insight = 'Search matches ' + rows.length + ' endpoints across ' + families.length + ' families. Tip: click a family in the panel above to apply a cleaner family lens.';
        if (state.filters.search.indexOf('aggregate') !== -1) {
          insight += ' /aggregate refers to cross-resource utility endpoints rather than one business entity family.';
        }
      } else if (state.filters.category !== 'all' || state.filters.burden !== 'all') {
        insight = 'Current lens is issue-driven. Use family rows above to pivot from issue type to affected endpoint groups.';
      } else {
        insight = 'No search/filter narrowing is active. Start with a family row or preset to avoid scanning all endpoints.';
      }
      el.searchInsight.textContent = insight;
    }
    if (el.rankingCue) {
      if (state.filters.sortBy === 'priority') {
        el.rankingCue.textContent = 'Default order uses endpoint pressure and issue evidence. Score is secondary and shown only as supporting context.';
      } else if (state.filters.sortBy === 'findings') {
        el.rankingCue.textContent = 'Sorted by issue count. Dominant issue type and message detail should guide actual fixes.';
      } else {
        el.rankingCue.textContent = 'Sorted alphabetically by path. Use pressure and dominant issue type to decide what to inspect first.';
      }
    }
    if (rows.length === 0) {
      state.selectedEndpointId = "";
      el.endpointRows.innerHTML = '<tr><td colspan="4" class="subtle">No endpoints match this lens. Clear one filter to widen investigation scope.</td></tr>';
      return;
    }
    if (rows.length > 0 && !rows.find(function (r) { return r.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(rows, { preferFindings: state.filters.findingsOnly || state.selectionSource !== 'endpoint-list' });
    }
    el.endpointRows.innerHTML = rows.map(function (row) {
      var selected = row.id === state.selectedEndpointId ? 'active' : '';
      var pressure = inspectionPressureLabel(row);
      var dominantIssue = rowDominantIssue(row);
      return '<tr class="' + selected + '" data-id="' + row.id + '"><td><div class="endpoint-main"><strong>' + row.method + ' ' + row.path + '</strong><div class="endpoint-sub"><span class="endpoint-chip">' + humanFamilyLabel(row.family) + '</span><span class="subtle">' + rowProblemSummary(row) + '</span></div></div></td><td><div class="dominant-cell"><span class="dominant-main">' + escapeHtml(dominantIssue.label) + '</span><span class="dominant-sub">' + escapeHtml(dominantIssue.code) + '</span></div></td><td><span class="badge ' + row.priority + '">' + row.priority + '</span></td><td><div class="rank-cell"><span class="rank-main">' + pressure + '</span><span class="rank-sub">' + row.findings + ' issue' + (row.findings === 1 ? '' : 's') + '</span><span class="rank-score">Score basis: ' + row.riskSummary + '</span></div></td></tr>';
    }).join('');

    Array.prototype.forEach.call(el.endpointRows.querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () {
        state.selectedEndpointId = tr.getAttribute('data-id');
        state.selectionSource = 'endpoint-list';
        state.selectedFindingIdx = -1;
        renderEndpointRows();
        renderEndpointDetail();
        focusSelectedRow();
      });
    });

    focusSelectedRow();
  }

  function filteredRows() {
    var rows = state.payload.endpoints.slice();
    rows = rows.filter(function (row) {
      if (state.filters.findingsOnly && row.findings === 0) return false;
      if (state.filters.search) {
        var hay = (row.method + ' ' + row.path).toLowerCase();
        if (hay.indexOf(state.filters.search) === -1) return false;
      }
      if (state.filters.severity !== 'all' && !((row.severityCounts || {})[state.filters.severity] > 0)) return false;
      if (state.filters.category !== 'all' && !((row.categoryCounts || {})[state.filters.category] > 0)) return false;
      if (state.filters.burden !== 'all' && (row.burdenFocuses || []).indexOf(state.filters.burden) === -1) return false;
      return true;
    });

    rows.sort(function (a, b) {
      if (state.filters.sortBy === 'path') {
        if (a.path !== b.path) return a.path.localeCompare(b.path);
        return a.method.localeCompare(b.method);
      }
      if (state.filters.sortBy === 'findings') {
        if (a.findings !== b.findings) return b.findings - a.findings;
        return a.path.localeCompare(b.path);
      }
      if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
      if (a.findings !== b.findings) return b.findings - a.findings;
      return a.path.localeCompare(b.path);
    });
    return rows;
  }

  function renderEndpointDetail() {
    var visibleRows = filteredRows();
    if (visibleRows.length === 0) {
      if (el.detailHelp) {
        el.detailHelp.textContent = 'No endpoint detail is shown because the current lens matches no endpoints.';
      }
      el.endpointDetail.innerHTML = "<div class='empty-state'><strong>No matching endpoints in current lens.</strong><p class='subtle'>You are investigating a narrow slice. Clear search or one filter to bring endpoint evidence back.</p><p class='subtle'>Useful reset path: clear search -> set category and burden to all -> keep findings-only on.</p></div>";
      return;
    }

    var detail = state.payload.endpointDetails[state.selectedEndpointId];
    if (!detail || !visibleRows.find(function (row) { return row.id === state.selectedEndpointId; })) {
      if (el.detailHelp) {
        el.detailHelp.textContent = 'Select an endpoint from the visible evidence list to inspect its detail.';
      }
      var howToMsg = 'Pick a row from the evidence list on the left to investigate its specific contract issues, related workflows, and what to fix.';
      if (state.fixFirstActiveId) {
        var item = state.payload.fixFirst.find(function (x) { return x.id === state.fixFirstActiveId; });
        if (item) {
          howToMsg = 'You clicked a priority queue item. ' + howToMsg;
        }
      }
      el.endpointDetail.innerHTML = "<div class='empty-state'><strong>Select an endpoint to inspect concrete issue messages.</strong><p class='subtle'>" + howToMsg + "</p><p class='subtle'>The right panel will show: dominant issue dimensions, exact rule messages, why pressure is high/medium/low, and what to inspect next.</p></div>";
      return;
    }

    if (el.detailHelp) {
      el.detailHelp.textContent = detailContextText();
    }

    var summary = endpointInvestigationSummary(detail);
    var dimensionSummary = summarizeIssueDimensions(detail.findings || []);
    var dimensionBlock = '<div class="dimension-summary"><h3>Dominant issue dimensions</h3>'
      + (dimensionSummary.length > 0
        ? '<div class="dimension-chips">' + dimensionSummary.map(function (d) { return '<span class="dimension-chip">' + escapeHtml(d.label + ' (' + d.count + ')') + '</span>'; }).join('') + '</div>'
        : '<p class="subtle">No direct issue dimensions for this endpoint in current lens.</p>')
      + '</div>';

    var findings = "<h3>Contract issues (exact messages)</h3>";
    if (detail.findings.length === 0) {
      findings += "<p class='subtle'>No contract issues are flagged on this endpoint in the current lens.</p>";
    } else {
      findings += "<ul class='finding-list'>" + detail.findings.map(function (f, idx) {
        var isSelected = idx === state.selectedFindingIdx;
        var impact = f.impact ? '<p class="finding-impact">' + escapeHtml(f.impact) + '</p>' : '';
        var expandContent = '';
        if (isSelected) {
          var hint = findingExamineHint(f.code, f.message);
          var wfCtx = findingWorkflowContext(detail.endpoint.id, f.code, detail.relatedWorkflows);
          expandContent = '<div class="finding-expand">'
            + (hint ? '<p class="finding-examine-label">What to examine</p><p class="finding-examine">' + escapeHtml(hint) + '</p>' : '')
            + wfCtx
            + '</div>';
        }
        var expandArrow = '<span class="finding-toggle">' + (isSelected ? '\u25be' : '\u25b8') + '</span>';
        return '<li class="finding-item' + (isSelected ? ' selected' : '') + '" data-idx="' + idx + '">'
          + '<div class="finding-head"><span class="badge ' + f.severity + '">' + f.severity + '</span><code class="finding-code">' + escapeHtml(f.code) + '</code>' + expandArrow + '</div>'
          + '<p class="finding-message">' + escapeHtml(f.message) + '</p>'
          + impact + expandContent + '</li>';
      }).join("") + "</ul>";
    }

    var workflows = detail.relatedWorkflows.length ? '<h3>Related workflow paths</h3><ul>' + detail.relatedWorkflows.slice(0, 6).map(function (w) {
      return '<li>' + w.kind + ': ' + w.fromLabel + ' → ' + w.toLabel + (w.score ? (' (' + w.score + ')') : '') + '</li>';
    }).join('') + '</ul>' : '';

    var chains = detail.relatedChains.length ? '<h3>Related endpoint families (chains)</h3><ul>' + detail.relatedChains.slice(0, 4).map(function (c) {
      return '<li>' + c.kind + ': ' + c.summary + (c.score ? (' (' + c.score + ')') : '') + '</li>';
    }).join('') + '</ul>' : '';

    var diffs = detail.relatedDiff.length ? '<h3>Related change-risk evidence</h3><ul>' + detail.relatedDiff.slice(0, 5).map(function (d) {
      return '<li>' + d.code + ': ' + escapeHtml(d.message) + '</li>';
    }).join('') + '</ul>' : '';

    el.endpointDetail.innerHTML = '<div class="detail-header"><div class="detail-title"><span class="eyebrow">Selected endpoint</span><span class="detail-path">' + detail.endpoint.method + ' ' + detail.endpoint.path + '</span></div><div class="detail-meta"><span class="badge ' + detail.endpoint.priority + '">' + detail.endpoint.priority + '</span><span class="endpoint-chip">' + humanFamilyLabel(detail.endpoint.family) + '</span><span class="risk-copy">Score basis (secondary): ' + detail.endpoint.riskSummary + '</span></div><div class="detail-context">' + escapeHtml(detailContextText(detail)) + '</div></div><div class="investigation-summary"><h3>Why this endpoint matters</h3><p>' + escapeHtml(summary.why) + '</p><p class="subtle">Next step: ' + escapeHtml(summary.next) + '</p></div>' + dimensionBlock + findings + workflows + chains + diffs;

    Array.prototype.forEach.call(el.endpointDetail.querySelectorAll('.finding-item'), function (item, idx) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        state.selectedFindingIdx = state.selectedFindingIdx === idx ? -1 : idx;
        renderEndpointDetail();
      });
    });
  }

  function renderWorkflowPanel() {
    var wf = state.payload.workflows;
    var details = state.payload.endpointDetails || {};
    var endpointFamilies = buildEndpointFamilySummaries(state.payload.endpoints || [], details);
    var kindSummaries = buildWorkflowKindSummaries(wf.entries || []);
    var familyPatterns = buildFamilyWorkflowPatterns(wf.entries || [], state.payload.endpointDetails || {});
    var filteredFamilies = endpointFamilies.filter(function (f) {
      return state.familyPressure === 'all' || f.pressure === state.familyPressure;
    });

    if (el.workflowHelp) {
      if (filteredFamilies.length > 0) {
        el.workflowHelp.textContent = 'Each family row shows pressure, dominant issue dimensions, and an inferred flow pattern. Clicking applies a family lens and selects representative endpoint evidence.';
      } else {
        el.workflowHelp.textContent = 'No families match the selected pressure tier. Change family pressure filter to widen scope.';
      }
    }

    var families = filteredFamilies.slice(0, 16).map(function (f, idx) {
      var prefix = idx === 0 ? 'Highest signal | ' : '';
      var pattern = familyPatterns[f.family];
      var patternTag = pattern ? ' <span class="family-pattern">flows: ' + workflowKindShort(pattern) + '</span>' : '';
      var dims = (f.topDimensions || []).map(function (d) { return '<span class="dimension-chip">' + escapeHtml(d) + '</span>'; }).join('');
      return '<li class="workflow-click" data-id="' + (f.targetID || '') + '">'
        + '<div class="family-row-head"><strong>' + prefix + humanFamilyLabel(f.family) + '</strong>' + patternTag + '<span class="badge ' + f.pressure + '">' + f.pressure + ' family pressure</span></div>'
        + '<span class="subtle">' + f.findings + ' issue' + (f.findings === 1 ? '' : 's') + ' across ' + f.endpoints + ' endpoint' + (f.endpoints === 1 ? '' : 's') + ' | dominant burden: ' + f.dominantBurden + '</span>'
        + '<div class="dimension-chips">' + dims + '</div>'
        + '</li>';
    }).join('');

    var paths = kindSummaries.slice(0, 6).map(function (k) {
      var kindDesc = workflowKindLabel(k.kind);
      return '<li class="workflow-click" data-id="' + (k.targetID || '') + '">'
        + '<strong>' + k.kind.replaceAll('-', ' → ') + '</strong>: ' + k.count + ' instance' + (k.count === 1 ? '' : 's')
        + '<br><span class="subtle">' + kindDesc + '</span>'
        + '</li>';
    }).join('');

    el.workflowPanel.innerHTML = '<div class="workflow-sections">'
      + '<section class="workflow-group"><h3>Families ranked by pressure and issue dimensions</h3>'
      + '<ul id="familyList">' + (families || "<li class='subtle'>No family summaries in this run.</li>") + '</ul>'
      + '</section>'
      + '<section class="workflow-group"><h3>Inferred multi-step patterns</h3>'
      + '<p class="workflow-caveat subtle">Inferred from endpoint path shapes and ID patterns, not runtime traces. Use these as candidate dependency flows to validate with endpoint messages.</p>'
      + '<ul id="workflowKindList">' + (paths || "<li class='subtle'>No workflow patterns detected.</li>") + '</ul>'
      + '</section>'
      + '</div>';

    ['familyList', 'workflowKindList'].forEach(function (listID) {
      var list = document.getElementById(listID);
      if (!list) return;
      Array.prototype.forEach.call(list.querySelectorAll('li[data-id]'), function (li) {
        li.addEventListener('click', function () {
          if (listID === 'familyList') {
            var endpointId = li.getAttribute('data-id');
            var familyName = '';
            var row = state.payload.endpointDetails[endpointId];
            if (row && row.endpoint) familyName = row.endpoint.family;
            if (familyName) {
              state.filters.search = familyName.toLowerCase();
              state.filters.findingsOnly = true;
              state.filters.sortBy = 'findings';
              syncControls();
            }
            jumpToEndpoint(endpointId);
            return;
          }
          jumpToEndpoint(li.getAttribute('data-id'));
        });
      });
    });
  }

  function jumpToEndpoint(id) {
    if (!id || !state.payload.endpointDetails[id]) return;
    var visible = filteredRows().some(function (row) { return row.id === id; });
    if (!visible) {
      var endpoint = state.payload.endpointDetails[id].endpoint;
      state.filters.search = '';
      state.filters.severity = 'all';
      state.filters.category = 'all';
      state.filters.burden = 'all';
      state.filters.findingsOnly = endpoint.findings > 0;
      state.filters.sortBy = endpoint.findings > 0 ? 'findings' : 'priority';
      syncControls();
    }
    state.selectedEndpointId = id;
    state.selectionSource = 'family-workflow';
    state.selectedFindingIdx = -1;
    renderEndpointRows();
    renderEndpointDetail();
    focusSelectedRow();
  }

  function detailContextText(detail) {
    var hasEvidence = detail && detail.findings && detail.findings.length > 0;
    var base = 'Current lens' + formatLensSuffix(state.filters) + '. ';
    if (state.selectionSource === 'family-workflow') {
      return hasEvidence ? base + 'Opened from family/workflow context. Evidence is rendered in this panel so you can confirm why this endpoint is concerning and what to inspect next.' : base + 'Opened from family/workflow context. This endpoint has no direct issue messages in the current lens, so use related workflow and family context rendered here.';
    }
    if (state.selectionSource === 'fix-first') {
      return hasEvidence ? base + 'Opened from preset prioritization. Evidence is rendered in this panel to validate urgency and related workflow impact.' : base + 'Opened from preset prioritization. No direct issue messages are attached to this endpoint in the current lens.';
    }
    return hasEvidence ? base + 'Evidence is rendered in this panel so you can confirm why this endpoint is concerning and what to inspect next.' : base + 'No direct issue messages are attached to this endpoint in the current lens; related workflow context is rendered here when available.';
  }

  function buildEndpointFamilySummaries(rows, details) {
    var byFamily = {};
    rows.forEach(function (row) {
      if (!byFamily[row.family]) {
        byFamily[row.family] = {
          family: row.family,
          findings: 0,
          endpoints: 0,
          targetID: row.id,
          maxFindings: row.findings,
          burdenCounts: {},
          priorityCounts: { high: 0, medium: 0, low: 0 },
          dimensionCounts: {}
        };
      }
      var item = byFamily[row.family];
      item.findings += row.findings;
      item.endpoints += 1;
      item.priorityCounts[row.priority] = (item.priorityCounts[row.priority] || 0) + 1;
      if (row.findings > item.maxFindings) {
        item.targetID = row.id;
        item.maxFindings = row.findings;
      }
      (row.burdenFocuses || []).forEach(function (focus) {
        item.burdenCounts[focus] = (item.burdenCounts[focus] || 0) + (row.findings > 0 ? row.findings : 1);
      });
      var d = details[row.id];
      if (d && d.findings) {
        d.findings.forEach(function (f) {
          var dim = issueDimensionForFinding(f.code, f.category, f.burdenFocus);
          item.dimensionCounts[dim] = (item.dimensionCounts[dim] || 0) + 1;
        });
      }
    });

    var families = Object.values(byFamily).map(function (f) {
      var dominant = Object.entries(f.burdenCounts).sort(function (a, b) { return b[1] - a[1]; });
      f.dominantBurden = dominant.length > 0 ? dominant[0][0].replaceAll('-', ' ') : 'mixed evidence';
      var dims = Object.entries(f.dimensionCounts).sort(function (a, b) { return b[1] - a[1]; });
      f.topDimensions = dims.slice(0, 3).map(function (x) { return x[0]; });
      f.pressure = familyPressureLabel(f.priorityCounts);
      return f;
    });
    families.sort(function (a, b) {
      if (a.findings !== b.findings) return b.findings - a.findings;
      return a.family.localeCompare(b.family);
    });
    return families;
  }

  function issueDimensionForFinding(code, category, burdenFocus) {
    if (!code) return category ? category.replaceAll('-', ' ') : 'other issues';
    if (code === 'contract-shape-workflow-guidance-burden') return 'storage-shaped / snapshot-heavy responses';
    if (code === 'prerequisite-task-burden') return 'hidden dependencies / next-step linkage burden';
    if (code === 'weak-list-detail-linkage' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
      return 'weak workflow outcome modeling';
    }
    if (code === 'array-items-too-generic') return 'deep nesting';
    if (code === 'internal-incidental-field') return 'internal/incidental fields';
    if (code === 'sibling-path-shape-drift' || code === 'endpoint-path-style-drift' || code === 'detail-path-parameter-name-drift') return 'consistency drift';
    if (code === 'likely-missing-enum' || code === 'generic-object-request' || code === 'generic-object-response') return 'typing/enum weakness';
    if ((category || '') === 'change-risk') return 'change-risk clues';
    if ((burdenFocus || '') === 'workflow-burden') return 'hidden dependencies / next-step linkage burden';
    if ((burdenFocus || '') === 'contract-shape') return 'storage-shaped / snapshot-heavy responses';
    if ((burdenFocus || '') === 'consistency') return 'consistency drift';
    return (category || 'other issues').replaceAll('-', ' ');
  }

  function familyPressureLabel(priorityCounts) {
    var high = priorityCounts.high || 0;
    var medium = priorityCounts.medium || 0;
    if (high >= 3) return 'high';
    if (high > 0 || medium >= 3) return 'medium';
    return 'low';
  }

  function buildWorkflowKindSummaries(entries) {
    var byKind = {};
    entries.forEach(function (w) {
      var targetID = betterWorkflowTarget(w);
      if (!byKind[w.kind]) {
        byKind[w.kind] = { kind: w.kind, count: 0, example: w.fromLabel + ' -> ' + w.toLabel, score: w.score || '', targetID: targetID };
      }
      byKind[w.kind].count += 1;
      if (!byKind[w.kind].score && w.score) {
        byKind[w.kind].score = w.score;
      }
      if (endpointFindingCount(targetID) > endpointFindingCount(byKind[w.kind].targetID)) {
        byKind[w.kind].targetID = targetID;
      }
    });
    var kinds = Object.values(byKind);
    kinds.sort(function (a, b) {
      if (a.count !== b.count) return b.count - a.count;
      return a.kind.localeCompare(b.kind);
    });
    return kinds;
  }

  function priorityRank(p) {
    if (p === 'high') return 0;
    if (p === 'medium') return 1;
    return 2;
  }

  function endpointFindingCount(id) {
    if (!id) return -1;
    var detail = state.payload.endpointDetails[id];
    if (!detail || !detail.findings) return -1;
    return detail.findings.length;
  }

  function betterWorkflowTarget(entry) {
    if (!entry) return '';
    var fromCount = endpointFindingCount(entry.fromId);
    var toCount = endpointFindingCount(entry.toId);
    if (fromCount >= toCount) return entry.fromId || entry.toId || '';
    return entry.toId || entry.fromId || '';
  }

  function firstVisibleEndpointId(rows, options) {
    if (!rows || rows.length === 0) return '';
    var preferFindings = options && options.preferFindings;
    if (preferFindings) {
      var withFindings = rows.find(function (row) { return row.findings > 0; });
      if (withFindings) return withFindings.id;
    }
    return rows[0].id;
  }

  function focusSelectedRow() {
    if (!state.selectedEndpointId || !el.endpointRows) return;
    var row = el.endpointRows.querySelector('tr[data-id="' + state.selectedEndpointId + '"]');
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' });
  }

  function fixFirstRank(id) {
    var order = ['workflow-burden', 'contract-shape', 'consistency', 'families'];
    var idx = order.indexOf(id);
    return idx === -1 ? '•' : String(idx + 1);
  }

  function renderFixFirstContext() {
    if (!el.fixFirstContext) return;
    if (!state.fixFirstActiveId) { el.fixFirstContext.innerHTML = ''; return; }
    var item = state.payload.fixFirst.find(function (x) { return x.id === state.fixFirstActiveId; });
    if (!item) { el.fixFirstContext.innerHTML = ''; return; }
    var rows = filteredRows();
    var codeCounts = {};
    rows.slice(0, 20).forEach(function (r) {
      var d = state.payload.endpointDetails[r.id];
      if (!d) return;
      d.findings.forEach(function (f) { codeCounts[f.code] = (codeCounts[f.code] || 0) + 1; });
    });
    var topCode = Object.entries(codeCounts).sort(function (a, b) { return b[1] - a[1]; })[0];
    var hint = topCode ? findingExamineHint(topCode[0], '') : '';
    var patternLine = topCode
      ? '<p class="fix-context-pattern">Dominant rule code: <code class="finding-code">' + escapeHtml(topCode[0]) + '</code> (' + topCode[1] + ' case' + (topCode[1] === 1 ? '' : 's') + '). ' + escapeHtml(hint || 'Open endpoint detail to inspect exact messages.') + '</p>'
      : '';
    var top3 = rows.slice(0, 3).map(function (r) {
      var shortPath = r.path.split('/').slice(0, 4).join('/') + (r.path.split('/').length > 4 ? '…' : '');
      return '<span class="ctx-chip" data-id="' + r.id + '">' + escapeHtml(r.method) + ' ' + escapeHtml(shortPath) + (r.findings > 0 ? ' <span class="ctx-chip-count">· ' + r.findings + '</span>' : '') + '</span>';
    }).join('');
    el.fixFirstContext.innerHTML = '<div class="fix-context-inner">'
      + '<p class="fix-context-label">Preset applied: <strong>' + escapeHtml(item.label) + '</strong> (' + rows.length + ' endpoint' + (rows.length === 1 ? '' : 's') + ' in lens)</p>'
      + patternLine
      + (top3 ? '<p class="fix-context-top-label">Quick endpoint picks:</p><div class="ctx-chips">' + top3 + '</div>' : '')
      + '</div>';
    Array.prototype.forEach.call(el.fixFirstContext.querySelectorAll('.ctx-chip[data-id]'), function (chip) {
      chip.addEventListener('click', function () { jumpToEndpoint(chip.getAttribute('data-id')); });
    });
  }

  function findingExamineHint(code, message) {
    switch (code) {
      case 'weak-list-detail-linkage':
      case 'weak-follow-up-linkage': {
        var m = (message || '').match(/\(no ([^)]+)\)/);
        var props = m ? m[1] : 'an id or identifier field';
        return 'Add ' + props + ' to the response item schema so clients can form the next request without a separate lookup.';
      }
      case 'weak-action-follow-up-linkage':
        return 'Add a state field or resource ID to the action response so clients can confirm the outcome without issuing a follow-up GET.';
      case 'weak-accepted-tracking-linkage':
        return 'Add a tracking URL or task ID to the 202 Accepted body so clients can poll for completion without guessing the status endpoint.';
      case 'likely-missing-enum': {
        var m = (message || '').match(/property '([^']+)'/);
        var prop = m ? "'" + m[1] + "'" : 'this property';
        return 'Declare explicit enum values on ' + prop + ' so generated clients type-check valid values and version changes are tracked.';
      }
      case 'prerequisite-task-burden': {
        var m = (message || '').match(/requires (\d+) identifier/);
        var n = m ? m[1] : 'multiple';
        return 'This endpoint needs ' + n + ' identifier input' + (n === '1' ? '' : 's') + '. Consider pre-including them in a parent response to avoid multi-step pre-fetch chains.';
      }
      case 'contract-shape-workflow-guidance-burden':
        return 'Return a compact outcome response instead of a full snapshot. Include a status field or follow-up link so clients know what changed and what to call next.';
      case 'sibling-path-shape-drift':
        return 'Align path parameter naming and response structure with the other endpoints in this group to make the API surface predictable.';
      case 'generic-object-request':
        return 'Replace the generic object with concrete named properties in the request schema so clients know exactly what to send.';
      case 'generic-object-response':
        return 'Replace the generic object with concrete named properties in the response schema so clients know exactly what to expect back.';
      case 'deprecated-operation':
        return 'Do not use this endpoint for new integrations. Locate the recommended replacement and migrate existing callers.';
      default:
        return '';
    }
  }

  function findingWorkflowContext(endpointId, code, relatedWorkflows) {
    if (!relatedWorkflows || relatedWorkflows.length === 0) return '';
    var linkageCodes = { 'weak-list-detail-linkage': true, 'weak-follow-up-linkage': true, 'weak-action-follow-up-linkage': true, 'weak-accepted-tracking-linkage': true };
    if (!linkageCodes[code]) return '';
    var asSource = relatedWorkflows.filter(function (w) { return w.fromId === endpointId; });
    if (asSource.length === 0) return '';
    var kindNames = uniq(asSource.map(function (w) { return w.kind.replaceAll('-', '\u00a0\u2192\u00a0'); })).slice(0, 2).join(', ');
    return '<p class="finding-workflow-ctx">This endpoint is the <strong>source</strong> in ' + asSource.length + ' inferred step-pair' + (asSource.length === 1 ? '' : 's') + ' (' + kindNames + '). The downstream target expects a linkage value this response does not currently expose.</p>';
  }

  function buildFamilyWorkflowPatterns(entries, details) {
    var familyKinds = {};
    entries.forEach(function (e) {
      var d = details[e.fromId];
      if (!d) return;
      var fam = d.endpoint.family;
      if (!familyKinds[fam]) familyKinds[fam] = {};
      familyKinds[fam][e.kind] = (familyKinds[fam][e.kind] || 0) + 1;
    });
    var result = {};
    Object.keys(familyKinds).forEach(function (fam) {
      var kinds = Object.entries(familyKinds[fam]).sort(function (a, b) { return b[1] - a[1]; });
      result[fam] = kinds.length > 0 ? kinds[0][0] : null;
    });
    return result;
  }

  function workflowKindShort(kind) {
    switch (kind) {
      case 'create-to-detail': return 'create \u2192 detail';
      case 'list-to-detail': return 'list \u2192 detail';
      case 'action-to-detail': return 'action \u2192 detail';
      case 'list-to-detail-to-update': return 'list \u2192 detail \u2192 update';
      default: return kind.replaceAll('-', ' \u2192 ');
    }
  }

  function dominantBurdenCode(rows) {
    if (!rows || rows.length === 0) return '';
    var counts = {};
    rows.forEach(function (row) {
      (row.burdenFocuses || []).forEach(function (focus) {
        counts[focus] = (counts[focus] || 0) + (row.findings > 0 ? row.findings : 1);
      });
    });
    var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    return ranked.length > 0 ? ranked[0][0] : '';
  }

  function burdenLabel(code) {
    switch (code) {
      case 'workflow-burden': return 'Hidden next-step dependencies';
      case 'contract-shape': return 'Storage-shaped / snapshot-heavy responses';
      case 'consistency': return 'Consistency drift';
      default: return code ? code.replaceAll('-', ' ') : 'Mixed signals';
    }
  }

  function burdenDescription(code) {
    switch (code) {
      case 'workflow-burden': return 'Many issues indicate missing next-step linkage: responses do not expose the ID/state clients need for the next call.';
      case 'contract-shape': return 'Many issues indicate write responses mirror storage snapshots instead of outcome-focused payloads, forcing follow-up calls.';
      case 'consistency': return 'Most findings flag naming or shape drift across related paths: path parameters, response structures, or operation names are inconsistent.';
      default: return 'Findings are distributed across multiple burden types. Use the fix-first priorities below to decide where to focus.';
    }
  }

  function fixFirstMeaning(id) {
    switch (id) {
      case 'workflow-burden': return 'Clients cannot reliably chain operations: the spec does not surface the ID or state needed to call the next endpoint in a two-step flow.';
      case 'contract-shape': return 'After a write, the response does not confirm the outcome \u2014 clients must issue a separate GET to confirm what actually changed.';
      case 'consistency': return 'Naming or shape drift across similar routes makes the API harder to learn and predict without reading every endpoint individually.';
      case 'families': return 'These families have the highest finding density. Fixing the most-concentrated family typically has the broadest impact per hour of review.';
      default: return '';
    }
  }

  function workflowKindLabel(kind) {
    switch (kind) {
      case 'create-to-detail': return 'POST creates a resource; GET by ID retrieves it. The create response should expose the new resource\u2019s ID.';
      case 'list-to-detail': return 'GET list and GET by ID are linked \u2014 the list response must include the ID the detail endpoint expects.';
      case 'action-to-detail': return 'POST action transitions state; GET by ID confirms the result. The action response should surface the new state.';
      case 'list-to-detail-to-update': return '3-step chain: list \u2192 detail \u2192 update. Each step depends on an ID or state value exposed by the previous response.';
      default: return kind.replaceAll('-', ' \u2192 ');
    }
  }
  function dominantBurdenFocus(rows) {
    if (!rows || rows.length === 0) return 'n/a';
    var counts = {};
    rows.forEach(function (row) {
      var focuses = row.burdenFocuses || [];
      if (focuses.length === 0) return;
      focuses.forEach(function (focus) {
        counts[focus] = (counts[focus] || 0) + (row.findings > 0 ? row.findings : 1);
      });
    });
    var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    if (ranked.length === 0) return 'no clear burden focus yet';
    return ranked[0][0].replaceAll('-', ' ') + ' (' + ranked[0][1] + ')';
  }

  function topFamilyByFindings(rows) {
    if (!rows || rows.length === 0) return { name: 'none', findings: 0, note: 'No family evidence detected in this run.' };
    var counts = {};
    rows.forEach(function (row) {
      counts[row.family] = (counts[row.family] || 0) + row.findings;
    });
    var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    if (ranked.length === 0) return { name: 'none', findings: 0, note: 'No family evidence detected in this run.' };
    var familyName = ranked[0][0];
    var findingCount = ranked[0][1];
    return {
      name: familyName,
      findings: findingCount,
      note: humanFamilyLabel(familyName) + ' has the highest issue density (' + findingCount + ' issues across endpoints in this family).'
    };
  }

  function humanFamilyLabel(name) {
    if (!name) return 'unlabeled family';
    if (name === '/aggregate') {
      return '/aggregate (cross-resource utility endpoints, not one business entity)';
    }
    return name;
  }

  function topWorkflowFamily(workflows) {
    var entries = Object.entries((workflows && workflows.familyCounts) || {}).sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length === 0) return 'none';
    return entries[0][0] + ' (' + entries[0][1] + ')';
  }

  function formatLensSuffix(filters) {
    var bits = [];
    if (filters.search) bits.push('search="' + filters.search + '"');
    if (filters.severity !== 'all') bits.push('severity=' + filters.severity);
    if (filters.category !== 'all') bits.push('category=' + filters.category);
    if (filters.burden !== 'all') bits.push('burden=' + filters.burden);
    if (filters.findingsOnly) bits.push('findings-only');
    if (bits.length === 0) return ': all endpoints';
    return ': ' + bits.join(', ');
  }

  function rowProblemSummary(row) {
    var categories = Object.entries(row.categoryCounts || {}).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    if (categories.length === 0) return 'no issues in this scope';
    var primaryCategory = categories[0][0].replaceAll('-', ' ');
    var burden = (row.burdenFocuses || []).length > 0 ? row.burdenFocuses[0].replaceAll('-', ' ') : 'mixed';
    return primaryCategory + ' / ' + burden;
  }

  function rowDominantIssue(row) {
    var d = state.payload.endpointDetails[row.id];
    if (!d || !d.findings || d.findings.length === 0) {
      return { label: 'No direct issue evidence', code: 'n/a' };
    }
    var first = d.findings[0];
    return {
      label: issueDimensionForFinding(first.code, first.category, first.burdenFocus),
      code: first.code
    };
  }

  function inspectionPressureLabel(row) {
    if (!row) return 'Inspection signal';
    if (row.priority === 'high') {
      return row.findings >= 10 ? 'High pressure (inspect early)' : 'High pressure';
    }
    if (row.priority === 'medium') {
      return 'Moderate pressure';
    }
    return row.findings > 0 ? 'Lower pressure' : 'No direct pressure';
  }

  function endpointInvestigationSummary(detail) {
    var findings = detail.findings || [];
    var endpoint = detail.endpoint || {};
    if (findings.length === 0) {
      return {
        why: 'No direct contract issues are flagged here, but this endpoint may still matter through family context or workflow chains.',
        next: 'Review the related workflow paths and endpoint families below to understand upstream or downstream impact.'
      };
    }

    var byCategory = {};
    var byBurden = {};
    findings.forEach(function (f) {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      if (f.burdenFocus) {
        byBurden[f.burdenFocus] = (byBurden[f.burdenFocus] || 0) + 1;
      }
    });

    var topCategory = Object.entries(byCategory).sort(function (a, b) { return b[1] - a[1]; })[0];
    var topBurden = Object.entries(byBurden).sort(function (a, b) { return b[1] - a[1]; })[0];
    var topCode = findings[0].code;

    var why = 'Pressure is ' + endpoint.priority + ' because this endpoint has ' + findings.length + ' issue' + (findings.length === 1 ? '' : 's') + ', mainly in ' + topCategory[0].replaceAll('-', ' ') + ' (' + topCategory[1] + ')';
    if (topBurden) {
      why += '. Most concern is ' + topBurden[0].replaceAll('-', ' ') + '.';
    } else {
      why += '.';
    }

    var next = 'Expand the first finding code "' + topCode + '" to see a specific recommendation, then check related workflow paths below.';
    if ((detail.relatedChains || []).length > 0) {
      next += ' Related endpoint families are also listed.';
    }

    return { why: why, next: next };
  }

  function summarizeIssueDimensions(findings) {
    var counts = {};
    findings.forEach(function (f) {
      var label = issueDimensionForFinding(f.code, f.category, f.burdenFocus);
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 6)
      .map(function (x) { return { label: x[0], count: x[1] }; });
  }

  function uniq(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function flatMap(items, fn) {
    return items.reduce(function (acc, item) { return acc.concat(fn(item)); }, []);
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
})();
