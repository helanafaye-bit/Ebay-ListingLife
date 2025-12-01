// Pending Items Manager for Sold Items Trends
class PendingItemsManager {
    constructor() {
        this.pendingItems = [];
        this.currentMovingItem = null;
        this.periods = [];
        this.currentPeriodId = null;
        
        // DOM elements
        this.importFileInput = document.getElementById('importFileInput');
        this.importFileBtn = document.getElementById('importFileBtn');
        this.importFileBtnEmpty = document.getElementById('importFileBtnEmpty');
        this.importFileName = document.getElementById('importFileName');
        this.importStatus = document.getElementById('importStatus');
        this.pendingItemsList = document.getElementById('pendingItemsList');
        this.pendingItemsEmpty = document.getElementById('pendingItemsEmpty');
        this.pendingItemsCount = document.getElementById('pendingItemsCount');
        this.clearPendingItemsBtn = document.getElementById('clearPendingItemsBtn');
        this.pendingPeriodSelect = document.getElementById('pendingPeriodSelect');
        this.createPeriodFromPendingBtn = document.getElementById('createPeriodFromPendingBtn');
        
        // Modal elements
        this.movePendingItemModal = document.getElementById('movePendingItemModal');
        this.movePendingItemForm = document.getElementById('movePendingItemForm');
        this.movePendingPeriod = document.getElementById('movePendingPeriod');
        this.movePendingCategory = document.getElementById('movePendingCategory');
        this.movePendingSubcategory = document.getElementById('movePendingSubcategory');
        this.createCategoryFromPendingBtn = document.getElementById('createCategoryFromPendingBtn');
        this.createSubcategoryFromPendingBtn = document.getElementById('createSubcategoryFromPendingBtn');
        this.newCategoryFromPendingContainer = document.getElementById('newCategoryFromPendingContainer');
        this.newSubcategoryFromPendingContainer = document.getElementById('newSubcategoryFromPendingContainer');
        this.createPeriodFromPendingModal = document.getElementById('createPeriodFromPendingModal');
        this.createPeriodFromPendingForm = document.getElementById('createPeriodFromPendingForm');
        
        this.init();
    }

