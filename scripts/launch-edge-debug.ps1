# Launches Microsoft Edge with remote debugging so Playwright can reuse your login.
# Close all Edge windows first, then run:  npm run setup:service-role:edge
$ErrorActionPreference = 'Stop'

$projectRef = 'yzykhrdwplvibzypihvc'
$apiKeysUrl = "https://supabase.com/dashboard/project/$projectRef/settings/api-keys"
$port = 9222

$edgeCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) {
  Write-Error 'Microsoft Edge was not found.'
}

try {
  $version = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
  Write-Host "Edge is already listening on port $port ($($version.Browser))."
  Start-Process $edge $apiKeysUrl
  exit 0
} catch {
  # not running yet
}

# Dedicated profile avoids "Edge already running" lock on your daily profile.
# Sign in to Supabase once in this window (GitHub SSO usually remembers you).
$userData = Join-Path (Split-Path $PSScriptRoot -Parent) '.edge-cdp-profile'
New-Item -ItemType Directory -Force -Path $userData | Out-Null

Write-Host "Starting Edge with remote debugging (port $port)."
Write-Host "Profile: $userData"
Write-Host 'Sign in to Supabase in that window if prompted (same GitHub account is fine).'
Write-Host ''

$args = @(
  "--remote-debugging-port=$port",
  "--user-data-dir=`"$userData`"",
  $apiKeysUrl
)
Start-Process -FilePath $edge -ArgumentList $args | Out-Null

$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2 | Out-Null
    Write-Host 'Edge debugging is ready. Running setup...'
    exit 0
  } catch {
    Start-Sleep -Seconds 1
  }
}

Write-Error 'Edge did not open the debugging port in time. Close other Edge windows and retry.'
