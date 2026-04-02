(function () {
  var state = {
    payload: null,
    selectedEndpointId: "",
    selectionSource: "default",
    filters: { search: "", severity: "all", category: "all", burden: "all", findingsOnly: false, sortBy: "priority" }
  };

  var el = {
    runContext: document.getElementById("runContext"),
    summaryHelp: document.getElementById("summaryHelp"),
    summaryCards: document.getElementById("summaryCards"),
    fixFirstHelp: document.getElementById("fixFirstHelp"),
    fixFirstList: document.getElementById("fixFirstList"),
    searchInput: document.getElementById("searchInput"),
    severityFilter: document.getElementById("severityFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    burdenFilter: document.getElementById("burdenFilter"),
    hasFindingsOnly: document.getElementById("hasFindingsOnly"),
    sortBy: document.getElementById("sortBy"),
    endpointRows: document.getElementById("endpointRows"),
    evidenceListHelp: document.getElementById("evidenceListHelp"),
    evidenceScope: document.getElementById("evidenceScope"),
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
    var trustPressure = s.endpointsAnalyzed === 0 ? "n/a" : (s.endpointsWithIssue + " of " + s.endpointsAnalyzed + " endpoints need trust review");
    var rows = state.payload.endpoints || [];
    var highPriorityCount = rows.filter(function (r) { return r.priority === "high"; }).length;
    var topFamily = topFamilyByFindings(rows);
    var topWorkflowKind = topWorkflowFamily(state.payload.workflows || {});
    var burdenSummary = dominantBurdenFocus(rows);
    var cards = [
      { label: "Contract trust pressure", value: trustPressure, meta: "Endpoints currently carrying direct burden, contract-shape, consistency, or change-risk evidence.", tone: "tone-trust" },
      { label: "Workflow burden concentration", value: burdenSummary, meta: "Dominant burden focus across evidence-bearing endpoints in the current run.", tone: "tone-workflow" },
      { label: "Fix-first load", value: String(s.totalFindings) + " findings", meta: highPriorityCount + " high-priority endpoints currently rise to the top of the queue.", tone: "tone-fix" },
      { label: "Family concentration", value: topFamily, meta: "Highest-density endpoint family based on current finding distribution.", tone: "tone-family" },
      { label: "Severity split", value: "E " + (s.severityCounts.error || 0) + " / W " + (s.severityCounts.warning || 0) + " / I " + (s.severityCounts.info || 0), meta: "Current analysis mix across error, warning, and informational signals.", tone: "tone-trust" },
      { label: "Workflow coverage", value: s.workflowsInferred + " paths / " + s.chainsInferred + " chains", meta: "Spec-derived handoffs and larger chains inferred from the current contract.", tone: "tone-workflow" },
      { label: "Dominant workflow kind", value: topWorkflowKind, meta: "Most common inferred path type, useful for deciding where to inspect first.", tone: "tone-family" },
      { label: "Endpoints in scope", value: String(s.endpointsAnalyzed), meta: "Total endpoints analyzed from the current spec payload.", tone: "tone-fix" }
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
      return '<button class="fix-item" data-id="' + item.id + '"><span class="fix-rank">' + rank + '</span><span class="fix-copy"><strong>' + item.label + '</strong><span class="fix-value">' + item.value + '</span><span>' + item.description + '</span></span></button>';
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
        el.searchInput.value = state.filters.search;
        el.severityFilter.value = state.filters.severity;
        el.categoryFilter.value = state.filters.category;
        el.burdenFilter.value = state.filters.burden;
        state.selectionSource = "fix-first";
        render();
      });
    });
  }

  function renderEndpointRows() {
    var rows = filteredRows();
    if (el.evidenceScope) {
      el.evidenceScope.textContent = rows.length + ' endpoints match current lens' + formatLensSuffix(state.filters) + '.';
    }
    if (rows.length > 0 && !rows.find(function (r) { return r.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = rows[0].id;
    }
    if (rows.length === 0) {
      el.endpointRows.innerHTML = '<tr><td colspan="4" class="subtle">No endpoints match this lens. Clear one filter to widen investigation scope.</td></tr>';
      return;
    }
    el.endpointRows.innerHTML = rows.map(function (row) {
      var selected = row.id === state.selectedEndpointId ? 'active' : '';
      return '<tr class="' + selected + '" data-id="' + row.id + '"><td><div class="endpoint-main"><strong>' + row.method + ' ' + row.path + '</strong><div class="endpoint-sub"><span class="endpoint-chip">' + row.family + '</span><span class="subtle">' + rowProblemSummary(row) + '</span></div></div></td><td><span class="findings-count">' + row.findings + '</span></td><td><span class="badge ' + row.priority + '">' + row.priority + '</span></td><td><span class="risk-copy">' + row.riskSummary + '</span></td></tr>';
    }).join('');

    Array.prototype.forEach.call(el.endpointRows.querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () {
        state.selectedEndpointId = tr.getAttribute('data-id');
        state.selectionSource = 'endpoint-list';
        renderEndpointRows();
        renderEndpointDetail();
      });
    });
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
    var detail = state.payload.endpointDetails[state.selectedEndpointId];
    if (!detail) {
      el.endpointDetail.innerHTML = "<div class='empty-state'><p class='subtle'>Select an endpoint to inspect contract/workflow evidence and related paths.</p></div>";
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
      findings += "<ul>" + detail.findings.map(function (f) {
        return '<li><strong>' + f.severity.toUpperCase() + '</strong> ' + f.code + '<br>' + escapeHtml(f.impact) + '</li>';
      }).join('') + "</ul>";
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

    el.endpointDetail.innerHTML = '<div class="detail-header"><div class="detail-title"><span class="eyebrow">Selected endpoint</span><span class="detail-path">' + detail.endpoint.method + ' ' + detail.endpoint.path + '</span></div><div class="detail-meta"><span class="badge ' + detail.endpoint.priority + '">' + detail.endpoint.priority + '</span><span class="endpoint-chip">' + detail.endpoint.family + '</span><span class="risk-copy">' + detail.endpoint.riskSummary + '</span></div><div class="detail-context">' + escapeHtml(detailContextText()) + '</div></div><div class="investigation-summary"><h3>Why this needs attention</h3><p>' + escapeHtml(summary.why) + '</p><p class="subtle">Inspect next: ' + escapeHtml(summary.next) + '</p></div>' + findings + workflows + chains + diffs;
  }

  function renderWorkflowPanel() {
    var wf = state.payload.workflows;
    var endpointFamilies = buildEndpointFamilySummaries(state.payload.endpoints || []);
    var kindSummaries = buildWorkflowKindSummaries(wf.entries || []);

    if (el.workflowHelp) {
      if (endpointFamilies.length > 0 || kindSummaries.length > 0) {
        var topFamily = endpointFamilies.length > 0 ? endpointFamilies[0].family : 'n/a';
        var topKind = kindSummaries.length > 0 ? kindSummaries[0].kind : 'n/a';
        el.workflowHelp.textContent = 'Start with family ' + topFamily + ' and workflow kind ' + topKind + '. Click a row below to open representative endpoint evidence.';
      } else {
        el.workflowHelp.textContent = 'No workflow/family concentration evidence is available in this run.';
      }
    }

    var families = endpointFamilies.slice(0, 8).map(function (f, idx) {
      var prefix = idx === 0 ? 'Start here - ' : '';
      return '<li class="workflow-click" data-id="' + (f.targetID || '') + '"><strong>' + prefix + f.family + '</strong><br>' + f.findings + ' findings across ' + f.endpoints + ' endpoints | dominant burden: ' + f.dominantBurden + '</li>';
    }).join('');

    var paths = kindSummaries.slice(0, 8).map(function (k, idx) {
      var prefix = idx === 0 ? 'Start here - ' : '';
      return '<li class="workflow-click" data-id="' + (k.targetID || '') + '"><strong>' + prefix + k.kind + '</strong>: ' + k.count + ' paths<br>' + k.example + (k.score ? (' (' + k.score + ')') : '') + '</li>';
    }).join('');

    var reps = (wf.chains || []).slice(0, 6).map(function (c) {
      var id = c.endpointIds[0] || '';
      return '<li class="workflow-click" data-id="' + id + '"><strong>' + c.kind + '</strong><br>' + escapeHtml(c.summary) + '</li>';
    }).join('');

    el.workflowPanel.innerHTML = '<div class="workflow-sections"><section class="workflow-group"><h3>Family summaries (by findings)</h3><ul id="familyList">' + (families || "<li class='subtle'>No family summaries in this run.</li>") + '</ul></section><section class="workflow-group"><h3>Workflow path summaries (by kind)</h3><ul id="workflowKindList">' + (paths || "<li class='subtle'>No workflow paths.</li>") + '</ul></section><section class="workflow-group"><h3>Representative chains (click to jump)</h3><ul id="chainList">' + (reps || "<li class='subtle'>No chains.</li>") + '</ul></section></div>';

    ['familyList', 'workflowKindList', 'chainList'].forEach(function (listID) {
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
    state.selectedEndpointId = id;
    state.selectionSource = 'family-workflow';
    renderEndpointRows();
    renderEndpointDetail();
  }

  function detailContextText() {
    var base = 'Current lens' + formatLensSuffix(state.filters) + '. ';
    if (state.selectionSource === 'family-workflow') {
      return base + 'Opened from family/workflow context. Use evidence below to confirm why this endpoint is concerning and what to inspect next.';
    }
    if (state.selectionSource === 'fix-first') {
      return base + 'Opened from fix-first prioritization. Use evidence below to validate urgency and related workflow impact.';
    }
    return base + 'Use evidence below to confirm why this endpoint is concerning and what to inspect next.';
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
      if (!byKind[w.kind]) {
        byKind[w.kind] = { kind: w.kind, count: 0, example: w.fromLabel + ' -> ' + w.toLabel, score: w.score || '', targetID: w.fromId || w.toId || '' };
      }
      byKind[w.kind].count += 1;
      if (!byKind[w.kind].score && w.score) {
        byKind[w.kind].score = w.score;
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

  function fixFirstRank(id) {
    var order = ['workflow-burden', 'contract-shape', 'consistency', 'families'];
    var idx = order.indexOf(id);
    return idx === -1 ? '•' : String(idx + 1);
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
