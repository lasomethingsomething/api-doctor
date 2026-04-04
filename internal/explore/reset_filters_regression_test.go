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

func TestResetFiltersDoesNotChangeActiveTopTab(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "reset-filters-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResetRegressionDocument(t, resetFiltersRegressionPayload())), 0o600); err != nil {
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
		"--virtual-time-budget=8000",
		"--window-size=1680,2200",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := resetFiltersRegressionReport(string(out))
	if !report.ready {
		t.Fatalf("reset regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected reset filters to preserve active tab for all top tabs, got %d failures\n%s", report.failures, report.detail)
	}
}

func findChromeForResetRegression() string {
	candidates := []string{
		os.Getenv("API_DOCTOR_CHROME_BIN"),
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return ""
}

func inlineResetRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="reset-filters-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+resetFiltersHarness(),
		1,
	)
	return doc
}

func resetFiltersHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('reset-filters-regression'); }

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

  function setInput(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setSelect(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setCheckbox(id, checked) {
    var el = document.getElementById(id);
    if (!el) return;
    el.checked = !!checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function activeTopTabId() {
    var btn = document.querySelector('.quick-action.active');
    return btn ? (btn.getAttribute('data-id') || '') : '';
  }

  function runOne(tab) {
    return new Promise(function (resolve) {
      click('button.quick-action[data-id="' + tab.id + '"]');
      window.setTimeout(function () {
        // Make the controls "dirty" so reset has something to undo.
        setInput('searchInput', '/non-default');
        setSelect('categoryFilter', 'spec-rule');
        setSelect('burdenFilter', 'all');
        setSelect('familyPriorityFilter', 'high');
        setCheckbox('includeNoIssueRows', true);

        click('button.reset-btn');

        window.setTimeout(function () {
          var failures = [];
          var gotTab = activeTopTabId();
          if (gotTab !== tab.id) {
            failures.push({ kind: 'tab-jump', expected: tab.id, got: gotTab });
          }
          var search = (document.getElementById('searchInput') || {}).value || '';
          var category = (document.getElementById('categoryFilter') || {}).value || '';
          var burden = (document.getElementById('burdenFilter') || {}).value || '';
          var pressure = (document.getElementById('familyPriorityFilter') || {}).value || '';
          var includeNoIssue = !!((document.getElementById('includeNoIssueRows') || {}).checked);

          if (search !== '') failures.push({ kind: 'search-not-reset', tab: tab.id, got: search });
          if (category !== tab.category) failures.push({ kind: 'category-not-reset', tab: tab.id, expected: tab.category, got: category });
          if (burden !== tab.burden) failures.push({ kind: 'burden-not-reset', tab: tab.id, expected: tab.burden, got: burden });
          if (pressure !== 'all') failures.push({ kind: 'pressure-not-reset', tab: tab.id, got: pressure });
          if (includeNoIssue) failures.push({ kind: 'include-no-issue-not-reset', tab: tab.id });

          resolve(failures);
        }, 80);
      }, 80);
    });
  }

  function waitForUI() {
    if (!document.querySelector('button.reset-btn') || !document.querySelector('button.quick-action[data-id="spec-rule"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var tabs = [
      { id: 'spec-rule', category: 'spec-rule', burden: 'all' },
      { id: 'workflow', category: 'all', burden: 'workflow-burden' },
      { id: 'shape', category: 'all', burden: 'contract-shape' }
    ];

    var failures = [];
    runOne(tabs[0])
      .then(function (f) { failures = failures.concat(f); return runOne(tabs[1]); })
      .then(function (f) { failures = failures.concat(f); return runOne(tabs[2]); })
      .then(function (f) { failures = failures.concat(f); finish(failures); });
  }

  waitForUI();
})();
</script>
`
}

type resetReport struct {
	ready    bool
	failures int
	detail   string
}

func resetFiltersRegressionReport(dom string) resetReport {
	readyRe := regexp.MustCompile(`id="reset-filters-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="reset-filters-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="reset-filters-regression"[^>]*>([^<]*)</div>`)

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

	return resetReport{ready: ready, failures: failures, detail: detail}
}

func resetFiltersRegressionPayload() *Payload {
	now := "2026-04-04T00:00:00Z"
	endpoints := []EndpointRow{
		{
			ID:     "ep-1",
			Method: "GET",
			Path:   "/tax-provider",
			Family: "/tax-provider",
			Findings: 2,
			Priority: "high",
			SeverityCounts: map[string]int{"warning": 2},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
		{
			ID:     "ep-2",
			Method: "POST",
			Path:   "/tax-provider/_action/compute",
			Family: "/tax-provider",
			Findings: 1,
			Priority: "medium",
			SeverityCounts: map[string]int{"info": 1},
			CategoryCounts: map[string]int{"spec-rule": 1, "workflow-burden": 1, "contract-shape": 1},
			BurdenFocuses:  []string{"workflow-burden", "contract-shape"},
		},
	}

	details := map[string]EndpointDetail{
		"ep-1": {
			Endpoint: endpoints[0],
			Findings: []FindingDetail{
				{
					Code:        "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:    "warning",
					Category:    "spec-rule",
					BurdenFocus: "",
					Message:     `Response Object is missing the required "description" field`,
					Impact:      "Clients cannot reliably interpret error conditions from the contract alone.",
					EvidenceType: "spec-rule",
					SpecRuleID:   "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					NormativeLevel: "REQUIRED",
					SpecSource:   "OpenAPI 3.0",
					SpecLocation: "responses.400.description",
				},
				{
					Code:        "weak-outcome-next-action-guidance",
					Severity:    "info",
					Category:    "workflow-burden",
					BurdenFocus: "workflow-burden",
					Message:     "Outcome is not clearly exposed; caller cannot infer the next valid action from the response.",
					Impact:      "Clients stall after success and must read docs to continue the workflow safely.",
				},
			},
			RelatedChains: []ChainEntry{
				{
					ID:          "chain-1",
					Kind:        "list-detail",
					EndpointIDs:  []string{"ep-1", "ep-2"},
					Summary:      "list: list -> action: act",
					Reason:       "Inferred chain for regression harness",
				},
			},
		},
		"ep-2": {
			Endpoint: endpoints[1],
			Findings: []FindingDetail{
				{
					Code:        "contract-shape-workflow-guidance-burden",
					Severity:    "info",
					Category:    "contract-shape",
					BurdenFocus: "contract-shape",
					Message:     "Response is snapshot-heavy; task outcome and next action are hard to locate.",
					Impact:      "Clients do extra parsing and still miss the main result and next step.",
				},
			},
		},
	}

	return &Payload{
		Run:     RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary: Summary{TotalFindings: 3, EndpointsAnalyzed: 2, WorkflowsInferred: 1, ChainsInferred: 1, EndpointsWithIssue: 2},
		FixFirst:        nil,
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows: WorkflowSection{
			FamilyCounts: map[string]int{"/tax-provider": 2},
			Entries:      nil,
			Chains:       details["ep-1"].RelatedChains,
		},
		GraphSeed: GraphSeed{},
	}
}

