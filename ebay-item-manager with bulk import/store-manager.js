// Store Management System
class StoreManager {
    constructor() {
        this.stores = [];
        this.currentStoreId = null;
        // Immediately restore dropdown value from localStorage to prevent flicker during navigation
        this.restoreDropdownValueImmediately();
        this.init();
    }

    restoreDropdownValueImmediately() {
        // Synchronously read current store from localStorage and set dropdown value immediately
        // This prevents visual flicker when navigating between pages
        try {
            const storeSelect = document.getElementById('storeSelect');
            if (!storeSelect) return;

            const savedStoreId = localStorage.getItem('ListingLifeCurrentStore');
            if (savedStoreId) {
                // Load stores synchronously from localStorage if available
                const savedStores = localStorage.getItem('ListingLifeStores');
                if (savedStores) {
                    try {
                        const stores = JSON.parse(savedStores);
                        // Check if saved store ID exists in stores list
                        const store = stores.find(s => s.id === savedStoreId);
                        if (store) {
                            // Set value immediately if store exists
                            // The value will be set properly once stores are loaded
                            // but this prevents the "Select Store" flash
                            this.currentStoreId = savedStoreId;
                            
                            // If dropdown already has options populated, set the value now
                            // Otherwise, the value will be set during updateStoreDropdown()
                            if (storeSelect.options.length > 1) {
                                const optionExists = Array.from(storeSelect.options).some(opt => opt.value === savedStoreId);
                                if (optionExists) {
                                    storeSelect.value = savedStoreId;
                                }
                            } else {
                                // Dropdown doesn't have options yet, but cache the store ID
                                // so updateStoreDropdown() knows which value to set
                                this._pendingStoreId = savedStoreId;
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        } catch (e) {
            // Ignore errors during immediate restore
        }
    }

    async init() {
        await this.loadStores();
        await this.migrateStoreIdsIfNeeded(); // Migrate old random IDs to deterministic IDs
        await this.loadCurrentStore();
        // Clear pending store ID if it was set during immediate restore
        if (this._pendingStoreId && this.currentStoreId === this._pendingStoreId) {
            this._pendingStoreId = null;
        }
        this.setupEventListeners();
        this.updateStoreDropdown();
    }
    
    // Generate deterministic ID based on store name (same as in handleStoreFormSubmit)
    generateStoreId(storeName) {
        // Simple hash function to create deterministic ID from name
        let hash = 0;
        const normalizedName = storeName.toLowerCase().trim();
        for (let i = 0; i < normalizedName.length; i++) {
            const char = normalizedName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Make it positive and add 'store-' prefix
        return `store-${Math.abs(hash).toString(36)}`;
    }
    
    // Check if a store ID looks like an old random ID (contains timestamp-like pattern)
    isRandomStoreId(storeId) {
        // Old format: store-<timestamp>36base-<random> (e.g., "store-k123abc-def456")
        // New format: store-<hash> (e.g., "store-abc123")
        // Random IDs have multiple segments separated by hyphens (more than 2 parts)
        // Keep 'default' as-is (it's a special case)
        if (storeId === 'default') {
            return false;
        }
        const parts = storeId.split('-');
        // If it has more than 2 parts (store-xxx-yyy), it's likely a random ID from the old format
        // This matches the old format: `store-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
        return parts.length > 2;
    }
    
    async migrateStoreIdsIfNeeded() {
        let migrated = false;
        const migrationMap = {}; // oldId -> newId mapping
        
        // Check each store to see if it needs migration
        for (const store of this.stores) {
            const expectedId = this.generateStoreId(store.name);
            
            // If the store ID is different from what it should be (based on name), migrate it
            if (store.id !== expectedId && this.isRandomStoreId(store.id)) {
                console.log(`Migrating store "${store.name}" from ID "${store.id}" to "${expectedId}"...`);
                migrationMap[store.id] = expectedId;
                
                // Migrate data keys from old ID to new ID
                const dataKeys = ['EbayListingLife', 'SoldItemsTrends', 'ImportedItems'];
                let dataMigrated = false;
                
                for (const dataKey of dataKeys) {
                    const oldKey = `${dataKey}_${store.id}`;
                    const newKey = `${dataKey}_${expectedId}`;
                    
                    // Migrate from localStorage
                    const oldData = localStorage.getItem(oldKey);
                    if (oldData) {
                        try {
                            // Only migrate if new key doesn't already exist (don't overwrite)
                            if (!localStorage.getItem(newKey)) {
                                localStorage.setItem(newKey, oldData);
                                console.log(`  ✓ Migrated ${dataKey} from localStorage (${oldKey} -> ${newKey})`);
                                dataMigrated = true;
                            } else {
                                console.log(`  ⚠ ${dataKey} already exists at ${newKey}, keeping both (old data at ${oldKey})`);
                            }
                        } catch (error) {
                            console.error(`  ✗ Error migrating ${dataKey} from localStorage:`, error);
                        }
                    }
                    
                    // Also migrate from backend if available
                    if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
                        try {
                            const response = await fetch('http://127.0.0.1:5000/api/storage/get', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ key: oldKey })
                            });
                            
                            if (response.ok) {
                                const result = await response.json();
                                if (result.value) {
                                    // Check if new key already exists in backend
                                    const checkResponse = await fetch('http://127.0.0.1:5000/api/storage/get', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ key: newKey })
                                    });
                                    
                                    if (checkResponse.ok) {
                                        const checkResult = await checkResponse.json();
                                        if (!checkResult.value) {
                                            // New key doesn't exist, migrate
                                            await window.storageWrapper.saveToBackend(newKey, result.value);
                                            console.log(`  ✓ Migrated ${dataKey} from backend (${oldKey} -> ${newKey})`);
                                            dataMigrated = true;
                                        } else {
                                            console.log(`  ⚠ ${dataKey} already exists in backend at ${newKey}, keeping both`);
                                        }
                                    }
                                }
                            }
                        } catch (backendError) {
                            console.warn(`  ⚠ Could not migrate ${dataKey} from backend:`, backendError.message);
                        }
                    }
                }
                
                // Update store ID to new deterministic ID
                store.id = expectedId;
                migrated = true;
                
                if (dataMigrated) {
                    console.log(`  ✓ Store "${store.name}" migration complete`);
                }
            }
        }
        
