# Remove Playwright / Edge CDP browser profile folders from the repo root.
# Close Edge windows opened for Supabase setup before running, or use -ForceKillEdge.

param([switch]$ForceKillEdge)

$root = Split-Path -Parent $PSScriptRoot
$profiles = @(
  (Join-Path $root '.edge-cdp-profile'),
  (Join-Path $root '.playwright-edge-profile'),
  (Join-Path $root '.playwright-supabase-profile')
)

if ($ForceKillEdge) {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'edge-cdp-profile|playwright-edge-profile|playwright-supabase-profile|remote-debugging-port=9222' } |
    ForEach-Object {
      Write-Host "Stopping Edge pid $($_.ProcessId)..."
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  Start-Sleep -Seconds 1
}

foreach ($dir in $profiles) {
  if (-not (Test-Path $dir)) {
    Write-Host "Already gone: $dir"
    continue
  }
  try {
    Remove-Item -LiteralPath $dir -Recurse -Force
    Write-Host "Removed: $dir"
  } catch {
    Write-Warning "Could not remove $dir — close Edge/Playwright browsers and retry with -ForceKillEdge"
  }
}
