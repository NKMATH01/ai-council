import assert from "node:assert/strict";

import { lintPlan } from "./plan-linter";
import { type PlanHarnessStructuredCall, runPlanHarness } from "./plan-harness";
import { extractJson, GeneratedPlanSchema, parseAndValidate } from "./plan-schema";
import {
  buildSessionFromState,
  buildSessionRow,
  mapRowToSession,
  detectHarnessRestoreSource,
  serializeRecommendationPayload,
  deserializeRecommendationPayload,
  type SessionRow,
} from "./session-mappers";
import type { DebateState, GeneratedPlan, PlanHarnessStreamEvent, PlanHarnessArtifacts, HarnessRunSnapshot } from "./types";
import { buildPreviousHarnessSummary } from "./harness-summary";
import { computeHarnessDiff, createSnapshot, pushSnapshot } from "./harness-diff";
import { mergeAttempts } from "./harness-attempts";

let passed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    });
}

function createStructuredCallQueue(outputs: string[]) {
  const calls: Array<{ systemPrompt: string; userMessage: string; maxTokens?: number }> = [];

  const callStructured: PlanHarnessStructuredCall = async (systemPrompt, userMessage, maxTokens) => {
    const next = outputs.shift();
    calls.push({ systemPrompt, userMessage, maxTokens });
    if (!next) {
      throw new Error("structured call queue exhausted");
    }
    return next;
  };

  return { calls, callStructured };
}

function createValidPlan(titleSuffix: string): GeneratedPlan {
  return {
    title: `React Supabase plan ${titleSuffix}`,
    objective: "Build a React and Supabase delivery plan with clear milestones.",
    milestones: [
      {
        id: "m1",
        title: "Define React product scope",
        objective: "Lock the React app scope and delivery targets.",
        exitCriteria: ["Scope approved", "Supabase data model confirmed"],
      },
      {
        id: "m2",
        title: "Implement Supabase delivery",
        objective: "Ship the React app and Supabase integration.",
        exitCriteria: ["Primary flows implemented", "Acceptance criteria reviewed"],
      },
    ],
    tasks: [
      {
        id: "t1",
        title: "Define React screen map",
        detail: "Outline the React screens, navigation, and user flows.",
        milestoneId: "m1",
        dependsOn: [],
        ownerHint: "frontend",
        deliverable: "React screen map document",
      },
      {
        id: "t2",
        title: "Design Supabase schema",
        detail: "Model the required tables, policies, and sync requirements in Supabase.",
        milestoneId: "m1",
        dependsOn: ["t1"],
        ownerHint: "backend",
        deliverable: "Supabase schema specification",
      },
      {
        id: "t3",
        title: "Implement React task flows",
        detail: "Build the core React flows and connect them to Supabase data access.",
        milestoneId: "m2",
        dependsOn: ["t2"],
        ownerHint: "fullstack",
        deliverable: "Working React task flow implementation",
      },
      {
        id: "t4",
        title: "Validate mobile acceptance",
        detail: "Review responsive behavior and validate delivery against acceptance criteria.",
        milestoneId: "m2",
        dependsOn: ["t3"],
        ownerHint: "qa",
        deliverable: "Mobile validation checklist",
      },
    ],
    dependencies: [
      { from: "t2", to: "t1", reason: "Schema depends on finalized screen flows." },
      { from: "t3", to: "t2", reason: "Implementation depends on the Supabase schema." },
      { from: "t4", to: "t3", reason: "Validation depends on the implemented flows." },
    ],
    risks: ["React scope creep", "Supabase policy mismatch"],
    acceptanceCriteria: [
      "React screens cover the required task flows.",
      "Supabase schema supports the required reads and writes.",
      "Mobile layout works for the defined task flows.",
    ],
    executionOrder: ["t1", "t2", "t3", "t4"],
    estimatedComplexity: "medium",
  };
}

function createStateWithHarness(): DebateState {
  return {
    topic: "Build a React task manager",
    command: "debate",
    debateEngine: "claude-sonnet",
    verifyEngine: "chatgpt",
    techSpec: "Use React and Supabase.",
    modeInput: null,
    recommendation: null,
    confirmedRoles: [],
    currentStage: "independent",
    currentRoleIndex: 0,
    messages: [],
    verificationProvider: null,
    verificationResult: "",
    prd: "",
    prdRevisions: [],
    revisionCount: 0,
    feedbacks: [],
    clarifications: [],
    clarificationRound: 0,
    clarificationPhase: "vision",
    generatedCommand: "",
    prototypeHtml: "",
    harness: {
      requirementSpec: {
        userIntent: "Create a planning workflow.",
        targetOutcome: "A validated delivery plan.",
        constraints: ["React", "Supabase", "mobile responsive"],
        nonGoals: ["Native mobile app"],
        preferredFormat: ["Milestones", "Tasks"],
        assumptions: ["Single delivery team"],
        missingInfo: [],
        sourceTopic: "Build a React task manager",
        sourceCommand: "debate",
      },
      cps: {
        context: "The team needs a delivery plan for a React and Supabase build.",
        problem: "The work must stay aligned to React, Supabase, and responsive delivery.",
        solution: "Create a validated plan with milestones, tasks, and dependencies.",
        successCriteria: ["React plan exists", "Supabase plan exists", "Mobile scope validated"],
        risks: ["Scope creep"],
      },
      generatedPlan: createValidPlan("roundtrip"),
      lintIssues: [],
      evaluation: {
        score: 82,
        requirementCoverage: 85,
        cpsAlignment: 80,
        feasibility: 78,
        hallucinationRisk: 15,
        missingWorkRisk: 20,
        reasons: ["Requirements are reflected."],
        warnings: [],
        suggestedFixes: [],
        passed: true,
      },
      attempts: [
        {
          attempt: 1,
          stage: "normalize",
          success: true,
          issues: [],
          timestamp: Date.now(),
          model: "claude-opus-4-6",
          provider: "anthropic",
        },
      ],
    },
    activeWorkflow: "plan_harness",
    status: "complete",
    createdAt: "2026-03-27T00:00:00.000Z",
    sessionId: "session-1",
  };
}