        // Update currentStoreId if it was migrated
        if (migrationMap[this.currentStoreId]) {
            this.currentStoreId = migrationMap[this.currentStoreId];
            console.log(`  ✓ Updated current store ID to: ${this.currentStoreId}`);
        }
        
        // Save updated stores list if any migrations occurred
        if (migrated) {
            this.saveStores();
            if (this.currentStoreId && migrationMap[Object.keys(migrationMap)[0]]) {
                this.saveCurrentStore();
            }
            console.log('✓ Store ID migration complete. All data preserved.');
        }
    }

    async loadStores() {
        try {
            // Check if using Dropbox/cloud storage (backend is source of truth for collaboration)
            const storageConfig = window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null;
            const storageMode = storageConfig?.storage_mode || 'local';
            const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
            const backendAvailable = window.storageWrapper && 
                                     window.storageWrapper.useBackend && 
                                     window.storageWrapper.backendAvailable;
            
            let loadedFromBackend = false;
            
            // CRITICAL: When using Dropbox/cloud, ALWAYS load stores from backend FIRST
            // This ensures both laptops see the same stores and can share data
            if (backendAvailable && useBackendStorage) {
                try {
                    console.log(`🔄 Loading stores from ${storageMode} storage (backend is source of truth)...`);
                    const response = await fetch('http://127.0.0.1:5000/api/storage/get', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ key: 'ListingLifeStores' })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        if (result.value) {
                            const backendStores = Array.isArray(result.value) ? result.value : JSON.parse(result.value);
                            this.stores = backendStores;
                            loadedFromBackend = true;
                            // Update localStorage with backend data
                            localStorage.setItem('ListingLifeStores', JSON.stringify(backendStores));
                            console.log(`✅ Loaded ${backendStores.length} store(s) from ${storageMode} storage`);
                            console.log(`   Stores: ${backendStores.map(s => s.name).join(', ')}`);
                            return;
                        } else {
                            console.log('ℹ️ No stores in Dropbox yet, will check localStorage as fallback');
                        }
                    }
                } catch (backendError) {
                    console.warn('Could not load stores from backend:', backendError.message);
                    // Fall back to localStorage below
                }
            }
            
            // Only check localStorage if we didn't load from backend
            // This ensures Dropbox stores take precedence for collaboration
            if (!loadedFromBackend) {
                let saved = localStorage.getItem('ListingLifeStores');
                if (saved) {
                    this.stores = JSON.parse(saved);
                    console.log(`✓ Loaded ${this.stores.length} store(s) from localStorage`);
                    
                    // If using Dropbox but didn't load from backend, sync stores to Dropbox
                    if (useBackendStorage && backendAvailable) {
                        console.log('ℹ️ Syncing stores to Dropbox...');
                        this.saveStores(); // This will sync to Dropbox via storage-wrapper
                    }
                } else {
                    // Try loading from backend if available (even if not using backend storage mode)
                    if (backendAvailable) {
                        try {
                            console.log('No stores in localStorage, trying to load from backend...');
                            const response = await fetch('http://127.0.0.1:5000/api/storage/get', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ key: 'ListingLifeStores' })
                            });
                            
                            if (response.ok) {
                                const result = await response.json();
                                if (result.value) {
                                    const backendStores = Array.isArray(result.value) ? result.value : JSON.parse(result.value);
                                    this.stores = backendStores;
                                    // Cache in localStorage
                                    localStorage.setItem('ListingLifeStores', JSON.stringify(backendStores));
                                    console.log(`✓ Loaded ${backendStores.length} store(s) from backend`);
                                    return;
                                }
                            }
                        } catch (backendError) {
                            console.warn('Could not load stores from backend:', backendError.message);
                        }
                    }
                    
                    // Create default store if none exist
                    this.stores = [{
                        id: 'default',
                        name: 'Default Store',
                        createdAt: new Date().toISOString()
                    }];
                    this.saveStores();
                }
            }
        } catch (error) {
            console.error('Error loading stores:', error);
            this.stores = [{
                id: 'default',
                name: 'Default Store',
                createdAt: new Date().toISOString()
            }];
            this.saveStores();
        }
    }

    async saveStores() {
        try {
            // Save to localStorage first (for immediate access)
            localStorage.setItem('ListingLifeStores', JSON.stringify(this.stores));
            
            // CRITICAL: If using Dropbox/cloud, save directly to backend
            // This ensures stores are synced immediately for collaboration
            const storageConfig = window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null;
            const storageMode = storageConfig?.storage_mode || 'local';
            const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
            const backendAvailable = window.storageWrapper && 
                                     window.storageWrapper.useBackend && 
                                     window.storageWrapper.backendAvailable;
            
            if (useBackendStorage && backendAvailable) {
                try {
                    // Save directly to backend (Dropbox/cloud) for immediate sync
                    await window.storageWrapper.saveToBackend('ListingLifeStores', this.stores);
                    console.log(`✅ Stores saved to ${storageMode} storage (${this.stores.length} store(s))`);
                    console.log(`   Store names: ${this.stores.map(s => s.name).join(', ')}`);
                } catch (backendError) {
                    console.error(`Failed to save stores to ${storageMode}:`, backendError);
                    // Continue - at least localStorage is saved
                }
            }
        } catch (error) {
            console.error('Error saving stores:', error);
        }
    }

    async loadCurrentStore() {
        try {
            let saved = localStorage.getItem('ListingLifeCurrentStore');
            if (saved) {
                this.currentStoreId = saved;
                // Verify store still exists
                if (!this.stores.find(s => s.id === this.currentStoreId)) {
                    this.currentStoreId = this.stores[0]?.id || null;
                    this.saveCurrentStore();
                }
            } else {
                // Try loading from backend if available
                if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
                    try {
                        console.log('No current store in localStorage, trying to load from backend...');
                        const response = await fetch('http://127.0.0.1:5000/api/storage/get', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ key: 'ListingLifeCurrentStore' })
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            if (result.value) {
                                // Current store is stored as a string (just the store ID)
                                const backendStoreId = typeof result.value === 'string' ? result.value : JSON.parse(result.value);
                                this.currentStoreId = backendStoreId;
                                // Verify store still exists
                                if (this.stores.find(s => s.id === this.currentStoreId)) {
                                    // Cache in localStorage
                                    localStorage.setItem('ListingLifeCurrentStore', backendStoreId);
                                    console.log(`✓ Loaded current store from backend: ${backendStoreId}`);
                                    return;
                                } else {
                                    console.warn(`Store ${backendStoreId} from backend not found in stores list`);
                                }
                            }
                        }
                    } catch (backendError) {
                        console.warn('Could not load current store from backend:', backendError.message);
                    }
                }
                
                this.currentStoreId = this.stores[0]?.id || null;
                this.saveCurrentStore();
            }
        } catch (error) {
            console.error('Error loading current store:', error);
            this.currentStoreId = this.stores[0]?.id || null;
        }
    }

    saveCurrentStore() {
        try {
            if (this.currentStoreId) {
                // localStorage.setItem is automatically synced to backend by storage-wrapper.js
                localStorage.setItem('ListingLifeCurrentStore', this.currentStoreId);
            } else {
                // localStorage.removeItem is automatically synced to backend by storage-wrapper.js
                localStorage.removeItem('ListingLifeCurrentStore');
            }
        } catch (error) {
            console.error('Error saving current store:', error);
        }
    }

    getCurrentStoreId() {
        return this.currentStoreId || this.stores[0]?.id || 'default';
    }

    getStoreDataKey(key) {
        const storeId = this.getCurrentStoreId();
        return `${key}_${storeId}`;
    }

    setupEventListeners() {
        // Store dropdown change
        const storeSelect = document.getElementById('storeSelect');
        if (storeSelect) {
            storeSelect.addEventListener('change', (e) => {
                this.switchStore(e.target.value);
            });
        }

        // Manage stores button
        const manageBtn = document.getElementById('manageStoresBtn');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                this.openStoreManagementModal();
            });
        }

        // Add store button
        const addStoreBtn = document.getElementById('addStoreBtn');
        if (addStoreBtn) {
            addStoreBtn.addEventListener('click', () => {
                this.openStoreFormModal();
            });
        }

        // Store form submit
        const storeForm = document.getElementById('storeForm');
        if (storeForm) {
            storeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleStoreFormSubmit();
            });
        }

        // Delete store button
        const deleteStoreBtn = document.getElementById('deleteStoreBtn');
        if (deleteStoreBtn) {
            deleteStoreBtn.addEventListener('click', () => {
                this.handleDeleteStore();
            });
        }

        // Modal close handlers
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.closest('[data-close-modal]').getAttribute('data-close-modal');
                this.closeModal(modalId);
            });
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            const storeManagementModal = document.getElementById('storeManagementModal');
            const storeFormModal = document.getElementById('storeFormModal');
            if (e.target === storeManagementModal) {
                this.closeModal('storeManagementModal');
            }
            if (e.target === storeFormModal) {
                this.closeModal('storeFormModal');
            }
        });
    }

    updateStoreDropdown() {
        const storeSelect = document.getElementById('storeSelect');
        if (!storeSelect) return;

        const currentSelectedId = storeSelect.value;
        const currentOptionsCount = storeSelect.options.length;
        const expectedOptionsCount = this.stores.length + 1;
        
        // If dropdown already shows the correct store and stores list hasn't changed, skip update completely
        // This prevents unnecessary flicker during navigation
        if (currentSelectedId === this.currentStoreId && 
            currentOptionsCount === expectedOptionsCount && 
            this.currentStoreId) {
            // Already correctly set, no need to update
            return;
        }

        // Preserve the currently selected value to restore it immediately after update
        const valueToRestore = this.currentStoreId || currentSelectedId;
        
        // Build all options in a DocumentFragment first to minimize visual flicker
        const fragment = document.createDocumentFragment();
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Store';
        fragment.appendChild(defaultOption);
        
        this.stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            // Pre-select if this is the store we want to restore
            if (store.id === valueToRestore) {
                option.selected = true;
            }
            fragment.appendChild(option);
        });
        
        // Replace all options atomically using replaceChildren to prevent flicker
        // Use a microtask to ensure value is set immediately in same render cycle
        storeSelect.replaceChildren(fragment);
        
        // Immediately restore the selected value in the same synchronous execution
        // This prevents the browser from showing "Select Store" even for a frame
        if (valueToRestore && storeSelect.value !== valueToRestore) {
            storeSelect.value = valueToRestore;
        }
        
        // Double-check: if value still doesn't match, force it one more time
        // This catches any edge cases where the option wasn't found
        if (this.currentStoreId && storeSelect.value !== this.currentStoreId) {
            // Try setting it again - the option should exist now
            const optionExists = Array.from(storeSelect.options).some(opt => opt.value === this.currentStoreId);
            if (optionExists) {
                storeSelect.value = this.currentStoreId;
            }
        }
    }

    switchStore(storeId) {
        if (!storeId) return;

        // Check if store exists
        const store = this.stores.find(s => s.id === storeId);
        if (!store) {
            this.showNotification('Store not found.', 'error');
            return;
        }

        // Preserve current view state before reload
        const currentUrl = new URL(window.location.href);
        const currentView = currentUrl.searchParams.get('view');
        const currentPath = window.location.pathname;
        let viewToPreserve = null;
        
        // Determine what view to preserve
        if (currentView) {
            // If URL has view parameter, use it
            viewToPreserve = currentView;
        } else if (currentPath.includes('ebaylistings.html')) {
            // If on ebaylistings.html, check the app's current view state
            if (window.app && window.app.currentView) {
                if (window.app.currentView === 'ended') {
                    viewToPreserve = 'ended';
                } else if (window.app.currentView === 'items') {
                    // For category items view, default back to categories (can't easily preserve specific category)
                    viewToPreserve = null; // Will default to categories
                } else {
                    // Categories view - no need to preserve, it's the default
                    viewToPreserve = null;
                }
            }
        }

        // Save current store
        this.currentStoreId = storeId;
        this.saveCurrentStore();
        this.updateStoreDropdown();

        // Trigger store change event for other scripts to reload data
        window.dispatchEvent(new CustomEvent('storeChanged', { detail: { storeId } }));

        // Reload page to refresh all data, preserving view if needed
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('skipHome', '1');
        
        if (viewToPreserve) {
            newUrl.searchParams.set('view', viewToPreserve);
        } else {
            // Explicitly remove view param to ensure we show categories (default view)
            newUrl.searchParams.delete('view');
        }
        
        window.location.href = newUrl.toString();
    }

    openStoreManagementModal() {
        const modal = document.getElementById('storeManagementModal');
        if (!modal) return;

        this.renderStoresList();
        modal.style.display = 'block';
    }

    renderStoresList() {
        const storesList = document.getElementById('storesList');
        if (!storesList) return;

        if (this.stores.length === 0) {
            storesList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No stores found. Click "Add Store" to create one.</p>';
            return;
        }

        storesList.innerHTML = '';
        this.stores.forEach(store => {
            const storeItem = document.createElement('div');
            storeItem.className = 'store-item';
            storeItem.innerHTML = `
                <span class="store-item-name">${this.escapeHtml(store.name)}</span>
                <div class="store-item-actions">
                    <button type="button" class="btn btn-secondary btn-small edit-store-btn" data-store-id="${store.id}">Edit</button>
                </div>
            `;
            storesList.appendChild(storeItem);
        });

        // Add edit button listeners
        storesList.querySelectorAll('.edit-store-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const storeId = e.target.getAttribute('data-store-id');
                this.openStoreFormModal(storeId);
            });
        });
    }

    openStoreFormModal(storeId = null) {
        const modal = document.getElementById('storeFormModal');
        const formTitle = document.getElementById('storeFormTitle');
        const storeNameInput = document.getElementById('storeName');
        const deleteBtn = document.getElementById('deleteStoreBtn');
        const storeForm = document.getElementById('storeForm');

        if (!modal || !formTitle || !storeNameInput) return;

        this.editingStoreId = storeId;

        if (storeId) {
            const store = this.stores.find(s => s.id === storeId);
            if (store) {
                formTitle.textContent = 'Edit Store';
                storeNameInput.value = store.name;
                deleteBtn.style.display = 'inline-block';
            }
        } else {
            formTitle.textContent = 'Add Store';
            storeNameInput.value = '';
            deleteBtn.style.display = 'none';
        }

        // Close management modal if open
        this.closeModal('storeManagementModal');
        modal.style.display = 'block';
        storeNameInput.focus();
    }

    async handleStoreFormSubmit() {
        const storeNameInput = document.getElementById('storeName');
        if (!storeNameInput) return;

        const name = storeNameInput.value.trim();
        if (!name) {
            this.showNotification('Please enter a store name.', 'warning');
            return;
        }

        if (this.editingStoreId) {
            // Edit existing store
            const store = this.stores.find(s => s.id === this.editingStoreId);
            if (store) {
                // Check if name already exists (excluding current store)
                const nameExists = this.stores.some(s => s.id !== this.editingStoreId && s.name.toLowerCase() === name.toLowerCase());
                if (nameExists) {
                    this.showNotification('A store with this name already exists.', 'warning');
                    return;
                }
                store.name = name;
                store.updatedAt = new Date().toISOString();
                await this.saveStores();
                this.updateStoreDropdown();
                this.showNotification('Store updated successfully.', 'success');
            }
        } else {
            // Add new store
            // CRITICAL: Check if store already exists in Dropbox before creating
            // This prevents duplicate stores when using the same Dropbox account
            const storageConfig = window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null;
            const storageMode = storageConfig?.storage_mode || 'local';
            const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
            const backendAvailable = window.storageWrapper && 
                                     window.storageWrapper.useBackend && 
                                     window.storageWrapper.backendAvailable;
            
            // If using Dropbox, check if store already exists in Dropbox
            if (useBackendStorage && backendAvailable) {
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/storage/get', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'ListingLifeStores' })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        if (result.value) {
                            const dropboxStores = Array.isArray(result.value) ? result.value : JSON.parse(result.value);
                            const dropboxStoreExists = dropboxStores.some(s => s.name.toLowerCase() === name.toLowerCase());
                            
                            if (dropboxStoreExists) {
                                this.showNotification(`Store "${name}" already exists in Dropbox. Please select it from the store dropdown instead.`, 'warning');
                                // Reload stores from Dropbox to get the existing one
                                await this.loadStores();
                                this.updateStoreDropdown();
                                return;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Could not check Dropbox for existing stores:', error);
                    // Continue with creation - better to create than fail
                }
            }
            
            const nameExists = this.stores.some(s => s.name.toLowerCase() === name.toLowerCase());
            if (nameExists) {
                this.showNotification('A store with this name already exists.', 'warning');
                return;
            }

            // Generate deterministic ID based on store name so same store name = same ID across devices
            // This ensures Dropbox sync works correctly across multiple laptops
            const newStoreId = this.generateStoreId(name);
            
            // Check if ID already exists (shouldn't happen with deterministic IDs and unique names, but handle it just in case)
            let finalStoreId = newStoreId;
            const idExists = this.stores.some(s => s.id === newStoreId);
            if (idExists) {
                // This should be extremely rare - add a suffix to make it unique
                let counter = 1;
                while (this.stores.some(s => s.id === finalStoreId)) {
                    finalStoreId = `${newStoreId}-${counter}`;
                    counter++;
                }
                console.warn(`Store ID collision detected for "${name}", using ID: ${finalStoreId}`);
            }
            
            const newStore = {
                id: finalStoreId,
                name: name,
                createdAt: new Date().toISOString()
            };
            this.stores.push(newStore);
            await this.saveStores(); // Make sure it saves to Dropbox immediately
            this.updateStoreDropdown();
            
            // Initialize empty data for the new store to prevent it from loading data from other stores
            const newStoreDataKey = `${newStore.id}`;
            const dataKeys = ['EbayListingLife', 'SoldItemsTrends', 'ImportedItems'];
            dataKeys.forEach(key => {
                const storeKey = `${key}_${newStore.id}`;
                // Only initialize if it doesn't exist (don't overwrite if somehow it does)
                if (!localStorage.getItem(storeKey)) {
                    // Initialize with empty structure
                    if (key === 'EbayListingLife') {
                        localStorage.setItem(storeKey, JSON.stringify({ categories: [], items: [] }));
                    } else if (key === 'SoldItemsTrends') {
                        localStorage.setItem(storeKey, JSON.stringify({ periods: [], currentPeriodId: null }));
                    } else if (key === 'ImportedItems') {
                        localStorage.setItem(storeKey, JSON.stringify([]));
                    }
                }
            });
            
            this.showNotification('Store created successfully.', 'success');
        }

        this.closeModal('storeFormModal');
        this.editingStoreId = null;
    }

    async handleDeleteStore() {
        if (!this.editingStoreId) return;

        const store = this.stores.find(s => s.id === this.editingStoreId);
        if (!store) return;

        // Warn if deleting the last store
        if (this.stores.length === 1) {
            const confirmMessage = `⚠️ WARNING: This is the only store!\n\n` +
                `Deleting this store will:\n` +
                `- Remove ALL store data from this device\n` +
                `- Remove ALL store data from Dropbox/cloud storage\n` +
                `- Leave you with NO stores (you'll need to create a new one)\n\n` +
                `This action CANNOT be undone!\n\n` +
                `Are you ABSOLUTELY SURE you want to delete "${store.name}"?`;
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // Double confirmation for last store
            if (!confirm(`FINAL CONFIRMATION: You are about to delete the ONLY store and ALL its data.\n\n` +
                `This will permanently delete:\n` +
                `- All listings and categories\n` +
                `- All ended items\n` +
                `- All sold trends\n` +
                `- All settings\n` +
                `- From both this device AND Dropbox/cloud storage\n\n` +
                `Type "DELETE" in the next prompt to confirm.`)) {
                return;
            }
        } else {
            // Standard confirmation for non-last store
            if (!confirm(`Are you sure you want to delete "${store.name}"? This will permanently delete all data for this store including listings, ended items, sold trends, and settings from both this device and Dropbox/cloud storage.`)) {
                return;
            }
        }

        // Delete store data from localStorage (this will auto-sync to backend via storage-wrapper)
        const storeId = this.editingStoreId;
        const dataKeys = ['EbayListingLife', 'SoldItemsTrends', 'ListingLifeSettings', 'eBayItemManager', 'ImportedItems'];
        
        // Delete from localStorage (this automatically triggers backend sync via storage-wrapper)
        // We also explicitly queue backend removal as a backup to ensure deletion happens
        if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
            console.log(`Deleting store data from backend for store: ${storeId}`);
            // Queue backend removals (localStorage.removeItem below will also trigger sync, but this ensures it)
            dataKeys.forEach(key => {
                const fullKey = `${key}_${storeId}`;
                try {
                    window.storageWrapper.queueBackendRemove(fullKey);
                } catch (error) {
                    console.warn(`Could not queue deletion of ${fullKey} from backend:`, error.message);
                }
            });
        }
        
        // Delete from localStorage (this also triggers backend sync via storage-wrapper)
        dataKeys.forEach(key => {
            try {
                localStorage.removeItem(`${key}_${storeId}`);
            } catch (error) {
                console.error(`Error deleting ${key} for store ${storeId}:`, error);
            }
        });

        // Remove store from list
        this.stores = this.stores.filter(s => s.id !== storeId);
        await this.saveStores();

        // If deleted store was current, switch to first available (or null if no stores left)
        if (this.currentStoreId === storeId) {
            this.currentStoreId = this.stores[0]?.id || null;
            this.saveCurrentStore();
        }

        this.updateStoreDropdown();
        this.closeModal('storeFormModal');
        this.editingStoreId = null;

        // Show success message
        if (this.stores.length === 0) {
            this.showNotification('Store deleted. Please create a new store to continue.', 'info');
        } else {
            this.showNotification('Store deleted successfully.', 'success');
        }

        // Reload page to refresh data
        window.location.reload();
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Try to use existing notification system if available
        if (window.ebayListingLife && typeof window.ebayListingLife.showNotification === 'function') {
            window.ebayListingLife.showNotification(message, type);
        } else if (window.soldItemsTrends && typeof window.soldItemsTrends.showNotification === 'function') {
            window.soldItemsTrends.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
    }
}

// Initialize store manager when DOM is ready
let storeManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        storeManager = new StoreManager();
        window.storeManager = storeManager;
        // Init is async but we don't need to await it
        storeManager.init().catch(err => console.error('Error initializing store manager:', err));
    });
} else {
    storeManager = new StoreManager();
    window.storeManager = storeManager;
    // Init is async but we don't need to await it
    storeManager.init().catch(err => console.error('Error initializing store manager:', err));
}

