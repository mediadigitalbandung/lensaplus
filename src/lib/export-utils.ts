import jsPDF from "jspdf";

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface ExportPdfOptions {
  title: string;
  excerpt?: string;
  content: string;
  author: string;
  category: string;
  date: string;
  featuredImage?: string;
  tags?: string[];
  sources?: { name: string; title?: string; institution?: string }[];
}

// Load image as data URL via canvas (handles CORS for remote images)
function loadImageAsDataUrl(src: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Timeout after 5s
    setTimeout(() => resolve(null), 5000);
    img.src = src;
  });
}

// Extract image URLs from HTML content
function extractImages(html: string): string[] {
  const matches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/g) || [];
  return matches
    .map((tag) => {
      const m = tag.match(/src=["']([^"']+)["']/);
      return m ? m[1] : "";
    })
    .filter((url) => url.length > 0);
}

// Split HTML content into segments: text and images in order
interface ContentSegment {
  type: "text" | "image";
  value: string; // text content or image URL
}

function parseContentSegments(html: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  let lastIndex = 0;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    // Text before this image
    if (match.index > lastIndex) {
      const textHtml = html.slice(lastIndex, match.index);
      const text = stripHtml(textHtml).trim();
      if (text) segments.push({ type: "text", value: text });
    }
    // The image
    segments.push({ type: "image", value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last image
  if (lastIndex < html.length) {
    const text = stripHtml(html.slice(lastIndex)).trim();
    if (text) segments.push({ type: "text", value: text });
  }

  return segments;
}

export async function exportArticlePdf(opts: ExportPdfOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  // ─── Helper: add new page if needed ───
  function checkPage(needed: number) {
    if (y + needed > pageH - 25) {
      addFooter();
      doc.addPage();
      y = 20;
    }
  }

  // ─── Helper: wrap and draw text ───
  function drawText(text: string, x: number, maxW: number, fontSize: number, style: "normal" | "bold" | "italic" | "bolditalic" = "normal", color: [number, number, number] = [28, 28, 30]) {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW);
    const lineH = fontSize * 0.45;
    for (const line of lines) {
      checkPage(lineH);
      doc.text(line, x, y);
      y += lineH;
    }
  }

  // ─── Helper: add image to PDF ───
  async function addImageToPdf(src: string, maxW: number) {
    const imgData = await loadImageAsDataUrl(src);
    if (!imgData) return;

    const aspectRatio = imgData.height / imgData.width;
    let imgW = Math.min(maxW, contentW);
    let imgH = imgW * aspectRatio;

    // Cap height to prevent oversized images
    const maxH = 100;
    if (imgH > maxH) {
      imgH = maxH;
      imgW = imgH / aspectRatio;
    }

    checkPage(imgH + 4);
    doc.addImage(imgData.dataUrl, "JPEG", marginL, y, imgW, imgH);
    y += imgH + 4;
  }

  // ─── Helper: draw footer ───
  function addFooter() {
    const pageNum = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `© ${new Date().getFullYear()} Lensaplus — lensaplus.com`,
      marginL,
      pageH - 10
    );
    doc.text(`Halaman ${pageNum}`, pageW - marginR, pageH - 10, { align: "right" });
  }

  // ═══════════════════════════════════════════
  // PAGE HEADER — Green accent bar
  // ═══════════════════════════════════════════
  doc.setFillColor(0, 170, 19);
  doc.rect(0, 0, pageW, 3, "F");

  y = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 170, 19);
  doc.text("LENSAPLUS", marginL, y);

  y += 3;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);

  // ═══════════════════════════════════════════
  // ARTICLE TITLE
  // ═══════════════════════════════════════════
  y += 8;
  drawText(opts.title, marginL, contentW, 18, "bold", [28, 28, 30]);

  // ═══════════════════════════════════════════
  // META LINE
  // ═══════════════════════════════════════════
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`${opts.author}  •  ${opts.category}  •  ${opts.date}`, marginL, y);

  y += 5;
  doc.setDrawColor(0, 170, 19);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, marginL + 40, y);

  // ═══════════════════════════════════════════
  // FEATURED IMAGE
  // ═══════════════════════════════════════════
  if (opts.featuredImage) {
    y += 5;
    await addImageToPdf(opts.featuredImage, contentW);
  }

  // ═══════════════════════════════════════════
  // EXCERPT
  // ═══════════════════════════════════════════
  if (opts.excerpt) {
    y += 2;
    const excerptLines = doc.splitTextToSize(opts.excerpt, contentW - 10);
    const excerptH = excerptLines.length * 4.5 + 8;
    checkPage(excerptH);
    doc.setFillColor(240, 255, 241);
    doc.roundedRect(marginL, y - 2, contentW, excerptH, 2, 2, "F");
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    for (const line of excerptLines) {
      doc.text(line, marginL + 5, y);
      y += 4.5;
    }
    y += 3;
  }

  // ═══════════════════════════════════════════
  // ARTICLE CONTENT (text + inline images)
  // ═══════════════════════════════════════════
  y += 4;
  const segments = parseContentSegments(opts.content);

  for (const seg of segments) {
    if (seg.type === "image") {
      await addImageToPdf(seg.value, contentW);
    } else {
      const paragraphs = seg.value.split(/\n\s*\n|\n/).filter((p) => p.trim());
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        const isHeading = trimmed.length < 80 && /^[A-Z\s\d:—–\-]+$/.test(trimmed);
        if (isHeading) {
          y += 3;
          drawText(trimmed, marginL, contentW, 12, "bold", [28, 28, 30]);
          y += 2;
        } else {
          drawText(trimmed, marginL, contentW, 10, "normal", [50, 50, 50]);
          y += 3;
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // SOURCES
  // ═══════════════════════════════════════════
  if (opts.sources && opts.sources.length > 0) {
    y += 5;
    checkPage(15);
    doc.setDrawColor(230, 230, 230);
    doc.line(marginL, y, pageW - marginR, y);
    y += 6;
    drawText("SUMBER & NARASUMBER", marginL, contentW, 9, "bold", [0, 170, 19]);
    y += 2;

    for (const src of opts.sources) {
      checkPage(6);
      let srcText = `• ${src.name}`;
      if (src.title) srcText += ` — ${src.title}`;
      if (src.institution) srcText += `, ${src.institution}`;
      drawText(srcText, marginL + 3, contentW - 3, 9, "normal", [80, 80, 80]);
      y += 1;
    }
  }

  // ═══════════════════════════════════════════
  // TAGS
  // ═══════════════════════════════════════════
  if (opts.tags && opts.tags.length > 0) {
    y += 5;
    checkPage(10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 170, 19);
    const tagsStr = opts.tags.map((t) => `#${t}`).join("   ");
    doc.text(tagsStr, marginL, y);
    y += 4;
  }

  // ═══════════════════════════════════════════
  // FOOTER + bottom bar on every page
  // ═══════════════════════════════════════════
  addFooter();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(0, 170, 19);
    doc.rect(0, pageH - 3, pageW, 3, "F");
  }

  // Download
  const safeFilename = opts.title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
  doc.save(`${safeFilename}.pdf`);
}