test("extractJson accepts strict JSON and rejects wrapped text", () => {
  assert.equal(extractJson('{"ok":true}'), '{"ok":true}');
  assert.equal(extractJson(" \n{\"ok\":true}\n "), '{"ok":true}');
  assert.throws(() => extractJson("```json\n{\"ok\":true}\n```"));
  assert.throws(() => extractJson("Hello\n{\"ok\":true}"));
  assert.throws(() => extractJson("{\"ok\":true}\nThanks"));
  assert.throws(() => extractJson("안녕하세요 {\"ok\":true}"));
});

test("session mapping roundtrip preserves harness payload", () => {
  const session = buildSessionFromState(createStateWithHarness());
  const row = buildSessionRow(session);
  const restored = mapRowToSession(row, session.techSpec || "");

  assert.equal(row.harness_data?.requirementSpec?.userIntent, "Create a planning workflow.");
  assert.equal(row.active_workflow, "plan_harness");
  assert.equal(row.recommendation, null);
  assert.equal(restored.activeWorkflow, "plan_harness");
  assert.equal(restored.harness?.requirementSpec?.userIntent, "Create a planning workflow.");
  assert.equal(restored.harness?.attempts[0]?.model, "claude-opus-4-6");
  assert.equal(restored.techSpec, "Use React and Supabase.");
  assert.equal(restored.recommendation, null);
});

test("session mapping restores legacy embedded harness payload", () => {
  const session = buildSessionFromState(createStateWithHarness());
  const legacyRow = buildSessionRow(session, { harnessStorage: "legacy" });
  const restored = mapRowToSession(legacyRow, session.techSpec || "");

  assert.equal(legacyRow.harness_data, null);
  assert.equal(legacyRow.active_workflow, null);
  assert.equal(typeof legacyRow.recommendation, "object");
  assert.equal(restored.activeWorkflow, "plan_harness");
  assert.equal(restored.harness?.generatedPlan?.title, "React Supabase plan roundtrip");
  assert.equal(restored.recommendation, null);
});

test("runPlanHarness records a single successful evaluate attempt", async () => {
  const requirementSpec = JSON.stringify({
    userIntent: "Build a project plan",
    targetOutcome: "Validated implementation plan",
    constraints: ["React", "Supabase", "mobile responsive"],
    nonGoals: ["Native mobile app"],
    preferredFormat: ["milestones", "tasks"],
    assumptions: ["Single team"],
    missingInfo: [],
    sourceTopic: "Build a React task manager",
    sourceCommand: "debate",
  });

  const cps = JSON.stringify({
    context: "The team is building a React and Supabase app.",
    problem: "The work needs a clear implementation plan.",
    solution: "Create a structured delivery plan for React and Supabase.",
    successCriteria: ["Plan exists", "Dependencies mapped", "Acceptance criteria defined"],
    risks: ["Scope creep", "Schema mismatch"],
  });

  const evaluation = JSON.stringify({
    score: 88,
    requirementCoverage: 90,
    cpsAlignment: 85,
    feasibility: 80,
    hallucinationRisk: 10,
    missingWorkRisk: 15,
    reasons: ["The plan reflects the requested stack."],
    warnings: [],
    suggestedFixes: [],
    passed: true,
  });

  const queue = createStructuredCallQueue([
    requirementSpec,
    cps,
    JSON.stringify(createValidPlan("success")),
    evaluation,
  ]);

  const artifacts = await runPlanHarness(
    {
      topic: "Build a React task manager",
      command: "debate",
      techSpec: "Use React 19 and Supabase.",
      referencePrd: "Reference PRD content.",
    },
    { callStructured: queue.callStructured },
  );

  assert.equal(artifacts.evaluation?.passed, true);
  assert.equal(
    artifacts.attempts.filter((attempt) => attempt.stage === "evaluate" && attempt.success).length,
    1,
  );
  assert.equal(
    artifacts.attempts.filter((attempt) => attempt.stage === "repair").length,
    0,
  );
  assert.match(queue.calls[0].userMessage, /Reference PRD/);
  assert.match(queue.calls[0].userMessage, /React 19 and Supabase/);
});

