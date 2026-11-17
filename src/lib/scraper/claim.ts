/**
 * Global, cross-source claim/lock for scraped upstream URLs.
 *
 * Why: scraping is now open to EVERY writer role (not just admins). Two
 * writers can open the same source — or two different sources that list
 * the same article — and click "Generate" at the same moment. Without a
 * global lock that race produces two identical drafts ("bentrok").
 *
 * How: `ScrapedUrl.url` is `@unique`. The first `create()` wins; a
 * concurrent `create()` violates the constraint (Prisma P2002) and loses
 * the race. That single DB invariant gives us atomic first-come-first-
 * served claiming with zero application-level locking.
 *
 * Lifecycle per URL:
 *   claimUrl()              → reserve (status CLAIMED) or refuse (taken / in-flight)
 *   finalizeClaim()         → mark DONE + attach the draft articleId
 *   releaseClaim()          → scrape failed; delete the row so anyone may retry
 *   markScrapedUrlsDeleted()→ mark DELETED on article deletion so preview shows
 *                             "Dihapus" and manual retry is permitted without
 *                             cron auto-resurrecting deleted drafts
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * A CLAIMED row older than this with no resulting draft is treated as
 * abandoned (the run that reserved it crashed) and may be taken over.
 * Generous enough to outlast a slow AI paraphrase + image download.
 */
const STALE_CLAIM_MS = 15 * 60 * 1000; // 15 minutes

export type ClaimResult =
  | {
      ok: true;
      claimId: string;
      /**
       * Ownership token = the exact `claimedAt` this claim was stamped with.
       * finalize/release are guarded on it so a caller that has since been
       * taken over (stale claim reclaimed by someone else) can never delete
       * or overwrite the new owner's row.
       */
      claimToken: Date;
    }
  /** Already converted to a draft — never scrape again. */
  | { ok: false; reason: "already-scraped" }
  /** Another writer is scraping it right now (fresh CLAIMED row). */
  | { ok: false; reason: "in-progress" };

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

/**
 * Atomically claim `url` for `userId`. Returns `{ ok: true, claimId }` if
 * this caller now owns the scrape, or `{ ok: false, reason }` if the URL
 * was already taken (active article) or is being scraped by someone else.
 *
 * When `allowRegenerateDeleted` is true (explicit manual click on a deleted
 * item in the preview UI), a `DELETED` claim — or a legacy `DONE` claim whose
 * articleId no longer exists in DB — may be reclaimed and re-generated.
 */
