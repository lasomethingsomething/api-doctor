package rule

import (
	"fmt"
	"sort"
	"strings"

	"github.com/lasomethingsomething/api-doctor/internal/model"
)

type Checker struct {
	rules    []Rule
	setRules []SetRule
}

type Rule interface {
	Check(op *model.Operation) []*model.Issue
	Name() string
}

type SetRule interface {
	CheckAll(operations []*model.Operation) []*model.Issue
	Name() string
}

func NewChecker() *Checker {
	return &Checker{
		rules: []Rule{
			NewMissingRequestSchemaRule(),
			NewMissingResponseSchemaRule(),
			NewGenericObjectRequestRule(),
			NewGenericObjectResponseRule(),
			NewWeakArrayItemsRule(),
			NewLikelyMissingEnumRule(),
			NewDeprecatedOperationRule(),
			// Spec-grounded per-operation rules (OAS normative language)
			NewSpecResponseDescriptionRequiredRule(),
			NewSpecNoSuccessResponseRule(),
			NewSpecGetRequestBodyRule(),
			NewSpecEmptyResponseContentRule(),
		},
		setRules: []SetRule{
			NewInconsistentResponseShapeRule(),
			NewDetailPathParameterNameDriftRule(),
			NewEndpointPathStyleDriftRule(),
			NewSiblingPathShapeDriftRule(),
			NewWeakFollowUpLinkageRule(),
			NewWeakListDetailLinkageRule(),
			NewWeakAcceptedTrackingLinkageRule(),
			NewWeakActionFollowUpLinkageRule(),
			NewWeakOutcomeNextActionGuidanceRule(),
			NewPrerequisiteTaskBurdenRule(),
			NewDuplicatedStateResponseRule(),
			NewIncidentalInternalFieldExposureRule(),
			NewDeeplyNestedResponseStructureRule(),
			NewSnapshotHeavyResponseRule(),
			NewContractShapeWorkflowGuidanceBurdenRule(),
			// Spec-grounded set rules (OAS normative language, require all operations)
			NewSpecOperationIDUniqueRule(),
		},
	}
}

func (c *Checker) CheckAll(operations []*model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		for _, r := range c.rules {
			issues = append(issues, r.Check(op)...)
		}
	}
	for _, r := range c.setRules {
		issues = append(issues, r.CheckAll(operations)...)
	}
	return issues
}

type MissingRequestSchemaRule struct{}

func NewMissingRequestSchemaRule() *MissingRequestSchemaRule { return &MissingRequestSchemaRule{} }
func (r *MissingRequestSchemaRule) Name() string             { return "missing-request-schema" }

func (r *MissingRequestSchemaRule) Check(op *model.Operation) []*model.Issue {
	if op.RequestBody == nil {
		return nil
	}
	issues := make([]*model.Issue, 0)
	for mtName, mt := range op.RequestBody.Content {
		if mt == nil || mt.Schema == nil {
			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "error",
				Path:        op.Path,
				Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
				Message:     fmt.Sprintf("Request body has no schema for media type '%s'", mtName),
				Description: "Request bodies should have a defined schema to describe the expected structure",
			})
		}
	}
	return issues
}

type MissingResponseSchemaRule struct{}

func NewMissingResponseSchemaRule() *MissingResponseSchemaRule { return &MissingResponseSchemaRule{} }
func (r *MissingResponseSchemaRule) Name() string              { return "missing-response-schema" }

func (r *MissingResponseSchemaRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for mtName, mt := range resp.Content {
			if mt == nil || mt.Schema == nil {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "error",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
					Message:     fmt.Sprintf("Response %s has no schema for media type '%s'", code, mtName),
					Description: "Responses with content should have a defined schema to describe the response structure",
				})
			}
		}
	}
	return issues
}

type GenericObjectRequestRule struct{}

func NewGenericObjectRequestRule() *GenericObjectRequestRule { return &GenericObjectRequestRule{} }
func (r *GenericObjectRequestRule) Name() string             { return "generic-object-request" }

func (r *GenericObjectRequestRule) Check(op *model.Operation) []*model.Issue {
	if op.RequestBody == nil {
		return nil
	}
	issues := make([]*model.Issue, 0)
	for _, mt := range op.RequestBody.Content {
		if mt != nil && isGenericObject(mt.Schema) {
			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "warning",
				Path:        op.Path,
				Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
				Message:     "Request body uses a generic object type without properties",
				Description: "Define specific properties in the request schema instead of using a generic object",
			})
		}
	}
	return issues
}

type GenericObjectResponseRule struct{}

func NewGenericObjectResponseRule() *GenericObjectResponseRule { return &GenericObjectResponseRule{} }
func (r *GenericObjectResponseRule) Name() string              { return "generic-object-response" }

func (r *GenericObjectResponseRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for _, mt := range resp.Content {
			if mt != nil && isGenericObject(mt.Schema) {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
					Message:     "Response uses a generic object type without properties",
					Description: "Define specific properties in the response schema instead of using a generic object",
				})
			}
		}
	}
	return issues
}

type WeakArrayItemsRule struct{}

func NewWeakArrayItemsRule() *WeakArrayItemsRule { return &WeakArrayItemsRule{} }
func (r *WeakArrayItemsRule) Name() string       { return "weak-array-items-schema" }

func (r *WeakArrayItemsRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)

	if op.RequestBody != nil {
		for mtName, mt := range op.RequestBody.Content {
			if mt != nil && hasWeakArrayItems(mt.Schema) {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
					Message:     fmt.Sprintf("Request body array has missing or overly generic items schema for media type '%s'", mtName),
					Description: "Generated clients depend on array item schemas for strong typing; weak item definitions often become loosely typed collections.",
				})
			}
		}
	}

	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for mtName, mt := range resp.Content {
			if mt != nil && hasWeakArrayItems(mt.Schema) {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
					Message:     fmt.Sprintf("Response array has missing or overly generic items schema for media type '%s'", mtName),
					Description: "Generated clients depend on array item schemas for strong typing; weak item definitions often become loosely typed collections.",
				})
			}
		}
	}

	return issues
}

type LikelyMissingEnumRule struct{}

func NewLikelyMissingEnumRule() *LikelyMissingEnumRule { return &LikelyMissingEnumRule{} }
func (r *LikelyMissingEnumRule) Name() string          { return "likely-missing-enum" }

func (r *LikelyMissingEnumRule) Check(op *model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)

	if op.RequestBody != nil {
		for mtName, mt := range op.RequestBody.Content {
			if mt == nil {
				continue
			}
			for _, propertyPath := range findLikelyMissingEnums(mt.Schema, "") {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
					Message:     fmt.Sprintf("Request schema property '%s' looks enum-like but has no enum for media type '%s'", propertyPath, mtName),
					Description: "Enum-like string fields without explicit enums weaken generated client typing and make allowed value changes harder to track across versions.",
				})
			}
		}
	}

	for code, resp := range op.Responses {
		if resp == nil {
			continue
		}
		for mtName, mt := range resp.Content {
			if mt == nil {
				continue
			}
			for _, propertyPath := range findLikelyMissingEnums(mt.Schema, "") {
				issues = append(issues, &model.Issue{
					Code:        r.Name(),
					Severity:    "warning",
					Path:        op.Path,
					Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
					Message:     fmt.Sprintf("Response schema property '%s' looks enum-like but has no enum for media type '%s'", propertyPath, mtName),
					Description: "Enum-like string fields without explicit enums weaken generated client typing and make allowed value changes harder to track across versions.",
				})
			}
		}
	}

	return issues
}

type DeprecatedOperationRule struct{}

func NewDeprecatedOperationRule() *DeprecatedOperationRule { return &DeprecatedOperationRule{} }
func (r *DeprecatedOperationRule) Name() string            { return "deprecated-operation" }

func (r *DeprecatedOperationRule) Check(op *model.Operation) []*model.Issue {
	if !op.Deprecated {
		return nil
	}
	return []*model.Issue{{
		Code:        r.Name(),
		Severity:    "warning",
		Path:        op.Path,
		Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
		Message:     "Operation is marked as deprecated",
		Description: "This operation is deprecated and should not be used for new integrations. Check the API documentation for recommended alternatives.",
	}}
}

type WeakFollowUpLinkageRule struct{}

func NewWeakFollowUpLinkageRule() *WeakFollowUpLinkageRule { return &WeakFollowUpLinkageRule{} }
func (r *WeakFollowUpLinkageRule) Name() string            { return "weak-follow-up-linkage" }

func (r *WeakFollowUpLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	detailParamsByBase := map[string][]string{}
	for _, op := range operations {
		basePath, paramName, ok := detailPathBaseAndParam(op.Path)
		if !ok {
			continue
		}
		detailParamsByBase[basePath] = appendUnique(detailParamsByBase[basePath], paramName)
	}

	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		if !isLikelyWorkflowSource(op) {
			continue
		}

		params := detailParamsByBase[op.Path]
		if len(params) == 0 {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok {
			continue
		}

		known, linked := exposesFollowUpIdentifier(schema, params)
		if !known || linked {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     fmt.Sprintf("Response does not clearly expose a follow-up identifier for related detail endpoint(s): %s", strings.Join(linkagePropertyCandidates(params), ", ")),
			Description: "Two-step flows are harder to automate when a collection or create response does not visibly provide the identifier needed for the next endpoint.",
		})
	}

	return issues
}

type WeakListDetailLinkageRule struct{}

func NewWeakListDetailLinkageRule() *WeakListDetailLinkageRule { return &WeakListDetailLinkageRule{} }
func (r *WeakListDetailLinkageRule) Name() string              { return "weak-list-detail-linkage" }

func (r *WeakListDetailLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	detailBases := map[string]bool{}
	for _, op := range operations {
		if basePath, ok := detailPathBaseForID(op.Path); ok {
			detailBases[basePath] = true
		}
	}

	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		basePath, ok := listOrSearchBasePath(op)
		if !ok || !detailBases[basePath] {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok {
			continue
		}

		reason, linked := listDetailLinkageReason(schema)
		if reason == "" || linked {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     fmt.Sprintf("High confidence: response item schema does not clearly expose an 'id' needed for the related detail endpoint (%s)", reason),
			Description: "List and search flows are harder to automate when the response does not visibly include the identifier needed to fetch a specific item next.",
		})
	}

	return issues
}

type WeakAcceptedTrackingLinkageRule struct{}

func NewWeakAcceptedTrackingLinkageRule() *WeakAcceptedTrackingLinkageRule {
	return &WeakAcceptedTrackingLinkageRule{}
}

func (r *WeakAcceptedTrackingLinkageRule) Name() string { return "weak-accepted-tracking-linkage" }

func (r *WeakAcceptedTrackingLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		if !isLikelyAcceptedWorkflowSource(op) {
			continue
		}

		resp, ok := op.Responses["202"]
		if !ok || resp == nil {
			continue
		}

		reason, linked := acceptedTrackingReason(resp)
		if linked || reason == "" {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (202)", op.Method, op.OperationID),
			Message:     reason,
			Description: "Accepted-now-check-later workflows are harder to automate when the initiating response does not clearly show how to track completion.",
		})
	}

	return issues
}

type WeakActionFollowUpLinkageRule struct{}