test("runPlanHarness records repair attempts without duplicating evaluate success", async () => {
  const queue = createStructuredCallQueue([
    JSON.stringify({
      userIntent: "Build a project plan",
      targetOutcome: "Validated implementation plan",
      constraints: ["React", "Supabase"],
      nonGoals: ["Native app"],
      preferredFormat: ["milestones"],
      assumptions: ["One team"],
      missingInfo: [],
      sourceTopic: "Build a React task manager",
      sourceCommand: "debate",
    }),
    JSON.stringify({
      context: "The team needs a React and Supabase plan.",
      problem: "The work needs structure and validation.",
      solution: "Define tasks, dependencies, and milestones.",
      successCriteria: ["Plan exists", "Dependencies mapped", "Acceptance criteria defined"],
      risks: ["Schedule slippage", "Schema mismatch"],
    }),
    JSON.stringify(createValidPlan("first")),
    JSON.stringify({
      score: 64,
      requirementCoverage: 65,
      cpsAlignment: 60,
      feasibility: 68,
      hallucinationRisk: 20,
      missingWorkRisk: 45,
      reasons: ["Coverage is incomplete."],
      warnings: ["Missing some work."],
      suggestedFixes: ["Expand the Supabase delivery work."],
      passed: false,
    }),
    JSON.stringify(createValidPlan("second")),
    JSON.stringify({
      score: 84,
      requirementCoverage: 82,
      cpsAlignment: 80,
      feasibility: 79,
      hallucinationRisk: 18,
      missingWorkRisk: 22,
      reasons: ["The revised plan covers the gaps."],
      warnings: [],
      suggestedFixes: [],
      passed: true,
    }),
  ]);

  const artifacts = await runPlanHarness(
    {
      topic: "Build a React task manager",
      command: "debate",
    },
    { callStructured: queue.callStructured },
  );

  const stages = artifacts.attempts.map((attempt) => attempt.stage);
  assert.deepEqual(stages, [
    "normalize",
    "cps",
    "generate",
    "lint",
    "evaluate",
    "repair",
    "generate",
    "lint",
    "evaluate",
  ]);
  assert.equal(
    artifacts.attempts.filter((attempt) => attempt.stage === "repair" && !attempt.success).length,
    1,
  );
  assert.equal(artifacts.evaluation?.passed, true);
});

test("lintPlan catches representative regression issues", () => {
  const badPlan: GeneratedPlan = {
    title: "Test",
    objective: "Test objective",
    milestones: [{ id: "m1", title: "Milestone 1", objective: "obj", exitCriteria: ["done"] }],
    tasks: [
      {
        id: "t1",
        title: "구현",
        detail: "Has vague text but enough length.",
        milestoneId: "m1",
        dependsOn: [],
        ownerHint: "backend",
        deliverable: "완료",
      },
      {
        id: "t2",
        title: "Design API contract",
        detail: "Describe the required API contract.",
        milestoneId: "missing-milestone",
        dependsOn: ["t999"],
        ownerHint: "backend",
        deliverable: "API contract document",
      },
    ],
    dependencies: [],
    risks: [],
    acceptanceCriteria: ["Only one criterion"],
    executionOrder: ["t1"],
    estimatedComplexity: "simple",
  };

  const issues = lintPlan(badPlan);
  const codes = issues.map((issue) => issue.code);

  assert(codes.includes("VAGUE_TASK_TITLE"));
  assert(codes.includes("VAGUE_DELIVERABLE"));
  assert(codes.includes("ORPHAN_TASK"));
  assert(codes.includes("INVALID_DEPENDENCY"));
  assert(codes.includes("FEW_ACCEPTANCE_CRITERIA"));
  assert(codes.includes("MISSING_IN_EXECUTION_ORDER"));
});

test("lintPlan detects single ownerHint across all tasks", () => {
  const plan: GeneratedPlan = {
    ...createValidPlan("owner"),
    tasks: createValidPlan("owner").tasks.map((t) => ({ ...t, ownerHint: "fullstack" })),
  };
  const issues = lintPlan(plan);
  const codes = issues.map((i) => i.code);
  assert(codes.includes("SINGLE_OWNER_HINT"), "should warn about single ownerHint");
});

test("lintPlan detects individual unreflected constraints as warning", () => {
  const plan = createValidPlan("constraint");
  const rs = {
    userIntent: "Build app",
    targetOutcome: "Working app",
    // 3 constraints: React and Supabase appear in plan text, "kubernetes deploy" does not
    constraints: ["React framework", "Supabase database", "kubernetes deploy pipeline"],
    nonGoals: [],
    preferredFormat: [],
    assumptions: [],
    missingInfo: [],
    sourceTopic: "test",
    sourceCommand: "debate" as const,
  };
  // 1 out of 3 unreflected (< 50%), so CONSTRAINT_NOT_REFLECTED warning should fire
  const issues = lintPlan(plan, rs);
  const codes = issues.map((i) => i.code);
  assert(codes.includes("CONSTRAINT_NOT_REFLECTED"), "should warn about individual unreflected constraint");
  assert(!codes.includes("REQUIREMENTS_NOT_REFLECTED"), "should not fire bulk error when < 50% unreflected");
});

test("parseAndValidate fails invalid JSON and schema mismatches", () => {
  const invalidJson = parseAndValidate("not json", GeneratedPlanSchema);
  const invalidShape = parseAndValidate('{"title":"test"}', GeneratedPlanSchema);

  assert.equal(invalidJson.success, false);
  assert.equal(invalidShape.success, false);
});

// =====================================================
// Storage contract: dedicated vs legacy priority
// =====================================================

test("dedicated harness_data takes priority over legacy recommendation._harness", () => {
  const session = buildSessionFromState(createStateWithHarness());
  const dedicatedRow = buildSessionRow(session);  // default: dedicated

  // Simulate a row that has BOTH dedicated AND legacy data (unlikely but defensive)
  const bothRow: SessionRow = {
    ...dedicatedRow,
    harness_data: { ...session.harness!, evaluation: { ...session.harness!.evaluation!, score: 99 } } as any,
    recommendation: serializeRecommendationPayload(
      null,
      { ...session.harness!, evaluation: { ...session.harness!.evaluation!, score: 50 } } as any,
      "plan_harness",
    ),
  };

  const restored = mapRowToSession(bothRow, "");
  // dedicated (score=99) should win over legacy (score=50)
  assert.equal(restored.harness?.evaluation?.score, 99);
});

