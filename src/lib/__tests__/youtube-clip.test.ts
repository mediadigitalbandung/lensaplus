import { describe, it, expect } from "vitest";
import {
  extractYouTubeId,
  isValidYouTubeVideoUrl,
  canonicalYouTubeUrl,
} from "@/lib/youtube/video-url";
import {
  parseClipSelection,
  validateAndMapClips,
  buildClipSelectionPrompt,
  chunkSegments,
  mergeClipPlans,
  type TranscriptSegment,
  type ClipPlan,
} from "@/lib/youtube/clip-select";
import {
  buildClipArgs,
  buildReframeFilter,
  buildAudioExtractArgs,
} from "@/lib/youtube/ffmpeg-args";
import { normalizeDeepgramResponse } from "@/lib/youtube/transcription";

describe("video-url.extractYouTubeId", () => {
  it("parses watch URLs", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
  });
  it("parses youtu.be, shorts, embed, live", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("accepts a bare 11-char id", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("rejects non-YouTube / malformed", () => {
    expect(extractYouTubeId("https://vimeo.com/12345")).toBeNull();
    expect(extractYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(extractYouTubeId("not a url")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
  });
  it("isValid + canonical helpers", () => {
    expect(isValidYouTubeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeVideoUrl("https://example.com")).toBe(false);
    expect(canonicalYouTubeUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

const SEGMENTS: TranscriptSegment[] = [
  { idx: 0, start: 0, end: 5, text: "Halo selamat datang." },
  { idx: 1, start: 5, end: 12, text: "Hari ini kita bahas ekonomi Bandung." },
  { idx: 2, start: 12, end: 20, text: "Inflasi naik tajam bulan ini." },
  { idx: 3, start: 20, end: 28, text: "Pemerintah merespons dengan kebijakan baru." },
  { idx: 4, start: 28, end: 40, text: "Dampaknya besar bagi pelaku UMKM." },
];

describe("clip-select.parseClipSelection", () => {
  it("parses clean JSON", () => {
    const text = '{"clips":[{"segmentStartIdx":1,"segmentEndIdx":2,"hookCaption":"Inflasi melonjak!","viralityScore":85}]}';
    const out = parseClipSelection(text);
    expect(out).toHaveLength(1);
    expect(out[0].segmentStartIdx).toBe(1);
    expect(out[0].hookCaption).toBe("Inflasi melonjak!");
  });
  it("strips markdown fences + surrounding prose", () => {
    const text = 'Berikut hasilnya:\n```json\n{"clips":[{"segmentStartIdx":0,"segmentEndIdx":1,"hookCaption":"Hook","viralityScore":50}]}\n```\nSemoga membantu.';
    expect(parseClipSelection(text)).toHaveLength(1);
  });
  it("returns [] on garbage", () => {
    expect(parseClipSelection("maaf saya tidak bisa")).toEqual([]);
    expect(parseClipSelection("")).toEqual([]);
    expect(parseClipSelection('{"clips": "nope"}')).toEqual([]);
  });
});

describe("clip-select.validateAndMapClips", () => {
  it("maps indices to real ms and clamps duration", () => {
    const raw = parseClipSelection('{"clips":[{"segmentStartIdx":1,"segmentEndIdx":2,"hookCaption":"Inflasi!","viralityScore":80}]}');
    const plans = validateAndMapClips(raw, SEGMENTS, { count: 3 });
    expect(plans).toHaveLength(1);
    expect(plans[0].startMs).toBe(5000); // seg1.start
    expect(plans[0].endMs).toBe(20000); // seg2.end
    expect(plans[0].durationMs).toBe(15000);
    expect(plans[0].score).toBe(80);
  });
  it("trims clips longer than 30s to the max", () => {
    const raw = [{ segmentStartIdx: 0, segmentEndIdx: 4, hookCaption: "x", viralityScore: 90 }];
    const [p] = validateAndMapClips(raw, SEGMENTS, { count: 1 });
    expect(p.durationMs).toBe(30000); // clamped from 40s
    expect(p.startMs).toBe(0);
    expect(p.endMs).toBe(30000);
  });
  it("drops invalid indices, empty captions, and de-overlaps by score", () => {
    const raw = [
      { segmentStartIdx: 0, segmentEndIdx: 2, hookCaption: "A", viralityScore: 60 }, // 0-20s
      { segmentStartIdx: 1, segmentEndIdx: 3, hookCaption: "B", viralityScore: 90 }, // 5-28s overlaps A
      { segmentStartIdx: 99, segmentEndIdx: 100, hookCaption: "C", viralityScore: 99 }, // bad idx
      { segmentStartIdx: 4, segmentEndIdx: 4, hookCaption: "", viralityScore: 50 }, // empty caption
    ];
    const plans = validateAndMapClips(raw, SEGMENTS, { count: 5 });
    // Highest-score non-overlapping wins: B (90). A overlaps B → dropped.
    expect(plans).toHaveLength(1);
    expect(plans[0].hookCaption).toBe("B");
  });
  it("respects the count cap and returns chronological order", () => {
    const raw = [
      { segmentStartIdx: 0, segmentEndIdx: 0, hookCaption: "first", viralityScore: 70 },
      { segmentStartIdx: 2, segmentEndIdx: 2, hookCaption: "third", viralityScore: 95 },
      { segmentStartIdx: 4, segmentEndIdx: 4, hookCaption: "fifth", viralityScore: 80 },
    ];
    const plans = validateAndMapClips(raw, SEGMENTS, { count: 2 });
    expect(plans).toHaveLength(2);
    // chosen by score: third(95), fifth(80); chronological → third before fifth
    expect(plans.map((p) => p.hookCaption)).toEqual(["third", "fifth"]);
  });
});

describe("clip-select.buildClipSelectionPrompt", () => {
  it("includes numbered segments and the JSON contract", () => {
    const { system, user } = buildClipSelectionPrompt(SEGMENTS, { count: 3, videoTitle: "Ekonomi Bandung" });
    expect(system).toContain("JSON");
    expect(system).toContain("segmentStartIdx");
    expect(user).toContain("[0]");
    expect(user).toContain("Ekonomi Bandung");
    expect(user).toContain("Inflasi naik tajam");
  });
});

describe("clip-select.chunkSegments", () => {
  it("returns a single chunk when under budget", () => {
    expect(chunkSegments(SEGMENTS, 28000)).toHaveLength(1);
  });
  it("splits long transcripts into multiple time-contiguous chunks", () => {
    const many: TranscriptSegment[] = Array.from({ length: 50 }, (_, i) => ({
      idx: i,
      start: i * 5,
      end: i * 5 + 5,
      text: "x".repeat(200),
    }));
    const chunks = chunkSegments(many, 1000); // ~216 chars/seg → ~4 segs/chunk
    expect(chunks.length).toBeGreaterThan(1);
    // every segment is preserved exactly once, in order
    const flat = chunks.flat();
    expect(flat).toHaveLength(50);
    expect(flat.map((s) => s.idx)).toEqual(many.map((s) => s.idx));
    // chunks are non-empty
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });
});

describe("clip-select.mergeClipPlans", () => {
  const mk = (startMs: number, score: number): ClipPlan => ({
    startMs,
    endMs: startMs + 5000,
    durationMs: 5000,
    hookCaption: `c${startMs}`,
    score,
    reason: "",
  });
  it("keeps top-N by score but returns chronological order", () => {
    const merged = mergeClipPlans([mk(0, 50), mk(10000, 95), mk(20000, 70)], 2);
    expect(merged).toHaveLength(2);
    // top-2 by score = 95 + 70; chronological → 10000 before 20000
    expect(merged.map((c) => c.startMs)).toEqual([10000, 20000]);
  });
});

describe("ffmpeg-args", () => {
  it("buildReframeFilter centre-crops to 9:16 by default", () => {
    expect(buildReframeFilter()).toBe(
      "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    );
  });
  it("buildClipArgs seeks, trims, reframes, and re-encodes", () => {
    const args = buildClipArgs({ input: "in.mp4", startSec: 5, durationSec: 15, output: "out.mp4", reframe: true });
    expect(args).toContain("-ss");
    expect(args[args.indexOf("-ss") + 1]).toBe("5.000");
    expect(args).toContain("-t");
    expect(args[args.indexOf("-t") + 1]).toBe("15.000");
    expect(args).toContain("-vf");
    expect(args).toContain("libx264");
    expect(args[args.length - 1]).toBe("out.mp4");
  });
  it("buildClipArgs omits -vf when not reframing and no subtitles", () => {
    const args = buildClipArgs({ input: "in.mp4", startSec: 0, durationSec: 10, output: "o.mp4" });
    expect(args).not.toContain("-vf");
  });
  it("buildAudioExtractArgs produces mono 16k wav", () => {
    const args = buildAudioExtractArgs("in.mp4", "a.wav");
    expect(args).toContain("-ar");
    expect(args[args.indexOf("-ar") + 1]).toBe("16000");
    expect(args).toContain("-ac");
    expect(args[args.indexOf("-ac") + 1]).toBe("1");
  });
});

describe("transcription.normalizeDeepgramResponse", () => {
  const dg = {
    metadata: { detected_language: "id" },
    results: {
      channels: [
        {
          alternatives: [
            {
              words: [
                { punctuated_word: "Halo", start: 0.0, end: 0.5 },
                { punctuated_word: "dunia.", start: 0.5, end: 1.0 },
                { punctuated_word: "Ekonomi", start: 1.0, end: 1.6 },
                { punctuated_word: "naik.", start: 1.6, end: 2.2 },
              ],
            },
          ],
        },
      ],
    },
  };
  it("groups words into sentence segments on punctuation", () => {
    const t = normalizeDeepgramResponse(dg);
    expect(t.language).toBe("id");
    expect(t.words).toHaveLength(4);
    expect(t.segments).toHaveLength(2);
    expect(t.segments[0].text).toBe("Halo dunia.");
    expect(t.segments[0].start).toBe(0);
    expect(t.segments[0].end).toBe(1.0);
    expect(t.segments[1].idx).toBe(1);
    expect(t.segments[1].text).toBe("Ekonomi naik.");
  });
  it("is safe on empty / malformed input", () => {
    expect(normalizeDeepgramResponse({}).segments).toEqual([]);
    expect(normalizeDeepgramResponse(null).words).toEqual([]);
  });
});
