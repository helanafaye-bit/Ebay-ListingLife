@echo off
echo ========================================
echo Installing ListingLife Storage Server
echo Dependencies
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python 3.7 or higher from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo Python found!
python --version
echo.

echo Installing required packages...
echo This may take a few moments...
echo.

REM Upgrade pip first to ensure setuptools installs properly
python -m pip install --upgrade pip

python -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies
    echo Please check the error messages above
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo You can now run the storage server by:
echo - Double-clicking: start_storage_server.bat
echo - Or running: python storage_server.py
echo.
pause

