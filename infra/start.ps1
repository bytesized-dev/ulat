# Starts the hub network: DNS answer for the hub name, Caddy over HTTPS, and the app.
# Usage: .\infra\start.ps1 -HubDomain hub.example.dev -HubIp 192.168.8.10
# Without certificate files in -CertDir it falls back to Caddy's internal certificate.
param(
  [string]$HubDomain = $env:HUB_DOMAIN,
  [string]$HubIp = $env:HUB_IP,
  [string]$CertDir = $(if ($env:HUB_CERT_DIR) { $env:HUB_CERT_DIR } else { Join-Path $env:ProgramData "ulat\certs" }),
  [string]$Caddy = $(if ($env:CADDY) { $env:CADDY } else { (Get-Command caddy -ErrorAction SilentlyContinue).Source }),
  [switch]$NoApp
)

$ErrorActionPreference = "Stop"
$infra = $PSScriptRoot
$root = Split-Path $infra -Parent

if (-not $HubDomain -or -not $HubIp) { throw "Set -HubDomain and -HubIp, for example hub.example.dev and 192.168.8.10." }
if (-not $Caddy -or -not (Test-Path $Caddy)) { throw "Caddy not found. Put caddy.exe on PATH or pass -Caddy with its path." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "node not found." }
if (-not $NoApp -and -not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm not found." }

$full = Join-Path $CertDir "fullchain.pem"
$key = Join-Path $CertDir "privkey.pem"
$real = (Test-Path $full) -and (Test-Path $key)
if ($real) { Write-Host "Certificate: $full" } else { Write-Host "No certificate in $CertDir, using Caddy's internal certificate. Phones must trust its root." }

# Build the Caddyfile from the template. The tls line is swapped when there is no real certificate.
$tmp = Join-Path $root "tmp"
New-Item -ItemType Directory -Force $tmp | Out-Null
$caddyfile = Join-Path $tmp "Caddyfile"
$text = Get-Content (Join-Path $infra "Caddyfile") -Raw
$tls = if ($real) { "tls `"$($full -replace '\\','/')`" `"$($key -replace '\\','/')`"" } else { "tls internal" }
$text = $text -replace '(?m)^\s*tls /etc/ulat/certs/fullchain\.pem /etc/ulat/certs/privkey\.pem\s*$', "`t$tls"
Set-Content -Path $caddyfile -Value $text -Encoding ascii

$env:HUB_DOMAIN = $HubDomain
$env:HUB_IP = $HubIp
$procs = @()
try {
  & $Caddy validate --config $caddyfile --adapter caddyfile | Out-Null
  $procs += Start-Process node -ArgumentList (Join-Path $infra "dns-stub.mjs") -PassThru -NoNewWindow
  $procs += Start-Process $Caddy -ArgumentList "run", "--config", $caddyfile, "--adapter", "caddyfile" -PassThru -NoNewWindow
  if (-not $NoApp) {
    $procs += Start-Process pnpm -ArgumentList "start" -WorkingDirectory $root -PassThru -NoNewWindow
  }
  Write-Host "Hub up: https://$HubDomain (DNS $HubIp). Press Ctrl+C to stop."
  Wait-Process -Id $procs[0].Id
} finally {
  foreach ($p in $procs) {
    if (-not $p.HasExited) { & taskkill /PID $p.Id /T /F | Out-Null }
  }
}
