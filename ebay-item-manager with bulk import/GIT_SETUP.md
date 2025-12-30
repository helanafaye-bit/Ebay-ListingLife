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


