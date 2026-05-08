// Next 14 → Next 16 codemod (v3, scoped).
//
// Strategy:
//   For each file in src/app, do TWO scoped passes:
//
//   Pass A — destructured signatures with INLINE typed object (most common):
//     `{ params }: { params: { id: string } }`
//       → `{ params: paramsPromise }: { params: Promise<{ id: string }> }`
//          + inject `const params = await paramsPromise;` at top of body
//     `{ params, searchParams }: { params: {...}; searchParams: {...} }`
//       → wrap each `{...}` in `Promise<>`
//          + inject both awaits
//     `{ searchParams }: { searchParams: { ... } }` similarly
//
//   Pass B — `interface PageProps { params: { ... }; searchParams: { ... }; }`:
//     Inside any `interface NAME` or `type NAME = { ... }` block, wrap fields
//     `params: { ... }` and `searchParams: { ... }` in `Promise<>`.
//     Then for any function whose parameter is annotated with that named interface
//     and destructures `{ params }` / `{ searchParams }`, rewrite the destructure
//     to use rename pattern + inject `await`.
//
// We deliberately do NOT touch occurrences of `params` / `searchParams` outside
// Next page/route boundaries (e.g. local helpers like `buildUrl(params: ...)`).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "src", "app");

let touched = 0;
const changed = [];

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function readBalanced(src, start, open, close) {
  if (src[start] !== open) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { start, end: i + 1, content: src.slice(start, i + 1) };
    }
  }
  return null;
}

// PASS A: rewrite destructured-signature WITH inline typed object.
// Form:  ({ params }: { params: { ... } })
//   or:  ({ params, searchParams }: { params: { ... }; searchParams: { ... } })
//   or:  ({ searchParams }: { searchParams: { ... } })
function passA(src) {
  const out = [];
  let cursor = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] !== "{") {
      i++;
      continue;
    }
    // Must be preceded by `(` or `,` (with optional whitespace/newlines)
    const before = src.slice(0, i);
    if (!/[(,]\s*$/.test(before)) {
      i++;
      continue;
    }
    const lhs = readBalanced(src, i, "{", "}");
    if (!lhs) {
      i++;
      continue;
    }
    const inside = lhs.content.slice(1, -1).trim();
    const idents = inside.split(",").map((s) => s.trim()).filter(Boolean);
    const allBare = idents.every((s) => /^[a-zA-Z_]\w*$/.test(s));
    if (!allBare) {
      i = lhs.end;
      continue;
    }
    const wantsParams = idents.includes("params");
    const wantsSearch = idents.includes("searchParams");
    if (!wantsParams && !wantsSearch) {
      i = lhs.end;
      continue;
    }
    // Look for `:` after lhs
    let j = lhs.end;
    while (/\s/.test(src[j])) j++;
    if (src[j] !== ":") {
      i = lhs.end;
      continue;
    }
    j++;
    while (/\s/.test(src[j])) j++;
    if (src[j] !== "{") {
      i = lhs.end;
      continue;
    }
    const rhs = readBalanced(src, j, "{", "}");
    if (!rhs) {
      i = lhs.end;
      continue;
    }
    // Wrap params/searchParams field types in Promise<>
    const newRhsContent = wrapPromiseInTypeBody(rhs.content);
    if (newRhsContent === rhs.content) {
      // Nothing to wrap (maybe already Promise<>). Skip — but still inject awaits if rhs already has Promise.
      const alreadyAsync = /(params|searchParams)\s*:\s*Promise\s*</.test(rhs.content);
      if (!alreadyAsync) {
        i = rhs.end;
        continue;
      }
    }
    // Build new destructure
    const newIdents = idents.map((id) =>
      id === "params"
        ? "params: paramsPromise"
        : id === "searchParams"
        ? "searchParams: searchParamsPromise"
        : id,
    );
    const newDestructure = `{ ${newIdents.join(", ")} }`;
    // Find function body opening `{` after the param list `)`
    const bodyStart = findFunctionBodyStart(src, rhs.end);
    if (bodyStart === -1) {
      i = rhs.end;
      continue;
    }
    out.push(src.slice(cursor, i));
    out.push(newDestructure);
    out.push(": ");
    out.push(newRhsContent);
    out.push(src.slice(rhs.end, bodyStart + 1)); // up to and including body `{`
    let inj = "";
    if (wantsParams) inj += "\n  const params = await paramsPromise;";
    if (wantsSearch) inj += "\n  const searchParams = await searchParamsPromise;";
    out.push(inj);
    cursor = bodyStart + 1;
    i = bodyStart + 1;
  }
  out.push(src.slice(cursor));
  return out.join("");
}

