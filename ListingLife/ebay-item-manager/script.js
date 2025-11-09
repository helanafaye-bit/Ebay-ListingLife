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
        this.lastSuggestedEndDate = null;
        this.endDateManuallyModified = false;
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderCategories();
        this.updateCategorySelect();
        this.updateUrgentItems();
        this.handleInitialView();
        
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
        this.addListenerById('searchBtn', 'click', () => this.searchItems());
        this.addListenerById('searchBar', 'keypress', (e) => {
            if (e.key === 'Enter') this.searchItems();
        });

        // Navigation buttons in the sidebar menu
        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.navTarget;
                if (target === 'home') {
                    sessionStorage.removeItem('listingLifeSkipHome');
                    window.location.href = 'index.html';
                    return;
                } else if (target === 'listinglife') {
                    sessionStorage.setItem('listingLifeSkipHome', 'true');
                    this.showCategoriesView();
                } else if (target === 'ended') {
                    this.showEndedItemsView();
                } else if (target === 'sold') {
                    window.location.href = 'sold-items-trends.html';
                    return;
                }
                this.updateActiveNav(target);
            });
        });

        // In-page navigation
        this.addListenerById('backToCategories', 'click', () => {
            this.showCategoriesView();
        });
        this.addListenerById('backToCategoriesFromEnded', 'click', () => {
            this.showCategoriesView();
        });

        // Modal buttons
        this.addListenerById('addCategoryBtn', 'click', () => this.openCategoryModal());
        this.addListenerById('addItemBtn', 'click', () => this.openItemModal());
        this.addListenerById('floatingAddItemBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openItemModal();
        });

        // Optional button for ended items (only if present)
        this.addListenerById('itemsEndedBtn', 'click', () => {
            this.showEndedItemsView();
            this.updateActiveNav('ended');
        });

        // Sidebar toggle buttons
        this.addListenerById('recentToggle', 'click', () => this.setSidebarMode('recent'));
        this.addListenerById('endingToggle', 'click', () => this.setSidebarMode('ending'));

        // Category sort dropdown
        this.addListenerById('categorySortSelect', 'change', (e) => this.handleCategorySort(e));

        // Modal forms
        this.addListenerById('categoryForm', 'submit', (e) => this.handleCategorySubmit(e));
        this.addListenerById('itemForm', 'submit', (e) => this.handleItemSubmit(e));
        this.addListenerById('itemDetailForm', 'submit', (e) => this.handleItemDetailSubmit(e));
        this.addListenerById('categoryAverageForm', 'submit', (e) => this.handleAverageFormSubmit(e));
        this.addListenerById('itemCategory', 'change', () => this.handleItemTimingChange());
        this.addListenerById('itemDateAdded', 'change', () => this.handleItemTimingChange());
        const endDateInput = this.addListenerById('itemEndDate', 'change', () => this.handleEndDateInput());
        if (endDateInput) {
            endDateInput.addEventListener('input', () => this.handleEndDateInput());
        }
        this.addListenerById('categoryDurationInfo', 'click', () => this.handleAverageDurationEdit());

        document.querySelectorAll('[data-close-modal]:not(.close)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.getAttribute('data-close-modal');
                this.closeModalById(modalId);
            });
        });

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

    updateActiveNav(target) {
        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
            const isActive = btn.dataset.navTarget === target;
            btn.classList.toggle('menu-btn-active', isActive);
        });
    }

    handleInitialView() {
        const params = new URLSearchParams(window.location.search);
        const requestedView = params.get('view');
        const skipHome = params.has('skipHome') || sessionStorage.getItem('listingLifeSkipHome') === 'true';

        if (!skipHome) {
            window.location.replace('index.html');
            return;
        }

        if (requestedView === 'ended') {
            this.showEndedItemsView();
        } else {
            this.showCategoriesView();
        }
    }

    addListenerById(id, eventName, handler) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id "${id}" not found. Skipping ${eventName} binding.`);
            return null;
        }
        element.addEventListener(eventName, handler);
        return element;
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
            document.getElementById('categoryDescription').value = category.description || '';
            document.getElementById('categoryAverageDays').value = category.averageDays || '';
        } else {
            title.textContent = 'Add New Category';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    handleCategorySubmit(e) {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        const description = document.getElementById('categoryDescription').value.trim();
        const averageDays = parseInt(document.getElementById('categoryAverageDays').value);

        if (!name) {
            alert('Please enter a category name.');
            return;
        }
        
        if (!averageDays || averageDays < 1) {
            alert('Please enter a valid average days (minimum 1 day).');
            return;
        }

        if (this.currentEditingCategory) {
            // Edit existing category (ensure we update the stored instance)
            const idx = this.categories.findIndex(cat => cat.id === this.currentEditingCategory.id);
            if (idx !== -1) {
                this.categories[idx].name = name;
                this.categories[idx].description = description;
                this.categories[idx].averageDays = averageDays;
            }
        } else {
            // Add new category
            const category = {
                id: Date.now().toString(),
                name: name,
                description: description,
                averageDays: averageDays,
                createdAt: new Date().toISOString()
            };
            this.categories.push(category);
        }

        try {
            this.saveData();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Error saving category: ' + error.message);
            return;
        }
        
        this.renderCategories();
        this.updateCategorySelect();
        this.closeModals();
    }

    handleItemTimingChange() {
        this.updateEndDateSuggestion({
            applyIfUnmodified: !this.currentEditingItem
        });
    }

    handleEndDateInput() {
        const endDateInput = document.getElementById('itemEndDate');
        if (!endDateInput) return;

        if (!this.lastSuggestedEndDate) {
            endDateInput.classList.remove('suggestion-active');
            this.endDateManuallyModified = Boolean(endDateInput.value);
            return;
        }

        if (endDateInput.value === this.lastSuggestedEndDate) {
            endDateInput.classList.add('suggestion-active');
            this.endDateManuallyModified = false;
        } else {
            endDateInput.classList.remove('suggestion-active');
            this.endDateManuallyModified = true;
        }
    }

    updateEndDateSuggestion({ forceApply = false, applyIfUnmodified = false } = {}) {
        const categorySelect = document.getElementById('itemCategory');
        const dateAddedInput = document.getElementById('itemDateAdded');
        const endDateInput = document.getElementById('itemEndDate');
        const suggestionEl = document.getElementById('endDateSuggestion');

        if (!categorySelect || !dateAddedInput || !endDateInput || !suggestionEl) {
            return;
        }

        const categoryId = categorySelect.value;
        let dateAdded = dateAddedInput.value;

        if (!categoryId) {
            this.resetEndDateSuggestion();
            return;
        }

        if (!dateAdded) {
            const today = new Date();
            dateAdded = today.toISOString().split('T')[0];
            dateAddedInput.value = dateAdded;
        }

        const category = this.categories.find(cat => cat.id === categoryId);
        const averageDays = category ? parseInt(category.averageDays, 10) : NaN;

        if (!category || !Number.isFinite(averageDays) || averageDays <= 0) {
            this.resetEndDateSuggestion();
            return;
        }

        const suggestedDate = this.calculateSuggestedEndDate(dateAdded, averageDays);
        if (!suggestedDate) {
            this.resetEndDateSuggestion();
            return;
        }

        this.lastSuggestedEndDate = suggestedDate;
        suggestionEl.classList.add('visible');
        suggestionEl.innerHTML = `
            Suggested end date: <strong>${this.formatDate(suggestedDate)}</strong>
            <br><span style="font-weight: 500;">Based on the ${averageDays}-day average for this category.</span>
        `;

        if (forceApply || (applyIfUnmodified && !this.endDateManuallyModified)) {
            endDateInput.value = suggestedDate;
            this.endDateManuallyModified = false;
        }

        this.handleEndDateInput();
    }

    calculateSuggestedEndDate(dateString, daysToAdd) {
        if (!dateString || !Number.isFinite(daysToAdd)) return null;
        const [yearStr, monthStr, dayStr] = dateString.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);
        if ([year, month, day].some(val => !Number.isFinite(val))) return null;

        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + daysToAdd);

        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    }

    resetEndDateSuggestion() {
        const suggestionEl = document.getElementById('endDateSuggestion');
        const endDateInput = document.getElementById('itemEndDate');

        if (suggestionEl) {
            suggestionEl.classList.remove('visible');
            suggestionEl.textContent = '';
        }
        if (endDateInput) {
            endDateInput.classList.remove('suggestion-active');
        }

        this.lastSuggestedEndDate = null;
        this.endDateManuallyModified = false;
    }

    handleAverageDurationEdit() {
        if (this.currentView !== 'items' || !this.selectedCategoryId) {
            return;
        }

        const category = this.categories.find(cat => cat.id === this.selectedCategoryId);
        if (!category) {
            alert('Unable to find the selected category.');
            return;
        }

        this.openAverageModal(category);
    }

    openAverageModal(category) {
        const modal = document.getElementById('categoryAverageModal');
        const input = document.getElementById('categoryAverageInput');
        const idInput = document.getElementById('categoryAverageId');
        if (!modal || !input || !idInput) return;

        idInput.value = category.id;
        input.value = category.averageDays || 30;
        modal.style.display = 'block';
    }

    closeModalById(modalId) {
        if (!modalId) return;
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            if (modalId === 'itemModal') {
                this.resetEndDateSuggestion();
                this.currentEditingItem = null;
                this.endDateManuallyModified = false;
            }
        }
    }

    handleAverageFormSubmit(e) {
        e.preventDefault();
        const idInput = document.getElementById('categoryAverageId');
        const valueInput = document.getElementById('categoryAverageInput');
        const modal = document.getElementById('categoryAverageModal');

        if (!idInput || !valueInput) return;

        const categoryId = idInput.value;
        const newAverage = parseInt(valueInput.value, 10);
        if (!categoryId || !Number.isFinite(newAverage) || newAverage < 1) {
            alert('Please enter a valid number of days (minimum 1).');
            return;
        }

        const category = this.categories.find(cat => cat.id === categoryId);
        if (!category) {
            alert('Unable to find the selected category.');
            return;
        }

        category.averageDays = newAverage;
        try {
            this.saveData();
        } catch (error) {
            console.error('Error saving updated average days:', error);
            alert('Unable to save the new average. Please try again.');
            return;
        }

        if (modal) {
            modal.style.display = 'none';
        }

        if (this.currentView === 'items' && this.selectedCategoryId === categoryId) {
            document.getElementById('categoryAverageValue').textContent = newAverage;
            this.updateEndDateSuggestion({ applyIfUnmodified: true });
        }

        this.renderCategories();
        this.updateUrgentItems();
    }

    deleteCategory(categoryId) {
        if (confirm('Are you sure you want to delete this category? All items in this category will also be deleted.')) {
            this.categories = this.categories.filter(cat => cat.id !== categoryId);
            this.items = this.items.filter(item => item.categoryId !== categoryId);
            try {
                this.saveData();
            } catch (error) {
                console.error('Error saving after category deletion:', error);
                alert('Error saving changes: ' + error.message);
                return;
            }
            this.renderCategories();
            this.updateCategorySelect();
            this.updateUrgentItems();
        }
    }

    // Item Management
    openItemModal(item = null) {
        // Close all other modals first
        this.closeAllModalsExcept('itemModal');
        this.resetEndDateSuggestion();
        
        this.currentEditingItem = item;
        this.endDateManuallyModified = false;
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
            // Compute end date from dateAdded + duration
            if (item.dateAdded && item.duration) {
                const addedDate = new Date(item.dateAdded);
                const endDate = new Date(addedDate.getTime() + (item.duration * 24 * 60 * 60 * 1000));
                document.getElementById('itemEndDate').value = endDate.toISOString().split('T')[0];
            } else {
                document.getElementById('itemEndDate').value = '';
            }
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
            
            // If we're currently viewing a category, pre-select that category
            if (this.currentView === 'items' && this.selectedCategoryId) {
                document.getElementById('itemCategory').value = this.selectedCategoryId;
            }
            
            // Set default date to today
            const todayYmd = new Date().toISOString().split('T')[0];
            document.getElementById('itemDateAdded').value = todayYmd;
            // Default end date to 30 days from date added
            const defaultEnd = new Date(new Date(todayYmd).getTime() + (30 * 24 * 60 * 60 * 1000));
            document.getElementById('itemEndDate').value = defaultEnd.toISOString().split('T')[0];
        }
        
        this.updateEndDateSuggestion({ forceApply: !item, applyIfUnmodified: !item });
        this.handleItemTimingChange();
        modal.style.display = 'block';
    }

    handleItemSubmit(e) {
        e.preventDefault();
        const categoryId = document.getElementById('itemCategory').value;
        const name = document.getElementById('itemName').value.trim();
        const description = document.getElementById('itemDescription').value.trim();
        const note = document.getElementById('itemNote').value.trim();
        const dateAdded = document.getElementById('itemDateAdded').value;
        const endDateStr = document.getElementById('itemEndDate').value;
        const photo = document.getElementById('itemPhoto').value.trim();

        // Validate required fields with user feedback
        if (!categoryId) {
            alert('Please select a category.');
            return;
        }
        if (!name) {
            alert('Please enter an item name.');
            return;
        }
        if (!dateAdded) {
            alert('Please select a date added.');
            return;
        }
        if (!endDateStr) {
            alert('Please select an end date.');
            return;
        }
        
        // Compute duration as days between dateAdded and endDate (ceil), minimum 1
        const start = new Date(dateAdded);
        const end = new Date(endDateStr);
        const diffMs = end - start;
        if (isNaN(diffMs) || diffMs < 0) {
            alert('End date must be the same as or after the date added.');
            return;
        }
        let duration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        duration = Math.max(duration, 1);
        

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
                
                // Show a message that the item has been restored to its category
                setTimeout(() => {
                    alert(`Item "${this.currentEditingItem.name}" has been restored to its category with ${duration} days duration.`);
                }, 100);
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

        // Save data with error handling
        try {
            this.saveData();
        } catch (error) {
            console.error('Error saving data:', error);
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                alert('Storage quota exceeded! The app cannot save more data. Try removing some items with photos or use smaller photos (URLs instead of file uploads).');
                return;
            } else {
                alert('Error saving item: ' + error.message);
                return;
            }
        }
        
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            // Re-apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !item.manuallyEnded);
            let sortedItems = [...categoryItems];
            
            if (sortOrder === 'newest') {
                sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            } else if (sortOrder === 'oldest') {
                sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            } else if (sortOrder === 'lowest-days') {
                sortedItems.sort((a, b) => {
                    const aDaysLeft = this.calculateDaysLeft(a);
                    const bDaysLeft = this.calculateDaysLeft(b);
                    return aDaysLeft - bDaysLeft;
                });
            } else if (sortOrder === 'highest-days') {
                sortedItems.sort((a, b) => {
                    const aDaysLeft = this.calculateDaysLeft(a);
                    const bDaysLeft = this.calculateDaysLeft(b);
                    return bDaysLeft - aDaysLeft;
                });
            }
            
            this.renderCategoryItems(sortedItems);
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
            try {
                this.saveData();
            } catch (error) {
                console.error('Error saving after item deletion:', error);
                alert('Error saving changes: ' + error.message);
                return;
            }
            this.renderCategories();
            this.updateUrgentItems();
            
            // If we're viewing items for a category, refresh that view
            if (this.currentView === 'items' && this.selectedCategoryId) {
                // Re-apply current sort order
                const sortOrder = document.getElementById('categorySortSelect').value;
                const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !item.manuallyEnded);
                let sortedItems = [...categoryItems];
                
                if (sortOrder === 'newest') {
                    sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                } else if (sortOrder === 'oldest') {
                    sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
                } else if (sortOrder === 'lowest-days') {
                    sortedItems.sort((a, b) => {
                        const aDaysLeft = this.calculateDaysLeft(a);
                        const bDaysLeft = this.calculateDaysLeft(b);
                        return aDaysLeft - bDaysLeft;
                    });
                } else if (sortOrder === 'highest-days') {
                    sortedItems.sort((a, b) => {
                        const aDaysLeft = this.calculateDaysLeft(a);
                        const bDaysLeft = this.calculateDaysLeft(b);
                        return bDaysLeft - aDaysLeft;
                    });
                }
                
                this.renderCategoryItems(sortedItems);
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
            
            try {
                this.saveData();
            } catch (error) {
                console.error('Error saving after ending item:', error);
                alert('Error saving changes: ' + error.message);
                return;
            }
            
            this.renderCategories();
            this.updateUrgentItems();
            
            // If we're viewing items for a category, refresh that view
            if (this.currentView === 'items' && this.selectedCategoryId) {
                // Re-apply current sort order
                const sortOrder = document.getElementById('categorySortSelect').value;
                const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !item.manuallyEnded);
                let sortedItems = [...categoryItems];
                
                if (sortOrder === 'newest') {
                    sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                } else if (sortOrder === 'oldest') {
                    sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
                } else if (sortOrder === 'lowest-days') {
                    sortedItems.sort((a, b) => {
                        const aDaysLeft = this.calculateDaysLeft(a);
                        const bDaysLeft = this.calculateDaysLeft(b);
                        return aDaysLeft - bDaysLeft;
                    });
                } else if (sortOrder === 'highest-days') {
                    sortedItems.sort((a, b) => {
                        const aDaysLeft = this.calculateDaysLeft(a);
                        const bDaysLeft = this.calculateDaysLeft(b);
                        return bDaysLeft - aDaysLeft;
                    });
                }
                
                this.renderCategoryItems(sortedItems);
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
        this.toggleFloatingAddButton(false);
        this.updateActiveNav('listinglife');
        this.renderCategories();
    }

    showEndedItemsView() {
        this.currentView = 'ended';
        this.selectedCategoryId = null;
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('categoryItemsContainer').style.display = 'none';
        document.getElementById('endedItemsContainer').style.display = 'block';
        this.toggleFloatingAddButton(false);
        this.updateActiveNav('ended');
        this.renderEndedItems();
    }

    showCategoryItems(categoryId) {
        this.currentView = 'items';
        this.selectedCategoryId = categoryId;
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('categoryItemsContainer').style.display = 'block';
        document.getElementById('endedItemsContainer').style.display = 'none';
        this.toggleFloatingAddButton(true);
        this.updateActiveNav('listinglife');
        
        const category = this.categories.find(cat => cat.id === categoryId);
        const categoryItems = this.items.filter(item => item.categoryId === categoryId && !item.manuallyEnded);
        
        // Update header
        document.getElementById('currentCategoryTitle').textContent = category.name;
        
        // Reset sort dropdown to newest first
        document.getElementById('categorySortSelect').value = 'newest';
        
        // Get average days from category (required field, should always exist)
        const avgDuration = category.averageDays || 30;
        
        // Display the average
        document.getElementById('categoryAverageValue').textContent = avgDuration;
        const durationInfoEl = document.getElementById('categoryDurationInfo');
        if (durationInfoEl) {
            durationInfoEl.setAttribute('title', 'Click to edit this category\'s average days');
            durationInfoEl.style.cursor = 'pointer';
        }
        
        // Show all items (not filtered by average days) - just sort them
        const sortOrder = 'newest';
        let sortedItems = [...categoryItems];
        
        if (sortOrder === 'newest') {
            sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        } else if (sortOrder === 'oldest') {
            sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
        } else if (sortOrder === 'lowest-days') {
            sortedItems.sort((a, b) => {
                const aDaysLeft = this.calculateDaysLeft(a);
                const bDaysLeft = this.calculateDaysLeft(b);
                return aDaysLeft - bDaysLeft;
            });
        } else if (sortOrder === 'highest-days') {
            sortedItems.sort((a, b) => {
                const aDaysLeft = this.calculateDaysLeft(a);
                const bDaysLeft = this.calculateDaysLeft(b);
                return bDaysLeft - aDaysLeft;
            });
        }
        
        this.renderCategoryItems(sortedItems);
    }

    toggleFloatingAddButton(show) {
        const floatingBtn = document.getElementById('floatingAddItemBtn');
        if (!floatingBtn) return;
        floatingBtn.classList.toggle('visible', Boolean(show));
    }

    handleCategorySort(e) {
        const sortOrder = e.target.value;
        const category = this.categories.find(cat => cat.id === this.selectedCategoryId);
        const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !item.manuallyEnded);
        
        // Show all items (not filtered by average days) - just sort them
        let itemsToSort = [...categoryItems];
        
        // Sort items based on selection
        if (sortOrder === 'newest') {
            itemsToSort.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        } else if (sortOrder === 'oldest') {
            itemsToSort.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
        } else if (sortOrder === 'lowest-days') {
            itemsToSort.sort((a, b) => {
                const aDaysLeft = this.calculateDaysLeft(a);
                const bDaysLeft = this.calculateDaysLeft(b);
                return aDaysLeft - bDaysLeft;
            });
        } else if (sortOrder === 'highest-days') {
            itemsToSort.sort((a, b) => {
                const aDaysLeft = this.calculateDaysLeft(a);
                const bDaysLeft = this.calculateDaysLeft(b);
                return bDaysLeft - aDaysLeft;
            });
        }
        
        // Re-render all items
        this.renderCategoryItems(itemsToSort);
    }
    
    filterCategoryItemsByAverage(averageDays) {
        if (!this.selectedCategoryId) return;
        
        const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !item.manuallyEnded);
        
        // Filter items that have approximately the same days remaining as the average
        // Allow a tolerance of ±2 days for flexibility
        const filteredItems = categoryItems.filter(item => {
            const daysLeft = this.calculateDaysLeft(item);
            return daysLeft >= 0 && Math.abs(daysLeft - averageDays) <= 2;
        });
        
        // If no items match exactly, show all items
        if (filteredItems.length === 0) {
            this.renderCategoryItems(categoryItems);
        } else {
            // Apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            let sortedItems = [...filteredItems];
            
            if (sortOrder === 'newest') {
                sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            } else if (sortOrder === 'oldest') {
                sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            } else if (sortOrder === 'lowest-days') {
                sortedItems.sort((a, b) => {
                    const aDaysLeft = this.calculateDaysLeft(a);
                    const bDaysLeft = this.calculateDaysLeft(b);
                    return aDaysLeft - bDaysLeft;
                });
            } else if (sortOrder === 'highest-days') {
                sortedItems.sort((a, b) => {
                    const aDaysLeft = this.calculateDaysLeft(a);
                    const bDaysLeft = this.calculateDaysLeft(b);
                    return bDaysLeft - aDaysLeft;
                });
            }
            
            this.renderCategoryItems(sortedItems);
        }
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
            !item.manuallyEnded && (
                item.name.toLowerCase().includes(searchTerm) ||
                (item.description && item.description.toLowerCase().includes(searchTerm)) ||
                (item.note && item.note.toLowerCase().includes(searchTerm))
            )
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
            // Only count items that are not manually ended
            const categoryItems = this.items.filter(item => item.categoryId === category.id && !item.manuallyEnded);
            const itemCount = categoryItems.length;
            
            html += `
                <div class="category-box" onclick="app.showCategoryItems('${category.id}')">
                    <h3>${category.name}</h3>
                    <div class="item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
                    ${category.description ? `<div class="item-description">${category.description}</div>` : ''}
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
        
        // Filter out manually ended items from category view
        const activeItems = items.filter(item => !item.manuallyEnded);
        
        if (activeItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No active items in this category yet</h3>
                    <p>Add your first item to this category!</p>
                </div>
            `;
            return;
        }

        let html = '<div class="items-list">';
        
        activeItems.forEach(item => {
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
        
        // Sort categories A–Z by name (case-insensitive)
        const sorted = [...this.categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        sorted.forEach(category => {
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
        const averageModal = document.getElementById('categoryAverageModal');
        if (averageModal) {
            averageModal.style.display = 'none';
        }
        document.getElementById('itemDetailModal').style.display = 'none';
        document.getElementById('viewModal').style.display = 'none';
        this.currentEditingCategory = null;
        this.currentEditingItem = null;
        this.currentDetailItem = null;
        this.resetEndDateSuggestion();
    }

    closeAllModalsExcept(excludeModalId) {
        const allModals = ['categoryModal', 'itemModal', 'categoryAverageModal', 'itemDetailModal', 'viewModal'];
        allModals.forEach(modalId => {
            if (modalId !== excludeModalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'none';
                    if (modalId === 'itemModal') {
                        this.resetEndDateSuggestion();
                        this.currentEditingItem = null;
                        this.endDateManuallyModified = false;
                    }
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

        try {
            this.saveData();
        } catch (error) {
            console.error('Error saving item details:', error);
            alert('Error saving changes: ' + error.message);
            return;
        }
        
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            // Re-apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !item.manuallyEnded);
            let sortedItems = [...categoryItems];
            
            if (sortOrder === 'newest') {
                sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            } else if (sortOrder === 'oldest') {
                sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            } else if (sortOrder === 'lowest-days') {
                sortedItems.sort((a, b) => {
                    const aDaysLeft = this.calculateDaysLeft(a);
                    const bDaysLeft = this.calculateDaysLeft(b);
                    return aDaysLeft - bDaysLeft;
                });
            } else if (sortOrder === 'highest-days') {
                sortedItems.sort((a, b) => {
                    const aDaysLeft = this.calculateDaysLeft(a);
                    const bDaysLeft = this.calculateDaysLeft(b);
                    return bDaysLeft - aDaysLeft;
                });
            }
            
            this.renderCategoryItems(sortedItems);
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
        
        if (url && url.trim()) {
            // Check if it's a valid URL format or data URL
            if (this.isValidUrl(url) || url.startsWith('data:image')) {
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
        } else {
            preview.style.display = 'none';
        }
    }

    isValidUrl(string) {
        try {
            // Try to create a URL object - works for http, https, and other protocols
            new URL(string);
            return true;
        } catch (_) {
            // Also accept relative URLs that start with / or just image file names
            if (string.startsWith('/') || string.startsWith('./') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(string)) {
                return true;
            }
            return false;
        }
    }

    previewPictureNew(url) {
        const preview = document.getElementById('itemPhotoPreview');
        const img = document.getElementById('previewImageNew');
        
        if (url && url.trim()) {
            // Check if it's a valid URL format or data URL
            if (this.isValidUrl(url) || url.startsWith('data:image')) {
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
        } else {
            preview.style.display = 'none';
        }
    }


    // Data Persistence
    saveData() {
        const data = {
            categories: this.categories,
            items: this.items
        };
        
        try {
            const jsonString = JSON.stringify(data);
            const dataSizeKB = (jsonString.length * 2) / 1024; // Approximate size in KB (UTF-16)
            
            // Attempt to save - browser will throw QuotaExceededError if limit reached
            localStorage.setItem('EbayListingLife', jsonString);
            console.log(`Data saved successfully. Size: ${Math.round(dataSizeKB)}KB`);
        } catch (error) {
            console.error('Error in saveData:', error);
            // Re-throw with helpful message for quota errors
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                const currentSizeKB = this.getLocalStorageSize();
                throw new Error(`Storage quota exceeded! Current storage: ~${Math.round(currentSizeKB)}KB. Try removing items with large photos or use photo URLs instead of file uploads.`);
            }
            throw error; // Re-throw other errors
        }
    }
    
    getLocalStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return (total * 2) / 1024; // Convert to KB (UTF-16 encoding)
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
            description: 'Delicate items that need careful handling',
            averageDays: 30,
            createdAt: new Date().toISOString()
        };
        
        const cameraCategory = {
            id: '2',
            name: 'Cameras and Things',
            description: 'Cameras, lenses, and related accessories',
            averageDays: 45,
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