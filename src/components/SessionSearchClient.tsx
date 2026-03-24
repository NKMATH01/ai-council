"use client";

import { useState } from "react";
import Link from "next/link";
import { SessionSummary, DebateCommand } from "@/lib/types";

const MODE_LABELS: Record<string, string> = {
  debate: "/debate",
  quick: "/quick",
  deep: "/deep",
  consult: "/consult",
  extend: "/extend",
  fix: "/fix",
};

interface Props {
  initialSessions: SessionSummary[];
}

export default function SessionSearchClient({ initialSessions }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const doSearch = async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchText.trim()) params.set("q", searchText.trim());
      if (filterMode) params.set("mode", filterMode);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const url = params.toString()
        ? `/api/search?${params.toString()}`
        : "/api/sessions";

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchText("");
    setFilterMode("");
    setDateFrom("");
    setDateTo("");
    setSessions(initialSessions);
  };

  const hasFilters = searchText || filterMode || dateFrom || dateTo;

  return (
    <>
      {/* Search Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="주제, PRD 내용으로 검색..."
              className="w-full pl-10 pr-3 py-2.5 bg-bg-muted border border-border-light rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent/40 outline-none text-sm text-text-primary placeholder-text-muted transition-all"
            />
          </div>
          <button
            onClick={doSearch}
            disabled={isSearching}
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {isSearching ? "검색 중..." : "검색"}
          </button>
          {hasFilters && (
            <button
              onClick={clearSearch}
              className="px-4 py-2.5 bg-bg-muted text-text-secondary text-sm rounded-xl border border-border-light hover:bg-bg-hover transition-all"
            >
              초기화
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-widest text-text-muted uppercase">모드</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-2.5 py-1.5 bg-bg-muted border border-border-light rounded-lg text-xs text-text-primary outline-none"
            >
              <option value="">전체</option>
              <option value="debate">/debate</option>
              <option value="quick">/quick</option>
              <option value="deep">/deep</option>
              <option value="consult">/consult</option>
              <option value="extend">/extend</option>
              <option value="fix">/fix</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-widest text-text-muted uppercase">기간</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 bg-bg-muted border border-border-light rounded-lg text-xs text-text-primary outline-none"
            />
            <span className="text-text-muted text-xs">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 bg-bg-muted border border-border-light rounded-lg text-xs text-text-primary outline-none"
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      {sessions.length === 0 ? (
        <div className="card px-8 py-12 text-center">
          <p className="text-text-muted text-sm">
            {hasFilters ? "검색 결과가 없습니다." : "아직 저장된 문서가 없습니다."}
          </p>
          {!hasFilters && (
            <Link href="/" className="inline-block mt-3 text-accent text-sm font-medium hover:underline">
              첫 토론을 시작해보세요
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-warm border-b border-border-light">
                <th className="text-left px-5 py-3 text-[10px] font-bold tracking-widest text-text-muted uppercase">상태</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold tracking-widest text-text-muted uppercase">주제</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold tracking-widest text-text-muted uppercase hidden sm:table-cell">모드</th>
                <th className="text-center px-5 py-3 text-[10px] font-bold tracking-widest text-text-muted uppercase hidden md:table-cell">버전</th>
                <th className="text-center px-5 py-3 text-[10px] font-bold tracking-widest text-text-muted uppercase hidden md:table-cell">메시지</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold tracking-widest text-text-muted uppercase">최근 수정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-bg-hover transition-colors group">
                  <td className="px-5 py-3">
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${
                      s.status === "complete" ? "bg-success-bg text-success" : "bg-bg-muted text-text-muted"
                    }`}>
                      {s.status === "complete" ? "완료" : "초안"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/sessions/${s.id}`} className="block">
                      <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate max-w-xs">
                        {s.topic}
                      </div>
                      {s.prdPreview && (
                        <div className="text-[11px] text-text-muted truncate max-w-xs mt-0.5">{s.prdPreview}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className="text-xs text-accent font-medium">{MODE_LABELS[s.command || "debate"] || "-"}</span>
                  </td>
                  <td className="px-5 py-3 text-center hidden md:table-cell">
                    <span className="text-xs text-accent font-medium">v{s.revisionCount}</span>
                  </td>
                  <td className="px-5 py-3 text-center hidden md:table-cell">
                    <span className="text-xs text-text-muted">{s.messageCount}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-[11px] text-text-muted">
                      {new Date(s.updatedAt).toLocaleDateString("ko-KR", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
