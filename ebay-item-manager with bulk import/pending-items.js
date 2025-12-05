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
                    let text = e.target.result;
                    // Remove BOM if present at the start of the file
                    text = text.replace(/^\uFEFF/, '');
                    
                    // Split by newlines and filter out completely empty lines
                    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
                    
                    if (lines.length < 2) {
                        reject(new Error('CSV file must have at least a header row and one data row'));
                        return;
                    }

                    // Parse header
                    const headers = this.parseCSVLine(lines[0]);
                    
                    // Filter out empty header columns
                    const nonEmptyHeaders = headers.filter((h, i) => h && h.trim().length > 0);
                    if (nonEmptyHeaders.length === 0) {
                        reject(new Error('CSV header row appears to be empty. Please ensure your CSV has column headers.'));
                        return;
                    }
                    
                    // Clean headers: remove BOM and normalize
                    const cleanedHeaders = headers.map(h => h.replace(/^\uFEFF/, '').trim());
                    
                    // Debug: log found headers
                    console.log('CSV Headers found:', cleanedHeaders);
                    
                    // eBay-specific column name variations (case-insensitive matching handles most, but be explicit)
                    const titleIndex = this.findColumnIndex(cleanedHeaders, [
                        'item title', 'itemtitle', 'item_title', 'item-title',
                        'title', 'item name', 'itemname', 'item_name', 'item-name',
                        'name', 'item', 'listing title', 'listingtitle', 'listing_title',
                        'product title', 'producttitle', 'product_title',
                        'item description', 'description'
                    ]);
                    const imageIndex = this.findColumnIndex(cleanedHeaders, [
                        'image', 'image url', 'imageurl', 'image_url', 'image-url',
                        'url', 'photo', 'picture', 'image link', 'imagelink', 'image_link',
                        'photourl', 'photo_url', 'photo-url', 'photolink', 'photo_link',
                        'image-link', 'photo-link', 'img', 'img url', 'imgurl', 'img_url',
                        'thumbnail', 'thumbnail url', 'thumbnailurl'
                    ]);
                    const priceIndex = this.findColumnIndex(cleanedHeaders, [
                        'item subtotal', 'itemsubtotal', 'item_subtotal', 'item-subtotal',
                        'subtotal', 'price', 'amount', 'sale price', 'saleprice', 'sale_price',
                        'sold price', 'soldprice', 'sold_price', 'total', 'item price',
                        'itemprice', 'item_price', 'final value', 'finalvalue', 'final_value',
                        'transaction amount', 'transactionamount', 'transaction_amount',
                        'gross transaction', 'grosstransaction', 'gross_transaction'
                    ]);
                    const refundIndex = this.findColumnIndex(cleanedHeaders, ['refund', 'refunds', 'refund amount', 'refundamount']);

                    if (titleIndex === -1 || priceIndex === -1) {
                        // Provide helpful error message with found columns
                        const foundColumns = cleanedHeaders.filter(h => h).join(', ');
                        let errorMsg = 'CSV must contain columns for Item Title and Item Subtotal. Image URL is optional.\n\n';
                        errorMsg += `Found columns: ${foundColumns || '(none)'}\n\n`;
                        if (titleIndex === -1) {
                            errorMsg += 'Missing: Item Title (or Title, Name, Item, Listing Title)\n';
                        }
                        if (priceIndex === -1) {
                            errorMsg += 'Missing: Item Subtotal (or Subtotal, Price, Amount, Sale Price, Sold Price, Total)';
                        }
                        reject(new Error(errorMsg));
                        return;
                    }
                    
                    console.log(`Found columns - Title: "${cleanedHeaders[titleIndex]}" (index ${titleIndex}), Subtotal: "${cleanedHeaders[priceIndex]}" (index ${priceIndex})`);
                    console.log(`Total rows to process: ${lines.length - 1}`);

                    // Parse data rows
                    const items = [];
                    let skippedRows = 0;
                    let skippedReasons = { noTitle: 0, noPrice: 0, invalidPrice: 0, notEnoughColumns: 0, payoutRow: 0, emptyRow: 0 };
                    
                    // Pattern to detect divider rows/values (rows that are just '---', '##', '___', etc.)
                    const dividerPattern = /^[-=#_\s]+$/;
                    
                    for (let i = 1; i < lines.length; i++) {
                        try {
                            const values = this.parseCSVLine(lines[i]);
                            
                            // Skip completely empty rows
                            if (values.length === 0 || values.every(v => !v || v.trim().length === 0)) {
                                skippedRows++;
                                skippedReasons.emptyRow++;
                                continue;
                            }
                            
                            // Skip divider rows (rows that are mostly '---', '##', or similar divider characters)
                            const isDividerRow = values.every(v => {
                                const trimmed = (v || '').trim();
                                return trimmed.length === 0 || dividerPattern.test(trimmed);
                            });
                            if (isDividerRow) {
                                skippedRows++;
                                skippedReasons.emptyRow++;
                                continue;
                            }
                            
                            // Clean divider characters from values (remove leading/trailing '---', '##', etc.)
                            const cleanedValues = values.map(v => {
                                if (!v) return '';
                                let cleaned = String(v).trim();
                                // Remove divider patterns at start/end
                                cleaned = cleaned.replace(/^[-=#_\s]+/, '').replace(/[-=#_\s]+$/, '');
                                return cleaned;
                            });
                            
                            // Check if we have enough columns (be very lenient - just check if indices exist)
                            // If indices are out of bounds, try to pad the array
                            while (cleanedValues.length <= Math.max(titleIndex, priceIndex)) {
                                cleanedValues.push('');
                            }

                            const title = (cleanedValues[titleIndex] || '').trim();
                            const priceStr = (cleanedValues[priceIndex] || '').trim();
                            let imageUrl = imageIndex >= 0 && imageIndex < cleanedValues.length ? ((cleanedValues[imageIndex] || '').trim()) : '';
                            const refundStr = refundIndex >= 0 && refundIndex < cleanedValues.length ? ((cleanedValues[refundIndex] || '').trim()) : '';
                            
                            // Skip payout rows in eBay transaction reports (they often have "#### Payout" or similar)
                            // Check if this looks like a payout row (usually has empty title but might have other indicators)
                            const firstFewValues = cleanedValues.slice(0, 5).join(' ').toLowerCase();
                            if (firstFewValues.includes('payout') || 
                                firstFewValues.includes('#### payout') ||
                                firstFewValues.includes('## payout') ||
                                (firstFewValues.includes('payout') && !title)) {
                                skippedRows++;
                                skippedReasons.payoutRow++;
                                continue;
                            }
                            
                            // Skip if title is just divider characters after cleaning
                            if (dividerPattern.test(title)) {
                                skippedRows++;
                                skippedReasons.noTitle++;
                                continue;
                            }
                            
                            // Clean up image URL - remove quotes and whitespace
                            if (imageUrl) {
                                imageUrl = imageUrl.replace(/^["']|["']$/g, '').trim();
                            }

                            // Skip if no title (but be more lenient - allow very short titles)
                            if (!title || title.length === 0) {
                                skippedRows++;
                                skippedReasons.noTitle++;
                                continue;
                            }

                            // Skip if no price string (but try to extract from other columns if price column is empty)
                            let finalPriceStr = priceStr;
                            // Clean divider characters from price string
                            if (finalPriceStr) {
                                finalPriceStr = finalPriceStr.replace(/^[-=#_\s]+/, '').replace(/[-=#_\s]+$/, '').trim();
                            }
                            
                            if (!finalPriceStr || finalPriceStr.length === 0) {
                                // Try to find price in other common columns (skip divider columns)
                                for (let j = 0; j < cleanedValues.length; j++) {
                                    let val = (cleanedValues[j] || '').trim();
                                    // Clean divider characters
                                    val = val.replace(/^[-=#_\s]+/, '').replace(/[-=#_\s]+$/, '').trim();
                                    // Skip if it's just divider characters
                                    if (dividerPattern.test(val)) continue;
                                    
                                    const testPrice = this.parsePrice(val);
                                    if (!isNaN(testPrice) && testPrice > 0) {
                                        finalPriceStr = val;
                                        break;
                                    }
                                }
                            }
                            
                            if (!finalPriceStr || finalPriceStr.length === 0) {
                                skippedRows++;
                                skippedReasons.noPrice++;
                                continue;
                            }

                            const price = this.parsePrice(finalPriceStr);
                            if (isNaN(price)) {
                                skippedRows++;
                                skippedReasons.invalidPrice++;
                                // Log the problematic price for debugging (first 10)
                                if (skippedReasons.invalidPrice <= 10) {
                                    console.warn(`Skipped row ${i + 1}: Invalid price "${finalPriceStr}" (original: "${priceStr}")`);
                                    console.warn(`  Row values (first 10):`, cleanedValues.slice(0, 10));
                                    console.warn(`  Title: "${title}"`);
                                }
                                continue;
                            }
                            
                            // Allow negative prices (refunds) - convert to positive for display
                            const displayPrice = Math.abs(price);

                            // Build notes with refund information if applicable
                            let notes = '';
                            if (refundStr) {
                                const refund = this.parsePrice(refundStr);
                                if (!isNaN(refund) && refund !== 0) {
                                    notes = `Refund: ${refundStr}`;
                                }
                            }

                            items.push({
                                label: title,
                                price: displayPrice, // Use absolute value for display
                                photo: imageUrl || null,
                                note: notes || null
                            });
                        } catch (rowError) {
                            skippedRows++;
                            console.warn(`Error parsing row ${i + 1}:`, rowError);
                        }
                    }

                    console.log(`=== CSV Import Summary ===`);
                    console.log(`Total rows in file: ${lines.length - 1}`);
                    console.log(`Items imported: ${items.length}`);
                    console.log(`Rows skipped: ${skippedRows}`);
                    if (skippedRows > 0) {
                        console.log('Skip reasons:', skippedReasons);
                        console.log(`  - Empty rows: ${skippedReasons.emptyRow}`);
                        console.log(`  - Payout rows: ${skippedReasons.payoutRow}`);
                        console.log(`  - No title: ${skippedReasons.noTitle}`);
                        console.log(`  - No price: ${skippedReasons.noPrice}`);
                        console.log(`  - Invalid price: ${skippedReasons.invalidPrice}`);
                        console.log(`  - Not enough columns: ${skippedReasons.notEnoughColumns}`);
                    }
                    console.log(`========================`);

                    if (items.length === 0) {
                        reject(new Error(`No valid items found in CSV. ${skippedRows} rows were skipped. Reasons: ${JSON.stringify(skippedReasons)}`));
                        return;
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

                        console.log(`Processing ${jsonData.length} rows from Excel file`);
                        console.log('Excel headers:', Object.keys(jsonData[0] || {}));
                        
                        const items = [];
                        let excelSkipped = 0;
                        let excelImported = 0;
                        
                        // Pattern to detect divider rows/values
                        const dividerPattern = /^[-=#_\s]+$/;
                        
                        jsonData.forEach((row, index) => {
                            try {
                                // Clean divider characters from row values
                                const cleanedRow = {};
                                Object.keys(row).forEach(key => {
                                    let value = row[key];
                                    if (value !== null && value !== undefined) {
                                        value = String(value).trim();
                                        // Remove divider patterns at start/end
                                        value = value.replace(/^[-=#_\s]+/, '').replace(/[-=#_\s]+$/, '');
                                        // Skip if it's just divider characters
                                        if (!dividerPattern.test(value)) {
                                            cleanedRow[key] = value;
                                        }
                                    }
                                });
                                
                                // Skip divider rows (rows that are mostly dividers)
                                const rowValues = Object.values(cleanedRow);
                                if (rowValues.length === 0 || rowValues.every(v => !v || dividerPattern.test(String(v)))) {
                                    excelSkipped++;
                                    return;
                                }
                                
                                const title = this.findValueInRow(cleanedRow, [
                                'item title', 'itemtitle', 'item_title', 'item-title',
                                'title', 'item name', 'itemname', 'item_name', 'item-name',
                                'name', 'item', 'listing title', 'listingtitle', 'listing_title',
                                'product title', 'producttitle', 'product_title',
                                'item description', 'description'
                            ]);
                                let priceStr = this.findValueInRow(cleanedRow, [
                                    'item subtotal', 'itemsubtotal', 'item_subtotal', 'item-subtotal',
                                    'subtotal', 'price', 'amount', 'sale price', 'saleprice', 'sale_price',
                                    'sold price', 'soldprice', 'sold_price', 'total', 'item price',
                                    'itemprice', 'item_price', 'final value', 'finalvalue', 'final_value',
                                    'transaction amount', 'transactionamount', 'transaction_amount',
                                    'gross transaction', 'grosstransaction', 'gross_transaction'
                                ]);
                                let imageUrl = this.findValueInRow(cleanedRow, [
                                    'image', 'image url', 'imageurl', 'image_url', 'image-url',
                                    'url', 'photo', 'picture', 'image link', 'imagelink', 'image_link',
                                    'photourl', 'photo_url', 'photo-url', 'photolink', 'photo_link',
                                    'image-link', 'photo-link', 'img', 'img url', 'imgurl', 'img_url',
                                    'thumbnail', 'thumbnail url', 'thumbnailurl'
                                ]);
                                const refundStr = this.findValueInRow(cleanedRow, ['refund', 'refunds', 'refund amount', 'refundamount']);

                                // Skip payout rows
                                const firstFewValues = Object.values(cleanedRow).slice(0, 5).join(' ').toLowerCase();
                                if (firstFewValues.includes('payout') || 
                                    firstFewValues.includes('#### payout') ||
                                    firstFewValues.includes('## payout') ||
                                    (firstFewValues.includes('payout') && !title)) {
                                    excelSkipped++;
                                    return;
                                }
                                
                                // Skip if title is just divider characters
                                if (!title || dividerPattern.test(title)) {
                                    excelSkipped++;
                                    return;
                                }
                                
                                // Try to find price in other columns if price column is empty
                                if (!priceStr || priceStr.length === 0) {
                                    for (const [key, value] of Object.entries(cleanedRow)) {
                                        if (value && !dividerPattern.test(String(value))) {
                                            const testPrice = this.parsePrice(String(value));
                                            if (!isNaN(testPrice) && testPrice > 0) {
                                                priceStr = String(value);
                                                break;
                                            }
                                        }
                                    }
                                }

                                if (!priceStr || priceStr.length === 0) {
                                    excelSkipped++;
                                    return;
                                }

                                const price = this.parsePrice(String(priceStr));
                                if (isNaN(price)) {
                                    excelSkipped++;
                                    if (excelSkipped <= 10) {
                                        console.warn(`Skipped Excel row ${index + 1}: Invalid price "${priceStr}"`);
                                    }
                                    return;
                                }
                                
                                // Allow negative prices (refunds) - convert to positive for display
                                const displayPrice = Math.abs(price);
                                
                                excelImported++;

                                // Clean up image URL - remove quotes and whitespace
                                if (imageUrl) {
                                    imageUrl = String(imageUrl).replace(/^["']|["']$/g, '').trim();
                                }

                                // Build notes with refund information if applicable
                                let notes = '';
                                if (refundStr) {
                                    const refund = this.parsePrice(String(refundStr));
                                    if (!isNaN(refund) && refund !== 0) {
                                        notes = `Refund: ${refundStr}`;
                                    }
                                }

                                items.push({
                                    label: String(title).trim(),
                                    price: displayPrice, // Use absolute value for display
                                    photo: imageUrl || null,
                                    note: notes || null
                                });
                            } catch (rowError) {
                                excelSkipped++;
                                console.warn(`Error processing Excel row ${index + 1}:`, rowError);
                            }
                        });

                        console.log(`Excel import complete: ${excelImported} items imported, ${excelSkipped} rows skipped`);
                        if (items.length === 0) {
                            reject(new Error(`No valid items found in Excel file. ${excelSkipped} rows were skipped.`));
                            return;
                        }

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
        // Remove BOM if present
        line = line.replace(/^\uFEFF/, '');
        
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                // Don't include the quote character in the value
            } else if (char === ',' && !inQuotes) {
                // Trim and normalize whitespace
                values.push(current.trim().replace(/\s+/g, ' '));
                current = '';
            } else {
                current += char;
            }
        }
        // Trim and normalize the last value
        values.push(current.trim().replace(/\s+/g, ' '));
        
        return values;
    }

    findColumnIndex(headers, possibleNames) {
        // Normalize headers: remove BOM, trim, and handle various whitespace
        const normalizedHeaders = headers.map(h => {
            // Remove BOM (Byte Order Mark) if present
            let normalized = h.replace(/^\uFEFF/, '').trim();
            // Replace multiple spaces with single space
            normalized = normalized.replace(/\s+/g, ' ');
            return normalized.toLowerCase();
        });
        
        for (const name of possibleNames) {
            const normalizedName = name.toLowerCase().trim();
            // Try exact match first
            let index = normalizedHeaders.indexOf(normalizedName);
            if (index !== -1) return index;
            
            // Try partial match (in case of extra words like "Item Title (required)")
            index = normalizedHeaders.findIndex(h => h.includes(normalizedName));
            if (index !== -1) return index;
            
            // Try reverse partial match (in case header is shorter)
            index = normalizedHeaders.findIndex(h => normalizedName.includes(h));
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
        if (!priceStr) {
            return NaN;
        }
        
        // Convert to string if it's not already
        if (typeof priceStr !== 'string') {
            priceStr = String(priceStr);
        }
        
        // Remove currency symbols, currency codes, and whitespace
        // Handle: £42.00, $42.00, €42.00, 42.00 GBP, 42.00 USD, etc.
        let cleaned = priceStr
            .replace(/[£$€¥,]/g, '') // Remove currency symbols and thousand separators
            .replace(/\s*(GBP|USD|EUR|AUD|CAD|JPY|CNY|POUND|DOLLAR|EURO)\s*/gi, '') // Remove currency codes
            .replace(/\s+/g, '') // Remove all whitespace
            .trim();
        
        // Handle negative values (refunds, etc.) - keep the sign
        const isNegative = cleaned.startsWith('-');
        if (isNegative) {
            cleaned = cleaned.substring(1);
        }
        
        // Extract number (handle cases like "42.00" or "42,00" or just "42")
        // Replace comma decimal separator with dot (but be careful - some locales use comma for thousands)
        // If comma is followed by exactly 2 digits, it's likely a decimal separator
        cleaned = cleaned.replace(/,(\d{2})$/, '.$1'); // "42,00" -> "42.00"
        
        // Remove any remaining non-numeric characters except decimal point and minus sign
        cleaned = cleaned.replace(/[^\d.-]/g, '');
        
        const parsed = parseFloat(cleaned);
        
        if (isNaN(parsed)) {
            return NaN;
        }
        
        return isNegative ? -parsed : parsed;
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
                note: this.currentMovingItem.note || null,
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

