(function () {
  var state = {
    payload: null,
    selectedEndpointId: "",
    selectionSource: "default",
    selectedFindingIdx: -1,
    fixFirstActiveId: null,
    filters: { search: "", severity: "all", category: "all", burden: "all", findingsOnly: false, sortBy: "priority" }
  };

  var el = {
    runContext: document.getElementById("runContext"),
    summaryHelp: document.getElementById("summaryHelp"),
    summaryCards: document.getElementById("summaryCards"),
    fixFirstHelp: document.getElementById("fixFirstHelp"),
    fixFirstList: document.getElementById("fixFirstList"),
      fixFirstContext: document.getElementById("fixFirstContext"),
    searchInput: document.getElementById("searchInput"),
    severityFilter: document.getElementById("severityFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    burdenFilter: document.getElementById("burdenFilter"),
    hasFindingsOnly: document.getElementById("hasFindingsOnly"),
    sortBy: document.getElementById("sortBy"),
    endpointRows: document.getElementById("endpointRows"),
    evidenceScope: document.getElementById("evidenceScope"),
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
  }

  function syncControls() {
    el.searchInput.value = state.filters.search;
    el.severityFilter.value = state.filters.severity;
    el.categoryFilter.value = state.filters.category;
    el.burdenFilter.value = state.filters.burden;
    el.hasFindingsOnly.checked = state.filters.findingsOnly;
    el.sortBy.value = state.filters.sortBy;
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
      { value: "workflow-burden", label: "burden focus: workflow burden" },
      { value: "contract-shape", label: "burden focus: contract shape" },
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
      el.summaryHelp.textContent = 'Trust the contract where evidence is clear, prioritize burden where workflows are hard, and drill into endpoint-level proof.';
    }
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
        label: "Where to start",
        value: topFamily,
        meta: pct + "% of " + s.endpointsAnalyzed + " endpoints (" + withFindings + ") carry at least one finding. This family has the highest burden concentration.",
        tone: "tone-trust"
      },
      {
        label: "Primary burden type",
        value: burdenLabel(burdenCode),
        meta: burdenDescription(burdenCode),
        tone: "tone-workflow"
      },
      {
        label: "Highest-pressure endpoints",
        value: highPriorityCount + (highPriorityCount === 1 ? " endpoint" : " endpoints"),
        meta: "Rise to the top based on low schema or client scores combined with multiple findings (" + s.totalFindings + " signals total across all endpoints). Use the fix-first priorities below to decide where to start.",
        tone: "tone-fix"
      },
      {
        label: "Spec-inferred workflows",
        value: s.workflowsInferred + " step-pairs \u00b7 " + s.chainsInferred + " chains",
        meta: "Inferred from path shapes and ID patterns \u2014 not from live API behavior. Dominant handoff type: " + topWorkflowKind + ".",
        tone: "tone-family"
      }
    ];
    el.summaryCards.innerHTML = cards.map(function (card) {
      return '<article class="card ' + card.tone + '"><p class="card-label">' + card.label + '</p><p class="card-value">' + card.value + '</p><p class="card-meta">' + card.meta + '</p></article>';
    }).join("");
  }

  function renderFixFirst() {
    var rows = state.payload.endpoints || [];
    var topFamily = topFamilyByFindings(rows);
    var topWorkflowKind = topWorkflowFamily(state.payload.workflows || {});
    if (el.fixFirstHelp) {
      el.fixFirstHelp.textContent = 'Use these priorities first, then verify endpoint-level evidence. Current concentration: ' + topFamily + '. Dominant workflow kind: ' + topWorkflowKind + '.';
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
    if (el.rankingCue) {
      if (state.filters.sortBy === 'priority') {
        el.rankingCue.textContent = 'Default order uses inspection priority first, then findings count. Score is shown as supporting context.';
      } else if (state.filters.sortBy === 'findings') {
        el.rankingCue.textContent = 'Sorted by findings count. Priority and score remain supporting context for triage.';
      } else {
        el.rankingCue.textContent = 'Sorted alphabetically by path. Use findings/priority to assess inspection urgency.';
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
      return '<tr class="' + selected + '" data-id="' + row.id + '"><td><div class="endpoint-main"><strong>' + row.method + ' ' + row.path + '</strong><div class="endpoint-sub"><span class="endpoint-chip">' + row.family + '</span><span class="subtle">' + rowProblemSummary(row) + '</span></div></div></td><td><span class="findings-count">' + row.findings + '</span></td><td><span class="badge ' + row.priority + '">' + row.priority + '</span></td><td><div class="rank-cell"><span class="rank-main">' + pressure + '</span><span class="rank-sub">' + row.findings + ' finding' + (row.findings === 1 ? '' : 's') + ' on this endpoint</span><span class="rank-score">Score: ' + row.riskSummary + '</span></div></td></tr>';
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
      el.endpointDetail.innerHTML = "<div class='empty-state'><strong>No endpoint detail in this lens.</strong><p class='subtle'>Clear one or more filters to restore endpoint evidence and inspection detail.</p></div>";
      return;
    }

    var detail = state.payload.endpointDetails[state.selectedEndpointId];
    if (!detail || !visibleRows.find(function (row) { return row.id === state.selectedEndpointId; })) {
      if (el.detailHelp) {
        el.detailHelp.textContent = 'Select an endpoint from the visible evidence list to inspect its detail.';
      }
      el.endpointDetail.innerHTML = "<div class='empty-state'><strong>Select an endpoint.</strong><p class='subtle'>Pick a row from the visible evidence list to inspect contract, workflow, and change-risk detail here.</p></div>";
      return;
    }

    if (el.detailHelp) {
      el.detailHelp.textContent = detailContextText();
    }

    var summary = endpointInvestigationSummary(detail);

    var findings = "<h3>Contract and workflow evidence</h3>";
    if (detail.findings.length === 0) {
      findings += "<p class='subtle'>No findings on this endpoint in the current spec-derived slice.</p>";
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
      return '<li>' + w.kind + ': ' + w.fromLabel + ' -> ' + w.toLabel + (w.score ? (' (' + w.score + ')') : '') + '</li>';
    }).join('') + '</ul>' : '';

    var chains = detail.relatedChains.length ? '<h3>Related family chains</h3><ul>' + detail.relatedChains.slice(0, 4).map(function (c) {
      return '<li>' + c.kind + ': ' + c.summary + (c.score ? (' (' + c.score + ')') : '') + '</li>';
    }).join('') + '</ul>' : '';

    var diffs = detail.relatedDiff.length ? '<h3>Related change-risk evidence</h3><ul>' + detail.relatedDiff.slice(0, 5).map(function (d) {
      return '<li>' + d.code + ': ' + escapeHtml(d.message) + '</li>';
    }).join('') + '</ul>' : '';

    el.endpointDetail.innerHTML = '<div class="detail-header"><div class="detail-title"><span class="eyebrow">Selected endpoint</span><span class="detail-path">' + detail.endpoint.method + ' ' + detail.endpoint.path + '</span></div><div class="detail-meta"><span class="badge ' + detail.endpoint.priority + '">' + detail.endpoint.priority + '</span><span class="endpoint-chip">' + detail.endpoint.family + '</span><span class="risk-copy">' + detail.endpoint.riskSummary + '</span></div><div class="detail-context">' + escapeHtml(detailContextText(detail)) + '</div></div><div class="investigation-summary"><h3>Why this needs attention</h3><p>' + escapeHtml(summary.why) + '</p><p class="subtle">Inspect next: ' + escapeHtml(summary.next) + '</p></div>' + findings + workflows + chains + diffs;

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
    var endpointFamilies = buildEndpointFamilySummaries(state.payload.endpoints || []);
    var kindSummaries = buildWorkflowKindSummaries(wf.entries || []);
    var familyPatterns = buildFamilyWorkflowPatterns(wf.entries || [], state.payload.endpointDetails || {});

    if (el.workflowHelp) {
      if (endpointFamilies.length > 0) {
        el.workflowHelp.textContent = 'Each row answers: where is burden concentrated, and what multi-step pattern is involved? Click any row to jump to its highest-evidence endpoint.';
      } else {
        el.workflowHelp.textContent = 'No workflow/family concentration evidence is available in this run.';
      }
    }

    var families = endpointFamilies.slice(0, 10).map(function (f, idx) {
      var prefix = idx === 0 ? 'Most findings \u2014 ' : '';
      var pattern = familyPatterns[f.family];
      var patternTag = pattern ? ' <span class="family-pattern">' + workflowKindShort(pattern) + '</span>' : '';
      return '<li class="workflow-click" data-id="' + (f.targetID || '') + '">'
        + '<div class="family-row-head"><strong>' + prefix + f.family + '</strong>' + patternTag + '</div>'
        + '<span class="subtle">' + f.findings + ' finding' + (f.findings === 1 ? '' : 's') + ' across ' + f.endpoints + ' endpoint' + (f.endpoints === 1 ? '' : 's') + ' \u00b7 ' + f.dominantBurden + ' burden</span>'
        + '</li>';
    }).join('');

    var paths = kindSummaries.slice(0, 6).map(function (k) {
      var kindDesc = workflowKindLabel(k.kind);
      return '<li class="workflow-click" data-id="' + (k.targetID || '') + '">'
        + '<strong>' + k.kind.replaceAll('-', ' \u2192 ') + '</strong>: ' + k.count + ' instance' + (k.count === 1 ? '' : 's')
        + '<br><span class="subtle">' + kindDesc + '</span>'
        + '</li>';
    }).join('');

    el.workflowPanel.innerHTML = '<div class="workflow-sections">'
      + '<section class="workflow-group"><h3>Where burden concentrates</h3>'
      + '<ul id="familyList">' + (families || "<li class='subtle'>No family summaries in this run.</li>") + '</ul>'
      + '</section>'
      + '<section class="workflow-group"><h3>Detected multi-step patterns</h3>'
      + '<p class="workflow-caveat subtle">Inferred from path shapes \u2014 not live API behavior.</p>'
      + '<ul id="workflowKindList">' + (paths || "<li class='subtle'>No workflow patterns detected.</li>") + '</ul>'
      + '</section>'
      + '</div>';

    ['familyList', 'workflowKindList'].forEach(function (listID) {
      var list = document.getElementById(listID);
      if (!list) return;
      Array.prototype.forEach.call(list.querySelectorAll('li[data-id]'), function (li) {
        li.addEventListener('click', function () {
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
      return hasEvidence ? base + 'Opened from family/workflow context. Evidence is rendered in this panel so you can confirm why this endpoint is concerning and what to inspect next.' : base + 'Opened from family/workflow context. This endpoint has no direct findings in the current lens, so use related workflow and family context rendered here.';
    }
    if (state.selectionSource === 'fix-first') {
      return hasEvidence ? base + 'Opened from fix-first prioritization. Evidence is rendered in this panel to validate urgency and related workflow impact.' : base + 'Opened from fix-first prioritization. No direct findings are attached to this endpoint in the current lens.';
    }
    return hasEvidence ? base + 'Evidence is rendered in this panel so you can confirm why this endpoint is concerning and what to inspect next.' : base + 'No direct findings are attached to this endpoint in the current lens; related workflow context is rendered here when available.';
  }

  function buildEndpointFamilySummaries(rows) {
    var byFamily = {};
    rows.forEach(function (row) {
      if (!byFamily[row.family]) {
        byFamily[row.family] = { family: row.family, findings: 0, endpoints: 0, targetID: row.id, maxFindings: row.findings, burdenCounts: {} };
      }
      var item = byFamily[row.family];
      item.findings += row.findings;
      item.endpoints += 1;
      if (row.findings > item.maxFindings) {
        item.targetID = row.id;
        item.maxFindings = row.findings;
      }
      (row.burdenFocuses || []).forEach(function (focus) {
        item.burdenCounts[focus] = (item.burdenCounts[focus] || 0) + (row.findings > 0 ? row.findings : 1);
      });
    });

    var families = Object.values(byFamily).map(function (f) {
      var dominant = Object.entries(f.burdenCounts).sort(function (a, b) { return b[1] - a[1]; });
      f.dominantBurden = dominant.length > 0 ? dominant[0][0].replaceAll('-', ' ') : 'mixed evidence';
      return f;
    });
    families.sort(function (a, b) {
      if (a.findings !== b.findings) return b.findings - a.findings;
      return a.family.localeCompare(b.family);
    });
    return families;
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
      ? '<p class="fix-context-pattern">Most common: <code class="finding-code">' + escapeHtml(topCode[0]) + '</code> \u2014 ' + topCode[1] + ' instance' + (topCode[1] === 1 ? '' : 's') + (hint ? '. ' + escapeHtml(hint) : '') + '</p>'
      : '';
    var top3 = rows.slice(0, 3).map(function (r) {
      var shortPath = r.path.split('/').slice(0, 4).join('/') + (r.path.split('/').length > 4 ? '\u2026' : '');
      return '<span class="ctx-chip" data-id="' + r.id + '">' + escapeHtml(r.method) + ' ' + escapeHtml(shortPath) + (r.findings > 0 ? ' <span class="ctx-chip-count">\u00b7\u202f' + r.findings + '</span>' : '') + '</span>';
    }).join('');
    el.fixFirstContext.innerHTML = '<div class="fix-context-inner">'
      + '<p class="fix-context-label">Investigating <strong>' + escapeHtml(item.label) + '</strong> \u2014 ' + rows.length + ' endpoint' + (rows.length === 1 ? '' : 's') + ' in this lens</p>'
      + patternLine
      + (top3 ? '<p class="fix-context-top-label">Jump to:</p><div class="ctx-chips">' + top3 + '</div>' : '')
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
      case 'workflow-burden': return 'Workflow linkage burden';
      case 'contract-shape': return 'Contract-shape burden';
      case 'consistency': return 'Consistency drift';
      default: return code ? code.replaceAll('-', ' ') : 'Mixed signals';
    }
  }

  function burdenDescription(code) {
    switch (code) {
      case 'workflow-burden': return 'Most findings flag missing next-step linkage: the spec does not expose the ID or state a client needs to call the next endpoint in a two-step flow.';
      case 'contract-shape': return 'Most findings flag write operations that return snapshot data instead of task outcomes: clients cannot confirm what changed without issuing a follow-up GET.';
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
    if (!rows || rows.length === 0) return 'none';
    var counts = {};
    rows.forEach(function (row) {
      counts[row.family] = (counts[row.family] || 0) + row.findings;
    });
    var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    if (ranked.length === 0) return 'none';
    return ranked[0][0] + ' (' + ranked[0][1] + ' findings)';
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
    if (categories.length === 0) return 'no findings in this scope';
    var primaryCategory = categories[0][0].replaceAll('-', ' ');
    var burden = (row.burdenFocuses || []).length > 0 ? row.burdenFocuses[0].replaceAll('-', ' ') : 'mixed';
    return primaryCategory + ' / ' + burden;
  }

  function inspectionPressureLabel(row) {
    if (!row) return 'Inspection signal';
    if (row.priority === 'high') {
      return row.findings >= 10 ? 'High pressure (top queue)' : 'High pressure';
    }
    if (row.priority === 'medium') {
      return 'Moderate pressure';
    }
    return row.findings > 0 ? 'Lower pressure' : 'No direct pressure';
  }

  function endpointInvestigationSummary(detail) {
    var findings = detail.findings || [];
    if (findings.length === 0) {
      return {
        why: 'No direct findings are attached in the current slice; this endpoint may still matter through family/workflow context.',
        next: 'Review related workflow paths and family chains for upstream or downstream burden.'
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

    var why = 'Most evidence here is ' + topCategory[0].replaceAll('-', ' ') + ' (' + topCategory[1] + ' finding' + (topCategory[1] === 1 ? '' : 's') + ')';
    if (topBurden) {
      why += ', with emphasis on ' + topBurden[0].replaceAll('-', ' ') + '.';
    } else {
      why += '.';
    }

    var next = 'Start with finding code ' + topCode + ', then check related workflow paths';
    if ((detail.relatedChains || []).length > 0) {
      next += ' and family chains';
    }
    if ((detail.relatedDiff || []).length > 0) {
      next += ', then review related change-risk entries';
    }
    next += '.';

    return { why: why, next: next };
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