func NewWeakActionFollowUpLinkageRule() *WeakActionFollowUpLinkageRule {
	return &WeakActionFollowUpLinkageRule{}
}

func (r *WeakActionFollowUpLinkageRule) Name() string { return "weak-action-follow-up-linkage" }

func (r *WeakActionFollowUpLinkageRule) CheckAll(operations []*model.Operation) []*model.Issue {
	detailPaths := map[string]bool{}
	for _, op := range operations {
		detailPaths[op.Path] = true
	}

	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		detailPath, ok := actionTransitionDetailPath(op)
		if !ok || !detailPaths[detailPath] {
			continue
		}

		code, resp, ok := successfulResponse(op)
		if !ok {
			continue
		}

		reason, linked := actionFollowUpReason(resp)
		if linked || reason == "" {
			continue
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     fmt.Sprintf("%s for related detail endpoint %s", reason, detailPath),
			Description: "Action and transition flows are easier to verify when the response clearly shows the resulting state or makes the next detail check obvious.",
		})
	}

	return issues
}

type PrerequisiteTaskBurdenRule struct{}

type WeakOutcomeNextActionGuidanceRule struct{}

const weakOutcomeNextActionIssueLimit = 30

func NewWeakOutcomeNextActionGuidanceRule() *WeakOutcomeNextActionGuidanceRule {
	return &WeakOutcomeNextActionGuidanceRule{}
}

func (r *WeakOutcomeNextActionGuidanceRule) Name() string {
	return "weak-outcome-next-action-guidance"
}

func (r *WeakOutcomeNextActionGuidanceRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type candidate struct {
		issue *model.Issue
		score int
	}

	candidates := make([]candidate, 0)
	for _, op := range operations {
		if !isLikelyOutcomeGuidanceTarget(op) {
			continue
		}
		if isLikelyWorkflowSource(op) {
			continue
		}
		if _, ok := actionTransitionDetailPath(op); ok {
			continue
		}
		if resp202, ok := op.Responses["202"]; ok && resp202 != nil {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok || schema == nil {
			continue
		}

		ev := inspectWeakOutcomeGuidanceEvidence(schema)
		continuationLikely := isLikelyWorkflowContinuation(op)
		if !isWeakOutcomeNextActionGuidance(ev, continuationLikely, code) {
			continue
		}

		missingSignals := make([]string, 0, 5)
		if ev.OutcomeSignalCount == 0 {
			missingSignals = append(missingSignals, "does not clearly communicate what changed")
		}
		if ev.NextActionSignalCount == 0 {
			missingSignals = append(missingSignals, "does not clearly expose what next action is valid")
		}
		if ev.AuthoritativeHandoffCount == 0 {
			missingSignals = append(missingSignals, "may hide the authoritative state needed for the next step")
		}
		if ev.StructuralHintCount >= 2 && ev.OutcomeSignalCount == 0 {
			missingSignals = append(missingSignals, "may force callers to infer follow-up meaning from broad response structure")
		}
		if continuationLikely && ev.NextActionSignalCount == 0 {
			missingSignals = append(missingSignals, "operation looks follow-up-oriented but next-step meaning is weakly signaled")
		}
		if len(missingSignals) == 0 {
			missingSignals = append(missingSignals, "workflow outcome and next-step meaning appear weakly signaled")
		}

		topFields := limitStrings(ev.TopLevelFields, 6)
		notablePaths := limitStrings(ev.NotableFieldPaths, 4)
		message := fmt.Sprintf(
			"Response %s application/json may weaken workflow guidance: %s",
			code,
			strings.Join(missingSignals, "; "),
		)
		if len(topFields) > 0 {
			message += fmt.Sprintf("; top-level fields: %s", strings.Join(topFields, ", "))
		}
		if len(notablePaths) > 0 {
			message += fmt.Sprintf("; notable response paths: %s", strings.Join(notablePaths, ", "))
		}

		issue := &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     message,
			Description: "This heuristic indicates a state-changing response that may not clearly communicate what changed or what next action is valid.",
		}

		score := 0
		if ev.OutcomeSignalCount == 0 {
			score += 3
		}
		if ev.NextActionSignalCount == 0 {
			score += 3
		}
		if ev.AuthoritativeHandoffCount == 0 {
			score += 2
		}
		if ev.StructuralHintCount >= 2 {
			score += 2
		}
		if continuationLikely {
			score += 2
		}
		if code == "202" {
			score += 1
		}

		candidates = append(candidates, candidate{issue: issue, score: score})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].issue.Path != candidates[j].issue.Path {
			return candidates[i].issue.Path < candidates[j].issue.Path
		}
		return strings.ToLower(candidates[i].issue.Operation) < strings.ToLower(candidates[j].issue.Operation)
	})

	issues := make([]*model.Issue, 0, len(candidates))
	for i, cand := range candidates {
		if i >= weakOutcomeNextActionIssueLimit {
			break
		}
		issues = append(issues, cand.issue)
	}

	return issues
}

func NewPrerequisiteTaskBurdenRule() *PrerequisiteTaskBurdenRule {
	return &PrerequisiteTaskBurdenRule{}
}
func (r *PrerequisiteTaskBurdenRule) Name() string { return "prerequisite-task-burden" }

func (r *PrerequisiteTaskBurdenRule) CheckAll(operations []*model.Operation) []*model.Issue {
	detailParamsByBase := map[string][]string{}
	for _, op := range operations {
		basePath, paramName, ok := detailPathBaseAndParam(op.Path)
		if !ok {
			continue
		}
		detailParamsByBase[basePath] = appendUnique(detailParamsByBase[basePath], paramName)
	}

	issues := make([]*model.Issue, 0)
	for _, op := range operations {
		if !isLikelyContractShapeTarget(op) {
			continue
		}

		depCount, depLabels, taskFieldCount := requiredDependentIdentifierCount(op)
		lookupLikely := isLikelyPreTaskLookupNeed(depCount, taskFieldCount)
		weakFollowUp := hasWeakFollowUpExposure(op, detailParamsByBase)

		signalCount := 0
		if depCount >= 2 {
			signalCount++
		}
		if lookupLikely {
			signalCount++
		}
		if weakFollowUp {
			signalCount++
		}
		if signalCount < 2 {
			continue
		}

		reasons := make([]string, 0, 3)
		if depCount >= 2 {
			reasons = append(reasons, fmt.Sprintf("requires %d identifier-like inputs (%s)", depCount, strings.Join(depLabels, ", ")))
		}
		if lookupLikely {
			reasons = append(reasons, "likely needs pre-task identifier lookup before the main call")
		}
		if weakFollowUp {
			reasons = append(reasons, "success response does not clearly expose follow-up identifiers or state")
		}

		issues = append(issues, &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s", op.Method, op.OperationID),
			Message:     fmt.Sprintf("%s prerequisite burden appears likely: %s", prerequisiteBurdenRating(depCount, lookupLikely, weakFollowUp), strings.Join(reasons, "; ")),
			Description: "This task appears to require extra identifier coordination and follow-up context that may make the happy path feel like managing internal model state instead of completing one user task.",
		})
	}

	return issues
}

func isLikelyContractShapeTarget(op *model.Operation) bool {
	if op == nil {
		return false
	}

	method := strings.ToUpper(op.Method)
	switch method {
	case "POST", "PUT", "PATCH":
		return true
	default:
		return false
	}
}

type ContractShapeWorkflowGuidanceBurdenRule struct{}

const contractShapeIssueLimit = 20

type DuplicatedStateResponseRule struct{}

const duplicatedStateIssueLimit = 30

type IncidentalInternalFieldExposureRule struct{}

const incidentalFieldIssueLimit = 30

func NewIncidentalInternalFieldExposureRule() *IncidentalInternalFieldExposureRule {
	return &IncidentalInternalFieldExposureRule{}
}

func (r *IncidentalInternalFieldExposureRule) Name() string {
	return "incidental-internal-field-exposure"
}

func (r *IncidentalInternalFieldExposureRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type candidate struct {
		issue *model.Issue
		score int
	}

	candidates := make([]candidate, 0)
	for _, op := range operations {
		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok || schema == nil {
			continue
		}

		ev := inspectIncidentalInternalFieldEvidence(schema)
		if !isIncidentalInternalFieldExposure(ev) {
			continue
		}

		notable := limitStrings(ev.NotableFieldPaths, 5)
		reasons := make([]string, 0, 4)
		reasons = append(reasons, fmt.Sprintf("internal/back-end oriented fields=%d", ev.InternalFieldCount))
		if ev.VersionLikeCount > 0 || ev.LinkageLikeCount > 0 {
			reasons = append(reasons, fmt.Sprintf("version/linkage metadata=%d/%d", ev.VersionLikeCount, ev.LinkageLikeCount))
		}
		if ev.ScaffoldingCount > 0 {
			reasons = append(reasons, fmt.Sprintf("translated/customFields/state-machine scaffolding=%d", ev.ScaffoldingCount))
		}
		if ev.LowLevelIDCount > 0 {
			reasons = append(reasons, fmt.Sprintf("low-level identifier metadata=%d", ev.LowLevelIDCount))
		}

		notablePart := ""
		if len(notable) > 0 {
			notablePart = fmt.Sprintf("; notable field paths: %s", strings.Join(notable, ", "))
		}

		issue := &model.Issue{
			Code:      r.Name(),
			Severity:  "warning",
			Path:      op.Path,
			Operation: fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message: fmt.Sprintf(
				"Response %s application/json appears to expose incidental/internal fields: %s%s; may leak backend model structure, may increase reading cost without clarifying the workflow outcome, and may weaken task-oriented contract emphasis",
				code,
				strings.Join(reasons, ", "),
				notablePart,
			),
			Description: "This heuristic suggests response fields that look backend-oriented or model-scaffolding-heavy rather than directly useful for immediate task handoff.",
		}

		score := (ev.InternalFieldCount * 3) + (ev.VersionLikeCount * 2) + (ev.LinkageLikeCount * 2) + (ev.ScaffoldingCount * 2) + ev.LowLevelIDCount
		candidates = append(candidates, candidate{issue: issue, score: score})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].issue.Path != candidates[j].issue.Path {
			return candidates[i].issue.Path < candidates[j].issue.Path
		}
		return strings.ToLower(candidates[i].issue.Operation) < strings.ToLower(candidates[j].issue.Operation)
	})

	issues := make([]*model.Issue, 0, len(candidates))
	for i, cand := range candidates {
		if i >= incidentalFieldIssueLimit {
			break
		}
		issues = append(issues, cand.issue)
	}

	return issues
}

func NewDuplicatedStateResponseRule() *DuplicatedStateResponseRule {
	return &DuplicatedStateResponseRule{}
}

func (r *DuplicatedStateResponseRule) Name() string {
	return "duplicated-state-response"
}

