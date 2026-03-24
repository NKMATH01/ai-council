"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDebate } from "@/hooks/useDebate";
import { DebateStageId, Session } from "@/lib/types";
import { STAGE_LABELS, MODE_INFO, getEngineLabel } from "@/lib/constants";
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
import Markdown from "react-markdown";

export default function DebateArena() {
  const {
    state, streamText, streamRoleId, streamLabel,
    requestRecommendation, confirmAndStart,
    startQuick, startDeep, startConsult, startExtend, startFix,
    handleVerificationChoice,
    submitFeedbackAndRefine,
    generateCommand, generatePrototype, refinePrototype,
    loadSession, stopDebate, resetDebate,
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
  const isWorking = ["recommending", "debating", "verifying", "generating_prd", "generating_command", "generating_ui"].includes(state.status);

  // 토론 시작 핸들러
  const handleSubmit = (data: TopicSubmitData) => {
    switch (data.command) {
      case "quick":
        startQuick(data);
        break;
      case "deep":
        startDeep(data);
        break;
      case "consult":
        startConsult(data);
        break;
      case "extend":
        startExtend(data);
        break;
      case "fix":
        startFix(data);
        break;
      case "debate":
      default:
        requestRecommendation(data);
        break;
    }
  };

  // 메시지가 있는 스테이지 목록
  const activeStages = Array.from(
    new Set(state.messages.map((m) => m.stage)),
  ) as DebateStageId[];

  // 진행 단계 표시
  const allStages: { id: string; label: string }[] = [
    ...(state.command === "debate" ? [{ id: "recommend", label: "추천" }] : []),
    { id: "independent", label: "독립 분석" },
    { id: "critique", label: "교차 비판" },
    { id: "final", label: "최종 정리" },
    { id: "verify", label: "검증" },
    { id: "prd", label: MODE_INFO[state.command]?.label.includes("PRD") ? "PRD" : "문서" },
  ];

  const getProgressIndex = () => {
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

          {/* 추천 분석 중 */}
          {state.status === "recommending" && (
            <div className="card px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm text-accent animate-pulse-soft">프로젝트 분석 중... ({getEngineLabel(state.debateEngine)})</span>
              </div>
            </div>
          )}

          {/* 추천 패널 */}
          {state.status === "awaiting_confirmation" && state.recommendation && (
            <RecommendationPanel
              recommendation={state.recommendation}
              onConfirm={confirmAndStart}
            />
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

          {/* 에러 */}
          {state.status === "error" && (
            <div className="card px-5 py-4 border-error/20 bg-error-bg text-sm text-error">{state.error}</div>
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
