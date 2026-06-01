/**
 * Saved background-music library for Reels.
 *
 * Persisted as a JSON array in SystemSetting (`reel_bgm_library`) so uploaded
 * tracks can be re-selected across Reels without re-uploading. Not a secret
 * (just public /uploads URLs + display names), so it is stored unencrypted.
 */

import { prisma } from "@/lib/prisma";

const KEY = "reel_bgm_library";
const MAX_TRACKS = 100;

export interface BgmTrack {
  url: string;
  name: string;
  savedAt: string;
}

export async function getBgmLibrary(): Promise<BgmTrack[]> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (!row?.value) return [];
    const arr = JSON.parse(row.value);
    return Array.isArray(arr) ? (arr as BgmTrack[]) : [];
  } catch {
    return [];
  }
}

async function save(tracks: BgmTrack[]): Promise<void> {
  const value = JSON.stringify(tracks.slice(0, MAX_TRACKS));
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  });
}

export async function addBgmTrack(track: BgmTrack): Promise<BgmTrack[]> {
  const tracks = await getBgmLibrary();
  if (!tracks.some((t) => t.url === track.url)) tracks.unshift(track);
  await save(tracks);
  return tracks;
}

export async function removeBgmTrack(url: string): Promise<BgmTrack[]> {
  const tracks = (await getBgmLibrary()).filter((t) => t.url !== url);
  await save(tracks);
  return tracks;
}
