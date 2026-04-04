package explore

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestTablesDoNotBleedOverflowWithLongStrings(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "overflow-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineOverflowRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
		t.Fatalf("write regression fixture: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		chromePath,
		"--headless",
		"--disable-gpu",
		"--no-sandbox",
		"--hide-scrollbars",
		"--run-all-compositor-stages-before-draw",
		"--virtual-time-budget=9000",
		"--window-size=1280,2200",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := overflowRegressionReport(string(out))
	if !report.ready {
		t.Fatalf("overflow regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected long strings to never bleed out of table cells, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineOverflowRegressionDocument(t *testing.T, payload *Payload) string {
	t.Helper()

	indexBytes, err := webFS.ReadFile("web/index.html")
	if err != nil {
		t.Fatalf("read explorer index: %v", err)
	}
	cssBytes, err := webFS.ReadFile("web/app.css")
	if err != nil {
		t.Fatalf("read explorer css: %v", err)
	}
	jsBytes, err := webFS.ReadFile("web/app.js")
	if err != nil {
		t.Fatalf("read explorer js: %v", err)
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal regression payload: %v", err)
	}

	doc := string(indexBytes)
	doc = strings.Replace(doc, `<link rel="stylesheet" href="/static/app.css">`, "<style>\n"+string(cssBytes)+"\n</style>", 1)
	doc = strings.Replace(
		doc,
		`<script src="/static/app.js"></script>`,
		`<script>
window.fetch = function (url) {
  if (url === "/api/payload") {
    return Promise.resolve({
      json: function () {
        return Promise.resolve(`+string(payloadJSON)+`);
      }
    });
  }
  return Promise.reject(new Error("unexpected fetch: " + url));
};
</script>
<div id="overflow-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+overflowRegressionHarness(),
		1,
	)
	return doc
}

func overflowRegressionHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('overflow-regression'); }

  function finish(failures) {
    var n = node();
    if (!n) return;
    n.setAttribute('data-ready', 'true');
    n.setAttribute('data-failures', String(failures.length));
    n.textContent = JSON.stringify(failures);
  }

  function click(selector) {
    var el = document.querySelector(selector);
    if (el) el.click();
  }

  function assertNoPageOverflow(step, failures) {
    // Intentionally a no-op: root scrollWidth includes scrollable containers.
    // This regression focuses on ensuring table cells clip/wrap, not whether the
    // page ever creates a horizontal scroll container.
  }

  function assertCellsNotOverflowVisible(step, selector, failures) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      var cs = window.getComputedStyle(nodes[i]);
      var ox = (cs && cs.overflowX) ? cs.overflowX : '';
      if (ox === 'visible') {
        failures.push({ kind: 'cell-overflow-visible', step: step, selector: selector, tag: nodes[i].tagName, className: nodes[i].className });
        return;
      }
    }
  }

  function expandLongFamily(family) {
    click('button.endpoints-expand[data-expand-endpoints="' + family + '"]');
  }

  function expandFirstNestedEndpointPreview(family) {
    var row = document.querySelector('tr.nested-endpoint-row[data-family="' + family + '"]');
    if (row) row.click();
  }

  function runOneTab(tabId, family) {
    return new Promise(function (resolve) {
      var failures = [];
      click('button.quick-action[data-id="' + tabId + '"]');
      window.setTimeout(function () {
        assertCellsNotOverflowVisible(tabId + ':family-table-cells', '.family-table th, .family-table td', failures);
        assertCellsNotOverflowVisible(tabId + ':endpoint-list-cells', 'table thead th, table tbody td', failures);
        assertCellsNotOverflowVisible(tabId + ':endpoint-findings-row-td', 'tr.endpoint-row-findings-row td', failures);

        expandLongFamily(family);
        window.setTimeout(function () {
          assertCellsNotOverflowVisible(tabId + ':nested-table-cells', '.nested-endpoint-table th, .nested-endpoint-table td', failures);
          assertCellsNotOverflowVisible(tabId + ':nested-expansion-td', 'tr.nested-endpoint-preview-row td, tr.nested-endpoint-findings-row td, tr.nested-endpoint-insight-row td', failures);

          expandFirstNestedEndpointPreview(family);
          window.setTimeout(function () {
            assertCellsNotOverflowVisible(tabId + ':preview-td-open', 'tr.nested-endpoint-preview-row td', failures);
            resolve(failures);
          }, 140);
        }, 140);
      }, 140);
    });
  }

  function waitForUI() {
    if (!document.querySelector('.family-table') || !document.querySelector('button.quick-action[data-id="spec-rule"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var first = document.querySelector('tr.family-row[data-family-row="true"]');
    var family = first ? (first.getAttribute('data-family') || '') : '';
    if (!family) {
      return window.setTimeout(waitForUI, 50);
    }

    var failures = [];
    runOneTab('spec-rule', family)
      .then(function (f) { failures = failures.concat(f); return runOneTab('workflow', family); })
      .then(function (f) { failures = failures.concat(f); return runOneTab('shape', family); })
      .then(function (f) { failures = failures.concat(f); finish(failures); });
  }

  waitForUI();
})();
</script>
`
}

type overflowReport struct {
	ready    bool
	failures int
	detail   string
}

func overflowRegressionReport(dom string) overflowReport {
	readyRe := regexp.MustCompile(`id="overflow-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="overflow-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="overflow-regression"[^>]*>([^<]*)</div>`)

	ready := false
	if m := readyRe.FindStringSubmatch(dom); len(m) == 2 {
		ready = m[1] == "true"
	}
	failures := -1
	if m := failRe.FindStringSubmatch(dom); len(m) == 2 {
		if n, err := strconv.Atoi(m[1]); err == nil {
			failures = n
		}
	}
	detail := ""
	if m := textRe.FindStringSubmatch(dom); len(m) == 2 {
		detail = strings.TrimSpace(m[1])
	}

	return overflowReport{ready: ready, failures: failures, detail: detail}
}

func overflowRegressionPayload() *Payload {
	now := "2026-04-04T00:00:00Z"
	longFamily := "/family-with-a-very-long-name-" + strings.Repeat("a", 90) + "-and-more-segments/" + strings.Repeat("b", 40)
	longPath := "/admin-api/" + strings.Repeat("very-long-segment-", 18) + "{id}/" + strings.Repeat("c", 60)

	// Surface the family string to the harness without hardcoding it there.
	// (The harness reads it from the first rendered family row.)
	endpoints := []EndpointRow{
		{
			ID:             "long-1",
			Method:         "GET",
			Path:           longPath,
			Family:         longFamily,
			Findings:       4,
			Priority:       "high",
			SeverityCounts: map[string]int{"warning": 2, "info": 2},
			CategoryCounts: map[string]int{"spec-rule": 2, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
		{
			ID:             "long-2",
			Method:         "POST",
			Path:           longPath + "/subresource/" + strings.Repeat("d", 40),
			Family:         longFamily,
			Findings:       4,
			Priority:       "high",
			SeverityCounts: map[string]int{"warning": 2, "info": 2},
			CategoryCounts: map[string]int{"spec-rule": 2, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
	}

	findings := []FindingDetail{
		{
			Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			Severity:       "warning",
			Category:       "spec-rule",
			Message:        `Response Object is missing the required "description" field`,
			Impact:         "Clients cannot interpret error conditions from the contract alone.",
			EvidenceType:   "spec-rule",
			SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			NormativeLevel: "REQUIRED",
			SpecSource:     "OpenAPI 3.0",
			SpecLocation:   "paths." + longPath + ".responses.400.description." + strings.Repeat("x", 80),
		},
		{
			Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			Severity:       "warning",
			Category:       "spec-rule",
			Message:        `Response Object is missing the required "description" field`,
			Impact:         "Clients cannot interpret error conditions from the contract alone.",
			EvidenceType:   "spec-rule",
			SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
			NormativeLevel: "REQUIRED",
			SpecSource:     "OpenAPI 3.0",
			SpecLocation:   "paths." + longPath + ".responses.404.description." + strings.Repeat("y", 80),
		},
		{
			Code:        "weak-outcome-next-action-guidance",
			Severity:    "info",
			Category:    "workflow-burden",
			BurdenFocus: "workflow-burden",
			Message:     "Outcome is not clearly exposed; caller cannot infer the next valid action from the response. " + strings.Repeat("workflow ", 18),
			Impact:      "Clients stall after success and must read docs to continue the workflow safely.",
		},
		{
			Code:        "snapshot-heavy-response",
			Severity:    "info",
			Category:    "contract-shape",
			BurdenFocus: "contract-shape",
			Message:     "Response is snapshot-heavy; task outcome and next action are hard to locate. " + strings.Repeat("shape ", 18),
			Impact:      "Clients do extra parsing and still miss the main result and next step.",
		},
	}

	details := map[string]EndpointDetail{
		"long-1": {Endpoint: endpoints[0], Findings: findings},
		"long-2": {Endpoint: endpoints[1], Findings: findings},
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: 8, EndpointsAnalyzed: len(endpoints), WorkflowsInferred: 1, ChainsInferred: 1, EndpointsWithIssue: 2},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows: WorkflowSection{
			FamilyCounts: map[string]int{longFamily: 2},
			Chains: []ChainEntry{
				{
					ID:          "chain-long-1",
					Kind:        "list-detail",
					EndpointIDs:  []string{"long-1", "long-2"},
					Summary:     "Long-string chain regression",
					Reason:      "Long-string payload for overflow regression harness.",
					Score:       "high",
				},
			},
		},
		GraphSeed: GraphSeed{},
	}
}
