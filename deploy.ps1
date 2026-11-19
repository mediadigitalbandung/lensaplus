# Auto Typecheck, Commit, Push, and Deploy Automation Script for Lensaplus
# Usage: .\deploy.ps1
# Requires: Node/npm, Git installed locally, SSH keys configured to root@145.79.15.99

$ErrorActionPreference = "Stop"

Write-Host "`n[1/5] Menjalankan TypeScript gate (npx tsc --noEmit)..." -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript check gagal! Deploy dibatalkan sebelum commit/push." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[2/5] Memeriksa perubahan & staging secara aman..." -ForegroundColor Cyan

# Check for suspicious untracked files (cPanel/LiteSpeed dirs, env/secrets, DB dumps, archives)
$untracked = @(git ls-files --others --exclude-standard)
$suspiciousPattern = '(?i)^(lscache|public_ftp|public_html|access-logs|mail|db|logs|etc)/|(^|/)\.env(\.(?!example$).*)?$|\.(sql|dump|bak|pem|key|p12|pfx|zip|tar\.gz|tgz)$'
$suspiciousFiles = @($untracked | Where-Object { $_ -match $suspiciousPattern })

if ($suspiciousFiles.Count -gt 0) {
    Write-Host "Ditemukan file untracked mencurigakan (folder cPanel/server/secret/backup):" -ForegroundColor Red
    foreach ($f in $suspiciousFiles) {
        Write-Host "  - $f" -ForegroundColor Yellow
    }
    Write-Host "Hapus atau tambahkan ke .gitignore terlebih dahulu. Deploy dibatalkan." -ForegroundColor Red
    exit 1
}

# Stage tracked modifications & deletions only (never blind `git add -A`)
git add -u
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gagal menstaging perubahan file ter-track!" -ForegroundColor Red
    exit $LASTEXITCODE
}

if ($untracked.Count -gt 0) {
    Write-Host "File baru (untracked) terdeteksi:" -ForegroundColor Yellow
    foreach ($f in $untracked) {
        Write-Host "  + $f" -ForegroundColor Yellow
    }
    $addUntracked = Read-Host -Prompt "Tambahkan file untracked di atas ke commit? (y/N)"
    if ($addUntracked -match '^(y|yes)$') {
        git add -- @untracked
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Gagal menstaging file untracked!" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } else {
        Write-Host "File untracked dilewati (hanya file ter-track yang di-stage)." -ForegroundColor DarkGray
    }
}

# Ensure there are staged changes before committing
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Tidak ada perubahan yang di-stage untuk di-commit. Deploy dibatalkan." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nRingkasan perubahan yang akan di-commit:" -ForegroundColor Cyan
git status -s

# Get commit message from user
$commitMsg = Read-Host -Prompt "`nMasukkan pesan commit (tekan Enter untuk memakai pesan otomatis)"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "auto: update pada $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-Host "`n[3/5] Melakukan commit..." -ForegroundColor Cyan
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gagal melakukan commit!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[4/5] Melakukan push ke GitHub (master)..." -ForegroundColor Cyan
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gagal melakukan push ke GitHub!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[5/5] Menghubungi VPS & Menjalankan script deploy..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=accept-new root@145.79.15.99 "cd /var/www/lensaplus && bash scripts/deploy-vps.sh"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy di VPS gagal (exit code $LASTEXITCODE)!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nProses typecheck, commit, push, dan deploy selesai dengan sukses!" -ForegroundColor Green
