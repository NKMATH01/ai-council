import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "ai_council_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/login" ||
    pathname === "/api/auth/login"
  ) {
    return NextResponse.next();
  }

  // 쿠키 값은 서버 전용 시크릿(AUTH_SECRET)과 일치해야 한다. 상수가 아니므로 공개 소스만으로는 위조 불가.
  // AUTH_SECRET 미설정 시 fail-closed (아무도 인증되지 않음 → 설정 강제).
  const authSecret = process.env.AUTH_SECRET;
  const isAuthed = !!authSecret && request.cookies.get(AUTH_COOKIE)?.value === authSecret;
  if (!isAuthed) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
