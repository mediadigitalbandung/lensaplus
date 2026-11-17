"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  AI_PROVIDERS,
  getProviderStatus,
  type AiProviderSlug,
} from "./AiProviderMeta";
import type { SettingsMap } from "@/components/panel/settings/SettingsControls";

export function AiSettingsShell({
  activeSlug,
  title,
  description,
  settings,
  dirty,
  loaded,
  children,
}: {
  activeSlug: AiProviderSlug | "overview";
  title: string;
  description: string;
  settings: SettingsMap;
  dirty?: boolean;
  loaded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Breadcrumb back to main Settings */}
      <div className="mb-4">
        <Link
          href="/panel/pengaturan?tab=ai"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
        >
          <ArrowLeft size={14} />
          Kembali ke Pengaturan
        </Link>
      </div>

      {/* Editorial header */}
      <div className="mb-5 border-l-4 border-primary pl-4">
        <h1 className="font-serif text-xl sm:text-3xl font-bold text-txt-primary">
          {title}
        </h1>
        <p className="mt-1 text-sm text-txt-secondary">{description}</p>
      </div>

      {/* Horizontal AI provider navigation */}
      <nav
        aria-label="Navigasi penyedia AI"
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
      >
        <Link
          href="/panel/pengaturan/ai"
          className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
            activeSlug === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-txt-secondary hover:text-txt-primary"
          }`}
        >
          Ringkasan &amp; Routing
        </Link>
        {AI_PROVIDERS.map((p) => {
          const isActive = activeSlug === p.slug;
          const st = loaded ? getProviderStatus(p, settings) : null;
          return (
            <Link
              key={p.slug}
              href={p.href}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-txt-secondary hover:text-txt-primary"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    st?.configured ? "bg-emerald-600" : "bg-stone-300"
                  }`}
                  title={st?.label}
                />
                {p.name}
                {isActive && dirty && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber-500"
                    title="Ada perubahan belum disimpan"
                  />
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {!loaded ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </div>
  );
}
