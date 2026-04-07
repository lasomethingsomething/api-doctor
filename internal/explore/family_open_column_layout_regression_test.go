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

func TestOpenFamilyRowKeepsFirstColumnAligned(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "family-open-column-layout-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFamilyOpenColumnLayoutRegressionDocument(t, familyInsightTogglePayload())), 0o600); err != nil {
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
		"--window-size=1280,1200",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := familyOpenColumnLayoutReport(string(out))
	if !report.ready {
		t.Fatalf("family open-column layout regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected open family rows to keep the first column aligned and readable, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFamilyOpenColumnLayoutRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="family-open-column-layout-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+familyOpenColumnLayoutHarness(),
		1,
	)
	return doc
}

func familyOpenColumnLayoutHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('family-open-column-layout-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout' }]);
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

  function rect(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  }

  function run() {
    var specBtn = document.querySelector('button.quick-action[data-id="spec-rule"]');
    if (!specBtn) return window.setTimeout(run, 50);
    specBtn.click();

    (function waitForRows() {
      var btn = document.querySelector('td.family-col-name button.family-name-toggle[data-insight-toggle]');
      if (!btn) return window.setTimeout(waitForRows, 50);

      btn.click();
      window.setTimeout(function () {
        var failures = [];
        var main = btn.querySelector('.family-name-main');
        var label = btn.querySelector('strong');
        var action = btn.querySelector('.family-name-action');
        var badge = btn.querySelector('.pressure-badge');
        if (!main || !label || !action || !badge) {
          failures.push({ kind: 'missing-name-parts' });
          return finish(failures);
        }

        var btnRect = rect(btn);
        var mainRect = rect(main);
        var labelRect = rect(label);
        var actionRect = rect(action);
        var badgeRect = rect(badge);

        if (btnRect.width < 140) failures.push({ kind: 'button-too-narrow', rect: btnRect });
        if (btnRect.height > 88) failures.push({ kind: 'button-too-tall', rect: btnRect });
        if (labelRect.width < 72) failures.push({ kind: 'label-too-narrow', rect: labelRect });
        if (badgeRect.left <= labelRect.left + 12) failures.push({ kind: 'badge-not-separated-from-label', labelRect: labelRect, badgeRect: badgeRect });
        if (badgeRect.top > mainRect.bottom + 2) failures.push({ kind: 'badge-fell-below-main-row', mainRect: mainRect, badgeRect: badgeRect });
        if (actionRect.top < mainRect.bottom - 2) failures.push({ kind: 'action-not-below-main-row', mainRect: mainRect, actionRect: actionRect });
        if (actionRect.left < btnRect.left - 1 || actionRect.right > btnRect.right + 1) failures.push({ kind: 'action-overflowed-button', btnRect: btnRect, actionRect: actionRect });
        if ((action.textContent || '').trim() !== 'Hide insight') failures.push({ kind: 'wrong-open-label', got: (action.textContent || '').trim() });
        finish(failures);
      }, 220);
    })();
  }

  run();
})();
</script>
`
}

type familyOpenColumnLayout struct {
	ready    bool
	failures int
	detail   string
}

func familyOpenColumnLayoutReport(dom string) familyOpenColumnLayout {
	readyRe := regexp.MustCompile(`id="family-open-column-layout-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="family-open-column-layout-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="family-open-column-layout-regression"[^>]*>([^<]*)</div>`)

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

	return familyOpenColumnLayout{ready: ready, failures: failures, detail: detail}
}
