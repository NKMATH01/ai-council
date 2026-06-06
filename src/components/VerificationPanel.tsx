"use client";

import { useState } from "react";
import { VerificationProvider } from "@/lib/types";
import { MODELS } from "@/lib/constants";

interface VerificationPanelProps {
  onChoice: (choice: VerificationProvider | null | "redebate", redebateTopic?: string) => void;
}

export default function VerificationPanel({ onChoice }: VerificationPanelProps) {
  const [showRedebate, setShowRedebate] = useState(false);
  const [redebateTopic, setRedebateTopic] = useState("");

  const options: {
    id: VerificationProvider | null | "redebate";
    label: string;
    description: string;
    recommended?: boolean;
  }[] = [
    {
      id: "chatgpt",
      label: `${MODELS.verification.chatgpt.label}로 검증`,
      description: "OpenAI 모델로 토론 결과의 누락, 과장, 실행 가능성을 검토합니다.",
      recommended: true,
    },
    {
      id: "gemini",
      label: `${MODELS.verification.gemini.label}로 검증`,
      description: "다른 모델 관점으로 논리와 빠진 조건을 검토합니다.",
    },
    {
      id: null,
      label: "검증 없이 문서 생성",
      description: "현재 토론 결과만 바탕으로 바로 최종 문서를 만듭니다.",
    },
    {
      id: "redebate",
      label: "특정 부분 재토론",
      description: "부족한 부분을 지정해 한 번 더 토론합니다.",
    },
  ];

  return (
    <div className="animate-fade-in card-elevated overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light bg-bg-warm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-success flex items-center justify-center text-white font-black">✓</div>
          <div>
            <h2 className="text-sm font-black text-text-primary">토론 완료 - 다음 단계를 선택하세요</h2>
            <p className="text-[11px] text-text-muted mt-0.5">외부 검증을 거치면 더 탄탄한 문서로 정리할 수 있습니다.</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 grid sm:grid-cols-2 gap-2">
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
            className={`text-left p-4 rounded-lg border transition-all hover:border-accent/40 hover:bg-accent-light ${
              opt.recommended ? "border-accent/30 bg-accent-light" : "border-border-light bg-bg-card"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-text-primary">{opt.label}</span>
              {opt.recommended && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent text-white font-bold">추천</span>}
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{opt.description}</p>
          </button>
        ))}
      </div>

      {showRedebate && (
        <div className="px-6 py-4 border-t border-border-light bg-bg-muted">
          <p className="text-xs font-semibold text-text-secondary mb-2">어떤 부분을 추가로 토론할까요?</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              value={redebateTopic}
              onChange={(e) => setRedebateTopic(e.target.value)}
              placeholder="예: 강사 배치 리스크를 더 현실적으로 검토해 주세요."
              className="flex-1 h-20 p-3 bg-bg-card border border-border-light rounded-lg resize-none focus:ring-2 focus:ring-accent/25 outline-none text-sm text-text-primary placeholder-text-muted transition-all"
            />
            <button
              onClick={() => onChoice("redebate", redebateTopic.trim())}
              disabled={!redebateTopic.trim()}
              className="sm:self-end px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-black rounded-lg transition-all disabled:opacity-30"
            >
              재토론
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
