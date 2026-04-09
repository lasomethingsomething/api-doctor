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

func TestEndpointInspectorPanelRemovedAndInlineWorkspaceStillWorks(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "endpoint-inspector-removed-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineEndpointInspectorRemovedDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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
		"--window-size=1360,2400",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := parseEndpointInspectorRemovedReport(string(out))
	if !report.ready {
		t.Fatalf("endpoint inspector removed regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected detached Endpoint Inspector panel removed + inline workspace preserved, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineEndpointInspectorRemovedDocument(t *testing.T, payload *Payload) string {
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
<div id="endpoint-inspector-removed-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+endpointInspectorRemovedHarness(),
		1,
	)
	return doc
}

func endpointInspectorRemovedHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('endpoint-inspector-removed-regression'); }

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

  function assertNoDetachedInspector(tabId, step, failures) {
    if (document.getElementById('endpointDiagnosticsSection')) {
      failures.push({ kind: 'detached-inspector-still-present', tab: tabId, step: step });
    }
    var endpointListSection = document.getElementById('endpointListSection');
    if (endpointListSection) {
      var style = window.getComputedStyle(endpointListSection);
      if (style.display !== 'none' || endpointListSection.getAttribute('aria-hidden') !== 'true') {
        failures.push({
          kind: 'detached-endpoint-evidence-still-visible',
          tab: tabId,
          step: step,
          display: style.display,
          ariaHidden: endpointListSection.getAttribute('aria-hidden') || ''
        });
      }
    }
    var heading = Array.prototype.find.call(document.querySelectorAll('h2,h3'), function (h) {
      return /endpoint inspector/i.test(h.textContent || '');
    });
    if (heading) {
      failures.push({ kind: 'inspector-heading-still-present', tab: tabId, step: step, text: (heading.textContent || '').trim() });
    }
  }

  function expandFirstFamily(failures) {
    var row = document.querySelector('tr.family-row[data-family-row="true"]');
    if (!row) {
      failures.push({ kind: 'missing-family-row' });
      return false;
    }
    var btn = row.querySelector('td.family-col-endpoints .endpoints-expand');
    if (!btn) {
      failures.push({ kind: 'missing-endpoints-expand' });
      return false;
    }
    btn.click();
    return true;
  }

  function inspectFirstEndpoint(failures) {
    var btn = document.querySelector('button.nested-endpoint-path-toggle[data-focus-endpoint]');
    if (!btn) {
      failures.push({ kind: 'missing-endpoint-select-control' });
      return false;
    }
    btn.click();
    return true;
  }

  function assertInlineWorkspace(tabId, step, failures) {
    var mount = document.querySelector('.inline-inspector-row-nested [data-inline-inspector-mount="1"]');
    if (!mount) {
      failures.push({ kind: 'missing-inline-mount', tab: tabId, step: step });
      return;
    }
    var code = mount.querySelector('.inspector-endpoint-code');
    var tabs = mount.querySelector('.endpoint-diag-tabs');
    if (!code || !tabs) {
      failures.push({ kind: 'inline-workspace-missing-chrome', tab: tabId, step: step });
      return;
    }
    var label = (code.textContent || '').trim();
    if (!/\/admin-api\//.test(label)) {
      failures.push({ kind: 'unexpected-endpoint-label', tab: tabId, step: step, label: label });
    }
    if (!tabs.querySelector('button.endpoint-diag-tab[data-endpoint-subtab="exact"]')) {
      failures.push({ kind: 'missing-exact-evidence-tab', tab: tabId, step: step });
    }
    click('.inline-inspector-row-nested [data-inline-inspector-mount="1"] button.endpoint-diag-tab[data-endpoint-subtab="exact"]');
    var groupedText = (mount.textContent || '').replace(/\s+/g, ' ').trim();
    if (groupedText.indexOf('Grouped deviations') === -1) {
      failures.push({ kind: 'missing-grouped-deviations-content', tab: tabId, step: step, text: groupedText.slice(0, 240) });
    }
    if (groupedText.indexOf('Schema grounding') === -1) {
      failures.push({ kind: 'missing-schema-grounding-content', tab: tabId, step: step, text: groupedText.slice(0, 240) });
    }
  }

  function runTab(tabId, failures, done) {
    click('button.quick-action[data-id="' + tabId + '"]');
    window.setTimeout(function () {
      assertNoDetachedInspector(tabId, 'after-tab', failures);
      if (!expandFirstFamily(failures)) return done();
      window.setTimeout(function () {
        assertNoDetachedInspector(tabId, 'after-expand', failures);
        if (!inspectFirstEndpoint(failures)) return done();
        window.setTimeout(function () {
          assertNoDetachedInspector(tabId, 'after-inspect', failures);
          assertInlineWorkspace(tabId, 'after-inspect', failures);
          done();
        }, 180);
      }, 180);
    }, 180);
  }

  function waitForUI() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')
      || !document.querySelector('button.quick-action[data-id="workflow"]')
      || !document.querySelector('button.quick-action[data-id="shape"]')) {
      return window.setTimeout(waitForUI, 50);
    }

    var failures = [];
    assertNoDetachedInspector('init', 'initial', failures);
    runTab('spec-rule', failures, function () {
      runTab('workflow', failures, function () {
        runTab('shape', failures, function () {
          finish(failures);
        });
      });
    });
  }

  waitForUI();
})();
</script>
`
}

type endpointInspectorRemovedReport struct {
	ready    bool
	failures int
	detail   string
}

func parseEndpointInspectorRemovedReport(dom string) endpointInspectorRemovedReport {
	readyRe := regexp.MustCompile(`id="endpoint-inspector-removed-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="endpoint-inspector-removed-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="endpoint-inspector-removed-regression"[^>]*>([^<]*)</div>`)

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

	return endpointInspectorRemovedReport{ready: ready, failures: failures, detail: detail}
}
