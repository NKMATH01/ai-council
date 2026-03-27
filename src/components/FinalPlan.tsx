"use client";

import { useState } from "react";
import { DebateCommand } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import Markdown from "react-markdown";

interface FinalPlanProps {
  plan: string;
  isGenerating: boolean;
  revisionCount: number;
  prdRevisions: string[];
  onSubmitFeedback: (feedback: string) => void;
  isRefining: boolean;
  verificationResult?: string;
  command?: DebateCommand;
  isHarnessMode?: boolean;
}

const DOC_TITLES: Record<string, string> = {
  consult: "의견 종합 보고서",
  extend: "기능 확장 계획서",
  fix: "구조 수정 계획서",
  debate: "PRD (제품 요구사항 문서)",
  quick: "PRD (제품 요구사항 문서)",
  deep: "PRD (제품 요구사항 문서)",
};

export default function FinalPlan({
  plan, isGenerating, revisionCount, prdRevisions,
  onSubmitFeedback, isRefining, verificationResult, command = "debate", isHarnessMode = false,
}: FinalPlanProps) {
  const [feedback, setFeedback] = useState("");
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  if (!plan && !isGenerating) return null;

  const displayPlan = viewingVersion !== null && prdRevisions[viewingVersion]
    ? prdRevisions[viewingVersion]
    : plan;
  const displayVersion = viewingVersion !== null ? viewingVersion + 1 : revisionCount;

  const handleCopy = () => navigator.clipboard.writeText(displayPlan);
  const handleDownload = () => {
    const blob = new Blob([displayPlan], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const docPrefix = command === "consult" ? "report" : command === "extend" ? "extend-plan" : command === "fix" ? "fix-plan" : "prd";
    a.download = `${docPrefix}-v${displayVersion}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = () => {
    if (feedback.trim()) {
      onSubmitFeedback(feedback.trim());
      setFeedback("");
      setViewingVersion(null);
    }
  };

  const isComplete = plan && !isGenerating && !isRefining;

  return (
    <div className="animate-fade-in space-y-4">
      {/* 검증 결과 (있으면) */}
      {verificationResult && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowVerification(!showVerification)}
            className="w-full px-6 py-3 border-b border-border-light bg-bg-warm flex items-center justify-between hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{"\u{1F50D}"}</span>
              <span className="text-sm font-semibold text-text-primary">외부 검증 결과</span>
            </div>
            <svg className={`w-4 h-4 text-text-muted transition-transform ${showVerification ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showVerification && (
            <div className="px-6 py-4 ai-prose text-sm max-h-[400px] overflow-y-auto">
              <Markdown>{verificationResult}</Markdown>
            </div>
          )}
        </div>
      )}

      {/* PRD */}
      <div className="card-elevated border-accent/20 overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-border-light bg-bg-warm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                {DOC_TITLES[command] || "PRD"}
                <span className="ml-2 text-xs font-normal text-accent">v{displayVersion}</span>
              </h2>
              <p className="text-[11px] text-text-muted">
                {isGenerating
                  ? `${MODELS.prd.label}로 문서 생성 중...`
                  : isRefining
                  ? "피드백 반영 중..."
                  : `${MODELS.prd.label}로 생성 완료`}
              </p>
            </div>
          </div>
          {isComplete && (
            <div className="flex gap-2">
              <button onClick={handleCopy} className="px-3.5 py-1.5 bg-bg-muted hover:bg-border-light text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-all border border-border-light">
                복사
              </button>
              <button onClick={handleDownload} className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-medium transition-all shadow-sm shadow-accent/15">
                .md 다운로드
              </button>
            </div>
          )}
        </div>

        {/* 버전 탭 */}
        {prdRevisions.length > 1 && (
          <div className="px-6 py-2 border-b border-border-light bg-bg-warm/50 flex items-center gap-1">
            <span className="text-[10px] text-text-muted mr-2 uppercase tracking-wide font-semibold">문서 버전</span>
            {prdRevisions.map((_, i) => (
              <button
                key={i}
                onClick={() => setViewingVersion(i === prdRevisions.length - 1 && viewingVersion === null ? null : i)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  (viewingVersion === i) || (viewingVersion === null && i === prdRevisions.length - 1)
                    ? "bg-accent text-white"
                    : "bg-bg-muted text-text-muted hover:text-text-secondary"
                }`}
              >
                v{i + 1}
              </button>
            ))}
          </div>
        )}

        {/* 내용 */}
        <div className="px-6 py-5 ai-prose text-sm max-h-[700px] overflow-y-auto">
          {isGenerating && !plan && (
            <div className="flex items-center gap-2 text-accent">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm animate-pulse-soft">{MODELS.prd.label}로 문서 생성 시작...</span>
            </div>
          )}
          <Markdown>{displayPlan}</Markdown>
        </div>
      </div>

      {/* 피드백 입력 */}
      {isComplete && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-md bg-accent-light flex items-center justify-center">
              <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-text-primary">피드백</h3>
            <span className="text-[11px] text-text-muted">
              {isHarnessMode
                ? "피드백을 입력하면 하네스 산출물 기반으로 PRD를 수정합니다"
                : "피드백을 입력하면 AI가 추가 토론 후 문서를 개선합니다"}
            </span>
          </div>
          <div className="flex gap-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="수정할 부분이나 추가로 고려할 사항을 입력하세요..."
              className="flex-1 h-20 p-3 bg-bg-muted border border-border-light rounded-xl resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-sm text-text-primary placeholder-text-muted transition-all"
            />
            <button
              onClick={handleSubmit}
              disabled={!feedback.trim()}
              className="self-end px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-sm shadow-accent/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              피드백 반영
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
