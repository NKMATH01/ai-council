import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSession } from "@/lib/session-store";
import { ROLE_POOL, STAGE_LABELS } from "@/lib/constants";
import { DebateStageId } from "@/lib/types";
import SessionDetailClient from "@/components/SessionDetailClient";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadSession(id);
  if (!session) notFound();

  const stages = Array.from(new Set(session.messages.map((m) => m.stage))) as DebateStageId[];

  const commandLabel: Record<string, string> = {
    quick: "/quick 빠른 토론",
    deep: "/deep 깊은 토론",
    debate: "/debate 기본 토론",
    consult: "/consult 전문가 의견",
    extend: "/extend 기능 추가",
    fix: "/fix 구조 수정",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/sessions" className="hover:text-text-secondary">저장 문서</Link>
        <span>/</span>
        <span className="text-text-secondary truncate max-w-xs">{session.topic}</span>
      </div>

      {/* Header */}
      <div className="card-elevated px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${
                session.status === "complete" ? "bg-success-bg text-success" : "bg-bg-muted text-text-muted"
              }`}>{session.status === "complete" ? "최종 저장" : "진행 중"}</span>
              <span className="text-[10px] text-text-muted">v{session.revisionCount}</span>
              <span className="text-[10px] text-accent font-medium">{commandLabel[session.command] || session.command}</span>
            </div>
            <h1 className="font-display text-xl font-bold text-text-primary">{session.topic}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
              <span>{session.messages.length}개 메시지</span>
              <span>최근 수정: {new Date(session.updatedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {/* 역할 표시 */}
            {session.confirmedRoles && session.confirmedRoles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {session.confirmedRoles.map((roleId) => {
                  const role = ROLE_POOL[roleId];
                  if (!role) return null;
                  return (
                    <span key={roleId} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${role.badgeBg} ${role.badgeText}`}>
                      {role.emoji} {role.koreanName}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <Link href={`/?session=${id}`}
            className="px-5 py-2.5 btn-accent text-white text-xs font-semibold rounded-lg whitespace-nowrap">
            이어서 진행
          </Link>
        </div>
      </div>

      <SessionDetailClient session={session} />

      {/* 단계별 타임라인 */}
      <div>
        <h2 className="font-display text-base font-bold text-text-primary mb-4">단계별 타임라인</h2>
        <div className="space-y-4">
          {stages.map((stage) => {
            const stageMsgs = session.messages.filter((m) => m.stage === stage);
            return (
              <div key={stage} className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-border-light bg-bg-warm flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-accent uppercase">
                    {STAGE_LABELS[stage] || stage}
                  </span>
                  <span className="text-[10px] text-text-muted">{stageMsgs.length}개 응답</span>
                </div>
                <div className="px-5 py-2 divide-y divide-border-light">
                  {stageMsgs.map((msg) => {
                    const role = ROLE_POOL[msg.roleId];
                    return (
                      <div key={msg.id} className="py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${role?.dotColor || "bg-text-muted"}`} />
                          <span className="text-base">{role?.emoji || ""}</span>
                          <span className="text-sm font-semibold text-text-primary">{role?.koreanName || msg.roleId}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${role?.badgeBg || "bg-bg-muted"} ${role?.badgeText || "text-text-muted"}`}>
                            {role?.name || ""}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed ml-3.5 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
