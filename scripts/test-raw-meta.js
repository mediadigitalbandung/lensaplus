const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const token = process.env.META_ACCESS_TOKEN || "";
if (!token) {
  console.error("ERROR: META_ACCESS_TOKEN environment variable is not set.");
  process.exit(1);
}

async function main() {
  console.log("=== RAW META API RESPONSES ===");

  // 1. debug_token response
  try {
    const url = `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    console.log("\n[1] debug_token response:");
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("debug_token error:", e);
  }

  // 2. me response
  try {
    const url = `${GRAPH_BASE}/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    console.log("\n[2] me response:");
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("me error:", e);
  }

  // 3. me/accounts response
  try {
    const url = `${GRAPH_BASE}/me/accounts?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    console.log("\n[3] me/accounts response:");
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("me/accounts error:", e);
  }
}

main().catch(console.error);
