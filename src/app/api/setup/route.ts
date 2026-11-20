import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";

function generateSecurePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// GET /api/setup — One-time setup endpoint to seed database
// This will create default categories and admin user
// Protected by a setup key to prevent unauthorized access
export async function GET(request: NextRequest) {
  try {
    const expected = process.env.SETUP_KEY;
    // Hard-disable when SETUP_KEY is not configured. Without this guard,
    // `setupKey === undefined && process.env.SETUP_KEY === undefined`
    // would compare equal and grant access without any key.
    if (!expected || expected.length < 16) {
      throw new ApiError("Setup endpoint disabled", 403);
    }
    // Disable the endpoint entirely once a SUPER_ADMIN exists. Avoids
    // recon (probing whether setup is done) and removes the footgun in prod.
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new ApiError("Setup endpoint disabled", 403);
    }

    const { searchParams } = new URL(request.url);
    const setupKey = searchParams.get("key") || "";

    // Constant-time comparison to defeat timing oracles.
    const provided = Buffer.from(setupKey);
    const target = Buffer.from(expected);
    const ok =
      provided.length === target.length &&
      crypto.timingSafeEqual(provided, target);
    if (!ok) {
      throw new ApiError("Invalid setup key", 403);
    }

    // Create categories
    const categories = [
      { name: "Hukum", slug: "hukum", description: "Berita hukum, peradilan, dan regulasi", order: 1 },
      { name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi", description: "Berita bisnis, ekonomi, dan keuangan", order: 2 },
      { name: "Olahraga", slug: "olahraga", description: "Berita olahraga nasional dan internasional", order: 3 },
      { name: "Hiburan", slug: "hiburan", description: "Entertainment, selebriti, dan budaya pop", order: 4 },
      { name: "Kesehatan", slug: "kesehatan", description: "Berita kesehatan, medis, dan gaya hidup sehat", order: 5 },
      { name: "Pertanian & Peternakan", slug: "pertanian-peternakan", description: "Agrikultur, peternakan, dan ketahanan pangan", order: 6 },
      { name: "Teknologi", slug: "teknologi", description: "Teknologi, digital, startup, dan inovasi", order: 7 },
      { name: "Politik", slug: "politik", description: "Politik, pemerintahan, dan kebijakan publik", order: 8 },
      { name: "Pendidikan", slug: "pendidikan", description: "Pendidikan, akademik, dan riset", order: 9 },
      { name: "Lingkungan", slug: "lingkungan", description: "Isu lingkungan, iklim, dan konservasi", order: 10 },
      { name: "Gaya Hidup", slug: "gaya-hidup", description: "Lifestyle, travel, kuliner, dan tren", order: 11 },
      { name: "Opini", slug: "opini", description: "Opini, analisis, dan kolom", order: 12 },
    ];

    // Generate secure random passwords (never hardcoded) & hash outside transaction
    const adminPlain = generateSecurePassword();
    const editorPlain = generateSecurePassword();
    const journalistPlain = generateSecurePassword();

    const [adminPassword, editorPassword, journalistPassword] = await Promise.all([
      bcrypt.hash(adminPlain, 12),
      bcrypt.hash(editorPlain, 12),
      bcrypt.hash(journalistPlain, 12),
    ]);

    const { admin, editor, journalist } = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction to prevent concurrent /api/setup races
      const raceAdmin = await tx.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      });
      if (raceAdmin) {
        throw new ApiError("Setup endpoint disabled", 403);
      }

      for (const cat of categories) {
        await tx.category.upsert({
          where: { slug: cat.slug },
          update: {},
          create: cat,
        });
      }

      const createdAdmin = await tx.user.create({
        data: {
          email: "admin@lensaplus.com",
          password: adminPassword,
          name: "Super Admin",
          role: "SUPER_ADMIN",
          bio: "Administrator Lensaplus",
        },
      });

      const createdEditor = await tx.user.create({
        data: {
          email: "editor@lensaplus.com",
          password: editorPassword,
          name: "Editor Kepala",
          role: "CHIEF_EDITOR",
          bio: "Editor Kepala Lensaplus",
        },
      });

      const createdJournalist = await tx.user.create({
        data: {
          email: "jurnalis@lensaplus.com",
          password: journalistPassword,
          name: "Ahmad Fauzi",
          role: "SENIOR_JOURNALIST",
          bio: "Jurnalis senior dengan pengalaman 10 tahun meliput berita.",
          specialization: "Hukum",
        },
      });

      const hukumCat = await tx.category.findUnique({
        where: { slug: "hukum" },
      });

      if (hukumCat) {
        await tx.article.create({
          data: {
            title: "Mahkamah Konstitusi Putuskan Uji Materi UU Cipta Kerja di Bandung",
            slug: "mk-putuskan-uji-materi-uu-cipta-kerja",
            content: `<p>BANDUNG - Mahkamah Konstitusi Republik Indonesia telah memutuskan hasil uji materi terhadap beberapa pasal dalam Undang-Undang Cipta Kerja yang diajukan oleh serikat pekerja di Bandung.</p><h2>Latar Belakang Gugatan</h2><p>Gugatan ini diajukan oleh Konfederasi Serikat Pekerja Bandung (KSPB) yang mewakili lebih dari 50.000 pekerja di wilayah Bandung Raya.</p><blockquote>"Kami mengajukan gugatan ini demi melindungi hak-hak fundamental pekerja yang dijamin oleh konstitusi," ujar Ketua KSPB, Ahmad Fauzi.</blockquote><h2>Isi Putusan MK</h2><p>Dalam putusannya, MK memutuskan bahwa tiga dari lima pasal yang digugat dinyatakan bertentangan dengan UUD 1945.</p>`,
            excerpt: "Mahkamah Konstitusi RI memutuskan hasil uji materi terhadap beberapa pasal dalam UU Cipta Kerja yang diajukan oleh serikat pekerja di Bandung.",
            status: "PUBLISHED",
            verificationLabel: "VERIFIED",
            readTime: 5,
            viewCount: 0,
            publishedAt: new Date(),
            authorId: createdJournalist.id,
            categoryId: hukumCat.id,
            seoTitle: "MK Putuskan Uji Materi UU Cipta Kerja di Bandung",
            seoDescription: "Hasil putusan MK terhadap uji materi UU Cipta Kerja dari serikat pekerja Bandung.",
            sources: {
              create: [
                { name: "Ahmad Fauzi", title: "Ketua KSPB", institution: "Konfederasi Serikat Pekerja Bandung" },
              ],
            },
          },
        });
      }

      return { admin: createdAdmin, editor: createdEditor, journalist: createdJournalist };
    });

    return successResponse({
      message: "Setup berhasil! Database telah di-seed.",
      users: {
        admin: { email: admin.email, password: adminPlain },
        editor: { email: editor.email, password: editorPlain },
        journalist: { email: journalist.email, password: journalistPlain },
      },
      categories: categories.length,
      warning: "SIMPAN PASSWORD DI ATAS SEKARANG! Password hanya ditampilkan sekali dan tidak tersimpan di source code. SEGERA GANTI setelah login pertama kali!",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
