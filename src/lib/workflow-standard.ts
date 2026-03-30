import { WorkflowContext } from "./workflow-context";
import {
  DebateState, DebateMessage, DebateRoleId, DebateStageId,
  FeedbackEntry, Recommendation, VerificationProvider,
} from "./types";
import type { HarnessInputArtifacts } from "./types";
import { TopicSubmitData } from "@/components/TopicInput";
import {
  QUICK_ROLES, DEEP_ROLES, CONSULT_ROLES, FIX_ROLES,
  getDebateOrder,
} from "./constants";
import { initialState } from "./debate-reducer";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ===== 역할 하나 실행 =====
export async function runRole(
  ctx: WorkflowContext,
  roleId: DebateRoleId,
  stage: DebateStageId,
  topic: string,
  historyMsgs: DebateMessage[],
  snap: DebateState,
  feedback?: string,
): Promise<DebateMessage> {
  ctx.setStreamRoleId(roleId);
  ctx.setStreamText("");

  const content = await ctx.fetchStream("/api/debate", {
    roleId,
    topic,
    stage,
    confirmedRoles: snap.confirmedRoles,
    history: historyMsgs,
    feedback,
    isRefine: !!feedback,
    debateEngine: snap.debateEngine,
    techSpec: snap.techSpec || undefined,
    modeInput: snap.modeInput || undefined,
    command: snap.command,
  }, (t) => ctx.setStreamText(t));

  ctx.setStreamText("");
  ctx.setStreamRoleId(null);

  return {
    id: `${stage}-${roleId}-${Date.now()}`,
    roleId,
    stage,
    content,
    timestamp: Date.now(),
  };
}

// ===== 스테이지 실행 =====
export async function runStage(
  ctx: WorkflowContext,
  stage: DebateStageId,
  topic: string,
  allMessages: DebateMessage[],
  snap: DebateState,
  feedback?: string,
) {
  ctx.dispatch({ type: "SET_STAGE", stage, status: "debating" });

  let roles: DebateRoleId[];
  if (stage === "final") {
    roles = snap.confirmedRoles.includes("moderator") ? ["moderator"] : [];
  } else {
    roles = getDebateOrder(snap.confirmedRoles, snap.command).filter((r) => r !== "moderator");
  }

  for (let i = 0; i < roles.length; i++) {
    ctx.dispatch({ type: "SET_ROLE_INDEX", index: i });
    const historyForRole = stage === "independent" ? [] : allMessages;
    const msg = await runRole(ctx, roles[i], stage, topic, historyForRole, snap, feedback);
    allMessages.push(msg);
    ctx.dispatch({ type: "SET_MESSAGES", messages: [...allMessages] });
  }
}

// ===== PRD/문서 생성 =====
export async function generatePrd(
  ctx: WorkflowContext,
  topic: string,
  allMessages: DebateMessage[],
  snap: DebateState,
  mode: "initial" | "refine" = "initial",
  previousPrd?: string,
  feedbackText?: string,
) {
  const docName = snap.command === "consult" ? "의견 종합 보고서"
    : snap.command === "extend" ? "기능 확장 계획서"
    : snap.command === "fix" ? "구조 수정 계획서"
    : "PRD";

  ctx.dispatch({ type: "SET_STATUS", status: "generating_prd" });
  ctx.setStreamRoleId(null);
  ctx.setStreamLabel(`${docName} 생성 중 (Claude Opus 4.6)`);
  ctx.setStreamText("");

  const prd = await ctx.fetchStream("/api/synthesize", {
    topic,
    messages: allMessages,
    confirmedRoles: snap.confirmedRoles,
    verificationResult: snap.verificationResult || undefined,
    feedbacks: snap.feedbacks,
    previousPrd: previousPrd,
    feedback: feedbackText,
    mode,
    debateEngine: snap.debateEngine,
    techSpec: snap.techSpec || undefined,
    modeInput: snap.modeInput || undefined,
    command: snap.command,
  }, (t: string) => ctx.dispatch({ type: "STREAM_PRD", prd: t }));

  ctx.setStreamLabel("");

  const currentRevisions = ctx.stateRef.current.prdRevisions;
  const currentRevisionCount = ctx.stateRef.current.revisionCount;
  ctx.dispatch({
    type: "COMPLETE_PRD",
    prd,
    prdRevisions: [...currentRevisions, prd],
    revisionCount: currentRevisionCount + 1,
    status: "complete",
  });
  await ctx.save({ ...ctx.stateRef.current, prd, status: "complete" }, "complete");
}

