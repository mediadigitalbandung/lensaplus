/**
 * Public press-card verification page (behind the card QR).
 * /verifikasi/[number] — shows whether a KTA is genuine + its current status.
 * No login required. Reveals only name + role + validity (no contact PII).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { roleLabelsMap } from "@/lib/roles";
import { effectiveStatus, STATUS_LABELS } from "@/lib/membership";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verifikasi Kartu Anggota — Lensaplus",
  robots: { index: false, follow: false },
};

function fmt(d: Date | null): string {
  return d
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d)
    : "-";
}

export default async function VerifyCardPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;

  let decodedNumber: string;
  try {
    decodedNumber = decodeURIComponent(number).trim();
  } catch {
    notFound();
  }
  if (!decodedNumber || decodedNumber.length > 100) {
    notFound();
  }

  const card = await prisma.membershipCard
    .findUnique({
      where: { number: decodedNumber },
      include: { user: { select: { name: true, role: true, isActive: true } } },
    })
    .catch(() => null);

  const isUserActive = Boolean(card?.user?.isActive);
  const rawStatus = card ? effectiveStatus(card) : null;
  const status = card ? (isUserActive ? rawStatus : "REVOKED") : null;
  const valid = Boolean(card && isUserActive && card.status === "ACTIVE" && rawStatus === "ACTIVE");
  const displayName = card
    ? isUserActive
      ? card.holderName || card.user.name
      : card.user.name
    : "";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 py-12">
      <div className="w-full rounded-xl border border-border bg-surface p-8 shadow-card">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Lensaplus</p>
          <p className="text-xs text-txt-muted">Verifikasi Kartu Tanda Anggota Pers</p>
        </div>

        {!card ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <ShieldX size={56} className="text-red-500" />
            <h1 className="text-xl font-bold text-txt-primary">Kartu Tidak Ditemukan</h1>
            <p className="text-sm text-txt-secondary">
              Nomor <span className="font-mono">{decodedNumber}</span> tidak terdaftar di sistem Lensaplus.
              Kartu ini kemungkinan tidak sah.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {valid ? (
              <ShieldCheck size={56} className="text-green-600" />
            ) : (
              <ShieldAlert size={56} className="text-red-500" />
            )}
            <h1 className="text-xl font-bold text-txt-primary">
              {valid ? "Kartu Sah & Aktif" : `Kartu ${STATUS_LABELS[status || ""] || status}`}
            </h1>
            {!valid && (
              <p className="text-sm text-red-600">
                Kartu ini saat ini <strong>tidak berlaku</strong>. Jangan terima sebagai identitas pers yang aktif.
              </p>
            )}

            <div className="mt-2 w-full space-y-2 rounded-lg border border-border bg-surface-secondary/50 p-4 text-left text-sm">
              <Row label="Nama" value={displayName} />
              <Row label="Jabatan" value={roleLabelsMap[card.user.role] || card.user.role} />
              <Row label="No. Anggota" value={card.number} mono />
              <Row label="Status" value={STATUS_LABELS[status || ""] || status || "-"} />
              <Row label="Diterbitkan" value={fmt(card.issuedAt)} />
              <Row label="Berlaku s/d" value={fmt(card.expiresAt)} />
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-xs text-txt-muted">Lensaplus — Media Berita Digital Nasional Indonesia</p>
          <Link href="/" className="text-xs font-medium text-primary hover:underline">
            lensaplus.com
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-txt-muted">{label}</span>
      <span className={`font-medium text-txt-primary ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
