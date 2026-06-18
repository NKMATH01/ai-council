import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // 비밀번호·쿠키 시크릿은 소스가 아니라 환경변수에서만 읽는다(공개 저장소 노출 방지).
  const sitePassword = process.env.SITE_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;
  if (!sitePassword || !authSecret) {
    return NextResponse.json({ error: "서버 인증 설정(SITE_PASSWORD/AUTH_SECRET)이 누락되었습니다." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));

  if (body?.password !== sitePassword) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("ai_council_auth", authSecret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
