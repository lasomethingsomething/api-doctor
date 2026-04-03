package rule

import (
	"strings"
	"testing"

	"github.com/lasomethingsomething/api-doctor/internal/model"
	"github.com/lasomethingsomething/api-doctor/internal/openapi"
)

func TestMissingRequestSchemaRule(t *testing.T) {
	r := NewMissingRequestSchemaRule()
	op := &model.Operation{
		Path:        "/products",
		Method:      "POST",
		OperationID: "createProduct",
		RequestBody: &model.RequestBody{Content: map[string]*model.MediaType{
			"application/json": {Schema: nil},
		}},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "missing-request-schema" {
		t.Fatalf("expected missing-request-schema issue, got %#v", issues)
	}
}

func TestGenericObjectResponseRule(t *testing.T) {
	r := NewGenericObjectResponseRule()
	op := &model.Operation{
		Path:        "/users",
		Method:      "GET",
		OperationID: "listUsers",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{}},
					},
				},
			},
		},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "generic-object-response" {
		t.Fatalf("expected generic-object-response issue, got %#v", issues)
	}
}

func TestDeprecatedOperationRule(t *testing.T) {
	r := NewDeprecatedOperationRule()
	op := &model.Operation{Path: "/x", Method: "PUT", OperationID: "update", Deprecated: true}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "deprecated-operation" {
		t.Fatalf("expected deprecated-operation issue, got %#v", issues)
	}
}

func TestWeakArrayItemsRule_MissingRequestItems(t *testing.T) {
	r := NewWeakArrayItemsRule()
	op := &model.Operation{
		Path:        "/sync",
		Method:      "POST",
		OperationID: "sync",
		RequestBody: &model.RequestBody{Content: map[string]*model.MediaType{
			"application/json": {Schema: &model.Schema{Type: "array"}},
		}},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "weak-array-items-schema" {
		t.Fatalf("expected weak-array-items-schema issue, got %#v", issues)
	}
}

func TestWeakArrayItemsRule_GenericResponseItems(t *testing.T) {
	r := NewWeakArrayItemsRule()
	op := &model.Operation{
		Path:        "/items",
		Method:      "GET",
		OperationID: "listItems",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{
							Type:  "array",
							Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{}},
						},
					},
				},
			},
		},
	}

	issues := r.Check(op)
	if len(issues) != 1 || issues[0].Code != "weak-array-items-schema" {
		t.Fatalf("expected weak-array-items-schema issue, got %#v", issues)
	}
}

func TestWeakArrayItemsRule_StrongItemsNoIssue(t *testing.T) {
	r := NewWeakArrayItemsRule()
	op := &model.Operation{
		Path:        "/items",
		Method:      "GET",
		OperationID: "listItems",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{
							Type: "array",
							Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
								"id": {Type: "string"},
							}},
						},
					},
				},
			},
		},
	}

	issues := r.Check(op)
	if len(issues) != 0 {
		t.Fatalf("expected no issues, got %#v", issues)
	}
}

func TestChecker_CheckAll_ArrayItemsContrastFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/array-items-contrast.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from contrast fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-array-items-schema" {
		t.Fatalf("expected weak-array-items-schema issue, got %#v", issue)
	}
	if issue.Path != "/weak-items" {
		t.Fatalf("expected weak endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "get listWeakItems (200)" {
		t.Fatalf("expected weak operation details, got %#v", issue)
	}
}

func TestChecker_CheckAll_LikelyMissingEnumFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/likely-missing-enum.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from enum fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "likely-missing-enum" {
		t.Fatalf("expected likely-missing-enum issue, got %#v", issue)
	}
	if issue.Path != "/weak-enum" {
		t.Fatalf("expected weak enum endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "get getWeakEnum (200)" {
		t.Fatalf("expected weak enum operation details, got %#v", issue)
	}
	if issue.Message == "" {
		t.Fatalf("expected descriptive issue message, got %#v", issue)
	}
}

func TestChecker_CheckAll_InconsistentResponseShapesFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/inconsistent-response-shapes.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "inconsistent-response-shape" {
			matched = append(matched, issue)
		}
	}
	if len(matched) != 2 {
		t.Fatalf("expected exactly 2 inconsistent-response-shape issues from fixture, got %#v", matched)
	}

	for _, issue := range matched {
		if issue.Code != "inconsistent-response-shape" {
			t.Fatalf("expected inconsistent-response-shape, got %#v", issue)
		}
		if issue.Path != "/weak-items/{id}" && issue.Path != "/weak-items/{itemId}" {
			t.Fatalf("expected only weak item endpoints to trigger, got %#v", issue)
		}
	}
}

func TestChecker_CheckAll_InconsistentResponseShapesFamilyFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/inconsistent-response-shapes-family.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "inconsistent-response-shape" {
			matched = append(matched, issue)
		}
	}
	if len(matched) != 2 {
		t.Fatalf("expected exactly 2 inconsistent-response-shape issues from family fixture, got %#v", matched)
	}

	for _, issue := range matched {
		if issue.Code != "inconsistent-response-shape" {
			t.Fatalf("expected inconsistent-response-shape, got %#v", issue)
		}
		if issue.Path != "/weak-items/by-id/{id}" && issue.Path != "/weak-items/by-code/{code}" {
			t.Fatalf("expected only weak family endpoints to trigger, got %#v", issue)
		}
	}
}

