# TikTok Automation — Plan & Ops Notes

Status: **Fase 1 selesai** (2026-04-26). Dokumen ini menjadi sumber tunggal untuk melanjutkan Fase 2 (auto render via Hyperframes) dan Fase 3 (auto post via TikTok Content Posting API) di sesi berikutnya.

---

## 1. Overview tujuan akhir

User (staff redaksi) cukup:
1. Upload foto/video ke panel TikTok.
2. Atur caption + hashtag (atau biarkan AI generate).
3. Pilih akun TikTok dan jadwal posting.
4. Klik **Publish** — sistem otomatis render video (template Hyperframes), upload ke TikTok via API, set jadwal/post.

Editor mode (manual edit) tetap tersedia untuk overlay teks, BGM, transisi, dsb.

---

## 2. Arsitektur

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser (Next.js panel)                                            │
│   /panel/tiktok          – list konten                             │
│   /panel/tiktok/baru     – create                                  │
│   /panel/tiktok/[id]     – editor (slots / caption / music / etc.) │
│   /panel/tiktok/akun     – manajemen akun                          │
│   /panel/tiktok/template – browse template                         │
└────────────────────────────────────────────────────────────────────┘
            │ fetch
┌────────────────────────────────────────────────────────────────────┐
│ Next.js API (src/app/api/tiktok/*)                                 │
│   /upload                                – simpan ke /public/uploads│
│   /accounts, /accounts/[id]              – manajemen akun           │
│   /contents, /contents/[id]              – CRUD konten              │
│   /contents/[id]/slots, /slots/[slotId]  – slot media               │
│   /contents/[id]/export                  – manifest JSON (Fase 1)   │
│   /contents/[id]/render                  – Fase 2 stub (501)        │
│   /contents/[id]/publish                 – Fase 3 stub (501)        │
│   /templates                             – list/CRUD template       │
└────────────────────────────────────────────────────────────────────┘
            │ Prisma
┌────────────────────────────────────────────────────────────────────┐
│ PostgreSQL                                                          │
│   tiktok_accounts                                                   │
│   tiktok_contents                                                   │
│   tiktok_media_slots                                                │
│   tiktok_templates                                                  │
│   tiktok_render_jobs                                                │
└────────────────────────────────────────────────────────────────────┘

(Fase 2, terpisah dari Next.js process)
┌────────────────────────────────────────────────────────────────────┐
│ Render worker (Node 22 + Puppeteer + FFmpeg)                       │
│   PM2 process: kartawarta-tiktok-render                            │
│   loop: poll TiktokRenderJob WHERE status='QUEUED'                 │
│        → fetch content + slots                                     │
│        → run Hyperframes against template HTML                     │
│        → upload MP4 ke /public/uploads/tiktok-output/              │
│        → update content.outputUrl + status='READY'                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data model (sudah ada di prisma/schema.prisma)

| Tabel | Fungsi |
|---|---|
| `tiktok_accounts` | Akun TikTok yang terhubung. Token field disiapkan untuk Fase 3. |
| `tiktok_contents` | 1 row per konten TikTok. Punya status lifecycle penuh. |
| `tiktok_media_slots` | Asset per konten (foto/video) dengan urutan, durasi, trim, caption per-slot. |
| `tiktok_templates` | Daftar template Hyperframes — hanya aktif Fase 2. |
| `tiktok_render_jobs` | Antrean render — Fase 2. |

Enum penting:
- `TiktokContentStatus` — `DRAFT → READY → RENDERING → SCHEDULED → PUBLISHING → PUBLISHED` (plus error/archived states).
- `TiktokAspectRatio` — `PORTRAIT_9_16` (default TikTok feed) atau `SQUARE_1_1`.
- `TiktokMediaKind` — `IMAGE` atau `VIDEO`.

---

## 4. Fase 1 — sudah selesai (sesi 2026-04-26)

**Yang sudah jalan:**
- Skema database lengkap (5 tabel TikTok).
- Panel UI:
  - List konten dengan filter status/search dan thumbnail.
  - Form create dengan pilihan akun/template/aspek.
  - Editor 3-kolom: slot list, preview, settings tabs (Caption / Musik / Overlay / Publikasi).
  - Manajemen akun manual (placeholder — akan diganti OAuth Fase 3).
  - Browser template (read-only sampai Fase 2).
- API CRUD konten + slot.
- Upload media (image/video/audio) ke `/uploads/tiktok-media/` dan `/uploads/tiktok-bgm/` dengan validasi format & size sesuai TikTok specs.
- Export manifest JSON: `GET /api/tiktok/contents/:id/export` → file siap pakai untuk edit manual di CapCut.
- Endpoint render & publish return 501 dengan pesan jelas.
- Sidebar entry "TikTok" untuk role EDITOR ke atas.

**Workflow user di Fase 1:**
1. Buka `/panel/tiktok` → "Buat Konten".
2. Upload media slot satu per satu, atur durasi.
3. Tulis caption + hashtag, set BGM kalau perlu.
4. Klik **Export** → unduh `tiktok-{id}.json` berisi semua URL media + caption final.
5. Edit manual di CapCut/aplikasi TikTok, upload sendiri.

---

## 5. Fase 2 — auto render via Hyperframes

### Prasyarat infra

Di VPS (`ssh root@145.79.15.99`):
```bash
# Upgrade Node ke 22+ (Hyperframes butuh)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install FFmpeg
apt install -y ffmpeg

# Chromium dependencies untuk Puppeteer
apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libxss1 libasound2t64 libpangocairo-1.0-0 libpango-1.0-0 \
  libgtk-3-0 libgconf-2-4 fonts-liberation
```

Ekspektasi resource: render 30s @1080×1920 ≈ 1-3 menit di VPS shared, ~600-900MB RAM peak. **Wajib jalan di proses terpisah** (PM2 process kedua) supaya tidak ganggu Next.js production.

### Library

```bash
cd /var/www/kartawarta
npm install @heygen/hyperframes puppeteer fluent-ffmpeg
```

### Struktur file template

```
templates/tiktok/
  ├── kronologi/
  │   ├── index.html        # template Hyperframes (HTML+CSS+anim)
  │   ├── thumbnail.jpg
  │   └── meta.json         # { minSlots, maxSlots, etc. }
  ├── analisis/
  └── ...
```

Tiap template:
- Membaca slot data dari `window.__SLOTS__` (di-inject oleh worker).
- Pakai data attributes Hyperframes (`data-frame-start`, `data-frame-duration`).
- Output ratio fix sesuai `aspectRatio`.

### Worker process

File baru: `tools/tiktok-render-worker.mjs`

```js
// Pseudocode
import { PrismaClient } from '@prisma/client';
import { renderToMp4 } from '@heygen/hyperframes';
import path from 'path';
import { writeFile } from 'fs/promises';

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = 5000;

async function tick() {
  const job = await prisma.tiktokRenderJob.findFirst({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return;

  await prisma.tiktokRenderJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', startedAt: new Date(), workerId: process.env.HOSTNAME },
  });

  try {
    const content = await prisma.tiktokContent.findUnique({
      where: { id: job.contentId },
      include: { slots: { orderBy: { order: 'asc' } } },
    });
    const tplPath = path.join(process.cwd(), 'templates', 'tiktok', content.templateKey, 'index.html');
    const outPath = path.join(process.cwd(), 'public', 'uploads', 'tiktok-output', `${content.id}.mp4`);

    await renderToMp4(tplPath, outPath, {
      data: {
        slots: content.slots,
        caption: content.caption,
        bgmUrl: content.bgmUrl,
        bgmVolume: content.bgmVolume,
        overlay: content.overlayJson,
      },
      width: content.aspectRatio === 'PORTRAIT_9_16' ? 1080 : 1080,
      height: content.aspectRatio === 'PORTRAIT_9_16' ? 1920 : 1080,
      fps: 30,
    });

    await prisma.tiktokContent.update({
      where: { id: content.id },
      data: {
        outputUrl: `/uploads/tiktok-output/${content.id}.mp4`,
        status: 'READY',
      },
    });
    await prisma.tiktokRenderJob.update({
      where: { id: job.id },
      data: { status: 'SUCCEEDED', finishedAt: new Date(), outputUrl: `/uploads/tiktok-output/${content.id}.mp4` },
    });
  } catch (err) {
    await prisma.tiktokRenderJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(err) },
    });
    await prisma.tiktokContent.update({
      where: { id: job.contentId },
      data: { status: 'RENDER_FAILED' },
    });
  }
}

setInterval(tick, POLL_INTERVAL_MS);
```

PM2 ecosystem entry:
```js
// ecosystem.config.js
module.exports = {
  apps: [
    { name: 'kartawarta', script: 'node_modules/.bin/next', args: 'start' },
    { name: 'kartawarta-tiktok-render', script: 'tools/tiktok-render-worker.mjs', max_memory_restart: '1G' },
  ],
};
```

### Update API stub

File `src/app/api/tiktok/contents/[id]/render/route.ts` ganti body dari 501 menjadi:
1. Validasi `slots.length >= template.minSlots` dan `<= template.maxSlots`.
2. Pastikan `templateKey` ada dan template aktif.
3. `prisma.tiktokRenderJob.create({ data: { contentId: params.id, status: 'QUEUED' } })`.
4. Update `content.status = 'RENDERING'`.
5. Return `{ jobId, queued: true }`.

UI editor sudah punya tombol "Render Otomatis" — saat 501 hilang dan job ID muncul, tampilkan progress dari polling `GET /api/tiktok/contents/[id]` yang return `renderJobs[0]` terbaru.

### Estimasi effort
~2-3 sesi Claude Code (1 sesi: install infra + worker scaffold; 1 sesi: 2-3 template HTML; 1 sesi: integrasi end-to-end + testing).

---

## 6. Fase 3 — auto post via TikTok Content Posting API

### Prasyarat business

1. **Daftar app di TikTok for Developers**
   - <https://developers.tiktok.com/>
   - Pilih kategori: "Media & News" atau "Content Publishing"
   - Domain: kartawarta.com
   - Privacy policy: kartawarta.com/privasi
   - Terms: kartawarta.com/syarat-ketentuan

2. **Apply audit `video.publish` scope**
   - Tanpa audit, semua post otomatis = `PRIVATE_TO_SELF` (cuma kelihatan di akun yg post, ga publik).
   - Audit butuh: demo video pakai API, screenshot UI, jelaskan use case (otomasi konten redaksi).
   - Timeline: ~1-4 minggu, kadang ada revisi.

3. **Catat credentials** ke `SystemSetting` table (atau env file di VPS):
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - Redirect URL: `https://kartawarta.com/api/tiktok/oauth/callback`

### OAuth flow

Endpoint baru:
- `GET /api/tiktok/oauth/authorize` — redirect ke TikTok auth screen dengan scope `user.info.basic,video.upload,video.publish`.
- `GET /api/tiktok/oauth/callback` — terima code, exchange jadi access+refresh token, simpan ke `tiktok_accounts`.
- `POST /api/tiktok/oauth/refresh` — refresh token expired (auto-call dari publish endpoint).

Library: pakai `fetch` saja, atau `tiktok-business-api-sdk` kalau ada (cek dulu lisensi).

### Posting flow

`POST /api/tiktok/contents/:id/publish` (replace stub):

1. Validasi: `content.outputUrl` ada (sudah render Fase 2), `content.account.status === 'CONNECTED'`, token belum expired (refresh jika perlu).
2. POST `https://open.tiktokapis.com/v2/post/publish/video/init/` dengan:
   ```json
   {
     "post_info": {
       "title": "<finalCaption>",
       "privacy_level": "PUBLIC_TO_EVERYONE",
       "disable_duet": false,
       "disable_comment": false,
       "disable_stitch": false,
       "video_cover_timestamp_ms": 1000
     },
     "source_info": {
       "source": "FILE_UPLOAD",
       "video_size": <bytes>,
       "chunk_size": 10485760,
       "total_chunk_count": <ceil(video_size / 10MB)>
     }
   }
   ```
3. Server return `upload_url` + `publish_id` — stream upload chunks per spec.
4. Poll `GET /v2/post/publish/status/fetch/?publish_id=...` setiap 5 detik sampai `status=PUBLISH_COMPLETE`.
5. Simpan `platformPostId` dari response, set `content.status='PUBLISHED'`, `publishedAt=now()`.

### Cron untuk scheduled posts

Endpoint baru `POST /api/cron/tiktok-publish` (jaga dengan `verifyCronSecret`):
- Query content WHERE `status='SCHEDULED'` AND `scheduledAt <= now()` → call publish flow.
- Tambah ke `crontab` VPS: `*/5 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://kartawarta.com/api/cron/tiktok-publish`.

### Update UI

`/panel/tiktok/akun`:
- Ganti form manual jadi tombol **"Connect dengan TikTok"** → window popup OAuth.
- Setelah callback, refresh list — tampil avatar + display name asli dari TikTok.

Editor `Publikasi` tab:
- Tombol "Posting ke TikTok" jadi aktif setelah `content.outputUrl` ada (render Fase 2 selesai) DAN `accountId` dipilih.

### Estimasi effort

~2-3 sesi setelah audit lulus.

---

## 7. Variabel lingkungan baru

Tambah ke `.env` di VPS (jangan commit):

```
# TikTok (Fase 3)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://kartawarta.com/api/tiktok/oauth/callback
TIKTOK_SANDBOX=true   # set false setelah audit lulus
```

Sentinel guard di `src/lib/tiktok/api.ts` (Fase 3): kalau env kosong, semua route OAuth/publish return 503 dengan pesan jelas.

---

## 8. Checklist pra-launch Fase 2 & 3

### Fase 2
- [ ] VPS upgrade Node 22, install ffmpeg + chromium deps
- [ ] `npm install @heygen/hyperframes puppeteer fluent-ffmpeg`
- [ ] Author minimal 3 template HTML di `templates/tiktok/`
- [ ] Tulis worker `tools/tiktok-render-worker.mjs`
- [ ] Update PM2 ecosystem dengan worker process
- [ ] Replace 501 di `/api/tiktok/contents/[id]/render` dengan job-queue logic
- [ ] Test render 1 konten end-to-end
- [ ] Tambah pengamatan worker di sentry / pm2 logs

### Fase 3
- [ ] Daftarkan app di TikTok for Developers
- [ ] Submit audit `video.publish`
- [ ] Tambah env vars TikTok ke VPS
- [ ] Implement `/api/tiktok/oauth/authorize` + `/callback`
- [ ] Replace 501 di `/api/tiktok/contents/[id]/publish` dengan upload + status poll
- [ ] Implement `/api/cron/tiktok-publish` untuk scheduled posts
- [ ] Tambah crontab entry di VPS
- [ ] Update `/panel/tiktok/akun` jadi OAuth-based
- [ ] E2E test: posting konten ke akun TikTok dummy

---

## 9. Spec TikTok Content Posting API (referensi cepat)

| Item | Limit |
|---|---|
| Caption (title) | 2200 char |
| Hashtag | 100 hashtag/post, 100 char/hashtag |
| Video size | 287.6 MB max (kita cap 100 MB) |
| Video duration | 60 menit max (kita cap 10 menit di Fase 2) |
| Video format | MP4, H.264 (kita encode dari Hyperframes) |
| Aspect | 9:16 atau 1:1 |
| FPS | 23-60 |
| Resolution | min 540×960, max 4K |
| Privacy (unaudited) | `SELF_ONLY` (private) only |
| Privacy (audited) | `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `SELF_ONLY` |

Sumber: <https://developers.tiktok.com/doc/content-posting-api-reference-direct-post/>

---

## 10. Catatan keamanan

- Token TikTok di `tiktok_accounts.accessToken` & `refreshToken` — keduanya `@db.Text`. Pertimbangkan encryption-at-rest pakai `crypto.createCipheriv` dengan kunci di env (sudah pattern ini dipakai untuk InstagramSettings).
- Render worker tulis ke `/public/uploads/tiktok-output/` — file MP4 bisa puluhan MB. Tambah cron untuk hapus file >30 hari.
- Rate limit `/api/tiktok/upload` per user (sudah ada `apiRateLimit` di `src/lib/rate-limit.ts` — wajib pasang).
- Audit log tiap publish/render attempt sudah otomatis via `logAudit` di route.

---

## 11. Memori untuk sesi berikutnya

Saat user bilang **"lanjut tiktok fase 2"**:
1. Cek dokumen ini.
2. Cek prasyarat infra di VPS (`node -v`, `which ffmpeg`).
3. Mulai dari install deps → tulis 1 template sampel → worker scaffold.

Saat user bilang **"lanjut tiktok fase 3"**:
1. Pastikan Fase 2 sudah jalan (`outputUrl` ada di salah satu konten).
2. Tanya dulu: "Apakah audit `video.publish` sudah lulus? Sudah ada CLIENT_KEY?".
3. Jika ya → mulai dari OAuth callback → publish endpoint → cron.
