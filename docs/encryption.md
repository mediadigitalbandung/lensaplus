# Encryption-at-Rest for SystemSetting

Sensitive credentials stored in the `SystemSetting` table (API keys, tokens,
service-account JSON) are encrypted with **AES-256-GCM** before being written
to the database. A backup-DB leak cannot expose credentials without the
encryption key.

---

## Encrypted fields

Any `SystemSetting` key that is in the explicit list **or** whose name ends
with `_key`, `_token`, or `_secret` is automatically encrypted on write and
decrypted on read. The current explicit list:

| Key | Description |
|-----|-------------|
| `deepseek_api_key` | DeepSeek AI provider key |
| `anthropic_api_key` | Anthropic Claude key |
| `google_credentials_json` | Google service-account JSON (Indexing/GA4/GSC) |
| `cloudflare_api_token` | Cloudflare API token (cache purge + analytics) |
| `twitter_consumer_key` | Twitter/X OAuth consumer key |
| `twitter_consumer_secret` | Twitter/X OAuth consumer secret |
| `twitter_access_token` | Twitter/X OAuth access token |
| `twitter_access_secret` | Twitter/X OAuth access secret |
| `twitter_bearer_token` | Twitter/X bearer token |
| `resend_api_key` | Resend email API key |
| `indexnow_key` | IndexNow ping key |

---

## Setup

### 1. Generate the encryption key

```bash
openssl rand -base64 32
```

This outputs a 44-character base64 string that encodes 32 random bytes
(correct key length for AES-256).

### 2. Add to environment

**Development** — add to `.env` (never commit this file):

```
SETTINGS_ENCRYPTION_KEY=<output from openssl command>
```

**Production (VPS)** — add to `/var/www/kartawarta/.env` on the server:

```bash
ssh root@145.79.15.99
echo 'SETTINGS_ENCRYPTION_KEY=<key>' >> /var/www/kartawarta/.env
pm2 restart kartawarta
```

### 3. Run one-shot migration (existing plaintext values)

After setting the key, run the migration script to encrypt any values that
were stored as plaintext before this feature was introduced:

```bash
# Dry-run first (shows what will be encrypted)
node tools/migrate-encrypt-settings.mjs

# Apply
node tools/migrate-encrypt-settings.mjs --apply
```

The script skips rows already prefixed with `v1:` (safe to re-run).

---

## Stored format

Encrypted values are stored as:

```
v1:<iv_base64>:<ciphertext_base64>:<auth_tag_base64>
```

- `v1` — version prefix for future algorithm negotiation
- 96-bit random IV per encryption call (so same value encrypts differently each time)
- 128-bit GCM authentication tag (tampering detection built-in)

Legacy values (stored before this feature) have no prefix and are returned
as-is by `decryptSecret()` — zero migration downtime.

---

## Panel behaviour

The admin panel (`/panel/pengaturan`) **never** returns plaintext for sensitive
fields. The `GET /api/settings` response shows:

```
••••••••1234
```

(last 4 characters of the plaintext value, for verification that the correct
key is stored — without exposing the full credential.)

---

## Key rotation

1. Generate a new key with `openssl rand -base64 32`.
2. Run the migration script with both old and new key available — or re-save
   each sensitive setting through the panel (which re-encrypts with the active
   key).
3. Replace `SETTINGS_ENCRYPTION_KEY` in the environment.
4. Restart the application.

---

## Dev / staging without a key

If `SETTINGS_ENCRYPTION_KEY` is not set:

- `encryptSecret()` returns the plaintext unchanged (dev-friendly).
- `decryptSecret()` returns non-prefixed values unchanged.
- A one-time `console.warn` fires to remind you the key is missing.
- Attempting to decrypt a `v1:` value **without a key throws** — this prevents
  a misconfigured prod server from silently returning garbage.
