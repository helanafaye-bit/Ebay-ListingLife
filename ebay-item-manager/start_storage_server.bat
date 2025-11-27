@echo off
echo ========================================
echo ListingLife Storage Server
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7 or higher
    pause
    exit /b 1
)

REM Check if requirements are installed
echo Checking dependencies...
python -m pip show flask >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo Starting storage server...
echo Press Ctrl+C to stop the server
echo.

REM Run the server
python storage_server.py

pause