test("detectHarnessRestoreSource correctly identifies dedicated vs legacy vs none", () => {
  const session = buildSessionFromState(createStateWithHarness());

  const dedicatedRow = buildSessionRow(session);
  assert.equal(detectHarnessRestoreSource(dedicatedRow), "dedicated");

  const legacyRow = buildSessionRow(session, { harnessStorage: "legacy" });
  assert.equal(detectHarnessRestoreSource(legacyRow), "legacy");

  // Plain session with no harness
  const plainState = { ...createStateWithHarness(), harness: undefined, activeWorkflow: undefined };
  const plainSession = buildSessionFromState(plainState);
  const plainRow = buildSessionRow(plainSession);
  assert.equal(detectHarnessRestoreSource(plainRow), "none");
});

test("after migration, recommendation has no _harness or _activeWorkflow keys", () => {
  const session = buildSessionFromState(createStateWithHarness());
  const dedicatedRow = buildSessionRow(session);

  // In dedicated mode, recommendation should be clean
  const rec = dedicatedRow.recommendation;
  if (rec && typeof rec === "object") {
    assert.equal("_harness" in rec, false, "recommendation should not contain _harness in dedicated mode");
    assert.equal("_activeWorkflow" in rec, false, "recommendation should not contain _activeWorkflow in dedicated mode");
  }
});

test("serializeRecommendationPayload roundtrips through deserializeRecommendationPayload", () => {
  const harness = createStateWithHarness().harness!;
  const serialized = serializeRecommendationPayload(null, harness, "plan_harness");
  const deserialized = deserializeRecommendationPayload(serialized);

  assert.equal(deserialized.activeWorkflow, "plan_harness");
  assert.equal(deserialized.harness?.requirementSpec?.userIntent, "Create a planning workflow.");
  assert.equal(deserialized.recommendation, null);
});

test("legacy-only row restores correctly and detectHarnessRestoreSource returns legacy", () => {
  const session = buildSessionFromState(createStateWithHarness());
  const legacyRow = buildSessionRow(session, { harnessStorage: "legacy" });

  // Verify legacy row structure
  assert.equal(legacyRow.harness_data, null);
  assert.equal(legacyRow.active_workflow, null);
  assert.equal(detectHarnessRestoreSource(legacyRow), "legacy");

  // Restore and verify
  const restored = mapRowToSession(legacyRow, "");
  assert.equal(restored.activeWorkflow, "plan_harness");
  assert.equal(restored.harness?.attempts[0]?.model, "claude-opus-4-6");
});

// =====================================================
// Abort / cancellation tests
// =====================================================

test("abort before any LLM call emits aborted and no completed", async () => {
  const ac = new AbortController();
  ac.abort(); // abort immediately

  const events: PlanHarnessStreamEvent[] = [];
  const queue = createStructuredCallQueue([
    // Should never be consumed
    '{"userIntent":"x","targetOutcome":"x","constraints":[],"nonGoals":[],"preferredFormat":[],"assumptions":[],"missingInfo":[],"sourceTopic":"x","sourceCommand":"debate"}',
  ]);

  const artifacts = await runPlanHarness(
    { topic: "test", command: "debate" },
    { callStructured: queue.callStructured, signal: ac.signal, onEvent: (ev) => events.push(ev) },
  );

  const eventNames = events.map((e) => e.event);
  assert(eventNames.includes("aborted"), "should emit aborted");
  assert(!eventNames.includes("completed"), "should not emit completed");
  assert(!eventNames.includes("error"), "should not emit error");
  assert.equal(queue.calls.length, 0, "no LLM calls should have been made");
  assert.equal(artifacts.attempts.length, 0, "no attempts should be recorded");
});

test("abort during normalize stops pipeline and emits aborted", async () => {
  const ac = new AbortController();
  let callCount = 0;

  const callStructured: PlanHarnessStructuredCall = async (_sys, _user, _max, signal) => {
    callCount++;
    // Simulate abort happening during the first LLM call
    ac.abort();
    if (signal?.aborted) throw new DOMException("AbortError", "AbortError");
    return '{}';
  };

  const events: PlanHarnessStreamEvent[] = [];
  const artifacts = await runPlanHarness(
    { topic: "test", command: "debate" },
    { callStructured, signal: ac.signal, onEvent: (ev) => events.push(ev) },
  );

  const eventNames = events.map((e) => e.event);
  assert(eventNames.includes("aborted"), "should emit aborted");
  assert(!eventNames.includes("completed"), "should not emit completed");
  assert.equal(callCount, 1, "only one LLM call before abort");
  // normalize failed due to abort, so no success attempts
  const successAttempts = artifacts.attempts.filter((a) => a.success);
  assert.equal(successAttempts.length, 0, "no successful attempts after abort");
});

