@echo off
REM ListingLife Storage Server Launcher for Windows
REM This script finds any Python 3.x installation and starts the storage server

echo ========================================
echo ListingLife Storage Server
echo ========================================
echo.

REM Try to find Python - check multiple commands in order of preference
set PYTHON_CMD=

REM First try: py launcher (Windows Python Launcher - most reliable on Windows)
py --version >nul 2>&1
if not errorlevel 1 (
    REM Verify it's Python 3.x
    py -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py -3
        goto :found_python
    )
)

REM Try: python command
python --version >nul 2>&1
if not errorlevel 1 (
    python -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=python
        goto :found_python
    )
)

REM Try: python3 command
python3 --version >nul 2>&1
if not errorlevel 1 (
    python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=python3
        goto :found_python
    )
)

REM Try versioned commands (python3.14, python3.13, etc. down to python3.7)
for /L %%v in (14,-1,7) do (
    python3.%%v --version >nul 2>&1
    if not errorlevel 1 (
        python3.%%v -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" >nul 2>&1
        if not errorlevel 1 (
            set PYTHON_CMD=python3.%%v
            goto :found_python
        )
    )
    python%%v --version >nul 2>&1
    if not errorlevel 1 (
        python%%v -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" >nul 2>&1
        if not errorlevel 1 (
            set PYTHON_CMD=python%%v
            goto :found_python
        )
    )
)

REM Last resort: Try using the Python finder script
if exist find_python.py (
    echo Trying to use Python finder script...
    python find_python.py
    if not errorlevel 1 (
        exit /b 0
    )
    python3 find_python.py
    if not errorlevel 1 (
        exit /b 0
    )
    py find_python.py
    if not errorlevel 1 (
        exit /b 0
    )
)

REM Python not found
echo ERROR: Python 3.7 or higher is not installed or not in PATH
echo.
echo Please install Python 3.x from:
echo https://www.python.org/downloads/
echo.
echo Make sure to check "Add Python to PATH" during installation
echo.
echo If Python is already installed, try running from Command Prompt:
echo   py -3 storage_server.py
echo   OR
echo   python storage_server.py
echo   OR
echo   python3 storage_server.py
echo.
echo You can also try running: python find_python.py
echo.
pause
exit /b 1

:found_python
echo Python found!
%PYTHON_CMD% --version
echo.

REM Check if requirements are installed
echo Checking dependencies...
%PYTHON_CMD% -m pip show flask >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    %PYTHON_CMD% -m pip install --upgrade pip
    if errorlevel 1 (
        echo WARNING: Failed to upgrade pip, continuing anyway...
    )
    %PYTHON_CMD% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        echo.
        echo Try running install_requirements.bat first
        pause
        exit /b 1
    )
)

echo.
echo Starting storage server...
echo Press Ctrl+C to stop the server
echo.

REM Run the server
%PYTHON_CMD% storage_server.py

if errorlevel 1 (
    echo.
    echo ERROR: Server exited with an error
    pause
    exit /b 1
)

pause

