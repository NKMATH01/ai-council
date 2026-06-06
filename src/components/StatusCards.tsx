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
    recommending: "역할 분석 중",
    awaiting_confirmation: "역할 확인",
    clarifying: "질문 생성 중",
    awaiting_clarification: "답변 대기",
    debating: "토론 진행 중",
    debating_user_perspective: "사용자 관점 토론",
    awaiting_verification: "검증 선택",
    verifying: "외부 검증 중",
    generating_prd: "문서 생성 중",
    generating_command: "명령 생성 중",
    generating_ui: "UI 생성 중",
    generating_plan: "계획 생성 중",
    complete: "완료",
    error: "오류",
  };

  const statusColor: Record<string, string> = {
    idle: "text-text-muted",
    recommending: "text-accent",
    awaiting_confirmation: "text-warning",
    clarifying: "text-accent",
    awaiting_clarification: "text-warning",
    debating: "text-accent",
    debating_user_perspective: "text-role-ux",
    awaiting_verification: "text-warning",
    verifying: "text-role-architect",
    generating_prd: "text-role-moderator",
    generating_command: "text-role-moderator",
    generating_ui: "text-role-creative",
    generating_plan: "text-accent",
    complete: "text-success",
    error: "text-error",
  };

  const modeInfo = MODE_INFO[command as keyof typeof MODE_INFO];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard value={roleCount || "-"} label="ROLES" desc="참여 역할" />
      <MetricCard value={modeInfo?.shortLabel || command} label="MODE" desc={modeInfo?.category || "설계"} />
      <div className="card px-4 py-3.5">
        <div className={`text-base font-black ${statusColor[status] || "text-text-muted"}`}>{statusLabel[status] || status}</div>
        <div className="text-[10px] font-black tracking-normal text-accent uppercase mt-1">STATUS</div>
        <div className="text-xs text-text-muted mt-0.5">{debateEngine ? getEngineLabel(debateEngine) : "엔진 대기"}</div>
      </div>
      <Link href="/sessions" className="card px-4 py-3.5 hover:bg-bg-hover transition-colors group">
        <div className="text-2xl font-black text-text-primary">{docCount ?? "-"}</div>
        <div className="text-[10px] font-black tracking-normal text-accent uppercase mt-1">DOCUMENTS</div>
        <div className="text-xs text-text-muted mt-0.5 group-hover:text-text-secondary">저장 문서 보기</div>
      </Link>
    </div>
  );
}

function MetricCard({ value, label, desc }: { value: string | number; label: string; desc: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-2xl font-black text-text-primary">{value}</div>
      <div className="text-[10px] font-black tracking-normal text-accent uppercase mt-1">{label}</div>
      <div className="text-xs text-text-muted mt-0.5">{desc}</div>
    </div>
  );
}
