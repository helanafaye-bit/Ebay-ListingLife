# Dropbox Storage Setup Guide

This guide explains how to configure ListingLife to save data to Dropbox instead of local files.

## Quick Setup

### Step 1: Get a Dropbox Access Token

1. **Go to Dropbox App Console**: https://www.dropbox.com/developers/apps
2. **Click "Create app"**
3. **Choose**:
   - **Scoped access** (recommended)
   - **Full Dropbox** (or App folder if you prefer)
   - **Name your app** (e.g., "ListingLife Storage")
4. **Click "Create app"**
5. **IMPORTANT: Enable Required Permissions**
   - Go to the **"Permissions"** tab in your app settings
   - Under **"Files and folders"**, make sure **"files.content.write"** is enabled
   - This permission is required for the app to save files to Dropbox
6. **In the app settings**, scroll down to "OAuth 2" section
7. **Click "Generate"** under "Generated access token"
8. **Copy the access token** (you'll need this)
9. **Note**: The generated token will be short-lived (starts with `sl.u.`) and expires after ~4 hours. This is normal - Dropbox no longer offers long-lived tokens via the app console. Simply regenerate the token when it expires, or update it in your settings.

**💡 For Long-Lived Access (Recommended):** See the "OAuth 2.0 with Refresh Tokens" section below to set up automatic token refresh so you don't have to manually update tokens every few hours.

### Step 2: Install Dropbox SDK

Run the installation script or manually install:

```bash
python -m pip install -r requirements.txt
```

This will install the `dropbox` package along with other dependencies.

### Step 3: Configure Environment Variables

**Windows (PowerShell):**
```powershell
$env:STORAGE_MODE="dropbox"
$env:DROPBOX_ACCESS_TOKEN="your-access-token-here"
$env:DROPBOX_FOLDER="/ListingLife"  # Optional, defaults to /ListingLife
python storage_server.py
```

**Windows (Command Prompt):**
```cmd
set STORAGE_MODE=dropbox
set DROPBOX_ACCESS_TOKEN=your-access-token-here
set DROPBOX_FOLDER=/ListingLife
python storage_server.py
```

**Linux/Mac:**
```bash
export STORAGE_MODE=dropbox
export DROPBOX_ACCESS_TOKEN=your-access-token-here
export DROPBOX_FOLDER=/ListingLife
python storage_server.py
```

### Step 4: Create a Batch File (Windows - Optional)

Create a file `start_dropbox_server.bat`:

```batch
@echo off
echo ========================================
echo ListingLife Storage Server - Dropbox
echo ========================================
echo.

set STORAGE_MODE=dropbox
set DROPBOX_ACCESS_TOKEN=your-access-token-here
set DROPBOX_FOLDER=/ListingLife

echo Starting Dropbox storage server...
python storage_server.py

pause
```

**Important**: Replace `your-access-token-here` with your actual Dropbox access token!

## Using a .env File (Recommended)

For better security, you can use a `.env` file:

1. **Install python-dotenv**:
   ```bash
   python -m pip install python-dotenv
   ```

2. **Create a `.env` file** in the same directory as `storage_server.py`:
   ```
   STORAGE_MODE=dropbox
   DROPBOX_ACCESS_TOKEN=your-access-token-here
   DROPBOX_FOLDER=/ListingLife
   ```

3. **Update `storage_server.py`** to load the .env file (add at the top):
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```

4. **Add `.env` to `.gitignore`** to keep your token secure:
   ```
   .env
   ```

## Dropbox Folder Structure

Data will be saved in your Dropbox folder structure like this:

```
/ListingLife/
  ├── EbayListingLife_store-default.json
  ├── SoldItemsTrends_store-default.json
  ├── ListingLifeSettings.json
  ├── ListingLifeStores.json
  └── ListingLifeCurrentStore.json
```

You can change the folder by setting `DROPBOX_FOLDER` environment variable (e.g., `/MyApps/ListingLife`).

## Switching Storage Modes

### Switch to Dropbox:
```bash
set STORAGE_MODE=dropbox
set DROPBOX_ACCESS_TOKEN=your-token
python storage_server.py
```

### Switch back to Local:
```bash
set STORAGE_MODE=local
python storage_server.py
```

### Switch to AWS S3:
```bash
set STORAGE_MODE=cloud
set S3_BUCKET=your-bucket
set AWS_ACCESS_KEY_ID=your-key
set AWS_SECRET_ACCESS_KEY=your-secret
python storage_server.py
```

## Verification

When the server starts, you should see:
```
============================================================
ListingLife Storage Server
============================================================
Storage Mode: DROPBOX
Dropbox Folder: /ListingLife
Server running on: http://127.0.0.1:5000
============================================================
```

In your browser console, you should see:
```
✅ Python storage backend connected
   Mode: dropbox
   Dropbox folder: /ListingLife
```

## Troubleshooting

### "Dropbox authentication failed"
- Verify your access token is correct
- Make sure the token hasn't expired
- Check that the app has the correct permissions

### "files.content.write scope required" or "not permitted to access this endpoint"
**This is the most common error!** Your Dropbox app is missing the required permission:
1. Go to https://www.dropbox.com/developers/apps
2. Click on your app (ID: 5405139 or your app ID)
3. Go to the **"Permissions"** tab
4. Under **"Files and folders"**, find **"files.content.write"**
5. **Enable it** (check the box)
6. **Regenerate your access token** (go back to "Settings" → "OAuth 2" → "Generate" new token)
7. **Update your access token** in the app settings
8. **Restart the storage server**

### "dropbox not installed"
- Run: `python -m pip install dropbox`
- Or: `python -m pip install -r requirements.txt`

### "Dropbox module not available"
- Make sure you've installed the dropbox package
- Restart the server after installing

### Data not appearing in Dropbox
- Check the Dropbox folder path is correct
- Verify the access token has write permissions
- Check server logs for error messages
- Look in your Dropbox account under the specified folder

## Security Notes

⚠️ **Important Security Tips:**

1. **Never commit your access token to version control**
   - Add `.env` to `.gitignore`
   - Never share your token publicly

2. **Use environment variables** instead of hardcoding tokens

3. **Rotate tokens** if you suspect they've been compromised

4. **Use scoped access** when creating the Dropbox app (more secure than full access)

5. **Consider using App folder** instead of Full Dropbox if you only need a specific folder

## Advanced: Using App Folder

If you created your app with "App folder" access:

1. The app will only have access to a specific folder in your Dropbox
2. The folder name will be the same as your app name
3. You can still use `DROPBOX_FOLDER` to specify a subfolder within the app folder
4. Example: If your app is named "ListingLife", files will be in `/ListingLife/` by default

## OAuth 2.0 with Refresh Tokens (Long-Lived Access)

If you're tired of updating your Dropbox token every few hours, you can set up OAuth 2.0 with refresh tokens for automatic token renewal.

### Benefits:
- ✅ Tokens automatically refresh when they expire
- ✅ No manual token updates needed
- ✅ Long-term access without interruption

### Setup Steps:

1. **Get Your App Key and Secret:**
   - Go to https://www.dropbox.com/developers/apps
   - Select your app
   - Go to the **"Settings"** tab
   - Find **"App key"** and **"App secret"** (click "Show" to reveal the secret)
   - Copy both values

2. **Get Initial Access and Refresh Tokens:**
   
   You need to perform an OAuth flow to get both access and refresh tokens. Here's a simple Python script to do this:
   
   ```python
   import requests
   import base64
   
   APP_KEY = "your-app-key-here"
   APP_SECRET = "your-app-secret-here"
   REDIRECT_URI = "http://localhost:5000/oauth/callback"  # Or any URL you control
   
   # Step 1: Get authorization URL
   auth_url = f"https://www.dropbox.com/oauth2/authorize?client_id={APP_KEY}&response_type=code&redirect_uri={REDIRECT_URI}"
   print(f"Visit this URL: {auth_url}")
   print("After authorizing, you'll be redirected. Copy the 'code' parameter from the URL.")
   
   # Step 2: Exchange code for tokens
   auth_code = input("Paste the authorization code here: ")
   
   auth_string = f"{APP_KEY}:{APP_SECRET}"
   auth_bytes = auth_string.encode('ascii')
   auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
   
   token_url = "https://api.dropbox.com/oauth2/token"
   data = {
       'code': auth_code,
       'grant_type': 'authorization_code',
       'redirect_uri': REDIRECT_URI
   }
   headers = {
       'Authorization': f'Basic {auth_b64}',
       'Content-Type': 'application/x-www-form-urlencoded'
   }
   
   response = requests.post(token_url, data=data, headers=headers)
   if response.status_code == 200:
       tokens = response.json()
       print(f"\n✅ Success! Here are your tokens:")
       print(f"Access Token: {tokens['access_token']}")
       print(f"Refresh Token: {tokens['refresh_token']}")
       print(f"\nAdd these to your storage_config.json:")
       print(f'"dropbox_access_token": "{tokens["access_token"]}",')
       print(f'"dropbox_refresh_token": "{tokens["refresh_token"]}",')
       print(f'"dropbox_app_key": "{APP_KEY}",')
       print(f'"dropbox_app_secret": "{APP_SECRET}"')
   else:
       print(f"Error: {response.status_code} - {response.text}")
   ```

3. **Update Your Configuration:**
   
   Add the following to your `storage_config.json`:
   ```json
   {
     "storage_mode": "dropbox",
     "dropbox_access_token": "your-access-token",
     "dropbox_refresh_token": "your-refresh-token",
     "dropbox_app_key": "your-app-key",
     "dropbox_app_secret": "your-app-secret",
     "dropbox_folder": "/ListingLife"
   }
   ```

4. **Restart the Server:**
   
   The server will now automatically refresh your access token when it expires. You'll see log messages like:
   ```
   ✅ Dropbox access token refreshed successfully
   ```

### Important Notes:
- The refresh token doesn't expire (unless revoked)
- The access token will be automatically refreshed when it expires
- Your refresh token is stored in `storage_config.json` - keep it secure!
- If you revoke access in Dropbox, you'll need to repeat the OAuth flow

## Support

If you encounter issues:
1. Check the Python server console for error messages
2. Check the browser console (F12) for connection errors
3. Verify your Dropbox access token is valid
4. Test the token by accessing Dropbox API directly



