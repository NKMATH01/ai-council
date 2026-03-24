import Link from "next/link";
import { listSessions } from "@/lib/session-store";
import SessionSearchClient from "@/components/SessionSearchClient";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await listSessions();

  const completeCount = sessions.filter((s) => s.status === "complete").length;
  const draftCount = sessions.length - completeCount;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">저장 문서</h1>
          <p className="text-sm text-text-muted mt-1">토론 세션과 문서를 관리합니다</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-accent/90">
          새 토론 시작
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xl font-bold text-text-primary">{sessions.length}</div>
          <div className="text-[10px] font-semibold tracking-widest text-accent uppercase">전체</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xl font-bold text-success">{completeCount}</div>
          <div className="text-[10px] font-semibold tracking-widest text-success uppercase">완료</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xl font-bold text-text-muted">{draftCount}</div>
          <div className="text-[10px] font-semibold tracking-widest text-text-muted uppercase">초안</div>
        </div>
      </div>

      {/* Search + Results (client component) */}
      <SessionSearchClient initialSessions={sessions} />
    </div>
  );
}
