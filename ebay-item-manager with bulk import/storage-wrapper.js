/**
 * Storage Wrapper - Routes localStorage calls to Python backend
 * Automatically detects if Python server is running and routes accordingly
 * NON-BLOCKING: All backend operations are async and don't block the UI
 */
class StorageWrapper {
    constructor() {
        this.backendUrl = 'http://127.0.0.1:5000/api/storage';
        this.healthUrl = 'http://127.0.0.1:5000/api/health';
        this.useBackend = false;
        this.backendAvailable = false;
        this.backendStorageMode = 'local'; // Track actual backend storage mode
        this.syncInProgress = false;
        this.initialSyncAttempted = false; // Track if we've attempted initial sync
        this.pendingRequests = new Set(); // Track pending requests to prevent duplicates
        this.requestQueue = []; // Queue for rate limiting
        this.processingQueue = false;
        this.checkBackendAvailability();
    }

    async checkBackendAvailability() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // Increased timeout to 2 seconds
            
            const response = await fetch(this.healthUrl, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache' // Ensure we don't get cached responses
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const health = await response.json();
                this.useBackend = true;
                this.backendAvailable = true;
                this.backendStorageMode = health.storage_mode || 'local';
                console.log('✅ Python storage backend connected');
                console.log(`   Mode: ${this.backendStorageMode}`);
                console.log(`   Path: ${health.local_path || health.dropbox_folder || health.cloud_bucket || 'N/A'}`);
                
                // Check if Dropbox is configured in settings but backend is in LOCAL mode
                // This indicates Dropbox initialization failed
                const storageConfig = window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null;
                const configuredMode = storageConfig?.storage_mode || 'local';
                
                if (configuredMode === 'dropbox' && this.backendStorageMode === 'local') {
                    console.warn('⚠️ WARNING: Dropbox is configured but backend is using LOCAL storage!');
                    console.warn('   This means Dropbox initialization failed on the server.');
                    console.warn('   Check server logs for Dropbox errors.');
                    console.warn('   Common causes:');
                    console.warn('   - Missing dropbox package: pip install dropbox setuptools');
                    console.warn('   - Invalid or expired Dropbox token');
                    console.warn('   - Network connectivity issues');
                    console.warn('');
                    console.warn('   The server will use LOCAL storage until Dropbox is fixed.');
                    console.warn('   Local data may be out of sync with Dropbox data.');
                    
                    // Show a notification to the user
                    if (window.app && typeof window.app.showNotification === 'function') {
                        window.app.showNotification(
                            'Dropbox is configured but server is using LOCAL storage. Check server logs for errors. Local data may be out of sync.',
                            'warning',
                            10000
                        );
                    }
                }
                
                // Sync existing localStorage data to backend on first connection
                // IMPORTANT: Delay sync to allow app's loadData() to check backend first
                // This prevents overwriting newer backend data with old localStorage data
                if (!this.syncInProgress && !this.initialSyncAttempted) {
                    // Delay sync to give app time to load from backend first (2 seconds)
                    // The sync will check backend before syncing, so it's safe even if it runs earlier
                    this.initialSyncAttempted = true;
                    setTimeout(() => this.syncToBackend(), 2000);
                }
            } else {
                console.log(`⚠️ Backend returned status ${response.status}, using localStorage`);
                this.useBackend = false;
                this.backendAvailable = false;
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.log('⚠️ Python backend not available, using localStorage');
                console.log('   (This is normal if the storage server is not running)');
            }
            this.useBackend = false;
            this.backendAvailable = false;
        }
    }

    async syncToBackend(forceOverride = false) {
        if (this.syncInProgress || !this.useBackend) return;
        
        this.syncInProgress = true;
        if (forceOverride) {
            console.log('🔄 Force syncing to backend (overriding existing data)...');
        } else {
            console.log('🔄 Checking backend storage before syncing...');
        }
        
        try {
            // Collect all relevant localStorage keys
            const items = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (
                    key.startsWith('EbayListingLife') || 
                    key.startsWith('SoldItemsTrends') || 
                    key.startsWith('ListingLifeSettings') ||
                    key.startsWith('ListingLifeStores') ||
                    key === 'ListingLifeCurrentStore'
                )) {
                    const value = storageWrapper._originalGetItem ? storageWrapper._originalGetItem(key) : localStorage.getItem(key);
                    if (value) {
                        items[key] = value;
                    }
                }
            }

            if (Object.keys(items).length > 0) {
                // CRITICAL: Check if backend already has data for each key before syncing
                // This prevents overwriting newer backend data with old localStorage data
                // UNLESS forceOverride is true (allows editing/correcting mistakes)
                const itemsToSync = {};
                let checkedCount = 0;
                let skippedCount = 0;
                
                for (const [key, value] of Object.entries(items)) {
                    try {
                        // If force override, skip the check and sync everything
                        if (forceOverride) {
                            itemsToSync[key] = value;
                            checkedCount++;
                            continue;
                        }
                        
                        // Check if backend has data for this key
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3000);
                        
                        const checkResponse = await fetch(`${this.backendUrl}/get`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ key }),
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (checkResponse.ok) {
                            const checkResult = await checkResponse.json();
                            // checkResult.value can be an object, string, or null
                            // Check if it exists and has content (for objects, check if it has keys; for strings, check length)
                            const hasValue = checkResult.value !== null && checkResult.value !== undefined && 
                                (typeof checkResult.value === 'string' 
                                    ? checkResult.value.trim().length > 0 
                                    : (typeof checkResult.value === 'object' 
                                        ? Object.keys(checkResult.value).length > 0 
                                        : true));
                            
                            if (hasValue) {
                                // Check if Dropbox is configured but backend is LOCAL
                                // In this case, local data might be old and we should still try to sync
                                // (though if backend is LOCAL, it can't access Dropbox anyway)
                                const storageConfig = window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null;
                                const configuredMode = storageConfig?.storage_mode || 'local';
                                
                                if (configuredMode === 'dropbox' && this.backendStorageMode === 'local') {
                                    // Dropbox is configured but backend is LOCAL - this is a mismatch
                                    // Local data might be old, but backend can't access Dropbox anyway
                                    // So we'll skip sync but log a warning
                                    console.warn(`⚠️ Backend has LOCAL data for ${key}, but Dropbox is configured.`);
                                    console.warn(`   Backend cannot access Dropbox (initialization failed).`);
                                    console.warn(`   Skipping sync - fix Dropbox on server to access shared data.`);
                                    console.warn(`   To force sync anyway, use: storageWrapper.syncToBackend(true)`);
                                } else {
                                    // Normal case: backend already has data - don't overwrite it
                                    console.log(`⚠️ Backend already has data for ${key}, skipping sync to prevent overwrite`);
                                    console.log(`   To force sync and overwrite, use: storageWrapper.syncToBackend(true)`);
                                }
                                skippedCount++;
                                checkedCount++;
                                continue;
                            }
                        }
                        
                        // Backend is empty for this key - safe to sync
                        itemsToSync[key] = value;
                        checkedCount++;
                    } catch (checkError) {
                        if (checkError.name !== 'AbortError') {
                            console.warn(`Could not check backend for ${key}, will skip sync:`, checkError.message);
                        }
                        // If we can't check, don't sync to be safe
                        checkedCount++;
                    }
                }
                
                if (Object.keys(itemsToSync).length > 0) {
                    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} skipped - backend has data)` : '';
                    if (forceOverride) {
                        console.log(`🔄 Force syncing ${Object.keys(itemsToSync).length} items to backend (overriding existing data)...`);
                    } else {
                        console.log(`🔄 Syncing ${Object.keys(itemsToSync).length} items to backend${skippedMsg}`);
                    }
                    
                    // Try sync endpoint, fallback to individual saves
                    try {
                        const response = await fetch(`${this.backendUrl.replace('/storage', '/storage/sync')}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ items: itemsToSync })
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            if (forceOverride) {
                                console.log(`✅ Force synced ${result.synced || Object.keys(itemsToSync).length} items to backend (overwrote existing data)`);
                            } else {
                                console.log(`✅ Synced ${result.synced || Object.keys(itemsToSync).length} items to backend`);
                            }
                        }
                    } catch (syncError) {
                        // Fallback: sync items individually (but don't block)
                        console.log('Batch sync not available, syncing individually...');
                        for (const [key, value] of Object.entries(itemsToSync)) {
                            this.queueBackendSave(key, value);
                        }
                    }
                } else {
                    if (forceOverride) {
                        console.log(`ℹ️ No items to sync (all items already match backend)`);
                    } else {
                        console.log(`✓ Backend already has all data. No sync needed (prevents overwriting newer data).`);
                        console.log(`   To force sync anyway (e.g., to fix a typo), use: storageWrapper.syncToBackend(true)`);
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing to backend:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    // Queue backend operations to prevent overwhelming the server
    queueBackendSave(key, value) {
        // Skip if already pending
        if (this.pendingRequests.has(key)) {
            return;
        }

        this.pendingRequests.add(key);
        this.requestQueue.push({ type: 'set', key, value });
        
        if (!this.processingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.processingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.processingQueue = true;

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                if (request.type === 'set') {
                    await this.saveToBackend(request.key, request.value);
                    this.pendingRequests.delete(request.key);
                } else if (request.type === 'remove') {
                    await this.removeFromBackend(request.key);
                    this.pendingRequests.delete(`remove_${request.key}`);
                }
            } catch (error) {
                // Error already logged in saveToBackend/removeFromBackend
                if (request.type === 'set') {
                    this.pendingRequests.delete(request.key);
                } else if (request.type === 'remove') {
                    this.pendingRequests.delete(`remove_${request.key}`);
                }
            }

            // Small delay between requests to prevent overwhelming
            if (this.requestQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.processingQueue = false;
    }

    async saveToBackend(key, value) {
        if (!this.useBackend || !this.backendAvailable) {
            return;
        }

        try {
            // Parse value if it's a JSON string
            let parsedValue = value;
            if (typeof value === 'string') {
                try {
                    parsedValue = JSON.parse(value);
                } catch {
                    // Not JSON, keep as string
                    parsedValue = value;
                }
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

            const response = await fetch(`${this.backendUrl}/set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key, value: parsedValue }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Backend save failed');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Backend save failed for', key, ':', error.message);
            }
            this.backendAvailable = false;
            // Re-check backend availability after a delay
            setTimeout(() => this.checkBackendAvailability(), 5000);
            throw error;
        }
    }

    // Synchronous setItem - saves to localStorage immediately, queues backend save
    // Note: This is called from the override, so we use original methods directly
    setItem(key, value) {
        // This method is no longer used directly - the override calls queueBackendSave
        // Keeping for backward compatibility
        if (this.useBackend && this.backendAvailable) {
            this.queueBackendSave(key, value);
        }
    }

    // Synchronous getItem - reads from localStorage immediately
    // Backend sync happens in background without blocking
    getItem(key) {
        // Always return from localStorage immediately (synchronous)
        // Use original method if available, otherwise fallback
        if (this._originalGetItem) {
            return this._originalGetItem(key);
        }
        return localStorage.getItem(key);
    }

    // Synchronous removeItem - removes from localStorage immediately, queues backend remove
    // Note: This is called from the override, so we use original methods directly
    removeItem(key) {
        // This method is no longer used directly - the override calls queueBackendRemove
        // Keeping for backward compatibility
        if (this.useBackend && this.backendAvailable) {
            this.queueBackendRemove(key);
        }
    }

    queueBackendRemove(key) {
        if (this.pendingRequests.has(`remove_${key}`)) {
            return;
        }

        this.pendingRequests.add(`remove_${key}`);
        this.requestQueue.push({ type: 'remove', key });
        
        if (!this.processingQueue) {
            this.processQueue();
        }
    }

    async removeFromBackend(key) {
        if (!this.useBackend || !this.backendAvailable) {
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            await fetch(`${this.backendUrl}/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Backend remove failed for', key, ':', error.message);
            }
            this.backendAvailable = false;
            setTimeout(() => this.checkBackendAvailability(), 5000);
            throw error;
        }
    }

    // Periodic health check
    startHealthCheck() {
        setInterval(() => {
            if (!this.backendAvailable) {
                this.checkBackendAvailability();
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Force sync to backend, overriding existing data
     * Use this if you need to correct mistakes or overwrite backend data with localStorage data
     * 
     * Example: storageWrapper.forceSyncToBackend()
     */
    async forceSyncToBackend() {
        console.log('⚠️ Force sync requested - will overwrite backend data with localStorage data');
        console.log('   This is useful if you need to correct mistakes or restore from localStorage');
        return this.syncToBackend(true);
    }
}

// Save original Storage methods BEFORE creating wrapper (to avoid recursion)
const originalSetItem = Storage.prototype.setItem;
const originalGetItem = Storage.prototype.getItem;
const originalRemoveItem = Storage.prototype.removeItem;

// Initialize storage wrapper
const storageWrapper = new StorageWrapper();
// Store original methods in wrapper for direct access
storageWrapper._originalSetItem = function(key, value) {
    return originalSetItem.call(localStorage, key, value);
};
storageWrapper._originalGetItem = function(key) {
    return originalGetItem.call(localStorage, key);
};
storageWrapper._originalRemoveItem = function(key) {
    return originalRemoveItem.call(localStorage, key);
};
storageWrapper.startHealthCheck();

// Override setItem to sync to backend
Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    // Non-blocking backend sync (only queue, don't call setItem again)
    if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
        window.storageWrapper.queueBackendSave(key, value);
    }
};

// Keep getItem synchronous - only read from localStorage
Storage.prototype.getItem = function(key) {
    return originalGetItem.call(this, key);
};

// Override removeItem to sync to backend
Storage.prototype.removeItem = function(key) {
    originalRemoveItem.call(this, key);
    // Non-blocking backend sync (only queue, don't call removeItem again)
    if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
        window.storageWrapper.queueBackendRemove(key);
    }
};

// Export for debugging
window.storageWrapper = storageWrapper;

console.log('📦 Storage wrapper initialized (non-blocking mode)');
