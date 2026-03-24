"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DebateEngineId } from "@/lib/types";
import { MODE_INFO, getEngineLabel } from "@/lib/constants";

interface StatusCardsProps {
  roleCount: number;
  status: string;
  command: string;
  debateEngine?: DebateEngineId;
}

export default function StatusCards({ roleCount, status, command, debateEngine }: StatusCardsProps) {
  const [docCount, setDocCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/sessions").then((r) => r.json()).then((d) => setDocCount(Array.isArray(d) ? d.length : 0)).catch(() => setDocCount(0));
  }, [status]);

  const statusLabel: Record<string, string> = {
    idle: "대기",
    recommending: "프로젝트 분석 중",
    awaiting_confirmation: "역할 확인 대기",
    debating: "토론 진행 중",
    awaiting_verification: "검증 선택 대기",
    verifying: "외부 검증 중",
    generating_prd: "문서 생성 중",
    generating_command: "명령문 생성 중",
    generating_ui: "UI 생성 중",
    complete: "완료",
    error: "오류",
  };

  const statusColor: Record<string, string> = {
    idle: "text-text-muted",
    recommending: "text-accent",
    awaiting_confirmation: "text-warning",
    debating: "text-accent",
    awaiting_verification: "text-warning",
    verifying: "text-role-architect",
    generating_prd: "text-role-moderator",
    generating_command: "text-role-moderator",
    generating_ui: "text-role-creative",
    complete: "text-success",
    error: "text-error",
  };

  const modeInfo = MODE_INFO[command as keyof typeof MODE_INFO];
  const modeLabel = modeInfo?.shortLabel || command;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="card px-4 py-3.5">
        <div className="text-2xl font-bold text-text-primary">{roleCount || "-"}</div>
        <div className="text-[10px] font-semibold tracking-widest text-accent uppercase mt-0.5">ROLES</div>
        <div className="text-xs text-text-muted mt-0.5">참여 역할</div>
      </div>
      <div className="card px-4 py-3.5">
        <div className="text-base font-bold text-text-primary">{modeLabel}</div>
        <div className="text-[10px] font-semibold tracking-widest text-accent uppercase mt-0.5">MODE</div>
        <div className="text-xs text-text-muted mt-0.5">{modeInfo?.category || "설계"}</div>
      </div>
      <div className="card px-4 py-3.5">
        <div className={`text-base font-bold ${statusColor[status] || "text-text-muted"}`}>{statusLabel[status] || status}</div>
        <div className="text-[10px] font-semibold tracking-widest text-accent uppercase mt-0.5">STATUS</div>
        <div className="text-xs text-text-muted mt-0.5">{debateEngine ? getEngineLabel(debateEngine) : ""}</div>
      </div>
      <Link href="/sessions" className="card px-4 py-3.5 hover:bg-bg-hover transition-colors group">
        <div className="text-2xl font-bold text-text-primary">{docCount ?? "\u2014"}</div>
        <div className="text-[10px] font-semibold tracking-widest text-accent uppercase mt-0.5">DOCUMENTS</div>
        <div className="text-xs text-text-muted mt-0.5 group-hover:text-text-secondary">저장 문서 &rarr;</div>
      </Link>
    </div>
  );
}
