/**
 * Dokumentasi — SUPER_ADMIN only
 * Server component: reads docs/FEATURE_REFERENCE.md and passes to client renderer.
 */

import fs from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/api-utils";
import DocumentationClient from "./DocumentationClient";

export const dynamic = "force-dynamic";

export default async function DokumentasiPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?reason=unauthorized");
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/panel/dashboard");
  }

  let markdown = "";
  let errorMessage: string | null = null;
  try {
    const docPath = path.join(
      process.cwd(),
      "docs",
      "FEATURE_REFERENCE.md",
    );
    markdown = fs.readFileSync(docPath, "utf-8");
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Gagal membaca dokumentasi.";
  }

  return (
    <DocumentationClient markdown={markdown} errorMessage={errorMessage} />
  );
}
