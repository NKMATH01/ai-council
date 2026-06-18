"use client";

import { GitHubResearchBrief } from "@/lib/types";

interface Props {
  research: GitHubResearchBrief;
}

export default function GitHubResearchPanel({ research }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className="card-elevated px-6 py-4 rounded-t-xl">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-role-devops" />
          GitHub 레퍼런스 리서치
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          검색어: {research.query}
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-text-primary">{research.summary}</p>

        {research.patterns.length > 0 && (
          <ListBlock title="차용할 패턴" items={research.patterns} tone="text-accent" />
        )}
        {research.cautions.length > 0 && (
          <ListBlock title="주의점" items={research.cautions} tone="text-status-warning" />
        )}

        {research.references.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider">참고 저장소</div>
            {research.references.map((ref) => (
              <div key={ref.repository} className="rounded-lg border border-border-light bg-bg-muted p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-accent hover:underline"
                  >
                    {ref.repository}
                  </a>
                  <span className="text-[10px] text-text-muted">stars {ref.stars}</span>
                  {ref.language && <span className="text-[10px] text-text-muted">{ref.language}</span>}
                  {ref.archived && <span className="text-[10px] text-status-warning">archived</span>}
                </div>
                {ref.description && (
                  <p className="text-xs text-text-secondary mt-1">{ref.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{title}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-xs ${tone} flex items-start gap-2`}>
            <span className="mt-1.5 w-1 h-1 rounded-full bg-current flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
