# Cross-Platform Setup Guide

ListingLife now works on **Windows, Mac, and Linux** with any Python 3.7+ version!

## Quick Start

### Windows
1. **Install dependencies:**
   - Double-click `install_requirements.bat`
   - OR run: `install_requirements.bat` from Command Prompt

2. **Start the server:**
   - Double-click `start_storage_server.bat`
   - OR run: `start_storage_server.bat` from Command Prompt
   - OR run: `python find_python.py`

### Mac / Linux
1. **Make scripts executable (first time only):**
   ```bash
   chmod +x install_requirements.sh start_storage_server.sh find_python.py
   ```

2. **Install dependencies:**
   ```bash
   ./install_requirements.sh
   ```

3. **Start the server:**
   ```bash
   ./start_storage_server.sh
   ```
   OR
   ```bash
   python3 find_python.py
   ```

## Python Detection

The scripts automatically detect Python 3.7+ using these methods (in order):

### Windows:
- `py -3` (Python Launcher - recommended)
- `python`
- `python3`
- `python3.14`, `python3.13`, ... `python3.7`
- `python14`, `python13`, ... `python7`

### Mac / Linux:
- `python3`
- `python`
- `python3.14`, `python3.13`, ... `python3.7`

## Universal Python Launcher

The `find_python.py` script works on **all platforms** and automatically:
- Finds any Python 3.7+ installation
- Verifies it's compatible
- Installs dependencies if needed
- Starts the storage server

**Usage:**
```bash
# Windows
python find_python.py
py find_python.py

# Mac / Linux
python3 find_python.py
python find_python.py
```

## Troubleshooting

### "Python not found" error

**Windows:**
1. Install Python from https://www.python.org/downloads/
2. **Important:** Check "Add Python to PATH" during installation
3. Try running: `py -3 --version` in Command Prompt

**Mac:**
```bash
brew install python3
```

**Linux:**
```bash
sudo apt-get install python3 python3-pip
# OR
sudo yum install python3 python3-pip
```

### Data not loading

1. **Make sure the storage server is running:**
   - Check the console window - it should show "Server running on: http://127.0.0.1:5000"
   - Look for "✅ Python storage backend connected" in browser console (F12)

2. **Check browser console (F12):**
   - Look for error messages
   - Verify data is being loaded from backend

3. **Verify data exists:**
   - Check `listinglife_data/` folder (local storage)
   - Or check your Dropbox/cloud storage if configured

### Server won't start

1. **Check if port 5000 is in use:**
   - Windows: `netstat -ano | findstr :5000`
   - Mac/Linux: `lsof -i :5000` or `netstat -an | grep 5000`

2. **Try a different port:**
   - Edit `storage_server.py` and change `port=5000` to another port (e.g., `5001`)
   - Update `storage-wrapper.js` to use the new port

3. **Check Python version:**
   - Run: `python --version` (should be 3.7 or higher)
   - The script will tell you if Python version is incompatible

## Data Persistence

Data is stored in multiple ways for reliability:

1. **localStorage** (browser) - Fast, always available
2. **Backend storage** (when server is running):
   - Local files: `listinglife_data/` folder
   - Dropbox: If configured in settings
   - Cloud (S3): If configured in settings

**The app automatically:**
- Loads from backend first (most up-to-date)
- Falls back to localStorage if backend unavailable
- Syncs localStorage to backend when server starts
- Caches backend data in localStorage for speed

## Platform-Specific Notes

### Windows
- Use `py -3` command for best compatibility
- Batch files (`.bat`) are for Windows only
- Python Launcher (`py`) is installed with Python

### Mac
- Python 3 is usually pre-installed
- Use `python3` command
- Shell scripts (`.sh`) work natively

### Linux
- Python 3 is usually pre-installed
- Use `python3` command
- Shell scripts (`.sh`) work natively
- May need to install `python3-pip` separately

## Support

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Check the storage server console for Python errors
3. Verify Python version: `python --version` or `python3 --version`
4. Make sure all dependencies are installed: `pip list` should show `flask` and `flask-cors`

