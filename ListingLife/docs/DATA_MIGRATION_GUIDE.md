# Data Migration Guide - Moving from Old to New ListingLife

## Understanding Where Your Data Is Stored

**Important:** The old version of ListingLife (HTML-only, without Python storage server) stores all data in your **browser's localStorage**. This means:

- ✅ Data is stored in the browser on the machine where you used the app
- ❌ Data is NOT stored in files on your computer
- ❌ Data is NOT automatically synced to Dropbox or cloud storage
- ⚠️ If you clear browser data or use a different browser, the data is lost

## How to Migrate Your Data

### Step 1: Export Data from Old Machine

1. **On your OLD machine** (where you originally created the listings):
   - Open the **same browser** you used with the old ListingLife app
   - Navigate to the ListingLife folder
   - Open `export-data.html` in that browser
   - The tool will show all your ListingLife data from localStorage
   - Check the boxes for all data you want to export (recommended: select all)
   - Click "Export Selected Data"
   - JSON files will download to your Downloads folder

2. **Transfer the exported JSON files** to your new machine:
   - Copy them to a USB drive
   - Email them to yourself
   - Upload to cloud storage (Dropbox, Google Drive, etc.)
   - Or use any other transfer method

### Step 2: Import Data on New Machine

1. **On your NEW machine**:
   - Make sure the Python storage server is running (if using Dropbox/cloud)
   - Open `migrate-data.html` in your browser
   - Click "Choose File" and select all the JSON files you exported
   - Click "Import Selected Files"
   - You should see a success message

2. **Verify the import**:
   - Open your ListingLife app (`ebaylistings.html`)
   - Your categories and items should now appear
   - Check the browser console (F12) for any messages

3. **Sync to Dropbox** (if configured):
   - If you have Dropbox configured, the app will automatically sync the imported data
   - You can verify this by checking the Dropbox folder in your Dropbox account
   - The data will now be backed up and available across devices

## Troubleshooting

### "I can't access the old machine's browser"

**Problem:** The data is only in that browser's localStorage. If you can't access that browser, you cannot export the data.

**Solutions:**
- If the old machine still works, you must access it to export
- If you have remote access (TeamViewer, RDP, etc.), use that
- If the machine is broken but the hard drive works, you might be able to access browser data (advanced - requires technical knowledge)

### "The export tool shows no data"

**Possible causes:**
- You're using a different browser than where you used the app
- The browser data was cleared
- You're looking in the wrong browser profile

**Solution:** Make sure you're using the exact same browser and profile where you used ListingLife.

### "Data imported but not showing in the app"

**Possible causes:**
- Wrong storage key format
- Data structure mismatch
- Store system creating different keys

**Solution:**
1. Open browser console (F12)
2. Look for messages about data loading
3. Check what storage keys were found
4. The app checks multiple possible keys, so it should find the data

### "Data appears but doesn't sync to Dropbox"

**Solution:**
1. Make sure the storage server is running
2. Check that Dropbox is configured in Settings
3. Verify the Dropbox connection works (test in Settings)
4. The app should automatically sync after import
5. Check browser console for sync messages

## What Gets Exported

The export tool exports all ListingLife-related data:
- `EbayListingLife` or `EbayListingLife_[store-id]` - Your main listings data
- `SoldItemsTrends` or `SoldItemsTrends_[store-id]` - Sold items data
- `ListingLifeStores` - Store configuration
- `ListingLifeCurrentStore` - Current store selection
- `ListingLifeSettings` - App settings
- Any other ListingLife-related keys

## After Migration

Once your data is imported and synced:
- ✅ Your data is now in localStorage on the new machine
- ✅ Your data is synced to Dropbox (if configured)
- ✅ Your data will be available across devices
- ✅ Future changes will be automatically synced

## Prevention for Future

To avoid this issue in the future:
1. **Set up Dropbox storage** in Settings
2. **Start the storage server** regularly
3. **Export your data periodically** as a backup
4. The new version automatically syncs to Dropbox, so your data is always backed up