func (r *DuplicatedStateResponseRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type candidate struct {
		issue *model.Issue
		score int
	}

	candidates := make([]candidate, 0)
	for _, op := range operations {
		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok || schema == nil {
			continue
		}

		ev := inspectDuplicatedStateEvidence(schema)
		if !isDuplicatedStateShape(ev) {
			continue
		}

		repeatedConcepts := limitStrings(ev.RepeatedConcepts, 4)
		overlapExamples := limitStrings(ev.OverlapExamples, 3)

		reasons := make([]string, 0, 4)
		if len(repeatedConcepts) > 0 {
			reasons = append(reasons, fmt.Sprintf("repeated concepts across branches: %s", strings.Join(repeatedConcepts, ", ")))
		}
		if len(overlapExamples) > 0 {
			reasons = append(reasons, fmt.Sprintf("overlapping branch field groups: %s", strings.Join(overlapExamples, "; ")))
		}
		if ev.RepeatedIDLikeFieldCount > 0 {
			reasons = append(reasons, fmt.Sprintf("repeated identifier/linkage-style fields across branches=%d", ev.RepeatedIDLikeFieldCount))
		}
		if len(reasons) == 0 {
			reasons = append(reasons, "similar branch shapes appear repeated")
		}

		issue := &model.Issue{
			Code:      r.Name(),
			Severity:  "warning",
			Path:      op.Path,
			Operation: fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message: fmt.Sprintf(
				"Response %s application/json appears to repeat similar state across branches: %s; may increase reading cost, may duplicate information instead of emphasizing what matters next, and may weaken task-outcome clarity",
				code,
				strings.Join(reasons, "; "),
			),
			Description: "This heuristic suggests overlapping state exposure across response branches, which can make contracts noisy and reduce focus on the most important task outcome.",
		}

		score := (len(ev.RepeatedConcepts) * 4) + (len(ev.OverlapExamples) * 3) + (ev.RepeatedIDLikeFieldCount * 2)
		candidates = append(candidates, candidate{issue: issue, score: score})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].issue.Path != candidates[j].issue.Path {
			return candidates[i].issue.Path < candidates[j].issue.Path
		}
		return strings.ToLower(candidates[i].issue.Operation) < strings.ToLower(candidates[j].issue.Operation)
	})

	issues := make([]*model.Issue, 0, len(candidates))
	for i, cand := range candidates {
		if i >= duplicatedStateIssueLimit {
			break
		}
		issues = append(issues, cand.issue)
	}

	return issues
}

type DeeplyNestedResponseStructureRule struct{}

const deepNestingIssueLimit = 30

func NewDeeplyNestedResponseStructureRule() *DeeplyNestedResponseStructureRule {
	return &DeeplyNestedResponseStructureRule{}
}

func (r *DeeplyNestedResponseStructureRule) Name() string {
	return "deeply-nested-response-structure"
}

func (r *DeeplyNestedResponseStructureRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type candidate struct {
		issue *model.Issue
		score int
	}

	candidates := make([]candidate, 0)
	for _, op := range operations {
		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok || schema == nil {
			continue
		}

		ev := inspectDeepNestingEvidence(schema)
		if !isDeeplyNestedResponseShape(ev) {
			continue
		}

		reasons := []string{
			fmt.Sprintf("max object nesting depth=%d", ev.MaxObjectDepth),
			fmt.Sprintf("max property path depth=%d", ev.MaxPathDepth),
			fmt.Sprintf("deep object chains=%d", ev.DeepObjectChainCount),
		}
		if ev.NestedArrayObjectCount > 0 {
			reasons = append(reasons, fmt.Sprintf("nested arrays of objects=%d", ev.NestedArrayObjectCount))
		}

		notablePaths := limitStrings(ev.DeepPropertyPaths, 4)
		notablePart := ""
		if len(notablePaths) > 0 {
			notablePart = fmt.Sprintf("; notable deep paths: %s", strings.Join(notablePaths, ", "))
		}

		issue := &model.Issue{
			Code:      r.Name(),
			Severity:  "warning",
			Path:      op.Path,
			Operation: fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message: fmt.Sprintf(
				"Response %s application/json appears deeply nested: %s%s; may increase reading cost, may hide the important outcome, and may weaken workflow-outcome emphasis",
				code,
				strings.Join(reasons, ", "),
				notablePart,
			),
			Description: "This heuristic suggests nested response structure complexity that can make the contract harder to scan and can bury outcome meaning beneath deep object paths.",
		}

		score := (ev.MaxObjectDepth * 5) + (ev.MaxPathDepth * 3) + (ev.DeepObjectChainCount * 2) + (ev.NestedArrayObjectCount * 2)
		candidates = append(candidates, candidate{issue: issue, score: score})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].issue.Path != candidates[j].issue.Path {
			return candidates[i].issue.Path < candidates[j].issue.Path
		}
		return strings.ToLower(candidates[i].issue.Operation) < strings.ToLower(candidates[j].issue.Operation)
	})

	issues := make([]*model.Issue, 0, len(candidates))
	for i, cand := range candidates {
		if i >= deepNestingIssueLimit {
			break
		}
		issues = append(issues, cand.issue)
	}

	return issues
}

type SnapshotHeavyResponseRule struct{}

const snapshotHeavyIssueLimit = 30

func NewSnapshotHeavyResponseRule() *SnapshotHeavyResponseRule {
	return &SnapshotHeavyResponseRule{}
}

func (r *SnapshotHeavyResponseRule) Name() string {
	return "snapshot-heavy-response"
}

func (r *SnapshotHeavyResponseRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type candidate struct {
		issue *model.Issue
		score int
	}

	candidates := make([]candidate, 0)
	for _, op := range operations {
		if !isLikelyContractShapeTarget(op) {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok || schema == nil {
			continue
		}

		stats := inspectSchemaShape(schema, 0)
		if !isSnapshotHeavyObjectGraph(stats) {
			continue
		}

		reasons := make([]string, 0, 5)
		reasons = append(reasons, fmt.Sprintf("%d top-level fields", stats.TopLevelProperties))
		reasons = append(reasons, fmt.Sprintf("%d nested object branches", stats.NestedObjectBranches))
		if stats.ArrayOfObjectBranches > 0 {
			reasons = append(reasons, fmt.Sprintf("%d arrays of nested objects", stats.ArrayOfObjectBranches))
		}
		if stats.EntityLikeNodeCount > 0 {
			reasons = append(reasons, fmt.Sprintf("%d entity-like substructures", stats.EntityLikeNodeCount))
		}
		if stats.IDLikeFieldCount > 0 || stats.VersionLikeFieldCount > 0 || stats.LinkageLikeFieldCount > 0 {
			reasons = append(reasons, fmt.Sprintf("id/version/linkage fields=%d/%d/%d", stats.IDLikeFieldCount, stats.VersionLikeFieldCount, stats.LinkageLikeFieldCount))
		}

		notable := limitStrings(stats.NotableBranches, 4)
		notablePart := ""
		if len(notable) > 0 {
			notablePart = fmt.Sprintf("; notable branches: %s", strings.Join(notable, ", "))
		}

		message := fmt.Sprintf(
			"Response %s application/json appears snapshot-heavy: %s%s; suggests broad internal object-graph exposure and may increase reading cost while weakening workflow-outcome emphasis",
			code,
			strings.Join(reasons, ", "),
			notablePart,
		)

		issue := &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     message,
			Description: "This heuristic suggests the response is broad and snapshot-like rather than compact task outcome guidance, which may hide what changed or what matters next.",
		}

		score := (stats.TopLevelProperties * 2) + stats.TotalProperties + (stats.NestedObjectBranches * 2) + (stats.ArrayOfObjectBranches * 3) + (stats.EntityLikeNodeCount * 2)
		candidates = append(candidates, candidate{issue: issue, score: score})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].issue.Path != candidates[j].issue.Path {
			return candidates[i].issue.Path < candidates[j].issue.Path
		}
		return strings.ToLower(candidates[i].issue.Operation) < strings.ToLower(candidates[j].issue.Operation)
	})

	issues := make([]*model.Issue, 0, len(candidates))
	for i, cand := range candidates {
		if i >= snapshotHeavyIssueLimit {
			break
		}
		issues = append(issues, cand.issue)
	}

	return issues
}

func NewContractShapeWorkflowGuidanceBurdenRule() *ContractShapeWorkflowGuidanceBurdenRule {
	return &ContractShapeWorkflowGuidanceBurdenRule{}
}

func (r *ContractShapeWorkflowGuidanceBurdenRule) Name() string {
	return "contract-shape-workflow-guidance-burden"
}

func (r *ContractShapeWorkflowGuidanceBurdenRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type candidate struct {
		issue *model.Issue
		score int
	}
	candidates := make([]candidate, 0)
	seenSignatures := map[string]bool{}
	for _, op := range operations {
		if !isLikelyTaskBurdenTarget(op) {
			continue
		}

		code, schema, ok := successfulJSONResponseSchema(op)
		if !ok || schema == nil {
			continue
		}

		stats := inspectSchemaShape(schema, 0)
		snapshotHeavy := isSnapshotHeavyShape(stats)
		internalExposure := isInternalStateExposure(stats)
		missingOutcomeGuidance := isMissingWorkflowOutcomeGuidance(stats)
		storageShaped := isStorageShapedOverTaskMeaning(stats)
		if !snapshotHeavy || !internalExposure {
			continue
		}

		signature := contractShapeSignature(stats)
		if seenSignatures[signature] {
			continue
		}
		seenSignatures[signature] = true

		signalCount := 0
		if snapshotHeavy {
			signalCount++
		}
		if internalExposure {
			signalCount++
		}
		if missingOutcomeGuidance {
			signalCount++
		}
		if storageShaped {
			signalCount++
		}
		reasons := make([]string, 0, 4)
		if snapshotHeavy {
			reasons = append(reasons, fmt.Sprintf("response appears snapshot-heavy (%d nested fields, depth %d)", stats.TotalProperties, stats.MaxDepth))
		}
		if internalExposure {
			reasons = append(reasons, fmt.Sprintf("response exposes many incidental internal-looking fields (%d matches)", stats.InternalLookingCount))
		}
		if missingOutcomeGuidance {
			reasons = append(reasons, "response does not clearly communicate compact workflow outcome guidance")
		}
		if storageShaped {
			reasons = append(reasons, "response emphasizes storage/model structure more than task-level meaning")
		}

		issue := &model.Issue{
			Code:        r.Name(),
			Severity:    "warning",
			Path:        op.Path,
			Operation:   fmt.Sprintf("%s %s (%s)", op.Method, op.OperationID, code),
			Message:     fmt.Sprintf("%s contract-shape/workflow-guidance burden appears likely: %s", contractShapeBurdenLevel(signalCount, stats), strings.Join(reasons, "; ")),
			Description: "This response appears closer to internal platform state than a compact task-level contract, which may force developers to infer workflow meaning and next actions manually.",
		}

		score := stats.TotalProperties + (stats.InternalLookingCount * 8) + (stats.MaxDepth * 3) + (stats.ArrayNodes * 2)
		candidates = append(candidates, candidate{issue: issue, score: score})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].issue.Path != candidates[j].issue.Path {
			return candidates[i].issue.Path < candidates[j].issue.Path
		}
		return strings.ToLower(candidates[i].issue.Operation) < strings.ToLower(candidates[j].issue.Operation)
	})

	issues := make([]*model.Issue, 0, len(candidates))
	for i, cand := range candidates {
		if i >= contractShapeIssueLimit {
			break
		}
		issues = append(issues, cand.issue)
	}
	return issues
}

