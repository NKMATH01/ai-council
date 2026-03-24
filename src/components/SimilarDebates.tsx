"use client";

import { useEffect, useState, useRef } from "react";
import { SessionSummary } from "@/lib/types";

interface SimilarDebatesProps {
  topic: string;
  onReference: (prd: string) => void;
}

export default function SimilarDebates({ topic, onReference }: SimilarDebatesProps) {
  const [similar, setSimilar] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenced, setReferenced] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!topic || topic.trim().length < 4) {
      setSimilar([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topic.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          setSimilar(Array.isArray(data) ? data.slice(0, 3) : []);
        }
      } catch {
        setSimilar([]);
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [topic]);

  const handleReference = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const session = await res.json();
        if (session.prd) {
          onReference(session.prd);
          setReferenced(sessionId);
        }
      }
    } catch {
      // silent
    }
  };

  if (similar.length === 0) return null;

  return (
    <div className="animate-fade-in rounded-xl bg-accent-light/20 border border-accent/15 p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-semibold text-accent">비슷한 과거 토론이 있습니다</span>
        {loading && <span className="text-[10px] text-text-muted animate-pulse-soft">검색 중...</span>}
      </div>
      <div className="space-y-1.5">
        {similar.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-bg-card border border-border-light">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-text-primary truncate">{s.topic}</div>
              <div className="text-[10px] text-text-muted">
                {new Date(s.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                {" · "}
                {s.command ? `/${s.command}` : ""} · v{s.revisionCount}
              </div>
            </div>
            {referenced === s.id ? (
              <span className="text-[10px] text-success font-medium px-2 py-1 bg-success-bg rounded">참고 반영됨</span>
            ) : (
              <button
                onClick={() => handleReference(s.id)}
                className="text-[10px] font-medium text-accent px-2.5 py-1 bg-accent/10 hover:bg-accent/20 rounded transition-colors whitespace-nowrap"
              >
                참고하기
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
