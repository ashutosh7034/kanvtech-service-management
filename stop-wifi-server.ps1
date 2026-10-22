# ==============================================================================
# Kanvtech Service Management - Local Wi-Fi Server Shutdown Script
# ==============================================================================
# Purpose: Gracefully stops the NestJS Backend and Next.js Frontend servers.
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Quiet
)

$WorkspaceRoot = $PSScriptRoot
$PidFile = Join-Path $WorkspaceRoot ".wifi-server.pids.json"

if (-not $Quiet) {
    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host "  STOPPING KANVTECH LOCAL WI-FI SERVER PROCESSES" -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Cyan
}

# 1. Stop by recorded PIDs
if (Test-Path $PidFile) {
    try {
        $pids = Get-Content $PidFile -Raw | ConvertFrom-Json
        if ($pids.BackendPid) {
            Stop-Process -Id $pids.BackendPid -Force -ErrorAction SilentlyContinue
            if (-not $Quiet) { Write-Host "[+] Stopped Backend process (PID $($pids.BackendPid))" -ForegroundColor Green }
        }
        if ($pids.FrontendPid) {
            Stop-Process -Id $pids.FrontendPid -Force -ErrorAction SilentlyContinue
            if (-not $Quiet) { Write-Host "[+] Stopped Frontend process (PID $($pids.FrontendPid))" -ForegroundColor Green }
        }
    } catch {}
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# 2. Check and clean any remaining processes on port 3000 and 5000
$ports = @(3000, 5000)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $port }
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess
        if ($procId -gt 4) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                if (-not $Quiet) { Write-Host "[+] Terminated remaining process on port $port (PID $procId)" -ForegroundColor Green }
            } catch {}
        }
    }
}

if (-not $Quiet) {
    Write-Host "[+] Server shutdown complete. Ports 3000 and 5000 released." -ForegroundColor Green
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host ""
}
