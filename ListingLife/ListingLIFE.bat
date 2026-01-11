@echo off
REM ListingLife Launcher - Opens both the server and the web app
REM This script starts the storage server and opens the web application

title ListingLife Launcher

REM Get the directory where this script is located
cd /d "%~dp0"

REM Show instructions using PowerShell message box
powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Welcome to ListingLife!' + [Environment]::NewLine + [Environment]::NewLine + 'IMPORTANT: Dropbox Setup Required' + [Environment]::NewLine + [Environment]::NewLine + 'Before using the app, you need to:' + [Environment]::NewLine + '1. Go to Settings in the web app' + [Environment]::NewLine + '2. Click the Dropbox link to open Dropbox App Console' + [Environment]::NewLine + '3. Generate a new access token' + [Environment]::NewLine + '4. Copy and paste the token into the input field' + [Environment]::NewLine + '5. Click Save' + [Environment]::NewLine + [Environment]::NewLine + 'The server and web app will now launch...', 'ListingLife Setup', 'OK', 'Information')" >nul 2>&1

REM Start the storage server in a new window (don't wait for it)
start "ListingLife Storage Server" cmd /k "server\start_storage_server.bat"

REM Wait a moment for the server to start
timeout /t 2 /nobreak >nul

REM Open the web application in default browser
start "" "app\ebaylistings.html"

REM Exit this launcher window (server runs in its own window)
exit
