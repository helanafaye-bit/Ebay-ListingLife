// Store Management System
class StoreManager {
    constructor() {
        this.stores = [];
        this.currentStoreId = null;
        this.init();
    }

    async init() {
        await this.loadStores();
        await this.migrateStoreIdsIfNeeded(); // Migrate old random IDs to deterministic IDs
        await this.loadCurrentStore();
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
            let saved = localStorage.getItem('ListingLifeStores');
            if (saved) {
                this.stores = JSON.parse(saved);
            } else {
                // Try loading from backend if available
                if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
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

    saveStores() {
        try {
            // localStorage.setItem is automatically synced to backend by storage-wrapper.js
            localStorage.setItem('ListingLifeStores', JSON.stringify(this.stores));
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

        storeSelect.innerHTML = '<option value="">Select Store</option>';
        this.stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            if (store.id === this.currentStoreId) {
                option.selected = true;
            }
            storeSelect.appendChild(option);
        });
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

    handleStoreFormSubmit() {
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
                this.saveStores();
                this.updateStoreDropdown();
                this.showNotification('Store updated successfully.', 'success');
            }
        } else {
            // Add new store
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
            this.saveStores();
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

    handleDeleteStore() {
        if (!this.editingStoreId) return;

        const store = this.stores.find(s => s.id === this.editingStoreId);
        if (!store) return;

        // Prevent deleting if it's the only store
        if (this.stores.length === 1) {
            this.showNotification('Cannot delete the only store. Please create another store first.', 'warning');
            return;
        }

        // Confirm deletion
        if (!confirm(`Are you sure you want to delete "${store.name}"? This will permanently delete all data for this store including listings, ended items, sold trends, and settings.`)) {
            return;
        }

        // Delete store data from localStorage
        const storeId = this.editingStoreId;
        const dataKeys = ['EbayListingLife', 'SoldItemsTrends', 'ListingLifeSettings', 'eBayItemManager'];
        dataKeys.forEach(key => {
            try {
                localStorage.removeItem(`${key}_${storeId}`);
            } catch (error) {
                console.error(`Error deleting ${key} for store ${storeId}:`, error);
            }
        });

        // Remove store from list
        this.stores = this.stores.filter(s => s.id !== storeId);
        this.saveStores();

        // If deleted store was current, switch to first available
        if (this.currentStoreId === storeId) {
            this.currentStoreId = this.stores[0]?.id || null;
            this.saveCurrentStore();
        }

        this.updateStoreDropdown();
        this.closeModal('storeFormModal');
        this.editingStoreId = null;

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

