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

func TestSharedExplorerShellStatesAcrossTabs(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "shared-explorer-shell-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineSharedExplorerShellRegressionDocument(t, familyExpansionLayoutPayload())), 0o600); err != nil {
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
		"--virtual-time-budget=11000",
		"--window-size=1600,2600",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := sharedExplorerShellReport(string(out))
	if !report.ready {
		t.Fatalf("shared explorer shell regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected shared explorer shell behavior to stay stable across tabs and states, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineSharedExplorerShellRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="shared-explorer-shell-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+sharedExplorerShellHarness(),
		1,
	)
	return doc
}

func sharedExplorerShellHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('shared-explorer-shell-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', bodyClass: document.body.className }]);
  }, 8000);

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

  function setInput(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function activeTabId() {
    var active = document.querySelectorAll('.quick-action.active');
    if (active.length !== 1) return '';
    return active[0].getAttribute('data-id') || '';
  }

  function waitForTab(tabId, bodyClass, done) {
    if (activeTabId() === tabId && document.body.classList.contains(bodyClass) && document.querySelector('.family-table')) {
      return window.setTimeout(done, 120);
    }
    click('button.quick-action[data-id="' + tabId + '"]');
    window.setTimeout(function poll() {
      if (activeTabId() !== tabId || !document.body.classList.contains(bodyClass) || !document.querySelector('.family-table')) {
        return window.setTimeout(poll, 40);
      }
      done();
    }, 140);
  }

  function assertSharedShell(tab, phase, failures) {
    var tabs = document.querySelectorAll('.quick-action');
    var active = document.querySelectorAll('.quick-action.active');
    var filterBar = document.querySelectorAll('.lens-controls');
    var reset = document.querySelectorAll('.reset-btn');
    var table = document.querySelector('.family-table');
    var surface = document.getElementById('familySurface');
    if (tabs.length !== 3) failures.push({ kind: 'top-tab-count', tab: tab.id, phase: phase, expected: 3, got: tabs.length });
    if (active.length !== 1) failures.push({ kind: 'active-tab-count', tab: tab.id, phase: phase, expected: 1, got: active.length });
    if (activeTabId() !== tab.id) failures.push({ kind: 'wrong-active-tab', tab: tab.id, phase: phase, got: activeTabId() });
    if (filterBar.length !== 1) failures.push({ kind: 'shared-filter-bar-count', tab: tab.id, phase: phase, expected: 1, got: filterBar.length });
    if (reset.length !== 1) failures.push({ kind: 'shared-reset-count', tab: tab.id, phase: phase, expected: 1, got: reset.length });
    if (!table || !surface) {
      failures.push({ kind: 'missing-family-table', tab: tab.id, phase: phase });
      return;
    }

    var headRows = table.querySelectorAll('thead tr');
    var bodyHeaders = table.querySelectorAll('tbody th');
    if (headRows.length !== 1) failures.push({ kind: 'duplicate-table-head', tab: tab.id, phase: phase, got: headRows.length });
    if (bodyHeaders.length !== 0) failures.push({ kind: 'header-leaked-into-body', tab: tab.id, phase: phase, got: bodyHeaders.length });

    var lastHeader = table.querySelector('thead th:last-child');
    if (lastHeader) {
      var surfaceRect = surface.getBoundingClientRect();
      var headerRect = lastHeader.getBoundingClientRect();
      if (headerRect.right > surfaceRect.right + 1) {
        failures.push({ kind: 'right-edge-header-offscreen', tab: tab.id, phase: phase, headerRight: headerRect.right, surfaceRight: surfaceRect.right });
      }
    }
  }

  function assertExpanded(tab, failures, done) {
    var row = document.querySelector('tr.family-row[data-family="/aggregate"][data-family-row="true"]');
    var btn = row ? row.querySelector('button.endpoints-expand[data-expand-endpoints="/aggregate"]') : null;
    if (!row || !btn) {
      failures.push({ kind: 'missing-expand-target', tab: tab.id });
      return done();
    }
    btn.click();
    window.setTimeout(function () {
      var expansion = document.querySelector('tr.family-endpoint-table-row[data-family="/aggregate"]');
      if (!expansion) {
        failures.push({ kind: 'expansion-missing', tab: tab.id });
        return done();
      }
      if (row.nextElementSibling !== expansion) {
        failures.push({ kind: 'expansion-not-inline', tab: tab.id });
      }
      var nested = expansion.querySelectorAll('tr.nested-endpoint-row[data-family="/aggregate"]');
      if (nested.length < 10) failures.push({ kind: 'nested-row-count', tab: tab.id, expectedMin: 10, got: nested.length });
      assertSharedShell(tab, 'expanded', failures);
      btn = document.querySelector('button.endpoints-expand[data-expand-endpoints="/aggregate"]');
      if (btn) btn.click();
      window.setTimeout(function () {
        if (document.querySelector('tr.family-endpoint-table-row[data-family="/aggregate"]')) {
          failures.push({ kind: 'expansion-did-not-collapse', tab: tab.id });
        }
        done();
      }, 180);
    }, 220);
  }

  function assertFiltered(tab, failures, done) {
    setInput('searchInput', '/aggregate');
    window.setTimeout(function () {
      var rows = document.querySelectorAll('tr.family-row[data-family-row="true"]');
      if (rows.length !== 1) failures.push({ kind: 'filtered-family-count', tab: tab.id, expected: 1, got: rows.length });
      assertSharedShell(tab, 'filtered', failures);
      done();
    }, 160);
  }

  function assertEmpty(tab, failures, done) {
    setInput('searchInput', '/missing-family');
    window.setTimeout(function () {
      var empty = document.querySelector('#familySurface .empty, #filterEmptyState .empty, #filterEmptyState');
      var visibleRows = document.querySelectorAll('tr.family-row[data-family-row="true"]');
      if (visibleRows.length !== 0) failures.push({ kind: 'empty-state-still-has-rows', tab: tab.id, got: visibleRows.length });
      if (!empty) failures.push({ kind: 'missing-empty-state', tab: tab.id });
      if (activeTabId() !== tab.id) failures.push({ kind: 'tab-changed-during-empty-state', tab: tab.id, got: activeTabId() });
      done();
    }, 160);
  }

  function resetFilters(tab, failures, done) {
    click('button.reset-btn');
    window.setTimeout(function () {
      if (activeTabId() !== tab.id) failures.push({ kind: 'reset-changed-tab', tab: tab.id, got: activeTabId() });
      var search = (document.getElementById('searchInput') || {}).value || '';
      if (search !== '') failures.push({ kind: 'reset-did-not-clear-search', tab: tab.id, got: search });
      assertSharedShell(tab, 'default', failures);
      done();
    }, 160);
  }

  function runTab(tab, failures, done) {
    waitForTab(tab.id, tab.bodyClass, function () {
      assertSharedShell(tab, 'default', failures);
      assertFiltered(tab, failures, function () {
        assertExpanded(tab, failures, function () {
          assertEmpty(tab, failures, function () {
            resetFilters(tab, failures, done);
          });
        });
      });
    });
  }

  function runTabs(tabs, failures, done) {
    if (!tabs.length) return done();
    runTab(tabs[0], failures, function () {
      runTabs(tabs.slice(1), failures, done);
    });
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]') || !document.querySelector('.family-table')) {
      return window.setTimeout(waitForUI, 50);
    }
    var failures = [];
    runTabs([
      { id: 'spec-rule', bodyClass: 'lens-spec-rule' },
      { id: 'workflow', bodyClass: 'lens-workflow' },
      { id: 'shape', bodyClass: 'lens-shape' }
    ], failures, function () {
      finish(failures);
    });
  }

  waitForUI();
})();
</script>
`
}

type sharedExplorerShellRegression struct {
	ready    bool
	failures int
	detail   string
}

func sharedExplorerShellReport(dom string) sharedExplorerShellRegression {
	readyRe := regexp.MustCompile(`id="shared-explorer-shell-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="shared-explorer-shell-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="shared-explorer-shell-regression"[^>]*>([^<]*)</div>`)

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

	return sharedExplorerShellRegression{ready: ready, failures: failures, detail: detail}
}
