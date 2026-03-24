"use client";

import { useState, useCallback, useRef } from "react";
import {
  DebateState, DebateStatus, DebateCommand, DebateStageId,
  DebateMessage, DebateRoleId, FeedbackEntry, Recommendation,
  VerificationProvider, DebateEngineId, VerifyEngineId, ModeInput,
  Session,
} from "@/lib/types";
import { QUICK_ROLES, DEEP_ROLES, CONSULT_ROLES, FIX_ROLES, getDebateOrder } from "@/lib/constants";
import { TopicSubmitData } from "@/components/TopicInput";

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
  };

  // ===== 세션 빌드/저장 =====
  const buildSession = (snap: DebateState, statusOverride?: string): Session => ({
    id: snap.sessionId || genId(),
    topic: snap.topic,
    command: snap.command,
    debateEngine: snap.debateEngine,
    verifyEngine: snap.verifyEngine,
    techSpec: snap.techSpec || undefined,
    modeInput: snap.modeInput || undefined,
    recommendation: snap.recommendation,
    confirmedRoles: snap.confirmedRoles,
    messages: snap.messages,
    verificationProvider: snap.verificationProvider,
    verificationResult: snap.verificationResult,
    prd: snap.prd,
    prdRevisions: snap.prdRevisions,
    revisionCount: snap.revisionCount,
    feedbacks: snap.feedbacks,
    generatedCommand: snap.generatedCommand || undefined,
    prototypeHtml: snap.prototypeHtml || undefined,
    status: statusOverride || snap.status,
    createdAt: snap.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const save = async (snap: DebateState, st?: string) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSession(snap, st)),
      });
      setState((p) => ({ ...p, saveError: undefined }));
    } catch {
      setState((p) => ({ ...p, saveError: "세션 저장 실패" }));
    }
  };

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

  // ===== 9. 피드백 후 재토론 + PRD 재생성 =====
  const submitFeedbackAndRefine = useCallback(async (feedbackText: string) => {
    const snap = stateRef.current;
    const allMessages = [...snap.messages];
    const prevPrd = snap.prd;

    const fb: FeedbackEntry = {
      id: genId(),
      type: "feedback",
      content: feedbackText,
      timestamp: Date.now(),
      afterRevision: snap.revisionCount,
    };
    const allFeedbacks = [...snap.feedbacks, fb];

    setState((p) => ({ ...p, feedbacks: allFeedbacks, status: "debating" }));

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
  }, []);

  // ===== 10. Claude Code 명령 생성 =====
  const generateCommand = useCallback(async () => {
    const snap = stateRef.current;
    if (!snap.prd) return;

    setState((p) => ({ ...p, status: "generating_command" }));
    setStreamLabel("Claude Code 명령문 생성 중...");

    try {
      const cmd = await fetchStream("/api/generate-command", {
        topic: snap.topic,
        command: snap.command,
        prd: snap.prd,
        modeInput: snap.modeInput,
      }, (t) => setState((p) => ({ ...p, generatedCommand: t })));

      setStreamLabel("");
      setState((p) => ({ ...p, generatedCommand: cmd, status: "complete" }));
      await save({ ...stateRef.current, generatedCommand: cmd }, "complete");
    } catch (e: any) {
      setStreamLabel("");
      setState((p) => ({ ...p, status: "complete", error: e.message }));
    }
  }, []);

  // ===== 11. UI 프로토타입 생성 =====
  const generatePrototype = useCallback(async () => {
    const snap = stateRef.current;
    if (!snap.prd) return;

    setState((p) => ({ ...p, status: "generating_ui" }));
    setStreamLabel("UI 프로토타입 생성 중 (Gemini 3.1 Pro)...");

    try {
      const html = await fetchStream("/api/generate-ui", {
        prd: snap.prd,
      }, (t) => setState((p) => ({ ...p, prototypeHtml: t })));

      setStreamLabel("");
      // HTML 정리 (마크다운 코드블록 제거)
      const cleaned = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim();
      setState((p) => ({ ...p, prototypeHtml: cleaned, status: "complete" }));
      await save({ ...stateRef.current, prototypeHtml: cleaned }, "complete");
      // Save UI version to DB
      if (stateRef.current.sessionId) {
        fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ debateId: stateRef.current.sessionId, htmlCode: cleaned, modificationRequest: "" }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setStreamLabel("");
      setState((p) => ({ ...p, status: "complete", error: e.message }));
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
      setState((p) => ({ ...p, status: "complete", error: e.message }));
    }
  }, []);

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
        generatedCommand: s.generatedCommand || "",
        prototypeHtml: s.prototypeHtml || "",
        status: (s.status || "complete") as DebateStatus,
        sessionId: s.id,
        createdAt: s.createdAt,
      });
    } catch (e: any) {
      setState((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, []);

  // ===== 중단/리셋 =====
  const stopDebate = useCallback(() => {
    abortRef.current?.abort();
    setState((p) => ({ ...p, status: "idle" }));
  }, []);

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
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
