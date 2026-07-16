#!/usr/bin/env node
/**
 * sync-glossary.mjs
 *
 * Scan Obsidian editorial vault → upsert glossary istilah hukum ke DB Lensaplus
 * via /api/external/glossary/from-obsidian endpoint.
 *
 * Usage:
 *   node tools/sync-glossary.mjs                  # dry-run
 *   node tools/sync-glossary.mjs --apply          # actually upsert
 *
 * Environment: same as sync-obsidian.mjs (OBSIDIAN_SYNC_TOKEN, LENSAPLUS_API_URL, VAULT_PATH)
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { argv, env, exit } from "node:process";

// Reuse parser + markdown→HTML from sync-obsidian.mjs (inlined for zero-dep)

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm = {};
  const lines = m[1].split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      if (value === "" || value === "[]") {
        const arr = [];
        let j = i + 1;
        while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
          arr.push(lines[j].replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""));
          j++;
        }
        if (arr.length > 0) { fm[key] = arr; i = j; continue; }
        fm[key] = value === "[]" ? [] : "";
      } else if (value.startsWith("[") && value.endsWith("]")) {
        fm[key] = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      } else {
        fm[key] = value.replace(/^["']|["']$/g, "");
      }
    }
    i++;
  }
  return { frontmatter: fm, body: m[2] };
}

function markdownToHtml(md) {
  let html = md;
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre><code${lang ? ` class="language-${lang}"` : ""}>${escaped}</code></pre>`;
  });
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^>\s?(.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/^(?:- |\* )(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.+<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/^(?:\d+\.\s+)(.+)$/gm, "<oli>$1</oli>");
  html = html.replace(/(<oli>.+<\/oli>\n?)+/g, (m) => `<ol>${m.replace(/oli/g, "li")}</ol>`);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/^---+$/gm, "<hr />");
  html = html.split(/\n\n+/).map((b) => {
    const t = b.trim();
    if (!t) return "";
    if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|p|table)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, " ")}</p>`;
  }).join("\n");
  // Preserve [[wikilinks]] as <a> to /glossary/{slug}
  html = html.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_, target, alias) => {
    const text = alias ? alias.slice(1) : target;
    // Strip path prefix like ../99-Glossary-Hukum/ or ../01-Riset/
    const cleanTarget = target.replace(/^\.\.?\/?\d{2}-[^/]+\//, "").replace(/\.md$/, "").replace(/\s+/g, "-").toLowerCase();
    return `<a href="/glossary/${cleanTarget}">${text}</a>`;
  });
  return html.trim();
}

const args = argv.slice(2);
const apply = args.includes("--apply");
const vaultIdx = args.indexOf("--vault");
const vaultPath = vaultIdx >= 0 ? args[vaultIdx + 1] : env.VAULT_PATH || "c:/Users/Owen/Documents/Aureon/lensaplus-editorial";
const apiUrl = env.LENSAPLUS_API_URL || "https://lensaplus.com";
const token = env.OBSIDIAN_SYNC_TOKEN;

if (!token) {
  console.error("ERROR: OBSIDIAN_SYNC_TOKEN env var required");
  exit(1);
}

const glossaryDir = join(vaultPath, "99-Glossary-Hukum");
console.log(`📂 Vault: ${vaultPath}`);
console.log(`🌐 Target: ${apiUrl}`);
console.log(`${apply ? "⚡ APPLY" : "🔍 DRY-RUN"}\n`);

let dirEntries;
try { dirEntries = await readdir(glossaryDir); }
catch (e) { console.error(`ERROR reading ${glossaryDir}:`, e.message); exit(1); }

const stats = { scanned: 0, synced: 0, errors: 0 };

const RANAH_MAP = {
  pidana: "PIDANA", perdata: "PERDATA", htn: "HTN", hi: "HI",
  prosedur: "PROSEDUR", umum: "UMUM",
};

for (const filename of dirEntries) {
  if (!filename.endsWith(".md") || filename === "README.md") continue;
  stats.scanned++;

  const filePath = join(glossaryDir, filename);
  const raw = await readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);

  if (frontmatter.type !== "glossary") {
    console.log(`  skip ${filename} (frontmatter.type != "glossary")`);
    continue;
  }

  const slug = filename.replace(/\.md$/, "");
  const istilah = frontmatter.istilah || slug;
  const ranah = RANAH_MAP[(frontmatter.ranah || "umum").toLowerCase()] || "UMUM";

  // Strip H1 (we use frontmatter.istilah as title)
  const cleanBody = body.replace(/^#\s+.+$/m, "").trim();
  const html = markdownToHtml(cleanBody);

  // Detect related slugs from "Lihat Juga" section
  const related = [];
  const lihatJugaMatch = body.match(/##\s+Lihat Juga[\s\S]*?(?=\n##|\n---|\n$)/i);
  if (lihatJugaMatch) {
    const wikis = [...lihatJugaMatch[0].matchAll(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g)];
    for (const w of wikis) {
      const t = w[1].replace(/^\.\.?\/?\d{2}-[^/]+\//, "").replace(/\.md$/, "").trim().replace(/\s+/g, "-").toLowerCase();
      related.push(t);
    }
  }

  const payload = {
    slug,
    istilah,
    singkatan: frontmatter.singkatan || null,
    bahasaAsli: frontmatter["bahasa-asli"] || null,
    ranah,
    bodyHtml: html,
    bodyMarkdown: cleanBody,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((t) => t !== "glossary") : [],
    related,
    sourcePath: filePath,
    isPublished: true,
  };

  console.log(`📄 ${filename}`);
  console.log(`   istilah: ${istilah}`);
  console.log(`   ranah: ${ranah}`);
  console.log(`   tags: [${payload.tags.join(", ")}]`);
  console.log(`   related: [${related.join(", ")}]`);
  console.log(`   html: ${html.length} chars`);

  if (!apply) { console.log(`   (dry-run)\n`); continue; }

  try {
    const res = await fetch(`${apiUrl}/api/external/glossary/from-obsidian`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      console.error(`   ❌ FAILED: ${json.error || `HTTP ${res.status}`}\n`);
      stats.errors++;
      continue;
    }
    console.log(`   ✅ ${json.data.url}\n`);
    stats.synced++;
  } catch (e) {
    console.error(`   ❌ ERROR: ${e.message}\n`);
    stats.errors++;
  }
}

console.log(`─── SUMMARY ───`);
console.log(`Scanned: ${stats.scanned}`);
console.log(`Synced: ${stats.synced}`);
console.log(`Errors: ${stats.errors}`);
exit(stats.errors > 0 ? 1 : 0);