// ===== 공통 토론 실행 (모든 모드 공유) =====
export async function runDebateFlow(
  ctx: WorkflowContext,
  snap: DebateState,
  allMessages: DebateMessage[],
) {
  await runStage(ctx, "independent", snap.topic, allMessages, snap);
  await runStage(ctx, "critique", snap.topic, allMessages, snap);
  await runStage(ctx, "final", snap.topic, allMessages, snap);
  await ctx.save({ ...ctx.stateRef.current, messages: [...allMessages] }, "debated");
}

// ===== 1. 추천 받기 (/debate) =====
export async function requestRecommendation(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();

  ctx.dispatch({
    type: "INIT_SESSION",
    state: {
      ...initialState,
      topic: data.topic,
      command: "debate",
      debateEngine: data.debateEngine,
      verifyEngine: data.verifyEngine,
      techSpec: data.techSpec,
      modeInput: null,
      status: "recommending",
      sessionId,
      createdAt,
    },
  });

  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: data.topic }),
    });
    if (!res.ok) throw new Error("추천 분석 실패");
    const recommendation: Recommendation = await res.json();

    ctx.dispatch({
      type: "SET_RECOMMENDATION",
      recommendation,
      confirmedRoles: recommendation.suggestedRoles,
      status: "awaiting_confirmation",
    });
  } catch (e: any) {
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 2. 역할 확인 후 토론 시작 =====
export async function confirmAndStart(ctx: WorkflowContext, roles: DebateRoleId[]) {
  const snap = ctx.stateRef.current;
  const allMessages: DebateMessage[] = [];

  ctx.dispatch({ type: "CONFIRM_ROLES", roles, status: "debating" });

  const updatedSnap = { ...snap, confirmedRoles: roles };

  try {
    await runDebateFlow(ctx, updatedSnap, allMessages);
    ctx.dispatch({ type: "SET_STATUS", status: "awaiting_verification" });
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 3. 빠른 토론 (/quick) =====
export async function startQuick(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();
  const roles = QUICK_ROLES;

  const snap: DebateState = {
    ...initialState,
    topic: data.topic,
    command: "quick",
    debateEngine: data.debateEngine,
    verifyEngine: data.verifyEngine,
    techSpec: data.techSpec,
    modeInput: null,
    confirmedRoles: roles,
    status: "debating",
    sessionId,
    createdAt,
  };
  ctx.dispatch({ type: "INIT_SESSION", state: snap });

  const allMessages: DebateMessage[] = [];
  try {
    await runDebateFlow(ctx, snap, allMessages);
    await generatePrd(ctx, data.topic, allMessages, { ...snap, messages: allMessages });
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 4. 깊은 토론 (/deep) =====
export async function startDeep(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();
  const roles = DEEP_ROLES;

  const snap: DebateState = {
    ...initialState,
    topic: data.topic,
    command: "deep",
    debateEngine: data.debateEngine,
    verifyEngine: data.verifyEngine,
    techSpec: data.techSpec,
    modeInput: null,
    confirmedRoles: roles,
    status: "debating",
    sessionId,
    createdAt,
  };
  ctx.dispatch({ type: "INIT_SESSION", state: snap });

  const allMessages: DebateMessage[] = [];
  try {
    await runDebateFlow(ctx, snap, allMessages);

    // /deep는 GPT + Gemini 2라운드 검증
    for (const vp of ["chatgpt", "gemini"] as VerificationProvider[]) {
      ctx.dispatch({ type: "SET_VERIFYING", provider: vp });
      ctx.setStreamRoleId(null);
      ctx.setStreamLabel(`외부 검증 중 (${vp === "chatgpt" ? "GPT-5.4" : "Gemini 3.1 Pro"})`);
      ctx.setStreamText("");

      const verifyContent = await ctx.fetchStream("/api/verify", {
        provider: vp,
        topic: data.topic,
        messages: allMessages,
        confirmedRoles: roles,
      }, (t) => ctx.setStreamText(t));

      ctx.setStreamLabel("");
      const prevResult = ctx.stateRef.current.verificationResult;
      ctx.dispatch({
        type: "SET_VERIFICATION_RESULT",
        result: prevResult
          ? prevResult + "\n\n---\n\n" + verifyContent
          : verifyContent,
      });
    }

    await generatePrd(ctx, data.topic, allMessages, ctx.stateRef.current);
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 5. /consult =====
export async function startConsult(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();
  const roles = CONSULT_ROLES;

  const snap: DebateState = {
    ...initialState,
    topic: data.topic,
    command: "consult",
    debateEngine: data.debateEngine,
    verifyEngine: data.verifyEngine,
    techSpec: data.techSpec,
    modeInput: data.modeInput,
    confirmedRoles: roles,
    status: "debating",
    sessionId,
    createdAt,
  };
  ctx.dispatch({ type: "INIT_SESSION", state: snap });

  const allMessages: DebateMessage[] = [];
  try {
    await runDebateFlow(ctx, snap, allMessages);

    if (data.verifyEngine !== "none") {
      ctx.dispatch({ type: "SET_STATUS", status: "awaiting_verification" });
    } else {
      await generatePrd(ctx, data.topic, allMessages, { ...snap, messages: allMessages });
    }
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 6. /extend =====
export async function startExtend(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();
  const roles = CONSULT_ROLES; // 같은 기본 역할

  const snap: DebateState = {
    ...initialState,
    topic: data.topic,
    command: "extend",
    debateEngine: data.debateEngine,
    verifyEngine: data.verifyEngine,
    techSpec: data.techSpec,
    modeInput: data.modeInput,
    confirmedRoles: roles,
    status: "debating",
    sessionId,
    createdAt,
  };
  ctx.dispatch({ type: "INIT_SESSION", state: snap });

  const allMessages: DebateMessage[] = [];
  try {
    await runDebateFlow(ctx, snap, allMessages);

    if (data.verifyEngine !== "none") {
      ctx.dispatch({ type: "SET_STATUS", status: "awaiting_verification" });
    } else {
      await generatePrd(ctx, data.topic, allMessages, { ...snap, messages: allMessages });
    }
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 7. /fix =====
export async function startFix(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();
  const roles = FIX_ROLES;

  const snap: DebateState = {
    ...initialState,
    topic: data.topic,
    command: "fix",
    debateEngine: data.debateEngine,
    verifyEngine: data.verifyEngine,
    techSpec: data.techSpec,
    modeInput: data.modeInput,
    confirmedRoles: roles,
    status: "debating",
    sessionId,
    createdAt,
  };
  ctx.dispatch({ type: "INIT_SESSION", state: snap });

  const allMessages: DebateMessage[] = [];
  try {
    await runDebateFlow(ctx, snap, allMessages);

    if (data.verifyEngine !== "none") {
      ctx.dispatch({ type: "SET_STATUS", status: "awaiting_verification" });
    } else {
      await generatePrd(ctx, data.topic, allMessages, { ...snap, messages: allMessages });
    }
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 8. 검증 선택 후 처리 =====
export async function handleVerificationChoice(
  ctx: WorkflowContext,
  choice: VerificationProvider | null | "redebate",
  redebateTopic?: string,
) {
  const snap = ctx.stateRef.current;

  if (choice === "redebate") {
    const allMessages = [...snap.messages];
    const feedback = redebateTopic || "";
    ctx.dispatch({ type: "SET_STATUS", status: "debating" });

    try {
      await runStage(ctx, "critique", snap.topic, allMessages, snap, feedback);
      await runStage(ctx, "final", snap.topic, allMessages, snap);
      await ctx.save({ ...ctx.stateRef.current, messages: [...allMessages] }, "debated");
      ctx.dispatch({ type: "SET_STATUS", status: "awaiting_verification" });
    } catch (e: any) {
      if (e.name === "AbortError") return;
      ctx.dispatch({ type: "SET_ERROR", error: e.message });
    }
    return;
  }

  if (choice === null) {
    await generatePrd(ctx, snap.topic, snap.messages, snap);
    return;
  }

  ctx.dispatch({ type: "SET_VERIFYING", provider: choice });
  ctx.setStreamRoleId(null);
  ctx.setStreamLabel(`외부 검증 중 (${choice === "chatgpt" ? "GPT-5.4" : "Gemini 3.1 Pro"})`);
  ctx.setStreamText("");

  try {
    const verifyContent = await ctx.fetchStream("/api/verify", {
      provider: choice,
      topic: snap.topic,
      messages: snap.messages,
      confirmedRoles: snap.confirmedRoles,
    }, (t) => ctx.setStreamText(t));

    ctx.setStreamLabel("");
    ctx.dispatch({ type: "SET_VERIFICATION_RESULT", result: verifyContent });

    await generatePrd(ctx, snap.topic, snap.messages, {
      ...ctx.stateRef.current,
      verificationResult: verifyContent,
    });
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 9. 피드백 후 PRD 재생성 =====
export async function submitFeedbackAndRefine(ctx: WorkflowContext, feedbackText: string) {
  const snap = ctx.stateRef.current;
  const prevPrd = snap.prd;

  const fb: FeedbackEntry = {
    id: genId(),
    type: "feedback",
    content: feedbackText,
    timestamp: Date.now(),
    afterRevision: snap.revisionCount,
  };
  const allFeedbacks = [...snap.feedbacks, fb];

  ctx.dispatch({ type: "SET_FEEDBACKS", feedbacks: allFeedbacks });

  // 워크플로 분기: 하네스 vs 일반 토론
  if (snap.activeWorkflow === "plan_harness") {
    await refineHarnessPrd(ctx, snap, prevPrd, feedbackText, allFeedbacks);
  } else {
    await refineStandardPrd(ctx, snap, prevPrd, feedbackText, allFeedbacks);
  }
}

// 일반 토론 기반 리파인 (기존 로직 그대로)
async function refineStandardPrd(
  ctx: WorkflowContext,
  snap: DebateState, prevPrd: string, feedbackText: string, allFeedbacks: FeedbackEntry[],
) {
  const allMessages = [...snap.messages];
  ctx.dispatch({ type: "SET_STATUS", status: "debating" });
  const refineSnap = { ...snap, feedbacks: allFeedbacks };

  try {
    await runStage(ctx, "critique", snap.topic, allMessages, refineSnap, feedbackText);
    await runStage(ctx, "final", snap.topic, allMessages, refineSnap);
    await generatePrd(
      ctx, snap.topic, allMessages,
      { ...refineSnap, messages: allMessages },
      "refine", prevPrd, feedbackText,
    );
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// 하네스 기반 리파인 (토론 재실행 없이 PRD만 재생성)
async function refineHarnessPrd(
  ctx: WorkflowContext,
  snap: DebateState, prevPrd: string, feedbackText: string, allFeedbacks: FeedbackEntry[],
) {
  ctx.dispatch({ type: "SET_STATUS", status: "generating_prd" });
  ctx.setStreamLabel("하네스 PRD 피드백 반영 중 (Claude Opus 4.6)...");
  ctx.setStreamText("");

  try {
    const prd = await ctx.fetchStream("/api/synthesize", {
      topic: snap.topic,
      messages: [],
      confirmedRoles: [],
      mode: "refine",
      command: snap.command,
      source: "harness",
      harnessArtifacts: getHarnessArtifactsForApi(snap),
      previousPrd: prevPrd,
      feedback: feedbackText,
      feedbacks: allFeedbacks,
    }, (t: string) => ctx.dispatch({ type: "STREAM_PRD", prd: t }));

    ctx.setStreamLabel("");
    const currentRevisions = ctx.stateRef.current.prdRevisions;
    const currentRevisionCount = ctx.stateRef.current.revisionCount;
    ctx.dispatch({
      type: "COMPLETE_PRD",
      prd,
      prdRevisions: [...currentRevisions, prd],
      revisionCount: currentRevisionCount + 1,
      status: "complete",
    });
    await ctx.save({ ...ctx.stateRef.current, prd, status: "complete" }, "complete");
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.setStreamLabel("");
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 하네스 산출물을 API 전달용으로 변환 =====
export function getHarnessArtifactsForApi(snap: DebateState): HarnessInputArtifacts | undefined {
  if (!snap.harness) return undefined;
  return {
    requirementSpec: snap.harness.requirementSpec,
    cps: snap.harness.cps,
    generatedPlan: snap.harness.generatedPlan,
    evaluation: snap.harness.evaluation,
  };
}

// ===== 10. 하네스 기반 PRD 생성 =====
export async function generateHarnessPrd(ctx: WorkflowContext) {
  const snap = ctx.stateRef.current;
  if (!snap.harness?.generatedPlan) return;

  ctx.dispatch({ type: "SET_STATUS", status: "generating_prd" });
  ctx.setStreamLabel("하네스 계획 기반 PRD 생성 중 (Claude Opus 4.6)...");
  ctx.setStreamText("");

  try {
    const prd = await ctx.fetchStream("/api/synthesize", {
      topic: snap.topic,
      messages: [],
      confirmedRoles: [],
      mode: "initial",
      command: snap.command,
      source: "harness",
      harnessArtifacts: getHarnessArtifactsForApi(snap),
    }, (t: string) => ctx.dispatch({ type: "STREAM_PRD", prd: t }));

    ctx.setStreamLabel("");
    const currentRevisions = ctx.stateRef.current.prdRevisions;
    const currentRevisionCount = ctx.stateRef.current.revisionCount;
    ctx.dispatch({
      type: "COMPLETE_PRD",
      prd,
      prdRevisions: [...currentRevisions, prd],
      revisionCount: currentRevisionCount + 1,
      status: "complete",
    });
    await ctx.save({ ...ctx.stateRef.current, prd, status: "complete" }, "complete");
  } catch (e: any) {
    ctx.setStreamLabel("");
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 11. Claude Code 명령 생성 =====
export async function generateCommand(ctx: WorkflowContext) {
  const snap = ctx.stateRef.current;
  const isHarness = snap.activeWorkflow === "plan_harness" && !snap.prd && !!snap.harness?.generatedPlan;

  if (!snap.prd && !isHarness) return;

  ctx.dispatch({ type: "SET_STATUS", status: "generating_command" });
  ctx.setStreamLabel("Claude Code 명령문 생성 중...");

  try {
    const cmd = await ctx.fetchStream("/api/generate-command", {
      topic: snap.topic,
      command: snap.command,
      prd: snap.prd || "",
      modeInput: snap.modeInput,
      ...(isHarness ? { source: "harness" as const, harnessArtifacts: getHarnessArtifactsForApi(snap) } : {}),
    }, (t: string) => ctx.dispatch({ type: "STREAM_COMMAND", generatedCommand: t }));

    ctx.setStreamLabel("");
    ctx.dispatch({ type: "COMPLETE_COMMAND", generatedCommand: cmd, status: "complete" });
    await ctx.save({ ...ctx.stateRef.current, generatedCommand: cmd }, "complete");
  } catch (e: any) {
    ctx.setStreamLabel("");
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 12. UI 프로토타입 생성 =====
export async function generatePrototype(ctx: WorkflowContext) {
  const snap = ctx.stateRef.current;
  const isHarness = snap.activeWorkflow === "plan_harness" && !snap.prd && !!snap.harness?.generatedPlan;

  if (!snap.prd && !isHarness) return;

  ctx.dispatch({ type: "SET_STATUS", status: "generating_ui" });
  ctx.setStreamLabel("UI 프로토타입 생성 중 (Gemini 3.1 Pro)...");

  try {
    const html = await ctx.fetchStream("/api/generate-ui", {
      prd: snap.prd || "",
      ...(isHarness ? { source: "harness" as const, harnessArtifacts: getHarnessArtifactsForApi(snap) } : {}),
    }, (t: string) => ctx.dispatch({ type: "STREAM_PROTOTYPE", prototypeHtml: t }));

    ctx.setStreamLabel("");
    const cleaned = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim();
    ctx.dispatch({ type: "COMPLETE_PROTOTYPE", prototypeHtml: cleaned, status: "complete" });
    await ctx.save({ ...ctx.stateRef.current, prototypeHtml: cleaned }, "complete");
    if (ctx.stateRef.current.sessionId) {
      fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId: ctx.stateRef.current.sessionId, htmlCode: cleaned, modificationRequest: "" }),
      }).catch(() => {});
    }
  } catch (e: any) {
    ctx.setStreamLabel("");
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 12. UI 수정 요청 =====
export async function refinePrototype(ctx: WorkflowContext, modificationRequest: string) {
  const snap = ctx.stateRef.current;
  if (!snap.prototypeHtml) return;

  ctx.dispatch({ type: "SET_STATUS", status: "generating_ui" });
  ctx.setStreamLabel("UI 수정 중 (Gemini 3.1 Pro)...");

  try {
    const html = await ctx.fetchStream("/api/generate-ui", {
      prd: snap.prd,
      existingHtml: snap.prototypeHtml,
      modificationRequest,
    }, (t: string) => ctx.dispatch({ type: "STREAM_PROTOTYPE", prototypeHtml: t }));

    ctx.setStreamLabel("");
    const cleaned = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim();
    ctx.dispatch({ type: "COMPLETE_PROTOTYPE", prototypeHtml: cleaned, status: "complete" });
    await ctx.save({ ...ctx.stateRef.current, prototypeHtml: cleaned }, "complete");
    // Save UI version to DB
    if (ctx.stateRef.current.sessionId) {
      fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId: ctx.stateRef.current.sessionId, htmlCode: cleaned, modificationRequest }),
      }).catch(() => {});
    }
  } catch (e: any) {
    ctx.setStreamLabel("");
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}
