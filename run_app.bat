@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "APP_URL=http://127.0.0.1:5173"

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python was not found on PATH.
    echo Install Python, reopen this folder, and run run_app.bat again.
    goto :failed
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found on PATH.
    echo Install Node.js, reopen this folder, and run run_app.bat again.
    goto :failed
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js was not found on PATH.
    echo Install Node.js, reopen this folder, and run run_app.bat again.
    goto :failed
)

python -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Backend Python packages are missing.
    echo Run: python -m pip install -r "%BACKEND_DIR%\requirements.txt"
    goto :failed
)

if not exist "%FRONTEND_DIR%\node_modules\vite\bin\vite.js" (
    echo ERROR: Frontend packages are missing.
    echo Run: cd /d "%FRONTEND_DIR%" ^&^& npm install
    goto :failed
)

echo Starting Budget Charts backend...
start "Budget Charts Backend" /D "%BACKEND_DIR%" cmd /k python start_server.py

echo Starting Budget Charts frontend...
start "Budget Charts Frontend" /D "%FRONTEND_DIR%" cmd /k node node_modules\vite\bin\vite.js

echo Waiting for %APP_URL% ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(30); do { try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%APP_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } } catch {} Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
    echo ERROR: The frontend did not become available within 30 seconds.
    echo Check the Backend and Frontend windows for error messages.
    goto :failed
)

echo Opening Budget Charts...
start "" "%APP_URL%"
exit /b 0

:failed
echo.
pause
exit /b 1
