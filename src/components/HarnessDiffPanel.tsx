"use client";

import { HarnessDiff } from "@/lib/harness-diff";

interface Props {
  diff: HarnessDiff;
  runNumber: number;
}

export default function HarnessDiffPanel({ diff, runNumber }: Props) {
  const hasChanges =
    diff.milestonesAdded.length > 0 ||
    diff.milestonesRemoved.length > 0 ||
    diff.milestonesRenamed.length > 0 ||
    diff.tasksAdded > 0 ||
    diff.tasksRemoved > 0 ||
    diff.executionOrderChanged ||
    diff.scoreChange !== null;

  if (!hasChanges) return null;

  return (
    <div className="card animate-fade-in px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-md bg-accent-light flex items-center justify-center text-[10px] text-accent font-bold">{runNumber}</span>
        <span className="text-xs font-semibold text-text-primary">실행 #{runNumber} vs #{runNumber - 1} 비교</span>
        {diff.previousRevisionRequest && (
          <span className="text-[10px] text-text-muted truncate max-w-[300px]">요청: {diff.previousRevisionRequest}</span>
        )}
      </div>

      <div className="space-y-2 text-xs">
        {/* 평가 점수 변화 */}
        {diff.scoreChange !== null && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-16">평가 점수</span>
            <span className="text-text-secondary">{diff.scoreBefore}점</span>
            <span className="text-text-muted">&rarr;</span>
            <span className={diff.scoreChange > 0 ? "text-success" : diff.scoreChange < 0 ? "text-error" : "text-text-secondary"}>
              {diff.scoreAfter}점 ({diff.scoreChange > 0 ? "+" : ""}{diff.scoreChange})
            </span>
            {diff.passedBefore !== diff.passedAfter && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${diff.passedAfter ? "bg-success/15 text-success" : "bg-error/15 text-error"}`}>
                {diff.passedAfter ? "통과" : "미통과"}
              </span>
            )}
          </div>
        )}

        {/* 마일스톤 변화 */}
        {(diff.milestonesAdded.length > 0 || diff.milestonesRemoved.length > 0 || diff.milestonesRenamed.length > 0) && (
          <div className="flex items-start gap-2">
            <span className="text-text-muted w-16 flex-shrink-0">마일스톤</span>
            <div className="space-y-0.5">
              {diff.milestonesAdded.map((m, i) => (
                <div key={`a${i}`} className="text-success">+ {m}</div>
              ))}
              {diff.milestonesRemoved.map((m, i) => (
                <div key={`r${i}`} className="text-error">- {m}</div>
              ))}
              {diff.milestonesRenamed.map((m, i) => (
                <div key={`n${i}`} className="text-warning">{m.id}: {m.from} &rarr; {m.to}</div>
              ))}
            </div>
          </div>
        )}

        {/* 태스크 변화 */}
        {(diff.tasksAdded > 0 || diff.tasksRemoved > 0) && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-16">태스크</span>
            <span className="text-text-secondary">{diff.taskCountBefore}개</span>
            <span className="text-text-muted">&rarr;</span>
            <span className="text-text-secondary">{diff.taskCountAfter}개</span>
            {diff.tasksAdded > 0 && <span className="text-success">+{diff.tasksAdded}</span>}
            {diff.tasksRemoved > 0 && <span className="text-error">-{diff.tasksRemoved}</span>}
          </div>
        )}

        {/* 실행 순서 변화 */}
        {diff.executionOrderChanged && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-16">실행 순서</span>
            <span className="text-warning">변경됨</span>
          </div>
        )}

        {/* 경고 변화 */}
        {diff.warningsBefore !== diff.warningsAfter && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-16">경고</span>
            <span className="text-text-secondary">{diff.warningsBefore}개</span>
            <span className="text-text-muted">&rarr;</span>
            <span className={diff.warningsAfter < diff.warningsBefore ? "text-success" : "text-error"}>
              {diff.warningsAfter}개
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
