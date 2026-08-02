# Lensaplus LLM Prompt Engineering & Routing Pipeline

Dokumen ini memuat spesifikasi prompt dan routing model AI untuk **AI Workflow Orchestrator Agent**.

---

## 1. Perplexity AI Prompt Template (`sonar-pro`)

```text
Lakukan riset mendalam mengenai perkembangan berita terkini di Kota Bandung/Jawa Barat tentang topik: "{KEYWORD}".
Kumpulkan fakta terkonfirmasi, angka statistik resmi, kutipan narasumber, dan minimal 3 sumber outlet berita Indonesia (seperti Kompas, Detik, Tempo, Antara, Pikiran Rakyat).
Format luaran:
1. Judul Berita SEO-friendly (maks 110 karakter)
2. Lead berita 5W+1H (1-2 kalimat)
3. Isi berita berparagraf HTML (<p>, <h2>, <blockquote>, <ul>)
4. Label Verifikasi (VERIFIED/UNVERIFIED)
5. Daftar sumber rujukan URL
```

---

## 2. Model Routing Matrix

| Tugas AI | Model Utama | Fallback Model | Target Latensi |
|---|---|---|---|
| Riset Live Web News | Perplexity `sonar-pro` | Perplexity `sonar` | < 25 detik |
| Extraksi Meta SEO & Tags | DeepSeek V3 / Claude 3.5 | GPT-4o-mini | < 5 detik |
| Rangkuman Berita Pintar | Claude 3.5 Sonnet | DeepSeek V3 | < 12 detik |

---

## 3. Log Audit AI (`/panel/ai-log`)

- Pencatatan `promptTokens`, `completionTokens`, `totalCostUsd`, dan `executionMs` pada setiap panggialn API.
