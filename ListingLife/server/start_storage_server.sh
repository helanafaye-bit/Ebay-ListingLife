#!/bin/bash
# ListingLife Storage Server Launcher for Mac/Linux
# This script finds Python and starts the storage server

echo "========================================"
echo "ListingLife Storage Server"
echo "========================================"
echo ""

# Try to find Python
PYTHON_CMD=""
for cmd in python3 python python3.14 python3.13 python3.12 python3.11 python3.10 python3.9 python3.8 python3.7; do
    if command -v "$cmd" >/dev/null 2>&1; then
        # Check if it's Python 3.x
        if "$cmd" --version 2>&1 | grep -q "Python 3\."; then
            # Verify it's at least Python 3.7
            if "$cmd" -c "import sys; exit(0 if sys.version_info >= (3, 7) else 1)" 2>/dev/null; then
                PYTHON_CMD="$cmd"
                break
            fi
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "ERROR: Python 3.x is not installed or not in PATH"
    echo ""
    echo "Please install Python 3.7 or higher:"
    echo "  Mac:     brew install python3"
    echo "  Linux:   sudo apt-get install python3 python3-pip"
    echo "  Or:      https://www.python.org/downloads/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Python found!"
"$PYTHON_CMD" --version
echo ""

# Check if requirements are installed
echo "Checking dependencies..."
if ! "$PYTHON_CMD" -m pip show flask >/dev/null 2>&1; then
    echo "Installing dependencies..."
    "$PYTHON_CMD" -m pip install --upgrade pip
    "$PYTHON_CMD" -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Failed to install dependencies"
        echo "Try running install_requirements.sh first"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

echo ""
echo "Starting storage server..."
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
"$PYTHON_CMD" storage_server.py

