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

func TestTopTabsKeepIndependentFamilyTableLayoutsAndSummaries(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "top-tabs-snapshot-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineTopTabsSnapshotRegressionDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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

	report := topTabsSnapshotReport(string(out))
	if !report.ready {
		t.Fatalf("top-tabs snapshot regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected top tabs to keep tab-specific layout/summary behavior without cross-regressions, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineTopTabsSnapshotRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="top-tabs-snapshot-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+topTabsSnapshotHarness(),
		1,
	)
	return doc
}

func topTabsSnapshotHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('top-tabs-snapshot-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', bodyClass: document.body.className }]);
  }, 7000);

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

  function parseRGB(color) {
    var m = String(color || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(',').map(function (p) { return parseFloat(p.trim()); });
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: (parts.length > 3 ? parts[3] : 1) };
  }

  function colorDistance(c1, c2) {
    if (!c1 || !c2) return 0;
    var dr = (c1.r - c2.r);
    var dg = (c1.g - c2.g);
    var db = (c1.b - c2.b);
    return Math.sqrt(dr*dr + dg*dg + db*db);
  }

  function summaryCounts() {
    var ctx = document.getElementById('familySurfaceContext');
    if (!ctx) return { shape: 0, normal: 0 };
    return {
      shape: ctx.querySelectorAll('.context-summary-shape').length,
      normal: ctx.querySelectorAll('.context-summary:not(.context-summary-shape)').length
    };
  }

  function collectSnapshot(tabKey) {
    var surface = document.getElementById('familySurface');
    var table = document.querySelector('.family-table');
    var row = document.querySelector('tr.family-row[data-family-row="true"]');
    var endpointsBtn = row ? row.querySelector('td.family-col-endpoints .endpoints-expand') : null;
    var signalChip = row ? row.querySelector('td.family-col-top-signal .family-signal-chip') : null;
    var snap = {
      tab: tabKey,
      bodyClass: document.body.className,
      tableLayout: table ? (window.getComputedStyle(table).tableLayout || '') : '',
      tableMinWidth: table ? (window.getComputedStyle(table).minWidth || '') : '',
      surfaceScrollWidth: surface ? (surface.scrollWidth || 0) : 0,
      surfaceClientWidth: surface ? (surface.clientWidth || 0) : 0,
      surfaceScrollLeft: surface ? (surface.scrollLeft || 0) : 0,
      summary: summaryCounts(),
      endpointsBg: endpointsBtn ? parseRGB(window.getComputedStyle(endpointsBtn).backgroundColor) : null,
      signalBg: signalChip ? parseRGB(window.getComputedStyle(signalChip).backgroundColor) : null
    };
    snap.endpointsVsSignalDist = (snap.endpointsBg && snap.signalBg) ? colorDistance(snap.endpointsBg, snap.signalBg) : null;
    return snap;
  }

  function assertTab(tabKey, expectedBodyClass, expectedTableLayout, failures) {
    if (!document.body.classList.contains(expectedBodyClass)) {
      failures.push({ kind: 'wrong-body-class', tab: tabKey, expected: expectedBodyClass, bodyClass: document.body.className });
      return;
    }
    var table = document.querySelector('.family-table');
    if (!table) {
      failures.push({ kind: 'missing-table', tab: tabKey });
      return;
    }
    var layout = (window.getComputedStyle(table).tableLayout || '').toLowerCase();
    if (layout !== expectedTableLayout) {
      failures.push({ kind: 'unexpected-table-layout', tab: tabKey, expected: expectedTableLayout, got: layout });
    }

    // Ensure we're not accidentally carrying a prior horizontal scroll position across tabs.
    var surface = document.getElementById('familySurface');
    if (surface && surface.scrollLeft > 0) {
      failures.push({ kind: 'surface-scroll-left', tab: tabKey, scrollLeft: surface.scrollLeft });
    }

    // Ensure shape-only summary variants do not leak into other tabs.
    var counts = summaryCounts();
    if (tabKey === 'shape') {
      if (counts.shape < 1) failures.push({ kind: 'missing-shape-summary', tab: tabKey, counts: counts });
      if (counts.normal > 0) failures.push({ kind: 'unexpected-normal-summary-in-shape', tab: tabKey, counts: counts });
    } else {
      if (counts.shape > 0) failures.push({ kind: 'shape-summary-leaked', tab: tabKey, counts: counts });
      if (counts.normal < 1) failures.push({ kind: 'missing-normal-summary', tab: tabKey, counts: counts });
    }
  }

  function assertShapeSemantics(failures) {
    var snap = collectSnapshot('shape');
    if (snap.endpointsVsSignalDist !== null && snap.endpointsVsSignalDist < 22) {
      failures.push({ kind: 'shape-endpoints-too-similar-to-signals', distance: snap.endpointsVsSignalDist, snap: snap });
    }
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')
      || !document.querySelector('button.quick-action[data-id="workflow"]')
      || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var failures = [];

    click('button.quick-action[data-id="spec-rule"]');
    (function waitForSpecRule() {
      if (!document.body.classList.contains('lens-spec-rule') || !document.querySelector('tr.family-row[data-family-row="true"]')) {
        return window.setTimeout(waitForSpecRule, 50);
      }
      window.setTimeout(function () {
        assertTab('spec-rule', 'lens-spec-rule', 'auto', failures);

        click('button.quick-action[data-id="workflow"]');
        (function waitForWorkflow() {
          if (!document.body.classList.contains('lens-workflow') || !document.querySelector('tr.family-row[data-family-row="true"]')) {
            return window.setTimeout(waitForWorkflow, 50);
          }
          window.setTimeout(function () {
            assertTab('workflow', 'lens-workflow', 'auto', failures);

            click('button.quick-action[data-id="shape"]');
            (function waitForShape() {
              if (!document.body.classList.contains('lens-shape') || !document.querySelector('tr.family-row[data-family-row="true"]')) {
                return window.setTimeout(waitForShape, 50);
              }
              window.setTimeout(function () {
                assertTab('shape', 'lens-shape', 'fixed', failures);
                assertShapeSemantics(failures);
                finish(failures);
              }, 160);
            })();
          }, 160);
        })();
      }, 160);
    })();
  }

  waitForUI();
})();
</script>
`
}

type topTabsSnapshot struct {
	ready    bool
	failures int
	detail   string
}

func topTabsSnapshotReport(dom string) topTabsSnapshot {
	readyRe := regexp.MustCompile(`id="top-tabs-snapshot-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="top-tabs-snapshot-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="top-tabs-snapshot-regression"[^>]*>([^<]*)</div>`)

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

	return topTabsSnapshot{ready: ready, failures: failures, detail: detail}
}

