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

func TestTopTabsStayClickableWithOpenInsightRows(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "top-tab-clickability-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineTopTabClickabilityRegressionDocument(t, familyInsightTogglePayload())), 0o600); err != nil {
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
		"--window-size=1280,1400",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := topTabClickabilityReport(string(out))
	if !report.ready {
		t.Fatalf("top-tab clickability regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected top tabs to remain clickable with open insight rows, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineTopTabClickabilityRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="top-tab-clickability-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+topTabClickabilityHarness(),
		1,
	)
	return doc
}

func topTabClickabilityHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('top-tab-clickability-regression'); }
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

  function hitTargetInfo(btn) {
    if (!btn) return null;
    var rect = btn.getBoundingClientRect();
    var x = rect.left + Math.max(8, Math.min(rect.width / 2, rect.width - 8));
    var y = rect.top + Math.max(8, Math.min(rect.height / 2, rect.height - 8));
    var hit = document.elementFromPoint(x, y);
    return {
      x: x,
      y: y,
      hitTag: hit ? hit.tagName : '',
      hitClass: hit ? (hit.className || '') : '',
      hitDataId: hit && hit.getAttribute ? (hit.getAttribute('data-id') || '') : ''
    };
  }

  function assertTabClickable(tabId, failures, step) {
    var btn = document.querySelector('button.quick-action[data-id="' + tabId + '"]');
    if (!btn) {
      failures.push({ kind: 'missing-tab-button', step: step, tab: tabId });
      return null;
    }
    var info = hitTargetInfo(btn);
    var hit = document.elementFromPoint(info.x, info.y);
    if (!hit || (hit !== btn && !btn.contains(hit))) {
      failures.push({ kind: 'tab-hit-target-blocked', step: step, tab: tabId, info: info });
    }
    return btn;
  }

  function openFirstInsight(step, failures, done) {
    var row = document.querySelector('tr.family-row[data-family-row="true"]');
    if (!row) {
      failures.push({ kind: 'missing-family-row', step: step });
      return done();
    }
    var family = row.getAttribute('data-family') || '';
    var btn = row.querySelector('td.family-col-name button.family-name-toggle[data-insight-toggle]');
    if (!btn) {
      failures.push({ kind: 'missing-family-toggle', step: step, family: family });
      return done();
    }
    btn.click();
    window.setTimeout(function () {
      var insightRow = document.querySelector('tr.family-inline-insight-row[data-family="' + family + '"]');
      if (!insightRow) {
        failures.push({ kind: 'insight-did-not-open', step: step, family: family });
      }
      if ((btn.getAttribute('aria-expanded') || '') !== 'true') {
        failures.push({ kind: 'toggle-state-not-expanded', step: step, family: family, ariaExpanded: btn.getAttribute('aria-expanded') || '' });
      }
      var expandBtn = row.querySelector('button[data-expand-endpoints]');
      if (!expandBtn) {
        failures.push({ kind: 'missing-endpoints-expand', step: step, family: family });
        window.scrollTo(0, 980);
        return window.setTimeout(done, 120);
      }
      expandBtn.click();
      window.setTimeout(function () {
        var expanded = document.querySelector('tr.family-endpoint-table-row[data-family="' + family + '"]');
        if (!expanded) {
          failures.push({ kind: 'endpoints-did-not-expand', step: step, family: family });
        }
        window.scrollTo(0, 980);
        window.setTimeout(done, 120);
      }, 180);
    }, 180);
  }

  function waitForTab(tabId, done) {
    var bodyClass = tabId === 'spec-rule' ? 'lens-spec-rule' : (tabId === 'workflow' ? 'lens-workflow' : 'lens-shape');
    (function poll() {
      if (!document.body.classList.contains(bodyClass) || !document.querySelector('tr.family-row[data-family-row="true"]')) {
        return window.setTimeout(poll, 40);
      }
      window.setTimeout(done, 160);
    })();
  }

  function run() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')
      || !document.querySelector('button.quick-action[data-id="workflow"]')
      || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(run, 50);
    }

    var failures = [];
    click('button.quick-action[data-id="spec-rule"]');
    waitForTab('spec-rule', function () {
      openFirstInsight('spec-rule-open', failures, function () {
        var workflowBtn = assertTabClickable('workflow', failures, 'spec-rule-to-workflow');
        if (workflowBtn) workflowBtn.click();
        waitForTab('workflow', function () {
          openFirstInsight('workflow-open', failures, function () {
            var shapeBtn = assertTabClickable('shape', failures, 'workflow-to-shape');
            if (shapeBtn) shapeBtn.click();
            waitForTab('shape', function () {
              finish(failures);
            });
          });
        });
      });
    });
  }

  run();
})();
</script>
`
}

type topTabClickability struct {
	ready    bool
	failures int
	detail   string
}

func topTabClickabilityReport(dom string) topTabClickability {
	readyRe := regexp.MustCompile(`id="top-tab-clickability-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="top-tab-clickability-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="top-tab-clickability-regression"[^>]*>([^<]*)</div>`)

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

	return topTabClickability{ready: ready, failures: failures, detail: detail}
}
