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

func TestDxChipDoesNotShowPlusOneSuffixWhenCountAddsNoValue(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "dx-chip-suffix-threshold-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineDxChipSuffixRegressionDocument(t, dxChipSuffixPayload())), 0o600); err != nil {
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

	report := dxChipSuffixReport(string(out))
	if !report.ready {
		t.Fatalf("dx-chip suffix regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected dx chips to avoid noisy (+1) suffixes, got %d failures\n%s", report.failures, report.detail)
	}
}

func dxChipSuffixPayload() *Payload {
	now := "2026-04-04T00:00:00Z"

	// Create 4 families with identical workflow signals so the dx-consequence chip
	// renders (repeat threshold) and previously would show "(+1)".
	families := []string{"/dx-suffix-1", "/dx-suffix-2", "/dx-suffix-3", "/dx-suffix-4"}

	endpoints := make([]EndpointRow, 0, len(families))
	details := make(map[string]EndpointDetail, len(families))
	for i, fam := range families {
		id := "dx-" + strconv.Itoa(i+1)
		row := EndpointRow{
			ID:             id,
			Method:         "GET",
			Path:           "/dx-suffix/" + id,
			Family:         fam,
			Findings:       2,
			Priority:       "high",
			SeverityCounts: map[string]int{"info": 2},
			CategoryCounts: map[string]int{"workflow-burden": 2},
			BurdenFocuses:  []string{"workflow-burden"},
		}
		endpoints = append(endpoints, row)

		findings := []FindingDetail{
			{
				Code:        "weak-follow-up-linkage",
				Severity:    "info",
				Category:    "workflow-burden",
				BurdenFocus: "workflow-burden",
				Message:     "Follow-up is unclear; next step not clearly exposed.",
				Impact:      "Clients cannot find the next action.",
			},
			{
				Code:        "weak-outcome-next-action-guidance",
				Severity:    "info",
				Category:    "workflow-burden",
				BurdenFocus: "workflow-burden",
				Message:     "Outcome meaning is unclear; next action is weakly exposed.",
				Impact:      "Clients stall after success.",
			},
		}
		details[id] = EndpointDetail{Endpoint: row, Findings: findings}
	}

	return &Payload{
		Run:             RunContext{SpecPath: "spec.json", GeneratedAt: now},
		Summary:         Summary{TotalFindings: len(endpoints) * 2, EndpointsAnalyzed: len(endpoints), EndpointsWithIssue: len(endpoints)},
		Endpoints:       endpoints,
		EndpointDetails: details,
		Workflows:       WorkflowSection{},
		GraphSeed:       GraphSeed{},
	}
}

func inlineDxChipSuffixRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="dx-chip-suffix-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+dxChipSuffixHarness(),
		1,
	)
	return doc
}

func dxChipSuffixHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('dx-chip-suffix-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', hasTable: !!document.querySelector('.family-table') }]);
  }, 5000);

  function finish(failures) {
    if (finished) return;
    finished = true;
    if (watchdog) window.clearTimeout(watchdog);
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

  function assertNoPlusOneSuffix(step, failures) {
    var chips = document.querySelectorAll('.family-table .family-dx-chip');
    if (!chips || chips.length < 1) {
      failures.push({ kind: 'missing-dx-chips', step: step, count: (chips ? chips.length : 0) });
      return;
    }
    for (var i = 0; i < chips.length; i++) {
      var text = (chips[i].textContent || '').trim();
      if (text.indexOf('(+1)') !== -1) {
        failures.push({ kind: 'found-plus-one', step: step, text: text });
        return;
      }
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="workflow"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    click('button.quick-action[data-id="workflow"]');
    (function waitForTable() {
      if (!document.querySelector('.family-table')) {
        return window.setTimeout(waitForTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertNoPlusOneSuffix('workflow-family-dx', failures);
        finish(failures);
      }, 200);
    })();
  }

  waitForUI();
})();
</script>
`
}

type dxChipSuffix struct {
	ready    bool
	failures int
	detail   string
}

func dxChipSuffixReport(dom string) dxChipSuffix {
	readyRe := regexp.MustCompile(`id="dx-chip-suffix-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="dx-chip-suffix-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="dx-chip-suffix-regression"[^>]*>([^<]*)</div>`)

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
		detail = m[1]
	}

	return dxChipSuffix{ready: ready, failures: failures, detail: detail}
}

