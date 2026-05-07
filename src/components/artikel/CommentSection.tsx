"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageCircle, Send, CheckCircle, User } from "lucide-react";
import Turnstile from "@/components/ui/Turnstile";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string;
  isApproved: boolean;
  parentId: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "Baru saja";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} hari lalu`;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CommentSection({ articleId }: { articleId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const onCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`);
      if (res.ok) {
        const json = await res.json();
        // Only show approved comments for public view
        setComments(
          (json.data || []).filter((c: Comment) => c.isApproved)
        );
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!name.trim() || !email.trim() || !content.trim()) {
      setError("Semua kolom harus diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: name.trim(),
          authorEmail: email.trim(),
          content: content.trim(),
          captchaToken,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal mengirim komentar.");
        return;
      }

      setSuccess(true);
      setContent("");
      // Preserve name + email for convenience
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary flex items-center gap-2">
          <MessageCircle size={20} />
          Komentar
          {comments.length > 0 && (
            <span className="text-sm font-normal text-txt-muted">
              ({comments.length})
            </span>
          )}
        </h2>
      </div>

      {/* Existing comments */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-sm bg-surface-secondary p-4"
            >
              <div className="h-4 w-1/4 rounded bg-surface-tertiary" />
              <div className="mt-2 h-3 w-3/4 rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-3 mb-8">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-sm border border-border bg-surface p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User size={14} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-txt-primary">
                    {comment.authorName}
                  </span>
                  <span className="ml-2 text-xs text-txt-muted">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-txt-secondary leading-relaxed pl-10">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-txt-muted">
          Belum ada komentar. Jadilah yang pertama berkomentar!
        </p>
      )}

      {/* Comment form */}
      <div className="rounded-sm border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-sm font-bold text-txt-primary uppercase tracking-wider">
          Tulis Komentar
        </h3>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-sm bg-primary-light px-4 py-3 text-sm text-primary">
            <CheckCircle size={16} />
            Komentar Anda akan ditampilkan setelah disetujui moderator.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-sm bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-txt-secondary">
                Nama *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda"
                className="input w-full text-sm"
                required
                maxLength={100}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-txt-secondary">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contoh.com"
                className="input w-full text-sm"
                required
              />
              <p className="mt-0.5 text-[10px] text-txt-muted">
                Email tidak akan ditampilkan publik
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-txt-secondary">
              Komentar *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={(e) => {
                // Ensure the submit button stays visible when mobile keyboard opens
                setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300);
              }}
              placeholder="Tulis komentar Anda..."
              className="input w-full text-sm"
              rows={4}
              required
              maxLength={2000}
            />
            <p className="mt-0.5 text-right text-[10px] text-txt-muted">
              {content.length}/2000
            </p>
          </div>
          <Turnstile onVerify={onCaptchaVerify} onExpire={() => setCaptchaToken("")} />
          <p className="text-sm text-on-surface-variant">
            Dengan mengirim, Anda menyetujui pemrosesan data sesuai{" "}
            <Link href="/privasi" className="text-primary underline hover:text-primary-dark">
              Kebijakan Privasi
            </Link>{" "}
            Kartawarta sesuai UU PDP No. 27/2022.
          </p>
          <button
            type="submit"
            disabled={submitting || !captchaToken}
            className="btn-primary flex min-h-[44px] items-center gap-1.5 px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send size={14} />
            )}
            Kirim Komentar
          </button>
        </form>
      </div>
    </section>
  );
}
