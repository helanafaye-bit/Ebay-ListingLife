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
        this.listingConfirmModal = null;
        this.listingConfirmTitleEl = null;
        this.listingConfirmMessageEl = null;
        this.listingConfirmCancelBtn = null;
        this.listingConfirmProceedBtn = null;
        this.listingConfirmCloseBtn = null;
        this.activeListingConfirmResolver = null;
        this.listingConfirmDefaults = {
            title: 'Confirm Action',
            confirmLabel: 'Proceed',
            cancelLabel: 'Cancel',
            focus: 'confirm',
            variant: 'primary'
        };
        this.currentSoldItem = null;
        this.currentSoldCategory = null;
        this.currentSoldPeriod = null;
        this.notificationEl = null;
        this.notificationMessageEl = null;
        this.notificationCloseBtn = null;
        this.notificationHideTimeout = null;
        
        // Performance optimization: Cache item counts per category
        this._categoryItemCounts = null;
        this._renderCategoriesRequestId = null;
        this._cachedCategoriesHTML = null;
        this._lastCategoriesHash = null;
        
        // Performance optimization: Cache ended items
        this._cachedEndedItemsHTML = null;
        this._lastEndedItemsHash = null;
        this._renderEndedItemsRequestId = null;
        this._categoryLookup = null;
        
        this.init();
    }

    init() {
        this.setupUiHelpers();
        
        // Check if editing an imported item
        const urlParams = new URLSearchParams(window.location.search);
        const editImportedId = urlParams.get('editImported');
        if (editImportedId) {
            const importedItemData = sessionStorage.getItem('editImportedItem');
            if (importedItemData) {
                try {
                    const item = JSON.parse(importedItemData);
                    // Wait for data to load, then open modal
                    setTimeout(() => {
                        this.openItemModal(item);
                        // Clean up session storage
                        sessionStorage.removeItem('editImportedItem');
                        sessionStorage.removeItem('editImportedItemId');
                        // Remove query parameter from URL
                        window.history.replaceState({}, '', './ebaylistings.html');
                    }, 500);
                } catch (e) {
                    console.error('Error parsing imported item data:', e);
                }
            }
        }
        
        // Ensure DOM is ready before setting up event listeners
        const setupListenersWhenReady = () => {
            const navButtons = document.querySelectorAll('.menu-btn[data-nav-target]');
            if (navButtons.length > 0) {
                console.log('DOM ready, setting up event listeners for', navButtons.length, 'nav buttons');
            this.setupEventListeners();
            } else {
                // Retry if buttons aren't found yet
                console.log('Nav buttons not found yet, retrying...');
                setTimeout(setupListenersWhenReady, 50);
            }
        };
        
        // Try immediately, then retry if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupListenersWhenReady);
        } else {
            setupListenersWhenReady();
        }
        
        // Ensure storeManager is available before loading data
        const initializeApp = async () => {
            try {
                await this.loadData();
            } catch (error) {
                console.error('Error loading data:', error);
                // Initialize with empty data if load fails
                this.categories = [];
                this.items = [];
            }
            this.renderCategories();
            this.updateCategorySelect();
            this.updateUrgentItems();
            this.handleInitialView();
            console.log('EbayListingLife initialized successfully');
        };
        
        if (!window.storeManager) {
            // Wait for storeManager to initialize - check multiple times
            let attempts = 0;
            const maxAttempts = 10;
            const checkStoreManager = () => {
                if (window.storeManager) {
                    console.log('storeManager found after', attempts * 50, 'ms');
                    initializeApp();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkStoreManager, 50);
                } else {
                    console.warn('storeManager not found after', maxAttempts * 50, 'ms, proceeding anyway');
                    initializeApp();
                }
            };
            checkStoreManager();
        } else {
            initializeApp();
        }
    }

    setupUiHelpers() {
        this.listingConfirmModal = document.getElementById('listingConfirmModal');
        this.listingConfirmTitleEl = document.getElementById('listingConfirmTitle');
        this.listingConfirmMessageEl = document.getElementById('listingConfirmMessage');
        this.listingConfirmCancelBtn = document.getElementById('listingConfirmCancel');
        this.listingConfirmProceedBtn = document.getElementById('listingConfirmProceed');
        this.listingConfirmCloseBtn = document.getElementById('listingConfirmClose');
        
        // Setup notification system
        this.notificationEl = document.getElementById('appNotification');
        this.notificationMessageEl = document.getElementById('appNotificationMessage');
        this.notificationCloseBtn = document.getElementById('appNotificationClose');
        
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
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.notificationEl && this.notificationEl.classList.contains('visible')) {
                this.hideNotification();
            }
        });

        if (this.listingConfirmCancelBtn) {
            this.listingConfirmCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.resolveListingConfirm(false);
            });
        }

        if (this.listingConfirmCloseBtn) {
            this.listingConfirmCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.resolveListingConfirm(false);
            });
        }

        if (this.listingConfirmProceedBtn) {
            this.listingConfirmProceedBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.resolveListingConfirm(true);
            });
        }

        if (this.listingConfirmModal) {
            this.listingConfirmModal.addEventListener('click', (e) => {
                if (e.target === this.listingConfirmModal) {
                    this.resolveListingConfirm(false);
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeListingConfirmResolver) {
                this.resolveListingConfirm(false);
            }
        });
    }

    showListingConfirm(message, options = {}) {
        if (!this.listingConfirmModal || !this.listingConfirmMessageEl) {
            return Promise.resolve(true);
        }

        if (this.activeListingConfirmResolver) {
            this.resolveListingConfirm(false);
        }

        const settings = {
            ...this.listingConfirmDefaults,
            ...options
        };

        if (this.listingConfirmTitleEl) {
            this.listingConfirmTitleEl.textContent = settings.title || this.listingConfirmDefaults.title;
        }
        this.listingConfirmMessageEl.textContent = message || 'This listing already exists.';

        if (this.listingConfirmCancelBtn) {
            this.listingConfirmCancelBtn.textContent = settings.cancelLabel || this.listingConfirmDefaults.cancelLabel;
        }

        if (this.listingConfirmProceedBtn) {
            this.listingConfirmProceedBtn.textContent = settings.confirmLabel || this.listingConfirmDefaults.confirmLabel;
            this.listingConfirmProceedBtn.classList.remove('btn-primary', 'btn-danger');
            const variantClass = settings.variant === 'danger' ? 'btn-danger' : 'btn-primary';
            this.listingConfirmProceedBtn.classList.add(variantClass);
        }

        this.listingConfirmModal.style.display = 'block';
        this.listingConfirmModal.setAttribute('aria-hidden', 'false');

        const focusTarget = settings.focus === 'cancel' ? this.listingConfirmCancelBtn : this.listingConfirmProceedBtn;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            setTimeout(() => focusTarget.focus(), 0);
        }

        return new Promise((resolve) => {
            this.activeListingConfirmResolver = resolve;
        });
    }

    resolveListingConfirm(result) {
        if (this.listingConfirmModal) {
            this.listingConfirmModal.style.display = 'none';
            this.listingConfirmModal.setAttribute('aria-hidden', 'true');
        }

        const resolver = this.activeListingConfirmResolver;
        this.activeListingConfirmResolver = null;

        if (typeof resolver === 'function') {
            resolver(Boolean(result));
        }
    }

    setupEventListeners() {
        // Search functionality
        this.addListenerById('searchBtn', 'click', () => this.searchItems());
        this.addListenerById('searchBar', 'keypress', (e) => {
            if (e.key === 'Enter') this.searchItems();
        });
        // Real-time search as you type
        this.addListenerById('searchBar', 'input', () => this.searchItems());

        // Navigation buttons in the sidebar menu - use event delegation for reliability
        const navHandler = (e) => {
            const btn = e.target.closest('.menu-btn[data-nav-target]');
            if (!btn) return;
            
                e.preventDefault();
                e.stopPropagation();
                const target = btn.dataset.navTarget;
            console.log('Nav button clicked:', target);
            
                if (target === 'home') {
                    sessionStorage.removeItem('listingLifeSkipHome');
                    window.location.href = './index.html';
                    return;
                } else if (target === 'listinglife') {
                    sessionStorage.setItem('listingLifeSkipHome', 'true');
                if (this.showCategoriesView) {
                    this.showCategoriesView();
                }
                } else if (target === 'ended') {
                if (this.showEndedItemsView) {
                    this.showEndedItemsView();
                }
                } else if (target === 'sold') {
                    window.location.href = './sold-items-trends.html';
                    return;
                } else if (target === 'settings') {
                    window.location.href = './settings.html';
                    return;
                }
            if (this.updateActiveNav) {
                this.updateActiveNav(target);
            }
        };
        
        // Try to attach to buttons directly first
        const navButtons = document.querySelectorAll('.menu-btn[data-nav-target]');
        console.log('Found', navButtons.length, 'navigation buttons');
        navButtons.forEach(btn => {
            btn.addEventListener('click', navHandler);
        });
        
        // Also use event delegation on document as fallback
        document.addEventListener('click', (e) => {
            if (e.target.closest('.menu-btn[data-nav-target]')) {
                navHandler(e);
            }
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
        this.addListenerById('importItemsBtn', 'click', () => {
            window.location.href = './import-items.html';
        });
        this.addListenerById('createCategoryFromItemBtn', 'click', () => this.toggleNewCategoryFromItemInput());
        this.addListenerById('floatingAddItemBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openItemModal();
        });

        // Optional button for ended items (only if present)
        const itemsEndedBtn = document.getElementById('itemsEndedBtn');
        if (itemsEndedBtn) {
            itemsEndedBtn.addEventListener('click', () => {
            this.showEndedItemsView();
            this.updateActiveNav('ended');
        });
        }

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
        this.addListenerById('soldItemForm', 'submit', (e) => this.handleSoldItemSubmit(e));
        this.addListenerById('soldItemCategory', 'change', () => this.handleSoldCategoryChange());
        this.addListenerById('createCategoryBtn', 'click', () => this.toggleNewCategoryInput());
        this.addListenerById('createSubcategoryBtn', 'click', () => this.toggleNewSubcategoryInput());
        this.addListenerById('soldItemSubcategory', 'change', () => this.handleSoldSubcategoryChange());
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
                if (e.target.id === 'listingConfirmModal') {
                    this.resolveListingConfirm(false);
                } else {
                    e.target.style.display = 'none';
                }
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
            
            // Handle SOLD button clicks
            if (e.target.matches('.sold-btn')) {
                const button = e.target;
                const itemId = button.getAttribute('data-item-id');
                
                console.log('=== SOLD BUTTON CLICKED ===');
                console.log('Item ID:', itemId);
                
                e.preventDefault();
                e.stopPropagation();
                
                this.openSoldItemModal(itemId);
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
            
            // Handle checkbox clicks - prevent them from triggering item edit
            if (e.target.matches('.ended-item-checkbox') || e.target.closest('.ended-item-checkbox-container')) {
                e.stopPropagation();
                // Checkbox is just visual, no action needed
                return;
            }
            
            // Handle clicks on the item itself (not on buttons or checkbox)
            // Check if click is on item-clickable or any of its children (including highlighted spans)
            const itemElement = e.target.closest('.item-clickable');
            if (itemElement && !e.target.closest('.item-actions') && !e.target.closest('.ended-item-checkbox-container')) {
                const itemId = itemElement.getAttribute('data-item-id');
                if (itemId) {
                    console.log('Item clicked (not button) for item:', itemId);
                    e.preventDefault();
                    e.stopPropagation();
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
        let requestedView = params.get('view');
        const skipHome = params.has('skipHome') || sessionStorage.getItem('listingLifeSkipHome') === 'true';

        if (!skipHome) {
            window.location.replace('index.html');
            return;
        }

        // Check if we have a preserved view from store switch (and clear it after reading)
        const preservedView = sessionStorage.getItem('listingLifePreserveView');
        if (preservedView && !requestedView) {
            requestedView = preservedView;
            // Clear it after using it
            sessionStorage.removeItem('listingLifePreserveView');
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    async handleCategorySubmit(e) {
        e.preventDefault();
        const nameInput = document.getElementById('categoryName');
        const averageDaysInput = document.getElementById('categoryAverageDays');
        
        if (!nameInput || !averageDaysInput) {
            this.showNotification('Form elements not found.', 'error');
            return;
        }
        
        const name = nameInput.value.trim();
        const description = document.getElementById('categoryDescription').value.trim();
        const averageDaysValue = averageDaysInput.value.trim();
        const averageDays = averageDaysValue ? parseInt(averageDaysValue, 10) : NaN;

        if (!name) {
            this.showNotification('Please enter a category name.', 'warning');
            nameInput.focus();
            return;
        }
        
        if (!averageDaysValue || isNaN(averageDays) || averageDays < 1) {
            this.showNotification('Please enter a valid average days (minimum 1 day).', 'warning');
            averageDaysInput.focus();
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

        // Invalidate cache since data changed
        this._invalidateCategoryCache();

        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving category:', error);
            this.showNotification('Error saving category: ' + error.message, 'error');
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
            this.showNotification('Unable to find the selected category.', 'error');
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

    async handleAverageFormSubmit(e) {
        e.preventDefault();
        const idInput = document.getElementById('categoryAverageId');
        const valueInput = document.getElementById('categoryAverageInput');
        const modal = document.getElementById('categoryAverageModal');

        if (!idInput || !valueInput) return;

        const categoryId = idInput.value;
        const newAverage = parseInt(valueInput.value, 10);
        if (!categoryId || !Number.isFinite(newAverage) || newAverage < 1) {
            this.showNotification('Please enter a valid number of days (minimum 1).', 'warning');
            return;
        }

        const category = this.categories.find(cat => cat.id === categoryId);
        if (!category) {
            this.showNotification('Unable to find the selected category.', 'error');
            return;
        }

        category.averageDays = newAverage;
        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving updated average days:', error);
            this.showNotification('Unable to save the new average. Please try again.', 'error');
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

    async deleteCategory(categoryId) {
        const confirmed = await this.showListingConfirm(
            'Are you sure you want to delete this category? All items in this category will also be deleted.',
            {
                title: 'Delete Category',
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel',
                focus: 'cancel',
                variant: 'danger'
            }
        );

        if (!confirmed) {
            return;
        }

        this.categories = this.categories.filter(cat => cat.id !== categoryId);
        this.items = this.items.filter(item => item.categoryId !== categoryId);
        
        // Invalidate cache since data changed
        this._invalidateCategoryCache();
        
        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving after category deletion:', error);
            this.showNotification('Error saving changes: ' + error.message, 'error');
            return;
        }
        this.renderCategories();
        this.updateCategorySelect();
        this.updateUrgentItems();
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
        
        // Hide new category input when opening modal
        this.hideNewCategoryFromItemInput();
        
        if (item) {
            title.textContent = item.id && item.id.startsWith('imported-') ? 'Edit Imported Item' : 'Edit Item';
            document.getElementById('itemCategory').value = item.categoryId || '';
            document.getElementById('itemName').value = item.name || '';
            document.getElementById('itemDescription').value = item.description || '';
            document.getElementById('itemNote').value = item.note || '';
            document.getElementById('itemDateAdded').value = item.dateAdded || '';
            // Compute end date from dateAdded + duration
            if (item.dateAdded && item.duration) {
                const addedDate = new Date(item.dateAdded);
                const endDate = new Date(addedDate.getTime() + (item.duration * 24 * 60 * 60 * 1000));
                document.getElementById('itemEndDate').value = endDate.toISOString().split('T')[0];
            } else if (item.endDate) {
                document.getElementById('itemEndDate').value = item.endDate;
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

    async handleItemSubmit(e) {
        e.preventDefault();
        let categoryId = document.getElementById('itemCategory').value;
        const name = document.getElementById('itemName').value.trim();
        const description = document.getElementById('itemDescription').value.trim();
        const note = document.getElementById('itemNote').value.trim();
        const dateAdded = document.getElementById('itemDateAdded').value;
        const endDateStr = document.getElementById('itemEndDate').value;
        const photo = document.getElementById('itemPhoto').value.trim();

        // Check if creating a new category
        const newCategoryContainer = document.getElementById('newCategoryFromItemContainer');
        const isCreatingCategory = newCategoryContainer && newCategoryContainer.style.display !== 'none';
        const newCategoryName = document.getElementById('newCategoryFromItemName')?.value.trim();
        const newCategoryDescription = document.getElementById('newCategoryFromItemDescription')?.value.trim();
        const newCategoryAverageDays = parseInt(document.getElementById('newCategoryFromItemAverageDays')?.value) || 30;

        // Validate category - if creating new, the name must be provided
        if (!categoryId && !isCreatingCategory) {
            this.showNotification('Please select or create a category.', 'warning');
            return;
        }

        if (isCreatingCategory && !newCategoryName) {
            this.showNotification('Please enter a category name.', 'warning');
            return;
        }

        // Create new category if needed - do this BEFORE any other validation
        if (isCreatingCategory && newCategoryName) {
            const timestamp = new Date().toISOString();
            const newCategory = {
                id: this.generateId('cat'),
                name: newCategoryName,
                description: newCategoryDescription || '',
                averageDays: newCategoryAverageDays,
                createdAt: timestamp,
                updatedAt: timestamp
            };
            this.categories.push(newCategory);
            categoryId = newCategory.id;
            
            // Save categories first before proceeding
            try {
                await this.saveData();
            } catch (error) {
                console.error('Error saving new category:', error);
                this.showNotification('Error saving new category: ' + error.message, 'error');
                // Remove the category from memory if save failed
                this.categories = this.categories.filter(cat => cat.id !== newCategory.id);
                return;
            }
            
            // Update the category select dropdown - MUST happen before any validation
            this.updateCategorySelect();
            
            // Wait a moment for DOM to update, then set the value
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const categorySelect = document.getElementById('itemCategory');
            if (categorySelect) {
                categorySelect.value = categoryId;
                // Remove required attribute temporarily to avoid validation issues
                categorySelect.removeAttribute('required');
                // Trigger change event to ensure form recognizes the value
                categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Keep form validation disabled for now (we'll validate manually)
            const form = document.getElementById('itemForm');
            if (form) {
                form.setAttribute('novalidate', 'novalidate');
            }
            
            // Hide the new category input
            this.hideNewCategoryFromItemInput();
        }

        // Validate required fields with user feedback (after category is created)
        if (!categoryId) {
            this.showNotification('Please select a category.', 'warning');
            return;
        }
        if (!name) {
            this.showNotification('Please enter an item name.', 'warning');
            return;
        }
        if (!endDateStr) {
            this.showNotification('Please select an end date.', 'warning');
            return;
        }
        
        // If dateAdded is not provided, default to today
        let actualDateAdded = dateAdded;
        if (!actualDateAdded) {
            const today = new Date();
            actualDateAdded = today.toISOString().split('T')[0];
        }
        
        // Compute duration as days between dateAdded and endDate (ceil), minimum 1
        const start = new Date(actualDateAdded);
        const end = new Date(endDateStr);
        const diffMs = end - start;
        if (isNaN(diffMs) || diffMs < 0) {
            this.showNotification('End date must be the same as or after the date added.', 'warning');
            return;
        }
        let duration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        duration = Math.max(duration, 1);
        
        const normalizedName = name.toLowerCase();
        const duplicateItem = this.items.find(item =>
            item.categoryId === categoryId &&
            !this.isItemEnded(item) &&
            item.name &&
            item.name.trim().toLowerCase() === normalizedName &&
            (!this.currentEditingItem || item.id !== this.currentEditingItem.id)
        );

        if (duplicateItem) {
            // Verify the duplicate is actually persisted (not just in memory from a failed save)
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('EbayListingLife') : 'EbayListingLife';
            let isPersisted = false;
            try {
                const savedData = localStorage.getItem(storageKey);
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    isPersisted = parsed.items && parsed.items.some(i => i.id === duplicateItem.id);
                }
            } catch (e) {
                // If we can't check, assume it's persisted to be safe
                isPersisted = true;
            }
            
            // If duplicate exists but isn't persisted, it's likely from a failed save - allow proceeding
            if (!isPersisted) {
                console.warn('Duplicate item found in memory but not persisted - likely from failed save, allowing proceed');
                // Remove the orphaned item
                this.items = this.items.filter(item => item.id !== duplicateItem.id);
            } else {
            const proceed = await this.showListingConfirm('This listing already exists.', {
                title: 'Duplicate Listing',
                confirmLabel: 'Proceed',
                cancelLabel: 'Cancel',
                focus: 'cancel',
                variant: 'primary'
            });

            if (!proceed) {
                return;
                }
            }
        }

        let newItem = null;
        let wasEditing = false;
        
        // Check if this is an imported item being edited
        const isImportedItem = this.currentEditingItem && this.currentEditingItem.id && this.currentEditingItem.id.startsWith('imported-');
        const importedItemId = isImportedItem ? this.currentEditingItem.id : null;

        if (this.currentEditingItem && !isImportedItem) {
            // Edit existing item - store original values for rollback
            wasEditing = true;
            const originalItem = { ...this.currentEditingItem };
            
            this.currentEditingItem.categoryId = categoryId;
            this.currentEditingItem.name = name;
            this.currentEditingItem.description = description;
            this.currentEditingItem.note = note;
            this.currentEditingItem.dateAdded = actualDateAdded;
            this.currentEditingItem.duration = duration;
            this.currentEditingItem.photo = photo;
            
            // If editing an ended item with new duration, clear the manually ended flag
            if (this.currentEditingItem.manuallyEnded && duration > 0) {
                this.currentEditingItem.manuallyEnded = false;
                delete this.currentEditingItem.endedDate;
                
                // Show a message that the item has been restored to its category
                setTimeout(() => {
                    this.showNotification(`Item "${this.currentEditingItem.name}" has been restored to its category with ${duration} days duration.`, 'success');
                }, 100);
            }
            
            // Save data with error handling - rollback on failure
            try {
                await this.saveData();
            } catch (error) {
                console.error('Error saving data:', error);
                // Rollback changes
                Object.assign(this.currentEditingItem, originalItem);
                
                if (error.name === 'QuotaExceededError' || error.code === 22 || error.message?.includes('quota')) {
                    const currentSizeKB = this.getLocalStorageSize();
                    this.showNotification(`Error saving item: Storage quota exceeded! Current storage: ~${Math.round(currentSizeKB)}KB. Try removing items with large photos or use photo URLs instead of file uploads.`, 'error');
        } else {
                    this.showNotification('Error saving item: ' + error.message, 'error');
                }
                return;
            }
        } else {
            // Handle new item or imported item
            if (isImportedItem) {
                // Handle imported item - save to ListingLife and remove from imported items
                newItem = {
                    id: Date.now().toString(),
                    categoryId: categoryId, // Use the categoryId (which may have been just created)
                    name: name,
                    description: description,
                    note: note,
                    dateAdded: actualDateAdded,
                    duration: duration,
                    photo: photo,
                    createdAt: new Date().toISOString()
                };
                
                this.items.push(newItem);
                
                // Invalidate cache since data changed
                this._invalidateCategoryCache();
                
                try {
                    await this.saveData();
                    this.showNotification('Item saved to ListingLife!', 'success');
                    
                    // Remove from imported items list
                    const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('ImportedItems') : 'ImportedItems';
                    const saved = localStorage.getItem(storageKey);
                    if (saved) {
                        try {
                            const importedItems = JSON.parse(saved);
                            const filtered = importedItems.filter(item => item.id !== importedItemId);
                            localStorage.setItem(storageKey, JSON.stringify(filtered));
                        } catch (e) {
                            console.error('Error removing from imported items:', e);
                        }
                    }
                } catch (error) {
                    console.error('Error saving data:', error);
                    this.items = this.items.filter(item => item.id !== newItem.id);
                    
                    if (error.name === 'QuotaExceededError' || error.code === 22 || error.message?.includes('quota')) {
                        const currentSizeKB = this.getLocalStorageSize();
                        this.showNotification(`Error saving item: Storage quota exceeded! Current storage: ~${Math.round(currentSizeKB)}KB. Try removing items with large photos or use photo URLs instead of file uploads.`, 'error');
                    } else {
                        this.showNotification('Error saving item: ' + error.message, 'error');
                    }
                    return;
                }
            } else {
                // Add new item - create but don't add to array yet
                newItem = {
                    id: Date.now().toString(),
                categoryId: categoryId,
                name: name,
                description: description,
                note: note,
                dateAdded: actualDateAdded,
                duration: duration,
                photo: photo,
                createdAt: new Date().toISOString()
            };

                // Temporarily add to check for duplicates in persisted data
                this.items.push(newItem);
                
                // Invalidate cache since data changed
                this._invalidateCategoryCache();
                
                // Save data with error handling - remove item if save fails
                try {
                    await this.saveData();
                } catch (error) {
                    console.error('Error saving data:', error);
                    // Remove the item we just added since save failed
                    this.items = this.items.filter(item => item.id !== newItem.id);
                    
                    if (error.name === 'QuotaExceededError' || error.code === 22 || error.message?.includes('quota')) {
                        const currentSizeKB = this.getLocalStorageSize();
                        this.showNotification(`Error saving item: Storage quota exceeded! Current storage: ~${Math.round(currentSizeKB)}KB. Try removing items with large photos or use photo URLs instead of file uploads.`, 'error');
                    } else {
                        this.showNotification('Error saving item: ' + error.message, 'error');
                    }
                    return;
                }
            }
        }
        
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            // Re-apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !this.isItemEnded(item));
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
        this.hideNewCategoryFromItemInput();
    }

    toggleNewCategoryFromItemInput() {
        const container = document.getElementById('newCategoryFromItemContainer');
        const categorySelect = document.getElementById('itemCategory');
        const form = document.getElementById('itemForm');
        if (!container || !categorySelect) return;
        
        const isVisible = container.style.display !== 'none';
        container.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Showing - clear category selection and remove required attribute
            categorySelect.value = '';
            categorySelect.removeAttribute('required');
            // Disable HTML5 validation for the form when creating new category
            if (form) {
                form.setAttribute('novalidate', 'novalidate');
            }
            // Clear input fields
            const nameInput = document.getElementById('newCategoryFromItemName');
            const descInput = document.getElementById('newCategoryFromItemDescription');
            const avgDaysInput = document.getElementById('newCategoryFromItemAverageDays');
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            if (avgDaysInput) avgDaysInput.value = '';
        } else {
            // Hiding - restore category dropdown and make it required again
            categorySelect.value = '';
            categorySelect.required = true;
            // Re-enable HTML5 validation
            if (form) {
                form.removeAttribute('novalidate');
            }
        }
    }

    hideNewCategoryFromItemInput() {
        const container = document.getElementById('newCategoryFromItemContainer');
        const categorySelect = document.getElementById('itemCategory');
        if (container) {
            container.style.display = 'none';
        }
        if (categorySelect) {
            categorySelect.required = true;
            // Clear input fields
            const nameInput = document.getElementById('newCategoryFromItemName');
            const descInput = document.getElementById('newCategoryFromItemDescription');
            const avgDaysInput = document.getElementById('newCategoryFromItemAverageDays');
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            if (avgDaysInput) avgDaysInput.value = '';
        }
    }

    async deleteItem(itemId) {
        const confirmed = await this.showListingConfirm(
            'Are you sure you want to delete this item?',
            {
                title: 'Delete Item',
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel',
                focus: 'cancel',
                variant: 'danger'
            }
        );

        if (!confirmed) {
            return;
        }

        this.items = this.items.filter(item => item.id !== itemId);
        
        // Invalidate cache since data changed
        this._invalidateCategoryCache();
        
        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving after item deletion:', error);
            this.showNotification('Error saving changes: ' + error.message, 'error');
            return;
        }
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            // Re-apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !this.isItemEnded(item));
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

    async endItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            console.error('Item not found for ending:', itemId);
            return;
        }

        const itemName = item.name;
        const category = this.categories.find(cat => cat.id === item.categoryId);
        const categoryName = category ? category.name : 'Unknown';
        
        const confirmed = await this.showListingConfirm(
            `Are you sure you want to end the item "${itemName}" from category "${categoryName}"?\n\nThis will move the item to the "Items Ended" list.`,
            {
                title: 'End Item',
                confirmLabel: 'End Item',
                cancelLabel: 'Cancel',
                focus: 'cancel',
                variant: 'primary'
            }
        );

        if (!confirmed) {
            return;
        }

        // Mark the item as manually ended
        item.manuallyEnded = true;
        item.endedDate = new Date().toISOString().split('T')[0];
        
        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving after ending item:', error);
            this.showNotification('Error saving changes: ' + error.message, 'error');
            return;
        }
        
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            // Re-apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            const categoryItems = this.items.filter(it => it.categoryId === this.selectedCategoryId && !this.isItemEnded(it));
            let sortedItems = [...categoryItems];
            
            if (sortOrder === 'newest') {
                sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            } else if (sortOrder === 'oldest') {
                sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            } else if (sortOrder === 'lowest-days') {
                sortedItems.sort((a, b) => this.calculateDaysLeft(a) - this.calculateDaysLeft(b));
            } else if (sortOrder === 'highest-days') {
                sortedItems.sort((a, b) => this.calculateDaysLeft(b) - this.calculateDaysLeft(a));
            }
            
            this.renderCategoryItems(sortedItems);
        }
        
        // If we're viewing ended items, refresh that view
        if (this.currentView === 'ended') {
            this.renderEndedItems();
        }
    }

    openSoldItemModal(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            console.error('Item not found for marking as sold:', itemId);
            return;
        }

        // Check if item is already marked as sold
        if (item.soldDate || (item.manuallyEnded && item.soldPrice)) {
            this.showNotification('This item has already been marked as sold.', 'warning');
            return;
        }

        this.currentSoldItem = item;
        const modal = document.getElementById('soldItemModal');
        if (!modal) return;

        // Load sold categories and populate dropdown
        this.loadSoldCategories();

        // Reset form
        const form = document.getElementById('soldItemForm');
        if (form) form.reset();
        
        const subcategorySelect = document.getElementById('soldItemSubcategory');
        if (subcategorySelect) {
            subcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';
            subcategorySelect.disabled = true;
        }
        
        const newSubcategoryContainer = document.getElementById('newSubcategoryContainer');
        if (newSubcategoryContainer) {
            newSubcategoryContainer.style.display = 'none';
        }

        modal.style.display = 'block';
    }

    loadSoldCategories() {
        const categorySelect = document.getElementById('soldItemCategory');
        if (!categorySelect) return;

        // Load sold trends data
        const soldDataKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
        const soldData = localStorage.getItem(soldDataKey);
        if (!soldData) {
            categorySelect.innerHTML = '<option value="">No categories found. Create a new category below.</option>';
            categorySelect.disabled = false;
            return;
        }

        try {
            const data = JSON.parse(soldData);
            const periods = data.periods || [];
            
            if (periods.length === 0) {
                categorySelect.innerHTML = '<option value="">No categories found. Create a new category below.</option>';
                categorySelect.disabled = false;
                return;
            }

            // Get current period or first period
            const currentPeriodId = data.currentPeriodId || (periods[0] ? periods[0].id : null);
            const currentPeriod = periods.find(p => p.id === currentPeriodId) || periods[0];
            
            if (!currentPeriod) {
                categorySelect.innerHTML = '<option value="">No period found. Create a new category below.</option>';
                categorySelect.disabled = false;
                return;
            }

            categorySelect.innerHTML = '<option value="">Select a category...</option>';
            categorySelect.disabled = false;
            
            if (currentPeriod.categories && currentPeriod.categories.length > 0) {
                currentPeriod.categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    option.dataset.categoryData = JSON.stringify(category);
                    categorySelect.appendChild(option);
                });
            }

            // Add option to create new category
            const newCategoryOption = document.createElement('option');
            newCategoryOption.value = '__new__';
            newCategoryOption.textContent = '-- Create New Category --';
            categorySelect.appendChild(newCategoryOption);

            this.currentSoldPeriod = currentPeriod;
        } catch (error) {
            console.error('Error loading sold categories:', error);
            categorySelect.innerHTML = '<option value="">Error loading categories. Create a new category below.</option>';
            categorySelect.disabled = false;
        }
    }

    toggleNewCategoryInput() {
        const categorySelect = document.getElementById('soldItemCategory');
        const newCategoryContainer = document.getElementById('newCategoryContainer');
        const newCategoryName = document.getElementById('newCategoryName');
        
        if (!categorySelect || !newCategoryContainer) return;

        if (newCategoryContainer.style.display === 'none') {
            newCategoryContainer.style.display = 'block';
            categorySelect.value = '__new__';
            if (newCategoryName) {
                newCategoryName.focus();
                newCategoryName.value = '';
            }
        } else {
            newCategoryContainer.style.display = 'none';
            categorySelect.value = '';
            if (newCategoryName) newCategoryName.value = '';
            const newCategoryDescription = document.getElementById('newCategoryDescription');
            if (newCategoryDescription) newCategoryDescription.value = '';
        }
    }

    handleSoldCategoryChange() {
        const categorySelect = document.getElementById('soldItemCategory');
        const subcategorySelect = document.getElementById('soldItemSubcategory');
        const newCategoryContainer = document.getElementById('newCategoryContainer');
        const newSubcategoryContainer = document.getElementById('newSubcategoryContainer');
        
        if (!categorySelect || !subcategorySelect) return;

        const selectedCategoryId = categorySelect.value;
        
        // Handle new category creation
        if (selectedCategoryId === '__new__') {
            if (newCategoryContainer) newCategoryContainer.style.display = 'block';
            // Enable subcategory dropdown and allow creating new subcategory
            subcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';
            const newSubcategoryOption = document.createElement('option');
            newSubcategoryOption.value = '__new__';
            newSubcategoryOption.textContent = '-- Create New Subcategory --';
            subcategorySelect.appendChild(newSubcategoryOption);
            subcategorySelect.disabled = false;
            // Auto-select create new subcategory option and show input
            subcategorySelect.value = '__new__';
            if (newSubcategoryContainer) {
                newSubcategoryContainer.style.display = 'block';
                const newSubcategoryName = document.getElementById('newSubcategoryName');
                if (newSubcategoryName) {
                    setTimeout(() => newSubcategoryName.focus(), 100);
                }
            }
            this.currentSoldCategory = null;
            return;
        }
        
        if (newCategoryContainer) newCategoryContainer.style.display = 'none';
        
        if (!selectedCategoryId) {
            subcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';
            subcategorySelect.disabled = true;
            if (newSubcategoryContainer) newSubcategoryContainer.style.display = 'none';
            this.currentSoldCategory = null;
            return;
        }

        // Get the selected category data
        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        if (!selectedOption || !selectedOption.dataset.categoryData) {
            subcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';
            subcategorySelect.disabled = true;
            this.currentSoldCategory = null;
            return;
        }

        try {
            const category = JSON.parse(selectedOption.dataset.categoryData);
            const subcategories = category.subcategories || [];

            subcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';
            subcategorySelect.disabled = false;

            if (subcategories.length > 0) {
                subcategories.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.id;
                    option.textContent = sub.name;
                    subcategorySelect.appendChild(option);
                });
            }

            // Add option to create new subcategory
            const newOption = document.createElement('option');
            newOption.value = '__new__';
            newOption.textContent = '-- Create New Subcategory --';
            subcategorySelect.appendChild(newOption);

            this.currentSoldCategory = category;
        } catch (error) {
            console.error('Error loading subcategories:', error);
            subcategorySelect.innerHTML = '<option value="">Error loading subcategories</option>';
            subcategorySelect.disabled = true;
            this.currentSoldCategory = null;
        }
    }

    handleSoldSubcategoryChange() {
        const subcategorySelect = document.getElementById('soldItemSubcategory');
        const newSubcategoryContainer = document.getElementById('newSubcategoryContainer');
        const newSubcategoryName = document.getElementById('newSubcategoryName');
        
        if (!subcategorySelect || !newSubcategoryContainer) return;

        if (subcategorySelect.value === '__new__') {
            newSubcategoryContainer.style.display = 'block';
            if (newSubcategoryName) {
                newSubcategoryName.focus();
                newSubcategoryName.value = '';
            }
        } else {
            newSubcategoryContainer.style.display = 'none';
            if (newSubcategoryName) newSubcategoryName.value = '';
        }
    }

    toggleNewSubcategoryInput() {
        const categorySelect = document.getElementById('soldItemCategory');
        const subcategorySelect = document.getElementById('soldItemSubcategory');
        const newSubcategoryContainer = document.getElementById('newSubcategoryContainer');
        const newSubcategoryName = document.getElementById('newSubcategoryName');
        
        if (!subcategorySelect || !newSubcategoryContainer) return;

        // If creating a new category, enable the subcategory dropdown first
        if (categorySelect && categorySelect.value === '__new__') {
            subcategorySelect.disabled = false;
            subcategorySelect.innerHTML = '<option value="">Select a subcategory...</option>';
            const newOption = document.createElement('option');
            newOption.value = '__new__';
            newOption.textContent = '-- Create New Subcategory --';
            subcategorySelect.appendChild(newOption);
        }

        if (newSubcategoryContainer.style.display === 'none' || !newSubcategoryContainer.style.display) {
            newSubcategoryContainer.style.display = 'block';
            subcategorySelect.value = '__new__';
            if (newSubcategoryName) {
                newSubcategoryName.focus();
                newSubcategoryName.value = '';
            }
        } else {
            newSubcategoryContainer.style.display = 'none';
            subcategorySelect.value = '';
            if (newSubcategoryName) newSubcategoryName.value = '';
        }
    }

    async handleSoldItemSubmit(e) {
        e.preventDefault();
        
        if (!this.currentSoldItem) {
            this.showNotification('Item not found. Please try again.', 'error');
            return;
        }

        const categorySelect = document.getElementById('soldItemCategory');
        const subcategorySelect = document.getElementById('soldItemSubcategory');
        const newCategoryName = document.getElementById('newCategoryName');
        const newCategoryDescription = document.getElementById('newCategoryDescription');
        const newSubcategoryName = document.getElementById('newSubcategoryName');
        const priceInput = document.getElementById('soldItemPrice');

        if (!categorySelect || !subcategorySelect || !priceInput) return;

        const categoryId = categorySelect.value;
        const subcategoryId = subcategorySelect.value;
        const isNewCategory = categoryId === '__new__';
        const isNewSubcategory = subcategoryId === '__new__';
        const newCategoryNameValue = newCategoryName ? newCategoryName.value.trim() : '';
        const newCategoryDescriptionValue = newCategoryDescription ? newCategoryDescription.value.trim() : '';
        const newSubcategoryNameValue = newSubcategoryName ? newSubcategoryName.value.trim() : '';
        const price = parseFloat(priceInput.value);

        if (!categoryId) {
            this.showNotification('Please select a category or create a new one.', 'warning');
            return;
        }

        if (isNewCategory) {
            if (!newCategoryNameValue) {
                this.showNotification('Please enter a name for the new category.', 'warning');
                return;
            }
            // When creating a new category, we must also create a new subcategory
            // Check if new subcategory name is provided
            const newSubcategoryContainer = document.getElementById('newSubcategoryContainer');
            const isNewSubcategoryVisible = newSubcategoryContainer && newSubcategoryContainer.style.display !== 'none';
            
            if (!isNewSubcategoryVisible || !newSubcategoryNameValue) {
                this.showNotification('Please enter a name for the new subcategory.', 'warning');
                return;
            }
        } else {
            // Existing category selected
            if (isNewSubcategory) {
                if (!newSubcategoryNameValue) {
                    this.showNotification('Please enter a name for the new subcategory.', 'warning');
                    return;
                }
            } else if (!subcategoryId) {
                this.showNotification('Please select a subcategory or create a new one.', 'warning');
                return;
            }
        }

        if (!priceInput.value || isNaN(price) || price < 0) {
            this.showNotification('Please enter a valid price (0 or greater).', 'warning');
            return;
        }

        // Load sold trends data
        const soldDataKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
        let soldData = localStorage.getItem(soldDataKey);
        let data;
        
        try {
            if (!soldData) {
                // Create initial data structure if it doesn't exist
                data = {
                    periods: [],
                    currentPeriodId: null
                };
            } else {
                data = JSON.parse(soldData);
            }
            
            const periods = data.periods || [];
            let currentPeriodId = data.currentPeriodId || (periods[0] ? periods[0].id : null);
            let currentPeriod = periods.find(p => p.id === currentPeriodId);

            // If no period exists, create one
            if (!currentPeriod) {
                const timestamp = new Date().toISOString();
                currentPeriod = {
                    id: `period-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
                    name: 'Default Period',
                    description: '',
                    categories: [],
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                periods.push(currentPeriod);
                currentPeriodId = currentPeriod.id;
                data.currentPeriodId = currentPeriodId;
            }

            // Create or find the category
            let category = null;
            let categoryIndex = -1;

            if (isNewCategory) {
                // Create new category
                const timestamp = new Date().toISOString();
                category = {
                    id: `cat-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
                    name: newCategoryNameValue,
                    description: newCategoryDescriptionValue,
                    subcategories: [],
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                
                if (!currentPeriod.categories) {
                    currentPeriod.categories = [];
                }
                currentPeriod.categories.push(category);
                categoryIndex = currentPeriod.categories.length - 1;
            } else {
                // Find existing category
                categoryIndex = currentPeriod.categories.findIndex(cat => cat.id === categoryId);
                if (categoryIndex === -1) {
                    this.showNotification('Error: Category not found.', 'error');
                    return;
                }
                category = currentPeriod.categories[categoryIndex];
            }
            let subcategory = null;
            let subcategoryIndex = -1;

            // When creating a new category, we must also create a new subcategory
            // Check if we're creating a new subcategory (either explicitly or because we're creating a new category)
            const actualIsNewSubcategory = isNewCategory || isNewSubcategory;
            const actualSubcategoryName = isNewCategory ? newSubcategoryNameValue : (isNewSubcategory ? newSubcategoryNameValue : '');

            if (actualIsNewSubcategory) {
                // Create new subcategory
                const timestamp = new Date().toISOString();
                const newSubcategory = {
                    id: `sub-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
                    name: actualSubcategoryName,
                    count: 0,
                    price: null,
                    items: [],
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                
                if (!category.subcategories) {
                    category.subcategories = [];
                }
                category.subcategories.push(newSubcategory);
                subcategory = newSubcategory;
                subcategoryIndex = category.subcategories.length - 1;
            } else {
                // Find existing subcategory
                subcategoryIndex = category.subcategories.findIndex(sub => sub.id === subcategoryId);
                if (subcategoryIndex === -1) {
                    this.showNotification('Error: Subcategory not found.', 'error');
                    return;
                }
                subcategory = category.subcategories[subcategoryIndex];
            }

            // Check if this item is already in the subcategory (prevent duplicates)
            if (!subcategory.items) {
                subcategory.items = [];
            }
            
            // Check for duplicate based on item name and price (or original item ID if stored)
            const existingItem = subcategory.items.find(item => 
                item.label === this.currentSoldItem.name && 
                item.price === price &&
                (!this.currentSoldItem.id || item.id === `solditem-${this.currentSoldItem.id}`)
            );
            
            if (existingItem) {
                this.showNotification('This item has already been added to this subcategory.', 'warning');
                return;
            }

            // Add item to subcategory
            const timestamp = new Date().toISOString();
            const soldItem = {
                id: `solditem-${this.currentSoldItem.id || Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
                label: this.currentSoldItem.name,
                price: price,
                photo: this.currentSoldItem.photo || null, // Include photo URL if available
                createdAt: timestamp,
                updatedAt: timestamp
            };

            subcategory.items.push(soldItem);

            // Update subcategory count
            subcategory.count = subcategory.items.length;
            subcategory.updatedAt = timestamp;

            // Update category
            category.updatedAt = timestamp;
            currentPeriod.updatedAt = timestamp;

            // Save sold items data first
            data.periods = periods;
            data.currentPeriodId = currentPeriod.id;
            const soldDataKey = window.storeManager ? window.storeManager.getStoreDataKey('SoldItemsTrends') : 'SoldItemsTrends';
            
            try {
            localStorage.setItem(soldDataKey, JSON.stringify(data));
            } catch (soldError) {
                console.error('Error saving sold items data:', soldError);
                // Remove the item we just added since save failed
                subcategory.items = subcategory.items.filter(item => item.id !== soldItem.id);
                subcategory.count = subcategory.items.length;
                this.showNotification('Error saving to sold items. Please try again.', 'error');
                return;
            }

            // Mark the item as sold (end it) - but don't fail if this save fails
            const originalItemState = {
                manuallyEnded: this.currentSoldItem.manuallyEnded,
                endedDate: this.currentSoldItem.endedDate,
                soldDate: this.currentSoldItem.soldDate,
                soldPrice: this.currentSoldItem.soldPrice
            };
            
            this.currentSoldItem.manuallyEnded = true;
            this.currentSoldItem.endedDate = new Date().toISOString().split('T')[0];
            this.currentSoldItem.soldDate = timestamp;
            this.currentSoldItem.soldPrice = price;
            
            let saveSuccess = false;
            try {
                await this.saveData();
                saveSuccess = true;
            } catch (saveError) {
                console.error('Error saving ListingLife data after marking as sold:', saveError);
                // Rollback the sold item state if save failed
                Object.assign(this.currentSoldItem, originalItemState);
                // But don't remove from sold items - it's already there
                this.showNotification(
                    `Item added to Sold Items Trends, but failed to update in ListingLife: ${saveError.message}. The item may still appear in your listings.`,
                    'warning'
                );
                // Continue - the item is in sold items, which is the important part
            }

            // Close modal
            const modal = document.getElementById('soldItemModal');
            if (modal) modal.style.display = 'none';

            // Refresh views
            this.renderCategories();
            this.updateUrgentItems();
            
            if (this.currentView === 'items' && this.selectedCategoryId) {
                const sortOrder = document.getElementById('categorySortSelect').value;
                const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !this.isItemEnded(item));
                let sortedItems = [...categoryItems];
                
                if (sortOrder === 'newest') {
                    sortedItems.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                } else if (sortOrder === 'oldest') {
                    sortedItems.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
                } else if (sortOrder === 'lowest-days') {
                    sortedItems.sort((a, b) => this.calculateDaysLeft(a) - this.calculateDaysLeft(b));
                } else if (sortOrder === 'highest-days') {
                    sortedItems.sort((a, b) => this.calculateDaysLeft(b) - this.calculateDaysLeft(a));
                }
                
                this.renderCategoryItems(sortedItems);
            }

            if (this.currentView === 'ended') {
                this.renderEndedItems();
            }

            // Only show success if both saves worked
            if (saveSuccess) {
            this.showNotification(`Item "${this.currentSoldItem.name}" has been marked as sold and added to Sold Items Trends.`, 'success');
            }
            this.currentSoldItem = null;
        } catch (error) {
            console.error('Error saving sold item:', error);
            this.showNotification('Error saving sold item: ' + error.message, 'error');
        }
    }

    // Navigation
    showCategoriesView() {
        this.currentView = 'categories';
        this.selectedCategoryId = null;
        this.previousView = 'categories';
        this.previousCategoryId = null;
        
        // Show container immediately for instant visual feedback
        const categoriesContainer = document.getElementById('categoriesContainer');
        const categoryItemsContainer = document.getElementById('categoryItemsContainer');
        const endedItemsContainer = document.getElementById('endedItemsContainer');
        
        if (categoriesContainer) categoriesContainer.style.display = 'block';
        if (categoryItemsContainer) categoryItemsContainer.style.display = 'none';
        if (endedItemsContainer) endedItemsContainer.style.display = 'none';
        
        this.toggleFloatingAddButton(false);
        this.updateActiveNav('listinglife');
        
        // Render will use cache if available, so it should be instant
        this.renderCategories();
    }

    showEndedItemsView() {
        this.currentView = 'ended';
        this.selectedCategoryId = null;
        
        // Show container immediately for instant visual feedback
        const categoriesContainer = document.getElementById('categoriesContainer');
        const categoryItemsContainer = document.getElementById('categoryItemsContainer');
        const endedItemsContainer = document.getElementById('endedItemsContainer');
        
        if (categoriesContainer) categoriesContainer.style.display = 'none';
        if (categoryItemsContainer) categoryItemsContainer.style.display = 'none';
        if (endedItemsContainer) endedItemsContainer.style.display = 'block';
        
        this.toggleFloatingAddButton(false);
        this.updateActiveNav('ended');
        
        // Render will use cache if available, so it should be instant
        this.renderEndedItems();
    }

    showCategoryItems(categoryId) {
        this.currentView = 'items';
        this.selectedCategoryId = categoryId;
        this.previousView = 'items';
        this.previousCategoryId = categoryId;
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('categoryItemsContainer').style.display = 'block';
        document.getElementById('endedItemsContainer').style.display = 'none';
        this.toggleFloatingAddButton(true);
        this.updateActiveNav('listinglife');
        
        const category = this.categories.find(cat => cat.id === categoryId);
        const categoryItems = this.items.filter(item => item.categoryId === categoryId && !this.isItemEnded(item));
        
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
        const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !this.isItemEnded(item));
        
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
        
        const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !this.isItemEnded(item));
        
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

    isItemEnded(item) {
        // Check if item is manually ended or has automatically ended (days left <= 0)
        return item.manuallyEnded || this.calculateDaysLeft(item) <= 0;
    }

    // Search Functionality
    searchItems() {
        const searchTerm = document.getElementById('searchBar').value.trim();
        const originalSearchTerm = searchTerm; // Keep original for display
        
        if (!searchTerm) {
            // Restore previous view
            if (this.previousView === 'items' && this.previousCategoryId) {
                this.showCategoryItems(this.previousCategoryId);
            } else {
                this.showCategoriesView();
            }
            return;
        }

        // Store current view before showing search results
        if (this.currentView === 'items' && this.selectedCategoryId) {
            this.previousView = 'items';
            this.previousCategoryId = this.selectedCategoryId;
        } else if (this.currentView === 'categories') {
            this.previousView = 'categories';
            this.previousCategoryId = null;
        }

        // Split search term into keywords (multiple words)
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);

        // Filter items where ALL keywords appear (in any order, anywhere in the text)
        const matchingItems = this.items.filter(item => {
            if (this.isItemEnded(item)) return false;
            
            // Combine all searchable text fields
            const searchableText = [
                item.name || '',
                item.description || '',
                item.note || ''
            ].join(' ').toLowerCase();
            
            // Check if ALL keywords are found in the searchable text
            return keywords.every(keyword => searchableText.includes(keyword));
        });

        this.renderSearchResults(originalSearchTerm, matchingItems);
    }

    renderSearchResults(searchTerm, matchingItems) {
        const categoriesContainer = document.getElementById('categoriesContainer');
        const categoryItemsContainer = document.getElementById('categoryItemsContainer');
        
        // Hide category items view and show categories container for search results
        if (categoryItemsContainer) {
            categoryItemsContainer.style.display = 'none';
        }
        if (categoriesContainer) {
            categoriesContainer.style.display = 'block';
        }
        
        if (matchingItems.length === 0) {
            categoriesContainer.innerHTML = `
                <div class="search-results">
                    <h3>No items found for "${searchTerm}"</h3>
                </div>
            `;
            this.currentView = 'search';
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

        categoriesContainer.innerHTML = html;
        this.currentView = 'search';
    }

    highlightSearchTerm(text, searchTerm) {
        // Split search term into keywords and highlight each one
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);
        let highlightedText = text;
        
        // Escape special regex characters in keywords
        keywords.forEach(keyword => {
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedKeyword})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
        });
        
        return highlightedText;
    }

    // Performance optimization: Calculate item counts once
    _calculateCategoryItemCounts() {
        if (this._categoryItemCounts !== null && this.items.length === this._lastItemCount) {
            return this._categoryItemCounts;
        }
        
        // Build a map of category ID to item count in one pass (O(n) instead of O(n*m))
        const counts = new Map();
        this.categories.forEach(cat => counts.set(cat.id, 0));
        
        // Count items per category in a single pass
        this.items.forEach(item => {
            if (!this.isItemEnded(item) && counts.has(item.categoryId)) {
                counts.set(item.categoryId, counts.get(item.categoryId) + 1);
            }
        });
        
        this._categoryItemCounts = counts;
        this._lastItemCount = this.items.length;
        return counts;
    }
    
    // Generate a hash of categories data to detect changes
    _getCategoriesHash() {
        // Create a simple hash from category IDs, names, and item counts
        const itemCounts = this._calculateCategoryItemCounts();
        const hashParts = this.categories.map(cat => {
            const count = itemCounts.get(cat.id) || 0;
            return `${cat.id}:${cat.name}:${count}:${cat.description || ''}`;
        });
        return hashParts.join('|');
    }
    
    // Invalidate category cache when data changes
    _invalidateCategoryCache() {
        this._cachedCategoriesHTML = null;
        this._lastCategoriesHash = null;
        this._categoryItemCounts = null;
        this._lastItemCount = null;
        // Also invalidate ended items cache
        this._cachedEndedItemsHTML = null;
        this._lastEndedItemsHash = null;
        this._categoryLookup = null;
    }
    
    // Build category lookup map for O(1) access
    _buildCategoryLookup() {
        if (this._categoryLookup !== null) {
            return this._categoryLookup;
        }
        this._categoryLookup = new Map();
        this.categories.forEach(cat => {
            this._categoryLookup.set(cat.id, cat);
        });
        return this._categoryLookup;
    }
    
    // Generate hash for ended items to detect changes
    _getEndedItemsHash() {
        const endedItems = this.items.filter(item => {
            // Exclude sold items from ended items hash
            if (item.soldDate) {
                return false;
            }
            const daysLeft = this.calculateDaysLeft(item);
            return daysLeft <= 0;
        });
        // Create hash from item IDs and manuallyEnded flags
        const hashParts = endedItems.map(item => `${item.id}:${item.manuallyEnded ? '1' : '0'}`);
        return hashParts.join('|');
    }

    // Rendering
    renderCategories() {
        // Cancel any pending render to avoid duplicate work
        if (this._renderCategoriesRequestId !== null) {
            cancelAnimationFrame(this._renderCategoriesRequestId);
        }
        
        // Check if we can use cached HTML
        const currentHash = this._getCategoriesHash();
        const container = document.getElementById('categoriesContainer');
        
        if (container && this._cachedCategoriesHTML && this._lastCategoriesHash === currentHash) {
            // Data hasn't changed, use cached HTML immediately
            container.innerHTML = this._cachedCategoriesHTML;
            return;
        }
        
        // Show loading state immediately if container exists
        if (container && this.categories.length > 0) {
            // Keep existing content or show minimal loading indicator
            // Don't clear it completely to avoid flash
        }
        
        // Defer rendering to next frame to prevent blocking UI
        this._renderCategoriesRequestId = requestAnimationFrame(() => {
            this._renderCategoriesRequestId = null;
            this._doRenderCategories();
        });
    }
    
    _doRenderCategories() {
        const container = document.getElementById('categoriesContainer');
        if (!container) return;
        
        if (this.categories.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <h3>No categories yet</h3>
                    <p>Create your first category to start managing your eBay items!</p>
                </div>
            `;
            container.innerHTML = emptyHTML;
            this._cachedCategoriesHTML = emptyHTML;
            this._lastCategoriesHash = this._getCategoriesHash();
            return;
        }

        // Use cached item counts (calculated once, O(n) instead of O(n*m))
        const itemCounts = this._calculateCategoryItemCounts();
        
        // Use array join instead of string concatenation for better performance
        const categoryHTMLs = this.categories.map(category => {
            const itemCount = itemCounts.get(category.id) || 0;
            const escapedCategory = JSON.stringify(category).replace(/"/g, '&quot;');
            const descriptionHTML = category.description ? `<div class="item-description">${category.description}</div>` : '';
            
            return `
                <div class="category-box" onclick="app.showCategoryItems('${category.id}')">
                    <h3>${this.escapeHtml(category.name)}</h3>
                    <div class="item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
                    ${descriptionHTML}
                    <div class="category-actions">
                        <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); app.openCategoryModal(${escapedCategory})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); app.deleteCategory('${category.id}')">Delete</button>
                    </div>
                </div>
            `;
        });

        // Use document fragment for faster DOM updates
        const html = '<div class="categories-grid">' + categoryHTMLs.join('') + '</div>';
        
        // Update DOM in one operation
        container.innerHTML = html;
        
        // Cache the rendered HTML
        this._cachedCategoriesHTML = html;
        this._lastCategoriesHash = this._getCategoriesHash();
    }

    renderCategoryItems(items) {
        const container = document.getElementById('categoryItemsList');
        
        // Filter out ended items (both manually and automatically ended) from category view
        const activeItems = items.filter(item => !this.isItemEnded(item));
        
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
                        <button class="btn btn-small btn-success sold-btn" data-item-id="${item.id}">Sold</button>
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
        // Cancel any pending render to avoid duplicate work
        if (this._renderEndedItemsRequestId !== null) {
            cancelAnimationFrame(this._renderEndedItemsRequestId);
        }
        
        // Check if we can use cached HTML
        const currentHash = this._getEndedItemsHash();
        const container = document.getElementById('endedItemsList');
        
        if (container && this._cachedEndedItemsHTML && this._lastEndedItemsHash === currentHash) {
            // Data hasn't changed, use cached HTML immediately
            container.innerHTML = this._cachedEndedItemsHTML;
            return;
        }
        
        // Defer rendering to next frame to prevent blocking UI
        this._renderEndedItemsRequestId = requestAnimationFrame(() => {
            this._renderEndedItemsRequestId = null;
            this._doRenderEndedItems();
        });
    }
    
    _doRenderEndedItems() {
        const container = document.getElementById('endedItemsList');
        if (!container) return;
        
        // Filter items that have 0 or negative days left, but exclude items that were sold
        // (sold items should only appear in the sold items section)
        const endedItems = [];
        const itemDaysLeft = new Map(); // Cache days left calculations
        
        this.items.forEach(item => {
            // Skip items that have been marked as sold
            if (item.soldDate) {
                return;
            }
            
            const daysLeft = this.calculateDaysLeft(item);
            itemDaysLeft.set(item.id, daysLeft);
            if (daysLeft <= 0) {
                endedItems.push(item);
            }
        });

        if (endedItems.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <h3>No ended items</h3>
                    <p>All your items are still active!</p>
                </div>
            `;
            container.innerHTML = emptyHTML;
            this._cachedEndedItemsHTML = emptyHTML;
            this._lastEndedItemsHash = this._getEndedItemsHash();
            return;
        }

        // Build category lookup map once (O(n) instead of O(n*m))
        const categoryLookup = this._buildCategoryLookup();
        
        // Use array join instead of string concatenation for better performance
        const itemHTMLs = endedItems.map(item => {
            const category = categoryLookup.get(item.categoryId);
            const photoHtml = item.photo ? 
                `<div class="item-photo"><img src="${this.escapeHtml(item.photo)}" alt="${this.escapeHtml(item.name)}" onerror="this.style.display='none'"></div>` : 
                `<div class="item-photo no-photo"><span>📷</span></div>`;
            
            // Use cached days left calculation
            const daysLeft = itemDaysLeft.get(item.id);
            const daysText = item.manuallyEnded ? 'Manually Ended' : (daysLeft <= 0 ? 'Ended' : `${daysLeft} days left`);
            const noteHTML = item.note ? `<div class="item-notes">${this.escapeHtml(item.note.substring(0, 50))}${item.note.length > 50 ? '...' : ''}</div>` : '';
            const categoryName = category ? this.escapeHtml(category.name) : 'Unknown';
            const dateAdded = item.dateAdded ? this.formatDate(item.dateAdded) : 'Unknown';
            
            return `
                <div class="item item-clickable" data-item-id="${item.id}">
                    <div class="ended-item-checkbox-container">
                        <input type="checkbox" class="ended-item-checkbox" data-item-id="${item.id}" title="Mark as done">
                    </div>
                    ${photoHtml}
                    <div class="item-info">
                        <div class="item-name">${this.escapeHtml(item.name)}</div>
                        <div class="item-date">Category: ${categoryName} | Added: ${dateAdded}</div>
                        ${noteHTML}
                        <div class="item-days-left ended">${this.escapeHtml(daysText)}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-small btn-primary edit-btn" data-item-id="${item.id}">Edit</button>
                        <button class="btn btn-small btn-danger delete-btn" data-item-id="${item.id}">Delete</button>
                    </div>
                </div>
            `;
        });

        const html = '<div class="items-list">' + itemHTMLs.join('') + '</div>';
        container.innerHTML = html;
        
        // Cache the rendered HTML
        this._cachedEndedItemsHTML = html;
        this._lastEndedItemsHash = this._getEndedItemsHash();
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
        // Show items added in the last 7 days (excluding ended items)
        const recentItems = this.items
            .filter(item => {
                if (!item.dateAdded) return false;
                if (this.isItemEnded(item)) return false; // Exclude ended items
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

        // Filter items that are ending within 14 days (but not already ended) and sort by days until end
        const endingSoonItems = itemsWithEndDates
            .filter(item => !this.isItemEnded(item) && item.daysUntilEnd > 0 && item.daysUntilEnd <= 14)
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
            this.showNotification('Item not found!', 'error');
            return;
        }
        
        const category = this.categories.find(cat => cat.id === item.categoryId);
        console.log('Found category:', category);
        
        const modal = document.getElementById('viewModal');
        console.log('Modal element:', modal);
        
        if (!modal) {
            console.error('View modal not found in DOM');
            this.showNotification('View modal not found!', 'error');
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
            this.showNotification('Item not found! Please try again.', 'error');
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

    async handleItemDetailSubmit(e) {
        e.preventDefault();
        if (!this.currentDetailItem) return;

        const note = document.getElementById('itemDetailNote').value.trim();
        const picture = document.getElementById('itemDetailPicture').value.trim();


        // Update item with new data
        this.currentDetailItem.note = note;
        this.currentDetailItem.photo = picture;

        try {
            await this.saveData();
        } catch (error) {
            console.error('Error saving item details:', error);
            this.showNotification('Error saving changes: ' + error.message, 'error');
            return;
        }
        
        this.renderCategories();
        this.updateUrgentItems();
        
        // If we're viewing items for a category, refresh that view
        if (this.currentView === 'items' && this.selectedCategoryId) {
            // Re-apply current sort order
            const sortOrder = document.getElementById('categorySortSelect').value;
            const categoryItems = this.items.filter(item => item.categoryId === this.selectedCategoryId && !this.isItemEnded(item));
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
    async saveData() {
        const data = {
            categories: this.categories,
            items: this.items
        };
        
            const jsonString = JSON.stringify(data);
            const dataSizeKB = (jsonString.length * 2) / 1024; // Approximate size in KB (UTF-16)
            
            // Get store-specific key
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey('EbayListingLife') : 'EbayListingLife';
            
        // Get configured storage mode from settings
        const storageConfig = this.getStorageConfig();
        const storageMode = storageConfig?.storage_mode || 'local';
        const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
        
        // Check if backend is available
        const backendAvailable = window.storageWrapper && 
                                 window.storageWrapper.useBackend && 
                                 window.storageWrapper.backendAvailable;
        
        // If configured for backend storage (Dropbox/Cloud), always try backend first
        if (useBackendStorage && backendAvailable) {
            // Backend storage is configured and available - save directly to backend
            try {
                // Pass the data object directly (storage wrapper will handle serialization)
                await window.storageWrapper.saveToBackend(storageKey, data);
                console.log(`Data saved to ${storageMode} backend successfully. Size: ${Math.round(dataSizeKB)}KB`);
                
                // Try to also save to localStorage as cache (but don't fail if it's full)
                try {
            localStorage.setItem(storageKey, jsonString);
                } catch (localError) {
                    // localStorage is full, but that's OK since we saved to backend
                    if (localError.name === 'QuotaExceededError' || localError.code === 22) {
                        console.warn(`localStorage is full, but data saved to ${storageMode} backend`);
                    }
                }
                return; // Success
            } catch (backendError) {
                console.error(`${storageMode} backend save failed:`, backendError);
                // If backend is configured but fails, fall back to localStorage with warning
                console.warn(`Backend save failed, falling back to localStorage. Please check your ${storageMode === 'dropbox' ? 'Dropbox' : 'cloud'} connection.`);
                // Fall through to localStorage save below
            }
        } else if (useBackendStorage && !backendAvailable) {
            // Backend storage is configured but backend is not available
            // Fall back to localStorage with a warning (don't block the user)
            console.warn(`Storage is configured for ${storageMode === 'dropbox' ? 'Dropbox' : 'cloud'} but the storage server is not available. Using localStorage as fallback. Please start the storage server to use ${storageMode} storage.`);
            // Fall through to localStorage save below
        }
        
        // Local storage mode, backend not configured, or backend failed - use localStorage
        try {
            localStorage.setItem(storageKey, jsonString);
            if (useBackendStorage) {
                // If Dropbox/cloud was configured but we're using localStorage, show a one-time notification
                const lastWarningKey = `lastBackendFallbackWarning_${storageMode}`;
                const lastWarning = sessionStorage.getItem(lastWarningKey);
                if (!lastWarning) {
                    sessionStorage.setItem(lastWarningKey, Date.now().toString());
                    this.showNotification(
                        `${storageMode === 'dropbox' ? 'Dropbox' : 'Cloud'} storage is configured but the server is not available. Using local storage. Start the storage server to use ${storageMode} storage.`,
                        'warning'
                    );
                }
            }
            console.log(`Data saved to localStorage successfully. Size: ${Math.round(dataSizeKB)}KB`);
        } catch (error) {
            console.error('Error in saveData:', error);
            // Re-throw with helpful message for quota errors
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                const currentSizeKB = this.getLocalStorageSize();
                // If Dropbox/cloud is configured, suggest starting the server instead of just saying quota exceeded
                if (useBackendStorage) {
                    throw new Error(`Local storage quota exceeded (~${Math.round(currentSizeKB)}KB). ${storageMode === 'dropbox' ? 'Dropbox' : 'Cloud'} storage is configured - please start the storage server to use unlimited ${storageMode} storage.`);
                } else {
                    throw new Error(`Storage quota exceeded! Current storage: ~${Math.round(currentSizeKB)}KB. Try removing items with large photos, use photo URLs instead of file uploads, or configure Dropbox/cloud storage in settings for unlimited storage.`);
                }
            }
            throw error; // Re-throw other errors
        }
    }
    
    getStorageConfig() {
        try {
            const configStr = localStorage.getItem('ListingLifeStorageConfig');
            return configStr ? JSON.parse(configStr) : null;
        } catch (error) {
            console.warn('Error loading storage config:', error);
            return null;
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

    cleanupOrphanedItems(storageKey) {
        // Check if items in memory match persisted items
        // This helps clean up items that were added but save failed
        // Only run if we have items in memory but they don't match persisted data
        try {
            const savedData = localStorage.getItem(storageKey);
            if (savedData && this.items.length > 0) {
                const parsed = JSON.parse(savedData);
                const persistedItemIds = new Set((parsed.items || []).map(item => item.id));
                const originalCount = this.items.length;
                
                // Only remove items that aren't in persisted data AND we have persisted data
                if (persistedItemIds.size > 0) {
                    this.items = this.items.filter(item => persistedItemIds.has(item.id));
                    
                    if (this.items.length < originalCount) {
                        console.log(`Cleaned up ${originalCount - this.items.length} orphaned items that weren't persisted`);
                    }
                }
            }
        } catch (e) {
            console.warn('Error during orphaned items cleanup:', e);
            // Don't fail - this is just cleanup, and don't remove items if cleanup fails
        }
    }

    async loadData() {
        console.log('=== Loading ListingLife Data ===');
        console.log('storeManager available:', !!window.storeManager);
        
        // Wait a moment for store manager to finish loading from backend if needed
        if (window.storeManager && window.storageWrapper && window.storageWrapper.backendAvailable) {
            // Give store manager time to load stores/current store from backend
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Get store-specific key
        let storageKey = 'EbayListingLife';
        if (window.storeManager) {
            try {
                storageKey = window.storeManager.getStoreDataKey('EbayListingLife');
            } catch (err) {
                console.warn('Error getting store data key, using default:', err);
            }
        }
        console.log('Target storage key:', storageKey);
        
        // DEBUG: List ALL localStorage keys to help diagnose
        const allKeys = Object.keys(localStorage);
        const relevantKeys = allKeys.filter(k => 
            k.toLowerCase().includes('ebay') || 
            k.toLowerCase().includes('listing') ||
            k.toLowerCase().includes('item')
        );
        console.log('All localStorage keys containing "ebay", "listing", or "item":', relevantKeys);
        console.log('Total localStorage keys:', allKeys.length);
        
        // Get configured storage mode from settings
        const storageConfig = this.getStorageConfig();
        const storageMode = storageConfig?.storage_mode || 'local';
        const useBackendStorage = storageMode === 'dropbox' || storageMode === 'cloud';
        const backendAvailable = window.storageWrapper && 
                                 window.storageWrapper.useBackend && 
                                 window.storageWrapper.backendAvailable;
        
        // Try to load from store-specific key first, then fall back to old keys for backward compatibility
        let savedData = null;
        let loadedFromOldKey = false;
        let oldKeyUsed = null;
        let loadedFromBackend = false;
        
        // Strategy: Check store-specific key first, but ALWAYS check old keys as fallback
        // This ensures backward compatibility even if store system creates new default store
        
        // First, try store-specific key (if storeManager exists)
        if (window.storeManager && storageKey !== 'EbayListingLife') {
            savedData = localStorage.getItem(storageKey);
            console.log('Data in store-specific key:', !!savedData);
        }
        
        // Always check old keys (critical for backward compatibility)
        // Also check ALL possible variations in case data was stored with different casing or formats
        if (!savedData) {
            const oldKeys = ['EbayListingLife', 'eBayItemManager', 'ebaylistinglife', 'ebayitemmanager'];
            
            // Also check all localStorage keys for any that might contain ListingLife data
            const allKeys = Object.keys(localStorage);
            const possibleKeys = allKeys.filter(key => {
                const lower = key.toLowerCase();
                return (lower.includes('ebay') && lower.includes('listing')) ||
                       (lower.includes('ebay') && lower.includes('item') && lower.includes('manager')) ||
                       (lower === 'ebaylistinglife') ||
                       (lower === 'ebayitemmanager');
            });
            
            // Combine old keys with found keys, removing duplicates
            const keysToCheck = [...new Set([...oldKeys, ...possibleKeys])];
            
            for (const oldKey of keysToCheck) {
                const data = localStorage.getItem(oldKey);
                if (data && data.trim().length > 0) {
                    // Verify it's valid data structure
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.categories !== undefined || parsed.items !== undefined) {
                            savedData = data;
                            loadedFromOldKey = true;
                            oldKeyUsed = oldKey;
                            console.log('✓ Found data in old key:', oldKey, `(${parsed.categories?.length || 0} categories, ${parsed.items?.length || 0} items)`);
                            break;
                        }
                    } catch (e) {
                        console.warn('Invalid JSON in key:', oldKey, e.message);
                    }
                }
            }
        }
        
        // Don't check other store-specific keys - each store should have its own data
        // Only check old non-store keys for backward compatibility
        
        // ALWAYS try loading from backend if available (even if localStorage has data)
        // This ensures we get the latest data from backend storage (Dropbox/cloud/local file)
        // BUT: If localStorage has data and backend doesn't, we should sync localStorage to backend
        if (backendAvailable) {
            try {
                console.log(`Checking backend storage for latest data (key: ${storageKey})...`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                
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
                        // Backend returned data - parse it
                        try {
                            const backendData = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
                            if (backendData.categories !== undefined || backendData.items !== undefined) {
                                // Backend data takes precedence - it's the source of truth
                                const backendDataStr = JSON.stringify(backendData);
                                
                                // Only use backend data if it's different or if we had no localStorage data
                                if (!savedData || savedData !== backendDataStr) {
                                    savedData = backendDataStr;
                                    loadedFromBackend = true;
                                    console.log(`✓ Loaded data from backend storage (${backendData.categories?.length || 0} categories, ${backendData.items?.length || 0} items)`);
                                    
                                    // Cache it in localStorage for faster future loads
                                    try {
                                        localStorage.setItem(storageKey, savedData);
                                        console.log('✓ Cached backend data in localStorage');
                                    } catch (cacheError) {
                                        console.warn('Could not cache data in localStorage (quota may be full):', cacheError);
                                    }
                                } else {
                                    console.log('✓ Backend data matches localStorage, using cached version');
                                }
                            }
                        } catch (parseError) {
                            console.error('Error parsing backend data:', parseError);
                            // Fall back to localStorage data if available
                        }
                    } else {
                        console.log('Backend returned no data for key:', storageKey);
                        // Backend has no data, but localStorage does - sync localStorage to backend
                        if (savedData && useBackendStorage) {
                            console.log('⚠️ Backend has no data but localStorage does. Syncing localStorage to backend...');
                            try {
                                const dataToSync = JSON.parse(savedData);
                                await fetch(`http://127.0.0.1:5000/api/storage/set`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ key: storageKey, value: dataToSync })
                                });
                                console.log('✓ Synced localStorage data to backend');
                            } catch (syncError) {
                                console.warn('Could not sync localStorage to backend:', syncError);
                            }
                        }
                    }
                } else {
                    console.log(`Backend returned ${response.status}, using localStorage data if available`);
                }
            } catch (backendError) {
                if (backendError.name !== 'AbortError') {
                    console.warn(`Could not load from backend storage:`, backendError.message);
                }
                // Continue with localStorage data if available - don't fail completely
            }
        }
        
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                // Ensure we have arrays (handle null/undefined cases)
                this.categories = Array.isArray(data.categories) ? data.categories : [];
                this.items = Array.isArray(data.items) ? data.items : [];
                
                console.log(`✓ Successfully loaded ${this.categories.length} categories and ${this.items.length} items from key: ${oldKeyUsed || storageKey}`);
                console.log('Categories:', this.categories.map(c => c.name));
                console.log('Items sample (first 5):', this.items.slice(0, 5).map(i => i.name));
                
                // Invalidate cache after loading new data
                this._invalidateCategoryCache();
                
                // Clean up any orphaned items (items that might be in memory but not persisted)
                // This can happen if a save failed previously
                this.cleanupOrphanedItems(storageKey);
                
                // If we loaded from old key, migrate to store-specific key
                if (loadedFromOldKey && window.storeManager) {
                    const currentStoreData = localStorage.getItem(storageKey);
                    if (!currentStoreData) {
                        console.log('Migrating data to store-specific key:', storageKey);
                        try {
                            await this.saveData();
                            console.log('✓ Migration complete - data saved to:', storageKey);
                            // Clean up old key after successful migration (only if it's a non-store key)
                            if (oldKeyUsed === 'eBayItemManager') {
                                localStorage.removeItem('eBayItemManager');
                                console.log('Removed old key: eBayItemManager');
                            } else if (oldKeyUsed === 'EbayListingLife' && storageKey !== 'EbayListingLife') {
                                // Only remove if we're using store manager (to avoid breaking non-store data)
                                localStorage.removeItem('EbayListingLife');
                                console.log('Removed old key: EbayListingLife');
                            }
                        } catch (migrationErr) {
                            console.error('Error during migration:', migrationErr);
                            // Don't fail - data is already loaded, just migration failed
                        }
                    } else {
                        console.log('Data already exists in store-specific key, skipping migration');
                    }
                }
            } catch (err) {
                console.error('✗ Error parsing listing data:', err);
                console.error('Raw data (first 200 chars):', savedData ? savedData.substring(0, 200) : 'null');
                this.categories = [];
                this.items = [];
                // Don't add sample data if there was a parse error - data might be corrupted
            }
        } else {
            // No data found - start with empty arrays
            this.categories = [];
            this.items = [];
        }
    }

    toggleImportSection() {
        const importSection = document.getElementById('importItemsSection');
        if (importSection) {
            const isVisible = importSection.style.display !== 'none';
            importSection.style.display = isVisible ? 'none' : 'block';
        }
    }

    async handleItemsFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileNameEl = document.getElementById('importItemsFileName');
        const statusEl = document.getElementById('importItemsStatus');
        
        if (fileNameEl) fileNameEl.textContent = file.name;
        this.showImportItemsStatus('Processing file...', 'info');

        try {
            const items = await this.parseItemsFile(file);
            if (items && items.length > 0) {
                await this.processImportedItems(items);
                this.showImportItemsStatus(`Successfully imported ${items.length} item(s)`, 'success');
                
                // Clear file input
                e.target.value = '';
                if (fileNameEl) fileNameEl.textContent = '';
                
                // Refresh the view
                this.loadData();
                if (this.currentView === 'categories') {
                    this.showCategoriesView();
                } else if (this.currentView === 'items' && this.selectedCategoryId) {
                    this.showCategoryItems(this.selectedCategoryId);
                }
            } else {
                this.showImportItemsStatus('No items found in file. Please check the file format.', 'warning');
            }
        } catch (error) {
            console.error('Error importing file:', error);
            this.showImportItemsStatus('Error importing file: ' + error.message, 'error');
        }
    }

    async parseItemsFile(file) {
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.split('.').pop();

        if (fileExtension === 'csv') {
            return await this.parseItemsCSV(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            return await this.parseItemsExcel(file);
        } else {
            throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx, .xls) files.');
        }
    }

    async parseItemsCSV(file) {
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
                    const nameIndex = this.findColumnIndex(headers, ['name', 'title', 'item name', 'item', 'item title', 'listing title']);
                    const categoryIndex = this.findColumnIndex(headers, ['category', 'cat', 'category name']);
                    const dateAddedIndex = this.findColumnIndex(headers, ['date added', 'dateadded', 'date_added', 'added date', 'start date', 'listed date']);
                    const endDateIndex = this.findColumnIndex(headers, ['end date', 'enddate', 'end_date', 'ending date', 'expiry date', 'expires']);
                    const imageIndex = this.findColumnIndex(headers, ['image', 'image url', 'url', 'photo', 'picture', 'image link', 'imageurl', 'photourl', 'imagelink', 'image_url', 'photo_url', 'image-link', 'photo-link', 'img', 'img url', 'imgurl']);
                    const descriptionIndex = this.findColumnIndex(headers, ['description', 'desc', 'details']);
                    const noteIndex = this.findColumnIndex(headers, ['note', 'notes', 'comment', 'comments']);

                    if (nameIndex === -1 || categoryIndex === -1 || dateAddedIndex === -1 || endDateIndex === -1) {
                        reject(new Error('CSV must contain columns for: Name, Category, Date Added, and End Date. Image URL, Description, and Note are optional.'));
                        return;
                    }

                    // Parse data rows
                    const items = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = this.parseCSVLine(lines[i]);
                        if (values.length < Math.max(nameIndex, categoryIndex, dateAddedIndex, endDateIndex) + 1) continue;

                        const name = values[nameIndex]?.trim() || '';
                        const categoryName = values[categoryIndex]?.trim() || '';
                        const dateAddedStr = values[dateAddedIndex]?.trim() || '';
                        const endDateStr = values[endDateIndex]?.trim() || '';
                        let imageUrl = imageIndex >= 0 ? (values[imageIndex]?.trim() || '') : '';
                        const description = descriptionIndex >= 0 ? (values[descriptionIndex]?.trim() || '') : '';
                        const note = noteIndex >= 0 ? (values[noteIndex]?.trim() || '') : '';

                        if (!name || !categoryName || !dateAddedStr || !endDateStr) continue;

                        // Clean up image URL - remove quotes
                        if (imageUrl) {
                            imageUrl = imageUrl.replace(/^["']|["']$/g, '').trim();
                        }

                        // Validate dates
                        const dateAdded = new Date(dateAddedStr);
                        const endDate = new Date(endDateStr);
                        if (isNaN(dateAdded.getTime()) || isNaN(endDate.getTime())) continue;
                        if (endDate < dateAdded) continue;

                        items.push({
                            name: name,
                            categoryName: categoryName,
                            dateAdded: dateAddedStr,
                            endDate: endDateStr,
                            photo: imageUrl || null,
                            description: description || '',
                            note: note || ''
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

    async parseItemsExcel(file) {
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
                            const name = this.findValueInRow(row, ['name', 'title', 'item name', 'item', 'item title', 'listing title']);
                            const categoryName = this.findValueInRow(row, ['category', 'cat', 'category name']);
                            const dateAddedStr = this.findValueInRow(row, ['date added', 'dateadded', 'date_added', 'added date', 'start date', 'listed date']);
                            const endDateStr = this.findValueInRow(row, ['end date', 'enddate', 'end_date', 'ending date', 'expiry date', 'expires']);
                            let imageUrl = this.findValueInRow(row, ['image', 'image url', 'url', 'photo', 'picture', 'image link', 'imageurl', 'photourl', 'imagelink', 'image_url', 'photo_url', 'image-link', 'photo-link', 'img', 'img url', 'imgurl']);
                            const description = this.findValueInRow(row, ['description', 'desc', 'details']);
                            const note = this.findValueInRow(row, ['note', 'notes', 'comment', 'comments']);

                            if (!name || !categoryName || !dateAddedStr || !endDateStr) return;

                            // Clean up image URL
                            if (imageUrl) {
                                imageUrl = String(imageUrl).replace(/^["']|["']$/g, '').trim();
                            }

                            // Validate dates
                            const dateAdded = new Date(dateAddedStr);
                            const endDate = new Date(endDateStr);
                            if (isNaN(dateAdded.getTime()) || isNaN(endDate.getTime())) return;
                            if (endDate < dateAdded) return;

                            items.push({
                                name: String(name).trim(),
                                categoryName: String(categoryName).trim(),
                                dateAdded: String(dateAddedStr).trim(),
                                endDate: String(endDateStr).trim(),
                                photo: imageUrl || null,
                                description: description ? String(description).trim() : '',
                                note: note ? String(note).trim() : ''
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

    async processImportedItems(importedItems) {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const itemData of importedItems) {
            try {
                // Find or create category
                let category = this.categories.find(c => c.name.toLowerCase().trim() === itemData.categoryName.toLowerCase().trim());
                
                if (!category) {
                    // Create new category
                    const timestamp = new Date().toISOString();
                    category = {
                        id: this.generateId('cat'),
                        name: itemData.categoryName,
                        description: '',
                        averageDays: 30,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    };
                    this.categories.push(category);
                }

                // Calculate duration
                const start = new Date(itemData.dateAdded);
                const end = new Date(itemData.endDate);
                const diffMs = end - start;
                let duration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                duration = Math.max(duration, 1);

                // Create item
                const timestamp = new Date().toISOString();
                const newItem = {
                    id: this.generateId('item'),
                    categoryId: category.id,
                    name: itemData.name,
                    description: itemData.description || '',
                    note: itemData.note || '',
                    dateAdded: itemData.dateAdded,
                    duration: duration,
                    photo: itemData.photo || null,
                    createdAt: timestamp,
                    updatedAt: timestamp
                };

                // Check for duplicates
                const duplicateItem = this.items.find(item =>
                    item.categoryId === category.id &&
                    !this.isItemEnded(item) &&
                    item.name &&
                    item.name.trim().toLowerCase() === itemData.name.toLowerCase().trim()
                );

                if (duplicateItem) {
                    // Skip duplicates silently or log them
                    console.log(`Skipping duplicate item: ${itemData.name} in category ${itemData.categoryName}`);
                    continue;
                }

                this.items.push(newItem);
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(`${itemData.name}: ${error.message}`);
                console.error(`Error processing item ${itemData.name}:`, error);
            }
        }

        // Save all items
        try {
            await this.saveData();
            if (errorCount > 0) {
                this.showImportItemsStatus(`Imported ${successCount} item(s), ${errorCount} error(s). Errors: ${errors.join('; ')}`, 'warning');
            } else {
                this.showImportItemsStatus(`Successfully imported ${successCount} item(s)`, 'success');
            }
            
            // Invalidate cache after bulk import
            this._invalidateCategoryCache();
        } catch (error) {
            console.error('Error saving imported items:', error);
            this.showImportItemsStatus(`Imported ${successCount} item(s) but failed to save: ${error.message}`, 'error');
            // Still invalidate cache even if save failed
            this._invalidateCategoryCache();
        }
    }

    showImportItemsStatus(message, type = 'info') {
        const statusEl = document.getElementById('importItemsStatus');
        if (!statusEl) return;
        
        statusEl.style.display = 'block';
        statusEl.textContent = message;
        statusEl.className = `import-status import-status-${type}`;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    async addSampleData() {
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
        await this.saveData();
    }
}

// Initialize the app
// Wait for DOM and store manager to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a tick to ensure storeManager is initialized
        setTimeout(() => {
            const app = new EbayListingLife();
            window.app = app;
        }, 0);
    });
} else {
    // DOM already loaded, wait a tick for storeManager
    setTimeout(() => {
        const app = new EbayListingLife();
        window.app = app;
    }, 0);
}

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