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
    resetControl: document.getElementById("resetControl"),
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
    var categoryValues = uniq(flatMap(state.payload.endpoints, function (row) {
      return Object.keys(row.categoryCounts || {});
    })).sort();
    setOptions(el.categoryFilter, [{ value: "all", label: "all categories" }].concat(
      categoryValues.map(function (c) {
        return { value: c, label: c === 'spec-rule' ? 'spec rule violations' : c.replaceAll("-", " ") };
      })
    ));

    setOptions(el.burdenFilter, [
      { value: "all", label: "all burdens" },
      { value: "workflow-burden", label: "workflow burden" },
      { value: "contract-shape", label: "shape burden" },
      { value: "consistency", label: "consistency" }
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
    renderResetControl();
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
      { id: "spec-rule", label: "Spec rule violations", copy: "OpenAPI MUST/SHOULD violations grounded in normative spec language", color: 'spec-rule' },
      { id: "workflow", label: "Workflow burden", copy: "Missing next-step IDs or continuity context across call chains", color: 'workflow' },
      { id: "shape", label: "Shape burden", copy: "Schemas are too generic or storage-shaped for clean client use", color: 'shape' },
      { id: "consistency", label: "Consistency", copy: "Similar endpoints drift in path style, parameter names, or response shape", color: 'consistency' }
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

  function renderResetControl() {
    el.resetControl.innerHTML = '<button type="button" class="quick-action quick-action-reset" data-id="clear-current-lens" title="Reset filters">'
      + '<span class="quick-label">Reset filters</span>'
      + '<span class="quick-copy">Clear all active filters and start over</span>'

    Array.prototype.forEach.call(el.resetControl.querySelectorAll("button[data-id]"), function (btn) {
      btn.addEventListener("click", function () {
        applyQuickAction(btn.getAttribute("data-id"), "");
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
    } else if (id === "spec-rule") {
      state.filters.search = "";
      state.filters.category = "spec-rule";
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
        + '<p class="subtle">The current filters removed all relevant call chains.</p>'
        + '<div class="recovery-actions">'
        + '<button type="button" class="secondary-action" data-recovery-action="show-all-workflows">Show all workflow patterns</button>'
        + '</div>'
        + '<p class="recovery-secondary-hint">Or: <button type="button" class="recovery-link" data-recovery-action="reset-burden">reset burden</button> · <button type="button" class="recovery-link" data-recovery-action="clear-search">clear search</button></p>'
        + '</div>';
      bindRecoveryButtons(el.workflowChains);
      return;
    }

    el.workflowSection.style.display = 'block';
    el.workflowHelp.textContent = 'Call chains inferred from path structure. Step cards summarize continuity cues; inspect detail for exact issue evidence and OpenAPI grounding where available.';

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

    return Object.keys(burdens).map(function (k) { return burdens[k]; }).filter(function (b) { return b.steps.length > 0; });
  }

  function renderWorkflowBurdenSummary(chain, roles) {
    var items = collectWorkflowBurdenSummary(chain, roles);
    if (!items.length) return '';
    var html = items.map(function (item) {
      return '<span class="workflow-burden-item workflow-burden-' + item.key + '">'
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

  function inferWorkflowTransitionCue(clues, roleLabel) {
    var prereq = clues && clues.prereq ? clues.prereq : [];
    var establish = clues && clues.establish ? clues.establish : [];
    var nextNeeds = clues && clues.nextNeeds ? clues.nextNeeds : [];
    var hidden = clues && clues.hidden ? clues.hidden : [];
    var role = (roleLabel || '').toLowerCase();
    var allText = (prereq.concat(establish, nextNeeds, hidden)).join(' | ').toLowerCase();
    var handoffText = (establish.concat(nextNeeds)).join(' | ').toLowerCase();

    // Derive the most specific applicable label from available clue text,
    // including when hidden signals are present.
    if (/(auth|bearer|authorization|access\s*key|api[-\s]?key)/.test(allText)) {
      return { kind: 'context', label: hidden.length ? 'auth/header dependency' : 'auth/header dependency' };
    }
    if (/(token|context)/.test(allText)) {
      return { kind: 'context', label: hidden.length ? 'context token handoff' : 'context handoff' };
    }
    if (/(order identity|order state|order context)/.test(allText)) {
      return { kind: 'state', label: 'order identity handoff' };
    }
    if (/(cart|order|customer)/.test(allText) && hidden.length) {
      return { kind: 'state', label: 'cart/order state dependency' };
    }
    if (/(cart|order|customer|state)/.test(handoffText) || role === 'action' || role === 'update') {
      return { kind: 'state', label: 'state transition' };
    }
    if (/(payment|follow-up|follow up|transaction)/.test(allText) || role === 'payment' || role === 'checkout') {
      return { kind: 'followup', label: hidden.length ? 'follow-up action dependency' : 'follow-up dependency' };
    }
    if (hidden.length) {
      if (prereq.length) return { kind: 'weak', label: 'prior-state dependency' };
      return { kind: 'weak', label: 'implicit handoff' };
    }
    if (prereq.length) {
      return { kind: 'prereq', label: 'prior-state dependency' };
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
      + (dependencyHtml || '')
      + (warningBadges ? '<div class="step-warnings">' + warningBadges + '</div>' : '')
      + (continuityBurden || '')
      + '<span class="step-inspect-hint">\u2197 inspect detail: exact issue evidence</span>'
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
      return '<p class="subtle">No spec-rule findings visible in the current lens.</p>';
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
      if (topSignals.length) {
        return topSignals.map(function(s) { return humanizeSignalLabel(s); }).join(' and ') + ' patterns.';
      }
      return 'Potential workflow sequencing or follow-up linkage issues.';
    }
    if (burden === 'contract-shape') {
      if (topSignals.length) {
        return topSignals.map(function(s) { return humanizeSignalLabel(s); }).join(' and ') + ' patterns.';
      }
      return 'Response schema appears storage-shaped rather than task-oriented.';
    }
    if (burden === 'consistency') {
      if (topSignals.length) {
        return topSignals.map(function(s) { return humanizeSignalLabel(s); }).join(' and ') + ' drift.';
      }
      return 'Similar operations drift in path style, parameters, or response shape.';
    }
    return '';
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

  function renderFamilyCard(family) {
    var activeBurden = state.filters.burden;
    var whyText = activeBurden !== 'all' ? familyBurdenWhyText(family) : '';

    var chipItems;
    if (activeBurden !== 'all') {
      chipItems = topFamilyBurdenSignals(family, activeBurden, 2);
      if (!chipItems.length) {
        if (activeBurden === 'workflow-burden') chipItems = ['missing next action'];
        else if (activeBurden === 'contract-shape') chipItems = ['storage-shaped response'];
        else chipItems = ['path/param drift'];
      }
    } else {
      chipItems = (family.topDimensions || []).slice(0, 1);
    }
    var chipsHtml = chipItems.map(function(c) { return '<span class="chip">' + escapeHtml(c) + '</span>'; }).join('');

    return '<button type="button" class="family-card pressure-' + family.pressure + '" data-family="' + escapeHtml(family.family) + '">'
      + '<div class="family-head">'
      + '<strong>' + escapeHtml(humanFamilyLabel(family.family)) + '</strong>'
      + pressureBadge(family.pressure, 'pressure')
      + '</div>'
      + '<p class="family-stat">' + family.findings + ' issue' + (family.findings === 1 ? '' : 's') + ' across ' + family.endpoints + ' endpoint' + (family.endpoints === 1 ? '' : 's') + '</p>'
      + (whyText
          ? '<p class="family-burden-why">' + escapeHtml(whyText) + '</p>'
          : '')
      + (chipsHtml ? '<div class="chips">' + chipsHtml + '</div>' : '')
      + '</button>';
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

    var burdenIntro = '';
    if (state.filters.burden === 'workflow-burden') {
      burdenIntro = '<p class="burden-lens-intro">Workflow burden lens \u2014 highlights families where contracts appear to rely on hidden handoffs, brittle sequencing, or weak next-step guidance. Card text explains why each family appears here; exact evidence lives in endpoint detail below.</p>';
    } else if (state.filters.burden === 'contract-shape') {
      burdenIntro = '<p class="burden-lens-intro">Shape burden lens \u2014 highlights families whose contracts appear storage-shaped (deep nesting, incidental/internal fields, weaker task-outcome emphasis). Card text explains why each family appears here; exact evidence lives in endpoint detail below.</p>';
    } else if (state.filters.burden === 'consistency') {
      burdenIntro = '<p class="burden-lens-intro">Consistency lens \u2014 highlights families where similar operations appear to drift in parameter names, path style, or response/outcome shape. Card text explains why each family appears here; exact evidence lives in endpoint detail below.</p>';
    }

    var copy = '<div class="context-block family-context-block">';
    if (burdenIntro) copy += burdenIntro;
    copy += '<ul class="count-semantics">';
      + '<li><strong>Families in spec:</strong> ' + specTotal + ' (all distinct family labels, no filters)</li>'
      + '<li><strong>Matching search / category / burden:</strong> ' + totalInLens + ' (families with at least one finding-bearing endpoint in the current lens)</li>'
      + '<li><strong>In ' + tierLabel + ':</strong> ' + familiesInPressureTier + ' (of those ' + totalInLens + ')</li>'
      + '<li><strong>Cards shown:</strong> ' + visibleFamilies + (showingTruncated ? ' — top 24 of ' + familiesInPressureTier + ' (' + (familiesInPressureTier - visibleFamilies) + ' not shown)' : '') + '</li>'
      + '</ul>';
    copy += '<p class="detail-location-hint">Card = summary of why this family is flagged. Click a card, then select an endpoint row below to see exact issue messages and OpenAPI grounding in the detail pane \u2192</p>';
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
      + '</td>'
      + '<td>'
      + (firstFinding ? severityBadge(severity) : '')
      + '<div class="message-line">' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '</div>'
      + '<div class="context-inline-wrap">' + contextLine + '</div>'
        + '<div class="row-next-step">→ select row to inspect</div>'
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
            bumpCounter(counts, 'hidden context/token handoff appears likely');
          }
          if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage' || code === 'weak-outcome-next-action-guidance' || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
            bumpCounter(counts, 'next required step is not clearly exposed');
          }
          if (code === 'prerequisite-task-burden' || /prior state|earlier|prerequisite|lookup/.test(msg)) {
            bumpCounter(counts, 'sequencing appears brittle across steps');
          }
          if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
            bumpCounter(counts, 'auth/header/context requirements appear spread across calls');
          }
        }

        if (burdenLens === 'contract-shape') {
          if (code === 'deeply-nested-response-structure' || dim === 'shape / nesting complexity' || /nested|deep/.test(msg)) {
            bumpCounter(counts, 'deep nesting appears frequently in this slice');
          }
          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || /snapshot|storage|model structure/.test(msg)) {
            bumpCounter(counts, 'duplicated or snapshot-style state appears common');
          }
          if (code === 'duplicated-state-response' || /duplicate|duplicated/.test(msg)) {
            bumpCounter(counts, 'similar state appears repeated across response branches');
          }
          if (code === 'incidental-internal-field-exposure' || dim === 'internal/incidental fields' || /internal|incidental|audit|raw id/.test(msg)) {
            bumpCounter(counts, 'incidental/internal field emphasis appears often');
          }
          if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response' || dim === 'workflow outcome weakness' || /outcome|next action/.test(msg)) {
            bumpCounter(counts, 'task outcome / next action emphasis appears weak');
          }
        }

        if (burdenLens === 'consistency') {
          if (code === 'detail-path-parameter-name-drift') {
            bumpCounter(counts, 'parameter naming drift appears often');
          }
          if (code === 'endpoint-path-style-drift' || code === 'sibling-path-shape-drift') {
            bumpCounter(counts, 'path style drift appears across similar routes');
          }
          if (code === 'inconsistent-response-shape' || code === 'inconsistent-response-shape-family' || code === 'inconsistent-response-shapes' || code === 'inconsistent-response-shapes-family') {
            bumpCounter(counts, 'response shape drift appears across similar endpoints');
            bumpCounter(counts, 'outcome is modeled differently across similar endpoints');
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
      return '<span class="chip">' + escapeHtml(signal.label) + ' (' + signal.count + ')</span>';
    }).join('');

    return '<div class="burden-dynamic-signals">'
      + '<strong>Most common in this slice:</strong>'
      + '<div class="chips">' + chips + '</div>'
      + '</div>';
  }

  function buildListContext(matches, total) {
    var lens = [];
    if (state.filters.search) lens.push('\u201c' + state.filters.search + '\u201d');
    if (state.filters.category !== "all") lens.push(state.filters.category.replaceAll("-", " "));
    if (state.filters.burden !== "all") lens.push(state.filters.burden.replaceAll("-", " "));
    if (state.filters.familyPressure !== "all") lens.push('pressure: ' + state.filters.familyPressure);

    var mode = state.filters.includeNoIssueRows ? 'all rows' : 'evidence-only';
    var visibleRows = filteredRows();
    var burdenExplanation = '';
    if (state.filters.category === 'spec-rule') {
      var ruleGroups = aggregateSpecRuleFindings(filteredRows());
      burdenExplanation = '<div class="burden-explanation spec-rule-explanation">'
        + '<strong>Spec rule violations</strong> \u2014 findings grounded in explicit OpenAPI normative language. '
        + 'REQUIRED / MUST violations are <strong>errors</strong>; SHOULD / RECOMMENDED concerns are <strong>warnings</strong>. '
        + 'These are distinct from heuristic workflow-burden or shape-burden findings.'
        + renderSpecRuleAggregate(ruleGroups)
        + '<p class="burden-evidence-cue">Click any endpoint row to see its exact instances. Normative grounding (rule ID + level) appears in each issue group in the detail pane.</p>'
        + '</div>';
    } else if (state.filters.burden === 'workflow-burden') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<strong>Workflow burden</strong> — this slice highlights contracts that appear to make real call chains harder to complete safely.'
        + '<ul>'
        + '<li>Hidden token/context/header dependencies appear across steps.</li>'
        + '<li>Sequencing suggests brittle handoffs where the next required step is not clearly exposed.</li>'
        + '<li>Outcome guidance appears weak, so callers likely infer what to do next.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'workflow-burden')
        + '<span class="burden-evidence-cue">Cards summarize why each family/endpoint appears here. Open a row, then use the detail pane for exact issue messages and OpenAPI grounding where derivable.</span>'
        + '</div>';
    } else if (state.filters.burden === 'contract-shape') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<strong>Shape burden</strong> — this slice highlights contracts that appear storage-shaped or snapshot-heavy instead of task-shaped.'
        + '<ul>'
        + '<li>Deep nesting, duplicated state, or incidental/internal fields dominate the response.</li>'
        + '<li>Generic object/array typing weakens what the caller can safely infer.</li>'
        + '<li>Task outcome and next action emphasis appears weaker than backend structure emphasis.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'contract-shape')
        + '<span class="burden-evidence-cue">Cards summarize why each family/endpoint appears here. Open a row, then use the detail pane for exact schema-facing messages and location cues.</span>'
        + '</div>';
    } else if (state.filters.burden === 'consistency') {
      burdenExplanation = '<div class="burden-explanation">'
        + '<strong>Consistency</strong> — this slice highlights drift across similar operations and contracts.'
        + '<ul>'
        + '<li>Parameter naming drift (for example <code>id</code> vs <code>userId</code>).</li>'
        + '<li>Path style drift across sibling routes.</li>'
        + '<li>Outcome/response shape drift across endpoints that appear similar.</li>'
        + '</ul>'
        + renderDynamicBurdenSignals(visibleRows, 'consistency')
        + '<span class="burden-evidence-cue">Cards summarize where drift appears. Open a row, then use the detail pane for exact path/shape evidence and affected operation messages.</span>'
        + '</div>';
    }
    var guide = matches > 0
      ? 'Cards and rows are summary signals. Click a row to inspect exact issue evidence in detail.'
      : 'No rows match. Use the buttons below to broaden the lens.';

    return '<div class="context-block compact-context-block">'
      + '<p><strong>' + matches + ' / ' + total + '</strong> endpoints \u2014 ' + escapeHtml(mode)
      + (lens.length ? ' | filtered by: ' + escapeHtml(lens.join(', ')) : '') + '</p>'
      + burdenExplanation
      + '<p class="subtle">' + escapeHtml(guide) + '</p>'
      + '<div class="context-actions">'
        + '<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all matching families</button>'
      + '<button type="button" class="secondary-action" data-recovery-action="clear-current-lens">Clear lens</button>'
      + '</div>'
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
      return /follow[-\s]?up|next[-\s]?step|tracking|identifier|token|context|header|nested|snapshot|internal/.test(msg);
    });
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
        pushUnique(current, 'Current contract appears to emphasize storage/internal structure over task outcome.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could surface task outcome first (what changed, what is authoritative now).');
      }
      if (code === 'deeply-nested-response-structure') {
        pushUnique(current, 'Response appears deeply nested, which can bury important outcome meaning several levels down.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could keep outcome and next action fields near the top level.');
      }
      if (code === 'duplicated-state-response') {
        pushUnique(current, 'Similar state appears duplicated across response branches, increasing scan noise.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could avoid repeated branch snapshots and keep one clear outcome view.');
      }
      if (code === 'incidental-internal-field-exposure') {
        pushUnique(current, 'Response appears to expose backend-oriented incidental fields that are weakly tied to immediate task outcome.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could keep only handoff-relevant fields and hide low-level model scaffolding.');
      }
      if (code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
        pushUnique(current, 'Next-step requirement appears weakly signaled; caller must infer follow-up details.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could make next required action and handoff identifier explicit.');
      }
      if (code === 'prerequisite-task-burden') {
        pushUnique(current, 'Contract appears to depend on hidden prerequisites across earlier calls.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could clarify authoritative context and prerequisite state for this step.');
      }
      if (code === 'generic-object-response' || code === 'weak-array-items-schema') {
        pushUnique(current, 'Response shape appears generic or broad, diluting handoff meaning.');
        pushUnique(cleaner, 'Workflow-shaped emphasis could reduce incidental fields and keep only handoff-critical state.');
      }
    });

    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    if (/login|auth|session|register/.test(path)) {
      pushUnique(cleaner, 'Illustrative emphasis: auth/context token now authoritative for subsequent calls.');
    }
    if (/customer/.test(path)) {
      pushUnique(cleaner, 'Illustrative emphasis: customer context authoritative and reusable across later workflow steps.');
    }
    if (/cart/.test(path)) {
      pushUnique(cleaner, 'Illustrative emphasis: cart state change plus minimal handoff fields for order placement.');
    }
    if (/order/.test(path)) {
      pushUnique(cleaner, 'Illustrative emphasis: order created/updated outcome and next valid actions for payment/follow-up.');
    }
    if (/payment|checkout/.test(path)) {
      pushUnique(cleaner, 'Illustrative emphasis: payment/follow-up meaning and authoritative transaction state for next checks.');
    }

    return {
      current: current.slice(0, 3),
      cleaner: cleaner.slice(0, 4),
      evidence: evidence.slice(0, 4)
    };
  }

  function renderWorkflowShapedExample(detail) {
    var findings = detail.findings || [];
    if (!hasWorkflowShapedExampleSignals(findings)) return '';

    var points = collectWorkflowShapedExamplePoints(detail.endpoint || {}, findings);
    if (!points.current.length && !points.cleaner.length) return '';

    var currentHtml = points.current.length
      ? '<ul>' + points.current.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '<p class="subtle">Current emphasis appears mixed; handoff meaning is not consistently clear.</p>';
    var cleanerHtml = points.cleaner.length
      ? '<ul>' + points.cleaner.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '<p class="subtle">Cleaner emphasis would prioritize task outcome, authoritative context, and next action clarity.</p>';

    var evidenceHint = points.evidence.length
      ? '<p class="workflow-example-evidence"><strong>Evidence signals:</strong> ' + escapeHtml(points.evidence.join(', ')) + '</p>'
      : '';

    return '<section class="workflow-example-block">'
      + '<h3>Cleaner contract emphasis (illustrative)</h3>'
      + '<p class="workflow-example-note">Guidance-oriented sketch only — not a literal generated replacement and not a runtime guarantee.</p>'
      + '<div class="workflow-example-grid">'
      + '  <div class="workflow-example-col">'
      + '    <h4>Current contract appears to emphasize</h4>'
      +      currentHtml
      + '  </div>'
      + '  <div class="workflow-example-col">'
      + '    <h4>Workflow-shaped emphasis could make clearer</h4>'
      +      cleanerHtml
      + '  </div>'
      + '</div>'
      + evidenceHint
      + '</section>';
  }

  function renderEndpointDetail() {
    var detail = state.selectedEndpointId ? state.payload.endpointDetails[state.selectedEndpointId] : null;
    if (!detail) {
      el.detailHelp.textContent = 'Select a row to inspect exact issue evidence. OpenAPI grounding is shown where derivable from messages.';
      el.endpointDetail.innerHTML = '<div class="empty">'
        + '<strong>No endpoint selected.</strong>'
        + '<p class="subtle">Choose a family cluster or endpoint row to inspect exact issue messages, OpenAPI location cues, and the next spec checks.</p>'
        + '</div>';
      return;
    }

    var findings = detail.findings || [];
    var endpoint = detail.endpoint || {};
    if (!findings.length) {
      el.detailHelp.textContent = 'No exact issue evidence for this endpoint in the current lens.';
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
    var groupedFindingsCount = groups.length;
    var relatedChains = detail.relatedChains || [];
    var chainContext = buildChainContext(relatedChains, state.selectedEndpointId, state.payload.endpointDetails);

    var topMsg = topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.';
    var topContext = topGroup ? topGroup.context : {};
    var contextBadge = buildContextTypeBadge(topContext);
    var cleanerHint = topGroup ? dimensionCleanerHint(topGroup.dimension) : '';
    var moreCount = groupedFindingsCount - 1;

    el.detailHelp.textContent = 'Exact issue-by-issue evidence for the selected endpoint. OpenAPI grounding appears where derivable.';

    var workflowExample = renderWorkflowShapedExample(detail);

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
      + '      <span class="grounding-label">OpenAPI grounding (where available)</span>'
      +        renderOpenAPIContextPills(topContext, false)
      +        (topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '')
      +    '</div>'
      + '    <p class="lead-finding-impact"><strong>Why this is problematic:</strong> ' + escapeHtml(topGroup ? topGroup.impact : '') + '</p>'
      + (cleanerHint ? '    <p class="lead-finding-cleaner"><strong>Cleaner contract would:</strong> ' + escapeHtml(cleanerHint) + '</p>' : '')
      + (moreCount > 0 ? '    <p class="detail-more-hint">' + moreCount + ' more issue group' + (moreCount > 1 ? 's' : '') + ' in the evidence section below.</p>' : '')
      + '  </div>'
      + '</div>';

    if (workflowExample) {
      html += workflowExample;
    }

    if (chainContext) {
      html += chainContext;
    }

    html += '<section class="detail-section detail-section-tight">'
      + '  <h3>Exact issue evidence</h3>'
      + '  <p class="subtle detail-section-copy">Grouped by location and type. First two groups start open.</p>'
      + groups.map(function (group, index) {
            return renderIssueGroup(group, index);
          }).join('')
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
      + '  <div class="issue-group-meta"><span class="grounding-label">OpenAPI grounding (where available)</span>' + openAPI + '</div>'
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

  function humanizeSignalLabel(signal) {
    var map = {
      'snapshot-heavy-response': 'snapshot-heavy',
      'deeply-nested-response-structure': 'deeply-nested',
      'duplicated-state-response': 'duplicated state',
      'incidental-internal-field-exposure': 'incidental fields',
      'weak-outcome-next-action-guidance': 'weak guidance',
      'missing-next-action': 'missing next-action',
      'storage-shaped-response': 'storage-shaped'
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
