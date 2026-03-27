"use client";
import { CpsDocument } from "@/lib/types";

interface Props {
  cps: CpsDocument;
}

export default function CpsPanel({ cps }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className="card-elevated px-6 py-4 rounded-t-xl">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-warning" />
          CPS 분석 (Context-Problem-Solution)
        </h3>
      </div>
      <div className="px-6 py-5 space-y-5">
        <Section icon="📋" title="배경 (Context)" content={cps.context} />
        <Section icon="⚠️" title="문제 (Problem)" content={cps.problem} />
        <Section icon="💡" title="해결 방향 (Solution)" content={cps.solution} />
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">성공 기준</h4>
          <ul className="space-y-1">
            {cps.successCriteria.map((c, i) => (
              <li key={i} className="text-sm text-status-success flex items-start gap-2">
                <span className="mt-0.5">✓</span> {c}
              </li>
            ))}
          </ul>
        </div>
        {cps.risks.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">위험 요소</h4>
            <ul className="space-y-1">
              {cps.risks.map((r, i) => (
                <li key={i} className="text-sm text-status-error flex items-start gap-2">
                  <span className="mt-0.5">⚡</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, content }: { icon: string; title: string; content: string }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
        <span>{icon}</span> {title}
      </h4>
      <p className="text-sm text-text-primary leading-relaxed">{content}</p>
    </div>
  );
}
