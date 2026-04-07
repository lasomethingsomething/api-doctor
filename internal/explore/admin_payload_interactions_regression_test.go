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

	"github.com/lasomethingsomething/api-doctor/internal/endpoint"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
	"github.com/lasomethingsomething/api-doctor/internal/rule"
	"github.com/lasomethingsomething/api-doctor/internal/workflow"
)

func TestAdminPayloadTopLevelInteractionsRemainResponsive(t *testing.T) {
	chromePath := findChromeForResetRegression()
	if chromePath == "" {
		t.Skip("skipping browser regression: Google Chrome not available")
	}

	payload := adminPayloadRegressionPayload(t)
	outDir := t.TempDir()
	htmlPath := filepath.Join(outDir, "admin-payload-interactions-regression.html")
	if err := os.WriteFile(htmlPath, []byte(inlineAdminPayloadInteractionsDocument(t, payload)), 0o600); err != nil {
		t.Fatalf("write regression fixture: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		chromePath,
		"--headless",
		"--disable-gpu",
		"--no-sandbox",
		"--hide-scrollbars",
		"--run-all-compositor-stages-before-draw",
		"--virtual-time-budget=15000",
		"--window-size=1440,1800",
		"--dump-dom",
		"file://"+htmlPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("chrome regression run failed: %v\n%s", err, out)
	}

	report := adminPayloadInteractionsReport(string(out))
	if !report.ready {
		t.Fatalf("admin payload interaction regression script did not finish\n%s", out)
	}
	if report.failures != 0 {
		t.Fatalf("expected top-level explorer interactions to stay responsive for adminapi payload, got %d failures\n%s", report.failures, report.detail)
	}
}

func adminPayloadRegressionPayload(t *testing.T) *Payload {
	t.Helper()

	parser := openapi.NewParser()
	analysis, err := parser.ParseFile(filepath.Join("..", "..", "adminapi.json"))
	if err != nil {
		t.Fatalf("parse adminapi.json: %v", err)
	}

	checker := rule.NewChecker()
	analysis.Issues = checker.CheckAll(analysis.Operations)
	endpointScores := endpoint.ScoreOperations(analysis.Operations, analysis.Issues)
	graph := workflow.Infer(analysis.Operations)
	workflowScores := workflow.ScoreGraph(graph, analysis.Operations, analysis.Issues)
	chainScores := workflow.ScoreChains(graph, analysis.Operations, analysis.Issues)

	return BuildPayload(
		analysis,
		endpointScores,
		graph,
		workflowScores,
		chainScores,
		nil,
		time.Date(2026, time.April, 7, 12, 0, 0, 0, time.UTC),
		"",
		"",
	)
}

func inlineAdminPayloadInteractionsDocument(t *testing.T, payload *Payload) string {
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
<div id="admin-payload-interactions-regression" hidden data-ready="false" data-failures="-1"></div>
<script>
`+string(jsBytes)+`
</script>`+adminPayloadInteractionsHarness(),
		1,
	)
	return doc
}

func adminPayloadInteractionsHarness() string {
	return `
<script>
(function () {
  function node() { return document.getElementById('admin-payload-interactions-regression'); }
  var finished = false;
  var watchdog = window.setTimeout(function () {
    if (finished) return;
    finish([{ kind: 'timeout', rows: document.querySelectorAll('tr.family-row[data-family-row="true"]').length }]);
  }, 12000);

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

  function waitFor(condition, done) {
    var start = Date.now();
    (function poll() {
      if (condition()) return done();
      if (Date.now() - start > 5000) return done(new Error('wait-timeout'));
      window.setTimeout(poll, 60);
    })();
  }

  function click(selector, failures, step) {
    var el = document.querySelector(selector);
    if (!el) {
      failures.push({ kind: 'missing-target', step: step, selector: selector });
      return null;
    }
    el.click();
    return el;
  }

  function run() {
    var failures = [];
    waitFor(function () {
      return document.querySelectorAll('button.quick-action[data-id]').length === 3
        && document.querySelectorAll('tr.family-row[data-family-row="true"]').length > 0;
    }, function (err) {
      if (err) {
        failures.push({ kind: 'initial-render-timeout' });
        return finish(failures);
      }

      click('button.quick-action[data-id="spec-rule"]', failures, 'open-spec-rule');
      waitFor(function () {
        return document.body.classList.contains('lens-spec-rule');
      }, function (err) {
        if (err) failures.push({ kind: 'spec-rule-tab-timeout' });

        click('button.quick-action[data-id="workflow"]', failures, 'open-workflow');
        waitFor(function () {
          return document.body.classList.contains('lens-workflow');
        }, function (err) {
          if (err) failures.push({ kind: 'workflow-tab-timeout' });

          click('button.quick-action[data-id="shape"]', failures, 'open-shape');
          waitFor(function () {
            return document.body.classList.contains('lens-shape');
          }, function (err) {
            if (err) failures.push({ kind: 'shape-tab-timeout' });

            click('button.quick-action[data-id="spec-rule"]', failures, 'return-spec-rule');
            waitFor(function () {
              return document.body.classList.contains('lens-spec-rule');
            }, function (err) {
              if (err) failures.push({ kind: 'return-spec-rule-timeout' });

              var familyBtn = click('td.family-col-name button.family-name-toggle[data-insight-toggle]', failures, 'open-family-insight');
              waitFor(function () {
                var family = familyBtn ? (familyBtn.getAttribute('data-insight-toggle') || '') : '';
                return !!family && !!document.querySelector('tr.family-inline-insight-row[data-family="' + family + '"]');
              }, function (err) {
                if (err) failures.push({ kind: 'family-insight-timeout' });
                finish(failures);
              });
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

type adminPayloadInteractions struct {
	ready    bool
	failures int
	detail   string
}

func adminPayloadInteractionsReport(dom string) adminPayloadInteractions {
	readyRe := regexp.MustCompile(`id="admin-payload-interactions-regression"[^>]*data-ready="([^"]+)"`)
	failRe := regexp.MustCompile(`id="admin-payload-interactions-regression"[^>]*data-failures="([^"]+)"`)
	textRe := regexp.MustCompile(`id="admin-payload-interactions-regression"[^>]*>([^<]*)</div>`)

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

	return adminPayloadInteractions{ready: ready, failures: failures, detail: detail}
}
