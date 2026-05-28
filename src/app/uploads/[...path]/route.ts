import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// Simple extension to mime-type mapping
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
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ path: string[] }> }
) {
  const params = await paramsPromise;
  try {
    const filePathArray = params.path;
    if (!filePathArray || filePathArray.length === 0) {
      return new Response("Not Found", { status: 404 });
    }

    // Resolve absolute path to the file inside public/uploads
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const safePath = path.join(uploadsDir, ...filePathArray);

    // Security: Prevent directory traversal attack (ensure resolved path is inside uploadsDir)
    if (!safePath.startsWith(uploadsDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(safePath);
    } catch {
      return new Response("File Not Found", { status: 404 });
    }

    // Read and serve file content
    const fileBuffer = await fs.readFile(safePath);
    const mimeType = getMimeType(safePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=2592000, no-transform", // 30 days cache
      },
    });
  } catch (error) {
    console.error("Failed to serve upload file dynamically:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