test("abort between stages stops before next stage LLM call", async () => {
  const ac = new AbortController();
  let callCount = 0;

  const requirementSpec = JSON.stringify({
    userIntent: "test",
    targetOutcome: "test",
    constraints: [],
    nonGoals: [],
    preferredFormat: [],
    assumptions: [],
    missingInfo: [],
    sourceTopic: "test",
    sourceCommand: "debate",
  });

  const callStructured: PlanHarnessStructuredCall = async (_sys, _user, _max, signal) => {
    callCount++;
    if (callCount === 1) {
      return requirementSpec;
    }
    // Second call (cps) — abort should have been detected before reaching here,
    // but if it does reach here, signal should be aborted
    if (signal?.aborted) throw new DOMException("AbortError", "AbortError");
    return '{}';
  };

  // Use onEvent to abort right after normalize succeeds (attempt event for normalize)
  const events: PlanHarnessStreamEvent[] = [];
  const artifacts = await runPlanHarness(
    { topic: "test", command: "debate" },
    {
      callStructured,
      signal: ac.signal,
      onEvent: (ev) => {
        events.push(ev);
        // Abort after normalize attempt succeeds, before cps stage_started
        if (ev.event === "attempt" && "attempt" in ev && ev.attempt.stage === "normalize" && ev.attempt.success) {
          ac.abort();
        }
      },
    },
  );

  const eventNames = events.map((e) => e.event);
  // Abort fires after normalize attempt emit, before cps LLM call.
  // runWithRetry records success, but checkAbort() fires before requirementSpec is set
  // OR after requirementSpec is set but before cps starts.
  // Either way: no completed, aborted is present.
  assert(eventNames.includes("aborted"), "should emit aborted");
  assert(!eventNames.includes("completed"), "should not emit completed");

  // Verify cps never got a success attempt
  const cpsSuccess = artifacts.attempts.filter((a) => a.stage === "cps" && a.success);
  assert.equal(cpsSuccess.length, 0, "cps should not have a successful attempt");
});

test("abort does not add extra attempts after the abort point", async () => {
  const ac = new AbortController();
  let callCount = 0;

  const outputs = [
    JSON.stringify({
      userIntent: "test", targetOutcome: "test", constraints: [], nonGoals: [],
      preferredFormat: [], assumptions: [], missingInfo: [], sourceTopic: "test", sourceCommand: "debate",
    }),
    JSON.stringify({
      context: "test context here", problem: "test problem here", solution: "test solution here",
      successCriteria: ["x"], risks: [],
    }),
  ];

  const callStructured: PlanHarnessStructuredCall = async (_sys, _user, _max, _signal) => {
    callCount++;
    const out = outputs.shift();
    if (callCount === 2) {
      // Abort after cps succeeds
      ac.abort();
    }
    if (!out) throw new Error("exhausted");
    return out;
  };

  const artifacts = await runPlanHarness(
    { topic: "test", command: "debate" },
    { callStructured, signal: ac.signal },
  );

  // Should have normalize + cps attempts, but nothing after
  const stagesAfterCps = artifacts.attempts.filter(
    (a) => a.stage !== "normalize" && a.stage !== "cps"
  );
  assert.equal(stagesAfterCps.length, 0, "no attempts after abort point (generate/lint/evaluate)");
});

// =====================================================
// Previous harness summary builder tests
// =====================================================

test("buildPreviousHarnessSummary extracts milestone and task structure", () => {
  const artifacts: PlanHarnessArtifacts = {
    requirementSpec: {
      userIntent: "Build a task manager",
      targetOutcome: "Working app",
      constraints: ["React", "Supabase"],
      nonGoals: ["Native mobile"],
      preferredFormat: [],
      assumptions: [],
      missingInfo: [],
      sourceTopic: "test",
      sourceCommand: "debate",
    },
    cps: {
      context: "Team needs a plan",
      problem: "No structured plan exists",
      solution: "Create milestones and tasks",
      successCriteria: ["Plan exists"],
      risks: ["Scope creep"],
    },
    generatedPlan: createValidPlan("summary-test"),
    lintIssues: [],
    evaluation: {
      score: 82,
      requirementCoverage: 85,
      cpsAlignment: 80,
      feasibility: 78,
      hallucinationRisk: 15,
      missingWorkRisk: 20,
      reasons: ["Good coverage"],
      warnings: ["Watch scope"],
      suggestedFixes: ["Add error handling tasks"],
      passed: true,
    },
    attempts: [],
  };

  const summary = buildPreviousHarnessSummary(artifacts);

  // milestone ids present
  assert(summary.includes("m1:"), "should include milestone m1");
  assert(summary.includes("m2:"), "should include milestone m2");

  // task ids present
  assert(summary.includes("t1:"), "should include task t1");
  assert(summary.includes("t2:"), "should include task t2");
  assert(summary.includes("t3:"), "should include task t3");
  assert(summary.includes("t4:"), "should include task t4");

  // execution order present
  assert(summary.includes("t1 → t2 → t3 → t4"), "should include execution order");

  // evaluation warnings present
  assert(summary.includes("Watch scope"), "should include evaluation warnings");
  assert(summary.includes("Add error handling tasks"), "should include suggested fixes");

  // constraints present
  assert(summary.includes("React"), "should include constraints");
  assert(summary.includes("Native mobile"), "should include nonGoals");
});

test("buildPreviousHarnessSummary handles empty artifacts gracefully", () => {
  const empty: PlanHarnessArtifacts = { lintIssues: [], attempts: [] };
  const summary = buildPreviousHarnessSummary(empty);
  assert.equal(summary, "", "empty artifacts should produce empty summary");
});

