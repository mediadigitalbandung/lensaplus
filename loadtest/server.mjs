// ─────────────────────────────────────────────────────────────────────────
// Kartawarta — Load / Stress Test Tool (LOCALHOST ONLY)
//
// This is a CONTROLLED LOAD TESTER for measuring the capacity & resilience of
// a site you OWN or are AUTHORIZED to test. It is NOT a DDoS weapon:
//   • binds to 127.0.0.1 only (never exposed to the network)
//   • requires an explicit "I am authorized" acknowledgement per run
//   • concurrency/duration are capped to sane limits
//   • per-request timeout, graceful stop, no amplification/spoofing
//
// Run:   node loadtest/server.mjs       then open  http://127.0.0.1:8787
//
// ⚠️  Testing a LIVE production site on shared hosting (e.g. Hostinger) can
//     take it down for real readers and breach the host's ToS. Prefer testing
//     a LOCAL build (npm run dev → http://localhost:3000) or a staging copy.
//     Against production, use modest load just to confirm rate-limiting works.
// ─────────────────────────────────────────────────────────────────────────

import http from "node:http";
import { performance } from "node:perf_hooks";

const PORT = 8787;
const HOST = "127.0.0.1";

// Hard safety caps — the UI can request less, never more.
const MAX_CONCURRENCY = 500;
const MAX_DURATION_SEC = 300;
const REQUEST_TIMEOUT_MS = 15_000;
const LAT_RESERVOIR = 200_000; // cap stored latency samples (memory guard)

let activeRun = null; // { abort: AbortController, stop: () => void }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, lo, hi, dflt) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function snapshot(stats) {
  const elapsed = (performance.now() - stats.startedAt) / 1000;
  const lat = stats.latencies;
  let p50 = 0, p90 = 0, p95 = 0, p99 = 0, max = 0, min = 0, avg = 0;
  if (lat.length) {
    const sorted = [...lat].sort((a, b) => a - b);
    p50 = percentile(sorted, 50);
    p90 = percentile(sorted, 90);
    p95 = percentile(sorted, 95);
    p99 = percentile(sorted, 99);
    min = sorted[0];
    max = sorted[sorted.length - 1];
    avg = lat.reduce((s, x) => s + x, 0) / lat.length;
  }
  return {
    elapsed: +elapsed.toFixed(1),
    sent: stats.sent,
    completed: stats.completed,
    failed: stats.failed,
    rps: elapsed > 0 ? +(stats.completed / elapsed).toFixed(1) : 0,
    bytes: stats.bytes,
    byStatus: stats.byStatus,
    errors: stats.errorKinds,
    latency: {
      min: +min.toFixed(1), avg: +avg.toFixed(1), p50: +p50.toFixed(1),
      p90: +p90.toFixed(1), p95: +p95.toFixed(1), p99: +p99.toFixed(1), max: +max.toFixed(1),
    },
  };
}

