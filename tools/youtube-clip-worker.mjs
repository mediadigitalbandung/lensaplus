/**
 * Kartawarta — YouTube auto-clip worker (PM2 process: kartawarta-youtube-worker).
 *
 * Polls YoutubeClipJob (status=QUEUED), then for each job:
 *   DOWNLOADING     yt-dlp  → source.mp4
 *   TRANSCRIBING    ffmpeg  → mono 16k wav → Deepgram → transcript JSON
 *   SELECTING       POST /api/internal/youtube/select-clips (tested TS libs +
 *                   callAI: normalise transcript + AI-pick highlight windows)
 *   CUTTING         ffmpeg  → one vertical 9:16 clip mp4 per highlight
 *   CREATING_CONTENTS  prisma → one DRAFT TiktokContent + slot per clip
 *
 * Design: this worker is PURE I/O + DB. All "smart" logic (transcript
 * normalisation, AI selection, index→ms mapping) lives in the tested TS libs
 * behind the internal route, so it is never duplicated in plain JS here.
 *
 * Runs OUTSIDE Next.js (separate PM2 app) because download+transcode is heavy.
 *
 * Required env (VPS .env):
 *   DATABASE_URL        prisma connection
 *   DEEPGRAM_API_KEY    speech-to-text (Indonesian)
 *   CRON_SECRET         to call the internal select-clips route
 *   APP_URL             base URL of the running app (default http://127.0.0.1:3000)
 * Optional: YTDLP_PATH, FFMPEG_PATH (default: rely on PATH).
 */

import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { mkdir, rm, readFile, stat } from "node:fs/promises";
import { randomBytes, createDecipheriv } from "node:crypto";
import path from "node:path";
import os from "node:os";

// This worker is a plain Node process — unlike Next.js it does NOT auto-load
// .env. Load it from the app dir (pm2 cwd) so DATABASE_URL / CRON_SECRET /
// DEEPGRAM_API_KEY are available BEFORE PrismaClient initialises. Guarded:
// harmless if the file is absent or the vars are already exported.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  /* no .env here or unsupported Node — rely on exported env */
}

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = 5000;
const STALE_RUNNING_MS = 45 * 60 * 1000; // reclaim RUNNING jobs idle > 45 min
const WORKER_ID = process.env.HOSTNAME || `yt-worker-${process.pid}`;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:3000";
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "tiktok-media");

const SLOT_MIN_MS = 500;
const SLOT_MAX_MS = 30000;

function log(...a) {
  console.log(new Date().toISOString(), "[yt-clip]", ...a);
}

/** Spawn a command, capture stderr tail, resolve on exit 0 else reject. */
function run(cmd, args, { timeoutMs = 20 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (e) {
      reject(e);
      return;
    }
    let stderr = "";
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("error", (e) => {
      clearTimeout(killer);
      reject(e.code === "ENOENT" ? new Error(`${cmd} not found — install it on the VPS`) : e);
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

async function setStage(jobId, stage, progress) {
  await prisma.youtubeClipJob
    .update({ where: { id: jobId }, data: { stage, progress } })
    .catch(() => {});
}

/** Atomically claim one QUEUED job (race-safe across multiple workers). */
async function claimNext() {
  const candidate = await prisma.youtubeClipJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return null;
  const claim = await prisma.youtubeClipJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", workerId: WORKER_ID, startedAt: new Date(), stage: "DOWNLOADING", progress: 5 },
  });
  if (claim.count === 0) return null; // lost the race
  return prisma.youtubeClipJob.findUnique({ where: { id: candidate.id } });
}

/** Fail RUNNING jobs whose heartbeat (updatedAt) is stale — crashed worker. */
async function reclaimStale() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS);
  await prisma.youtubeClipJob
    .updateMany({
      where: { status: "RUNNING", updatedAt: { lt: cutoff } },
      data: { status: "FAILED", errorMessage: "Worker timeout / crashed (stale RUNNING reclaimed)", finishedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Decrypt a SystemSetting value (mirror of src/lib/crypto-secrets.ts so the
 * worker honours the documented "keys live in SystemSetting" convention). The
 * .ts helper can't be imported into this plain-JS worker, so the AES-256-GCM
 * format ("v1:iv:ct:tag" base64) is reproduced here. Returns null if it can't
 * decrypt (no/!32-byte key) so the caller can fall back to env.
 */
function decryptSecret(stored) {
  if (!stored || !stored.startsWith("v1:")) return stored || null;
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) return null;
  const parts = stored.split(":");
  if (parts.length !== 4) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64"), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from(parts[3], "base64"));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Resolve the Deepgram key SystemSetting-first (like the app), then env. */
async function getDeepgramKey() {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: "deepgram_api_key" } });
    if (s?.value && s.value.trim()) {
      const dec = decryptSecret(s.value.trim());
      if (dec && dec.trim()) return dec.trim();
    }
  } catch {
    /* DB hiccup — fall back to env */
  }
  const env = process.env.DEEPGRAM_API_KEY;
  return env && env.trim() ? env.trim() : null;
}

async function deepgramTranscribe(wavPath, key) {
  if (!key) throw new Error("Deepgram API key belum diset (SystemSetting deepgram_api_key atau env DEEPGRAM_API_KEY)");
  const bytes = await readFile(wavPath);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5 * 60_000);
  try {
    const res = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=id",
      {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
        body: bytes,
      },
    );
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      throw new Error(`Deepgram HTTP ${res.status}: ${b.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function selectClips(deepgramJson, job) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET not set on the worker host");
  const res = await fetch(`${APP_URL}/api/internal/youtube/select-clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      deepgram: deepgramJson,
      count: job.requestedClips,
      targetLengthSec: job.targetLengthSec ?? undefined,
      videoTitle: job.videoTitle ?? undefined,
      userId: job.requestedById,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(`select-clips failed: ${data.error || res.status}`);
  }
  return data.data.clips || [];
}

