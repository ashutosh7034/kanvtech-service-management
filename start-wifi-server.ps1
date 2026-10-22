# ==============================================================================
# Kanvtech Service Management - Local Wi-Fi Server Startup Script
# ==============================================================================
# Purpose: Start Backend (NestJS) and Frontend (Next.js) bound to 0.0.0.0,
#          accessible from any device on the local Wi-Fi / LAN network.
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$DevMode,
    [switch]$Foreground,
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 5000
)

$ErrorActionPreference = "Stop"
$WorkspaceRoot = $PSScriptRoot
$LogDir = Join-Path $WorkspaceRoot "logs"
$PidFile = Join-Path $WorkspaceRoot ".wifi-server.pids.json"

if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  KANVTECH SERVICE MANAGEMENT - LOCAL WI-FI SERVER STARTUP" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Detect Active LAN IPv4 Address
Write-Host "[1/5] Detecting local network interface..." -ForegroundColor Yellow
$activeIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.254\.' 
} | Select-Object -First 1).IPAddress

if (-not $activeIP) {
    Write-Host "[-] WARNING: Could not automatically detect LAN IP address. Falling back to localhost." -ForegroundColor Red
    $activeIP = "127.0.0.1"
} else {
    Write-Host "[+] Detected Active LAN IPv4: $activeIP" -ForegroundColor Green
}

# 2. Check Prerequisites
Write-Host "[2/5] Checking environment prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVer = & node -v
    Write-Host "[+] Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not installed or not available in PATH. Please install Node.js."
    exit 1
}

# Check Database Connection on 5432
$dbPortCheck = Test-NetConnection -ComputerName "127.0.0.1" -Port 5432 -InformationLevel Quiet
if ($dbPortCheck) {
    Write-Host "[+] PostgreSQL database is active and listening on port 5432." -ForegroundColor Green
} else {
    Write-Host "[-] PostgreSQL is not currently running on port 5432." -ForegroundColor Yellow
    Write-Host "    Attempting to start embedded PostgreSQL fallback..." -ForegroundColor Yellow
    $dbProcess = Start-Process node -ArgumentList "backend/scripts/start-postgres.js" -WorkingDirectory $WorkspaceRoot -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# 3. Check for Port Conflicts
Write-Host "[3/5] Checking listening ports ($FrontendPort, $BackendPort)..." -ForegroundColor Yellow
$conflicts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @($FrontendPort, $BackendPort) }
if ($conflicts) {
    Write-Host "[-] Notice: Port(s) currently in use:" -ForegroundColor Yellow
    $conflicts | ForEach-Object { Write-Host "    - Port $($_.LocalPort) used by PID $($_.OwningProcess)" }
    Write-Host "    Terminating conflicting processes using stop-wifi-server..." -ForegroundColor Yellow
    & "$WorkspaceRoot\stop-wifi-server.ps1" -Quiet
    Start-Sleep -Seconds 2
}

# 4. Start Backend Service
Write-Host "[4/5] Launching NestJS Backend (Port $BackendPort on 0.0.0.0)..." -ForegroundColor Yellow
$backendDist = Join-Path $WorkspaceRoot "backend\dist\main.js"
if (!(Test-Path $backendDist)) {
    Write-Host "    Compiling backend first..." -ForegroundColor Cyan
    & npm run build --prefix backend
}

$backendLog = Join-Path $LogDir "backend.log"
$backendErr = Join-Path $LogDir "backend.err.log"

$backendProcess = Start-Process -FilePath "node" `
    -ArgumentList "dist/main.js" `
    -WorkingDirectory "$WorkspaceRoot\backend" `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError $backendErr `
    -PassThru `
    -WindowStyle Hidden

Write-Host "[+] Backend process started (PID: $($backendProcess.Id))." -ForegroundColor Green

# 5. Start Frontend Service
Write-Host "[5/5] Launching Next.js Web Frontend (Port $FrontendPort on 0.0.0.0)..." -ForegroundColor Yellow
$webLog = Join-Path $LogDir "web.log"
$webErr = Join-Path $LogDir "web.err.log"

$webArgs = if ($DevMode) { "next dev -H 0.0.0.0 -p $FrontendPort" } else { "next start -H 0.0.0.0 -p $FrontendPort" }

$webProcess = Start-Process -FilePath "npx.cmd" `
    -ArgumentList $webArgs `
    -WorkingDirectory "$WorkspaceRoot\web" `
    -RedirectStandardOutput $webLog `
    -RedirectStandardError $webErr `
    -PassThru `
    -WindowStyle Hidden

Write-Host "[+] Frontend process started (PID: $($webProcess.Id))." -ForegroundColor Green

# Save PIDs
$pids = @{
    BackendPid = $backendProcess.Id
    FrontendPid = $webProcess.Id
    ActiveIP = $activeIP
    StartedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}
$pids | ConvertTo-Json | Set-Content $PidFile -Encoding UTF8

# Wait for services to respond
Write-Host ""
Write-Host "Waiting for services to initialize..." -NoNewline
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    $beReady = (Test-NetConnection -ComputerName "127.0.0.1" -Port $BackendPort -InformationLevel Quiet)
    $feReady = (Test-NetConnection -ComputerName "127.0.0.1" -Port $FrontendPort -InformationLevel Quiet)
    if ($beReady -and $feReady) { break }
}
Write-Host " Ready!" -ForegroundColor Green

# Display Summary Banner
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  KANVTECH LOCAL SERVER IS LIVE & ACCESSIBLE ON YOUR WI-FI!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. ACCESS FROM THIS LAPTOP:" -ForegroundColor Yellow
Write-Host "     Web Application:  http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "     Backend REST API: http://localhost:$BackendPort/api" -ForegroundColor White
Write-Host "     Swagger API Docs: http://localhost:$BackendPort/api/docs" -ForegroundColor White
Write-Host ""
Write-Host "  2. ACCESS FROM OTHER WI-FI DEVICES (PHONES, TABLETS, PC):" -ForegroundColor Yellow
Write-Host "     Web Application:  http://${activeIP}:${FrontendPort}" -ForegroundColor Green
Write-Host "     Backend REST API: http://${activeIP}:${BackendPort}/api" -ForegroundColor Green
Write-Host "     Swagger API Docs: http://${activeIP}:${BackendPort}/api/docs" -ForegroundColor Green
Write-Host ""
Write-Host "  3. LOGS & MANAGEMENT:" -ForegroundColor Yellow
Write-Host "     Backend Log:      $backendLog" -ForegroundColor Gray
Write-Host "     Frontend Log:     $webLog" -ForegroundColor Gray
Write-Host "     To Stop Server:   powershell -ExecutionPolicy Bypass -File .\stop-wifi-server.ps1" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($Foreground) {
    Write-Host "Server running in foreground mode. Press Ctrl+C to terminate..." -ForegroundColor Cyan
    try {
        while ($true) {
            Start-Sleep -Seconds 2
            if ($backendProcess.HasExited -or $webProcess.HasExited) {
                Write-Host "One of the server processes terminated unexpectedly." -ForegroundColor Red
                break
            }
        }
    } finally {
        Write-Host "Stopping servers..." -ForegroundColor Yellow
        & "$WorkspaceRoot\stop-wifi-server.ps1" -Quiet
    }
}