func TestChecker_CheckAll_DetailPathParameterNameDriftFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/detail-path-parameter-name-drift.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "detail-path-parameter-name-drift" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 2 {
		t.Fatalf("expected exactly 2 detail-path-parameter-name-drift issues, got %#v", matched)
	}

	for _, issue := range matched {
		if issue.Path != "/weak-items/{id}" && issue.Path != "/weak-items/{itemId}" {
			t.Fatalf("expected weak detail endpoints only, got %#v", issue)
		}
		if !strings.Contains(issue.Message, "id, itemId") {
			t.Fatalf("expected message to include drifted identifier names, got %#v", issue)
		}
	}
}

func TestChecker_CheckAll_EndpointPathStyleDriftFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/endpoint-path-style-drift.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "endpoint-path-style-drift" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 endpoint-path-style-drift issue, got %#v", matched)
	}

	issue := matched[0]
	if issue.Path != "/catalog/{id}/media_upload" {
		t.Fatalf("expected only the non-dominant snake_case endpoint to be flagged, got %#v", issue)
	}
	if !strings.Contains(issue.Message, "dominant: kebab-case") {
		t.Fatalf("expected dominant-style hint in message, got %#v", issue)
	}
	if strings.Contains(issue.Path, "/_action/") || strings.Contains(issue.Path, "/search/") {
		t.Fatalf("expected excluded prefixes to be ignored, got %#v", issue)
	}
}

