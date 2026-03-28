"use client";

import { useState, useEffect } from "react";
import { ClarificationQA, DebateRoleId, ParsedQuestion } from "@/lib/types";
import { ROLE_POOL } from "@/lib/constants";
import { parseQuestions } from "@/lib/parse-questions";
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

// 역할별 답변 상태: 각 질문별 선택 + 기타 텍스트
interface RoleAnswerState {
  selections: Record<number, string>; // questionIndex -> selected option or typed text
  etcText: string;                     // 기타 자유 입력
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
  const [answerStates, setAnswerStates] = useState<Record<string, RoleAnswerState>>({});

  // Initialize answer states when clarifications change
  useEffect(() => {
    setAnswerStates((prev) => {
      const updated: Record<string, RoleAnswerState> = {};
      for (const roleId of clarifyRoles) {
        updated[roleId] = prev[roleId] || { selections: {}, etcText: "" };
      }
      return updated;
    });
  }, [clarifyRoles, round]);

  const updateSelection = (roleId: string, qIndex: number, value: string) => {
    setAnswerStates((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        selections: { ...prev[roleId]?.selections, [qIndex]: value },
      },
    }));
  };

  const updateEtcText = (roleId: string, value: string) => {
    setAnswerStates((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], etcText: value },
    }));
  };

  // 구조화된 답변을 하나의 문자열로 합성 (downstream 호환)
  const buildAnswerString = (roleId: string, pqs: ParsedQuestion[]): string => {
    const state = answerStates[roleId];
    if (!state) return "";

    const parts: string[] = [];
    for (const q of pqs) {
      const sel = state.selections[q.index];
      if (sel) {
        parts.push(`${q.index}. ${sel}`);
      }
    }
    if (state.etcText.trim()) {
      parts.push(`기타: ${state.etcText.trim()}`);
    }
    return parts.join("\n");
  };

  // Check all required questions answered
  const getQuestions = (roleId: DebateRoleId): ParsedQuestion[] => {
    const qa = clarifications.find((c) => c.roleId === roleId && c.round === round);
    return qa?.parsedQuestions ?? (qa?.questions ? parseQuestions(qa.questions) : []);
  };

  const rolesWithQuestions = clarifyRoles.filter((roleId) => {
    const qa = clarifications.find((c) => c.roleId === roleId && c.round === round);
    return qa && qa.questions;
  });

  const allAnswered =
    rolesWithQuestions.length > 0 &&
    rolesWithQuestions.every((roleId) => {
      const pqs = getQuestions(roleId);
      const state = answerStates[roleId];
      if (!state) return false;
      // 모든 질문에 답변이 있어야 함
      return pqs.every((q) => state.selections[q.index]?.trim());
    });

  const handleSubmitAndMore = () => {
    const answers: Record<string, string> = {};
    for (const roleId of rolesWithQuestions) {
      answers[roleId] = buildAnswerString(roleId, getQuestions(roleId));
    }
    onRequestMoreQuestions(answers);
  };

  const handleSubmitAndProceed = () => {
    const answers: Record<string, string> = {};
    for (const roleId of rolesWithQuestions) {
      answers[roleId] = buildAnswerString(roleId, getQuestions(roleId));
    }
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
          const parsedQs = getQuestions(roleId);
          const state = answerStates[roleId] || { selections: {}, etcText: "" };

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

              {/* Questions + Answers area */}
              <div className="px-4 py-3">
                {/* Streaming indicator */}
                {!hasQuestions && isStreamingThis && currentStreamText && (
                  <div className="ai-prose text-sm text-text-secondary leading-relaxed mb-3">
                    <Markdown>{currentStreamText}</Markdown>
                  </div>
                )}
                {!hasQuestions && isStreamingThis && !currentStreamText && (
                  <div className="flex items-center gap-1.5 py-2 mb-3">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className={`w-1.5 h-1.5 rounded-full ${role.dotColor} animate-bounce`}
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                )}
                {!hasQuestions && !isStreamingThis && (
                  <p className="text-xs text-text-muted py-2 mb-3">
                    질문 대기 중...
                  </p>
                )}

                {/* Parsed questions with interactive answers */}
                {hasQuestions && parsedQs.length > 0 && (
                  <div className="space-y-4">
                    {parsedQs.map((q) => (
                      <QuestionItem
                        key={q.index}
                        question={q}
                        value={state.selections[q.index] || ""}
                        disabled={isGenerating}
                        onChange={(val) => updateSelection(roleId, q.index, val)}
                      />
                    ))}

                    {/* 기타 - 추가 의견 */}
                    <div className="mt-4 pt-3 border-t border-border-light">
                      <label className="block text-xs font-semibold text-text-muted mb-1.5">
                        기타 - 추가로 전달하고 싶은 내용
                      </label>
                      <textarea
                        value={state.etcText}
                        onChange={(e) => updateEtcText(roleId, e.target.value)}
                        disabled={isGenerating}
                        placeholder="위 질문 외에 추가로 알려주고 싶은 사항이 있으면 자유롭게 작성하세요..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-bg-muted border border-border-light text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                {/* Fallback: 파싱 실패 시 원본 마크다운 + 기존 textarea */}
                {hasQuestions && parsedQs.length === 0 && (
                  <>
                    <div className="ai-prose text-sm text-text-secondary leading-relaxed mb-3">
                      <Markdown>{qa.questions}</Markdown>
                    </div>
                    <textarea
                      value={state.selections[0] || ""}
                      onChange={(e) => updateSelection(roleId, 0, e.target.value)}
                      disabled={isGenerating}
                      placeholder="이 질문에 대한 답변을 입력하세요..."
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-lg bg-bg-muted border border-border-light text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </>
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

// ─── 개별 질문 컴포넌트 ───────────────────────────────

function QuestionItem({
  question,
  value,
  disabled,
  onChange,
}: {
  question: ParsedQuestion;
  value: string;
  disabled: boolean;
  onChange: (val: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleOptionSelect = (option: string) => {
    setShowCustom(false);
    setCustomText("");
    onChange(option);
  };

  const handleCustomSelect = () => {
    setShowCustom(true);
    onChange(customText);
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    onChange(text);
  };

  if (question.type === "choice" && question.options) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs font-bold text-accent mt-0.5 shrink-0">
            Q{question.index}
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary leading-snug">
              {question.text}
            </p>
            {question.reason && (
              <p className="text-[11px] text-text-muted mt-0.5">
                {question.reason}
              </p>
            )}
          </div>
        </div>
        <div className="ml-6 grid gap-1.5">
          {question.options.map((opt, i) => {
            const isSelected = value === opt && !showCustom;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => handleOptionSelect(opt)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                  isSelected
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border-light bg-bg-card text-text-secondary hover:border-accent/40 hover:bg-accent/5"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="font-semibold mr-1.5 text-[11px] opacity-60">
                  {String.fromCharCode(97 + i)})
                </span>
                {opt}
              </button>
            );
          })}
          {/* 직접 입력 옵션 */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleCustomSelect}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
              showCustom
                ? "border-accent bg-accent/10 text-accent font-medium"
                : "border-border-light bg-bg-card text-text-secondary hover:border-accent/40 hover:bg-accent/5"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="font-semibold mr-1.5 text-[11px] opacity-60">
              ✎
            </span>
            직접 입력
          </button>
          {showCustom && (
            <input
              type="text"
              value={customText}
              onChange={(e) => handleCustomChange(e.target.value)}
              disabled={disabled}
              autoFocus
              placeholder="답변을 직접 입력하세요..."
              className="ml-0 px-3 py-2 rounded-lg bg-bg-muted border border-accent text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
            />
          )}
        </div>
      </div>
    );
  }

  // 주관식
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-accent mt-0.5 shrink-0">
          Q{question.index}
        </span>
        <div>
          <p className="text-sm font-medium text-text-primary leading-snug">
            {question.text}
          </p>
          {question.reason && (
            <p className="text-[11px] text-text-muted mt-0.5">
              {question.reason}
            </p>
          )}
        </div>
      </div>
      <div className="ml-6">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="답변을 입력하세요..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-bg-muted border border-border-light text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
