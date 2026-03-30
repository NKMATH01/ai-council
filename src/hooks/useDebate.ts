"use client";

import { useState, useCallback, useRef, useReducer, useMemo } from "react";
import {
  DebateState, DebateStatus, DebateMessage, DebateRoleId,
  VerificationProvider, Session,
} from "@/lib/types";
import { CLARIFY_PHASE_ROLES, IDEATE_UX_ROLES } from "@/lib/constants";
import { TopicSubmitData } from "@/components/TopicInput";
import { buildSessionFromState } from "@/lib/session-mappers";
import { debateReducer, initialState } from "@/lib/debate-reducer";
import type { WorkflowContext } from "@/lib/workflow-context";

// Workflow functions
import {
  runStage as _runStage,
  runDebateFlow as _runDebateFlow,
  generatePrd as _generatePrd,
  requestRecommendation as _requestRecommendation,
  confirmAndStart as _confirmAndStart,
  startQuick as _startQuick,
  startDeep as _startDeep,
  startConsult as _startConsult,
  startExtend as _startExtend,
  startFix as _startFix,
  handleVerificationChoice as _handleVerificationChoice,
  submitFeedbackAndRefine as _submitFeedbackAndRefine,
  generateHarnessPrd as _generateHarnessPrd,
  generateCommand as _generateCommand,
  generatePrototype as _generatePrototype,
  refinePrototype as _refinePrototype,
} from "@/lib/workflow-standard";

import {
  startIdeate as _startIdeate,
  submitClarificationAndAskMore as _submitClarificationAndAskMore,
  submitClarificationAndDebate as _submitClarificationAndDebate,
  runClarificationPhase as _runClarificationPhase,
  buildClarifiedContext,
} from "@/lib/workflow-ideate";

import {
  startPlanHarness as _startPlanHarness,
  rerunPlanHarness as _rerunPlanHarness,
} from "@/lib/workflow-harness";

