import { NextRequest } from "next/server";
import { saveSession, listSessions, saveUiVersion } from "@/lib/session-store";
import { Session } from "@/lib/types";
import { SessionSaveSchema, SessionPatchSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";

// GET: list all sessions
export async function GET() {
  try {
    const sessions = await listSessions();
    return Response.json(sessions);
  } catch (error: any) {
    console.error("Sessions GET API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST: save/update a session
export async function POST(request: NextRequest) {
  try {
    const session = SessionSaveSchema.parse(await request.json()) as Session;
    await saveSession(session);
    return Response.json({ ok: true, id: session.id });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("Sessions POST API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: save UI version
export async function PATCH(request: NextRequest) {
  try {
    const { debateId, htmlCode, modificationRequest } = SessionPatchSchema.parse(await request.json());
    await saveUiVersion(debateId, htmlCode, modificationRequest || "");
    return Response.json({ ok: true });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("Sessions PATCH API error:", error);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
