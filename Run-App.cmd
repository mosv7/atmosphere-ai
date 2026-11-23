@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-app.ps1" %*
if errorlevel 1 (
    echo.
    echo Atmosphere AI could not start. Review the error above and logs in .runtime.
    pause
    exit /b 1
)
endlocal
