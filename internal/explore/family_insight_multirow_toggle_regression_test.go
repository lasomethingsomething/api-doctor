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

func TestFamilyInsightTogglesReliablyAcrossMultipleRows(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "family-insight-multirow-toggle-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineFamilyInsightMultiRowToggleRegressionDocument(t, familyInsightTogglePayload())), 0o600); err != nil {
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

	report := familyInsightMultiRowToggleReport(string(out))
	if !report.ready {
		t.Fatalf("family insight multi-row regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected family insight toggles to open/close reliably across rows without scroll jump, got %d failures\n%s", report.failures, report.detail)
	}
}

func inlineFamilyInsightMultiRowToggleRegressionDocument(t *testing.T, payload *Payload) string {
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
<div id="family-insight-multirow-toggle-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+familyInsightMultiRowToggleHarness(),
		1,
	)
	return doc
}

func familyInsightMultiRowToggleHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('family-insight-multirow-toggle-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', rows: document.querySelectorAll('tr.family-row[data-family-row="true"]').length }]);
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

  function scrollStable(before, after) {
    return Math.abs((after || 0) - (before || 0)) <= 1;
  }

  function familyButton(index) {
    return document.querySelectorAll('td.family-col-name button.family-name-toggle[data-insight-toggle]')[index] || null;
  }

  function familyName(btn) {
    return btn ? (btn.getAttribute('data-insight-toggle') || '') : '';
  }

  function insightRowFor(family) {
    return document.querySelector('tr.family-inline-insight-row[data-family="' + family + '"]');
  }

  function labelOf(btn) {
    var label = btn ? btn.querySelector('.family-name-action') : null;
    return ((label && label.textContent) || '').trim();
  }

  function onlyOneInsightRowOpen() {
    return document.querySelectorAll('tr.family-inline-insight-row').length === 1;
  }

  function expandEndpointsFor(btn, failures, step, done) {
    var row = btn ? btn.closest('tr.family-row[data-family-row="true"]') : null;
    if (!row) {
      failures.push({ kind: 'missing-family-row-for-expand', step: step });
      return done();
    }
    var family = familyName(btn);
    var expandBtn = row.querySelector('button[data-expand-endpoints]');
    if (!expandBtn) {
      failures.push({ kind: 'missing-endpoints-expand', step: step, family: family });
      return done();
    }
    expandBtn.click();
    window.setTimeout(function () {
      var expanded = document.querySelector('tr.family-endpoint-table-row[data-family="' + family + '"]');
      if (!expanded) {
        failures.push({ kind: 'endpoints-did-not-expand', step: step, family: family });
      }
      done();
    }, 220);
  }

  function clickAndCheck(btn, expectedLabel, failures, step, done) {
    var before = window.scrollY || 0;
    var family = familyName(btn);
    btn.click();
    window.setTimeout(function () {
      var after = window.scrollY || 0;
      if (!scrollStable(before, after)) {
        failures.push({ kind: 'scroll-jump', step: step, before: before, after: after });
      }
      var actualLabel = labelOf(btn);
      if (actualLabel !== expectedLabel) {
        failures.push({ kind: 'wrong-label', step: step, family: family, expected: expectedLabel, got: actualLabel });
      }
      var expanded = btn.getAttribute('aria-expanded') || '';
      if ((expectedLabel === 'Hide insight' && expanded !== 'true') || (expectedLabel === 'Show insight' && expanded !== 'false')) {
        failures.push({ kind: 'wrong-expanded-state', step: step, family: family, expanded: expanded, expectedLabel: expectedLabel });
      }
      done();
    }, 220);
  }

  function run() {
    if (!document.querySelector('button.quick-action[data-id="spec-rule"]')) {
      return window.setTimeout(run, 50);
    }
    document.querySelector('button.quick-action[data-id="spec-rule"]').click();

    (function waitForRows() {
      var rows = document.querySelectorAll('tr.family-row[data-family-row="true"]');
      if (rows.length < 2) return window.setTimeout(waitForRows, 50);

      var failures = [];
      var firstBtn = familyButton(0);
      var secondBtn = familyButton(1);
      if (!firstBtn || !secondBtn) {
        failures.push({ kind: 'missing-family-buttons' });
        return finish(failures);
      }

      window.scrollTo(0, 520);
      clickAndCheck(firstBtn, 'Hide insight', failures, 'open-first', function () {
        var firstFamily = familyName(firstBtn);
        if (!insightRowFor(firstFamily)) failures.push({ kind: 'first-not-open', family: firstFamily });

        expandEndpointsFor(firstBtn, failures, 'expand-first-family', function () {
          clickAndCheck(firstBtn, 'Show insight', failures, 'close-first', function () {
            if (insightRowFor(firstFamily)) failures.push({ kind: 'first-not-closed', family: firstFamily });

            clickAndCheck(firstBtn, 'Hide insight', failures, 'reopen-first', function () {
              if (!insightRowFor(firstFamily)) failures.push({ kind: 'first-not-reopened', family: firstFamily });

              clickAndCheck(secondBtn, 'Hide insight', failures, 'switch-to-second', function () {
                var secondFamily = familyName(secondBtn);
                if (!insightRowFor(secondFamily)) failures.push({ kind: 'second-not-open', family: secondFamily });
                if (insightRowFor(firstFamily)) failures.push({ kind: 'first-still-open-after-second', family: firstFamily });
                if (!onlyOneInsightRowOpen()) failures.push({ kind: 'multiple-insight-rows-open' });
                if (labelOf(firstBtn) !== 'Show insight') failures.push({ kind: 'first-label-not-reset', got: labelOf(firstBtn) });

                clickAndCheck(secondBtn, 'Show insight', failures, 'close-second', function () {
                  if (insightRowFor(secondFamily)) failures.push({ kind: 'second-not-closed', family: secondFamily });
                  finish(failures);
                });
              });
            });
          });
        });
      });
    })();
  }

  run();
})();
</script>
`
}

type familyInsightMultiRowToggle struct {
	ready    bool
	failures int
	detail   string
}

func familyInsightMultiRowToggleReport(dom string) familyInsightMultiRowToggle {
	readyRe := regexp.MustCompile(`id="family-insight-multirow-toggle-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="family-insight-multirow-toggle-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="family-insight-multirow-toggle-regression"[^>]*>([^<]*)</div>`)

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

	return familyInsightMultiRowToggle{ready: ready, failures: failures, detail: detail}
}
