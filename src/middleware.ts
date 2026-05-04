import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /panel/* routes — require valid session
  if (pathname.startsWith("/panel")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const tok = token as Record<string, unknown>;

    // Account deactivated or single-device session superseded by another login.
    if (tok.sessionInvalid) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "session-expired");
      return NextResponse.redirect(loginUrl);
    }

    // Legacy flag kept for backward compat during transition.
    if (tok.invalid) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "session-expired");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*"],
};
