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

func TestResponseShapeLayoutOverridesAreScopedToShapeTabOnly(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "response-shape-tab-isolation-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineResponseShapeTabIsolationRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := responseShapeTabIsolationReport(string(out))
	if !report.ready {
		t.Fatalf("tab-isolation regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected Response Shape layout overrides to be scoped to the Shape tab only, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineResponseShapeTabIsolationRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shape-tab-isolation-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+responseShapeTabIsolationHarness(),
		1,
	)
	return doc
}

func responseShapeTabIsolationHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shape-tab-isolation-regression'); }

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

  function assertFamilyTableLayout(step, expectedTableLayout, failures) {
    var table = document.querySelector('.family-table');
    if (!table) {
      failures.push({ kind: 'missing-table', step: step });
      return;
    }
    var layout = (window.getComputedStyle(table).tableLayout || '').toLowerCase();
    if (layout !== expectedTableLayout) {
      failures.push({ kind: 'unexpected-table-layout', step: step, expected: expectedTableLayout, got: layout });
    }
  }

  function assertBodyLens(step, className, failures) {
    if (!document.body.classList.contains(className)) {
      failures.push({ kind: 'missing-body-class', step: step, expected: className, bodyClass: document.body.className });
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')
      || !document.querySelector('button.quick-action[data-id="workflow"]')
      || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    // Shape: fixed table layout.
    click('button.quick-action[data-id="shape"]');
    (function waitForShape() {
      if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-shape')) {
        return window.setTimeout(waitForShape, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        assertBodyLens('shape', 'lens-shape', failures);
        assertFamilyTableLayout('shape', 'fixed', failures);

        // Workflow: should remain auto layout (do not inherit fixed column sizing).
        click('button.quick-action[data-id="workflow"]');
        (function waitForWorkflow() {
          if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-workflow')) {
            return window.setTimeout(waitForWorkflow, 50);
          }
          window.setTimeout(function () {
            assertBodyLens('workflow', 'lens-workflow', failures);
            assertFamilyTableLayout('workflow', 'auto', failures);

            // Contract Issues (spec-rule): should remain auto layout as well.
            click('button.quick-action[data-id="spec-rule"]');
            (function waitForSpecRule() {
              if (!document.querySelector('.family-table') || !document.body.classList.contains('lens-spec-rule')) {
                return window.setTimeout(waitForSpecRule, 50);
              }
              window.setTimeout(function () {
                assertBodyLens('spec-rule', 'lens-spec-rule', failures);
                assertFamilyTableLayout('spec-rule', 'auto', failures);
                finish(failures);
              }, 140);
            })();
          }, 140);
        })();
      }, 160);
    })();
  }

  waitForUI();
})();
</script>
`
}

type responseShapeTabIsolation struct {
	ready    bool
	failures int
	detail   string
}

func responseShapeTabIsolationReport(dom string) responseShapeTabIsolation {
	readyRe := regexp.MustCompile(`id="shape-tab-isolation-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shape-tab-isolation-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shape-tab-isolation-regression"[^>]*>([^<]*)</div>`)

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

	return responseShapeTabIsolation{ready: ready, failures: failures, detail: detail}
}

