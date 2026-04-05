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

func TestCountedDeviationsAppearAtTopOfExactEvidence(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "counted-deviations-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineCountedDeviationsDocument(t, countedDeviationsPayload())), 0o600); err != nil {
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
		"--window-size=1680,2400",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := countedDeviationsReport(string(out))
	if !report.ready {
		t.Fatalf("counted deviations regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected counted deviations list to appear above groups, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineCountedDeviationsDocument(t *testing.T, payload *Payload) string {
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
<div id="counted-deviations-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+countedDeviationsHarness(),
		1,
	)
	return doc
}

func countedDeviationsHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('counted-deviations-regression'); }

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

  function drawer() {
    return document.querySelectorAll('.detail-evidence-drawer')[0] || null;
  }

  function drawerOpen() {
    var d = drawer();
    return !!(d && d.open);
  }

  function countedItems() {
    var d = drawer();
    if (!d || !d.open) return [];
    return Array.prototype.map.call(d.querySelectorAll('.counted-occurrences-list li'), function (li) {
      return (li.textContent || '').trim();
    });
  }

  function countedBeforeGroups() {
    var d = drawer();
    if (!d || !d.open) return false;
    var list = d.querySelector('.counted-occurrences-summary');
    var group = d.querySelector('.issue-group');
    if (!list || !group) return false;
    return !!(list.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function firstGroupTitleLine() {
    var d = drawer();
    if (!d || !d.open) return '';
    var n = d.querySelector('.issue-group .issue-group-titleline');
    return n ? (n.textContent || '').trim() : '';
  }

  function responsesMeta() {
    var d = drawer();
    if (!d || !d.open) return '';
    var n = d.querySelector('.issue-group .issue-meta-chip[data-meta="responses"]');
    return n ? (n.textContent || '').trim() : '';
  }

	  function run() {
	    var failures = [];

    click('button.quick-action[data-id="spec-rule"]');

    window.setTimeout(function () {
      click('button.endpoints-expand[data-expand-endpoints="/aggregate"]');

	      window.setTimeout(function () {
	        // Click the occurrences-count chip inside the nested endpoint table.
	        var chip = document.querySelector('tr.nested-endpoint-row[data-endpoint-id="aggregate-webhook-event-log"] button.instance-count-chip.is-interactive');
	        if (!chip) {
	          failures.push({ kind: 'missing-count-chip' });
	          return finish(failures);
	        }
	        var chipText = (chip.textContent || '').toLowerCase();
	        if (chipText.indexOf('deviation') === -1) {
	          failures.push({ kind: 'count-chip-not-deviation', got: (chip.textContent || '').trim() });
	        }
	        if (chipText.indexOf('instance') !== -1) {
	          failures.push({ kind: 'count-chip-still-says-instances', got: (chip.textContent || '').trim() });
	        }
	        chip.click();

        window.setTimeout(function () {
          if (!drawerOpen()) {
            failures.push({ kind: 'drawer-not-open-after-count-click' });
          }

          var items = countedItems();
          if (items.join(' | ').toLowerCase().indexOf('400 missing description') === -1) {
            failures.push({ kind: 'missing-400', expected_includes: '400 missing description', got: items });
          }
          if (items.join(' | ').toLowerCase().indexOf('401 missing description') === -1) {
            failures.push({ kind: 'missing-401', expected_includes: '401 missing description', got: items });
          }
          if (!countedBeforeGroups()) {
            failures.push({ kind: 'counted-list-not-before-groups' });
          }

          var responses = responsesMeta().toLowerCase();
          if (responses.indexOf('400/401') === -1 && (responses.indexOf('400') === -1 || responses.indexOf('401') === -1)) {
            failures.push({ kind: 'group-meta-omits-401', got: responsesMeta(), title: firstGroupTitleLine() });
          }

          finish(failures);
        }, 420);
      }, 260);
    }, 180);
  }

  function waitForUI() {
    if (!document.querySelector('button.endpoints-expand[data-expand-endpoints="/aggregate"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    run();
  }

  waitForUI();
})();
</script>
`
}

type countedDeviationsRegressionReport struct {
	ready    bool
	failures int
	detail   string
}

func countedDeviationsReport(dom string) countedDeviationsRegressionReport {
	readyRe := regexp.MustCompile(`id="counted-deviations-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="counted-deviations-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="counted-deviations-regression"[^>]*>([^<]*)</div>`)

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

	return countedDeviationsRegressionReport{ready: ready, failures: failures, detail: detail}
}

func countedDeviationsPayload() *Payload {
	now := "2026-04-04T00:00:00Z"
	endpoints := []EndpointRow{
		{
			ID:             "aggregate-webhook-event-log",
			Method:         "GET",
			Path:           "/aggregate/webhook-event-log",
			Family:         "/aggregate",
			Findings:       2,
			Priority:       "medium",
			SeverityCounts: map[string]int{"warning": 2},
			CategoryCounts: map[string]int{"spec-rule": 2},
		},
	}

	details := map[string]EndpointDetail{
		"aggregate-webhook-event-log": {
			Endpoint: endpoints[0],
			Findings: []FindingDetail{
				{
					Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:       "warning",
					Category:       "spec-rule",
					Message:        `Response 400 is missing a description`,
					Impact:         "Clients cannot interpret errors from the contract alone.",
					EvidenceType:   "spec-rule",
					SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					NormativeLevel: "REQUIRED",
					SpecSource:     "OpenAPI 3.0",
					SpecLocation:   "responses.400.description",
				},
				{
					Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:       "warning",
					Category:       "spec-rule",
					Message:        `Response 401 is missing a description`,
					Impact:         "Clients cannot interpret errors from the contract alone.",
					EvidenceType:   "spec-rule",
					SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					NormativeLevel: "REQUIRED",
					SpecSource:     "OpenAPI 3.0",
					SpecLocation:   "responses.401.description",
				},
			},
		},
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: 2, EndpointsAnalyzed: 1, EndpointsWithIssue: 1},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{FamilyCounts: map[string]int{"/aggregate": 1}},
		GraphSeed:       GraphSeed{},
	}
}
