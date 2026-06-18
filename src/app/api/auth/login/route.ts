import { NextRequest, NextResponse } from "next/server";

const PASSWORD = "7102";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (body?.password !== PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("ai_council_auth", "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
