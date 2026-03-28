"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDebate } from "@/hooks/useDebate";
import { DebateStageId, Session } from "@/lib/types";
import { STAGE_LABELS, MODE_INFO, getEngineLabel, IDEATE_CLARIFY_ROLES } from "@/lib/constants";
import { TopicSubmitData } from "@/components/TopicInput";
import StatusCards from "./StatusCards";
import TopicInput from "./TopicInput";
import RecommendationPanel from "./RecommendationPanel";
import RoundDisplay from "./RoundDisplay";
import VerificationPanel from "./VerificationPanel";
import FinalPlan from "./FinalPlan";
import FeedbackEntryComponent from "./FeedbackEntry";
import CommandOutput from "./CommandOutput";
import UiPrototype from "./UiPrototype";
import SimilarDebates from "./SimilarDebates";
import ClarificationPanel from "./ClarificationPanel";
import RequirementSpecPanel from "./RequirementSpecPanel";
import CpsPanel from "./CpsPanel";
import GeneratedPlanPanel from "./GeneratedPlanPanel";
import PlanEvaluationPanel from "./PlanEvaluationPanel";
import HarnessDiffPanel from "./HarnessDiffPanel";
import { computeHarnessDiff } from "@/lib/harness-diff";
import Markdown from "react-markdown";

