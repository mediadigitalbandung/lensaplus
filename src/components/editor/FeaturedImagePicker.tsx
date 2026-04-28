"use client";

import { useState } from "react";
import { ImageIcon, Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { PickedImage } from "./ImagePickerModal";

const ImagePickerModal = dynamic(() => import("./ImagePickerModal"), { ssr: false });

interface Props {
  /** Current featured image URL (empty string when none). */
  value: string;
  /** Setter — receives URL string. */
  onChange: (url: string) => void;
  /** Optional: receive picture metadata (caption/credit) — useful for OG/alt later. */
  onMetaChange?: (meta: { caption?: string | null; credit?: string | null }) => void;
  /** Field label, defaults to "Gambar Utama". */
  label?: string;
  /** Help text below the picker. */
  helpText?: string;
}

/**
 * Reusable Featured Image picker — preview + Pilih/Ganti button + Hapus button.
 * Wraps ImagePickerModal (upload + gallery tabs) so any article form (baru/edit)
 * can drop this in without re-implementing.
 */
export default function FeaturedImagePicker({
  value,
  onChange,
  onMetaChange,
  label = "Gambar Utama",
  helpText = "Direkomendasikan rasio 16:9, max 1200px lebar.",
}: Props) {
  const [open, setOpen] = useState(false);

  function handlePicked(payload: string | PickedImage) {
    if (typeof payload === "string") {
      onChange(payload);
    } else {
      onChange(payload.url);
      onMetaChange?.({ caption: payload.caption ?? null, credit: payload.credit ?? null });
    }
    setOpen(false);
  }

  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-txt-muted">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
            title="Hapus gambar utama"
          >
            <Trash2 size={12} />
            Hapus
          </button>
        )}
      </div>

      {value ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Gambar utama"
            className="block w-full max-h-56 rounded-[8px] object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0.3";
            }}
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-border bg-surface-secondary px-3 py-2 text-xs font-medium text-txt-secondary hover:border-primary hover:text-primary"
          >
            <Pencil size={12} />
            Ganti gambar
          </button>
          {/* Show URL truncated for debugging */}
          <p className="truncate text-[10px] text-txt-muted" title={value}>
            {value}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-[8px] border-2 border-dashed border-border bg-surface-secondary text-txt-muted transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
        >
          <ImageIcon size={28} strokeWidth={1.5} />
          <span className="text-xs font-medium">Pilih atau Upload Gambar</span>
        </button>
      )}

      <p className="mt-2 text-[10px] text-txt-muted">{helpText}</p>

      <ImagePickerModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={handlePicked}
      />
    </div>
  );
}
