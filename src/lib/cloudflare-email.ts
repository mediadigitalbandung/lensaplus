/**
 * Cloudflare Email Routing API
 * Manage email addresses via Cloudflare API
 */

const CF_API = "https://api.cloudflare.com/client/v4";

function getConfig() {
  const apiKey = process.env.CLOUDFLARE_GLOBAL_API_KEY;
  const email = process.env.CLOUDFLARE_EMAIL;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!apiKey || !email || !zoneId) throw new Error("Cloudflare env vars not configured (CLOUDFLARE_GLOBAL_API_KEY, CLOUDFLARE_EMAIL, CLOUDFLARE_ZONE_ID)");
  return { apiKey, email, zoneId };
}

function headers() {
  const { apiKey, email } = getConfig();
  return {
    "X-Auth-Email": email,
    "X-Auth-Key": apiKey,
    "Content-Type": "application/json",
  };
}

export interface EmailRule {
  id: string;
  tag: string;
  name: string;
  enabled: boolean;
  matchers: { type: string; field: string; value: string }[];
  actions: { type: string; value: string[] }[];
}

/** List all email routing rules */
export async function listEmailRules(): Promise<EmailRule[]> {
  const { zoneId } = getConfig();
  const res = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules`, {
    headers: headers(),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || "Failed to list rules");
  return json.result || [];
}

/** Create a new email routing rule (forward address) */
export async function createEmailForward(
  localPart: string,
  destinationEmail: string
): Promise<EmailRule> {
  const { zoneId } = getConfig();
  const address = `${localPart}@lensaplus.com`;

  const res = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: `Forward ${address} to ${destinationEmail}`,
      enabled: true,
      matchers: [{ type: "literal", field: "to", value: address }],
      actions: [{ type: "forward", value: [destinationEmail] }],
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || "Failed to create rule");
  return json.result;
}

/** Delete an email routing rule */
export async function deleteEmailRule(ruleId: string): Promise<void> {
  const { zoneId } = getConfig();
  const res = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules/${ruleId}`, {
    method: "DELETE",
    headers: headers(),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || "Failed to delete rule");
}

/** Toggle email routing rule on/off */
export async function toggleEmailRule(ruleId: string, enabled: boolean): Promise<void> {
  const { zoneId } = getConfig();
  // Get current rule first
  const getRes = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules/${ruleId}`, {
    headers: headers(),
  });
  const getJson = await getRes.json();
  if (!getJson.success) throw new Error("Failed to get rule");

  const rule = getJson.result;
  const res = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules/${ruleId}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      name: rule.name,
      enabled,
      matchers: rule.matchers,
      actions: rule.actions,
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || "Failed to toggle rule");
}

/** Add destination address (must be verified by recipient) */
export async function addDestinationAddress(email: string): Promise<{ id: string; email: string; verified: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID not set");

  // First check if already exists
  const listRes = await fetch(`${CF_API}/accounts/${accountId}/email/routing/addresses`, {
    headers: headers(),
  });
  const listText = await listRes.text();
  let listJson;
  try { listJson = JSON.parse(listText); } catch { listJson = { result: [] }; }
  const existing = (listJson.result || []).find((a: { email: string }) => a.email === email);
  if (existing) return existing;

  const res = await fetch(`${CF_API}/accounts/${accountId}/email/routing/addresses`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Invalid response from Cloudflare"); }
  if (!json.success) throw new Error(json.errors?.[0]?.message || "Failed to add destination");
  return json.result;
}

/** List destination addresses */
export async function listDestinationAddresses(): Promise<{ id: string; email: string; verified: string }[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) return [];
  const res = await fetch(`${CF_API}/accounts/${accountId}/email/routing/addresses`, {
    headers: headers(),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { return []; }
  if (!json.success) return [];
  return json.result || [];
}
