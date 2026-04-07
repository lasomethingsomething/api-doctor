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

func TestFamilyTableHeaderLabelsRemainVisible(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "family-table-header-labels-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFamilyTableHeaderLabelsDocument(t, familyInsightTogglePayload())), 0o600); err != nil {
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

	report := familyTableHeaderLabelsReport(string(out))
	if !report.ready {
		t.Fatalf("family table header labels regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected visible family table header labels, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFamilyTableHeaderLabelsDocument(t *testing.T, payload *Payload) string {
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
<div id="family-table-header-labels-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+familyTableHeaderLabelsHarness(),
		1,
	)
	return doc
}

func familyTableHeaderLabelsHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('family-table-header-labels-regression'); }

  function finish(failures) {
    var n = node();
    if (!n) return;
    n.setAttribute('data-ready', 'true');
    n.setAttribute('data-failures', String(failures.length));
    n.textContent = JSON.stringify(failures);
  }

  function headerTexts() {
    return Array.prototype.map.call(document.querySelectorAll('.family-table thead th'), function (th) {
      return ((th.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase());
    });
  }

  function run() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')) {
      return window.setTimeout(run, 50);
    }
    document.querySelector('button.quick-action[data-id="spec-rule"]').click();
    (function waitForTable() {
      if (!document.querySelector('.family-table thead th')) {
        return window.setTimeout(waitForTable, 50);
      }
      window.setTimeout(function () {
        var failures = [];
        var texts = headerTexts();
        ['FAMILY', 'SEVERITY MIX', 'ENDPOINTS', 'TOP SIGNAL', 'PRIMARY RISK', 'CLIENT EFFECT', 'WHAT DOMINATES'].forEach(function (label) {
          var found = texts.some(function (text) { return text.indexOf(label) !== -1; });
          if (!found) failures.push({ kind: 'missing-header-label', label: label, texts: texts });
        });
        var titleSpans = document.querySelectorAll('.family-table thead th .th-title');
        if (!titleSpans.length) failures.push({ kind: 'missing-th-title-spans' });
        finish(failures);
      }, 180);
    })();
  }

  run();
})();
</script>
`
}

type familyTableHeaderLabels struct {
	ready    bool
	failures int
	detail   string
}

func familyTableHeaderLabelsReport(dom string) familyTableHeaderLabels {
	readyRe := regexp.MustCompile(`id="family-table-header-labels-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="family-table-header-labels-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="family-table-header-labels-regression"[^>]*>([^<]*)</div>`)

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

	return familyTableHeaderLabels{ready: ready, failures: failures, detail: detail}
}
