"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { Copy, Trash2, ShieldCheck, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Copy {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  viewCount: number;
  author: string;
  category: string;
  comments: number;
  revisions: number;
  recommendedKeep: boolean;
}
interface Group {
  key: string;
  title: string;
  copies: Copy[];
}

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-primary-light text-primary",
  DRAFT: "bg-surface-tertiary text-txt-muted",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-600",
  ARCHIVED: "bg-surface-tertiary text-txt-muted",
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Dipublikasi",
  DRAFT: "Draf",
  IN_REVIEW: "Menunggu Review",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  ARCHIVED: "Diarsipkan",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DuplikatPage() {
  const { data: session, status } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);

  const fetchDups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/articles/duplicates");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat");
      const gs: Group[] = json.data.groups || [];
      setGroups(gs);
      // Pre-select every non-keep copy for removal.
      const pre: Record<string, boolean> = {};
      for (const g of gs) for (const c of g.copies) if (!c.recommendedKeep) pre[c.id] = true;
      setSelected(pre);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal memuat duplikat");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchDups();
  }, [fetchDups]);

  // Role guard after hooks (rules-of-hooks).
  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const role = session?.user?.role as Role | undefined;
  if (!session || !(role === "SUPER_ADMIN" || role === "CHIEF_EDITOR")) {
    redirect("/panel/artikel");
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: "Hapus artikel duplikat",
      message: `Hapus permanen ${selectedIds.length} artikel duplikat yang dicentang? Salinan yang ditandai "DIPERTAHANKAN" tidak akan dihapus. Tindakan ini tidak bisa dibatalkan.`,
      variant: "danger",
    });
    if (!ok) return;

    setDeleting(true);
    let okCount = 0;
    let failCount = 0;
    // Sequential — keeps the per-article SEO/cache cleanup orderly and avoids
    // hammering the DB.
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
        if (res.ok) okCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setDeleting(false);
    if (okCount) success(`${okCount} artikel duplikat dihapus`);
    if (failCount) showError(`${failCount} artikel gagal dihapus`);
    await fetchDups();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/panel/artikel"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary"
        >
          <ArrowLeft size={15} /> Kembali ke Daftar Artikel
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-3xl">
          <Copy size={24} className="text-primary" />
          Artikel Duplikat
        </h1>
        <p className="mt-1 text-sm text-txt-secondary">
          Artikel dengan judul sama (sering muncul akibat klik terbit berulang). Salinan terbaik
          otomatis ditandai <strong>DIPERTAHANKAN</strong>; sisanya dicentang untuk dihapus — Anda
          tetap bisa mengubah pilihannya.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-card">
          <ShieldCheck size={36} className="mx-auto text-green-500" />
          <p className="mt-3 font-semibold text-txt-primary">Tidak ada artikel duplikat 🎉</p>
          <p className="mt-1 text-sm text-txt-secondary">
            Semua judul artikel unik. Bagus untuk SEO &amp; Google News.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-5 pb-24">
            {groups.map((g) => (
              <div key={g.key} className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-secondary px-4 py-3">
                  <h2 className="line-clamp-1 text-sm font-bold text-txt-primary">{g.title}</h2>
                  <span className="shrink-0 rounded-full bg-secondary-light px-2.5 py-0.5 text-xs font-semibold text-secondary">
                    {g.copies.length} salinan
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {g.copies.map((c) => (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                        c.recommendedKeep ? "bg-primary-50/40" : ""
                      }`}
                    >
                      <div className="flex w-6 shrink-0 justify-center">
                        {c.recommendedKeep ? (
                          <ShieldCheck size={18} className="text-primary" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={!!selected[c.id]}
                            onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.checked }))}
                            className="h-4 w-4 cursor-pointer accent-secondary"
                            aria-label={`Pilih untuk hapus: ${c.title}`}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] || ""}`}>
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                          {c.recommendedKeep ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                              DIPERTAHANKAN
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-secondary">akan dihapus</span>
                          )}
                          <Link
                            href={`/panel/artikel/${c.id}/edit`}
                            className="inline-flex items-center gap-1 text-xs text-txt-secondary hover:text-primary"
                          >
                            <ExternalLink size={12} /> buka
                          </Link>
                        </div>
                        <p className="mt-1 truncate text-xs text-txt-muted">
                          {c.author} · {c.category} · {c.viewCount.toLocaleString("id-ID")} views ·{" "}
                          {c.comments} komentar · dibuat {fmt(c.createdAt)} ·{" "}
                          <span className="font-mono">{c.slug}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sticky action bar */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
              <p className="text-sm text-txt-secondary">
                <strong className="text-txt-primary">{selectedIds.length}</strong> artikel dipilih untuk dihapus
              </p>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting || selectedIds.length === 0}
                className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white hover:bg-secondary-dark disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? "Menghapus..." : "Hapus Terpilih"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
