"use client";

import { useState, Suspense } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: session } = useSession();
  const searchParams = useSearchParams();
  // Accept both spellings — middleware writes "session-expired", legacy code uses underscore.
  const reason = searchParams.get("reason") || "";
  const sessionExpired = reason === "session_expired" || reason === "session-expired";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Clear existing session before new login
    if (session) {
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut({ redirect: false });
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      // Hard redirect to clear all cached state
      window.location.href = "/panel/dashboard";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-5 sm:p-8 shadow-card">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <span className="text-lg font-bold text-white">JH</span>
          </div>
          <h1 className="text-xl font-bold text-txt-primary">
            Masuk ke Panel
          </h1>
          <p className="mt-2 text-sm text-txt-secondary">
            Kartawarta
          </p>
        </div>

        {sessionExpired && (
          <div className="mb-4 rounded-[12px] bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            Sesi Anda telah berakhir. Silakan login kembali.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-600">
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-muted transition-colors hover:text-txt-primary"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? "Memproses..." : "Masuk"}
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