function cutArgs(input, startSec, durationSec, output, reframe) {
  const args = ["-y", "-ss", startSec.toFixed(3), "-i", input, "-t", durationSec.toFixed(3)];
  if (reframe) {
    args.push("-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");
  }
  args.push(
    "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    output,
  );
  return args;
}

async function processJob(job) {
  log(`job ${job.id} start: ${job.sourceUrl} (clips=${job.requestedClips})`);
  const workDir = path.join(os.tmpdir(), "kartawarta-yt", job.id);
  await mkdir(workDir, { recursive: true });
  await mkdir(UPLOAD_DIR, { recursive: true });
  const sourcePath = path.join(workDir, "source.mp4");
  const audioPath = path.join(workDir, "audio.wav");
  const resultContentIds = [];

  try {
    // 1) DOWNLOAD
    await setStage(job.id, "DOWNLOADING", 10);
    const ytArgs = [
      "-f", "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best",
      "--no-playlist", "--merge-output-format", "mp4",
    ];
    // YouTube blocks datacenter IPs with a bot-check; a cookies file from a
    // logged-in session is required to download. Set YTDLP_COOKIES to its path.
    if (process.env.YTDLP_COOKIES) ytArgs.push("--cookies", process.env.YTDLP_COOKIES);
    ytArgs.push("-o", sourcePath, job.sourceUrl);
    await run(YTDLP, ytArgs);
    await stat(sourcePath); // throws if download produced nothing

    // 2) TRANSCRIBE
    await setStage(job.id, "TRANSCRIBING", 35);
    await run(FFMPEG, ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", audioPath]);
    const dgKey = await getDeepgramKey();
    const deepgramJson = await deepgramTranscribe(audioPath, dgKey);

    // 3) SELECT (delegated to tested TS libs + callAI)
    await setStage(job.id, "SELECTING", 60);
    const clips = await selectClips(deepgramJson, job);
    if (!clips.length) {
      throw new Error("AI tidak menemukan potongan layak dari transkrip video ini.");
    }

    // 4) CUT each clip → vertical mp4
    await setStage(job.id, "CUTTING", 75);
    const cut = [];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const durationMs = Math.max(SLOT_MIN_MS, Math.min(SLOT_MAX_MS, c.durationMs));
      const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.mp4`;
      const outPath = path.join(UPLOAD_DIR, filename);
      await run(
        FFMPEG,
        cutArgs(sourcePath, c.startMs / 1000, durationMs / 1000, outPath, job.reframe),
        { timeoutMs: 10 * 60_000 },
      );
      const st = await stat(outPath).catch(() => null);
      if (!st || st.size === 0) continue; // skip a clip that failed to encode
      cut.push({ ...c, url: `/uploads/tiktok-media/${filename}`, filename, durationMs, size: st.size });
    }
    if (!cut.length) throw new Error("Semua potongan gagal di-encode oleh FFmpeg.");

    // 5) CREATE DRAFT TiktokContents (one standalone short per clip)
    await setStage(job.id, "CREATING_CONTENTS", 90);
    const baseTitle = (job.videoTitle || "Klip YouTube").slice(0, 120);
    for (let i = 0; i < cut.length; i++) {
      const c = cut[i];
      const content = await prisma.tiktokContent.create({
        data: {
          title: `${baseTitle} — Klip ${i + 1}`,
          caption: c.hookCaption || null,
          hashtags: "",
          aspectRatio: "PORTRAIT_9_16",
          status: "DRAFT",
          accountId: job.accountId || null,
          sourceVideoUrl: job.sourceUrl,
          sourceClipJobId: job.id,
          createdById: job.requestedById,
          createdByName: job.requestedByName || "youtube-clipper",
          slots: {
            create: {
              order: 0,
              kind: "VIDEO",
              url: c.url,
              filename: c.filename,
              mimeType: "video/mp4",
              durationMs: c.durationMs,
              trimStartMs: 0,
              trimEndMs: null,
              caption: c.hookCaption || null,
              size: c.size,
            },
          },
        },
        select: { id: true },
      });
      resultContentIds.push(content.id);
    }

    await prisma.youtubeClipJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        stage: "CREATING_CONTENTS",
        progress: 100,
        resultContentIds,
        clipCount: resultContentIds.length,
        finishedAt: new Date(),
        errorMessage: null,
      },
    });
    log(`job ${job.id} done: ${resultContentIds.length} DRAFT contents`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`job ${job.id} FAILED: ${msg}`);
    await prisma.youtubeClipJob
      .update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: msg.slice(0, 1000),
          resultContentIds, // keep any that were created before failure
          clipCount: resultContentIds.length,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function tick() {
  try {
    await reclaimStale();
    const job = await claimNext();
    if (job) await processJob(job);
  } catch (e) {
    log("tick error:", e instanceof Error ? e.message : String(e));
  }
}

let running = false;
async function loop() {
  if (running) return;
  running = true;
  try {
    await tick();
  } finally {
    running = false;
  }
}

log(`worker ${WORKER_ID} started; polling every ${POLL_INTERVAL_MS}ms; app=${APP_URL}`);
setInterval(loop, POLL_INTERVAL_MS);

async function shutdown() {
  log("shutting down");
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