export default function DebateArena() {
  const {
    state, streamText, streamRoleId, streamLabel,
    requestRecommendation, confirmAndStart,
    startQuick, startDeep, startConsult, startExtend, startFix,
    startIdeate, submitClarificationAndAskMore, submitClarificationAndDebate,
    startPlanHarness, rerunPlanHarness, generateHarnessPrd,
    handleVerificationChoice,
    submitFeedbackAndRefine,
    generateCommand, generatePrototype, refinePrototype,
    loadSession, stopDebate, resetDebate, retryFromError,
  } = useDebate();

  const [skipUi, setSkipUi] = useState(false);
  const [topicForSimilar, setTopicForSimilar] = useState("");
  const [referencePrd, setReferencePrd] = useState("");

  const searchParams = useSearchParams();

  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid && state.status === "idle" && !state.sessionId) loadSession(sid);
  }, [searchParams]);

  const isActive = state.status !== "idle";
  const isWorking = ["recommending", "clarifying", "debating", "debating_user_perspective", "verifying", "generating_prd", "generating_command", "generating_ui", "generating_plan"].includes(state.status);
  const isHarnessMode = state.activeWorkflow === "plan_harness";

  // 워크플로 결정은 여기서 1회. 이후 분기 없음.
  const handleSubmit = (data: TopicSubmitData) => {
    if (data.workflow === "plan_harness") {
      startPlanHarness(data);
      return;
    }
    // standard workflow: command 기반 분기
    switch (data.command) {
      case "quick": startQuick(data); break;
      case "deep": startDeep(data); break;
      case "consult": startConsult(data); break;
      case "extend": startExtend(data); break;
      case "fix": startFix(data); break;
      case "ideate": startIdeate(data); break;
      case "debate": default: requestRecommendation(data); break;
    }
  };

  // 메시지가 있는 스테이지 목록
  const activeStages = Array.from(
    new Set(state.messages.map((m) => m.stage)),
  ) as DebateStageId[];

  // 하네스 진행 단계: 서버가 실제로 보낸 stage_started 기준
  const harnessStageSequence = ["normalize", "cps", "generate", "lint", "evaluate", "repair"] as const;
  const harnessStageLabels: Record<string, string> = {
    normalize: "요구사항 정규화",
    cps: "CPS 분석",
    generate: "계획 생성",
    lint: "린트 검증",
    evaluate: "계획 평가",
    repair: "결함 수정",
  };

  // 하네스 모드에서 서버가 실제로 진행한 단계만 진행바에 표시
  const harnessVisitedStages: string[] = [];
  if (isHarnessMode && state.harness) {
    const seen = new Set<string>();
    for (const a of state.harness.attempts) {
      if (!seen.has(a.stage)) { seen.add(a.stage); harnessVisitedStages.push(a.stage); }
    }
    // 현재 진행 중인 단계가 아직 attempt에 없으면 추가
    if (state.currentHarnessStage && !seen.has(state.currentHarnessStage)) {
      harnessVisitedStages.push(state.currentHarnessStage);
    }
  }

  const allStages: { id: string; label: string }[] = isHarnessMode
    ? (harnessVisitedStages.length > 0
        ? harnessVisitedStages.map((s) => ({ id: s, label: harnessStageLabels[s] || s }))
        : [{ id: "generating_plan", label: "자동 계획 파이프라인" }])
    : state.command === "ideate"
    ? [
        { id: "clarify", label: "아이디어 구체화" },
        { id: "independent", label: "독립 분석" },
        { id: "critique", label: "교차 비판" },
        { id: "final", label: "최종 정리" },
        { id: "user_perspective", label: "사용자 관점" },
        { id: "prd", label: "개발계획서" },
      ]
    : [
        ...(state.command === "debate" ? [{ id: "recommend", label: "추천" }] : []),
        { id: "independent", label: "독립 분석" },
        { id: "critique", label: "교차 비판" },
        { id: "final", label: "최종 정리" },
        { id: "verify", label: "검증" },
        { id: "prd", label: MODE_INFO[state.command]?.label.includes("PRD") ? "PRD" : "문서" },
      ];

  const getProgressIndex = () => {
    if (isHarnessMode) {
      if (state.status === "complete" || state.status === "error") return allStages.length;
      if (state.status === "generating_plan" && state.currentHarnessStage) {
        const idx = harnessVisitedStages.indexOf(state.currentHarnessStage);
        return idx >= 0 ? idx : allStages.length - 1;
      }
      return allStages.length > 0 ? allStages.length - 1 : 0;
    }

    if (state.command === "ideate") {
      switch (state.status) {
        case "clarifying":
        case "awaiting_clarification":
          return 0;
        case "debating":
          if (state.currentStage === "independent") return 1;
          if (state.currentStage === "critique") return 2;
          if (state.currentStage === "final") return 3;
          return 1;
        case "debating_user_perspective":
          return 4;
        case "generating_prd":
          return 5;
        case "generating_command":
        case "generating_ui":
        case "complete":
          return allStages.length;
        default:
          return -1;
      }
    }

    const offset = state.command === "debate" ? 0 : -1;
    switch (state.status) {
      case "recommending":
      case "awaiting_confirmation":
        return 0;
      case "debating":
        if (state.currentStage === "independent") return 1 + offset;
        if (state.currentStage === "critique") return 2 + offset;
        if (state.currentStage === "final") return 3 + offset;
        return 1 + offset;
      case "awaiting_verification":
      case "verifying":
        return 4 + offset;
      case "generating_prd":
        return 5 + offset;
      case "generating_command":
      case "generating_ui":
      case "complete":
        return allStages.length;
      default:
        return -1;
    }
  };
  const progressIdx = getProgressIndex();

  return (
    <div className="space-y-5">
      <StatusCards
        roleCount={state.confirmedRoles.length}
        status={state.status}
        command={state.command}
        debateEngine={state.debateEngine}
      />

      <TopicInput onSubmit={handleSubmit} disabled={isActive} onTopicChange={setTopicForSimilar} referencePrd={referencePrd} />

      {/* 유사 토론 추천 */}
      {!isActive && topicForSimilar.length >= 4 && (
        <SimilarDebates topic={topicForSimilar} onReference={setReferencePrd} />
      )}

      {isActive && (
        <>
          {/* 진행 바 */}
          <div className="card px-5 py-3">
            <div className="flex items-center gap-1.5">
              {allStages.map((s, i) => {
                const isDone = i < progressIdx;
                const isCurrent = i === progressIdx && !["complete", "generating_command", "generating_ui"].includes(state.status);
                return (
                  <div key={s.id} className="flex items-center gap-1.5 flex-1">
                    <div className={`h-6 px-2 rounded-full flex items-center justify-center text-[9px] font-bold transition-all whitespace-nowrap ${
                      isDone ? "bg-success text-white"
                      : isCurrent ? "bg-accent text-white animate-pulse-soft"
                      : "bg-bg-muted text-text-muted border border-border-light"
                    }`}>
                      {isDone ? "\u2713" : s.label}
                    </div>
                    {i < allStages.length - 1 && (
                      <div className={`flex-1 h-px ${isDone ? "bg-success/40" : "bg-border-light"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 컨트롤 */}
          <div className="flex justify-end">
            {isWorking && (
              <button onClick={stopDebate} className="px-4 py-1.5 text-xs font-medium text-error bg-error-bg border border-error/15 rounded-lg">
                중단
              </button>
            )}
            {(state.status === "complete" || state.status === "error") && (
              <button onClick={() => { resetDebate(); setSkipUi(false); }} className="px-4 py-1.5 text-xs font-medium text-text-secondary bg-bg-muted border border-border-light rounded-lg hover:bg-bg-hover">
                새 토론
              </button>
            )}
          </div>

          {/* 추천 분석 중 (일반 토론 전용) */}
          {!isHarnessMode && state.status === "recommending" && (
            <div className="card px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm text-accent animate-pulse-soft">프로젝트 분석 중... ({getEngineLabel(state.debateEngine)})</span>
              </div>
            </div>
          )}

          {/* 추천 패널 (일반 토론 전용) */}
          {!isHarnessMode && state.status === "awaiting_confirmation" && state.recommendation && (
            <RecommendationPanel
              recommendation={state.recommendation}
              onConfirm={confirmAndStart}
            />
          )}

          {/* Plan Harness 진행 / 결과 */}
          {isHarnessMode && (
            <div className="space-y-4">
              {/* 진행 중 실시간 상태 */}
              {state.status === "generating_plan" && (
                <div className="card px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm text-accent animate-pulse-soft">
                      {streamLabel || "자동 계획 파이프라인 시작 중..."}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-2">Claude Opus 4.6 고정. 서버에서 단계별 진행 이벤트를 실시간 수신 중입니다.</p>

                  {/* 실시간 attempt 로그 */}
                  {state.harness && state.harness.attempts.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-border-light pt-3">
                      <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">실행 이력</div>
                      {state.harness.attempts.slice(-5).map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.success ? "bg-success" : "bg-error"}`} />
                          <span className="text-text-muted font-mono">#{a.attempt}</span>
                          <span className="text-text-secondary">{a.stage}</span>
                          {a.success && <span className="text-success">OK</span>}
                          {!a.success && a.issues[0] && (
                            <span className="text-error truncate max-w-[350px]">{a.issues[0]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 완료 요약 */}
              {state.harnessUserSummary && (state.status === "complete" || state.status === "error") && (
                <div className={`card px-5 py-3 text-xs ${state.status === "complete" ? "text-success border-success/20 bg-success/5" : "text-error border-error/20 bg-error/5"}`}>
                  {state.harnessUserSummary}
                </div>
              )}

              {/* 결과 패널들 — 도착하는 대로 부분 표시 */}
              {state.harness?.requirementSpec && (
                <RequirementSpecPanel spec={state.harness.requirementSpec} />
              )}
              {state.harness?.cps && (
                <CpsPanel cps={state.harness.cps} />
              )}
              {state.harness?.generatedPlan && (
                <GeneratedPlanPanel plan={state.harness.generatedPlan} lintIssues={state.harness.lintIssues || []} />
              )}
              {state.harness?.evaluation && (
                <PlanEvaluationPanel evaluation={state.harness.evaluation} attempts={state.harness.attempts || []} />
              )}

              {/* 이전 실행과 비교 */}
              {isHarnessMode && (state.status === "complete" || state.status === "error") &&
                state.harness?.history && state.harness.history.length > 0 && state.harness.generatedPlan && (
                <HarnessDiffPanel
                  diff={computeHarnessDiff(state.harness, state.harness.history[0])}
                  runNumber={state.harnessRunCount || 1}
                />
              )}

              {/* 하네스 후속 액션 */}
              {isHarnessMode && (state.status === "complete" || state.status === "error") && state.harness?.generatedPlan && (
                <HarnessActions
                  hasPrd={!!state.prd}
                  hasGeneratedPlan={!!state.harness?.generatedPlan}
                  harnessRunCount={state.harnessRunCount || 1}
                  onGeneratePrd={generateHarnessPrd}
                  onGenerateCommand={generateCommand}
                  onGeneratePrototype={generatePrototype}
                  onRerunHarness={rerunPlanHarness}
                />
              )}
            </div>
          )}

          {/* ========== 일반 토론 워크플로 전용 ========== */}
          {!isHarnessMode && (
            <>
          {/* 아이디어 구체화 (ideate 모드) */}
          {state.command === "ideate" && (state.status === "clarifying" || state.status === "awaiting_clarification" || state.clarifications.length > 0) && (
            <ClarificationPanel
              clarifications={state.clarifications}
              clarifyRoles={IDEATE_CLARIFY_ROLES}
              isGenerating={state.status === "clarifying"}
              currentStreamRoleId={state.status === "clarifying" ? streamRoleId : null}
              currentStreamText={state.status === "clarifying" ? streamText : ""}
              round={state.clarificationRound}
              onProceedToDebate={(answers) => submitClarificationAndDebate(answers)}
              onRequestMoreQuestions={(answers) => submitClarificationAndAskMore(answers)}
            />
          )}

          {/* 사용자 관점 토론 진행 중 표시 */}
          {state.status === "debating_user_perspective" && streamLabel && (
            <div className="card px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-role-ux animate-pulse" />
                <span className="text-sm text-role-ux animate-pulse-soft">{streamLabel}</span>
              </div>
            </div>
          )}

          {/* 토론 내용 */}
          <div className="space-y-4">
            {activeStages.map((stage) => (
              <RoundDisplay
                key={stage}
                stage={stage}
                messages={state.messages}
                confirmedRoles={state.confirmedRoles}
                currentStreamRoleId={state.currentStage === stage ? streamRoleId : null}
                currentStreamText={state.currentStage === stage ? streamText : ""}
                isCurrentStage={state.currentStage === stage && state.status === "debating"}
                engineLabel={getEngineLabel(state.debateEngine)}
              />
            ))}
          </div>

          {/* 외부 검증 스트리밍 */}
          {state.status === "verifying" && streamLabel && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border-light bg-bg-warm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-role-architect animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest text-role-architect uppercase">{streamLabel}</span>
              </div>
              <div className="px-5 py-4 ai-prose text-sm">
                {streamText ? <Markdown>{streamText}</Markdown> : (
                  <span className="text-accent animate-pulse-soft">검증 시작...</span>
                )}
              </div>
            </div>
          )}

          {/* 검증 선택 */}
          {state.status === "awaiting_verification" && (
            <VerificationPanel onChoice={handleVerificationChoice} />
          )}

          {/* 피드백 기록 */}
          {state.feedbacks.map((fb) => (
            <FeedbackEntryComponent key={fb.id} feedback={fb} />
          ))}
            </>
          )}
          {/* ========== 공통 UI (양쪽 워크플로 공유) ========== */}

          {/* 에러 */}
          {state.status === "error" && (
            <div className="card px-5 py-4 border-error/20 bg-error-bg text-sm text-error">
              <div>{state.error}</div>
              {isHarnessMode && state.error === "사용자에 의해 중단됨" && state.harness && state.harness.attempts.length > 0 && (
                <div className="text-xs text-text-muted mt-1">부분 결과가 저장되었습니다. 서버에서 이미 시작된 LLM 호출은 완료될 때까지 계속될 수 있습니다.</div>
              )}
              {state.error !== "사용자에 의해 중단됨" && (
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={retryFromError}
                    className="px-4 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-all active:scale-[0.97]"
                  >
                    이어서 계속
                  </button>
                  <button
                    onClick={resetDebate}
                    className="px-4 py-2 text-xs font-medium border border-border-light text-text-secondary rounded-lg hover:bg-bg-muted transition-all"
                  >
                    처음부터 다시
                  </button>
                  <span className="text-[10px] text-text-muted">네트워크 에러인 경우 자동으로 1회 재시도합니다</span>
                </div>
              )}
            </div>
          )}

          {/* 저장 에러 */}
          {state.saveError && (
            <div className="card px-5 py-3 border-warning/20 bg-warning-bg text-sm text-warning">
              <span>{state.saveError}</span>
            </div>
          )}

          {/* PRD/문서 생성 중 표시 */}
          {state.status === "generating_prd" && streamLabel && !state.prd && (
            <div className="card px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-role-moderator animate-pulse" />
                <span className="text-sm text-role-moderator animate-pulse-soft">{streamLabel}</span>
              </div>
            </div>
          )}

          {/* PRD/문서 */}
          <FinalPlan
            plan={state.prd}
            isGenerating={state.status === "generating_prd"}
            revisionCount={state.revisionCount}
            prdRevisions={state.prdRevisions}
            onSubmitFeedback={submitFeedbackAndRefine}
            isRefining={isWorking && state.revisionCount > 0}
            verificationResult={state.verificationResult}
            command={state.command}
            isHarnessMode={isHarnessMode}
          />

          {/* Claude Code 명령 생성 */}
          {state.prd && (state.status === "complete" || state.status === "generating_command") && (
            <CommandOutput
              command={state.generatedCommand}
              isGenerating={state.status === "generating_command"}
              onGenerate={generateCommand}
            />
          )}

          {/* UI 프로토타입 */}
          {state.prd && !skipUi && (state.status === "complete" || state.status === "generating_ui") && (
            <UiPrototype
              html={state.prototypeHtml}
              isGenerating={state.status === "generating_ui"}
              onGenerate={generatePrototype}
              onRefine={refinePrototype}
              onSkip={() => setSkipUi(true)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ===== 하네스 후속 액션 서브 컴포넌트 =====
function HarnessActions({ hasPrd, hasGeneratedPlan, harnessRunCount, onGeneratePrd, onGenerateCommand, onGeneratePrototype, onRerunHarness }: {
  hasPrd: boolean;
  hasGeneratedPlan: boolean;
  harnessRunCount: number;
  onGeneratePrd: () => void;
  onGenerateCommand: () => void;
  onGeneratePrototype: () => void;
  onRerunHarness: (revisionRequest?: string) => void;
}) {
  const [revisionInput, setRevisionInput] = useState("");
  const [showRerun, setShowRerun] = useState(false);

  return (
    <div className="card px-5 py-4 space-y-4">
      {/* 산출물 생성 */}
      <div>
        <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-2">산출물 생성</div>
        <p className="text-[10px] text-text-muted mb-2">문구나 세부 내용만 바꾸고 싶으면 아래 버튼으로 생성 후 PRD 피드백을 사용하세요.</p>
        <div className="flex flex-wrap gap-2">
          {!hasPrd && (
            <button onClick={onGeneratePrd}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 transition-all active:scale-[0.97]">
              PRD 생성
            </button>
          )}
          <button onClick={onGenerateCommand} disabled={!hasPrd && !hasGeneratedPlan}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-bg-muted text-text-primary border border-border-light hover:bg-bg-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]">
            Claude 명령 생성
          </button>
          <button onClick={onGeneratePrototype} disabled={!hasPrd && !hasGeneratedPlan}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-bg-muted text-text-primary border border-border-light hover:bg-bg-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]">
            UI 초안 생성
          </button>
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-border-light" />

      {/* 계획 구조 수정 */}
      <div>
        <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-2">계획 구조 수정</div>
        <p className="text-[10px] text-text-muted mb-2">마일스톤/태스크/우선순위/제약사항 등 계획 자체를 바꾸려면 하네스를 다시 실행하세요.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onRerunHarness()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-bg-muted text-text-primary border border-border-light hover:bg-bg-hover transition-all active:scale-[0.97]">
            동일 입력으로 재실행 {harnessRunCount > 1 && `(${harnessRunCount}회차)`}
          </button>
          <button onClick={() => setShowRerun(!showRerun)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-bg-muted text-accent border border-accent/30 hover:bg-accent/10 transition-all active:scale-[0.97]">
            수정 요청 + 재실행
          </button>
        </div>
        {showRerun && (
          <div className="mt-3 space-y-2">
            <textarea
              value={revisionInput}
              onChange={(e) => setRevisionInput(e.target.value)}
              placeholder="예: 모바일 MVP 우선으로 재정렬 / 인증 태스크를 분리 / 2주 일정 제약 반영"
              rows={2}
              className="w-full p-3 bg-bg-muted border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-sm text-text-primary placeholder-text-muted transition-all"
            />
            <button
              onClick={() => { onRerunHarness(revisionInput.trim()); setRevisionInput(""); setShowRerun(false); }}
              disabled={!revisionInput.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]">
              수정 요청 반영하여 재실행
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
