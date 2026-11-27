import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionMatches } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/status") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/ingest")
  ) {
    return NextResponse.next();
  }
  const ok = await sessionMatches(pin, request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
