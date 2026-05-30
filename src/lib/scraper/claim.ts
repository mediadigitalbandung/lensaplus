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
 *   claimUrl()    → reserve (status CLAIMED) or refuse (taken / in-flight)
 *   finalizeClaim → mark DONE + attach the draft articleId
 *   releaseClaim  → scrape failed; delete the row so anyone may retry
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
 * was already taken (done) or is being scraped by someone else.
 */
export async function claimUrl(opts: {
  url: string;
  sourceId: string;
  userId: string;
}): Promise<ClaimResult> {
  const { url, sourceId, userId } = opts;

  const existing = await prisma.scrapedUrl.findUnique({ where: { url } });
  if (existing) {
    if (existing.status === "DONE") {
      return { ok: false, reason: "already-scraped" };
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
 * Return the subset of `urls` that are already claimed (CLAIMED or DONE),
 * mapped to who took them + status. Used to pre-filter candidates and to
 * annotate the preview so writers can see what's already been grabbed.
 */
export async function getClaimsForUrls(urls: string[]): Promise<
  Map<string, { status: string; scrapedByName: string | null }>
> {
  if (urls.length === 0) return new Map();
  const rows = await prisma.scrapedUrl.findMany({
    where: { url: { in: urls } },
    select: {
      url: true,
      status: true,
      scrapedBy: { select: { name: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.url,
      { status: r.status, scrapedByName: r.scrapedBy?.name ?? null },
    ]),
  );
}
