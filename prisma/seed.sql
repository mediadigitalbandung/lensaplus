INSERT INTO categories (id, name, slug, description, "order") VALUES
('cat01', 'Hukum', 'hukum', 'Berita hukum, peradilan, dan regulasi', 1),
('cat02', 'Bisnis & Ekonomi', 'bisnis-ekonomi', 'Berita bisnis, ekonomi, dan keuangan', 2),
('cat03', 'Olahraga', 'olahraga', 'Berita olahraga nasional dan internasional', 3),
('cat04', 'Hiburan', 'hiburan', 'Entertainment, selebriti, dan budaya pop', 4),
('cat05', 'Kesehatan', 'kesehatan', 'Berita kesehatan, medis, dan gaya hidup sehat', 5),
('cat06', 'Pertanian & Peternakan', 'pertanian-peternakan', 'Agrikultur, peternakan, dan ketahanan pangan', 6),
('cat07', 'Teknologi', 'teknologi', 'Teknologi, digital, startup, dan inovasi', 7),
('cat08', 'Politik', 'politik', 'Politik, pemerintahan, dan kebijakan publik', 8),
('cat09', 'Pendidikan', 'pendidikan', 'Pendidikan, akademik, dan riset', 9),
('cat10', 'Lingkungan', 'lingkungan', 'Isu lingkungan, iklim, dan konservasi', 10),
('cat11', 'Gaya Hidup', 'gaya-hidup', 'Lifestyle, travel, kuliner, dan tren', 11),
('cat12', 'Opini', 'opini', 'Opini, analisis, dan kolom', 12)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, email, password, name, role, bio, "updatedAt") VALUES
('usr01', 'admin@lensaplus.com', '$2a$12$zqYxNqp4mSi4a/ufwO2tb.UzKF6E2zObvtSwtBhO4EAzzGUHv.csm', 'Super Admin', 'SUPER_ADMIN', 'Administrator Lensaplus', NOW()),
('usr02', 'editor@lensaplus.com', '$2a$12$iUuXGR1NSyb2ft9qoIV11.xq7OdwBWHtC2.Tv6zorYF6M7j/X.ZJa', 'Editor Kepala', 'CHIEF_EDITOR', 'Editor Kepala Lensaplus', NOW()),
('usr03', 'jurnalis@lensaplus.com', '$2a$12$P7KahhEQWaQIk45n3YMMVehLakfohuqSAS7yKCfIlPBUGAFqSY5o.', 'Ahmad Fauzi', 'SENIOR_JOURNALIST', 'Jurnalis senior dengan pengalaman 10 tahun meliput berita.', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO articles (id, title, slug, content, excerpt, status, "verificationLabel", "readTime", "viewCount", "publishedAt", "authorId", "categoryId", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES
('art01', 'Mahkamah Konstitusi Putuskan Uji Materi UU Cipta Kerja di Bandung', 'mk-putuskan-uji-materi-uu-cipta-kerja', '<p>BANDUNG - Mahkamah Konstitusi Republik Indonesia telah memutuskan hasil uji materi terhadap beberapa pasal dalam Undang-Undang Cipta Kerja yang diajukan oleh serikat pekerja di Bandung.</p><h2>Latar Belakang Gugatan</h2><p>Gugatan ini diajukan oleh Konfederasi Serikat Pekerja Bandung (KSPB) yang mewakili lebih dari 50.000 pekerja di wilayah Bandung Raya.</p><blockquote>Kami mengajukan gugatan ini demi melindungi hak-hak fundamental pekerja yang dijamin oleh konstitusi, ujar Ketua KSPB, Ahmad Fauzi.</blockquote><h2>Isi Putusan MK</h2><p>Dalam putusannya, MK memutuskan bahwa tiga dari lima pasal yang digugat dinyatakan bertentangan dengan UUD 1945.</p>', 'Mahkamah Konstitusi RI memutuskan hasil uji materi terhadap beberapa pasal dalam UU Cipta Kerja yang diajukan oleh serikat pekerja di Bandung.', 'PUBLISHED', 'VERIFIED', 5, 0, NOW(), 'usr03', 'cat03', 'MK Putuskan Uji Materi UU Cipta Kerja di Bandung', 'Hasil putusan MK terhadap uji materi UU Cipta Kerja dari serikat pekerja Bandung.', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (id, name, title, institution, "articleId") VALUES
('src01', 'Ahmad Fauzi', 'Ketua KSPB', 'Konfederasi Serikat Pekerja Bandung', 'art01')
ON CONFLICT DO NOTHING;
