"use client";

import { useState } from "react";
import { Recommendation, DebateRoleId } from "@/lib/types";
import { ROLE_POOL, PROJECT_TYPE_LABELS, COMPLEXITY_LABELS, MODELS } from "@/lib/constants";

interface RecommendationPanelProps {
  recommendation: Recommendation;
  onConfirm: (roles: DebateRoleId[]) => void;
  isLoading?: boolean;
}

export default function RecommendationPanel({
  recommendation,
  onConfirm,
  isLoading = false,
}: RecommendationPanelProps) {
  const [selectedRoles, setSelectedRoles] = useState<DebateRoleId[]>(
    recommendation.suggestedRoles,
  );

  const toggleRole = (roleId: DebateRoleId) => {
    const role = ROLE_POOL[roleId];
    // 필수 역할(architect, critic, moderator)은 해제 불가
    if (role.alwaysInclude) return;

    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev.filter((r) => r !== "moderator"), roleId, "moderator"],
    );
  };

  const allRoleIds = Object.keys(ROLE_POOL) as DebateRoleId[];
  const complexityInfo = COMPLEXITY_LABELS[recommendation.complexity];

  return (
    <div className="animate-fade-in card-elevated overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-light bg-bg-warm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">AI 토론 구성 추천</h2>
            <p className="text-[11px] text-text-muted">프로젝트 분석 결과를 확인하고 역할을 조정하세요</p>
          </div>
        </div>
      </div>

      {/* 프로젝트 분석 결과 */}
      <div className="px-6 py-4 border-b border-border-light">
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-muted border border-border-light">
            <span className="text-[10px] font-bold text-text-muted uppercase">유형</span>
            <span className="text-xs font-semibold text-text-primary">
              {PROJECT_TYPE_LABELS[recommendation.projectType] || recommendation.projectType}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-muted border border-border-light">
            <span className="text-[10px] font-bold text-text-muted uppercase">복잡도</span>
            <span className={`text-xs font-semibold ${complexityInfo.color}`}>
              {complexityInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-muted border border-border-light">
            <span className="text-[10px] font-bold text-text-muted uppercase">토론 AI</span>
            <span className="text-xs font-semibold text-text-primary">{MODELS.debate.label}</span>
          </div>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">{recommendation.reasoning}</p>
      </div>

      {/* 추천 역할 구성 */}
      <div className="px-6 py-4 border-b border-border-light">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold tracking-widest text-accent uppercase">추천 역할 구성</span>
          <span className="text-[10px] text-text-muted">{selectedRoles.length}명</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allRoleIds.map((roleId) => {
            const role = ROLE_POOL[roleId];
            const isSelected = selectedRoles.includes(roleId);
            const isSuggested = recommendation.suggestedRoles.includes(roleId);
            const isRequired = role.alwaysInclude;

            return (
              <button
                key={roleId}
                type="button"
                onClick={() => toggleRole(roleId)}
                disabled={isRequired}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? `${role.borderColor} ${role.badgeBg}`
                    : "border-border-light opacity-50 hover:opacity-80 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{role.emoji}</span>
                    <span className={`text-xs font-semibold ${isSelected ? role.badgeText : "text-text-primary"}`}>
                      {role.koreanName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isRequired && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">필수</span>
                    )}
                    {isSuggested && !isRequired && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-success-bg text-success font-medium">추천</span>
                    )}
                    {isSelected && (
                      <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">{role.description}</p>
                {role.condition && (
                  <p className="text-[10px] text-text-muted mt-1 italic">조건: {role.condition}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 추천 검증 AI */}
      <div className="px-6 py-4 border-b border-border-light">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold tracking-widest text-text-muted uppercase">추천 외부 검증 AI</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-muted border border-border-light">
          <span className="text-xs font-semibold text-text-primary">
            {recommendation.verificationAi === "chatgpt" ? "GPT-5.4" : "Gemini 3.1 Pro"}
          </span>
          <span className="text-[10px] text-text-muted">(토론 후 선택 가능)</span>
        </div>
      </div>

      {/* 확인 버튼 */}
      <div className="px-6 py-4 bg-bg-warm flex items-center justify-between">
        <p className="text-xs text-text-muted">이대로 진행할까요? 수정하고 싶으면 역할을 클릭해서 조정하세요.</p>
        <button
          onClick={() => onConfirm(selectedRoles)}
          disabled={isLoading || selectedRoles.length < 2}
          className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-sm shadow-accent/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          {isLoading ? "진행 중..." : "이 구성으로 토론 시작"}
        </button>
      </div>
    </div>
  );
}