export async function claimUrl(opts: {
  url: string;
  sourceId: string;
  userId: string;
  allowRegenerateDeleted?: boolean;
}): Promise<ClaimResult> {
  const { url, sourceId, userId, allowRegenerateDeleted = false } = opts;

  const existing = await prisma.scrapedUrl.findUnique({ where: { url } });
  if (existing) {
    if (existing.status === "DONE" || existing.status === "DELETED") {
      // Check whether the generated Article still exists in DB. If it's gone
      // (or explicitly marked DELETED), treat as deleted.
      let liveArticleExists = false;
      if (existing.status === "DONE") {
        if (existing.articleId) {
          const art = await prisma.article.findUnique({
            where: { id: existing.articleId },
            select: { id: true },
          });
          liveArticleExists = Boolean(art);
        } else {
          const priorSource = await prisma.source.findFirst({
            where: { url },
            select: { articleId: true },
          });
          liveArticleExists = Boolean(priorSource);
        }
      }

      if (liveArticleExists || !allowRegenerateDeleted) {
        return { ok: false, reason: "already-scraped" };
      }

      // Deleted article + explicit manual regenerate: reclaim atomically.
      const token = new Date();
      const takeover = await prisma.scrapedUrl.updateMany({
        where: { id: existing.id, claimedAt: existing.claimedAt },
        data: {
          status: "CLAIMED",
          scrapedById: userId,
          sourceId,
          articleId: null,
          claimedAt: token,
        },
      });
      if (takeover.count === 0) {
        return { ok: false, reason: "in-progress" };
      }
      return { ok: true, claimId: existing.id, claimToken: token };
    }

    // CLAIMED. Only allow a takeover if the claim is stale (crashed run).
    const age = Date.now() - existing.claimedAt.getTime();
    if (age < STALE_CLAIM_MS) {
      return { ok: false, reason: "in-progress" };
    }
    // Before re-opening a stale claim, make sure the previous run didn't
    // already create a draft for this URL but fail to record it (a
    // finalizeClaim that silently errored). A `Source` row with this URL
    // proves a draft exists — heal the ledger to DONE instead of scraping
    // a duplicate.
    const priorDraft = await prisma.source.findFirst({
      where: { url },
      select: { articleId: true },
    });
    if (priorDraft) {
      await prisma.scrapedUrl.updateMany({
        where: { id: existing.id, claimedAt: existing.claimedAt },
        data: { status: "DONE", articleId: priorDraft.articleId },
      });
      return { ok: false, reason: "already-scraped" };
    }
    // Optimistic takeover: only succeeds if claimedAt is still what we
    // read, so two writers reclaiming the same stale row can't both win.
    // The fresh `token` becomes this caller's ownership token.
    const token = new Date();
    const takeover = await prisma.scrapedUrl.updateMany({
      where: { id: existing.id, claimedAt: existing.claimedAt },
      data: {
        status: "CLAIMED",
        scrapedById: userId,
        sourceId,
        articleId: null,
        claimedAt: token,
      },
    });
    if (takeover.count === 0) {
      return { ok: false, reason: "in-progress" };
    }
    return { ok: true, claimId: existing.id, claimToken: token };
  }

  // Legacy safeguard: even if no ScrapedUrl row exists yet, check if a live
  // Source row already references this upstream URL so legacy drafts don't
  // duplicate.
  const priorSource = await prisma.source.findFirst({
    where: { url },
    select: { articleId: true },
  });
  if (priorSource) {
    return { ok: false, reason: "already-scraped" };
  }

  // No row yet — try to insert. The unique constraint is the lock.
  const token = new Date();
  try {
    const created = await prisma.scrapedUrl.create({
      data: {
        url,
        sourceId,
        scrapedById: userId,
        status: "CLAIMED",
        claimedAt: token,
      },
      select: { id: true },
    });
    return { ok: true, claimId: created.id, claimToken: token };
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Lost the race by microseconds — someone inserted between our
      // findUnique and create.
      return { ok: false, reason: "in-progress" };
    }
    throw e;
  }
}

/**
 * Mark a claim DONE and attach the resulting draft. Ownership-scoped on
 * `claimToken`: if this row was taken over since we claimed it (claimedAt
 * changed), the updateMany matches 0 rows and we leave the new owner alone.
 */
export async function finalizeClaim(
  claimId: string,
  claimToken: Date,
  articleId: string,
): Promise<void> {
  await prisma.scrapedUrl
    .updateMany({
      where: { id: claimId, claimedAt: claimToken },
      data: { status: "DONE", articleId },
    })
    .catch(() => {
      // Non-fatal: the draft already exists; losing the bookkeeping update
      // must not surface as a scrape failure. The takeover path's prior-
      // draft guard prevents a stuck CLAIMED row from causing a duplicate.
    });
}

/**
 * Release a failed claim so the URL becomes available again. Ownership-
 * scoped on `claimToken` so a caller that was already taken over can never
 * delete the new owner's live claim (which would re-open it for duplication).
 */
export async function releaseClaim(
  claimId: string,
  claimToken: Date,
): Promise<void> {
  await prisma.scrapedUrl
    .deleteMany({ where: { id: claimId, claimedAt: claimToken } })
    .catch(() => {
      // Already gone or taken over — nothing to do.
    });
}

/**
 * Mark claim ledger rows as DELETED when an article is deleted so preview
 * reflects the deletion clearly and allows manual regeneration, while still
 * preventing cron auto-scrape from recreating intentionally deleted drafts.
 */
export async function markScrapedUrlsDeleted(
  articleIds: string | string[],
): Promise<void> {
  const ids = Array.isArray(articleIds) ? articleIds : [articleIds];
  if (ids.length === 0) return;
  if (typeof prisma?.scrapedUrl?.updateMany !== "function") return;
  await prisma.scrapedUrl
    .updateMany({
      where: { articleId: { in: ids } },
      data: { status: "DELETED", articleId: null },
    })
    .catch(() => {
      // Non-fatal: preview & claimUrl also cross-check prisma.article directly.
    });
}

