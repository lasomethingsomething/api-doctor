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

func TestWorkflowGuidanceShowsStepByStepChainSurfaceAndScopesFamilyRows(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "workflow-chain-surface-regression.html")
	userDataDir := filepath.Join(outDir, "chrome-profile")
	if err := os.WriteFile(htmlPath, []byte(inlineWorkflowChainSurfaceDocument(t, resetFiltersRegressionPayload())), 0o600); err != nil {
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

	report := workflowChainSurfaceReport(string(out))
	if !report.ready {
		t.Fatalf("workflow chain surface regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Workflow Guidance to foreground step-by-step chains and scope family rows on step click, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineWorkflowChainSurfaceDocument(t *testing.T, payload *Payload) string {
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
<div id="workflow-chain-surface-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+workflowChainSurfaceHarness(),
		1,
	)
	return doc
}

func workflowChainSurfaceHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('workflow-chain-surface-regression'); }

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

  function text(el) {
    return el ? ((el.textContent || '').replace(/\s+/g, ' ').trim()) : '';
  }

  function assertChainSurfaceLead(failures) {
    var primary = document.querySelector('.workflow-chains-drawer-body .workflow-chain-surface-primary');
    var guide = document.querySelector('.workflow-chains-drawer-body .workflow-guide-section');
    if (!primary) {
      failures.push({ kind: 'missing-primary-chain-surface' });
      return;
    }
    if (!guide) {
      failures.push({ kind: 'missing-secondary-guide-section' });
      return;
    }
    var pRect = primary.getBoundingClientRect();
    var gRect = guide.getBoundingClientRect();
    if (pRect.top > gRect.top + 1) {
      failures.push({ kind: 'chain-surface-not-first', primaryTop: pRect.top, guideTop: gRect.top });
    }
  }

  function assertStepFieldsAndTraps(failures) {
    var step = document.querySelector('.workflow-chain-surface-primary .workflow-step .step-box');
    if (!step) {
      failures.push({ kind: 'missing-workflow-step' });
      return;
    }
    var t = text(step);
    [
      'What this call does',
      'What you need before calling it',
      'Authoritative state after success',
      'What to call next',
      'Common hidden traps'
    ].forEach(function (label) {
      if (t.indexOf(label) === -1) failures.push({ kind: 'missing-step-field', label: label, text: t.slice(0, 400) });
    });
    var lower = t.toLowerCase();
    var trapMatches = [
      'token/context replacement',
      'cart invalidation',
      'hidden prerequisites',
      'weak or absent next-step modeling',
      'payment',
      'sw-access-key'
    ].filter(function (needle) { return lower.indexOf(needle) !== -1; });
    if (!trapMatches.length) {
      failures.push({ kind: 'missing-real-trap-copy', text: t.slice(0, 400) });
    }
  }

  function assertStepClickScopesFamilySurface(failures, done) {
    var step = document.querySelector('.workflow-chain-surface-primary [data-step-id="ep-1"]');
    if (!step) {
      failures.push({ kind: 'missing-target-step', endpoint: 'ep-1' });
      return done();
    }
    step.click();
    window.setTimeout(function () {
      var filter = document.getElementById('searchInput');
      var activeStep = document.querySelector('[data-step-id="ep-1"] .step-box.step-active');
      var familyRow = document.querySelector('tr.family-row[data-family="/tax-provider"][data-family-row="true"]');
      var inlineMount = document.querySelector('.inline-inspector-row-nested[data-endpoint-id="ep-1"] [data-inline-inspector-mount="1"]');
      if (!filter || (filter.value || '').toLowerCase() !== '/tax-provider') {
        failures.push({ kind: 'family-filter-not-scoped', got: filter ? filter.value : '' });
      }
      if (!activeStep) {
        failures.push({ kind: 'step-not-highlighted-after-click', endpoint: 'ep-1' });
      }
      if (!familyRow) {
        failures.push({ kind: 'family-row-not-visible-after-step-click', family: '/tax-provider' });
      }
      if (!inlineMount) {
        failures.push({ kind: 'inline-endpoint-detail-not-open', endpoint: 'ep-1' });
      }
      done();
    }, 420);
  }

  function run() {
    var failures = [];
    click('button.quick-action[data-id="workflow"]');
    (function waitForChains() {
      if (!document.body.classList.contains('lens-workflow')
        || !document.querySelector('.workflow-chains-drawer[open]')
        || !document.querySelector('.workflow-chain-surface-primary .workflow-step')) {
        return window.setTimeout(waitForChains, 50);
      }
      window.setTimeout(function () {
        assertChainSurfaceLead(failures);
        assertStepFieldsAndTraps(failures);
        assertStepClickScopesFamilySurface(failures, function () {
          finish(failures);
        });
      }, 220);
    })();
  }

  run();
})();
</script>
`
}

type workflowChainSurfaceRegressionReport struct {
	ready    bool
	failures int
	detail   string
}

func workflowChainSurfaceReport(dom string) workflowChainSurfaceRegressionReport {
	readyRe := regexp.MustCompile(`id="workflow-chain-surface-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="workflow-chain-surface-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="workflow-chain-surface-regression"[^>]*>([^<]*)</div>`)

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

	return workflowChainSurfaceRegressionReport{ready: ready, failures: failures, detail: detail}
}