func contractShapeSignature(stats schemaShapeStats) string {
	parts := []string{
		fmt.Sprintf("top=%d", stats.TopLevelProperties),
		fmt.Sprintf("total=%d", stats.TotalProperties),
		fmt.Sprintf("obj=%d", stats.ObjectNodes),
		fmt.Sprintf("arr=%d", stats.ArrayNodes),
		fmt.Sprintf("depth=%d", stats.MaxDepth),
		fmt.Sprintf("internal=%d", stats.InternalLookingCount),
		fmt.Sprintf("outcome=%d", stats.OutcomeHintCount),
		fmt.Sprintf("structural=%d", stats.StructuralHintCount),
	}
	return strings.Join(parts, "|")
}

type InconsistentResponseShapeRule struct{}

func NewInconsistentResponseShapeRule() *InconsistentResponseShapeRule {
	return &InconsistentResponseShapeRule{}
}
func (r *InconsistentResponseShapeRule) Name() string { return "inconsistent-response-shape" }

func (r *InconsistentResponseShapeRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type comparable struct {
		op       *model.Operation
		code     string
		shape    string
		groupKey string
		normPath string
	}

	groups := map[string][]comparable{}
	for _, op := range operations {
		code, shape, ok := comparableResponseShape(op)
		if !ok {
			continue
		}
		for _, groupKey := range similarEndpointGroupKeys(op) {
			groups[groupKey] = append(groups[groupKey], comparable{
				op:       op,
				code:     code,
				shape:    shape,
				groupKey: groupKey,
				normPath: normalizePathTemplate(op.Path),
			})
		}
	}

	issues := make([]*model.Issue, 0)
	seen := map[string]bool{}
	for _, entries := range groups {
		if len(entries) < 2 {
			continue
		}

		shapes := map[string]int{}
		for _, entry := range entries {
			shapes[entry.shape]++
		}
		if len(shapes) < 2 {
			continue
		}

		shapeNames := make([]string, 0, len(shapes))
		for shape := range shapes {
			shapeNames = append(shapeNames, shape)
		}
		sort.Strings(shapeNames)

		for _, entry := range entries {
			issueKey := strings.Join([]string{r.Name(), entry.op.Path, entry.op.Method, entry.op.OperationID, entry.code}, "|")
			if seen[issueKey] {
				continue
			}
			seen[issueKey] = true

			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "warning",
				Path:        entry.op.Path,
				Operation:   fmt.Sprintf("%s %s (%s)", entry.op.Method, entry.op.OperationID, entry.code),
				Message:     fmt.Sprintf("Similar endpoint group '%s' has inconsistent response shapes: %s", entry.groupKey, strings.Join(shapeNames, ", ")),
				Description: "Similar endpoints with different response shapes make generated clients and shared integration logic harder to rely on consistently.",
			})
		}
	}

	return issues
}

type DetailPathParameterNameDriftRule struct{}

func NewDetailPathParameterNameDriftRule() *DetailPathParameterNameDriftRule {
	return &DetailPathParameterNameDriftRule{}
}

func (r *DetailPathParameterNameDriftRule) Name() string { return "detail-path-parameter-name-drift" }

func (r *DetailPathParameterNameDriftRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type detailEntry struct {
		op       *model.Operation
		param    string
		groupKey string
	}

	groups := map[string][]detailEntry{}
	for _, op := range operations {
		if op == nil || strings.ToUpper(op.Method) != "GET" {
			continue
		}
		if countPathParams(op.Path) != 1 {
			continue
		}
		basePath, paramName, ok := detailPathBaseAndParam(op.Path)
		if !ok {
			continue
		}
		groupKey := strings.ToUpper(op.Method) + " " + normalizePathTemplate(basePath)
		groups[groupKey] = append(groups[groupKey], detailEntry{op: op, param: paramName, groupKey: groupKey})
	}

	issues := make([]*model.Issue, 0)
	for groupKey, entries := range groups {
		if len(entries) < 2 {
			continue
		}
		paramSet := map[string]bool{}
		for _, entry := range entries {
			paramSet[entry.param] = true
		}
		if len(paramSet) < 2 {
			continue
		}

		paramNames := make([]string, 0, len(paramSet))
		for name := range paramSet {
			paramNames = append(paramNames, name)
		}
		sort.Strings(paramNames)

		for _, entry := range entries {
			issues = append(issues, &model.Issue{
				Code:        r.Name(),
				Severity:    "warning",
				Path:        entry.op.Path,
				Operation:   fmt.Sprintf("%s %s", entry.op.Method, entry.op.OperationID),
				Message:     fmt.Sprintf("Related detail endpoints in '%s' use different identifier parameter names: %s", groupKey, strings.Join(paramNames, ", ")),
				Description: "Using multiple identifier parameter names for the same detail endpoint family makes call chaining and reusable integration code harder to keep consistent.",
			})
		}
	}

	return issues
}

type EndpointPathStyleDriftRule struct{}

func NewEndpointPathStyleDriftRule() *EndpointPathStyleDriftRule {
	return &EndpointPathStyleDriftRule{}
}

func (r *EndpointPathStyleDriftRule) Name() string { return "endpoint-path-style-drift" }

func (r *EndpointPathStyleDriftRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type styleEntry struct {
		op      *model.Operation
		segment string
		style   string
		group   string
	}

	groups := map[string][]styleEntry{}
	for _, op := range operations {
		if op == nil {
			continue
		}
		segments := splitPathSegments(op.Path)
		if len(segments) < 2 || isExcludedStyleDriftPrefix(segments[0]) {
			continue
		}

		for i := range segments {
			segment := segments[i]
			if isPathParam(segment) {
				continue
			}
			style := staticSegmentStyle(segment)
			if style == "other" {
				continue
			}

			groupParts := make([]string, 0, len(segments))
			for j, part := range segments {
				switch {
				case j == i:
					groupParts = append(groupParts, "*")
				case isPathParam(part):
					groupParts = append(groupParts, "{}")
				default:
					groupParts = append(groupParts, strings.ToLower(part))
				}
			}
			groupKey := strings.ToUpper(op.Method) + " " + joinPathSegments(groupParts)
			groups[groupKey] = append(groups[groupKey], styleEntry{op: op, segment: segment, style: style, group: groupKey})
		}
	}

	issues := make([]*model.Issue, 0)
	seen := map[string]bool{}
	for groupKey, entries := range groups {
		if len(entries) < 3 {
			continue
		}

		styleCounts := map[string]int{"kebab": 0, "snake": 0}
		for _, entry := range entries {
			if entry.style == "kebab" || entry.style == "snake" {
				styleCounts[entry.style]++
			}
		}
		if styleCounts["kebab"] == 0 || styleCounts["snake"] == 0 {
			continue
		}

		dominant := "kebab"
		if styleCounts["snake"] > styleCounts["kebab"] {
			dominant = "snake"
		}
		if styleCounts["kebab"] == styleCounts["snake"] {
			continue
		}

		for _, entry := range entries {
			if entry.style == dominant || (entry.style != "kebab" && entry.style != "snake") {
				continue
			}

			issueKey := strings.Join([]string{r.Name(), entry.op.Method, entry.op.Path, groupKey}, "|")
			if seen[issueKey] {
				continue
			}
			seen[issueKey] = true

			issues = append(issues, &model.Issue{
				Code:      r.Name(),
				Severity:  "warning",
				Path:      entry.op.Path,
				Operation: fmt.Sprintf("%s %s", entry.op.Method, entry.op.OperationID),
				Message: fmt.Sprintf(
					"Sibling endpoints in '%s' mix static segment styles (dominant: %s-case, found: %s-case segment '%s')",
					groupKey,
					dominant,
					entry.style,
					entry.segment,
				),
				Description: "Static path segments should use one naming style within a sibling endpoint family to keep endpoint discovery and integration code consistent.",
			})
		}
	}

	return issues
}

type SiblingPathShapeDriftRule struct{}

func NewSiblingPathShapeDriftRule() *SiblingPathShapeDriftRule {
	return &SiblingPathShapeDriftRule{}
}

func (r *SiblingPathShapeDriftRule) Name() string { return "sibling-path-shape-drift" }

func (r *SiblingPathShapeDriftRule) CheckAll(operations []*model.Operation) []*model.Issue {
	type shapeEntry struct {
		op        *model.Operation
		familyKey string
		signature string
		display   string
	}

	groups := map[string][]shapeEntry{}
	for _, op := range operations {
		if op == nil {
			continue
		}
		familyKey, signature, display, ok := siblingShapeInfo(op.Path)
		if !ok {
			continue
		}
		groupKey := strings.ToUpper(op.Method) + " " + familyKey
		groups[groupKey] = append(groups[groupKey], shapeEntry{
			op:        op,
			familyKey: familyKey,
			signature: signature,
			display:   display,
		})
	}

	issues := make([]*model.Issue, 0)
	seen := map[string]bool{}
	for groupKey, entries := range groups {
		if len(entries) < 3 {
			continue
		}

		sigCounts := map[string]int{}
		sigDisplay := map[string]string{}
		for _, entry := range entries {
			sigCounts[entry.signature]++
			sigDisplay[entry.signature] = entry.display
		}
		if len(sigCounts) < 2 {
			continue
		}

		type sigCount struct {
			signature string
			count     int
		}
		ranked := make([]sigCount, 0, len(sigCounts))
		for signature, count := range sigCounts {
			ranked = append(ranked, sigCount{signature: signature, count: count})
		}
		sort.Slice(ranked, func(i, j int) bool {
			if ranked[i].count != ranked[j].count {
				return ranked[i].count > ranked[j].count
			}
			return ranked[i].signature < ranked[j].signature
		})

		dominant := ranked[0]
		second := ranked[1]
		total := len(entries)

		if dominant.count == second.count {
			continue
		}
		// Strong-majority guardrail: dominant shape must cover at least two-thirds of the sibling set.
		if dominant.count*3 < total*2 {
			continue
		}

		for _, entry := range entries {
			if entry.signature == dominant.signature {
				continue
			}
			issueKey := strings.Join([]string{r.Name(), entry.op.Method, entry.op.Path, groupKey}, "|")
			if seen[issueKey] {
				continue
			}
			seen[issueKey] = true

			issues = append(issues, &model.Issue{
				Code:      r.Name(),
				Severity:  "warning",
				Path:      entry.op.Path,
				Operation: fmt.Sprintf("%s %s", entry.op.Method, entry.op.OperationID),
				Message: fmt.Sprintf(
					"Sibling endpoints in '%s' mostly use shape '%s', but this endpoint uses '%s'",
					groupKey,
					sigDisplay[dominant.signature],
					entry.display,
				),
				Description: "Sibling endpoints are easier to discover and automate when they follow one dominant path shape within a method and family.",
			})
		}
	}

	return issues
}

func isGenericObject(schema *model.Schema) bool {
	if schema == nil {
		return false
	}
	return schema.Type == "object" && len(schema.Properties) == 0 && schema.Ref == ""
}

