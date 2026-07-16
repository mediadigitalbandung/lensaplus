#!/usr/bin/env node
/**
 * Inspect the stored Google service-account JSON: confirm private_key
 * is properly formatted (PEM with real newlines), then attempt one
 * publish to capture the verbatim error.
 */
const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");

const prisma = new PrismaClient();

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
    json = JSON.parse(cred.value);
  } catch (e) {
    console.log("CREDENTIALS NOT VALID JSON:", e.message);
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
      "https://kartawarta.com/berita/regulasi-ai-di-indonesia-terlambat-atau-tepat-waktu";
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
