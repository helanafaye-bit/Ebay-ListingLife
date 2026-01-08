"""
ListingLife Storage Server
Routes data from the browser app to local or cloud storage
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
from pathlib import Path
import logging
import gzip

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow requests from browser

# Global storage variables
STORAGE_MODE = 'local'
LOCAL_STORAGE_PATH = Path('./listinglife_data')
CLOUD_BUCKET = None
DROPBOX_ACCESS_TOKEN = None
DROPBOX_REFRESH_TOKEN = None
DROPBOX_APP_KEY = None
DROPBOX_APP_SECRET = None
DROPBOX_FOLDER = '/ListingLife'
s3_client = None
dropbox_client = None
dropbox = None

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent.absolute()
CONFIG_FILE = SCRIPT_DIR / 'storage_config.json'

def load_config_file():
    """Load storage config from file"""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                logger.info(f"Loaded config from: {CONFIG_FILE}")
                logger.info(f"Storage mode in config: {config.get('storage_mode', 'not set')}")
                return config
        except Exception as e:
            logger.error(f"Error loading config file: {e}")
    else:
        logger.info(f"Config file not found at: {CONFIG_FILE}")
    return None

def save_config_file(config):
    """Save storage config to file"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Error saving config file: {e}")
        return False

def initialize_storage():
    """Initialize storage based on current configuration"""
    global STORAGE_MODE, LOCAL_STORAGE_PATH, CLOUD_BUCKET, DROPBOX_ACCESS_TOKEN, DROPBOX_REFRESH_TOKEN
    global DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_FOLDER
    global s3_client, dropbox_client, dropbox
    
    # First, try to load from config file (takes precedence over env vars)
    config = load_config_file()
    if config:
        STORAGE_MODE = config.get('storage_mode', 'local').lower()
        LOCAL_STORAGE_PATH = Path(config.get('local_storage_path', './listinglife_data'))
        CLOUD_BUCKET = config.get('s3_bucket', None)
        DROPBOX_ACCESS_TOKEN = config.get('dropbox_access_token', None)
        DROPBOX_REFRESH_TOKEN = config.get('dropbox_refresh_token', None)
        DROPBOX_APP_KEY = config.get('dropbox_app_key', None)
        DROPBOX_APP_SECRET = config.get('dropbox_app_secret', None)
        DROPBOX_FOLDER = config.get('dropbox_folder', '/ListingLife')
        # Also set env vars for AWS if provided
        if config.get('aws_access_key_id'):
            os.environ['AWS_ACCESS_KEY_ID'] = config['aws_access_key_id']
        if config.get('aws_secret_access_key'):
            os.environ['AWS_SECRET_ACCESS_KEY'] = config['aws_secret_access_key']
        if config.get('aws_region'):
            os.environ['AWS_REGION'] = config['aws_region']
        logger.info(f"Loaded storage config from file: mode={STORAGE_MODE}")
    else:
        # Fall back to environment variables
        STORAGE_MODE = os.getenv('STORAGE_MODE', 'local').lower()
        LOCAL_STORAGE_PATH = Path(os.getenv('LOCAL_STORAGE_PATH', './listinglife_data'))
        CLOUD_BUCKET = os.getenv('S3_BUCKET', None)
        DROPBOX_ACCESS_TOKEN = os.getenv('DROPBOX_ACCESS_TOKEN', None)
        DROPBOX_FOLDER = os.getenv('DROPBOX_FOLDER', '/ListingLife')
        logger.info(f"Using environment variables for storage config: mode={STORAGE_MODE}")
    
    # Initialize storage
    if STORAGE_MODE == 'local':
        LOCAL_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
        logger.info(f"Local storage initialized at: {LOCAL_STORAGE_PATH.absolute()}")
    
    # Initialize S3 client if using cloud (S3)
    s3_client = None
    if STORAGE_MODE == 'cloud':
        try:
            import boto3
            if CLOUD_BUCKET:
                s3_client = boto3.client('s3',
                    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                    region_name=os.getenv('AWS_REGION', 'us-east-1')
                )
                logger.info(f"Cloud storage (S3) initialized with bucket: {CLOUD_BUCKET}")
            else:
                logger.warning("STORAGE_MODE is 'cloud' but S3_BUCKET not set. Falling back to local.")
                STORAGE_MODE = 'local'
        except ImportError:
            logger.warning("boto3 not installed. Cloud storage unavailable. Falling back to local.")
            STORAGE_MODE = 'local'
    
    # Initialize Dropbox client if using Dropbox
    dropbox_client = None
    if STORAGE_MODE == 'dropbox':
        # Try to import dropbox module - use local variable first to avoid shadowing global
        dropbox_imported = None
        try:
            import dropbox
            dropbox_imported = dropbox  # Keep reference to imported module
            dropbox = dropbox_imported  # Update global dropbox module reference
        except ImportError as import_error:
            error_msg = str(import_error)
            if 'pkg_resources' in error_msg or 'setuptools' in error_msg:
                logger.error("Dropbox requires setuptools. Install with: pip install setuptools dropbox")
            else:
                logger.warning(f"dropbox library not installed: {import_error}. Install with: pip install dropbox")
            logger.warning("Falling back to local storage.")
            STORAGE_MODE = 'local'
            dropbox = None
        except Exception as e:
            logger.error(f"Error importing dropbox: {e}")
            logger.warning("Falling back to local storage.")
            STORAGE_MODE = 'local'
            dropbox = None
        
        if dropbox_imported and STORAGE_MODE == 'dropbox':
            if DROPBOX_ACCESS_TOKEN:
                # Check if token is short-lived (starts with 'sl.u.')
                # Note: As of 2024, Dropbox only issues short-lived tokens via the app console
                # Long-lived tokens require OAuth flow with refresh tokens
                if DROPBOX_ACCESS_TOKEN.startswith('sl.u.'):
                    logger.info("ℹ️  Using short-lived Dropbox token (this is normal)")
                    logger.info("   Short-lived tokens from the app console expire after ~4 hours.")
                    logger.info("   If your token expires, simply generate a new one in Dropbox app settings.")
                    logger.info("   The app will continue working with short-lived tokens.")
                    logger.info("")
                
                try:
                    dropbox_client = dropbox_imported.Dropbox(DROPBOX_ACCESS_TOKEN)
                    # Test connection with retry for temporary network issues
                    max_retries = 3
                    retry_count = 0
                    connection_success = False
                    
                    while retry_count < max_retries and not connection_success:
                        try:
                            dropbox_client.users_get_current_account()
                            connection_success = True
                            logger.info(f"✅ Dropbox storage initialized. Folder: {DROPBOX_FOLDER}")
                            logger.info(f"   Token: {DROPBOX_ACCESS_TOKEN[:20]}... (length: {len(DROPBOX_ACCESS_TOKEN)})")
                            # Update global dropbox module reference
                            dropbox = dropbox_imported
                            # Success! Keep STORAGE_MODE as 'dropbox' and dropbox_client set
                        except (dropbox_imported.exceptions.AuthError, dropbox_imported.exceptions.ApiError) as api_error:
                            # Only retry on network/rate limit errors, not auth errors
                            error_msg = str(api_error)
                            error_type = type(api_error).__name__
                            
                            # Check for specific expired token indicators
                            is_expired = (
                                'expired_access_token' in error_msg or
                                (error_type == 'AuthError' and 'expired' in error_msg.lower() and 'token' in error_msg.lower()) or
                                (hasattr(api_error, 'error') and hasattr(api_error.error, 'is_expired') and api_error.error.is_expired())
                            )
                            
                            if is_expired:
                                # Definitely expired, don't retry
                                raise
                            
                            # Check for rate limiting or temporary errors
                            is_temporary = (
                                'rate_limit' in error_msg.lower() or
                                'too_many_requests' in error_msg.lower() or
                                '503' in error_msg or
                                '502' in error_msg or
                                '504' in error_msg
                            )
                            
                            if is_temporary and retry_count < max_retries - 1:
                                retry_count += 1
                                import time
                                time.sleep(1)  # Wait 1 second before retry
                                continue
                            else:
                                raise
                    
                    # If we get here and connection_success is True, Dropbox is working
                    if connection_success:
                        # Ensure STORAGE_MODE stays as 'dropbox' and update global dropbox module
                        STORAGE_MODE = 'dropbox'
                        dropbox = dropbox_imported  # Update global dropbox module reference
                        logger.info("✅ Dropbox connection verified and active")
                    
                except dropbox_imported.exceptions.AuthError as auth_error:
                    error_msg = str(auth_error)
                    error_type = type(auth_error).__name__
                    
                    # Only report as expired if we're certain
                    is_expired = (
                        'expired_access_token' in error_msg or
                        (error_type == 'AuthError' and 'expired' in error_msg.lower() and 'token' in error_msg.lower()) or
                        (hasattr(auth_error, 'error') and hasattr(auth_error.error, 'is_expired') and auth_error.error.is_expired())
                    )
                    
                    if is_expired:
                        logger.error(f"Dropbox access token has expired. Please generate a new token from:")
                        logger.error("https://www.dropbox.com/developers/apps")
                        logger.error("Go to your app -> Settings -> OAuth 2 -> Generate access token")
                        logger.error("Then update the token in your settings or restart the server with the new token.")
                    else:
                        logger.warning(f"Dropbox authentication issue (may be temporary): {auth_error}")
                        logger.info("Falling back to local storage. Dropbox will be retried on next operation.")
                    STORAGE_MODE = 'local'
                    dropbox_client = None
                    dropbox = None
                except Exception as e:
                    error_msg = str(e)
                    error_type = type(e).__name__
                    
                    # Only report as expired if we're certain - be very specific
                    is_expired = (
                        'expired_access_token' in error_msg or
                        (error_type == 'AuthError' and 'expired' in error_msg.lower() and 'token' in error_msg.lower())
                    )
                    
                    # Don't treat generic 401 or 'expired' as token expiration unless it's specifically about tokens
                    if is_expired:
                        logger.error(f"Dropbox access token has expired. Please generate a new token from:")
                        logger.error("https://www.dropbox.com/developers/apps")
                        logger.error("Go to your app -> Settings -> OAuth 2 -> Generate access token")
                        logger.error("Then update the token in your settings or restart the server with the new token.")
                    else:
                        logger.warning(f"Dropbox connection issue (may be temporary): {e}")
                        logger.info("Falling back to local storage. Dropbox will be retried on next operation.")
                    STORAGE_MODE = 'local'
                    dropbox_client = None
                    dropbox = None
            else:
                logger.warning("STORAGE_MODE is 'dropbox' but DROPBOX_ACCESS_TOKEN not set. Falling back to local.")
                STORAGE_MODE = 'local'
                dropbox = None