function wrapPromiseInTypeBody(typeBody) {
  // typeBody includes outer `{` and `}`.
  // Wrap `params: { ... }` and `searchParams: { ... }` (top-level only) in Promise<>.
  // We don't touch nested params/searchParams.
  if (!(typeBody.startsWith("{") && typeBody.endsWith("}"))) return typeBody;
  const inner = typeBody.slice(1, -1);
  const result = [];
  let cursor = 0;
  let i = 0;
  while (i < inner.length) {
    // Look for `params` or `searchParams` followed by `:` `{` at top level (depth 0)
    const m = /^(params|searchParams)\b/.exec(inner.slice(i));
    if (!m || !atTopLevel(inner, i)) {
      i++;
      continue;
    }
    const nameLen = m[0].length;
    let k = i + nameLen;
    while (/\s/.test(inner[k])) k++;
    if (inner[k] !== ":") {
      i = i + nameLen;
      continue;
    }
    k++;
    while (/\s/.test(inner[k])) k++;
    if (inner[k] !== "{") {
      i = i + nameLen;
      continue;
    }
    const objType = readBalanced(inner, k, "{", "}");
    if (!objType) {
      i = i + nameLen;
      continue;
    }
    // Skip if already Promise<...> (won't happen since we only matched `: {` directly)
    result.push(inner.slice(cursor, k));
    result.push(`Promise<${objType.content}>`);
    cursor = objType.end;
    i = objType.end;
  }
  result.push(inner.slice(cursor));
  return "{" + result.join("") + "}";
}

// True if position i in src is at brace-depth 0 (i.e. not inside a nested `{...}`).
function atTopLevel(src, pos) {
  let depth = 0;
  for (let k = 0; k < pos; k++) {
    const c = src[k];
    if (c === "{") depth++;
    else if (c === "}") depth--;
  }
  return depth === 0;
}

function findFunctionBodyStart(src, fromIdx) {
  // From `fromIdx` (right after RHS type closing `}`), walk forward to find `)` that
  // closes the param list, then find the next `{` that opens the function body.
  let depth = 0;
  let i = fromIdx;
  // We are inside the parameter parens — but `fromIdx` is the `}` of the RHS object type.
  // Walk forward to `)` at depth 0.
  while (i < src.length) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      if (depth === 0) {
        i++;
        break;
      }
      depth--;
    }
    i++;
  }
  // Skip optional `: ReturnType` (which may include `<...>` and `Promise<...>` etc.)
  // and `=> ` for arrow functions, until we hit `{`.
  // Strategy: scan forward, tracking brace/angle depth, until we find a `{` at depth 0.
  let bDepth = 0;
  let aDepth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "<") aDepth++;
    else if (c === ">") aDepth = Math.max(0, aDepth - 1);
    else if (c === "(") bDepth++;
    else if (c === ")") bDepth--;
    else if (c === "{" && bDepth === 0 && aDepth === 0) return i;
    else if (c === ";") return -1; // function-type alias, no body
    i++;
  }
  return -1;
}

