"use client";

import { useState, Suspense } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import Logo from "@/components/common/Logo";

const DEFAULT_CALLBACK_URL = "/panel/dashboard";

function getSafeCallbackUrl(raw: string | null): string {
  if (!raw) return DEFAULT_CALLBACK_URL;
  const trimmed = raw.trim();
  // Accept ONLY single-slash relative paths; reject protocol-relative (//),
  // backslash tricks (/\), control chars, and redirect loops back to /login.
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\r\n\0]/.test(trimmed)
  ) {
    return DEFAULT_CALLBACK_URL;
  }
  if (trimmed === "/login" || trimmed.startsWith("/login?") || trimmed.startsWith("/login/")) {
    return DEFAULT_CALLBACK_URL;
  }
  try {
    const dummyOrigin = "https://lensaplus.local";
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return DEFAULT_CALLBACK_URL;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [code, setCode] = useState("");

  const { data: session } = useSession();
  const searchParams = useSearchParams();
  // Accept both spellings — middleware writes "session-expired", legacy code uses underscore.
  const reason = searchParams.get("reason") || "";
  const sessionExpired = reason === "session_expired" || reason === "session-expired";
  const safeCallbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Clear existing session before new login
    if (session) {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Ignore transient network errors when clearing old session
      }
      await signOut({ redirect: false });
    }

    const result = await signIn("credentials", {
      email,
      password,
      code: needs2fa ? code : undefined,
      redirect: false,
      callbackUrl: safeCallbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "2FA_REQUIRED") {
        // Password OK — account has 2FA. Prompt for the authenticator code.
        setNeeds2fa(true);
        setError("");
        return;
      }
      setError(result.error === "CredentialsSignin" ? "Email atau password salah" : result.error);
    } else {
      // Hard redirect to clear all cached state while honoring validated callbackUrl
      window.location.href = safeCallbackUrl;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 sm:p-8 shadow-card">
        {/* Logo */}
        <div className="mb-8 text-center flex flex-col items-center justify-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-stone-500 font-medium">
            Masuk ke Panel Redaksi Lensaplus
          </p>
        </div>

        {sessionExpired && (
          <div className="mb-4 rounded-lg border border-border border-l-4 border-l-amber-500 bg-surface px-4 py-3 text-sm text-amber-800">
            Sesi Anda telah berakhir. Silakan login kembali.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-border border-l-4 border-l-red-600 bg-surface px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-txt-primary">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="nama@email.com"
                required
                aria-required="true"
                className="input pl-11"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-txt-primary">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                aria-required="true"
                className="input pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-muted transition-colors hover:text-txt-primary"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {needs2fa && (
            <div>
              <label htmlFor="totp" className="mb-1.5 block text-sm font-medium text-txt-primary">
                Kode Autentikasi (2FA)
              </label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input
                  id="totp"
                  type="text"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 12))}
                  placeholder="6 digit, atau kode cadangan"
                  autoFocus
                  className="input pl-11 tracking-widest"
                />
              </div>
              <p className="mt-1.5 text-xs text-txt-muted">
                Masukkan kode dari Google Authenticator, atau salah satu kode cadangan Anda.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (needs2fa && code.length < 6)}
            className="btn-primary w-full py-3"
          >
            {loading ? "Memproses..." : needs2fa ? "Verifikasi & Masuk" : "Masuk"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-txt-secondary">
          Hanya untuk jurnalis dan redaksi terdaftar.
          <br />
          <Link href="/kontak" className="mt-1 inline-block text-primary transition-colors hover:text-primary-dark hover:underline">
            Hubungi admin
          </Link>{" "}
          untuk registrasi akun.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
