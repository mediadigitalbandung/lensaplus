#!/usr/bin/env node
/**
 * Inspect the stored Google service-account JSON: confirm private_key
 * is properly formatted (PEM with real newlines), then attempt one
 * publish to capture the verbatim error.
 */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");

const prisma = new PrismaClient();

function decryptStoredSecret(stored) {
  if (!stored || !stored.startsWith("v1:")) return stored;
  const rawKey = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is required to decrypt v1: SystemSetting values");
  }
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) {
    throw new Error(`SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`);
  }
  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted v1: value (expected 4 segments)");
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
    { authTagLength: 16 },
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

(async () => {
  const cred = await prisma.systemSetting.findUnique({
    where: { key: "google_credentials_json" },
  });
  if (!cred?.value) {
    console.log("NO CREDENTIALS in SystemSetting");
    process.exit(1);
  }

  let json;
  try {
    const raw = decryptStoredSecret(cred.value.trim());
    json = JSON.parse(raw);
  } catch (e) {
    console.log("CREDENTIALS DECRYPT/PARSE ERROR:", e.message);
    process.exit(1);
  }

  console.log("client_email:", json.client_email);
  console.log("project_id:", json.project_id);
  console.log("type:", json.type);
  console.log("");
  console.log("private_key inspection:");
  console.log("  total length:", json.private_key?.length || 0);
  console.log("  starts with:", JSON.stringify(json.private_key?.slice(0, 30)));
  console.log("  contains real \\n:", (json.private_key || "").includes("\n"));
  console.log(
    "  contains escaped backslash-n:",
    (json.private_key || "").includes("\\n"),
  );
  console.log("");

  // If private_key has escaped newlines (\\n), normalise them.
  let privateKey = json.private_key || "";
  if (!privateKey.includes("\n") && privateKey.includes("\\n")) {
    console.log("[fix] normalising escaped \\n -> real newline");
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  try {
    const jwt = new google.auth.JWT({
      email: json.client_email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/indexing"],
    });
    const token = await jwt.authorize();
    console.log("Auth ok. access_token chars:", token.access_token?.length || 0);

    const indexing = google.indexing({ version: "v3", auth: jwt });
    const url =
      "https://lensaplus.com/berita/regulasi-ai-di-indonesia-terlambat-atau-tepat-waktu";
    const res = await indexing.urlNotifications.publish({
      requestBody: { url, type: "URL_UPDATED" },
    });
    console.log("Submit ok. status:", res.status);
    console.log("body:", JSON.stringify(res.data));
  } catch (e) {
    console.log("ERROR code:", e?.code);
    console.log("ERROR message:", e?.message);
    if (e?.response?.data) {
      console.log("response.data:", JSON.stringify(e.response.data, null, 2));
    }
  }
  await prisma.$disconnect();
})();
