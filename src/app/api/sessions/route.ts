import { NextRequest } from "next/server";
import { saveSession, listSessions, saveUiVersion } from "@/lib/session-store";
import { Session } from "@/lib/types";

export const runtime = "nodejs";

// GET: list all sessions
export async function GET() {
  try {
    const sessions = await listSessions();
    return Response.json(sessions);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST: save/update a session
export async function POST(request: NextRequest) {
  try {
    const session: Session = await request.json();
    await saveSession(session);
    return Response.json({ ok: true, id: session.id });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: save UI version
export async function PATCH(request: NextRequest) {
  try {
    const { debateId, htmlCode, modificationRequest } = await request.json();
    await saveUiVersion(debateId, htmlCode, modificationRequest || "");
    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
