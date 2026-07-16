# Auto Commit, Push, and Deploy Automation Script for Lensaplus
# Usage: .\deploy.ps1
# Requires: Git installed locally, SSH keys configured to root@145.79.15.99

$ErrorActionPreference = "Stop"

# Get commit message from user
$commitMsg = Read-Host -Prompt "Masukkan pesan commit (tekan Enter untuk memakai pesan otomatis)"
if ([string]::IsNullOrEmpty($commitMsg)) {
    $commitMsg = "auto: update pada $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-Host "`n[1/4] Menstaging perubahan..." -ForegroundColor Cyan
git add -A

Write-Host "`n[2/4] Melakukan commit..." -ForegroundColor Cyan
git commit -m $commitMsg

Write-Host "`n[3/4] Melakukan push ke GitHub (master)..." -ForegroundColor Cyan
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gagal melakukan push ke GitHub!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[4/4] Menghubungi VPS & Menjalankan script deploy..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no root@145.79.15.99 "cd /var/www/lensaplus && bash scripts/deploy-vps.sh"

Write-Host "`n🎉 Proses auto commit, push, dan deploy selesai dengan sukses!" -ForegroundColor Green
