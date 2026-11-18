/**
 * Cloudflare Email Routing API
 * Manage email addresses via Cloudflare API
 */

const CF_API = "https://api.cloudflare.com/client/v4";
const CF_TIMEOUT_MS = 15_000;

function getConfig() {
  const apiKey = process.env.CLOUDFLARE_GLOBAL_API_KEY;
  const email = process.env.CLOUDFLARE_EMAIL;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!apiKey || !email || !zoneId) {
    throw new Error(
      "Cloudflare env vars not configured (CLOUDFLARE_GLOBAL_API_KEY, CLOUDFLARE_EMAIL, CLOUDFLARE_ZONE_ID)",
    );
  }
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

interface CfEnvelope<T> {
  success?: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
}

async function cfEmailFetch<T>(
  path: string,
  init: RequestInit = {},
  fallbackError = "Cloudflare request failed",
): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
    signal: AbortSignal.timeout(CF_TIMEOUT_MS),
  });
  const text = await res.text();
  let json: CfEnvelope<T>;
  try {
    json = JSON.parse(text) as CfEnvelope<T>;
  } catch {
    throw new Error(`Invalid response from Cloudflare (HTTP ${res.status})`);
  }
  if (!res.ok || !json.success) {
    throw new Error(
      json.errors?.[0]?.message || `${fallbackError} (HTTP ${res.status})`,
    );
  }
  return json.result as T;
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
  const res = await cfEmailFetch<EmailRule[]>(
    `/zones/${encodeURIComponent(zoneId)}/email/routing/rules`,
    {},
    "Failed to list rules",
  );
  return res || [];
}

/** Create a new email routing rule (forward address) */
export async function createEmailForward(
  localPart: string,
  destinationEmail: string,
): Promise<EmailRule> {
  const { zoneId } = getConfig();
  const address = `${localPart}@lensaplus.com`;

  return cfEmailFetch<EmailRule>(
    `/zones/${encodeURIComponent(zoneId)}/email/routing/rules`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `Forward ${address} to ${destinationEmail}`,
        enabled: true,
        matchers: [{ type: "literal", field: "to", value: address }],
        actions: [{ type: "forward", value: [destinationEmail] }],
      }),
    },
    "Failed to create rule",
  );
}

/** Delete an email routing rule */
export async function deleteEmailRule(ruleId: string): Promise<void> {
  const { zoneId } = getConfig();
  await cfEmailFetch<unknown>(
    `/zones/${encodeURIComponent(zoneId)}/email/routing/rules/${encodeURIComponent(ruleId)}`,
    { method: "DELETE" },
    "Failed to delete rule",
  );
}

/** Toggle email routing rule on/off */
export async function toggleEmailRule(
  ruleId: string,
  enabled: boolean,
): Promise<void> {
  const { zoneId } = getConfig();
  const safeRulePath = `/zones/${encodeURIComponent(zoneId)}/email/routing/rules/${encodeURIComponent(ruleId)}`;
  const rule = await cfEmailFetch<EmailRule>(
    safeRulePath,
    {},
    "Failed to get rule",
  );

  await cfEmailFetch<unknown>(
    safeRulePath,
    {
      method: "PUT",
      body: JSON.stringify({
        name: rule.name,
        enabled,
        matchers: rule.matchers,
        actions: rule.actions,
      }),
    },
    "Failed to update rule",
  );
}

/** Add destination address (must be verified by recipient) */
export async function addDestinationAddress(
  email: string,
): Promise<{ id: string; email: string; verified: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID not set");
  const safeAccount = encodeURIComponent(accountId);

  const list = await cfEmailFetch<
    { id: string; email: string; verified: string }[]
  >(
    `/accounts/${safeAccount}/email/routing/addresses`,
    {},
    "Failed to list destinations",
  ).catch((err) => {
    console.warn(
      "[cloudflare-email] Failed to list destination addresses:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  });
  const existing = list.find((a) => a.email === email);
  if (existing) return existing;

  return cfEmailFetch<{ id: string; email: string; verified: string }>(
    `/accounts/${safeAccount}/email/routing/addresses`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    "Failed to add destination",
  );
}

/** List destination addresses */
export async function listDestinationAddresses(): Promise<
  { id: string; email: string; verified: string }[]
> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) return [];
  return cfEmailFetch<{ id: string; email: string; verified: string }[]>(
    `/accounts/${encodeURIComponent(accountId)}/email/routing/addresses`,
    {},
    "Failed to list destinations",
  );
}
