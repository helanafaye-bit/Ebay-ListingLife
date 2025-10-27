// Ebay ListingLife JavaScript
class EbayListingLife {
    constructor() {
        console.log('EbayListingLife constructor called');
        this.categories = [];
        this.items = [];
        this.currentEditingCategory = null;
        this.currentEditingItem = null;
        this.currentView = 'categories'; // 'categories', 'items', or 'ended'
        this.selectedCategoryId = null;
        this.currentDetailItem = null;
        this.sidebarMode = 'recent'; // 'recent' or 'ending'
        
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
        document.getElementById('backToCategoriesFromEnded').addEventListener('click', () => this.showCategoriesView());

        // Modal buttons
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.openCategoryModal());
        document.getElementById('addItemBtn').addEventListener('click', () => this.openItemModal());
        document.getElementById('itemsEndedBtn').addEventListener('click', () => this.showEndedItemsView());

        // Sidebar toggle buttons
        document.getElementById('recentToggle').addEventListener('click', () => this.setSidebarMode('recent'));
        document.getElementById('endingToggle').addEventListener('click', () => this.setSidebarMode('ending'));

        // Category sort dropdown
        document.getElementById('categorySortSelect').addEventListener('change', (e) => this.handleCategorySort(e));

        // Modal forms
        document.getElementById('categoryForm').addEventListener('submit', (e) => this.handleCategorySubmit(e));
        document.getElementById('itemForm').addEventListener('submit', (e) => this.handleItemSubmit(e));
        document.getElementById('itemDetailForm').addEventListener('submit', (e) => this.handleItemDetailSubmit(e));
        
