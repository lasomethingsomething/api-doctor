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

func TestWorkflowChainLinkCardHasClearActionAndHelperText(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "workflow-chain-link-card-regression.html")
	userDataDir := filepath.Join(outDir, "chrome-profile")
	if err := os.WriteFile(htmlPath, []byte(inlineWorkflowChainLinkCardDocument(t, resetFiltersRegressionPayload())), 0o600); err != nil {
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
		"--no-first-run",
		"--no-default-browser-check",
		"--user-data-dir="+userDataDir,
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

	report := workflowChainLinkCardReport(string(out))
	if !report.ready {
		t.Fatalf("workflow chain link card regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected workflow chain action to be explicit + explanatory, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineWorkflowChainLinkCardDocument(t *testing.T, payload *Payload) string {
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
<div id="workflow-chain-link-card-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+workflowChainLinkCardHarness(),
		1,
	)
	return doc
}

func workflowChainLinkCardHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('workflow-chain-link-card-regression'); }

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

  function buttonText() {
    var btn = document.querySelector('button[data-open-workflow-chain]');
    return btn ? (btn.textContent || '').trim() : '';
  }

  function buttonHasProminentClass() {
    var btn = document.querySelector('button[data-open-workflow-chain]');
    return !!(btn && btn.classList && btn.classList.contains('workflow-chain-link-action'));
  }

  function helperText() {
    var p = document.querySelector('.workflow-chain-link-helper');
    return p ? (p.textContent || '').trim() : '';
  }

  function activeTopTabLabel() {
    var active = document.querySelector('.quick-action.active .quick-label');
    return active ? (active.textContent || '').trim() : '';
  }

  function workflowDrawerOpen() {
    var drawer = document.querySelector('[data-workflow-chains-drawer]');
    return !!(drawer && drawer.open);
  }

  function workflowStepHighlighted(endpointId) {
    var elem = document.querySelector('[data-step-id="' + endpointId + '"] .step-box');
    return !!(elem && elem.classList && elem.classList.contains('step-active'));
  }

  function run() {
    var failures = [];

    // Contract Issues tab, expand family, select endpoint (inspector opens inline).
    click('button.quick-action[data-id="spec-rule"]');

    window.setTimeout(function () {
      click('button.endpoints-expand[data-expand-endpoints="/tax-provider"]');

      window.setTimeout(function () {
        click('tr.nested-endpoint-row[data-endpoint-id="ep-1"] button.nested-endpoint-path-toggle');

        window.setTimeout(function () {
          var text = buttonText();
          if (text.toLowerCase().indexOf('open this chain in workflow guidance tab') === -1) {
            failures.push({ kind: 'button-label', expected_includes: 'Open this chain in Workflow Guidance tab', got: text });
          }
          if (!buttonHasProminentClass()) {
            failures.push({ kind: 'missing-prominent-class' });
          }
          var helper = helperText();
          if (helper.toLowerCase().indexOf('switches tabs and opens this endpoint') === -1) {
            failures.push({ kind: 'helper-text', expected_includes: 'Switches tabs and opens this endpoint', got: helper });
          }

          // Click CTA and ensure Workflow Guidance opens with the relevant chain visible + selected.
          click('button[data-open-workflow-chain]');

          window.setTimeout(function () {
            var tab = activeTopTabLabel();
            if (tab.toLowerCase().indexOf('workflow guidance') === -1) {
              failures.push({ kind: 'did-not-switch-tab', expected_includes: 'Workflow Guidance', got: tab });
            }
            if (!workflowDrawerOpen()) {
              failures.push({ kind: 'workflow-drawer-not-open' });
            }
            if (!workflowStepHighlighted('ep-1')) {
              failures.push({ kind: 'workflow-step-not-highlighted', endpoint: 'ep-1' });
            }
            finish(failures);
          }, 520);
        }, 380);
      }, 260);
    }, 200);
  }

  function waitForUI() {
    if (!document.querySelector('button.endpoints-expand[data-expand-endpoints="/tax-provider"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    run();
  }

  waitForUI();
})();
</script>
`
}

type workflowChainLinkCardRegressionReport struct {
	ready    bool
	failures int
	detail   string
}

func workflowChainLinkCardReport(dom string) workflowChainLinkCardRegressionReport {
	readyRe := regexp.MustCompile(`id="workflow-chain-link-card-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="workflow-chain-link-card-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="workflow-chain-link-card-regression"[^>]*>([^<]*)</div>`)

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

	return workflowChainLinkCardRegressionReport{ready: ready, failures: failures, detail: detail}
}
