param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [switch]$Install,
    [switch]$BuildFrontend,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$nextPath = Join-Path $projectRoot 'frontend\node_modules\next\package.json'

function Wait-AppEndpoint([string]$Url, [string]$Name) {
    $deadline = (Get-Date).AddSeconds(90)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { return }
        } catch {
            Start-Sleep -Seconds 1
        }
    } while ((Get-Date) -lt $deadline)
    throw "$Name did not become ready at $Url. Check logs in $projectRoot\.runtime."
}

try {
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'Node.js and npm are required. Install Node.js, then run Run-App.cmd again.'
    }
    $needsInstall = $Install -or -not (Test-Path $pythonPath) -or -not (Test-Path $nextPath)
    if ($needsInstall -and -not (Test-Path $pythonPath) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
        throw 'Python 3.13 is required to create the local environment.'
    }
    if (-not (Test-Path (Join-Path $PostgresBin 'pg_ctl.exe'))) {
        throw 'PostgreSQL was not found. Pass -PostgresBin "C:\path\to\PostgreSQL\bin".'
    }
    Write-Host 'Starting Atmosphere AI...'
    & (Join-Path $PSScriptRoot 'start-local.ps1') -PostgresBin $PostgresBin -Install:$needsInstall -BuildFrontend:$BuildFrontend
    Write-Host 'Waiting for the API and web application...'
    Wait-AppEndpoint 'http://127.0.0.1:8000/api/health' 'API'
    Wait-AppEndpoint 'http://127.0.0.1:3000' 'Web application'
    Write-Host 'Atmosphere AI is ready: http://127.0.0.1:3000'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3000' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
