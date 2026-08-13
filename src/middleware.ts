import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Server-side gate for the admin panel. Runs before every /admin/* request.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  // The login page is public; bounce already-authenticated users onward.
  if (pathname === "/admin/login") {
    if (session) {
      return NextResponse.redirect(new URL("/admin/registrations", req.url));
    }
    return NextResponse.next();
  }

  // Everything else under /admin requires a valid session.
  if (!session) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
