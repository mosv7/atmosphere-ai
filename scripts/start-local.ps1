param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [switch]$Install,
    [switch]$BuildFrontend
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $projectRoot '.runtime'
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
New-Item -ItemType Directory -Force $runtimePath | Out-Null
if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
    Copy-Item (Join-Path $projectRoot '.env.example') (Join-Path $projectRoot '.env')
}
if ($Install) {
    Push-Location $projectRoot
    try {
        if (-not (Test-Path $pythonPath)) { python -m venv .venv }
        & $pythonPath -m pip install -r backend/requirements.lock.txt
        if ($LASTEXITCODE) { throw 'Python dependency installation failed' }
        Push-Location frontend
        try { npm.cmd ci; if ($LASTEXITCODE) { throw 'npm ci failed' } } finally { Pop-Location }
    } finally { Pop-Location }
}
if (-not (Test-Path $pythonPath)) { throw 'Run scripts/start-local.ps1 -Install first' }
if (-not (Test-Path (Join-Path $PostgresBin 'pg_ctl.exe'))) { throw 'Pass -PostgresBin with the PostgreSQL bin directory, or use Docker Compose' }
$clusterPath = Join-Path $runtimePath 'postgres'
$env:PGPASSWORD = 'atmosphere'
if (-not (Test-Path (Join-Path $clusterPath 'PG_VERSION'))) {
    $passwordPath = Join-Path $runtimePath 'pg-password.txt'
    Set-Content -LiteralPath $passwordPath -Value 'atmosphere' -NoNewline
    & (Join-Path $PostgresBin 'initdb.exe') -D $clusterPath -U atmosphere "--pwfile=$passwordPath" --auth=scram-sha-256 --encoding=UTF8 --locale=C
    if ($LASTEXITCODE) { throw 'PostgreSQL cluster initialization failed' }
}
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $clusterPath status | Out-Null
if ($LASTEXITCODE) {
    & (Join-Path $PostgresBin 'pg_ctl.exe') -D $clusterPath -l (Join-Path $runtimePath 'postgres.log') -o '-p 5433 -h 127.0.0.1' start
    if ($LASTEXITCODE) { throw 'PostgreSQL startup failed' }
}
$databaseExists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p 5433 -U atmosphere -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='atmosphere'"
if ($databaseExists -ne '1') {
    & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p 5433 -U atmosphere atmosphere
    if ($LASTEXITCODE) { throw 'Database creation failed' }
}
Push-Location (Join-Path $projectRoot 'backend')
try { & $pythonPath -m alembic upgrade head; if ($LASTEXITCODE) { throw 'Database migration failed' } } finally { Pop-Location }
if (-not (Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue)) {
    $apiProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'backend.log') -RedirectStandardError (Join-Path $runtimePath 'backend-error.log') -PassThru
    Set-Content (Join-Path $runtimePath 'backend.pid') $apiProcess.Id
}
if ($BuildFrontend -or -not (Test-Path (Join-Path $projectRoot 'frontend\.next\BUILD_ID'))) {
    Push-Location (Join-Path $projectRoot 'frontend')
    try { npm.cmd run build; if ($LASTEXITCODE) { throw 'Frontend build failed' } } finally { Pop-Location }
}
if (-not (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue)) {
    $webProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','start','--','--hostname','127.0.0.1') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'frontend.log') -RedirectStandardError (Join-Path $runtimePath 'frontend-error.log') -PassThru
    Set-Content (Join-Path $runtimePath 'frontend.pid') $webProcess.Id
}
Write-Output 'Application: http://127.0.0.1:3000 ; API: http://127.0.0.1:8000/docs'
Write-Output 'Logs: .runtime. Models must be collected and trained separately; see README.md.'