func TestChecker_CheckAll_SiblingPathShapeDriftFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/sibling-path-shape-drift.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "sibling-path-shape-drift" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 sibling-path-shape-drift issue, got %#v", matched)
	}

	issue := matched[0]
	if issue.Path != "/catalog/{id}/detail" {
		t.Fatalf("expected only minority catalog shape endpoint to be flagged, got %#v", issue)
	}
	if !strings.Contains(issue.Message, "mostly use shape") {
		t.Fatalf("expected plain-language dominant-vs-observed message, got %#v", issue)
	}
	if strings.Contains(issue.Path, "/_action/") || strings.Contains(issue.Path, "/search/") {
		t.Fatalf("expected excluded families to be ignored, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakFollowUpLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-follow-up-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from follow-up linkage fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-follow-up-linkage" {
		t.Fatalf("expected weak-follow-up-linkage issue, got %#v", issue)
	}
	if issue.Path != "/weak-items" {
		t.Fatalf("expected only weak list endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post createWeakItem (200)" {
		t.Fatalf("expected weak create operation details, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakListDetailLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-list-detail-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from list-detail linkage fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-list-detail-linkage" {
		t.Fatalf("expected weak-list-detail-linkage issue, got %#v", issue)
	}
	if issue.Path != "/weak-items/search" {
		t.Fatalf("expected only weak search endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post searchWeakItems (200)" {
		t.Fatalf("expected weak search operation details, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakAcceptedTrackingLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-accepted-tracking-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from accepted tracking fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-accepted-tracking-linkage" {
		t.Fatalf("expected weak-accepted-tracking-linkage issue, got %#v", issue)
	}
	if issue.Path != "/imports/run" {
		t.Fatalf("expected only weak accepted endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post startWeakImport (202)" {
		t.Fatalf("expected weak accepted operation details, got %#v", issue)
	}
	if issue.Message == "" {
		t.Fatalf("expected descriptive accepted tracking message, got %#v", issue)
	}
}

func TestChecker_CheckAll_WeakActionFollowUpLinkageFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-action-follow-up-linkage.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	if len(issues) != 1 {
		t.Fatalf("expected exactly 1 issue from action follow-up fixture, got %#v", issues)
	}

	issue := issues[0]
	if issue.Code != "weak-action-follow-up-linkage" {
		t.Fatalf("expected weak-action-follow-up-linkage issue, got %#v", issue)
	}
	if issue.Path != "/_action/order/{orderId}/state/{transition}" {
		t.Fatalf("expected only weak action endpoint to trigger, got %#v", issue)
	}
	if issue.Operation != "post transitionWeakOrder (200)" {
		t.Fatalf("expected weak action operation details, got %#v", issue)
	}
	if issue.Message == "" {
		t.Fatalf("expected descriptive action follow-up message, got %#v", issue)
	}
}

func TestWeakOutcomeNextActionGuidanceRule_FlagsWeakMutationOutcomeGuidance(t *testing.T) {
	r := NewWeakOutcomeNextActionGuidanceRule()
	op := &model.Operation{
		Path:        "/payments/{id}/capture",
		Method:      "POST",
		OperationID: "capturePayment",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"data": {Type: "object", Properties: map[string]*model.Schema{
								"attributes": {Type: "object", Properties: map[string]*model.Schema{
									"phase":        {Type: "string"},
									"attemptCount": {Type: "integer"},
								}},
							}},
							"meta": {Type: "object", Properties: map[string]*model.Schema{
								"requestTrace": {Type: "string"},
							}},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 1 {
		t.Fatalf("expected 1 weak outcome/next-action issue, got %#v", issues)
	}
	if issues[0].Code != "weak-outcome-next-action-guidance" {
		t.Fatalf("expected weak-outcome-next-action-guidance code, got %#v", issues[0])
	}
	lower := strings.ToLower(issues[0].Message)
	if !strings.Contains(lower, "may weaken workflow guidance") {
		t.Fatalf("expected cautious guidance wording, got %#v", issues[0])
	}
	if !strings.Contains(lower, "does not clearly communicate what changed") {
		t.Fatalf("expected outcome weakness evidence, got %#v", issues[0])
	}
	if !strings.Contains(lower, "does not clearly expose what next action is valid") {
		t.Fatalf("expected next-action weakness evidence, got %#v", issues[0])
	}
	if !strings.Contains(issues[0].Message, "Response 200 application/json") {
		t.Fatalf("expected response code/media grounding, got %#v", issues[0])
	}
}

func TestWeakOutcomeNextActionGuidanceRule_DoesNotFlagClearOutcomeGuidance(t *testing.T) {
	r := NewWeakOutcomeNextActionGuidanceRule()
	op := &model.Operation{
		Path:        "/payments/{id}/capture-preview",
		Method:      "POST",
		OperationID: "capturePaymentPreview",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"status":       {Type: "string"},
							"outcome":      {Type: "string"},
							"nextAction":   {Type: "string"},
							"captureId":    {Type: "string"},
							"contextToken": {Type: "string"},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 0 {
		t.Fatalf("expected no weak outcome/next-action issue for clear guidance response, got %#v", issues)
	}
}

func TestChecker_CheckAll_WeakOutcomeNextActionGuidanceFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/weak-outcome-next-action-guidance.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	weakGuidanceMatched := make([]*model.Issue, 0)
	snapshotMatched := make([]*model.Issue, 0)
	deepMatched := make([]*model.Issue, 0)
	dupMatched := make([]*model.Issue, 0)
	incidentalMatched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "weak-outcome-next-action-guidance" {
			weakGuidanceMatched = append(weakGuidanceMatched, issue)
		}
		if issue.Code == "snapshot-heavy-response" {
			snapshotMatched = append(snapshotMatched, issue)
		}
		if issue.Code == "deeply-nested-response-structure" {
			deepMatched = append(deepMatched, issue)
		}
		if issue.Code == "duplicated-state-response" {
			dupMatched = append(dupMatched, issue)
		}
		if issue.Code == "incidental-internal-field-exposure" {
			incidentalMatched = append(incidentalMatched, issue)
		}
	}

	if len(weakGuidanceMatched) != 1 {
		t.Fatalf("expected exactly 1 weak-outcome-next-action-guidance issue from fixture, got %#v", weakGuidanceMatched)
	}
	if weakGuidanceMatched[0].Path != "/payments/{id}/capture" {
		t.Fatalf("expected only weak outcome-guidance endpoint to trigger, got %#v", weakGuidanceMatched[0])
	}
	if len(snapshotMatched) != 0 {
		t.Fatalf("expected weak outcome-guidance fixture to stay distinct from snapshot-heavy detector, got %#v", snapshotMatched)
	}
	if len(deepMatched) != 0 {
		t.Fatalf("expected weak outcome-guidance fixture to stay distinct from deep-nesting detector, got %#v", deepMatched)
	}
	if len(dupMatched) != 0 {
		t.Fatalf("expected weak outcome-guidance fixture to stay distinct from duplicated-state detector, got %#v", dupMatched)
	}
	if len(incidentalMatched) != 0 {
		t.Fatalf("expected weak outcome-guidance fixture to stay distinct from incidental-field detector, got %#v", incidentalMatched)
	}
}

func TestChecker_CheckAll_PrerequisiteTaskBurdenFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/prerequisite-task-burden.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "prerequisite-task-burden" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 4 {
		t.Fatalf("expected exactly 4 prerequisite-task-burden issues from fixture, got %#v", matched)
	}

	byPath := map[string]*model.Issue{}
	for _, issue := range matched {
		byPath[issue.Path] = issue
		if issue.Severity != "warning" {
			t.Fatalf("expected warning severity for burden issue, got %#v", issue)
		}
		if !strings.Contains(issue.Message, "appears likely") {
			t.Fatalf("expected cautious wording in message, got %#v", issue)
		}
	}

	for _, expectedPath := range []string{
		"/products",
		"/products/{id}",
		"/_action/order/{orderId}/state/{transition}",
		"/products/{id}/media",
	} {
		if _, ok := byPath[expectedPath]; !ok {
			t.Fatalf("expected prerequisite-task-burden issue for %s, got %#v", expectedPath, matched)
		}
	}

	if _, ok := byPath["/profiles/{id}"]; ok {
		t.Fatalf("did not expect task-level update endpoint to be flagged, got %#v", byPath["/profiles/{id}"])
	}

	createIssue := byPath["/products"]
	if !strings.Contains(createIssue.Message, "requires") || !strings.Contains(createIssue.Message, "identifier-like inputs") {
		t.Fatalf("expected dependent identifier count reason for create flow, got %#v", createIssue)
	}
	if !strings.Contains(createIssue.Message, "likely needs pre-task identifier lookup") {
		t.Fatalf("expected pre-task lookup reason for create flow, got %#v", createIssue)
	}
	if !strings.Contains(createIssue.Message, "does not clearly expose") {
		t.Fatalf("expected weak follow-up exposure reason for create flow, got %#v", createIssue)
	}
}

func TestChecker_CheckAll_ContractShapeWorkflowGuidanceBurdenFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/contract-shape-workflow-guidance-burden.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "contract-shape-workflow-guidance-burden" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 representative contract-shape-workflow-guidance-burden issue from fixture, got %#v", matched)
	}

	byPath := map[string]*model.Issue{}
	for _, issue := range matched {
		byPath[issue.Path] = issue
		if issue.Severity != "warning" {
			t.Fatalf("expected warning severity, got %#v", issue)
		}
		if !strings.Contains(issue.Message, "appears likely") {
			t.Fatalf("expected cautious wording in message, got %#v", issue)
		}
	}

	if _, ok := byPath["/products/{id}/sync"]; !ok {
		if _, ok := byPath["/media/{id}/replace"]; !ok {
			t.Fatalf("expected representative issue for one storage-shaped endpoint, got %#v", matched)
		}
	}

	if _, ok := byPath["/orders/{id}/cancel"]; ok {
		t.Fatalf("did not expect task-shaped cancel response to be flagged, got %#v", byPath["/orders/{id}/cancel"])
	}
	if _, ok := byPath["/profiles/{id}"]; ok {
		t.Fatalf("did not expect small update response to be flagged, got %#v", byPath["/profiles/{id}"])
	}

	selected := byPath["/products/{id}/sync"]
	if selected == nil {
		selected = byPath["/media/{id}/replace"]
	}
	message := selected.Message
	if !strings.Contains(message, "snapshot-heavy") {
		t.Fatalf("expected snapshot-heavy reason, got %#v", selected)
	}
	if !strings.Contains(message, "internal-looking") {
		t.Fatalf("expected internal exposure reason, got %#v", selected)
	}
}

func TestSnapshotHeavyResponseRule_FlagsBroadGraph(t *testing.T) {
	r := NewSnapshotHeavyResponseRule()
	op := &model.Operation{
		Path:        "/orders/{id}/sync",
		Method:      "POST",
		OperationID: "syncOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"id":        {Type: "string"},
							"versionId": {Type: "string"},
							"customer": {Type: "object", Properties: map[string]*model.Schema{
								"id":               {Type: "string"},
								"defaultAddressId": {Type: "string"},
							}},
							"addresses": {Type: "array", Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
								"id":        {Type: "string"},
								"countryId": {Type: "string"},
							}}},
							"deliveries": {Type: "array", Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
								"id":      {Type: "string"},
								"stateId": {Type: "string"},
							}}},
							"transactions": {Type: "array", Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
								"id":              {Type: "string"},
								"paymentMethodId": {Type: "string"},
							}}},
							"lineItems": {Type: "array", Items: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
								"id":        {Type: "string"},
								"productId": {Type: "string"},
							}}},
							"relationships": {Type: "object", Properties: map[string]*model.Schema{
								"linkedOrderIds": {Type: "array", Items: &model.Schema{Type: "string"}},
							}},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 1 {
		t.Fatalf("expected 1 snapshot-heavy issue, got %#v", issues)
	}
	if issues[0].Code != "snapshot-heavy-response" {
		t.Fatalf("expected snapshot-heavy-response code, got %#v", issues[0])
	}
	if !strings.Contains(strings.ToLower(issues[0].Message), "appears snapshot-heavy") {
		t.Fatalf("expected cautious snapshot-heavy wording, got %#v", issues[0])
	}
	if !strings.Contains(issues[0].Message, "Response 200 application/json") {
		t.Fatalf("expected response code/media grounding, got %#v", issues[0])
	}
}

