const LISTING_LIFE_SETTINGS_KEY = 'ListingLifeSettings';
const SOLD_TRENDS_DEFAULT_CURRENCY = 'GBP';
const SOLD_TRENDS_CURRENCY_MAP = {
    GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', label: 'British Pound (£)' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US', label: 'US Dollar ($)' },
    EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', label: 'Euro (€)' },
    AUD: { code: 'AUD', symbol: '$', locale: 'en-AU', label: 'Australian Dollar ($)' },
    CAD: { code: 'CAD', symbol: '$', locale: 'en-CA', label: 'Canadian Dollar ($)' }
};

class SoldItemsTrends {
    constructor() {
        this.periods = [];
        this.currentPeriodId = null;
        this.categories = [];
        this.currentEditingCategory = null;
        this.categoryForm = document.getElementById('soldCategoryForm');
        this.subcategoryEditorEl = document.getElementById('soldSubcategoryEditor');
        this.addSubcategoryBtn = document.getElementById('addSoldSubcategoryRow');
        this.deleteCategoryBtn = document.getElementById('deleteSoldCategoryBtn');
        this.categoryModal = document.getElementById('soldCategoryModal');
        this.subcategoryItemsModal = document.getElementById('soldSubcategoryItemsModal');
        this.subcategoryItemsTitle = document.getElementById('soldSubcategoryItemsTitle');
        this.subcategoryItemsList = document.getElementById('soldSubcategoryItemsList');
        this.subcategoryItemsCountLabel = document.getElementById('soldSubcategoryItemsCountLabel');
        this.addSubcategoryItemBtn = document.getElementById('addSoldSubcategoryItem');
        this.saveSubcategoryItemsBtn = document.getElementById('saveSoldSubcategoryItemsBtn');
        this.currentSubcategoryRow = null;
        this.periodSelect = document.getElementById('dataPeriodSelect');
        this.addPeriodBtn = document.getElementById('addDataPeriodBtn');
        this.periodModal = document.getElementById('soldPeriodModal');
        this.periodForm = document.getElementById('soldPeriodForm');
        this.periodNameInput = document.getElementById('soldPeriodName');
        this.periodDescriptionInput = document.getElementById('soldPeriodDescription');
        this.dataPeriodDisplay = document.getElementById('dataPeriodDisplay');
        this.removePeriodBtn = document.getElementById('removeDataPeriodBtn');
        this.notificationEl = document.getElementById('soldAppNotification');
        this.notificationMessageEl = document.getElementById('soldAppNotificationMessage');
        this.notificationCloseBtn = document.getElementById('soldAppNotificationClose');
        this.notificationHideTimeout = null;
        this.confirmModal = document.getElementById('soldConfirmModal');
        this.confirmTitleEl = document.getElementById('soldConfirmTitle');
        this.confirmMessageEl = document.getElementById('soldConfirmMessage');
        this.confirmCancelBtn = document.getElementById('soldConfirmCancel');
        this.confirmAcceptBtn = document.getElementById('soldConfirmAccept');
        this.activeConfirmResolver = null;
        this.confirmDefaults = {
            title: 'Confirm Action',
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
            variant: 'danger'
        };
        this.currencyConfig = null;
        this.currentMovingItem = null;
        this.currentMovingItemRow = null;
        this.currentMovingCategory = null;
        this.currentMovingSubcategory = null;
        this.moveItemModal = document.getElementById('moveItemModal');
        this.moveItemForm = document.getElementById('moveItemForm');
        this.moveItemCategorySelect = document.getElementById('moveItemCategory');
        this.moveItemSubcategorySelect = document.getElementById('moveItemSubcategory');
        this.soldSearchBar = document.getElementById('soldSearchBar');
        this.soldSearchBtn = document.getElementById('soldSearchBtn');
        this.soldSearchResults = document.getElementById('soldSearchResults');
        this.trendingKeywordsList = document.getElementById('trendingKeywordsList');
        this.init();
    }

    init() {
        this.setupNotificationSystem();
        // Ensure storeManager is available before loading data
        if (!window.storeManager) {
            // Wait a bit more for storeManager to initialize
            setTimeout(async () => {
                await this.loadData();
                this.setupEventListeners();
                this.updatePeriodSelect();
                this.renderDataPeriod();
                this.renderCategories();
                this.updateRemovePeriodButtonState();
                this.renderTrendingKeywords();
            }, 100);
        } else {
            // Use async IIFE to handle async loadData
            (async () => {
                await this.loadData();
                this.setupEventListeners();
                this.updatePeriodSelect();
                this.renderDataPeriod();
                this.renderCategories();
                this.updateRemovePeriodButtonState();
                this.renderTrendingKeywords();
            })();
        }
    }