func hasWeakArrayItems(schema *model.Schema) bool {
	if schema == nil || schema.Type != "array" {
		return false
	}
	if schema.Items == nil {
		return true
	}
	if schema.Items.Ref != "" {
		return false
	}
	if schema.Items.Type == "" {
		return true
	}
	if isGenericObject(schema.Items) {
		return true
	}
	return false
}

func comparableResponseShape(op *model.Operation) (string, string, bool) {
	if op == nil {
		return "", "", false
	}

	preferredCodes := []string{"200", "201", "202"}
	for _, code := range preferredCodes {
		if resp, ok := op.Responses[code]; ok {
			if shape, ok := responseShape(resp); ok {
				return code, shape, true
			}
		}
	}

	for code, resp := range op.Responses {
		if strings.HasPrefix(code, "2") {
			if shape, ok := responseShape(resp); ok {
				return code, shape, true
			}
		}
	}

	return "", "", false
}

func responseShape(resp *model.Response) (string, bool) {
	if resp == nil {
		return "", false
	}
	mt, ok := resp.Content["application/json"]
	if !ok || mt == nil || mt.Schema == nil {
		return "", false
	}
	return schemaShape(mt.Schema), true
}

func schemaShape(schema *model.Schema) string {
	if schema == nil {
		return "unknown"
	}
	if schema.Ref != "" {
		return "ref:" + schema.Ref
	}
	if schema.Type == "array" {
		return "array<" + schemaShape(schema.Items) + ">"
	}
	if schema.Type == "object" {
		if len(schema.Properties) == 0 {
			return "object{}"
		}
		return "object"
	}
	if schema.Type == "" {
		return "unknown"
	}
	return schema.Type
}

func normalizePathTemplate(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			parts[i] = "{}"
		}
	}
	return strings.Join(parts, "/")
}

func similarEndpointGroupKeys(op *model.Operation) []string {
	keys := []string{strings.ToUpper(op.Method) + " " + normalizePathTemplate(op.Path)}

	segments := splitPathSegments(op.Path)
	if len(segments) >= 3 && isPathParam(segments[len(segments)-1]) {
		familySegments := append([]string{}, segments...)
		familySegments[len(familySegments)-1] = "{}"
		familySegments[len(familySegments)-2] = "*"
		keys = append(keys, strings.ToUpper(op.Method)+" "+joinPathSegments(familySegments))
	}

	return keys
}

func splitPathSegments(path string) []string {
	parts := strings.Split(path, "/")
	segments := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			segments = append(segments, part)
		}
	}
	return segments
}

func isExcludedStyleDriftPrefix(segment string) bool {
	lower := strings.ToLower(strings.TrimSpace(segment))
	return lower == "_action" || lower == "search"
}

func staticSegmentStyle(segment string) string {
	trimmed := strings.TrimSpace(segment)
	if trimmed == "" {
		return "other"
	}
	hasDash := strings.Contains(trimmed, "-")
	hasUnderscore := strings.Contains(trimmed, "_")
	switch {
	case hasDash && !hasUnderscore:
		return "kebab"
	case hasUnderscore && !hasDash:
		return "snake"
	default:
		return "other"
	}
}

func siblingShapeInfo(path string) (string, string, string, bool) {
	segments := splitPathSegments(path)
	if len(segments) < 2 {
		return "", "", "", false
	}
	if isPathParam(segments[0]) || isExcludedStyleDriftPrefix(segments[0]) {
		return "", "", "", false
	}

	family := "/" + strings.ToLower(segments[0])
	kinds := make([]string, 0, len(segments))
	labels := make([]string, 0, len(segments))
	for _, segment := range segments {
		if isPathParam(segment) {
			kinds = append(kinds, "{}")
			labels = append(labels, "param")
		} else {
			kinds = append(kinds, "*")
			labels = append(labels, "static")
		}
	}
	signature := fmt.Sprintf("%d|%s", len(segments), strings.Join(kinds, "/"))
	display := fmt.Sprintf("%d segments (%s)", len(segments), strings.Join(labels, " -> "))
	return family, signature, display, true
}

func countPathParams(path string) int {
	count := 0
	for _, segment := range splitPathSegments(path) {
		if isPathParam(segment) {
			count++
		}
	}
	return count
}

func joinPathSegments(segments []string) string {
	if len(segments) == 0 {
		return "/"
	}
	return "/" + strings.Join(segments, "/")
}

func isPathParam(segment string) bool {
	return strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}")
}

func detailPathBaseAndParam(path string) (string, string, bool) {
	segments := splitPathSegments(path)
	if len(segments) == 0 {
		return "", "", false
	}
	last := segments[len(segments)-1]
	if !isPathParam(last) {
		return "", "", false
	}
	paramName := strings.TrimSuffix(strings.TrimPrefix(last, "{"), "}")
	return joinPathSegments(segments[:len(segments)-1]), paramName, true
}

func detailPathBaseForID(path string) (string, bool) {
	basePath, paramName, ok := detailPathBaseAndParam(path)
	if !ok || paramName != "id" {
		return "", false
	}
	return basePath, true
}

func isLikelyWorkflowSource(op *model.Operation) bool {
	if op == nil {
		return false
	}
	if strings.Contains(op.Path, "{") {
		return false
	}
	return strings.ToUpper(op.Method) == "POST"
}

func isLikelyTaskBurdenTarget(op *model.Operation) bool {
	if op == nil {
		return false
	}

	method := strings.ToUpper(op.Method)
	if method != "POST" && method != "PUT" && method != "PATCH" {
		return false
	}

	if method == "POST" && strings.HasSuffix(op.Path, "/search") {
		return false
	}

	return true
}

func isLikelyAcceptedWorkflowSource(op *model.Operation) bool {
	if op == nil {
		return false
	}

	switch strings.ToUpper(op.Method) {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}

func isLikelyOutcomeGuidanceTarget(op *model.Operation) bool {
	if op == nil {
		return false
	}

	method := strings.ToUpper(op.Method)
	if method == "POST" && strings.HasSuffix(op.Path, "/search") {
		return false
	}

	if method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE" {
		return true
	}

	lowerPath := strings.ToLower(op.Path)
	lowerID := strings.ToLower(op.OperationID)
	for _, token := range []string{"_action", "state", "transition", "approve", "capture", "cancel", "finalize", "complete", "confirm", "sync"} {
		if strings.Contains(lowerPath, token) || strings.Contains(lowerID, token) {
			return true
		}
	}

	return false
}

func isLikelyWorkflowContinuation(op *model.Operation) bool {
	if op == nil {
		return false
	}

	if _, ok := actionTransitionDetailPath(op); ok {
		return true
	}

	lowerPath := strings.ToLower(op.Path)
	lowerID := strings.ToLower(op.OperationID)
	for _, token := range []string{"next", "follow", "state", "transition", "approve", "capture", "cancel", "finalize", "complete", "confirm", "sync", "authorize", "payment", "order"} {
		if strings.Contains(lowerPath, token) || strings.Contains(lowerID, token) {
			return true
		}
	}

	method := strings.ToUpper(op.Method)
	return (method == "POST" || method == "PATCH" || method == "PUT") && strings.Contains(op.Path, "{")
}

func successfulJSONResponseSchema(op *model.Operation) (string, *model.Schema, bool) {
	if op == nil {
		return "", nil, false
	}
	preferredCodes := []string{"200", "201", "202"}
	for _, code := range preferredCodes {
		resp, ok := op.Responses[code]
		if !ok || resp == nil {
			continue
		}
		mt, ok := resp.Content["application/json"]
		if ok && mt != nil && mt.Schema != nil {
			return code, mt.Schema, true
		}
	}
	return "", nil, false
}

func listOrSearchBasePath(op *model.Operation) (string, bool) {
	if op == nil || strings.Contains(op.Path, "{") {
		return "", false
	}

	method := strings.ToUpper(op.Method)
	if method == "GET" && strings.Contains(strings.ToLower(op.OperationID), "list") {
		return op.Path, true
	}

	if method == "POST" && strings.HasSuffix(op.Path, "/search") {
		basePath := strings.TrimSuffix(op.Path, "/search")
		if basePath == "" {
			return "", false
		}
		return basePath, true
	}

	return "", false
}

func acceptedTrackingReason(resp *model.Response) (string, bool) {
	if resp == nil {
		return "", false
	}

	mt, ok := resp.Content["application/json"]
	if !ok || mt == nil || mt.Schema == nil {
		return "202 Accepted response has no JSON body to expose a tracking identifier", false
	}

	if exposesAcceptedTrackingIdentifier(mt.Schema, 0) {
		return "", true
	}

	return fmt.Sprintf(
		"202 Accepted response body does not clearly expose a tracking identifier such as %s",
		strings.Join(acceptedTrackingCandidates(), ", "),
	), false
}

func actionTransitionDetailPath(op *model.Operation) (string, bool) {
	if op == nil || strings.ToUpper(op.Method) != "POST" {
		return "", false
	}

	segments := splitPathSegments(op.Path)
	if len(segments) != 5 {
		return "", false
	}
	if segments[0] != "_action" || !isPathParam(segments[2]) || segments[3] != "state" || !isPathParam(segments[4]) {
		return "", false
	}
	if segments[1] == "state-machine" {
		return "", false
	}

	resource := strings.ReplaceAll(segments[1], "_", "-")
	return "/" + resource + "/{id}", true
}

func actionFollowUpReason(resp *model.Response) (string, bool) {
	if resp == nil {
		return "", false
	}

	mt, ok := resp.Content["application/json"]
	if !ok || mt == nil || mt.Schema == nil {
		return "Success response has no JSON body to expose resulting state information", false
	}
	if mt.Schema.Ref != "" {
		return "", true
	}
	if exposesActionStateIndicator(mt.Schema, 0) {
		return "", true
	}

	return fmt.Sprintf(
		"Success response body does not clearly expose resulting state information such as %s",
		strings.Join(actionStateCandidates(), ", "),
	), false
}

func actionStateCandidates() []string {
	return []string{"stateId", "state", "status", "stateMachineState", "stateMachineStateId", "toStateId", "toStateMachineStateId", "technicalName", "actionName"}
}

func exposesActionStateIndicator(schema *model.Schema, depth int) bool {
	if schema == nil || depth > 3 {
		return false
	}
	if schema.Ref != "" {
		return true
	}
	if schema.Type == "array" {
		return exposesActionStateIndicator(schema.Items, depth+1)
	}
	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}

	for _, candidate := range actionStateCandidates() {
		if _, ok := schema.Properties[candidate]; ok {
			return true
		}
	}

	for _, wrapper := range []string{"data", "result", "state", "transition"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if exposesActionStateIndicator(child, depth+1) {
			return true
		}
	}

	return false
}

func successfulResponse(op *model.Operation) (string, *model.Response, bool) {
	if op == nil {
		return "", nil, false
	}
	preferredCodes := []string{"200", "201", "202", "204"}
	for _, code := range preferredCodes {
		resp, ok := op.Responses[code]
		if ok && resp != nil {
			return code, resp, true
		}
	}

	for code, resp := range op.Responses {
		if strings.HasPrefix(code, "2") && resp != nil {
			return code, resp, true
		}
	}

	return "", nil, false
}

func acceptedTrackingCandidates() []string {
	return []string{"id", "jobId", "taskId", "processId", "operationId", "runId"}
}

