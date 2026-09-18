@echo off
setlocal
cd /d "%~dp0"
title AgriGuard LIVE - Backend + Frontend

echo ========================================================
echo  AGRIGUARD LIVE
echo  Frontend: http://localhost:1572
echo  Backend : http://localhost:1573
echo  ONE TERMINAL - BOTH SERVICES
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js LTS and run start.bat again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [SETUP] Installing root launcher...
  call npm install
  if errorlevel 1 goto :fail
)
if not exist backend\node_modules (
  echo [SETUP] Installing backend dependencies...
  call npm --prefix backend install
  if errorlevel 1 goto :fail
)
if not exist frontend\node_modules (
  echo [SETUP] Installing frontend dependencies...
  call npm --prefix frontend install
  if errorlevel 1 goto :fail
)

echo.
echo [START] Starting backend and frontend in this terminal...
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:1572"
call npm start
exit /b 0

:fail
echo.
echo [ERROR] AgriGuard failed to install or start.
pause
exit /b 1