async function runTest(opts, onProgress) {
  const { url, method, concurrency, durationSec, rampSec, rps } = opts;
  const abort = new AbortController();
  const deadline = performance.now() + durationSec * 1000;
  const rampMs = rampSec * 1000;

  const stats = {
    startedAt: performance.now(),
    sent: 0, completed: 0, failed: 0, bytes: 0,
    byStatus: {}, errorKinds: {}, latencies: [],
  };

  // Optional global pacing (requests/sec across all workers).
  let nextSlot = performance.now();
  const slotMs = rps > 0 ? 1000 / rps : 0;
  async function pace() {
    if (!slotMs) return;
    const now = performance.now();
    if (nextSlot < now) nextSlot = now;
    const wait = nextSlot - now;
    nextSlot += slotMs;
    if (wait > 0) await sleep(wait);
  }

  function record(latency, status, size) {
    stats.completed++;
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.bytes += size;
    // Reservoir sampling to cap memory on very long runs.
    if (stats.latencies.length < LAT_RESERVOIR) {
      stats.latencies.push(latency);
    } else {
      const j = Math.floor(Math.random() * stats.completed);
      if (j < LAT_RESERVOIR) stats.latencies[j] = latency;
    }
  }
  function recordError(e) {
    stats.failed++;
    const kind = e?.name === "AbortError" ? "timeout/abort" : (e?.cause?.code || e?.code || e?.name || "error");
    stats.errorKinds[kind] = (stats.errorKinds[kind] || 0) + 1;
  }

  async function worker(i) {
    // Ramp-up: stagger worker start so load climbs instead of spiking.
    if (rampMs > 0) await sleep((rampMs * i) / concurrency);
    while (!abort.signal.aborted && performance.now() < deadline) {
      await pace();
      if (abort.signal.aborted || performance.now() >= deadline) break;
      const t0 = performance.now();
      const reqAbort = new AbortController();
      const onAbort = () => reqAbort.abort();
      abort.signal.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => reqAbort.abort(), REQUEST_TIMEOUT_MS);
      stats.sent++;
      try {
        const res = await fetch(url, {
          method,
          redirect: "manual",
          signal: reqAbort.signal,
          headers: { "user-agent": "Kartawarta-LoadTest/1.0 (authorized self-test)" },
        });
        const body = await res.arrayBuffer();
        record(performance.now() - t0, res.status, body.byteLength);
      } catch (e) {
        recordError(e);
      } finally {
        clearTimeout(timer);
        abort.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  const progressTimer = setInterval(() => onProgress(snapshot(stats), false), 500);
  activeRun = { abort, stop: () => abort.abort() };

  const workers = Array.from({ length: concurrency }, (_, i) => worker(i));
  await Promise.all(workers);

  clearInterval(progressTimer);
  activeRun = null;
  return snapshot(stats);
}

// ── HTTP server ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "GET" && u.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  if (req.method === "POST" && u.pathname === "/stop") {
    if (activeRun) activeRun.stop();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ stopped: true }));
    return;
  }

  if (req.method === "GET" && u.pathname === "/run") {
    const p = u.searchParams;
    if (p.get("authorized") !== "1") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Centang dulu pernyataan otorisasi." }));
      return;
    }
    let target;
    try {
      target = new URL(p.get("url"));
      if (!/^https?:$/.test(target.protocol)) throw new Error("protocol");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "URL tidak valid (harus http/https)." }));
      return;
    }
    if (activeRun) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Sudah ada tes berjalan." }));
      return;
    }

    const opts = {
      url: target.toString(),
      method: (p.get("method") || "GET").toUpperCase() === "HEAD" ? "HEAD" : "GET",
      concurrency: clamp(p.get("concurrency"), 1, MAX_CONCURRENCY, 10),
      durationSec: clamp(p.get("duration"), 1, MAX_DURATION_SEC, 10),
      rampSec: clamp(p.get("ramp"), 0, MAX_DURATION_SEC, 0),
      rps: clamp(p.get("rps"), 0, 100_000, 0),
    };

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("start", opts);

    // Client closed the stream (Stop button / tab close) → abort the run.
    req.on("close", () => { if (activeRun) activeRun.stop(); });

    try {
      const summary = await runTest(opts, (snap) => send("progress", snap));
      send("done", summary);
    } catch (e) {
      send("error", { error: String(e?.message || e) });
    } finally {
      res.end();
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Kartawarta Load Test — buka di browser:\n  → http://${HOST}:${PORT}\n`);
  console.log("  Tekan Ctrl+C untuk berhenti.\n");
});