func TestSnapshotHeavyResponseRule_DoesNotFlagCompactOutcome(t *testing.T) {
	r := NewSnapshotHeavyResponseRule()
	op := &model.Operation{
		Path:        "/orders/{id}/cancel",
		Method:      "POST",
		OperationID: "cancelOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"success":      {Type: "boolean"},
							"status":       {Type: "string"},
							"nextAction":   {Type: "string"},
							"contextToken": {Type: "string"},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 0 {
		t.Fatalf("expected no snapshot-heavy issue for compact outcome response, got %#v", issues)
	}
}

func TestChecker_CheckAll_SnapshotHeavyResponseFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/snapshot-heavy-response.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	matched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "snapshot-heavy-response" {
			matched = append(matched, issue)
		}
	}

	if len(matched) != 1 {
		t.Fatalf("expected exactly 1 snapshot-heavy-response issue from fixture, got %#v", matched)
	}
	issue := matched[0]
	if issue.Path != "/orders/{id}/sync" {
		t.Fatalf("expected only broad snapshot endpoint to trigger, got %#v", issue)
	}
	if !strings.Contains(issue.Message, "notable branches") {
		t.Fatalf("expected notable branch grounding in message, got %#v", issue)
	}
}

func TestDeeplyNestedResponseStructureRule_FlagsDeepPaths(t *testing.T) {
	r := NewDeeplyNestedResponseStructureRule()
	op := &model.Operation{
		Path:        "/orders/{id}/finalize",
		Method:      "POST",
		OperationID: "finalizeOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"data": {Type: "object", Properties: map[string]*model.Schema{
								"result": {Type: "object", Properties: map[string]*model.Schema{
									"envelope": {Type: "object", Properties: map[string]*model.Schema{
										"payload": {Type: "object", Properties: map[string]*model.Schema{
											"order": {Type: "object", Properties: map[string]*model.Schema{
												"state": {Type: "object", Properties: map[string]*model.Schema{
													"status": {Type: "string"},
												}},
											}},
										}},
									}},
								}},
							}},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 1 {
		t.Fatalf("expected 1 deep-nesting issue, got %#v", issues)
	}
	if issues[0].Code != "deeply-nested-response-structure" {
		t.Fatalf("expected deeply-nested-response-structure code, got %#v", issues[0])
	}
	lower := strings.ToLower(issues[0].Message)
	if !strings.Contains(lower, "appears deeply nested") {
		t.Fatalf("expected cautious deep-nesting wording, got %#v", issues[0])
	}
	if !strings.Contains(issues[0].Message, "Response 200 application/json") {
		t.Fatalf("expected response code/media grounding, got %#v", issues[0])
	}
	if !strings.Contains(lower, "max object nesting depth") || !strings.Contains(lower, "notable deep paths") {
		t.Fatalf("expected concrete depth/path evidence, got %#v", issues[0])
	}
}