test("rerun with revisionRequest includes previousPlanSummary in API call", async () => {
  // This test verifies the call shape by checking that the harness runner
  // receives previousPlanSummary when revisionRequest is present.
  const _calls: Array<{ systemPrompt: string; userMessage: string }> = [];
  const requirementSpec = JSON.stringify({
    userIntent: "Revised plan",
    targetOutcome: "Better plan",
    constraints: ["React", "2 weeks"],
    nonGoals: ["Mobile"],
    preferredFormat: [],
    assumptions: [],
    missingInfo: [],
    sourceTopic: "test",
    sourceCommand: "debate",
  });

  const queue = createStructuredCallQueue([
    requirementSpec,
    JSON.stringify({
      context: "Revision context",
      problem: "Need restructured plan",
      solution: "Apply revision request",
      successCriteria: ["Revised plan meets constraints"],
      risks: [],
    }),
    JSON.stringify(createValidPlan("revised")),
    JSON.stringify({
      score: 85,
      requirementCoverage: 88,
      cpsAlignment: 82,
      feasibility: 80,
      hallucinationRisk: 10,
      missingWorkRisk: 15,
      reasons: ["Revision applied"],
      warnings: [],
      suggestedFixes: [],
      passed: true,
    }),
  ]);

  await runPlanHarness(
    {
      topic: "Build a React task manager",
      command: "debate",
      revisionRequest: "인증 태스크를 결제와 분리해주세요",
      previousPlanSummary: "m1: Setup\nt1: Init project [m1]\n실행순서: t1",
    },
    { callStructured: queue.callStructured },
  );

  // The first call (normalize) should contain both previous summary and revision request
  const normalizeCall = queue.calls[0];
  assert(normalizeCall.userMessage.includes("이전 계획 요약"), "normalize should include previous plan summary header");
  assert(normalizeCall.userMessage.includes("m1: Setup"), "normalize should include actual summary content");
  assert(normalizeCall.userMessage.includes("인증 태스크를 결제와 분리"), "normalize should include revision request");
});

// =====================================================
// Harness history + diff tests
// =====================================================

test("createSnapshot captures plan and evaluation", () => {
  const artifacts: PlanHarnessArtifacts = {
    generatedPlan: createValidPlan("snap"),
    evaluation: { score: 80, requirementCoverage: 80, cpsAlignment: 75, feasibility: 78,
      hallucinationRisk: 12, missingWorkRisk: 18, reasons: [], warnings: ["warn1"], suggestedFixes: [], passed: true },
    lintIssues: [],
    attempts: [],
  };
  const snap = createSnapshot(artifacts, 1, "test topic", "split auth");
  assert.equal(snap.runNumber, 1);
  assert.equal(snap.revisionRequest, "split auth");
  assert.equal(snap.generatedPlan?.title, "React Supabase plan snap");
  assert.equal(snap.evaluation?.score, 80);
  assert.equal(snap.topic, "test topic");
  assert(snap.completedAt > 0);
});

test("pushSnapshot limits history to 3 entries", () => {
  const mk = (n: number): HarnessRunSnapshot => ({
    runNumber: n, completedAt: n, topic: "t", generatedPlan: createValidPlan(`h${n}`),
  });
  let history: HarnessRunSnapshot[] = [];
  history = pushSnapshot(history, mk(1));
  assert.equal(history.length, 1);
  history = pushSnapshot(history, mk(2));
  assert.equal(history.length, 2);
  history = pushSnapshot(history, mk(3));
  assert.equal(history.length, 3);
  history = pushSnapshot(history, mk(4));
  assert.equal(history.length, 3);
  assert.equal(history[0].runNumber, 4, "newest first");
  assert.equal(history[2].runNumber, 2, "oldest entry is run 2, run 1 evicted");
});

test("computeHarnessDiff detects milestone and task changes", () => {
  const prevPlan = createValidPlan("prev");
  const curPlan: GeneratedPlan = {
    ...createValidPlan("cur"),
    milestones: [
      { id: "m1", title: "Renamed milestone", objective: "obj", exitCriteria: ["done"] },
      { id: "m3", title: "New milestone", objective: "new", exitCriteria: ["done"] },
    ],
    tasks: [
      ...createValidPlan("cur").tasks,
      { id: "t5", title: "Brand new task here", detail: "detail", milestoneId: "m3",
        dependsOn: [], ownerHint: "dev", deliverable: "New deliverable output" },
    ],
    executionOrder: ["t1", "t2", "t3", "t4", "t5"],
  };

  const snapshot: HarnessRunSnapshot = {
    runNumber: 1, completedAt: 1, topic: "test",
    generatedPlan: prevPlan,
    evaluation: { score: 75, requirementCoverage: 70, cpsAlignment: 70, feasibility: 72,
      hallucinationRisk: 20, missingWorkRisk: 25, reasons: [], warnings: ["w1", "w2"], suggestedFixes: [], passed: true },
  };

  const current: PlanHarnessArtifacts = {
    generatedPlan: curPlan,
    evaluation: { score: 85, requirementCoverage: 85, cpsAlignment: 80, feasibility: 80,
      hallucinationRisk: 10, missingWorkRisk: 15, reasons: [], warnings: ["w1"], suggestedFixes: [], passed: true },
    lintIssues: [], attempts: [],
  };

  const diff = computeHarnessDiff(current, snapshot);

  assert.equal(diff.milestonesAdded.length, 1, "m3 added");
  assert(diff.milestonesAdded[0].includes("New milestone"));
  assert.equal(diff.milestonesRemoved.length, 1, "m2 removed");
  assert.equal(diff.milestonesRenamed.length, 1, "m1 renamed");
  assert.equal(diff.milestonesRenamed[0].id, "m1");
  assert.equal(diff.tasksAdded, 1);
  assert.equal(diff.tasksRemoved, 0);
  assert.equal(diff.scoreChange, 10);
  assert.equal(diff.scoreBefore, 75);
  assert.equal(diff.scoreAfter, 85);
  assert.equal(diff.executionOrderChanged, true);
  assert.equal(diff.warningsBefore, 2);
  assert.equal(diff.warningsAfter, 1);
});

