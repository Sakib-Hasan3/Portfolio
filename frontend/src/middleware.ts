import { type NextRequest, NextResponse } from "next/server";

/**
 * Early redirect for signed-out visitors. This is a UX guard only —
 * every admin API call is authorised by FastAPI.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";
  const hasSession = req.cookies.has("admin_session");

  if (!isLogin && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname !== "/admin" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
