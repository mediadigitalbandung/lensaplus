import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { Role } from "@prisma/client";

// MED-AUTH1 — Explicit cookie security flags (audit remediation 2026-05-07).
// In production (HTTPS), the __Secure- prefix is added automatically so the
// browser rejects the cookie over plain HTTP.  __Host- on the CSRF token is
// the most restrictive option: no Domain attribute, path must be "/", Secure.
// In development NODE_ENV !== "production", no prefix is added so localhost
// (HTTP) still works normally.  Cookie names stay identical between envs
// except for the prefix — existing sessions in production remain valid.
const useSecureCookies = process.env.NODE_ENV === "production";

/**
 * Single-device enforcement:
 * - Enabled by default (SINGLE_DEVICE_ENFORCEMENT defaults to "true").
 * - Set SINGLE_DEVICE_ENFORCEMENT=false to bypass (e.g., staging debug).
 * - Each new login generates a new sessionId, stored in User.activeSessionId.
 * - JWT carries the sessionId and a lastValidatedAt timestamp.
 * - DB re-validation happens at most once per SESSION_REVALIDATE_INTERVAL_MS (10 min).
 *   Max staleness: 10 minutes before a forcibly-revoked session is detected.
 * - Mismatch → token marked sessionInvalid → middleware redirects to /login?reason=session-expired.
 */
const SESSION_REVALIDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function isSingleDeviceEnabled(): boolean {
  return process.env.SINGLE_DEVICE_ENFORCEMENT !== "false";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      avatar?: string | null;
      sessionId?: string;
    };
  }
  interface User {
    id: string;
    role: Role;
    avatar?: string | null;
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    avatar?: string | null;
    sessionId?: string;
    /** Unix ms — last time we queried DB for session + role validation */
    lastValidatedAt?: number;
    /** Set to true when session is invalidated (kicked by another login) */
    sessionInvalid?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  // ── Explicit cookie security flags (MED-AUTH1) ───────────────────────────
  // Declaring these explicitly makes the security posture audit-visible and
  // prevents silent regressions if NextAuth changes its defaults on upgrade.
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      // __Host- is stricter: enforces Secure + path="/" + no Domain attribute.
      name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    // pkceCodeVerifier, state, nonce — not used (Credentials-only, no OAuth).
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password diperlukan");
        }

        const emailLower = credentials.email.toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email: emailLower },
        });

        if (!user || !user.isActive) {
          throw new Error("Email atau password salah");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) {
          throw new Error("Email atau password salah");
        }

        // Generate unique session ID for this login.
        // Writing the new sessionId to DB immediately invalidates any existing
        // session on another device — their next JWT revalidation will detect
        // the mismatch and mark their token as sessionInvalid.
        const sessionId = crypto.randomUUID();
        await prisma.user.update({
          where: { id: user.id },
          data: { activeSessionId: sessionId, lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          sessionId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: populate token from authorize() return value.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.avatar = user.avatar;
        token.sessionId = user.sessionId;
        token.lastValidatedAt = Date.now();
        token.sessionInvalid = false;
        return token;
      }

      // Subsequent requests: re-validate from DB at most once per interval.
      // Always skip if token has already been marked invalid (avoid redundant queries).
      if (token.sessionInvalid) {
        return token;
      }

      const now = Date.now();
      const lastValidated = token.lastValidatedAt ?? 0;
      const needsRevalidation = now - lastValidated >= SESSION_REVALIDATE_INTERVAL_MS;

      if (!needsRevalidation) {
        // Within cache window — trust the cached values.
        return token;
      }

      // Past the cache window — hit the DB for fresh role + session check.
      if (!token.id) {
        return token;
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            name: true,
            avatar: true,
            isActive: true,
            activeSessionId: true,
          },
        });

        // Account deleted or deactivated.
        if (!dbUser || !dbUser.isActive) {
          token.sessionInvalid = true;
          return token;
        }

        // Single-device enforcement: sessionId in JWT must match DB.
        // Tokens without a sessionId (pre-feature sessions) are allowed through
        // for backward compatibility — they carry no session identifier to compare.
        if (
          isSingleDeviceEnabled() &&
          token.sessionId &&
          dbUser.activeSessionId !== token.sessionId
        ) {
          // Another device has logged in and taken over the activeSessionId.
          token.sessionInvalid = true;
          return token;
        }

        // Update cached values.
        token.role = dbUser.role;
        token.name = dbUser.name ?? token.name;
        token.avatar = dbUser.avatar ?? token.avatar;
        token.lastValidatedAt = now;
      } catch {
        // DB unreachable — fail open (don't kick user) to avoid mass logouts
        // during transient DB issues. The 10-min cache buys us resilience.
      }

      return token;
    },

    async session({ session, token }) {
      // Propagate invalid flag — middleware will redirect to login.
      if (token.sessionInvalid) {
        (session as unknown as Record<string, unknown>).sessionInvalid = true;
        return session;
      }

      session.user.id = token.id;
      session.user.role = token.role;
      session.user.avatar = token.avatar;
      session.user.sessionId = token.sessionId;
      if (token.name) session.user.name = token.name as string;

      return session;
    },

    // ── Open-redirect guard (MED-AUTH1 supplement) ────────────────────────
    // NextAuth v4 does not validate the ?callbackUrl= parameter by default,
    // which allows an attacker to craft a link like:
    //   /login?callbackUrl=https://evil.com
    // and steal credentials via phishing.  This callback enforces same-origin.
    async redirect({ url, baseUrl }) {
      // Same-origin absolute URL — allow.
      if (url.startsWith(baseUrl)) return url;
      // Relative path — resolve against baseUrl and allow.
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      // Any other origin — silently fall back to home.
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const EDITOR_ROLES: Role[] = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
];

const WRITER_ROLES: Role[] = [
  ...EDITOR_ROLES,
  "SENIOR_JOURNALIST",
  "JOURNALIST",
  "CONTRIBUTOR",
];

// Roles allowed to publish/schedule an article WITHOUT going through editorial
// review. Must match the server-side workflow in api/articles/[id]: only
// EDITOR_ROLES hit the publish branch; lower roles (incl. SENIOR_JOURNALIST)
// are confined to DRAFT/IN_REVIEW. Keep this in sync with EDITOR_ROLES.
export function canPublishDirectly(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "CHIEF_EDITOR" || role === "EDITOR";
}

export function canApproveArticles(role: Role): boolean {
  return EDITOR_ROLES.includes(role);
}

// Editors+ (SUPER_ADMIN, CHIEF_EDITOR, EDITOR) may VIEW every article — the
// panel list, a single article, and its revisions — for newsroom oversight.
// Creators (journalist/contributor) stay scoped to their own articles plus the
// ones assigned/directed to them (authorId | reviewedBy | assignedEditorId).
// VIEW-only: edit/publish/delete rights are still enforced separately by the
// article workflow, so widening visibility does not grant mutation.
export function canViewAllArticles(role: Role): boolean {
  return EDITOR_ROLES.includes(role);
}

export function canWriteArticles(role: Role): boolean {
  return WRITER_ROLES.includes(role);
}

export function canManageUsers(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canManageAds(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "CHIEF_EDITOR";
}
