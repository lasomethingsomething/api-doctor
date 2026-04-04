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

func TestFullExactEvidenceAccordionShowsGroupsAndProvidesCloseAction(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "full-exact-evidence-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFullExactEvidenceDocument(t, fullExactEvidencePayload())), 0o600); err != nil {
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

	report := fullExactEvidenceReport(string(out))
	if !report.ready {
		t.Fatalf("full exact evidence regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected full exact evidence accordion to reveal groups + provide in-panel close action, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFullExactEvidenceDocument(t *testing.T, payload *Payload) string {
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
<div id="full-exact-evidence-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+fullExactEvidenceHarness(),
		1,
	)
	return doc
}

func fullExactEvidenceHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('full-exact-evidence-regression'); }

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

  function inspectorEndpointCode() {
    var code = document.querySelector('.inspector-endpoint-code');
    return code ? (code.textContent || '').trim() : '';
  }

  function summaryLabel() {
    var drawer = document.querySelectorAll('.detail-evidence-drawer')[0];
    if (!drawer) return '';
    var summary = drawer.querySelector(':scope > summary');
    return summary ? (summary.textContent || '').trim() : '';
  }

  function groupCountVisible() {
    var drawer = document.querySelectorAll('.detail-evidence-drawer')[0];
    if (!drawer || !drawer.open) return 0;
    return drawer.querySelectorAll('.issue-group').length;
  }

  function drawerOpen() {
    var drawer = document.querySelectorAll('.detail-evidence-drawer')[0];
    return !!(drawer && drawer.open);
  }

  function clickHideEvidence() {
    var drawer = document.querySelectorAll('.detail-evidence-drawer')[0];
    if (!drawer) return;
    var btn = drawer.querySelector('button[data-close-details]');
    if (btn) btn.click();
  }

  function run() {
    var failures = [];
    click('button.quick-action[data-id="spec-rule"]');

    window.setTimeout(function () {
      // Select endpoint in nested table.
      click('button.endpoints-expand[data-expand-endpoints="/tax-rule"]');

      window.setTimeout(function () {
        click('tr.nested-endpoint-row[data-endpoint-id="tax-rule-detail"] button.endpoint-inspect-action');

        window.setTimeout(function () {
          var before = inspectorEndpointCode();
          if (before.indexOf('GET /tax-rule/{id}') === -1) {
            failures.push({ kind: 'precondition-endpoint', expected_includes: 'GET /tax-rule/{id}', got: before });
          }

          var title = summaryLabel();
          if (title.toLowerCase().indexOf('exact contract evidence') === -1) {
            failures.push({ kind: 'summary-title', expected_includes: 'Exact contract evidence', got: title });
          }
          if (title.toLowerCase().indexOf('by schema field and issue type') === -1) {
            failures.push({ kind: 'summary-grouping-basis', expected_includes: 'by schema field and issue type', got: title });
          }

          // Open the accordion.
          click('.detail-evidence-drawer > summary');

          window.setTimeout(function () {
            var after = inspectorEndpointCode();
            if (after !== before) {
              failures.push({ kind: 'selection-changed', before: before, after: after });
            }
            if (!drawerOpen()) {
              failures.push({ kind: 'drawer-not-open' });
            }
            if (groupCountVisible() < 2) {
              failures.push({ kind: 'groups-not-visible', got: groupCountVisible() });
            }

            // Close using the explicit in-panel close action (Hide evidence).
            clickHideEvidence();

            window.setTimeout(function () {
              if (drawerOpen()) {
                failures.push({ kind: 'drawer-not-closed-via-hide-evidence' });
              }
              if (groupCountVisible() !== 0) {
                failures.push({ kind: 'groups-still-visible-after-close', got: groupCountVisible() });
              }
              finish(failures);
            }, 220);

          }, 260);
        }, 240);
      }, 240);
    }, 160);
  }

  function waitForUI() {
    if (!document.querySelector('button.endpoints-expand[data-expand-endpoints="/tax-rule"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    run();
  }

  waitForUI();
})();
</script>
`
}

type fullExactEvidenceRegressionReport struct {
	ready    bool
	failures int
	detail   string
}

func fullExactEvidenceReport(dom string) fullExactEvidenceRegressionReport {
	readyRe := regexp.MustCompile(`id="full-exact-evidence-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="full-exact-evidence-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="full-exact-evidence-regression"[^>]*>([^<]*)</div>`)

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

	return fullExactEvidenceRegressionReport{ready: ready, failures: failures, detail: detail}
}

func fullExactEvidencePayload() *Payload {
	now := "2026-04-04T00:00:00Z"
	endpoints := []EndpointRow{
		{
			ID:             "tax-rule-detail",
			Method:         "GET",
			Path:           "/tax-rule/{id}",
			Family:         "/tax-rule",
			Findings:       2,
			Priority:       "medium",
			SeverityCounts: map[string]int{"warning": 2},
			CategoryCounts: map[string]int{"spec-rule": 2},
		},
	}

	details := map[string]EndpointDetail{
		"tax-rule-detail": {
			Endpoint: endpoints[0],
			Findings: []FindingDetail{
				{
					Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:       "warning",
					Category:       "spec-rule",
					Message:        `Response Object is missing the required "description" field`,
					Impact:         "Clients cannot interpret errors from the contract alone.",
					EvidenceType:   "spec-rule",
					SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					NormativeLevel: "REQUIRED",
					SpecSource:     "OpenAPI 3.0",
					SpecLocation:   "responses.400.description",
				},
				{
					Code:           "OAS-OPERATION-ID-UNIQUE",
					Severity:       "warning",
					Category:       "spec-rule",
					Message:        `OperationId must be unique across the spec`,
					Impact:         "Clients cannot rely on stable generated method names.",
					EvidenceType:   "spec-rule",
					SpecRuleID:     "OAS-OPERATION-ID-UNIQUE",
					NormativeLevel: "REQUIRED",
					SpecSource:     "OpenAPI 3.0",
					SpecLocation:   "paths./tax-rule/{id}.get.operationId",
				},
			},
		},
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: 2, EndpointsAnalyzed: 1, EndpointsWithIssue: 1},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{FamilyCounts: map[string]int{"/tax-rule": 1}},
		GraphSeed:       GraphSeed{},
	}
}