# Don't initialize here - wait for main block to load config first
# initialize_storage() will be called in if __name__ == '__main__' block

def save_to_local(key, data):
    """Save data to local file (compact JSON, no indent to save space)"""
    try:
        file_path = LOCAL_STORAGE_PATH / f"{key}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        logger.info(f"Saved to local: {key}")
        return True
    except Exception as e:
        logger.error(f"Error saving to local {key}: {e}")
        raise

def load_from_local(key):
    """Load data from local file"""
    try:
        file_path = LOCAL_STORAGE_PATH / f"{key}.json"
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"Loaded from local: {key}")
            return data
        return None
    except Exception as e:
        logger.error(f"Error loading from local {key}: {e}")
        return None

def save_to_cloud(key, data):
    """Save data to cloud storage (S3) with compression"""
    if not s3_client:
        raise Exception("S3 client not initialized")
    
    try:
        # Use compact JSON and compress to save space
        json_data = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        compressed_data = gzip.compress(json_data.encode('utf-8'))
        
        s3_client.put_object(
            Bucket=CLOUD_BUCKET,
            Key=f"listinglife/{key}.json.gz",
            Body=compressed_data,
            ContentType='application/gzip',
            ContentEncoding='gzip'
        )
        logger.info(f"Saved to cloud: {key} (compressed)")
        return True
    except Exception as e:
        logger.error(f"Error saving to cloud {key}: {e}")
        raise

