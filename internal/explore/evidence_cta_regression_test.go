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

func TestSeverityAndInstanceCountCTAsOpenExactEvidence(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "evidence-cta-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineEvidenceCTARegressionDocument(t, evidenceCTARegressionPayload())), 0o600); err != nil {
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

	report := evidenceCTARegressionReport(string(out))
	if !report.ready {
		t.Fatalf("evidence CTA regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected severity/count CTAs to open exact evidence, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineEvidenceCTARegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="evidence-cta-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+evidenceCTAHarness(),
		1,
	)
	return doc
}

func evidenceCTAHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('evidence-cta-regression'); }

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

  function activeSubtab() {
    var btn = document.querySelector('.endpoint-diag-tab.active');
    return btn ? (btn.getAttribute('data-endpoint-subtab') || '') : '';
  }

  function inspectorEndpointCode() {
    var code = document.querySelector('.inspector-endpoint-code');
    return code ? (code.textContent || '').trim() : '';
  }

  function hasOpenEvidenceDrawer() {
    var drawer = document.querySelector('.detail-evidence-drawer');
    return !!drawer && drawer.hasAttribute('open');
  }

  function run() {
    var failures = [];

    // Ensure we are on Contract Issues.
    click('button.quick-action[data-id="spec-rule"]');

    window.setTimeout(function () {
      // Expand family endpoints.
      click('button.endpoints-expand[data-expand-endpoints="/tax-rule"]');

      window.setTimeout(function () {
        // Click instance-count chip inside the nested endpoint table (must open exact evidence).
        click('tr.nested-endpoint-row[data-endpoint-id="tax-rule-detail"] button.instance-count-chip.is-interactive');

        window.setTimeout(function () {
          if (inspectorEndpointCode().indexOf('GET /tax-rule/{id}') === -1) {
            failures.push({ kind: 'inspector-endpoint', expected_includes: 'GET /tax-rule/{id}', got: inspectorEndpointCode() });
          }
          if (activeSubtab() !== 'exact') {
            failures.push({ kind: 'subtab-not-exact', got: activeSubtab() });
          }
          if (!hasOpenEvidenceDrawer()) {
            failures.push({ kind: 'evidence-drawer-not-open' });
          }

          // Now click the severity badge inside the nested endpoint table (also must open exact evidence).
          click('tr.nested-endpoint-row[data-endpoint-id="tax-rule-list"] button.severity-badge.is-interactive');

          window.setTimeout(function () {
            if (inspectorEndpointCode().indexOf('GET /tax-rule') === -1 || inspectorEndpointCode().indexOf('{id}') !== -1) {
              failures.push({ kind: 'inspector-endpoint-2', expected_includes: 'GET /tax-rule', got: inspectorEndpointCode() });
            }
            if (activeSubtab() !== 'exact') {
              failures.push({ kind: 'subtab-not-exact-2', got: activeSubtab() });
            }
            if (!hasOpenEvidenceDrawer()) {
              failures.push({ kind: 'evidence-drawer-not-open-2' });
            }

            finish(failures);
          }, 260);
        }, 260);
      }, 220);
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

type evidenceCTAReport struct {
	ready    bool
	failures int
	detail   string
}

func evidenceCTARegressionReport(dom string) evidenceCTAReport {
	readyRe := regexp.MustCompile(`id="evidence-cta-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="evidence-cta-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="evidence-cta-regression"[^>]*>([^<]*)</div>`)

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

	return evidenceCTAReport{ready: ready, failures: failures, detail: detail}
}

func evidenceCTARegressionPayload() *Payload {
	now := "2026-04-04T00:00:00Z"
	endpoints := []EndpointRow{
		{
			ID:             "tax-rule-list",
			Method:         "GET",
			Path:           "/tax-rule",
			Family:         "/tax-rule",
			Findings:       1,
			Priority:       "medium",
			SeverityCounts: map[string]int{"warning": 1},
			CategoryCounts: map[string]int{"spec-rule": 1},
			BurdenFocuses:  nil,
		},
		{
			ID:             "tax-rule-detail",
			Method:         "GET",
			Path:           "/tax-rule/{id}",
			Family:         "/tax-rule",
			Findings:       2,
			Priority:       "medium",
			SeverityCounts: map[string]int{"warning": 2},
			CategoryCounts: map[string]int{"spec-rule": 2},
			BurdenFocuses:  nil,
		},
	}

	// Provide endpointDetails for both endpoints so the evidence drawer has content.
	details := map[string]EndpointDetail{
		"tax-rule-list": {
			Endpoint: endpoints[0],
			Findings: []FindingDetail{
				{
					Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:       "warning",
					Category:       "spec-rule",
					BurdenFocus:    "",
					Message:        `Response Object is missing the required "description" field`,
					Impact:         "Clients cannot interpret errors from the contract alone.",
					EvidenceType:   "spec-rule",
					SpecRuleID:     "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					NormativeLevel: "REQUIRED",
					SpecSource:     "OpenAPI 3.0",
					SpecLocation:   "responses.400.description",
				},
			},
		},
		"tax-rule-detail": {
			Endpoint: endpoints[1],
			Findings: []FindingDetail{
				{
					Code:           "OAS-RESPONSE-DESCRIPTION-REQUIRED",
					Severity:       "warning",
					Category:       "spec-rule",
					BurdenFocus:    "",
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
					BurdenFocus:    "",
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
		Summary:         Summary{TotalFindings: 3, EndpointsAnalyzed: 2, WorkflowsInferred: 0, ChainsInferred: 0, EndpointsWithIssue: 2},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{FamilyCounts: map[string]int{"/tax-rule": 2}},
		GraphSeed:       GraphSeed{},
	}
}