func TestDeeplyNestedResponseStructureRule_DoesNotFlagCompactOutcome(t *testing.T) {
	r := NewDeeplyNestedResponseStructureRule()
	op := &model.Operation{
		Path:        "/orders/{id}/cancel",
		Method:      "POST",
		OperationID: "cancelOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"success":    {Type: "boolean"},
							"status":     {Type: "string"},
							"nextAction": {Type: "string"},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 0 {
		t.Fatalf("expected no deeply nested issue for compact outcome response, got %#v", issues)
	}
}

func TestChecker_CheckAll_DeeplyNestedResponseStructureFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/deeply-nested-response-structure.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	deepMatched := make([]*model.Issue, 0)
	snapshotMatched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "deeply-nested-response-structure" {
			deepMatched = append(deepMatched, issue)
		}
		if issue.Code == "snapshot-heavy-response" {
			snapshotMatched = append(snapshotMatched, issue)
		}
	}

	if len(deepMatched) != 1 {
		t.Fatalf("expected exactly 1 deeply-nested-response-structure issue from fixture, got %#v", deepMatched)
	}
	if deepMatched[0].Path != "/orders/{id}/finalize" {
		t.Fatalf("expected only deep nested endpoint to trigger, got %#v", deepMatched[0])
	}
	if len(snapshotMatched) != 0 {
		t.Fatalf("expected deep nesting fixture to stay distinct from snapshot-heavy detector, got %#v", snapshotMatched)
	}
}

func TestDuplicatedStateResponseRule_FlagsRepeatedStateBranches(t *testing.T) {
	r := NewDuplicatedStateResponseRule()
	op := &model.Operation{
		Path:        "/orders/{id}/review",
		Method:      "POST",
		OperationID: "reviewOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"customerSummary": {Type: "object", Properties: map[string]*model.Schema{
								"name":   {Type: "string"},
								"email":  {Type: "string"},
								"status": {Type: "string"},
							}},
							"customerProfile": {Type: "object", Properties: map[string]*model.Schema{
								"name":   {Type: "string"},
								"email":  {Type: "string"},
								"status": {Type: "string"},
							}},
							"billingAddress": {Type: "object", Properties: map[string]*model.Schema{
								"line1":   {Type: "string"},
								"city":    {Type: "string"},
								"country": {Type: "string"},
							}},
							"shippingAddress": {Type: "object", Properties: map[string]*model.Schema{
								"line1":   {Type: "string"},
								"city":    {Type: "string"},
								"country": {Type: "string"},
							}},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 1 {
		t.Fatalf("expected 1 duplicated-state issue, got %#v", issues)
	}
	if issues[0].Code != "duplicated-state-response" {
		t.Fatalf("expected duplicated-state-response code, got %#v", issues[0])
	}
	lower := strings.ToLower(issues[0].Message)
	if !strings.Contains(lower, "repeat similar state across branches") {
		t.Fatalf("expected cautious repeated-state wording, got %#v", issues[0])
	}
	if !strings.Contains(issues[0].Message, "Response 200 application/json") {
		t.Fatalf("expected response code/media grounding, got %#v", issues[0])
	}
	if !strings.Contains(lower, "repeated concepts") || !strings.Contains(lower, "overlapping branch field groups") {
		t.Fatalf("expected concrete repeated-state grounding, got %#v", issues[0])
	}
}

