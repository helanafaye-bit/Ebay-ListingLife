class SoldItemsTrends {
    constructor() {
        this.categories = [];
        this.currentEditingCategory = null;
        this.categoryForm = document.getElementById('soldCategoryForm');
        this.subcategoryEditorEl = document.getElementById('soldSubcategoryEditor');
        this.addSubcategoryBtn = document.getElementById('addSoldSubcategoryRow');
        this.deleteCategoryBtn = document.getElementById('deleteSoldCategoryBtn');
        this.categoryModal = document.getElementById('soldCategoryModal');
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderCategories();
    }

    setupEventListeners() {
        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.navTarget;
                if (target === 'home') {
                    window.location.href = 'ebaylistings.html';
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

        document.querySelectorAll('.close').forEach(closeBtn => {
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
            if (!nameInputEl || !countInputEl) return;

            const subName = nameInputEl.value.trim();
            const count = parseInt(countInputEl.value, 10);
            if (!subName) return;

            const existingId = row.dataset.subcategoryId;
            const createdAt = row.dataset.createdAt || timestamp;

            subcategories.push({
                id: existingId || this.generateId('sub'),
                name: subName,
                count: Number.isFinite(count) && count >= 0 ? count : 0,
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

        this.categories = this.categories.filter(cat => cat.id !== categoryId);
        this.saveData();
        this.renderCategories();
        this.closeModal('soldCategoryModal');
    }

    handleResetData() {
        if (!confirm('This will clear all sold trend data. Continue?')) {
            return;
        }
        localStorage.removeItem('SoldItemsTrends');
        this.categories = [];
        this.renderCategories();
        this.closeModal('soldCategoryModal');
    }

    renderCategories() {
        const container = document.getElementById('soldCategoriesContainer');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No sold categories yet</h3>
                    <p>Create a category to start tracking how many items have sold.</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.categories.forEach(category => {
            const totalSold = category.subcategories.reduce((acc, sub) => acc + (sub.count ?? 0), 0);
            const updatedText = category.updatedAt ? this.formatRelativeDate(category.updatedAt) : this.formatRelativeDate(category.createdAt);

            const subcategoriesMarkup = category.subcategories.length
                ? `<ul class="sold-subcategory-list">
                        ${category.subcategories.map(sub => `
                            <li>
                                <span class="sold-subcategory-name">${this.escapeHtml(sub.name)}</span>
                                <span class="sold-subcategory-count">${this.formatNumber(sub.count ?? 0)}</span>
                            </li>
                        `).join('')}
                   </ul>`
                : `<div class="sold-subcategory-empty">No subcategories yet. Use Edit to add the first one.</div>`;

            html += `
                <div class="category-box sold-category-box" data-category-id="${category.id}">
                    <div class="sold-category-header">
                        <h3>${this.escapeHtml(category.name)}</h3>
                        <p class="sold-total-inline">Total sold: <strong>${this.formatNumber(totalSold)}</strong></p>
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
        localStorage.setItem('SoldItemsTrends', JSON.stringify({ categories: this.categories }));
    }

    loadData() {
        const saved = localStorage.getItem('SoldItemsTrends');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.categories = Array.isArray(data.categories) ? data.categories : [];
            } catch (err) {
                console.error('Error parsing sold trends data:', err);
                this.categories = [];
            }
        } else {
            this.categories = [];
        }
    }

    formatNumber(value) {
        return Number(value || 0).toLocaleString();
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

