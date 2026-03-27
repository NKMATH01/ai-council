"use client";
import { useState } from "react";
import { GeneratedPlan, PlanLintIssue } from "@/lib/types";

interface Props {
  plan: GeneratedPlan;
  lintIssues: PlanLintIssue[];
}

export default function GeneratedPlanPanel({ plan, lintIssues }: Props) {
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(plan.milestones[0]?.id || null);
  const errors = lintIssues.filter((i) => i.severity === "error");
  const warnings = lintIssues.filter((i) => i.severity === "warning");

  return (
    <div className="card animate-fade-in">
      <div className="card-elevated px-6 py-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-role-architect" />
            개발 계획 ({plan.tasks.length}개 태스크, {plan.milestones.length}개 마일스톤)
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            plan.estimatedComplexity === "simple" ? "bg-status-success/20 text-status-success" :
            plan.estimatedComplexity === "medium" ? "bg-status-warning/20 text-status-warning" :
            "bg-status-error/20 text-status-error"
          }`}>
            {plan.estimatedComplexity}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-1">{plan.objective}</p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Lint Issues */}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="rounded-lg border border-border-light p-3 space-y-2 bg-bg-muted">
            <h4 className="text-xs font-medium text-text-muted">린트 결과</h4>
            {errors.map((e, i) => (
              <div key={i} className="text-xs text-status-error flex items-start gap-1">
                <span>🔴</span> [{e.code}] {e.message}
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={i} className="text-xs text-status-warning flex items-start gap-1">
                <span>🟡</span> [{w.code}] {w.message}
              </div>
            ))}
          </div>
        )}

        {/* Milestones + Tasks */}
        <div className="space-y-3">
          {plan.milestones.map((ms, idx) => {
            const tasks = plan.tasks.filter((t) => t.milestoneId === ms.id);
            const isExpanded = expandedMilestone === ms.id;
            return (
              <div key={ms.id} className="border border-border-light rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedMilestone(isExpanded ? null : ms.id)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-bg-card hover:bg-bg-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">M{idx + 1}</span>
                    <span className="text-sm font-medium text-text-primary">{ms.title}</span>
                    <span className="text-xs text-text-muted">({tasks.length}개 태스크)</span>
                  </div>
                  <span className="text-text-muted text-xs">{isExpanded ? "▲" : "▼"}</span>
                </button>
                {isExpanded && (
                  <div className="px-4 py-3 space-y-2 border-t border-border-light bg-bg-muted">
                    <p className="text-xs text-text-secondary">{ms.objective}</p>
                    {tasks.map((task) => (
                      <div key={task.id} className="rounded-md border border-border-light/50 p-3 bg-bg-card">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-text-muted bg-bg-muted px-1 py-0.5 rounded">{task.id}</span>
                          <span className="text-sm font-medium text-text-primary">{task.title}</span>
                        </div>
                        <p className="text-xs text-text-secondary mb-1">{task.detail}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="text-role-backend bg-role-backend-bg px-1.5 py-0.5 rounded">{task.ownerHint}</span>
                          <span className="text-text-muted">산출물: {task.deliverable}</span>
                          {task.dependsOn.length > 0 && (
                            <span className="text-text-muted">의존: {task.dependsOn.join(", ")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Acceptance Criteria */}
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">인수 기준</h4>
          <ul className="space-y-1">
            {plan.acceptanceCriteria.map((c, i) => (
              <li key={i} className="text-sm text-text-primary flex items-start gap-2">
                <span className="text-status-success mt-0.5">☑</span> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        {plan.risks.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">위험 요소</h4>
            <ul className="space-y-1">
              {plan.risks.map((r, i) => (
                <li key={i} className="text-xs text-status-warning flex items-start gap-2">
                  <span>⚡</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
