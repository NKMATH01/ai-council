import { NextRequest } from "next/server";
import { loadSession, deleteSession } from "@/lib/session-store";

export const runtime = "nodejs";

// GET: load a specific session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await loadSession(id);
    if (!session) {
      return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json(session);
  } catch (error: any) {
    console.error("Sessions GET API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// DELETE: remove a session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteSession(id);
    if (!deleted) {
      return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error: any) {
    console.error("Sessions DELETE API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
