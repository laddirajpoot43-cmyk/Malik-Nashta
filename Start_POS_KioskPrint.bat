@echo off
title Malik Tasty Nashta Point - Direct Thermal Print POS
set "POS_URL=https://malik-nashta.vercel.app/pos"
set "PROFILE_DIR=%LOCALAPPDATA%\MalikPOS_PrintProfile"

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --user-data-dir="%PROFILE_DIR%" --kiosk-printing --app=%POS_URL%
    exit
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --user-data-dir="%PROFILE_DIR%" --kiosk-printing --app=%POS_URL%
    exit
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%PROFILE_DIR%" --kiosk-printing --app=%POS_URL%
    exit
)

echo Google Chrome / Edge not found in standard Program Files folders.
pause