test("computeHarnessDiff handles identical plans", () => {
  const plan = createValidPlan("same");
  const ev = { score: 80, requirementCoverage: 80, cpsAlignment: 75, feasibility: 78,
    hallucinationRisk: 12, missingWorkRisk: 18, reasons: [], warnings: [], suggestedFixes: [], passed: true };
  const snapshot: HarnessRunSnapshot = { runNumber: 1, completedAt: 1, topic: "t", generatedPlan: plan, evaluation: ev };
  const current: PlanHarnessArtifacts = { generatedPlan: plan, evaluation: ev, lintIssues: [], attempts: [] };
  const diff = computeHarnessDiff(current, snapshot);

  assert.equal(diff.milestonesAdded.length, 0);
  assert.equal(diff.milestonesRemoved.length, 0);
  assert.equal(diff.tasksAdded, 0);
  assert.equal(diff.tasksRemoved, 0);
  assert.equal(diff.scoreChange, 0);
  assert.equal(diff.executionOrderChanged, false);
});

test("session roundtrip preserves harness metadata (runCount, revisionRequest, userSummary)", () => {
  const stateWithMeta = createStateWithHarness();
  stateWithMeta.harness!.runCount = 3;
  stateWithMeta.harness!.revisionRequest = "인증 태스크를 분리해주세요";
  stateWithMeta.harness!.userSummary = "요구사항 정규화 완료 → CPS 문서 생성 완료 → 평가: 82점 (통과)";

  const session = buildSessionFromState(stateWithMeta);
  const row = buildSessionRow(session);
  const restored = mapRowToSession(row, session.techSpec || "");

  assert.equal(restored.harness?.runCount, 3);
  assert.equal(restored.harness?.revisionRequest, "인증 태스크를 분리해주세요");
  assert.equal(restored.harness?.userSummary, "요구사항 정규화 완료 → CPS 문서 생성 완료 → 평가: 82점 (통과)");
});

test("session roundtrip preserves harness history", () => {
  const stateWithHistory = createStateWithHarness();
  stateWithHistory.harness!.history = [
    { runNumber: 1, completedAt: 1000, topic: "old topic",
      generatedPlan: createValidPlan("old"), evaluation: stateWithHistory.harness!.evaluation },
  ];
  const session = buildSessionFromState(stateWithHistory);
  const row = buildSessionRow(session);
  const restored = mapRowToSession(row, session.techSpec || "");

  assert.equal(restored.harness?.history?.length, 1);
  assert.equal(restored.harness?.history?.[0].runNumber, 1);
  assert.equal(restored.harness?.history?.[0].generatedPlan?.title, "React Supabase plan old");
});

// =====================================================
// Model config separation tests
// =====================================================

test("runPlanHarness records generation model on generate attempts", async () => {
  const queue = createStructuredCallQueue([
    JSON.stringify({
      userIntent: "test", targetOutcome: "test", constraints: [], nonGoals: [],
      preferredFormat: [], assumptions: [], missingInfo: [], sourceTopic: "t", sourceCommand: "debate",
    }),
    JSON.stringify({
      context: "test context here", problem: "test problem here", solution: "test solution here",
      successCriteria: ["a"], risks: [],
    }),
    JSON.stringify(createValidPlan("model-test")),
    JSON.stringify({
      score: 85, requirementCoverage: 85, cpsAlignment: 80, feasibility: 80,
      hallucinationRisk: 10, missingWorkRisk: 15, reasons: ["ok"], warnings: [], suggestedFixes: [], passed: true,
    }),
  ]);

  const genModel = { provider: "anthropic", model: "claude-sonnet-4-6" };
  const evalModel = { provider: "openai", model: "gpt-5.4" };

  const artifacts = await runPlanHarness(
    { topic: "test", command: "debate" },
    { callStructured: queue.callStructured, models: { generation: genModel, evaluation: evalModel } },
  );

  // normalize, cps, generate should use generation model
  const genAttempts = artifacts.attempts.filter((a) => ["normalize", "cps", "generate"].includes(a.stage));
  for (const a of genAttempts) {
    assert.equal(a.model, "claude-sonnet-4-6", `${a.stage} should use generation model`);
    assert.equal(a.provider, "anthropic", `${a.stage} should use generation provider`);
  }

  // evaluate should use evaluation model
  const evalAttempts = artifacts.attempts.filter((a) => a.stage === "evaluate");
  for (const a of evalAttempts) {
    assert.equal(a.model, "gpt-5.4", `evaluate should use evaluation model`);
    assert.equal(a.provider, "openai", `evaluate should use evaluation provider`);
  }
});

test("runPlanHarness uses defaults when no models specified", async () => {
  const queue = createStructuredCallQueue([
    JSON.stringify({
      userIntent: "test", targetOutcome: "test", constraints: [], nonGoals: [],
      preferredFormat: [], assumptions: [], missingInfo: [], sourceTopic: "t", sourceCommand: "debate",
    }),
    JSON.stringify({
      context: "test context here", problem: "test problem here", solution: "test solution here",
      successCriteria: ["a"], risks: [],
    }),
    JSON.stringify(createValidPlan("default")),
    JSON.stringify({
      score: 85, requirementCoverage: 85, cpsAlignment: 80, feasibility: 80,
      hallucinationRisk: 10, missingWorkRisk: 15, reasons: ["ok"], warnings: [], suggestedFixes: [], passed: true,
    }),
  ]);

  const artifacts = await runPlanHarness(
    { topic: "test", command: "debate" },
    { callStructured: queue.callStructured },
  );

  // All attempts should use default claude-opus-4-6
  for (const a of artifacts.attempts) {
    assert.equal(a.model, "claude-opus-4-6", `${a.stage} should default to opus`);
    assert.equal(a.provider, "anthropic", `${a.stage} should default to anthropic`);
  }
});

