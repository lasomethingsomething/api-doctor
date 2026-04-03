(function () {
  var state = {
    payload: null,
    selectedEndpointId: "",
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
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    burdenFilter: document.getElementById("burdenFilter"),
    familyPriorityFilter: document.getElementById("familyPriorityFilter"),
    includeNoIssueRows: document.getElementById("includeNoIssueRows"),
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
      render();
    });
    el.burdenFilter.addEventListener("change", function (e) {
      state.filters.burden = e.target.value;
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

  function renderFilterOptions() {
    setOptions(el.categoryFilter, [{ value: "all", label: "all categories" }].concat(
      uniq(flatMap(state.payload.endpoints, function (row) {
        return Object.keys(row.categoryCounts || {});
      })).sort().map(function (c) {
        return { value: c, label: c.replaceAll("-", " ") };
      })
    ));

    setOptions(el.burdenFilter, [
      { value: "all", label: "all burdens" },
      { value: "workflow-burden", label: "hidden dependency / linkage burden" },
      { value: "contract-shape", label: "shape / storage-style burden" },
      { value: "consistency", label: "consistency burden" }
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
    renderHeader();
    renderQuickActions();
    syncControls();
    renderFamilySurface();
    renderWorkflowChains();
    renderEndpointRows();
    renderEndpointDetail();
  }

  function renderHeader() {
    var run = state.payload.run || {};
    var diffTag = run.baseSpecPath && run.headSpecPath ? (' | diff: ' + run.baseSpecPath + ' -> ' + run.headSpecPath) : '';
    el.runContext.textContent = 'spec: ' + run.specPath + ' | generated: ' + run.generatedAt + diffTag;
  }

  function renderQuickActions() {
    var rows = state.payload.endpoints || [];
    var topFamily = topFamilyByFindings(rows);
    var actions = [
      { id: "family", label: "Top family shortcut", copy: topFamily.name ? ('Jump to ' + humanFamilyLabel(topFamily.name)) : 'Jump to the highest-finding family', color: 'family' },
      { id: "workflow", label: "Workflow burden", copy: "Missing next-step IDs or continuity context across call chains", color: 'workflow' },
      { id: "shape", label: "Shape burden", copy: "Schemas are too generic or storage-shaped for clean client use", color: 'shape' },
      { id: "consistency", label: "Consistency", copy: "Similar endpoints drift in path style, parameter names, or response shape", color: 'consistency' },
      { id: "clear-current-lens", label: "Clear current lens", copy: "Reset all filters and start over", color: 'reset' }
    ];

    el.quickActions.innerHTML = actions.map(function (action) {
      return '<button type="button" class="quick-action quick-action-' + escapeHtml(action.color) + '" data-id="' + action.id + '" title="' + escapeHtml(action.label) + '">' 
        + '<span class="quick-label">' + escapeHtml(action.label) + '</span>'
        + '<span class="quick-copy">' + escapeHtml(action.copy) + '</span>'
        + '</button>';
    }).join("");

    Array.prototype.forEach.call(el.quickActions.querySelectorAll("button[data-id]"), function (btn) {
      btn.addEventListener("click", function () {
        applyQuickAction(btn.getAttribute("data-id"), topFamily.name);
      });
    });
  }

  function applyQuickAction(id, topFamilyName) {
    if (id === "clear-current-lens") {
      clearCurrentLens();
      return;
    }

    state.filters.includeNoIssueRows = false;
    state.filters.familyPressure = "all";

    if (id === "family" && topFamilyName) {
      state.filters.search = String(topFamilyName).toLowerCase();
      state.filters.category = "all";
      state.filters.burden = "all";
    } else if (id === "workflow") {
      state.filters.search = "";
      state.filters.category = "all";
      state.filters.burden = "workflow-burden";
    } else if (id === "shape") {
      state.filters.search = "";
      state.filters.category = "all";
      state.filters.burden = "contract-shape";
    } else if (id === "consistency") {
      state.filters.search = "";
      state.filters.category = "all";
      state.filters.burden = "consistency";
    }

    state.selectedEndpointId = firstVisibleEndpointId(filteredRows());
    render();
  }

  function syncControls() {
    el.searchInput.value = state.filters.search;
    el.categoryFilter.value = state.filters.category;
    el.burdenFilter.value = state.filters.burden;
    el.familyPriorityFilter.value = state.filters.familyPressure;
    el.includeNoIssueRows.checked = state.filters.includeNoIssueRows;
  }

  function clearCurrentLens() {
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

    if (!summaries.length) {
      el.familySurfaceHelp.textContent = "No families match the current lens.";
      el.familySurfaceContext.innerHTML = lensContext;
      bindRecoveryButtons(el.familySurfaceContext);
      el.familySurface.innerHTML = '<div class="empty">'
        + '<strong>No matching families.</strong>'
        + '<p class="subtle">The current lens removed every family. Use the buttons below to restore a wider view.</p>'
        + renderRecoveryActions(["clear-search", "reset-burden", "show-all-families", "clear-current-lens"])
        + '</div>';
      bindRecoveryButtons(el.familySurface);
      return;
    }

    el.familySurfaceHelp.textContent = "Family clusters \u2014 click a card to focus on its endpoints. Urgency is in the pressure tag, not the card color.";
    el.familySurfaceContext.innerHTML = lensContext;
    bindRecoveryButtons(el.familySurfaceContext);
    el.familySurface.innerHTML = summaries.map(function (family) {
      return renderFamilyCard(family);
    }).join("");

    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-family]"), function (btn) {
      btn.addEventListener("click", function () {
        var family = btn.getAttribute("data-family") || "";
        state.filters.search = family.toLowerCase();
        state.filters.includeNoIssueRows = false;
        state.selectedEndpointId = firstVisibleEndpointId(filteredRows());
        render();
      });
    });
  }

  function renderWorkflowChains() {
    var allChains = state.payload.workflows.chains || [];
    if (!allChains.length) {
      el.workflowSection.style.display = 'none';
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

    if (!filteredChains.length) {
      el.workflowSection.style.display = 'block';
      el.workflowHelp.textContent = 'No call chains match the current lens. Broaden the filters to see workflow patterns.';
      el.workflowChains.innerHTML = '<div class="workflow-no-match">'
        + '<p><strong>No matching workflows</strong></p>'
        + '<p class="subtle">The current search, category, or burden filters removed all relevant call chains. Use the buttons below to broaden the view.</p>'
        + renderRecoveryActions(["clear-search", "reset-burden", "show-all-workflows", "clear-current-lens"])  
        + '</div>';
      bindRecoveryButtons(el.workflowChains);
      return;
    }

    el.workflowSection.style.display = 'block';
    el.workflowHelp.textContent = 'Call chains inferred from path structure. Click any step to load its evidence. Steps with badges have continuity issues.';

    var groups = groupChainsByKind(filteredChains);
    el.workflowChains.innerHTML = groups.map(renderWorkflowKindGroup).join('');

    Array.prototype.forEach.call(el.workflowChains.querySelectorAll('[data-step-id]'), function (elem) {
      elem.addEventListener('click', function () {
        Array.prototype.forEach.call(el.workflowChains.querySelectorAll('.step-box'), function (b) {
          b.classList.remove('step-active');
        });
        var box = elem.querySelector('.step-box');
        if (box) box.classList.add('step-active');
        state.selectedEndpointId = elem.getAttribute('data-step-id');
        renderEndpointRows();
        renderEndpointDetail();
        el.endpointDetail.classList.remove('detail-flash');
        void el.endpointDetail.offsetWidth;
        el.endpointDetail.classList.add('detail-flash');
        setTimeout(function () {
          el.endpointDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      });
    });
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

  function chainResourceLabel(chain) {
    var ids = chain.endpointIds || [];
    var detail = ids.length ? state.payload.endpointDetails[ids[0]] : null;
    if (!detail) return chain.kind || 'workflow';
    var segs = detail.endpoint.path.split('/').filter(function (p) { return p && !p.startsWith('{'); });
    return segs.length ? segs[segs.length - 1] : detail.endpoint.path;
  }

  function renderWorkflowKindGroup(group) {
    var kindLabel = group.kind.replaceAll('-', ' \u2192 ');
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
      return renderWorkflowStep(endpointId, idx, steps.length, roles[idx] || '');
    }).join('');

    var stepsAndReason = '<div class="workflow-steps">' + stepElements + '</div>'
      + (chain.reason ? '<div class="workflow-reason">' + escapeHtml(chain.reason) + '</div>' : '');

    if (isPrimary) {
      return '<div class="workflow-chain">'
        + '<div class="chain-resource-label">'
        + '<span class="chain-resource-name">' + escapeHtml(resourceLabel) + '</span>'
        + '<span class="chain-step-count">' + steps.length + '-step chain</span>'
        + burdenBadge
        + '</div>'
        + stepsAndReason
        + '</div>';
    }
    return '<details class="workflow-chain-compact">'
      + '<summary>'
      + '<span class="chain-compact-resource">' + escapeHtml(resourceLabel) + '</span>'
      + '<span class="chain-compact-steps">' + steps.length + '-step</span>'
      + burdenBadge
      + '</summary>'
      + '<div class="workflow-chain-compact-body">'
      + stepsAndReason
      + '</div>'
      + '</details>';
  }

  function renderWorkflowStep(endpointId, stepIndex, totalSteps, roleLabel) {
    var detail = state.payload.endpointDetails[endpointId];
    if (!detail) return '';

    var endpoint = detail.endpoint;
    var findings = detail.findings || [];

    var shapeFindings = findings.filter(function (f) {
      return f.code === 'contract-shape-workflow-guidance-burden';
    });

    var linkageFindings = findings.filter(function (f) {
      return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage';
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

    var roleSlug = roleLabel ? roleLabel.toLowerCase().replace(/[^a-z]/g, '') : '';
    var roleHtml = roleLabel
      ? '<span class="step-role-pill step-role-' + escapeHtml(roleSlug) + '">' + escapeHtml(roleLabel.toUpperCase()) + '</span>'
      : '<span class="step-number">Step ' + (stepIndex + 1) + ' of ' + totalSteps + '</span>';

    var arrow = isLast ? '' : '<div class="workflow-arrow">\u2192</div>';

    return '<div class="workflow-step" data-step-id="' + escapeHtml(endpointId) + '">'
      + '<div class="step-box">'
      + roleHtml
      + '<div class="step-endpoint">'
      + '<strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
      + '</div>'
      + (warningBadges ? '<div class="step-warnings">' + warningBadges + '</div>' : '')
      + (continuityBurden || '')
      + '<span class="step-inspect-hint">\u2197 inspect evidence</span>'
      + '</div>'
      + arrow
      + '</div>';
  }

  function renderFamilyCard(family) {
    var dims = (family.topDimensions || []).map(function (dimension) {
      return '<span class="chip">' + escapeHtml(dimension) + '</span>';
    }).join("");

    var burdenLabel = family.dominantBurden === 'mixed' ? 'mixed (multiple burden types)' : family.dominantBurden;
    return '<button type="button" class="family-card pressure-' + family.pressure + '" data-family="' + escapeHtml(family.family) + '">'
      + '<div class="family-head">'
      + '<strong>' + escapeHtml(humanFamilyLabel(family.family)) + '</strong>'
      + pressureBadge(family.pressure, 'pressure')
      + '</div>'
      + '<p class="family-stat">' + family.findings + ' issue' + (family.findings === 1 ? '' : 's') + ' across ' + family.endpoints + ' endpoint' + (family.endpoints === 1 ? '' : 's') + '</p>'
      + '<p class="subtle">Main burden: ' + escapeHtml(burdenLabel) + '</p>'
      + '<div class="chips">' + dims + '</div>'
      + '</button>';
  }

  function buildFamilySurfaceContext(summaries) {
    var visibleFamilies = summaries.length;
    var lensActive = state.filters.search || state.filters.category !== 'all' || state.filters.burden !== 'all' || state.filters.familyPressure !== 'all';
    var allFamiliesInLens = familySummariesRaw();
    var totalFamiliesInLens = allFamiliesInLens.length;
    var familiesInPressureTier = state.filters.familyPressure === 'all'
      ? totalFamiliesInLens
      : allFamiliesInLens.filter(function (family) { return family.pressure === state.filters.familyPressure; }).length;
    var showingTruncated = visibleFamilies < familiesInPressureTier;

    var copy = '<div class="context-block family-context-block">';
    if (visibleFamilies === 1 && lensActive) {
      copy += '<p><strong>1 family currently shown.</strong> The active lens narrowed this surface to one family. Click the card to focus its endpoints, or widen the lens below.</p>';
    } else if (lensActive) {
      copy += '<p><strong>' + visibleFamilies + ' families currently shown.</strong> These match the active lens and selected pressure tier.</p>';
    } else {
      copy += '<p><strong>' + visibleFamilies + ' families currently shown — no active lens.</strong> All families are visible by default. Click a card to narrow endpoints to that family.</p>';
    }
    copy += '<p><strong>Count semantics:</strong> total families in current search/category/burden lens = ' + totalFamiliesInLens
      + '; families in selected pressure tier = ' + familiesInPressureTier
      + '; currently shown cards = ' + visibleFamilies
      + (showingTruncated ? ' (top 24 shown).' : '.') + '</p>';
    copy += '<div class="context-actions">'
      + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all matching families</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="clear-current-lens">Clear lens</button>'
      + '</div>'
      + '</div>';
    return copy;
  }

  function familyScopeReason() {
    if (state.filters.search) {
      return 'The search lens currently matches a specific family or endpoint pattern, so the family surface is narrowed.';
    }
    if (state.filters.category !== 'all' || state.filters.burden !== 'all') {
      return 'Category or burden filters removed families that do not carry matching evidence.';
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
          dimensionCounts: {}
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

    el.listContext.innerHTML = buildListContext(rows.length, total);
    bindRecoveryButtons(el.listContext);

    if (!rows.length) {
      state.selectedEndpointId = "";
      el.endpointRows.innerHTML = '<tr><td colspan="3">'
        + '<div class="empty inline-empty">'
        + '<strong>No endpoints match this evidence lens.</strong>'
        + '<p class="subtle">No evidence-bearing endpoints are left after the current filters.</p>'
        + renderRecoveryActions(["clear-search", "reset-burden", "include-no-issue-rows", "clear-current-lens"])
        + '</div>'
        + '</td></tr>';
      bindRecoveryButtons(el.endpointRows);
      return;
    }

    if (!rows.find(function (row) { return row.id === state.selectedEndpointId; })) {
      state.selectedEndpointId = firstVisibleEndpointId(rows);
    }

    el.endpointRows.innerHTML = rows.map(function (row) {
      return renderEndpointRow(row);
    }).join("");

    Array.prototype.forEach.call(el.endpointRows.querySelectorAll("tr[data-id]"), function (tr) {
      tr.addEventListener("click", function () {
        state.selectedEndpointId = tr.getAttribute("data-id");
        renderEndpointRows();
        renderEndpointDetail();
      });
    });
  }

  function renderEndpointRow(row) {
    var detail = state.payload.endpointDetails[row.id] || { findings: [] };
    var firstFinding = detail.findings[0] || null;
    var dominant = rowDominantIssue(row);
    var selected = row.id === state.selectedEndpointId ? "active" : "";
    var intent = endpointIntentCue(row.method, row.path);
    var severity = dominantSeverity(detail.findings || []);
    var firstContext = firstFinding ? extractOpenAPIContext(firstFinding) : null;
    var contextLine = firstContext ? renderOpenAPIContextPills(firstContext, true) : '<span class="context-inline subtle">OpenAPI location not derivable from the top message.</span>';

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
      + '<div class="code-line">' + escapeHtml(dominant.code) + '</div>'
      + '</td>'
      + '<td>'
      + (firstFinding ? severityBadge(severity) : '')
      + '<div class="message-line">' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '</div>'
      + '<div class="context-inline-wrap">' + contextLine + '</div>'
      + '</td>'
      + '</tr>';
  }

  function buildListContext(matches, total) {
    var lens = [];
    if (state.filters.search) lens.push('\u201c' + state.filters.search + '\u201d');
    if (state.filters.category !== "all") lens.push(state.filters.category.replaceAll("-", " "));
    if (state.filters.burden !== "all") lens.push(state.filters.burden.replaceAll("-", " "));
    if (state.filters.familyPressure !== "all") lens.push('pressure: ' + state.filters.familyPressure);

    var mode = state.filters.includeNoIssueRows ? 'all rows' : 'evidence-only';
    var burdenHint = '';
    if (state.filters.burden === 'workflow-burden') {
      burdenHint = 'Workflow burden = missing continuity clues between steps (for example missing follow-up IDs).';
    } else if (state.filters.burden === 'contract-shape') {
      burdenHint = 'Shape burden = schemas are too generic or storage-shaped for easy client use.';
    } else if (state.filters.burden === 'consistency') {
      burdenHint = 'Consistency drift = similar endpoints differ in path style, parameter naming, or payload shape.';
    }
    var guide = matches > 0
      ? 'Pick a family above to narrow further, or click any row below to inspect its evidence.'
      : 'No rows match. Use the buttons below to broaden the lens.';

    return '<div class="context-block compact-context-block">'
      + '<p><strong>' + matches + ' / ' + total + '</strong> endpoints \u2014 ' + escapeHtml(mode)
      + (lens.length ? ' | filtered by: ' + escapeHtml(lens.join(', ')) : '') + '</p>'
      + '<p class="subtle">' + escapeHtml(guide) + '</p>'
        + (burdenHint ? '<p class="subtle">' + escapeHtml(burdenHint) + '</p>' : '')
      + '<div class="context-actions">'
        + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all matching families</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="clear-current-lens">Clear lens</button>'
      + '</div>'
      + '</div>';
  }

  function renderEndpointDetail() {
    var detail = state.selectedEndpointId ? state.payload.endpointDetails[state.selectedEndpointId] : null;
    if (!detail) {
      el.detailHelp.textContent = 'Select an evidence row to inspect concrete OpenAPI-facing findings.';
      el.endpointDetail.innerHTML = '<div class="empty">'
        + '<strong>No endpoint selected.</strong>'
        + '<p class="subtle">Choose a family cluster or endpoint row to inspect exact issue messages, OpenAPI location cues, and the next spec checks.</p>'
        + '</div>';
      return;
    }

    var findings = detail.findings || [];
    var endpoint = detail.endpoint || {};
    if (!findings.length) {
      el.detailHelp.textContent = 'No direct issue messages on this endpoint in the current lens.';
      el.endpointDetail.innerHTML = '<div class="empty">'
        + '<strong>' + escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>'
        + '<p class="subtle">This endpoint is visible, but there is no direct issue evidence to inspect in the current lens. Pick another evidence-bearing row.</p>'
        + renderRecoveryActions(["clear-search", "reset-burden", "clear-current-lens"])
        + '</div>';
      bindRecoveryButtons(el.endpointDetail);
      return;
    }

    var groups = groupFindings(findings);
    var dimensions = summarizeIssueDimensions(findings);
    var severity = dominantSeverity(findings);
    var topGroup = groups[0] || null;
    var topFields = topFieldPaths(groups);
    var inspectFirst = uniq(groups.slice(0, 3).map(function (group) { return group.inspectHint; })).slice(0, 3);
    var openAPIHighlights = topOpenAPIHighlights(groups);
    var groupedFindingsCount = groups.length;
    var relatedChains = detail.relatedChains || [];
    var workflowFindings = findings.filter(function (f) { return f.burdenFocus === 'workflow-burden' || f.code === 'contract-shape-workflow-guidance-burden'; });
    var chainContext = buildChainContext(relatedChains, state.selectedEndpointId, state.payload.endpointDetails);

    el.detailHelp.textContent = 'Concrete evidence first. OpenAPI grounding stays visible near the top, grouped warnings keep repeated messages from turning into one long stack, and composite score stays hidden.';

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
      + '  <div class="detail-summary-grid detail-summary-grid-balanced">'
      + '    <div class="summary-tile summary-tile-lead"><span class="tile-label">What is wrong</span><strong>' + escapeHtml(topGroup ? topGroup.title : dimensions[0].label) + '</strong><p>' + escapeHtml(topGroup ? topGroup.preview : 'Concrete contract issues are attached to this endpoint.') + '</p></div>'
      + '    <div class="summary-tile"><span class="tile-label">OpenAPI grounding</span>' + renderOpenAPISummary(openAPIHighlights) + '</div>'
      + '    <div class="summary-tile"><span class="tile-label">Inspect first</span>' + renderBulletList(inspectFirst, 'Review the first grouped issue below.') + '</div>'
      + '  </div>'
      + '  <div class="detail-signal-strip">'
      + '    <div class="signal-card"><span class="tile-label">Important fields and signals</span>' + renderChipList(topFields, 'No field path extracted from the current messages.') + '</div>'
      + '    <div class="signal-card"><span class="tile-label">Problem mix</span><div class="chips">' + dimensions.map(function (dimension) {
             return '<span class="chip">' + escapeHtml(dimension.label) + ' (' + dimension.count + ')</span>';
           }).join('') + '</div></div>'
      + '    <div class="signal-card"><span class="tile-label">Evidence groups</span><strong class="signal-count">' + groupedFindingsCount + '</strong><p>' + escapeHtml(groupedFindingsCount === 1 ? 'One grouped evidence cluster is attached to this endpoint.' : 'Repeated issues are collapsed into grouped evidence clusters below.') + '</p></div>'
      + '  </div>'
      + '</div>';

    if (chainContext) {
      html += chainContext;
    }

    html += '<section class="detail-section detail-section-tight">'
      + '  <h3>Grouped issue evidence</h3>'
      + '  <p class="subtle detail-section-copy">Open each group for exact issue messages. The first groups start open so the main evidence is immediately visible.</p>'
      + groups.map(function (group, index) {
            return renderIssueGroup(group, index);
          }).join('')
      + '</section>'
      + '<section class="detail-section detail-insight-grid">'
      + '  <div class="insight-card">'
      + '    <h3>Why it matters</h3>'
      + '    <ul>' + dimensions.slice(0, 3).map(function (dimension) {
             return '<li><strong>' + escapeHtml(dimension.label) + ':</strong> ' + escapeHtml(dimensionImpact(dimension.label)) + '</li>';
           }).join('') + '</ul>'
      + '  </div>'
      + '  <div class="insight-card">'
      + '    <h3>Inspect in the spec</h3>'
      + '    <ul>' + inspectFirst.map(function (hint) {
             return '<li>' + escapeHtml(hint) + '</li>';
           }).join('') + '</ul>'
      + '  </div>'
      + '</section>';

    el.endpointDetail.innerHTML = html;
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

  function renderIssueGroup(group, index) {
    var openAttr = index < 2 ? ' open' : '';
    var messageList = group.messages.map(function (message) {
      return '<li>' + escapeHtml(message) + '</li>';
    }).join('');
    var openAPI = renderOpenAPIContextPills(group.context, false);
    var countSuffix = group.count > 1 ? '<span class="issue-group-count">\u00d7' + group.count + '</span>' : '';

    return '<details class="issue-group"' + openAttr + '>'
      + '<summary>'
      + '<span class="issue-toggle-indicator"></span>'
      + severityBadge(group.severity)
      + '<span class="issue-group-title">' + escapeHtml(group.title) + '</span>'
      + countSuffix
      + '</summary>'
      + '<div class="issue-group-body">'
      + '  <div class="issue-group-meta">' + openAPI + '</div>'
      + '  <p class="issue-inspect-hint"><strong>Inspect in spec:</strong> ' + escapeHtml(group.inspectHint) + '</p>'
      + '  <div class="issue-messages">'
      + '    <p class="group-label">' + (group.count === 1 ? 'Issue message' : group.count + ' issue messages') + '</p>'
      + '    <ul>' + messageList + '</ul>'
      + '  </div>'
      + '  <p class="issue-impact"><strong>Why it matters:</strong> ' + escapeHtml(group.impact) + '</p>'
      + '</div>'
      + '</details>';
  }

  function groupFindings(findings) {
    var groups = {};

    findings.forEach(function (finding) {
      var context = extractOpenAPIContext(finding);
      var key = [
        finding.code || '',
        context.primaryLabel || '',
        context.primaryValue || '',
        context.mediaType || '',
        context.statusCode || ''
      ].join('|');

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
          title: formatIssueGroupTitle(finding, context)
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
      } else if (finding.code === 'generic-object-response' || finding.code === 'missing-response-schema' || finding.code === 'contract-shape-workflow-guidance-burden') {
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
    if (!detail || !detail.findings || !detail.findings.length) {
      return { label: 'No direct issue evidence', code: 'n/a' };
    }

    var first = detail.findings[0];
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
    return '<span class="severity-badge severity-' + escapeHtml(severity) + '">'
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
    } else if (action === 'show-all-workflows') {
      state.filters.search = '';
      state.filters.category = 'all';
      state.filters.burden = 'all';
      state.filters.familyPressure = 'all';
    } else if (action === 'include-no-issue-rows') {
      state.filters.includeNoIssueRows = true;
    } else if (action === 'clear-current-lens') {
      clearCurrentLens();
      return;
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
    return 'Clear current lens';
  }

  function issueDimensionForFinding(code, category, burdenFocus) {
    if (!code) return category ? category.replaceAll('-', ' ') : 'other issues';
    if (code === 'contract-shape-workflow-guidance-burden') return 'shape / storage-style response weakness';
    if (code === 'prerequisite-task-burden') return 'hidden dependency / linkage burden';
    if (code === 'weak-list-detail-linkage' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
      return 'workflow outcome weakness';
    }
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
      case 'likely-missing-enum': {
        var enumField = (message || '').match(/property '([^']+)'/);
        return 'Declare enum values for ' + (enumField ? enumField[1] : 'the property') + ' in schema.';
      }
      case 'prerequisite-task-burden':
        return 'Expose prerequisite identifier/state in parent response or simplify required task linkage.';
      case 'contract-shape-workflow-guidance-burden':
        return 'Return a compact outcome payload with explicit status/link rather than a full snapshot.';
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
