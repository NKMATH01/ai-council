"use client";

import { DebateMessage, DebateRoleId, DebateStageId } from "@/lib/types";
import { STAGE_LABELS, getDebateOrder } from "@/lib/constants";
import AiMessage from "./AiMessage";

interface RoundDisplayProps {
  stage: DebateStageId;
  messages: DebateMessage[];
  confirmedRoles: DebateRoleId[];
  currentStreamRoleId: DebateRoleId | null;
  currentStreamText: string;
  isCurrentStage: boolean;
  engineLabel?: string;
}

export default function RoundDisplay({
  stage, messages, confirmedRoles,
  currentStreamRoleId, currentStreamText,
  isCurrentStage, engineLabel,
}: RoundDisplayProps) {
  const stageMessages = messages.filter((m) => m.stage === stage);
  const stageLabel = STAGE_LABELS[stage] || stage;

  // 역할 순서 (중재자 마지막)
  const orderedRoles = stage === "final"
    ? confirmedRoles.filter((r) => r === "moderator")
    : getDebateOrder(confirmedRoles).filter((r) => r !== "moderator");

  const totalRoles = orderedRoles.length;
  const doneCount = stageMessages.length;

  return (
    <div className="animate-fade-in card overflow-hidden">
      <div className="px-5 py-3 border-b border-border-light bg-bg-warm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest text-accent uppercase">{stageLabel}</span>
          {stage === "independent" && <span className="text-[10px] text-text-muted">(독립 - 역할 간 답변 미공유)</span>}
          {stage === "final" && <span className="text-[10px] text-text-muted">(중재자 종합)</span>}
        </div>
        <span className="text-[10px] text-text-muted">{doneCount}/{totalRoles} 완료</span>
      </div>

      <div className="px-5 py-2 divide-y divide-border-light">
        {orderedRoles.map((roleId) => {
          const msg = stageMessages.find((m) => m.roleId === roleId);
          const isStreaming = isCurrentStage && currentStreamRoleId === roleId;
          if (!msg && !isStreaming) return null;
          return (
            <AiMessage
              key={`${stage}-${roleId}`}
              roleId={roleId}
              content={isStreaming ? currentStreamText : msg?.content || ""}
              isStreaming={isStreaming}
              engineLabel={engineLabel}
            />
          );
        })}
      </div>
    </div>
  );
}
