import { WorkflowContext } from "./workflow-context";
import {
  DebateState, DebateMessage, DebateStatus,
  ClarificationQA, ClarificationPhase,
} from "./types";
import { TopicSubmitData } from "@/components/TopicInput";
import {
  IDEATE_DEBATE_ROLES, IDEATE_UX_ROLES,
  CLARIFY_PHASE_ROLES, CLARIFY_PHASE_ORDER,
  ROLE_POOL,
} from "./constants";
import { parseQuestions } from "./parse-questions";
import { initialState } from "./debate-reducer";
import { runDebateFlow, generatePrd } from "./workflow-standard";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ===== /ideate: 아이디어 구체화 시작 =====
export async function startIdeate(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();

  const snap: DebateState = {
    ...initialState,
    topic: data.topic,
    command: "ideate",
    debateEngine: data.debateEngine,
    verifyEngine: data.verifyEngine,
    techSpec: data.techSpec,
    modeInput: null,
    confirmedRoles: IDEATE_DEBATE_ROLES,
    clarifications: [],
    clarificationRound: 1,
    clarificationPhase: "vision",
    status: "clarifying",
    sessionId,
    createdAt,
  };
  ctx.dispatch({ type: "INIT_SESSION", state: snap });

  try {
    await runClarificationPhase(ctx, snap, "vision", []);
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== Phase 기반 전문가 질문 생성 =====
export async function runClarificationPhase(
  ctx: WorkflowContext,
  snap: DebateState,
  phase: ClarificationPhase,
  previousQA: ClarificationQA[],
) {
  const phaseRoles = CLARIFY_PHASE_ROLES[phase];
  ctx.dispatch({ type: "SET_CLARIFICATIONS", clarifications: snap.clarifications, status: "clarifying", clarificationPhase: phase });

  const newQAs: ClarificationQA[] = [];

  for (const roleId of phaseRoles) {
    ctx.setStreamRoleId(roleId);
    ctx.setStreamText("");

    const questions = await ctx.fetchStream("/api/clarify", {
      roleId,
      topic: snap.topic,
      previousQA,
      round: CLARIFY_PHASE_ORDER.indexOf(phase) + 1,
      debateEngine: snap.debateEngine,
      phase,
    }, (t) => ctx.setStreamText(t));

    ctx.setStreamText("");
    ctx.setStreamRoleId(null);

    const qa: ClarificationQA = {
      id: genId(),
      roleId,
      questions,
      parsedQuestions: parseQuestions(questions),
      answers: "",
      round: CLARIFY_PHASE_ORDER.indexOf(phase) + 1,
      phase,
      timestamp: Date.now(),
    };
    newQAs.push(qa);

    ctx.dispatch({ type: "SET_CLARIFICATIONS", clarifications: [...previousQA, ...newQAs] });
  }

  ctx.dispatch({ type: "SET_CLARIFICATIONS", clarifications: [...previousQA, ...newQAs], status: "awaiting_clarification" });
}

// ===== 답변 제출 후 다음 Phase 진행 =====
export async function submitClarificationAndAskMore(ctx: WorkflowContext, answers: Record<string, string>) {
  const snap = ctx.stateRef.current;

  // 현재 phase의 QA에 답변 업데이트
  const updatedQAs = snap.clarifications.map((qa) => {
    if (qa.phase === snap.clarificationPhase && answers[qa.roleId]) {
      return { ...qa, answers: answers[qa.roleId] };
    }
    return qa;
  });

  ctx.dispatch({ type: "SET_CLARIFICATIONS", clarifications: updatedQAs });

  // Find next phase
  const currentIdx = CLARIFY_PHASE_ORDER.indexOf(snap.clarificationPhase);
  const nextPhase = CLARIFY_PHASE_ORDER[currentIdx + 1];

  if (!nextPhase) {
    // No more phases — gracefully start debate
    await submitClarificationAndDebate(ctx, answers);
    return;
  }

  try {
    await runClarificationPhase(
      ctx,
      { ...snap, clarifications: updatedQAs, clarificationPhase: nextPhase },
      nextPhase,
      updatedQAs,
    );
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// ===== 답변 제출 후 토론 진행 =====
export async function submitClarificationAndDebate(ctx: WorkflowContext, answers: Record<string, string>) {
  const snap = ctx.stateRef.current;

  // 현재 phase의 QA에 답변 업데이트
  const updatedQAs = snap.clarifications.map((qa) => {
    if (qa.phase === snap.clarificationPhase && answers[qa.roleId]) {
      return { ...qa, answers: answers[qa.roleId] };
    }
    return qa;
  });

  ctx.dispatch({ type: "SET_CLARIFICATIONS", clarifications: updatedQAs, status: "debating" });

  const updatedSnap = { ...snap, clarifications: updatedQAs };

  // QA 내용을 토론 컨텍스트로 변환
  const clarifiedContext = buildClarifiedContext(updatedQAs);
  const enrichedTopic = `${snap.topic}\n\n## 전문가 질문을 통해 구체화된 내용\n${clarifiedContext}`;

  const debateSnap = { ...updatedSnap, topic: enrichedTopic };
  const allMessages: DebateMessage[] = [];

  try {
    // 2단계: 개발계획 토론 (기존 3단계 토론 재활용)
    await runDebateFlow(ctx, debateSnap, allMessages);

    // 3단계: 사용자 관점 토론
    ctx.dispatch({ type: "SET_STATUS", status: "debating_user_perspective" as DebateStatus });
    ctx.setStreamLabel("사용자 관점 토론 중...");

    for (const roleId of IDEATE_UX_ROLES.filter((r) => r !== "moderator")) {
      ctx.setStreamRoleId(roleId);
      ctx.setStreamText("");

      const content = await ctx.fetchStream("/api/debate", {
        roleId,
        topic: enrichedTopic,
        stage: "user_perspective",
        confirmedRoles: IDEATE_UX_ROLES,
        history: allMessages,
        debateEngine: snap.debateEngine,
        command: "ideate",
      }, (t) => ctx.setStreamText(t));

      ctx.setStreamText("");
      ctx.setStreamRoleId(null);

      const msg: DebateMessage = {
        id: `user_perspective-${roleId}-${Date.now()}`,
        roleId,
        stage: "user_perspective",
        content,
        timestamp: Date.now(),
      };
      allMessages.push(msg);
      ctx.dispatch({ type: "SET_MESSAGES", messages: [...allMessages] });
    }

    // 중재자 최종 정리
    ctx.setStreamRoleId("moderator");
    ctx.setStreamText("");
    const modContent = await ctx.fetchStream("/api/debate", {
      roleId: "moderator",
      topic: enrichedTopic,
      stage: "user_perspective",
      confirmedRoles: IDEATE_UX_ROLES,
      history: allMessages,
      debateEngine: snap.debateEngine,
      command: "ideate",
    }, (t) => ctx.setStreamText(t));

    ctx.setStreamText("");
    ctx.setStreamRoleId(null);

    allMessages.push({
      id: `user_perspective-moderator-${Date.now()}`,
      roleId: "moderator",
      stage: "user_perspective",
      content: modContent,
      timestamp: Date.now(),
    });
    ctx.dispatch({ type: "SET_MESSAGES", messages: [...allMessages] });

    ctx.setStreamLabel("");
    await ctx.save({ ...ctx.stateRef.current, messages: [...allMessages], clarifications: updatedQAs }, "debated");

    // PRD 생성
    await generatePrd(ctx, enrichedTopic, allMessages, {
      ...ctx.stateRef.current,
      messages: allMessages,
      topic: enrichedTopic,
    });
  } catch (e: any) {
    if (e.name === "AbortError") return;
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  }
}

// QA를 텍스트 컨텍스트로 변환 (phase별 구조화) — pure function
export function buildClarifiedContext(qas: ClarificationQA[]): string {
  if (qas.length === 0) return "";

  const phaseLabels: Record<string, string> = {
    vision: "\u{1F3AF} 비전 및 목적",
    features: "\u2699\uFE0F 핵심 기능",
    technical: "\u{1F527} 기술 제약",
    resolution: "\u{1F4CB} 최종 정리",
  };

  // Group by phase
  const byPhase = new Map<string, ClarificationQA[]>();
  for (const qa of qas) {
    const phase = qa.phase || "general";
    if (!byPhase.has(phase)) byPhase.set(phase, []);
    byPhase.get(phase)!.push(qa);
  }

  let context = "";

  // Output in phase order
  const phaseOrder = ["vision", "features", "technical", "resolution", "general"];
  for (const phase of phaseOrder) {
    const phaseQAs = byPhase.get(phase);
    if (!phaseQAs) continue;

    const label = phaseLabels[phase] || "기타";
    context += `\n### ${label}\n`;

    for (const qa of phaseQAs) {
      if (qa.answers) {
        // Only include answered questions — skip unanswered ones
        context += `\n**질문 (${ROLE_POOL[qa.roleId]?.koreanName || qa.roleId}):**\n${qa.questions}\n`;
        context += `**답변:**\n${qa.answers}\n`;
      }
    }
  }

  return context;
}
