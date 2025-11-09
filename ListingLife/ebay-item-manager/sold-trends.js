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
        this.periodSelect = document.getElementById('dataPeriodSelect');
        this.addPeriodBtn = document.getElementById('addDataPeriodBtn');
        this.periodModal = document.getElementById('soldPeriodModal');
        this.periodForm = document.getElementById('soldPeriodForm');
        this.periodNameInput = document.getElementById('soldPeriodName');
        this.periodDescriptionInput = document.getElementById('soldPeriodDescription');
        this.dataPeriodDisplay = document.getElementById('dataPeriodDisplay');
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.updatePeriodSelect();
        this.renderDataPeriod();
        this.renderCategories();
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
                        row.remove();
                        if (!this.subcategoryEditorEl.querySelector('.subcategory-editor-row')) {
                            this.addSubcategoryEditorRow();
                        }
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

        if (this.periodForm) {
            this.periodForm.addEventListener('submit', (e) => this.handlePeriodFormSubmit(e));
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
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        if (modalId === 'soldCategoryModal') {
            this.currentEditingCategory = null;
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
        row.innerHTML = `
            <div class="editor-field">
                <label>Subcategory Name</label>
                <input type="text" class="subcategory-name-input" placeholder="e.g., Plates" value="${subcategory.name ? this.escapeHtml(subcategory.name) : ''}">
            </div>
            <div class="editor-field">
                <label>Sold Count</label>
                <input type="number" class="subcategory-count-input" min="0" value="${Number.isFinite(subcategory.count) ? subcategory.count : 0}">
            </div>
            <div class="editor-field">
                <label>Sold Price (optional)</label>
                <input type="number" class="subcategory-price-input" min="0" step="0.01" placeholder="e.g., 19.99" value="${Number.isFinite(subcategory.price) ? subcategory.price : ''}">
            </div>
            <button type="button" class="btn btn-small btn-danger subcategory-remove-btn">Remove</button>
        `;
        this.subcategoryEditorEl.appendChild(row);
    }

    handleCategorySubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('soldCategoryName');
        const descriptionInput = document.getElementById('soldCategoryDescription');
        if (!nameInput || !this.subcategoryEditorEl) return;

        const name = nameInput.value.trim();
        const description = descriptionInput ? descriptionInput.value.trim() : '';

        if (!name) {
            alert('Please enter a category name.');
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
            const price = Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : null;

            subcategories.push({
                id: existingId || this.generateId('sub'),
                name: subName,
                count: Number.isFinite(count) && count >= 0 ? count : 0,
                price,
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

    deleteCategory(categoryId, skipConfirm = false) {
        const category = this.categories.find(cat => cat.id === categoryId);
        if (!category) return;

        if (!skipConfirm && !confirm(`Delete category "${category.name}" and all of its subcategories?`)) {
            return;
        }

        const idx = this.categories.findIndex(cat => cat.id === categoryId);
        if (idx !== -1) {
            this.categories.splice(idx, 1);
        }
        this.touchCurrentPeriod();
        this.saveData();
        this.renderCategories();
        this.closeModal('soldCategoryModal');
    }

    handleResetData() {
        if (!confirm('This will clear all sold trend data. Continue?')) {
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
                const count = sub.count ?? 0;
                acc.totalSold += count;
                if (Number.isFinite(sub.price) && sub.price > 0) {
                    acc.totalMade += count * sub.price;
                    acc.hasPrice = true;
                }
                return acc;
            }, { totalSold: 0, totalMade: 0, hasPrice: false });

            const updatedText = category.updatedAt ? this.formatRelativeDate(category.updatedAt) : this.formatRelativeDate(category.createdAt);

            const subcategoriesMarkup = category.subcategories.length
                ? `<ul class="sold-subcategory-list">
                        ${category.subcategories.map(sub => `
                            <li>
                                <span class="sold-subcategory-name">${this.escapeHtml(sub.name)}</span>
                                <span class="sold-subcategory-count">
                                    ${this.formatNumber(sub.count ?? 0)}
                                    ${Number.isFinite(sub.price) && sub.price > 0 ? ` × ${this.formatCurrency(sub.price)}` : ''}
                                </span>
                            </li>
                        `).join('')}
                   </ul>`
                : `<div class="sold-subcategory-empty">No subcategories yet. Use Edit to add the first one.</div>`;

            html += `
                <div class="category-box sold-category-box" data-category-id="${category.id}">
                    <div class="sold-category-header">
                        <h3>${this.escapeHtml(category.name)}</h3>
                        <p class="sold-total-inline">Total sold: <strong>${this.formatNumber(totals.totalSold)}</strong></p>
                        ${totals.hasPrice ? `<p class="sold-total-inline">Total made: <strong>${this.formatCurrency(totals.totalMade)}</strong></p>` : ''}
                        ${category.description ? `<p class="sold-category-description">${this.escapeHtml(category.description)}</p>` : ''}
                        <p class="sold-card-updated">Updated ${updatedText}</p>
                    </div>
                    ${subcategoriesMarkup}
                    <div class="sold-category-actions">
                        <button class="btn btn-small btn-primary" data-action="edit-category" data-category-id="${category.id}">Edit</button>
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
            alert('Please enter a period name.');
            return;
        }

        const newPeriod = this.createPeriod(name, description, []);
        this.periods.push(newPeriod);
        this.closeModal('soldPeriodModal');
        this.setCurrentPeriod(newPeriod.id);
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

    formatNumber(value) {
        return Number(value || 0).toLocaleString();
    }

    formatCurrency(value) {
        return Number(value || 0).toLocaleString('en-GB', {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.soldTrendsApp = new SoldItemsTrends();
});