    setupEventListeners() {
        const navButtons = document.querySelectorAll('.menu-btn[data-nav-target]');
        navButtons.forEach(btn => {
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
                    window.location.href = './settings.html';
                }
            });
        });

        const addCategoryBtn = document.getElementById('addSoldCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.openCategoryModal());
        }

        const pendingItemsBtn = document.getElementById('pendingItemsBtn');
        if (pendingItemsBtn) {
            pendingItemsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = './pending-items.html';
            });
        }

        const resetBtn = document.getElementById('resetSoldDataBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleResetData());
        }

        if (this.categoryForm) {
            this.categoryForm.addEventListener('submit', (e) => this.handleCategorySubmit(e));
        }

        if (this.addSubcategoryBtn) {
            this.addSubcategoryBtn.addEventListener('click', () => this.addSubcategoryEditorRow());
        }

        if (this.subcategoryEditorEl) {
            this.subcategoryEditorEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('subcategory-remove-btn')) {
                    const row = e.target.closest('.subcategory-editor-row');
                    if (row) {
                        if (this.currentSubcategoryRow === row) {
                            this.currentSubcategoryRow = null;
                        }
                        row.remove();
                        if (!this.subcategoryEditorEl.querySelector('.subcategory-editor-row')) {
                            this.addSubcategoryEditorRow();
                        }
                    }
                } else if (e.target.closest('.subcategory-manage-btn')) {
                    const manageBtn = e.target.closest('.subcategory-manage-btn');
                    const row = manageBtn ? manageBtn.closest('.subcategory-editor-row') : null;
                    if (row) {
                        this.openSubcategoryItemsModal(row);
                    }
                }
            });
        }

        if (this.deleteCategoryBtn) {
            this.deleteCategoryBtn.addEventListener('click', () => {
                if (this.currentEditingCategory) {
                    this.deleteCategory(this.currentEditingCategory.id);
                }
            });
        }

        if (this.periodSelect) {
            this.periodSelect.addEventListener('change', (e) => this.setCurrentPeriod(e.target.value));
        }

        if (this.addPeriodBtn) {
            this.addPeriodBtn.addEventListener('click', () => this.openPeriodModal());
        }

        if (this.removePeriodBtn) {
            this.removePeriodBtn.addEventListener('click', () => this.handleRemovePeriod());
        }

        if (this.periodForm) {
            this.periodForm.addEventListener('submit', (e) => this.handlePeriodFormSubmit(e));
        }

        if (this.addSubcategoryItemBtn) {
            this.addSubcategoryItemBtn.addEventListener('click', () => this.addSubcategoryItemEditorRow());
        }

        if (this.subcategoryItemsList) {
            this.subcategoryItemsList.addEventListener('click', (e) => {
                if (e.target.classList.contains('subcategory-item-remove')) {
                    const row = e.target.closest('.subcategory-item-row');
                    if (row) {
                        row.remove();
                        this.updateSubcategoryItemsCountLabel();
                    }
                } else if (e.target.classList.contains('subcategory-item-move')) {
                    const row = e.target.closest('.subcategory-item-row');
                    if (row) {
                        const itemId = row.dataset.itemId;
                        this.openMoveItemModal(itemId, row);
                    }
                }
            });
        }

        if (this.saveSubcategoryItemsBtn) {
            this.saveSubcategoryItemsBtn.addEventListener('click', () => this.handleSubcategoryItemsSave());
        }

        if (this.moveItemForm) {
            this.moveItemForm.addEventListener('submit', (e) => this.handleMoveItemSubmit(e));
        }

        // Search functionality
        if (this.soldSearchBtn) {
            this.soldSearchBtn.addEventListener('click', () => this.searchSoldItems());
        }

        if (this.soldSearchBar) {
            this.soldSearchBar.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchSoldItems();
                }
            });
            // Search as you type
            this.soldSearchBar.addEventListener('input', () => {
                this.searchSoldItems();
            });
        }

        if (this.moveItemCategorySelect) {
            this.moveItemCategorySelect.addEventListener('change', () => this.handleMoveCategoryChange());
        }

        document.querySelectorAll('.close').forEach(closeBtn => {
            const modalId = closeBtn.dataset.closeModal;
            closeBtn.addEventListener('click', () => this.closeModal(modalId));
        });

        document.querySelectorAll('[data-close-modal]:not(.close)').forEach(closeBtn => {
            const modalId = closeBtn.dataset.closeModal;
            closeBtn.addEventListener('click', () => this.closeModal(modalId));
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('button[data-action="edit-category"]');
            if (!editBtn) return;
            const category = this.categories.find(cat => cat.id === editBtn.dataset.categoryId);
            this.openCategoryModal(category || null);
        });

        const categoriesContainer = document.getElementById('soldCategoriesContainer');
        if (categoriesContainer) {
            categoriesContainer.addEventListener('click', (e) => {
                const editButton = e.target.closest('button[data-action="edit-category"]');
                if (editButton) {
                    return;
                }

                const categoryBox = e.target.closest('.category-box[data-category-id]');
                if (!categoryBox) return;

                const categoryId = categoryBox.dataset.categoryId;
                if (!categoryId) return;

                const category = this.categories.find(cat => cat.id === categoryId);
                if (category) {
                    this.openCategoryModal(category);
                }
            });
        }

        window.addEventListener('storage', (event) => {
            if (event.key === LISTING_LIFE_SETTINGS_KEY) {
                this.currencyConfig = null;
                this.renderCategories();
            }
        });
    }

    openCategoryModal(category = null) {
        this.currentEditingCategory = category;
        const title = document.getElementById('soldCategoryModalTitle');
        const nameInput = document.getElementById('soldCategoryName');
        const descriptionInput = document.getElementById('soldCategoryDescription');

        if (!this.categoryModal || !title || !nameInput || !descriptionInput || !this.subcategoryEditorEl) return;

        if (category) {
            title.textContent = 'Edit Sold Category';
            nameInput.value = category.name;
            descriptionInput.value = category.description || '';
        } else {
            title.textContent = 'Add Sold Category';
            nameInput.value = '';
            descriptionInput.value = '';
        }

        this.subcategoryEditorEl.innerHTML = '';
        const subs = category && Array.isArray(category.subcategories) ? category.subcategories : [];
        if (subs.length > 0) {
            subs.forEach(sub => this.addSubcategoryEditorRow(sub));
        } else {
            this.addSubcategoryEditorRow();
        }

        if (this.deleteCategoryBtn) {
            this.deleteCategoryBtn.style.display = category ? 'inline-flex' : 'none';
        }

        this.categoryModal.style.display = 'block';
        nameInput.focus();
    }

    closeModal(modalId) {
        if (!modalId) return;
        if (modalId === 'soldConfirmModal') {
            this.resolveConfirm(false);
            return;
        }
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        if (modalId === 'soldCategoryModal') {
            this.currentEditingCategory = null;
        } else if (modalId === 'soldSubcategoryItemsModal') {
            this.currentSubcategoryRow = null;
            this.clearSubcategoryItemsEditor();
        }
    }

    addSubcategoryEditorRow(subcategory = {}) {
        if (!this.subcategoryEditorEl) return;
        const row = document.createElement('div');
        row.className = 'subcategory-editor-row';
        if (subcategory.id) {
            row.dataset.subcategoryId = subcategory.id;
        }
        if (subcategory.createdAt) {
            row.dataset.createdAt = subcategory.createdAt;
        }
        const items = this.normalizeSubcategoryItems(subcategory.items);
        row.dataset.items = JSON.stringify(items);
        const itemsCount = items.length;
        const safeName = subcategory.name ? this.escapeHtml(subcategory.name) : '';
        const countValue = Number.isFinite(subcategory.count) && subcategory.count >= 0 ? subcategory.count : itemsCount;
        const hasManualPrice = Number.isFinite(subcategory.price) && subcategory.price >= 0 && !itemsCount;
        const priceValue = hasManualPrice ? Number(subcategory.price) : '';
        const countReadonlyAttr = itemsCount ? 'readonly' : '';
        const priceDisabledAttr = itemsCount ? 'disabled' : '';
        const countHintClass = itemsCount ? 'field-hint subcategory-count-hint visible' : 'field-hint subcategory-count-hint';
        const priceHintClass = itemsCount ? 'field-hint subcategory-price-hint visible' : 'field-hint subcategory-price-hint';

        row.innerHTML = `
            <div class="editor-field">
                <label>Subcategory Name</label>
                <input type="text" class="subcategory-name-input" placeholder="e.g., Plates" value="${safeName}">
            </div>
            <div class="editor-field">
                <label>Sold Count</label>
                <input type="number" class="subcategory-count-input" min="0" value="${Number.isFinite(countValue) ? countValue : 0}" ${countReadonlyAttr}>
                <span class="${countHintClass}">Count matches the number of managed items.</span>
            </div>
            <div class="editor-field">
                <label>Sold Price (optional)</label>
                <input type="number" class="subcategory-price-input" min="0" step="0.01" placeholder="e.g., 19.99" value="${hasManualPrice ? priceValue : ''}" ${priceDisabledAttr}>
                <span class="${priceHintClass}">Totals will use individual item prices.</span>
            </div>
            <div class="subcategory-row-actions">
                <button type="button" class="btn btn-secondary btn-small subcategory-manage-btn" aria-label="Manage items for this subcategory">
                    Manage Items
                    <span class="subcategory-items-pill" aria-live="polite">${itemsCount}</span>
                </button>
                <button type="button" class="btn btn-small btn-danger subcategory-remove-btn">Remove</button>
            </div>
        `;
        this.subcategoryEditorEl.appendChild(row);
    }

    openSubcategoryItemsModal(row) {
        if (!row || !this.subcategoryItemsModal || !this.subcategoryItemsList) return;
        this.currentSubcategoryRow = row;
        const nameInput = row.querySelector('.subcategory-name-input');
        const subcategoryName = nameInput ? nameInput.value.trim() : '';
        const items = this.normalizeSubcategoryItems(row.dataset.items);

        // Find and store the current category and subcategory
        const period = this.getCurrentPeriod();
        if (period && this.currentEditingCategory) {
            this.currentSubcategoryCategory = this.currentEditingCategory;
            const subcategoryId = row.dataset.subcategoryId;
            if (subcategoryId) {
                const subcategory = (this.currentEditingCategory.subcategories || []).find(sub => sub.id === subcategoryId);
                if (subcategory) {
                    // Store reference to the actual subcategory object
                    this.currentMovingSubcategory = subcategory;
                    this.currentMovingCategory = this.currentEditingCategory;
                }
            }
        }

        this.clearSubcategoryItemsEditor();

        // Only add rows for existing items, don't add empty row automatically
        items.forEach(item => this.addSubcategoryItemEditorRow(item));

        this.updateSubcategoryItemsCountLabel();

        if (this.subcategoryItemsTitle) {
            this.subcategoryItemsTitle.textContent = subcategoryName
                ? `Manage Items – ${subcategoryName}`
                : 'Manage Items';
        }

        if (this.subcategoryItemsCountLabel) {
            const label = items.length === 1 ? '1 item' : `${items.length} items`;
            this.subcategoryItemsCountLabel.textContent = label;
        }

        this.subcategoryItemsModal.style.display = 'block';
    }

    clearSubcategoryItemsEditor() {
        if (this.subcategoryItemsList) {
            this.subcategoryItemsList.innerHTML = '';
        }
        if (this.subcategoryItemsCountLabel) {
            this.subcategoryItemsCountLabel.textContent = '0 items';
        }
    }

    addSubcategoryItemEditorRow(item = {}) {
        if (!this.subcategoryItemsList) return;
        const row = document.createElement('div');
        row.className = 'subcategory-item-row';

        if (item.id) {
            row.dataset.itemId = item.id;
        }
        if (item.createdAt) {
            row.dataset.createdAt = item.createdAt;
        }

        const safeLabel = item.label ? this.escapeHtml(item.label) : '';
        const rawPrice = item.price;
        const hasPrice = rawPrice !== '' && rawPrice !== null && rawPrice !== undefined && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0;
        const priceValue = hasPrice ? Number(rawPrice) : '';
        const photoUrl = item.photo && String(item.photo).trim() ? String(item.photo).trim() : null;
        
        // Always include both photo and placeholder divs for dynamic switching
        // When photo exists, show photo div; when not, show placeholder
        const photoHtml = photoUrl 
            ? `<div class="subcategory-item-photo"><img src="${this.escapeHtml(photoUrl)}" alt="${safeLabel || 'Item photo'}" onerror="this.style.display='none'; const placeholder = this.parentElement?.querySelector('.subcategory-item-photo-placeholder'); if (placeholder) placeholder.style.display='flex';"></div><div class="subcategory-item-photo-placeholder" style="display: none;"><span>📷</span></div>`
            : `<div class="subcategory-item-photo" style="display: none;"><img src="" alt="${safeLabel || 'Item photo'}" onerror="this.style.display='none'; const placeholder = this.parentElement?.querySelector('.subcategory-item-photo-placeholder'); if (placeholder) placeholder.style.display='flex';"></div><div class="subcategory-item-photo-placeholder"><span>📷</span></div>`;

        // Only show image URL input for manually added items (items without existing photo)
        // Items moved from ListingLife already have photos and don't need this field
        const showImageUrlInput = !photoUrl;
        const imageUrlInputHtml = showImageUrlInput 
            ? `<div class="editor-field subcategory-item-image-url-field">
                <label>Image URL (optional)</label>
                <input type="url" class="subcategory-item-image-url" placeholder="Paste image URL" value="" oninput="(function(row, url) {
                    const photoDiv = row.querySelector('.subcategory-item-photo');
                    const photoImg = row.querySelector('.subcategory-item-photo img');
                    const placeholderDiv = row.querySelector('.subcategory-item-photo-placeholder');
                    if (url.trim()) {
                        if (photoImg) photoImg.src = url.trim();
                        if (photoDiv) photoDiv.style.display = 'flex';
                        if (placeholderDiv) placeholderDiv.style.display = 'none';
                    } else {
                        if (photoDiv) photoDiv.style.display = 'none';
                        if (placeholderDiv) placeholderDiv.style.display = 'flex';
                    }
                })(this.closest('.subcategory-item-row'), this.value);">
            </div>`
            : '';

        row.innerHTML = `
            <div class="subcategory-item-photo-container">
                ${photoHtml}
            </div>
            <div class="editor-field">
                <label>Item Label (optional)</label>
                <input type="text" class="subcategory-item-name" placeholder="e.g., Single plate" value="${safeLabel}">
            </div>
            <div class="editor-field subcategory-item-price-field">
                <label>Item Price</label>
                <input type="number" class="subcategory-item-price" min="0" step="0.01" placeholder="e.g., 12.50" value="${priceValue}">
            </div>
            ${imageUrlInputHtml}
            <div class="subcategory-row-actions">
                <button type="button" class="btn btn-small btn-primary subcategory-item-move" data-item-id="${item.id || ''}">Move</button>
                <button type="button" class="btn btn-small btn-danger subcategory-item-remove">Remove</button>
            </div>
        `;

        this.subcategoryItemsList.appendChild(row);
        this.updateSubcategoryItemsCountLabel();
    }

    updateSubcategoryItemsCountLabel() {
        if (!this.subcategoryItemsCountLabel || !this.subcategoryItemsList) return;
        const count = this.subcategoryItemsList.querySelectorAll('.subcategory-item-row').length;
        const label = count === 1 ? '1 item' : `${count} items`;
        this.subcategoryItemsCountLabel.textContent = label;
    }

    async handleSubcategoryItemsSave() {
        if (!this.currentSubcategoryRow) {
            this.closeModal('soldSubcategoryItemsModal');
            return;
        }
        const items = this.collectSubcategoryItemsFromEditor();
        if (items === null) {
            return;
        }

        // Update the actual subcategory object in the period data structure
        const period = this.getCurrentPeriod();
        let subcategory = this.currentMovingSubcategory;
        let category = this.currentMovingCategory;
        
        // If subcategory wasn't found when opening modal, try to find it now
        if (!subcategory && period && this.currentSubcategoryRow) {
            const subcategoryId = this.currentSubcategoryRow.dataset.subcategoryId;
            if (subcategoryId) {
                // Try to find from currentEditingCategory first
                if (this.currentEditingCategory) {
                    subcategory = (this.currentEditingCategory.subcategories || []).find(sub => sub.id === subcategoryId);
                    category = this.currentEditingCategory;
                }
                
                // If still not found, search all categories in the period
                if (!subcategory) {
                    for (const cat of (period.categories || [])) {
                        subcategory = (cat.subcategories || []).find(sub => sub.id === subcategoryId);
                        if (subcategory) {
                            category = cat;
                            break;
                        }
                    }
                }
            }
        }
        
        if (period && subcategory) {
            const normalizedItems = this.normalizeSubcategoryItems(items);
            subcategory.items = normalizedItems;
            subcategory.count = normalizedItems.length;
            subcategory.updatedAt = new Date().toISOString();
            
            // Update the category's updatedAt timestamp
            if (category) {
                category.updatedAt = new Date().toISOString();
            }
            period.updatedAt = new Date().toISOString();
        }

        // Update the DOM row
        this.updateSubcategoryRowFromItems(this.currentSubcategoryRow, items);
        
        // Persist to storage
        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving subcategory items:', error);
            this.showNotification('Error saving items: ' + error.message, 'error');
            return;
        }
        
        this.closeModal('soldSubcategoryItemsModal');
        this.renderTrendingKeywords();
    }

    openMoveItemModal(itemId, itemRow) {
        if (!itemId || !itemRow || !this.moveItemModal) return;

        // Get the current item data from the row
        const nameInput = itemRow.querySelector('.subcategory-item-name');
        const priceInput = itemRow.querySelector('.subcategory-item-price');
        const photoImg = itemRow.querySelector('.subcategory-item-photo img');
        const itemLabel = nameInput ? nameInput.value.trim() : '';
        const itemPrice = priceInput ? parseFloat(priceInput.value) : 0;
        const itemPhoto = photoImg && photoImg.src ? photoImg.src : (itemRow.dataset.itemPhoto || null);

        // Store references
        this.currentMovingItem = {
            id: itemId,
            label: itemLabel,
            price: itemPrice,
            photo: itemPhoto,
            createdAt: itemRow.dataset.createdAt || new Date().toISOString()
        };
        this.currentMovingItemRow = itemRow;

        // Use stored category and subcategory from openSubcategoryItemsModal
        if (!this.currentMovingCategory || !this.currentMovingSubcategory) {
            // Fallback: try to find from period
            const period = this.getCurrentPeriod();
            if (!period) {
                this.showNotification('No period found.', 'error');
                return;
            }

            for (const cat of period.categories) {
                for (const sub of (cat.subcategories || [])) {
                    const items = this.normalizeSubcategoryItems(sub.items);
                    if (items.some(item => item.id === itemId)) {
                        this.currentMovingCategory = cat;
                        this.currentMovingSubcategory = sub;
                        break;
                    }
                }
                if (this.currentMovingCategory) break;
            }
        }

        if (!this.currentMovingCategory || !this.currentMovingSubcategory) {
            this.showNotification('Unable to determine current category/subcategory.', 'error');
            return;
        }

        const period = this.getCurrentPeriod();
        if (!period) {
            this.showNotification('No period found.', 'error');
            return;
        }

        // Load categories for the dropdown (show all categories, including current one)
        this.loadMoveCategories(period);

        this.moveItemModal.style.display = 'block';
    }

    loadMoveCategories(period, excludeCategoryId = null) {
        if (!this.moveItemCategorySelect) return;

        this.moveItemCategorySelect.innerHTML = '<option value="">Select a category...</option>';

        if (!period.categories || period.categories.length === 0) {
            this.moveItemCategorySelect.innerHTML = '<option value="">No categories available</option>';
            this.moveItemCategorySelect.disabled = true;
            return;
        }

        this.moveItemCategorySelect.disabled = false;

        // Show all categories (including current one, so user can move to different subcategory in same category)
        period.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            option.dataset.categoryData = JSON.stringify(category);
            this.moveItemCategorySelect.appendChild(option);
        });
    }

    handleMoveCategoryChange() {
        if (!this.moveItemCategorySelect || !this.moveItemSubcategorySelect) return;

        const selectedCategoryId = this.moveItemCategorySelect.value;
        
        this.moveItemSubcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';

        if (!selectedCategoryId) {
            this.moveItemSubcategorySelect.disabled = true;
            return;
        }

        const selectedOption = this.moveItemCategorySelect.options[this.moveItemCategorySelect.selectedIndex];
        if (!selectedOption || !selectedOption.dataset.categoryData) {
            this.moveItemSubcategorySelect.disabled = true;
            return;
        }

        try {
            const category = JSON.parse(selectedOption.dataset.categoryData);
            const subcategories = category.subcategories || [];

            this.moveItemSubcategorySelect.disabled = false;

            if (subcategories.length > 0) {
                subcategories.forEach(sub => {
                    // Exclude current subcategory if moving within same category
                    if (this.currentMovingCategory && 
                        this.currentMovingCategory.id === category.id && 
                        this.currentMovingSubcategory && 
                        sub.id === this.currentMovingSubcategory.id) {
                        return;
                    }
                    const option = document.createElement('option');
                    option.value = sub.id;
                    option.textContent = sub.name;
                    this.moveItemSubcategorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading subcategories:', error);
            this.moveItemSubcategorySelect.innerHTML = '<option value="">Error loading subcategories</option>';
            this.moveItemSubcategorySelect.disabled = true;
        }
    }

    handleMoveItemSubmit(e) {
        e.preventDefault();

        if (!this.currentMovingItem || !this.currentMovingItemRow) {
            this.showNotification('Item data not found.', 'error');
            return;
        }

        const categoryId = this.moveItemCategorySelect.value;
        const subcategoryId = this.moveItemSubcategorySelect.value;

        if (!categoryId || !subcategoryId) {
            this.showNotification('Please select both a category and subcategory.', 'warning');
            return;
        }

        const period = this.getCurrentPeriod();
        if (!period) {
            this.showNotification('No period found.', 'error');
            return;
        }

        // Find target category and subcategory
        const targetCategory = period.categories.find(cat => cat.id === categoryId);
        if (!targetCategory) {
            this.showNotification('Target category not found.', 'error');
            return;
        }

        const targetSubcategory = (targetCategory.subcategories || []).find(sub => sub.id === subcategoryId);
        if (!targetSubcategory) {
            this.showNotification('Target subcategory not found.', 'error');
            return;
        }

        // Find the actual subcategory reference in the period data to ensure we're modifying the correct object
        let actualCurrentSubcategory = null;
        let actualCurrentCategory = null;
        
        for (const cat of period.categories) {
            if (cat.id === this.currentMovingCategory.id) {
                actualCurrentCategory = cat;
                for (const sub of (cat.subcategories || [])) {
                    if (sub.id === this.currentMovingSubcategory.id) {
                        actualCurrentSubcategory = sub;
                        break;
                    }
                }
                break;
            }
        }
        
        if (!actualCurrentSubcategory) {
            this.showNotification('Error: Could not find current subcategory in period data.', 'error');
            return;
        }

        // Remove item from current subcategory
        if (actualCurrentSubcategory.items) {
            const itemIndex = actualCurrentSubcategory.items.findIndex(item => item.id === this.currentMovingItem.id);
            if (itemIndex !== -1) {
                actualCurrentSubcategory.items.splice(itemIndex, 1);
                actualCurrentSubcategory.count = actualCurrentSubcategory.items.length;
                const timestamp = new Date().toISOString();
                actualCurrentSubcategory.updatedAt = timestamp;
                actualCurrentCategory.updatedAt = timestamp;
                
                // Update the subcategory row's dataset.items to reflect the removal
                if (this.currentSubcategoryRow) {
                    const normalizedItems = this.normalizeSubcategoryItems(actualCurrentSubcategory.items);
                    this.currentSubcategoryRow.dataset.items = JSON.stringify(normalizedItems);
                    
                    // Update the pill count
                    const pill = this.currentSubcategoryRow.querySelector('.subcategory-items-pill');
                    if (pill) {
                        pill.textContent = normalizedItems.length;
                    }
                    
                    // Update count input
                    const countInput = this.currentSubcategoryRow.querySelector('.subcategory-count-input');
                    if (countInput) {
                        countInput.value = normalizedItems.length;
                    }
                }
            } else {
                this.showNotification('Error: Item not found in current subcategory.', 'error');
                return;
            }
        }

        // Add item to target subcategory
        if (!targetSubcategory.items) {
            targetSubcategory.items = [];
        }
        const timestamp = new Date().toISOString();
        const movedItem = {
            id: this.currentMovingItem.id,
            label: this.currentMovingItem.label,
            price: this.currentMovingItem.price,
            photo: this.currentMovingItem.photo || null, // Preserve photo
            createdAt: this.currentMovingItem.createdAt,
            updatedAt: timestamp
        };
        targetSubcategory.items.push(movedItem);
        
        // Normalize items to ensure consistency
        const normalizedTargetItems = this.normalizeSubcategoryItems(targetSubcategory.items);
        targetSubcategory.items = normalizedTargetItems;
        targetSubcategory.count = normalizedTargetItems.length;
        targetSubcategory.updatedAt = timestamp;
        targetCategory.updatedAt = timestamp;
        period.updatedAt = timestamp;

        // Update the target subcategory's row in the DOM to reflect the new item count
        const targetSubcategoryRow = document.querySelector(`[data-subcategory-id="${subcategoryId}"]`);
        if (targetSubcategoryRow) {
            targetSubcategoryRow.dataset.items = JSON.stringify(normalizedTargetItems);
            
            // Update the pill count
            const pill = targetSubcategoryRow.querySelector('.subcategory-items-pill');
            if (pill) {
                pill.textContent = normalizedTargetItems.length;
            }
            
            // Update count input
            const countInput = targetSubcategoryRow.querySelector('.subcategory-count-input');
            if (countInput) {
                countInput.value = normalizedTargetItems.length;
            }
        }

        // Sync categories from period to ensure we have the latest data
        this.syncCategoriesFromPeriod();
        
        // Save data
        this.saveData();

        // Remove the row from current view (it's now in a different subcategory)
        this.currentMovingItemRow.remove();
        this.updateSubcategoryItemsCountLabel();

        // Close modal
        this.closeModal('moveItemModal');

        // Clear references
        this.currentMovingItem = null;
        this.currentMovingItemRow = null;
        this.currentMovingCategory = null;
        this.currentMovingSubcategory = null;

        this.showNotification('Item moved successfully.', 'success');
        this.renderTrendingKeywords();
    }

    collectSubcategoryItemsFromEditor() {
        if (!this.subcategoryItemsList) return [];
        const itemRows = Array.from(this.subcategoryItemsList.querySelectorAll('.subcategory-item-row'));
        const timestamp = new Date().toISOString();
        const items = [];

        for (const row of itemRows) {
            const labelInput = row.querySelector('.subcategory-item-name');
            const priceInput = row.querySelector('.subcategory-item-price');
            if (!priceInput) {
                continue;
            }

            const priceRaw = priceInput.value.trim();
            if (priceRaw === '') {
                this.showNotification('Please enter a price for each item, or remove rows you do not need.', 'warning');
                return null;
            }

            const priceValue = Number(priceRaw);
            if (!Number.isFinite(priceValue) || priceValue < 0) {
                this.showNotification('Please enter a valid price (0 or greater) for each item.', 'warning');
                return null;
            }

            const label = labelInput ? labelInput.value.trim() : '';
            const itemId = row.dataset.itemId || this.generateId('solditem');
            const createdAt = row.dataset.createdAt || timestamp;
            
            // Get photo from image URL input (for manually added items) or from existing photo
            const imageUrlInput = row.querySelector('.subcategory-item-image-url');
            const photoImg = row.querySelector('.subcategory-item-photo img');
            let photo = null;
            
            // Priority: image URL input (for manually added items) > existing photo > dataset
            if (imageUrlInput && imageUrlInput.value.trim()) {
                photo = imageUrlInput.value.trim();
            } else if (photoImg && photoImg.src && !photoImg.src.includes('data:') && photoImg.style.display !== 'none') {
                photo = photoImg.src;
            } else if (row.dataset.itemPhoto) {
                photo = row.dataset.itemPhoto;
            }

            items.push({
                id: itemId,
                label,
                price: priceValue,
                photo: photo,
                createdAt,
                updatedAt: timestamp
            });
        }

        return items;
    }

    updateSubcategoryRowFromItems(row, items) {
        if (!row) return;
        const normalizedItems = this.normalizeSubcategoryItems(items);
        row.dataset.items = JSON.stringify(normalizedItems);

        const pill = row.querySelector('.subcategory-items-pill');
        if (pill) {
            pill.textContent = normalizedItems.length;
        }

        const nameInput = row.querySelector('.subcategory-name-input');
        const manageBtn = row.querySelector('.subcategory-manage-btn');
        if (manageBtn) {
            const name = nameInput ? nameInput.value.trim() : '';
            const itemText = normalizedItems.length === 1 ? '1 item' : `${normalizedItems.length} items`;
            manageBtn.setAttribute('aria-label', name ? `Manage items for ${name} (${itemText})` : `Manage items (${itemText})`);
        }

        const countInput = row.querySelector('.subcategory-count-input');
        const priceInput = row.querySelector('.subcategory-price-input');
        const countHint = row.querySelector('.subcategory-count-hint');
        const priceHint = row.querySelector('.subcategory-price-hint');
        const itemsLength = normalizedItems.length;

        if (countInput) {
            countInput.value = itemsLength;
            if (itemsLength) {
                countInput.setAttribute('readonly', 'readonly');
            } else {
                countInput.removeAttribute('readonly');
            }
        }

        if (priceInput) {
            if (itemsLength) {
                priceInput.value = '';
                priceInput.setAttribute('disabled', 'disabled');
            } else {
                priceInput.removeAttribute('disabled');
            }
        }

        if (countHint) {
            countHint.classList.toggle('visible', Boolean(itemsLength));
        }

        if (priceHint) {
            priceHint.classList.toggle('visible', Boolean(itemsLength));
        }
    }

    handleCategorySubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('soldCategoryName');
        const descriptionInput = document.getElementById('soldCategoryDescription');
        if (!nameInput || !this.subcategoryEditorEl) return;

        const name = nameInput.value.trim();
        const description = descriptionInput ? descriptionInput.value.trim() : '';

        if (!name) {
            this.showNotification('Please enter a category name.', 'warning');
            return;
        }

        const timestamp = new Date().toISOString();
        const subcategories = [];

        this.subcategoryEditorEl.querySelectorAll('.subcategory-editor-row').forEach(row => {
            const nameInputEl = row.querySelector('.subcategory-name-input');
            const countInputEl = row.querySelector('.subcategory-count-input');
            const priceInputEl = row.querySelector('.subcategory-price-input');
            if (!nameInputEl || !countInputEl) return;

            const subName = nameInputEl.value.trim();
            const count = parseInt(countInputEl.value, 10);
            if (!subName) return;

            const existingId = row.dataset.subcategoryId;
            const createdAt = row.dataset.createdAt || timestamp;
            const priceValue = priceInputEl ? parseFloat(priceInputEl.value) : NaN;
            const items = this.normalizeSubcategoryItems(row.dataset.items);
            const hasItems = items.length > 0;
            const resolvedCount = hasItems ? items.length : (Number.isFinite(count) && count >= 0 ? count : 0);
            const price = hasItems ? null : (Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : null);

            subcategories.push({
                id: existingId || this.generateId('sub'),
                name: subName,
                count: resolvedCount,
                price,
                items,
                createdAt,
                updatedAt: timestamp
            });
        });

        if (this.currentEditingCategory) {
            this.currentEditingCategory.name = name;
            this.currentEditingCategory.description = description;
            this.currentEditingCategory.subcategories = subcategories;
            this.currentEditingCategory.updatedAt = timestamp;
        } else {
            this.categories.push({
                id: this.generateId('cat'),
                name,
                description,
                createdAt: timestamp,
                updatedAt: timestamp,
                subcategories
            });
        }

        this.touchCurrentPeriod(timestamp);
        this.saveData();
        this.renderCategories();
        this.renderTrendingKeywords();
        this.closeModal('soldCategoryModal');
    }

    async deleteCategory(categoryId, skipConfirm = false) {
        const category = this.categories.find(cat => cat.id === categoryId);
        if (!category) return;

        if (!skipConfirm) {
            const confirmed = await this.showConfirm(
                `Delete category "${category.name}" and all of its subcategories?`,
                {
                    title: 'Delete Category',
                    confirmLabel: 'Delete',
                    cancelLabel: 'Cancel',
                    variant: 'danger'
                }
            );
            if (!confirmed) {
                return;
            }
        }

        const idx = this.categories.findIndex(cat => cat.id === categoryId);
        if (idx !== -1) {
            this.categories.splice(idx, 1);
        }
        this.touchCurrentPeriod();
        this.saveData();
        this.renderCategories();
        this.closeModal('soldCategoryModal');
        this.showNotification(`Deleted category "${category.name}".`, 'success');
    }

    async handleResetData() {
        const confirmed = await this.showConfirm(
            'This will clear all sold trend data. This action cannot be undone.',
            {
                title: 'Reset Sold Trends Data',
                confirmLabel: 'Reset Data',
                cancelLabel: 'Cancel',
                variant: 'danger'
            }
        );

        if (!confirmed) {
            return;
        }

        localStorage.removeItem('SoldItemsTrends');
        this.periods = [];
        this.currentPeriodId = null;
        this.categories = [];
        this.updatePeriodSelect();
        this.renderCategories();
        this.renderDataPeriod();
        this.saveData();
        this.closeModal('soldCategoryModal');
        this.updateRemovePeriodButtonState();
        this.showNotification('Sold trend data has been reset.', 'success');
    }

    renderCategories() {
        const container = document.getElementById('soldCategoriesContainer');
        if (!container) return;

        const currentPeriod = this.getCurrentPeriod();

        if (!currentPeriod) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No periods yet</h3>
                    <p>Add a period to start tracking how many items have sold.</p>
                </div>
            `;
            return;
        }

        if (!this.categories || this.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No sold categories yet</h3>
                    <p>Create a category for the "${this.escapeHtml(currentPeriod.name)}" period to start tracking how many items have sold.</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.categories.forEach(category => {
            const totals = category.subcategories.reduce((acc, sub) => {
                const items = this.normalizeSubcategoryItems(sub.items);
                const hasItems = items.length > 0;
                const count = hasItems ? items.length : sub.count ?? 0;
                acc.totalSold += count;

                if (hasItems) {
                    const itemsTotal = items.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0);
                    acc.totalMade += itemsTotal;
                    acc.hasPrice = true;
                } else if (Number.isFinite(sub.price)) {
                    acc.totalMade += count * sub.price;
                    acc.hasPrice = true;
                }
                return acc;
            }, { totalSold: 0, totalMade: 0, hasPrice: false });

            const updatedText = category.updatedAt ? this.formatRelativeDate(category.updatedAt) : this.formatRelativeDate(category.createdAt);

            const subcategoriesMarkup = category.subcategories.length
                ? `<ul class="sold-subcategory-list">
                        ${category.subcategories.map(sub => {
                            const items = this.normalizeSubcategoryItems(sub.items);
                            const hasItems = items.length > 0;
                            const itemCount = hasItems ? items.length : sub.count ?? 0;
                            const countLabel = hasItems
                                ? `${this.formatNumber(itemCount)} ${itemCount === 1 ? 'item' : 'items'}`
                                : this.formatNumber(itemCount);
                            let priceLabel = '';

                            if (hasItems) {
                                const itemsTotal = items.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0);
                                priceLabel = `Total <span class="sold-price-value">${this.formatCurrency(itemsTotal)}</span>`;
                            } else if (Number.isFinite(sub.price)) {
                                priceLabel = `× <span class="sold-price-value">${this.formatCurrency(sub.price)}</span>`;
                            }

                            return `
                                <li>
                                    <div class="sold-subcategory-line">
                                        <span class="sold-subcategory-name">${this.escapeHtml(sub.name)}</span>
                                        <span class="sold-subcategory-count">
                                            ${countLabel}${priceLabel ? ` · ${priceLabel}` : ''}
                                        </span>
                                    </div>
                                </li>
                            `;
                        }).join('')}
                   </ul>`
                : `<div class="sold-subcategory-empty">No subcategories yet. Use Edit to add the first one.</div>`;

            const totalSoldMarkup = `<span class="sold-total-inline sold-category-total">Total sold: <strong>${this.formatNumber(totals.totalSold)}</strong></span>`;
            const totalMadeMarkup = totals.hasPrice
                ? `<span class="sold-total-inline sold-category-total sold-total-made">Total made: <strong class="sold-price-value">${this.formatCurrency(totals.totalMade)}</strong></span>`
                : '';

            html += `
                <div class="category-box sold-category-box" data-category-id="${category.id}">
                    <div class="sold-category-header">
                        <h3>${this.escapeHtml(category.name)}</h3>
                        ${category.description ? `<p class="sold-category-description">${this.escapeHtml(category.description)}</p>` : ''}
                        <p class="sold-card-updated">Updated ${updatedText}</p>
                    </div>
                    ${subcategoriesMarkup}
                    <div class="sold-category-actions">
                        <button class="btn btn-small btn-primary" data-action="edit-category" data-category-id="${category.id}">Edit</button>
                        <div class="sold-category-totals">
                            ${totalSoldMarkup}
                            ${totalMadeMarkup}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        // Update trending keywords after rendering categories
        this.renderTrendingKeywords();
    }

    renderTrendingKeywords() {
        if (!this.trendingKeywordsList) return;

        const period = this.getCurrentPeriod();
        if (!period || !period.categories) {
            this.trendingKeywordsList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No data available</p>';
            return;
        }

        // Collect all items from all subcategories
        const keywordCounts = new Map();
        
        period.categories.forEach(category => {
            if (category.subcategories) {
                category.subcategories.forEach(subcategory => {
                    if (subcategory.items) {
                        const normalizedItems = this.normalizeSubcategoryItems(subcategory.items);
                        normalizedItems.forEach(item => {
                            const label = item.label || '';
                            if (label.trim()) {
                                // Extract keywords from the label
                                // Split by common separators and extract meaningful words
                                const words = label.toLowerCase()
                                    .split(/[\s,\-_\/\(\)]+/)
                                    .filter(word => word.length >= 2) // Filter out very short words
                                    .filter(word => !/^\d+$/.test(word)); // Filter out pure numbers
                                
                                words.forEach(word => {
                                    const count = keywordCounts.get(word) || 0;
                                    keywordCounts.set(word, count + 1);
                                });
                            }
                        });
                    }
                });
            }
        });

        if (keywordCounts.size === 0) {
            this.trendingKeywordsList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No keywords found</p>';
            return;
        }

        // Sort by count (descending) and get top keywords
        const sortedKeywords = Array.from(keywordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50); // Show top 50 keywords

        let html = '';
        sortedKeywords.forEach(([keyword, count]) => {
            const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            html += `
                <div class="trending-keyword-item" data-keyword="${this.escapeHtml(keyword)}">
                    <span class="trending-keyword-name">${this.escapeHtml(capitalizedKeyword)}</span>
                    <span class="trending-keyword-count">${count}</span>
                </div>
            `;
        });

        this.trendingKeywordsList.innerHTML = html;

        // Add click handlers to search for the keyword
        this.trendingKeywordsList.querySelectorAll('.trending-keyword-item').forEach(item => {
            item.addEventListener('click', () => {
                const keyword = item.dataset.keyword;
                if (this.soldSearchBar) {
                    this.soldSearchBar.value = keyword;
                    this.searchSoldItems();
                }
            });
        });
    }

    async saveData() {
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
        const data = {
            periods: this.periods,
            currentPeriodId: this.currentPeriodId
        };
        
        // Try to save to backend first if storage wrapper is available and backend is configured
        if (window.storageWrapper && window.storageWrapper.useBackend && window.storageWrapper.backendAvailable) {
            try {
                await window.storageWrapper.saveToBackend(storageKey, data);
                // Also cache in localStorage for faster access
                try {
                    localStorage.setItem(storageKey, JSON.stringify(data));
                } catch (localError) {
                    console.warn('Failed to cache in localStorage:', localError);
                }
                return;
            } catch (backendError) {
                console.warn('Failed to save to backend, falling back to localStorage:', backendError);
                // Fall through to localStorage save
            }
        }
        
        // Fallback to localStorage
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save SoldItemsTrends data:', error);
            throw error;
        }
    }

    setupNotificationSystem() {
        if (this.notificationCloseBtn) {
            this.notificationCloseBtn.addEventListener('click', () => this.hideNotification());
        }

        if (this.notificationEl) {
            this.notificationEl.addEventListener('click', (e) => {
                if (e.target === this.notificationEl) {
                    this.hideNotification();
                }
            });
        }

        if (this.confirmCancelBtn) {
            this.confirmCancelBtn.addEventListener('click', () => this.resolveConfirm(false));
        }

        if (this.confirmAcceptBtn) {
            this.confirmAcceptBtn.addEventListener('click', () => this.resolveConfirm(true));
        }

        if (this.confirmModal) {
            this.confirmModal.addEventListener('click', (e) => {
                if (e.target === this.confirmModal) {
                    this.resolveConfirm(false);
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.activeConfirmResolver) {
                    this.resolveConfirm(false);
                } else if (this.notificationEl && this.notificationEl.classList.contains('visible')) {
                    this.hideNotification();
                }
            }
        });
    }

    showNotification(message, type = 'info', options = {}) {
        if (!this.notificationEl || !this.notificationMessageEl) {
            return;
        }

        const { duration = 4000 } = options;

        if (this.notificationHideTimeout) {
            clearTimeout(this.notificationHideTimeout);
        }

        this.notificationMessageEl.textContent = message;
        this.notificationEl.dataset.type = type;
        this.notificationEl.classList.add('visible');
        this.notificationEl.setAttribute('aria-hidden', 'false');

        if (duration !== null) {
            this.notificationHideTimeout = setTimeout(() => this.hideNotification(), duration);
        }
    }

    hideNotification() {
        if (!this.notificationEl) {
            return;
        }
        if (this.notificationHideTimeout) {
            clearTimeout(this.notificationHideTimeout);
            this.notificationHideTimeout = null;
        }
        this.notificationEl.classList.remove('visible');
        this.notificationEl.setAttribute('aria-hidden', 'true');
        delete this.notificationEl.dataset.type;
        if (this.notificationMessageEl) {
            this.notificationMessageEl.textContent = '';
        }
    }

    showConfirm(message, options = {}) {
        if (!this.confirmModal || !this.confirmMessageEl) {
            return Promise.resolve(true);
        }

        if (this.activeConfirmResolver) {
            this.resolveConfirm(false);
        }

        const settings = {
            ...this.confirmDefaults,
            ...options
        };

        this.confirmMessageEl.textContent = message;
        if (this.confirmTitleEl) {
            this.confirmTitleEl.textContent = settings.title;
        }

        if (this.confirmCancelBtn) {
            this.confirmCancelBtn.textContent = settings.cancelLabel;
        }

        if (this.confirmAcceptBtn) {
            this.confirmAcceptBtn.textContent = settings.confirmLabel;
            this.confirmAcceptBtn.classList.remove('btn-primary', 'btn-danger');
            const variantClass = settings.variant === 'primary' ? 'btn-primary' : 'btn-danger';
            this.confirmAcceptBtn.classList.add(variantClass);
        }

        this.confirmModal.style.display = 'block';
        this.confirmModal.setAttribute('aria-hidden', 'false');

        const focusTarget = settings.focus === 'cancel' ? this.confirmCancelBtn : this.confirmAcceptBtn;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            focusTarget.focus();
        }

        return new Promise((resolve) => {
            this.activeConfirmResolver = resolve;
        });
    }

    resolveConfirm(result) {
        if (this.confirmModal) {
            this.confirmModal.style.display = 'none';
            this.confirmModal.setAttribute('aria-hidden', 'true');
        }

        if (this.confirmAcceptBtn) {
            this.confirmAcceptBtn.classList.remove('btn-primary');
            if (!this.confirmAcceptBtn.classList.contains('btn-danger')) {
                this.confirmAcceptBtn.classList.add('btn-danger');
            }
        }

        const resolver = this.activeConfirmResolver;
        this.activeConfirmResolver = null;
        if (typeof resolver === 'function') {
            resolver(Boolean(result));
        }
    }

    updateRemovePeriodButtonState() {
        if (this.removePeriodBtn) {
            this.removePeriodBtn.disabled = !this.periods.length;
        }
    }

    async handleRemovePeriod() {
        if (!this.periods.length) {
            this.showNotification('No periods available to remove.', 'warning');
            return;
        }
        const period = this.getCurrentPeriod();
        if (!period) {
            this.showNotification('No period selected to remove.', 'warning');
            return;
        }

        const confirmed = await this.showConfirm(
            `Remove the period "${period.name}"? This deletes all categories and sold data saved for it.`,
            {
                title: 'Remove Period',
                confirmLabel: 'Remove',
                cancelLabel: 'Keep Period',
                variant: 'danger'
            }
        );

        if (!confirmed) {
            return;
        }

        const removed = this.removePeriod(period.id);
        if (removed) {
            this.showNotification(`Removed period "${period.name}".`, 'success');
        }
    }

    removePeriod(periodId) {
        const index = this.periods.findIndex(period => period.id === periodId);
        if (index === -1) {
            this.showNotification('Unable to find that period. Please try again.', 'error');
            return false;
        }

        this.periods.splice(index, 1);

        if (!this.periods.length) {
            this.currentPeriodId = null;
            this.categories = [];
        } else {
            const nextIndex = index >= this.periods.length ? this.periods.length - 1 : index;
            this.currentPeriodId = this.periods[nextIndex].id;
        }

        this.syncCategoriesFromPeriod();
        this.updatePeriodSelect();
        this.renderDataPeriod();
        this.renderCategories();
        this.saveData();
        this.updateRemovePeriodButtonState();
        return true;
    }

    async loadData() {
        // Get store-specific key
        const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
        
        // Check if using Dropbox/cloud storage (backend is source of truth)
        const storageConfig = this.getStorageConfig ? this.getStorageConfig() : 
            (window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null);
        const storageMode = storageConfig?.storage_mode || 'local';
        const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
        const backendAvailable = window.storageWrapper && 
                                 window.storageWrapper.useBackend && 
                                 window.storageWrapper.backendAvailable;
        
        let saved = null;
        let loadedFromOldKey = false;
        let loadedFromBackend = false;
        
        // CRITICAL: When using Dropbox/cloud, always load from backend first
        if (backendAvailable && useBackendStorage) {
            try {
                console.log(`🔄 Loading SoldItemsTrends from ${storageMode} storage...`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(`http://127.0.0.1:5000/api/storage/get`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ key: storageKey }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.value) {
                        try {
                            const backendData = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
                            saved = JSON.stringify(backendData);
                            loadedFromBackend = true;
                            console.log(`✅ Loaded SoldItemsTrends from ${storageMode} storage`);
                            
                            // Update localStorage with backend data
                            try {
                                localStorage.setItem(storageKey, saved);
                                console.log('✓ Updated localStorage with backend data');
                            } catch (cacheError) {
                                console.warn('Could not cache data in localStorage:', cacheError);
                            }
                        } catch (parseError) {
                            console.error('Error parsing backend data:', parseError);
                        }
                    }
                }
            } catch (backendError) {
                if (backendError.name !== 'AbortError') {
                    console.warn(`Could not load from backend storage:`, backendError.message);
                }
            }
        }
        
        // Fall back to localStorage if backend didn't provide data
        if (!saved) {
            saved = localStorage.getItem(storageKey);
            if (!saved) {
                // Try old key without store suffix
                saved = localStorage.getItem('SoldItemsTrends');
                if (saved) {
                    loadedFromOldKey = true;
                }
            }
        }
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (Array.isArray(data.periods)) {
                    this.periods = data.periods.map(period => this.normalizePeriod(period));
                    this.currentPeriodId = data.currentPeriodId;
                } else {
                    const legacyCategories = Array.isArray(data.categories) ? data.categories : [];
                    const legacyName = data.dataPeriod?.primary || '';
                    const legacyDescription = data.dataPeriod?.secondary || '';
                    if (legacyCategories.length || legacyName) {
                        const legacyPeriod = this.createPeriod(legacyName || 'Legacy Period', legacyDescription, legacyCategories);
                        this.periods = legacyPeriod ? [legacyPeriod] : [];
                        this.currentPeriodId = legacyPeriod ? legacyPeriod.id : null;
                    } else {
                        this.periods = [];
                        this.currentPeriodId = null;
                    }
                }
                
                // If we loaded from old key, migrate to store-specific key
                // SAFETY: Only migrate if using local storage - in Dropbox mode, keep old keys as backup
                if (loadedFromOldKey && window.storeManager && !localStorage.getItem(storageKey)) {
                    const storageConfig = this.getStorageConfig ? this.getStorageConfig() : 
                        (window.listingLifeSettings ? window.listingLifeSettings.getStorageConfig() : null);
                    const storageMode = storageConfig?.storage_mode || 'local';
                    const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
                    
                    this.saveData();
                    
                    // Only remove old key in local mode - keep as backup in Dropbox mode
                    if (!useBackendStorage) {
                        localStorage.removeItem('SoldItemsTrends');
                        console.log('✓ Migrated to store-specific key (local mode)');
                    } else {
                        console.log('ℹ️ Keeping old key as backup (Dropbox mode)');
                    }
                }
            } catch (err) {
                console.error('Error parsing sold trends data:', err);
                // SAFETY: Don't clear data on parse error - try to preserve what we can
                // Only clear if we truly have no valid data
                if (!this.periods || this.periods.length === 0) {
                    this.periods = [];
                    this.currentPeriodId = null;
                } else {
                    console.warn('⚠️ Parse error but keeping existing periods data');
                }
            }
        } else {
            this.periods = [];
            this.currentPeriodId = null;
        }

        if (!this.periods.length) {
            this.categories = [];
            this.currentPeriodId = null;
            return;
        }

        if (!this.currentPeriodId || !this.periods.some(period => period.id === this.currentPeriodId)) {
            if (this.periods.length > 0) {
                this.currentPeriodId = this.periods[0].id;
            }
        }

        // Log what we loaded for debugging
        console.log(`✓ Sold Items Trends loaded: ${this.periods.length} period(s), ${this.categories.length} categories`);
        if (this.periods.length > 0) {
            console.log(`   Periods: ${this.periods.map(p => p.name).join(', ')}`);
        }

        this.syncCategoriesFromPeriod();
        this.updateRemovePeriodButtonState();
        
        // CRITICAL: Update the dropdown AFTER data is loaded
        this.updatePeriodSelect();
        this.renderDataPeriod();
    }

    renderDataPeriod() {
        if (!this.dataPeriodDisplay) return;

        const period = this.getCurrentPeriod();
        if (!period) {
            this.dataPeriodDisplay.innerHTML = '<span class="data-period-empty">No period saved yet</span>';
            return;
        }

        const parts = [`<span class="data-period-name">${this.escapeHtml(period.name)}</span>`];
        if (period.description) {
            parts.push(`<span class="data-period-note">${this.escapeHtml(period.description)}</span>`);
        }
        this.dataPeriodDisplay.innerHTML = parts.join('');
    }

    openPeriodModal() {
        if (!this.periodModal) return;
        if (this.periodNameInput) this.periodNameInput.value = '';
        if (this.periodDescriptionInput) this.periodDescriptionInput.value = '';
        this.periodModal.style.display = 'block';
        if (this.periodNameInput) this.periodNameInput.focus();
    }

    handlePeriodFormSubmit(e) {
        e.preventDefault();
        if (!this.periodNameInput) return;

        const name = this.periodNameInput.value.trim();
        const description = this.periodDescriptionInput ? this.periodDescriptionInput.value.trim() : '';

        if (!name) {
            this.showNotification('Please enter a period name.', 'warning');
            return;
        }

        const newPeriod = this.createPeriod(name, description, []);
        this.periods.push(newPeriod);
        this.closeModal('soldPeriodModal');
        this.setCurrentPeriod(newPeriod.id);
        this.showNotification(`Added period "${name}".`, 'success');
    }

    setCurrentPeriod(periodId) {
        if (!this.periods.length) {
            this.currentPeriodId = null;
            this.categories = [];
            this.updatePeriodSelect();
            this.renderDataPeriod();
            this.renderCategories();
            this.renderTrendingKeywords();
            this.saveData();
            return;
        }
        const targetPeriod = this.periods.find(period => period.id === periodId) || this.periods[0];
        this.currentPeriodId = targetPeriod.id;
        this.syncCategoriesFromPeriod();
        this.updatePeriodSelect();
        this.renderDataPeriod();
        this.renderCategories();
        this.renderTrendingKeywords();
        this.saveData();
    }

    getCurrentPeriod() {
        if (!this.periods.length) return null;
        return this.periods.find(period => period.id === this.currentPeriodId) || this.periods[0] || null;
    }

    syncCategoriesFromPeriod() {
        const period = this.getCurrentPeriod();
        this.categories = period ? period.categories : [];
    }

    updatePeriodSelect() {
        if (!this.periodSelect) return;
        this.periodSelect.innerHTML = '';

        if (!this.periods.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No periods added';
            option.disabled = true;
            option.selected = true;
            this.periodSelect.appendChild(option);
            this.periodSelect.disabled = true;
            this.updateRemovePeriodButtonState();
            return;
        }

        this.periodSelect.disabled = false;

        this.periods.forEach(period => {
            const option = document.createElement('option');
            option.value = period.id;
            option.textContent = period.name;
            if (period.id === this.currentPeriodId) {
                option.selected = true;
            }
            this.periodSelect.appendChild(option);
        });
        this.updateRemovePeriodButtonState();
    }

    touchCurrentPeriod(timestamp = new Date().toISOString()) {
        const period = this.getCurrentPeriod();
        if (period) {
            period.updatedAt = timestamp;
        }
    }

    createPeriod(name, description = '', categories = []) {
        const timestamp = new Date().toISOString();
        const safeName = typeof name === 'string' && name.trim() ? name.trim() : 'Untitled Period';
        const safeDescription = typeof description === 'string' ? description.trim() : '';
        return {
            id: this.generateId('period'),
            name: safeName,
            description: safeDescription,
            categories: Array.isArray(categories) ? categories : [],
            createdAt: timestamp,
            updatedAt: timestamp
        };
    }

    normalizePeriod(period) {
        if (!period || typeof period !== 'object') {
            return this.createPeriod('Untitled Period');
        }
        const timestamp = new Date().toISOString();
        return {
            id: period.id || this.generateId('period'),
            name: period.name && String(period.name).trim() ? String(period.name).trim() : 'Untitled Period',
            description: period.description && String(period.description).trim ? String(period.description).trim() : '',
            categories: Array.isArray(period.categories) ? period.categories : [],
            createdAt: period.createdAt || timestamp,
            updatedAt: period.updatedAt || period.createdAt || timestamp
        };
    }

    normalizeSubcategoryItems(itemsInput) {
        if (!itemsInput) return [];
        let rawItems;
        if (Array.isArray(itemsInput)) {
            rawItems = itemsInput;
        } else if (typeof itemsInput === 'string') {
            rawItems = this.safeParseJson(itemsInput);
        } else {
            rawItems = [];
        }

        if (!Array.isArray(rawItems)) return [];
        const fallbackTimestamp = new Date().toISOString();

        return rawItems
            .map(item => this.normalizeSubcategoryItem(item, fallbackTimestamp))
            .filter(Boolean);
    }

    normalizeSubcategoryItem(item, fallbackTimestamp) {
        if (!item || typeof item !== 'object') return null;
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) return null;
        const label = item.label && String(item.label).trim() ? String(item.label).trim() : '';
        const photo = item.photo && String(item.photo).trim() ? String(item.photo).trim() : null;
        const createdAt = item.createdAt || fallbackTimestamp;
        const updatedAt = item.updatedAt || item.createdAt || fallbackTimestamp;

        return {
            id: item.id || this.generateId('solditem'),
            label,
            price,
            photo,
            createdAt,
            updatedAt
        };
    }

    safeParseJson(str) {
        if (typeof str !== 'string') return [];
        try {
            return JSON.parse(str);
        } catch (err) {
            console.warn('Unable to parse JSON', err);
            return [];
        }
    }

    formatNumber(value) {
        return Number(value || 0).toLocaleString();
    }

    formatCurrency(value) {
        const config = this.getCurrencyConfig();
        const numericValue = Number(value || 0);
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
        const localized = typeof Intl !== 'undefined'
            ? safeValue.toLocaleString(config.locale || undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
            : safeValue.toFixed(2);
        return `${config.symbol}${localized}`;
    }

    formatRelativeDate(dateString) {
        if (!dateString) return 'just now';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return 'just now';

        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

        return date.toLocaleDateString();
    }

    generateId(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getCurrencyConfig() {
        if (!this.currencyConfig) {
            this.currencyConfig = this.loadCurrencyConfig();
        }
        return this.currencyConfig;
    }

    searchSoldItems() {
        if (!this.soldSearchBar || !this.soldSearchResults) return;

        const searchTerm = this.soldSearchBar.value.trim();
        const originalSearchTerm = searchTerm; // Keep original for display
        
        if (!searchTerm) {
            this.soldSearchResults.style.display = 'none';
            const categoriesContainer = document.getElementById('soldCategoriesContainer');
            if (categoriesContainer) {
                categoriesContainer.style.display = 'grid';
            }
            return;
        }

        // Split search term into keywords (multiple words)
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);

        // Search through all items in all periods
        const matchingItems = [];
        const period = this.getCurrentPeriod();
        
        if (period && period.categories) {
            period.categories.forEach(category => {
                if (category.subcategories) {
                    category.subcategories.forEach(subcategory => {
                        if (subcategory.items) {
                            const normalizedItems = this.normalizeSubcategoryItems(subcategory.items);
                            normalizedItems.forEach(item => {
                                const itemLabel = (item.label || '').toLowerCase();
                                
                                // Check if ALL keywords are found in the item label
                                if (keywords.every(keyword => itemLabel.includes(keyword))) {
                                    matchingItems.push({
                                        item: item,
                                        category: category,
                                        subcategory: subcategory,
                                        period: period
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        this.renderSoldSearchResults(originalSearchTerm, matchingItems);
    }

    renderSoldSearchResults(searchTerm, matchingItems) {
        if (!this.soldSearchResults) return;

        // Hide categories container
        const categoriesContainer = document.getElementById('soldCategoriesContainer');
        if (categoriesContainer) {
            categoriesContainer.style.display = 'none';
        }

        if (matchingItems.length === 0) {
            this.soldSearchResults.innerHTML = `
                <div class="search-results">
                    <h3>No items found for "${searchTerm}"</h3>
                </div>
            `;
            this.soldSearchResults.style.display = 'block';
            return;
        }

        const currency = this.currencyConfig || SOLD_TRENDS_CURRENCY_MAP[SOLD_TRENDS_DEFAULT_CURRENCY];
        
        let html = `
            <div class="search-results">
                <h3>Search Results for "${searchTerm}" (${matchingItems.length} items found)</h3>
                <div class="items-list">
        `;

        matchingItems.forEach(({ item, category, subcategory, period }) => {
            const itemLabel = item.label || 'Unnamed Item';
            const itemPrice = item.price || 0;
            const formattedPrice = new Intl.NumberFormat(currency.locale, {
                style: 'currency',
                currency: currency.code
            }).format(itemPrice);
            
            html += `
                <div class="item item-clickable sold-search-result" 
                     data-category-id="${category.id}" 
                     data-subcategory-id="${subcategory.id}"
                     data-item-id="${item.id}"
                     data-period-id="${period.id}">
                    <div class="item-info">
                        <div class="item-name">${this.highlightSearchTerm(itemLabel, searchTerm)}</div>
                        <div class="item-date">Period: ${period.name || 'Default'} | Category: ${category.name || 'Unknown'} | Subcategory: ${subcategory.name || 'Unknown'} | Price: ${formattedPrice}</div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        this.soldSearchResults.innerHTML = html;
        this.soldSearchResults.style.display = 'block';

        // Add click handlers to navigate to item location
        this.soldSearchResults.querySelectorAll('.sold-search-result').forEach(result => {
            result.addEventListener('click', () => {
                this.navigateToSoldItem(
                    result.dataset.periodId,
                    result.dataset.categoryId,
                    result.dataset.subcategoryId,
                    result.dataset.itemId
                );
            });
        });
    }

    navigateToSoldItem(periodId, categoryId, subcategoryId, itemId) {
        // Switch to the correct period if needed
        if (periodId && this.currentPeriodId !== periodId) {
            this.setCurrentPeriod(periodId);
            // Wait for period to switch and categories to render
            setTimeout(() => {
                this.openSubcategoryItemsModalForItem(categoryId, subcategoryId, itemId);
            }, 200);
        } else {
            this.openSubcategoryItemsModalForItem(categoryId, subcategoryId, itemId);
        }
    }

    openSubcategoryItemsModalForItem(categoryId, subcategoryId, itemId) {
        const period = this.getCurrentPeriod();
        if (!period) return;

        // Find the category
        const category = period.categories.find(cat => cat.id === categoryId);
        if (!category) {
            // If category not found, open category modal first
            this.openCategoryModal(category);
            return;
        }

        // Find the subcategory
        const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
        if (!subcategory) return;

        // Open the category modal to show subcategories
        this.openCategoryModal(category);

        // Wait for modal to open and find the subcategory row
        setTimeout(() => {
            const subcategoryRows = this.subcategoryEditorEl.querySelectorAll('.subcategory-editor-row');
            let targetSubcategoryRow = null;

            subcategoryRows.forEach(row => {
                if (row.dataset.subcategoryId === subcategoryId) {
                    targetSubcategoryRow = row;
                }
            });

            if (targetSubcategoryRow) {
                // Click the manage button to open items modal
                const manageBtn = targetSubcategoryRow.querySelector('.subcategory-manage-btn');
                if (manageBtn) {
                    manageBtn.click();
                    
                    // After modal opens, scroll to and highlight the item
                    setTimeout(() => {
                        const itemRow = this.subcategoryItemsList.querySelector(`[data-item-id="${itemId}"]`);
                        if (itemRow) {
                            itemRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            itemRow.style.backgroundColor = '#fff3cd';
                            itemRow.style.transition = 'background-color 0.3s';
                            
                            // Remove highlight after 3 seconds
                            setTimeout(() => {
                                itemRow.style.backgroundColor = '';
                            }, 3000);
                        }
                    }, 300);
                }
            }
        }, 100);
    }

    highlightSearchTerm(text, searchTerm) {
        // Split search term into keywords and highlight each one
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);
        let highlightedText = text;
        
        // Escape special regex characters and highlight each keyword
        keywords.forEach(keyword => {
            const escapedKeyword = this.escapeRegex(keyword);
            const regex = new RegExp(`(${escapedKeyword})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
        });
        
        return highlightedText;
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    loadCurrencyConfig() {
        const settings = this.loadGlobalSettings();
        return this.resolveCurrencyConfig(settings.soldCurrency);
    }

    resolveCurrencyConfig(code) {
        const key = code && Object.prototype.hasOwnProperty.call(SOLD_TRENDS_CURRENCY_MAP, code)
            ? code
            : SOLD_TRENDS_DEFAULT_CURRENCY;
        return SOLD_TRENDS_CURRENCY_MAP[key];
    }

    loadGlobalSettings() {
        try {
            const raw = localStorage.getItem(LISTING_LIFE_SETTINGS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.warn('Unable to parse ListingLife settings; using defaults.', error);
            return {};
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.soldTrendsApp = new SoldItemsTrends();
});