func exposesAcceptedTrackingIdentifier(schema *model.Schema, depth int) bool {
	if schema == nil || schema.Ref != "" || depth > 3 {
		return false
	}

	if schema.Type == "array" {
		return exposesAcceptedTrackingIdentifier(schema.Items, depth+1)
	}

	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false
	}

	for _, candidate := range acceptedTrackingCandidates() {
		if _, ok := schema.Properties[candidate]; ok {
			return true
		}
	}

	for _, wrapper := range []string{"data", "result", "job", "task", "process"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if exposesAcceptedTrackingIdentifier(child, depth+1) {
			return true
		}
	}

	return false
}

func exposesFollowUpIdentifier(schema *model.Schema, params []string) (bool, bool) {
	if schema == nil || schema.Ref != "" {
		return false, false
	}

	candidates := linkagePropertyCandidates(params)
	return exposesFollowUpIdentifierRecursive(schema, candidates, 0)
}

func linkagePropertyCandidates(params []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0)
	for _, param := range params {
		for _, candidate := range []string{param, "id"} {
			if candidate == "" || seen[candidate] {
				continue
			}
			seen[candidate] = true
			out = append(out, candidate)
		}
	}
	sort.Strings(out)
	return out
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func limitStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func listDetailLinkageReason(schema *model.Schema) (string, bool) {
	itemSchema, reason, ok := collectionItemSchema(schema, 0)
	if !ok {
		return "", false
	}
	if itemSchema == nil || itemSchema.Ref != "" || itemSchema.Type != "object" || len(itemSchema.Properties) == 0 {
		return "", false
	}
	if _, ok := itemSchema.Properties["id"]; ok {
		return reason, true
	}
	return reason, false
}

func collectionItemSchema(schema *model.Schema, depth int) (*model.Schema, string, bool) {
	if schema == nil || schema.Ref != "" || depth > 3 {
		return nil, "", false
	}

	if schema.Type == "array" {
		if schema.Items == nil {
			return nil, "", false
		}
		return schema.Items, "top-level array items", true
	}

	if schema.Type != "object" || len(schema.Properties) == 0 {
		return nil, "", false
	}

	for _, wrapper := range []string{"data", "items", "elements", "result", "results", "records"} {
		child, ok := schema.Properties[wrapper]
		if !ok || child == nil {
			continue
		}
		if child.Type == "array" && child.Items != nil {
			return child.Items, wrapper + " array items", true
		}
		if child.Type == "object" && len(child.Properties) > 0 {
			if nested, reason, ok := collectionItemSchema(child, depth+1); ok {
				return nested, wrapper + "." + reason, true
			}
		}
	}

	return nil, "", false
}

func exposesIdentifierRecursive(schema *model.Schema, candidates []string, wrappers []string, depth int) (bool, bool) {
	if schema == nil || schema.Ref != "" || depth > 3 {
		return false, false
	}

	if schema.Type == "array" {
		if schema.Items == nil {
			return false, false
		}
		return exposesIdentifierRecursive(schema.Items, candidates, wrappers, depth+1)
	}

	if schema.Type != "object" || len(schema.Properties) == 0 {
		return false, false
	}

	for _, candidate := range candidates {
		if _, ok := schema.Properties[candidate]; ok {
			return true, true
		}
	}

	known := true
	for _, wrapper := range wrappers {
		child, ok := schema.Properties[wrapper]
		if !ok {
			continue
		}
		childKnown, childLinked := exposesIdentifierRecursive(child, candidates, wrappers, depth+1)
		if childLinked {
			return true, true
		}
		if childKnown {
			known = true
		}
	}

	return known, false
}

func exposesFollowUpIdentifierRecursive(schema *model.Schema, candidates []string, depth int) (bool, bool) {
	return exposesIdentifierRecursive(schema, candidates, []string{"data", "items", "elements", "result", "results", "records"}, depth)
}

func findLikelyMissingEnums(schema *model.Schema, prefix string) []string {
	if schema == nil {
		return nil
	}

	paths := make([]string, 0)
	for name, property := range schema.Properties {
		propertyPath := name
		if prefix != "" {
			propertyPath = prefix + "." + name
		}

		if isLikelyEnumProperty(name, property) {
			paths = append(paths, propertyPath)
		}
		paths = append(paths, findLikelyMissingEnums(property, propertyPath)...)
	}

	if schema.Items != nil {
		itemPrefix := prefix + "[]"
		if prefix == "" {
			itemPrefix = "[]"
		}
		paths = append(paths, findLikelyMissingEnums(schema.Items, itemPrefix)...)
	}

	return paths
}

func hasWeakFollowUpExposure(op *model.Operation, detailParamsByBase map[string][]string) bool {
	if op == nil {
		return false
	}

	if params := detailParamsByBase[op.Path]; len(params) > 0 {
		_, schema, ok := successfulJSONResponseSchema(op)
		if ok {
			known, linked := exposesFollowUpIdentifier(schema, params)
			if known && !linked {
				return true
			}
		}
	}

	detailPath, ok := actionTransitionDetailPath(op)
	if !ok || detailPath == "" {
		return false
	}

	_, resp, ok := successfulResponse(op)
	if !ok {
		return false
	}

	reason, linked := actionFollowUpReason(resp)
	return !linked && reason != ""
}

func requiredDependentIdentifierCount(op *model.Operation) (int, []string, int) {
	idFields := map[string]bool{}
	taskFields := map[string]bool{}

	for _, paramName := range pathParameterNames(op.Path) {
		if isIdentifierLikeField(paramName) {
			idFields["path."+paramName] = true
		}
	}

	if schema, ok := requestBodySchema(op); ok {
		collectRequiredFieldKinds(schema, "body", 0, idFields, taskFields)
	}

	labels := make([]string, 0, len(idFields))
	for label := range idFields {
		labels = append(labels, label)
	}
	sort.Strings(labels)
	if len(labels) > 3 {
		labels = labels[:3]
		labels = append(labels, "...")
	}

	return len(idFields), labels, len(taskFields)
}

func isLikelyPreTaskLookupNeed(dependentIdentifierCount int, requiredTaskFieldCount int) bool {
	if dependentIdentifierCount <= 0 {
		return false
	}
	if dependentIdentifierCount >= 2 && requiredTaskFieldCount <= 1 {
		return true
	}
	if dependentIdentifierCount >= 3 {
		return true
	}
	return false
}

func prerequisiteBurdenRating(dependentIdentifierCount int, lookupLikely bool, weakFollowUp bool) string {
	score := 0
	if dependentIdentifierCount >= 2 {
		score++
	}
	if dependentIdentifierCount >= 3 {
		score++
	}
	if lookupLikely {
		score++
	}
	if weakFollowUp {
		score++
	}

	switch {
	case score >= 4:
		return "high"
	case score == 3:
		return "medium"
	default:
		return "low"
	}
}

func requestBodySchema(op *model.Operation) (*model.Schema, bool) {
	if op == nil || op.RequestBody == nil {
		return nil, false
	}

	if mt, ok := op.RequestBody.Content["application/json"]; ok && mt != nil && mt.Schema != nil {
		return mt.Schema, true
	}

	for _, mt := range op.RequestBody.Content {
		if mt != nil && mt.Schema != nil {
			return mt.Schema, true
		}
	}

	return nil, false
}

