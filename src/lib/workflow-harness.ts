import { WorkflowContext } from "./workflow-context";
import { DebateState, PlanHarnessStreamEvent } from "./types";
import { TopicSubmitData } from "@/components/TopicInput";
import { buildPreviousHarnessSummary } from "./harness-summary";
import { createSnapshot, pushSnapshot } from "./harness-diff";
import { mergeAttempts } from "./harness-attempts";
import { initialState } from "./debate-reducer";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/** abort 시 저장할 스냅샷을 동기적으로 구성 */
function buildAbortSnapshot(current: DebateState): DebateState {
  return {
    ...current,
    currentHarnessStage: undefined,
    status: "error",
    error: "사용자에 의해 중단됨",
  };
}

// ===== 하네스 abort 공통 처리 =====
export async function handleHarnessAbort(ctx: WorkflowContext) {
  const aborted = buildAbortSnapshot(ctx.stateRef.current);
  ctx.dispatch({ type: "INIT_SESSION", state: aborted });
  ctx.setStreamLabel("");
  try {
    if (aborted.sessionId) {
      await ctx.save(aborted, "error");
    }
  } catch {
    ctx.dispatch({ type: "SET_SAVE_ERROR", saveError: "세션 저장 실패" });
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

/** NDJSON 이벤트를 DebateState에 반영 */
function applyHarnessEvent(ctx: WorkflowContext, ev: PlanHarnessStreamEvent) {
  switch (ev.event) {
    case "started":
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          status: "generating_plan",
          activeWorkflow: "plan_harness",
          harness: ctx.stateRef.current.harness || { lintIssues: [], attempts: [] },
        },
      });
      break;

    case "stage_started":
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: { currentHarnessStage: ev.stage },
      });
      ctx.setStreamLabel(harnessStageLabel(ev.stage));
      break;

    case "attempt": {
      const cur = ctx.stateRef.current;
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          harness: cur.harness
            ? { ...cur.harness, attempts: [...cur.harness.attempts, ev.attempt] }
            : { lintIssues: [], attempts: [ev.attempt] },
        },
      });
      break;
    }

    case "lint_result": {
      const cur = ctx.stateRef.current;
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          harness: cur.harness
            ? { ...cur.harness, lintIssues: ev.issues }
            : { lintIssues: ev.issues, attempts: [] },
        },
      });
      break;
    }

    case "evaluation_result": {
      const cur = ctx.stateRef.current;
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          harness: cur.harness
            ? { ...cur.harness, evaluation: ev.evaluation }
            : { lintIssues: [], attempts: [], evaluation: ev.evaluation },
        },
      });
      break;
    }

    case "completed": {
      const cur = ctx.stateRef.current;
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          harness: {
            requirementSpec: ev.requirementSpec,
            cps: ev.cps,
            generatedPlan: ev.generatedPlan,
            lintIssues: ev.lintIssues,
            evaluation: ev.evaluation,
            attempts: ev.attempts,
            history: cur.harness?.history,
            runCount: cur.harnessRunCount || 1,
            revisionRequest: cur.harnessRevisionRequest,
            userSummary: ev.userFacingSummary,
          },
          harnessUserSummary: ev.userFacingSummary,
          currentHarnessStage: undefined,
          status: ev.success ? "complete" : "error",
          error: ev.success ? undefined : (ev.userFacingSummary || "계획 생성 파이프라인이 평가를 통과하지 못했습니다"),
        },
      });
      ctx.setStreamLabel("");
      break;
    }

    case "error": {
      const cur = ctx.stateRef.current;
      const clientAttempts = cur.harness?.attempts || [];
      const merged = mergeAttempts(clientAttempts, ev.attempts);
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          harness: cur.harness
            ? { ...cur.harness, attempts: merged }
            : { lintIssues: [], attempts: merged },
          currentHarnessStage: undefined,
          status: "error",
          error: ev.message,
        },
      });
      ctx.setStreamLabel("");
      break;
    }

    case "aborted": {
      const cur = ctx.stateRef.current;
      const clientAttempts = cur.harness?.attempts || [];
      const merged = mergeAttempts(clientAttempts, ev.attempts);
      ctx.dispatch({
        type: "UPDATE_HARNESS",
        updates: {
          harness: cur.harness
            ? { ...cur.harness, attempts: merged }
            : { lintIssues: [], attempts: merged },
          currentHarnessStage: undefined,
          status: "error",
          error: "사용자에 의해 중단됨",
        },
      });
      ctx.setStreamLabel("");
      break;
    }
  }
}

/** 공통 NDJSON 스트림 읽기 + 이벤트 처리 루프 */
async function readHarnessStream(ctx: WorkflowContext, res: Response) {
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
      try {
        const ev = JSON.parse(trimmed) as PlanHarnessStreamEvent;
        applyHarnessEvent(ctx, ev);
      } catch {
        // 파싱 실패 줄은 무시
      }
    }
  }

  // 스트림 종료 후 버퍼에 남은 마지막 줄 처리
  if (buf.trim()) {
    try {
      const ev = JSON.parse(buf.trim()) as PlanHarnessStreamEvent;
      applyHarnessEvent(ctx, ev);
    } catch {}
  }
}

// ===== Plan Harness: NDJSON 스트림 기반 자동 계획 생성 =====
export async function startPlanHarness(ctx: WorkflowContext, data: TopicSubmitData) {
  const sessionId = genId();
  const createdAt = new Date().toISOString();
  ctx.dispatch({
    type: "INIT_SESSION",
    state: {
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
    },
  });

  const ctrl = new AbortController();
  ctx.abortRef.current = ctrl;

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

    await readHarnessStream(ctx, res);

    // 스트림 끝까지 읽었는데 status가 아직 generating_plan이면 error로 전환
    if (ctx.stateRef.current.status === "generating_plan") {
      ctx.dispatch({ type: "SET_ERROR", error: "서버 스트림이 완료 이벤트 없이 종료됨" });
    }

    // 세션 저장
    try {
      const snap = ctx.stateRef.current;
      await ctx.save(snap, snap.status);
    } catch {
      ctx.dispatch({ type: "SET_SAVE_ERROR", saveError: "세션 저장 실패" });
    }
  } catch (e: any) {
    if (e.name === "AbortError") {
      await handleHarnessAbort(ctx);
      return;
    }
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  } finally {
    if (ctx.abortRef.current === ctrl) ctx.abortRef.current = null;
    ctx.setStreamLabel("");
  }
}

// ===== Plan Harness 재실행 (구조적 수정) =====
export async function rerunPlanHarness(ctx: WorkflowContext, revisionRequest?: string) {
  const snap = ctx.stateRef.current;
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

  ctx.dispatch({
    type: "UPDATE_HARNESS",
    updates: {
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
    },
  });

  const ctrl = new AbortController();
  ctx.abortRef.current = ctrl;

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

    await readHarnessStream(ctx, res);

    if (ctx.stateRef.current.status === "generating_plan") {
      ctx.dispatch({ type: "SET_ERROR", error: "서버 스트림이 완료 이벤트 없이 종료됨" });
    }

    try { await ctx.save(ctx.stateRef.current, ctx.stateRef.current.status); } catch {
      ctx.dispatch({ type: "SET_SAVE_ERROR", saveError: "세션 저장 실패" });
    }
  } catch (e: any) {
    if (e.name === "AbortError") {
      await handleHarnessAbort(ctx);
      return;
    }
    ctx.dispatch({ type: "SET_ERROR", error: e.message });
  } finally {
    if (ctx.abortRef.current === ctrl) ctx.abortRef.current = null;
    ctx.setStreamLabel("");
  }
}
