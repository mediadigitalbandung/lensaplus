#!/usr/bin/env node
/**
 * Diagnose Google Indexing API: read service account from SystemSetting,
 * authorize, and submit one test URL. Prints whatever Google returns so we
 * know whether credentials, scope, ownership, or quota is the problem.
 */
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";

const prisma = new PrismaClient();
const cred = await prisma.systemSetting.findUnique({ where: { key: "google_credentials_json" } });
if (!cred?.value) {
  console.log("NO_CREDENTIALS in SystemSetting");
  process.exit(1);
}
const parsed = JSON.parse(cred.value);
console.log("client_email :", parsed.client_email);
console.log("project_id   :", parsed.project_id);

try {
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: parsed.private_key,
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });
  const token = await auth.authorize();
  console.log("AUTH_OK token len:", token.access_token?.length);

  const indexing = google.indexing({ version: "v3", auth });
  const url = process.argv[2] || "https://kartawarta.com/";
  const resp = await indexing.urlNotifications.publish({
    requestBody: { url, type: "URL_UPDATED" },
  });
  console.log("SUBMIT_OK", resp.status, "for", url);
  console.log(JSON.stringify(resp.data, null, 2).slice(0, 600));
} catch (e) {
  console.log("ERROR:", e.message);
  if (e.response?.data) {
    console.log("DETAIL:", JSON.stringify(e.response.data, null, 2).slice(0, 800));
  }
}
await prisma.$disconnect();