    init() {
        this.loadPendingItems();
        this.loadSoldItemsData();
        this.setupEventListeners();
        this.renderPendingItems();
        this.setupNavigation();
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
            window.storeManager.init();
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

        // Clear pending items
        if (this.clearPendingItemsBtn) {
            this.clearPendingItemsBtn.addEventListener('click', () => this.clearAllPendingItems());
        }

        // Period selection
        if (this.pendingPeriodSelect) {
            this.pendingPeriodSelect.addEventListener('change', () => this.filterByPeriod());
        }

        // Create period from pending
        if (this.createPeriodFromPendingBtn) {
            this.createPeriodFromPendingBtn.addEventListener('click', () => this.openCreatePeriodModal());
        }

        // Move item modal
        if (this.movePendingItemForm) {
            this.movePendingItemForm.addEventListener('submit', (e) => this.handleMovePendingItem(e));
        }

        // Category/subcategory creation
        if (this.createCategoryFromPendingBtn) {
            this.createCategoryFromPendingBtn.addEventListener('click', () => this.toggleNewCategoryInput());
        }
        if (this.createSubcategoryFromPendingBtn) {
            this.createSubcategoryFromPendingBtn.addEventListener('click', () => this.toggleNewSubcategoryInput());
        }

        // Period change handlers
        if (this.movePendingPeriod) {
            this.movePendingPeriod.addEventListener('change', () => this.handleMovePeriodChange());
        }
        if (this.movePendingCategory) {
            this.movePendingCategory.addEventListener('change', () => this.handleMoveCategoryChange());
        }

        // Create period form
        if (this.createPeriodFromPendingForm) {
            this.createPeriodFromPendingForm.addEventListener('submit', (e) => this.handleCreatePeriod(e));
        }

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modalId = closeBtn.getAttribute('data-close-modal');
                if (modalId) {
                    this.closeModal(modalId);
                }
            });
        });

        document.querySelectorAll('[data-close-modal]:not(.close)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.getAttribute('data-close-modal');
                if (modalId) {
                    this.closeModal(modalId);
                }
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    loadSoldItemsData() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
        const saved = localStorage.getItem(storageKey);
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.periods = data.periods || [];
                this.currentPeriodId = data.currentPeriodId || null;
                this.updatePeriodSelects();
            } catch (error) {
                console.error('Error loading sold items data:', error);
            }
        }
    }

    updatePeriodSelects() {
        // Update pending period filter
        if (this.pendingPeriodSelect) {
            this.pendingPeriodSelect.innerHTML = '<option value="">All Periods</option>';
            this.periods.forEach(period => {
                const option = document.createElement('option');
                option.value = period.id;
                option.textContent = period.name;
                this.pendingPeriodSelect.appendChild(option);
            });
        }

        // Update move item modal period select
        if (this.movePendingPeriod) {
            this.movePendingPeriod.innerHTML = '<option value="">Select a period...</option>';
            this.periods.forEach(period => {
                const option = document.createElement('option');
                option.value = period.id;
                option.textContent = period.name;
                this.movePendingPeriod.appendChild(option);
            });
        }
    }

    loadPendingItems() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('PendingItems') : 'PendingItems';
        const saved = localStorage.getItem(storageKey);
        
        if (saved) {
            try {
                this.pendingItems = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading pending items:', error);
                this.pendingItems = [];
            }
        } else {
            this.pendingItems = [];
        }
    }

    savePendingItems() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('PendingItems') : 'PendingItems';
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.pendingItems));
        } catch (error) {
            console.error('Error saving pending items:', error);
            this.showNotification('Error saving pending items: ' + error.message, 'error');
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
                // Add items to pending list
                items.forEach(item => {
                    if (!item.id) {
                        item.id = this.generateId('pending');
                    }
                    if (!item.createdAt) {
                        item.createdAt = new Date().toISOString();
                    }
                });
                
                this.pendingItems.push(...items);
                this.savePendingItems();
                this.renderPendingItems();
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
                    const titleIndex = this.findColumnIndex(headers, ['title', 'name', 'item', 'item title', 'listing title']);
                    const imageIndex = this.findColumnIndex(headers, ['image', 'image url', 'url', 'photo', 'picture', 'image link', 'imageurl', 'photourl', 'imagelink', 'image_url', 'photo_url', 'image-link', 'photo-link', 'img', 'img url', 'imgurl']);
                    const priceIndex = this.findColumnIndex(headers, ['subtotal', 'price', 'amount', 'sale price', 'sold price', 'total']);

                    if (titleIndex === -1 || priceIndex === -1) {
                        reject(new Error('CSV must contain columns for Title and Subtotal/Price. Image URL is optional.'));
                        return;
                    }

                    // Parse data rows
                    const items = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = this.parseCSVLine(lines[i]);
                        if (values.length < Math.max(titleIndex, priceIndex) + 1) continue;

                        const title = values[titleIndex]?.trim() || '';
                        const priceStr = values[priceIndex]?.trim() || '';
                        let imageUrl = imageIndex >= 0 ? (values[imageIndex]?.trim() || '') : '';
                        
                        // Clean up image URL - remove quotes and whitespace
                        if (imageUrl) {
                            imageUrl = imageUrl.replace(/^["']|["']$/g, '').trim();
                        }

                        if (!title || !priceStr) continue;

                        const price = this.parsePrice(priceStr);
                        if (isNaN(price) || price < 0) continue;

                        items.push({
                            label: title,
                            price: price,
                            photo: imageUrl || null
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
        // For Excel files, we'll use a simple approach: try to load SheetJS if available
        // Otherwise, show a message to convert to CSV
        return new Promise((resolve, reject) => {
            // Check if SheetJS is available
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
                            const title = this.findValueInRow(row, ['title', 'name', 'item', 'item title', 'listing title']);
                            const priceStr = this.findValueInRow(row, ['subtotal', 'price', 'amount', 'sale price', 'sold price', 'total']);
                            let imageUrl = this.findValueInRow(row, ['image', 'image url', 'url', 'photo', 'picture', 'image link', 'imageurl', 'photourl', 'imagelink', 'image_url', 'photo_url', 'image-link', 'photo-link', 'img', 'img url', 'imgurl']);

                            if (!title || !priceStr) return;

                            const price = this.parsePrice(priceStr);
                            if (isNaN(price) || price < 0) return;

                            // Clean up image URL - remove quotes and whitespace
                            if (imageUrl) {
                                imageUrl = String(imageUrl).replace(/^["']|["']$/g, '').trim();
                            }

                            items.push({
                                label: String(title).trim(),
                                price: price,
                                photo: imageUrl || null
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
                // SheetJS not available - suggest CSV or provide CDN link
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
                // Don't include the quote character in the value
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

    parsePrice(priceStr) {
        // Remove currency symbols and whitespace
        const cleaned = priceStr.replace(/[£$€,]/g, '').trim();
        return parseFloat(cleaned);
    }

    renderPendingItems() {
        if (!this.pendingItemsList) return;

        const filteredItems = this.getFilteredItems();

        if (filteredItems.length === 0) {
            this.pendingItemsList.style.display = 'none';
            if (this.pendingItemsEmpty) {
                this.pendingItemsEmpty.style.display = 'block';
            }
        } else {
            this.pendingItemsList.style.display = 'grid';
            if (this.pendingItemsEmpty) {
                this.pendingItemsEmpty.style.display = 'none';
            }

            this.pendingItemsList.innerHTML = filteredItems.map(item => this.renderPendingItem(item)).join('');
        }

        // Update count
        if (this.pendingItemsCount) {
            const count = filteredItems.length;
            this.pendingItemsCount.textContent = `${count} pending item${count !== 1 ? 's' : ''}`;
        }

        // Attach event listeners
        this.attachItemEventListeners();
    }

    getFilteredItems() {
        const periodFilter = this.pendingPeriodSelect?.value;
        if (!periodFilter) {
            return this.pendingItems;
        }
        // For now, all items are shown regardless of period (period is assigned when moving)
        return this.pendingItems;
    }

    renderPendingItem(item) {
        const safeLabel = this.escapeHtml(item.label || 'Untitled Item');
        const price = Number.isFinite(item.price) ? item.price.toFixed(2) : '0.00';
        const photoHtml = item.photo 
            ? `<div class="pending-item-photo"><img src="${this.escapeHtml(item.photo)}" alt="${safeLabel}" onerror="this.style.display='none'; const placeholder = this.parentElement?.querySelector('.pending-item-photo-placeholder'); if (placeholder) placeholder.style.display='flex';"></div><div class="pending-item-photo-placeholder" style="display: none;"><span>📷</span></div>`
            : '<div class="pending-item-photo-placeholder"><span>📷</span></div>';

        return `
            <div class="pending-item-card" data-item-id="${item.id}">
                <div class="pending-item-photo-container">
                    ${photoHtml}
                </div>
                <div class="pending-item-details">
                    <h3 class="pending-item-title">${safeLabel}</h3>
                    <div class="pending-item-price">£${price}</div>
                </div>
                <div class="pending-item-actions">
                    <button class="btn btn-primary btn-small move-pending-item-btn" data-item-id="${item.id}">Move to Category</button>
                    <button class="btn btn-danger btn-small remove-pending-item-btn" data-item-id="${item.id}">Remove</button>
                </div>
            </div>
        `;
    }

    attachItemEventListeners() {
        // Move buttons
        document.querySelectorAll('.move-pending-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.openMoveItemModal(itemId);
            });
        });

        // Remove buttons
        document.querySelectorAll('.remove-pending-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.removePendingItem(itemId);
            });
        });
    }

    openMoveItemModal(itemId) {
        const item = this.pendingItems.find(i => i.id === itemId);
        if (!item || !this.movePendingItemModal) return;

        this.currentMovingItem = item;
        this.updateMoveModalPeriods();
        this.movePendingItemModal.style.display = 'block';
    }

    updateMoveModalPeriods() {
        if (!this.movePendingPeriod) return;
        this.movePendingPeriod.innerHTML = '<option value="">Select a period...</option>';
        this.periods.forEach(period => {
            const option = document.createElement('option');
            option.value = period.id;
            option.textContent = period.name;
            this.movePendingPeriod.appendChild(option);
        });
    }

    handleMovePeriodChange() {
        if (!this.movePendingPeriod || !this.movePendingCategory) return;
        
        const periodId = this.movePendingPeriod.value;
        if (!periodId) {
            this.movePendingCategory.innerHTML = '<option value="">Select a category...</option>';
            this.movePendingCategory.disabled = true;
            return;
        }

        const period = this.periods.find(p => p.id === periodId);
        if (!period) return;

        this.movePendingCategory.innerHTML = '<option value="">Select a category...</option>';
        this.movePendingCategory.disabled = false;

        (period.categories || []).forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            this.movePendingCategory.appendChild(option);
        });

        this.handleMoveCategoryChange();
    }

    handleMoveCategoryChange() {
        if (!this.movePendingCategory || !this.movePendingSubcategory) return;
        
        // Check if we're creating a new category (new category input is visible)
        const isCreatingNewCategory = this.newCategoryFromPendingContainer?.style.display !== 'none';
        
        if (isCreatingNewCategory) {
            // If creating new category, clear subcategory dropdown (new category has no subcategories yet)
            this.movePendingSubcategory.innerHTML = '<option value="">Select a subcategory...</option>';
            this.movePendingSubcategory.disabled = true;
            return;
        }
        
        const periodId = this.movePendingPeriod.value;
        const categoryId = this.movePendingCategory.value;
        
        if (!periodId || !categoryId) {
            this.movePendingSubcategory.innerHTML = '<option value="">Select a subcategory...</option>';
            this.movePendingSubcategory.disabled = true;
            return;
        }

        const period = this.periods.find(p => p.id === periodId);
        if (!period) return;

        const category = (period.categories || []).find(c => c.id === categoryId);
        if (!category) {
            this.movePendingSubcategory.innerHTML = '<option value="">Select a subcategory...</option>';
            this.movePendingSubcategory.disabled = true;
            return;
        }

        this.movePendingSubcategory.innerHTML = '<option value="">Select a subcategory...</option>';
        this.movePendingSubcategory.disabled = false;

        // Only show subcategories for the selected category
        (category.subcategories || []).forEach(subcategory => {
            const option = document.createElement('option');
            option.value = subcategory.id;
            option.textContent = subcategory.name;
            this.movePendingSubcategory.appendChild(option);
        });
    }

    async handleMovePendingItem(e) {
        e.preventDefault();

        if (!this.currentMovingItem) {
            this.showNotification('Item data not found.', 'error');
            return;
        }

        const periodId = this.movePendingPeriod.value;
        const categoryId = this.movePendingCategory.value;
        const subcategoryId = this.movePendingSubcategory.value;

        // Check if creating new category
        const newCategoryName = document.getElementById('newCategoryFromPendingName')?.value.trim();
        const newCategoryDescription = document.getElementById('newCategoryFromPendingDescription')?.value.trim();
        const isCreatingCategory = this.newCategoryFromPendingContainer?.style.display !== 'none' && newCategoryName;

        // Check if creating new subcategory
        const newSubcategoryName = document.getElementById('newSubcategoryFromPendingName')?.value.trim();
        const isCreatingSubcategory = this.newSubcategoryFromPendingContainer?.style.display !== 'none' && newSubcategoryName;

        if (!periodId) {
            this.showNotification('Please select a period.', 'warning');
            return;
        }

        // Validate category - if creating new, the name must be provided
        if (!categoryId && !isCreatingCategory) {
            this.showNotification('Please select or create a category.', 'warning');
            return;
        }

        if (isCreatingCategory && !newCategoryName) {
            this.showNotification('Please enter a category name.', 'warning');
            return;
        }

        // Validate subcategory - if creating new, the name must be provided
        if (!subcategoryId && !isCreatingSubcategory) {
            this.showNotification('Please select or create a subcategory.', 'warning');
            return;
        }

        if (isCreatingSubcategory && !newSubcategoryName) {
            this.showNotification('Please enter a subcategory name.', 'warning');
            return;
        }

        try {
            // Load current sold items data
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
            let saved = localStorage.getItem(storageKey);
            let data = saved ? JSON.parse(saved) : { periods: [], currentPeriodId: null };
            
            let period = data.periods.find(p => p.id === periodId);
            if (!period) {
                this.showNotification('Period not found.', 'error');
                return;
            }

            // Find or create category
            let category = period.categories.find(c => c.id === categoryId);
            if (!category && isCreatingCategory) {
                const timestamp = new Date().toISOString();
                category = {
                    id: this.generateId('cat'),
                    name: newCategoryName,
                    description: newCategoryDescription || '',
                    subcategories: [],
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                if (!period.categories) period.categories = [];
                period.categories.push(category);
            }

            if (!category) {
                this.showNotification('Category not found.', 'error');
                return;
            }

            // Find or create subcategory
            let subcategory = category.subcategories.find(s => s.id === subcategoryId);
            if (!subcategory && isCreatingSubcategory) {
                const timestamp = new Date().toISOString();
                subcategory = {
                    id: this.generateId('sub'),
                    name: newSubcategoryName,
                    count: 0,
                    price: null,
                    items: [],
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                if (!category.subcategories) category.subcategories = [];
                category.subcategories.push(subcategory);
            }

            if (!subcategory) {
                this.showNotification('Subcategory not found.', 'error');
                return;
            }

            // Add item to subcategory
            const timestamp = new Date().toISOString();
            const movedItem = {
                id: this.generateId('solditem'),
                label: this.currentMovingItem.label || '',
                price: this.currentMovingItem.price || 0,
                photo: this.currentMovingItem.photo || null,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            if (!subcategory.items) subcategory.items = [];
            subcategory.items.push(movedItem);
            subcategory.count = subcategory.items.length;
            subcategory.updatedAt = timestamp;
            category.updatedAt = timestamp;
            period.updatedAt = timestamp;

            // Save sold items data
            localStorage.setItem(storageKey, JSON.stringify(data));

            // Remove from pending items
            this.pendingItems = this.pendingItems.filter(i => i.id !== this.currentMovingItem.id);
            this.savePendingItems();

            // Close modal and refresh
            this.closeModal('movePendingItemModal');
            this.renderPendingItems();
            this.showNotification('Item moved successfully!', 'success');

            // Reset form
            this.movePendingItemForm.reset();
            this.newCategoryFromPendingContainer.style.display = 'none';
            this.newSubcategoryFromPendingContainer.style.display = 'none';
            this.currentMovingItem = null;

        } catch (error) {
            console.error('Error moving item:', error);
            this.showNotification('Error moving item: ' + error.message, 'error');
        }
    }

    removePendingItem(itemId) {
        if (confirm('Are you sure you want to remove this item from pending?')) {
            this.pendingItems = this.pendingItems.filter(i => i.id !== itemId);
            this.savePendingItems();
            this.renderPendingItems();
            this.showNotification('Item removed from pending.', 'success');
        }
    }

    clearAllPendingItems() {
        if (confirm('Are you sure you want to clear all pending items? This cannot be undone.')) {
            this.pendingItems = [];
            this.savePendingItems();
            this.renderPendingItems();
            this.showNotification('All pending items cleared.', 'success');
        }
    }

    filterByPeriod() {
        this.renderPendingItems();
    }

    toggleNewCategoryInput() {
        if (!this.newCategoryFromPendingContainer) return;
        const isVisible = this.newCategoryFromPendingContainer.style.display !== 'none';
        this.newCategoryFromPendingContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            // Hiding - restore category dropdown and make it required again
            this.movePendingCategory.value = '';
            if (this.movePendingCategory) {
                this.movePendingCategory.removeAttribute('required');
                this.movePendingCategory.required = true;
            }
            this.handleMoveCategoryChange();
        } else {
            // Showing - clear category selection, remove required attribute, and clear subcategory dropdown
            this.movePendingCategory.value = '';
            if (this.movePendingCategory) {
                this.movePendingCategory.removeAttribute('required');
            }
            if (this.movePendingSubcategory) {
                this.movePendingSubcategory.innerHTML = '<option value="">Select a subcategory...</option>';
                this.movePendingSubcategory.disabled = true;
                this.movePendingSubcategory.removeAttribute('required');
            }
        }
    }

    toggleNewSubcategoryInput() {
        if (!this.newSubcategoryFromPendingContainer) return;
        const isVisible = this.newSubcategoryFromPendingContainer.style.display !== 'none';
        this.newSubcategoryFromPendingContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            // Hiding - restore subcategory dropdown and make it required again
            this.movePendingSubcategory.value = '';
            if (this.movePendingSubcategory) {
                this.movePendingSubcategory.removeAttribute('required');
                this.movePendingSubcategory.required = true;
            }
        } else {
            // Showing - clear subcategory selection and remove required attribute
            this.movePendingSubcategory.value = '';
            if (this.movePendingSubcategory) {
                this.movePendingSubcategory.removeAttribute('required');
            }
        }
    }

    openCreatePeriodModal() {
        if (this.createPeriodFromPendingModal) {
            this.createPeriodFromPendingModal.style.display = 'block';
        }
    }

    async handleCreatePeriod(e) {
        e.preventDefault();

        const nameInput = document.getElementById('newPeriodFromPendingName');
        const descriptionInput = document.getElementById('newPeriodFromPendingDescription');

        if (!nameInput) return;

        const name = nameInput.value.trim();
        const description = descriptionInput ? descriptionInput.value.trim() : '';

        if (!name) {
            this.showNotification('Please enter a period name.', 'warning');
            return;
        }

        try {
            // Load current sold items data
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
            let saved = localStorage.getItem(storageKey);
            let data = saved ? JSON.parse(saved) : { periods: [], currentPeriodId: null };

            const timestamp = new Date().toISOString();
            const newPeriod = {
                id: this.generateId('period'),
                name: name,
                description: description,
                categories: [],
                createdAt: timestamp,
                updatedAt: timestamp
            };

            if (!data.periods) data.periods = [];
            data.periods.push(newPeriod);
            data.currentPeriodId = newPeriod.id;

            // Save
            localStorage.setItem(storageKey, JSON.stringify(data));

            // Update local data
            this.periods = data.periods;
            this.currentPeriodId = newPeriod.id;
            this.updatePeriodSelects();

            // Close modal and reset form
            this.closeModal('createPeriodFromPendingModal');
            this.createPeriodFromPendingForm.reset();
            this.showNotification(`Period "${name}" created successfully!`, 'success');

        } catch (error) {
            console.error('Error creating period:', error);
            this.showNotification('Error creating period: ' + error.message, 'error');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
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
        // Simple notification - you can enhance this with a proper notification system
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
        window.pendingItemsManager = new PendingItemsManager();
    });
} else {
    window.pendingItemsManager = new PendingItemsManager();
}