        // Picture URL preview
        document.getElementById('itemDetailPicture').addEventListener('input', (e) => this.previewPicture(e.target.value));

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                console.log('Close button clicked');
                const modal = e.target.closest('.modal');
                if (modal) {
                    console.log('Closing modal:', modal.id);
                    modal.style.display = 'none';
                }
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                console.log('Clicked outside modal, closing:', e.target.id);
                e.target.style.display = 'none';
            }
        });
        
        // Clear and specific event delegation for buttons
        document.addEventListener('click', (e) => {
            console.log('Click detected on:', e.target);
            
            
            // Handle EDIT button clicks
            if (e.target.matches('.edit-btn')) {
                const button = e.target;
                const itemId = button.getAttribute('data-item-id');
                
                console.log('=== EDIT BUTTON CLICKED ===');
                console.log('Item ID:', itemId);
                
                e.preventDefault();
                e.stopPropagation();
                
                const item = this.items.find(i => i.id === itemId);
                if (item) {
                    this.openItemModal(item);
                } else {
                    console.error('Item not found for editing:', itemId);
                }
                return;
            }
            
            // Handle DELETE button clicks
            if (e.target.matches('.delete-btn')) {
                const button = e.target;
                const itemId = button.getAttribute('data-item-id');
                
                console.log('=== DELETE BUTTON CLICKED ===');
                console.log('Item ID:', itemId);
                
                e.preventDefault();
                e.stopPropagation();
                
                this.deleteItem(itemId);
                return;
            }
            
            // Handle END button clicks
            if (e.target.matches('.end-btn')) {
                const button = e.target;
                const itemId = button.getAttribute('data-item-id');
                
                console.log('=== END BUTTON CLICKED ===');
                console.log('Item ID:', itemId);
                
                e.preventDefault();
                e.stopPropagation();
                
                this.endItem(itemId);
                return;
            }
            
            // Handle clicks on the item itself (not on buttons)
            const itemElement = e.target.closest('.item-clickable');
            if (itemElement && !e.target.closest('.item-actions')) {
                const itemId = itemElement.getAttribute('data-item-id');
                if (itemId) {
                    console.log('Item clicked (not button) for item:', itemId);
                    this.openViewModal(itemId);
                }
            }
        });
    }

    // Category Management
    openCategoryModal(category = null) {
        // Close all other modals first
        this.closeAllModalsExcept('categoryModal');
        
        this.currentEditingCategory = category;
        const modal = document.getElementById('categoryModal');
        const title = document.getElementById('categoryModalTitle');
        const form = document.getElementById('categoryForm');
        
        if (category) {
            title.textContent = 'Edit Category';
            document.getElementById('categoryName').value = category.name;
        } else {
            title.textContent = 'Add New Category';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    handleCategorySubmit(e) {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();

        if (!name) return;

        if (this.currentEditingCategory) {
            // Edit existing category
            this.currentEditingCategory.name = name;
        } else {
            // Add new category
            const category = {
                id: Date.now().toString(),
                name: name,
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
        // Close all other modals first
        this.closeAllModalsExcept('itemModal');
        
        this.currentEditingItem = item;
        const modal = document.getElementById('itemModal');
        const title = document.getElementById('itemModalTitle');
        const form = document.getElementById('itemForm');
        
        if (item) {
            title.textContent = 'Edit Item';
            document.getElementById('itemCategory').value = item.categoryId;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemDescription').value = item.description || '';
            document.getElementById('itemNote').value = item.note || '';
            document.getElementById('itemDateAdded').value = item.dateAdded || '';
            document.getElementById('itemDuration').value = item.duration || '';
            document.getElementById('itemPhoto').value = item.photo || '';
            
            // Show photo preview if exists
            if (item.photo) {
                this.previewPictureNew(item.photo);
            } else {
                document.getElementById('itemPhotoPreview').style.display = 'none';
            }
        } else {
            title.textContent = 'Add New Item';
            form.reset();
            document.getElementById('itemPhotoPreview').style.display = 'none';
            // Set default date to today
            document.getElementById('itemDateAdded').value = new Date().toISOString().split('T')[0];
        }
        
        modal.style.display = 'block';
    }

    handleItemSubmit(e) {
        e.preventDefault();
        const categoryId = document.getElementById('itemCategory').value;
        const name = document.getElementById('itemName').value.trim();
        const description = document.getElementById('itemDescription').value.trim();
        const note = document.getElementById('itemNote').value.trim();
        const dateAdded = document.getElementById('itemDateAdded').value;
        const duration = parseInt(document.getElementById('itemDuration').value);
        const photo = document.getElementById('itemPhoto').value.trim();

        if (!categoryId || !name || !dateAdded || !duration) return;

        if (this.currentEditingItem) {
            // Edit existing item
            this.currentEditingItem.categoryId = categoryId;
            this.currentEditingItem.name = name;
            this.currentEditingItem.description = description;
            this.currentEditingItem.note = note;
            this.currentEditingItem.dateAdded = dateAdded;
            this.currentEditingItem.duration = duration;
            this.currentEditingItem.photo = photo;
            
            // If editing an ended item with new duration, clear the manually ended flag
            if (this.currentEditingItem.manuallyEnded && duration > 0) {
                this.currentEditingItem.manuallyEnded = false;
                delete this.currentEditingItem.endedDate;
            }
        } else {
            // Add new item
            const item = {
                id: Date.now().toString(),
                categoryId: categoryId,
                name: name,
                description: description,
                note: note,
                dateAdded: dateAdded,
                duration: duration,
                photo: photo,
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
        
        // If we're viewing ended items, refresh that view
        if (this.currentView === 'ended') {
            this.renderEndedItems();
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
            
            // If we're viewing ended items, refresh that view
            if (this.currentView === 'ended') {
                this.renderEndedItems();
            }
        }
    }

    endItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            console.error('Item not found for ending:', itemId);
            return;
        }

        const itemName = item.name;
        const category = this.categories.find(cat => cat.id === item.categoryId);
        const categoryName = category ? category.name : 'Unknown';
        
        if (confirm(`Are you sure you want to end the item "${itemName}" from category "${categoryName}"?\n\nThis will move the item to the "Items Ended" list.`)) {
            // Mark the item as manually ended
            item.manuallyEnded = true;
            item.endedDate = new Date().toISOString().split('T')[0];
            
            this.saveData();
            this.renderCategories();
            this.updateUrgentItems();
            
            // If we're viewing items for a category, refresh that view
            if (this.currentView === 'items' && this.selectedCategoryId) {
                this.showCategoryItems(this.selectedCategoryId);
            }
            
            // If we're viewing ended items, refresh that view
            if (this.currentView === 'ended') {
                this.renderEndedItems();
            }
            
            console.log(`Item "${itemName}" has been ended`);
        }
    }

    // Navigation
    showCategoriesView() {
        this.currentView = 'categories';
        this.selectedCategoryId = null;
        document.getElementById('categoriesContainer').style.display = 'block';
        document.getElementById('categoryItemsContainer').style.display = 'none';
        document.getElementById('endedItemsContainer').style.display = 'none';
        this.renderCategories();
    }

    showEndedItemsView() {
        this.currentView = 'ended';
        this.selectedCategoryId = null;
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('categoryItemsContainer').style.display = 'none';
        document.getElementById('endedItemsContainer').style.display = 'block';
        this.renderEndedItems();
    }

    showCategoryItems(categoryId) {
        this.currentView = 'items';
        this.selectedCategoryId = categoryId;
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('categoryItemsContainer').style.display = 'block';
        document.getElementById('endedItemsContainer').style.display = 'none';
        
        const category = this.categories.find(cat => cat.id === categoryId);
        const categoryItems = this.items.filter(item => item.categoryId === categoryId);
        
        // Update header
        document.getElementById('currentCategoryTitle').textContent = category.name;
        
        // Reset sort dropdown to newest first
        document.getElementById('categorySortSelect').value = 'newest';
        
        // Calculate average duration for this category
        const avgDuration = categoryItems.length > 0 ? 
            Math.round(categoryItems.reduce((sum, item) => sum + (item.duration || 30), 0) / categoryItems.length) : 
            30;
        
        document.getElementById('categoryDurationInfo').textContent = `Average: ${avgDuration} days`;
        
        // Render items
        this.renderCategoryItems(categoryItems);
    }

    handleCategorySort(e) {
        const sortOrder = e.target.value;
        const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId);
        
        // Sort items based on selection
        if (sortOrder === 'newest') {
            categoryItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        } else if (sortOrder === 'oldest') {
            categoryItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
        } else if (sortOrder === 'lowest-days') {
            categoryItems.sort((a, b) => {
                const aDaysLeft = this.calculateDaysLeft(a);
                const bDaysLeft = this.calculateDaysLeft(b);
                return aDaysLeft - bDaysLeft;
            });
        } else if (sortOrder === 'highest-days') {
            categoryItems.sort((a, b) => {
                const aDaysLeft = this.calculateDaysLeft(a);
                const bDaysLeft = this.calculateDaysLeft(b);
                return bDaysLeft - aDaysLeft;
            });
        }
        
        // Re-render items
        this.renderCategoryItems(categoryItems);
    }

    calculateDaysLeft(item) {
        // If item was manually ended, return 0
        if (item.manuallyEnded) {
            return 0;
        }
        
        const duration = item.duration || 30;
        const addedDate = new Date(item.dateAdded);
        const endDate = new Date(addedDate.getTime() + (duration * 24 * 60 * 60 * 1000));
        return Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
    }

    // Search Functionality
    searchItems() {
        const searchTerm = document.getElementById('searchBar').value.trim().toLowerCase();
        
        if (!searchTerm) {
            this.showCategoriesView();
            return;
        }

        const matchingItems = this.items.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.note && item.note.toLowerCase().includes(searchTerm))
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
            
            html += `
                <div class="item item-clickable" data-item-id="${item.id}">
                    <div class="item-info">
                        <div class="item-name">${this.highlightSearchTerm(item.name, searchTerm)}</div>
                        <div class="item-date">Category: ${category ? category.name : 'Unknown'} | Added: ${item.dateAdded ? this.formatDate(item.dateAdded) : 'Unknown'}</div>
                        ${item.note ? `<div class="item-notes">${item.note.substring(0, 50)}${item.note.length > 50 ? '...' : ''}</div>` : ''}
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-small btn-primary edit-btn" data-item-id="${item.id}">Edit</button>
                        <button class="btn btn-small btn-warning end-btn" data-item-id="${item.id}">End</button>
                        <button class="btn btn-small btn-danger delete-btn" data-item-id="${item.id}">Delete</button>
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
            const photoHtml = item.photo ? 
                `<div class="item-photo"><img src="${item.photo}" alt="${item.name}" onerror="this.style.display='none'"></div>` : 
                `<div class="item-photo no-photo"><span>📷</span></div>`;
            
            // Calculate days left
            const daysLeft = this.calculateDaysLeft(item);
            const urgencyClass = this.getUrgencyClass(daysLeft);
            const daysText = daysLeft <= 0 ? 'Ended' : `${daysLeft} days left`;
            
            html += `
                <div class="item item-clickable" data-item-id="${item.id}">
                    ${photoHtml}
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-date">Added: ${item.dateAdded ? this.formatDate(item.dateAdded) : 'Unknown'}</div>
                        ${item.note ? `<div class="item-notes">${item.note.substring(0, 50)}${item.note.length > 50 ? '...' : ''}</div>` : ''}
                        <div class="item-days-left ${urgencyClass}">${daysText}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-small btn-primary edit-btn" data-item-id="${item.id}">Edit</button>
                        <button class="btn btn-small btn-warning end-btn" data-item-id="${item.id}">End</button>
                        <button class="btn btn-small btn-danger delete-btn" data-item-id="${item.id}">Delete</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    renderEndedItems() {
        const container = document.getElementById('endedItemsList');
        
        // Filter items that have 0 or negative days left
        const endedItems = this.items.filter(item => {
            const daysLeft = this.calculateDaysLeft(item);
            return daysLeft <= 0;
        });

        if (endedItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No ended items</h3>
                    <p>All your items are still active!</p>
                </div>
            `;
            return;
        }

        let html = '<div class="items-list">';
        
        endedItems.forEach(item => {
            const category = this.categories.find(cat => cat.id === item.categoryId);
            const photoHtml = item.photo ? 
                `<div class="item-photo"><img src="${item.photo}" alt="${item.name}" onerror="this.style.display='none'"></div>` : 
                `<div class="item-photo no-photo"><span>📷</span></div>`;
            
            // Calculate days left (should be 0 or negative)
            const daysLeft = this.calculateDaysLeft(item);
            const daysText = item.manuallyEnded ? 'Manually Ended' : (daysLeft <= 0 ? 'Ended' : `${daysLeft} days left`);
            
            html += `
                <div class="item item-clickable" data-item-id="${item.id}">
                    ${photoHtml}
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-date">Category: ${category ? category.name : 'Unknown'} | Added: ${item.dateAdded ? this.formatDate(item.dateAdded) : 'Unknown'}</div>
                        ${item.note ? `<div class="item-notes">${item.note.substring(0, 50)}${item.note.length > 50 ? '...' : ''}</div>` : ''}
                        <div class="item-days-left ended">${daysText}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-small btn-primary edit-btn" data-item-id="${item.id}">Edit</button>
                        <button class="btn btn-small btn-danger delete-btn" data-item-id="${item.id}">Delete</button>
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

    setSidebarMode(mode) {
        this.sidebarMode = mode;
        
        // Update button states
        document.getElementById('recentToggle').classList.toggle('active', mode === 'recent');
        document.getElementById('endingToggle').classList.toggle('active', mode === 'ending');
        
        // Update title
        const title = document.getElementById('sidebarTitle');
        title.textContent = mode === 'recent' ? 'Recently Added Items' : 'Items Ending Soonest';
        
        // Update the sidebar content
        this.updateUrgentItems();
    }

    updateUrgentItems() {
        const container = document.getElementById('urgentItemsList');
        
        if (this.sidebarMode === 'recent') {
            this.updateRecentItems(container);
        } else {
            this.updateEndingSoonItems(container);
        }
    }

    updateRecentItems(container) {
        // Show items added in the last 7 days
        const recentItems = this.items
            .filter(item => {
                if (!item.dateAdded) return false;
                const addedDate = new Date(item.dateAdded);
                const daysSinceAdded = Math.floor((new Date() - addedDate) / (1000 * 60 * 60 * 24));
                return daysSinceAdded <= 7; // Items added in the last 7 days
            })
            .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

        if (recentItems.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No recent items</p>';
            return;
        }

        let html = '';
        recentItems.forEach(item => {
            const category = this.categories.find(cat => cat.id === item.categoryId);
            const daysSinceAdded = Math.floor((new Date() - new Date(item.dateAdded)) / (1000 * 60 * 60 * 24));
            
            html += `
                <div class="urgent-item" onclick="app.showCategoryItems('${item.categoryId}')">
                    <div class="item-name">${item.name}</div>
                    <div class="item-date">${category ? category.name : 'Unknown'} | ${this.formatDate(item.dateAdded)}</div>
                    <span class="days-remaining">${daysSinceAdded} days ago</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateEndingSoonItems(container) {
        // Calculate ending dates based on item-specific duration
        const itemsWithEndDates = this.items.map(item => {
            const category = this.categories.find(cat => cat.id === item.categoryId);
            const duration = item.duration || 30; // Use item duration, default 30 days if not set
            const addedDate = new Date(item.dateAdded);
            const endDate = new Date(addedDate.getTime() + (duration * 24 * 60 * 60 * 1000));
            const daysUntilEnd = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            
            return {
                ...item,
                endDate: endDate,
                daysUntilEnd: daysUntilEnd,
                category: category
            };
        });

        // Filter items that are ending within 14 days and sort by days until end
        const endingSoonItems = itemsWithEndDates
            .filter(item => item.daysUntilEnd <= 14)
            .sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);

        if (endingSoonItems.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No items ending soon</p>';
            return;
        }

        let html = '';
        endingSoonItems.forEach(item => {
            const urgencyClass = this.getUrgencyClass(item.daysUntilEnd);
            const daysText = item.daysUntilEnd <= 0 ? 'Ended' : `${item.daysUntilEnd} days left`;
            
            html += `
                <div class="urgent-item ending-soon ${urgencyClass}" onclick="app.showCategoryItems('${item.categoryId}')">
                    <div class="item-name">${item.name}</div>
                    <div class="item-date">${item.category ? item.category.name : 'Unknown'} | ${this.formatDate(item.dateAdded)}</div>
                    <span class="days-remaining ${urgencyClass}">${daysText}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    getUrgencyClass(daysLeft) {
        if (daysLeft <= 0) return 'ended';
        if (daysLeft <= 3) return 'danger';
        if (daysLeft <= 7) return 'warning';
        return 'normal';
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
        document.getElementById('viewModal').style.display = 'none';
        this.currentEditingCategory = null;
        this.currentEditingItem = null;
        this.currentDetailItem = null;
    }

    closeAllModalsExcept(excludeModalId) {
        const allModals = ['categoryModal', 'itemModal', 'itemDetailModal', 'viewModal'];
        allModals.forEach(modalId => {
            if (modalId !== excludeModalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        });
    }

    // Simple View Modal Management
    openViewModal(itemId) {
        console.log('=== OPENING VIEW MODAL ===');
        console.log('Item ID:', itemId);
        console.log('Available items:', this.items);
        
        // First, close all other modals to prevent conflicts
        this.closeAllModalsExcept('viewModal');
        
        const item = this.items.find(i => i.id === itemId);
        console.log('Found item:', item);
        
        if (!item) {
            console.error('Item not found with ID:', itemId);
            alert('Item not found!');
            return;
        }
        
        const category = this.categories.find(cat => cat.id === item.categoryId);
        console.log('Found category:', category);
        
        const modal = document.getElementById('viewModal');
        console.log('Modal element:', modal);
        
        if (!modal) {
            console.error('View modal not found in DOM');
            alert('View modal not found!');
            return;
        }
        
        // Populate the view modal
        console.log('Populating modal fields...');
        document.getElementById('viewName').textContent = item.name;
        document.getElementById('viewCategory').textContent = category ? category.name : 'Unknown';
        document.getElementById('viewDescription').textContent = item.description || '';
        document.getElementById('viewNote').textContent = item.note || '';
        document.getElementById('viewDateAdded').textContent = item.dateAdded ? this.formatDate(item.dateAdded) : 'Unknown';
        
        // Handle photo display
        const viewImage = document.getElementById('viewImage');
        const viewNoPhoto = document.getElementById('viewNoPhoto');
        
        console.log('Item photo:', item.photo);
        
        if (item.photo && item.photo.trim()) {
            console.log('Setting up photo display');
            viewImage.src = item.photo;
            viewImage.style.display = 'block';
            viewNoPhoto.style.display = 'none';
            
            // Handle image load errors
            viewImage.onerror = () => {
                console.log('Image failed to load, showing placeholder');
                viewImage.style.display = 'none';
                viewNoPhoto.style.display = 'block';
            };
        } else {
            console.log('No photo available, showing placeholder');
            viewImage.style.display = 'none';
            viewNoPhoto.style.display = 'block';
        }
        
        // Show the modal
        console.log('Showing modal...');
        modal.style.display = 'block';
        
        console.log('=== VIEW MODAL SHOULD NOW BE VISIBLE ===');
    }
    
    closeViewModal() {
        console.log('=== CLOSING VIEW MODAL ===');
        const modal = document.getElementById('viewModal');
        if (modal) {
            console.log('Closing view modal');
            modal.style.display = 'none';
        } else {
            console.error('View modal not found');
        }
    }

    // Item Detail Management
    openItemDetailModal(itemId) {
        console.log('openItemDetailModal called with itemId:', itemId);
        console.log('Available items:', this.items);
        
        // Close all other modals first
        this.closeAllModalsExcept('itemDetailModal');
        
        const item = this.items.find(i => i.id === itemId);
        console.log('Found item:', item);
        
        if (!item) {
            console.error('Item not found with ID:', itemId);
            alert('Item not found! Please try again.');
            return;
        }
        
        this.currentDetailItem = item;
        const modal = document.getElementById('itemDetailModal');
        console.log('Modal element:', modal);
        
        if (!modal) {
            console.error('Modal element not found');
            return;
        }
        
        const category = this.categories.find(cat => cat.id === item.categoryId);
        
        // Populate form fields
        document.getElementById('itemDetailName').value = item.name;
        document.getElementById('itemDetailCategory').value = category ? category.name : 'Unknown';
        document.getElementById('itemDetailDescription').value = item.description || '';
        document.getElementById('itemDetailNote').value = item.note || '';
        document.getElementById('itemDetailDateAdded').value = item.dateAdded ? this.formatDate(item.dateAdded) : '';
        document.getElementById('itemDetailPicture').value = item.photo || '';
        
        // Clear file input
        document.getElementById('itemDetailPictureFile').value = '';
        
        // Show picture preview if exists
        if (item.photo) {
            this.previewPicture(item.photo);
        } else {
            document.getElementById('itemPicturePreview').style.display = 'none';
        }
        
        modal.style.display = 'block';
        console.log('Modal should now be visible');
    }

    handleItemDetailSubmit(e) {
        e.preventDefault();
        if (!this.currentDetailItem) return;

        const note = document.getElementById('itemDetailNote').value.trim();
        const picture = document.getElementById('itemDetailPicture').value.trim();

        // Update item with new data
        this.currentDetailItem.note = note;
        this.currentDetailItem.photo = picture;

        this.saveData();
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            this.showCategoryItems(this.selectedCategoryId);
        }
        
        // If we're viewing ended items, refresh that view
        if (this.currentView === 'ended') {
            this.renderEndedItems();
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

    previewPictureNew(url) {
        const preview = document.getElementById('itemPhotoPreview');
        const img = document.getElementById('previewImageNew');
        
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

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            // Convert file to data URL for preview and storage
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                // Check which modal we're in based on the file input ID
                if (event.target.id === 'itemPhotoFile') {
                    document.getElementById('itemPhoto').value = dataUrl;
                    this.previewPictureNew(dataUrl);
                } else {
                    document.getElementById('itemDetailPicture').value = dataUrl;
                    this.previewPicture(dataUrl);
                }
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
            createdAt: new Date().toISOString()
        };
        
        const cameraCategory = {
            id: '2',
            name: 'Cameras and Things',
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
                description: 'A large decorative glass vase with intricate patterns',
                note: 'Handle with care - very fragile',
                dateAdded: new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 25 days ago
                duration: 30, // Will end in 5 days
                photo: '',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                categoryId: '1',
                name: 'Another glass thing',
                description: 'Small glass figurine, perfect for collectors',
                note: 'Minor chip on the base',
                dateAdded: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
                duration: 14, // Will end in 9 days
                photo: '',
                createdAt: new Date().toISOString()
            }
        ];

        const cameraItems = [
            {
                id: '3',
                categoryId: '2',
                name: 'Camera',
                description: 'Professional DSLR camera with lens kit',
                note: 'Excellent condition, barely used',
                dateAdded: new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 40 days ago
                duration: 45, // Will end in 5 days
                photo: '',
                createdAt: new Date().toISOString()
            },
            {
                id: '4',
                categoryId: '2',
                name: 'Camera 2',
                description: 'Compact digital camera for everyday use',
                note: 'Includes memory card and case',
                dateAdded: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
                duration: 30, // Will end in 23 days
                photo: '',
                createdAt: new Date().toISOString()
            },
            {
                id: '5',
                categoryId: '2',
                name: 'Vintage Lens',
                description: 'Rare vintage camera lens from the 1970s',
                note: 'Perfect condition, no scratches',
                dateAdded: new Date(today.getTime() - 42 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 42 days ago
                duration: 45, // Will end in 3 days
                photo: '',
                createdAt: new Date().toISOString()
            },
            {
                id: '6',
                categoryId: '2',
                name: 'Old Camera',
                description: 'Vintage film camera from the 1980s',
                note: 'Needs new battery',
                dateAdded: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
                duration: 30, // Ended today (0 days left)
                photo: '',
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
window.closeViewModal = function() {
    console.log('Global closeViewModal called');
    if (window.app && window.app.closeViewModal) {
        window.app.closeViewModal();
    } else {
        console.error('App or closeViewModal method not found');
    }
};

console.log('App initialized and available globally:', window.app);