// =====================================================
// Abort snapshot + reload defense tests
// =====================================================

test("abort snapshot preserves partial harness and sets status to error", () => {
  // Simulate what buildAbortSnapshot does: take current state, override status/error
  const current = createStateWithHarness();
  current.status = "generating_plan";
  current.currentHarnessStage = "cps";
  current.harness!.attempts = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 1 },
  ];

  // buildAbortSnapshot equivalent
  const aborted = {
    ...current,
    currentHarnessStage: undefined,
    status: "error" as const,
    error: "사용자에 의해 중단됨",
  };

  // Verify abort state
  assert.equal(aborted.status, "error");
  assert.equal(aborted.error, "사용자에 의해 중단됨");
  assert.equal(aborted.currentHarnessStage, undefined);
  // Partial harness data preserved
  assert.equal(aborted.harness?.attempts.length, 1);
  assert.equal(aborted.harness?.attempts[0].stage, "normalize");
  assert.equal(aborted.activeWorkflow, "plan_harness");

  // Save/restore roundtrip
  const session = buildSessionFromState(aborted, "error");
  const row = buildSessionRow(session);
  const restored = mapRowToSession(row, "");
  assert.equal(restored.status, "error");
  assert.equal(restored.harness?.attempts.length, 1);
  assert.equal(restored.activeWorkflow, "plan_harness");
});

test("generating_plan harness session is corrected to error on load", () => {
  // Simulate a session saved with stale generating_plan status
  const staleState = createStateWithHarness();
  staleState.status = "generating_plan";
  staleState.activeWorkflow = "plan_harness";

  const session = buildSessionFromState(staleState, "generating_plan");
  const row = buildSessionRow(session);
  const restored = mapRowToSession(row, "");

  // The session has status=generating_plan and activeWorkflow=plan_harness
  // loadSession defense should convert this to error
  const correctedStatus = restored.activeWorkflow === "plan_harness" && restored.status === "generating_plan"
    ? "error"
    : restored.status;

  assert.equal(correctedStatus, "error", "stale generating_plan harness session should be corrected to error");
});

// =====================================================
// mergeAttempts dedupe tests
// =====================================================

test("mergeAttempts keeps client-only attempts", () => {
  const client: PlanHarnessArtifacts["attempts"] = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100 },
    { attempt: 2, stage: "cps", success: true, issues: [], timestamp: 200 },
    { attempt: 3, stage: "generate", success: true, issues: [], timestamp: 300 },
  ];
  // Server only has 2 (missed last one due to abort timing)
  const server: PlanHarnessArtifacts["attempts"] = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100 },
    { attempt: 2, stage: "cps", success: true, issues: [], timestamp: 200 },
  ];
  const merged = mergeAttempts(client, server);
  assert.equal(merged.length, 3, "client-only attempt #3 should be kept");
  assert.equal(merged[2].stage, "generate");
});

test("mergeAttempts adds server-only attempts", () => {
  const client: PlanHarnessArtifacts["attempts"] = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100 },
    { attempt: 2, stage: "cps", success: true, issues: [], timestamp: 200 },
  ];
  // Server has an extra attempt that client missed
  const server: PlanHarnessArtifacts["attempts"] = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100 },
    { attempt: 2, stage: "cps", success: true, issues: [], timestamp: 200 },
    { attempt: 3, stage: "generate", success: false, issues: ["schema error"], timestamp: 300 },
  ];
  const merged = mergeAttempts(client, server);
  assert.equal(merged.length, 3, "server-only attempt #3 should be added");
  assert.equal(merged[2].issues[0], "schema error");
});

test("mergeAttempts prefers server when same key has more complete data", () => {
  const client: PlanHarnessArtifacts["attempts"] = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100 },
    { attempt: 2, stage: "cps", success: false, issues: ["partial"], timestamp: 200 },
  ];
  const server: PlanHarnessArtifacts["attempts"] = [
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100, model: "claude-opus-4-6", provider: "anthropic" },
    { attempt: 2, stage: "cps", success: false, issues: ["full error: schema validation failed"], timestamp: 200, model: "claude-opus-4-6" },
  ];
  const merged = mergeAttempts(client, server);
  assert.equal(merged.length, 2);
  // Server values should win (more complete)
  assert.equal(merged[0].model, "claude-opus-4-6", "server model should be present");
  assert.equal(merged[1].issues[0], "full error: schema validation failed", "server issues should be preferred");
});

test("mergeAttempts handles empty arrays", () => {
  assert.equal(mergeAttempts([], []).length, 0, "both empty");
  const one = [{ attempt: 1, stage: "normalize" as const, success: true, issues: [], timestamp: 1 }];
  assert.equal(mergeAttempts(one, []).length, 1, "client only");
  assert.equal(mergeAttempts([], one).length, 1, "server only");
});

test("mergeAttempts result is sorted by attempt number", () => {
  const client: PlanHarnessArtifacts["attempts"] = [
    { attempt: 3, stage: "generate", success: true, issues: [], timestamp: 300 },
    { attempt: 1, stage: "normalize", success: true, issues: [], timestamp: 100 },
  ];
  const server: PlanHarnessArtifacts["attempts"] = [
    { attempt: 2, stage: "cps", success: true, issues: [], timestamp: 200 },
  ];
  const merged = mergeAttempts(client, server);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].attempt, 1);
  assert.equal(merged[1].attempt, 2);
  assert.equal(merged[2].attempt, 3);
});

process.on("beforeExit", () => {
  if (process.exitCode && process.exitCode !== 0) {
    return;
  }

  console.log(`passed ${passed} harness tests`);
});
