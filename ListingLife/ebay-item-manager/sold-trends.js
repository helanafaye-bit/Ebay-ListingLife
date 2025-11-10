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
        this.init();
    }

    init() {
        this.setupNotificationSystem();
        this.loadData();
        this.setupEventListeners();
        this.updatePeriodSelect();
        this.renderDataPeriod();
        this.renderCategories();
        this.updateRemovePeriodButtonState();
    }

    setupEventListeners() {
        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.navTarget;
                if (target === 'home') {
                    sessionStorage.removeItem('listingLifeSkipHome');
                    window.location.href = 'index.html';
                } else if (target === 'listinglife') {
                    sessionStorage.setItem('listingLifeSkipHome', 'true');
                    window.location.href = 'ebaylistings.html?skipHome=1';
                } else if (target === 'ended') {
                    sessionStorage.setItem('listingLifeSkipHome', 'true');
                    window.location.href = 'ebaylistings.html?view=ended&skipHome=1';
                } else if (target === 'sold') {
                    window.location.href = 'sold-items-trends.html';
                } else if (target === 'settings') {
                    window.location.href = 'settings.html';
                }
            });
        });

        const addCategoryBtn = document.getElementById('addSoldCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.openCategoryModal());
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
                }
            });
        }

        if (this.saveSubcategoryItemsBtn) {
            this.saveSubcategoryItemsBtn.addEventListener('click', () => this.handleSubcategoryItemsSave());
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

        this.clearSubcategoryItemsEditor();

        items.forEach(item => this.addSubcategoryItemEditorRow(item));
        if (!items.length) {
            this.addSubcategoryItemEditorRow();
        }

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

        row.innerHTML = `
            <div class="editor-field">
                <label>Item Label (optional)</label>
                <input type="text" class="subcategory-item-name" placeholder="e.g., Single plate" value="${safeLabel}">
            </div>
            <div class="editor-field">
                <label>Item Price</label>
                <input type="number" class="subcategory-item-price" min="0" step="0.01" placeholder="e.g., 12.50" value="${priceValue}">
            </div>
            <button type="button" class="btn btn-small btn-danger subcategory-item-remove">Remove</button>
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

    handleSubcategoryItemsSave() {
        if (!this.currentSubcategoryRow) {
            this.closeModal('soldSubcategoryItemsModal');
            return;
        }
        const items = this.collectSubcategoryItemsFromEditor();
        if (items === null) {
            return;
        }

        this.updateSubcategoryRowFromItems(this.currentSubcategoryRow, items);
        this.closeModal('soldSubcategoryItemsModal');
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

            items.push({
                id: itemId,
                label,
                price: priceValue,
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
    }

    saveData() {
        localStorage.setItem('SoldItemsTrends', JSON.stringify({
            periods: this.periods,
            currentPeriodId: this.currentPeriodId
        }));
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

    loadData() {
        const saved = localStorage.getItem('SoldItemsTrends');
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
            } catch (err) {
                console.error('Error parsing sold trends data:', err);
                this.periods = [];
                this.currentPeriodId = null;
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
            this.currentPeriodId = this.periods[0].id;
        }

        this.syncCategoriesFromPeriod();
        this.updateRemovePeriodButtonState();
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
            this.saveData();
            return;
        }
        const targetPeriod = this.periods.find(period => period.id === periodId) || this.periods[0];
        this.currentPeriodId = targetPeriod.id;
        this.syncCategoriesFromPeriod();
        this.updatePeriodSelect();
        this.renderDataPeriod();
        this.renderCategories();
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
        const createdAt = item.createdAt || fallbackTimestamp;
        const updatedAt = item.updatedAt || item.createdAt || fallbackTimestamp;

        return {
            id: item.id || this.generateId('solditem'),
            label,
            price,
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

