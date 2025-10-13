// Ebay ListingLife JavaScript
class EbayListingLife {
    constructor() {
        console.log('EbayListingLife constructor called');
        this.categories = [];
        this.items = [];
        this.currentEditingCategory = null;
        this.currentEditingItem = null;
        this.currentView = 'categories'; // 'categories' or 'items'
        this.selectedCategoryId = null;
        this.currentDetailItem = null;
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderCategories();
        this.updateCategorySelect();
        this.updateUrgentItems();
        
        // Test if JavaScript is working
        console.log('EbayListingLife initialized successfully');
        
        // Add a simple test click handler
        setTimeout(() => {
            const testItems = document.querySelectorAll('.item-clickable');
            console.log('Found', testItems.length, 'clickable items');
            testItems.forEach((item, index) => {
                console.log(`Item ${index}:`, item);
            });
        }, 1000);
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.searchItems());
        document.getElementById('searchBar').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchItems();
        });

        // Navigation
        document.getElementById('backToCategories').addEventListener('click', () => this.showCategoriesView());

        // Modal buttons
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.openCategoryModal());
        document.getElementById('addItemBtn').addEventListener('click', () => this.openItemModal());

        // Modal forms
        document.getElementById('categoryForm').addEventListener('submit', (e) => this.handleCategorySubmit(e));
        document.getElementById('itemForm').addEventListener('submit', (e) => this.handleItemSubmit(e));
        document.getElementById('itemDetailForm').addEventListener('submit', (e) => this.handleItemDetailSubmit(e));
        
        // Picture URL preview
        document.getElementById('itemDetailPicture').addEventListener('input', (e) => this.previewPicture(e.target.value));

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeModals());
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
        
        // Add event delegation for item clicks
        document.addEventListener('click', (e) => {
            const itemElement = e.target.closest('.item-clickable');
            if (itemElement && !e.target.closest('.item-actions')) {
                const itemId = itemElement.getAttribute('data-item-id');
                if (itemId) {
                    console.log('Item clicked via delegation:', itemId);
                    this.openItemDetailModal(itemId);
                }
            }
        });
    }

    // Category Management
    openCategoryModal(category = null) {
        this.currentEditingCategory = category;
        const modal = document.getElementById('categoryModal');
        const title = document.getElementById('categoryModalTitle');
        const form = document.getElementById('categoryForm');
        
        if (category) {
            title.textContent = 'Edit Category';
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryDuration').value = category.duration;
        } else {
            title.textContent = 'Add New Category';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    handleCategorySubmit(e) {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        const duration = parseInt(document.getElementById('categoryDuration').value);

        if (!name || !duration) return;

        if (this.currentEditingCategory) {
            // Edit existing category
            this.currentEditingCategory.name = name;
            this.currentEditingCategory.duration = duration;
        } else {
            // Add new category
            const category = {
                id: Date.now().toString(),
                name: name,
                duration: duration,
                createdAt: new Date().toISOString()
            };
            this.categories.push(category);
        }

        this.saveData();
        this.renderCategories();
        this.updateCategorySelect();
        this.closeModals();
    }

    deleteCategory(categoryId) {
        if (confirm('Are you sure you want to delete this category? All items in this category will also be deleted.')) {
            this.categories = this.categories.filter(cat => cat.id !== categoryId);
            this.items = this.items.filter(item => item.categoryId !== categoryId);
            this.saveData();
            this.renderCategories();
            this.updateCategorySelect();
            this.updateUrgentItems();
        }
    }

    // Item Management
    openItemModal(item = null) {
        this.currentEditingItem = item;
        const modal = document.getElementById('itemModal');
        const title = document.getElementById('itemModalTitle');
        const form = document.getElementById('itemForm');
        
        if (item) {
            title.textContent = 'Edit Item';
            document.getElementById('itemCategory').value = item.categoryId;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemRemovalDate').value = item.removalDate;
        } else {
            title.textContent = 'Add New Item';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    handleItemSubmit(e) {
        e.preventDefault();
        const categoryId = document.getElementById('itemCategory').value;
        const name = document.getElementById('itemName').value.trim();
        const removalDate = document.getElementById('itemRemovalDate').value;

        if (!categoryId || !name || !removalDate) return;

        if (this.currentEditingItem) {
            // Edit existing item
            this.currentEditingItem.categoryId = categoryId;
            this.currentEditingItem.name = name;
            this.currentEditingItem.removalDate = removalDate;
        } else {
            // Add new item
            const item = {
                id: Date.now().toString(),
                categoryId: categoryId,
                name: name,
                removalDate: removalDate,
                createdAt: new Date().toISOString()
            };
            this.items.push(item);
        }

        this.saveData();
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            this.showCategoryItems(this.selectedCategoryId);
        }
        
        this.closeModals();
    }

    deleteItem(itemId) {
        if (confirm('Are you sure you want to delete this item?')) {
            this.items = this.items.filter(item => item.id !== itemId);
            this.saveData();
            this.renderCategories();
            this.updateUrgentItems();
            
            // If we're viewing items for a category, refresh that view
            if (this.currentView === 'items' && this.selectedCategoryId) {
                this.showCategoryItems(this.selectedCategoryId);
            }
        }
    }

    // Navigation
    showCategoriesView() {
        this.currentView = 'categories';
        this.selectedCategoryId = null;
        document.getElementById('categoriesContainer').style.display = 'block';
        document.getElementById('categoryItemsContainer').style.display = 'none';
        this.renderCategories();
    }

    showCategoryItems(categoryId) {
        this.currentView = 'items';
        this.selectedCategoryId = categoryId;
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('categoryItemsContainer').style.display = 'block';
        
        const category = this.categories.find(cat => cat.id === categoryId);
        const categoryItems = this.items.filter(item => item.categoryId === categoryId);
        
        // Update header
        document.getElementById('currentCategoryTitle').textContent = category.name;
        
        // Calculate average duration for this category
        const avgDuration = categoryItems.length > 0 ? 
            Math.round(categoryItems.reduce((sum, item) => sum + this.calculateDaysRemaining(item.removalDate), 0) / categoryItems.length) : 
            category.duration;
        
        document.getElementById('categoryDurationInfo').textContent = `Average: ${avgDuration} days`;
        
        // Render items
        this.renderCategoryItems(categoryItems);
    }

    // Search Functionality
    searchItems() {
        const searchTerm = document.getElementById('searchBar').value.trim().toLowerCase();
        
        if (!searchTerm) {
            this.showCategoriesView();
            return;
        }

        const matchingItems = this.items.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );

        this.renderSearchResults(searchTerm, matchingItems);
    }

    renderSearchResults(searchTerm, matchingItems) {
        const container = document.getElementById('categoriesContainer');
        
        if (matchingItems.length === 0) {
            container.innerHTML = `
                <div class="search-results">
                    <h3>No items found for "${searchTerm}"</h3>
                </div>
            `;
            return;
        }

        let html = `
            <div class="search-results">
                <h3>Search Results for "${searchTerm}" (${matchingItems.length} items found)</h3>
                <div class="items-list">
        `;

        matchingItems.forEach(item => {
            const category = this.categories.find(cat => cat.id === item.categoryId);
            const daysRemaining = this.calculateDaysRemaining(item.removalDate);
            const daysClass = this.getDaysClass(daysRemaining);
            
            html += `
                <div class="item item-clickable" data-item-id="${item.id}">
                    <div class="item-info">
                        <div class="item-name">${this.highlightSearchTerm(item.name, searchTerm)}</div>
                        <div class="item-date">Category: ${category ? category.name : 'Unknown'} | Remove by: ${this.formatDate(item.removalDate)}</div>
                        ${item.notes ? `<div class="item-notes">${item.notes.substring(0, 50)}${item.notes.length > 50 ? '...' : ''}</div>` : ''}
                    </div>
                    <div class="item-actions">
                        <span class="days-remaining ${daysClass}">${daysRemaining} days</span>
                        <button class="btn btn-small btn-secondary" onclick="openItemDetail('${item.id}')">View</button>
                        <button class="btn btn-small btn-primary" onclick="openItemEdit(${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
        document.getElementById('categoryItemsContainer').style.display = 'none';
    }

    highlightSearchTerm(text, searchTerm) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    // Rendering
    renderCategories() {
        const container = document.getElementById('categoriesContainer');
        
        if (this.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No categories yet</h3>
                    <p>Create your first category to start managing your eBay items!</p>
                </div>
            `;
            return;
        }

        let html = '<div class="categories-grid">';
        
        this.categories.forEach(category => {
            const categoryItems = this.items.filter(item => item.categoryId === category.id);
            const itemCount = categoryItems.length;
            
            html += `
                <div class="category-box" onclick="app.showCategoryItems('${category.id}')">
                    <h3>${category.name}</h3>
                    <div class="item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
                    <div class="category-actions">
                        <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); app.openCategoryModal(${JSON.stringify(category).replace(/"/g, '&quot;')})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); app.deleteCategory('${category.id}')">Delete</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    renderCategoryItems(items) {
        const container = document.getElementById('categoryItemsList');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No items in this category yet</h3>
                    <p>Add your first item to this category!</p>
                </div>
            `;
            return;
        }

        let html = '<div class="items-list">';
        
        items.forEach(item => {
            const daysRemaining = this.calculateDaysRemaining(item.removalDate);
            const daysClass = this.getDaysClass(daysRemaining);
            
            html += `
                <div class="item item-clickable" data-item-id="${item.id}">
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-date">Remove by: ${this.formatDate(item.removalDate)}</div>
                        ${item.notes ? `<div class="item-notes">${item.notes.substring(0, 50)}${item.notes.length > 50 ? '...' : ''}</div>` : ''}
                    </div>
                    <div class="item-actions">
                        <span class="days-remaining ${daysClass}">${daysRemaining} days</span>
                        <button class="btn btn-small btn-secondary" onclick="openItemDetail('${item.id}')">View</button>
                        <button class="btn btn-small btn-primary" onclick="openItemEdit(${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    updateCategorySelect() {
        const select = document.getElementById('itemCategory');
        select.innerHTML = '<option value="">Select Category</option>';
        
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    updateUrgentItems() {
        const urgentItems = this.items.filter(item => {
            const daysRemaining = this.calculateDaysRemaining(item.removalDate);
            return daysRemaining <= 7;
        }).sort((a, b) => this.calculateDaysRemaining(a.removalDate) - this.calculateDaysRemaining(b.removalDate));

        const container = document.getElementById('urgentItemsList');
        
        if (urgentItems.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No urgent items</p>';
            return;
        }

        let html = '';
        urgentItems.forEach(item => {
            const category = this.categories.find(cat => cat.id === item.categoryId);
            const daysRemaining = this.calculateDaysRemaining(item.removalDate);
            
            html += `
                <div class="urgent-item" onclick="app.showCategoryItems('${item.categoryId}')">
                    <div class="item-name">${item.name}</div>
                    <div class="item-date">${category ? category.name : 'Unknown'} | ${this.formatDate(item.removalDate)}</div>
                    <span class="days-remaining">${daysRemaining} days left</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Utility Functions
    calculateDaysRemaining(removalDate) {
        const today = new Date();
        const removal = new Date(removalDate);
        const diffTime = removal - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    getDaysClass(days) {
        if (days <= 7) return 'danger';
        if (days <= 30) return 'warning';
        return '';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    closeModals() {
        document.getElementById('categoryModal').style.display = 'none';
        document.getElementById('itemModal').style.display = 'none';
        document.getElementById('itemDetailModal').style.display = 'none';
        this.currentEditingCategory = null;
        this.currentEditingItem = null;
        this.currentDetailItem = null;
    }

    closeItemDetailModal() {
        document.getElementById('itemDetailModal').style.display = 'none';
        this.currentDetailItem = null;
    }

    // Item Detail Management
    openItemDetailModal(itemId) {
        console.log('Opening item detail modal for item ID:', itemId); // Debug log
        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            console.error('Item not found with ID:', itemId);
            return;
        }
        
        this.currentDetailItem = item;
        const modal = document.getElementById('itemDetailModal');
        const category = this.categories.find(cat => cat.id === item.categoryId);
        
        // Populate form fields
        document.getElementById('itemDetailName').value = item.name;
        document.getElementById('itemDetailCategory').value = category ? category.name : 'Unknown';
        document.getElementById('itemDetailRemovalDate').value = this.formatDate(item.removalDate);
        document.getElementById('itemDetailNotes').value = item.notes || '';
        document.getElementById('itemDetailPicture').value = item.picture || '';
        
        // Clear file input
        document.getElementById('itemDetailPictureFile').value = '';
        
        // Show picture preview if exists
        if (item.picture) {
            this.previewPicture(item.picture);
        } else {
            document.getElementById('itemPicturePreview').style.display = 'none';
        }
        
        modal.style.display = 'block';
    }

    handleItemDetailSubmit(e) {
        e.preventDefault();
        if (!this.currentDetailItem) return;

        const notes = document.getElementById('itemDetailNotes').value.trim();
        const picture = document.getElementById('itemDetailPicture').value.trim();

        // Update item with new data
        this.currentDetailItem.notes = notes;
        this.currentDetailItem.picture = picture;

        this.saveData();
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            this.showCategoryItems(this.selectedCategoryId);
        }
        
        this.closeItemDetailModal();
    }

    previewPicture(url) {
        const preview = document.getElementById('itemPicturePreview');
        const img = document.getElementById('previewImage');
        
        if (url && this.isValidUrl(url)) {
            img.src = url;
            img.onload = () => {
                preview.style.display = 'block';
            };
            img.onerror = () => {
                preview.style.display = 'none';
            };
        } else {
            preview.style.display = 'none';
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            // Convert file to data URL for preview and storage
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                document.getElementById('itemDetailPicture').value = dataUrl;
                this.previewPicture(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    }

    // Data Persistence
    saveData() {
        const data = {
            categories: this.categories,
            items: this.items
        };
        localStorage.setItem('EbayListingLife', JSON.stringify(data));
    }

    loadData() {
        // Try to load from new key first, then fall back to old key for backward compatibility
        let savedData = localStorage.getItem('EbayListingLife');
        if (!savedData) {
            savedData = localStorage.getItem('eBayItemManager');
        }
        
        if (savedData) {
            const data = JSON.parse(savedData);
            this.categories = data.categories || [];
            this.items = data.items || [];
            
            // If we loaded from old key, migrate to new key
            if (localStorage.getItem('eBayItemManager') && !localStorage.getItem('EbayListingLife')) {
                this.saveData();
                localStorage.removeItem('eBayItemManager'); // Clean up old key
            }
        } else {
            // Add some sample data for demonstration
            this.addSampleData();
        }
    }

    addSampleData() {
        // Sample categories
        const fragileCategory = {
            id: '1',
            name: 'Fragile Items',
            duration: 30,
            createdAt: new Date().toISOString()
        };
        
        const cameraCategory = {
            id: '2',
            name: 'Cameras and Things',
            duration: 45,
            createdAt: new Date().toISOString()
        };

        this.categories = [fragileCategory, cameraCategory];

        // Sample items
        const today = new Date();
        const fragileItems = [
            {
                id: '1',
                categoryId: '1',
                name: 'Big Glass thing',
                removalDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days (urgent)
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                categoryId: '1',
                name: 'Another glass thing',
                removalDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 25 days
                createdAt: new Date().toISOString()
            }
        ];

        const cameraItems = [
            {
                id: '3',
                categoryId: '2',
                name: 'Camera',
                removalDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days (urgent)
                createdAt: new Date().toISOString()
            },
            {
                id: '4',
                categoryId: '2',
                name: 'Camera 2',
                removalDate: new Date(today.getTime() + 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 50 days
                createdAt: new Date().toISOString()
            }
        ];

        this.items = [...fragileItems, ...cameraItems];
        this.saveData();
    }
}

// Initialize the app
const app = new EbayListingLife();

// Make sure app is available globally
window.app = app;

// Create global functions for onclick handlers
window.openItemDetail = function(itemId) {
    console.log('Global function called with itemId:', itemId);
    app.openItemDetailModal(itemId);
};

window.openItemEdit = function(item) {
    console.log('Global function called with item:', item);
    app.openItemModal(item);
};

window.deleteItem = function(itemId) {
    console.log('Global function called to delete itemId:', itemId);
    app.deleteItem(itemId);
};

console.log('App initialized and available globally:', window.app);