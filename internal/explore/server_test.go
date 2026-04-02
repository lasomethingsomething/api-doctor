package explore

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListenLocalhost(t *testing.T) {
	ln, err := ListenLocalhost(0)
	if err != nil {
		t.Fatalf("listen failed: %v", err)
	}
	defer ln.Close()
	if !strings.HasPrefix(ln.Addr().String(), "127.0.0.1:") {
		t.Fatalf("expected 127.0.0.1 binding, got %s", ln.Addr().String())
	}
}

func TestHandlerPayloadEndpoint(t *testing.T) {
	payload := &Payload{Run: RunContext{SpecPath: "spec.json"}, Summary: Summary{TotalFindings: 2}}
	ts := httptest.NewServer(NewHandler(payload))
	defer ts.Close()

	res, err := http.Get(ts.URL + "/api/payload")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}

	var got Payload
	if err := json.NewDecoder(res.Body).Decode(&got); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if got.Run.SpecPath != "spec.json" || got.Summary.TotalFindings != 2 {
		t.Fatalf("unexpected payload content")
	}
}
