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
        this.syncInProgress = false;
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
                console.log('✅ Python storage backend connected');
                console.log(`   Mode: ${health.storage_mode || 'local'}`);
                console.log(`   Path: ${health.local_path || health.dropbox_folder || health.cloud_bucket || 'N/A'}`);
                // Sync existing localStorage data to backend on first connection
                if (!this.syncInProgress) {
                    // Delay sync to avoid blocking page load, but do it sooner
                    setTimeout(() => this.syncToBackend(), 500);
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

    async syncToBackend() {
        if (this.syncInProgress || !this.useBackend) return;
        
        this.syncInProgress = true;
        console.log('🔄 Syncing localStorage data to backend...');
        
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
                // Try sync endpoint, fallback to individual saves
                try {
                    const response = await fetch(`${this.backendUrl.replace('/storage', '/storage/sync')}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ items })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`✅ Synced ${result.synced || Object.keys(items).length} items to backend`);
                    }
                } catch (syncError) {
                    // Fallback: sync items individually (but don't block)
                    console.log('Batch sync not available, syncing individually...');
                    for (const [key, value] of Object.entries(items)) {
                        this.queueBackendSave(key, value);
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
