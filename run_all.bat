@echo off
REM =====================================================
REM  run_all.bat — Start API, ngrok tunnel, patch config, then Expo
REM =====================================================

REM --- 1) API on port 3000 ---
call :CHECK_PORT 3000
if %errorlevel%==0 (
  echo [API] already running on port 3000, skipping.
) else (
  echo [API] starting...
  start "Driving-MVP API" /D "C:\Users\jaket\driving-mvp-api" cmd /k ^
    "npm install && node server.js"
)

REM --- 2) ngrok on port 4040 ---
call :CHECK_PORT 4040
if %errorlevel%==0 (
  echo [ngrok] tunnel already running, skipping.
) else (
  echo [ngrok] starting tunnel on port 3000...
  start "ngrok Tunnel" cmd /k "ngrok http 3000"
)

REM --- 3) Wait for ngrok’s API to come up ---
echo Waiting for ngrok API on port 4040…
:WAIT_NGROK
timeout /t 2 >nul
call :CHECK_PORT 4040
if %errorlevel% neq 0 goto WAIT_NGROK

REM --- 4) Patch config.js with ngrok public URL ---
echo Patching driving-mvp-app\config.js with ngrok URL...
powershell -NoProfile -Command "Set-Content -Encoding UTF8 -Path 'C:\Users\jaket\driving-mvp-app\config.js' -Value 'export const API_BASE = ''$( (Invoke-RestMethod ''http://127.0.0.1:4040/api/tunnels'').Tunnels.PublicURL )'';'"

REM --- 5) Expo on port 19000 ---
call :CHECK_PORT 19000
if %errorlevel%==0 (
  echo [Expo] dev server already running, skipping.
) else (
  echo [Expo] launching in tunnel mode…
  start "Driving-MVP App" /D "C:\Users\jaket\driving-mvp-app" cmd /k ^
    "npm install && npx expo start --tunnel --clear"
)

exit /b

:CHECK_PORT
REM Checks if TCP port %1 is LISTENING
netstat -ano | findstr "LISTENING" | findstr ":%1 " >nul
exit /b %errorlevel%
