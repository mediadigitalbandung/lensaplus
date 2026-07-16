import webpush from "web-push";

/**
 * VAPID keys untuk web-push.
 * Production: set env VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (generate sekali pakai
 * `npx web-push generate-vapid-keys`).
 *
 * Public key di-expose ke client untuk subscribe.
 * Private key TIDAK boleh di-expose, hanya server-side untuk sign push.
 */
export function getVapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export function getPublicVapidKey(): string | null {
  return (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    null
  );
}

export function configureWebPush(): boolean {
  const keys = getVapidKeys();
  if (!keys) return false;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:redaksi@lensaplus.com";
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return true;
}
