"use client";
import { PlanEvaluation, PlanAttempt } from "@/lib/types";

interface Props {
  evaluation: PlanEvaluation;
  attempts: PlanAttempt[];
}

export default function PlanEvaluationPanel({ evaluation, attempts }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className={`px-6 py-4 rounded-t-xl ${evaluation.passed ? "bg-status-success/10 border-b border-status-success/20" : "bg-status-error/10 border-b border-status-error/20"}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${evaluation.passed ? "bg-status-success" : "bg-status-error"}`} />
            계획 평가 ({evaluation.passed ? "통과" : "미통과"})
          </h3>
          <span className={`text-lg font-bold ${evaluation.score >= 70 ? "text-status-success" : "text-status-error"}`}>
            {evaluation.score}점
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Score Bars */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreBar label="요구사항 반영률" value={evaluation.requirementCoverage} />
          <ScoreBar label="CPS 정합성" value={evaluation.cpsAlignment} />
          <ScoreBar label="실행 가능성" value={evaluation.feasibility} />
          <ScoreBar label="환각 위험" value={evaluation.hallucinationRisk} inverted />
          <ScoreBar label="누락 작업 위험" value={evaluation.missingWorkRisk} inverted />
        </div>

        {/* Reasons */}
        {evaluation.reasons.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">평가 근거</h4>
            <ul className="space-y-1">
              {evaluation.reasons.map((r, i) => (
                <li key={i} className="text-xs text-text-secondary">• {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {evaluation.warnings.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">경고</h4>
            {evaluation.warnings.map((w, i) => (
              <p key={i} className="text-xs text-status-warning">⚠ {w}</p>
            ))}
          </div>
        )}

        {/* Suggested Fixes */}
        {evaluation.suggestedFixes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">개선 제안</h4>
            <ul className="space-y-1">
              {evaluation.suggestedFixes.map((f, i) => (
                <li key={i} className="text-xs text-accent">→ {f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Model info */}
        {attempts.length > 0 && (() => {
          const genModels = new Set(attempts.filter((a) => a.stage !== "evaluate" && a.model).map((a) => a.model));
          const evalModels = new Set(attempts.filter((a) => a.stage === "evaluate" && a.model).map((a) => a.model));
          return (genModels.size > 0 || evalModels.size > 0) ? (
            <div className="flex flex-wrap gap-3 text-[10px] text-text-muted">
              {genModels.size > 0 && <span>생성: {[...genModels].join(", ")}</span>}
              {evalModels.size > 0 && <span>평가: {[...evalModels].join(", ")}</span>}
            </div>
          ) : null;
        })()}

        {/* Attempts History */}
        {attempts.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              실행 이력 ({attempts.length}회)
            </h4>
            <div className="space-y-1">
              {attempts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${a.success ? "bg-status-success" : "bg-status-error"}`} />
                  <span className="text-text-muted font-mono">#{a.attempt}</span>
                  <span className="text-text-secondary">{a.stage}</span>
                  {a.model && <span className="text-text-muted">({a.model})</span>}
                  {!a.success && a.issues.length > 0 && (
                    <span className="text-status-error truncate max-w-[300px]">{a.issues[0]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, inverted }: { label: string; value: number; inverted?: boolean }) {
  const isGood = inverted ? value <= 30 : value >= 70;
  const isMid = inverted ? value <= 50 : value >= 50;
  const color = isGood ? "bg-status-success" : isMid ? "bg-status-warning" : "bg-status-error";
  const textColor = isGood ? "text-status-success" : isMid ? "text-status-warning" : "text-status-error";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className={textColor}>{value}%</span>
      </div>
      <div className="h-1.5 bg-bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