// PASS B: handle `interface PageProps { params: {...}; searchParams: {...}; }`
// and `type PageProps = { ... }`. Wrap inner params/searchParams in Promise<>.
function passB(src) {
  // Find interface/type blocks at top-level whose body has params: { ... } or searchParams: { ... }
  const result = [];
  let cursor = 0;
  // Match: interface NAME { ... }   or   type NAME = { ... }
  const re =
    /(interface\s+(\w+)[^{]*\{|type\s+(\w+)\s*=\s*\{)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const headStart = m.index;
    // Find the `{` that opens the body
    const braceIdx = src.indexOf("{", headStart);
    if (braceIdx === -1) continue;
    const body = readBalanced(src, braceIdx, "{", "}");
    if (!body) continue;
    const newBody = wrapPromiseInTypeBody(body.content);
    if (newBody !== body.content) {
      result.push(src.slice(cursor, braceIdx));
      result.push(newBody);
      cursor = body.end;
      re.lastIndex = body.end;
    }
  }
  result.push(src.slice(cursor));
  return result.join("");
}

// PASS C: rewrite destructured signatures whose RHS is a NAMED type (e.g. `: PageProps`).
// We scan all functions that have `({ params, searchParams }: NamedType)` where NamedType
// was modified by passB. Since we don't track which names were modified, we conservatively
// assume any time we see `({ params }: <Identifier>)` or `({ searchParams }: <Identifier>)`
// in a Next page/route file (path under src/app and ends with page.tsx, layout.tsx, route.ts etc.)
// it's safe to rewrite.
function passC(src) {
  const out = [];
  let cursor = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] !== "{") {
      i++;
      continue;
    }
    const before = src.slice(0, i);
    if (!/[(,]\s*$/.test(before)) {
      i++;
      continue;
    }
    const lhs = readBalanced(src, i, "{", "}");
    if (!lhs) {
      i++;
      continue;
    }
    const inside = lhs.content.slice(1, -1).trim();
    const idents = inside.split(",").map((s) => s.trim()).filter(Boolean);
    const allBare = idents.every((s) => /^[a-zA-Z_]\w*$/.test(s));
    if (!allBare) {
      i = lhs.end;
      continue;
    }
    const wantsParams = idents.includes("params");
    const wantsSearch = idents.includes("searchParams");
    if (!wantsParams && !wantsSearch) {
      i = lhs.end;
      continue;
    }
    let j = lhs.end;
    while (/\s/.test(src[j])) j++;
    if (src[j] !== ":") {
      i = lhs.end;
      continue;
    }
    j++;
    while (/\s/.test(src[j])) j++;
    // Look for an Identifier (named type)
    const idMatch = src.slice(j).match(/^[A-Z]\w*/);
    if (!idMatch) {
      i = lhs.end;
      continue;
    }
    const typeNameEnd = j + idMatch[0].length;
    // Heuristic: only if the named type appears in this file AND its definition
    // mentions `params: Promise<` or `searchParams: Promise<`.
    const typeName = idMatch[0];
    const defRe = new RegExp(
      `(interface|type)\\s+${typeName}\\b[^{]*\\{([\\s\\S]*?)\\}`,
    );
    const defMatch = src.match(defRe);
    if (!defMatch) {
      i = lhs.end;
      continue;
    }
    if (!/(params|searchParams)\s*:\s*Promise\s*</.test(defMatch[2])) {
      // Type wasn't transformed by passB — don't touch this destructure.
      i = lhs.end;
      continue;
    }
    // Build new destructure with renames + injection
    const newIdents = idents.map((id) =>
      id === "params"
        ? "params: paramsPromise"
        : id === "searchParams"
        ? "searchParams: searchParamsPromise"
        : id,
    );
    const newDestructure = `{ ${newIdents.join(", ")} }`;
    const bodyStart = findFunctionBodyStart(src, typeNameEnd);
    if (bodyStart === -1) {
      i = lhs.end;
      continue;
    }
    out.push(src.slice(cursor, i));
    out.push(newDestructure);
    out.push(src.slice(lhs.end, bodyStart + 1));
    let inj = "";
    if (wantsParams) inj += "\n  const params = await paramsPromise;";
    if (wantsSearch) inj += "\n  const searchParams = await searchParamsPromise;";
    out.push(inj);
    cursor = bodyStart + 1;
    i = bodyStart + 1;
  }
  out.push(src.slice(cursor));
  return out.join("");
}

for (const file of listFiles(APP_DIR)) {
  const before = fs.readFileSync(file, "utf8");
  let after = passA(before);
  after = passB(after);
  after = passC(after);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    touched++;
    changed.push(path.relative(ROOT, file).replace(/\\/g, "/"));
  }
}

console.log(`Codemod done. ${touched} files changed.`);
for (const f of changed) console.log("  - " + f);
