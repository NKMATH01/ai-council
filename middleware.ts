import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "ai_council_auth";
const AUTH_VALUE = "ok";

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

  const isAuthed = request.cookies.get(AUTH_COOKIE)?.value === AUTH_VALUE;
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