def load_from_cloud(key):
    """Load data from cloud storage (S3) - supports compressed and uncompressed"""
    if not s3_client:
        raise Exception("S3 client not initialized")
    
    try:
        # Try compressed file first
        try:
            response = s3_client.get_object(
                Bucket=CLOUD_BUCKET,
                Key=f"listinglife/{key}.json.gz"
            )
            compressed_data = response['Body'].read()
            decompressed_data = gzip.decompress(compressed_data)
            data = json.loads(decompressed_data.decode('utf-8'))
            logger.info(f"Loaded from cloud: {key} (compressed)")
            return data
        except s3_client.exceptions.NoSuchKey:
            # Try uncompressed for backward compatibility
            try:
                response = s3_client.get_object(
                    Bucket=CLOUD_BUCKET,
                    Key=f"listinglife/{key}.json"
                )
                data = json.loads(response['Body'].read().decode('utf-8'))
                logger.info(f"Loaded from cloud: {key} (uncompressed)")
                return data
            except s3_client.exceptions.NoSuchKey:
                logger.info(f"Key not found in cloud: {key}")
                return None
    except Exception as e:
        logger.error(f"Error loading from cloud {key}: {e}")
        return None

def refresh_dropbox_token():
    """Refresh Dropbox access token using refresh token"""
    global DROPBOX_ACCESS_TOKEN, dropbox_client, dropbox
    
    if not DROPBOX_REFRESH_TOKEN or not DROPBOX_APP_KEY or not DROPBOX_APP_SECRET:
        return False
    
    try:
        import requests
        import base64
        
        # OAuth 2.0 token refresh endpoint
        url = 'https://api.dropbox.com/oauth2/token'
        auth_string = f"{DROPBOX_APP_KEY}:{DROPBOX_APP_SECRET}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': DROPBOX_REFRESH_TOKEN
        }
        
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(url, data=data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            token_data = response.json()
            DROPBOX_ACCESS_TOKEN = token_data.get('access_token')
            
            # Update refresh token if a new one is provided
            if 'refresh_token' in token_data:
                DROPBOX_REFRESH_TOKEN = token_data['refresh_token']
                # Save updated tokens to config
                config = load_config_file()
                if config:
                    config['dropbox_access_token'] = DROPBOX_ACCESS_TOKEN
                    config['dropbox_refresh_token'] = DROPBOX_REFRESH_TOKEN
                    save_config_file(config)
            
            # Recreate Dropbox client with new token
            dropbox_client = dropbox.Dropbox(DROPBOX_ACCESS_TOKEN)
            logger.info("✅ Dropbox access token refreshed successfully")
            return True
        else:
            logger.error(f"Failed to refresh Dropbox token: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"Error refreshing Dropbox token: {e}")
        return False

def save_to_dropbox(key, data):
    """Save data to Dropbox with compression"""
    global dropbox_client
    
    if not dropbox_client or not dropbox:
        raise Exception("Dropbox client not initialized")
    
    try:
        # Use compact JSON (no indent) and compress with gzip to save space
        json_data = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        compressed_data = gzip.compress(json_data.encode('utf-8'))
        
        # Save as .json.gz to indicate it's compressed
        file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json.gz"
        
        # Upload compressed data to Dropbox
        dropbox_client.files_upload(
            compressed_data,
            file_path,
            mode=dropbox.files.WriteMode('overwrite')
        )
        
        original_size = len(json_data.encode('utf-8'))
        compressed_size = len(compressed_data)
        compression_ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
        logger.info(f"Saved to Dropbox: {key} ({compressed_size}B compressed, {compression_ratio:.1f}% reduction)")
        return True
    except dropbox.exceptions.AuthError as auth_error:
        error_msg = str(auth_error)
        # Only report as expired if we're certain
        is_expired = (
            'expired_access_token' in error_msg or
            (hasattr(auth_error, 'error') and hasattr(auth_error.error, 'is_expired') and auth_error.error.is_expired())
        )
        
        if is_expired:
            # Try to refresh token if we have refresh token
            if DROPBOX_REFRESH_TOKEN and refresh_dropbox_token():
                # Retry the save operation with new token
                try:
                    json_data = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
                    compressed_data = gzip.compress(json_data.encode('utf-8'))
                    file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json.gz"
                    dropbox_client.files_upload(
                        compressed_data,
                        file_path,
                        mode=dropbox.files.WriteMode('overwrite')
                    )
                    original_size = len(json_data.encode('utf-8'))
                    compressed_size = len(compressed_data)
                    compression_ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
                    logger.info(f"Saved to Dropbox: {key} ({compressed_size}B compressed, {compression_ratio:.1f}% reduction) [after token refresh]")
                    return True
                except Exception as retry_error:
                    raise Exception(f"Token refreshed but save failed: {retry_error}")
            else:
                raise Exception(
                    "Your Dropbox access token has expired.\n\n"
                    "To fix:\n"
                    "1. Go to https://www.dropbox.com/developers/apps\n"
                    "2. Select your app -> Settings -> OAuth 2\n"
                    "3. Click 'Generate' under 'Generated access token'\n"
                    "4. Copy the new token\n"
                    "5. Update it in your app settings (no server restart needed)\n\n"
                    "For long-lived access, set up OAuth 2.0 with refresh tokens (see DROPBOX_SETUP.md)"
                )
        raise Exception(f"Dropbox authentication error: {auth_error}")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error saving to Dropbox {key}: {e}")
        
        # Only check for expired token if it's specifically mentioned
        is_expired = (
            'expired_access_token' in error_msg or
            (hasattr(e, 'error') and hasattr(e.error, 'is_expired') and e.error.is_expired())
        )
        
        if is_expired:
            raise Exception(
                "Your Dropbox access token has expired (this is normal for short-lived tokens).\n\n"
                "To fix:\n"
                "1. Go to https://www.dropbox.com/developers/apps\n"
                "2. Select your app -> Settings -> OAuth 2\n"
                "3. Click 'Generate' under 'Generated access token'\n"
                "4. Copy the new token\n"
                "5. Update it in your app settings (no server restart needed)"
            )
        # Check for permission/scope errors
        elif 'files.content.write' in error_msg or 'required scope' in error_msg.lower():
            raise Exception(
                "Dropbox permission error: Your app needs the 'files.content.write' scope. "
                "Go to https://www.dropbox.com/developers/apps, select your app, "
                "go to the 'Permissions' tab, and enable 'files.content.write'. "
                "Then regenerate your access token."
            )
        raise

def load_from_dropbox(key):
    """Load data from Dropbox (supports both compressed and uncompressed)"""
    global dropbox_client
    
    if not dropbox_client or not dropbox:
        raise Exception("Dropbox client not initialized")
    
    try:
        # Try compressed file first (.json.gz)
        file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json.gz"
        try:
            _, response = dropbox_client.files_download(file_path)
            # Decompress and parse
            decompressed_data = gzip.decompress(response.content)
            data = json.loads(decompressed_data.decode('utf-8'))
            logger.info(f"Loaded from Dropbox: {key} (compressed)")
            return data
        except dropbox.exceptions.ApiError as e:
            # If compressed file not found, try uncompressed (.json) for backward compatibility
            if e.error.is_path() and e.error.get_path().is_not_found():
                file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json"
                try:
                    _, response = dropbox_client.files_download(file_path)
                    data = json.loads(response.content.decode('utf-8'))
                    logger.info(f"Loaded from Dropbox: {key} (uncompressed, consider re-saving to compress)")
                    return data
                except dropbox.exceptions.ApiError as e2:
                    if e2.error.is_path() and e2.error.get_path().is_not_found():
                        logger.info(f"Key not found in Dropbox: {key}")
                        return None
                    raise
            raise
    except dropbox.exceptions.AuthError as auth_error:
        error_msg = str(auth_error)
        is_expired = (
            'expired_access_token' in error_msg or
            (hasattr(auth_error, 'error') and hasattr(auth_error.error, 'is_expired') and auth_error.error.is_expired())
        )
        
        if is_expired and DROPBOX_REFRESH_TOKEN and refresh_dropbox_token():
            # Retry the load operation with new token
            try:
                file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json.gz"
                try:
                    _, response = dropbox_client.files_download(file_path)
                    decompressed_data = gzip.decompress(response.content)
                    data = json.loads(decompressed_data.decode('utf-8'))
                    logger.info(f"Loaded from Dropbox: {key} (compressed) [after token refresh]")
                    return data
                except dropbox.exceptions.ApiError as e:
                    if e.error.is_path() and e.error.get_path().is_not_found():
                        file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json"
                        try:
                            _, response = dropbox_client.files_download(file_path)
                            data = json.loads(response.content.decode('utf-8'))
                            logger.info(f"Loaded from Dropbox: {key} (uncompressed) [after token refresh]")
                            return data
                        except dropbox.exceptions.ApiError:
                            logger.info(f"Key not found in Dropbox: {key}")
                            return None
            except Exception as retry_error:
                logger.error(f"Error loading from Dropbox {key} after token refresh: {retry_error}")
                return None
        else:
            logger.error(f"Error loading from Dropbox {key}: {auth_error}")
            return None
    except dropbox.exceptions.ApiError as e:
        if e.error.is_path() and e.error.get_path().is_not_found():
            logger.info(f"Key not found in Dropbox: {key}")
            return None
        logger.error(f"Error loading from Dropbox {key}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error loading from Dropbox {key}: {e}")
        return None

@app.route('/api/storage/set', methods=['POST'])
def set_item():
    """Save data to storage"""
    try:
        data = request.json
        key = data.get('key')
        value = data.get('value')
        
        if not key:
            return jsonify({'error': 'Key is required'}), 400
        
        # Parse value if it's a string (JSON)
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except:
                pass  # Keep as string if not valid JSON
        
        # Save based on storage mode
        if STORAGE_MODE == 'local':
            logger.info(f"💾 Saving to LOCAL storage: {key}")
            save_to_local(key, value)
        elif STORAGE_MODE == 'cloud':
            logger.info(f"☁️ Saving to CLOUD storage: {key}")
            save_to_cloud(key, value)
        elif STORAGE_MODE == 'dropbox':
            if not dropbox_client:
                logger.error(f"❌ Dropbox client not initialized! Cannot save {key}")
                logger.error(f"   Current STORAGE_MODE: {STORAGE_MODE}")
                logger.error(f"   dropbox_client: {dropbox_client}")
                logger.error(f"   dropbox: {dropbox}")
                return jsonify({'error': 'Dropbox client not initialized. Check server logs.'}), 500
            logger.info(f"📦 Saving to DROPBOX storage: {key}")
            save_to_dropbox(key, value)
            logger.info(f"✅ Successfully saved {key} to Dropbox")
        else:
            return jsonify({'error': f'Invalid storage mode: {STORAGE_MODE}'}), 500
        
        return jsonify({'success': True, 'message': f'Data saved for key: {key}'})
    except Exception as e:
        logger.error(f"Error in set_item: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/get', methods=['POST'])
def get_item():
    """Load data from storage"""
    try:
        data = request.json
        key = data.get('key')
        
        if not key:
            return jsonify({'error': 'Key is required'}), 400
        
        # Load based on storage mode
        if STORAGE_MODE == 'local':
            logger.info(f"📂 Loading from LOCAL storage: {key}")
            result = load_from_local(key)
        elif STORAGE_MODE == 'cloud':
            logger.info(f"☁️ Loading from CLOUD storage: {key}")
            result = load_from_cloud(key)
        elif STORAGE_MODE == 'dropbox':
            if not dropbox_client:
                logger.error(f"❌ Dropbox client not initialized! Cannot load {key}")
                logger.error(f"   Current STORAGE_MODE: {STORAGE_MODE}")
                logger.error(f"   dropbox_client: {dropbox_client}")
                return jsonify({'error': 'Dropbox client not initialized. Check server logs.'}), 500
            logger.info(f"📦 Loading from DROPBOX storage: {key}")
            result = load_from_dropbox(key)
            if result:
                logger.info(f"✅ Successfully loaded {key} from Dropbox")
            else:
                logger.info(f"ℹ️ {key} not found in Dropbox")
        else:
            return jsonify({'error': f'Invalid storage mode: {STORAGE_MODE}'}), 500
        
        if result is None:
            return jsonify({'value': None})
        
        return jsonify({'value': result})
    except Exception as e:
        logger.error(f"Error in get_item: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/remove', methods=['POST'])
def remove_item():
    """Remove data from storage"""
    try:
        data = request.json
        key = data.get('key')
        
        if not key:
            return jsonify({'error': 'Key is required'}), 400
        
        if STORAGE_MODE == 'local':
            file_path = LOCAL_STORAGE_PATH / f"{key}.json"
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Removed from local: {key}")
        elif STORAGE_MODE == 'cloud':
            try:
                s3_client.delete_object(
                    Bucket=CLOUD_BUCKET,
                    Key=f"listinglife/{key}.json"
                )
                logger.info(f"Removed from cloud: {key}")
            except s3_client.exceptions.NoSuchKey:
                pass  # Already doesn't exist
        elif STORAGE_MODE == 'dropbox':
            try:
                if not dropbox:
                    raise Exception("Dropbox module not available")
                file_path = f"{DROPBOX_FOLDER.rstrip('/')}/{key}.json"
                dropbox_client.files_delete(file_path)
                logger.info(f"Removed from Dropbox: {key}")
            except dropbox.exceptions.ApiError as e:
                if e.error.is_path() and e.error.get_path().is_not_found():
                    pass  # Already doesn't exist
                else:
                    raise
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error in remove_item: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/keys', methods=['GET'])
def list_keys():
    """List all storage keys"""
    try:
        if STORAGE_MODE == 'local':
            keys = [f.stem for f in LOCAL_STORAGE_PATH.glob('*.json')]
        elif STORAGE_MODE == 'cloud':
            response = s3_client.list_objects_v2(
                Bucket=CLOUD_BUCKET,
                Prefix='listinglife/'
            )
            keys = [obj['Key'].replace('listinglife/', '').replace('.json', '') 
                   for obj in response.get('Contents', [])]
        elif STORAGE_MODE == 'dropbox':
            try:
                if not dropbox:
                    raise Exception("Dropbox module not available")
                folder_path = DROPBOX_FOLDER.rstrip('/')
                response = dropbox_client.files_list_folder(folder_path)
                keys = []
                for entry in response.entries:
                    if isinstance(entry, dropbox.files.FileMetadata) and entry.name.endswith('.json'):
                        keys.append(entry.name.replace('.json', ''))
                # Handle pagination if needed
                while response.has_more:
                    response = dropbox_client.files_list_folder_continue(response.cursor)
                    for entry in response.entries:
                        if isinstance(entry, dropbox.files.FileMetadata) and entry.name.endswith('.json'):
                            keys.append(entry.name.replace('.json', ''))
            except dropbox.exceptions.ApiError as e:
                if e.error.is_path() and e.error.get_path().is_not_found():
                    keys = []  # Folder doesn't exist yet
                else:
                    raise
        else:
            keys = []
        
        return jsonify({'keys': keys})
    except Exception as e:
        logger.error(f"Error in list_keys: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'storage_mode': STORAGE_MODE,
        'local_path': str(LOCAL_STORAGE_PATH.absolute()) if STORAGE_MODE == 'local' else None,
        'cloud_bucket': CLOUD_BUCKET if STORAGE_MODE == 'cloud' else None,
        'dropbox_folder': DROPBOX_FOLDER if STORAGE_MODE == 'dropbox' else None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/storage/sync', methods=['POST'])
def sync_data():
    """Sync all data from localStorage (called on initial connection)"""
    try:
        data = request.json
        items = data.get('items', {})
        
        synced = 0
        for key, value in items.items():
            try:
                # Parse value if it's a string
                if isinstance(value, str):
                    try:
                        value = json.loads(value)
                    except:
                        pass
                
                if STORAGE_MODE == 'local':
                    save_to_local(key, value)
                elif STORAGE_MODE == 'cloud':
                    save_to_cloud(key, value)
                elif STORAGE_MODE == 'dropbox':
                    save_to_dropbox(key, value)
                synced += 1
            except Exception as e:
                error_msg = str(e)
                # Provide helpful message for Dropbox permission errors
                if 'files.content.write' in error_msg or 'required scope' in error_msg.lower():
                    logger.error(f"Error syncing {key}: Dropbox permission error - 'files.content.write' scope required")
                else:
                    logger.error(f"Error syncing {key}: {e}")
        
        return jsonify({'success': True, 'synced': synced})
    except Exception as e:
        logger.error(f"Error in sync_data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/config', methods=['GET'])
def get_storage_config():
    """Get current storage configuration"""
    try:
        config = load_config_file()
        if not config:
            # Return current environment-based config
            config = {
                'storage_mode': STORAGE_MODE,
                'local_storage_path': str(LOCAL_STORAGE_PATH.absolute()) if STORAGE_MODE == 'local' else None,
                'dropbox_access_token': DROPBOX_ACCESS_TOKEN if STORAGE_MODE == 'dropbox' else None,
                'dropbox_folder': DROPBOX_FOLDER if STORAGE_MODE == 'dropbox' else None,
                's3_bucket': CLOUD_BUCKET if STORAGE_MODE == 'cloud' else None,
                'aws_region': os.getenv('AWS_REGION', 'us-east-1') if STORAGE_MODE == 'cloud' else None
            }
        # Don't return sensitive data
        safe_config = {
            'storage_mode': config.get('storage_mode', 'local'),
            'local_storage_path': config.get('local_storage_path'),
            'dropbox_folder': config.get('dropbox_folder', '/ListingLife'),
            's3_bucket': config.get('s3_bucket'),
            'aws_region': config.get('aws_region', 'us-east-1'),
            'has_dropbox_token': bool(config.get('dropbox_access_token')),
            'has_aws_credentials': bool(config.get('aws_access_key_id'))
        }
        return jsonify(safe_config)
    except Exception as e:
        logger.error(f"Error in get_storage_config: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/config', methods=['POST'])
def set_storage_config():
    """Save storage configuration"""
    try:
        config = request.json
        if save_config_file(config):
            # Re-initialize storage with new config (initialize_storage now reads from config file)
            initialize_storage()
            
            # Return appropriate message based on storage mode
            if STORAGE_MODE == 'dropbox':
                if dropbox_client:
                    return jsonify({
                        'success': True,
                        'message': 'Configuration saved and Dropbox connection verified. No restart needed.'
                    })
                else:
                    return jsonify({
                        'success': True,
                        'message': 'Configuration saved. Dropbox connection failed - check token and try again.'
                    })
            elif STORAGE_MODE == 'cloud':
                if s3_client:
                    return jsonify({
                        'success': True,
                        'message': 'Configuration saved and S3 connection initialized. No restart needed.'
                    })
                else:
                    return jsonify({
                        'success': True,
                        'message': 'Configuration saved. S3 connection failed - check credentials.'
                    })
            else:
                return jsonify({
                    'success': True,
                    'message': 'Configuration saved. Local storage mode active. No restart needed.'
                })
        else:
            return jsonify({'error': 'Failed to save configuration'}), 500
    except Exception as e:
        logger.error(f"Error in set_storage_config: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/test', methods=['POST'])
def test_storage():
    """Test storage connection with provided credentials"""
    try:
        config = request.json
        mode = config.get('storage_mode', 'local')
        
        if mode == 'local':
            path = config.get('local_storage_path', './listinglife_data')
            test_path = Path(path)
            try:
                test_path.mkdir(parents=True, exist_ok=True)
                # Test write
                test_file = test_path / '.test_write'
                test_file.write_text('test')
                test_file.unlink()
                return jsonify({'success': True, 'message': f'Local storage path is accessible: {path}'})
            except Exception as e:
                return jsonify({'error': f'Cannot access local path: {str(e)}'}), 400
                
        elif mode == 'dropbox':
            token = config.get('dropbox_access_token')
            if not token:
                return jsonify({'error': 'Dropbox access token is required'}), 400
            
            try:
                import dropbox
            except ImportError as import_error:
                error_msg = str(import_error)
                if 'pkg_resources' in error_msg or 'setuptools' in error_msg:
                    return jsonify({
                        'error': 'Missing Python dependency: setuptools. Please install it with: pip install setuptools dropbox'
                    }), 400
                else:
                    return jsonify({
                        'error': f'Dropbox library not installed. Please install it with: pip install dropbox. Error: {error_msg}'
                    }), 400
            
            try:
                test_client = dropbox.Dropbox(token)
                # Test connection
                test_client.users_get_current_account()
                
                # Test write permission by attempting to upload a small test file
                try:
                    test_file_path = f"{config.get('dropbox_folder', '/ListingLife').rstrip('/')}/.test_write"
                    test_client.files_upload(
                        b'test',
                        test_file_path,
                        mode=dropbox.files.WriteMode('overwrite')
                    )
                    # Clean up test file
                    try:
                        test_client.files_delete(test_file_path)
                    except:
                        pass  # Ignore cleanup errors
                except Exception as write_error:
                    error_msg = str(write_error)
                    if 'files.content.write' in error_msg or 'required scope' in error_msg.lower():
                        return jsonify({
                            'error': "Dropbox permission error: Your app needs the 'files.content.write' scope. Go to https://www.dropbox.com/developers/apps, select your app, go to the 'Permissions' tab, enable 'files.content.write', and regenerate your access token."
                        }), 400
                    else:
                        return jsonify({'error': f'Dropbox write test failed: {error_msg}'}), 400
                
                folder = config.get('dropbox_folder', '/ListingLife')
                return jsonify({'success': True, 'message': f'Dropbox connection successful. Folder: {folder}'})
            except dropbox.exceptions.AuthError as auth_error:
                error_msg = str(auth_error)
                # Only report as expired if we're certain
                is_expired = (
                    'expired_access_token' in error_msg or
                    (hasattr(auth_error, 'error') and hasattr(auth_error.error, 'is_expired') and auth_error.error.is_expired())
                )
                
                if is_expired:
                    return jsonify({
                        'error': 'Your Dropbox access token has expired (this is normal for short-lived tokens).\n\nTo fix:\n1. Go to https://www.dropbox.com/developers/apps\n2. Select your app -> Settings -> OAuth 2\n3. Click "Generate" under "Generated access token"\n4. Copy the new token\n5. Update it in your app settings (no server restart needed)'
                    }), 400
                elif 'Invalid access token' in error_msg:
                    return jsonify({'error': 'Invalid Dropbox access token. Please check your token and try again.'}), 400
                else:
                    return jsonify({'error': f'Dropbox authentication failed: {error_msg}'}), 400
            except Exception as e:
                error_msg = str(e)
                # Only check for expired token if it's specifically mentioned
                is_expired = (
                    'expired_access_token' in error_msg or
                    (hasattr(e, 'error') and hasattr(e.error, 'is_expired') and e.error.is_expired())
                )
                
                if is_expired:
                    return jsonify({
                        'error': 'Your Dropbox access token has expired (this is normal for short-lived tokens).\n\nTo fix:\n1. Go to https://www.dropbox.com/developers/apps\n2. Select your app -> Settings -> OAuth 2\n3. Click "Generate" under "Generated access token"\n4. Copy the new token\n5. Update it in your app settings (no server restart needed)'
                    }), 400
                elif 'Invalid access token' in error_msg:
                    return jsonify({'error': 'Invalid Dropbox access token. Please check your token and try again.'}), 400
                elif 'files.content.write' in error_msg or 'required scope' in error_msg.lower():
                    return jsonify({
                        'error': "Dropbox permission error: Your app needs the 'files.content.write' scope. Go to https://www.dropbox.com/developers/apps, select your app, go to the 'Permissions' tab, enable 'files.content.write', and regenerate your access token."
                    }), 400
                elif 'pkg_resources' in error_msg:
                    return jsonify({
                        'error': 'Missing Python dependency: setuptools. Please install it with: pip install setuptools dropbox'
                    }), 400
                else:
                    return jsonify({'error': f'Dropbox connection failed: {error_msg}'}), 400
                
        elif mode == 'cloud':
            bucket = config.get('s3_bucket')
            access_key = config.get('aws_access_key_id')
            secret_key = config.get('aws_secret_access_key')
            region = config.get('aws_region', 'us-east-1')
            
            if not all([bucket, access_key, secret_key]):
                return jsonify({'error': 'All AWS credentials are required'}), 400
            
            try:
                import boto3
                test_client = boto3.client('s3',
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region
                )
                # Test connection
                test_client.head_bucket(Bucket=bucket)
                return jsonify({'success': True, 'message': f'AWS S3 connection successful. Bucket: {bucket}'})
            except Exception as e:
                return jsonify({'error': f'AWS S3 connection failed: {str(e)}'}), 400
        else:
            return jsonify({'error': f'Invalid storage mode: {mode}'}), 400
            
    except Exception as e:
        logger.error(f"Error in test_storage: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/storage/size', methods=['GET'])
def get_storage_size():
    """Get storage size information"""
    try:
        total_size = 0
        file_count = 0
        file_sizes = {}
        
        if STORAGE_MODE == 'local':
            if LOCAL_STORAGE_PATH.exists():
                for file_path in LOCAL_STORAGE_PATH.glob('*.json'):
                    size = file_path.stat().st_size
                    total_size += size
                    file_count += 1
                    file_sizes[file_path.name] = size
        
        elif STORAGE_MODE == 'dropbox' and dropbox_client:
            try:
                # List all files in Dropbox folder
                folder_path = DROPBOX_FOLDER.rstrip('/')
                result = dropbox_client.files_list_folder(folder_path)
                
                while True:
                    for entry in result.entries:
                        if isinstance(entry, dropbox.files.FileMetadata):
                            # Check if it's a compressed file
                            if entry.name.endswith('.json.gz'):
                                file_count += 1
                                size = entry.size
                                total_size += size
                                file_sizes[entry.name] = size
                            elif entry.name.endswith('.json'):
                                file_count += 1
                                size = entry.size
                                total_size += size
                                file_sizes[entry.name] = size
                    
                    if not result.has_more:
                        break
                    result = dropbox_client.files_list_folder_continue(result.cursor)
            except Exception as e:
                logger.warning(f"Could not list Dropbox files: {e}")
        
        # Format sizes
        def format_size(bytes_size):
            for unit in ['B', 'KB', 'MB', 'GB']:
                if bytes_size < 1024.0:
                    return f"{bytes_size:.2f} {unit}"
                bytes_size /= 1024.0
            return f"{bytes_size:.2f} TB"
        
        # Sort files by size (largest first)
        sorted_files = sorted(file_sizes.items(), key=lambda x: x[1], reverse=True)
        
        return jsonify({
            'storage_mode': STORAGE_MODE,
            'total_size_bytes': total_size,
            'total_size_formatted': format_size(total_size),
            'file_count': file_count,
            'files': [
                {
                    'name': name,
                    'size_bytes': size,
                    'size_formatted': format_size(size)
                }
                for name, size in sorted_files[:20]  # Top 20 largest files
            ]
        })
    except Exception as e:
        logger.error(f"Error in get_storage_size: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Verify Python version compatibility
    import sys
    if sys.version_info < (3, 7):
        print("=" * 60)
        print("ERROR: Python 3.7 or higher is required")
        print(f"Current version: {sys.version}")
        print("=" * 60)
        input("Press Enter to exit...")
        sys.exit(1)
    
    # Try to load config from file first
    file_config = load_config_file()
    if file_config:
        # Override environment variables with file config
        requested_mode = file_config.get('storage_mode', 'local')
        os.environ['STORAGE_MODE'] = requested_mode
        logger.info(f"Setting storage mode from config: {requested_mode}")
        
        if file_config.get('local_storage_path'):
            os.environ['LOCAL_STORAGE_PATH'] = file_config['local_storage_path']
        if file_config.get('dropbox_access_token'):
            token = file_config['dropbox_access_token']
            os.environ['DROPBOX_ACCESS_TOKEN'] = token
            logger.info(f"Dropbox token loaded: {token[:20]}... (length: {len(token)})")
        if file_config.get('dropbox_folder'):
            os.environ['DROPBOX_FOLDER'] = file_config['dropbox_folder']
        if file_config.get('s3_bucket'):
            os.environ['S3_BUCKET'] = file_config['s3_bucket']
        if file_config.get('aws_access_key_id'):
            os.environ['AWS_ACCESS_KEY_ID'] = file_config['aws_access_key_id']
        if file_config.get('aws_secret_access_key'):
            os.environ['AWS_SECRET_ACCESS_KEY'] = file_config['aws_secret_access_key']
        if file_config.get('aws_region'):
            os.environ['AWS_REGION'] = file_config['aws_region']
        
        # Re-initialize storage with new config
        logger.info("=" * 60)
        logger.info("Initializing storage with config file settings...")
        logger.info("=" * 60)
        initialize_storage()
        logger.info("=" * 60)
        logger.info(f"✅ Storage initialized: {STORAGE_MODE.upper()}")
        if STORAGE_MODE == 'dropbox':
            logger.info(f"   Dropbox folder: {DROPBOX_FOLDER}")
            logger.info(f"   Dropbox client: {'✅ Connected' if dropbox_client else '❌ Not connected'}")
        elif STORAGE_MODE == 'local':
            logger.info(f"   Local path: {LOCAL_STORAGE_PATH.absolute()}")
        logger.info("=" * 60)
        
        # Warn if Dropbox was requested but not initialized
        if requested_mode == 'dropbox' and STORAGE_MODE != 'dropbox':
            print("=" * 60)
            print("⚠️  WARNING: Dropbox was requested but initialization failed!")
            print("=" * 60)
            print("The server will use LOCAL storage instead.")
            print("Check the logs above for error details.")
            print("=" * 60)
            print()
    else:
        logger.info("No config file found, using environment variables or defaults")
        initialize_storage()
    
    print("=" * 60)
    print("ListingLife Storage Server")
    print("=" * 60)
    print(f"Python Version: {sys.version.split()[0]}")
    print(f"Storage Mode: {STORAGE_MODE.upper()}")
    if STORAGE_MODE == 'local':
        print(f"Local Storage Path: {LOCAL_STORAGE_PATH.absolute()}")
    elif STORAGE_MODE == 'cloud':
        print(f"Cloud Bucket (S3): {CLOUD_BUCKET}")
    elif STORAGE_MODE == 'dropbox':
        print(f"Dropbox Folder: {DROPBOX_FOLDER}")
        if dropbox_client:
            print("✅ Dropbox connection: ACTIVE")
        else:
            print("❌ Dropbox connection: FAILED (check logs above)")
    print(f"Server running on: http://127.0.0.1:5000")
    print("=" * 60)
    print("Press Ctrl+C to stop the server")
    print()
    
    try:
        app.run(host='127.0.0.1', port=5000, debug=False)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"\nERROR: Server crashed: {e}")
        logger.exception("Server error:")
        input("Press Enter to exit...")
        sys.exit(1)

