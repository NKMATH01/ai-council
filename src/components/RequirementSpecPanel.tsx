"use client";
import { RequirementSpec } from "@/lib/types";

interface Props {
  spec: RequirementSpec;
}

export default function RequirementSpecPanel({ spec }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className="card-elevated px-6 py-4 rounded-t-xl">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent" />
          요구사항 정규화 (RequirementSpec)
        </h3>
      </div>
      <div className="px-6 py-5 space-y-4">
        <Field label="사용자 의도" value={spec.userIntent} />
        <Field label="목표 산출물" value={spec.targetOutcome} />
        <ListField label="제약사항" items={spec.constraints} color="text-status-warning" />
        <ListField label="비목표 (Non-Goals)" items={spec.nonGoals} color="text-text-muted" />
        <ListField label="전제 조건" items={spec.assumptions} color="text-text-secondary" />
        {spec.missingInfo.length > 0 && (
          <ListField label="불명확 사항" items={spec.missingInfo} color="text-status-error" />
        )}
        {spec.preferredFormat.length > 0 && (
          <ListField label="선호 기술" items={spec.preferredFormat} color="text-accent" />
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <p className="text-sm text-text-primary mt-1">{value}</p>
    </div>
  );
}

function ListField({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm ${color} flex items-start gap-2`}>
            <span className="mt-1.5 w-1 h-1 rounded-full bg-current flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
