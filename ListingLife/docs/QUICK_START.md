# Quick Start Guide

## Running the Storage Server

### Option 1: Use the Batch File (Windows)
Double-click `start_storage_server.bat`

### Option 2: Command Line
```bash
# Install dependencies (first time only)
pip install -r requirements.txt

# Run the server
python storage_server.py
```

## What Happens

1. **Server starts** on `http://127.0.0.1:5000`
2. **Open your HTML app** in the browser (any of the HTML files)
3. **Check browser console** - you should see:
   ```
   ✅ Python storage backend connected
   ```
4. **Data is now being saved** to:
   - Local files in `./listinglife_data/` folder (default)
   - OR to cloud storage if configured

## Switching to Cloud Storage

1. Set environment variables:
   ```bash
   set STORAGE_MODE=cloud
   set S3_BUCKET=your-bucket-name
   set AWS_ACCESS_KEY_ID=your-key
   set AWS_SECRET_ACCESS_KEY=your-secret
   set AWS_REGION=us-east-1
   ```

2. Restart the server

## Data Location

- **Local Mode**: `./listinglife_data/` folder (created automatically)
- **Cloud Mode**: AWS S3 bucket under `listinglife/` prefix

## Troubleshooting

**Server won't start?**
- Check if Python is installed: `python --version`
- Install dependencies: `pip install -r requirements.txt`

**Browser can't connect?**
- Make sure server is running
- Check browser console for errors
- Try: `http://127.0.0.1:5000/api/health` in browser

**Data not saving?**
- Check browser console for connection status
- Verify server console shows no errors
- Data is saved to both localStorage AND backend (dual storage)

## Need More Help?

See `STORAGE_SETUP.md` for detailed documentation.



