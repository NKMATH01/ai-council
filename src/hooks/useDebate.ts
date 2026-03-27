"use client";

import { useState, useCallback, useRef } from "react";
import {
  DebateState, DebateStatus, DebateCommand, DebateStageId,
  DebateMessage, DebateRoleId, FeedbackEntry, Recommendation,
  VerificationProvider, DebateEngineId, VerifyEngineId, ModeInput,
  Session, ClarificationQA, PlanHarnessStreamEvent,
} from "@/lib/types";
import { QUICK_ROLES, DEEP_ROLES, CONSULT_ROLES, FIX_ROLES, IDEATE_CLARIFY_ROLES, IDEATE_DEBATE_ROLES, IDEATE_UX_ROLES, getDebateOrder } from "@/lib/constants";
import { TopicSubmitData } from "@/components/TopicInput";
import { buildSessionFromState } from "@/lib/session-mappers";
import type { HarnessInputArtifacts } from "@/lib/types";
import { buildPreviousHarnessSummary } from "@/lib/harness-summary";
import { createSnapshot, pushSnapshot } from "@/lib/harness-diff";
import { mergeAttempts } from "@/lib/harness-attempts";

const initialState: DebateState = {
  topic: "",
  command: "debate",
  debateEngine: "claude-sonnet",
  verifyEngine: "chatgpt",
  techSpec: "",
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
  generatedCommand: "",
  prototypeHtml: "",
  status: "idle",
  createdAt: "",
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function useDebate() {
  const [state, setState] = useState<DebateState>(initialState);
  const [streamText, setStreamText] = useState("");
  const [streamRoleId, setStreamRoleId] = useState<DebateRoleId | null>(null);
  const [streamLabel, setStreamLabel] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<DebateState>(initialState);
  stateRef.current = state;

  // ===== 스트림 fetch 헬퍼 =====
  const fetchStream = async (
    url: string, body: any, onChunk: (t: string) => void,
  ): Promise<string> => {
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
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
      }
    }
  };

  // ===== 세션 저장 =====
  const save = async (snap: DebateState, st?: string) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSessionFromState(snap, st)),
      });
      setState((p) => ({ ...p, saveError: undefined }));
    } catch {
      setState((p) => ({ ...p, saveError: "세션 저장 실패" }));
    }
  };

  // ===== 하네스 abort 공통 처리 =====
  // abort 스냅샷을 stateRef.current 기반으로 동기적으로 구성한 뒤,
  // 같은 객체를 setState와 save에 공유하여 batching 불일치를 방지한다.
  async function handleHarnessAbort() {
    const aborted = buildAbortSnapshot(stateRef.current);
    setState(aborted);
    setStreamLabel("");
    // 부분 결과 저장 — aborted 스냅샷을 직접 전달하므로 stateRef 의존 없음
    try {
      if (aborted.sessionId) {
        await save(aborted, "error");
      }
    } catch {
      setState((p) => ({ ...p, saveError: "세션 저장 실패" }));
    }
  }

  /** abort 시 저장할 스냅샷을 동기적으로 구성.
   *  현재 state에서 partial harness/metadata를 유지하고,
   *  status와 error만 명시적으로 덮어쓴다. */
  function buildAbortSnapshot(current: DebateState): DebateState {
    return {
      ...current,
      currentHarnessStage: undefined,
      status: "error",
      error: "사용자에 의해 중단됨",
    };
  }

  // ===== 역할 하나 실행 =====
  const runRole = async (
    roleId: DebateRoleId,
    stage: DebateStageId,
    topic: string,
    historyMsgs: DebateMessage[],
    snap: DebateState,
    feedback?: string,
  ): Promise<DebateMessage> => {
    setStreamRoleId(roleId);
    setStreamText("");

    const content = await fetchStream("/api/debate", {
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
    }, (t) => setStreamText(t));

    setStreamText("");
    setStreamRoleId(null);

    return {
      id: `${stage}-${roleId}-${Date.now()}`,
      roleId,
      stage,
      content,
      timestamp: Date.now(),
    };
  };

  // ===== 스테이지 실행 =====
  const runStage = async (
    stage: DebateStageId,
    topic: string,
    allMessages: DebateMessage[],
    snap: DebateState,
    feedback?: string,
  ) => {
    setState((p) => ({ ...p, currentStage: stage, status: "debating" }));

    let roles: DebateRoleId[];
    if (stage === "final") {
      roles = snap.confirmedRoles.includes("moderator") ? ["moderator"] : [];
    } else {
      roles = getDebateOrder(snap.confirmedRoles, snap.command).filter((r) => r !== "moderator");
    }

    for (let i = 0; i < roles.length; i++) {
      setState((p) => ({ ...p, currentRoleIndex: i }));
      const historyForRole = stage === "independent" ? [] : allMessages;
      const msg = await runRole(roles[i], stage, topic, historyForRole, snap, feedback);
      allMessages.push(msg);
      setState((p) => ({ ...p, messages: [...allMessages] }));
    }
  };

  // ===== PRD/문서 생성 =====
  const generatePrd = async (
    topic: string,
    allMessages: DebateMessage[],
    snap: DebateState,
    mode: "initial" | "refine" = "initial",
    previousPrd?: string,
    feedbackText?: string,
  ) => {
    const docName = snap.command === "consult" ? "의견 종합 보고서"
      : snap.command === "extend" ? "기능 확장 계획서"
      : snap.command === "fix" ? "구조 수정 계획서"
      : "PRD";

    setState((p) => ({ ...p, status: "generating_prd" }));
    setStreamRoleId(null);
    setStreamLabel(`${docName} 생성 중 (Claude Opus 4.6)`);
    setStreamText("");

    const prd = await fetchStream("/api/synthesize", {
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
    }, (t) => setState((p) => ({ ...p, prd: t })));

    setStreamLabel("");

    setState((p) => ({
      ...p,
      prd,
      prdRevisions: [...p.prdRevisions, prd],
      revisionCount: p.revisionCount + 1,
      status: "complete",
    }));
    await save({ ...stateRef.current, prd, status: "complete" }, "complete");
  };

  // ===== 공통 토론 실행 (모든 모드 공유) =====
  const runDebateFlow = async (snap: DebateState, allMessages: DebateMessage[]) => {
    await runStage("independent", snap.topic, allMessages, snap);
    await runStage("critique", snap.topic, allMessages, snap);
    await runStage("final", snap.topic, allMessages, snap);
    await save({ ...stateRef.current, messages: [...allMessages] }, "debated");
  };

  // ===== 1. 추천 받기 (/debate) =====
  const requestRecommendation = useCallback(async (data: TopicSubmitData) => {
    const sessionId = genId();
    const createdAt = new Date().toISOString();

    setState({
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
    });

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: data.topic }),
      });
      if (!res.ok) throw new Error("추천 분석 실패");
      const recommendation: Recommendation = await res.json();

      setState((p) => ({
        ...p,
        recommendation,
        confirmedRoles: recommendation.suggestedRoles,
        status: "awaiting_confirmation",
      }));
    } catch (e: any) {
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 2. 역할 확인 후 토론 시작 =====
  const confirmAndStart = useCallback(async (roles: DebateRoleId[]) => {
    const snap = stateRef.current;
    const allMessages: DebateMessage[] = [];

    setState((p) => ({ ...p, confirmedRoles: roles, status: "debating" }));

    const updatedSnap = { ...snap, confirmedRoles: roles };

    try {
      await runDebateFlow(updatedSnap, allMessages);
      setState((p) => ({ ...p, status: "awaiting_verification" }));
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 3. 빠른 토론 (/quick) =====
  const startQuick = useCallback(async (data: TopicSubmitData) => {
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
    setState(snap);

    const allMessages: DebateMessage[] = [];
    try {
      await runDebateFlow(snap, allMessages);
      await generatePrd(data.topic, allMessages, { ...snap, messages: allMessages });
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 4. 깊은 토론 (/deep) =====
  const startDeep = useCallback(async (data: TopicSubmitData) => {
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
    setState(snap);

    const allMessages: DebateMessage[] = [];
    try {
      await runDebateFlow(snap, allMessages);

      // /deep는 GPT + Gemini 2라운드 검증
      for (const vp of ["chatgpt", "gemini"] as VerificationProvider[]) {
        setState((p) => ({ ...p, status: "verifying", verificationProvider: vp }));
        setStreamRoleId(null);
        setStreamLabel(`외부 검증 중 (${vp === "chatgpt" ? "GPT-5.4" : "Gemini 3.1 Pro"})`);
        setStreamText("");

        const verifyContent = await fetchStream("/api/verify", {
          provider: vp,
          topic: data.topic,
          messages: allMessages,
          confirmedRoles: roles,
        }, (t) => setStreamText(t));

        setStreamLabel("");
        setState((p) => ({
          ...p,
          verificationResult: p.verificationResult
            ? p.verificationResult + "\n\n---\n\n" + verifyContent
            : verifyContent,
        }));
      }

      await generatePrd(data.topic, allMessages, stateRef.current);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 5. /consult =====
  const startConsult = useCallback(async (data: TopicSubmitData) => {
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
    setState(snap);

    const allMessages: DebateMessage[] = [];
    try {
      await runDebateFlow(snap, allMessages);

      if (data.verifyEngine !== "none") {
        setState((p) => ({ ...p, status: "awaiting_verification" }));
      } else {
        await generatePrd(data.topic, allMessages, { ...snap, messages: allMessages });
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 6. /extend =====
  const startExtend = useCallback(async (data: TopicSubmitData) => {
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
    setState(snap);

    const allMessages: DebateMessage[] = [];
    try {
      await runDebateFlow(snap, allMessages);

      if (data.verifyEngine !== "none") {
        setState((p) => ({ ...p, status: "awaiting_verification" }));
      } else {
        await generatePrd(data.topic, allMessages, { ...snap, messages: allMessages });
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 7. /fix =====
  const startFix = useCallback(async (data: TopicSubmitData) => {
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
    setState(snap);

    const allMessages: DebateMessage[] = [];
    try {
      await runDebateFlow(snap, allMessages);

      if (data.verifyEngine !== "none") {
        setState((p) => ({ ...p, status: "awaiting_verification" }));
      } else {
        await generatePrd(data.topic, allMessages, { ...snap, messages: allMessages });
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 8. 검증 선택 후 처리 =====
  const handleVerificationChoice = useCallback(async (
    choice: VerificationProvider | null | "redebate",
    redebateTopic?: string,
  ) => {
    const snap = stateRef.current;

    if (choice === "redebate") {
      const allMessages = [...snap.messages];
      const feedback = redebateTopic || "";
      setState((p) => ({ ...p, status: "debating" }));

      try {
        await runStage("critique", snap.topic, allMessages, snap, feedback);
        await runStage("final", snap.topic, allMessages, snap);
        await save({ ...stateRef.current, messages: [...allMessages] }, "debated");
        setState((p) => ({ ...p, status: "awaiting_verification" }));
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setState((p) => ({ ...p, status: "error", error: e.message }));
      }
      return;
    }

    if (choice === null) {
      await generatePrd(snap.topic, snap.messages, snap);
      return;
    }

    setState((p) => ({ ...p, status: "verifying", verificationProvider: choice }));
    setStreamRoleId(null);
    setStreamLabel(`외부 검증 중 (${choice === "chatgpt" ? "GPT-5.4" : "Gemini 3.1 Pro"})`);
    setStreamText("");

    try {
      const verifyContent = await fetchStream("/api/verify", {
        provider: choice,
        topic: snap.topic,
        messages: snap.messages,
        confirmedRoles: snap.confirmedRoles,
      }, (t) => setStreamText(t));

      setStreamLabel("");
      setState((p) => ({ ...p, verificationResult: verifyContent }));

      await generatePrd(snap.topic, snap.messages, {
        ...stateRef.current,
        verificationResult: verifyContent,
      });
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 9. 피드백 후 PRD 재생성 =====
  const submitFeedbackAndRefine = useCallback(async (feedbackText: string) => {
    const snap = stateRef.current;
    const prevPrd = snap.prd;

    const fb: FeedbackEntry = {
      id: genId(),
      type: "feedback",
      content: feedbackText,
      timestamp: Date.now(),
      afterRevision: snap.revisionCount,
    };
    const allFeedbacks = [...snap.feedbacks, fb];

    setState((p) => ({ ...p, feedbacks: allFeedbacks }));

    // 워크플로 분기: 하네스 vs 일반 토론
    if (snap.activeWorkflow === "plan_harness") {
      await refineHarnessPrd(snap, prevPrd, feedbackText, allFeedbacks);
    } else {
      await refineStandardPrd(snap, prevPrd, feedbackText, allFeedbacks);
    }
  }, []);

  // 일반 토론 기반 리파인 (기존 로직 그대로)
  async function refineStandardPrd(
    snap: DebateState, prevPrd: string, feedbackText: string, allFeedbacks: FeedbackEntry[],
  ) {
    const allMessages = [...snap.messages];
    setState((p) => ({ ...p, status: "debating" }));
    const refineSnap = { ...snap, feedbacks: allFeedbacks };

    try {
      await runStage("critique", snap.topic, allMessages, refineSnap, feedbackText);
      await runStage("final", snap.topic, allMessages, refineSnap);
      await generatePrd(
        snap.topic, allMessages,
        { ...refineSnap, messages: allMessages },
        "refine", prevPrd, feedbackText,
      );
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }

  // 하네스 기반 리파인 (토론 재실행 없이 PRD만 재생성)
  async function refineHarnessPrd(
    snap: DebateState, prevPrd: string, feedbackText: string, allFeedbacks: FeedbackEntry[],
  ) {
    setState((p) => ({ ...p, status: "generating_prd" }));
    setStreamLabel("하네스 PRD 피드백 반영 중 (Claude Opus 4.6)...");
    setStreamText("");

    try {
      const prd = await fetchStream("/api/synthesize", {
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
      }, (t) => setState((p) => ({ ...p, prd: t })));

      setStreamLabel("");
      setState((p) => ({
        ...p,
        prd,
        prdRevisions: [...p.prdRevisions, prd],
        revisionCount: p.revisionCount + 1,
        status: "complete",
      }));
      await save({ ...stateRef.current, prd, status: "complete" }, "complete");
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setStreamLabel("");
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }

  // ===== 하네스 산출물을 API 전달용으로 변환 =====
  function getHarnessArtifactsForApi(snap: DebateState): HarnessInputArtifacts | undefined {
    if (!snap.harness) return undefined;
    return {
      requirementSpec: snap.harness.requirementSpec,
      cps: snap.harness.cps,
      generatedPlan: snap.harness.generatedPlan,
      evaluation: snap.harness.evaluation,
    };
  }

  // ===== 10. 하네스 기반 PRD 생성 =====
  const generateHarnessPrd = useCallback(async () => {
    const snap = stateRef.current;
    if (!snap.harness?.generatedPlan) return;

    setState((p) => ({ ...p, status: "generating_prd" }));
    setStreamLabel("하네스 계획 기반 PRD 생성 중 (Claude Opus 4.6)...");
    setStreamText("");

    try {
      const prd = await fetchStream("/api/synthesize", {
        topic: snap.topic,
        messages: [],
        confirmedRoles: [],
        mode: "initial",
        command: snap.command,
        source: "harness",
        harnessArtifacts: getHarnessArtifactsForApi(snap),
      }, (t) => setState((p) => ({ ...p, prd: t })));

      setStreamLabel("");
      setState((p) => ({
        ...p,
        prd,
        prdRevisions: [...p.prdRevisions, prd],
        revisionCount: p.revisionCount + 1,
        status: "complete",
      }));
      await save({ ...stateRef.current, prd, status: "complete" }, "complete");
    } catch (e: any) {
      setStreamLabel("");
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 11. Claude Code 명령 생성 =====
  const generateCommand = useCallback(async () => {
    const snap = stateRef.current;
    const isHarness = snap.activeWorkflow === "plan_harness" && !snap.prd && !!snap.harness?.generatedPlan;

    if (!snap.prd && !isHarness) return;

    setState((p) => ({ ...p, status: "generating_command" }));
    setStreamLabel("Claude Code 명령문 생성 중...");

    try {
      const cmd = await fetchStream("/api/generate-command", {
        topic: snap.topic,
        command: snap.command,
        prd: snap.prd || "",
        modeInput: snap.modeInput,
        ...(isHarness ? { source: "harness" as const, harnessArtifacts: getHarnessArtifactsForApi(snap) } : {}),
      }, (t) => setState((p) => ({ ...p, generatedCommand: t })));

      setStreamLabel("");
      setState((p) => ({ ...p, generatedCommand: cmd, status: "complete" }));
      await save({ ...stateRef.current, generatedCommand: cmd }, "complete");
    } catch (e: any) {
      setStreamLabel("");
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 12. UI 프로토타입 생성 =====
  const generatePrototype = useCallback(async () => {
    const snap = stateRef.current;
    const isHarness = snap.activeWorkflow === "plan_harness" && !snap.prd && !!snap.harness?.generatedPlan;

    if (!snap.prd && !isHarness) return;

    setState((p) => ({ ...p, status: "generating_ui" }));
    setStreamLabel("UI 프로토타입 생성 중 (Gemini 3.1 Pro)...");

    try {
      const html = await fetchStream("/api/generate-ui", {
        prd: snap.prd || "",
        ...(isHarness ? { source: "harness" as const, harnessArtifacts: getHarnessArtifactsForApi(snap) } : {}),
      }, (t) => setState((p) => ({ ...p, prototypeHtml: t })));

      setStreamLabel("");
      const cleaned = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim();
      setState((p) => ({ ...p, prototypeHtml: cleaned, status: "complete" }));
      await save({ ...stateRef.current, prototypeHtml: cleaned }, "complete");
      if (stateRef.current.sessionId) {
        fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ debateId: stateRef.current.sessionId, htmlCode: cleaned, modificationRequest: "" }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setStreamLabel("");
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 12. UI 수정 요청 =====
  const refinePrototype = useCallback(async (modificationRequest: string) => {
    const snap = stateRef.current;
    if (!snap.prototypeHtml) return;

    setState((p) => ({ ...p, status: "generating_ui" }));
    setStreamLabel("UI 수정 중 (Gemini 3.1 Pro)...");

    try {
      const html = await fetchStream("/api/generate-ui", {
        prd: snap.prd,
        existingHtml: snap.prototypeHtml,
        modificationRequest,
      }, (t) => setState((p) => ({ ...p, prototypeHtml: t })));

      setStreamLabel("");
      const cleaned = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim();
      setState((p) => ({ ...p, prototypeHtml: cleaned, status: "complete" }));
      await save({ ...stateRef.current, prototypeHtml: cleaned }, "complete");
      // Save UI version to DB
      if (stateRef.current.sessionId) {
        fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ debateId: stateRef.current.sessionId, htmlCode: cleaned, modificationRequest }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setStreamLabel("");
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== Plan Harness 재실행 (구조적 수정) =====
  const rerunPlanHarness = useCallback(async (revisionRequest?: string) => {
    const snap = stateRef.current;
    if (snap.activeWorkflow !== "plan_harness") return;

    const previousPlanSummary = revisionRequest && snap.harness
      ? buildPreviousHarnessSummary(snap.harness)
      : undefined;

    const runCount = (snap.harnessRunCount || 1) + 1;

    // 이전 결과가 있으면 snapshot으로 history에 보관 (최대 3개)
    const prevHistory = snap.harness?.history || [];
    let newHistory = prevHistory;
    if (snap.harness?.generatedPlan) {
      const snapshot = createSnapshot(
        snap.harness,
        snap.harnessRunCount || 1,
        snap.topic,
        snap.harnessRevisionRequest,
      );
      newHistory = pushSnapshot(prevHistory, snapshot);
    }

    setState((p) => ({
      ...p,
      harness: { lintIssues: [], attempts: [], history: newHistory, runCount, revisionRequest },
      harnessRevisionRequest: revisionRequest || undefined,
      harnessRunCount: runCount,
      harnessUserSummary: undefined,
      currentHarnessStage: undefined,
      prd: "",
      prdRevisions: [],
      revisionCount: 0,
      generatedCommand: "",
      prototypeHtml: "",
      feedbacks: [],
      status: "generating_plan",
      error: undefined,
    }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/plan-harness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: snap.topic,
          command: snap.command,
          modeInput: snap.modeInput,
          techSpec: snap.techSpec,
          referencePrd: undefined,
          revisionRequest: revisionRequest || undefined,
          previousPlanSummary,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(errBody).message || msg; } catch {}
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림 읽기 실패");
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try { applyHarnessEvent(JSON.parse(trimmed)); } catch {}
        }
      }
      if (buf.trim()) {
        try { applyHarnessEvent(JSON.parse(buf.trim())); } catch {}
      }

      setState((p) => {
        if (p.status === "generating_plan") {
          return { ...p, status: "error", error: "서버 스트림이 완료 이벤트 없이 종료됨" };
        }
        return p;
      });

      try { await save(stateRef.current, stateRef.current.status); } catch {
        setState((p) => ({ ...p, saveError: "세션 저장 실패" }));
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        await handleHarnessAbort();
        return;
      }
      setState((p) => ({ ...p, status: "error", error: e.message }));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setStreamLabel("");
    }
  }, []);

  // ===== Plan Harness: NDJSON 스트림 기반 자동 계획 생성 =====
  const startPlanHarness = useCallback(async (data: TopicSubmitData) => {
    const sessionId = genId();
    const createdAt = new Date().toISOString();
    setState({
      ...initialState,
      topic: data.topic,
      command: data.command,
      debateEngine: data.debateEngine,
      verifyEngine: data.verifyEngine,
      techSpec: data.techSpec,
      modeInput: data.modeInput,
      activeWorkflow: "plan_harness",
      harness: { lintIssues: [], attempts: [] },
      status: "generating_plan",
      sessionId,
      createdAt,
    });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/plan-harness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: data.topic,
          command: data.command,
          modeInput: data.modeInput,
          techSpec: data.techSpec,
          referencePrd: data.referencePrd,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(errBody).message || msg; } catch {}
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림 읽기 실패");

      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        // 줄 단위 파싱
        const lines = buf.split("\n");
        buf = lines.pop() || ""; // 마지막 불완전 줄은 버퍼에 유지
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev = JSON.parse(trimmed) as PlanHarnessStreamEvent;
            applyHarnessEvent(ev);
          } catch {
            // 파싱 실패 줄은 무시
          }
        }
      }

      // 스트림 종료 후 버퍼에 남은 마지막 줄 처리
      if (buf.trim()) {
        try {
          const ev = JSON.parse(buf.trim()) as PlanHarnessStreamEvent;
          applyHarnessEvent(ev);
        } catch {}
      }

      // 스트림 끝까지 읽었는데 status가 아직 generating_plan이면 error로 전환
      setState((p) => {
        if (p.status === "generating_plan") {
          return { ...p, status: "error", error: "서버 스트림이 완료 이벤트 없이 종료됨" };
        }
        return p;
      });

      // 세션 저장
      try {
        const snap = stateRef.current;
        await save(snap, snap.status);
      } catch {
        setState((p) => ({ ...p, saveError: "세션 저장 실패" }));
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        await handleHarnessAbort();
        return;
      }
      setState((p) => ({ ...p, status: "error", error: e.message }));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setStreamLabel("");
    }
  }, []);

  /** NDJSON 이벤트를 DebateState에 반영 */
  function applyHarnessEvent(ev: PlanHarnessStreamEvent) {
    switch (ev.event) {
      case "started":
        setState((p) => ({
          ...p,
          status: "generating_plan",
          activeWorkflow: "plan_harness",
          harness: p.harness || { lintIssues: [], attempts: [] },
        }));
        break;

      case "stage_started":
        setState((p) => ({
          ...p,
          currentHarnessStage: ev.stage,
        }));
        setStreamLabel(harnessStageLabel(ev.stage));
        break;

      case "attempt":
        setState((p) => ({
          ...p,
          harness: p.harness
            ? { ...p.harness, attempts: [...p.harness.attempts, ev.attempt] }
            : { lintIssues: [], attempts: [ev.attempt] },
        }));
        break;

      case "lint_result":
        setState((p) => ({
          ...p,
          harness: p.harness
            ? { ...p.harness, lintIssues: ev.issues }
            : { lintIssues: ev.issues, attempts: [] },
        }));
        break;

      case "evaluation_result":
        setState((p) => ({
          ...p,
          harness: p.harness
            ? { ...p.harness, evaluation: ev.evaluation }
            : { lintIssues: [], attempts: [], evaluation: ev.evaluation },
        }));
        break;

      case "completed":
        setState((p) => ({
          ...p,
          harness: {
            requirementSpec: ev.requirementSpec,
            cps: ev.cps,
            generatedPlan: ev.generatedPlan,
            lintIssues: ev.lintIssues,
            evaluation: ev.evaluation,
            attempts: ev.attempts,
            history: p.harness?.history,
            runCount: p.harnessRunCount || 1,
            revisionRequest: p.harnessRevisionRequest,
            userSummary: ev.userFacingSummary,
          },
          harnessUserSummary: ev.userFacingSummary,
          currentHarnessStage: undefined,
          status: ev.success ? "complete" : "error",
          error: ev.success ? undefined : (ev.userFacingSummary || "계획 생성 파이프라인이 평가를 통과하지 못했습니다"),
        }));
        setStreamLabel("");
        break;

      case "error":
        // attempts는 서버 값과 클라이언트 값 중 더 많은 쪽을 사용 (줄어들지 않게)
        setState((p) => {
          const clientAttempts = p.harness?.attempts || [];
          const merged = mergeAttempts(clientAttempts, ev.attempts);
          return {
            ...p,
            harness: p.harness
              ? { ...p.harness, attempts: merged }
              : { lintIssues: [], attempts: merged },
            currentHarnessStage: undefined,
            status: "error",
            error: ev.message,
          };
        });
        setStreamLabel("");
        break;

      case "aborted":
        // 서버가 보낸 aborted — 부분 결과를 유지하고 "중단됨" 상태로 표시
        // attempts는 서버 값과 클라이언트 값 중 더 많은 쪽을 사용
        setState((p) => {
          const clientAttempts = p.harness?.attempts || [];
          const merged = mergeAttempts(clientAttempts, ev.attempts);
          return {
            ...p,
            harness: p.harness
              ? { ...p.harness, attempts: merged }
              : { lintIssues: [], attempts: merged },
            currentHarnessStage: undefined,
            status: "error",
            error: "사용자에 의해 중단됨",
          };
        });
        setStreamLabel("");
        break;
    }
  }

  function harnessStageLabel(stage: string): string {
    switch (stage) {
      case "normalize": return "요구사항 정규화 중...";
      case "cps": return "CPS 분석 중...";
      case "generate": return "계획 생성 중...";
      case "lint": return "린트 검증 중...";
      case "evaluate": return "계획 평가 중...";
      case "repair": return "결함 수정 후 재생성 중...";
      default: return `${stage} 처리 중...`;
    }
  }

  // ===== /ideate: 아이디어 구체화 시작 =====
  const startIdeate = useCallback(async (data: TopicSubmitData) => {
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
      status: "clarifying",
      sessionId,
      createdAt,
    };
    setState(snap);

    try {
      await runClarificationRound(snap, 1, []);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 전문가 질문 생성 (1라운드) =====
  const runClarificationRound = async (
    snap: DebateState,
    round: number,
    previousQA: ClarificationQA[],
  ) => {
    setState((p) => ({ ...p, status: "clarifying", clarificationRound: round }));

    const newQAs: ClarificationQA[] = [];

    for (const roleId of IDEATE_CLARIFY_ROLES) {
      setStreamRoleId(roleId);
      setStreamText("");

      const questions = await fetchStream("/api/clarify", {
        roleId,
        topic: snap.topic,
        previousQA,
        round,
        debateEngine: snap.debateEngine,
      }, (t) => setStreamText(t));

      setStreamText("");
      setStreamRoleId(null);

      const qa: ClarificationQA = {
        id: genId(),
        roleId,
        questions,
        answers: "",
        round,
        timestamp: Date.now(),
      };
      newQAs.push(qa);

      setState((p) => ({
        ...p,
        clarifications: [...previousQA, ...newQAs],
      }));
    }

    setState((p) => ({
      ...p,
      clarifications: [...previousQA, ...newQAs],
      status: "awaiting_clarification",
    }));
  };

  // ===== 답변 제출 후 후속 질문 =====
  const submitClarificationAndAskMore = useCallback(async (answers: Record<string, string>) => {
    const snap = stateRef.current;

    // 현재 라운드의 QA에 답변 업데이트
    const updatedQAs = snap.clarifications.map((qa) => {
      if (qa.round === snap.clarificationRound && answers[qa.roleId]) {
        return { ...qa, answers: answers[qa.roleId] };
      }
      return qa;
    });

    setState((p) => ({ ...p, clarifications: updatedQAs }));

    const nextRound = snap.clarificationRound + 1;

    try {
      await runClarificationRound(
        { ...snap, clarifications: updatedQAs },
        nextRound,
        updatedQAs,
      );
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 답변 제출 후 토론 진행 =====
  const submitClarificationAndDebate = useCallback(async (answers: Record<string, string>) => {
    const snap = stateRef.current;

    // 현재 라운드의 QA에 답변 업데이트
    const updatedQAs = snap.clarifications.map((qa) => {
      if (qa.round === snap.clarificationRound && answers[qa.roleId]) {
        return { ...qa, answers: answers[qa.roleId] };
      }
      return qa;
    });

    setState((p) => ({ ...p, clarifications: updatedQAs, status: "debating" }));

    const updatedSnap = { ...snap, clarifications: updatedQAs };

    // QA 내용을 토론 컨텍스트로 변환
    const clarifiedContext = buildClarifiedContext(updatedQAs);
    const enrichedTopic = `${snap.topic}\n\n## 전문가 질문을 통해 구체화된 내용\n${clarifiedContext}`;

    const debateSnap = { ...updatedSnap, topic: enrichedTopic };
    const allMessages: DebateMessage[] = [];

    try {
      // 2단계: 개발계획 토론 (기존 3단계 토론 재활용)
      await runDebateFlow(debateSnap, allMessages);

      // 3단계: 사용자 관점 토론
      setState((p) => ({ ...p, status: "debating_user_perspective" as DebateStatus }));
      setStreamLabel("사용자 관점 토론 중...");

      for (const roleId of IDEATE_UX_ROLES.filter((r) => r !== "moderator")) {
        setStreamRoleId(roleId);
        setStreamText("");

        const content = await fetchStream("/api/debate", {
          roleId,
          topic: enrichedTopic,
          stage: "user_perspective",
          confirmedRoles: IDEATE_UX_ROLES,
          history: allMessages,
          debateEngine: snap.debateEngine,
          command: "ideate",
        }, (t) => setStreamText(t));

        setStreamText("");
        setStreamRoleId(null);

        const msg: DebateMessage = {
          id: `user_perspective-${roleId}-${Date.now()}`,
          roleId,
          stage: "user_perspective",
          content,
          timestamp: Date.now(),
        };
        allMessages.push(msg);
        setState((p) => ({ ...p, messages: [...allMessages] }));
      }

      // 중재자 최종 정리
      setStreamRoleId("moderator");
      setStreamText("");
      const modContent = await fetchStream("/api/debate", {
        roleId: "moderator",
        topic: enrichedTopic,
        stage: "user_perspective",
        confirmedRoles: IDEATE_UX_ROLES,
        history: allMessages,
        debateEngine: snap.debateEngine,
        command: "ideate",
      }, (t) => setStreamText(t));

      setStreamText("");
      setStreamRoleId(null);

      allMessages.push({
        id: `user_perspective-moderator-${Date.now()}`,
        roleId: "moderator",
        stage: "user_perspective",
        content: modContent,
        timestamp: Date.now(),
      });
      setState((p) => ({ ...p, messages: [...allMessages] }));

      setStreamLabel("");
      await save({ ...stateRef.current, messages: [...allMessages], clarifications: updatedQAs }, "debated");

      // PRD 생성
      await generatePrd(enrichedTopic, allMessages, {
        ...stateRef.current,
        messages: allMessages,
        topic: enrichedTopic,
      });
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // QA를 텍스트 컨텍스트로 변환
  function buildClarifiedContext(qas: ClarificationQA[]): string {
    let context = "";
    const byRound = new Map<number, ClarificationQA[]>();
    for (const qa of qas) {
      const list = byRound.get(qa.round) || [];
      list.push(qa);
      byRound.set(qa.round, list);
    }
    for (const [round, roundQAs] of byRound) {
      context += `\n### 라운드 ${round}\n`;
      for (const qa of roundQAs) {
        context += `\n**${qa.roleId} 질문:** ${qa.questions}\n**기획자 답변:** ${qa.answers}\n`;
      }
    }
    return context;
  }

  // ===== 세션 로드 =====
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("세션을 불러올 수 없습니다.");
      const s: Session = await res.json();

      setState({
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
      });
    } catch (e: any) {
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 중단 =====
  // abort 신호만 보낸다. 실제 상태 전이는
  // - 하네스 경로: AbortError catch에서 handleHarnessAbort()가 담당
  // - 일반 토론: AbortError catch에서 early return
  const stopDebate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // 하네스가 아닌 일반 경로에서는 abort 후 상태가 멈출 수 있으므로 idle 전환
    // 하네스 경로는 자체 AbortError catch에서 처리
    setState((p) => {
      if (p.activeWorkflow === "plan_harness" && p.status === "generating_plan") {
        // 하네스: AbortError catch가 처리할 것이므로 여기서는 건드리지 않음
        return p;
      }
      // 일반 토론: 즉시 idle
      return { ...p, status: "idle" };
    });
    setStreamText("");
    setStreamRoleId(null);
    setStreamLabel("");
  }, []);

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
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
  };
}