export function useDebate() {
  const [state, dispatch] = useReducer(debateReducer, initialState);
  const [streamText, setStreamText] = useState("");
  const [streamRoleId, setStreamRoleId] = useState<DebateRoleId | null>(null);
  const [streamLabel, setStreamLabel] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<DebateState>(initialState);
  stateRef.current = state;

  // ===== 스트림 fetch 헬퍼 (네트워크 에러 시 1회 자동 재시도) =====
  const fetchStream = async (
    url: string, body: any, onChunk: (t: string) => void,
  ): Promise<string> => {
    const attempt = async (retry: boolean): Promise<string> => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let full = "";
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "API 요청 실패" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("스트림 읽기 실패");
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += dec.decode(value, { stream: true });
          onChunk(full);
        }
        return full;
      } catch (e: any) {
        if (e.name === "AbortError") throw e;
        // 네트워크 에러 + 재시도 가능 → 1회 자동 재시도
        if (retry && isNetworkError(e)) {
          await new Promise((r) => setTimeout(r, 2000));
          onChunk(""); // 스트림 리셋
          return attempt(false);
        }
        throw e;
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
        }
      }
    };
    return attempt(true);
  };

  const isNetworkError = (e: any): boolean => {
    const msg = (e?.message || "").toLowerCase();
    return msg.includes("fetch") || msg.includes("network") ||
      msg.includes("failed to fetch") || msg.includes("aborted") === false &&
      (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("socket"));
  };

  // ===== 세션 저장 =====
  const save = async (snap: DebateState, st?: string) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSessionFromState(snap, st)),
      });
      dispatch({ type: "SET_SAVE_ERROR", saveError: undefined });
    } catch {
      dispatch({ type: "SET_SAVE_ERROR", saveError: "세션 저장 실패" });
    }
  };

  // ===== 워크플로 컨텍스트 =====
  const ctx: WorkflowContext = useMemo(() => ({
    dispatch, stateRef, abortRef, setStreamText, setStreamRoleId, setStreamLabel, fetchStream, save,
  }), [dispatch]);

  // ===== 워크플로 함수 래핑 =====
  const requestRecommendation = useCallback(
    (data: TopicSubmitData) => _requestRecommendation(ctx, data), [ctx]);

  const confirmAndStart = useCallback(
    (roles: DebateRoleId[]) => _confirmAndStart(ctx, roles), [ctx]);

  const startQuick = useCallback(
    (data: TopicSubmitData) => _startQuick(ctx, data), [ctx]);

  const startDeep = useCallback(
    (data: TopicSubmitData) => _startDeep(ctx, data), [ctx]);

  const startConsult = useCallback(
    (data: TopicSubmitData) => _startConsult(ctx, data), [ctx]);

  const startExtend = useCallback(
    (data: TopicSubmitData) => _startExtend(ctx, data), [ctx]);

  const startFix = useCallback(
    (data: TopicSubmitData) => _startFix(ctx, data), [ctx]);

  const startIdeate = useCallback(
    (data: TopicSubmitData) => _startIdeate(ctx, data), [ctx]);

  const submitClarificationAndAskMore = useCallback(
    (answers: Record<string, string>) => _submitClarificationAndAskMore(ctx, answers), [ctx]);

  const submitClarificationAndDebate = useCallback(
    (answers: Record<string, string>) => _submitClarificationAndDebate(ctx, answers), [ctx]);

  const startPlanHarness = useCallback(
    (data: TopicSubmitData) => _startPlanHarness(ctx, data), [ctx]);

  const rerunPlanHarness = useCallback(
    (revisionRequest?: string) => _rerunPlanHarness(ctx, revisionRequest), [ctx]);

  const generateHarnessPrd = useCallback(
    () => _generateHarnessPrd(ctx), [ctx]);

  const handleVerificationChoice = useCallback(
    (choice: VerificationProvider | null | "redebate", redebateTopic?: string) =>
      _handleVerificationChoice(ctx, choice, redebateTopic), [ctx]);

  const submitFeedbackAndRefine = useCallback(
    (feedbackText: string) => _submitFeedbackAndRefine(ctx, feedbackText), [ctx]);

  const generateCommand = useCallback(
    () => _generateCommand(ctx), [ctx]);

  const generatePrototype = useCallback(
    () => _generatePrototype(ctx), [ctx]);

  const refinePrototype = useCallback(
    (modificationRequest: string) => _refinePrototype(ctx, modificationRequest), [ctx]);

  // ===== 세션 로드 =====
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("세션을 불러올 수 없습니다.");
      const s: Session = await res.json();

      dispatch({
        type: "LOAD_SESSION",
        state: {
          topic: s.topic,
          command: s.command || "debate",
          debateEngine: s.debateEngine || "claude-sonnet",
          verifyEngine: s.verifyEngine || "chatgpt",
          techSpec: s.techSpec || "",
          modeInput: s.modeInput || null,
          recommendation: s.recommendation,
          confirmedRoles: s.confirmedRoles || [],
          currentStage: "final",
          currentRoleIndex: 0,
          messages: s.messages,
          verificationProvider: s.verificationProvider,
          verificationResult: s.verificationResult || "",
          prd: s.prd || "",
          prdRevisions: s.prdRevisions || [],
          revisionCount: s.revisionCount || 0,
          feedbacks: s.feedbacks || [],
          clarifications: s.clarifications || [],
          clarificationRound: s.clarificationRound || 0,
          clarificationPhase: "vision",
          harness: s.harness || undefined,
          activeWorkflow: s.activeWorkflow || undefined,
          harnessRunCount: s.harness?.runCount || undefined,
          harnessRevisionRequest: s.harness?.revisionRequest || undefined,
          harnessUserSummary: s.harness?.userSummary || undefined,
          generatedCommand: s.generatedCommand || "",
          prototypeHtml: s.prototypeHtml || "",
          // generating_plan 상태로 저장된 하네스 세션은 스트림이 이미 끊긴 stale 세션이므로
          // error로 전환하여 "멈춤"을 방지한다.
          status: (s.activeWorkflow === "plan_harness" && s.status === "generating_plan"
            ? "error"
            : (s.status || "complete")) as DebateStatus,
          error: s.activeWorkflow === "plan_harness" && s.status === "generating_plan"
            ? "이전 실행이 완료되지 않은 세션입니다 (중단 또는 연결 끊김)"
            : undefined,
          sessionId: s.id,
          createdAt: s.createdAt,
        },
      });
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", error: e.message });
    }
  }, []);

  // ===== 중단 =====
  const stopDebate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const cur = stateRef.current;
    if (!(cur.activeWorkflow === "plan_harness" && cur.status === "generating_plan")) {
      dispatch({ type: "SET_STATUS", status: "idle" });
    }
    setStreamText("");
    setStreamRoleId(null);
    setStreamLabel("");
  }, []);

  // ===== 에러에서 이어서 계속 =====
  const retryFromError = useCallback(async () => {
    const snap = stateRef.current;
    if (snap.status !== "error") return;

    dispatch({ type: "CLEAR_ERROR" });

    const cmd = snap.command;

    // ideate 모드: 마지막 성공 지점 감지 후 재개
    if (cmd === "ideate") {
      const hasAnsweredClarifications = snap.clarifications.some((q) => q.answers);
      const hasMessages = snap.messages.length > 0;
      const hasPrd = !!snap.prd;

      const currentPhase = snap.clarificationPhase || "vision";
      const phaseRoles = CLARIFY_PHASE_ROLES[currentPhase];
      const currentPhaseQAs = snap.clarifications.filter((q) => q.phase === currentPhase);
      const isPhaseIncomplete = currentPhaseQAs.length < phaseRoles.length;

      if (!hasAnsweredClarifications && isPhaseIncomplete) {
        const previousPhaseQAs = snap.clarifications.filter((q) => q.phase !== currentPhase);
        try {
          dispatch({ type: "SET_STATUS", status: "clarifying" });
          await _runClarificationPhase(ctx, snap, currentPhase, previousPhaseQAs);
        } catch (e: any) {
          if (e.name === "AbortError") return;
          dispatch({ type: "SET_ERROR", error: e.message });
        }
        return;
      }

      if (hasAnsweredClarifications && !hasMessages) {
        const clarifiedContext = buildClarifiedContext(snap.clarifications);
        const enrichedTopic = `${snap.topic}\n\n## 전문가 질문을 통해 구체화된 내용\n${clarifiedContext}`;
        const debateSnap = { ...snap, topic: enrichedTopic };
        const allMessages: DebateMessage[] = [];

        try {
          dispatch({ type: "SET_STATUS", status: "debating" });
          await _runDebateFlow(ctx, debateSnap, allMessages);

          dispatch({ type: "SET_STATUS", status: "debating_user_perspective" as DebateStatus });
          setStreamLabel("사용자 관점 토론 중...");

          for (const roleId of IDEATE_UX_ROLES.filter((r) => r !== "moderator")) {
            setStreamRoleId(roleId);
            setStreamText("");
            const content = await fetchStream("/api/debate", {
              roleId, topic: enrichedTopic, stage: "user_perspective",
              confirmedRoles: IDEATE_UX_ROLES, history: allMessages,
              debateEngine: snap.debateEngine, command: "ideate",
            }, (t) => setStreamText(t));
            setStreamText(""); setStreamRoleId(null);
            allMessages.push({ id: `user_perspective-${roleId}-${Date.now()}`, roleId, stage: "user_perspective", content, timestamp: Date.now() });
            dispatch({ type: "SET_MESSAGES", messages: [...allMessages] });
          }

          setStreamRoleId("moderator"); setStreamText("");
          const modContent = await fetchStream("/api/debate", {
            roleId: "moderator", topic: enrichedTopic, stage: "user_perspective",
            confirmedRoles: IDEATE_UX_ROLES, history: allMessages,
            debateEngine: snap.debateEngine, command: "ideate",
          }, (t) => setStreamText(t));
          setStreamText(""); setStreamRoleId(null);
          allMessages.push({ id: `user_perspective-moderator-${Date.now()}`, roleId: "moderator", stage: "user_perspective", content: modContent, timestamp: Date.now() });
          dispatch({ type: "SET_MESSAGES", messages: [...allMessages] });
          setStreamLabel("");

          await _generatePrd(ctx, enrichedTopic, allMessages, { ...stateRef.current, messages: allMessages, topic: enrichedTopic });
        } catch (e: any) {
          if (e.name === "AbortError") return;
          dispatch({ type: "SET_ERROR", error: e.message });
        }
        return;
      }

      if (hasMessages && !hasPrd) {
        const clarifiedContext = buildClarifiedContext(snap.clarifications);
        const enrichedTopic = `${snap.topic}\n\n## 전문가 질문을 통해 구체화된 내용\n${clarifiedContext}`;
        try {
          await _generatePrd(ctx, enrichedTopic, snap.messages, { ...snap, topic: enrichedTopic });
        } catch (e: any) {
          if (e.name === "AbortError") return;
          dispatch({ type: "SET_ERROR", error: e.message });
        }
        return;
      }

      if (snap.clarifications.length > 0 && !hasAnsweredClarifications) {
        dispatch({ type: "SET_STATUS", status: "awaiting_clarification" });
        return;
      }
    }

    // quick, deep, debate 등 일반 모드: 토론 재시작
    if (["quick", "deep", "debate", "consult", "extend", "fix"].includes(cmd || "")) {
      const allMessages: DebateMessage[] = [];
      try {
        dispatch({ type: "UPDATE_HARNESS", updates: { status: "debating", messages: [] } });
        await _runDebateFlow(ctx, snap, allMessages);
        if (["quick", "deep"].includes(cmd || "")) {
          await _generatePrd(ctx, snap.topic, allMessages, { ...snap, messages: allMessages });
        } else {
          dispatch({ type: "SET_STATUS", status: "awaiting_verification" });
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
        dispatch({ type: "SET_ERROR", error: e.message });
      }
    }
  }, [ctx]);

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "RESET" });
    setStreamText("");
    setStreamRoleId(null);
    setStreamLabel("");
  }, []);

  return {
    state,
    streamText,
    streamRoleId,
    streamLabel,
    requestRecommendation,
    confirmAndStart,
    startQuick,
    startDeep,
    startConsult,
    startExtend,
    startFix,
    startIdeate,
    submitClarificationAndAskMore,
    submitClarificationAndDebate,
    startPlanHarness,
    rerunPlanHarness,
    generateHarnessPrd,
    handleVerificationChoice,
    submitFeedbackAndRefine,
    generateCommand,
    generatePrototype,
    refinePrototype,
    loadSession,
    stopDebate,
    resetDebate,
    retryFromError,
  };
}