// ── UI (single inline HTML page) ─────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kartawarta — Uji Beban</title>
<style>
  :root { --navy:#002045; --navy2:#001530; --crimson:#b7102a; --bd:#c4c6d0; --muted:#74777f; --bg:#f8f9fa; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background:var(--bg); color:#191c1d; }
  header { background:var(--navy); color:#fff; padding:18px 24px; }
  header h1 { margin:0; font-size:18px; }
  header p { margin:4px 0 0; font-size:13px; color:#9fb2c9; }
  main { max-width:980px; margin:0 auto; padding:24px; }
  .warn { background:#fff7ed; border:1px solid #fdba74; color:#9a3412; padding:12px 14px; border-radius:10px; font-size:13px; margin-bottom:18px; }
  .card { background:#fff; border:1px solid var(--bd); border-radius:12px; padding:18px; margin-bottom:18px; }
  label { display:block; font-size:12px; font-weight:600; color:#44474e; margin-bottom:4px; }
  input[type=text], input[type=number], select { width:100%; padding:8px 10px; border:1px solid var(--bd); border-radius:8px; font-size:14px; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .row { display:flex; gap:10px; align-items:center; margin-top:14px; flex-wrap:wrap; }
  button { border:0; border-radius:8px; padding:10px 18px; font-weight:700; font-size:14px; cursor:pointer; }
  .start { background:var(--navy); color:#fff; } .start:disabled { opacity:.5; cursor:not-allowed; }
  .stop { background:var(--crimson); color:#fff; } .stop:disabled { opacity:.5; cursor:not-allowed; }
  .chk { display:flex; gap:8px; align-items:flex-start; font-size:13px; color:#44474e; margin-top:14px; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .stat { background:#f1f3f4; border-radius:10px; padding:12px; }
  .stat b { display:block; font-size:22px; color:var(--navy); }
  .stat span { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td,th { text-align:left; padding:6px 8px; border-bottom:1px solid #eee; }
  .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:700; }
  .ok { background:#dcfce7; color:#166534; } .warnp { background:#fef9c3; color:#854d0e; } .bad { background:#fee2e2; color:#991b1b; }
  .muted { color:var(--muted); font-size:12px; }
  h3 { margin:0 0 12px; font-size:14px; }
</style>
</head>
<body>
<header>
  <h1>Kartawarta — Uji Beban (Load / Stress Test)</h1>
  <p>Alat lokal untuk mengukur kapasitas & ketahanan situs milik sendiri. Bukan alat serangan.</p>
</header>
<main>
  <div class="warn">
    <b>Gunakan hanya untuk situs yang Anda miliki / berwenang uji.</b> Menguji situs produksi di hosting bersama
    bisa menjatuhkan situs untuk pembaca asli dan melanggar ToS hosting. Disarankan menguji <b>localhost</b>
    (npm run dev → http://localhost:3000) atau staging; ke produksi gunakan beban kecil saja untuk memverifikasi rate-limit.
  </div>

  <div class="card">
    <div class="grid">
      <div style="grid-column:1 / -1">
        <label>Target URL</label>
        <input id="url" type="text" value="http://localhost:3000" placeholder="https://kartawarta.com" />
      </div>
    </div>
    <div class="grid4" style="margin-top:14px">
      <div><label>Concurrency (1–${MAX_CONCURRENCY})</label><input id="concurrency" type="number" value="10" min="1" max="${MAX_CONCURRENCY}" /></div>
      <div><label>Durasi (detik, ≤${MAX_DURATION_SEC})</label><input id="duration" type="number" value="10" min="1" max="${MAX_DURATION_SEC}" /></div>
      <div><label>Ramp-up (detik)</label><input id="ramp" type="number" value="2" min="0" max="${MAX_DURATION_SEC}" /></div>
      <div><label>Batas RPS (0 = bebas)</label><input id="rps" type="number" value="0" min="0" /></div>
    </div>
    <div class="grid4" style="margin-top:14px">
      <div><label>Method</label>
        <select id="method"><option value="GET">GET</option><option value="HEAD">HEAD</option></select>
      </div>
    </div>
    <label class="chk"><input id="auth" type="checkbox" />
      <span>Saya menyatakan bahwa saya <b>pemilik</b> atau <b>berwenang</b> menguji target di atas, dan paham risikonya.</span>
    </label>
    <div class="row">
      <button class="start" id="startBtn" disabled>▶ Mulai Uji Beban</button>
      <button class="stop" id="stopBtn" disabled>■ Stop</button>
      <span class="muted" id="state">Siap.</span>
    </div>
  </div>

  <div class="card">
    <h3>Statistik Live</h3>
    <div class="stats">
      <div class="stat"><b id="s_rps">0</b><span>Req / detik</span></div>
      <div class="stat"><b id="s_completed">0</b><span>Selesai</span></div>
      <div class="stat"><b id="s_failed">0</b><span>Gagal</span></div>
      <div class="stat"><b id="s_elapsed">0</b><span>Detik berjalan</span></div>
    </div>
    <div class="stats" style="margin-top:12px">
      <div class="stat"><b id="s_p50">0</b><span>Latensi p50 (ms)</span></div>
      <div class="stat"><b id="s_p95">0</b><span>Latensi p95 (ms)</span></div>
      <div class="stat"><b id="s_p99">0</b><span>Latensi p99 (ms)</span></div>
      <div class="stat"><b id="s_max">0</b><span>Latensi max (ms)</span></div>
    </div>
  </div>

  <div class="card">
    <h3>Breakdown Status & Error</h3>
    <table id="statusTable"><tbody><tr><td class="muted">Belum ada data.</td></tr></tbody></table>
  </div>
</main>

<script>
  const $ = (id) => document.getElementById(id);
  const auth = $("auth"), startBtn = $("startBtn"), stopBtn = $("stopBtn");
  let es = null;

  auth.addEventListener("change", () => { startBtn.disabled = !auth.checked; });

  function setRunning(running) {
    startBtn.disabled = running || !auth.checked;
    stopBtn.disabled = !running;
    ["url","concurrency","duration","ramp","rps","method","auth"].forEach((id)=>$(id).disabled = running);
  }

  function render(s) {
    $("s_rps").textContent = s.rps;
    $("s_completed").textContent = s.completed.toLocaleString("id-ID");
    $("s_failed").textContent = s.failed.toLocaleString("id-ID");
    $("s_elapsed").textContent = s.elapsed;
    $("s_p50").textContent = s.latency.p50;
    $("s_p95").textContent = s.latency.p95;
    $("s_p99").textContent = s.latency.p99;
    $("s_max").textContent = s.latency.max;
    const rows = [];
    for (const [code, n] of Object.entries(s.byStatus).sort()) {
      const c = +code;
      const cls = c < 300 ? "ok" : c < 500 ? "warnp" : "bad";
      const note = c === 429 ? " (rate-limited — bagus, proteksi aktif)" : c >= 500 ? " (server error)" : "";
      rows.push('<tr><td><span class="pill '+cls+'">'+code+'</span></td><td>'+n.toLocaleString("id-ID")+'</td><td class="muted">'+note+'</td></tr>');
    }
    for (const [kind, n] of Object.entries(s.errors)) {
      rows.push('<tr><td><span class="pill bad">ERR</span></td><td>'+n.toLocaleString("id-ID")+'</td><td class="muted">'+kind+'</td></tr>');
    }
    $("statusTable").innerHTML = "<tbody>" + (rows.join("") || '<tr><td class="muted">—</td></tr>') + "</tbody>";
  }

  startBtn.addEventListener("click", () => {
    const params = new URLSearchParams({
      url: $("url").value.trim(),
      concurrency: $("concurrency").value,
      duration: $("duration").value,
      ramp: $("ramp").value,
      rps: $("rps").value,
      method: $("method").value,
      authorized: auth.checked ? "1" : "0",
    });
    setRunning(true);
    $("state").textContent = "Berjalan…";
    es = new EventSource("/run?" + params.toString());
    es.addEventListener("progress", (e) => render(JSON.parse(e.data)));
    es.addEventListener("done", (e) => { render(JSON.parse(e.data)); $("state").textContent = "Selesai ✓"; cleanup(); });
    es.addEventListener("error", (e) => {
      try { $("state").textContent = "Error: " + JSON.parse(e.data).error; } catch { $("state").textContent = "Koneksi terputus."; }
      cleanup();
    });
  });

  stopBtn.addEventListener("click", () => {
    fetch("/stop", { method: "POST" });
    if (es) es.close();
    $("state").textContent = "Dihentikan.";
    cleanup();
  });

  function cleanup() { if (es) { es.close(); es = null; } setRunning(false); }
</script>
</body>
</html>`;
