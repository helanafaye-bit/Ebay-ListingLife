# Git Setup - Removing Test Data

## Important: Before Committing to GitHub

If you've already committed test data or sensitive files to your repository, you need to remove them from git history.

### Files That Should NOT Be Committed:

1. **`listinglife_data/`** - Contains user data, test listings, categories, stores
2. **`storage_config.json`** - Contains Dropbox access tokens (sensitive!)

### How to Clean Your Repository:

If you've already pushed these files to GitHub, run these commands to remove them from git:

```bash
# Remove listinglife_data directory from git (but keep local files)
git rm -r --cached listinglife_data/

# Remove storage_config.json from git (but keep local file)
git rm --cached storage_config.json

# Commit the removal
git commit -m "Remove test data and sensitive config files"

# Push to GitHub
git push
```

### After Cleanup:

The `.gitignore` file has been created to prevent these files from being committed in the future:
- `listinglife_data/` - All user data files
- `storage_config.json` - Storage configuration with access tokens

### First-Time Setup:

New users should:
1. Copy `storage_config.json.example` to `storage_config.json`
2. Fill in their own Dropbox token in `storage_config.json` (via Settings page in the app)
3. Start with empty `listinglife_data/` directory (created automatically)

The app will work correctly with empty data - users start with no categories or items until they add them.

## Cleaning Up Old Local Data Before Syncing

**Important:** If you're switching between laptops or have old test data in your `listinglife_data/` folder, you should clean it up before syncing to Dropbox to prevent old data from overwriting your current data.

### Steps to Clean Up:

1. **Backup current data** (if needed):
   - If you have important data in Dropbox, it's already backed up there
   - If you only have local data you want to keep, make a backup copy of the `listinglife_data/` folder

2. **Delete old local data**:
   - Close the storage server if it's running
   - Delete the entire `listinglife_data/` folder
   - The folder will be recreated automatically when you start the server

3. **Configure Dropbox**:
   - Open the app Settings page
   - Select "Dropbox" as storage mode
   - Enter your Dropbox access token
   - Click "Save Storage Settings"
   - The server will automatically connect to Dropbox and load your data from there

4. **Verify**:
   - Check the server console - it should show "Dropbox storage initialized"
   - Your data should load from Dropbox, not from local files
   - New data will be saved to Dropbox automatically

### Why This Matters:

- If you have old test data in `listinglife_data/` from a different laptop, the sync process might try to upload that old data to Dropbox
- The app checks if backend (Dropbox) already has data before syncing, but it's safer to start with a clean local folder
- The `listinglife_data/` folder is already in `.gitignore`, so it won't be committed to GitHub




