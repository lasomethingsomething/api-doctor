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

func TestExplorerDoesNotRenderBurdenFilterAnywhere(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "burden-filter-removed-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineBurdenFilterRemovedRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := burdenFilterRemovedReport(string(out))
	if !report.ready {
		t.Fatalf("burden-filter-removed regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected explorer to not render the removed Burden filter anywhere, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineBurdenFilterRemovedRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="burden-filter-removed-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+burdenFilterRemovedHarness(),
		1,
	)
	return doc
}

func burdenFilterRemovedHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('burden-filter-removed-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', bodyClass: document.body.className }]);
  }, 6500);

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

  function assertNoBurdenUI(step, failures) {
    if (document.getElementById('burdenFilter')) {
      failures.push({ kind: 'burden-select-present', step: step });
    }
    // Burden was a top-level filter field label ("Burden"). Categories may still contain
    // option values like "workflow burden", so only assert the filter-row field label is gone.
    var labels = document.querySelectorAll('.lens-controls label.field');
    for (var i = 0; i < labels.length; i++) {
      var raw = labels[i].textContent || '';
      var firstLine = raw.split('\n')[0].trim();
      if (firstLine.toLowerCase() === 'burden') {
        failures.push({ kind: 'burden-field-label-present', step: step, label: firstLine });
      }
    }
    var summary = document.getElementById('lensControlHint');
    var sumText = summary ? (summary.textContent || '') : '';
    if (sumText.toLowerCase().indexOf('burden ') !== -1 || sumText.toLowerCase().indexOf('· burden') !== -1) {
      failures.push({ kind: 'burden-in-summary', step: step, text: sumText.trim() });
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')
      || !document.querySelector('button.quick-action[data-id="workflow"]')
      || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    // Validate across all three tabs (guards against conditional rendering/leaks).
    var failures = [];

    click('button.quick-action[data-id="spec-rule"]');
    (function waitForSpec() {
      if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-spec-rule')) {
        return window.setTimeout(waitForSpec, 50);
      }
      window.setTimeout(function () {
        assertNoBurdenUI('spec-rule', failures);
        click('button.quick-action[data-id="workflow"]');
        (function waitForWorkflow() {
          if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-workflow')) {
            return window.setTimeout(waitForWorkflow, 50);
          }
          window.setTimeout(function () {
            assertNoBurdenUI('workflow', failures);
            click('button.quick-action[data-id="shape"]');
            (function waitForShape() {
              if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-shape')) {
                return window.setTimeout(waitForShape, 50);
              }
              window.setTimeout(function () {
                assertNoBurdenUI('shape', failures);
                finish(failures);
              }, 140);
            })();
          }, 140);
        })();
      }, 140);
    })();
  }

  waitForUI();
})();
</script>
`
}

type burdenFilterRemoved struct {
	ready    bool
	failures int
	detail   string
}

func burdenFilterRemovedReport(dom string) burdenFilterRemoved {
	readyRe := regexp.MustCompile(`id="burden-filter-removed-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="burden-filter-removed-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="burden-filter-removed-regression"[^>]*>([^<]*)</div>`)

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

	return burdenFilterRemoved{ready: ready, failures: failures, detail: detail}
}
