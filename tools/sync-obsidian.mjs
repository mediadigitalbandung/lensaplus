#!/usr/bin/env node
/**
 * sync-obsidian.mjs
 *
 * Scan Obsidian editorial vault → push articles with status=ready to Lensaplus DB
 * via /api/external/articles/from-obsidian endpoint.
 *
 * Usage:
 *   node tools/sync-obsidian.mjs                      # dry-run (no POST, just report)
 *   node tools/sync-obsidian.mjs --apply              # actually POST + update frontmatter
 *   node tools/sync-obsidian.mjs --apply --vault PATH # custom vault path
 *
 * Environment:
 *   LENSAPLUS_API_URL   default https://lensaplus.com
 *   OBSIDIAN_SYNC_TOKEN  required (must match server .env)
 *   VAULT_PATH           default c:/Users/Owen/Documents/Aureon/lensaplus-editorial
 *
 * Behavior:
 *   1. Glob VAULT_PATH/03-Artikel-Plan/*.md
 *   2. Filter: frontmatter.status === "ready" AND no published-id
 *   3. For each match:
 *      - Parse frontmatter + body
 *      - Convert markdown body → HTML (marked + sanitize)
 *      - POST to endpoint with Bearer token
 *      - On success: update frontmatter (status=published, published-id, published-url)
 *      - On dry-run: just print what would happen
 *   4. Report summary
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { argv, env, exit } from "node:process";

// ─── Lightweight YAML frontmatter parser ──────────────────────────
// (gray-matter would be a dep — keeping zero-dep for tools/)

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
      // Multi-line list (indented "- ...")
      if (value === "" || value === "[]") {
        const arr = [];
        let j = i + 1;
        while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
          arr.push(lines[j].replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""));
          j++;
        }
        if (arr.length > 0) {
          fm[key] = arr;
          i = j;
          continue;
        }
        fm[key] = value === "[]" ? [] : "";
      } else {
        // Inline list [a, b, c]
        if (value.startsWith("[") && value.endsWith("]")) {
          fm[key] = value
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        } else {
          // String (strip quotes)
          fm[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    }
    i++;
  }
  return { frontmatter: fm, body: m[2] };
}

function stringifyFrontmatter(fm, body) {
  const yamlLines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      if (v.length === 0) yamlLines.push(`${k}: []`);
      else {
        yamlLines.push(`${k}:`);
        for (const item of v) yamlLines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
      }
    } else if (typeof v === "object" && v !== null) {
      yamlLines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        yamlLines.push(`  ${k2}: ${typeof v2 === "string" ? `"${v2}"` : v2}`);
      }
    } else if (typeof v === "string") {
      yamlLines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    } else {
      yamlLines.push(`${k}: ${v}`);
    }
  }
  yamlLines.push("---");
  return yamlLines.join("\n") + "\n" + body;
}

// ─── Minimal markdown → HTML converter ────────────────────────────
// Supports: headings, paragraphs, bold, italic, links, code blocks, lists, blockquotes.
// For richer needs, install `marked` and import here.

function markdownToHtml(md) {
  let html = md;

  // Code blocks (must come first)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><code${lang ? ` class="language-${lang}"` : ""}>${escaped}</code></pre>`;
  });

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Blockquotes
  html = html.replace(/^>\s?(.+)$/gm, "<blockquote>$1</blockquote>");

  // Lists (simple unordered)
  html = html.replace(/^(?:- |\* )(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.+<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Bold + italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr />");

  // Paragraphs (lines that are not block-level)
  html = html
    .split(/\n\n+/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|p)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  // Strip Obsidian-specific [[wikilinks]] — convert to plain text
  html = html.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_, target, alias) => {
    return alias ? alias.slice(1) : target;
  });

  return html.trim();
}

// ─── Main ───────────────────────────────────────────────────────────

const args = argv.slice(2);
const apply = args.includes("--apply");
const vaultIdx = args.indexOf("--vault");
const vaultPath = vaultIdx >= 0 ? args[vaultIdx + 1] : env.VAULT_PATH || "c:/Users/Owen/Documents/Aureon/lensaplus-editorial";
const apiUrl = env.LENSAPLUS_API_URL || "https://lensaplus.com";
const token = env.OBSIDIAN_SYNC_TOKEN;

if (!token) {
  console.error("ERROR: OBSIDIAN_SYNC_TOKEN env var required");
  console.error("Set with: export OBSIDIAN_SYNC_TOKEN='your-token-from-vps-env'");
  exit(1);
}

const articlePlanDir = join(vaultPath, "03-Artikel-Plan");

console.log(`📂 Vault: ${vaultPath}`);
console.log(`🌐 Target: ${apiUrl}`);
console.log(`${apply ? "⚡ APPLY MODE — will POST + write frontmatter" : "🔍 DRY-RUN — no changes (use --apply to commit)"}`);
console.log("");

let dirEntries;
try {
  dirEntries = await readdir(articlePlanDir);
} catch (e) {
  console.error(`ERROR reading ${articlePlanDir}:`, e.message);
  exit(1);
}

const stats = { scanned: 0, eligible: 0, synced: 0, skipped: 0, errors: 0 };

for (const filename of dirEntries) {
  if (!filename.endsWith(".md") || filename === "README.md") continue;
  stats.scanned++;

  const filePath = join(articlePlanDir, filename);
  const raw = await readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);

  // Skip if not ready or already published
  if (frontmatter.status !== "ready") {
    console.log(`  skip ${filename} (status=${frontmatter.status || "none"})`);
    continue;
  }
  if (frontmatter["published-id"]) {
    console.log(`  skip ${filename} (already published, id=${frontmatter["published-id"]})`);
    continue;
  }

  stats.eligible++;
  console.log(`\n📄 ${filename}`);

  // Build payload
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, "");
  const cleanBody = body.replace(/^#\s+.+$/m, "").trim();
  const html = markdownToHtml(cleanBody);

  const payload = {
    title,
    excerpt: frontmatter["estimasi-kata"] ? undefined : undefined, // user fills excerpt via panel later
    content: html,
    categorySlug: frontmatter.kategori || "umum",
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((t) => t !== "artikel" && t !== frontmatter.kategori) : [],
    authorEmail: frontmatter.penulis && frontmatter.penulis.includes("@") ? frontmatter.penulis : undefined,
    sourceMarkdownPath: filePath,
    verificationLabel: frontmatter.kategori === "opini" ? "OPINION" : "UNVERIFIED",
  };

  console.log(`   title: ${title}`);
  console.log(`   category: ${payload.categorySlug}`);
  console.log(`   tags: [${payload.tags.join(", ")}]`);
  console.log(`   content: ${html.length} chars HTML`);

  if (!apply) {
    console.log(`   (dry-run — would POST to ${apiUrl}/api/external/articles/from-obsidian)`);
    continue;
  }

  // POST
  try {
    const res = await fetch(`${apiUrl}/api/external/articles/from-obsidian`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      console.error(`   ❌ FAILED: ${json.error || `HTTP ${res.status}`}`);
      stats.errors++;
      continue;
    }
    const { articleId, url, idempotent } = json.data;
    console.log(`   ✅ ${idempotent ? "ALREADY EXISTS" : "CREATED"} — id=${articleId}`);
    console.log(`   🔗 ${url}`);

    // Update frontmatter
    frontmatter.status = "published";
    frontmatter["published-id"] = articleId;
    frontmatter["published-url"] = url;
    frontmatter.updated = new Date().toISOString().slice(0, 10);
    const newRaw = stringifyFrontmatter(frontmatter, body);
    await writeFile(filePath, newRaw, "utf-8");
    console.log(`   📝 Updated frontmatter in ${filename}`);
    stats.synced++;
  } catch (e) {
    console.error(`   ❌ ERROR: ${e.message}`);
    stats.errors++;
  }
}

console.log(`\n─── SUMMARY ───`);
console.log(`Scanned: ${stats.scanned}`);
console.log(`Eligible (status=ready): ${stats.eligible}`);
console.log(`Synced: ${stats.synced}`);
console.log(`Errors: ${stats.errors}`);
exit(stats.errors > 0 ? 1 : 0);
