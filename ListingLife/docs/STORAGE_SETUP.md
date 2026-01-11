# ListingLife Storage Server Setup Guide

This guide explains how to set up the Python storage server to route your ListingLife data to local files or cloud storage.

## Overview

The storage server runs alongside your browser application and automatically intercepts all localStorage operations, routing them to either:
- **Local Storage**: Saves data as JSON files in a local directory
- **Cloud Storage**: Saves data to AWS S3 (or other cloud providers)

The browser app will automatically detect if the Python server is running and route data accordingly. If the server is not running, it falls back to browser localStorage.

## Quick Start

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Server (Local Storage Mode)

```bash
python storage_server.py
```

The server will start on `http://127.0.0.1:5000` and save data to `./listinglife_data/` directory.

### 3. Open Your Browser App

Open any of the HTML files in your browser. The app will automatically detect the Python server and start routing data to it.

You should see in the browser console:
```
✅ Python storage backend connected
   Mode: local
   Local path: C:\path\to\listinglife_data
```

## Configuration

### Local Storage Mode (Default)

By default, the server uses local storage. Data is saved as JSON files in the `listinglife_data` directory.

**Customize the storage path:**
```bash
set LOCAL_STORAGE_PATH=C:\MyData\ListingLife
python storage_server.py
```

Or on Linux/Mac:
```bash
export LOCAL_STORAGE_PATH=/home/user/listinglife_data
python storage_server.py
```

### Cloud Storage Mode (AWS S3)

To use cloud storage, you need to:

1. **Set up AWS credentials:**
   - Create an AWS account
   - Create an S3 bucket
   - Create an IAM user with S3 read/write permissions
   - Get your Access Key ID and Secret Access Key

2. **Set environment variables:**
   ```bash
   set STORAGE_MODE=cloud
   set S3_BUCKET=your-bucket-name
   set AWS_ACCESS_KEY_ID=your-access-key-id
   set AWS_SECRET_ACCESS_KEY=your-secret-access-key
   set AWS_REGION=us-east-1
   python storage_server.py
   ```

   Or on Linux/Mac:
   ```bash
   export STORAGE_MODE=cloud
   export S3_BUCKET=your-bucket-name
   export AWS_ACCESS_KEY_ID=your-access-key-id
   export AWS_SECRET_ACCESS_KEY=your-secret-access-key
   export AWS_REGION=us-east-1
   python storage_server.py
   ```

3. **Create a `.env` file (optional):**
   You can also create a `.env` file in the same directory:
   ```
   STORAGE_MODE=cloud
   S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   AWS_REGION=us-east-1
   ```
   
   Then install `python-dotenv` and modify the server to load it:
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```

## How It Works

1. **Storage Wrapper (`storage-wrapper.js`)**: 
   - Intercepts all `localStorage.setItem()`, `getItem()`, and `removeItem()` calls
   - Automatically detects if Python server is running
   - Routes data to Python backend when available
   - Falls back to localStorage if server is unavailable

2. **Python Server (`storage_server.py`)**:
   - Provides REST API endpoints for storage operations
   - Handles saving/loading data to/from local files or cloud
   - Automatically syncs existing localStorage data on first connection

3. **Dual Storage**:
   - Data is always saved to both localStorage (as backup) and the backend
   - If backend is unavailable, localStorage continues to work
   - When backend reconnects, data is automatically synced

## API Endpoints

The server provides these endpoints:

- `GET /api/health` - Check server status
- `POST /api/storage/set` - Save data
- `POST /api/storage/get` - Load data
- `POST /api/storage/remove` - Delete data
- `GET /api/storage/keys` - List all keys
- `POST /api/storage/sync` - Sync multiple items at once

## Data Storage Structure

### Local Storage
Data is saved as JSON files:
```
listinglife_data/
  ├── EbayListingLife_default.json
  ├── SoldItemsTrends_default.json
  ├── ListingLifeSettings_default.json
  ├── ListingLifeStores.json
  └── ListingLifeCurrentStore.json
```

### Cloud Storage (S3)
Data is saved with the prefix `listinglife/`:
```
s3://your-bucket/
  └── listinglife/
      ├── EbayListingLife_default.json
      ├── SoldItemsTrends_default.json
      └── ...
```

## Troubleshooting

### Server won't start
- Check if port 5000 is already in use
- Verify Python and Flask are installed correctly
- Check for error messages in the console

### Browser can't connect to server
- Ensure the server is running
- Check browser console for CORS errors
- Verify firewall isn't blocking localhost:5000
- Try accessing `http://127.0.0.1:5000/api/health` directly in browser

### Cloud storage not working
- Verify AWS credentials are correct
- Check S3 bucket name and region
- Ensure IAM user has S3 permissions
- Check server logs for error messages

### Data not syncing
- Check browser console for errors
- Verify server is running and accessible
- Check network tab in browser dev tools
- Try refreshing the page

## Security Notes

- The server runs on localhost only (127.0.0.1) by default
- Never commit AWS credentials to version control
- Use environment variables or secure credential storage
- For production, consider adding authentication

## Advanced Usage

### Running as a Service

**Windows (using Task Scheduler or NSSM):**
```bash
# Create a batch file: start_storage_server.bat
@echo off
cd /d "C:\path\to\listinglife"
python storage_server.py
```

**Linux (using systemd):**
Create `/etc/systemd/system/listinglife-storage.service`:
```ini
[Unit]
Description=ListingLife Storage Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/listinglife
ExecStart=/usr/bin/python3 storage_server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable listinglife-storage
sudo systemctl start listinglife-storage
```

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the Python server console for errors
3. Verify all dependencies are installed
4. Ensure the storage wrapper script is loaded before other scripts



