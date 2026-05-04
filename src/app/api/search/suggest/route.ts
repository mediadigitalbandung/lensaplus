import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/search/suggest?q=keyword — returns top 5 matching article titles
export async function GET(request: NextRequest) {
  try {
    // Rate limit per IP — endpoint is unauthenticated and runs a Prisma
    // contains-query, which is cheap individually but trivial to abuse for
    // database scanning if left unbounded.
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { success: allowed } = apiRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").slice(0, 100);

    if (query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        title: { contains: query, mode: "insensitive" },
      },
      select: {
        title: true,
        slug: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    });

    return NextResponse.json({ success: true, data: articles });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil saran pencarian" },
      { status: 500 }
    );
  }
}
