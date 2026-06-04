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

    // The Emiten + Kalender Emiten admin pages were removed from the CMS for
    // ALL roles/users. Redirect any lingering links (e.g. from the dashboard).
    // (Public /emiten and /kalender-emiten pages are NOT under /panel, so the
    // middleware matcher never touches them.)
    if (
      pathname === "/panel/emiten" ||
      pathname.startsWith("/panel/emiten/") ||
      pathname === "/panel/kalender-emiten" ||
      pathname.startsWith("/panel/kalender-emiten/")
    ) {
      return NextResponse.redirect(new URL("/panel/dashboard", request.url));
    }

    // Defense-in-depth role→path gating. The API routes remain the source of
    // truth (the JWT role can be up to ~10 min stale per the revalidate
    // interval), so this only stops low-privilege users from deep-linking into
    // admin/editor page shells. Fail OPEN if role is somehow absent — never
    // lock a valid user out of a page the API would have allowed.
    const role = (tok.role as string) || "";
    if (role) {
      const isSuper = role === "SUPER_ADMIN";
      const isMgmt = isSuper || role === "CHIEF_EDITOR";
      const isEditor = isMgmt || role === "EDITOR";

      // SUPER_ADMIN only.
      const SUPER_ONLY = [
        "/panel/pengguna",
        "/panel/pengaturan",
        "/panel/social",
        "/panel/email",
        "/panel/aktivitas",
        "/panel/ai-log",
        "/panel/auto-artikel",
        "/panel/dokumentasi",
      ];
      // SUPER_ADMIN | CHIEF_EDITOR.
      const MANAGEMENT = [
        "/panel/iklan",
        "/panel/analytics",
        "/panel/seo",
        "/panel/redaksi",
        "/panel/polling",
        "/panel/topik",
        "/panel/newsletter-subscribers",
      ];
      // SUPER_ADMIN | CHIEF_EDITOR | EDITOR.
      const EDITOR_PATHS = [
        "/panel/kategori",
        "/panel/komentar",
        "/panel/media",
        "/panel/laporan",
        "/panel/riwayat-review",
        "/panel/tags",
        "/panel/tiktok",
        "/panel/live-blogs",
        "/panel/sorotan",
        // "/panel/statistik" is open to ALL writers — creators see only their
        // OWN stats; editors+ get the extra "Editor" tab (review + team Sorotan)
        // and can switch site-wide vs personal — not gated here.
        // ("/panel/statistik-editor" was merged into /panel/statistik and now
        //  only redirects there, so it's intentionally left ungated.)
        "/panel/material-artikel",
      ];
      // Everything else under /panel (dashboard, artikel, profil,
      // sumber-berita) stays open to any authenticated writer.

      const matches = (list: string[]) =>
        list.some((p) => pathname === p || pathname.startsWith(p + "/"));

      let allowed = true;
      if (matches(SUPER_ONLY)) allowed = isSuper;
      else if (matches(MANAGEMENT)) allowed = isMgmt;
      else if (matches(EDITOR_PATHS)) allowed = isEditor;

      if (!allowed) {
        return NextResponse.redirect(new URL("/panel/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*"],
};