func TestDuplicatedStateResponseRule_DoesNotFlagCompactOutcome(t *testing.T) {
	r := NewDuplicatedStateResponseRule()
	op := &model.Operation{
		Path:        "/orders/{id}/cancel",
		Method:      "POST",
		OperationID: "cancelOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"success":    {Type: "boolean"},
							"status":     {Type: "string"},
							"nextAction": {Type: "string"},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 0 {
		t.Fatalf("expected no duplicated-state issue for compact response, got %#v", issues)
	}
}

func TestChecker_CheckAll_DuplicatedStateResponseFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/duplicated-state-response.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	dupMatched := make([]*model.Issue, 0)
	snapshotMatched := make([]*model.Issue, 0)
	deepMatched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "duplicated-state-response" {
			dupMatched = append(dupMatched, issue)
		}
		if issue.Code == "snapshot-heavy-response" {
			snapshotMatched = append(snapshotMatched, issue)
		}
		if issue.Code == "deeply-nested-response-structure" {
			deepMatched = append(deepMatched, issue)
		}
	}

	if len(dupMatched) != 1 {
		t.Fatalf("expected exactly 1 duplicated-state-response issue from fixture, got %#v", dupMatched)
	}
	if dupMatched[0].Path != "/orders/{id}/review" {
		t.Fatalf("expected only repeated-state endpoint to trigger, got %#v", dupMatched[0])
	}
	if len(snapshotMatched) != 0 {
		t.Fatalf("expected duplicated-state fixture to stay distinct from snapshot-heavy detector, got %#v", snapshotMatched)
	}
	if len(deepMatched) != 0 {
		t.Fatalf("expected duplicated-state fixture to stay distinct from deep-nesting detector, got %#v", deepMatched)
	}
}

func TestIncidentalInternalFieldExposureRule_FlagsBackendOrientedFields(t *testing.T) {
	r := NewIncidentalInternalFieldExposureRule()
	op := &model.Operation{
		Path:        "/orders/{id}/ack",
		Method:      "POST",
		OperationID: "ackOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"id":                  {Type: "string"},
							"status":              {Type: "string"},
							"nextAction":          {Type: "string"},
							"versionId":           {Type: "string"},
							"createdById":         {Type: "string"},
							"updatedById":         {Type: "string"},
							"stateMachineState":   {Type: "string"},
							"stateMachineStateId": {Type: "string"},
							"customFields":        {Type: "object", Properties: map[string]*model.Schema{"internalTag": {Type: "string"}}},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 1 {
		t.Fatalf("expected 1 incidental/internal issue, got %#v", issues)
	}
	if issues[0].Code != "incidental-internal-field-exposure" {
		t.Fatalf("expected incidental-internal-field-exposure code, got %#v", issues[0])
	}
	lower := strings.ToLower(issues[0].Message)
	if !strings.Contains(lower, "appears to expose incidental/internal fields") {
		t.Fatalf("expected cautious internal-field wording, got %#v", issues[0])
	}
	if !strings.Contains(issues[0].Message, "Response 200 application/json") {
		t.Fatalf("expected response code/media grounding, got %#v", issues[0])
	}
	if !strings.Contains(lower, "notable field paths") {
		t.Fatalf("expected concrete field/path grounding, got %#v", issues[0])
	}
}

func TestIncidentalInternalFieldExposureRule_DoesNotFlagCompactOutcome(t *testing.T) {
	r := NewIncidentalInternalFieldExposureRule()
	op := &model.Operation{
		Path:        "/orders/{id}/cancel",
		Method:      "POST",
		OperationID: "cancelOrder",
		Responses: map[string]*model.Response{
			"200": {
				Content: map[string]*model.MediaType{
					"application/json": {
						Schema: &model.Schema{Type: "object", Properties: map[string]*model.Schema{
							"success":    {Type: "boolean"},
							"status":     {Type: "string"},
							"nextAction": {Type: "string"},
						}},
					},
				},
			},
		},
	}

	issues := r.CheckAll([]*model.Operation{op})
	if len(issues) != 0 {
		t.Fatalf("expected no incidental/internal issue for compact outcome response, got %#v", issues)
	}
}

func TestChecker_CheckAll_IncidentalInternalFieldExposureFixture(t *testing.T) {
	parser := openapi.NewParser()
	result, err := parser.ParseFile("../../testdata/incidental-internal-field-exposure.json")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}

	issues := NewChecker().CheckAll(result.Operations)
	incidentalMatched := make([]*model.Issue, 0)
	snapshotMatched := make([]*model.Issue, 0)
	deepMatched := make([]*model.Issue, 0)
	dupMatched := make([]*model.Issue, 0)
	for _, issue := range issues {
		if issue.Code == "incidental-internal-field-exposure" {
			incidentalMatched = append(incidentalMatched, issue)
		}
		if issue.Code == "snapshot-heavy-response" {
			snapshotMatched = append(snapshotMatched, issue)
		}
		if issue.Code == "deeply-nested-response-structure" {
			deepMatched = append(deepMatched, issue)
		}
		if issue.Code == "duplicated-state-response" {
			dupMatched = append(dupMatched, issue)
		}
	}

	if len(incidentalMatched) != 1 {
		t.Fatalf("expected exactly 1 incidental-internal-field-exposure issue from fixture, got %#v", incidentalMatched)
	}
	if incidentalMatched[0].Path != "/orders/{id}/ack" {
		t.Fatalf("expected only internal-field-heavy endpoint to trigger, got %#v", incidentalMatched[0])
	}
	if len(snapshotMatched) != 0 {
		t.Fatalf("expected incidental-field fixture to stay distinct from snapshot-heavy detector, got %#v", snapshotMatched)
	}
	if len(deepMatched) != 0 {
		t.Fatalf("expected incidental-field fixture to stay distinct from deep-nesting detector, got %#v", deepMatched)
	}
	if len(dupMatched) != 0 {
		t.Fatalf("expected incidental-field fixture to stay distinct from duplicated-state detector, got %#v", dupMatched)
	}
}

