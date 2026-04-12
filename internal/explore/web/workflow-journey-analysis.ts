interface WorkflowJourneyAnalysis {
  problems: string[];
  tokens: string[];
  context: string[];
  hiddenDeps: string[];
  learnedRules: string[];
  contractGaps: StringMap<boolean>;
}

interface WorkflowJourneyDependencyClues {
  prereq?: string[];
  establish?: string[];
  nextNeeds?: string[];
  hidden?: string[];
}

function workflowJourneyAnalyzePattern(
  kind: string,
  chains: ExplorerWorkflowChain[],
  endpointDetails: StringMap<ExplorerEndpointDetail>,
  parseRoles: (summary: string | undefined, stepCount: number) => string[],
  summarizeBurden: (chain: ExplorerWorkflowChain, roles: string[]) => WorkflowBurdenSummaryItem[],
  buildClues: (
    endpoint: ExplorerEndpointRow,
    findings: ExplorerFinding[],
    stepIndex: number,
    totalSteps: number,
    roleLabel: string,
    nextEndpoint: ExplorerEndpointRow | null,
    nextRoleLabel: string,
    linkageFindings: ExplorerFinding[],
    prerequisiteFindings: ExplorerFinding[]
  ) => WorkflowJourneyDependencyClues,
  humanizeRole: (value: string) => string
): WorkflowJourneyAnalysis {
  var allProblems: string[] = [];
  var allTokens: string[] = [];
  var allContext: string[] = [];
  var allHiddenDeps: string[] = [];
  var allLearnedRules: string[] = [];
  var contractGaps: StringMap<boolean> = {};

  (chains || []).forEach(function (chain: ExplorerWorkflowChain) {
    var steps = chain.endpointIds || [];
    var roles = parseRoles(chain.summary, steps.length);
    var summary = summarizeBurden(chain, roles);

    summary.forEach(function (burden: WorkflowBurdenSummaryItem) {
      if (allProblems.indexOf(burden.label) === -1) {
        allProblems.push(burden.label);
      }
    });

    steps.forEach(function (endpointId: string, idx: number) {
      var detail = endpointDetails[endpointId];
      if (!detail) return;
      var endpoint = detail.endpoint || createEmptyEndpointRow();
      var findings = detail.findings || [];
      var role = roles[idx] || "";
      var nextEndpointId = idx < (steps.length - 1) ? steps[idx + 1] : "";
      var nextDetail = nextEndpointId ? endpointDetails[nextEndpointId] : null;
      var nextEndpoint = nextDetail ? nextDetail.endpoint : null;
      var nextRole = roles[idx + 1] || "";

      var linkageFindings = findings.filter(function (finding: ExplorerFinding) {
        return finding.code === "weak-follow-up-linkage"
          || finding.code === "weak-action-follow-up-linkage"
          || finding.code === "weak-accepted-tracking-linkage"
          || finding.code === "weak-outcome-next-action-guidance";
      });
      var prerequisiteFindings = findings.filter(function (finding: ExplorerFinding) {
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
        (clues.hidden || []).forEach(function (hidden: string) {
          allHiddenDeps.push(hidden);
        });
      }
      if (prerequisiteFindings.length) {
        allHiddenDeps.push(humanizeRole(role) + " depends on prior state");
      }

      if ((endpoint.path || "").indexOf("{") > -1 && idx > 0) {
        allLearnedRules.push("Step " + (idx + 1) + " path requires resource ID from prior response");
      }
      if ((clues.prereq || []).some(function (prereq: string) { return /prior state|earlier|mutation/i.test(prereq); })) {
        allLearnedRules.push("Step " + (idx + 1) + " depends on mutations from earlier steps");
      }

      if (linkageFindings.length && !contractGaps.missing_next_action) {
        contractGaps.missing_next_action = true;
      }
      if (!(endpoint as StringMap<unknown>).description || String((endpoint as StringMap<unknown>).description || "").length < 20) {
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

function workflowJourneyRenderProblems(
  problems: string[],
  escape: (value: unknown) => string
): string {
  if (!problems || !problems.length) return "";
  return '<div class="journey-problems">'
    + '<p class="journey-section-kicker">Why developers get stuck in this workflow</p>'
    + '<ul class="journey-problem-list">'
    + problems.map(function (problem: string) {
      return "<li><strong>" + escape(problem) + "</strong></li>";
    }).join("")
    + "</ul>"
    + "</div>";
}

function workflowJourneyRenderContractGaps(
  gaps: StringMap<boolean>,
  escape: (value: unknown) => string
): string {
  if (!gaps || Object.keys(gaps).length === 0) return "";
  var items: string[] = [];
  if (gaps.missing_next_action) {
    items.push('<li><strong>Missing next action:</strong> Add <code>nextAction</code> (plus required IDs/links) to responses so the next step is explicit.</li>');
  }
  if (gaps.hidden_context) {
    items.push('<li><strong>Hidden context:</strong> Expose authoritative state and requiredContext fields needed for the next step.</li>');
  }
  if (gaps.weak_guidance) {
    items.push('<li><strong>Weak guidance:</strong> Add endpoint descriptions that state purpose, prerequisites, and continuation requirements.</li>');
  }
  if (!items.length) return "";
  return '<div class="journey-gaps">'
    + '<p class="journey-section-kicker">What the contract does not say clearly</p>'
    + '<ul class="journey-gap-list">'
    + items.join("")
    + "</ul>"
    + "</div>";
}

function workflowJourneyRenderProposal(
  kind: string,
  analysis: WorkflowJourneyAnalysis,
  escape: (value: unknown) => string
): string {
  var proposals: string[] = [];

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

  if (!proposals.length) return "";

  return '<div class="journey-proposal">'
    + '<p class="journey-section-kicker">What should change next</p>'
    + '<ul class="journey-proposal-list">'
    + proposals.slice(0, 4).map(function (proposal: string) {
      return "<li>" + escape(proposal) + "</li>";
    }).join("")
    + "</ul>"
    + "</div>";
}

function workflowJourneyRenderGuidance(
  kind: string,
  chains: ExplorerWorkflowChain[],
  analysis: WorkflowJourneyAnalysis,
  kindLabel: string,
  totalBurden: number,
  escape: (value: unknown) => string
): string {
  var chainCount = chains.length;
  var signalLabel = totalBurden === 1 ? "signal" : "signals";
  var chainLabel = chainCount === 1 ? "chain" : "chains";

  return '<details class="workflow-journey-card">'
    + '<summary class="workflow-journey-summary">'
    + '<span class="journey-label">' + escape(kindLabel) + "</span>"
    + '<span class="journey-meta">' + chainCount + " " + chainLabel + " · " + totalBurden + " workflow " + signalLabel + "</span>"
    + "</summary>"
    + '<div class="workflow-journey-body">'
    + workflowJourneyRenderProblems(analysis.problems, escape)
    + workflowJourneyRenderContractGaps(analysis.contractGaps, escape)
    + workflowJourneyRenderProposal(kind, analysis, escape)
    + "</div>"
    + "</details>";
}
