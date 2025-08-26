@echo off
REM =====================================
REM  run_all.bat — Kill & Relaunch Services
REM  and auto-patch config.js with ngrok URL
REM =====================================

REM --- 0) Tear down any old windows/processes ---
taskkill /F /FI "WINDOWTITLE eq Driving-MVP API*"   >nul 2>&1
taskkill /F /IM ngrok.exe                           >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Driving-MVP App*"   >nul 2>&1

REM --- 1) Start the API server ---
start "Driving-MVP API" /D "C:\Users\jaket\driving-mvp-api" cmd /k ^
  "echo Starting API on port 3000... && node server.js"

REM --- 2) Start ngrok tunnel ---
start "ngrok Tunnel" cmd /k ^
  "echo Tunneling port 3000 via ngrok... && ngrok http 3000"

REM --- 3) Wait for ngrok’s local API to become ready ---
echo Waiting for ngrok API on 127.0.0.1:4040…
:WAIT_NGROK
  timeout /t 2 >nul
  curl.exe -s -o NUL http://127.0.0.1:4040/api/tunnels
  if errorlevel 1 goto WAIT_NGROK

REM --- 4) Extract the HTTPS tunnel URL & write to config.js ---
echo Patching driving-mvp-app\api_base.json with live ngrok URL…

powershell -NoProfile -Command ^
  "$t = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels';" ^
  "$url = ($t.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url;" ^
  "if (-not $url) { throw 'No https tunnel found' }" ^
  "$json = @{ API_BASE = $url } | ConvertTo-Json -Compress;" ^
  "Set-Content -Encoding UTF8 -Path 'C:\Users\jaket\driving-mvp-app\api_base.json' -Value $json"

if errorlevel 1 (
  echo Failed to patch api_base.json. Please check your ngrok installation. We could fallback to localhost:3000
  exit /b 1
)

REM --- 5) Launch the Expo dev server in tunnel mode ---
start "Driving-MVP App" /D "C:\Users\jaket\driving-mvp-app" cmd /k ^
  "echo Launching Expo (tunnel mode)... && npx expo start --tunnel --clear"

exit /b