export type ScrapedArticleStatus =
  | "CLAIMED"
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED"
  | "DELETED";

export interface ClaimLookupInfo {
  status: string;
  scrapedByName: string | null;
  articleId: string | null;
  articleStatus: ScrapedArticleStatus | null;
  articleSlug: string | null;
  articleTitle: string | null;
  publishedAt: string | null;
}

/**
 * Return claimed / previously scraped URLs enriched with live `Article` state
 * (`DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `REJECTED`, `ARCHIVED`, or
 * `DELETED` when the linked article was deleted).
 */
export async function getClaimsForUrls(
  urls: string[],
): Promise<Map<string, ClaimLookupInfo>> {
  if (urls.length === 0) return new Map();

  const rows = await prisma.scrapedUrl.findMany({
    where: { url: { in: urls } },
    select: {
      url: true,
      status: true,
      articleId: true,
      claimedAt: true,
      scrapedBy: { select: { name: true } },
    },
  });

  const claimByUrl = new Map(rows.map((r) => [r.url, r]));
  const articleIds = Array.from(
    new Set(rows.map((r) => r.articleId).filter((id): id is string => Boolean(id))),
  );

  const liveArticles =
    articleIds.length > 0
      ? await prisma.article.findMany({
          where: { id: { in: articleIds } },
          select: {
            id: true,
            status: true,
            slug: true,
            title: true,
            publishedAt: true,
          },
        })
      : [];
  const articleById = new Map(liveArticles.map((a) => [a.id, a]));

  // Fallback lookup via `Source.url` for legacy scrapes that lack a ScrapedUrl row
  // or whose claim row missed articleId.
  const fallbackUrls = urls.filter((u) => {
    const c = claimByUrl.get(u);
    return !c?.articleId || !articleById.has(c.articleId);
  });
  const sourceFallbackRows =
    fallbackUrls.length > 0
      ? await prisma.source.findMany({
          where: { url: { in: fallbackUrls } },
          select: {
            url: true,
            article: {
              select: {
                id: true,
                status: true,
                slug: true,
                title: true,
                publishedAt: true,
              },
            },
          },
        })
      : [];
  const articleBySourceUrl = new Map<string, (typeof liveArticles)[number]>();
  for (const s of sourceFallbackRows) {
    if (s.url && s.article && !articleBySourceUrl.has(s.url)) {
      articleBySourceUrl.set(s.url, s.article);
    }
  }

  const out = new Map<string, ClaimLookupInfo>();

  for (const url of urls) {
    const claim = claimByUrl.get(url);
    const liveArticle =
      (claim?.articleId ? articleById.get(claim.articleId) : undefined) ??
      articleBySourceUrl.get(url);

    if (liveArticle) {
      out.set(url, {
        status: claim?.status ?? "DONE",
        scrapedByName: claim?.scrapedBy?.name ?? null,
        articleId: liveArticle.id,
        articleStatus: liveArticle.status as ScrapedArticleStatus,
        articleSlug: liveArticle.slug,
        articleTitle: liveArticle.title,
        publishedAt: liveArticle.publishedAt ? liveArticle.publishedAt.toISOString() : null,
      });
      continue;
    }

    if (!claim) continue;

    if (claim.status === "CLAIMED") {
      const age = Date.now() - claim.claimedAt.getTime();
      if (age < STALE_CLAIM_MS) {
        out.set(url, {
          status: "CLAIMED",
          scrapedByName: claim.scrapedBy?.name ?? null,
          articleId: null,
          articleStatus: "CLAIMED",
          articleSlug: null,
          articleTitle: null,
          publishedAt: null,
        });
      }
      // Stale abandoned CLAIMED row with no article: omit so preview treats
      // it as available and claimUrl can safely take over.
      continue;
    }

    // DONE without a live Article (previously deleted), or explicitly DELETED.
    out.set(url, {
      status: "DELETED",
      scrapedByName: claim.scrapedBy?.name ?? null,
      articleId: null,
      articleStatus: "DELETED",
      articleSlug: null,
      articleTitle: null,
      publishedAt: null,
    });
  }

  return out;
}
