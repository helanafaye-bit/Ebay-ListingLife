// Import Items Manager for ListingLife
class ImportItemsManager {
    constructor() {
        this.importedItems = [];
        
        // DOM elements
        this.importFileInput = document.getElementById('importItemsFileInput');
        this.importFileBtn = document.getElementById('importItemsFileBtn');
        this.importFileBtnEmpty = document.getElementById('importItemsFileBtnEmpty');
        this.importFileName = document.getElementById('importItemsFileName');
        this.importStatus = document.getElementById('importItemsStatus');
        this.importedItemsList = document.getElementById('importedItemsList');
        this.importedItemsEmpty = document.getElementById('importedItemsEmpty');
        this.importedItemsCount = document.getElementById('importedItemsCount');
        this.clearImportedItemsBtn = document.getElementById('clearImportedItemsBtn');
        this.saveImportedItemsBtn = document.getElementById('saveImportedItemsBtn');
        
        this.init();
    }

    init() {
        this.loadImportedItems();
        this.setupEventListeners();
        this.renderImportedItems();
        this.setupNavigation();
        this.setupEditModal();
    }

    setupNavigation() {
        // Handle navigation buttons
        document.querySelectorAll('[data-nav-target]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-nav-target');
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
                    window.location.href = './settings.html';
                }
            });
        });

        // Store selector (if exists)
        if (typeof window.storeManager !== 'undefined' && window.storeManager) {
            // Init is async but we don't need to await it
            window.storeManager.init().catch(err => console.error('Error initializing store manager:', err));
        }
    }

    setupEventListeners() {
        // File import
        if (this.importFileBtn) {
            this.importFileBtn.addEventListener('click', () => this.importFileInput?.click());
        }
        if (this.importFileBtnEmpty) {
            this.importFileBtnEmpty.addEventListener('click', () => this.importFileInput?.click());
        }
        if (this.importFileInput) {
            this.importFileInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        // Clear imported items
        if (this.clearImportedItemsBtn) {
            this.clearImportedItemsBtn.addEventListener('click', () => this.clearAllImportedItems());
        }

        // Save imported items
        if (this.saveImportedItemsBtn) {
            this.saveImportedItemsBtn.addEventListener('click', () => this.saveAllImportedItems());
        }
    }

    loadImportedItems() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('ImportedItems') : 'ImportedItems';
        const saved = localStorage.getItem(storageKey);
        
        if (saved) {
            try {
                this.importedItems = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading imported items:', error);
                this.importedItems = [];
            }
        } else {
            this.importedItems = [];
        }
    }

    saveImportedItems() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('ImportedItems') : 'ImportedItems';
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.importedItems));
        } catch (error) {
            console.error('Error saving imported items:', error);
            this.showNotification('Error saving imported items: ' + error.message, 'error');
        }
    }

    async handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.importFileName.textContent = file.name;
        this.showImportStatus('Processing file...', 'info');

        try {
            const items = await this.parseFile(file);
            if (items && items.length > 0) {
                // Add items to imported list
                items.forEach(item => {
                    if (!item.id) {
                        item.id = this.generateId('imported');
                    }
                    if (!item.createdAt) {
                        item.createdAt = new Date().toISOString();
                    }
                });
                
                this.importedItems.push(...items);
                this.saveImportedItems();
                this.renderImportedItems();
                this.showImportStatus(`Successfully imported ${items.length} item(s)`, 'success');
                
                // Clear file input
                this.importFileInput.value = '';
                this.importFileName.textContent = '';
            } else {
                this.showImportStatus('No items found in file. Please check the file format.', 'warning');
            }
        } catch (error) {
            console.error('Error importing file:', error);
            this.showImportStatus('Error importing file: ' + error.message, 'error');
        }
    }

    async parseFile(file) {
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.split('.').pop();

        if (fileExtension === 'csv') {
            return await this.parseCSV(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            return await this.parseExcel(file);
        } else {
            throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx, .xls) files.');
        }
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(line => line.trim());
                    
                    if (lines.length < 2) {
                        reject(new Error('CSV file must have at least a header row and one data row'));
                        return;
                    }

                    // Parse header
                    const headers = this.parseCSVLine(lines[0]);
                    const titleIndex = this.findColumnIndex(headers, ['title', 'name', 'item name', 'item', 'item title', 'listing title']);

                    if (titleIndex === -1) {
                        reject(new Error('CSV must contain a column for Title (or Name).'));
                        return;
                    }

                    // Parse data rows
                    const items = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = this.parseCSVLine(lines[i]);
                        if (values.length < titleIndex + 1) continue;

                        const title = values[titleIndex]?.trim() || '';

                        if (!title) continue;

                        items.push({
                            name: title,
                            categoryId: null,
                            description: '',
                            note: '',
                            dateAdded: '',
                            duration: 30, // Default duration
                            photo: null
                        });
                    }

                    resolve(items);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                        const items = [];
                        jsonData.forEach(row => {
                            const title = this.findValueInRow(row, ['title', 'name', 'item name', 'item', 'item title', 'listing title']);

                            if (!title) return;

                            items.push({
                                name: String(title).trim(),
                                categoryId: null,
                                description: '',
                                note: '',
                                dateAdded: '',
                                duration: 30, // Default duration
                                photo: null
                            });
                        });

                        resolve(items);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = () => reject(new Error('Error reading file'));
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error('Excel file support requires SheetJS library. Please convert your file to CSV format, or add SheetJS to the page.'));
            }
        });
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        return values;
    }

    findColumnIndex(headers, possibleNames) {
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());
        for (const name of possibleNames) {
            const index = lowerHeaders.indexOf(name.toLowerCase());
            if (index !== -1) return index;
        }
        return -1;
    }

    findValueInRow(row, possibleKeys) {
        const lowerKeys = Object.keys(row).map(k => k.toLowerCase().trim());
        for (const key of possibleKeys) {
            const foundKey = lowerKeys.find(k => k === key.toLowerCase());
            if (foundKey) {
                const originalKey = Object.keys(row).find(k => k.toLowerCase().trim() === foundKey);
                return row[originalKey];
            }
        }
        return null;
    }

    renderImportedItems() {
        if (!this.importedItemsList) return;

        if (this.importedItems.length === 0) {
            this.importedItemsList.style.display = 'none';
            if (this.importedItemsEmpty) {
                this.importedItemsEmpty.style.display = 'block';
            }
        } else {
            this.importedItemsList.style.display = 'grid';
            if (this.importedItemsEmpty) {
                this.importedItemsEmpty.style.display = 'none';
            }

            this.importedItemsList.innerHTML = this.importedItems.map(item => this.renderImportedItem(item)).join('');
        }

        // Update count
        if (this.importedItemsCount) {
            const count = this.importedItems.length;
            this.importedItemsCount.textContent = `${count} item${count !== 1 ? 's' : ''} imported`;
        }

        // Attach event listeners
        this.attachItemEventListeners();
    }

    renderImportedItem(item) {
        const safeName = this.escapeHtml(item.name || 'Untitled Item');
        const categoryName = item.categoryId ? (this.getCategoryName(item.categoryId) || 'Not set') : 'Not set';
        const dateAdded = item.dateAdded || 'Not set';
        const endDate = item.endDate || (item.dateAdded && item.duration ? this.calculateEndDate(item.dateAdded, item.duration) : 'Not set');
        const photoHtml = item.photo 
            ? `<div class="imported-item-photo"><img src="${this.escapeHtml(item.photo)}" alt="${safeName}" onerror="this.style.display='none'; const placeholder = this.parentElement?.querySelector('.imported-item-photo-placeholder'); if (placeholder) placeholder.style.display='flex';"></div><div class="imported-item-photo-placeholder" style="display: none;"><span>📷</span></div>`
            : '<div class="imported-item-photo-placeholder"><span>📷</span></div>';

        return `
            <div class="imported-item-card" data-item-id="${item.id}">
                <div class="imported-item-photo-container">
                    ${photoHtml}
                </div>
                <div class="imported-item-content">
                    <h3 class="imported-item-title">${safeName}</h3>
                    <div class="imported-item-details">
                        <div class="imported-item-field">
                            <strong>Category:</strong> <span>${this.escapeHtml(categoryName)}</span>
                        </div>
                        <div class="imported-item-field">
                            <strong>Date Added:</strong> <span>${dateAdded}</span>
                        </div>
                        <div class="imported-item-field">
                            <strong>End Date:</strong> <span>${endDate}</span>
                        </div>
                        ${item.description ? `<div class="imported-item-field"><strong>Description:</strong> <span>${this.escapeHtml(item.description.substring(0, 50))}${item.description.length > 50 ? '...' : ''}</span></div>` : ''}
                    </div>
                </div>
                <div class="imported-item-actions">
                    <button class="btn btn-primary btn-small edit-imported-item-btn" data-item-id="${item.id}">Edit</button>
                    <button class="btn btn-danger btn-small remove-imported-item-btn" data-item-id="${item.id}">Remove</button>
                </div>
            </div>
        `;
    }

    attachItemEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-imported-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.editImportedItem(itemId);
            });
        });

        // Remove buttons
        document.querySelectorAll('.remove-imported-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.removeImportedItem(itemId);
            });
        });
    }

    editImportedItem(itemId) {
        // Show edit modal instead of redirecting
        const item = this.importedItems.find(i => i.id === itemId);
        if (!item) return;

        // Store current editing item
        this.currentEditingItemId = itemId;
        this.currentEditingItem = item;

        // Load categories for the dropdown
        this.loadCategoriesForEdit();

        // Populate form with item data
        document.getElementById('editImportedItemName').value = item.name || '';
        document.getElementById('editImportedItemDescription').value = item.description || '';
        document.getElementById('editImportedItemNote').value = item.note || '';
        document.getElementById('editImportedItemDateAdded').value = item.dateAdded || '';
        
        // Calculate end date if we have dateAdded and duration
        if (item.dateAdded && item.duration) {
            const start = new Date(item.dateAdded);
            const end = new Date(start);
            end.setDate(end.getDate() + item.duration);
            document.getElementById('editImportedItemEndDate').value = end.toISOString().split('T')[0];
        } else if (item.endDate) {
            document.getElementById('editImportedItemEndDate').value = item.endDate;
        } else {
            document.getElementById('editImportedItemEndDate').value = '';
        }
        
        document.getElementById('editImportedItemPhoto').value = item.photo || '';
        
        // Show photo preview if photo exists
        const previewDiv = document.getElementById('editImportedItemPhotoPreview');
        const previewImg = document.getElementById('editImportedItemPreviewImage');
        if (item.photo) {
            previewImg.src = item.photo;
            previewDiv.style.display = 'block';
            previewImg.onerror = () => {
                previewDiv.style.display = 'none';
            };
        } else {
            previewDiv.style.display = 'none';
        }

        // Set category if it exists
        const categorySelect = document.getElementById('editImportedItemCategory');
        if (item.categoryId) {
            // Will be set after categories load
            this.pendingCategoryId = item.categoryId;
        } else {
            categorySelect.value = '';
        }

        // Show modal
        const modal = document.getElementById('editImportedItemModal');
        modal.style.display = 'block';
    }

    loadCategoriesForEdit() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('EbayListingLife') : 'EbayListingLife';
        const saved = localStorage.getItem(storageKey);
        const categorySelect = document.getElementById('editImportedItemCategory');
        
        // Clear existing options except "Not set"
        categorySelect.innerHTML = '<option value="">Not set</option>';
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.categories && Array.isArray(data.categories)) {
                    data.categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category.id;
                        option.textContent = category.name;
                        categorySelect.appendChild(option);
                    });
                    
                    // Set the category if we have a pending one
                    if (this.pendingCategoryId) {
                        const category = data.categories.find(c => c.id === this.pendingCategoryId);
                        if (category) {
                            categorySelect.value = this.pendingCategoryId;
                        } else {
                            // Category doesn't exist, clear it
                            this.currentEditingItem.categoryId = null;
                            categorySelect.value = '';
                        }
                        this.pendingCategoryId = null;
                    }
                }
            } catch (e) {
                console.error('Error loading categories:', e);
            }
        }
    }

    setupEditModal() {
        const modal = document.getElementById('editImportedItemModal');
        const closeBtn = document.getElementById('closeEditImportedItemModal');
        const cancelBtn = document.getElementById('cancelEditImportedItem');
        const form = document.getElementById('editImportedItemForm');
        const photoInput = document.getElementById('editImportedItemPhoto');

        // Close modal handlers
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Form submit
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEditedImportedItem();
            });
        }

        // Photo preview
        if (photoInput) {
            photoInput.addEventListener('input', (e) => {
                const url = e.target.value.trim();
                const previewDiv = document.getElementById('editImportedItemPhotoPreview');
                const previewImg = document.getElementById('editImportedItemPreviewImage');
                
                if (url) {
                    previewImg.src = url;
                    previewDiv.style.display = 'block';
                    previewImg.onerror = () => {
                        previewDiv.style.display = 'none';
                    };
                } else {
                    previewDiv.style.display = 'none';
                }
            });
        }
    }

    saveEditedImportedItem() {
        if (!this.currentEditingItemId || !this.currentEditingItem) return;

        const item = this.importedItems.find(i => i.id === this.currentEditingItemId);
        if (!item) return;

        // Get form values
        item.name = document.getElementById('editImportedItemName').value.trim();
        item.description = document.getElementById('editImportedItemDescription').value.trim();
        item.note = document.getElementById('editImportedItemNote').value.trim();
        item.dateAdded = document.getElementById('editImportedItemDateAdded').value;
        item.endDate = document.getElementById('editImportedItemEndDate').value;
        item.photo = document.getElementById('editImportedItemPhoto').value.trim();
        
        const categoryId = document.getElementById('editImportedItemCategory').value;
        item.categoryId = categoryId || null;

        // Calculate duration if we have dates
        if (item.dateAdded && item.endDate) {
            const start = new Date(item.dateAdded);
            const end = new Date(item.endDate);
            const diffMs = end - start;
            item.duration = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 1);
        }

        // Validate
        if (!item.name) {
            this.showNotification('Please enter an item name.', 'error');
            return;
        }

        // Save and refresh
        this.saveImportedItems();
        this.renderImportedItems();
        
        // Close modal
        document.getElementById('editImportedItemModal').style.display = 'none';
        
        this.showNotification('Item updated successfully.', 'success');
    }

    removeImportedItem(itemId) {
        if (confirm('Are you sure you want to remove this item from the import list?')) {
            this.importedItems = this.importedItems.filter(i => i.id !== itemId);
            this.saveImportedItems();
            this.renderImportedItems();
            this.showNotification('Item removed from import list.', 'success');
        }
    }

    clearAllImportedItems() {
        if (confirm('Are you sure you want to clear all imported items? This cannot be undone.')) {
            this.importedItems = [];
            this.saveImportedItems();
            this.renderImportedItems();
            this.showNotification('All imported items cleared.', 'success');
        }
    }

    async saveAllImportedItems() {
        if (this.importedItems.length === 0) {
            this.showNotification('No items to save.', 'warning');
            return;
        }

        try {
            // Load current ListingLife data
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('EbayListingLife') : 'EbayListingLife';
            let saved = localStorage.getItem(storageKey);
            let data = saved ? JSON.parse(saved) : { categories: [], items: [] };
            
            let successCount = 0;
            let errorCount = 0;

            for (const importedItem of this.importedItems) {
                try {
                    // Find or create category if categoryId is set
                    let category = null;
                    if (importedItem.categoryId) {
                        category = data.categories.find(c => c.id === importedItem.categoryId);
                    }

                    // If no category, assign to first category or create default
                    if (!category) {
                        if (data.categories.length > 0) {
                            category = data.categories[0];
                            importedItem.categoryId = category.id;
                        } else {
                            // Create a default category
                            const timestamp = new Date().toISOString();
                            category = {
                                id: this.generateId('cat'),
                                name: 'Imported Items',
                                description: 'Items imported from CSV/Excel',
                                averageDays: 30,
                                createdAt: timestamp,
                                updatedAt: timestamp
                            };
                            data.categories.push(category);
                            importedItem.categoryId = category.id;
                        }
                    }

                    // Set default dates if not set
                    if (!importedItem.dateAdded) {
                        importedItem.dateAdded = new Date().toISOString().split('T')[0];
                    }
                    if (!importedItem.endDate && importedItem.duration) {
                        const start = new Date(importedItem.dateAdded);
                        const end = new Date(start);
                        end.setDate(end.getDate() + importedItem.duration);
                        importedItem.endDate = end.toISOString().split('T')[0];
                    }

                    // Calculate duration
                    if (importedItem.dateAdded && importedItem.endDate) {
                        const start = new Date(importedItem.dateAdded);
                        const end = new Date(importedItem.endDate);
                        const diffMs = end - start;
                        importedItem.duration = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 1);
                    } else {
                        importedItem.duration = importedItem.duration || 30;
                    }

                    // Create item
                    const timestamp = new Date().toISOString();
                    const newItem = {
                        id: this.generateId('item'),
                        categoryId: importedItem.categoryId,
                        name: importedItem.name,
                        description: importedItem.description || '',
                        note: importedItem.note || '',
                        dateAdded: importedItem.dateAdded,
                        duration: importedItem.duration,
                        photo: importedItem.photo || null,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    };

                    data.items.push(newItem);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    console.error(`Error processing item ${importedItem.name}:`, error);
                }
            }

            // Save data
            localStorage.setItem(storageKey, JSON.stringify(data));

            // Clear imported items
            this.importedItems = [];
            this.saveImportedItems();
            this.renderImportedItems();

            if (errorCount > 0) {
                this.showNotification(`Saved ${successCount} item(s), ${errorCount} error(s).`, 'warning');
            } else {
                this.showNotification(`Successfully saved ${successCount} item(s) to ListingLife!`, 'success');
            }

            // Redirect to ListingLife after a short delay
            setTimeout(() => {
                window.location.href = './ebaylistings.html';
            }, 1500);

        } catch (error) {
            console.error('Error saving imported items:', error);
            this.showNotification('Error saving items: ' + error.message, 'error');
        }
    }

    getCategoryName(categoryId) {
        // This would need to load categories from ListingLife data
        // For now, return null - will be handled when saving
        return null;
    }

    calculateEndDate(dateAdded, duration) {
        if (!dateAdded) return 'Not set';
        try {
            const start = new Date(dateAdded);
            const end = new Date(start);
            end.setDate(end.getDate() + duration);
            return end.toISOString().split('T')[0];
        } catch (e) {
            return 'Not set';
        }
    }

    showImportStatus(message, type = 'info') {
        if (!this.importStatus) return;
        this.importStatus.style.display = 'block';
        this.importStatus.textContent = message;
        this.importStatus.className = `import-status import-status-${type}`;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                this.importStatus.style.display = 'none';
            }, 5000);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    generateId(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.importItemsManager = new ImportItemsManager();
    });
} else {
    window.importItemsManager = new ImportItemsManager();
}

