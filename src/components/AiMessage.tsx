"use client";

import { DebateRoleId } from "@/lib/types";
import { ROLE_POOL, MODELS } from "@/lib/constants";
import Markdown from "react-markdown";

interface AiMessageProps {
  roleId: DebateRoleId;
  content: string;
  isStreaming?: boolean;
  engineLabel?: string;
}

export default function AiMessage({ roleId, content, isStreaming = false, engineLabel }: AiMessageProps) {
  const role = ROLE_POOL[roleId];

  return (
    <div className={`animate-slide-in border-l-2 ${isStreaming ? "border-l-accent animate-glow" : "border-l-border"} pl-4 py-3 transition-all`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${role.dotColor} ${isStreaming ? "animate-pulse" : ""}`} />
        <span className="text-base">{role.emoji}</span>
        <span className="text-sm font-semibold text-text-primary">{role.koreanName}</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${role.badgeBg} ${role.badgeText}`}>
          {role.name}
        </span>
        <span className="text-[10px] text-text-muted">{engineLabel || MODELS.debate.label}</span>
        {isStreaming && <span className="ml-auto text-[10px] text-accent font-medium animate-pulse-soft">응답 수신 중</span>}
      </div>
      <div className="ai-prose text-sm ml-4">
        {content ? <Markdown>{content}</Markdown> : isStreaming ? (
          <div className="flex items-center gap-1.5 py-2">
            {[0, 150, 300].map((d) => (
              <span key={d} className={`w-1.5 h-1.5 rounded-full ${role.dotColor} animate-bounce`} style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
