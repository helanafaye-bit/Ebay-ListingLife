class ListingLifeSettingsPage {
    constructor() {
        this.SETTINGS_KEY = 'ListingLifeSettings';
        this.STORAGE_CONFIG_KEY = 'ListingLifeStorageConfig';
        this.DEFAULT_CURRENCY = 'GBP';
        this.CURRENCY_MAP = {
            GBP: { label: 'British Pound', symbol: '£', locale: 'en-GB' },
            USD: { label: 'US Dollar', symbol: '$', locale: 'en-US' },
            EUR: { label: 'Euro', symbol: '€', locale: 'de-DE' },
            AUD: { label: 'Australian Dollar', symbol: '$', locale: 'en-AU' },
            CAD: { label: 'Canadian Dollar', symbol: '$', locale: 'en-CA' }
        };

        this.currencySelect = document.getElementById('settingsCurrencySelect');
        this.statusMessage = document.getElementById('settingsCurrencyStatus');
        
        // Storage settings elements
        this.storageModeSelect = document.getElementById('storageModeSelect');
        this.localStoragePath = document.getElementById('localStoragePath');
        this.browseFolderBtn = document.getElementById('browseFolderBtn');
        this.dropboxAccessToken = document.getElementById('dropboxAccessToken');
        this.dropboxFolder = document.getElementById('dropboxFolder');
        this.s3Bucket = document.getElementById('s3Bucket');
        this.awsAccessKeyId = document.getElementById('awsAccessKeyId');
        this.awsSecretAccessKey = document.getElementById('awsSecretAccessKey');
        this.awsRegion = document.getElementById('awsRegion');
        this.saveStorageBtn = document.getElementById('saveStorageBtn');
        this.testStorageBtn = document.getElementById('testStorageBtn');
        this.storageStatus = document.getElementById('storageStatus');
        
        this.storageOptions = {
            local: document.getElementById('localStorageOptions'),
            dropbox: document.getElementById('dropboxStorageOptions'),
            cloud: document.getElementById('cloudStorageOptions')
        };

        this.init();
    }

    init() {
        this.setupNavigation();
        this.applySavedCurrency();
        this.registerEvents();
        this.loadStorageSettings();
    }

    setupNavigation() {
        const setActive = (target) => {
            document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
                btn.classList.toggle('menu-btn-active', btn.dataset.navTarget === target);
            });
        };

        setActive('settings');

        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const target = btn.dataset.navTarget;
                if (target === 'home') {
                    sessionStorage.removeItem('listingLifeSkipHome');
                    window.location.href = './index.html';
                } else if (target === 'listinglife') {
                    sessionStorage.setItem('listingLifeSkipHome', 'true');
                    window.location.href = './ebaylistings.html?skipHome=1';
                } else if (target === 'ended') {
                    sessionStorage.setItem('listingLifeSkipHome', 'true');
                    window.location.href = './ebaylistings.html?view=ended&skipHome=1';
                } else if (target === 'sold') {
                    window.location.href = './sold-items-trends.html';
                } else if (target === 'settings') {
                    setActive('settings');
                }
            });
        });
    }

    registerEvents() {
        if (this.currencySelect) {
            this.currencySelect.addEventListener('change', () => this.handleCurrencyChange());
        }
        
        // Storage settings events
        if (this.storageModeSelect) {
            this.storageModeSelect.addEventListener('change', () => this.handleStorageModeChange());
        }
        
        if (this.browseFolderBtn) {
            this.browseFolderBtn.addEventListener('click', () => this.browseFolder());
        }
        
        if (this.saveStorageBtn) {
            this.saveStorageBtn.addEventListener('click', () => this.saveStorageSettings());
        }
        
        if (this.testStorageBtn) {
            this.testStorageBtn.addEventListener('click', () => this.testStorageConnection());
        }
    }
    
    handleStorageModeChange() {
        const mode = this.storageModeSelect.value;
        
        // Hide all options
        Object.values(this.storageOptions).forEach(opt => {
            if (opt) opt.style.display = 'none';
        });
        
        // Show selected option
        if (this.storageOptions[mode]) {
            this.storageOptions[mode].style.display = 'block';
        }
    }
    
    async browseFolder() {
        // Try File System Access API (modern browsers)
        if ('showDirectoryPicker' in window) {
            try {
                const directoryHandle = await window.showDirectoryPicker();
                const path = directoryHandle.name;
                // Note: File System Access API doesn't give full path for security
                // We'll use the folder name and let user know they may need to enter full path
                this.localStoragePath.value = path;
                this.showStorageStatus('Folder selected: ' + path + '. You may need to enter the full path manually.', 'info');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error selecting folder:', error);
                    this.showStorageStatus('Error selecting folder. Please enter the path manually.', 'error');
                }
            }
        } else {
            // Fallback: Show instructions
            const path = prompt('Enter the full path to the folder where you want to save data:\n\nExample: C:\\Users\\YourName\\ListingLife\\data');
            if (path) {
                this.localStoragePath.value = path;
            }
        }
    }
    
    async loadStorageSettings() {
        try {
            // Try to get current config from backend with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
            
            const response = await fetch('http://127.0.0.1:5000/api/storage/config', {
                method: 'GET',
                signal: controller.signal
            }).catch(() => null); // Silently catch network errors
            
            clearTimeout(timeoutId);
            
            if (response && response.ok) {
                const config = await response.json();
                // Backend returns safe config (no tokens), so also load from localStorage for tokens
                const localConfig = this.loadLocalStorageConfig();
                if (localConfig) {
                    // Merge: use backend config for mode/paths, localStorage for tokens
                    const merged = { ...config, ...localConfig };
                    this.applyStorageConfig(merged);
                } else {
                    this.applyStorageConfig(config);
                }
                return;
            }
        } catch (error) {
            // Backend not available - this is normal if server isn't running
            // Silently fall through to localStorage
        }
        
        // Fallback to localStorage
        const localConfig = this.loadLocalStorageConfig();
        if (localConfig) {
            this.applyStorageConfig(localConfig);
        } else {
            // Default to local
            this.storageModeSelect.value = 'local';
            this.handleStorageModeChange();
        }
    }
    
    loadLocalStorageConfig() {
        try {
            const raw = localStorage.getItem(this.STORAGE_CONFIG_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }
    
    applyStorageConfig(config) {
        if (config.storage_mode) {
            this.storageModeSelect.value = config.storage_mode;
            this.handleStorageModeChange();
        }
        
        if (config.local_storage_path) {
            this.localStoragePath.value = config.local_storage_path;
        }
        
        if (config.dropbox_access_token) {
            this.dropboxAccessToken.value = config.dropbox_access_token;
        }
        
        if (config.dropbox_folder) {
            this.dropboxFolder.value = config.dropbox_folder;
        }
        
        if (config.s3_bucket) {
            this.s3Bucket.value = config.s3_bucket;
        }
        
        if (config.aws_access_key_id) {
            this.awsAccessKeyId.value = config.aws_access_key_id;
        }
        
        if (config.aws_secret_access_key) {
            this.awsSecretAccessKey.value = config.aws_secret_access_key;
        }
        
        if (config.aws_region) {
            this.awsRegion.value = config.aws_region;
        }
    }
    
    async saveStorageSettings() {
        const mode = this.storageModeSelect.value;
        const config = {
            storage_mode: mode
        };
        
        // Validate and collect config based on mode
        if (mode === 'local') {
            const path = this.localStoragePath.value.trim();
            if (!path) {
                this.showStorageStatus('Please enter a storage folder path.', 'error');
                return;
            }
            config.local_storage_path = path;
        } else if (mode === 'dropbox') {
            const token = this.dropboxAccessToken.value.trim();
            if (!token) {
                this.showStorageStatus('Please enter your Dropbox access token.', 'error');
                return;
            }
            config.dropbox_access_token = token;
            config.dropbox_folder = this.dropboxFolder.value.trim() || '/ListingLife';
        } else if (mode === 'cloud') {
            const bucket = this.s3Bucket.value.trim();
            const accessKey = this.awsAccessKeyId.value.trim();
            const secretKey = this.awsSecretAccessKey.value.trim();
            const region = this.awsRegion.value.trim() || 'us-east-1';
            
            if (!bucket || !accessKey || !secretKey) {
                this.showStorageStatus('Please fill in all AWS S3 credentials.', 'error');
                return;
            }
            config.s3_bucket = bucket;
            config.aws_access_key_id = accessKey;
            config.aws_secret_access_key = secretKey;
            config.aws_region = region;
        }
        
        // Save to localStorage
        try {
            localStorage.setItem(this.STORAGE_CONFIG_KEY, JSON.stringify(config));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
        
        // Try to save to backend
        try {
            const response = await fetch('http://127.0.0.1:5000/api/storage/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            if (response.ok) {
                this.showStorageStatus('Storage settings saved! Please restart the storage server for changes to take effect.', 'success');
            } else {
                const error = await response.json();
                this.showStorageStatus('Settings saved locally. Backend update failed: ' + (error.error || 'Unknown error') + '. Please restart the server manually.', 'warning');
            }
        } catch (error) {
            this.showStorageStatus('Settings saved locally. Backend not available - please restart the storage server manually with the new settings.', 'warning');
        }
    }
    
    async testStorageConnection() {
        const mode = this.storageModeSelect.value;
        this.showStorageStatus('Testing connection...', 'info');
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/storage/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    storage_mode: mode,
                    local_storage_path: mode === 'local' ? this.localStoragePath.value.trim() : undefined,
                    dropbox_access_token: mode === 'dropbox' ? this.dropboxAccessToken.value.trim() : undefined,
                    dropbox_folder: mode === 'dropbox' ? (this.dropboxFolder.value.trim() || '/ListingLife') : undefined,
                    s3_bucket: mode === 'cloud' ? this.s3Bucket.value.trim() : undefined,
                    aws_access_key_id: mode === 'cloud' ? this.awsAccessKeyId.value.trim() : undefined,
                    aws_secret_access_key: mode === 'cloud' ? this.awsSecretAccessKey.value.trim() : undefined,
                    aws_region: mode === 'cloud' ? (this.awsRegion.value.trim() || 'us-east-1') : undefined
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showStorageStatus(result.message || 'Connection test successful!', 'success');
            } else {
                let errorMessage = 'Unknown error';
                try {
                    const error = await response.json();
                    errorMessage = error.error || error.message || 'Unknown error';
                    
                    // Provide helpful messages for common errors
                    if (errorMessage.includes('pkg_resources') || errorMessage.includes('No module named')) {
                        errorMessage = `Python module missing: ${errorMessage}. Please install required Python packages. Run: pip install setuptools dropbox`;
                    } else if (errorMessage.includes('Dropbox connection failed')) {
                        errorMessage = `Dropbox connection failed: ${errorMessage}. Please check your access token and ensure the storage server has the required packages installed (pip install dropbox setuptools).`;
                    }
                } catch (parseError) {
                    errorMessage = `Server error (${response.status}). Check the storage server console for details.`;
                }
                this.showStorageStatus('Connection test failed: ' + errorMessage, 'error');
            }
        } catch (error) {
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.showStorageStatus('Cannot test connection: Backend server not available. Make sure the storage server is running on port 5000.', 'error');
            } else {
                this.showStorageStatus('Cannot test connection: ' + error.message, 'error');
            }
        }
    }
    
    showStorageStatus(message, type = 'info') {
        if (!this.storageStatus) return;
        this.storageStatus.textContent = message;
        this.storageStatus.className = 'settings-status ' + (type === 'error' ? 'error' : type === 'success' ? '' : '');
    }

    handleCurrencyChange() {
        if (!this.currencySelect) return;
        const selectedCode = this.currencySelect.value;
        this.saveSettings({ soldCurrency: selectedCode });
        this.renderStatus(`Currency updated to ${this.describeCurrency(selectedCode)}.`);
    }

    applySavedCurrency() {
        if (!this.currencySelect) return;
        const settings = this.loadSettings();
        const savedCurrency = settings.soldCurrency && this.CURRENCY_MAP[settings.soldCurrency]
            ? settings.soldCurrency
            : this.DEFAULT_CURRENCY;

        this.currencySelect.value = savedCurrency;
        this.renderStatus(`Currently using ${this.describeCurrency(savedCurrency)}.`);
    }

    describeCurrency(code) {
        const meta = this.CURRENCY_MAP[code] || this.CURRENCY_MAP[this.DEFAULT_CURRENCY];
        return `${code} (${meta.symbol})`;
    }

    renderStatus(message) {
        if (!this.statusMessage) return;
        this.statusMessage.textContent = message;
    }

    loadSettings() {
        try {
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey(this.SETTINGS_KEY) : this.SETTINGS_KEY;
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.warn('Unable to parse settings; using defaults.', error);
            return {};
        }
    }

    saveSettings(patch) {
        const current = this.loadSettings();
        const updated = { ...current, ...patch };
        try {
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey(this.SETTINGS_KEY) : this.SETTINGS_KEY;
            localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save settings.', error);
            this.renderStatus('Unable to save settings. Please check browser storage permissions.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.listingLifeSettingsPage = new ListingLifeSettingsPage();
});