// ─── Spec-rule tests ──────────────────────────────────────────────────────────

func TestSpecResponseDescriptionRequiredRule_Missing(t *testing.T) {
	r := NewSpecResponseDescriptionRequiredRule()
	op := &model.Operation{
		Path:        "/orders",
		Method:      "GET",
		OperationID: "listOrders",
		Responses: map[string]*model.Response{
			"200": {Code: "200", Description: ""},
		},
	}
	issues := r.Check(op)
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d: %#v", len(issues), issues)
	}
	issue := issues[0]
	if issue.Code != "oas-response-description-required" {
		t.Fatalf("wrong code: %s", issue.Code)
	}
	if issue.EvidenceType != "spec-rule" {
		t.Fatalf("expected spec-rule evidence type, got %q", issue.EvidenceType)
	}
	if issue.SpecRuleID != "OAS-RESPONSE-DESCRIPTION-REQUIRED" {
		t.Fatalf("expected OAS-RESPONSE-DESCRIPTION-REQUIRED, got %q", issue.SpecRuleID)
	}
	if issue.NormativeLevel != "REQUIRED" {
		t.Fatalf("expected REQUIRED, got %q", issue.NormativeLevel)
	}
	if issue.Severity != "error" {
		t.Fatalf("expected error severity, got %q", issue.Severity)
	}
}

func TestSpecResponseDescriptionRequiredRule_Present(t *testing.T) {
	r := NewSpecResponseDescriptionRequiredRule()
	op := &model.Operation{
		Path:        "/orders",
		Method:      "GET",
		OperationID: "listOrders",
		Responses: map[string]*model.Response{
			"200": {Code: "200", Description: "A list of orders"},
		},
	}
	if issues := r.Check(op); len(issues) != 0 {
		t.Fatalf("expected no issues, got %#v", issues)
	}
}

func TestSpecOperationIDUniqueRule_Duplicate(t *testing.T) {
	r := NewSpecOperationIDUniqueRule()
	ops := []*model.Operation{
		{Path: "/orders", Method: "GET", OperationID: "listItems"},
		{Path: "/items", Method: "GET", OperationID: "listItems"},
	}
	issues := r.CheckAll(ops)
	if len(issues) != 2 {
		t.Fatalf("expected 2 issues (one per duplicate op), got %d: %#v", len(issues), issues)
	}
	for _, issue := range issues {
		if issue.EvidenceType != "spec-rule" {
			t.Fatalf("expected spec-rule evidence type, got %q", issue.EvidenceType)
		}
		if issue.SpecRuleID != "OAS-OPERATION-ID-UNIQUE" {
			t.Fatalf("expected OAS-OPERATION-ID-UNIQUE, got %q", issue.SpecRuleID)
		}
		if issue.NormativeLevel != "MUST" {
			t.Fatalf("expected MUST, got %q", issue.NormativeLevel)
		}
		if issue.Severity != "error" {
			t.Fatalf("expected error severity, got %q", issue.Severity)
		}
	}
}

func TestSpecOperationIDUniqueRule_Unique(t *testing.T) {
	r := NewSpecOperationIDUniqueRule()
	ops := []*model.Operation{
		{Path: "/orders", Method: "GET", OperationID: "listOrders"},
		{Path: "/items", Method: "GET", OperationID: "listItems"},
	}
	if issues := r.CheckAll(ops); len(issues) != 0 {
		t.Fatalf("expected no issues, got %#v", issues)
	}
}

func TestSpecNoSuccessResponseRule_Missing(t *testing.T) {
	r := NewSpecNoSuccessResponseRule()
	op := &model.Operation{
		Path:        "/webhooks",
		Method:      "POST",
		OperationID: "triggerWebhook",
		Responses: map[string]*model.Response{
			"400": {Code: "400", Description: "Bad request"},
		},
	}
	issues := r.Check(op)
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d: %#v", len(issues), issues)
	}
	issue := issues[0]
	if issue.Code != "oas-no-success-response" {
		t.Fatalf("wrong code: %s", issue.Code)
	}
	if issue.NormativeLevel != "SHOULD" {
		t.Fatalf("expected SHOULD, got %q", issue.NormativeLevel)
	}
	if issue.Severity != "warning" {
		t.Fatalf("expected warning severity, got %q", issue.Severity)
	}
}

