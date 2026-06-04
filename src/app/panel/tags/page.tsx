"use client";

/**
 * Tags Manager — EDITOR+
 * List + create + delete tags. AI research placeholder (endpoint not yet available).
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Hash,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EDITOR_ROLES } from "@/lib/roles";

interface Tag {
  id: string;
  name: string;
  slug: string;
  _count?: { articles: number };
}

export default function TagsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  // Deleting a tag is SA|CE only (matches DELETE /api/tags) — EDITOR can view
  // and create tags but must not see a delete button that just 403s.
  const isManagement = userRole === "SUPER_ADMIN" || userRole === "CHIEF_EDITOR";
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"usage" | "name">("usage");

  // AI research state
  const [topic, setTopic] = useState<string>("");
  const [researching, setResearching] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiProvider, setAiProvider] = useState<string>("");
  const [aiError, setAiError] = useState<string>("");

  if (
    sessionStatus !== "loading" &&
    session &&
    !EDITOR_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tags");
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];
        setTags(data);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  async function handleCreate() {
    if (!newName.trim() || newName.trim().length < 2) {
      showError("Nama tag minimal 2 karakter.");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal membuat tag");
      showSuccess("Tag berhasil dibuat.");
      setNewName("");
      fetchTags();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal membuat tag");
    } finally {
      setCreating(false);
    }
  }

  async function handleResearch() {
    const t = topic.trim();
    if (t.length < 2) {
      showError("Topik minimal 2 karakter.");
      return;
    }
    try {
      setResearching(true);
      setAiError("");
      setSuggestions([]);
      const res = await fetch("/api/tags/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Riset gagal");
      const list = (json.data?.suggestions || []) as string[];
      setSuggestions(list);
      setAiProvider(json.data?.provider || "");
      if (list.length === 0) {
        setAiError(
          "AI tidak mengembalikan saran yang valid. Coba topik lain.",
        );
      } else {
        showSuccess(`${list.length} saran keyword tersedia.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Riset gagal";
      setAiError(msg);
      showError(msg);
    } finally {
      setResearching(false);
    }
  }

  async function handleAddSuggestion(name: string) {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menambah tag");
      showSuccess(`Tag "${name}" ditambahkan.`);
      setSuggestions((prev) => prev.filter((s) => s !== name));
      fetchTags();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menambah tag");
    }
  }

  async function handleDelete(id: string, name: string, usage: number) {
    const ok = await confirm({
      title: "Hapus tag",
      message:
        usage > 0
          ? `Tag "${name}" dipakai oleh ${usage} artikel. Yakin ingin hapus?`
          : `Yakin ingin hapus tag "${name}"?`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/tags?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus");
      showSuccess("Tag dihapus.");
      fetchTags();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  const filtered = tags
    .filter((t) =>
      !search ? true : t.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "usage") {
        return (b._count?.articles ?? 0) - (a._count?.articles ?? 0);
      }
      return a.name.localeCompare(b.name, "id");
    });

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Hash size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Tags
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Kelola tag artikel. Total {tags.length} tag.
          </p>
        </div>
        <button
          onClick={fetchTags}
          className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Create form */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <h2 className="text-sm font-bold text-txt-primary mb-3 flex items-center gap-1.5">
          <Plus size={14} className="text-primary" /> Tambah Tag
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1 py-2 text-sm"
            placeholder="Nama tag (min 2 karakter)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Tambah
          </button>
        </div>
      </div>

      {/* AI Research */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-sm font-bold text-txt-primary mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-primary" /> AI Riset Keyword
        </h2>
        <p className="text-xs text-txt-secondary mb-3">
          Masukkan topik artikel — AI akan menyarankan 8–12 keyword SEO Bahasa Indonesia.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1 py-2 text-sm"
            placeholder="Topik (mis. RUU KUHAP, sengketa pilkada Bandung)..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleResearch();
            }}
          />
          <button
            onClick={handleResearch}
            disabled={researching}
            className="btn-secondary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {researching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {researching ? "Meriset..." : "Riset"}
          </button>
        </div>

        {aiError && (
          <p className="mt-3 text-xs text-red-600">{aiError}</p>
        )}

        {suggestions.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-txt-secondary">
                Saran ({suggestions.length}){aiProvider ? ` · via ${aiProvider}` : ""}
              </p>
              <button
                onClick={() => setSuggestions([])}
                className="text-[11px] text-txt-muted hover:text-txt-primary"
              >
                Bersihkan
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleAddSuggestion(s)}
                  className="group inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                  title={`Klik untuk menambah "${s}" sebagai tag`}
                >
                  <Plus size={10} className="opacity-70 group-hover:opacity-100" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border bg-surface-secondary px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted"
            />
            <input
              type="text"
              className="input w-full pl-9 py-2 text-sm"
              placeholder="Cari tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input text-sm py-2"
            value={sort}
            onChange={(e) => setSort(e.target.value as "usage" | "name")}
          >
            <option value="usage">Sort: Pemakaian</option>
            <option value="name">Sort: Nama</option>
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Hash size={40} className="mx-auto text-border mb-3" />
            <p className="text-sm text-txt-secondary">
              {search ? "Tidak ada tag cocok." : "Belum ada tag."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Nama
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Slug
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Artikel
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => {
                  const usage = t._count?.articles ?? 0;
                  return (
                    <tr key={t.id} className="hover:bg-surface-secondary/50">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
                          <Hash size={10} />
                          {t.name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-txt-muted font-mono">
                        {t.slug}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-txt-primary">
                        {usage.toLocaleString("id-ID")}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isManagement && (
                          <button
                            onClick={() => handleDelete(t.id, t.name, usage)}
                            className="btn-ghost rounded p-2 hover:text-red-500"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
