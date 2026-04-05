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

func TestWorkflowAndShapeControlsPreserveActiveTopTab(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "top-tab-preservation-regression.html")
	userDataDir := filepath.Join(outDir, "chrome-profile")
	if err := os.WriteFile(htmlPath, []byte(inlineTopTabPreservationDocument(t, resetFiltersRegressionPayload())), 0o600); err != nil {
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

	report := topTabPreservationReport(string(out))
	if !report.ready {
		t.Fatalf("top tab preservation regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected controls inside Workflow Guidance and Response Shape to preserve active top tab, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineTopTabPreservationDocument(t *testing.T, payload *Payload) string {
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
<div id="top-tab-preservation" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+topTabPreservationHarness(),
		1,
	)
	return doc
}

func topTabPreservationHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('top-tab-preservation'); }

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

  function activeTopTabId() {
    var btn = document.querySelector('.quick-action.active');
    return btn ? (btn.getAttribute('data-id') || '') : '';
  }

  function assertTab(failures, expected, label) {
    var got = activeTopTabId();
    if (got !== expected) {
      failures.push({ kind: 'tab-jump', where: label, expected: expected, got: got });
    }
  }

  function runOne(tabId) {
    return new Promise(function (resolve) {
      var failures = [];

      click('button.quick-action[data-id="' + tabId + '"]');
      window.setTimeout(function () {
        assertTab(failures, tabId, 'after-tab-click');

        // Filter changes must not switch tabs.
        setInput('searchInput', '/tax-provider');
        setSelect('categoryFilter', 'spec-rule');
        window.setTimeout(function () {
          assertTab(failures, tabId, 'after-filter-changes');

          // Row expansion/collapse must not switch tabs.
          click('button.endpoints-expand[data-expand-endpoints="/tax-provider"]');
          window.setTimeout(function () {
            assertTab(failures, tabId, 'after-expand-endpoints');

            click('button.endpoints-expand[data-expand-endpoints="/tax-provider"]');
            window.setTimeout(function () {
              assertTab(failures, tabId, 'after-collapse-endpoints');

              click('button[data-insight-toggle="/tax-provider"]');
              window.setTimeout(function () {
                assertTab(failures, tabId, 'after-show-insight');

                click('button[data-insight-toggle="/tax-provider"]');
                window.setTimeout(function () {
                  assertTab(failures, tabId, 'after-hide-insight');

                  // Reset filters must not switch tabs.
                  click('button.reset-btn');
                  window.setTimeout(function () {
                    assertTab(failures, tabId, 'after-reset-filters');
                    resolve(failures);
                  }, 100);
                }, 100);
              }, 100);
            }, 100);
          }, 120);
        }, 120);
      }, 120);
    });
  }

  function waitForUI() {
    if (!document.querySelector('button.reset-btn') || !document.querySelector('button.quick-action[data-id="workflow"]')) {
      return window.setTimeout(waitForUI, 50);
    }
    if (!document.querySelector('button.endpoints-expand[data-expand-endpoints="/tax-provider"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var failures = [];
    runOne('workflow')
      .then(function (f) { failures = failures.concat(f); return runOne('shape'); })
      .then(function (f) { failures = failures.concat(f); finish(failures); });
  }

  waitForUI();
})();
</script>
`
}

type topTabPreservationResult struct {
	ready    bool
	failures int
	detail   string
}

func topTabPreservationReport(dom string) topTabPreservationResult {
	readyRe := regexp.MustCompile(`id="top-tab-preservation"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="top-tab-preservation"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="top-tab-preservation"[^>]*>([^<]*)</div>`)

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
	return topTabPreservationResult{ready: ready, failures: failures, detail: detail}
}
