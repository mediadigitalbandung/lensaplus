# GitHub Actions — Lensaplus

## `deploy.yml` — Auto-deploy ke VPS on push to master

### Setup pertama kali

Tambahkan 3 secrets di Repo Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_HOST` | `145.79.15.99` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private key SSH (paste full content `~/.ssh/id_ed25519` atau RSA equivalent yang sudah authorized di VPS) |

### Cara generate SSH key untuk Actions (di local)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/lensaplus_deploy -N ""
# Tambahkan ke VPS authorized_keys:
ssh-copy-id -i ~/.ssh/lensaplus_deploy.pub root@145.79.15.99
# Paste isi private key (~/.ssh/lensaplus_deploy) ke GitHub secret VPS_SSH_KEY
```

### Behavior

- Trigger: setiap push ke `master` atau manual via "Run workflow"
- Step 1 — `validate`: install deps + Prisma generate + tsc --noEmit + lint + vitest
- Step 2 — `deploy` (kalau validate pass): SSH ke VPS, stop PM2, pull, install, build, restart, verify production HTTP 200
- Concurrency: serial (cancel-in-progress=false) — tidak ada race deploy

### Rollback manual

Kalau deploy fail dan production down, SSH ke VPS:
```bash
cd /var/www/lensaplus
git log --oneline -10                  # cari commit lama yang stable
git checkout <commit-hash>
rm -rf .next && npm run build
pm2 restart lensaplus
```

### Disable temporarily

Comment-out trigger di `deploy.yml` atau pakai branch protection rule.
