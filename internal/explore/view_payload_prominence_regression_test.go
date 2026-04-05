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

func TestViewPayloadButtonIsVisibleAndProminent(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "view-payload-prominence-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineViewPayloadProminenceDocument(t, overflowRegressionPayload())), 0o600); err != nil {
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
		"--window-size=1280,620",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := viewPayloadProminenceReport(string(out))
	if !report.ready {
		t.Fatalf("view payload prominence regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected View payload to be visible + prominent, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineViewPayloadProminenceDocument(t *testing.T, payload *Payload) string {
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
<div id="view-payload-prominence-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+viewPayloadProminenceHarness(),
		1,
	)
	return doc
}

func viewPayloadProminenceHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('view-payload-prominence-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout' }]);
  }, 5000);

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

  function parseRGB(color) {
    if (!color) return null;
    if (color === 'transparent') return { r: 255, g: 255, b: 255, a: 0 };
    var m = String(color || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(',').map(function (p) { return parseFloat(p.trim()); });
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: (parts.length > 3 ? parts[3] : 1) };
  }

  function colorDistance(a, b) {
    if (!a || !b) return 0;
    var dr = (a.r - b.r);
    var dg = (a.g - b.g);
    var db = (a.b - b.b);
    return Math.sqrt(dr*dr + dg*dg + db*db);
  }

  function waitForUI() {
    var failures = [];
    var btn = Array.prototype.find.call(document.querySelectorAll('.topbar a'), function (a) {
      return (a.textContent || '').trim().toLowerCase() === 'view payload';
    });
    if (!btn) {
      failures.push({ kind: 'missing-button' });
      return finish(failures);
    }
    if (!btn.classList.contains('button--payload')) {
      failures.push({ kind: 'missing-payload-class', className: btn.className });
    }
    var rect = btn.getBoundingClientRect();
    if (!(rect.width > 70 && rect.height > 26)) {
      failures.push({ kind: 'unexpected-size', width: rect.width, height: rect.height });
    }
    if (rect.top < 0 || rect.left < 0 || rect.right > window.innerWidth + 1) {
      failures.push({ kind: 'not-in-viewport', rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom }, viewport: { w: window.innerWidth, h: window.innerHeight } });
    }

    var style = window.getComputedStyle(btn);
    var bg = parseRGB(style.backgroundColor);
    var white = { r: 255, g: 255, b: 255, a: 1 };
    var dist = (bg && bg.a > 0) ? colorDistance(bg, white) : 0;
    if (dist < 18) {
      failures.push({ kind: 'background-too-close-to-white', backgroundColor: style.backgroundColor, distance: dist });
    }
    if ((style.boxShadow || '').toLowerCase() === 'none') {
      failures.push({ kind: 'missing-shadow', boxShadow: style.boxShadow });
    }
    finish(failures);
  }

  window.setTimeout(waitForUI, 220);
})();
</script>
`
}

type viewPayloadProminence struct {
	ready    bool
	failures int
	detail   string
}

func viewPayloadProminenceReport(dom string) viewPayloadProminence {
	readyRe := regexp.MustCompile(`id="view-payload-prominence-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="view-payload-prominence-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="view-payload-prominence-regression"[^>]*>([^<]*)</div>`)

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

	return viewPayloadProminence{ready: ready, failures: failures, detail: detail}
}