func TestSpecNoSuccessResponseRule_HasDefault(t *testing.T) {
	r := NewSpecNoSuccessResponseRule()
	op := &model.Operation{
		Path:        "/webhooks",
		Method:      "POST",
		OperationID: "triggerWebhook",
		Responses: map[string]*model.Response{
			"default": {Code: "default", Description: "Successful response"},
		},
	}
	if issues := r.Check(op); len(issues) != 0 {
		t.Fatalf("expected no issues with 'default' response, got %#v", issues)
	}
}

func TestSpecGetRequestBodyRule_GetWithBody(t *testing.T) {
	r := NewSpecGetRequestBodyRule()
	op := &model.Operation{
		Path:        "/search",
		Method:      "GET",
		OperationID: "searchItems",
		RequestBody: &model.RequestBody{
			Content: map[string]*model.MediaType{
				"application/json": {Schema: &model.Schema{Type: "object"}},
			},
		},
	}
	issues := r.Check(op)
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d: %#v", len(issues), issues)
	}
	issue := issues[0]
	if issue.Code != "oas-get-request-body" {
		t.Fatalf("wrong code: %s", issue.Code)
	}
	if issue.NormativeLevel != "SHOULD NOT" {
		t.Fatalf("expected SHOULD NOT, got %q", issue.NormativeLevel)
	}
	if issue.Severity != "warning" {
		t.Fatalf("expected warning severity, got %q", issue.Severity)
	}
}

func TestSpecGetRequestBodyRule_PostWithBody(t *testing.T) {
	r := NewSpecGetRequestBodyRule()
	op := &model.Operation{
		Path:        "/orders",
		Method:      "POST",
		OperationID: "createOrder",
		RequestBody: &model.RequestBody{
			Content: map[string]*model.MediaType{
				"application/json": {Schema: &model.Schema{Type: "object"}},
			},
		},
	}
	if issues := r.Check(op); len(issues) != 0 {
		t.Fatalf("POST with body should not be flagged, got %#v", issues)
	}
}

func TestSpecEmptyResponseContentRule_204WithContent(t *testing.T) {
	r := NewSpecEmptyResponseContentRule()
	op := &model.Operation{
		Path:        "/orders/{id}",
		Method:      "DELETE",
		OperationID: "deleteOrder",
		Responses: map[string]*model.Response{
			"204": {
				Code:        "204",
				Description: "No content",
				Content: map[string]*model.MediaType{
					"application/json": {Schema: &model.Schema{Type: "object"}},
				},
			},
		},
	}
	issues := r.Check(op)
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d: %#v", len(issues), issues)
	}
	issue := issues[0]
	if issue.Code != "oas-204-has-content" {
		t.Fatalf("wrong code: %s", issue.Code)
	}
	if issue.NormativeLevel != "SHOULD NOT" {
		t.Fatalf("expected SHOULD NOT, got %q", issue.NormativeLevel)
	}
}

func TestSpecEmptyResponseContentRule_204NoContent(t *testing.T) {
	r := NewSpecEmptyResponseContentRule()
	op := &model.Operation{
		Path:        "/orders/{id}",
		Method:      "DELETE",
		OperationID: "deleteOrder",
		Responses: map[string]*model.Response{
			"204": {Code: "204", Description: "No content", Content: map[string]*model.MediaType{}},
		},
	}
	if issues := r.Check(op); len(issues) != 0 {
		t.Fatalf("expected no issues, got %#v", issues)
	}
}

func TestSpecRuleFindings_HaveSpecRuleCategory(t *testing.T) {
	// Integration: run checker on an op with a missing response description and
	// verify the issue carries spec-rule evidence type.
	checker := NewChecker()
	ops := []*model.Operation{
		{
			Path:        "/orders",
			Method:      "GET",
			OperationID: "listOrders",
			Responses: map[string]*model.Response{
				"200": {Code: "200", Description: ""},
			},
		},
	}
	issues := checker.CheckAll(ops)
	var specRuleIssues []*model.Issue
	for _, issue := range issues {
		if issue.EvidenceType == "spec-rule" {
			specRuleIssues = append(specRuleIssues, issue)
		}
	}
	if len(specRuleIssues) == 0 {
		t.Fatal("expected at least one spec-rule issue from checker")
	}
	for _, issue := range specRuleIssues {
		if issue.SpecRuleID == "" {
			t.Fatalf("spec-rule issue missing SpecRuleID: %#v", issue)
		}
		if issue.NormativeLevel == "" {
			t.Fatalf("spec-rule issue missing NormativeLevel: %#v", issue)
		}
		if issue.SpecSource == "" {
			t.Fatalf("spec-rule issue missing SpecSource: %#v", issue)
		}
	}
}
