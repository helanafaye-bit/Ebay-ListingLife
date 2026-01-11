# Data Recovery Guide

If your ListingLife categories and items are missing after updating, your data is likely still safe in the `listinglife_data` folder. Here's how to recover it:

## Option 1: Use the Migration Tool (Recommended)

1. **Open the migration tool:**
   - Navigate to your ListingLife folder
   - Open `migrate-data.html` in your web browser

2. **Import your data files:**
   - Click "Select JSON files to import"
   - Navigate to the `listinglife_data` folder
   - Select these files (in this order):
     - `ListingLifeStores.json` (store configuration)
     - `ListingLifeCurrentStore.json` (current store setting)
     - `EbayListingLife_ebay-mhtpx8il.json` (your actual data)
     - Any other data files you want to import

3. **Click "Import Selected Files"**

4. **Refresh your ListingLife page** - Your data should now appear!

## Option 2: Start the Storage Server

If you prefer to use the storage server (which automatically syncs data):

1. **Start the storage server:**
   - Double-click `start_storage_server.bat` (Windows)
   - Or run: `python storage_server.py`

2. **Keep the server running** while using ListingLife

3. **Refresh your ListingLife page** - The server will automatically load data from the JSON files

## Option 3: Manual Import via Browser Console

If the above options don't work, you can manually import via the browser console:

1. **Open your ListingLife page** in the browser
2. **Open Developer Tools** (F12)
3. **Go to the Console tab**
4. **Copy and paste this code** (replace the file path with your actual path):

```javascript
// Read the JSON file (you'll need to adjust the path)
fetch('listinglife_data/EbayListingLife_ebay-mhtpx8il.json')
  .then(response => response.json())
  .then(data => {
    localStorage.setItem('EbayListingLife_ebay-mhtpx8il', JSON.stringify(data));
    console.log('Data imported! Refreshing page...');
    location.reload();
  })
  .catch(error => console.error('Error:', error));
```

## Why This Happened

When you download a new version, the browser's localStorage is separate from the file system. Your data is stored in:
- **Backend storage**: JSON files in `listinglife_data/` folder (persistent)
- **Browser storage**: localStorage (cleared when browser data is cleared)

The migration tool copies data from the JSON files into localStorage so the app can access it.

## Need Help?

If you're still having issues:
1. Check that the JSON files exist in `listinglife_data/` folder
2. Verify the file names match what the app expects
3. Check the browser console for any error messages

