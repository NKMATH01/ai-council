"use client";

import { useEffect, useState } from "react";
import { SessionSummary } from "@/lib/types";

interface SessionListProps {
  onLoad: (sessionId: string) => void;
  currentSessionId?: string;
}

export default function SessionList({ onLoad, currentSessionId }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) setSessions(await res.json());
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]);

  if (sessions.length === 0) return null;

  const current = sessions.find((s) => s.id === currentSessionId);
  const others = sessions.filter((s) => s.id !== currentSessionId);

  return (
    <div className="bg-bg-card border border-border-light rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-3 border-b border-border-light bg-bg-muted/50 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-bold tracking-wide text-text-primary uppercase">저장 문서</span>
          <span className="text-[10px] text-text-muted">{sessions.length}건</span>
        </div>
        <svg className={`w-4 h-4 text-text-muted transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="divide-y divide-border-light max-h-72 overflow-y-auto">
          {/* Current session highlight */}
          {current && (
            <div className="px-5 py-3 bg-accent-light/20 border-l-2 border-l-accent">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold tracking-widest text-accent uppercase">현재 문서</span>
                <StatusBadge status={current.status} />
              </div>
              <div className="text-sm font-medium text-text-primary truncate">{current.topic}</div>
              <SessionMeta s={current} />
              {current.prdPreview && (
                <p className="text-[11px] text-text-muted mt-1 truncate italic">{current.prdPreview}</p>
              )}
            </div>
          )}

          {/* Other sessions */}
          {others.map((s) => (
            <button
              key={s.id}
              onClick={() => onLoad(s.id)}
              className="w-full text-left px-5 py-3 hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={s.status} />
                <span className="text-[10px] text-text-muted">
                  {formatDate(s.updatedAt)}
                </span>
              </div>
              <div className="text-sm font-medium text-text-primary truncate">{s.topic}</div>
              <SessionMeta s={s} />
              {s.prdPreview && (
                <p className="text-[11px] text-text-muted mt-1 truncate italic">{s.prdPreview}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "complete") {
    return <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-success-bg text-success rounded">최종 저장</span>;
  }
  return <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-bg-muted text-text-muted rounded">초안</span>;
}

function SessionMeta({ s }: { s: SessionSummary }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] text-text-muted">v{s.revisionCount}</span>
      <span className="text-[10px] text-text-muted">{s.messageCount}개 메시지</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
