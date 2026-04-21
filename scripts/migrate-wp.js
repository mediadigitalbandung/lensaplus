/**
 * WordPress to Prisma Migration Script
 * Reads WP SQL dump and imports articles into PostgreSQL via Prisma
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SQL_FILE = path.join(__dirname, "..", "db", "afhntwic_wp317.sql");

// Map WP categories to our Prisma categories
const WP_CATEGORY_MAP = {
  1: "berita-bandung",     // Mancanegara → mapped to closest
  6: "berita-bandung",     // Daerah
  7: "hukum-tata-negara",  // Nasional
  8: "hukum-pidana",       // Hukrim
  9: "opini",              // Opini
  10: "berita-bandung",    // Peristiwa
  11: "berita-bandung",    // Olahraga
  12: "hukum-bisnis",      // Tekno
  13: "berita-bandung",    // Otomotif
};

function cleanWpContent(content) {
  if (!content) return "";
  return content
    .replace(/<!-- wp:[^\s]+ -->/g, "")
    .replace(/<!-- \/wp:[^\s]+ -->/g, "")
    .replace(/<!-- wp:[^\s]+ ({.*?}) -->/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function generateExcerpt(content, maxLen = 200) {
  const text = content
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

function estimateReadTime(content) {
  const words = content.replace(/<[^>]+>/g, "").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function parseSqlInserts(sql, tableName) {
  const rows = [];
  const regex = new RegExp(
    `INSERT INTO \`${tableName}\`[^)]+\\)\\s+VALUES\\s*([\\s\\S]*?)(?=;\\s*(?:INSERT|DROP|CREATE|ALTER|--|$))`,
    "gi"
  );

  let match;
  while ((match = regex.exec(sql)) !== null) {
    const valuesStr = match[1];
    // Parse each row tuple
    let depth = 0;
    let current = "";
    let inString = false;
    let escape = false;

    for (let i = 0; i < valuesStr.length; i++) {
      const ch = valuesStr[i];

      if (escape) {
        current += ch;
        escape = false;
        continue;
      }

      if (ch === "\\") {
        current += ch;
        escape = true;
        continue;
      }

      if (ch === "'" && !escape) {
        inString = !inString;
        current += ch;
        continue;
      }

      if (!inString) {
        if (ch === "(") {
          depth++;
          if (depth === 1) {
            current = "";
            continue;
          }
        } else if (ch === ")") {
          depth--;
          if (depth === 0) {
            rows.push(current);
            current = "";
            continue;
          }
        }
      }

      current += ch;
    }
  }

  return rows;
}

function parseRow(rowStr) {
  const values = [];
  let current = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < rowStr.length; i++) {
    const ch = rowStr[i];

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      current += ch;
      continue;
    }

    if (ch === "'") {
      if (!inString) {
        inString = true;
        continue;
      } else {
        inString = false;
        continue;
      }
    }

    if (ch === "," && !inString) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }
  values.push(current.trim());
  return values;
}

async function main() {
  console.log("Reading SQL dump...");
  const sql = fs.readFileSync(SQL_FILE, "utf-8");

  // Parse terms (categories + tags)
  console.log("Parsing WP terms...");
  const termRows = parseSqlInserts(sql, "wpqn_terms");
  const terms = {};
  for (const row of termRows) {
    const vals = parseRow(row);
    terms[vals[0]] = { name: vals[1], slug: vals[2] };
  }
  console.log(`  Found ${Object.keys(terms).length} terms`);

  // Parse term_taxonomy (to know which terms are categories vs tags)
  const taxRows = parseSqlInserts(sql, "wpqn_term_taxonomy");
  const taxonomy = {};
  for (const row of taxRows) {
    const vals = parseRow(row);
    taxonomy[vals[0]] = { termId: vals[1], type: vals[2], count: parseInt(vals[5]) || 0 };
  }

  // Parse term_relationships (post -> term mapping)
  const relRows = parseSqlInserts(sql, "wpqn_term_relationships");
  const postTerms = {};
  for (const row of relRows) {
    const vals = parseRow(row);
    const postId = vals[0];
    const taxId = vals[1];
    if (!postTerms[postId]) postTerms[postId] = [];
    postTerms[postId].push(taxId);
  }

  // Parse posts
  console.log("Parsing WP posts...");
  const postRows = parseSqlInserts(sql, "wpqn_posts");
  const posts = [];
  for (const row of postRows) {
    const vals = parseRow(row);
    const postType = vals[20];
    const postStatus = vals[7];

    // Only import published posts (not pages, revisions, attachments)
    if (postType === "post" && postStatus === "publish") {
      posts.push({
        id: vals[0],
        authorId: vals[1],
        date: vals[2],
        content: vals[4],
        title: vals[5],
        excerpt: vals[6],
        slug: vals[11],
      });
    }
  }
  console.log(`  Found ${posts.length} published posts to migrate`);

  // Get first journalist from DB
  const journalist = await prisma.user.findFirst({
    where: { role: { in: ["SENIOR_JOURNALIST", "JOURNALIST"] } },
  });
  if (!journalist) {
    console.error("No journalist found in DB. Run seed first.");
    process.exit(1);
  }
  console.log(`  Using author: ${journalist.name} (${journalist.id})`);

  // Ensure categories exist
  const categoryMap = {};
  const existingCats = await prisma.category.findMany();
  for (const cat of existingCats) {
    categoryMap[cat.slug] = cat.id;
  }
  console.log(`  Found ${existingCats.length} categories in DB`);

  // Default category fallback
  const defaultCatId = categoryMap["berita-bandung"] || existingCats[0]?.id;

  // Delete existing sample article
  await prisma.article.deleteMany({
    where: { slug: "mk-putuskan-uji-materi-uu-cipta-kerja" },
  });

  // Import posts
  let imported = 0;
  let skipped = 0;

  for (const post of posts) {
    try {
      // Determine category from WP term relationships
      let categoryId = defaultCatId;
      const postTaxIds = postTerms[post.id] || [];
      for (const taxId of postTaxIds) {
        const tax = taxonomy[taxId];
        if (tax && tax.type === "category") {
          const mappedSlug = WP_CATEGORY_MAP[tax.termId];
          if (mappedSlug && categoryMap[mappedSlug]) {
            categoryId = categoryMap[mappedSlug];
            break;
          }
        }
      }

      // Collect tags
      const tagNames = [];
      for (const taxId of postTaxIds) {
        const tax = taxonomy[taxId];
        if (tax && tax.type === "post_tag" && terms[tax.termId]) {
          tagNames.push(terms[tax.termId].name);
        }
      }

      const cleanContent = cleanWpContent(post.content);
      const excerpt = post.excerpt ? cleanWpContent(post.excerpt) : generateExcerpt(cleanContent);
      const readTime = estimateReadTime(cleanContent);

      // Ensure unique slug
      let slug = post.slug || slugify(post.title);
      const existing = await prisma.article.findUnique({ where: { slug } });
      if (existing) {
        slug = `${slug}-${post.id}`;
      }

      // Clean title
      const title = post.title
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8211;/g, "–")
        .replace(/&#8212;/g, "—")
        .replace(/&#8230;/g, "…")
        .replace(/&#038;/g, "&")
        .replace(/&#8217;/g, "'");

      await prisma.article.create({
        data: {
          title,
          slug,
          content: cleanContent,
          excerpt,
          status: "PUBLISHED",
          verificationLabel: "VERIFIED",
          readTime,
          viewCount: Math.floor(Math.random() * 500) + 50,
          publishedAt: new Date(post.date),
          authorId: journalist.id,
          categoryId,
          tags: {
            connectOrCreate: tagNames.slice(0, 5).map((name) => ({
              where: { slug: slugify(name) },
              create: { name, slug: slugify(name) },
            })),
          },
        },
      });

      imported++;
      process.stdout.write(`\r  Imported: ${imported}/${posts.length}`);
    } catch (err) {
      skipped++;
      console.error(`\n  Skip "${post.title}": ${err.message}`);
    }
  }

  console.log(`\n\nMigration complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total posts in WP dump: ${posts.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
