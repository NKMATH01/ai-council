import { JudgeVerdict } from "@/lib/types";

interface JudgePanelProps {
  verdicts: JudgeVerdict[];
}

export default function JudgePanel({ verdicts }: JudgePanelProps) {
  if (verdicts.length === 0) return null;

  return (
    <section className="rounded-lg border border-border-light p-3 text-xs text-text-primary space-y-2">
      <h3 className="font-semibold text-text-primary">심판 평가</h3>
      {verdicts.map((verdict, index) => {
        const consensus = Math.min(1, Math.max(0, verdict.consensus_level || 0));
        const decisionClass = verdict.decision === "stop" ? "bg-green-600" : "bg-amber-600";

        return (
          <div key={`${verdict.round || index}-${index}`} className="rounded-lg border border-border-light p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">라운드 {verdict.round || index + 1}</span>
              <span className={`${decisionClass} text-white text-xs px-1.5 rounded`}>
                {verdict.decision}
              </span>
              {verdict.is_superficial_agreement && (
                <span className="rounded bg-warning-bg px-1.5 text-warning">피상적 동의</span>
              )}
            </div>
            <div className="text-text-secondary">합의율: {(consensus * 100).toFixed(0)}%</div>
            <p className="text-text-secondary text-xs">{verdict.reason}</p>
          </div>
        );
      })}
    </section>
  );
}
