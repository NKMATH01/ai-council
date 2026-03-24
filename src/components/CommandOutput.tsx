"use client";

import { useState } from "react";
import Markdown from "react-markdown";

interface CommandOutputProps {
  command: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

export default function CommandOutput({ command, isGenerating, onGenerate }: CommandOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="px-5 py-3 border-b border-border-light bg-bg-warm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-role-moderator flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-text-primary">Claude Code 명령문</h3>
        </div>
        <div className="flex gap-2">
          {!command && !isGenerating && (
            <button
              onClick={onGenerate}
              className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
            >
              명령문 생성
            </button>
          )}
          {command && (
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-bg-muted hover:bg-border-light text-text-secondary rounded-lg text-xs font-medium transition-all border border-border-light"
            >
              {copied ? "복사됨!" : "복사"}
            </button>
          )}
        </div>
      </div>

      {isGenerating && !command && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-accent">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm animate-pulse-soft">명령문 생성 중...</span>
          </div>
        </div>
      )}

      {command && (
        <div className="px-5 py-4 ai-prose text-sm max-h-[400px] overflow-y-auto">
          <Markdown>{command}</Markdown>
        </div>
      )}
    </div>
  );
}
