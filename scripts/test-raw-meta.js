const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const token = "EAATm6YSnzcUBRovdeYgQDSZCZAIcgKZBn3CtluASGCeqv4M3s6wSdeMaYORBcemfhf218rU7sd5kZAOmhRdV8NLZAZABZB0QEiM7nP4rLRChQGbMfQPRY99IWCIzGbfoPyHdJfIDweoyF8uIojIYDhdCDtV5FfZBnu1DI6qWXZCW2sTTFwHCw2QX79UzHIYF1unSS4NgnIGNHsZASGyE0jynPKxcmWNDEO548ZC9UXRFe9C5lNQEnTtHAXJHvDCGidC235KE6UVoixEsmMYt0MZD";

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
