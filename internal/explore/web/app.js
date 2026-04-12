function createEmptyOpenAPIContext() {
    return {
        primaryLabel: "",
        primaryValue: "",
        mediaType: "",
        statusCode: "",
        parameterKind: "",
        parameterNames: ""
    };
}
function createEmptyEndpointRow() {
    return {
        id: "",
        method: "",
        path: ""
    };
}
function createEmptyFilters() {
    return {
        search: "",
        category: "all",
        familyPressure: "all",
        includeNoIssueRows: false
    };
}
function createInitialExplorerState() {
    return {
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
        shapeWorkspaceCollapsed: false,
        issueScopeIndex: null,
        issueScopeIndexKey: "",
        familyTableShowAll: false,
        workflowChainsOpen: false,
        workflowChainFocusChainId: "",
        workflowChainFocusEndpointIds: [],
        inspectorWorkflowContextOpen: null,
        familyTableBackState: null,
        familyTableSort: {
            key: "default",
            direction: "asc"
        },
        detailEvidenceOpenForId: "",
        filters: createEmptyFilters()
    };
}
function createExplorerElements(doc) {
    return {
        runContext: doc.getElementById("runContext"),
        quickActions: doc.getElementById("quickActions"),
        resetControl: doc.getElementById("resetControl"),
        searchInput: doc.getElementById("searchInput"),
        categoryFilter: doc.getElementById("categoryFilter"),
        familyPriorityFilter: doc.getElementById("familyPriorityFilter"),
        filterEmptyState: doc.getElementById("filterEmptyState"),
        familySurfaceHelp: doc.getElementById("familySurfaceHelp"),
        familySurfaceContext: doc.getElementById("familySurfaceContext"),
        familySurface: doc.getElementById("familySurface"),
        workflowSection: doc.getElementById("workflowSection"),
        workflowHelp: doc.getElementById("workflowHelp"),
        workflowChains: doc.getElementById("workflowChains"),
        listContext: doc.getElementById("listContext"),
        endpointRows: doc.getElementById("endpointRows"),
        detailHelp: doc.getElementById("detailHelp"),
        endpointDetail: doc.getElementById("endpointDetail")
    };
}
var TOP_TABS = [
    {
        id: "spec-rule",
        label: "Contract Issues",
        copy: "OpenAPI rule violations (REQUIRED vs SHOULD) and consistency drift",
        color: "spec-rule",
        bodyClass: "lens-spec-rule",
        defaultCategory: "all",
        defaultSubTab: "exact",
        familyEyebrow: "Contract surface",
        familyHeading: "Family investigation clusters",
        familyHelp: "Families cluster contract-rule and consistency problems so you can expand evidence inline without leaving the main table.",
        emptyHelp: "",
        signalHeader: "Top signal",
        riskHeader: "Primary risk",
        clientEffectHeader: "Client effect"
    },
    {
        id: "workflow",
        label: "Workflow Guidance",
        copy: "Inferred call chains, continuity burden, hidden dependencies, and sequencing traps",
        color: "workflow",
        bodyClass: "lens-workflow",
        defaultCategory: "all",
        defaultSubTab: "summary",
        familyEyebrow: "Workflow surface",
        familyHeading: "Workflow continuity clusters",
        familyHelp: "Families stay in one shared table, but this tab ranks them by continuity burden, traps, and hidden handoff costs.",
        emptyHelp: "",
        signalHeader: "Continuity signals",
        riskHeader: "Main continuity risk",
        clientEffectHeader: "Client impact in flow"
    },
    {
        id: "shape",
        label: "Response Shape",
        copy: "Storage-shaped responses, duplicated state, internal fields, and workflow-first redesign guidance",
        color: "shape",
        bodyClass: "lens-shape",
        defaultCategory: "all",
        defaultSubTab: "summary",
        familyEyebrow: "Response Shape surface",
        familyHeading: "Response-shape investigation clusters",
        familyHelp: "Families stay in the same shared table pattern while this tab swaps in shape-specific burden, caller cost, and redesign guidance.",
        emptyHelp: "Response Shape: no families currently expose shape-heavy evidence in this slice.",
        signalHeader: "Shape signals",
        riskHeader: "Main response-shape risk",
        clientEffectHeader: "Client effect"
    }
];
var TOP_TAB_INDEX = TOP_TABS.reduce(function (acc, tab) {
    acc[tab.id] = tab;
    return acc;
}, {});
function clearEndpointSelectionState(state) {
    state.selectedEndpointId = "";
    state.userSelectedEndpoint = false;
    state.detailEvidenceOpenForId = "";
}
function applyFilterStateChange(state, mutate, invalidateDerivedCaches, render) {
    mutate();
    clearEndpointSelectionState(state);
    invalidateDerivedCaches();
    state.familyTableShowAll = false;
    render();
}
function resetInlineUiState(state) {
    state.expandedFamily = "";
    state.expandedFamilyInsight = "";
    state.expandedFamilySignals = {};
    state.expandedEndpointInsightIds = {};
    state.expandedEndpointRowFindings = {};
    state.inspectingEndpointId = "";
    state.inspectPlacementHint = "";
    state.selectedEndpointId = "";
    state.userSelectedEndpoint = false;
    state.detailEvidenceOpenForId = "";
    state.workflowChainFocusChainId = "";
    state.workflowChainFocusEndpointIds = [];
    state.familyTableBackState = null;
}
function applyTabDefaults(state, tabId, topTabIndex, options) {
    var cfg = topTabIndex[tabId] || topTabIndex["spec-rule"];
    var opts = options || {};
    state.activeTopTab = cfg.id;
    state.endpointDiagnosticsSubTab = cfg.defaultSubTab;
    if (opts.resetFilters !== false) {
        state.filters.search = "";
        state.filters.category = cfg.defaultCategory;
        state.filters.familyPressure = "all";
        state.filters.includeNoIssueRows = false;
    }
}
function cloneJSONValue(obj, fallback) {
    try {
        return JSON.parse(JSON.stringify(obj || fallback));
    }
    catch (e) {
        return fallback;
    }
}
function hasFamilyScopeActive(state) {
    return !!state.filters.search
        || state.filters.familyPressure !== "all"
        || !!state.expandedFamily
        || !!state.expandedFamilyInsight
        || Object.keys(state.expandedEndpointInsightIds || {}).length > 0;
}
function hasFamilyDrillActive(state, isExactFamilyName) {
    if (state.familyTableBackState)
        return true;
    if (state.expandedFamily)
        return true;
    if (state.expandedFamilyInsight)
        return true;
    if (Object.keys(state.expandedEndpointInsightIds || {}).length > 0)
        return true;
    return isExactFamilyName((state.filters.search || "").trim().toLowerCase());
}
function captureFamilyTableBackStateIfNeeded(state, overrides) {
    if (state.familyTableBackState)
        return;
    var o = overrides || {};
    state.familyTableBackState = {
        search: (typeof o.search === "string") ? o.search : (state.filters.search || ""),
        familyTableShowAll: !!state.familyTableShowAll,
        expandedFamily: state.expandedFamily || "",
        expandedFamilyInsight: state.expandedFamilyInsight || "",
        expandedEndpointInsightIds: cloneJSONValue(state.expandedEndpointInsightIds || {}, {}),
        expandedEndpointRowFindings: cloneJSONValue(state.expandedEndpointRowFindings || {}, {}),
        detailEvidenceOpenForId: state.detailEvidenceOpenForId || ""
    };
}
function restoreFamilyTableBackState(state) {
    if (!state.familyTableBackState) {
        state.expandedFamily = "";
        state.expandedFamilyInsight = "";
        state.expandedEndpointInsightIds = {};
        state.expandedEndpointRowFindings = {};
        state.detailEvidenceOpenForId = "";
        return;
    }
    var s = state.familyTableBackState;
    state.filters.search = s.search || "";
    state.familyTableShowAll = !!s.familyTableShowAll;
    state.expandedFamily = s.expandedFamily || "";
    state.expandedFamilyInsight = s.expandedFamilyInsight || "";
    state.expandedEndpointInsightIds = s.expandedEndpointInsightIds || {};
    state.expandedEndpointRowFindings = s.expandedEndpointRowFindings || {};
    state.detailEvidenceOpenForId = s.detailEvidenceOpenForId || "";
    if (state.expandedFamily && state.expandedFamilyInsight && state.expandedFamily !== state.expandedFamilyInsight) {
        state.expandedFamilyInsight = "";
    }
    state.familyTableBackState = null;
}
function focusFamilySurface(state, family, filteredRows, render) {
    if (!family)
        return;
    captureFamilyTableBackStateIfNeeded(state);
    state.filters.search = family.trim().toLowerCase();
    state.familyTableShowAll = false;
    clearEndpointSelectionState(state);
    var rows = filteredRows();
    if (state.selectedEndpointId && !rows.some(function (r) { return (r && r.id) === state.selectedEndpointId; })) {
        clearEndpointSelectionState(state);
    }
    render();
}
function syncFamilyInsightToggleButtons(familySurface, state, setFamilyInsightToggleButton) {
    if (!familySurface)
        return;
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-insight-toggle]"), function (toggleBtn) {
        var isExpanded = state.expandedFamilyInsight === (toggleBtn.getAttribute("data-insight-toggle") || "");
        setFamilyInsightToggleButton(toggleBtn, isExpanded);
    });
}
function removeInlineFamilyInsightRows(familySurface, exceptFamily) {
    if (!familySurface)
        return;
    Array.prototype.forEach.call(familySurface.querySelectorAll("tr.family-inline-insight-row"), function (insightRow) {
        var rowFamily = insightRow.getAttribute("data-family") || "";
        if (exceptFamily && rowFamily === exceptFamily)
            return;
        if (insightRow.parentNode)
            insightRow.parentNode.removeChild(insightRow);
    });
}
function inlineFamilyInsightRowForFamily(familySurface, family) {
    if (!familySurface || !family)
        return null;
    var match = null;
    Array.prototype.forEach.call(familySurface.querySelectorAll("tr.family-inline-insight-row"), function (insightRow) {
        if (match)
            return;
        if ((insightRow.getAttribute("data-family") || "") === family) {
            match = insightRow;
        }
    });
    return match;
}
function bindInsightPanelActions(row, focusFamily, openEvidence) {
    if (!row)
        return;
    Array.prototype.forEach.call(row.querySelectorAll("button[data-focus-family]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var family = btn.getAttribute("data-focus-family") || "";
            if (!family)
                return;
            focusFamily(family);
        });
    });
    Array.prototype.forEach.call(row.querySelectorAll("button[data-open-evidence-id]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-open-evidence-id") || "";
            if (!endpointId)
                return;
            openEvidence(endpointId);
        });
    });
}
function toggleFamilyInsightInline(options) {
    var familySurface = options.familySurface;
    var state = options.state;
    var btn = options.button;
    var family = options.family;
    if (!familySurface || !btn || !family)
        return;
    var row = btn.closest('tr.family-row[data-family-row="true"]');
    if (!row)
        return;
    var openInlineRow = inlineFamilyInsightRowForFamily(familySurface, family);
    var alreadyOpen = state.expandedFamilyInsight === family && !!openInlineRow;
    if (alreadyOpen) {
        state.expandedFamilyInsight = "";
        if (openInlineRow && openInlineRow.parentNode)
            openInlineRow.parentNode.removeChild(openInlineRow);
        removeInlineFamilyInsightRows(familySurface);
        syncFamilyInsightToggleButtons(familySurface, state, options.setFamilyInsightToggleButton);
        return;
    }
    options.captureBackState();
    removeInlineFamilyInsightRows(familySurface);
    var summaries = options.familySummaries();
    var match = summaries.find(function (f) {
        return (f && (f.family || "unlabeled family")) === family;
    });
    if (!match) {
        state.expandedFamilyInsight = "";
        syncFamilyInsightToggleButtons(familySurface, state, options.setFamilyInsightToggleButton);
        return;
    }
    state.expandedFamilyInsight = family;
    syncFamilyInsightToggleButtons(familySurface, state, options.setFamilyInsightToggleButton);
    if (openInlineRow && openInlineRow.parentNode) {
        openInlineRow.parentNode.removeChild(openInlineRow);
    }
    row.insertAdjacentHTML("afterend", options.familyInsightRowHtml(match));
    var inserted = row.nextElementSibling;
    if (inserted && inserted.classList && inserted.classList.contains("family-inline-insight-row")) {
        options.bindInsightPanelActions(inserted);
    }
}
function bindFamilySurfaceEndpointInteractions(options) {
    var familySurface = options.familySurface;
    var state = options.state;
    if (!familySurface)
        return;
    function collapseSelectedEndpointInline() {
        state.selectedEndpointId = "";
        state.userSelectedEndpoint = false;
        state.inspectingEndpointId = "";
        state.detailEvidenceOpenForId = "";
        options.renderFamilySurface();
        options.renderEndpointDiagnostics();
    }
    function openExactEvidence(endpointId) {
        state.inspectPlacementHint = "nested";
        state.detailEvidenceOpenForId = endpointId;
        options.selectEndpointForInspector(endpointId, "exact");
        options.syncWorkflowStepSelectionHighlight();
    }
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-expand-endpoints]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var family = btn.getAttribute("data-expand-endpoints") || "";
            if (!family)
                return;
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
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-expand-signals]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var family = btn.getAttribute("data-expand-signals") || "";
            if (!family)
                return;
            if (!state.expandedFamilySignals)
                state.expandedFamilySignals = {};
            if (state.expandedFamilySignals[family]) {
                delete state.expandedFamilySignals[family];
            }
            else {
                state.expandedFamilySignals[family] = true;
            }
            options.renderFamilySurface();
        });
        var expanded = !!(state.expandedFamilySignals && state.expandedFamilySignals[(btn.getAttribute("data-expand-signals") || "")]);
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-inspect-top-endpoint]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-inspect-top-endpoint") || "";
            if (!endpointId)
                return;
            options.selectEndpointForInspector(endpointId);
        });
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-endpoint-insight-toggle]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-endpoint-insight-toggle") || "";
            if (!endpointId)
                return;
            if (state.expandedEndpointInsightIds[endpointId]) {
                delete state.expandedEndpointInsightIds[endpointId];
            }
            else {
                state.expandedEndpointInsightIds[endpointId] = true;
            }
            options.renderFamilySurface();
        });
        var endpointExpanded = !!state.expandedEndpointInsightIds[(btn.getAttribute("data-endpoint-insight-toggle") || "")];
        btn.setAttribute("aria-expanded", endpointExpanded ? "true" : "false");
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-toggle-row-findings]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-toggle-row-findings") || "";
            if (!endpointId)
                return;
            if (state.expandedEndpointRowFindings[endpointId]) {
                delete state.expandedEndpointRowFindings[endpointId];
            }
            else {
                state.expandedEndpointRowFindings[endpointId] = true;
            }
            options.renderFamilySurface();
            options.syncSelectedEndpointHighlight();
        });
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-focus-endpoint]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-focus-endpoint") || "";
            if (!endpointId)
                return;
            if (state.selectedEndpointId === endpointId && state.userSelectedEndpoint) {
                collapseSelectedEndpointInline();
                return;
            }
            state.inspectPlacementHint = "nested";
            options.selectEndpointForInspector(endpointId);
        });
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-focus-family]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var family = btn.getAttribute("data-focus-family") || "";
            options.focusFamily(family);
        });
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll("button[data-open-evidence-id]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-open-evidence-id") || "";
            if (!endpointId)
                return;
            openExactEvidence(endpointId);
        });
    });
    Array.prototype.forEach.call(familySurface.querySelectorAll(".nested-endpoint-row[data-endpoint-id]"), function (tr) {
        tr.addEventListener("click", function () {
            var endpointId = tr.getAttribute("data-endpoint-id") || "";
            if (!endpointId)
                return;
            if (state.selectedEndpointId === endpointId && state.userSelectedEndpoint) {
                collapseSelectedEndpointInline();
                return;
            }
            state.inspectPlacementHint = "nested";
            options.selectEndpointForInspector(endpointId);
        });
    });
}
function bindEndpointListInteractions(options) {
    var endpointRows = options.endpointRows;
    var state = options.state;
    if (!endpointRows)
        return;
    Array.prototype.forEach.call(endpointRows.querySelectorAll("tr[data-id]"), function (tr) {
        tr.addEventListener("click", function () {
            options.selectEndpointForInspector(tr.getAttribute("data-id") || "");
        });
    });
    Array.prototype.forEach.call(endpointRows.querySelectorAll(".severity-badge.is-interactive"), function (badge) {
        badge.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var row = badge.closest("tr[data-id]");
            if (!row)
                return;
            var endpointId = row.getAttribute("data-id") || "";
            if (!endpointId)
                return;
            state.detailEvidenceOpenForId = endpointId;
            options.selectEndpointForInspector(endpointId, "exact");
        });
        badge.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ")
                return;
            event.preventDefault();
            badge.click();
        });
    });
    Array.prototype.forEach.call(endpointRows.querySelectorAll("button[data-focus-endpoint]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-focus-endpoint") || "";
            if (!endpointId)
                return;
            options.selectEndpointForInspector(endpointId);
        });
    });
    Array.prototype.forEach.call(endpointRows.querySelectorAll("button[data-toggle-row-findings]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-toggle-row-findings") || "";
            if (!endpointId)
                return;
            if (state.expandedEndpointRowFindings[endpointId]) {
                delete state.expandedEndpointRowFindings[endpointId];
            }
            else {
                state.expandedEndpointRowFindings[endpointId] = true;
            }
            options.renderEndpointRows();
        });
    });
}
function buildFindingGroupKeyFromContext(finding, context) {
    if (!finding)
        return "";
    if (finding.evidenceType === "spec-rule" && finding.specRuleId) {
        return "spec-rule|" + finding.specRuleId;
    }
    var ctx = context || {};
    return [
        finding.code || "",
        ctx.primaryLabel || "",
        ctx.primaryValue || "",
        ctx.mediaType || "",
        ctx.statusCode || ""
    ].join("|");
}
function buildIssueScopeIndex(rows, endpointDetails, findingsForActiveLens, getFindingGroupKey) {
    var index = {
        keyToEndpointIds: {},
        keyToFamilies: {},
        keyFamilyToEndpointIds: {}
    };
    (rows || []).forEach(function (row) {
        var family = row.family || "unlabeled family";
        var detail = endpointDetails ? endpointDetails[row.id] : null;
        if (!detail || !detail.findings)
            return;
        var findings = findingsForActiveLens(detail.findings || []);
        if (!findings.length)
            return;
        findings.forEach(function (finding) {
            var key = getFindingGroupKey(finding);
            if (!key)
                return;
            if (!index.keyToEndpointIds[key])
                index.keyToEndpointIds[key] = {};
            index.keyToEndpointIds[key][row.id] = true;
            if (!index.keyToFamilies[key])
                index.keyToFamilies[key] = {};
            index.keyToFamilies[key][family] = true;
            var familyKey = key + "||" + family;
            if (!index.keyFamilyToEndpointIds[familyKey]) {
                index.keyFamilyToEndpointIds[familyKey] = {};
            }
            index.keyFamilyToEndpointIds[familyKey][row.id] = true;
        });
    });
    return index;
}
function deriveIssueScopeLabelForKey(groupKey, familyName, issueScopeIndex) {
    if (!groupKey)
        return "Endpoint only";
    var index = issueScopeIndex || {
        keyToEndpointIds: {},
        keyToFamilies: {},
        keyFamilyToEndpointIds: {}
    };
    var endpoints = index.keyToEndpointIds[groupKey] || {};
    var endpointCount = Object.keys(endpoints).length;
    if (endpointCount <= 1)
        return "Endpoint only";
    var families = index.keyToFamilies[groupKey] || {};
    var familyCount = Object.keys(families).length;
    if (familyCount > 1)
        return "Repeated across current view";
    var familyKey = groupKey + "||" + (familyName || "unlabeled family");
    var familyEndpoints = index.keyFamilyToEndpointIds[familyKey] || {};
    if (Object.keys(familyEndpoints).length > 1)
        return "Repeated across family";
    return "Repeated across current view";
}
function extractOpenAPIContext(finding) {
    var message = finding.message || "";
    var context = {
        primaryLabel: "",
        primaryValue: "",
        mediaType: "",
        statusCode: "",
        parameterKind: "",
        parameterNames: ""
    };
    var mediaType = /media type '([^']+)'/.exec(message);
    if (mediaType)
        context.mediaType = mediaType[1];
    var responseMissingSchema = /^Response ([0-9]{3}) has no schema for media type/.exec(message);
    if (responseMissingSchema) {
        context.primaryLabel = "Response schema";
        context.statusCode = responseMissingSchema[1];
    }
    var responseMissingDescription = /^Response ([0-9]{3}) is missing a description/.exec(message);
    if (responseMissingDescription) {
        context.primaryLabel = "Response Object";
        context.statusCode = responseMissingDescription[1];
    }
    var requestMissingSchema = /^Request body has no schema for media type/.exec(message);
    if (requestMissingSchema) {
        context.primaryLabel = "Request schema";
    }
    var requestField = /^Request schema property '([^']+)'/.exec(message);
    if (requestField) {
        context.primaryLabel = "Request schema field";
        context.primaryValue = requestField[1];
    }
    var responseField = /^Response schema property '([^']+)'/.exec(message);
    if (responseField) {
        context.primaryLabel = "Response schema field";
        context.primaryValue = responseField[1];
    }
    var requestArray = /^Request body array has missing or overly generic items schema/.exec(message);
    if (requestArray) {
        context.primaryLabel = "Request schema field";
        context.primaryValue = "array items";
    }
    var responseArray = /^Response array has missing or overly generic items schema/.exec(message);
    if (responseArray) {
        context.primaryLabel = "Response schema field";
        context.primaryValue = "array items";
    }
    var followUpCandidates = /related detail endpoint\(s\): (.+)$/.exec(message);
    if (followUpCandidates) {
        context.primaryLabel = "Response schema field";
        context.primaryValue = followUpCandidates[1];
    }
    var responseItemField = /response item schema does not clearly expose an '([^']+)'/.exec(message);
    if (responseItemField) {
        context.primaryLabel = "Response schema field";
        context.primaryValue = responseItemField[1];
    }
    var trackingField = /tracking identifier such as (.+)$/.exec(message);
    if (trackingField) {
        context.primaryLabel = "Response schema field";
        context.primaryValue = trackingField[1];
        context.statusCode = context.statusCode || "202";
    }
    var pathParameters = /parameter names: (.+)$/.exec(message);
    if (pathParameters) {
        context.primaryLabel = "Path parameter";
        context.primaryValue = pathParameters[1];
        context.parameterKind = "path";
        context.parameterNames = pathParameters[1];
    }
    if (!context.primaryLabel) {
        if (finding.code === "generic-object-request" || finding.code === "missing-request-schema") {
            context.primaryLabel = "Request schema";
        }
        else if (finding.code === "generic-object-response"
            || finding.code === "missing-response-schema"
            || finding.code === "contract-shape-workflow-guidance-burden"
            || finding.code === "snapshot-heavy-response"
            || finding.code === "deeply-nested-response-structure"
            || finding.code === "duplicated-state-response"
            || finding.code === "incidental-internal-field-exposure"
            || finding.code === "weak-outcome-next-action-guidance") {
            context.primaryLabel = "Response schema";
        }
        else if (finding.code === "detail-path-parameter-name-drift"
            || finding.code === "endpoint-path-style-drift"
            || finding.code === "sibling-path-shape-drift") {
            context.primaryLabel = "Path parameter";
        }
        else if (finding.code === "prerequisite-task-burden") {
            context.primaryLabel = "Request parameter set";
        }
    }
    return context;
}
function groupFindingsByContext(findings, options) {
    var groups = {};
    (findings || []).forEach(function (finding) {
        var context = extractOpenAPIContext(finding);
        var isSpecRule = finding.evidenceType === "spec-rule";
        var key = buildFindingGroupKeyFromContext(finding, context);
        if (!groups[key]) {
            var groupContext = context || {};
            if (isSpecRule) {
                groupContext = Object.assign({}, groupContext, { statusCodes: [] });
            }
            var dimension = options.dimensionForFinding(finding.code, finding.category, finding.burdenFocus);
            groups[key] = {
                groupKey: key,
                code: finding.code || "n/a",
                severity: finding.severity || "info",
                dimension: dimension,
                context: groupContext,
                messages: [],
                count: 0,
                preview: finding.message || "",
                impact: options.dimensionImpact(dimension),
                inspectHint: options.findingExamineHint(finding.code, finding.message),
                title: (isSpecRule && finding.specRuleId)
                    ? ((options.specRuleSummary && options.specRuleSummary[finding.specRuleId]) || finding.specRuleId.replace(/^OAS-/, "").replace(/-/g, " "))
                    : options.formatIssueGroupTitle(finding, context),
                isSpecRule: isSpecRule,
                specRuleId: isSpecRule ? (finding.specRuleId || "") : "",
                normativeLevel: isSpecRule ? (finding.normativeLevel || "") : "",
                specSource: isSpecRule ? (finding.specSource || "") : ""
            };
        }
        groups[key].messages.push(finding.message || "");
        groups[key].count += 1;
        if (isSpecRule && context && context.statusCode) {
            var codes = groups[key].context.statusCodes || [];
            var codeStr = String(context.statusCode);
            if (codes.indexOf(codeStr) === -1)
                codes.push(codeStr);
            groups[key].context.statusCodes = codes;
            if (!groups[key].context.statusCode)
                groups[key].context.statusCode = codeStr;
        }
        if (options.severityPriority(finding.severity) < options.severityPriority(groups[key].severity)) {
            groups[key].severity = finding.severity;
        }
    });
    return Object.values(groups).sort(function (a, b) {
        if (options.severityPriority(a.severity) !== options.severityPriority(b.severity)) {
            return options.severityPriority(a.severity) - options.severityPriority(b.severity);
        }
        if (a.count !== b.count)
            return b.count - a.count;
        return a.title.localeCompare(b.title);
    });
}
function issueGroupRenderOpenAPIContextPills(context, compact, escapeHtml) {
    var pills = [];
    if (!compact) {
        if (context.primaryLabel && context.primaryValue) {
            pills.push('<span class="openapi-pill"><strong>' + escapeHtml(context.primaryLabel) + ':</strong> ' + escapeHtml(context.primaryValue) + '</span>');
        }
        else if (context.primaryLabel) {
            pills.push('<span class="openapi-pill"><strong>' + escapeHtml(context.primaryLabel) + '</strong></span>');
        }
        if (context.statusCode) {
            pills.push('<span class="openapi-pill"><strong>Response code:</strong> ' + escapeHtml(context.statusCode) + '</span>');
        }
    }
    if (context.mediaType) {
        pills.push('<span class="openapi-pill"><strong>Media type:</strong> ' + escapeHtml(context.mediaType) + '</span>');
    }
    if (!pills.length) {
        return compact ? '' : '<span class="openapi-pill subtle">OpenAPI location not derivable from this message.</span>';
    }
    return pills.join('');
}
function issueGroupRenderOpenAPILocationCuesBlock(context, compact, escapeHtml) {
    var pills = issueGroupRenderOpenAPIContextPills(context || createEmptyOpenAPIContext(), !!compact, escapeHtml);
    var body = pills
        ? ('<div class="openapi-summary-list">' + pills + '</div>')
        : '<p class="subtle location-cues-empty">No location cues available.</p>';
    return '<div class="location-cues-block">'
        + '<div class="location-cues-heading">OpenAPI location cues</div>'
        + body
        + '</div>';
}
function issueGroupFormatTitle(finding, context, issueDimensionForFinding) {
    var dimension = issueDimensionForFinding(finding.code, finding.category, finding.burdenFocus);
    if (context.primaryLabel === 'Request schema field' || context.primaryLabel === 'Response schema field' || context.primaryLabel === 'Path parameter') {
        return context.primaryValue ? context.primaryValue + ' | ' + dimension : dimension;
    }
    return dimension;
}
function issueGroupFormatCountLabel(group) {
    if (!group)
        return 'No grouped issue label available';
    var baseTitle = group.title || 'Grouped issue';
    var count = group.count || 0;
    var unit = count === 1 ? 'occurrence' : 'occurrences';
    return baseTitle + ' - ' + count + ' ' + unit + ' on this endpoint';
}
function issueGroupTopFieldPaths(groups, uniq) {
    return uniq((groups || []).map(function (group) {
        if (!group.context)
            return '';
        if (group.context.primaryLabel === 'Request schema field' || group.context.primaryLabel === 'Response schema field' || group.context.primaryLabel === 'Path parameter') {
            return group.context.primaryValue;
        }
        return '';
    })).slice(0, 6);
}
function issueGroupTopOpenAPIHighlights(groups, uniq) {
    var highlights = [];
    (groups || []).forEach(function (group) {
        if (group.context && group.context.primaryLabel) {
            if (group.context.primaryValue) {
                highlights.push(group.context.primaryLabel + ': ' + group.context.primaryValue);
            }
            else {
                highlights.push(group.context.primaryLabel);
            }
        }
        if (group.context && group.context.mediaType) {
            highlights.push('Media type: ' + group.context.mediaType);
        }
    });
    return uniq(highlights).slice(0, 6);
}
function issueGroupRenderGroup(group, index, options, helpers) {
    options = options || {};
    var escapeHtml = helpers.escapeHtml;
    var openAttr = index < 2 ? ' open' : '';
    var cap = 3;
    var visibleMsgs = (group.isSpecRule && group.messages.length > cap)
        ? group.messages.slice(0, cap) : group.messages;
    var hiddenCount = group.messages.length - visibleMsgs.length;
    var messageList = visibleMsgs.map(function (message) {
        return '<li>' + escapeHtml(message) + '</li>';
    }).join('');
    var expandMore = hiddenCount > 0
        ? '<details class="spec-rule-expand"><summary class="spec-rule-expand-toggle">+' + hiddenCount + ' more occurrences</summary>'
            + '<ul>' + group.messages.slice(cap).map(function (message) { return '<li>' + escapeHtml(message) + '</li>'; }).join('') + '</ul>'
            + '</details>'
        : '';
    var openAPICuesBlock = issueGroupRenderOpenAPILocationCuesBlock(group.context, true, escapeHtml);
    var specGrounding = group.isSpecRule ? helpers.renderSpecRuleGroundingForGroup(group) : '';
    var openAPIMeta = '  <div class="issue-group-meta">' + openAPICuesBlock + '</div>';
    function issueGroupKindLabel(innerGroup) {
        if (!innerGroup)
            return 'Issue';
        if (innerGroup.isSpecRule)
            return 'Spec rule';
        var dim = (innerGroup.dimension || '').trim();
        if (!dim)
            return 'Issue';
        return dim.replace(/(^|\s)([a-z])/g, function (_, prefix, chr) { return prefix + chr.toUpperCase(); });
    }
    function issueGroupHumanTitle(innerGroup) {
        if (!innerGroup)
            return 'Grouped issue';
        if (innerGroup.isSpecRule)
            return innerGroup.title || innerGroup.specRuleId || 'Spec rule';
        return innerGroup.title || innerGroup.preview || innerGroup.code || 'Issue';
    }
    function issueGroupResponseCodes(innerGroup) {
        var ctx = innerGroup && innerGroup.context ? innerGroup.context : createEmptyOpenAPIContext();
        if (ctx.statusCodes && ctx.statusCodes.length)
            return ctx.statusCodes.join('/');
        if (ctx.statusCode)
            return String(ctx.statusCode);
        return '';
    }
    function issueMetaChip(label, value, metaKey, useCode) {
        if (!value)
            return '';
        var renderedValue = useCode ? ('<code>' + escapeHtml(value) + '</code>') : escapeHtml(value);
        var keyAttr = metaKey ? (' data-meta="' + escapeHtml(metaKey) + '"') : '';
        return '<span class="issue-meta-chip"' + keyAttr + '><strong>' + escapeHtml(label) + ':</strong> ' + renderedValue + '</span>';
    }
    function issueMetaChips(innerGroup) {
        if (!innerGroup)
            return '';
        var ctx = innerGroup.context || createEmptyOpenAPIContext();
        var chips = [];
        var target = '';
        if (ctx.primaryLabel && ctx.primaryValue)
            target = ctx.primaryLabel + ': ' + ctx.primaryValue;
        else if (ctx.primaryLabel)
            target = ctx.primaryLabel;
        var responses = issueGroupResponseCodes(innerGroup);
        if (target)
            chips.push(issueMetaChip('Target', target, 'target', false));
        if (responses)
            chips.push(issueMetaChip('Responses', responses, 'responses', false));
        if (innerGroup.isSpecRule && innerGroup.specRuleId)
            chips.push(issueMetaChip('Rule', innerGroup.specRuleId, 'rule', true));
        var count = innerGroup.count || 0;
        if (count)
            chips.push('<span class="issue-meta-chip" data-meta="count"><strong>Count:</strong> ' + String(count) + ' deviation' + (count === 1 ? '' : 's') + '</span>');
        return chips.join('');
    }
    var scopeFamilyName = options.familyName || '';
    var scopeLabel = helpers.issueScopeLabelForKey(group.groupKey || '', scopeFamilyName);
    var commonScopeLabel = options.commonScopeLabel || '';
    var showScopeInline = !commonScopeLabel || scopeLabel !== commonScopeLabel;
    var scopePill = '<span class="issue-group-scope-pill" title="' + escapeHtml('Scope: ' + scopeLabel) + '"><strong>Scope:</strong> ' + escapeHtml(scopeLabel) + '</span>';
    var titleLine = issueGroupHumanTitle(group);
    var kindLabel = issueGroupKindLabel(group);
    var titleHtml = '<span class="issue-group-titleline" title="' + escapeHtml(titleLine) + '">' + escapeHtml(titleLine) + '</span>';
    var metaRow = '<span class="issue-group-meta-row">' + issueMetaChips(group) + '</span>';
    var inspectTarget = helpers.inspectTargetForGroup(group, options.endpoint || null) || group.inspectHint || '';
    return '<details class="issue-group'
        + (index > 0 ? ' issue-group-secondary' : '')
        + (group.isSpecRule ? ' issue-group-spec-rule' : '')
        + '"' + openAttr + '>'
        + '<summary>'
        + '<span class="issue-toggle-indicator"></span>'
        + helpers.severityBadge(group.severity)
        + '<span class="issue-group-summary-main">'
        + '<span class="issue-group-kind">' + escapeHtml(kindLabel) + '</span>'
        + titleHtml
        + metaRow
        + '</span>'
        + '<span class="issue-group-summary-side">'
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
function openApiTargetOperationPointer(endpoint) {
    if (!endpoint || !endpoint.method || !endpoint.path)
        return '';
    return 'paths["' + endpoint.path + '"].' + String(endpoint.method).toLowerCase();
}
function openApiTargetResponseObjectPointer(endpoint, statusCode) {
    var op = openApiTargetOperationPointer(endpoint);
    if (!op)
        return '';
    if (statusCode)
        return op + '.responses["' + statusCode + '"]';
    return op + '.responses';
}
function openApiTargetResponseSchemaPointer(endpoint, context) {
    var ctx = context || createEmptyOpenAPIContext();
    var base = openApiTargetResponseObjectPointer(endpoint, ctx.statusCode || '');
    if (!base)
        return '';
    if (ctx.mediaType) {
        return base + '.content["' + ctx.mediaType + '"].schema';
    }
    return base + '.content[mediaType].schema';
}
function openApiTargetRequestSchemaPointer(endpoint, context) {
    var ctx = context || createEmptyOpenAPIContext();
    var op = openApiTargetOperationPointer(endpoint);
    if (!op)
        return '';
    if (ctx.mediaType) {
        return op + '.requestBody.content["' + ctx.mediaType + '"].schema';
    }
    return op + '.requestBody.content[mediaType].schema';
}
function openApiTargetFormatWhere(endpoint, context, opts) {
    var options = opts || {};
    var ctx = context || createEmptyOpenAPIContext();
    var kind = options.kind || '';
    var pointer = '';
    var suffix = '';
    if (kind === 'response-description') {
        pointer = openApiTargetResponseObjectPointer(endpoint, ctx.statusCode || '');
        pointer = pointer ? (pointer + '.description') : '';
    }
    else if (kind === 'operation-id') {
        pointer = openApiTargetOperationPointer(endpoint);
        pointer = pointer ? (pointer + '.operationId') : '';
    }
    else if (kind === 'request-schema') {
        pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
    }
    else if (kind === 'request-field') {
        pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
        if (ctx.primaryValue)
            suffix = ' (field: ' + ctx.primaryValue + ')';
    }
    else if (kind === 'path-params') {
        pointer = openApiTargetOperationPointer(endpoint);
        pointer = pointer ? (pointer + '.parameters') : '';
        if (ctx.parameterNames || ctx.primaryValue) {
            suffix = ' (path params: ' + (ctx.parameterNames || ctx.primaryValue) + ')';
        }
    }
    else if (kind === 'response-object') {
        pointer = openApiTargetResponseObjectPointer(endpoint, ctx.statusCode || '');
    }
    else if (kind === 'response-field') {
        pointer = openApiTargetResponseSchemaPointer(endpoint, ctx);
        if (ctx.primaryValue)
            suffix = ' (field: ' + ctx.primaryValue + ')';
    }
    else {
        pointer = openApiTargetResponseSchemaPointer(endpoint, ctx);
        if (ctx.primaryLabel === 'Request schema')
            pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
        if (ctx.primaryLabel === 'Request schema field') {
            pointer = openApiTargetRequestSchemaPointer(endpoint, ctx);
            if (ctx.primaryValue)
                suffix = ' (field: ' + ctx.primaryValue + ')';
        }
        if (ctx.primaryLabel === 'Path parameter') {
            pointer = openApiTargetOperationPointer(endpoint);
            pointer = pointer ? (pointer + '.parameters') : '';
            if (ctx.primaryValue)
                suffix = ' (path params: ' + ctx.primaryValue + ')';
        }
    }
    if (!pointer) {
        var fallback = (endpoint && endpoint.method && endpoint.path)
            ? ('operation ' + endpoint.method + ' ' + endpoint.path)
            : 'this endpoint';
        return fallback;
    }
    return 'OpenAPI: ' + pointer + suffix;
}
function openApiRenderSpecRuleGroundingForGroup(group, escapeHtml) {
    if (!group.isSpecRule || !group.specRuleId)
        return '';
    var levelClass = (group.normativeLevel === 'REQUIRED' || group.normativeLevel === 'MUST' || group.normativeLevel === 'MUST NOT')
        ? 'spec-level-must' : 'spec-level-should';
    return '<div class="spec-rule-grounding">'
        + '<span class="spec-norm-badge ' + levelClass + '">' + escapeHtml(group.normativeLevel || '') + '</span>'
        + '<span class="spec-source">' + escapeHtml(group.specSource || '') + '</span>'
        + '</div>';
}
function openApiInspectTargetForGroup(group, endpoint) {
    if (!group)
        return '';
    var ctx = group.context || createEmptyOpenAPIContext();
    if (group.isSpecRule) {
        var ruleId = group.specRuleId || '';
        if (ruleId === 'OAS-RESPONSE-DESCRIPTION-REQUIRED') {
            return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-description' });
        }
        if (ruleId === 'OAS-OPERATION-ID-UNIQUE') {
            return openApiTargetFormatWhere(endpoint, ctx, { kind: 'operation-id' });
        }
        if (ruleId === 'OAS-NO-SUCCESS-RESPONSE') {
            var successTarget = openApiTargetResponseObjectPointer(endpoint, '200');
            return successTarget ? ('OpenAPI: ' + successTarget + '.content[mediaType].schema') : '';
        }
        if (ruleId === 'OAS-GET-REQUEST-BODY') {
            var operationTarget = openApiTargetOperationPointer(endpoint);
            return operationTarget ? ('OpenAPI: ' + operationTarget + '.requestBody') : '';
        }
        if (ruleId === 'OAS-204-HAS-CONTENT') {
            var noContentTarget = openApiTargetResponseObjectPointer(endpoint, '204');
            return noContentTarget ? ('OpenAPI: ' + noContentTarget + '.content') : '';
        }
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-object' });
    }
    if (ctx.primaryLabel === 'Response schema field') {
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-field' });
    }
    if (ctx.primaryLabel === 'Request schema field') {
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'request-field' });
    }
    if (ctx.primaryLabel === 'Response schema') {
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-schema' });
    }
    if (ctx.primaryLabel === 'Request schema') {
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'request-schema' });
    }
    if (ctx.primaryLabel === 'Path parameter') {
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'path-params' });
    }
    if (ctx.primaryLabel === 'Response Object') {
        return openApiTargetFormatWhere(endpoint, ctx, { kind: 'response-object' });
    }
    return openApiTargetFormatWhere(endpoint, ctx, {});
}
function contractImprovementDescribeWhere(context, fallback) {
    if (!context)
        return fallback;
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
function contractImprovementBuildItemForFinding(finding, endpoint, helpers) {
    var code = finding.code || '';
    var context = helpers.extractOpenAPIContext(finding);
    var endpointLabel = (endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : 'this endpoint';
    if (finding.evidenceType === 'spec-rule') {
        var ruleId = finding.specRuleId || code;
        if (ruleId === 'OAS-RESPONSE-DESCRIPTION-REQUIRED') {
            var descriptionTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-description' });
            return {
                change: 'Add a non-empty `description` to the Response Object.',
                where: descriptionTarget,
                inspect: descriptionTarget,
                why: helpers.specRuleWhy[ruleId] || 'Docs and generated clients need response semantics to remain clear.'
            };
        }
        if (ruleId === 'OAS-OPERATION-ID-UNIQUE') {
            var operationIdTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'operation-id' });
            return {
                change: 'Rename `operationId` to a unique value (no duplicates across the spec).',
                where: operationIdTarget,
                inspect: operationIdTarget,
                why: helpers.specRuleWhy[ruleId] || 'Tooling that keys by operationId can break when IDs collide.'
            };
        }
        if (ruleId === 'OAS-NO-SUCCESS-RESPONSE') {
            var successTarget = helpers.openApiResponseObjectPointer(endpoint, '200');
            var successInspect = successTarget ? ('OpenAPI: ' + successTarget + '.content[mediaType].schema') : endpointLabel;
            return {
                change: 'Add at least one 2xx success response with an explicit schema (typically `200`).',
                where: successInspect,
                inspect: successInspect,
                why: helpers.specRuleWhy[ruleId] || 'Clients cannot know the happy-path shape without a declared success response.'
            };
        }
        if (ruleId === 'OAS-GET-REQUEST-BODY') {
            var requestBodyTarget = helpers.openApiOperationPointer(endpoint);
            var requestInspect = requestBodyTarget ? ('OpenAPI: ' + requestBodyTarget + '.requestBody') : endpointLabel;
            return {
                change: 'Remove the request body from this GET/HEAD operation (move inputs to query params or change to POST).',
                where: requestInspect,
                inspect: requestInspect,
                why: helpers.specRuleWhy[ruleId] || 'HTTP intermediaries and tooling may drop or mishandle GET bodies.'
            };
        }
        if (ruleId === 'OAS-204-HAS-CONTENT') {
            var noContentTarget = helpers.openApiResponseObjectPointer(endpoint, '204');
            var noContentInspect = noContentTarget ? ('OpenAPI: ' + noContentTarget + '.content') : endpointLabel;
            return {
                change: 'Remove response content/schema from the 204 response (204 must not include a body).',
                where: noContentInspect,
                inspect: noContentInspect,
                why: helpers.specRuleWhy[ruleId] || 'Clients may mis-handle responses when 204 contradicts a response body.'
            };
        }
    }
    if (code === 'missing-response-schema') {
        var responseSchemaTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
        return {
            change: 'Define an explicit response schema instead of leaving this response untyped.',
            where: responseSchemaTarget,
            inspect: responseSchemaTarget,
            why: 'Clients can generate typed models, validate the payload, and stop guessing which fields are safe to read.'
        };
    }
    if (code === 'generic-object-response') {
        var genericTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
        return {
            change: 'Replace the generic object response with a named schema that lists the actual fields returned.',
            where: genericTarget,
            inspect: genericTarget,
            why: 'Clients can code against documented fields instead of probing the payload at runtime.'
        };
    }
    if (code === 'weak-array-items-schema') {
        var itemsTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-field' });
        return {
            change: 'Define the array item schema with named properties instead of leaving items generic.',
            where: itemsTarget,
            inspect: itemsTarget,
            why: 'Clients can iterate over collection items with stable field names and fewer defensive null checks.'
        };
    }
    if (code === 'deeply-nested-response-structure') {
        var nestedTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
        return {
            change: 'Promote the task outcome and handoff fields to the top level of the response instead of burying them in nested objects.',
            where: nestedTarget,
            inspect: nestedTarget,
            why: 'Clients can find the result and next-step data quickly without walking a deep object tree.'
        };
    }
    if (code === 'duplicated-state-response') {
        var duplicateTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
        return {
            change: 'Remove duplicate state copies and keep one authoritative representation of the resource state.',
            where: duplicateTarget,
            inspect: duplicateTarget,
            why: 'Clients stop choosing between conflicting copies of the same state and reduce silent drift bugs.'
        };
    }
    if (code === 'incidental-internal-field-exposure') {
        var internalField = context.primaryValue || '';
        var internalTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: internalField ? 'response-field' : 'response-schema' });
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
        var followUpTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-field' });
        return {
            change: 'Add an explicit follow-up field that names the next endpoint or returns the handoff identifier needed for the next call.',
            where: followUpTarget,
            inspect: followUpTarget,
            why: 'Clients can continue the workflow without reverse-engineering which identifier to carry forward.'
        };
    }
    if (code === 'weak-outcome-next-action-guidance') {
        var outcomeTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
        return {
            change: 'Add explicit outcome and next-action fields to the response contract.',
            where: outcomeTarget,
            inspect: outcomeTarget,
            why: 'Clients can tell what changed and what operation is valid next without reading docs or guessing from status alone.'
        };
    }
    if (code === 'prerequisite-task-burden') {
        var prereqTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, {
            kind: (context.primaryLabel && context.primaryLabel.indexOf('Request') === 0) ? 'request-schema' : 'path-params'
        });
        return {
            change: 'Document prerequisite inputs as explicit request fields or required parameters instead of leaving them implicit.',
            where: prereqTarget,
            inspect: prereqTarget,
            why: 'Clients learn which prior state is mandatory before calling the endpoint and fail less often in multi-step flows.'
        };
    }
    if (code === 'detail-path-parameter-name-drift') {
        var paramTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'path-params' });
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
        var alignTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'response-schema' });
        return {
            change: 'Align this response schema with sibling endpoints so the same concept is returned under the same field structure.',
            where: alignTarget,
            inspect: alignTarget,
            why: 'Clients can share parsing code across sibling routes instead of branching on endpoint-specific payload shapes.'
        };
    }
    if (code === 'missing-request-schema') {
        var requestSchemaTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'request-schema' });
        return {
            change: 'Define the request body schema and mark the required fields explicitly.',
            where: requestSchemaTarget,
            inspect: requestSchemaTarget,
            why: 'Clients can construct valid requests without trial-and-error against server validation.'
        };
    }
    if (code === 'generic-object-request') {
        var requestObjectTarget = helpers.formatWhereWithOpenAPITarget(endpoint, context, { kind: 'request-schema' });
        return {
            change: 'Replace the generic request object with a named request schema that lists supported fields.',
            where: requestObjectTarget,
            inspect: requestObjectTarget,
            why: 'Clients know which inputs are accepted and can generate typed request builders.'
        };
    }
    if (code === 'likely-missing-enum') {
        var msg = finding.message || '';
        var enumField = (msg.match(/property '([^']+)'/) || msg.match(/field '([^']+)'/));
        var field = enumField ? enumField[1] : (context.primaryValue || '');
        var enumContext = Object.assign({}, context);
        if (!enumContext.primaryValue && field)
            enumContext.primaryValue = field;
        var enumTarget = helpers.formatWhereWithOpenAPITarget(endpoint, enumContext, { kind: field ? 'response-field' : 'response-schema' });
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
function contractImprovementBuildItems(detail, findings, contractImprovementForFinding) {
    var endpoint = (detail && detail.endpoint) || { id: "", method: "", path: "" };
    var items = [];
    var seen = {};
    (findings || []).forEach(function (finding) {
        var item = contractImprovementForFinding(finding, endpoint);
        if (!item)
            return;
        var key = [item.change, item.where, item.why].join('|');
        if (seen[key])
            return;
        seen[key] = true;
        items.push(item);
    });
    return items.slice(0, 6);
}
function diagnosticsCollectShapePainSignals(endpoint, findings) {
    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    var method = ((endpoint && endpoint.method) || '').toUpperCase();
    var signals = [];
    function hasCode(code) {
        return (findings || []).some(function (f) { return (f.code || '') === code; });
    }
    function hasMsgMatch(re) {
        return (findings || []).some(function (f) { return re.test((f.message || '').toLowerCase()); });
    }
    var isOrder = /\/order/.test(path);
    var isCart = /\/cart/.test(path);
    var isPayment = /\/payment|\/checkout/.test(path);
    var isProduct = /\/product/.test(path);
    var isCustomer = /\/customer/.test(path);
    var isAction = path.indexOf('/_action/') !== -1;
    var isMutation = method === 'POST' || method === 'PATCH' || method === 'PUT';
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
            pain: 'When the same concept appears under multiple keys, developers pick one and rely on it. When those values diverge in production (cache lag, eventual consistency, partial update), the bug is silent until a customer notices. Client code that picked the "wrong" duplicate is correct until the day it isn\'t.',
            example: dupEx,
            callerNeeded: dupNeeded,
            notice: 'The same domain concept is represented multiple ways with no contract hint about which field is authoritative.',
            recommendedChange: 'Pick one canonical field for the concept (status/total/etc), remove duplicates, and if derived views must remain, label them explicitly as derived/read-only.',
            icon: 'State'
        });
    }
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
            pain: 'Internal fields force developers to figure out which fields matter. They become accidental documentation targets: once a developer couples client code to versionId or autoIncrement, those fields can\'t be renamed without a breaking change. The contract grows stickier in the wrong direction.',
            example: intEx,
            callerNeeded: intNeeded,
            notice: 'Backend/audit/join fields appear alongside domain fields at equal depth, encouraging accidental coupling.',
            recommendedChange: 'Remove internal/audit fields from the default success payload (or move them to explicitly internal components/endpoints) and keep only domain + workflow-handoff fields.',
            icon: 'Internal'
        });
    }
    if (hasCode('weak-outcome-next-action-guidance') || hasMsgMatch(/outcome|what changed|result mean/)) {
        var outEx = isPayment
            ? 'POST /handle-payment returns 200 but the body doesn\'t indicate whether payment was accepted, deferred, or requires redirect. The developer writes a secondary GET to confirm state — a round-trip the contract could have eliminated.'
            : isAction
                ? 'An /_action/ endpoint returns 200 with data but no outcome framing. Was the action applied? Is it pending? Does the caller need to poll? The developer must infer this from context or read docs each time.'
                : isMutation
                    ? 'A mutation (POST/PATCH/PUT) returns the resource but doesn\'t clearly distinguish between \'I applied your changes immediately\' and \'I queued them\' or \'this requires a follow-up confirmation step\'.'
                    : 'The response contains populated fields but no framing that contextualises the result. Success vs partial success vs async acceptance look the same to the caller.';
        var outNeeded = isPayment
            ? '{ "outcome": "redirect_required", "redirectUrl": "…", "transactionId": "…", "pollFor": "transaction.status" }'
            : isAction
                ? '{ "outcome": "accepted", "appliedNow": false, "transitionTo": "in_progress", "followUp": "/order/{id}/state" }'
                : '{ "applied": true, "status": "confirmed", "nextAction": null } — or for async: { "accepted": true, "pendingConfirmation": true, "confirmUrl": "…" }';
        signals.push({
            code: 'missing-outcome',
            label: 'Missing outcome framing — caller must infer what happened',
            pain: 'Without explicit outcome framing, developers write defensive code that checks 3–4 fields to infer state. "Did it work?" becomes a runtime question that needs a contract-level answer. Integration tests grow complex because they must mock guesses rather than trust explicit outcome fields.',
            example: outEx,
            callerNeeded: outNeeded,
            notice: 'Success/accepted/pending outcomes look the same; clients must poll or do follow-up reads to confirm what happened.',
            recommendedChange: 'Add explicit outcome fields (applied/accepted/pending, status, trackingId/confirmUrl) so clients can continue without reverse-engineering.',
            icon: 'Outcome'
        });
    }
    if (hasCode('weak-follow-up-linkage') || hasCode('weak-action-follow-up-linkage') || hasCode('weak-accepted-tracking-linkage') || hasMsgMatch(/next[-\s]?step|follow[-\s]?up|tracking/)) {
        var nextEx = isOrder
            ? 'POST /order succeeds but the response doesn\'t include a payment URL, whether confirmation is needed, or any indication of required customer steps. The developer reads the API docs or asks in Slack to learn these rules — then hard-codes assumptions that can break when the payment provider changes.'
            : isCart
                ? 'PATCH /cart returns the updated cart but doesn\'t indicate whether the cart is now ready for checkout or if there are blockers (e.g., shipping method not selected, item now out of stock). The developer polls or adds defensive checks.'
                : 'The operation completes but the response does not expose what the next call needs to be, which ID to carry forward, or whether additional steps are required before the workflow continues.';
        var nextNeeded = isOrder
            ? '{ "orderId": "…", "status": "open", "nextActions": [{ "type": "payment", "url": "…", "required": true }] }'
            : isCart
                ? '{ "token": "…", "readyForCheckout": false, "blockers": [{ "type": "shippingMethod", "message": "Select a shipping method to continue" }] }'
                : 'An explicit nextAction field or _links object that guides the caller to the next step without requiring out-of-band documentation.';
        signals.push({
            code: 'missing-next-action',
            label: 'Missing next-action cues — handoff requires reading docs',
            pain: 'Without next-step cues, developers learn the call sequence from documentation, Slack questions, or reverse-engineering prior implementations. This multiplies per-developer integration time and produces brittle hard-coded assumptions about workflow sequencing — assumptions that break when the workflow changes.',
            example: nextEx,
            callerNeeded: nextNeeded,
            notice: 'The response does not name the next valid operation or provide the identifier/linkage needed for the next step.',
            recommendedChange: 'Expose `nextActions` (or `_links`) with the next endpoint(s), required context, and handoff IDs so the workflow can be chained deterministically.',
            icon: 'Next'
        });
    }
    return signals;
}
function diagnosticsCollectConcreteNextActions(endpoint, findings, helpers) {
    var actions = [];
    var seen = {};
    function push(action) {
        if (!action)
            return;
        var key = action.trim().toLowerCase();
        if (!key || seen[key])
            return;
        seen[key] = true;
        actions.push(action);
    }
    var endpointLabel = (endpoint && endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : 'this endpoint';
    var lensFindings = helpers.findingsForActiveLens(findings || []);
    var missingDescCodes = {};
    lensFindings.forEach(function (finding) {
        if (!finding || finding.evidenceType !== 'spec-rule')
            return;
        var ruleId = finding.specRuleId || finding.code || '';
        if (ruleId !== 'OAS-RESPONSE-DESCRIPTION-REQUIRED')
            return;
        var ctx = helpers.extractOpenAPIContext(finding);
        if (ctx && ctx.statusCode)
            missingDescCodes[ctx.statusCode] = true;
    });
    var descCodes = Object.keys(missingDescCodes).sort();
    if (descCodes.length) {
        push('Add missing response descriptions for responses ' + descCodes.join('/') + ' on ' + endpointLabel + '.');
    }
    var enumField = '';
    lensFindings.some(function (finding) {
        if (!finding)
            return false;
        if ((finding.code || '') !== 'likely-missing-enum')
            return false;
        var msg = finding.message || '';
        var match = msg.match(/property '([^']+)'/) || msg.match(/field '([^']+)'/);
        enumField = match ? match[1] : (helpers.extractOpenAPIContext(finding).primaryValue || '');
        return true;
    });
    if (enumField) {
        push('Declare enum values for ' + enumField + '.');
    }
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
    if (actions.length < 1) {
        var items = helpers.buildContractImprovementItems({ endpoint: endpoint }, lensFindings);
        items.slice(0, 2).forEach(function (item) {
            if (!item || !item.change)
                return;
            push(item.change + (item.where ? (' (Where: ' + item.where + ')') : ''));
        });
    }
    return actions;
}
function diagnosticsRenderWhatToDoNextBlock(endpoint, findings, options, helpers) {
    var opts = options || {};
    var maxItems = typeof opts.maxItems === 'number' ? opts.maxItems : 2;
    var endpointLabel = (endpoint && endpoint.method && endpoint.path) ? (endpoint.method + ' ' + endpoint.path) : '';
    var actions = helpers.collectConcreteNextActions(endpoint || createEmptyEndpointRow(), findings || []);
    if (!actions.length)
        return '';
    actions = actions.slice(0, Math.max(1, maxItems));
    var headline = 'What to do next';
    var lead = opts.leadCopy || 'Pick one of these concrete changes and apply it directly in the OpenAPI contract.';
    return '<section class="next-actions-block" aria-label="' + helpers.escapeHtml(headline) + '">'
        + '<p class="next-actions-title">' + helpers.escapeHtml(headline) + '</p>'
        + (lead ? '<p class="subtle next-actions-lead">' + helpers.escapeHtml(lead) + '</p>' : '')
        + '<ul class="next-actions-list">'
        + actions.map(function (a) { return '<li>' + helpers.escapeHtml(a) + '</li>'; }).join('')
        + '</ul>'
        + (endpointLabel && opts.showEndpointLabel ? '<p class="subtle next-actions-endpoint">' + helpers.escapeHtml(endpointLabel) + '</p>' : '')
        + '</section>';
}
function diagnosticsRenderCleaner(detail, helpers) {
    var findings = helpers.findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var improvementItems = helpers.buildContractImprovementItems(detail, findings);
    var painSignals = helpers.collectShapePainSignals(endpoint, findings);
    var signalSummaryHtml = painSignals.length
        ? '<div class="cleaner-signal-summary">'
            + painSignals.map(function (s) {
                return '<span class="cleaner-signal-chip">' + s.icon + ' ' + helpers.escapeHtml(s.label) + '</span>';
            }).join('')
            + '</div>'
        : '';
    if (improvementItems.length) {
        return '<div class="endpoint-diag-pane">'
            + signalSummaryHtml
            + '<section class="detail-section detail-section-tight contract-improvements-list">'
            + '<h3>Contract improvements</h3>'
            + '<p class="subtle detail-section-copy">Concrete response/schema edits for <strong>' + helpers.escapeHtml(endpoint.method + ' ' + endpoint.path) + '</strong>.</p>'
            + '<div class="contract-improvements-items">'
            + improvementItems.map(function (item) {
                var inspect = item.inspect || item.where || '';
                return '<article class="contract-improvement-item">'
                    + '<p><strong>Change:</strong> ' + helpers.escapeHtml(item.change) + '</p>'
                    + '<p><strong>Where:</strong> ' + helpers.escapeHtml(item.where) + '</p>'
                    + (inspect ? ('<p><strong>Inspect in schema:</strong> ' + helpers.escapeHtml(inspect) + '</p>') : '')
                    + '<p><strong>Why:</strong> ' + helpers.escapeHtml(item.why) + '</p>'
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
function diagnosticsRenderConsistency(detail, helpers) {
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var findings = detail.findings || [];
    var consistencyFindings = helpers.consistencyFindingsForDetail(findings);
    var siblings = ((helpers.payload && helpers.payload.endpoints) || []).filter(function (row) {
        return row.id !== helpers.selectedEndpointId && (row.family || 'unlabeled family') === (endpoint.family || 'unlabeled family');
    }).slice(0, 6);
    var codesSeen = {};
    consistencyFindings.forEach(function (f) {
        codesSeen[f.code || ''] = true;
    });
    var driftBullets = [];
    if (codesSeen['detail-path-parameter-name-drift'])
        driftBullets.push('Parameter naming drift detected for this endpoint.');
    if (codesSeen['endpoint-path-style-drift'] || codesSeen['sibling-path-shape-drift'])
        driftBullets.push('Path style drift detected against sibling routes.');
    if (codesSeen['inconsistent-response-shape'] || codesSeen['inconsistent-response-shape-family'] || codesSeen['inconsistent-response-shapes'] || codesSeen['inconsistent-response-shapes-family']) {
        driftBullets.push('Response shape/outcome drift detected in related endpoints.');
    }
    return '<div class="endpoint-diag-pane">'
        + '<div class="family-insight-card">'
        + '<p class="insight-kicker">Consistency / drift for selected endpoint</p>'
        + '<p class="subtle">Selection context: ' + helpers.escapeHtml(endpoint.method + ' ' + endpoint.path) + ' | ' + helpers.escapeHtml(helpers.humanFamilyLabel(endpoint.family)) + '</p>'
        + (driftBullets.length
            ? '<ul class="family-top-evidence">' + driftBullets.map(function (b) { return '<li>' + helpers.escapeHtml(b) + '</li>'; }).join('') + '</ul>'
            : '<p class="subtle">No direct consistency drift findings are attached to this endpoint in the current view.</p>')
        + (consistencyFindings.length
            ? '<details class="detail-evidence-drawer">'
                + '<summary>Consistency evidence (' + consistencyFindings.length + ')</summary>'
                + '<ul class="family-top-evidence">'
                + consistencyFindings.slice(0, 8).map(function (f) { return '<li><strong>' + helpers.escapeHtml(f.code || 'consistency') + ':</strong> ' + helpers.escapeHtml(f.message || '') + '</li>'; }).join('')
                + '</ul>'
                + '</details>'
            : '')
        + (siblings.length
            ? '<p class="insight-kicker endpoint-diag-subkicker">Sibling endpoints for comparison</p><ul class="family-workflow-context">'
                + siblings.map(function (s) { return '<li>' + helpers.escapeHtml(s.method + ' ' + s.path) + '</li>'; }).join('')
                + '</ul>'
            : '<p class="subtle">No sibling endpoints available in this family for drift comparison.</p>')
        + '</div>'
        + '</div>';
}
function diagnosticsRenderConsistencySupportCard(detail, options, helpers) {
    var opts = options || {};
    var endpoint = (detail && detail.endpoint) || createEmptyEndpointRow();
    var consistencyFindings = helpers.consistencyFindingsForDetail((detail && detail.findings) || []);
    var lines = [];
    var codesSeen = {};
    consistencyFindings.forEach(function (f) {
        codesSeen[f.code || ''] = true;
    });
    if (codesSeen['detail-path-parameter-name-drift'])
        lines.push('Parameter naming drift vs sibling routes.');
    if (codesSeen['endpoint-path-style-drift'] || codesSeen['sibling-path-shape-drift'])
        lines.push('Path style drift against related endpoints.');
    if (codesSeen['inconsistent-response-shape'] || codesSeen['inconsistent-response-shape-family'] || codesSeen['inconsistent-response-shapes'] || codesSeen['inconsistent-response-shapes-family']) {
        lines.push('Response shape or outcome wording drift across similar operations.');
    }
    var body = lines.length
        ? '<ul class="family-top-evidence">' + lines.slice(0, 3).map(function (line) { return '<li>' + helpers.escapeHtml(line) + '</li>'; }).join('') + '</ul>'
        : '<p class="subtle">' + helpers.escapeHtml(opts.emptyText || 'No direct consistency/drift signal is attached to this endpoint.') + '</p>';
    return '<div class="family-insight-card">'
        + '<p class="insight-kicker">' + helpers.escapeHtml(opts.title || 'Consistency / drift (supporting view)') + '</p>'
        + '<p class="subtle">' + helpers.escapeHtml(endpoint.method + ' ' + endpoint.path) + ' keeps drift analysis available as supporting context, not a primary navigation path.</p>'
        + body
        + '</div>';
}
var appShellStickyMetricsQueued = false;
function bindControls() {
    window.addEventListener("resize", queueStickyLayoutMetrics);
    if (el.searchInput) {
        el.searchInput.addEventListener("input", function (event) {
            var prevSearch = state.filters.search || "";
            var target = event.target;
            var nextSearch = target ? target.value.trim().toLowerCase() : "";
            if (!state.familyTableBackState && prevSearch !== nextSearch && isExactFamilyName(nextSearch)) {
                captureFamilyTableBackStateIfNeeded(state, { search: prevSearch });
            }
            applyFilterStateChange(state, function () {
                state.filters.search = nextSearch;
            }, invalidateDerivedCaches, render);
        });
    }
    if (el.familyPriorityFilter) {
        el.familyPriorityFilter.addEventListener("change", function (event) {
            var target = event.target;
            applyFilterStateChange(state, function () {
                state.filters.familyPressure = target ? target.value : "all";
            }, invalidateDerivedCaches, render);
        });
    }
}
function invalidateDerivedCaches() {
    state.issueScopeIndex = null;
    state.issueScopeIndexKey = "";
}
function isExactFamilyName(value) {
    if (!value || value.charAt(0) !== "/" || !state.payload || !state.payload.endpoints)
        return false;
    return (state.payload.endpoints || []).some(function (row) {
        return (row.family || "").trim().toLowerCase() === value;
    });
}
function renderFilterOptions() {
    if (!state.payload)
        return;
    var datalist = document.getElementById("searchSuggestions");
    if (datalist) {
        var families = uniq(state.payload.endpoints.map(function (row) { return row.family; })).sort();
        datalist.innerHTML = families.concat(["GET", "POST", "PATCH", "PUT", "DELETE"]).map(function (value) {
            return '<option value="' + escapeHtml(value) + '">';
        }).join("");
    }
}
function activeTopTabConfig() {
    return TOP_TAB_INDEX[state.activeTopTab] || TOP_TAB_INDEX["spec-rule"];
}
function isKnownTopTab(id) {
    return !!TOP_TAB_INDEX[id];
}
function render() {
    if (!isKnownTopTab(state.activeTopTab)) {
        applyTabDefaults(state, "spec-rule", TOP_TAB_INDEX);
    }
    renderFilterOptions();
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
function syncStickyLayoutMetrics() {
    var doc = document.documentElement;
    if (!doc)
        return;
    var topbar = document.querySelector(".topbar");
    var actionBar = document.querySelector(".action-bar");
    var topbarHeight = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
    var actionBarHeight = actionBar ? Math.ceil(actionBar.getBoundingClientRect().height) : 0;
    doc.style.setProperty("--topbar-height", topbarHeight + "px");
    doc.style.setProperty("--action-bar-height", actionBarHeight + "px");
}
function queueStickyLayoutMetrics() {
    if (appShellStickyMetricsQueued)
        return;
    appShellStickyMetricsQueued = true;
    window.requestAnimationFrame(function () {
        appShellStickyMetricsQueued = false;
        syncStickyLayoutMetrics();
    });
}
function syncLensVisualIdentity() {
    if (!document || !document.body)
        return;
    var active = activeTopTabConfig();
    TOP_TABS.forEach(function (tab) {
        document.body.classList.toggle(tab.bodyClass, tab.id === active.id);
    });
    if (el.familySurfaceSection) {
        el.familySurfaceSection.classList.toggle("shape-primary-surface", active.id === "shape");
    }
    if (el.endpointListSection) {
        el.endpointListSection.classList.toggle("shape-secondary-surface", active.id === "shape");
    }
}
function renderHeader() {
    if (!state.payload || !el.runContext)
        return;
    var run = state.payload.run || {};
    var diffTag = run.baseSpecPath && run.headSpecPath ? (" | diff: " + run.baseSpecPath + " -> " + run.headSpecPath) : "";
    el.runContext.textContent = "spec: " + run.specPath + " | generated: " + run.generatedAt + diffTag;
}
function renderQuickActions() {
    if (!el.quickActions)
        return;
    el.quickActions.innerHTML = TOP_TABS.map(function (action) {
        var activeClass = state.activeTopTab === action.id ? " active" : "";
        var workflowActiveClass = (action.id === "workflow" && state.activeTopTab === "workflow") ? " workflow-active" : "";
        var titleAttr = action.id === "spec-rule" ? "" : (' title="' + escapeHtml(action.label) + '"');
        return '<button type="button" class="quick-action quick-action-' + escapeHtml(action.color) + activeClass + workflowActiveClass + '" data-id="' + action.id + '"' + titleAttr + ">"
            + '<span class="quick-label">' + escapeHtml(action.label) + "</span>"
            + '<span class="quick-copy">' + escapeHtml(action.copy) + "</span>"
            + "</button>";
    }).join("");
    Array.prototype.forEach.call(el.quickActions.querySelectorAll("button[data-id]"), function (btn) {
        btn.addEventListener("click", function () {
            applyQuickAction(btn.getAttribute("data-id") || "");
        });
    });
}
function renderResetControl() {
    if (!el.resetControl)
        return;
    el.resetControl.innerHTML = '<button type="button" class="reset-btn" data-id="clear-current-lens" title="Reset filters">Reset filters</button>';
    Array.prototype.forEach.call(el.resetControl.querySelectorAll("button[data-id]"), function (btn) {
        btn.addEventListener("click", function () {
            applyQuickAction(btn.getAttribute("data-id") || "");
        });
    });
}
function applyQuickAction(id) {
    if (id === "clear-current-lens") {
        clearCurrentLens();
        return;
    }
    if (!isKnownTopTab(id))
        return;
    if (el.familySurface)
        el.familySurface.scrollLeft = 0;
    if (el.endpointRows) {
        var endpointSurface = el.endpointRows.closest(".endpoint-list-surface");
        if (endpointSurface)
            endpointSurface.scrollLeft = 0;
    }
    resetInlineUiState(state);
    state.familyTableShowAll = false;
    applyTabDefaults(state, id, TOP_TAB_INDEX, { resetFilters: true });
    render();
}
function clearCurrentLens() {
    var tab = isKnownTopTab(state.activeTopTab) ? state.activeTopTab : "spec-rule";
    resetInlineUiState(state);
    state.familyTableShowAll = false;
    applyTabDefaults(state, tab, TOP_TAB_INDEX, { resetFilters: true });
    render();
    pulseLensUpdate();
}
function appRuntimeSyncControls() {
    el.searchInput.value = state.filters.search;
    el.familyPriorityFilter.value = state.filters.familyPressure;
}
function appRuntimeEndpointRowForId(endpointId) {
    if (!endpointId || !state.payload || !state.payload.endpoints)
        return null;
    return (state.payload.endpoints || []).find(function (row) {
        return row && row.id === endpointId;
    }) || null;
}
function appRuntimeEndpointDetailForId(endpointId) {
    if (!endpointId || !state.payload)
        return null;
    var details = payloadEndpointDetails();
    if (details && details[endpointId])
        return details[endpointId];
    var row = appRuntimeEndpointRowForId(endpointId);
    if (!row)
        return null;
    return {
        endpoint: row,
        findings: [],
        relatedWorkflows: [],
        relatedChains: [],
        relatedDiff: []
    };
}
function appRuntimeSelectEndpointForInspector(endpointId, subTab) {
    if (!endpointId)
        return;
    if (state.activeTopTab === 'workflow'
        && state.workflowChainFocusEndpointIds
        && state.workflowChainFocusEndpointIds.length
        && state.workflowChainFocusEndpointIds.indexOf(endpointId) === -1) {
        state.workflowChainFocusChainId = '';
        state.workflowChainFocusEndpointIds = [];
    }
    state.inspectingEndpointId = endpointId;
    state.selectedEndpointId = endpointId;
    state.userSelectedEndpoint = true;
    state.inspectPlacementHint = 'nested';
    var detailForFocus = appRuntimeEndpointDetailForId(endpointId);
    var endpointForFocus = detailForFocus && detailForFocus.endpoint ? detailForFocus.endpoint : appRuntimeEndpointRowForId(endpointId);
    var familyForFocus = endpointForFocus ? (endpointForFocus.family || '') : '';
    if (familyForFocus) {
        captureFamilyTableBackStateIfNeeded(state);
        state.expandedFamily = familyForFocus;
        if (state.expandedFamilyInsight && state.expandedFamilyInsight !== familyForFocus) {
            state.expandedFamilyInsight = '';
        }
    }
    state.endpointDiagnosticsSubTab = (typeof subTab === 'string' && subTab)
        ? subTab
        : (state.endpointDiagnosticsSubTab || 'summary');
    renderFamilySurface();
    renderEndpointDiagnostics();
    renderEndpointDetail();
    syncSelectedEndpointHighlight();
    syncWorkflowStepSelectionHighlight();
    requestAnimationFrame(function () {
        state.inspectingEndpointId = '';
        renderFamilySurface();
        renderEndpointDiagnostics();
    });
}
function appRuntimeScopedRows(rows) {
    return rows.filter(function (row) {
        if (state.filters.search) {
            var hay = (row.method + ' ' + row.path + ' ' + (row.family || '')).toLowerCase();
            if (hay.indexOf(state.filters.search) === -1)
                return false;
        }
        return true;
    });
}
function appRuntimeRowsInScopeAll() {
    var counts = {};
    var focusMap = null;
    if (state.workflowChainFocusEndpointIds && state.workflowChainFocusEndpointIds.length) {
        focusMap = {};
        state.workflowChainFocusEndpointIds.forEach(function (endpointId) {
            if (!endpointId)
                return;
            focusMap[endpointId] = true;
        });
    }
    function lensCount(row) {
        if (!row || !row.id)
            return 0;
        if (counts[row.id] !== undefined)
            return counts[row.id];
        counts[row.id] = lensFindingCountForRow(row);
        return counts[row.id];
    }
    var rows = appRuntimeScopedRows((state.payload && state.payload.endpoints) ? state.payload.endpoints : []);
    var requiresEvidenceSlice = (state.filters.category !== 'all')
        || state.activeTopTab === 'workflow'
        || state.activeTopTab === 'shape';
    if (requiresEvidenceSlice) {
        rows = rows.filter(function (row) {
            if (lensCount(row) > 0)
                return true;
            return !!(focusMap && focusMap[row.id]);
        });
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
function appRuntimeFilteredRows() {
    var counts = {};
    function lensCount(row) {
        if (!row || !row.id)
            return 0;
        if (counts[row.id] !== undefined)
            return counts[row.id];
        counts[row.id] = lensFindingCountForRow(row);
        return counts[row.id];
    }
    var rows = appRuntimeRowsInScopeAll();
    if (!state.filters.includeNoIssueRows) {
        rows = rows.filter(function (row) { return lensCount(row) > 0; });
    }
    rows.sort(function (a, b) {
        if (priorityRank(a.priority || '') !== priorityRank(b.priority || ''))
            return priorityRank(a.priority || '') - priorityRank(b.priority || '');
        var aCount = lensCount(a);
        var bCount = lensCount(b);
        if (aCount !== bCount)
            return bCount - aCount;
        return a.path.localeCompare(b.path);
    });
    return rows;
}
function appRuntimeFirstEvidenceEndpointId(rows) {
    var found = (rows || []).find(function (row) { return lensFindingCountForRow(row) > 0; });
    return found ? found.id : (rows[0] ? rows[0].id : '');
}
function appRuntimeFirstVisibleEndpointId(rows) {
    if (!rows || !rows.length)
        return '';
    var withEvidence = rows.find(function (row) { return lensFindingCountForRow(row) > 0; });
    return withEvidence ? withEvidence.id : rows[0].id;
}
function appRuntimeRowDominantIssue(row) {
    var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
    var detail = endpointDetails[row.id];
    var findings = detail ? findingsForActiveLens(detail.findings || []) : [];
    if (!detail || !findings.length) {
        return { label: 'No direct issue evidence', code: 'n/a' };
    }
    var first = findings[0];
    return {
        label: uiIssueDimensionForFinding(first.code || '', first.category || '', first.burdenFocus || ''),
        code: first.code || 'n/a'
    };
}
function appRuntimeApplyRecoveryAction(action) {
    if (action === 'clear-search') {
        state.filters.search = '';
    }
    else if (action === 'reset-category') {
        state.filters.category = 'all';
        state.familyTableShowAll = false;
    }
    else if (action === 'show-all-matching-families') {
        state.filters.search = '';
        state.filters.category = 'all';
        state.filters.familyPressure = 'all';
        state.filters.includeNoIssueRows = false;
        state.familyTableShowAll = true;
        state.familyTableBackState = null;
        state.expandedFamily = '';
        state.expandedFamilyInsight = '';
        state.expandedEndpointInsightIds = {};
        state.expandedEndpointRowFindings = {};
        state.detailEvidenceOpenForId = '';
    }
    else if (action === 'back-to-all-families') {
        restoreFamilyTableBackState(state);
    }
    else if (action === 'back-to-family-table') {
        restoreFamilyTableBackState(state);
    }
    else if (action === 'show-all-families') {
        state.familyTableShowAll = true;
    }
    else if (action === 'show-all-workflows') {
        state.filters.search = '';
        state.filters.category = 'all';
        state.filters.familyPressure = 'all';
    }
    else if (action === 'include-no-issue-rows') {
        state.filters.includeNoIssueRows = true;
    }
    else if (action === 'clear-table-filters') {
        state.filters.search = '';
        state.filters.category = 'all';
        state.filters.familyPressure = 'all';
        state.filters.includeNoIssueRows = false;
        state.familyTableShowAll = false;
        state.familyTableBackState = null;
        state.expandedFamily = '';
        state.expandedFamilyInsight = '';
        state.expandedEndpointInsightIds = {};
        state.expandedEndpointRowFindings = {};
        state.detailEvidenceOpenForId = '';
    }
    else if (action === 'clear-current-lens') {
        if (state.activeTopTab === 'spec-rule') {
            state.filters.search = '';
            state.filters.category = 'spec-rule';
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
        }
        else {
            clearCurrentLens();
            return;
        }
    }
    if (state.activeTopTab === 'shape') {
        state.endpointDiagnosticsSubTab = 'summary';
    }
    state.selectedEndpointId = '';
    state.userSelectedEndpoint = false;
    state.detailEvidenceOpenForId = '';
    render();
    pulseLensUpdate();
}
function appRuntimeHumanFamilyLabel(name) {
    if (!name)
        return 'unlabeled family';
    if (name === '/aggregate')
        return '/aggregate (cross-resource utility)';
    return name;
}
function appRuntimeDimensionCleanerHint(dimension) {
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
function renderEndpointDiagnosticsEmptyState() {
    var families = familySummaries();
    if (!families.length) {
        return '<div class="empty">'
            + "<strong>Nothing to inspect yet</strong>"
            + '<p class="subtle">No families match the current filters, so no endpoint can be selected. Widen the filters above to continue.</p>'
            + "</div>";
    }
    return '<div class="empty"><p class="subtle">Endpoint diagnostics appear inline under the endpoint you select within a family’s expanded list.</p></div>';
}
function evidenceSectionTitleForActiveLens() {
    if (state.activeTopTab === "workflow")
        return "Evidence of workflow continuity risk";
    if (state.activeTopTab === "shape")
        return "Evidence of response-shape burden";
    return "Evidence of contract violations";
}
function evidenceGroupsSummaryLabel(groupCount) {
    var count = (typeof groupCount === "number" && isFinite(groupCount)) ? groupCount : 0;
    return evidenceSectionTitleForActiveLens() + " (" + count + " by schema field and issue type)";
}
function evidenceGroupsGroupingBasisCopy() {
    return "Evidence grouped by schema field and issue type.";
}
function exactEvidenceTargetLabel() {
    return "Grouped deviations";
}
function exactEvidenceTabLabelWithCount() {
    var label = exactEvidenceTargetLabel();
    var detail = state.selectedEndpointId ? endpointDetailForId(state.selectedEndpointId) : null;
    if (!detail || !detail.findings)
        return label;
    var groups = groupFindings(findingsForActiveLens(detail.findings || []));
    var count = groups.length || 0;
    return label + " (" + count + " group" + (count === 1 ? "" : "s") + ")";
}
function exactEvidenceGroupsSummaryLabel(groupCount) {
    var count = (typeof groupCount === "number" && isFinite(groupCount)) ? groupCount : 0;
    return exactEvidenceTargetLabel() + " (" + count + " group" + (count === 1 ? "" : "s") + ")";
}
function fullExactEvidenceClosedLabel(groupCount) {
    var count = (typeof groupCount === "number" && isFinite(groupCount)) ? groupCount : 0;
    var unit = count === 1 ? "group" : "groups";
    return "Open grouped deviations (" + count + " " + unit + ")";
}
function fullExactEvidenceOpenLabel() {
    return "Hide grouped deviations";
}
function compactEvidenceOccurrenceLabel(message) {
    var msg = (message || "").trim();
    if (!msg)
        return "";
    var responseMissingDescription = /^Response\s+([0-9]{3})\s+is\s+missing\s+(?:a\s+)?description\.?$/i.exec(msg);
    if (responseMissingDescription)
        return responseMissingDescription[1] + " missing description";
    var responseMissingSchema = /^Response\s+([0-9]{3})\s+has\s+no\s+schema\s+for\s+media\s+type\s+'([^']+)'\.?.*$/i.exec(msg);
    if (responseMissingSchema)
        return responseMissingSchema[1] + " missing schema (" + responseMissingSchema[2] + ")";
    var requestMissingSchema = /^Request\s+body\s+has\s+no\s+schema\s+for\s+media\s+type\s+'([^']+)'\.?.*$/i.exec(msg);
    if (requestMissingSchema)
        return "request missing schema (" + requestMissingSchema[1] + ")";
    var genericMissingDescription = /missing\s+the\s+required\s+"description"\s+field/i.exec(msg);
    if (genericMissingDescription)
        return "missing description";
    return msg.replace(/\s+/g, " ").replace(/\.$/, "");
}
function renderCountedOccurrencesList(groups) {
    var flat = [];
    (groups || []).forEach(function (group) {
        var messages = group && group.messages ? group.messages : [];
        if (messages && messages.length) {
            messages.forEach(function (msg) {
                flat.push(String(msg || ""));
            });
            return;
        }
        if (group && group.preview)
            flat.push(String(group.preview || ""));
    });
    if (!flat.length)
        return "";
    var ordered = [];
    var counts = {};
    flat.forEach(function (msg) {
        var label = compactEvidenceOccurrenceLabel(msg);
        if (!label)
            return;
        if (!counts[label])
            ordered.push(label);
        counts[label] = (counts[label] || 0) + 1;
    });
    if (!ordered.length)
        return "";
    var total = ordered.reduce(function (sum, label) { return sum + (counts[label] || 0); }, 0);
    var shown = ordered.slice(0, 10);
    var remaining = ordered.length - shown.length;
    return '<div class="counted-occurrences-summary" data-counted-occurrences="1">'
        + '<p class="counted-occurrences-title"><strong>Counted deviations</strong> (' + String(total) + ")</p>"
        + '<ul class="counted-occurrences-list">'
        + shown.map(function (label) {
            var n = counts[label] || 0;
            var suffix = n > 1 ? (" ×" + n) : "";
            return "<li>" + escapeHtml(label + suffix) + "</li>";
        }).join("")
        + "</ul>"
        + (remaining > 0 ? ('<p class="subtle counted-occurrences-more">+' + remaining + " more</p>") : "")
        + "</div>";
}
function renderFullExactEvidenceDrawer(groups, options) {
    var opts = options || {};
    var endpoint = opts.endpoint || createEmptyEndpointRow();
    var familyName = opts.familyName || "";
    var openAttr = opts.open ? " open" : "";
    var groupCount = (groups || []).length || 0;
    var titleLabel = exactEvidenceGroupsSummaryLabel(groupCount);
    var closeControl = '<div class="details-close-row">'
        + '<button type="button" class="tertiary-action details-close-btn" data-close-details="1" aria-label="Hide evidence" title="Hide evidence">Hide evidence</button>'
        + "</div>";
    var commonScope = "";
    if (groups && groups.length > 1) {
        var scopeLabels = groups.map(function (group) {
            return issueScopeLabelForKey((group && group.groupKey) ? group.groupKey : "", familyName);
        });
        commonScope = scopeLabels[0] || "";
        for (var i = 1; i < scopeLabels.length; i++) {
            if (scopeLabels[i] !== commonScope) {
                commonScope = "";
                break;
            }
        }
    }
    var scopeLine = commonScope
        ? ('<p class="subtle detail-section-copy detail-section-copy-scope"><strong>Scope:</strong> ' + escapeHtml(commonScope) + "</p>")
        : "";
    return '<details class="detail-evidence-drawer" data-full-exact-evidence="1"' + openAttr + ">"
        + '<summary><span class="evidence-drawer-title">' + escapeHtml(titleLabel) + "</span></summary>"
        + '<section class="detail-section detail-section-tight">'
        + closeControl
        + renderCountedOccurrencesList(groups)
        + '  <p class="subtle detail-section-copy">' + escapeHtml(evidenceGroupsGroupingBasisCopy()) + "</p>"
        + scopeLine
        + (groups || []).map(function (group, index) {
            return renderIssueGroup(group, index, { familyName: familyName, endpoint: endpoint, commonScopeLabel: commonScope });
        }).join("")
        + "</section>"
        + "</details>";
}
function renderEndpointDiagnosticsTabs() {
    var tabs = [
        { id: "summary", label: "Endpoint summary", description: "what is wrong and why it matters" },
        { id: "exact", label: exactEvidenceTabLabelWithCount(), description: "evidence grouped by schema field and issue type" },
        { id: "consistency", label: "Consistency / drift", description: "sibling-route comparison" },
        { id: "cleaner", label: "Contract improvements", description: "concrete response and schema changes" }
    ];
    var activeTab = tabs.find(function (tab) {
        return tab.id === state.endpointDiagnosticsSubTab;
    }) || tabs[0];
    return '<div class="endpoint-diag-tabs-wrap">'
        + '<div class="endpoint-diag-tabs">'
        + tabs.map(function (tab) {
            var active = state.endpointDiagnosticsSubTab === tab.id ? " active" : "";
            return '<button type="button" class="endpoint-diag-tab' + active + '" data-endpoint-subtab="' + tab.id + '">' + escapeHtml(tab.label) + "</button>";
        }).join("")
        + "</div>"
        + '<p class="endpoint-diag-tab-description">' + escapeHtml(activeTab.description) + "</p>"
        + "</div>";
}
function consistencyFindingsForDetail(findings) {
    var consistencyCodes = {
        "detail-path-parameter-name-drift": true,
        "endpoint-path-style-drift": true,
        "sibling-path-shape-drift": true,
        "inconsistent-response-shape": true,
        "inconsistent-response-shape-family": true,
        "inconsistent-response-shapes": true,
        "inconsistent-response-shapes-family": true
    };
    return (findings || []).filter(function (finding) {
        return !!consistencyCodes[finding.code || ""];
    });
}
function isConsistencyDriftFinding(finding) {
    if (!finding)
        return false;
    var code = finding.code || "";
    return code === "detail-path-parameter-name-drift"
        || code === "endpoint-path-style-drift"
        || code === "sibling-path-shape-drift"
        || code === "inconsistent-response-shape"
        || code === "inconsistent-response-shape-family"
        || code === "inconsistent-response-shapes"
        || code === "inconsistent-response-shapes-family"
        || (finding.burdenFocus || "") === "consistency";
}
function isSpecRuleFinding(finding) {
    if (!finding)
        return false;
    return finding.evidenceType === "spec-rule" || (finding.category || "") === "spec-rule";
}
function isWorkflowContinuityFinding(finding) {
    if (!finding)
        return false;
    if (isSpecRuleFinding(finding))
        return false;
    if ((finding.burdenFocus || "") === "workflow-burden")
        return true;
    var code = finding.code || "";
    if (code === "prerequisite-task-burden")
        return true;
    if (code === "weak-list-detail-linkage")
        return true;
    if (code === "weak-follow-up-linkage")
        return true;
    if (code === "weak-action-follow-up-linkage")
        return true;
    if (code === "weak-accepted-tracking-linkage")
        return true;
    if (code === "weak-outcome-next-action-guidance")
        return true;
    var msg = (finding.message || "").toLowerCase();
    if (/token|bearer|authorization|api[-\s]?key|auth|header|context transfer|handoff/.test(msg))
        return true;
    return false;
}
function isResponseShapeFinding(finding) {
    if (!finding)
        return false;
    if (isSpecRuleFinding(finding))
        return false;
    var code = finding.code || "";
    return code === "deeply-nested-response-structure"
        || code === "duplicated-state-response"
        || code === "incidental-internal-field-exposure"
        || code === "snapshot-heavy-response"
        || code === "contract-shape-workflow-guidance-burden"
        || code === "weak-outcome-next-action-guidance";
}
function isShapeScopedFinding(finding) {
    if (!finding)
        return false;
    if (finding.evidenceType === "spec-rule")
        return false;
    if ((finding.burdenFocus || "") === "contract-shape")
        return true;
    var code = finding.code || "";
    return code === "contract-shape-workflow-guidance-burden"
        || code === "snapshot-heavy-response"
        || code === "deeply-nested-response-structure"
        || code === "duplicated-state-response"
        || code === "incidental-internal-field-exposure"
        || code === "prerequisite-task-burden"
        || code === "weak-outcome-next-action-guidance"
        || code === "weak-follow-up-linkage"
        || code === "weak-action-follow-up-linkage"
        || code === "weak-accepted-tracking-linkage"
        || code === "generic-object-response"
        || code === "weak-array-items-schema";
}
function findingsForActiveTopTab(findings) {
    var out = findings || [];
    if (state.activeTopTab === "spec-rule") {
        out = out.filter(function (finding) {
            return isSpecRuleFinding(finding) || isConsistencyDriftFinding(finding);
        });
    }
    if (state.activeTopTab === "workflow") {
        out = out.filter(isWorkflowContinuityFinding);
    }
    if (state.activeTopTab === "shape") {
        out = out.filter(isResponseShapeFinding);
    }
    return out;
}
function findingsForActiveLens(findings) {
    var out = findingsForActiveTopTab(findings || []);
    if (state.filters.category && state.filters.category !== "all") {
        if (state.filters.category === "spec-rule") {
            out = out.filter(function (finding) {
                if (state.activeTopTab === "spec-rule") {
                    return isSpecRuleFinding(finding) || isConsistencyDriftFinding(finding);
                }
                return isSpecRuleFinding(finding);
            });
        }
        else {
            out = out.filter(function (finding) {
                if (!finding)
                    return false;
                return (finding.category || "") === state.filters.category;
            });
        }
    }
    return out;
}
function viewScopeEnforceSpecRuleTabFilterModel() {
    if (state.activeTopTab !== 'spec-rule')
        return;
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
        state.selectedEndpointId = '';
        state.detailEvidenceOpenForId = '';
    }
}
function viewScopeEnforceWorkflowTabFilterModel() {
    if (state.activeTopTab !== 'workflow')
        return;
    if (state.endpointDiagnosticsSubTab === 'consistency' || state.endpointDiagnosticsSubTab === 'cleaner') {
        state.endpointDiagnosticsSubTab = 'summary';
    }
    if (state.filters.category === 'spec-rule' || state.filters.category === 'contract-shape') {
        state.filters.category = 'all';
    }
    var workflowRows = filteredRows();
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
function viewScopeEnforceShapeTabFilterModel() {
    if (state.activeTopTab !== 'shape')
        return;
    if (state.endpointDiagnosticsSubTab === 'consistency') {
        state.endpointDiagnosticsSubTab = 'summary';
    }
    if (state.filters.category === 'spec-rule' || state.filters.category === 'workflow-burden') {
        state.filters.category = 'all';
    }
    var shapeRows = filteredRows();
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
function viewScopeNormalizeSelectedEndpointForCurrentView() {
    var rows = filteredRows();
    if (!rows.length) {
        state.selectedEndpointId = '';
        return;
    }
    if (state.selectedEndpointId && !rows.some(function (row) { return row.id === state.selectedEndpointId; })) {
        state.selectedEndpointId = '';
    }
}
function viewScopePayloadEndpointDetails() {
    return state.payload && state.payload.endpointDetails
        ? state.payload.endpointDetails
        : {};
}
function viewScopePayloadWorkflowChains() {
    return state.payload && state.payload.workflows && state.payload.workflows.chains
        ? state.payload.workflows.chains
        : [];
}
function viewScopeLensFindingCountForRow(row) {
    if (!row || !row.id || !state.payload || !state.payload.endpointDetails)
        return 0;
    var detail = viewScopePayloadEndpointDetails()[row.id];
    if (detail && detail.findings) {
        return findingsForActiveLens(detail.findings || []).length;
    }
    var categoryCounts = row.categoryCounts || {};
    var category = state.filters.category || 'all';
    var base = row.findings || 0;
    if (category !== 'all') {
        base = categoryCounts[category] || 0;
    }
    return base;
}
function viewScopeHasValidSelectedEndpointInCurrentView() {
    if (!state.selectedEndpointId)
        return false;
    return rowsInScopeAll().some(function (row) {
        return row.id === state.selectedEndpointId;
    });
}
function viewScopeSelectionRowsForActiveView() {
    return filteredRows();
}
function viewScopeIssueScopeIndexCacheKey() {
    var f = state.filters || createEmptyFilters();
    return [
        state.activeTopTab,
        f.search || '',
        f.category || '',
        f.familyPressure || '',
        f.includeNoIssueRows ? '1' : '0'
    ].join('|');
}
function viewScopeFindingGroupKey(finding) {
    return buildFindingGroupKeyFromContext(finding, extractOpenAPIContext(finding));
}
function viewScopeBuildIssueScopeIndexForCurrentView() {
    return buildIssueScopeIndex(viewScopeSelectionRowsForActiveView(), state.payload ? viewScopePayloadEndpointDetails() : null, findingsForActiveLens, viewScopeFindingGroupKey);
}
function viewScopeGetIssueScopeIndex() {
    var key = viewScopeIssueScopeIndexCacheKey();
    if (state.issueScopeIndex && state.issueScopeIndexKey === key) {
        return state.issueScopeIndex;
    }
    state.issueScopeIndex = viewScopeBuildIssueScopeIndexForCurrentView();
    state.issueScopeIndexKey = key;
    return state.issueScopeIndex;
}
function viewScopeIssueScopeLabelForKey(groupKey, familyName) {
    return deriveIssueScopeLabelForKey(groupKey, familyName, viewScopeGetIssueScopeIndex());
}
function viewScopeFormatScopeValue(value, fallback) {
    if (value === undefined || value === null)
        return fallback;
    var text = String(value);
    if (!text)
        return fallback;
    return text;
}
function viewScopeFormatFilterSummaryHtml() {
    var families = familySummariesRaw().filter(function (family) {
        return state.filters.familyPressure === 'all' || family.pressure === state.filters.familyPressure;
    });
    var total = families.length || 0;
    var shown = state.familyTableShowAll ? total : Math.min(24, total);
    if (total === 0) {
        return '<strong>No families match the current filters.</strong>';
    }
    var lens = state.activeTopTab === 'workflow'
        ? 'workflow guidance burden'
        : state.activeTopTab === 'shape'
            ? 'response-shape burden'
            : 'contract issues';
    var prefix = state.activeTopTab === 'workflow'
        ? '<strong>Workflow Guidance:</strong> '
        : state.activeTopTab === 'shape'
            ? '<strong>Response Shape:</strong> '
            : '<strong>Contract Issues:</strong> ';
    if (state.activeTopTab === 'workflow'
        && state.workflowChainFocusEndpointIds
        && state.workflowChainFocusEndpointIds.length) {
        return prefix + 'Showing the selected chain\u2019s steps and their continuity signals.';
    }
    if (shown < total) {
        return prefix + 'Showing top ' + shown + ' of ' + total + ' families with ' + escapeHtml(lens) + '.';
    }
    return prefix + 'Showing ' + total + ' famil' + (total === 1 ? 'y' : 'ies') + ' with ' + escapeHtml(lens) + '.';
}
function viewScopeRenderFilterEmptyState() {
    if (!el.filterEmptyState)
        return;
    el.filterEmptyState.innerHTML = '';
    if (state.activeTopTab !== 'spec-rule')
        return;
    var families = familySummaries();
    var rows = filteredRows();
    if (families.length || rows.length)
        return;
    var primaryAction = '';
    var primaryLabel = '';
    var why = '';
    if (state.filters.search) {
        primaryAction = 'clear-search';
        primaryLabel = 'Clear search';
        why = 'The current search is narrower than the available contract-problem evidence in this slice.';
    }
    else if (state.filters.familyPressure !== 'all') {
        primaryAction = 'clear-table-filters';
        primaryLabel = 'Show all severity bands';
        why = 'The selected severity band hides all contract-problem families in this slice.';
    }
    else {
        primaryAction = 'clear-table-filters';
        primaryLabel = 'Reset table view';
        why = 'The current table view is narrower than the available contract-problem evidence in this slice.';
    }
    var actionHtml = '<div class="filter-empty-actions">'
        + '<button type="button" class="primary-action" data-recovery-action="' + escapeHtml(primaryAction) + '">' + escapeHtml(primaryLabel) + '</button>'
        + '</div>';
    el.filterEmptyState.innerHTML = '<section class="filter-empty-panel" aria-label="No matching families">'
        + '<p class="filter-empty-title"><strong>No matching families</strong></p>'
        + '<p class="filter-empty-lead">No contract-problem families match the current table view.</p>'
        + '<p class="subtle">' + escapeHtml(why) + '</p>'
        + actionHtml
        + '</section>';
    bindRecoveryButtons(el.filterEmptyState);
}
var SPEC_RULE_SUMMARY = {
    "OAS-RESPONSE-DESCRIPTION-REQUIRED": 'Response Object is missing the required "description" field',
    "OAS-OPERATION-ID-UNIQUE": "operationId must be unique across all operations",
    "OAS-NO-SUCCESS-RESPONSE": "Operation should define at least one 2xx success response",
    "OAS-GET-REQUEST-BODY": "GET/HEAD operations should not define a request body",
    "OAS-204-HAS-CONTENT": "204 No Content response should not define a response body"
};
var SPEC_RULE_WHY = {
    "OAS-RESPONSE-DESCRIPTION-REQUIRED": "Docs and generated clients lose intent when response semantics are missing.",
    "OAS-OPERATION-ID-UNIQUE": "Client generation and tooling can break when operationId collides.",
    "OAS-NO-SUCCESS-RESPONSE": "Clients cannot rely on a success contract when 2xx responses are undefined.",
    "OAS-GET-REQUEST-BODY": "Tooling and intermediaries may drop or mishandle GET request bodies.",
    "OAS-204-HAS-CONTENT": "Clients may mis-handle responses when 204 contradicts a response body."
};
function aggregateSpecRuleFindings(rows) {
    var totalEndpoints = rows.length;
    var byRule = {};
    var endpointDetails = (state.payload && state.payload.endpointDetails) ? state.payload.endpointDetails : {};
    rows.forEach(function (row) {
        var detail = endpointDetails[row.id];
        if (!detail)
            return;
        (detail.findings || []).forEach(function (finding) {
            if (finding.evidenceType !== "spec-rule")
                return;
            var ruleId = finding.specRuleId || finding.code || "";
            if (!byRule[ruleId]) {
                byRule[ruleId] = {
                    ruleId: ruleId,
                    normativeLevel: finding.normativeLevel || "",
                    specSource: finding.specSource || "",
                    severity: finding.severity || "info",
                    occurrences: 0,
                    endpointCount: 0,
                    _seen: {},
                    summary: SPEC_RULE_SUMMARY[ruleId] || ruleId.replace(/^OAS-/, "").replace(/-/g, " ").toLowerCase()
                };
            }
            byRule[ruleId].occurrences++;
            if (!byRule[ruleId]._seen || !byRule[ruleId]._seen[row.id]) {
                if (!byRule[ruleId]._seen)
                    byRule[ruleId]._seen = {};
                byRule[ruleId]._seen[row.id] = true;
                byRule[ruleId].endpointCount++;
            }
        });
    });
    var apiWideThreshold = 0.8;
    var normPriority = {
        REQUIRED: 0,
        MUST: 0,
        "MUST NOT": 0,
        "SHOULD NOT": 1,
        SHOULD: 1,
        RECOMMENDED: 2
    };
    return Object.keys(byRule).map(function (key) {
        var rule = byRule[key];
        rule.isApiWide = totalEndpoints > 0 && (rule.endpointCount / totalEndpoints) >= apiWideThreshold;
        return rule;
    }).sort(function (a, b) {
        var aPriority = normPriority[a.normativeLevel] !== undefined ? normPriority[a.normativeLevel] : 3;
        var bPriority = normPriority[b.normativeLevel] !== undefined ? normPriority[b.normativeLevel] : 3;
        if (aPriority !== bPriority)
            return aPriority - bPriority;
        if (b.endpointCount !== a.endpointCount)
            return b.endpointCount - a.endpointCount;
        return b.occurrences - a.occurrences;
    });
}
function renderSpecRuleAggregate(ruleGroups) {
    if (!ruleGroups.length) {
        return '<p class="subtle">No spec-rule findings are visible in the current view.</p>';
    }
    var apiWide = ruleGroups.filter(function (rule) { return !!rule.isApiWide; });
    var localized = ruleGroups.filter(function (rule) { return !rule.isApiWide; });
    function buildTableRows(rules) {
        return rules.map(function (rule) {
            var levelClass = (rule.normativeLevel === "REQUIRED" || rule.normativeLevel === "MUST" || rule.normativeLevel === "MUST NOT")
                ? "spec-level-must"
                : "spec-level-should";
            var endpointNote = rule.endpointCount === 1 ? "1 endpoint" : (rule.endpointCount + " endpoints");
            return '<tr class="spec-agg-row">'
                + '<td class="spec-agg-id"><code>' + escapeHtml(rule.ruleId) + '</code><div class="spec-agg-summary">' + escapeHtml(rule.summary) + "</div></td>"
                + '<td class="spec-agg-level"><span class="spec-norm-badge ' + levelClass + '">' + escapeHtml(rule.normativeLevel) + "</span></td>"
                + '<td class="spec-agg-count">' + rule.occurrences + "</td>"
                + '<td class="spec-agg-scope">' + escapeHtml(endpointNote) + "</td>"
                + "</tr>";
        }).join("");
    }
    var html = '<div class="spec-rule-aggregate">';
    if (apiWide.length) {
        html += '<div class="spec-agg-section spec-agg-apiwide">'
            + '<p class="spec-agg-section-label">This issue appears in most visible endpoints, so it is likely a broad contract problem, not a one-off.</p>'
            + '<table class="spec-agg-table"><thead><tr><th>Rule ID &amp; summary</th><th>Level</th><th>Count</th><th>Scope</th></tr></thead><tbody>'
            + buildTableRows(apiWide)
            + "</tbody></table></div>";
    }
    if (localized.length) {
        html += '<div class="spec-agg-section">'
            + (apiWide.length
                ? '<p class="spec-agg-section-label">Concentrated issues — affects a smaller share of endpoints. Easier to fix endpoint-by-endpoint.</p>'
                : '<p class="spec-agg-label">Sorted by normative level, then breadth of impact. Rows open grouped deviations with normative grounding.</p>')
            + '<table class="spec-agg-table"><thead><tr><th>Rule ID &amp; summary</th><th>Level</th><th>Count</th><th>Scope</th></tr></thead><tbody>'
            + buildTableRows(localized)
            + "</tbody></table></div>";
    }
    html += '<p class="spec-agg-footer">Endpoint rows open grouped deviations with exact occurrences and normative grounding.</p>';
    html += "</div>";
    return html;
}
function renderSpecRuleBanner(ruleGroups, totalEndpoints) {
    if (!ruleGroups || !ruleGroups.length)
        return "";
    var top = ruleGroups[0];
    var summary = top.summary || SPEC_RULE_SUMMARY[top.ruleId] || top.ruleId;
    var more = ruleGroups.length > 1 ? (" (and " + (ruleGroups.length - 1) + " more)") : "";
    var severityLabel = (top.severity || "info").toUpperCase();
    var level = top.normativeLevel || "";
    var affected = (top.endpointCount || 0) + "/" + (totalEndpoints || 0);
    var why = SPEC_RULE_WHY[top.ruleId] || "Improves spec validity and makes tooling and client integrations more reliable.";
    return '<div class="spec-rule-banner">'
        + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Rule</span><span class="spec-rule-banner-value"><code>'
        + escapeHtml(top.ruleId)
        + '</code> <span class="spec-rule-banner-summary">'
        + escapeHtml(summary)
        + more
        + "</span></span></div>"
        + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Severity</span><span class="spec-rule-banner-value"><span class="spec-rule-severity sev-'
        + escapeHtml(top.severity || "info")
        + '">'
        + escapeHtml(severityLabel)
        + "</span>"
        + (level
            ? (' <span class="spec-norm-badge ' + ((level === "REQUIRED" || level === "MUST" || level === "MUST NOT") ? "spec-level-must" : "spec-level-should") + '">' + escapeHtml(level) + "</span>")
            : "")
        + "</span></div>"
        + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Affected endpoints</span><span class="spec-rule-banner-value">'
        + escapeHtml(affected)
        + "</span></div>"
        + '<div class="spec-rule-banner-field"><span class="spec-rule-banner-label">Why it matters</span><span class="spec-rule-banner-value">'
        + escapeHtml(why)
        + "</span></div>"
        + "</div>";
}
function hasWorkflowShapedExampleSignals(findings) {
    return (findings || []).some(function (finding) {
        var code = finding.code || "";
        if (code === "contract-shape-workflow-guidance-burden"
            || code === "snapshot-heavy-response"
            || code === "duplicated-state-response"
            || code === "incidental-internal-field-exposure"
            || code === "deeply-nested-response-structure"
            || code === "prerequisite-task-burden"
            || code === "weak-follow-up-linkage"
            || code === "weak-action-follow-up-linkage"
            || code === "weak-accepted-tracking-linkage"
            || code === "generic-object-response"
            || code === "weak-array-items-schema") {
            return true;
        }
        var msg = (finding.message || "").toLowerCase();
        return /follow[-\s]?up|next[-\s]?step|tracking|identifier|token|context|header|nested|snapshot|internal|source of truth|authoritative|outcome|what changed/.test(msg);
    });
}
function collectInspectorContractComparisonPoints(endpoint, findings) {
    var current = [];
    var improved = [];
    var themes = [];
    function pushUnique(list, text) {
        if (list.indexOf(text) === -1)
            list.push(text);
    }
    function addTheme(theme, currentText, improvedText) {
        if (themes.indexOf(theme) === -1)
            themes.push(theme);
        pushUnique(current, currentText);
        pushUnique(improved, improvedText);
    }
    (findings || []).forEach(function (finding) {
        var code = finding.code || "";
        var msg = (finding.message || "").toLowerCase();
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure|full model/.test(msg)) {
            addTheme("storage-shaped vs task-shaped", "Storage-shaped payload dominates the response surface.", "Return a task-shaped response: lead with outcome, authoritative state, and handoff fields.");
            addTheme("graph dump vs explicit outcome", "Graph-style payload forces readers to infer what changed.", "Add an explicit outcome block: state what changed and whether the step is complete.");
        }
        if (code === "incidental-internal-field-exposure" || /internal|incidental|audit|raw id/.test(msg)) {
            addTheme("internal state vs domain-level state", "Internal/storage fields dominate over domain-level state.", "Move internal/storage fields out of the default payload; keep domain-level state primary.");
        }
        if (code === "duplicated-state-response" || /duplicate|duplicated|source of truth|authoritative/.test(msg)) {
            addTheme("duplicated state vs single source of truth", "Duplicated state appears across branches with unclear source-of-truth.", "Expose one authoritative state field as the single source of truth.");
        }
        if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
            addTheme("missing next action vs explicit next action", "Next action is missing or weakly modeled in the response.", "Include nextAction plus the required id/link for the next call.");
        }
        if (code === "prerequisite-task-burden" || /prerequisite|prior state|hidden dependency|handoff|implicit/.test(msg)) {
            addTheme("hidden dependency vs surfaced prerequisite / handoff", "Prerequisite/handoff dependency is implicit and easy to miss.", "Return prerequisite state and handoff fields explicitly in the response.");
        }
    });
    var path = ((endpoint && endpoint.path) || "").toLowerCase();
    if (/order|cart|checkout|payment/.test(path)) {
        pushUnique(improved, "Return domain-level outcome status (order/cart/payment state), not a backend object dump.");
    }
    if (!themes.length) {
        addTheme("storage-shaped vs task-shaped", "Current shape requires readers to infer intent from broad payload structure.", "Return outcome, authoritative state, and nextAction explicitly.");
    }
    return {
        themes: themes,
        current: current.slice(0, 4),
        improved: improved.slice(0, 4)
    };
}
function renderInspectorContractShapeComparison(detail, findingsOverride, options) {
    var opts = options || {};
    var endpoint = (detail && detail.endpoint) || createEmptyEndpointRow();
    var findings = findingsOverride || findingsForActiveLens((detail && detail.findings) || []);
    var points = collectInspectorContractComparisonPoints(endpoint, findings);
    var title = opts.title || "Current response shape vs better workflow-first response shape";
    var themeLine = points.themes.length ? points.themes.join(" | ") : "storage-shaped vs task-shaped";
    return '<section class="inspector-contract-compare">'
        + "<h3>" + escapeHtml(title) + "</h3>"
        + '<p class="inspector-contract-compare-note"><strong>Themes:</strong> ' + escapeHtml(themeLine) + "</p>"
        + '<div class="inspector-contract-compare-grid">'
        + '  <div class="inspector-contract-compare-col">'
        + "    <h4>Current response shape</h4>"
        + "    <ul>" + points.current.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>"
        + "  </div>"
        + '  <div class="inspector-contract-compare-col">'
        + "    <h4>Better workflow-first response shape</h4>"
        + "    <ul>" + points.improved.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>"
        + "  </div>"
        + "</div>"
        + "</section>";
}
function collectWorkflowShapedExamplePoints(endpoint, findings) {
    var current = [];
    var cleaner = [];
    var evidence = [];
    function pushUnique(list, text) {
        if (list.indexOf(text) === -1)
            list.push(text);
    }
    (findings || []).forEach(function (finding) {
        var code = finding.code || "";
        if (evidence.indexOf(code) === -1)
            evidence.push(code);
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response") {
            pushUnique(current, "Storage/model structure dominates the response.");
            pushUnique(cleaner, "Return task outcome and authoritative state first.");
        }
        if (code === "deeply-nested-response-structure") {
            pushUnique(current, "Deep nesting hides outcome meaning.");
            pushUnique(cleaner, "Move outcome and nextAction near the top of the response.");
        }
        if (code === "duplicated-state-response") {
            pushUnique(current, "Repeated state adds scan noise and obscures source-of-truth.");
            pushUnique(cleaner, "Expose one authoritative state field; remove repeated snapshots.");
        }
        if (code === "incidental-internal-field-exposure") {
            pushUnique(current, "Incidental internal fields crowd outcome visibility.");
            pushUnique(cleaner, "Move internal linkage/audit fields out of the default success payload.");
        }
        if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage") {
            pushUnique(current, "Next step is weakly signaled.");
            pushUnique(cleaner, "Include nextAction and the handoff ID/link needed for the next call.");
        }
        if (code === "weak-outcome-next-action-guidance") {
            pushUnique(current, "Outcome and next action framing is weak.");
            pushUnique(cleaner, "Return explicit outcome and nextAction fields in the response.");
        }
        if (code === "prerequisite-task-burden") {
            pushUnique(current, "Hidden prerequisites are doing too much work.");
            pushUnique(cleaner, "Return prerequisite state/IDs explicitly so the step can be formed deterministically.");
        }
        if (code === "generic-object-response" || code === "weak-array-items-schema") {
            pushUnique(current, "Generic shape weakens handoff meaning.");
            pushUnique(cleaner, "Replace generic objects with named properties and typed array item schemas.");
        }
    });
    var path = ((endpoint && endpoint.path) || "").toLowerCase();
    if (/login|auth|session|register/.test(path)) {
        pushUnique(cleaner, "Return one authoritative auth/context token field for follow-up calls.");
    }
    if (/customer/.test(path)) {
        pushUnique(cleaner, "Return reusable customer identifiers/links needed for follow-up calls.");
    }
    if (/cart/.test(path)) {
        pushUnique(cleaner, "Return cart outcome plus minimal handoff fields (IDs/links) in the response.");
    }
    if (/order/.test(path)) {
        pushUnique(cleaner, "Return order outcome plus nextAction(s) in the response.");
    }
    if (/payment|checkout/.test(path)) {
        pushUnique(cleaner, "Return payment outcome meaning plus the authoritative transaction state.");
    }
    return {
        current: current.slice(0, 2),
        cleaner: cleaner.slice(0, 3),
        evidence: evidence.slice(0, 4)
    };
}
function renderWorkflowShapedExample(detail, findingsOverride) {
    var findings = findingsOverride || findingsForActiveLens(detail.findings || []);
    if (!hasWorkflowShapedExampleSignals(findings))
        return "";
    var points = collectWorkflowShapedExamplePoints(detail.endpoint || createEmptyEndpointRow(), findings);
    if (!points.current.length && !points.cleaner.length)
        return "";
    var currentHtml = points.current.length
        ? ("<ul>" + points.current.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>")
        : '<p class="subtle">Current storage-shaped emphasis appears mixed; handoff meaning is not consistently clear.</p>';
    var cleanerHtml = points.cleaner.length
        ? ("<ul>" + points.cleaner.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>")
        : '<p class="subtle">Return outcome-first payloads with authoritative context and explicit nextAction.</p>';
    var evidenceHint = points.evidence.length
        ? ('<p class="workflow-example-evidence"><strong>Signals:</strong> ' + escapeHtml(points.evidence.join(", ")) + "</p>")
        : "";
    return '<section class="workflow-example-block">'
        + "<h3>Current storage-shaped vs improved task-shaped response (illustrative)</h3>"
        + '<p class="workflow-example-note">Illustrative only — not a generated replacement or runtime guarantee.</p>'
        + '<div class="workflow-example-grid">'
        + '  <div class="workflow-example-col">'
        + "    <h4>Current storage-shaped response</h4>"
        + currentHtml
        + "  </div>"
        + '  <div class="workflow-example-col">'
        + "    <h4>Improved task-shaped response</h4>"
        + cleanerHtml
        + "  </div>"
        + "</div>"
        + evidenceHint
        + "</section>";
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
    findings.forEach(function (finding) {
        var code = finding.code || "";
        var msg = (finding.message || "").toLowerCase();
        if (code === "deeply-nested-response-structure" || /nested|deep/.test(msg))
            totals.deep += 1;
        if (code === "incidental-internal-field-exposure" || /internal|incidental|audit|raw id/.test(msg))
            totals.internal += 1;
        if (code === "duplicated-state-response" || /duplicate|duplicated/.test(msg))
            totals.dup += 1;
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure/.test(msg))
            totals.snapshot += 1;
        if (code === "duplicated-state-response" || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg))
            totals.source += 1;
        if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || code === "weak-outcome-next-action-guidance" || /outcome|what changed|result meaning/.test(msg))
            totals.outcome += 1;
        if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg))
            totals.nextAction += 1;
    });
    return totals;
}
function familySummaryBuildSurfaceContext(summaries) {
    var visibleFamilies = summaries.length;
    var allFamiliesInLens = familySummaryRawList();
    var totalInLens = allFamiliesInLens.length;
    var specTotal = new Set((state.payload.endpoints || []).map(function (r) {
        return r.family || "unlabeled family";
    })).size;
    var familiesInPressureTier = state.filters.familyPressure === "all"
        ? totalInLens
        : allFamiliesInLens.filter(function (family) { return family.pressure === state.filters.familyPressure; }).length;
    var showingTruncated = visibleFamilies < familiesInPressureTier;
    var hasNarrowing = !!(state.filters.search
        || state.filters.category !== "all"
        || state.filters.familyPressure !== "all"
        || state.filters.includeNoIssueRows
        || state.familyTableBackState);
    var summaryLine = "";
    if (!totalInLens) {
        summaryLine = "No families match the current scope.";
    }
    else if (showingTruncated) {
        summaryLine = "Showing " + visibleFamilies + " of " + familiesInPressureTier + " matching families (" + specTotal + " total in spec).";
    }
    else {
        summaryLine = "Showing " + visibleFamilies + " matching famil" + (visibleFamilies === 1 ? "y" : "ies") + " (" + specTotal + " total in spec).";
    }
    if (state.activeTopTab === "shape") {
        if (!totalInLens) {
            summaryLine = "No families with response-shape findings match the current filtered view.";
        }
        else if (showingTruncated) {
            summaryLine = "Showing " + visibleFamilies + " families with response-shape findings in the current filtered view ("
                + familiesInPressureTier + " matching families in scope; " + specTotal + " families in spec total).";
        }
        else {
            summaryLine = "Showing " + visibleFamilies + " families with response-shape findings in the current filtered view ("
                + specTotal + " families in spec total).";
        }
    }
    var actionButtons = [];
    if (showingTruncated && !state.familyTableShowAll) {
        actionButtons.push('<button type="button" class="secondary-action" data-recovery-action="show-all-families">Show all families in current scope</button>');
    }
    if (hasNarrowing) {
        actionButtons.push('<button type="button" class="secondary-action" data-recovery-action="clear-table-filters">Clear table filters</button>');
    }
    var actionsHtml = actionButtons.length
        ? ('<div class="context-actions">' + actionButtons.join("") + "</div>")
        : "";
    var copy = '<div class="context-block family-context-block">';
    if (state.activeTopTab === "shape") {
        var scopeLine = "Scope: Ranks families by response-shape burden and highlights top shape signals for endpoints matching the current filters.";
        var resultsLine = "Results: " + summaryLine;
        copy += '<p class="context-summary context-summary-shape">' + escapeHtml(scopeLine) + "</p>";
        copy += '<p class="context-summary context-summary-shape">' + escapeHtml(resultsLine) + "</p>";
    }
    else {
        copy += '<p class="context-summary">' + escapeHtml(summaryLine) + "</p>";
    }
    copy += actionsHtml;
    copy += "</div>";
    return copy;
}
function familySummaryRawList() {
    var counts = {};
    function lensCount(row) {
        if (!row || !row.id)
            return 0;
        if (counts[row.id] !== undefined)
            return counts[row.id];
        counts[row.id] = lensFindingCountForRow(row);
        return counts[row.id];
    }
    var lensLocked = state.filters.category !== "all" || state.activeTopTab === "workflow" || state.activeTopTab === "shape";
    var rows = scopedRows(state.payload.endpoints || []);
    if (lensLocked) {
        rows = rows.filter(function (row) { return lensCount(row) > 0; });
    }
    var byFamily = {};
    var endpointDetails = state.payload.endpointDetails || {};
    rows.forEach(function (row) {
        var inScopeFindings = lensCount(row);
        var hasEvidence = inScopeFindings > 0;
        if (!hasEvidence && !state.filters.includeNoIssueRows)
            return;
        var key = row.family || "unlabeled family";
        if (!byFamily[key]) {
            byFamily[key] = {
                family: key,
                pressure: "",
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
        item.findings = (item.findings || 0) + inScopeFindings;
        item.endpoints = (item.endpoints || 0) + 1;
        var priorityCounts = item.priorityCounts || {};
        priorityCounts[row.priority || "low"] = (priorityCounts[row.priority || "low"] || 0) + 1;
        item.priorityCounts = priorityCounts;
        var burdenWeight = hasEvidence ? inScopeFindings : 1;
        (row.burdenFocuses || []).forEach(function (focus) {
            var burdenCounts = item.burdenCounts || {};
            burdenCounts[focus] = (burdenCounts[focus] || 0) + burdenWeight;
            item.burdenCounts = burdenCounts;
        });
        var detail = endpointDetails[row.id];
        if (detail && detail.relatedChains && detail.relatedChains.length) {
            detail.relatedChains.forEach(function (chain) {
                var ids = (chain && chain.endpointIds) ? chain.endpointIds : [];
                if (!ids.length)
                    return;
                var kind = (chain && chain.kind) ? String(chain.kind) : "workflow";
                var chainKey = kind + "|" + ids.join(",");
                (item.workflowChainKeys || {})[chainKey] = true;
            });
            item.workflowChainCount = Object.keys(item.workflowChainKeys || {}).length;
        }
        if (detail && detail.findings) {
            var lensFindings = findingsForActiveLens(detail.findings || []);
            lensFindings.forEach(function (finding) {
                var dimension = issueDimensionForFinding(finding.code || "", finding.category || "", finding.burdenFocus || "");
                var dimensionCounts = item.dimensionCounts || {};
                dimensionCounts[dimension] = (dimensionCounts[dimension] || 0) + 1;
                item.dimensionCounts = dimensionCounts;
                var code = finding.code || "";
                var msg = (finding.message || "").toLowerCase();
                if (finding.evidenceType === "spec-rule")
                    return;
                if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || code === "prerequisite-task-burden") {
                    bumpFamilySignal(item.workflowSignalCounts || {}, "hidden token/context handoff appears likely");
                }
                if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
                    bumpFamilySignal(item.workflowSignalCounts || {}, "next step not clearly exposed");
                }
                if (code === "prerequisite-task-burden" || /prior state|earlier|sequence|brittle/.test(msg)) {
                    bumpFamilySignal(item.workflowSignalCounts || {}, "sequencing appears brittle");
                }
                if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
                    bumpFamilySignal(item.workflowSignalCounts || {}, "auth/header burden spread across steps");
                }
                if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "response appears snapshot-heavy");
                }
                if (code === "deeply-nested-response-structure" || dimension === "shape / nesting complexity" || /nested|deep/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "deep nesting appears likely");
                }
                if (code === "duplicated-state-response" || /duplicate|duplicated/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "duplicated state appears likely");
                }
                if (code === "incidental-internal-field-exposure" || dimension === "internal/incidental fields" || /internal|incidental|audit|raw id/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "incidental/internal fields appear to dominate");
                }
                if (code === "duplicated-state-response" || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "source-of-truth fields are unclear");
                }
                if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || code === "weak-outcome-next-action-guidance" || /outcome|what changed|result meaning/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "outcome framing is easy to miss");
                }
                if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
                    bumpFamilySignal(item.shapeSignalCounts || {}, "next action is weakly exposed");
                }
                if (code === "detail-path-parameter-name-drift") {
                    bumpFamilySignal(item.consistencySignalCounts || {}, "parameter naming drift appears likely");
                }
                if (code === "endpoint-path-style-drift" || code === "sibling-path-shape-drift") {
                    bumpFamilySignal(item.consistencySignalCounts || {}, "path style drift appears likely");
                }
                if (code === "inconsistent-response-shape" || code === "inconsistent-response-shape-family" || code === "inconsistent-response-shapes" || code === "inconsistent-response-shapes-family") {
                    bumpFamilySignal(item.consistencySignalCounts || {}, "outcome modeled differently across similar endpoints");
                    bumpFamilySignal(item.consistencySignalCounts || {}, "response shape drift appears likely");
                }
            });
        }
    });
    return Object.values(byFamily).map(function (family) {
        var dominantBurden = Object.entries(family.burdenCounts || {}).sort(function (a, b) { return b[1] - a[1]; });
        var dimensions = Object.entries(family.dimensionCounts || {}).sort(function (a, b) { return b[1] - a[1]; });
        family.pressure = familyPressureLabel(family.priorityCounts || {});
        family.dominantBurden = dominantBurden.length ? dominantBurden[0][0].replaceAll("-", " ") : "mixed";
        family.topDimensions = dimensions.slice(0, 3).map(function (entry) { return entry[0]; });
        return family;
    }).sort(function (a, b) {
        if (state.activeTopTab === "workflow") {
            var aScore = sumSignalCounts(a.workflowSignalCounts || {});
            var bScore = sumSignalCounts(b.workflowSignalCounts || {});
            if (aScore !== bScore)
                return bScore - aScore;
            if ((a.workflowChainCount || 0) !== (b.workflowChainCount || 0))
                return (b.workflowChainCount || 0) - (a.workflowChainCount || 0);
            if ((a.findings || 0) !== (b.findings || 0))
                return (b.findings || 0) - (a.findings || 0);
            if (priorityRank(a.pressure || "") !== priorityRank(b.pressure || ""))
                return priorityRank(a.pressure || "") - priorityRank(b.pressure || "");
            return (a.family || "").localeCompare(b.family || "");
        }
        if (priorityRank(a.pressure || "") !== priorityRank(b.pressure || ""))
            return priorityRank(a.pressure || "") - priorityRank(b.pressure || "");
        if ((a.findings || 0) !== (b.findings || 0))
            return (b.findings || 0) - (a.findings || 0);
        return (a.family || "").localeCompare(b.family || "");
    });
}
function familySummaryList() {
    var families = familySummaryRawList().filter(function (family) {
        return state.filters.familyPressure === "all" || family.pressure === state.filters.familyPressure;
    });
    return state.familyTableShowAll ? families : families.slice(0, 24);
}
function familyInsightBestEndpointIdForFamily(familyName) {
    if (!familyName)
        return "";
    var rows = filteredRows().filter(function (row) {
        return (row.family || "unlabeled family") === familyName;
    });
    if (!rows.length)
        return "";
    var best = null;
    rows.forEach(function (row) {
        var detail = payloadEndpointDetails()[row.id] || null;
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
function familyInsightBuildRankedSummary(family) {
    var driver = pickFamilyDominantDriver(family);
    if (state.activeTopTab === "workflow") {
        driver = { key: "workflow", label: "Workflow-driven", signalKey: "workflow", score: driver.score || 0 };
    }
    if (state.activeTopTab === "shape") {
        driver = { key: "shape", label: "Shape-driven", signalKey: "shape", score: driver.score || 0 };
    }
    var dominantSignals = familyDominantSignalsForDriver(family, driver.signalKey || driver.key);
    var dxSignals = dominantSignals.slice();
    if (state.activeTopTab === "shape") {
        dxSignals = sortedSignalLabels((family && family.shapeSignalCounts ? family.shapeSignalCounts : {}), 6);
    }
    var dxReasons = uniq(dxSignals.map(function (s) { return familyDxSignalFragment(s); }).filter(Boolean));
    var dxParts = dxReasons.slice(0, 2);
    var dxConsequence = "";
    if (dxParts.length === 0) {
        dxConsequence = "Contract clarity is uneven, so similar operations may still teach different integration habits.";
    }
    else if (dxParts.length === 1) {
        dxConsequence = toSentenceCase(dxParts[0]) + ".";
    }
    else {
        dxConsequence = toSentenceCase(dxParts[0]) + " and " + dxParts[1] + ".";
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
function familyInsightRowsInView(familyName) {
    var key = familyName || "unlabeled family";
    var rows = filteredRows().filter(function (row) {
        return (row.family || "unlabeled family") === key && lensFindingCountForRow(row) > 0;
    });
    if (rows.length)
        return rows;
    return rowsInScopeAll().filter(function (row) {
        return (row.family || "unlabeled family") === key && lensFindingCountForRow(row) > 0;
    });
}
function familyInsightPickLeadRow(rows) {
    if (!rows || !rows.length)
        return null;
    var selected = rows.find(function (row) { return row.id === state.selectedEndpointId; });
    if (selected)
        return selected;
    return rows.slice().sort(function (a, b) {
        if (priorityRank(a.priority || "") !== priorityRank(b.priority || ""))
            return priorityRank(a.priority || "") - priorityRank(b.priority || "");
        var aCount = lensFindingCountForRow(a);
        var bCount = lensFindingCountForRow(b);
        if (aCount !== bCount)
            return bCount - aCount;
        return (a.path || "").localeCompare(b.path || "");
    })[0] || null;
}
function familyInsightCollectCompactWorkflowContext(relatedChains, endpointId, endpointDetails) {
    if (!relatedChains || !relatedChains.length)
        return [];
    var lines = [];
    relatedChains.slice(0, 2).forEach(function (chain) {
        var stepIndex = (chain.endpointIds || []).indexOf(endpointId);
        if (stepIndex < 0)
            return;
        var parts = [];
        var totalSteps = (chain.endpointIds || []).length;
        var kind = chain.kind ? chain.kind.replaceAll("-", " to ") : "workflow";
        parts.push("Step " + (stepIndex + 1) + " of " + totalSteps + " in " + kind + ".");
        if (stepIndex > 0) {
            var prevDetail = endpointDetails[chain.endpointIds[stepIndex - 1]];
            if (prevDetail && prevDetail.endpoint) {
                parts.push("Comes from " + prevDetail.endpoint.method + " " + prevDetail.endpoint.path + ".");
            }
        }
        if (stepIndex < totalSteps - 1) {
            var nextDetail = endpointDetails[chain.endpointIds[stepIndex + 1]];
            if (nextDetail && nextDetail.endpoint) {
                parts.push("Leads to " + nextDetail.endpoint.method + " " + nextDetail.endpoint.path + ".");
            }
        }
        lines.push(parts.join(" "));
    });
    return lines;
}
function familyInsightBuildModel(familyName, preferredEndpointId) {
    var rows = familyInsightRowsInView(familyName);
    var leadRow = null;
    if (preferredEndpointId) {
        leadRow = rows.find(function (row) { return row.id === preferredEndpointId; }) || null;
    }
    if (!leadRow) {
        leadRow = familyInsightPickLeadRow(rows);
    }
    if (!leadRow)
        return null;
    var detail = payloadEndpointDetails()[leadRow.id] || { findings: [], endpoint: leadRow };
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
        workflowLines: familyInsightCollectCompactWorkflowContext(detail.relatedChains || [], leadRow.id, payloadEndpointDetails())
    };
}
function familyInsightRenderPanel(family, preferredEndpointId) {
    var familyName = family.family || "unlabeled family";
    var model = familyInsightBuildModel(familyName, preferredEndpointId || "");
    if (!model) {
        return '<div class="family-insight-panel">'
            + '<p class="subtle">No evidence-bearing endpoint is currently available for this family in the current view.</p>'
            + "</div>";
    }
    var rankedFamily = familyInsightBuildRankedSummary(family || { family: familyName, pressure: "" });
    var lead = model.topGroup;
    var leadEndpoint = model.detail && model.detail.endpoint ? model.detail.endpoint : model.leadRow;
    var leadFindings = (model.detail && model.detail.findings) ? model.detail.findings : [];
    var workflowTabActive = state.activeTopTab === "workflow";
    var shapeTabActive = state.activeTopTab === "shape";
    var specRuleTabActive = state.activeTopTab === "spec-rule";
    var workflowTrapGuidance = workflowTabActive
        ? collectTrapGuidance(leadEndpoint, leadFindings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, "", false)
        : [];
    var primaryProblemText = lead && lead.messages[0] ? lead.messages[0] : "No direct issue text is available for this endpoint.";
    var whyMattersText = lead && lead.impact
        ? lead.impact
        : (specRuleTabActive
            ? "This violates an explicit OpenAPI rule expectation, which breaks client tooling and increases integration risk."
            : "Clients may need extra guesswork, follow-up reads, or runtime knowledge because the contract does not guide the next step clearly.");
    var recommendedChangeText = lead
        ? dimensionCleanerHint(lead.dimension)
        : (specRuleTabActive
            ? "Fix the OpenAPI rule violation at the referenced schema/response location."
            : "Return an outcome-first response with explicit nextAction and handoff IDs.");
    var insightEndpointLabel = model.leadRow.method + " " + model.leadRow.path;
    var lensFindings = findingsForActiveLens((model.detail && model.detail.findings) ? model.detail.findings : []);
    var improvementItems = buildContractImprovementItems(model.detail || { endpoint: leadEndpoint, findings: [] }, lensFindings);
    var topEvidence = model.groups.slice(0, 3);
    var groundingHtml = '<div class="expansion-grounding">'
        + renderOpenAPIContextPills(model.topContext || createEmptyOpenAPIContext(), true)
        + (lead && lead.isSpecRule ? renderSpecRuleGroundingForGroup(lead) : "")
        + "</div>";
    var problemBlock = '<div class="expansion-section expansion-problem">'
        + '<p class="expansion-section-title">Lead issue</p>'
        + '<p class="expansion-text">' + escapeHtml(primaryProblemText) + "</p>"
        + groundingHtml
        + "</div>";
    var clientEffectText = rankedFamily && rankedFamily.dxConsequence ? rankedFamily.dxConsequence : "";
    var trapHtml = (workflowTabActive && workflowTrapGuidance.length)
        ? ('<div class="expansion-subblock">'
            + '<p class="expansion-text"><strong>Common traps:</strong></p>'
            + renderTrapGuidanceList(workflowTrapGuidance, { title: "", className: "", limit: 2 })
            + "</div>")
        : "";
    var workflowContextHtml = (workflowTabActive && model.workflowLines.length)
        ? ('<div class="expansion-subblock">'
            + '<p class="expansion-text"><strong>Workflow context:</strong></p>'
            + '<ul class="expansion-workflow-list">' + model.workflowLines.slice(0, 4).map(function (line) { return "<li>" + escapeHtml(line) + "</li>"; }).join("") + "</ul>"
            + "</div>")
        : "";
    var clientBlock = '<div class="expansion-section expansion-client-impact">'
        + '<p class="expansion-section-title">Why it matters</p>'
        + '<p class="expansion-text">' + escapeHtml(whyMattersText) + "</p>"
        + (clientEffectText ? ('<p class="expansion-text"><strong>Client effect:</strong> ' + escapeHtml(clientEffectText) + "</p>") : "")
        + trapHtml
        + workflowContextHtml
        + "</div>";
    var changeItemsHtml = improvementItems.length
        ? '<div class="expansion-contract-items">'
            + improvementItems.slice(0, 3).map(function (item) {
                var inspect = item.inspect || item.where || "";
                return '<div class="expansion-contract-item">'
                    + '<p class="expansion-text"><strong>Change:</strong> ' + escapeHtml(item.change) + "</p>"
                    + '<p class="expansion-text"><strong>Where:</strong> ' + escapeHtml(item.where) + "</p>"
                    + (inspect ? ('<p class="expansion-text"><strong>Inspect in schema:</strong> ' + escapeHtml(inspect) + "</p>") : "")
                    + '<p class="expansion-text"><strong>Why:</strong> ' + escapeHtml(item.why) + "</p>"
                    + "</div>";
            }).join("")
            + "</div>"
        : '<p class="expansion-text"><strong>Recommended change:</strong> ' + escapeHtml(recommendedChangeText) + "</p>"
            + '<p class="expansion-text"><strong>Where:</strong> ' + escapeHtml(formatWhereWithOpenAPITarget(leadEndpoint, model.topContext || createEmptyOpenAPIContext(), {})) + "</p>";
    var shapeComparisonHtml = (shapeTabActive && (model.points.current.length || model.points.cleaner.length))
        ? ('<div class="expansion-subblock">'
            + '<p class="expansion-text"><strong>Current vs improved (illustrative):</strong></p>'
            + '<div class="expansion-cleaner-comparison">'
            + "<div><strong>Current</strong><ul>" + (model.points.current.length ? model.points.current.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") : '<li class="subtle">Storage-shaped, mixed outcome.</li>') + "</ul></div>"
            + "<div><strong>Improved</strong><ul>" + (model.points.cleaner.length ? model.points.cleaner.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") : '<li class="subtle">Task-shaped, outcome-first.</li>') + "</ul></div>"
            + "</div>"
            + "</div>")
        : "";
    var recommendedAction = rankedFamily && rankedFamily.recommendedAction ? rankedFamily.recommendedAction : "";
    var actionLine = recommendedAction
        ? ('<p class="expansion-text"><strong>Recommended action:</strong> ' + escapeHtml(recommendedAction) + "</p>")
        : "";
    var changeBlock = '<div class="expansion-section expansion-contract-change">'
        + '<p class="expansion-section-title">Recommended action</p>'
        + actionLine
        + renderWhatToDoNextBlock(leadEndpoint, lensFindings, { maxItems: 2, leadCopy: "" })
        + changeItemsHtml
        + shapeComparisonHtml
        + "</div>";
    var evidenceListHtml = topEvidence.length
        ? ('<ul class="expansion-evidence-list">'
            + topEvidence.map(function (group) { return "<li>" + escapeHtml(formatIssueGroupCountLabel(group)) + "</li>"; }).join("")
            + "</ul>")
        : '<p class="subtle">No grouped evidence was available for this endpoint in the current view.</p>';
    var evidenceActions = '<div class="expansion-actions expansion-actions-inline">'
        + '<button type="button" class="secondary-action" data-open-evidence-id="' + escapeHtml(model.leadRow.id) + '">Open grouped deviations</button>'
        + '<button type="button" class="secondary-action" data-focus-family="' + escapeHtml(familyName) + '">Filter to family in list</button>'
        + "</div>";
    var evidenceBlock = '<div class="expansion-section expansion-open-evidence">'
        + '<p class="expansion-section-title">Grouped deviations</p>'
        + '<p class="subtle">Evidence grouped by schema field and issue type. Open grouped deviations to see the exact findings and schema grounding.</p>'
        + evidenceListHtml
        + evidenceActions
        + "</div>";
    var sections = [problemBlock, clientBlock, changeBlock, evidenceBlock];
    return '<div class="family-insight-panel">'
        + '<div class="expansion-header">'
        + '<div class="expansion-header-title">'
        + "<strong>" + escapeHtml(insightEndpointLabel) + "</strong>"
        + '<span class="expansion-secondary-label"> | Family Insight</span>'
        + "</div>"
        + "</div>"
        + '<div class="expansion-sections expansion-sections-ordered">'
        + sections.join("")
        + "</div>"
        + "</div>";
}
function familyBurdenWhyText(family) {
    var burden = state.activeTopTab === "workflow"
        ? "workflow-burden"
        : state.activeTopTab === "shape"
            ? "contract-shape"
            : "all";
    var topSignals = topFamilyBurdenSignals(family, burden, 2);
    if (burden === "workflow-burden") {
        var workflowDominant = topSignals[0] || "";
        var workflowSecondary = topSignals[1] ? (" Also: " + humanizeSignalLabel(topSignals[1]) + ".") : "";
        var workflowSentences = {
            "hidden token/context handoff appears likely": "Hidden token/context requirements across call chain.",
            "next step not clearly exposed": "Next-step requirements or identifiers not clearly exposed.",
            "sequencing appears brittle": "Call sequence depends on tracking implicit prior state.",
            "auth/header burden spread across steps": "Auth/header context spread unevenly across steps."
        };
        var workflowLead = workflowSentences[workflowDominant] || "Potential workflow sequencing or follow-up linkage issues.";
        return workflowLead + workflowSecondary;
    }
    if (burden === "contract-shape") {
        var shapeDominant = topSignals[0] || "";
        var shapeSecondary = topSignals[1] ? (" Also: " + humanizeSignalLabel(topSignals[1]) + ".") : "";
        var shapeSentences = {
            "response appears snapshot-heavy": "Snapshot-heavy response makes callers read backend graph detail before they can see the real task outcome.",
            "deep nesting appears likely": "Deep nesting buries the outcome, authoritative state, and handoff fields under incidental structure.",
            "duplicated state appears likely": "Duplicated state forces callers to guess which field is authoritative.",
            "incidental/internal fields appear to dominate": "Incidental/internal fields crowd the payload and invite coupling to storage concerns.",
            "source-of-truth fields are unclear": "Multiple state representations make the authoritative source-of-truth unclear.",
            "outcome framing is easy to miss": "Missing outcome framing makes callers infer what changed from raw payload structure.",
            "next action is weakly exposed": "Missing next-action cues make the follow-up call sequence hard to discover from the response."
        };
        var shapeLead = shapeSentences[shapeDominant] || "Response schema appears storage-shaped rather than task-oriented.";
        return shapeLead + shapeSecondary;
    }
    if (burden === "consistency") {
        var consistencyDominant = topSignals[0] || "";
        var consistencySecondary = topSignals[1] ? (" Also: " + humanizeSignalLabel(topSignals[1]) + ".") : "";
        var consistencySentences = {
            "parameter naming drift appears likely": "Similar routes use different parameter names for the same idea.",
            "path style drift appears likely": "Similar routes use different path patterns for similar actions.",
            "outcome modeled differently across similar endpoints": "Similar actions describe the result differently.",
            "response shape drift appears likely": "Similar endpoints return different response shapes."
        };
        var consistencyLead = consistencySentences[consistencyDominant] || "Similar operations drift in names, paths, or response shape.";
        return consistencyLead + consistencySecondary;
    }
    var allDimensions = (family.topDimensions || []).slice(0, 2);
    if (allDimensions.length) {
        return "Shows " + allDimensions.join(" and ") + ".";
    }
    return "Family across " + family.endpoints + " endpoint" + (family.endpoints === 1 ? "" : "s") + ".";
}
function sumSignalCounts(map) {
    return Object.keys(map || {}).reduce(function (sum, key) {
        return sum + ((map && map[key]) || 0);
    }, 0);
}
function pickFamilyDominantDriver(family) {
    var workflowScore = sumSignalCounts(family.workflowSignalCounts || {});
    var shapeScore = sumSignalCounts(family.shapeSignalCounts || {});
    var contractScore = sumSignalCounts(family.consistencySignalCounts || {});
    Object.keys(family.burdenCounts || {}).forEach(function (key) {
        if (key !== "workflow-burden" && key !== "contract-shape") {
            contractScore += (family.burdenCounts && family.burdenCounts[key]) || 0;
        }
    });
    var contractishScore = contractScore + shapeScore;
    var top = Math.max(workflowScore, contractishScore);
    var second = Math.min(workflowScore, contractishScore);
    var mixed = top > 0 && second > 0 && (second / top) >= 0.6;
    var contractSignalKey = (shapeScore >= contractScore && shapeScore > 0) ? "shape" : "contract";
    if (mixed) {
        return { key: "mixed", label: "Mixed driver", signalKey: (workflowScore >= contractishScore ? "workflow" : contractSignalKey), score: top };
    }
    if (workflowScore >= contractishScore) {
        return { key: "workflow", label: "Mostly workflow driven", signalKey: "workflow", score: workflowScore };
    }
    return { key: "contract", label: "Mostly contract driven", signalKey: contractSignalKey, score: contractishScore };
}
function familyDominantSignalsForDriver(family, driverKey) {
    if (driverKey === "workflow") {
        return sortedSignalLabels(family.workflowSignalCounts || {}, 2);
    }
    if (driverKey === "shape") {
        return sortedSignalLabels(family.shapeSignalCounts || {}, 2);
    }
    var contractSignals = sortedSignalLabels(family.consistencySignalCounts || {}, 2);
    if (contractSignals.length)
        return contractSignals;
    return (family.topDimensions || []).slice(0, 2);
}
function familyDxSignalFragment(signal) {
    var map = {
        "hidden token/context handoff appears likely": "developers must infer required handoff IDs/context between calls",
        "next step not clearly exposed": "developers cannot tell the next valid call from the response",
        "sequencing appears brittle": "developers need undocumented ordering knowledge to proceed safely",
        "auth/header burden spread across steps": "developers chase scattered auth/header requirements across steps",
        "response appears snapshot-heavy": "developers sift large snapshots to find the actual outcome",
        "deep nesting appears likely": "developers hunt through nested objects to find outcome and handoff fields",
        "duplicated state appears likely": "developers reconcile conflicting state fields across the payload",
        "incidental/internal fields appear to dominate": "developers risk coupling to storage/internal fields",
        "source-of-truth fields are unclear": "developers cannot tell which field is authoritative",
        "outcome framing is easy to miss": "developers miss the outcome because it is not framed as a result",
        "next action is weakly exposed": "developers cannot reliably discover the next action from the response",
        "parameter naming drift appears likely": "developers special-case parameter names across sibling routes",
        "path style drift appears likely": "developers cannot compose sibling routes predictably",
        "response shape drift appears likely": "developers add per-endpoint parsing branches for sibling endpoints",
        "outcome modeled differently across similar endpoints": "developers cannot reuse the same success/failure handling across siblings"
    };
    return map[signal] || humanizeSignalLabel(signal).toLowerCase();
}
function toSentenceCase(text) {
    if (!text)
        return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}
function familyRecommendedAction(driverKey, dominantSignals) {
    var signals = dominantSignals || [];
    var signal0 = (signals[0] || "").toLowerCase();
    var signal1 = (signals[1] || "").toLowerCase();
    var blob = (signal0 + " | " + signal1).trim();
    if (driverKey === "workflow") {
        if (/description/.test(blob))
            return "Add missing response descriptions";
        if (/enum|typing|weak typing/.test(blob))
            return "Declare missing enums";
        if (/token|context handoff|handoff context|next step|next action|implicit|handoff/.test(blob))
            return "Expose nextAction and required context";
        if (/sequencing|brittle|prerequisite/.test(blob))
            return "Expose prerequisites and required ordering cues";
        if (/auth\/header|auth|header/.test(blob))
            return "Expose auth/header requirements in schema and errors";
        return "Expose nextAction and required context";
    }
    if (driverKey === "shape") {
        if (/description/.test(blob))
            return "Add missing response descriptions";
        if (/enum|typing|weak typing/.test(blob))
            return "Declare missing enums";
        if (/snapshot-heavy|storage-shaped|outcome|next action/.test(blob))
            return "Expose nextAction and required context";
        if (/deep nesting/.test(blob))
            return "Move outcome and handoff IDs to top-level fields";
        if (/duplicated state/.test(blob))
            return "Remove duplicated state; keep one canonical field";
        if (/internal fields|incidental/.test(blob))
            return "Move internal fields out of default payloads";
        return "Expose nextAction and required context";
    }
    if (/description/.test(blob))
        return "Add missing response descriptions";
    if (/enum|typing|weak typing/.test(blob))
        return "Declare missing enums";
    if (/parameter naming/.test(blob))
        return "Normalize parameter naming across sibling endpoints";
    if (/path style|path patterns/.test(blob))
        return "Align path templates across sibling routes";
    if (/response shape drift|response shapes drift/.test(blob))
        return "Align response schemas across sibling endpoints";
    return "Normalize contract patterns across sibling endpoints";
}
function familyPrimaryRisk(driverKey, dominantSignals) {
    var signals = dominantSignals || [];
    var signal0 = (signals[0] || "").toLowerCase();
    var signal1 = (signals[1] || "").toLowerCase();
    var blob = (signal0 + " | " + signal1).trim();
    if (driverKey === "workflow") {
        if (/handoff context|token\/context/.test(blob))
            return "Missing explicit handoff IDs/context between calls";
        if (/auth\/header|auth|header/.test(blob))
            return "Scattered auth/context requirements across steps";
        if (/sequencing|brittle/.test(blob))
            return "Implicit prerequisites and ordering (brittle sequencing)";
        if (/next step|next action|implicit/.test(blob))
            return "Missing next-step contract (follow-up is not visible)";
        return "Workflow continuity breaks across calls (handoffs and next steps are implicit)";
    }
    if (driverKey === "shape") {
        if (/deep nesting/.test(blob))
            return "Outcome and handoff fields are buried by nesting";
        if (/duplicated state/.test(blob))
            return "Duplicated/conflicting state fields blur authority";
        if (/internal fields|incidental/.test(blob))
            return "Incidental/internal fields are exposed as primary contract surface";
        if (/snapshot-heavy|storage-shaped/.test(blob))
            return "Snapshot-heavy payload obscures the task outcome";
        if (/enum|weak typing|typing/.test(blob))
            return "Weak typing and missing enums increase integration ambiguity";
        return "Response shape hides outcome and next-step cues";
    }
    if (/parameter naming/.test(blob))
        return "Parameter naming drift across sibling routes";
    if (/path style|path patterns/.test(blob))
        return "Path template drift across sibling routes";
    if (/response shape drift|response shapes drift/.test(blob))
        return "Response shape drift across sibling endpoints";
    return "Inconsistent contract patterns across sibling endpoints";
}
function familyDriverFocus(driverKey, dominantSignals) {
    var signals = (dominantSignals || []).map(function (signal) { return (signal || "").toLowerCase(); });
    var blob = signals.join(" | ");
    if (driverKey === "workflow") {
        if (/handoff/.test(blob))
            return "Focus: handoff context + IDs";
        if (/next step|next action/.test(blob))
            return "Focus: next step visibility";
        if (/sequencing|brittle/.test(blob))
            return "Focus: prerequisites + ordering";
        return "Focus: continuity signals";
    }
    if (driverKey === "shape") {
        if (/deep nesting/.test(blob))
            return "Focus: deep nesting";
        if (/snapshot-heavy/.test(blob))
            return "Focus: snapshot-heavy responses";
        if (/duplicated state/.test(blob))
            return "Focus: duplicated state";
        if (/internal/.test(blob))
            return "Focus: internal fields";
        return "Focus: response shape";
    }
    if (/parameter naming/.test(blob))
        return "Focus: parameter consistency";
    if (/path style/.test(blob))
        return "Focus: route shape consistency";
    if (/response shape drift/.test(blob))
        return "Focus: response consistency";
    return "Focus: sibling consistency";
}
function sortedSignalLabels(map, limit) {
    return Object.keys(map || {})
        .map(function (label) { return { label: label, count: (map && map[label]) || 0 }; })
        .sort(function (a, b) {
        if (a.count !== b.count)
            return b.count - a.count;
        return a.label.localeCompare(b.label);
    })
        .slice(0, limit || 3)
        .map(function (entry) { return entry.label; });
}
function topFamilyBurdenSignals(family, burden, limit) {
    if (!family)
        return [];
    if (burden === "workflow-burden")
        return sortedSignalLabels(family.workflowSignalCounts || {}, limit || 3);
    if (burden === "contract-shape")
        return sortedSignalLabels(family.shapeSignalCounts || {}, limit || 3);
    if (burden === "consistency")
        return sortedSignalLabels(family.consistencySignalCounts || {}, limit || 3);
    return [];
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
        totals.snapshot += map["response appears snapshot-heavy"] || 0;
        totals.deep += map["deep nesting appears likely"] || 0;
        totals.dup += map["duplicated state appears likely"] || 0;
        totals.internal += map["incidental/internal fields appear to dominate"] || 0;
        totals.source += map["source-of-truth fields are unclear"] || 0;
        totals.outcome += map["outcome framing is easy to miss"] || 0;
        totals.nextAction += map["next action is weakly exposed"] || 0;
    });
    var highlights = [];
    if (totals.snapshot > 0)
        highlights.push("snapshot-heavy");
    if (totals.deep > 0)
        highlights.push("deep nesting");
    if (totals.dup > 0)
        highlights.push("duplicated state");
    if (totals.internal > 0)
        highlights.push("internal fields");
    if (totals.source > 0)
        highlights.push("unclear source-of-truth");
    if (totals.outcome > 0)
        highlights.push("missing outcome framing");
    if (totals.nextAction > 0)
        highlights.push("missing next-action cues");
    return {
        deep: totals.deep,
        internal: totals.internal,
        dup: totals.dup,
        snapshot: totals.snapshot,
        source: totals.source,
        outcome: totals.outcome,
        nextAction: totals.nextAction,
        summary: highlights.length
            ? ("highest recurring shape signals: " + highlights.join(", "))
            : "no dominant shape signal extracted from current families"
    };
}
function familyPressureByFamily(rows) {
    var byFamily = {};
    rows.forEach(function (row) {
        var key = row.family || "unlabeled family";
        if (!byFamily[key])
            byFamily[key] = { high: 0, medium: 0, low: 0 };
        byFamily[key][row.priority || "low"] = (byFamily[key][row.priority || "low"] || 0) + 1;
    });
    var output = {};
    Object.keys(byFamily).forEach(function (key) {
        output[key] = familyPressureLabel(byFamily[key]);
    });
    return output;
}
function bumpCounter(map, key) {
    map[key] = (map[key] || 0) + 1;
}
function collectDynamicBurdenSignals(rows, burdenLens) {
    var counts = {};
    var endpointDetails = (state.payload && state.payload.endpointDetails) ? state.payload.endpointDetails : {};
    rows.forEach(function (row) {
        var detail = endpointDetails[row.id];
        if (!detail || !detail.findings)
            return;
        detail.findings.forEach(function (finding) {
            var code = finding.code || "";
            var msg = (finding.message || "").toLowerCase();
            var dim = issueDimensionForFinding(finding.code || "", finding.category || "", finding.burdenFocus || "");
            if (burdenLens === "workflow-burden") {
                if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || code === "prerequisite-task-burden") {
                    bumpCounter(counts, "hidden context/token handoff");
                }
                if (code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || code === "weak-outcome-next-action-guidance" || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed|workflow guidance/.test(msg)) {
                    bumpCounter(counts, "next required step is not clearly exposed");
                }
                if (code === "prerequisite-task-burden" || /prior state|earlier|prerequisite|lookup/.test(msg)) {
                    bumpCounter(counts, "workflow sequence feels brittle");
                }
                if (/auth|authorization|header|token|context|access\s*key|api[-\s]?key/.test(msg)) {
                    bumpCounter(counts, "auth/header/context requirements spread across calls");
                }
            }
            if (burdenLens === "contract-shape") {
                if (code === "deeply-nested-response-structure" || dim === "shape / nesting complexity" || /nested|deep/.test(msg)) {
                    bumpCounter(counts, "deep nesting shows up often in this view");
                }
                if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || /snapshot|storage|model structure/.test(msg)) {
                    bumpCounter(counts, "snapshot-style state shows up often");
                }
                if (code === "duplicated-state-response" || /duplicate|duplicated/.test(msg)) {
                    bumpCounter(counts, "similar state appears repeated across response branches");
                }
                if (code === "incidental-internal-field-exposure" || dim === "internal/incidental fields" || /internal|incidental|audit|raw id/.test(msg)) {
                    bumpCounter(counts, "incidental/internal fields show up often");
                }
                if (code === "duplicated-state-response" || /source of truth|authoritative|single state|multiple state|duplicate state/.test(msg)) {
                    bumpCounter(counts, "source-of-truth fields are unclear");
                }
                if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || code === "weak-outcome-next-action-guidance" || /outcome|what changed|result meaning/.test(msg)) {
                    bumpCounter(counts, "outcome framing is easy to miss");
                }
                if (code === "weak-outcome-next-action-guidance" || code === "weak-follow-up-linkage" || code === "weak-action-follow-up-linkage" || code === "weak-accepted-tracking-linkage" || /next[-\s]?step|follow[-\s]?up|tracking|next action/.test(msg)) {
                    bumpCounter(counts, "next action is weakly exposed");
                }
                if (code === "contract-shape-workflow-guidance-burden" || code === "snapshot-heavy-response" || dim === "workflow outcome weakness" || /outcome|next action/.test(msg)) {
                    bumpCounter(counts, "task outcome / next action is easy to miss");
                }
            }
            if (burdenLens === "consistency") {
                if (code === "detail-path-parameter-name-drift") {
                    bumpCounter(counts, "parameter names differ");
                }
                if (code === "endpoint-path-style-drift" || code === "sibling-path-shape-drift") {
                    bumpCounter(counts, "path patterns differ");
                }
                if (code === "inconsistent-response-shape" || code === "inconsistent-response-shape-family" || code === "inconsistent-response-shapes" || code === "inconsistent-response-shapes-family") {
                    bumpCounter(counts, "response shapes differ");
                    bumpCounter(counts, "outcome wording differs");
                }
            }
        });
    });
    return Object.keys(counts)
        .map(function (label) { return { label: label, count: counts[label] }; })
        .sort(function (a, b) {
        if (a.count !== b.count)
            return b.count - a.count;
        return a.label.localeCompare(b.label);
    })
        .slice(0, 4);
}
function renderDynamicBurdenSignals(rows, burdenLens) {
    var signals = collectDynamicBurdenSignals(rows, burdenLens);
    if (!signals.length)
        return "";
    var heading = burdenLens === "consistency"
        ? "Most common differences in this view:"
        : "Most common in this slice:";
    var parts = signals.slice(0, 4).map(function (signal) {
        var label = burdenLens === "consistency" ? humanizeSignalLabel(signal.label) : signal.label;
        return label + " (" + signal.count + ")";
    }).filter(Boolean);
    return '<div class="burden-dynamic-signals">'
        + '<p class="burden-dynamic-signals-line"><strong>' + escapeHtml(heading) + "</strong> "
        + escapeHtml(parts.join(", "))
        + ".</p></div>";
}
function uiDominantSeverity(findings) {
    if ((findings || []).some(function (finding) { return finding.severity === 'error'; }))
        return 'error';
    if ((findings || []).some(function (finding) { return finding.severity === 'warning'; }))
        return 'warning';
    return 'info';
}
function uiSeverityPriority(severity) {
    if (severity === 'error')
        return 0;
    if (severity === 'warning')
        return 1;
    return 2;
}
function uiSeverityIcon(severity) {
    if (severity === 'error')
        return 'x';
    if (severity === 'warning')
        return '!';
    return 'i';
}
function uiPressureBadge(priority, kind) {
    var label = (priority || 'low').toUpperCase();
    return '<span class="pressure-badge pressure-' + escapeHtml(priority || 'low') + ' ' + escapeHtml(kind || '') + '">' + label + '</span>';
}
function uiHumanizeObjectName(value) {
    if (!value)
        return 'resource';
    return value.replaceAll('-', ' ').replaceAll('_', ' ');
}
function uiSingularize(value) {
    if (!value)
        return value;
    if (value.endsWith('ies'))
        return value.slice(0, -3) + 'y';
    if (value.endsWith('s') && value.length > 1)
        return value.slice(0, -1);
    return value;
}
function uiEndpointIntentCue(method, path) {
    var segments = String(path || '').split('/').filter(Boolean);
    var staticSegments = segments.filter(function (segment) {
        return segment.indexOf('{') === -1 && segment.indexOf('}') === -1;
    });
    var objectName = staticSegments.length ? staticSegments[staticSegments.length - 1] : 'resource';
    var parentName = staticSegments.length > 1 ? staticSegments[staticSegments.length - 2] : objectName;
    objectName = uiHumanizeObjectName(objectName);
    parentName = uiHumanizeObjectName(parentName);
    if (method === 'GET') {
        if (segments.length && segments[segments.length - 1].indexOf('{') !== -1)
            return 'get ' + uiSingularize(parentName);
        if (objectName === 'search')
            return 'search ' + uiSingularize(parentName);
        return 'list ' + objectName;
    }
    if (method === 'POST') {
        if (segments.length > 1 && segments[segments.length - 1].indexOf('{') === -1 && staticSegments.length > 1) {
            return uiHumanizeObjectName(staticSegments[staticSegments.length - 1]) + ' ' + uiSingularize(parentName);
        }
        return 'create ' + uiSingularize(objectName);
    }
    if (method === 'PATCH' || method === 'PUT') {
        return 'update ' + uiSingularize(parentName);
    }
    if (method === 'DELETE') {
        return 'delete ' + uiSingularize(parentName);
    }
    return method.toLowerCase() + ' ' + uiSingularize(objectName);
}
function uiHumanizeSignalLabel(signal) {
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
function uiRenderRecoveryActions(actions) {
    return '<div class="recovery-actions">' + actions.map(function (action) {
        return '<button type="button" class="secondary-action" data-recovery-action="' + escapeHtml(action) + '">' + escapeHtml(uiRecoveryLabel(action)) + '</button>';
    }).join('') + '</div>';
}
function uiBindRecoveryButtons(container, onAction) {
    if (!container)
        return;
    Array.prototype.forEach.call(container.querySelectorAll('[data-recovery-action]'), function (btn) {
        btn.addEventListener('click', function (event) {
            event.stopPropagation();
            var action = btn.getAttribute('data-recovery-action');
            onAction(action || '');
        });
    });
}
function uiPulseLensUpdate() {
    [el.familySurfaceContext, el.listContext, el.workflowSection].forEach(function (node) {
        if (!node)
            return;
        node.classList.remove('lens-updated');
        void node.offsetWidth;
        node.classList.add('lens-updated');
    });
}
function uiRecoveryLabel(action) {
    if (action === 'back-to-all-families')
        return 'Back to all families';
    if (action === 'back-to-family-table')
        return 'Back to family table';
    if (action === 'clear-search')
        return 'Clear search';
    if (action === 'show-all-matching-families')
        return 'Show all matching families';
    if (action === 'show-all-families')
        return 'Show all families';
    if (action === 'clear-table-filters')
        return 'Reset table view';
    if (action === 'show-all-workflows')
        return 'Show all workflow paths';
    return 'Reset current view';
}
function uiIssueDimensionForFinding(code, category, burdenFocus) {
    if (!code)
        return category ? category.replaceAll('-', ' ') : 'other issues';
    if (code === 'contract-shape-workflow-guidance-burden' || code === 'snapshot-heavy-response')
        return 'shape / storage-style response weakness';
    if (code === 'duplicated-state-response')
        return 'shape / duplicated state exposure';
    if (code === 'incidental-internal-field-exposure')
        return 'internal/incidental fields';
    if (code === 'deeply-nested-response-structure')
        return 'shape / nesting complexity';
    if (code === 'prerequisite-task-burden')
        return 'hidden dependency / linkage burden';
    if (code === 'weak-list-detail-linkage' || code === 'weak-follow-up-linkage' || code === 'weak-action-follow-up-linkage' || code === 'weak-accepted-tracking-linkage') {
        return 'workflow outcome weakness';
    }
    if (code === 'weak-outcome-next-action-guidance')
        return 'workflow outcome weakness';
    if (code === 'weak-array-items-schema')
        return 'shape / nesting complexity';
    if (code === 'internal-incidental-field')
        return 'internal/incidental fields';
    if (code === 'sibling-path-shape-drift' || code === 'endpoint-path-style-drift' || code === 'detail-path-parameter-name-drift')
        return 'consistency drift';
    if (code === 'likely-missing-enum' || code === 'generic-object-request' || code === 'generic-object-response')
        return 'typing/enum weakness';
    if ((category || '') === 'change-risk')
        return 'change-risk clues';
    if ((burdenFocus || '') === 'workflow-burden')
        return 'hidden dependency / linkage burden';
    if ((burdenFocus || '') === 'contract-shape')
        return 'shape / storage-style response weakness';
    if ((burdenFocus || '') === 'consistency')
        return 'consistency drift';
    return (category || 'other issues').replaceAll('-', ' ');
}
function uiDimensionImpact(dimension) {
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
function uiFindingExamineHint(code, message) {
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
function uiBuildContextTypeBadge(context) {
    var label = context.primaryLabel || '';
    var text = '';
    if (label.indexOf('Request') !== -1) {
        text = 'Request';
    }
    else if (label.indexOf('Response') !== -1) {
        text = context.statusCode ? 'Response ' + context.statusCode : 'Response';
    }
    else if (label.indexOf('Path') !== -1) {
        text = 'Path';
    }
    if (!text)
        return '';
    return '<span class="context-type-badge">' + escapeHtml(text) + '</span>';
}
function uiFamilyPressureLabel(priorityCounts) {
    var high = priorityCounts.high || 0;
    var medium = priorityCounts.medium || 0;
    if (high >= 3)
        return 'high';
    if (high > 0 || medium >= 3)
        return 'medium';
    return 'low';
}
function uiSummarizeIssueDimensions(findings) {
    var counts = {};
    findings.forEach(function (finding) {
        var label = uiIssueDimensionForFinding(finding.code || '', finding.category || '', finding.burdenFocus || '');
        counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 6)
        .map(function (entry) { return { label: entry[0], count: entry[1] }; });
}
function uiTopFamilyByFindings(rows) {
    if (!rows || !rows.length)
        return { name: 'none', findings: 0 };
    var counts = {};
    rows.forEach(function (row) {
        var familyName = row.family || '';
        counts[familyName] = (counts[familyName] || 0) + (row.findings || 0);
    });
    var ranked = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    return ranked.length ? { name: ranked[0][0], findings: ranked[0][1] } : { name: 'none', findings: 0 };
}
function uiRenderChipList(items, emptyText) {
    if (!items || !items.length)
        return '<p class="subtle">' + escapeHtml(emptyText) + '</p>';
    return '<div class="chips">' + items.map(function (item) {
        return '<span class="chip">' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
}
function uiRenderBulletList(items, emptyText) {
    if (!items || !items.length)
        return '<p class="subtle">' + escapeHtml(emptyText) + '</p>';
    return '<ul>' + items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
}
function uiRenderOpenAPISummary(items) {
    if (!items || !items.length) {
        return '<p class="subtle">OpenAPI location is only available where the message exposes request, response, field, or media-type detail.</p>';
    }
    return '<div class="openapi-summary-list">' + items.map(function (item) {
        return '<span class="openapi-pill">' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
}
function uiPriorityRank(priority) {
    if (priority === 'high')
        return 0;
    if (priority === 'medium')
        return 1;
    return 2;
}
function uiUniq(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
}
function uiFlatMap(items, fn) {
    return items.reduce(function (acc, item) { return acc.concat(fn(item)); }, []);
}
function inspectionShellActiveTopTabLabel() {
    if (state.activeTopTab === 'workflow')
        return 'Workflow Guidance';
    if (state.activeTopTab === 'shape')
        return 'Response Shape';
    return 'Contract Issues';
}
function inspectionShellRenderInspectorWorkspaceHeader(detail, findings, options) {
    var opts = options || {};
    var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
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
function inspectionShellFamilySurfaceHelpCopy() {
    if (state.activeTopTab === 'shape') {
        return '';
    }
    if (state.activeTopTab === 'workflow') {
        return 'Families ranked by workflow burden in the current slice: hidden dependencies, brittle sequencing, missing handoff IDs, and weak next-step cues.';
    }
    return state.activeTopTab === 'shape'
        ? 'Response Shape: families ranked by shape friction for the current slice.'
        : state.activeTopTab === 'workflow'
            ? 'Workflow Guidance: families ranked by visible workflow pressure for the current slice.'
            : 'Contract Issues: families ranked by visible contract evidence for the current slice.';
}
function inspectionShellBuildListContext(matches, total) {
    var lens = [];
    if (state.filters.search)
        lens.push('\u201c' + state.filters.search + '\u201d');
    if (state.filters.category === 'spec-rule' && state.activeTopTab !== 'spec-rule')
        lens.push('rules-based view: spec rule');
    else if (state.filters.category !== 'all')
        lens.push('category: ' + state.filters.category.replaceAll('-', ' '));
    if (state.filters.familyPressure !== 'all')
        lens.push('pressure: ' + state.filters.familyPressure);
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
    }
    else if (state.activeTopTab === 'workflow') {
        burdenExplanation = '<div class="burden-explanation">'
            + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
            + '<strong>Workflow Guidance</strong> — family cards highlight cross-step continuity pressure that makes real call paths harder to complete safely.'
            + '<ul>'
            + '<li>Hidden token/context/header dependencies appear across steps.</li>'
            + '<li>Sequencing suggests brittle handoffs where the next required step is not clearly exposed.</li>'
            + '<li>Outcome guidance appears weak, so callers likely infer what to do next.</li>'
            + '<li>Endpoint rows provide supporting evidence and open inline diagnostics when selected.</li>'
            + '</ul>'
            + renderDynamicBurdenSignals(visibleRows, 'workflow-burden')
            + '</div>';
    }
    else if (state.activeTopTab === 'shape') {
        burdenExplanation = '<div class="burden-explanation">'
            + '<span class="evidence-track-label evidence-track-heuristic">Guidance view</span>'
            + '<strong>Response Shape</strong> — diagnoses real DX cost from storage-shaped payloads, not backend graph completeness.'
            + '<ul>'
            + '<li>Diagnose deep nesting, duplicated state, snapshot-heavy payloads, internal-field exposure, and unclear source-of-truth fields.</li>'
            + '<li>Diagnose missing outcome framing and missing next-action cues in shape-heavy responses.</li>'
            + '<li>Grouped deviations include OpenAPI location cues and show concrete schema locations for each finding.</li>'
            + '</ul>'
            + renderDynamicBurdenSignals(visibleRows, 'contract-shape')
            + '</div>';
    }
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var guide = matches > 0
        ? (workflowTabActive
            ? 'Family cards summarize continuity pressure; selecting an endpoint opens inline diagnostics and grouped deviations.'
            : shapeTabActive
                ? 'Family cards rank response-shape burden; selecting an endpoint opens inline diagnostics and grouped deviations.'
                : 'Family cards group contract issues by family; selecting an endpoint opens grouped deviations with OpenAPI location cues.')
        : 'No rows match. Use the family no-match recovery above to widen the view.';
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
function inspectionShellRenderEndpointInspectionContent(detail, options) {
    var opts = options || {};
    var findings = findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var familyName = endpoint.family || '';
    var groups = groupFindings(findings);
    var severity = dominantSeverity(findings);
    var topGroup = groups[0] || null;
    var relatedChains = detail.relatedChains || [];
    var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
    var chainContext = buildChainContext(relatedChains, endpoint.id || state.selectedEndpointId, endpointDetails);
    var topMsg = topGroup && topGroup.messages[0] ? topGroup.messages[0] : 'No issue message extracted.';
    var topContext = topGroup ? topGroup.context : createEmptyOpenAPIContext();
    var contextBadge = buildContextTypeBadge(topContext);
    var cleanerHint = topGroup ? dimensionCleanerHint(topGroup.dimension) : '';
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
        + '      <div class="detail-subline">' + escapeHtml(endpointIntentCue(endpoint.method, endpoint.path)) + ' | ' + escapeHtml(humanFamilyLabel(endpoint.family || '')) + '</div>'
        + '    </div>'
        + '    <div class="detail-badges">'
        + pressureBadge(endpoint.priority || '', 'pressure')
        + severityBadge(severity)
        + '    </div>'
        + '  </div>'
        + '  <div class="lead-finding">'
        + '    <div class="lead-finding-head">'
        + contextBadge
        + '    </div>'
        + '    <p class="lead-finding-message">' + escapeHtml(topMsg) + '</p>'
        + '    <div class="lead-finding-grounding">'
        + renderOpenAPILocationCuesBlock(topContext, false)
        + (topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '')
        + '</div>'
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
function inspectionShellSyncSelectedEndpointHighlight() {
    if (!el.familySurface)
        return;
    Array.prototype.forEach.call(el.familySurface.querySelectorAll('.family-row.row-selected, .endpoint-subrow.row-selected, .nested-endpoint-row.row-selected'), function (row) {
        row.classList.remove('row-selected');
    });
    Array.prototype.forEach.call(el.familySurface.querySelectorAll('tr[data-family-row="true"].row-has-selected-child'), function (row) {
        row.classList.remove('row-has-selected-child');
    });
    if (!state.selectedEndpointId)
        return;
    var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
    var selectedDetail = endpointDetails[state.selectedEndpointId];
    var selectedFamilyName = selectedDetail && selectedDetail.endpoint ? (selectedDetail.endpoint.family || '') : '';
    var selectedSubrow = el.familySurface.querySelector('.nested-endpoint-row[data-endpoint-id="' + state.selectedEndpointId + '"], .endpoint-subrow[data-endpoint-id="' + state.selectedEndpointId + '"]');
    if (selectedSubrow) {
        selectedSubrow.classList.add('row-selected');
        var ownerFamily = selectedSubrow.getAttribute('data-family') || selectedFamilyName;
        if (ownerFamily) {
            var ownerRow = el.familySurface.querySelector('tr[data-family="' + ownerFamily + '"][data-family-row="true"]');
            if (ownerRow)
                ownerRow.classList.add('row-has-selected-child');
        }
        return;
    }
    if (selectedFamilyName) {
        var familyRow = el.familySurface.querySelector('tr[data-family="' + selectedFamilyName + '"][data-family-row="true"]');
        if (familyRow)
            familyRow.classList.add('row-selected');
    }
}
function inspectionShellEndpointHasWorkflowBurden(detail) {
    if (state.activeTopTab !== 'workflow')
        return false;
    if (!detail)
        return false;
    if ((detail.relatedChains || []).length)
        return true;
    var findings = detail.findings || [];
    return findings.some(function (f) {
        if (!f)
            return false;
        if (f.burdenFocus === 'workflow-burden')
            return true;
        var code = f.code || '';
        return code === 'prerequisite-task-burden'
            || code === 'weak-follow-up-linkage'
            || code === 'weak-action-follow-up-linkage'
            || code === 'weak-accepted-tracking-linkage'
            || code === 'weak-outcome-next-action-guidance'
            || code === 'contract-shape-workflow-guidance-burden';
    });
}
function inspectionShellRenderInspectorWorkflowContextSupport(detail, options) {
    var opts = options || {};
    if (!inspectionShellEndpointHasWorkflowBurden(detail))
        return '';
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
        + '<p class="subtle">Use this when the contract forces hidden handoffs or unclear next steps. Steps are linked to inline endpoint diagnostics.</p>'
        + bodyHtml
        + '</div>'
        + '</details>';
}
function inspectionShellRenderCommonWorkflowJourneys(chains) {
    var allChains = (chains && chains.length) ? chains : viewScopePayloadWorkflowChains();
    if (!allChains.length)
        return '';
    var byKind = {};
    allChains.forEach(function (chain) {
        var kind = chain.kind || 'workflow';
        if (!byKind[kind])
            byKind[kind] = [];
        byKind[kind].push(chain);
    });
    var journeyPatterns = Object.keys(byKind)
        .map(function (kind) {
        var kindChains = byKind[kind];
        var totalBurden = kindChains.reduce(function (sum, chain) { return sum + workflowSurfaceChainBurdenScore(chain); }, 0);
        return { kind: kind, chains: kindChains, totalBurden: totalBurden };
    })
        .filter(function (entry) { return entry.totalBurden > 0; })
        .sort(function (a, b) { return b.totalBurden - a.totalBurden; })
        .slice(0, 4);
    if (!journeyPatterns.length)
        return '';
    var journeyHtml = journeyPatterns.map(function (pattern) {
        return workflowJourneyRenderGuidance(pattern.kind, pattern.chains, workflowJourneyAnalyzePattern(pattern.kind, pattern.chains, viewScopePayloadEndpointDetails(), workflowSurfaceParseChainRoles, workflowSurfaceCollectBurdenSummary, workflowStepBuildDependencyClues, workflowSurfaceHumanizeStepRole), workflowSurfaceKindGroupLabel(pattern.kind), pattern.totalBurden, escapeHtml);
    }).join('');
    return '<div class="workflow-journeys-section">'
        + '<div class="workflow-journeys-header">'
        + '<p class="workflow-journeys-kicker">Common workflow journeys</p>'
        + '<p class="workflow-journeys-copy">Problem-finding guide for developers. Identifies where the contract fails to guide you through each workflow and what a workflow-first contract must expose.</p>'
        + '</div>'
        + journeyHtml
        + '</div>';
}
function inspectionShellAnalyzeWorkflowPattern(kind, chains) {
    return workflowJourneyAnalyzePattern(kind, chains, viewScopePayloadEndpointDetails(), workflowSurfaceParseChainRoles, workflowSurfaceCollectBurdenSummary, workflowStepBuildDependencyClues, workflowSurfaceHumanizeStepRole);
}
function inspectionShellRenderWorkflowJourneyGuidance(kind, chains) {
    var totalBurden = chains.reduce(function (sum, chain) { return sum + workflowSurfaceChainBurdenScore(chain); }, 0);
    var analysis = inspectionShellAnalyzeWorkflowPattern(kind, chains);
    return workflowJourneyRenderGuidance(kind, chains, analysis, workflowSurfaceKindGroupLabel(kind), totalBurden, escapeHtml);
}
function inspectionShellRenderWorkflowJourneyProblems(problems) {
    return workflowJourneyRenderProblems(problems, escapeHtml);
}
function inspectionShellRenderWorkflowJourneyContractGaps(gaps) {
    return workflowJourneyRenderContractGaps(gaps, escapeHtml);
}
function inspectionShellRenderWorkflowJourneyProposal(kind, analysis) {
    return workflowJourneyRenderProposal(kind, analysis, escapeHtml);
}
function inspectorRenderEndpointDiagnosticsSummary(detail) {
    var findings = findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var topContext = topGroup ? topGroup.context : createEmptyOpenAPIContext();
    var severity = dominantSeverity(findings);
    var contextBadge = uiBuildContextTypeBadge(topContext);
    var openApiBlock = renderOpenAPILocationCuesBlock(topContext, true);
    var specGrounding = topGroup && topGroup.isSpecRule ? renderSpecRuleGroundingForGroup(topGroup) : '';
    var groundingBits = '';
    groundingBits += openApiBlock;
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
        + '      <div class="detail-subline">' + escapeHtml(endpointIntentCue(endpoint.method, endpoint.path)) + ' | ' + escapeHtml(humanFamilyLabel(endpoint.family || '')) + '</div>'
        + '    </div>'
        + '    <div class="detail-badges">'
        + pressureBadge(endpoint.priority || '', 'pressure')
        + severityBadge(severity)
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
function inspectorRenderEndpointDiagnosticsShapeSummary(detail) {
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var shapeTotals = collectShapeSignalTotalsForDetail(detail);
    var painSignals = collectShapePainSignals(endpoint, findings);
    var painHtml = renderShapePainSignals(painSignals);
    var comparisonHtml = renderInspectorContractShapeComparison(detail, findings, {
        title: 'Current response shape vs better workflow-first response shape',
        context: 'shape'
    });
    var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, '', false);
    var guidanceHtml = renderTrapGuidanceList(guidance, {
        title: 'Shape trap guidance',
        className: 'inspector-trap-guidance',
        limit: 3
    });
    var profileItems = [
        { key: 'deep', label: 'deep nesting', val: shapeTotals.deep },
        { key: 'dup', label: 'duplicated state', val: shapeTotals.dup },
        { key: 'internal-fields', label: 'incidental/internal fields', val: shapeTotals.internal },
        { key: 'snapshot-heavy', label: 'snapshot-heavy response', val: shapeTotals.snapshot },
        { key: 'missing-outcome', label: 'missing outcome framing', val: shapeTotals.outcome },
        { key: 'missing-next-action', label: 'missing next-action cues', val: shapeTotals.nextAction }
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
    var locationHighlights = topOpenAPIHighlights(groups).slice(0, 3);
    var locationHtml = locationHighlights.length
        ? '<p class="shape-location-hint">Schema locations with most signals: '
            + locationHighlights.map(function (location) { return '<code>' + escapeHtml(location) + '</code>'; }).join(' · ')
            + '</p>'
        : '';
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
function inspectorRenderEndpointDiagnosticsExact(detail) {
    var findings = findingsForActiveLens(detail.findings || []);
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var familyName = endpoint.family || '';
    var groups = groupFindings(findings);
    var openDrawer = state.detailEvidenceOpenForId === state.selectedEndpointId;
    return '<div class="endpoint-diag-pane">'
        + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: familyName, open: openDrawer })
        + inspectorRenderGroundingAndFlowContext(detail)
        + '</div>';
}
function inspectorRenderGroundingAndFlowContext(detail) {
    var specRuleTabActive = state.activeTopTab === 'spec-rule';
    var workflowTabActive = state.activeTopTab === 'workflow';
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var topGroup = groups[0] || null;
    var topContext = topGroup ? topGroup.context : createEmptyOpenAPIContext();
    var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
    var chainContext = (workflowTabActive && !specRuleTabActive)
        ? buildChainContext(detail.relatedChains || [], endpoint.id || state.selectedEndpointId, endpointDetails)
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
            + schemaClues.map(function (location) { return '<code>' + escapeHtml(location) + '</code>'; }).join(' · ')
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
function inspectorRenderContentMap() {
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
    var mapping = workflowTabActive
        ? 'Workflow Guidance inspector: Continuity summary = step-position context, hidden deps, traps. Grouped deviations = evidence grouped by schema field + issue type.'
        : shapeTabActive
            ? 'Response Shape inspector: Shape pain = per-signal DX analysis + caller-needed. Contract improvements = exact response/schema edits. Grouped deviations = evidence grouped by schema field + issue type.'
            : 'Contract Issues inspector: OpenAPI rule violations (REQUIRED vs SHOULD) + consistency drift. Grouped deviations = evidence grouped by schema field + issue type.';
    return '<p class="subtle inspector-content-map-inline"><strong>Inspector scope:</strong> ' + escapeHtml(mapping) + '</p>';
}
function renderFamilyTableClamp(text, className) {
    var value = text || "—";
    return '<div class="' + className + '" title="' + escapeHtml(value) + '">' + escapeHtml(value) + "</div>";
}
function familyTopSignalLabelForRow(family, ranked) {
    var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
    var top = items.length ? items[0] : "";
    return top ? humanizeSignalLabel(top) : "—";
}
function familySignalItemsForActiveLens(family, ranked) {
    if (state.activeTopTab === "workflow") {
        return sortedSignalLabels(family.workflowSignalCounts || {}, 50);
    }
    if (state.activeTopTab === "shape") {
        return sortedSignalLabels(family.shapeSignalCounts || {}, 50);
    }
    var dims = (family.topDimensions || []).slice();
    if (dims.length)
        return dims;
    return (ranked && ranked.dominantSignals) ? ranked.dominantSignals.slice() : [];
}
function renderFamilyDominantSignalsCell(family, ranked) {
    var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
    if (!items.length) {
        if (state.activeTopTab === "workflow")
            items = ["missing next action"];
        else if (state.activeTopTab === "shape")
            items = ["storage-shaped response"];
        else
            items = ["mixed contract signals"];
    }
    var familyName = family.family || "unlabeled family";
    var inlineExpand = state.activeTopTab === "shape";
    var expanded = inlineExpand && !!(state.expandedFamilySignals && state.expandedFamilySignals[familyName]);
    var visibleCount = inlineExpand
        ? (expanded ? items.length : (items.length <= 4 ? items.length : 2))
        : (items.length <= 3 ? items.length : 2);
    var visible = items.slice(0, visibleCount);
    var hidden = items.slice(visibleCount);
    var visibleChips = visible.map(function (item, index) {
        var cls = index === 0 ? "chip chip-primary family-signal-chip" : "chip chip-secondary family-signal-chip";
        var label = humanizeSignalLabel(item);
        return '<span class="' + cls + '" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
            + escapeHtml(label)
            + "</span></span>";
    }).join("");
    var hiddenChips = hidden.map(function (item) {
        var label = humanizeSignalLabel(item);
        return '<span class="chip chip-secondary family-signal-chip" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
            + escapeHtml(label)
            + "</span></span>";
    }).join("");
    var more = "";
    if (inlineExpand && items.length > 4) {
        var label = expanded ? "Hide extra signals" : ("Show " + hidden.length + " more");
        more = '<button type="button" class="tertiary-action family-signal-expand" data-expand-signals="'
            + escapeHtml(familyName)
            + '" aria-expanded="' + (expanded ? "true" : "false") + '">'
            + escapeHtml(label)
            + "</button>";
    }
    return '<div class="family-signal-cell">'
        + '<div class="chips family-signal-chips">' + visibleChips + "</div>"
        + ((expanded && hiddenChips) ? ('<div class="chips family-signal-reveal" aria-label="More shape signals">' + hiddenChips + "</div>") : "")
        + more
        + "</div>";
}
function renderFamilyTopSignalCell(family, ranked) {
    var items = familySignalItemsForActiveLens(family, ranked).filter(Boolean);
    if (!items.length) {
        if (state.activeTopTab === "workflow")
            items = ["missing next action"];
        else if (state.activeTopTab === "shape")
            items = ["storage-shaped response"];
        else
            items = ["mixed contract signals"];
    }
    var familyName = family.family || "unlabeled family";
    var inlineExpand = state.activeTopTab === "shape";
    var expanded = inlineExpand && !!(state.expandedFamilySignals && state.expandedFamilySignals[familyName]);
    var visibleCount = inlineExpand
        ? (expanded ? items.length : (items.length <= 4 ? items.length : 2))
        : (items.length <= 3 ? items.length : 2);
    var visible = items.slice(0, visibleCount).map(function (raw, index) {
        var label = raw ? humanizeSignalLabel(raw) : "—";
        var cls = index === 0 ? "chip chip-primary family-signal-chip" : "chip chip-secondary family-signal-chip";
        return '<span class="' + cls + '" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
            + escapeHtml(label)
            + "</span></span>";
    }).join("");
    var hidden = items.slice(visibleCount);
    var hiddenChips = hidden.map(function (item) {
        var label = humanizeSignalLabel(item);
        return '<span class="chip chip-secondary family-signal-chip" title="' + escapeHtml(label) + '"><span class="family-signal-chip-label">'
            + escapeHtml(label)
            + "</span></span>";
    }).join("");
    var more = "";
    if (inlineExpand && items.length > 4) {
        var label = expanded ? "Hide extra signals" : ("Show " + hidden.length + " more");
        more = '<button type="button" class="tertiary-action family-signal-expand" data-expand-signals="'
            + escapeHtml(familyName)
            + '" aria-expanded="' + (expanded ? "true" : "false") + '">'
            + escapeHtml(label)
            + "</button>";
    }
    return '<div class="family-signal-cell family-top-signal-cell">'
        + '<div class="chips family-signal-chips">' + visible + "</div>"
        + ((expanded && hiddenChips) ? ('<div class="chips family-signal-reveal" aria-label="More shape signals">' + hiddenChips + "</div>") : "")
        + more
        + "</div>";
}
function familyTableColumnsForActiveTab() {
    var tab = activeTopTabConfig();
    var shape = tab.id === "shape";
    function severityMixHeaderHtml() {
        return '<span class="th-title">Severity mix</span>'
            + '<span class="th-helper" title="Counts are endpoints in this family with in-scope findings at each severity (High/Med/Low).">endpoint counts</span>';
    }
    function endpointsHeaderHtml() {
        return '<span class="th-title">Endpoints</span>'
            + '<span class="th-helper" title="Expands the family to show endpoint rows and inline evidence.">inline evidence</span>';
    }
    var cols = [
        {
            key: "family",
            thClass: "family-col-name",
            th: "Family",
            tdClass: "family-col-name",
            render: function (family, ctx) {
                var familyName = ctx.familyName;
                return '<div class="family-name-static">'
                    + '<span class="family-name-main">'
                    + '<strong title="' + escapeHtml(humanFamilyLabel(familyName)) + '">' + escapeHtml(humanFamilyLabel(familyName)) + "</strong>"
                    + '<span class="family-name-badgewrap">' + pressureBadge(family.pressure, "pressure-badge") + "</span>"
                    + "</span>"
                    + "</div>";
            }
        },
        {
            key: "priority",
            thClass: "family-col-priority",
            thHtml: severityMixHeaderHtml(),
            th: "",
            tdClass: "family-col-priority",
            render: function (family) {
                return renderFamilyPriorityCountStack(family.priorityCounts || {});
            }
        },
        {
            key: "endpoints",
            thClass: "family-col-endpoints",
            thAttrs: ' title="Expand the family to see its endpoints and inline evidence."',
            thHtml: endpointsHeaderHtml(),
            tdClass: "family-col-endpoints",
            render: function (family, ctx) {
                var familyName = ctx.familyName;
                var endpointsExpanded = state.expandedFamily === familyName;
                return '<button type="button" class="endpoints-expand' + (endpointsExpanded ? " is-expanded" : "") + '" data-expand-endpoints="'
                    + escapeHtml(familyName)
                    + '" aria-expanded="' + (endpointsExpanded ? "true" : "false") + '" title="'
                    + escapeHtml(endpointsExpanded ? "Hide endpoints in this family" : "Show endpoints in this family")
                    + '" aria-label="'
                    + escapeHtml(endpointsExpanded ? "Hide endpoints in this family" : "Show endpoints in this family")
                    + '">'
                    + '<span class="endpoints-expand-count">' + family.endpoints + "</span>"
                    + '<span class="endpoints-expand-chevron" aria-hidden="true"></span>'
                    + "</button>";
            }
        }
    ];
    cols.push({
        key: "signals",
        thClass: "family-col-top-signal",
        th: "Lead signal",
        tdClass: "family-col-top-signal",
        render: function (family, ctx) {
            return renderFamilyTopSignalCell(family, ctx.ranked);
        }
    });
    cols.push({
        key: "risk",
        thClass: "family-col-primary-risk",
        th: "Why this matters",
        tdClass: "family-col-primary-risk",
        render: function (_family, ctx) {
            var ranked = ctx.ranked || familyInsightBuildRankedSummary(_family);
            var whyText = ranked.dxConsequence || ranked.primaryRisk || (ranked.driver === "workflow"
                ? "Developers must infer multi-step behavior from runtime instead of contract guidance."
                : ranked.driver === "shape"
                    ? "Developers have to interpret storage-shaped payloads instead of a task outcome."
                    : "Developers cannot reliably infer behavior from the contract alone.");
            var clampClass = shape
                ? "family-table-clamp family-table-clamp-risk"
                : "family-table-clamp family-table-clamp-3 family-table-clamp-risk";
            return renderFamilyTableClamp(whyText, clampClass);
        }
    });
    cols.push({
        key: "impact",
        thClass: "family-col-client-effect",
        th: "Recommended fix direction",
        tdClass: "family-col-client-effect",
        render: function (family, ctx) {
            var ranked = ctx.ranked || familyInsightBuildRankedSummary(family);
            return renderFamilyTableClamp(ranked.recommendedAction || "Clarify the contract for the next developer action.", "family-table-clamp family-table-clamp-3 family-table-clamp-effect");
        }
    });
    cols.push({
        key: "actions",
        thClass: "family-col-actions",
        th: "Actions",
        tdClass: "family-col-actions",
        render: function (_family, ctx) {
            var familyName = ctx.familyName;
            var insightExpanded = state.expandedFamilyInsight === familyName;
            return '<button type="button" class="secondary-action family-row-action" data-insight-toggle="' + escapeHtml(familyName) + '"'
                + ' aria-expanded="' + (insightExpanded ? "true" : "false") + '"'
                + ' title="' + escapeHtml(insightExpanded ? "Hide summary" : "Show summary") + '">'
                + escapeHtml(insightExpanded ? "Hide summary" : "Show summary")
                + "</button>";
        }
    });
    return cols;
}
function familyTableColumnCountForActiveTab() {
    return familyTableColumnsForActiveTab().length;
}
function renderFamilyTableColGroup(cols) {
    if (!cols || !cols.length)
        return "";
    return "<colgroup>" + cols.map(function (col) {
        var klass = col.tdClass || col.thClass || "";
        return "<col" + (klass ? (' class="' + escapeHtml(klass) + '"') : "") + ">";
    }).join("") + "</colgroup>";
}
function renderFamilyTableView(summaries) {
    if (!summaries.length)
        return "";
    function familyHeaderLabelHtml(col) {
        if (!col)
            return "";
        if (col.thHtml)
            return col.thHtml;
        if (col.th)
            return '<span class="th-title">' + escapeHtml(col.th) + "</span>";
        return "";
    }
    function focusedFamilyNameFromSummaries(items) {
        var search = (state.filters.search || "").trim().toLowerCase();
        if (!search || search.charAt(0) !== "/")
            return "";
        var match = (items || []).find(function (family) {
            return ((family.family || "").trim().toLowerCase() === search);
        });
        return match ? (match.family || "") : "";
    }
    var drilled = hasFamilyDrillActive(state, isExactFamilyName);
    var focusedFamily = focusedFamilyNameFromSummaries(summaries);
    var expansionOwnsContext = !!state.expandedFamily;
    var hasContextBar = !expansionOwnsContext && (drilled || !!focusedFamily);
    var contextLabel = focusedFamily
        ? ("<strong>Focused family:</strong> " + escapeHtml(focusedFamily))
        : "<strong>All families</strong>";
    var backControl = drilled && !expansionOwnsContext
        ? '<button type="button" class="secondary-action family-table-back" data-recovery-action="back-to-all-families">Back to all families</button>'
        : "";
    var contextBar = hasContextBar
        ? '<div class="family-table-contextbar" role="status" aria-label="Family table context">'
            + '<div class="family-table-contextlabel">' + contextLabel + "</div>"
            + '<div class="family-table-contextactions">' + backControl + "</div>"
            + "</div>"
        : "";
    var cols = familyTableColumnsForActiveTab();
    var rankedByFamily = {};
    var dxConsequenceCounts = {};
    summaries.forEach(function (family) {
        var key = family.family || "unlabeled family";
        var ranked = familyInsightBuildRankedSummary(family);
        rankedByFamily[key] = ranked;
        var dx = ranked.dxConsequence || "";
        dxConsequenceCounts[dx] = (dxConsequenceCounts[dx] || 0) + 1;
    });
    var rows = [];
    summaries.forEach(function (family) {
        var key = family.family || "unlabeled family";
        rows.push(renderFamilyTableRow(family, {
            ranked: rankedByFamily[key],
            dxCounts: dxConsequenceCounts,
            columns: cols
        }));
        var familyInsightRow = renderFamilyInlineInsightRow(family);
        if (familyInsightRow)
            rows.push(familyInsightRow);
        var expansionHtml = renderFamilyEndpointExpansion(family);
        if (expansionHtml)
            rows.push(expansionHtml);
    });
    return '<div class="family-table-shell' + (hasContextBar ? " family-table-shell-scoped" : "") + (focusedFamily ? " family-table-shell-has-focus" : "") + '">'
        + contextBar
        + '<table class="family-table">'
        + renderFamilyTableColGroup(cols)
        + '<thead class="family-table-head"><tr>'
        + cols.map(function (col) {
            var klass = col.thClass ? (' class="' + col.thClass + '"') : "";
            var attrs = col.thAttrs || "";
            return "<th" + klass + attrs + ">" + familyHeaderLabelHtml(col) + "</th>";
        }).join("")
        + "</tr></thead>"
        + "<tbody>"
        + rows.join("")
        + "</tbody>"
        + "</table>"
        + "</div>";
}
function renderFamilyTableRow(family, options) {
    var settings = options || {};
    var familyName = family.family || "unlabeled family";
    var ranked = settings.ranked || familyInsightBuildRankedSummary(family);
    var expandedClass = state.expandedFamily === familyName ? " is-expanded" : "";
    var search = (state.filters.search || "").trim().toLowerCase();
    var isFocused = (search && search.charAt(0) === "/" && familyName.trim().toLowerCase() === search)
        || state.expandedFamily === familyName
        || state.expandedFamilyInsight === familyName;
    var focusedClass = isFocused ? " row-focused" : "";
    var workflowFamilyActiveClass = (state.activeTopTab === "workflow" && state.expandedFamily === familyName)
        ? " family-row-workflow-active"
        : "";
    var cols = settings.columns || [];
    var ctx = {
        familyName: familyName,
        ranked: ranked,
        dxCounts: settings.dxCounts || {}
    };
    return '<tr class="family-row pressure-' + family.pressure + expandedClass + focusedClass + workflowFamilyActiveClass + '" data-family="'
        + escapeHtml(family.family)
        + '" data-family-row="true" data-driver="' + escapeHtml(ranked.driver || "contract") + '">'
        + cols.map(function (col) {
            var tdClass = col.tdClass ? (' class="' + col.tdClass + '"') : "";
            var extra = col.key === "family" ? (' data-focus-family-cell="' + escapeHtml(familyName) + '"') : "";
            return "<td" + tdClass + extra + ">" + (col.render ? col.render(family, ctx) : "") + "</td>";
        }).join("")
        + "</tr>";
}
function renderDxConsequenceCellValue(ranked, repeatCount) {
    var consequence = (ranked && ranked.dxConsequence) ? ranked.dxConsequence : "";
    if (!consequence)
        return { html: false, value: "—" };
    if (repeatCount >= 4) {
        var parts = (ranked.dxParts && ranked.dxParts.length) ? ranked.dxParts : [consequence.replace(/\.$/, "")];
        var label = parts[0] || consequence.replace(/\.$/, "");
        if (parts.length > 2) {
            label = label + " (+" + (parts.length - 1) + ")";
        }
        return {
            html: true,
            value: '<span class="family-effect-repeat" title="' + escapeHtml(consequence) + '">' + escapeHtml(label) + "</span>"
        };
    }
    return { html: false, value: consequence };
}
function renderCallerBurdenCellValue(ranked) {
    var reasons = (ranked && ranked.dxReasons && ranked.dxReasons.length)
        ? ranked.dxReasons.slice()
        : ((ranked && ranked.dxParts && ranked.dxParts.length) ? ranked.dxParts.slice() : []);
    reasons = uniq((reasons || []).filter(Boolean));
    if (!reasons.length)
        return { html: false, value: "—" };
    var primary = reasons[0] || "";
    var secondary = reasons[1] || "";
    var hidden = reasons.slice(1);
    if (reasons.length === 1) {
        return {
            html: true,
            value: '<div class="caller-burden-cell">'
                + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
                + escapeHtml(primary)
                + "</span>"
                + "</div>"
        };
    }
    if (reasons.length === 2) {
        return {
            html: true,
            value: '<div class="caller-burden-cell">'
                + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
                + escapeHtml(primary)
                + "</span>"
                + '<span class="chip chip-secondary caller-burden-chip" title="' + escapeHtml(secondary) + '">'
                + escapeHtml(secondary)
                + "</span>"
                + "</div>"
        };
    }
    return {
        html: true,
        value: '<div class="caller-burden-cell">'
            + '<span class="chip chip-primary caller-burden-chip" title="' + escapeHtml(primary) + '">'
            + escapeHtml(primary)
            + "</span>"
            + '<span class="chip chip-secondary caller-burden-chip caller-burden-more" title="' + escapeHtml(hidden.join("; ")) + '">+'
            + String(hidden.length)
            + " more</span>"
            + "</div>"
    };
}
function renderFamilyClientEffectCell(effect) {
    var resolved = effect || { html: false, value: "—" };
    if (resolved.html) {
        return '<div class="family-client-effect-chipwrap">' + resolved.value + "</div>";
    }
    return renderFamilyTableClamp(resolved.value || "—", "family-table-clamp family-table-clamp-3 family-table-clamp-effect");
}
function renderFamilyPriorityCountStack(priorityCounts) {
    var counts = priorityCounts || {};
    if (state.activeTopTab === "workflow" || state.activeTopTab === "shape") {
        var high = counts.high || 0;
        var medium = counts.medium || 0;
        var low = counts.low || 0;
        var title = "Severity mix (endpoint counts): High " + high + ", Medium " + medium + ", Low " + low + ". Counts are endpoints in this family with in-scope findings at each severity.";
        function chip(key, shortLabel, value) {
            return '<span class="pressure-mix-chip mix-' + escapeHtml(key) + '" title="' + escapeHtml(shortLabel + ": " + value + " endpoints") + '">'
                + '<span class="pressure-mix-label">' + escapeHtml(shortLabel) + "</span>"
                + '<span class="pressure-mix-count">' + String(value) + "</span>"
                + "</span>";
        }
        return '<div class="pressure-mix-inline" title="' + escapeHtml(title) + '">'
            + chip("high", "High", high)
            + chip("medium", "Med", medium)
            + chip("low", "Low", low)
            + "</div>";
    }
    var items = [
        { key: "high", label: "High:" },
        { key: "medium", label: "Medium:" },
        { key: "low", label: "Low:" }
    ];
    var lines = items.filter(function (item) {
        return (counts[item.key] || 0) > 0;
    }).map(function (item) {
        var value = counts[item.key] || 0;
        return '<div class="family-priority-line" title="' + escapeHtml(item.label.replace(":", "") + ": " + value) + '">'
            + '<span class="family-priority-chip priority-' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + "</span>"
            + '<span class="family-priority-count">' + value + "</span>"
            + "</div>";
    }).join("");
    if (!lines)
        return '<span class="subtle">—</span>';
    return '<div class="family-priority-stack">' + lines + "</div>";
}
function renderFamilyInlineInsightRow(family) {
    var familyName = family.family || "unlabeled family";
    if (state.expandedFamilyInsight !== familyName)
        return "";
    return '<tr class="family-expansion-row family-inline-insight-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="'
        + escapeHtml(family.family)
        + '"><td colspan="'
        + String(familyTableColumnCountForActiveTab())
        + '" class="family-expansion-cell"><div class="family-row-insight">'
        + renderFamilyInsightPanel(family)
        + "</div></td></tr>";
}
function renderFamilyEndpointExpansion(family) {
    var familyName = family.family || "unlabeled family";
    if (state.expandedFamily !== familyName)
        return "";
    var familyLabel = humanFamilyLabel(familyName);
    var familyHeader = '<p class="family-endpoint-table-title">Endpoints in <code>' + escapeHtml(familyLabel) + "</code> family</p>";
    var headerRow = '<div class="family-endpoint-table-header-row">' + familyHeader + "</div>";
    var backToTableControl = state.familyTableBackState
        ? '<button type="button" class="secondary-action family-endpoint-footer-action" data-recovery-action="back-to-all-families">Back to all families</button>'
        : "";
    var collapseControl = '<button type="button" class="tertiary-action family-endpoint-toggle family-endpoint-footer-action" data-expand-endpoints="'
        + escapeHtml(familyName)
        + '" aria-label="Hide endpoints" title="Hide endpoints"><span class="family-endpoint-toggle-label">Hide endpoints</span><span class="family-endpoint-toggle-chevron" aria-hidden="true"></span></button>';
    var footerActions = '<div class="family-endpoint-table-actions family-endpoint-table-footer-actions">'
        + backToTableControl
        + collapseControl
        + "</div>";
    var endpointsInFamily = filteredRows().filter(function (endpoint) {
        return (endpoint.family || "unlabeled family") === familyName;
    });
    if (!endpointsInFamily.length) {
        return '<tr class="family-expansion-row family-endpoint-table-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="'
            + escapeHtml(family.family)
            + '"><td colspan="'
            + String(familyTableColumnCountForActiveTab())
            + '" class="family-expansion-cell"><div class="family-endpoint-table-shell"><div class="empty inline-empty family-inline-empty"><section class="family-endpoint-table-section" aria-label="'
            + escapeHtml("Endpoints in " + familyLabel + " family")
            + '">'
            + headerRow
            + "<strong>No endpoint rows match this family in the current lens.</strong>"
            + '<p class="subtle">Widen the current table view to repopulate this family-owned endpoint table.</p>'
            + '<div class="family-endpoint-table-footer">' + footerActions + "</div>"
            + "</section></div></div></td></tr>";
    }
    var endpointDetails = state.payload ? state.payload.endpointDetails || {} : {};
    var nestedRows = endpointsInFamily.map(function (endpoint) {
        var detail = endpointDetails[endpoint.id];
        var findings = detail ? findingsForActiveLens(detail.findings || []) : [];
        var groups = groupFindings(findings);
        var topGroup = groups[0] || null;
        var html = renderEndpointRow(endpoint, {
            familyName: familyName,
            inlineTable: true
        });
        if (state.expandedEndpointInsightIds[endpoint.id]) {
            var topMsg = topGroup && topGroup.messages && topGroup.messages[0]
                ? topGroup.messages[0]
                : (findings[0] && findings[0].message ? findings[0].message : "No issue message extracted.");
            var severity = dominantSeverity(findings);
            var why = topGroup && topGroup.impact
                ? topGroup.impact
                : "Clients may need extra guesswork or follow-up reads because the contract does not make the next step or safe fields obvious.";
            var improvementItems = buildContractImprovementItems(detail || { endpoint: endpoint, findings: findings }, findings);
            var nextChanges = (improvementItems || []).slice(0, 3).map(function (item) {
                return '<li>' + escapeHtml(item.change || "Clarify the contract for the next developer action.") + "</li>";
            }).join("");
            var evidenceItems = groups.slice(0, 2).map(function (group) {
                var title = evidenceGroupTitleLine(group);
                var count = group.count || 0;
                return "<li>"
                    + '<span class="preview-evidence-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + "</span>"
                    + '<span class="preview-evidence-count">' + count + " occurrence" + (count === 1 ? "" : "s") + "</span>"
                    + "</li>";
            }).join("");
            var evidenceList = evidenceItems
                ? ('<ul class="preview-evidence-list">' + evidenceItems + "</ul>")
                : '<p class="subtle">No grouped evidence was available for this endpoint in the current view.</p>';
            html += '<tr class="nested-endpoint-preview-row" data-family="' + escapeHtml(family.family) + '" data-endpoint-id="' + escapeHtml(endpoint.id) + '">'
                + '<td colspan="7" class="nested-endpoint-preview-cell">'
                + '<div class="nested-endpoint-preview"><div class="nested-endpoint-preview-grid">'
                + '<div class="nested-endpoint-preview-block"><p class="nested-endpoint-preview-label">Why this is hard</p><div class="nested-endpoint-preview-value">'
                + (findings.length ? severityBadge(severity) : "")
                + '<span class="nested-endpoint-preview-text" title="' + escapeHtml(topMsg) + '">' + escapeHtml(topMsg) + "</span>"
                + '</div><p class="nested-endpoint-preview-why">'
                + escapeHtml(why)
                + "</div></div>"
                + '<div class="nested-endpoint-preview-block"><p class="nested-endpoint-preview-label">Exact evidence</p>'
                + evidenceList
                + "</div>"
                + '<div class="nested-endpoint-preview-block"><p class="nested-endpoint-preview-label">What should change next</p>'
                + (nextChanges
                    ? ('<ul class="preview-evidence-list preview-change-list">' + nextChanges + "</ul>")
                    : '<p class="subtle">No concrete contract changes were derived for this endpoint yet.</p>')
                + "</div>"
                + "</div>"
                + '<div class="nested-endpoint-preview-actions">'
                + '<button type="button" class="tertiary-action" data-open-evidence-id="' + escapeHtml(endpoint.id) + '">Show evidence</button>'
                + '<button type="button" class="tertiary-action" data-focus-endpoint="' + escapeHtml(endpoint.id) + '">Inspect endpoint</button>'
                + "</div></div></td></tr>";
        }
        return html;
    }).join("");
    return '<tr class="family-expansion-row family-endpoint-table-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="'
        + escapeHtml(family.family)
        + '"><td colspan="'
        + String(familyTableColumnCountForActiveTab())
        + '" class="family-expansion-cell"><div class="family-endpoint-table-shell"><section class="family-endpoint-table-section" aria-label="'
        + escapeHtml("Endpoints in " + familyLabel + " family")
        + '"><div class="family-endpoint-table-header">'
        + headerRow
        + '<p class="eyebrow">' + escapeHtml(evidenceSectionTitleForActiveLens()) + "</p>"
        + '<p class="subtle">Endpoint rows stay attached to this family so the ownership and investigation flow stay together.</p>'
        + '</div><div class="family-endpoint-table-scroll" data-family-endpoint-table-scroll="1"><table class="nested-endpoint-table"><colgroup><col class="nested-col-path"><col class="nested-col-issue"><col class="nested-col-type"><col class="nested-col-severity"><col class="nested-col-instance"><col class="nested-col-actionhint"><col class="nested-col-actions"></colgroup><thead><tr><th>Endpoint</th><th>Lead issue</th><th>Type</th><th>Severity</th><th>Evidence</th><th>Suggested action</th><th class="nested-endpoint-actions-col">Actions</th></tr></thead><tbody>'
        + nestedRows
        + '</tbody></table></div><div class="family-endpoint-table-footer"><span class="subtle">End of endpoints in <code>'
        + escapeHtml(familyLabel)
        + "</code> family.</span>"
        + footerActions
        + "</div></section></div></td></tr>";
}
function renderFamilySurface() {
    var tab = activeTopTabConfig();
    // Keep the family surface framing aligned with the active lens while using one
    // shared family table/expansion pattern across all top-level tabs.
    var familySection = el.familySurface ? el.familySurface.closest('.section') : null;
    if (familySection) {
        var heading = familySection.querySelector('.section-heading h2');
        var eyebrow = familySection.querySelector('.section-heading .eyebrow');
        if (eyebrow)
            eyebrow.textContent = tab.familyEyebrow;
        if (heading)
            heading.textContent = tab.familyHeading;
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
        el.familySurfaceHelp.textContent = tab.emptyHelp || '';
        // Avoid duplicating the Contract Issues empty-state story: that lives under the filter bar.
        if (state.activeTopTab === 'spec-rule') {
            el.familySurfaceContext.innerHTML = '';
        }
        else {
            el.familySurfaceContext.innerHTML = lensContext;
            bindRecoveryButtons(el.familySurfaceContext);
        }
        var hasWidenAction = !!(state.filters.search
            || state.filters.category !== 'all'
            || state.filters.familyPressure !== 'all'
            || state.filters.includeNoIssueRows
            || state.familyTableBackState);
        // Contract Issues no-match recovery belongs in the single empty-state block under the filter bar.
        // Keep the surface body minimal so we do not duplicate guidance in multiple panels.
        var recovery = (state.activeTopTab === 'spec-rule') ? '' : (hasWidenAction ? renderRecoveryActions(['clear-table-filters']) : '');
        if (state.activeTopTab === 'spec-rule') {
            el.familySurface.innerHTML = '<div class="empty empty-quiet" aria-hidden="true"></div>';
        }
        else {
            el.familySurface.innerHTML = '<div class="empty">'
                + '<strong>No matching families.</strong>'
                + '<p class="subtle">No families match the current table view.' + (hasWidenAction ? ' Reset the table view to widen it.' : '') + '</p>'
                + recovery
                + '</div>';
            bindRecoveryButtons(el.familySurface);
        }
        return;
    }
    el.familySurfaceHelp.textContent = tab.familyHelp || familySurfaceHelpCopy();
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
            }
            else {
                state.familyTableSort.key = sortKey;
                state.familyTableSort.direction = 'asc';
            }
            renderFamilySurface();
        });
    });
    function familyInsightRowHtml(family) {
        var familyName = family.family || 'unlabeled family';
        return '<tr class="family-expansion-row family-inline-insight-row is-expanded pressure-' + escapeHtml(family.pressure) + '" data-family="' + escapeHtml(familyName) + '">'
            + '<td colspan="' + String(familyTableColumnCountForActiveTab()) + '" class="family-expansion-cell">'
            + '<div class="family-row-insight">'
            + renderFamilyInsightPanel(family)
            + '</div>'
            + '</td>'
            + '</tr>';
    }
    function setFamilyInsightToggleButton(btn, expanded) {
        if (!btn)
            return;
        var label = expanded ? 'Hide insight' : 'Show insight';
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.setAttribute('title', label);
        var action = btn.querySelector('.family-name-action');
        if (action)
            action.textContent = label;
    }
    function syncInlineFamilyInsightButtons() {
        syncFamilyInsightToggleButtons(el.familySurface, state, setFamilyInsightToggleButton);
    }
    function bindInlineInsightPanelActions(row) {
        bindInsightPanelActions(row, function (family) {
            focusFamilySurface(state, family, filteredRows, render);
        }, function (endpointId) {
            state.inspectPlacementHint = 'nested';
            state.detailEvidenceOpenForId = endpointId;
            selectEndpointForInspector(endpointId, 'exact');
            syncWorkflowStepSelectionHighlight();
        });
    }
    // Family insight toggle handling (family name button).
    Array.prototype.forEach.call(el.familySurface.querySelectorAll("button[data-insight-toggle]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var family = btn.getAttribute("data-insight-toggle") || "";
            if (!family)
                return;
            toggleFamilyInsightInline({
                familySurface: el.familySurface,
                state: state,
                button: btn,
                family: family,
                captureBackState: function () { captureFamilyTableBackStateIfNeeded(state); },
                familySummaries: familySummaries,
                familyInsightRowHtml: familyInsightRowHtml,
                bindInsightPanelActions: bindInlineInsightPanelActions,
                setFamilyInsightToggleButton: setFamilyInsightToggleButton
            });
        });
    });
    syncInlineFamilyInsightButtons();
    bindFamilySurfaceEndpointInteractions({
        familySurface: el.familySurface,
        state: state,
        captureBackState: function () { captureFamilyTableBackStateIfNeeded(state); },
        renderFamilySurface: renderFamilySurface,
        renderEndpointDiagnostics: renderEndpointDiagnostics,
        renderEndpointDetail: renderEndpointDetail,
        syncSelectedEndpointHighlight: syncSelectedEndpointHighlight,
        syncWorkflowStepSelectionHighlight: syncWorkflowStepSelectionHighlight,
        selectEndpointForInspector: selectEndpointForInspector,
        focusFamily: function (family) {
            focusFamilySurface(state, family, filteredRows, render);
        }
    });
    // Endpoint workspace is rendered inline beneath the selected endpoint row.
}
function renderEndpointRows() {
    if (!el.endpointRows || !el.listContext) {
        return;
    }
    // The investigation flow is now: filters -> family table -> inline endpoints -> inline inspector.
    // Avoid detached endpoint evidence below the family table. All useful endpoint
    // detail now opens inline beneath the family or endpoint row that triggered it.
    var listSection = el.endpointRows ? el.endpointRows.closest('.section') : null;
    if (listSection) {
        listSection.style.display = 'none';
        listSection.setAttribute('aria-hidden', 'true');
    }
    el.listContext.innerHTML = '';
    el.endpointRows.innerHTML = '';
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
        }
        else if (state.activeTopTab === 'shape') {
            listSection.classList.add('endpoint-list-shape-secondary');
            listSection.classList.remove('endpoint-list-workflow-secondary');
        }
        else {
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
            + '<p class="subtle">No endpoints remain in the current table view. Reset the table view above to continue.</p>'
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
    bindEndpointListInteractions({
        endpointRows: el.endpointRows,
        state: state,
        renderEndpointRows: renderEndpointRows,
        renderEndpointDiagnostics: renderEndpointDiagnostics,
        selectEndpointForInspector: selectEndpointForInspector
    });
}
function renderEndpointRow(row, options) {
    options = options || {};
    var endpointDetails = state.payload && state.payload.endpointDetails ? state.payload.endpointDetails : {};
    var detail = endpointDetails[row.id] || { endpoint: row, findings: [] };
    var lensFindings = findingsForActiveLens(detail.findings || []);
    var firstFinding = lensFindings[0] || null;
    var scopeFamilyName = row.family || 'unlabeled family';
    var primaryScope = firstFinding ? issueScopeLabelForKey(findingGroupKey(firstFinding), scopeFamilyName) : '';
    var selected = row.id === state.selectedEndpointId ? "active" : "";
    var intent = endpointIntentCue(row.method, row.path);
    var severity = dominantSeverity(lensFindings);
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
                if (scopes[i] !== common) {
                    common = '';
                    break;
                }
            }
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
            + '<td colspan="7" class="nested-endpoint-findings-cell">'
            + additionalFindingsList
            + '</td>'
            + '</tr>'
        : '';
    var inspectLoading = state.inspectingEndpointId === row.id;
    var inspectSelected = state.selectedEndpointId === row.id && !inspectLoading;
    var inspectButtonClass = 'tertiary-action endpoint-inspect-action'
        + (inspectLoading ? ' is-loading' : '')
        + (inspectSelected ? ' is-selected' : '');
    var inspectButtonLabel = inspectLoading ? 'Inspecting...' : 'Inspect endpoint';
    var rowClasses = (options.inlineTable ? 'nested-endpoint-row ' : '') + selected + ' row-pressure-' + row.priority + (additionalOpen ? ' findings-expanded' : '');
    if (options.inlineTable) {
        var suggestedAction = (function () {
            var items = buildContractImprovementItems(detail, lensFindings);
            if (items && items.length && items[0] && items[0].change)
                return items[0].change;
            if (firstFinding)
                return "Clarify the contract so this problem is visible before runtime.";
            return "No suggested contract change.";
        })();
        var issueType = rowDominantIssue(row).label || "Issue";
        var endpointIdentityTitle = escapeHtml(((row.method || '').toUpperCase() + ' ' + (row.path || '') + ' — ' + intent).trim());
        var scopeBadge = primaryScope
            ? '<span class="row-issue-scope-pill" title="' + escapeHtml('Scope: ' + primaryScope) + '"><strong>Scope:</strong> ' + escapeHtml(primaryScope) + '</span>'
            : '';
        var labelPressed = (row.id === state.selectedEndpointId) ? 'true' : 'false';
        var pathActionLabel = 'Inspect';
        var rowHtml = '<tr class="' + rowClasses.trim() + '" data-id="' + row.id + '" data-endpoint-id="' + row.id + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
            + '<td class="nested-endpoint-path-cell">'
            + '<div class="endpoint-row-main">'
            + '<button type="button" class="nested-endpoint-path-toggle" data-focus-endpoint="' + escapeHtml(row.id) + '" aria-pressed="' + labelPressed + '" title="' + escapeHtml('Inspect ' + ((row.method || '').toUpperCase()) + ' ' + (row.path || '')) + '">'
            + '<strong title="' + endpointIdentityTitle + '">' + escapeHtml((row.method || '').toUpperCase() + ' ' + (row.path || '')) + '</strong>'
            + '<span class="nested-endpoint-path-action" aria-hidden="true">' + escapeHtml(pathActionLabel) + '</span>'
            + '</button>'
            + '</div>'
            + '</td>'
            + '<td class="nested-endpoint-issue-cell">'
            + '<div class="nested-endpoint-issue-top">'
            + '<div class="nested-endpoint-primary-issue" title="' + escapeHtml(topIssueLabel) + '">' + escapeHtml(topIssueLabel) + '</div>'
            + scopeBadge
            + (additionalFindingsControl ? '<div class="nested-endpoint-issue-actions">' + additionalFindingsControl + '</div>' : '')
            + '</div>'
            + '</td>'
            + '<td class="nested-endpoint-type-cell"><div class="nested-endpoint-type-label" title="' + escapeHtml(issueType) + '">' + escapeHtml(issueType) + '</div></td>'
            + '<td class="nested-endpoint-severity-cell">' + (firstFinding ? severityBadgeEvidenceCTA(severity, row.id) : '<span class="subtle">No issue</span>') + '</td>'
            + '<td class="nested-endpoint-instance-cell"><button type="button" class="instance-count-chip is-interactive" data-open-evidence-id="' + escapeHtml(row.id) + '" title="Open grouped deviations" aria-label="Open grouped deviations">' + instanceCount + ' deviation' + (instanceCount === 1 ? '' : 's') + '</button></td>'
            + '<td class="nested-endpoint-actionhint-cell"><div class="nested-endpoint-actionhint" title="' + escapeHtml(suggestedAction) + '">' + escapeHtml(suggestedAction) + '</div></td>'
            + '<td class="nested-endpoint-actions-cell">'
            + '<div class="nested-endpoint-actions">'
            + '<button type="button" class="tertiary-action" data-open-evidence-id="' + escapeHtml(row.id) + '">Show evidence</button>'
            + '<button type="button" class="tertiary-action endpoint-insight-toggle" data-endpoint-insight-toggle="' + escapeHtml(row.id) + '">' + (state.expandedEndpointInsightIds[row.id] ? 'Hide summary' : 'Show summary') + '</button>'
            + '</div>'
            + '</td>'
            + '</tr>';
        var inspectorInlineRowNested = (row.id === state.selectedEndpointId && state.inspectPlacementHint === 'nested')
            ? renderInlineInspectorMountRow(row.id, 7, 'nested')
            : '';
        return rowHtml + additionalFindingsRowInline + inspectorInlineRowNested;
    }
    var baseRow = '<tr class="' + rowClasses.trim() + '" data-id="' + row.id + '" data-endpoint-id="' + row.id + '"' + (options.familyName ? ' data-family="' + escapeHtml(options.familyName) + '"' : '') + '>'
        + '<td>'
        + '<div class="endpoint-row-main">'
        + '<div class="endpoint-row-identity">'
        + '<span class="endpoint-method-chip">' + escapeHtml((row.method || '').toUpperCase()) + '</span>'
        + '<strong class="endpoint-path-text">' + escapeHtml(row.path || '') + '</strong>'
        + '</div>'
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
        + '<div class="endpoint-evidence-row">'
        + '<div class="endpoint-evidence-top">'
        + '<div class="endpoint-evidence-severity">' + (firstFinding ? severityBadgeInteractive(severity) : '') + '</div>'
        + '<div class="endpoint-evidence-primary" title="' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '">' + escapeHtml(firstFinding ? firstFinding.message : 'No direct issue messages') + '</div>'
        + '<div class="endpoint-evidence-actions">'
        + '<button type="button" class="' + inspectButtonClass + '" data-focus-endpoint="' + escapeHtml(row.id) + '" aria-pressed="' + (inspectSelected ? 'true' : 'false') + '" aria-busy="' + (inspectLoading ? 'true' : 'false') + '">' + inspectButtonLabel + '</button>'
        + '</div>'
        + '</div>'
        + '<div class="endpoint-evidence-meta">'
        + (firstFinding ? ('<span class="row-issue-scope-pill" title="' + escapeHtml('Scope: ' + primaryScope) + '"><strong>Scope:</strong> ' + escapeHtml(primaryScope) + '</span>') : '')
        + (firstFinding ? ('<button type="button" class="instance-count-chip is-interactive" data-open-evidence-id="' + escapeHtml(row.id) + '" title="Open grouped deviations" aria-label="Open grouped deviations">' + instanceCount + ' deviation' + (instanceCount === 1 ? '' : 's') + '</button>') : '')
        + additionalFindingsControl
        + '</div>'
        + '<div class="context-inline-wrap">' + contextLine + '</div>'
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
    if (!endpointId)
        return null;
    var mounts = document.querySelectorAll('[data-inline-inspector-mount="1"]');
    for (var i = 0; i < mounts.length; i++) {
        if ((mounts[i].getAttribute('data-inline-endpoint-id') || '') === endpointId) {
            return mounts[i];
        }
    }
    return null;
}
function buildEndpointDiagnosticsBody(detail, findings) {
    var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
    var workflowTabActive = state.activeTopTab === 'workflow';
    var shapeTabActive = state.activeTopTab === 'shape';
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
    if (workflowTabActive) {
        body += renderWorkflowStepWorkspace(detail);
    }
    if (!workflowTabActive && relatedChains.length) {
        var primary = relatedChains[0] || { endpointIds: [] };
        var steps = primary.endpointIds || [];
        var idx = state.selectedEndpointId ? steps.indexOf(state.selectedEndpointId) : -1;
        var stepLabel = (idx >= 0 && steps.length)
            ? ('Step ' + (idx + 1) + ' of ' + steps.length)
            : (steps.length ? (steps.length + ' steps') : 'in chain');
        var linkTitle = 'Workflow chain available';
        var linkHelper = 'Switches tabs and opens this endpoint\u2019s inferred workflow chain.';
        var linkCopy = 'This endpoint participates in an inferred call sequence. The chain view shows purpose, required context, traps, and likely next actions.';
        body += '<section class="workflow-chain-link-card" aria-label="' + escapeHtml(linkTitle) + '">'
            + '<div class="workflow-chain-link-row">'
            + '<p class="workflow-chain-link-title"><strong>' + escapeHtml(linkTitle) + '</strong> <span class="subtle">' + escapeHtml(stepLabel) + '</span></p>'
            + '<button type="button" class="workflow-chain-link-action" data-open-workflow-chain="1" title="Open this chain in Workflow Guidance tab">Open this chain in Workflow Guidance tab</button>'
            + '</div>'
            + '<p class="subtle workflow-chain-link-helper">' + escapeHtml(linkHelper) + '</p>'
            + '<p class="subtle workflow-chain-link-copy">' + escapeHtml(linkCopy) + '</p>'
            + '</section>';
    }
    if (findings && findings.length) {
        body += renderWhatToDoNextBlock(endpoint, findings, { maxItems: 2, showEndpointLabel: false });
    }
    if (workflowTabActive) {
        body += renderWorkflowDiagnosticsFrame(detail);
    }
    if (workflowTabActive && state.endpointDiagnosticsSubTab !== 'summary') {
        body += renderInspectorWorkflowContextSupport(detail, { defaultOpen: true });
    }
    body += renderInspectorContentMap();
    body += renderEndpointDiagnosticsTabs();
    if (!findings || !findings.length) {
        body += renderEndpointDiagnosticsEmptyState();
    }
    else if (state.endpointDiagnosticsSubTab === 'exact') {
        body += renderEndpointDiagnosticsExact(detail);
    }
    else if (state.endpointDiagnosticsSubTab === 'consistency') {
        body += renderEndpointDiagnosticsConsistency(detail);
    }
    else if (state.endpointDiagnosticsSubTab === 'cleaner') {
        body += renderEndpointDiagnosticsCleaner(detail);
    }
    else {
        body += workflowTabActive
            ? renderEndpointDiagnosticsWorkflowSummary(detail)
            : (shapeTabActive ? renderEndpointDiagnosticsShapeSummary(detail) : renderEndpointDiagnosticsSummary(detail));
    }
    body += '</div>';
    return body;
}
function bindEndpointDiagnosticsInteractions(container) {
    if (!container)
        return;
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
            if (!workspaceBody)
                return;
            workspaceBody.classList.toggle('is-collapsed', !!collapsed);
            workspaceCollapseBtn.textContent = collapsed ? closedLabel : openLabel;
            workspaceCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            workspaceCollapseBtn.title = collapsed ? 'Expand workspace' : 'Collapse workspace';
        }
        if (state.activeTopTab === 'shape' && target === 'shape-workspace') {
            syncWorkspaceCollapseUi(!!state.shapeWorkspaceCollapsed);
        }
        workspaceCollapseBtn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (!workspaceBody)
                return;
            var nextCollapsed = !workspaceBody.classList.contains('is-collapsed');
            if (state.activeTopTab === 'shape' && target === 'shape-workspace') {
                state.shapeWorkspaceCollapsed = nextCollapsed;
            }
            syncWorkspaceCollapseUi(nextCollapsed);
        });
    }
    Array.prototype.forEach.call(container.querySelectorAll('details.detail-evidence-drawer'), function (drawer) {
        var labelNode = drawer.querySelector('[data-evidence-drawer-label]');
        if (!labelNode)
            return;
        function syncLabel() {
            labelNode.textContent = drawer.open ? 'Hide grouped deviations' : exactEvidenceTargetLabel();
        }
        drawer.addEventListener('toggle', syncLabel);
        syncLabel();
    });
    Array.prototype.forEach.call(container.querySelectorAll('button[data-close-details="1"]'), function (btn) {
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            var drawer = btn.closest('details');
            if (drawer)
                drawer.open = false;
        });
    });
    Array.prototype.forEach.call(container.querySelectorAll('button[data-endpoint-subtab]'), function (btn) {
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            var subtab = btn.getAttribute('data-endpoint-subtab') || 'summary';
            if (state.endpointDiagnosticsSubTab === subtab)
                return;
            state.endpointDiagnosticsSubTab = subtab;
            renderEndpointDiagnostics();
        });
    });
    Array.prototype.forEach.call(container.querySelectorAll('button[data-open-workflow-chain="1"]'), function (btn) {
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            state.activeTopTab = 'workflow';
            state.endpointDiagnosticsSubTab = 'summary';
            render();
            if (state.selectedEndpointId) {
                selectEndpointForInspector(state.selectedEndpointId, 'summary');
            }
        });
    });
}
function renderEndpointDiagnostics() {
    var detail = state.selectedEndpointId ? endpointDetailForId(state.selectedEndpointId) : null;
    var hasValidSelection = !!detail && hasValidSelectedEndpointInCurrentView();
    document.body.classList.toggle('has-endpoint-selection', hasValidSelection);
    var inlineMount = findInlineInspectorMount(state.selectedEndpointId);
    if (!inlineMount)
        return;
    if (!hasValidSelection) {
        inlineMount.innerHTML = renderEndpointDiagnosticsEmptyState();
        bindEndpointDiagnosticsInteractions(inlineMount);
        syncSelectedEndpointHighlight();
        return;
    }
    syncSelectedEndpointHighlight();
    var findings = findingsForActiveLens((detail.findings || []));
    var body = buildEndpointDiagnosticsBody(detail, findings);
    inlineMount.innerHTML = body;
    bindEndpointDiagnosticsInteractions(inlineMount);
}
function renderEndpointDetail() {
    if (!el.endpointDetail)
        return;
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
var workflowSurfaceKindGroupLabelMap = {
    "list-detail": "Browse then inspect",
    "list-detail-update": "Browse, inspect, and update",
    "list-detail-action": "Browse, inspect, and act",
    "list-detail-create": "Browse, inspect, and create",
    "create-detail": "Create then inspect",
    "create-detail-update": "Create then refine",
    "create-detail-action": "Create then act",
    "action-follow-up": "Act and follow up",
    "media-detail-follow-up": "Upload then follow up",
    "order-detail-action": "Submit then confirm"
};
function workflowSurfaceRenderChains() {
    if (state.activeTopTab !== "workflow") {
        el.workflowSection.style.display = "none";
        el.workflowHelp.textContent = "";
        el.workflowChains.innerHTML = "";
        return;
    }
    var allChains = state.payload.workflows.chains || [];
    if (!allChains.length) {
        el.workflowSection.style.display = "block";
        el.workflowHelp.textContent = "Optional inferred call paths for this slice. Open only when you need chaining context or hidden traps.";
        el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer(workflowSurfaceRenderEmptyState("absent"), 0);
        workflowSurfaceBindChainsDrawerToggle();
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
    el.workflowSection.style.display = "block";
    var chainSource = filteredChains.length ? filteredChains : scopedChains;
    var workflowGuideHtml = workflowSurfaceRenderGuideSection(chainSource);
    var journeyGuidanceHtml = renderCommonWorkflowJourneys(chainSource);
    if (filteredChains.length) {
        el.workflowHelp.textContent = "Optional inferred call paths for the current slice. Open this when you need chaining context, hidden prerequisites, or likely next actions.";
        var groups = workflowSurfaceGroupChainsByKind(filteredChains, { focusChainId: state.workflowChainFocusChainId || "" });
        el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer('<section class="workflow-chain-surface-primary">'
            + '<div class="workflow-chain-surface-header">'
            + '<h3 class="workflow-guide-title">Step-by-step workflow chains and hidden traps</h3>'
            + '<p class="workflow-guide-copy">Use this only when the chain itself is the problem. Click a step to scope the family table above to the matching API surface.</p>'
            + '</div>'
            + groups.map(workflowSurfaceRenderKindGroup).join("")
            + "</section>"
            + workflowGuideHtml
            + journeyGuidanceHtml, filteredChains.length);
        workflowSurfaceBindStepInteractions();
        workflowSurfaceSyncStepSelectionHighlight();
        workflowSurfaceBindChainsDrawerToggle();
        return;
    }
    if (scopedChains.length) {
        el.workflowHelp.textContent = "No path matches the current evidence-only slice, but inferred chains from the scoped endpoints are still available if you need sequence context.";
        var scopedGroups = workflowSurfaceGroupChainsByKind(scopedChains, { focusChainId: state.workflowChainFocusChainId || "" });
        el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer('<section class="workflow-chain-surface-primary">'
            + '<div class="workflow-chain-surface-header">'
            + '<h3 class="workflow-guide-title">Step-by-step workflow chains and hidden traps</h3>'
            + '<p class="workflow-guide-copy">These paths stay available from the scoped endpoint set so you can still inspect sequence and weak handoffs when needed.</p>'
            + '</div>'
            + '<div class="workflow-no-match">'
            + '<p class="workflow-empty-title"><strong>Call chain surface restored for this lens</strong></p>'
            + '<p class="workflow-empty-copy">Visible issue rows are currently too narrow for direct chain overlap, so this section keeps the inferred sequence visible from the scoped endpoint set.</p>'
            + renderRecoveryActions(["show-all-workflows"])
            + "</div>"
            + scopedGroups.map(workflowSurfaceRenderKindGroup).join("")
            + "</section>"
            + workflowGuideHtml
            + journeyGuidanceHtml, scopedChains.length);
        bindRecoveryButtons(el.workflowChains);
        workflowSurfaceBindStepInteractions();
        workflowSurfaceSyncStepSelectionHighlight();
        workflowSurfaceBindChainsDrawerToggle();
        return;
    }
    el.workflowHelp.textContent = "";
    el.workflowChains.innerHTML = workflowSurfaceRenderChainsDrawer(workflowGuideHtml + journeyGuidanceHtml + workflowSurfaceRenderEmptyState("filtered"), 0);
    bindRecoveryButtons(el.workflowChains);
    workflowSurfaceBindChainsDrawerToggle();
}
function workflowSurfaceRenderChainsDrawer(innerHtml, chainCount) {
    var count = (typeof chainCount === "number" && isFinite(chainCount)) ? chainCount : 0;
    var countLabel = count
        ? (count + " chain" + (count === 1 ? "" : "s") + " in view")
        : "no chains in view";
    var openAttr = state.workflowChainsOpen ? " open" : "";
    return '<details class="workflow-chains-drawer"' + openAttr + ' data-workflow-chains-drawer="1">'
        + '<summary class="workflow-chains-drawer-summary">'
        + "<strong>Workflow paths</strong>"
        + '<span class="workflow-chains-drawer-meta">' + escapeHtml(countLabel) + "</span>"
        + "</summary>"
        + '<div class="workflow-chains-drawer-body">'
        + innerHtml
        + "</div>"
        + "</details>";
}
function workflowSurfaceBindChainsDrawerToggle() {
    var drawer = el.workflowChains ? el.workflowChains.querySelector("[data-workflow-chains-drawer]") : null;
    if (!drawer)
        return;
    drawer.addEventListener("toggle", function () {
        state.workflowChainsOpen = !!drawer.open;
    });
}
function workflowSurfaceRenderGuideSection(chains) {
    var sourceChains = (chains || []).slice();
    if (!sourceChains.length)
        return "";
    var featured = sourceChains.slice().sort(function (a, b) {
        var burdenDiff = workflowSurfaceChainBurdenScore(b) - workflowSurfaceChainBurdenScore(a);
        if (burdenDiff !== 0)
            return burdenDiff;
        return (b.endpointIds || []).length - (a.endpointIds || []).length;
    }).slice(0, 3);
    if (!featured.length)
        return "";
    return '<section class="workflow-guide-section">'
        + '<div class="workflow-guide-header">'
        + '<h3 class="workflow-guide-title">High-signal workflow paths</h3>'
        + '<p class="workflow-guide-copy">Use these when you need a compact read on the heaviest inferred paths. The family table above remains the main investigation surface.</p>'
        + "</div>"
        + '<div class="workflow-guide-cards">'
        + featured.map(function (chain, index) {
            return workflowSurfaceRenderGuideCard(chain, index === 0);
        }).join("")
        + "</div>"
        + "</section>";
}
function workflowSurfaceRenderGuideCard(chain, isLead) {
    var roles = workflowSurfaceParseChainRoles(chain.summary, (chain.endpointIds || []).length);
    var burdenSummary = workflowSurfaceRenderBurdenSummary(chain, roles);
    var leadClass = isLead ? " workflow-guide-card-lead" : "";
    var reasonHtml = chain.reason
        ? '<p class="workflow-guide-reason"><strong>Why this path exists:</strong> ' + escapeHtml(chain.reason) + "</p>"
        : "";
    return '<article class="workflow-guide-card' + leadClass + '">'
        + '<div class="workflow-guide-card-head">'
        + '<p class="workflow-guide-card-kicker">' + escapeHtml(workflowSurfaceKindGroupLabel(chain.kind || "workflow")) + "</p>"
        + '<div class="workflow-guide-card-meta">'
        + "<strong>" + escapeHtml(workflowSurfaceChainTaskLabel(chain)) + "</strong>"
        + "<span>" + escapeHtml((chain.endpointIds || []).length + " steps") + "</span>"
        + "<span>" + escapeHtml(workflowSurfaceChainBurdenScore(chain) + " burden signals") + "</span>"
        + "</div>"
        + "</div>"
        + reasonHtml
        + burdenSummary
        + '<div class="workflow-guide-chain">'
        + workflowSurfaceRenderChain(chain, true)
        + "</div>"
        + "</article>";
}
function workflowSurfaceBindStepInteractions() {
    var endpointDetails = payloadEndpointDetails();
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll("[data-step-id]"), function (elem) {
        elem.addEventListener("click", function () {
            var endpointId = elem.getAttribute("data-step-id") || "";
            if (!endpointId)
                return;
            var detail = endpointDetails[endpointId];
            var family = detail && detail.endpoint ? (detail.endpoint.family || "") : "";
            state.selectedEndpointId = endpointId;
            state.userSelectedEndpoint = true;
            state.endpointDiagnosticsSubTab = "summary";
            if (family) {
                captureFamilyTableBackStateIfNeeded(state);
                state.filters.search = family.trim().toLowerCase();
                state.familyTableShowAll = false;
                state.expandedFamilyInsight = "";
                state.detailEvidenceOpenForId = "";
                state.inspectPlacementHint = "nested";
                selectEndpointForInspector(endpointId, "summary");
                workflowSurfaceSyncStepSelectionHighlight();
                return;
            }
            renderEndpointRows();
            renderEndpointDiagnostics();
            renderEndpointDetail();
            workflowSurfaceSyncStepSelectionHighlight();
        });
    });
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll("[data-step-open-evidence]"), function (btn) {
        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var endpointId = btn.getAttribute("data-step-open-evidence") || "";
            if (!endpointId)
                return;
            var detail = endpointDetails[endpointId];
            var family = detail && detail.endpoint ? (detail.endpoint.family || "") : "";
            state.selectedEndpointId = endpointId;
            state.userSelectedEndpoint = true;
            state.endpointDiagnosticsSubTab = "exact";
            state.detailEvidenceOpenForId = endpointId;
            if (family) {
                captureFamilyTableBackStateIfNeeded(state);
                state.filters.search = family.trim().toLowerCase();
                state.familyTableShowAll = false;
                state.expandedFamilyInsight = "";
                state.inspectPlacementHint = "nested";
                selectEndpointForInspector(endpointId, "exact");
                state.detailEvidenceOpenForId = endpointId;
                workflowSurfaceSyncStepSelectionHighlight();
                return;
            }
            renderEndpointRows();
            renderEndpointDiagnostics();
            renderEndpointDetail();
            workflowSurfaceSyncStepSelectionHighlight();
        });
    });
}
function workflowSurfaceSyncStepSelectionHighlight() {
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll(".step-box"), function (box) {
        box.classList.remove("step-active");
    });
    if (!state.selectedEndpointId)
        return;
    Array.prototype.forEach.call(el.workflowChains.querySelectorAll("[data-step-id]"), function (elem) {
        if ((elem.getAttribute("data-step-id") || "") !== state.selectedEndpointId)
            return;
        var box = elem.querySelector(".step-box");
        if (box)
            box.classList.add("step-active");
    });
}
function workflowSurfaceRenderEmptyState(mode) {
    if (mode === "absent") {
        return '<div class="workflow-no-match workflow-no-match-final">'
            + '<p class="workflow-empty-title"><strong>No inferred workflow chains</strong></p>'
            + '<p class="workflow-empty-copy">This spec currently reads as isolated endpoints rather than a linked call sequence, so there is nothing to expand in this section.</p>'
            + '<p class="workflow-empty-note">That is a final state for this spec, not a filter mismatch.</p>'
            + "</div>";
    }
    if (!filteredRows().length) {
        return '<div class="workflow-no-match">'
            + '<p class="workflow-empty-title"><strong>No workflows match the current scope</strong></p>'
            + '<p class="workflow-empty-copy">Clear filters or show all workflow patterns to widen the view.</p>'
            + renderRecoveryActions(["show-all-workflows"])
            + "</div>";
    }
    return '<div class="workflow-no-match">'
        + '<p class="workflow-empty-title"><strong>No workflows match the current scope</strong></p>'
        + '<p class="workflow-empty-copy">Show all workflow patterns to widen this section without changing tabs.</p>'
        + renderRecoveryActions(["show-all-workflows"])
        + "</div>";
}
function workflowSurfaceGroupChainsByKind(chains, options) {
    var opts = options || {};
    var focusChainId = opts.focusChainId || "";
    var byKind = {};
    chains.forEach(function (chain) {
        var kind = chain.kind || "workflow";
        if (!byKind[kind])
            byKind[kind] = [];
        byKind[kind].push(chain);
    });
    return Object.keys(byKind).map(function (kind) {
        var kindChains = byKind[kind].slice();
        kindChains.sort(function (a, b) {
            return workflowSurfaceChainBurdenScore(b) - workflowSurfaceChainBurdenScore(a);
        });
        if (focusChainId) {
            var idx = kindChains.findIndex(function (c) { return (c && c.id) === focusChainId; });
            if (idx > 0) {
                var picked = kindChains.splice(idx, 1)[0];
                kindChains.unshift(picked);
            }
        }
        return { kind: kind, chains: kindChains };
    }).sort(function (a, b) {
        if (focusChainId) {
            var aHas = a.chains.some(function (c) { return (c && c.id) === focusChainId; });
            var bHas = b.chains.some(function (c) { return (c && c.id) === focusChainId; });
            if (aHas && !bHas)
                return -1;
            if (bHas && !aHas)
                return 1;
        }
        var aScore = a.chains.reduce(function (s, c) { return s + workflowSurfaceChainBurdenScore(c); }, 0);
        var bScore = b.chains.reduce(function (s, c) { return s + workflowSurfaceChainBurdenScore(c); }, 0);
        return bScore - aScore;
    });
}
function workflowSurfaceChainBurdenScore(chain) {
    var endpointDetails = payloadEndpointDetails();
    return (chain.endpointIds || []).reduce(function (total, eid) {
        var d = endpointDetails[eid];
        if (!d)
            return total;
        return total + (d.findings || []).filter(function (f) {
            return f.burdenFocus === "workflow-burden";
        }).length;
    }, 0);
}
function workflowSurfaceParseChainRoles(summary, count) {
    if (!summary)
        return [];
    var parts = summary.split(" -> ");
    return parts.map(function (part) {
        var i = part.indexOf(": ");
        return i >= 0 ? part.substring(0, i) : "";
    });
}
function workflowSurfaceHumanizeStepRole(roleSlug) {
    var map = {
        "list": "browse list",
        "search": "search / filter",
        "detail": "load item",
        "create": "create",
        "update": "update",
        "delete": "delete",
        "action": "trigger action",
        "checkout": "checkout",
        "payment": "handle payment",
        "auth": "authenticate",
        "login": "authenticate",
        "register": "register",
        "submit": "submit",
        "confirm": "confirm",
        "follow-up": "follow up",
        "followup": "follow up",
        "cancel": "cancel",
        "upload": "upload",
        "download": "download",
        "refresh": "refresh",
        "poll": "poll status"
    };
    if (!roleSlug)
        return "";
    var slug = roleSlug.toLowerCase();
    return map[slug] || slug.replace(/-/g, " ");
}
function workflowSurfaceKindGroupLabel(kind) {
    return workflowSurfaceKindGroupLabelMap[kind] || kind.replace(/-/g, " to ");
}
function workflowSurfaceChainTaskLabel(chain) {
    var roles = workflowSurfaceParseChainRoles(chain.summary);
    if (roles.length >= 2) {
        var first = workflowSurfaceHumanizeStepRole(roles[0]);
        var last = workflowSurfaceHumanizeStepRole(roles[roles.length - 1]);
        if (first && last && first !== last) {
            return first + " to " + last;
        }
    }
    return workflowSurfaceChainResourceLabel(chain);
}
function workflowSurfaceChainResourceLabel(chain) {
    var ids = chain.endpointIds || [];
    var detail = ids.length ? payloadEndpointDetails()[ids[0]] : null;
    if (!detail)
        return chain.kind || "workflow";
    var segs = detail.endpoint.path.split("/").filter(function (p) { return p && !p.startsWith("{"); });
    return segs.length ? segs[segs.length - 1] : detail.endpoint.path;
}
function workflowSurfaceFormatStepRefs(indices) {
    if (!indices || !indices.length)
        return "";
    var sorted = indices.slice().sort(function (a, b) { return a - b; });
    var labels = sorted.map(function (n) { return String(n + 1); });
    return "shows up in step" + (labels.length > 1 ? "s " : " ") + labels.join(", ");
}
function workflowSurfaceCollectBurdenSummary(chain, roles) {
    var steps = chain.endpointIds || [];
    var endpointDetails = payloadEndpointDetails();
    var burdens = {
        hidden: { key: "hidden", label: "hidden token/context handoff", why: "does not clearly expose what the next call needs", steps: [] },
        outcome: { key: "outcome", label: "weak outcome guidance", why: "outcome is weakly signaled for later calls", steps: [] },
        sequence: { key: "sequence", label: "sequencing appears brittle", why: "later calls likely depend on implicit prior state", steps: [] },
        auth: { key: "auth", label: "auth/context/header burden", why: "auth or context requirements appear spread across steps", steps: [] }
    };
    steps.forEach(function (endpointId, idx) {
        var detail = endpointDetails[endpointId];
        if (!detail)
            return;
        var endpoint = detail.endpoint || createEmptyEndpointRow();
        var findings = detail.findings || [];
        var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : "";
        var nextDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
        var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
        var role = roles[idx] || "";
        var nextRole = roles[idx + 1] || "";
        var linkageFindings = findings.filter(function (f) {
            return f.code === "weak-follow-up-linkage" || f.code === "weak-action-follow-up-linkage" || f.code === "weak-accepted-tracking-linkage" || f.code === "weak-outcome-next-action-guidance";
        });
        var prerequisiteFindings = findings.filter(function (f) {
            return f.code === "prerequisite-task-burden";
        });
        var clues = buildWorkflowDependencyClues(endpoint, findings, idx, steps.length, role, nextEndpoint, nextRole, linkageFindings, prerequisiteFindings);
        var joined = (clues.prereq || []).concat(clues.establish || [], clues.nextNeeds || [], clues.hidden || []).join(" | ").toLowerCase();
        if ((clues.hidden || []).length || prerequisiteFindings.length) {
            if (burdens.hidden.steps.indexOf(idx) === -1)
                burdens.hidden.steps.push(idx);
        }
        if (findings.some(function (f) {
            return f.code === "weak-follow-up-linkage" || f.code === "weak-action-follow-up-linkage" || f.code === "weak-accepted-tracking-linkage" || f.code === "weak-outcome-next-action-guidance";
        })) {
            if (burdens.outcome.steps.indexOf(idx) === -1)
                burdens.outcome.steps.push(idx);
        }
        if ((clues.hidden || []).length || (clues.prereq || []).some(function (c) { return /prior state|earlier step|mutation|lookup/i.test(c); })) {
            if (burdens.sequence.steps.indexOf(idx) === -1)
                burdens.sequence.steps.push(idx);
        }
        if (/(auth|header|token|context|access\s*key|api[-\s]?key)/i.test(joined)) {
            if (burdens.auth.steps.indexOf(idx) === -1)
                burdens.auth.steps.push(idx);
        }
    });
    var priorityOrder = ["hidden", "outcome", "auth", "sequence"];
    return Object.keys(burdens)
        .map(function (k) { return burdens[k]; })
        .filter(function (b) { return b.steps.length > 0; })
        .sort(function (a, b) {
        if (b.steps.length !== a.steps.length)
            return b.steps.length - a.steps.length;
        return priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key);
    });
}
function workflowSurfaceRenderBurdenSummary(chain, roles) {
    var items = workflowSurfaceCollectBurdenSummary(chain, roles);
    if (!items.length)
        return "";
    var html = items.map(function (item, idx) {
        var priorityCls = idx === 0 ? " workflow-burden-primary" : " workflow-burden-secondary";
        return '<span class="workflow-burden-item workflow-burden-' + item.key + priorityCls + '">'
            + "<strong>" + escapeHtml(item.label) + "</strong>"
            + "<em>" + escapeHtml(workflowSurfaceFormatStepRefs(item.steps)) + "</em>"
            + "<span>" + escapeHtml(item.why) + "</span>"
            + "</span>";
    }).join("");
    return '<div class="workflow-burden-summary">' + html + "</div>";
}
function workflowSurfaceRenderKindGroup(group) {
    var kindLabel = workflowSurfaceKindGroupLabel(group.kind);
    var count = group.chains.length;
    var countBadge = count > 1 ? '<span class="kind-chain-count">' + count + " chains</span>" : "";
    var primaryHtml = workflowSurfaceRenderChain(group.chains[0], true);
    var secondaryHtml = group.chains.slice(1).map(function (chain) {
        return workflowSurfaceRenderChain(chain, false);
    }).join("");
    return '<div class="workflow-kind-group">'
        + '<div class="workflow-kind-header">'
        + "<strong>" + escapeHtml(kindLabel) + "</strong>"
        + countBadge
        + "</div>"
        + primaryHtml
        + secondaryHtml
        + "</div>";
}
function workflowSurfaceRenderChain(chain, isPrimary) {
    var steps = chain.endpointIds || [];
    var roles = workflowSurfaceParseChainRoles(chain.summary, steps.length);
    var burdenScore = workflowSurfaceChainBurdenScore(chain);
    var burdenBadge = burdenScore > 0
        ? '<span class="chain-burden-count">' + burdenScore + " burden issue" + (burdenScore === 1 ? "" : "s") + "</span>"
        : "";
    var stepElements = steps.map(function (endpointId, idx) {
        var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : "";
        return renderWorkflowStep(endpointId, idx, steps.length, roles[idx] || "", nextEndpointId, roles[idx + 1] || "");
    }).join("");
    var taskLabel = workflowSurfaceChainTaskLabel(chain);
    var burdenSummary = workflowSurfaceRenderBurdenSummary(chain, roles);
    var stepsAndReason = burdenSummary
        + '<div class="workflow-steps">' + stepElements + "</div>"
        + (chain.reason ? '<div class="workflow-reason">' + escapeHtml(chain.reason) + "</div>" : "");
    if (isPrimary) {
        return '<div class="workflow-chain">'
            + '<div class="chain-resource-label">'
            + '<span class="chain-resource-name">' + escapeHtml(taskLabel) + "</span>"
            + '<span class="chain-step-count">' + steps.length + " steps</span>"
            + burdenBadge
            + "</div>"
            + stepsAndReason
            + "</div>";
    }
    return '<details class="workflow-chain-compact">'
        + "<summary>"
        + '<span class="chain-compact-resource">' + escapeHtml(taskLabel) + "</span>"
        + '<span class="chain-compact-steps">' + steps.length + " steps</span>"
        + burdenBadge
        + "</summary>"
        + '<div class="workflow-chain-compact-body">'
        + stepsAndReason
        + "</div>"
        + "</details>";
}
function workflowSurfaceAddUniqueClue(list, text) {
    if (!text)
        return;
    if (list.indexOf(text) === -1)
        list.push(text);
}
function workflowSurfaceFirstClues(list, limit) {
    return (list || []).slice(0, limit);
}
function workflowSurfaceRenderDependencyClues(clues) {
    if (!clues)
        return "";
    var prereq = workflowSurfaceFirstClues(clues.prereq, 2);
    var establish = workflowSurfaceFirstClues(clues.establish, 2);
    var nextNeeds = workflowSurfaceFirstClues(clues.nextNeeds, 2);
    var hidden = workflowSurfaceFirstClues(clues.hidden, 2);
    if (!prereq.length && !establish.length && !nextNeeds.length && !hidden.length)
        return "";
    function clueRow(label, items, klass, icon) {
        if (!items.length)
            return "";
        return '<div class="step-clue-row ' + klass + '">'
            + '<span class="step-clue-label"><span class="step-clue-icon">' + icon + "</span>" + label + "</span>"
            + '<span class="step-clue-text">' + escapeHtml(items.join(" | ")) + "</span>"
            + "</div>";
    }
    return '<div class="step-dependency-clues">'
        + clueRow("Depends on", prereq, "step-clue-prereq", "\u25cb")
        + clueRow("Appears to establish", establish, "step-clue-establish", "\u25b8")
        + clueRow("Next step likely needs", nextNeeds, "step-clue-next", "\u2192")
        + clueRow("Not clearly exposed", hidden, "step-clue-hidden", "!")
        + "</div>";
}
function workflowSurfaceInferCueSubject(text) {
    if (!text)
        return "";
    if (/(auth|bearer|authorization|access\s*key|api[-\s]?key|auth\/header)/.test(text))
        return "auth header";
    if (/(token|context)/.test(text))
        return "context token";
    if (/(payment|transaction)/.test(text))
        return "payment";
    if (/order identity/.test(text))
        return "order id";
    if (/cart/.test(text) && /(identity|identifier|selected resource context)/.test(text))
        return "cart id";
    if (/customer/.test(text) && /(identity|identifier)/.test(text))
        return "customer id";
    if (/order/.test(text) && /(state|changed state|prior state|authoritative state|order context)/.test(text))
        return "order state";
    if (/cart/.test(text) && /(state|changed state|prior state|authoritative state|cart context)/.test(text))
        return "cart state";
    if (/customer/.test(text) && /(state|context)/.test(text))
        return "customer context";
    if (/(action|lookup)/.test(text))
        return "action prerequisite";
    if (/(identifier|header)/.test(text))
        return "id/header";
    if (/(state transition|changed state|prior state|authoritative state)/.test(text))
        return "state change";
    return "";
}
function workflowSurfaceInferTransitionCue(clues, roleLabel) {
    var prereq = clues && clues.prereq ? clues.prereq : [];
    var establish = clues && clues.establish ? clues.establish : [];
    var nextNeeds = clues && clues.nextNeeds ? clues.nextNeeds : [];
    var hidden = clues && clues.hidden ? clues.hidden : [];
    var role = (roleLabel || "").toLowerCase();
    var allText = (prereq.concat(establish, nextNeeds, hidden)).join(" | ").toLowerCase();
    var handoffText = (establish.concat(nextNeeds)).join(" | ").toLowerCase();
    var subject = workflowSurfaceInferCueSubject(allText);
    var handoffSubject = workflowSurfaceInferCueSubject(handoffText) || subject;
    if (/(auth|bearer|authorization|access\s*key|api[-\s]?key)/.test(allText)) {
        return { kind: "context", label: hidden.length ? "auth header dependency" : "auth header handoff" };
    }
    if (/(token|context)/.test(allText)) {
        return { kind: "context", label: hidden.length ? "context token dependency" : "context token handoff" };
    }
    if (/(order identity|order state|order context)/.test(allText)) {
        return { kind: "state", label: "order identity handoff" };
    }
    if (/(cart|order|customer)/.test(allText) && hidden.length) {
        if (subject === "order state" || subject === "cart state" || subject === "customer context") {
            return { kind: "state", label: subject + " dependency" };
        }
        if (subject === "order id" || subject === "cart id" || subject === "customer id") {
            return { kind: "state", label: subject + " dependency" };
        }
        return { kind: "state", label: "resource state dependency" };
    }
    if (/(cart|order|customer|state)/.test(handoffText) || role === "action" || role === "update") {
        if (handoffSubject === "order id" || handoffSubject === "cart id" || handoffSubject === "customer id") {
            return { kind: "state", label: handoffSubject + " handoff" };
        }
        if (handoffSubject === "order state" || handoffSubject === "cart state" || handoffSubject === "customer context") {
            return { kind: "state", label: handoffSubject + " handoff" };
        }
        return { kind: "state", label: "state change handoff" };
    }
    if (/(payment|follow-up|follow up|transaction)/.test(allText) || role === "payment" || role === "checkout") {
        if (/transaction/.test(allText)) {
            return { kind: "followup", label: hidden.length ? "transaction follow-up" : "transaction handoff" };
        }
        return { kind: "followup", label: hidden.length ? "payment follow-up" : "payment handoff" };
    }
    if (hidden.length) {
        if (subject === "action prerequisite")
            return { kind: "weak", label: "action prerequisite" };
        if (subject === "id/header")
            return { kind: "weak", label: "hidden id/header" };
        if (subject === "state change")
            return { kind: "weak", label: "hidden state handoff" };
        if (prereq.length)
            return { kind: "weak", label: "prior state handoff" };
        return { kind: "weak", label: "hidden handoff" };
    }
    if (prereq.length) {
        if (subject === "action prerequisite")
            return { kind: "prereq", label: "action prerequisite" };
        if (subject === "order state" || subject === "cart state" || subject === "customer context") {
            return { kind: "prereq", label: subject + " dependency" };
        }
        return { kind: "prereq", label: "prior state dependency" };
    }
    return null;
}
function renderWorkflowChainContextForEndpoint(detail) {
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var endpointId = endpoint.id || state.selectedEndpointId;
    var relatedChains = detail.relatedChains || [];
    var endpointDetails = payloadEndpointDetails();
    if (!relatedChains.length)
        return "";
    var primaryChain = relatedChains[0] || { endpointIds: [] };
    var steps = primaryChain.endpointIds || [];
    var currentStepIndex = steps.indexOf(endpointId);
    var roles = parseChainRoles(primaryChain.summary, steps.length);
    var taskLabel = chainTaskLabel(primaryChain);
    var chainKindLabel = kindGroupLabel(primaryChain.kind || "workflow");
    var stepElements = steps.map(function (endpointStepId, stepIdx) {
        var nextEndpointId = stepIdx < (steps.length - 1) ? steps[stepIdx + 1] : "";
        var isCurrent = stepIdx === currentStepIndex;
        var isAfterCurrent = stepIdx > currentStepIndex;
        var stepDetail = endpointDetails[endpointStepId];
        if (!stepDetail)
            return "";
        var stepEndpoint = stepDetail.endpoint;
        var findings = stepDetail.findings || [];
        var role = roles[stepIdx] || "";
        var nextEndpointDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
        var nextRole = roles[stepIdx + 1] || "";
        return renderInspectorWorkflowChainStep(endpointStepId, stepIdx, steps.length, role, nextEndpointId, nextRole, isCurrent, isAfterCurrent, findings, stepEndpoint, nextEndpointDetail ? nextEndpointDetail.endpoint : null);
    }).join("");
    return '<div class="workflow-chain-context-card">'
        + '<div class="workflow-chain-context-header">'
        + '<p class="workflow-chain-kicker">' + escapeHtml(chainKindLabel) + "</p>"
        + '<p class="workflow-chain-task"><strong>' + escapeHtml(taskLabel) + '</strong> <span class="workflow-chain-meta">' + steps.length + " steps</span></p>"
        + "</div>"
        + '<div class="workflow-chain-steps-container">'
        + stepElements
        + "</div>"
        + "</div>";
}
function renderInspectorWorkflowChainStep(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel, isCurrent, isAfterCurrent, findings, endpoint, nextEndpoint) {
    var method = endpoint.method || "";
    var path = endpoint.path || "";
    var isLast = stepIndex === (totalSteps - 1);
    var shapeFindings = findings.filter(function (finding) {
        return finding.code === "contract-shape-workflow-guidance-burden";
    });
    var linkageFindings = findings.filter(function (finding) {
        return finding.code === "weak-follow-up-linkage"
            || finding.code === "weak-action-follow-up-linkage"
            || finding.code === "weak-accepted-tracking-linkage"
            || finding.code === "weak-outcome-next-action-guidance";
    });
    var prerequisiteFindings = findings.filter(function (finding) {
        return finding.code === "prerequisite-task-burden";
    });
    var dependencyClues = buildWorkflowDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
    var trapGuidance = collectTrapGuidance(endpoint, findings, dependencyClues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
    var narrative = summarizeWorkflowStepNarrative(endpoint, roleLabel, nextEndpoint, dependencyClues, findings, linkageFindings, prerequisiteFindings, isLast);
    var trapHtml = "";
    if (trapGuidance.length) {
        trapHtml = '<div class="inspector-chain-step-trap">'
            + '<span class="trap-icon">Trap</span>'
            + '<span class="trap-text"><strong>Common hidden traps:</strong> ' + escapeHtml(trapGuidance[0].title || trapGuidance[0].happened || trapGuidance[0].id) + "</span>"
            + "</div>";
    }
    var warnings = [];
    if (shapeFindings.length)
        warnings.push("storage-shaped response");
    if (linkageFindings.length)
        warnings.push("missing next-step ID");
    if (prerequisiteFindings.length)
        warnings.push("hidden dependency");
    var warningHtml = warnings.length
        ? ('<div class="inspector-chain-step-warnings">' + warnings.join(", ") + "</div>")
        : "";
    var humanRole = roleLabel ? humanizeStepRole(roleLabel) : ("Step " + (stepIndex + 1));
    var currentClass = isCurrent ? " inspector-chain-step-current" : (isAfterCurrent ? " inspector-chain-step-future" : "");
    return '<div class="inspector-chain-step' + currentClass + '" data-chain-step-id="' + escapeHtml(endpointId) + '">'
        + '<div class="inspector-chain-step-number">' + (stepIndex + 1) + "</div>"
        + '<div class="inspector-chain-step-content">'
        + '<div class="inspector-chain-step-role">' + escapeHtml(humanRole) + "</div>"
        + '<div class="inspector-chain-step-endpoint"><strong>' + escapeHtml(method + " " + path) + "</strong></div>"
        + '<div class="inspector-chain-step-purpose"><span class="label">What this call does:</span> ' + escapeHtml(narrative.callDoes) + "</div>"
        + '<div class="inspector-chain-step-state"><span class="label">What you need before calling it:</span> ' + escapeHtml(narrative.requiredState || "none explicitly defined") + "</div>"
        + '<div class="inspector-chain-step-change"><span class="label">What changes after it succeeds:</span> ' + escapeHtml(narrative.changesAfter || "") + "</div>"
        + (narrative.nextAction ? ('<div class="inspector-chain-step-next"><span class="label">What to call next:</span> ' + escapeHtml(narrative.nextAction) + "</div>") : "")
        + warningHtml
        + trapHtml
        + "</div>"
        + "</div>";
}
function pickPrimaryWorkflowChainForEndpoint(detail) {
    var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
    var endpointId = endpoint.id || state.selectedEndpointId || "";
    var chains = (detail && detail.relatedChains) ? detail.relatedChains : [];
    if (!endpointId || !chains.length)
        return null;
    var candidates = chains.filter(function (chain) {
        var ids = chain && chain.endpointIds ? chain.endpointIds : [];
        return ids.indexOf(endpointId) >= 0;
    });
    if (!candidates.length)
        return null;
    candidates.sort(function (a, b) {
        var aScore = chainBurdenScore(a || { endpointIds: [] });
        var bScore = chainBurdenScore(b || { endpointIds: [] });
        if (aScore !== bScore)
            return bScore - aScore;
        var aLength = (a && a.endpointIds) ? a.endpointIds.length : 0;
        var bLength = (b && b.endpointIds) ? b.endpointIds.length : 0;
        if (aLength !== bLength)
            return bLength - aLength;
        return String((a && a.kind) || "").localeCompare(String((b && b.kind) || ""));
    });
    return candidates[0] || null;
}
function renderWorkflowStepWorkspace(detail) {
    var endpoint = (detail && detail.endpoint) ? detail.endpoint : createEmptyEndpointRow();
    var endpointId = endpoint.id || state.selectedEndpointId || "";
    var chain = pickPrimaryWorkflowChainForEndpoint(detail);
    if (!endpointId)
        return "";
    var steps = chain ? (chain.endpointIds || []) : [];
    var roles = chain ? parseChainRoles(chain.summary, steps.length) : [];
    var stepIndex = chain ? steps.indexOf(endpointId) : -1;
    var nextEndpointId = stepIndex < (steps.length - 1) ? steps[stepIndex + 1] : "";
    var nextDetail = nextEndpointId ? endpointDetailForId(nextEndpointId) : null;
    var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
    var linkageFindings = (detail.findings || []).filter(function (finding) {
        return finding && (finding.code === "weak-follow-up-linkage" || finding.code === "weak-action-follow-up-linkage" || finding.code === "weak-accepted-tracking-linkage" || finding.code === "weak-outcome-next-action-guidance");
    });
    var prerequisiteFindings = (detail.findings || []).filter(function (finding) {
        return finding && finding.code === "prerequisite-task-burden";
    });
    var clues = buildWorkflowDependencyClues(endpoint, detail.findings || [], Math.max(0, stepIndex), Math.max(1, steps.length || 1), roles[stepIndex] || "", nextEndpoint, roles[stepIndex + 1] || "", linkageFindings, prerequisiteFindings);
    var narrative = summarizeWorkflowStepNarrative(endpoint, roles[stepIndex] || "", nextEndpoint, clues, detail.findings || [], linkageFindings, prerequisiteFindings, stepIndex >= 0 ? (stepIndex === (steps.length - 1)) : false);
    var hiddenHandoff = (clues.hidden && clues.hidden.length)
        ? clues.hidden.slice(0, 2).join(" | ")
        : (linkageFindings.length
            ? "This response does not clearly surface the identifier/context the next step needs."
            : "No obvious hidden handoff signal was detected for this step in the current lens.");
    var contractFailed = linkageFindings.length
        ? "The contract does not make the next-step dependency explicit. It should return the next-step ID/context in an obvious field and document what the next call needs."
        : (prerequisiteFindings.length
            ? "The contract implies prerequisites without modeling them explicitly (clients must learn ordering at runtime)."
            : "The contract burden here is primarily about sequence clarity and context transfer, not a single missing field.");
    var stepLabel = (stepIndex >= 0 && steps.length) ? ("Step " + (stepIndex + 1) + " of " + steps.length) : "Current step";
    var kind = chain && chain.kind ? String(chain.kind).replace(/-/g, " to ") : "workflow";
    var stepPrefix = (chain && steps.length) ? (stepLabel + " — " + kind + " — ") : "";
    var nextActionFallback = nextEndpoint
        ? (nextEndpoint.method + " " + nextEndpoint.path)
        : (chain && steps.length ? "No next step was inferred for this chain." : "Expand endpoints in this family and inspect the next likely call.");
    return '<div class="family-insight-card workflow-step-workspace">'
        + '<p class="insight-kicker">Workflow step workspace</p>'
        + '<ul class="family-top-evidence">'
        + '<li><strong>Current step:</strong> ' + escapeHtml(stepPrefix + endpoint.method + " " + endpoint.path) + "</li>"
        + '<li><strong>What this step needs:</strong> ' + escapeHtml(narrative.requiredState || "No explicit prerequisites are visible in the contract; treat prior context as required.") + "</li>"
        + '<li><strong>Hidden handoff/context dependency:</strong> ' + escapeHtml(hiddenHandoff) + "</li>"
        + '<li><strong>What to call next:</strong> ' + escapeHtml(narrative.nextAction || nextActionFallback) + "</li>"
        + '<li><strong>Where the contract failed to communicate it:</strong> ' + escapeHtml(contractFailed) + "</li>"
        + "</ul>"
        + "</div>";
}
function summarizeWorkflowHeaderSignals(detail) {
    var findings = (detail && detail.findings) || [];
    var messages = findings.map(function (finding) { return (finding.message || "").toLowerCase(); }).join(" | ");
    function hasCode(codes) {
        return findings.some(function (finding) { return codes.indexOf(finding.code || "") !== -1; });
    }
    var labels = [];
    if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage", "weak-outcome-next-action-guidance"])
        || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed/.test(messages)) {
        labels.push("next-step gap");
    }
    if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage"])
        || /handoff|identifier|tracking|hidden/.test(messages)) {
        labels.push("hidden handoff");
    }
    if (/auth|authorization|bearer|token|header|context|access\s*key|api[-\s]?key/.test(messages)) {
        labels.push("auth/context burden");
    }
    if (hasCode(["prerequisite-task-burden"])
        || /prior state|earlier|sequence|prerequisite|brittle/.test(messages)) {
        labels.push("sequencing burden");
    }
    if (!labels.length)
        return "workflow continuity signals are limited for this endpoint";
    return "primary continuity signals: " + labels.join(", ");
}
function renderWorkflowDiagnosticsFrame(detail) {
    var findings = detail.findings || [];
    var messages = findings.map(function (finding) { return (finding.message || "").toLowerCase(); }).join(" | ");
    function hasCode(codes) {
        return findings.some(function (finding) { return codes.indexOf(finding.code || "") !== -1; });
    }
    var activeSignals = [];
    if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage", "weak-outcome-next-action-guidance"])
        || /next[-\s]?step|follow[-\s]?up|tracking|identifier|what changed/.test(messages)) {
        activeSignals.push("Next-step gap is signaled: follow-up requirement is not clearly exposed.");
    }
    if (hasCode(["weak-follow-up-linkage", "weak-action-follow-up-linkage", "weak-accepted-tracking-linkage"])
        || /handoff|identifier|tracking|hidden/.test(messages)) {
        activeSignals.push("Hidden handoff burden is signaled: identifier/context transfer appears implicit.");
    }
    if (/auth|authorization|bearer|token|header|context|access\s*key|api[-\s]?key/.test(messages)) {
        activeSignals.push("Auth/header/context burden is signaled across messages for this endpoint.");
    }
    if (hasCode(["prerequisite-task-burden"])
        || /prior state|earlier|sequence|prerequisite|brittle/.test(messages)) {
        activeSignals.push("Sequencing burden is signaled: this step appears to depend on prior state setup.");
    }
    var signalList = activeSignals.length
        ? activeSignals.map(function (text) { return "<li>" + escapeHtml(text) + "</li>"; }).join("")
        : "<li>No explicit workflow continuity burden signal is attached to this endpoint in the current workflow slice.</li>";
    return '<div class="family-insight-card">'
        + '<p class="insight-kicker">Workflow-first diagnostics framing</p>'
        + '<p class="subtle">This panel is focused on continuity burden for this endpoint inside call chains: what the next step needs, what state is hidden, and where sequencing may be brittle.</p>'
        + '<ul class="family-top-evidence">'
        + signalList
        + "</ul>"
        + "</div>";
}
function buildChainContext(relatedChains, endpointId, endpointDetails) {
    if (!relatedChains || !relatedChains.length)
        return "";
    var html = '<section class="detail-chain-context">';
    relatedChains.forEach(function (chain) {
        var stepIndex = chain.endpointIds.indexOf(endpointId);
        if (stepIndex < 0)
            return;
        var totalSteps = chain.endpointIds.length;
        var stepNum = stepIndex + 1;
        var hasPrev = stepIndex > 0;
        var hasNext = stepIndex < totalSteps - 1;
        var kind = chain.kind ? chain.kind.replaceAll("-", " to ") : "workflow";
        html += '<div class="chain-context-block">'
            + '<div class="chain-position-banner">Step ' + stepNum + " of " + totalSteps + " — " + escapeHtml(kind) + "</div>";
        if (hasPrev) {
            var prevId = chain.endpointIds[stepIndex - 1];
            var prevDetail = endpointDetails[prevId];
            if (prevDetail) {
                html += '<div class="chain-step-info prev-step">'
                    + '<p class="chain-step-label">Came from</p>'
                    + "<strong>" + escapeHtml(prevDetail.endpoint.method + " " + prevDetail.endpoint.path) + "</strong>"
                    + "<p class=\"subtle\">That step's response provides context or identifiers used here.</p>"
                    + "</div>";
            }
        }
        if (hasNext) {
            var nextId = chain.endpointIds[stepIndex + 1];
            var nextDetail = endpointDetails[nextId];
            if (nextDetail) {
                var nextNeeds = describeNextStepNeeds(chain.endpointIds[stepIndex], nextDetail);
                html += '<div class="chain-step-info next-step">'
                    + '<p class="chain-step-label">Leads to</p>'
                    + "<strong>" + escapeHtml(nextDetail.endpoint.method + " " + nextDetail.endpoint.path) + "</strong>"
                    + '<p class="subtle">' + escapeHtml(nextNeeds) + "</p>"
                    + "</div>";
            }
        }
        html += "</div>";
    });
    html += "</section>";
    return html;
}
function describeNextStepNeeds(fromId, toDetail) {
    var toPath = toDetail.endpoint.path;
    if (toPath.indexOf("{") !== -1) {
        return "This step needs to extract an identifier from " + humanizeObjectName(toPath.split("/").pop().replace(/{|}/g, "")) + " and pass it forward.";
    }
    return "The next step needs context or identifiers from this response to proceed. Check the response schema for required IDs.";
}
function renderEndpointDiagnosticsWorkflowSummary(detail) {
    var endpoint = detail.endpoint || createEmptyEndpointRow();
    var findings = findingsForActiveLens(detail.findings || []);
    var groups = groupFindings(findings);
    var chainCount = (detail.relatedChains || []).length;
    var signalSummary = summarizeWorkflowHeaderSignals(detail);
    var guidance = collectTrapGuidance(endpoint, findings, { prereq: [], establish: [], nextNeeds: [], hidden: [] }, [], [], null, "", false);
    var guidanceHtml = renderTrapGuidanceList(guidance, {
        title: "Workflow trap guidance",
        className: "inspector-trap-guidance",
        limit: 3
    });
    var chainContextHtml = renderWorkflowChainContextForEndpoint(detail);
    return '<div class="endpoint-diag-pane">'
        + chainContextHtml
        + '<div class="family-insight-card">'
        + '<p class="insight-kicker">Workflow continuity evidence</p>'
        + '<p class="subtle"><strong>' + escapeHtml(endpoint.method + " " + endpoint.path) + "</strong> "
        + (chainCount ? ("appears in " + chainCount + " workflow chain" + (chainCount === 1 ? "" : "s")) : "is not currently linked to an inferred chain")
        + " and is prioritized here for continuity burden signals.</p>"
        + '<ul class="family-top-evidence">'
        + '<li><strong>Primary continuity signals:</strong> ' + escapeHtml(signalSummary.replace(/^primary continuity signals:\s*/i, "")) + ".</li>"
        + "<li><strong>Why this matters to a client:</strong> When the contract does not expose next-step IDs/context, clients must guess, store hidden state, or add extra reads between calls.</li>"
        + "</ul>"
        + guidanceHtml
        + "</div>"
        + renderFullExactEvidenceDrawer(groups, { endpoint: endpoint, familyName: endpoint.family || "", open: false })
        + "</div>";
}
function workflowStepBuildDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings) {
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
        workflowSurfaceAddUniqueClue(clues.prereq, 'appears to require prior state from an earlier step');
    }
    if (/(header|authorization|bearer|access\s*key|api[-\s]?key|token|context)/i.test(messages)) {
        workflowSurfaceAddUniqueClue(clues.prereq, 'appears to require auth/header or context token');
    }
    if (path.indexOf('/_action/') !== -1 || role === 'action') {
        workflowSurfaceAddUniqueClue(clues.prereq, 'appears to require an earlier mutation or lookup');
    }
    if ((path.indexOf('cart') !== -1 || path.indexOf('order') !== -1 || path.indexOf('customer') !== -1) && stepIndex > 0) {
        workflowSurfaceAddUniqueClue(clues.prereq, 'suggests dependency on prior cart/customer/order context');
    }
    if (path.indexOf('auth') !== -1 || path.indexOf('login') !== -1 || path.indexOf('session') !== -1 || path.indexOf('register') !== -1) {
        workflowSurfaceAddUniqueClue(clues.establish, 'appears to establish auth context');
    }
    if (path.indexOf('customer') !== -1 && (method === 'POST' || role === 'create' || role === 'register' || role === 'login')) {
        workflowSurfaceAddUniqueClue(clues.establish, 'appears to establish customer context');
    }
    if (/(token|context)/i.test(messages)) {
        workflowSurfaceAddUniqueClue(clues.establish, 'appears to establish or store context token');
    }
    if (path.indexOf('cart') !== -1 && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
        workflowSurfaceAddUniqueClue(clues.establish, 'appears to mutate cart state');
    }
    if (path.indexOf('order') !== -1 && method === 'POST') {
        workflowSurfaceAddUniqueClue(clues.establish, 'appears to create order identity');
    }
    if (path.indexOf('payment') !== -1 || role === 'payment' || role === 'checkout') {
        workflowSurfaceAddUniqueClue(clues.establish, 'appears to trigger payment follow-up');
    }
    if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        workflowSurfaceAddUniqueClue(clues.establish, 'likely changes authoritative state for later calls');
    }
    if (!isLast && nextEndpoint) {
        if (/(token|context)/i.test(messages)) {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs context token');
        }
        if (/(header|authorization|bearer|access\s*key|api[-\s]?key)/i.test(messages)) {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs auth or access header');
        }
        if (nextPath.indexOf('{') !== -1 || nextRole === 'detail') {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs cart/customer/order identity');
        }
        if (nextMethod === 'PATCH' || nextMethod === 'PUT' || nextMethod === 'DELETE' || nextRole === 'action') {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely depends on changed state from this step');
        }
        if (nextPath.indexOf('payment') !== -1 || nextRole === 'payment' || nextRole === 'checkout') {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely depends on prior order or transaction state');
        }
        if (nextPath.indexOf('/_action/') !== -1) {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs action/context prerequisites');
        }
        if (!clues.nextNeeds.length && method === 'GET') {
            workflowSurfaceAddUniqueClue(clues.nextNeeds, 'next step likely needs selected resource context');
        }
    }
    if (linkageFindings.length) {
        workflowSurfaceAddUniqueClue(clues.hidden, 'does not clearly expose next required identifier or header');
        workflowSurfaceAddUniqueClue(clues.hidden, 'does not clearly expose authoritative token or context');
        workflowSurfaceAddUniqueClue(clues.hidden, isLast
            ? 'follow-up step appears brittle from contract alone'
            : 'next required state appears implicit in the contract');
    }
    if (prerequisiteFindings.length) {
        workflowSurfaceAddUniqueClue(clues.hidden, 'likely depends on prior state transition not clearly modeled');
    }
    if (/(follow[-\s]?up|next[-\s]?step|tracking|identifier)/i.test(messages) && !isLast) {
        workflowSurfaceAddUniqueClue(clues.hidden, 'suggests dependency on data not clearly surfaced in response fields');
    }
    return clues;
}
function workflowStepCollectTrapGuidance(endpoint, findings, clues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast) {
    var path = ((endpoint && endpoint.path) || '').toLowerCase();
    var nextPath = ((nextEndpoint && nextEndpoint.path) || '').toLowerCase();
    var messages = (findings || []).map(function (f) { return (f.message || '').toLowerCase(); }).join(' | ');
    var cluesText = ((clues && clues.prereq) || []).concat((clues && clues.establish) || [], (clues && clues.nextNeeds) || [], (clues && clues.hidden) || []).join(' | ').toLowerCase();
    var traps = [];
    function addTrap(id, title, happened, whyMissed, next) {
        if (traps.some(function (t) { return t.id === id; }))
            return;
        traps.push({ id: id, title: title, happened: happened, whyMissed: whyMissed, next: next });
    }
    var loginOrRegister = /login|register|auth|session/.test(path);
    var hasTokenContextSignals = /(token|context|authorization|bearer|auth)/.test(messages + ' | ' + cluesText);
    var hasAccessKeySignals = /(sw-access-key|access\s*key|api[-\s]?key)/.test(messages + ' | ' + cluesText);
    var hasLinkageSignals = (linkageFindings || []).length > 0 || /(next[-\s]?step|follow[-\s]?up|tracking|identifier|handoff)/.test(messages + ' | ' + cluesText);
    var hasPrereqSignals = (prerequisiteFindings || []).length > 0 || ((clues && clues.prereq) || []).length > 0;
    var hasShapeOutcomeSignals = false;
    if (loginOrRegister && hasTokenContextSignals) {
        addTrap('context-token-replacement-after-login-register', 'Context token replacement after login/register', 'This step can replace the active context/auth token.', 'Contract responses often do not clearly mark prior context as stale.', 'Treat previous token/context as invalid and persist the new token before downstream calls.');
    }
    if (/(cart)/.test(path + ' ' + nextPath) && hasTokenContextSignals) {
        addTrap('cart-loss-after-context-change', 'Cart loss after context change', 'Changing context can detach or invalidate the active cart reference.', 'Cart continuity is usually implicit, not modeled as an explicit invalidation rule.', 'Reload cart identity after context change, then continue checkout/update calls.');
    }
    if (/(store-api|store api|session|ephemeral)/.test(path + ' ' + messages + ' ' + cluesText) && hasTokenContextSignals) {
        addTrap('ephemeral-store-api-context', 'Ephemeral Store API context', 'Store API context appears ephemeral across requests.', 'TTL/replacement behavior is commonly omitted from explicit contract fields.', 'Read context token freshness per step and add retry/recovery for expired context.');
    }
    if (hasAccessKeySignals && hasTokenContextSignals) {
        addTrap('sw-access-key-vs-auth-token-confusion', 'sw-access-key vs auth token confusion', 'Both sw-access-key and auth/context token requirements appear in this flow.', 'Contract text can blur static key responsibilities vs per-session token handoff.', 'Document precedence and send each credential explicitly where required; fail fast on mismatch.');
    }
    if (hasPrereqSignals) {
        addTrap('hidden-prerequisites-before-step-valid', 'Hidden prerequisites before a step is valid', 'This step appears to require hidden prerequisite state before it is valid.', 'Required prior state/identifier is implied rather than explicitly modeled.', 'Surface prerequisite state in previous responses or add explicit precondition fields.');
    }
    if (hasPrereqSignals || hasLinkageSignals) {
        addTrap('runtime-taught-rule-contract-did-not', 'Runtime taught me the rule, contract did not', 'A behavioral rule is likely learned only at runtime, not from contract shape.', 'The schema does not provide enough explicit guardrails to predict the failure upfront.', 'Add explicit outcome/status/constraint fields so clients can validate before the next call.');
    }
    if (hasLinkageSignals || isLast) {
        addTrap('weak-or-absent-next-step-modeling', 'Weak or absent next-step modeling', 'Next-step modeling is weak or absent for this response.', 'There is no single explicit next-action/handoff field to follow safely.', 'Return nextAction plus required identifier/link in the response contract.');
    }
    if (hasShapeOutcomeSignals || /internal|snapshot|storage|model structure/.test(messages)) {
        addTrap('backend-internal-state-exposed-not-workflow-outcomes', 'Backend internal state exposed instead of workflow outcomes', 'Response emphasizes backend internal/storage state over workflow outcome.', 'Large snapshots look informative but hide completion meaning and next action.', 'Return compact outcome, authoritative state, and next action near top-level fields.');
    }
    return traps;
}
function workflowStepRenderTrapGuidanceList(traps, options) {
    var opts = options || {};
    var list = (traps || []).slice(0, opts.limit || 3);
    if (!list.length)
        return '';
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
function workflowStepSummarizeNarrative(endpoint, roleLabel, nextEndpoint, clues, findings, linkageFindings, prerequisiteFindings, isLast) {
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
    }
    else if (method === 'POST') {
        changed = 'creates new server-side state (response should expose the new identifier/status)';
    }
    else if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        changed = 'mutates server-side state (response should expose the outcome and updated authoritative fields)';
    }
    else {
        changed = 'returns current state for downstream steps (response should expose the fields needed for the next call)';
    }
    var requiredState = '';
    if ((clues.prereq || []).length) {
        requiredState = clues.prereq[0];
    }
    else if ((clues.nextNeeds || []).length) {
        requiredState = clues.nextNeeds[0];
    }
    else if (/(token|context|authorization|header|access\s*key|api[-\s]?key)/i.test(messages)) {
        requiredState = 'auth/context token in response or headers';
    }
    else if (/(identifier|id|tracking)/i.test(messages) || /(\{[^}]+\})/.test(endpoint.path || '')) {
        requiredState = 'resource identifier carried forward from an earlier response';
    }
    else if (/cart|order|customer/.test(path)) {
        requiredState = 'current ' + (path.indexOf('cart') !== -1 ? 'cart' : (path.indexOf('order') !== -1 ? 'order' : 'customer')) + ' state';
    }
    else {
        requiredState = 'response state needed by downstream calls';
    }
    var nextAction = '';
    if (isLast) {
        nextAction = 'confirm outcome or poll if asynchronous';
    }
    else if (nextEndpoint) {
        nextAction = endpointIntentCue(nextEndpoint.method || '', nextEndpoint.path || '') + ' via ' + (nextEndpoint.method || '') + ' ' + (nextEndpoint.path || '');
        if ((clues.nextNeeds || []).length) {
            nextAction += ' (needs: ' + clues.nextNeeds[0] + ')';
        }
    }
    else {
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
    return {
        callDoes: callDoes,
        changesAfter: changed,
        requiredState: requiredState,
        nextAction: nextAction,
        traps: uniq(traps)
    };
}
function workflowStepRender(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel) {
    var endpointDetails = payloadEndpointDetails();
    var detail = endpointDetails[endpointId];
    if (!detail)
        return '';
    var endpoint = detail.endpoint;
    var findings = detail.findings || [];
    var nextDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
    var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
    var linkageFindings = findings.filter(function (f) {
        return f.code === 'weak-follow-up-linkage' || f.code === 'weak-action-follow-up-linkage' || f.code === 'weak-accepted-tracking-linkage' || f.code === 'weak-outcome-next-action-guidance';
    });
    var prerequisiteFindings = findings.filter(function (f) {
        return f.code === 'prerequisite-task-burden';
    });
    var isLast = stepIndex === (totalSteps - 1);
    var warnings = [];
    if (linkageFindings.length)
        warnings.push({ type: 'linkage', count: linkageFindings.length, label: 'missing follow-up ID' });
    if (prerequisiteFindings.length)
        warnings.push({ type: 'prerequisite', count: prerequisiteFindings.length, label: 'hidden dependency' });
    var continuityBurden = '';
    if (isLast && linkageFindings.length) {
        continuityBurden = '<p class="workflow-burden-note"><strong>Workflow ends weakly:</strong> The response does not clearly expose the outcome or required next-step identifier. Clients may need manual confirmation or polling.</p>';
    }
    else if (!isLast && linkageFindings.length) {
        continuityBurden = '<p class="workflow-burden-note"><strong>Continuity burden:</strong> This step does not clearly expose the identifier or state needed for the next step. Clients must track or fetch separately.</p>';
    }
    var warningBadges = warnings.map(function (warning) {
        return '<span class="workflow-warning-badge workflow-warning-' + warning.type + '">'
            + '<strong>' + warning.count + '</strong> ' + warning.label
            + '</span>';
    }).join('');
    var dependencyClues = workflowStepBuildDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
    var dependencyHtml = workflowSurfaceRenderDependencyClues(dependencyClues);
    var roleSlug = roleLabel ? roleLabel.toLowerCase().replace(/[^a-z]/g, '') : '';
    var humanRole = roleLabel ? humanizeStepRole(roleLabel) : '';
    var roleHtml = humanRole
        ? '<span class="step-role-pill step-role-' + escapeHtml(roleSlug) + '">' + escapeHtml(humanRole) + '</span>'
        : '<span class="step-number">Step ' + (stepIndex + 1) + ' of ' + totalSteps + '</span>';
    var transitionCue = inferWorkflowTransitionCue(dependencyClues, roleLabel);
    var narrative = workflowStepSummarizeNarrative(endpoint, roleLabel, nextEndpoint, dependencyClues, findings, linkageFindings, prerequisiteFindings, isLast);
    var trapGuidance = workflowStepCollectTrapGuidance(endpoint, findings, dependencyClues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
    var narrativeHtml = '<div class="step-narrative">'
        + '<div class="step-narrative-row"><span class="step-narrative-label">What this call does</span><span class="step-narrative-value">' + escapeHtml(narrative.callDoes) + '</span></div>'
        + '<div class="step-narrative-row"><span class="step-narrative-label">What you need before calling it</span><span class="step-narrative-value">' + escapeHtml(narrative.requiredState) + '</span></div>'
        + '<div class="step-narrative-row"><span class="step-narrative-label">Authoritative state after success</span><span class="step-narrative-value">' + escapeHtml(narrative.changesAfter || '') + '</span></div>'
        + '<div class="step-narrative-row"><span class="step-narrative-label">What to call next</span><span class="step-narrative-value">' + escapeHtml(narrative.nextAction) + '</span></div>'
        + '</div>';
    var trapHtml = workflowStepRenderTrapGuidanceList(trapGuidance, {
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
function workflowJourneyAnalyzePattern(kind, chains, endpointDetails, parseRoles, summarizeBurden, buildClues, humanizeRole) {
    var allProblems = [];
    var allTokens = [];
    var allContext = [];
    var allHiddenDeps = [];
    var allLearnedRules = [];
    var contractGaps = {};
    (chains || []).forEach(function (chain) {
        var steps = chain.endpointIds || [];
        var roles = parseRoles(chain.summary, steps.length);
        var summary = summarizeBurden(chain, roles);
        summary.forEach(function (burden) {
            if (allProblems.indexOf(burden.label) === -1) {
                allProblems.push(burden.label);
            }
        });
        steps.forEach(function (endpointId, idx) {
            var detail = endpointDetails[endpointId];
            if (!detail)
                return;
            var endpoint = detail.endpoint || createEmptyEndpointRow();
            var findings = detail.findings || [];
            var role = roles[idx] || "";
            var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : "";
            var nextDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
            var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
            var nextRole = roles[idx + 1] || "";
            var linkageFindings = findings.filter(function (finding) {
                return finding.code === "weak-follow-up-linkage"
                    || finding.code === "weak-action-follow-up-linkage"
                    || finding.code === "weak-accepted-tracking-linkage"
                    || finding.code === "weak-outcome-next-action-guidance";
            });
            var prerequisiteFindings = findings.filter(function (finding) {
                return finding.code === "prerequisite-task-burden";
            });
            var clues = buildClues(endpoint, findings, idx, steps.length, role, nextEndpoint, nextRole, linkageFindings, prerequisiteFindings);
            if (/(auth|token|session|context)/i.test((clues.establish || []).join(" "))) {
                allTokens.push(role + " establishes context/token");
            }
            if (/(auth|token|header|context)/i.test((clues.nextNeeds || []).join(" "))) {
                allContext.push("step " + (idx + 1) + " needs " + ((clues.nextNeeds || [])[0] || "context"));
            }
            if ((clues.hidden || []).length) {
                (clues.hidden || []).forEach(function (hidden) {
                    allHiddenDeps.push(hidden);
                });
            }
            if (prerequisiteFindings.length) {
                allHiddenDeps.push(humanizeRole(role) + " depends on prior state");
            }
            if ((endpoint.path || "").indexOf("{") > -1 && idx > 0) {
                allLearnedRules.push("Step " + (idx + 1) + " path requires resource ID from prior response");
            }
            if ((clues.prereq || []).some(function (prereq) { return /prior state|earlier|mutation/i.test(prereq); })) {
                allLearnedRules.push("Step " + (idx + 1) + " depends on mutations from earlier steps");
            }
            if (linkageFindings.length && !contractGaps.missing_next_action) {
                contractGaps.missing_next_action = true;
            }
            if (!endpoint.description || String(endpoint.description || "").length < 20) {
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
function workflowJourneyRenderProblems(problems, escape) {
    if (!problems || !problems.length)
        return "";
    return '<div class="journey-problems">'
        + '<p class="journey-section-kicker">DX problems in this journey</p>'
        + '<ul class="journey-problem-list">'
        + problems.map(function (problem) {
            return "<li><strong>" + escape(problem) + "</strong></li>";
        }).join("")
        + "</ul>"
        + "</div>";
}
function workflowJourneyRenderContractGaps(gaps, escape) {
    if (!gaps || Object.keys(gaps).length === 0)
        return "";
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
    if (!items.length)
        return "";
    return '<div class="journey-gaps">'
        + '<p class="journey-section-kicker">Contract gaps</p>'
        + '<ul class="journey-gap-list">'
        + items.join("")
        + "</ul>"
        + "</div>";
}
function workflowJourneyRenderProposal(kind, analysis, escape) {
    var proposals = [];
    if (kind.indexOf("create") !== -1) {
        proposals.push("For POST responses, include the new resource ID and minimal authoritative state in the body.");
        proposals.push("Indicate completion vs follow-up required (and name the follow-up action/state).");
    }
    if (kind.indexOf("update") !== -1 || kind.indexOf("detail") !== -1) {
        proposals.push("For PATCH/PUT responses, return an explicit outcome summary and the authoritative state fields.");
        proposals.push("For every mutation, include <code>nextAction</code> (or <code>nextActions</code>) describing the next valid step.");
    }
    if (kind.indexOf("action") !== -1) {
        proposals.push("For action endpoints, return outcome state (not a request echo) in the success payload.");
        proposals.push("Return follow-up requirements: which endpoint to call next and which ID/state to carry forward.");
    }
    if (kind.indexOf("follow-up") !== -1) {
        proposals.push("Accept identifiers returned by prior steps (do not require extra lookup to form the call).");
        proposals.push("Return completion vs next required state change explicitly in the response.");
    }
    if (kind.indexOf("list") !== -1) {
        proposals.push("Return pagination context (<code>limit</code>/<code>offset</code>/<code>total</code> or equivalent).");
        proposals.push("Include minimal list-item detail needed to decide whether to fetch full details.");
    }
    if (analysis.hiddenDeps && analysis.hiddenDeps.length) {
        proposals.push("Expose prerequisite IDs/state in responses (do not require inferred prior state).");
    }
    if (analysis.learnedRules && analysis.learnedRules.length) {
        proposals.push('Add descriptions documenting sequencing rules and where path parameters come from (for example: "use id from step 2 response").');
    }
    if (!proposals.length)
        return "";
    return '<div class="journey-proposal">'
        + '<p class="journey-section-kicker">Workflow-first contract edits</p>'
        + '<ul class="journey-proposal-list">'
        + proposals.slice(0, 4).map(function (proposal) {
            return "<li>" + escape(proposal) + "</li>";
        }).join("")
        + "</ul>"
        + "</div>";
}
function workflowJourneyRenderGuidance(kind, chains, analysis, kindLabel, totalBurden, escape) {
    var chainCount = chains.length;
    var burdenLabel = totalBurden === 1 ? "issue" : "issues";
    var chainLabel = chainCount === 1 ? "chain" : "chains";
    return '<details class="workflow-journey-card">'
        + '<summary class="workflow-journey-summary">'
        + '<span class="journey-label">' + escape(kindLabel) + "</span>"
        + '<span class="journey-meta">' + chainCount + " " + chainLabel + " · " + totalBurden + " burden " + burdenLabel + "</span>"
        + "</summary>"
        + '<div class="workflow-journey-body">'
        + workflowJourneyRenderProblems(analysis.problems, escape)
        + workflowJourneyRenderContractGaps(analysis.contractGaps, escape)
        + workflowJourneyRenderProposal(kind, analysis, escape)
        + "</div>"
        + "</details>";
}
var state = createInitialExplorerState();
var el = createExplorerElements(document);
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
function enforceSpecRuleTabFilterModel() {
    viewScopeEnforceSpecRuleTabFilterModel();
}
function enforceWorkflowTabFilterModel() {
    viewScopeEnforceWorkflowTabFilterModel();
}
function enforceShapeTabFilterModel() {
    viewScopeEnforceShapeTabFilterModel();
}
function normalizeSelectedEndpointForCurrentView() {
    viewScopeNormalizeSelectedEndpointForCurrentView();
}
function payloadEndpointDetails() {
    return viewScopePayloadEndpointDetails();
}
function payloadWorkflowChains() {
    return viewScopePayloadWorkflowChains();
}
function lensFindingCountForRow(row) {
    return viewScopeLensFindingCountForRow(row);
}
function hasValidSelectedEndpointInCurrentView() {
    return viewScopeHasValidSelectedEndpointInCurrentView();
}
function selectionRowsForActiveView() {
    return viewScopeSelectionRowsForActiveView();
}
function issueScopeIndexCacheKey() {
    return viewScopeIssueScopeIndexCacheKey();
}
function findingGroupKey(finding) {
    return viewScopeFindingGroupKey(finding);
}
function buildIssueScopeIndexForCurrentView() {
    return viewScopeBuildIssueScopeIndexForCurrentView();
}
function getIssueScopeIndex() {
    return viewScopeGetIssueScopeIndex();
}
function issueScopeLabelForKey(groupKey, familyName) {
    return viewScopeIssueScopeLabelForKey(groupKey, familyName);
}
function renderEndpointDiagnosticsSummary(detail) {
    return inspectorRenderEndpointDiagnosticsSummary(detail);
}
function renderCommonWorkflowJourneys(chains) {
    return inspectionShellRenderCommonWorkflowJourneys(chains);
}
function renderWorkflowJourneyGuidance(kind, chains) {
    return inspectionShellRenderWorkflowJourneyGuidance(kind, chains);
}
function analyzeWorkflowPattern(kind, chains) {
    return inspectionShellAnalyzeWorkflowPattern(kind, chains);
}
function renderWorkflowJourneyProblems(problems) {
    return inspectionShellRenderWorkflowJourneyProblems(problems);
}
function renderWorkflowJourneyContractGaps(gaps) {
    return inspectionShellRenderWorkflowJourneyContractGaps(gaps);
}
function renderWorkflowJourneyProposal(kind, analysis) {
    return inspectionShellRenderWorkflowJourneyProposal(kind, analysis);
}
function renderEndpointDiagnosticsShapeSummary(detail) {
    return inspectorRenderEndpointDiagnosticsShapeSummary(detail);
}
function renderEndpointDiagnosticsExact(detail) {
    return inspectorRenderEndpointDiagnosticsExact(detail);
}
function renderInspectorGroundingAndFlowContext(detail) {
    return inspectorRenderGroundingAndFlowContext(detail);
}
function renderInspectorContentMap() {
    return inspectorRenderContentMap();
}
function renderEndpointDiagnosticsCleaner(detail) {
    return diagnosticsRenderCleaner(detail, {
        findingsForActiveLens: findingsForActiveLens,
        buildContractImprovementItems: buildContractImprovementItems,
        collectShapePainSignals: collectShapePainSignals,
        escapeHtml: escapeHtml
    });
}
function buildContractImprovementItems(detail, findings) {
    return contractImprovementBuildItems(detail, findings, contractImprovementItemForFinding);
}
function describeImprovementWhere(context, fallback) {
    return contractImprovementDescribeWhere(context, fallback);
}
function openApiOperationPointer(endpoint) {
    return openApiTargetOperationPointer(endpoint);
}
function openApiResponseObjectPointer(endpoint, statusCode) {
    return openApiTargetResponseObjectPointer(endpoint, statusCode);
}
function openApiResponseSchemaPointer(endpoint, context) {
    return openApiTargetResponseSchemaPointer(endpoint, context);
}
function openApiRequestSchemaPointer(endpoint, context) {
    return openApiTargetRequestSchemaPointer(endpoint, context);
}
function formatWhereWithOpenAPITarget(endpoint, context, opts) {
    return openApiTargetFormatWhere(endpoint, context, opts);
}
function contractImprovementItemForFinding(finding, endpoint) {
    return contractImprovementBuildItemForFinding(finding, endpoint, {
        extractOpenAPIContext: extractOpenAPIContext,
        formatWhereWithOpenAPITarget: formatWhereWithOpenAPITarget,
        openApiOperationPointer: openApiOperationPointer,
        openApiResponseObjectPointer: openApiResponseObjectPointer,
        specRuleWhy: SPEC_RULE_WHY
    });
}
function renderEndpointDiagnosticsConsistency(detail) {
    return diagnosticsRenderConsistency(detail, {
        consistencyFindingsForDetail: consistencyFindingsForDetail,
        selectedEndpointId: state.selectedEndpointId,
        payload: state.payload,
        escapeHtml: escapeHtml,
        humanFamilyLabel: humanFamilyLabel
    });
}
function renderConsistencySupportCard(detail, options) {
    return diagnosticsRenderConsistencySupportCard(detail, options, {
        consistencyFindingsForDetail: consistencyFindingsForDetail,
        escapeHtml: escapeHtml
    });
}
function syncControls() {
    appRuntimeSyncControls();
}
function selectEndpointForInspector(endpointId, subTab) {
    appRuntimeSelectEndpointForInspector(endpointId, subTab);
}
function endpointRowForId(endpointId) {
    return appRuntimeEndpointRowForId(endpointId);
}
function endpointDetailForId(endpointId) {
    return appRuntimeEndpointDetailForId(endpointId);
}
function activeTopTabLabel() {
    return inspectionShellActiveTopTabLabel();
}
function formatScopeValue(value, fallback) {
    return viewScopeFormatScopeValue(value, fallback);
}
function renderFilterEmptyState() {
    viewScopeRenderFilterEmptyState();
}
function renderWhatToDoNextBlock(endpoint, findings, options) {
    return diagnosticsRenderWhatToDoNextBlock(endpoint, findings, options, {
        escapeHtml: escapeHtml,
        collectConcreteNextActions: collectConcreteNextActions
    });
}
function renderInspectorWorkspaceHeader(detail, findings, options) {
    return inspectionShellRenderInspectorWorkspaceHeader(detail, findings, options);
}
function collectConcreteNextActions(endpoint, findings) {
    return diagnosticsCollectConcreteNextActions(endpoint, findings, {
        findingsForActiveLens: findingsForActiveLens,
        extractOpenAPIContext: extractOpenAPIContext,
        buildContractImprovementItems: buildContractImprovementItems
    });
}
function familySurfaceHelpCopy() {
    return inspectionShellFamilySurfaceHelpCopy();
}
function renderWorkflowChains() {
    workflowSurfaceRenderChains();
}
function renderWorkflowChainsDrawer(innerHtml, chainCount) {
    return workflowSurfaceRenderChainsDrawer(innerHtml, chainCount);
}
function bindWorkflowChainsDrawerToggle() {
    workflowSurfaceBindChainsDrawerToggle();
}
function renderWorkflowGuideSection(chains) {
    return workflowSurfaceRenderGuideSection(chains);
}
function renderWorkflowGuideCard(chain, isLead) {
    return workflowSurfaceRenderGuideCard(chain, isLead);
}
function bindWorkflowStepInteractions() {
    workflowSurfaceBindStepInteractions();
}
function syncWorkflowStepSelectionHighlight() {
    workflowSurfaceSyncStepSelectionHighlight();
}
function renderWorkflowEmptyState(mode) {
    return workflowSurfaceRenderEmptyState(mode);
}
function groupChainsByKind(chains, options) {
    return workflowSurfaceGroupChainsByKind(chains, options);
}
function chainBurdenScore(chain) {
    return workflowSurfaceChainBurdenScore(chain);
}
function parseChainRoles(summary, count) {
    return workflowSurfaceParseChainRoles(summary, count);
}
function humanizeStepRole(roleSlug) {
    return workflowSurfaceHumanizeStepRole(roleSlug);
}
var KIND_GROUP_LABEL = {
    'list-detail': 'Browse then inspect',
    'list-detail-update': 'Browse, inspect, and update',
    'list-detail-action': 'Browse, inspect, and act',
    'list-detail-create': 'Browse, inspect, and create',
    'create-detail': 'Create then inspect',
    'create-detail-update': 'Create then refine',
    'create-detail-action': 'Create then act',
    'action-follow-up': 'Act and follow up',
    'media-detail-follow-up': 'Upload then follow up',
    'order-detail-action': 'Submit then confirm'
};
function kindGroupLabel(kind) {
    return workflowSurfaceKindGroupLabel(kind);
}
function chainTaskLabel(chain) {
    return workflowSurfaceChainTaskLabel(chain);
}
function chainResourceLabel(chain) {
    return workflowSurfaceChainResourceLabel(chain);
}
function formatWorkflowStepRefs(indices) {
    return workflowSurfaceFormatStepRefs(indices);
}
function collectWorkflowBurdenSummary(chain, roles) {
    return workflowSurfaceCollectBurdenSummary(chain, roles);
}
function renderWorkflowBurdenSummary(chain, roles) {
    return workflowSurfaceRenderBurdenSummary(chain, roles);
}
function renderWorkflowKindGroup(group) {
    return workflowSurfaceRenderKindGroup(group);
}
function renderWorkflowChain(chain, isPrimary) {
    return workflowSurfaceRenderChain(chain, isPrimary);
}
function addUniqueClue(list, text) {
    workflowSurfaceAddUniqueClue(list, text);
}
function firstClues(list, limit) {
    return workflowSurfaceFirstClues(list, limit);
}
function renderWorkflowDependencyClues(clues) {
    return workflowSurfaceRenderDependencyClues(clues);
}
function inferWorkflowCueSubject(text) {
    return workflowSurfaceInferCueSubject(text);
}
function inferWorkflowTransitionCue(clues, roleLabel) {
    return workflowSurfaceInferTransitionCue(clues, roleLabel);
}
function buildWorkflowDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings) {
    return workflowStepBuildDependencyClues(endpoint, findings, stepIndex, totalSteps, roleLabel, nextEndpoint, nextRoleLabel, linkageFindings, prerequisiteFindings);
}
function collectTrapGuidance(endpoint, findings, clues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast) {
    return workflowStepCollectTrapGuidance(endpoint, findings, clues, linkageFindings, prerequisiteFindings, nextEndpoint, roleLabel, isLast);
}
function renderTrapGuidanceList(traps, options) {
    return workflowStepRenderTrapGuidanceList(traps, options);
}
function summarizeWorkflowStepNarrative(endpoint, roleLabel, nextEndpoint, clues, findings, linkageFindings, prerequisiteFindings, isLast) {
    return workflowStepSummarizeNarrative(endpoint, roleLabel, nextEndpoint, clues, findings, linkageFindings, prerequisiteFindings, isLast);
}
function renderWorkflowStep(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel) {
    return workflowStepRender(endpointId, stepIndex, totalSteps, roleLabel, nextEndpointId, nextRoleLabel);
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
function bestEndpointIdForFamily(familyName) {
    return familyInsightBestEndpointIdForFamily(familyName);
}
function buildFamilyRankedSummary(family) {
    return familyInsightBuildRankedSummary(family);
}
function bumpFamilySignal(map, label) {
    map[label] = (map[label] || 0) + 1;
}
function familyRowsInView(familyName) {
    return familyInsightRowsInView(familyName);
}
function pickFamilyLeadRow(rows) {
    return familyInsightPickLeadRow(rows);
}
function collectCompactWorkflowContext(relatedChains, endpointId, endpointDetails) {
    return familyInsightCollectCompactWorkflowContext(relatedChains, endpointId, endpointDetails);
}
function familyInsightModel(familyName, preferredEndpointId) {
    return familyInsightBuildModel(familyName, preferredEndpointId);
}
function renderFamilyInsightPanel(family, preferredEndpointId) {
    return familyInsightRenderPanel(family, preferredEndpointId || '');
}
function buildFamilySurfaceContext(summaries) {
    return familySummaryBuildSurfaceContext(summaries);
}
function familySummariesRaw() {
    return familySummaryRawList();
}
function familySummaries() {
    return familySummaryList();
}
function buildListContext(matches, total) {
    return inspectionShellBuildListContext(matches, total);
}
function renderEndpointInspectionContent(detail, options) {
    return inspectionShellRenderEndpointInspectionContent(detail, options);
}
function syncSelectedEndpointHighlight() {
    inspectionShellSyncSelectedEndpointHighlight();
}
function endpointHasWorkflowBurden(detail) {
    return inspectionShellEndpointHasWorkflowBurden(detail);
}
function renderInspectorWorkflowContextSupport(detail, options) {
    return inspectionShellRenderInspectorWorkflowContextSupport(detail, options);
}
// ---------------------------------------------------------------------------
// SHAPE BURDEN: pain-signal analysis
// Maps real finding codes → developer pain, concrete examples, caller-needed
// ---------------------------------------------------------------------------
function collectShapePainSignals(endpoint, findings) {
    return diagnosticsCollectShapePainSignals(endpoint, findings || []);
}
function renderShapePainSignals(signals) {
    if (!signals || !signals.length)
        return '';
    function sentenceCount(text) {
        if (!text)
            return 0;
        var t = String(text).trim();
        if (!t)
            return 0;
        var parts = t.split(/[.!?]+/).map(function (p) { return p.trim(); }).filter(Boolean);
        return parts.length || 1;
    }
    function firstSentence(text) {
        if (!text)
            return '';
        var t = String(text).trim();
        if (!t)
            return '';
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
        }
        else {
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
        if (improved)
            material = true; // code fragment is always material
        if (!material && current && sentenceCount(current) > 1)
            material = true;
        if (!material && change && change.length > 90)
            material = true;
        if (!material && (String(current).length + String(burden).length + String(improved).length + String(change).length) > 260)
            material = true;
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
// Render normative grounding block from a group object (aggregated by specRuleId).
// Shows "N occurrences" instead of a specific location when the group has many messages.
function renderSpecRuleGroundingForGroup(group) {
    return openApiRenderSpecRuleGroundingForGroup(group, escapeHtml);
}
function severityWord(severity) {
    var s = (severity || '').toLowerCase();
    if (s === 'error')
        return 'Error';
    if (s === 'warning' || s === 'warn')
        return 'Warning';
    if (s === 'info')
        return 'Info';
    return 'Info';
}
function evidenceGroupTitleLine(group) {
    // Tooltip-friendly full title for a group. The on-screen header is rendered
    // as structured "kind + human title + metadata row" to avoid duplicate chips.
    if (!group)
        return 'Issue group';
    if (group.isSpecRule) {
        return group.title || group.specRuleId || 'Spec rule';
    }
    return group.title || group.preview || group.code || 'Issue';
}
function inspectTargetForGroup(group, endpoint) {
    return openApiInspectTargetForGroup(group, endpoint);
}
function renderIssueGroup(group, index, options) {
    return issueGroupRenderGroup(group, index, options, {
        escapeHtml: escapeHtml,
        severityBadge: severityBadge,
        renderSpecRuleGroundingForGroup: renderSpecRuleGroundingForGroup,
        inspectTargetForGroup: inspectTargetForGroup,
        issueScopeLabelForKey: issueScopeLabelForKey
    });
}
function groupFindings(findings) {
    return groupFindingsByContext(findings, {
        dimensionForFinding: issueDimensionForFinding,
        dimensionImpact: dimensionImpact,
        findingExamineHint: findingExamineHint,
        formatIssueGroupTitle: formatIssueGroupTitle,
        severityPriority: severityPriority,
        specRuleSummary: SPEC_RULE_SUMMARY
    });
}
function renderOpenAPIContextPills(context, compact) {
    return issueGroupRenderOpenAPIContextPills(context, compact, escapeHtml);
}
function renderOpenAPILocationCuesBlock(context, compact) {
    return issueGroupRenderOpenAPILocationCuesBlock(context, compact, escapeHtml);
}
function formatIssueGroupTitle(finding, context) {
    return issueGroupFormatTitle(finding, context, issueDimensionForFinding);
}
function formatIssueGroupCountLabel(group) {
    return issueGroupFormatCountLabel(group);
}
function topFieldPaths(groups) {
    return issueGroupTopFieldPaths(groups, uniq);
}
function topOpenAPIHighlights(groups) {
    return issueGroupTopOpenAPIHighlights(groups, uniq);
}
function scopedRows(rows) {
    return appRuntimeScopedRows(rows);
}
function rowsInScopeAll() {
    return appRuntimeRowsInScopeAll();
}
function filteredRows() {
    return appRuntimeFilteredRows();
}
function firstEvidenceEndpointId(rows) {
    return appRuntimeFirstEvidenceEndpointId(rows);
}
function firstVisibleEndpointId(rows) {
    return appRuntimeFirstVisibleEndpointId(rows);
}
function rowDominantIssue(row) {
    return appRuntimeRowDominantIssue(row);
}
function dominantSeverity(findings) {
    return uiDominantSeverity(findings);
}
function severityPriority(severity) {
    return uiSeverityPriority(severity);
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
    return '<span class="severity-badge severity-' + escapeHtml(severity) + ' is-interactive" role="button" tabindex="0" title="Open grouped deviations for this endpoint">'
        + '<span class="severity-icon">' + escapeHtml(severityIcon(severity)) + '</span>'
        + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
        + '</span>';
}
function severityBadgeEvidenceCTA(severity, endpointId) {
    if (!severity)
        return '';
    if (!endpointId)
        return severityBadge(severity);
    return '<button type="button" class="severity-badge severity-' + escapeHtml(severity) + ' is-interactive" data-open-evidence-id="' + escapeHtml(endpointId) + '" aria-label="Open grouped deviations" title="Open grouped deviations">'
        + '<span class="severity-icon" aria-hidden="true">' + escapeHtml(severityIcon(severity)) + '</span>'
        + '<span>' + escapeHtml(severity.toUpperCase()) + '</span>'
        + '</button>';
}
function severityIcon(severity) {
    return uiSeverityIcon(severity);
}
function pressureBadge(priority, kind) {
    return uiPressureBadge(priority, kind);
}
function endpointIntentCue(method, path) {
    return uiEndpointIntentCue(method, path);
}
function humanizeObjectName(value) {
    return uiHumanizeObjectName(value);
}
function singularize(value) {
    return uiSingularize(value);
}
function humanizeSignalLabel(signal) {
    return uiHumanizeSignalLabel(signal);
}
function renderRecoveryActions(actions) {
    return uiRenderRecoveryActions(actions);
}
function bindRecoveryButtons(container) {
    uiBindRecoveryButtons(container, applyRecoveryAction);
}
function applyRecoveryAction(action) {
    appRuntimeApplyRecoveryAction(action);
}
function pulseLensUpdate() {
    uiPulseLensUpdate();
}
function recoveryLabel(action) {
    return uiRecoveryLabel(action);
}
function issueDimensionForFinding(code, category, burdenFocus) {
    return uiIssueDimensionForFinding(code, category, burdenFocus);
}
function dimensionImpact(dimension) {
    return uiDimensionImpact(dimension);
}
function findingExamineHint(code, message) {
    return uiFindingExamineHint(code, message);
}
function buildContextTypeBadge(context) {
    return uiBuildContextTypeBadge(context);
}
function dimensionCleanerHint(dimension) {
    return appRuntimeDimensionCleanerHint(dimension);
}
function familyPressureLabel(priorityCounts) {
    return uiFamilyPressureLabel(priorityCounts);
}
function summarizeIssueDimensions(findings) {
    return uiSummarizeIssueDimensions(findings);
}
function topFamilyByFindings(rows) {
    return uiTopFamilyByFindings(rows);
}
function humanFamilyLabel(name) {
    return appRuntimeHumanFamilyLabel(name);
}
function renderChipList(items, emptyText) {
    return uiRenderChipList(items, emptyText);
}
function renderBulletList(items, emptyText) {
    return uiRenderBulletList(items, emptyText);
}
function renderOpenAPISummary(items) {
    return uiRenderOpenAPISummary(items);
}
function priorityRank(priority) {
    return uiPriorityRank(priority);
}
function uniq(items) {
    return uiUniq(items);
}
function flatMap(items, fn) {
    return uiFlatMap(items, fn);
}
function escapeHtml(value) {
    if (value === undefined || value === null)
        return '';
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
