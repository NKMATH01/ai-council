"use client";

import { useState } from "react";
import { VerificationProvider } from "@/lib/types";

interface VerificationPanelProps {
  onChoice: (choice: VerificationProvider | null | "redebate", redebateTopic?: string) => void;
}

export default function VerificationPanel({ onChoice }: VerificationPanelProps) {
  const [showRedebate, setShowRedebate] = useState(false);
  const [redebateTopic, setRedebateTopic] = useState("");

  const options: {
    id: VerificationProvider | null | "redebate";
    emoji: string;
    label: string;
    description: string;
    recommended?: boolean;
  }[] = [
    {
      id: "chatgpt",
      emoji: "\u{1F7E2}",
      label: "GPT-5.4로 검증",
      description: "OpenAI의 최신 모델로 토론 결과를 객관적으로 검증합니다",
      recommended: true,
    },
    {
      id: "gemini",
      emoji: "\u{1F535}",
      label: "Gemini 3.1 Pro로 검증",
      description: "Google의 최신 모델로 토론 결과를 검증합니다",
    },
    {
      id: null,
      emoji: "\u26A1",
      label: "검증 건너뛰고 PRD 바로 생성",
      description: "외부 검증 없이 바로 최종 PRD를 생성합니다",
    },
    {
      id: "redebate",
      emoji: "\u{1F504}",
      label: "특정 부분 재토론",
      description: "추가로 토론이 필요한 부분을 지정합니다",
    },
  ];

  return (
    <div className="animate-fade-in card-elevated overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light bg-bg-warm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-success flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">토론 완료 - 다음 단계를 선택하세요</h2>
            <p className="text-[11px] text-text-muted">외부 AI로 검증하면 더 신뢰도 높은 PRD를 생성할 수 있습니다</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-2">
        {options.map((opt) => (
          <button
            key={String(opt.id)}
            type="button"
            onClick={() => {
              if (opt.id === "redebate") {
                setShowRedebate(true);
              } else {
                onChoice(opt.id);
              }
            }}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:border-accent/40 hover:bg-accent-light/10 ${
              opt.recommended ? "border-accent/30 bg-accent-light/10" : "border-border-light"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{opt.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{opt.label}</span>
                  {opt.recommended && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">추천</span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">{opt.description}</p>
              </div>
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* 재토론 입력 */}
      {showRedebate && (
        <div className="px-6 py-4 border-t border-border-light">
          <p className="text-xs text-text-muted mb-2">어떤 부분을 추가로 토론할까요?</p>
          <div className="flex gap-2">
            <textarea
              value={redebateTopic}
              onChange={(e) => setRedebateTopic(e.target.value)}
              placeholder="재토론할 내용을 입력하세요..."
              className="flex-1 h-20 p-3 bg-bg-muted border border-border-light rounded-xl resize-none focus:ring-2 focus:ring-accent/30 outline-none text-sm text-text-primary placeholder-text-muted transition-all"
            />
            <button
              onClick={() => onChoice("redebate", redebateTopic.trim())}
              disabled={!redebateTopic.trim()}
              className="self-end px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-30"
            >
              재토론
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
