"use client";

import { useState, useEffect } from "react";
import { ClarificationQA, DebateRoleId } from "@/lib/types";
import { ROLE_POOL } from "@/lib/constants";
import Markdown from "react-markdown";

interface ClarificationPanelProps {
  clarifications: ClarificationQA[];
  clarifyRoles: DebateRoleId[];
  isGenerating: boolean;
  currentStreamRoleId: DebateRoleId | null;
  currentStreamText: string;
  round: number;
  onProceedToDebate: (answers: Record<string, string>) => void;
  onRequestMoreQuestions: (answers: Record<string, string>) => void;
}

export default function ClarificationPanel({
  clarifications,
  clarifyRoles,
  isGenerating,
  currentStreamRoleId,
  currentStreamText,
  round,
  onProceedToDebate,
  onRequestMoreQuestions,
}: ClarificationPanelProps) {
  // Pre-fill answers from existing clarifications for current round
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const roleId of clarifyRoles) {
      const existing = clarifications.find(
        (c) => c.roleId === roleId && c.round === round
      );
      initial[roleId] = existing?.answers || "";
    }
    return initial;
  });

  // Sync answers when clarifications or round changes
  useEffect(() => {
    setAnswers((prev) => {
      const updated: Record<string, string> = {};
      for (const roleId of clarifyRoles) {
        const existing = clarifications.find(
          (c) => c.roleId === roleId && c.round === round
        );
        updated[roleId] = existing?.answers || prev[roleId] || "";
      }
      return updated;
    });
  }, [clarifications, clarifyRoles, round]);

  const handleAnswerChange = (roleId: DebateRoleId, value: string) => {
    setAnswers((prev) => ({ ...prev, [roleId]: value }));
  };

  // Check if all roles with questions have answers
  const rolesWithQuestions = clarifyRoles.filter((roleId) => {
    const qa = clarifications.find(
      (c) => c.roleId === roleId && c.round === round
    );
    return qa && qa.questions;
  });

  const allAnswered =
    rolesWithQuestions.length > 0 &&
    rolesWithQuestions.every((roleId) => answers[roleId]?.trim());

  const handleSubmitAndMore = () => {
    onRequestMoreQuestions(answers);
  };

  const handleSubmitAndProceed = () => {
    onProceedToDebate(answers);
  };

  return (
    <div className="animate-fade-in card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-light bg-bg-warm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              아이디어 구체화 - 전문가 질문 (라운드 {round})
            </h2>
            <p className="text-[11px] text-text-muted">
              각 전문가의 질문에 답변하여 아이디어를 더 구체화하세요
            </p>
          </div>
        </div>
      </div>

      {/* Role cards */}
      <div className="px-6 py-4 space-y-4">
        {clarifyRoles.map((roleId) => {
          const role = ROLE_POOL[roleId];
          if (!role) return null;

          const qa = clarifications.find(
            (c) => c.roleId === roleId && c.round === round
          );
          const isStreamingThis =
            isGenerating && currentStreamRoleId === roleId;
          const hasQuestions = qa && qa.questions;

          return (
            <div
              key={roleId}
              className={`card rounded-xl border-2 overflow-hidden transition-all ${
                isStreamingThis
                  ? `${role.borderColor} animate-glow`
                  : hasQuestions
                  ? role.borderColor
                  : "border-border-light"
              }`}
            >
              {/* Role header */}
              <div
                className={`px-4 py-3 border-b border-border-light ${role.badgeBg}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${role.dotColor} ${
                      isStreamingThis ? "animate-pulse" : ""
                    }`}
                  />
                  <span className="text-base">{role.emoji}</span>
                  <span className="text-sm font-semibold text-text-primary">
                    {role.koreanName}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${role.badgeBg} ${role.badgeText}`}
                  >
                    {role.name}
                  </span>
                  {isStreamingThis && (
                    <span className="ml-auto text-[10px] text-accent font-medium animate-pulse-soft">
                      질문 생성 중
                    </span>
                  )}
                </div>
              </div>

              {/* Questions area */}
              <div className="px-4 py-3">
                {hasQuestions ? (
                  <div className="ai-prose text-sm text-text-secondary leading-relaxed mb-3">
                    <Markdown>{qa.questions}</Markdown>
                  </div>
                ) : isStreamingThis && currentStreamText ? (
                  <div className="ai-prose text-sm text-text-secondary leading-relaxed mb-3">
                    <Markdown>{currentStreamText}</Markdown>
                  </div>
                ) : isStreamingThis ? (
                  <div className="flex items-center gap-1.5 py-2 mb-3">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className={`w-1.5 h-1.5 rounded-full ${role.dotColor} animate-bounce`}
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted py-2 mb-3">
                    질문 대기 중...
                  </p>
                )}

                {/* Answer textarea */}
                {(hasQuestions || (isStreamingThis && currentStreamText)) && (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">
                      답변
                    </label>
                    <textarea
                      value={answers[roleId] || ""}
                      onChange={(e) =>
                        handleAnswerChange(
                          roleId,
                          e.target.value
                        )
                      }
                      disabled={isGenerating}
                      placeholder="이 질문에 대한 답변을 입력하세요..."
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-lg bg-bg-muted border border-border-light text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="px-6 py-4 bg-bg-warm border-t border-border-light flex flex-col sm:flex-row items-center gap-3 justify-end">
        <button
          onClick={handleSubmitAndMore}
          disabled={!allAnswered || isGenerating}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold border border-border-light bg-bg-card text-text-primary hover:bg-bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          {isGenerating ? "생성 중..." : "답변 제출 \u2192 후속 질문 받기"}
        </button>
        <button
          onClick={handleSubmitAndProceed}
          disabled={!allAnswered || isGenerating}
          className="w-full sm:w-auto px-6 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-sm shadow-accent/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          {isGenerating
            ? "생성 중..."
            : "답변 제출 \u2192 개발계획 토론 시작"}
        </button>
      </div>
    </div>
  );
}