func pathParameterNames(path string) []string {
	segments := splitPathSegments(path)
	names := make([]string, 0)
	for _, segment := range segments {
		if !isPathParam(segment) {
			continue
		}
		name := strings.TrimSuffix(strings.TrimPrefix(segment, "{"), "}")
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func collectRequiredFieldKinds(schema *model.Schema, prefix string, depth int, idFields map[string]bool, taskFields map[string]bool) {
	if schema == nil || schema.Ref != "" || depth > 4 {
		return
	}

	if schema.Type == "array" {
		collectRequiredFieldKinds(schema.Items, prefix+"[]", depth+1, idFields, taskFields)
		return
	}

	if schema.Type != "object" || len(schema.Properties) == 0 || len(schema.Required) == 0 {
		return
	}

	for _, name := range schema.Required {
		fieldPath := prefix + "." + name
		if isIdentifierLikeField(name) {
			idFields[fieldPath] = true
		} else {
			taskFields[fieldPath] = true
		}
		collectRequiredFieldKinds(schema.Properties[name], fieldPath, depth+1, idFields, taskFields)
	}
}

func isIdentifierLikeField(name string) bool {
	if name == "" {
		return false
	}

	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "id" {
		return true
	}
	if strings.HasSuffix(lower, "_id") || strings.HasSuffix(lower, "_ids") {
		return true
	}

	return strings.HasSuffix(name, "Id") || strings.HasSuffix(name, "ID") || strings.HasSuffix(name, "Ids") || strings.HasSuffix(name, "IDs")
}

type schemaShapeStats struct {
	TopLevelProperties    int
	TotalProperties       int
	ObjectNodes           int
	ArrayNodes            int
	MaxDepth              int
	InternalLookingCount  int
	OutcomeHintCount      int
	StructuralHintCount   int
	NestedObjectBranches  int
	ArrayOfObjectBranches int
	EntityLikeNodeCount   int
	IDLikeFieldCount      int
	VersionLikeFieldCount int
	LinkageLikeFieldCount int
	NotableBranches       []string
}

func inspectSchemaShape(schema *model.Schema, depth int) schemaShapeStats {
	stats := schemaShapeStats{}
	collectSchemaShapeStats(schema, depth, true, &stats)
	return stats
}

func collectSchemaShapeStats(schema *model.Schema, depth int, topLevel bool, stats *schemaShapeStats) {
	if schema == nil || stats == nil || depth > 6 {
		return
	}
	if schema.Ref != "" && len(schema.Properties) == 0 && schema.Items == nil && schema.Type == "" {
		return
	}
	if depth > stats.MaxDepth {
		stats.MaxDepth = depth
	}

	if schema.Type == "array" {
		stats.ArrayNodes++
		collectSchemaShapeStats(schema.Items, depth+1, false, stats)
		return
	}

	if schema.Type != "object" && len(schema.Properties) == 0 {
		return
	}

	stats.ObjectNodes++
	if topLevel {
		stats.TopLevelProperties = len(schema.Properties)
	}

	for name, child := range schema.Properties {
		stats.TotalProperties++
		if isIDLikeShapeField(name) {
			stats.IDLikeFieldCount++
		}
		if isVersionLikeShapeField(name) {
			stats.VersionLikeFieldCount++
		}
		if isLinkageLikeShapeField(name) {
			stats.LinkageLikeFieldCount++
		}
		if isInternalLookingField(name) {
			stats.InternalLookingCount++
		}
		if isWorkflowOutcomeHintField(name) {
			stats.OutcomeHintCount++
		}
		if isStorageStructuralHintField(name) {
			stats.StructuralHintCount++
		}
		if child != nil {
			if child.Type == "object" && len(child.Properties) > 0 {
				stats.NestedObjectBranches++
				if topLevel && isLikelyEntityBranchName(name) {
					stats.NotableBranches = appendUnique(stats.NotableBranches, name)
				}
			}
			if child.Type == "array" && child.Items != nil && (child.Items.Type == "object" || len(child.Items.Properties) > 0) {
				stats.ArrayOfObjectBranches++
				if topLevel {
					stats.NotableBranches = appendUnique(stats.NotableBranches, name)
				}
			}
			if looksEntityLikeNode(child) {
				stats.EntityLikeNodeCount++
				if topLevel {
					stats.NotableBranches = appendUnique(stats.NotableBranches, name)
				}
			}
		}
		collectSchemaShapeStats(child, depth+1, false, stats)
	}
}

func isSnapshotHeavyObjectGraph(stats schemaShapeStats) bool {
	signals := 0
	if stats.TopLevelProperties >= 10 {
		signals++
	}
	if stats.TotalProperties >= 28 {
		signals++
	}
	if stats.NestedObjectBranches >= 5 {
		signals++
	}
	if stats.ArrayOfObjectBranches >= 2 {
		signals++
	}
	if stats.EntityLikeNodeCount >= 5 {
		signals++
	}
	if stats.IDLikeFieldCount >= 8 || (stats.IDLikeFieldCount >= 5 && stats.VersionLikeFieldCount >= 2) {
		signals++
	}
	if stats.LinkageLikeFieldCount >= 4 {
		signals++
	}

	// Require broad graph-style exposure, not just deep nesting.
	hasBroadShape := stats.TopLevelProperties >= 8 || stats.NestedObjectBranches >= 4 || stats.ArrayOfObjectBranches >= 2 || stats.TotalProperties >= 24
	return signals >= 2 && hasBroadShape
}

type deepNestingEvidence struct {
	MaxObjectDepth         int
	MaxPathDepth           int
	DeepObjectChainCount   int
	NestedArrayObjectCount int
	DeepPropertyPaths      []string
}

type duplicatedStateEvidence struct {
	RepeatedConcepts         []string
	OverlapExamples          []string
	RepeatedIDLikeFieldCount int
}

type incidentalInternalFieldEvidence struct {
	InternalFieldCount int
	VersionLikeCount   int
	LinkageLikeCount   int
	ScaffoldingCount   int
	LowLevelIDCount    int
	NotableFieldPaths  []string
}

type weakOutcomeGuidanceEvidence struct {
	TotalPropertyCount        int
	TopLevelFieldCount        int
	StructuralHintCount       int
	OutcomeSignalCount        int
	NextActionSignalCount     int
	AuthoritativeHandoffCount int
	TopLevelFields            []string
	NotableFieldPaths         []string
}

type responseBranchShape struct {
	Path         string
	FieldSet     map[string]bool
	ConceptSet   map[string]bool
	IDLikeFields map[string]bool
}

func inspectDuplicatedStateEvidence(schema *model.Schema) duplicatedStateEvidence {
	branches := collectResponseBranchShapes(schema)
	if len(branches) < 2 {
		return duplicatedStateEvidence{}
	}

	conceptBranchCount := map[string]int{}
	idFieldBranchCount := map[string]int{}
	overlapExamples := make([]string, 0)

	for _, branch := range branches {
		for concept := range branch.ConceptSet {
			conceptBranchCount[concept]++
		}
		for idField := range branch.IDLikeFields {
			idFieldBranchCount[idField]++
		}
	}

	for i := 0; i < len(branches); i++ {
		for j := i + 1; j < len(branches); j++ {
			shared := sharedFieldNames(branches[i].FieldSet, branches[j].FieldSet)
			if len(shared) >= 2 {
				overlap := fmt.Sprintf("%s <-> %s (shared: %s)", branches[i].Path, branches[j].Path, strings.Join(limitStrings(shared, 3), ", "))
				overlapExamples = appendUnique(overlapExamples, overlap)
			}
		}
	}

	repeatedConcepts := make([]string, 0)
	for concept, count := range conceptBranchCount {
		if count >= 2 {
			repeatedConcepts = append(repeatedConcepts, concept)
		}
	}
	sort.Strings(repeatedConcepts)

	repeatedIDLikeFieldCount := 0
	for _, count := range idFieldBranchCount {
		if count >= 2 {
			repeatedIDLikeFieldCount++
		}
	}

	sort.Strings(overlapExamples)

	return duplicatedStateEvidence{
		RepeatedConcepts:         repeatedConcepts,
		OverlapExamples:          overlapExamples,
		RepeatedIDLikeFieldCount: repeatedIDLikeFieldCount,
	}
}

func isDuplicatedStateShape(ev duplicatedStateEvidence) bool {
	signals := 0
	if len(ev.RepeatedConcepts) >= 2 {
		signals++
	}
	if len(ev.OverlapExamples) >= 1 {
		signals++
	}
	if len(ev.OverlapExamples) >= 2 {
		signals++
	}
	if ev.RepeatedIDLikeFieldCount >= 2 {
		signals++
	}

	return signals >= 2
}

func inspectIncidentalInternalFieldEvidence(schema *model.Schema) incidentalInternalFieldEvidence {
	ev := incidentalInternalFieldEvidence{}
	collectIncidentalInternalFieldEvidence(schema, nil, &ev)
	return ev
}

func collectIncidentalInternalFieldEvidence(schema *model.Schema, path []string, ev *incidentalInternalFieldEvidence) {
	if schema == nil || ev == nil || len(path) > 10 {
		return
	}

	if schema.Ref != "" && len(schema.Properties) == 0 && schema.Items == nil && schema.Type == "" {
		return
	}

	if schema.Type == "array" {
		collectIncidentalInternalFieldEvidence(schema.Items, append(path, "[]"), ev)
		return
	}

	if schema.Type != "object" && len(schema.Properties) == 0 {
		return
	}

	for name, child := range schema.Properties {
		nextPath := append(path, name)
		pathStr := strings.Join(nextPath, ".")
		lower := strings.ToLower(strings.TrimSpace(name))

		if isInternalLookingField(lower) || isIncidentalInternalFieldName(lower) {
			ev.InternalFieldCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isVersionLikeShapeField(lower) {
			ev.VersionLikeCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isLinkageLikeShapeField(lower) {
			ev.LinkageLikeCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isScaffoldingFieldName(lower) {
			ev.ScaffoldingCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isLowLevelIDField(lower) {
			ev.LowLevelIDCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}

		collectIncidentalInternalFieldEvidence(child, nextPath, ev)
	}
}

func isIncidentalInternalFieldExposure(ev incidentalInternalFieldEvidence) bool {
	signals := 0
	if ev.InternalFieldCount >= 4 {
		signals++
	}
	if ev.VersionLikeCount >= 2 {
		signals++
	}
	if ev.LinkageLikeCount >= 2 {
		signals++
	}
	if ev.ScaffoldingCount >= 1 {
		signals++
	}
	if ev.LowLevelIDCount >= 3 {
		signals++
	}

	return signals >= 2
}

func inspectWeakOutcomeGuidanceEvidence(schema *model.Schema) weakOutcomeGuidanceEvidence {
	ev := weakOutcomeGuidanceEvidence{}
	collectWeakOutcomeGuidanceEvidence(schema, nil, 0, true, &ev)
	return ev
}

func collectWeakOutcomeGuidanceEvidence(schema *model.Schema, path []string, depth int, topLevel bool, ev *weakOutcomeGuidanceEvidence) {
	if schema == nil || ev == nil || depth > 6 {
		return
	}

	if schema.Ref != "" && len(schema.Properties) == 0 && schema.Items == nil && schema.Type == "" {
		return
	}

	if schema.Type == "array" {
		collectWeakOutcomeGuidanceEvidence(schema.Items, append(path, "[]"), depth+1, topLevel, ev)
		return
	}

	if schema.Type != "object" && len(schema.Properties) == 0 {
		return
	}

	for name, child := range schema.Properties {
		nextPath := append(path, name)
		pathStr := strings.Join(nextPath, ".")
		lower := strings.ToLower(strings.TrimSpace(name))

		ev.TotalPropertyCount++
		if topLevel {
			ev.TopLevelFieldCount++
			ev.TopLevelFields = appendUnique(ev.TopLevelFields, name)
		}

		if isStorageStructuralHintField(lower) {
			ev.StructuralHintCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isOutcomeSignalField(lower) {
			ev.OutcomeSignalCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isNextActionGuidanceField(lower) {
			ev.NextActionSignalCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}
		if isAuthoritativeHandoffField(lower) {
			ev.AuthoritativeHandoffCount++
			ev.NotableFieldPaths = appendUnique(ev.NotableFieldPaths, pathStr)
		}

		collectWeakOutcomeGuidanceEvidence(child, nextPath, depth+1, false, ev)
	}
}

func isWeakOutcomeNextActionGuidance(ev weakOutcomeGuidanceEvidence, continuationLikely bool, responseCode string) bool {
	if ev.TopLevelFieldCount == 0 {
		return false
	}

	missingOutcome := ev.OutcomeSignalCount == 0
	missingNext := ev.NextActionSignalCount == 0
	missingHandoff := ev.AuthoritativeHandoffCount == 0

	signals := 0
	if missingOutcome {
		signals++
	}
	if missingNext {
		signals++
	}
	if missingHandoff {
		signals++
	}
	if ev.StructuralHintCount >= 2 && missingOutcome {
		signals++
	}
	if ev.TotalPropertyCount >= 8 && missingOutcome && missingNext {
		signals++
	}
	if continuationLikely && (missingNext || missingHandoff) {
		signals++
	}
	if responseCode == "202" && missingHandoff {
		signals++
	}

	return signals >= 3 && (missingOutcome || missingNext) && missingHandoff
}

func isOutcomeSignalField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{"success", "status", "state", "result", "outcome", "changed", "updated", "applied", "completed", "done"} {
		if lower == exact {
			return true
		}
	}
	return strings.HasSuffix(lower, "status") || strings.HasSuffix(lower, "state") || strings.HasSuffix(lower, "outcome")
}

func isNextActionGuidanceField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{"nextaction", "nextactions", "nextstep", "followup", "followupaction", "actionrequired", "requiresaction", "pollurl", "retryafter", "cancontinue"} {
		if lower == exact {
			return true
		}
	}
	return strings.Contains(lower, "next") || strings.Contains(lower, "follow")
}

func isAuthoritativeHandoffField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{"id", "token", "contexttoken", "trackingid", "jobid", "taskid", "operationid", "resourceid", "url", "href", "location", "correlationid"} {
		if lower == exact {
			return true
		}
	}
	if strings.HasSuffix(lower, "id") {
		return true
	}
	return strings.Contains(lower, "token")
}

func isIncidentalInternalFieldName(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{
		"createdat", "updatedat", "createdbyid", "updatedbyid", "deletedat", "deleted",
		"stateid", "statemachinestate", "statemachinestateid", "internalstate", "lifecycle",
		"translationcodeid", "translated", "translations", "customfields",
		"technicalname", "internal", "metadata",
	} {
		if lower == exact {
			return true
		}
	}
	return false
}

func isScaffoldingFieldName(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	return lower == "translated" || lower == "translations" || lower == "customfields" || lower == "statemachinestate" || lower == "statemachinestateid"
}

func isLowLevelIDField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "id" {
		return false
	}
	if strings.HasSuffix(lower, "id") {
		for _, frag := range []string{"version", "state", "reference", "parent", "createdby", "updatedby", "billing", "shipping", "address", "order", "customer", "payment", "transaction"} {
			if strings.Contains(lower, frag) {
				return true
			}
		}
	}
	return false
}

func collectResponseBranchShapes(schema *model.Schema) []responseBranchShape {
	if schema == nil {
		return nil
	}

	root := schema
	if root.Type == "array" {
		root = root.Items
	}
	if root == nil || (root.Type != "object" && len(root.Properties) == 0) {
		return nil
	}

	branches := make([]responseBranchShape, 0)
	for name, child := range root.Properties {
		appendBranchShape(name, child, &branches)
		if isWrapperBranchName(name) {
			for nestedName, nestedChild := range objectProperties(nestedObjectSchema(child)) {
				appendBranchShape(name+"."+nestedName, nestedChild, &branches)
			}
		}
	}

	return branches
}

func appendBranchShape(path string, schema *model.Schema, out *[]responseBranchShape) {
	obj := nestedObjectSchema(schema)
	if obj == nil || len(obj.Properties) < 2 {
		return
	}

	fields := map[string]bool{}
	concepts := map[string]bool{}
	idFields := map[string]bool{}

	for _, token := range strings.Split(strings.ToLower(path), ".") {
		for _, concept := range inferStateConcepts(token) {
			concepts[concept] = true
		}
	}

	for name := range obj.Properties {
		lower := strings.ToLower(name)
		fields[lower] = true
		for _, concept := range inferStateConcepts(lower) {
			concepts[concept] = true
		}
		if isIDLikeShapeField(lower) || isLinkageLikeShapeField(lower) {
			idFields[lower] = true
		}
	}

	*out = append(*out, responseBranchShape{
		Path:         path,
		FieldSet:     fields,
		ConceptSet:   concepts,
		IDLikeFields: idFields,
	})
}

func nestedObjectSchema(schema *model.Schema) *model.Schema {
	if schema == nil {
		return nil
	}
	if schema.Type == "array" {
		if schema.Items != nil && (schema.Items.Type == "object" || len(schema.Items.Properties) > 0) {
			return schema.Items
		}
		return nil
	}
	if schema.Type == "object" || len(schema.Properties) > 0 {
		return schema
	}
	return nil
}

func objectProperties(schema *model.Schema) map[string]*model.Schema {
	if schema == nil {
		return map[string]*model.Schema{}
	}
	return schema.Properties
}

func isWrapperBranchName(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	switch lower {
	case "data", "result", "payload", "response", "body", "entity":
		return true
	default:
		return false
	}
}

func inferStateConcepts(token string) []string {
	t := strings.ToLower(strings.TrimSpace(token))
	if t == "" {
		return nil
	}

	out := make([]string, 0, 4)
	add := func(concept string) {
		if !containsString(out, concept) {
			out = append(out, concept)
		}
	}

	if strings.Contains(t, "customer") {
		add("customer")
	}
	if strings.Contains(t, "address") || strings.Contains(t, "billing") || strings.Contains(t, "shipping") {
		add("address")
	}
	if strings.Contains(t, "payment") || strings.Contains(t, "transaction") {
		add("payment")
	}
	if strings.Contains(t, "state") || strings.Contains(t, "status") {
		add("state")
	}
	if strings.Contains(t, "delivery") || strings.Contains(t, "shipment") {
		add("delivery")
	}
	if strings.Contains(t, "order") {
		add("order")
	}

	return out
}

func sharedFieldNames(a map[string]bool, b map[string]bool) []string {
	shared := make([]string, 0)
	for name := range a {
		if b[name] {
			shared = append(shared, name)
		}
	}
	sort.Strings(shared)
	return shared
}

func containsString(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}

func inspectDeepNestingEvidence(schema *model.Schema) deepNestingEvidence {
	ev := deepNestingEvidence{}
	collectDeepNestingEvidence(schema, 0, 0, nil, &ev)
	return ev
}

func collectDeepNestingEvidence(schema *model.Schema, objectDepth int, pathDepth int, path []string, ev *deepNestingEvidence) {
	if schema == nil || ev == nil || pathDepth > 14 {
		return
	}

	if schema.Ref != "" && len(schema.Properties) == 0 && schema.Items == nil && schema.Type == "" {
		return
	}

	if schema.Type == "array" {
		if schema.Items != nil && (schema.Items.Type == "object" || len(schema.Items.Properties) > 0) {
			ev.NestedArrayObjectCount++
		}
		collectDeepNestingEvidence(schema.Items, objectDepth, pathDepth+1, append(path, "[]"), ev)
		return
	}

	if schema.Type != "object" && len(schema.Properties) == 0 {
		if pathDepth > ev.MaxPathDepth {
			ev.MaxPathDepth = pathDepth
		}
		if pathDepth >= 5 && len(path) > 0 {
			ev.DeepPropertyPaths = appendUnique(ev.DeepPropertyPaths, strings.Join(path, "."))
		}
		return
	}

	objectDepth++
	if objectDepth > ev.MaxObjectDepth {
		ev.MaxObjectDepth = objectDepth
	}
	if objectDepth >= 4 {
		ev.DeepObjectChainCount++
	}

	if len(schema.Properties) == 0 {
		if pathDepth > ev.MaxPathDepth {
			ev.MaxPathDepth = pathDepth
		}
		if pathDepth >= 5 && len(path) > 0 {
			ev.DeepPropertyPaths = appendUnique(ev.DeepPropertyPaths, strings.Join(path, "."))
		}
		return
	}

	for name, child := range schema.Properties {
		nextPath := append(path, name)
		nextPathDepth := pathDepth + 1
		if nextPathDepth > ev.MaxPathDepth {
			ev.MaxPathDepth = nextPathDepth
		}
		if nextPathDepth >= 5 {
			ev.DeepPropertyPaths = appendUnique(ev.DeepPropertyPaths, strings.Join(nextPath, "."))
		}
		collectDeepNestingEvidence(child, objectDepth, nextPathDepth, nextPath, ev)
	}
}

func isDeeplyNestedResponseShape(ev deepNestingEvidence) bool {
	signals := 0
	if ev.MaxObjectDepth >= 5 {
		signals++
	}
	if ev.MaxPathDepth >= 6 {
		signals++
	}
	if ev.DeepObjectChainCount >= 4 {
		signals++
	}
	if ev.NestedArrayObjectCount >= 2 {
		signals++
	}
	if len(ev.DeepPropertyPaths) >= 3 {
		signals++
	}

	// Require actual depth/path pressure so broad-but-shallow responses do not trip this detector.
	hasDepthPressure := ev.MaxObjectDepth >= 4 && ev.MaxPathDepth >= 5
	return signals >= 2 && hasDepthPressure
}

func isIDLikeShapeField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "id" {
		return true
	}
	if strings.HasSuffix(lower, "id") || strings.HasSuffix(lower, "ids") {
		return true
	}
	return strings.Contains(lower, "identifier")
}

func isVersionLikeShapeField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if strings.Contains(lower, "version") {
		return true
	}
	return strings.HasSuffix(lower, "revision") || strings.HasSuffix(lower, "revisionid")
}

func isLinkageLikeShapeField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "parentid" || strings.HasPrefix(lower, "parent") {
		return true
	}
	if strings.Contains(lower, "link") || strings.Contains(lower, "relationship") || strings.Contains(lower, "reference") {
		return true
	}
	return strings.Contains(lower, "state") && strings.HasSuffix(lower, "id")
}

func isLikelyEntityBranchName(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{"customer", "order", "delivery", "transaction", "payment", "address", "state", "version", "versions", "relationships", "included", "lineitems", "items", "records"} {
		if lower == exact {
			return true
		}
	}
	return strings.HasSuffix(lower, "s") && len(lower) > 3
}

func looksEntityLikeNode(schema *model.Schema) bool {
	if schema == nil {
		return false
	}
	if schema.Type == "array" {
		schema = schema.Items
	}
	if schema == nil || schema.Type != "object" || len(schema.Properties) < 2 {
		return false
	}
	idLike := 0
	structural := 0
	for name, child := range schema.Properties {
		if isIDLikeShapeField(name) || isVersionLikeShapeField(name) {
			idLike++
		}
		if isStorageStructuralHintField(name) || isLinkageLikeShapeField(name) {
			structural++
		}
		if child != nil && child.Type == "object" {
			structural++
		}
	}
	return idLike >= 1 && structural >= 1
}

func isSnapshotHeavyShape(stats schemaShapeStats) bool {
	if stats.TopLevelProperties >= 14 {
		return true
	}
	if stats.TotalProperties >= 40 {
		return true
	}
	if stats.ArrayNodes >= 4 && stats.TotalProperties >= 28 {
		return true
	}
	return stats.MaxDepth >= 5 && stats.TotalProperties >= 28
}

func isInternalStateExposure(stats schemaShapeStats) bool {
	return stats.InternalLookingCount >= 4
}

func isMissingWorkflowOutcomeGuidance(stats schemaShapeStats) bool {
	if stats.TotalProperties == 0 {
		return false
	}
	return stats.OutcomeHintCount == 0 && stats.TotalProperties >= 6 && stats.StructuralHintCount >= 1
}

func isStorageShapedOverTaskMeaning(stats schemaShapeStats) bool {
	if stats.TotalProperties == 0 {
		return false
	}
	if stats.StructuralHintCount >= 2 && stats.OutcomeHintCount <= 1 && stats.TotalProperties >= 8 {
		return true
	}
	if stats.ObjectNodes >= 4 && stats.OutcomeHintCount == 0 && stats.TotalProperties >= 14 {
		return true
	}
	return false
}

func contractShapeBurdenLevel(signalCount int, stats schemaShapeStats) string {
	score := signalCount
	if stats.TotalProperties >= 35 {
		score++
	}
	if stats.InternalLookingCount >= 5 {
		score++
	}
	if score >= 5 {
		return "high"
	}
	if score >= 3 {
		return "medium"
	}
	return "low"
}

func isInternalLookingField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}

	for _, exact := range []string{
		"versionid", "parentversionid", "createdbyid", "updatedbyid", "translated", "translations", "customfields",
		"stateid", "statemachinestate", "statemachinestateid", "auto_increment", "internal", "_score", "_uniqueidentifier",
	} {
		if lower == exact {
			return true
		}
	}

	return strings.HasSuffix(lower, "versionid") || strings.HasSuffix(lower, "stateid")
}

func isWorkflowOutcomeHintField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{
		"success", "result", "status", "state", "changed", "updated", "actionrequired", "nextactions",
		"nextaction", "contexttoken", "token", "message", "warnings", "errors",
	} {
		if lower == exact {
			return true
		}
	}
	return false
}

func isStorageStructuralHintField(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	for _, exact := range []string{"data", "attributes", "relationships", "included", "extensions", "meta", "elements", "items", "children", "links"} {
		if lower == exact {
			return true
		}
	}
	return false
}

func isLikelyEnumProperty(name string, schema *model.Schema) bool {
	if schema == nil {
		return false
	}
	if schema.Ref != "" || schema.Type != "string" || len(schema.Enum) > 0 {
		return false
	}
	switch name {
	case "status", "state", "type", "mode", "scope", "level":
		return true
	default:
		return false
	}
}
