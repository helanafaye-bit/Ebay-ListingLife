// Store Management System
class StoreManager {
    constructor() {
        this.stores = [];
        this.currentStoreId = null;
        this.init();
    }

    init() {
        this.loadStores();
        this.loadCurrentStore();
        this.setupEventListeners();
        this.updateStoreDropdown();
    }

    loadStores() {
        try {
            const saved = localStorage.getItem('ListingLifeStores');
            if (saved) {
                this.stores = JSON.parse(saved);
            } else {
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
            localStorage.setItem('ListingLifeStores', JSON.stringify(this.stores));
        } catch (error) {
            console.error('Error saving stores:', error);
        }
    }

    loadCurrentStore() {
        try {
            const saved = localStorage.getItem('ListingLifeCurrentStore');
            if (saved) {
                this.currentStoreId = saved;
                // Verify store still exists
                if (!this.stores.find(s => s.id === this.currentStoreId)) {
                    this.currentStoreId = this.stores[0]?.id || null;
                    this.saveCurrentStore();
                }
            } else {
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
                localStorage.setItem('ListingLifeCurrentStore', this.currentStoreId);
            } else {
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

        // Save current store
        this.currentStoreId = storeId;
        this.saveCurrentStore();
        this.updateStoreDropdown();

        // Trigger store change event for other scripts to reload data
        window.dispatchEvent(new CustomEvent('storeChanged', { detail: { storeId } }));

        // Reload page to refresh all data
        window.location.reload();
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

            const newStore = {
                id: `store-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
                name: name,
                createdAt: new Date().toISOString()
            };
            this.stores.push(newStore);
            this.saveStores();
            this.updateStoreDropdown();
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
    });
} else {
    storeManager = new StoreManager();
    window.storeManager = storeManager;
}

