import { NextRequest } from "next/server";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    case ".mp4":
      return "video/mp4";
    case ".mov":
    case ".quicktime":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mp3":
    case ".mpeg":
      return "audio/mpeg";
    case ".m4a":
    case ".xm4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".wav":
    case ".xwav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

function createNodeFileWebStream(
  filePath: string,
  options?: { start: number; end: number },
): ReadableStream<Uint8Array> {
  const stream = fsSync.createReadStream(filePath, options);
  let settled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      stream.on("end", () => {
        if (settled) return;
        settled = true;
        controller.close();
      });
      stream.on("error", (err) => {
        if (settled) return;
        settled = true;
        controller.error(err);
      });
    },
    cancel() {
      settled = true;
      stream.destroy();
    },
  });
}

function parseRangeHeader(
  rangeHeader: string,
  size: number,
): { start: number; end: number } | "invalid" {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return "invalid";
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return "invalid";

  let start: number;
  let end: number;

  if (!startStr) {
    // Suffix byte range: bytes=-500
    const suffixLen = Number(endStr);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return "invalid";
    start = Math.max(0, size - suffixLen);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr ? Number(endStr) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  }

  if (start < 0 || start >= size || end < start) return "invalid";
  end = Math.min(end, size - 1);
  return { start, end };
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ path: string[] }> },
) {
  const params = await paramsPromise;
  try {
    const filePathArray = params.path;
    if (!filePathArray || filePathArray.length === 0) {
      return new Response("Not Found", { status: 404 });
    }

    if (
      filePathArray.some(
        (seg) =>
          !seg ||
          seg === "." ||
          seg === ".." ||
          seg.includes("\0") ||
          seg.includes("/") ||
          seg.includes("\\"),
      )
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    const uploadsDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");
    const safePath = path.resolve(uploadsDir, ...filePathArray);

    // Enforce directory containment using trailing path.sep
    if (!safePath.startsWith(uploadsDir + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(safePath);
    } catch {
      return new Response("File Not Found", { status: 404 });
    }

    if (!stat.isFile()) {
      return new Response("File Not Found", { status: 404 });
    }

    const mimeType = getMimeType(safePath);
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=2592000, no-transform",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };

    if (mimeType === "image/svg+xml") {
      headers["Content-Security-Policy"] =
        "sandbox; default-src 'none'; style-src 'unsafe-inline'";
      headers["Content-Disposition"] = "inline";
    }

    const rangeHeader = request.headers.get("range");
    if (rangeHeader && stat.size > 0) {
      const parsed = parseRangeHeader(rangeHeader, stat.size);
      if (parsed === "invalid") {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${stat.size}`,
          },
        });
      }

      const { start, end } = parsed;
      const chunkLen = end - start + 1;
      const bodyStream = createNodeFileWebStream(safePath, { start, end });

      return new Response(bodyStream, {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": String(chunkLen),
        },
      });
    }

    const bodyStream = createNodeFileWebStream(safePath);
    return new Response(bodyStream, {
      status: 200,
      headers: {
        ...headers,
        "Content-Length": String(stat.size),
      },
    });
  } catch (error) {
    console.error("Failed to serve upload file dynamically:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
