"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { Session } from "@/lib/types";

const DOC_TITLES: Record<string, string> = {
  consult: "의견 종합 보고서",
  extend: "기능 확장 계획서",
  fix: "구조 수정 계획서",
  debate: "PRD (제품 요구사항 문서)",
  quick: "PRD (제품 요구사항 문서)",
  deep: "PRD (제품 요구사항 문서)",
};

export default function SessionDetailClient({ session }: { session: Session }) {
  const [viewingVersion, setViewingVersion] = useState(session.prdRevisions.length - 1);

  const displayPlan = session.prdRevisions[viewingVersion] || session.prd;
  const displayVersion = viewingVersion + 1;

  const handleCopy = () => navigator.clipboard.writeText(displayPlan);

  const handleDownloadMd = () => {
    const blob = new Blob([displayPlan], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const docPrefix = session.command === "consult" ? "report" : session.command === "extend" ? "extend-plan" : session.command === "fix" ? "fix-plan" : "prd";
    a.download = `${docPrefix}-v${displayVersion}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session.prd && session.prdRevisions.length === 0) return null;

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-light bg-bg-warm flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-text-primary">{DOC_TITLES[session.command] || "PRD"}</h2>
          <p className="text-[11px] text-text-muted mt-0.5">v{displayVersion} / {session.prdRevisions.length}개 버전</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="px-3 py-1.5 bg-bg-muted hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-medium border border-border-light transition-all">
            복사
          </button>
          <button onClick={handleDownloadMd} className="px-3 py-1.5 bg-bg-muted hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-medium border border-border-light transition-all">
            .md
          </button>
          <button onClick={handleDownloadJson} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/15 text-accent rounded-lg text-xs font-medium transition-all">
            .json 전체
          </button>
        </div>
      </div>

      {/* Version tabs */}
      {session.prdRevisions.length > 1 && (
        <div className="px-6 py-2 border-b border-border-light bg-bg-warm/50 flex items-center gap-1">
          <span className="text-[10px] text-text-muted mr-2 uppercase tracking-wide font-semibold">문서 버전</span>
          {session.prdRevisions.map((_, i) => (
            <button
              key={i}
              onClick={() => setViewingVersion(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewingVersion === i
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-text-muted hover:text-text-secondary"
              }`}
            >
              v{i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-5 ai-prose text-sm max-h-[600px] overflow-y-auto">
        <Markdown>{displayPlan}</Markdown>
      </div>

      {/* Generated Command */}
      {session.generatedCommand && (
        <div className="px-6 py-4 border-t border-border-light">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text-primary">Claude Code 명령문</h3>
            <button
              onClick={() => navigator.clipboard.writeText(session.generatedCommand!)}
              className="px-3 py-1.5 bg-bg-muted hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-medium border border-border-light transition-all"
            >
              복사
            </button>
          </div>
          <div className="ai-prose text-sm bg-bg-warm rounded-lg p-4 max-h-[300px] overflow-y-auto">
            <Markdown>{session.generatedCommand}</Markdown>
          </div>
        </div>
      )}

      {/* Prototype HTML */}
      {session.prototypeHtml && (
        <div className="px-6 py-4 border-t border-border-light">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text-primary">UI 프로토타입</h3>
            <button
              onClick={() => navigator.clipboard.writeText(session.prototypeHtml!)}
              className="px-3 py-1.5 bg-bg-muted hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-medium border border-border-light transition-all"
            >
              HTML 복사
            </button>
          </div>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <iframe
              srcDoc={session.prototypeHtml}
              className="w-full h-[400px]"
              sandbox="allow-scripts"
              title="UI Prototype Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
