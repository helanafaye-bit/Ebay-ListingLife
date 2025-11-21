class ListingLifeSettingsPage {
    constructor() {
        this.SETTINGS_KEY = 'ListingLifeSettings';
        this.DEFAULT_CURRENCY = 'GBP';
        this.CURRENCY_MAP = {
            GBP: { label: 'British Pound', symbol: '£', locale: 'en-GB' },
            USD: { label: 'US Dollar', symbol: '$', locale: 'en-US' },
            EUR: { label: 'Euro', symbol: '€', locale: 'de-DE' },
            AUD: { label: 'Australian Dollar', symbol: '$', locale: 'en-AU' },
            CAD: { label: 'Canadian Dollar', symbol: '$', locale: 'en-CA' }
        };

        this.currencySelect = document.getElementById('settingsCurrencySelect');
        this.statusMessage = document.getElementById('settingsCurrencyStatus');

        this.init();
    }

    init() {
        this.setupNavigation();
        this.applySavedCurrency();
        this.registerEvents();
    }

    setupNavigation() {
        const setActive = (target) => {
            document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
                btn.classList.toggle('menu-btn-active', btn.dataset.navTarget === target);
            });
        };

        setActive('settings');

        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
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
                    setActive('settings');
                }
            });
        });
    }

    registerEvents() {
        if (this.currencySelect) {
            this.currencySelect.addEventListener('change', () => this.handleCurrencyChange());
        }
    }

    handleCurrencyChange() {
        if (!this.currencySelect) return;
        const selectedCode = this.currencySelect.value;
        this.saveSettings({ soldCurrency: selectedCode });
        this.renderStatus(`Currency updated to ${this.describeCurrency(selectedCode)}.`);
    }

    applySavedCurrency() {
        if (!this.currencySelect) return;
        const settings = this.loadSettings();
        const savedCurrency = settings.soldCurrency && this.CURRENCY_MAP[settings.soldCurrency]
            ? settings.soldCurrency
            : this.DEFAULT_CURRENCY;

        this.currencySelect.value = savedCurrency;
        this.renderStatus(`Currently using ${this.describeCurrency(savedCurrency)}.`);
    }

    describeCurrency(code) {
        const meta = this.CURRENCY_MAP[code] || this.CURRENCY_MAP[this.DEFAULT_CURRENCY];
        return `${code} (${meta.symbol})`;
    }

    renderStatus(message) {
        if (!this.statusMessage) return;
        this.statusMessage.textContent = message;
    }

    loadSettings() {
        try {
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey(this.SETTINGS_KEY) : this.SETTINGS_KEY;
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.warn('Unable to parse settings; using defaults.', error);
            return {};
        }
    }

    saveSettings(patch) {
        const current = this.loadSettings();
        const updated = { ...current, ...patch };
        try {
            const storageKey = window.storeManager ? window.storeManager.getStoreDataKey(this.SETTINGS_KEY) : this.SETTINGS_KEY;
            localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save settings.', error);
            this.renderStatus('Unable to save settings. Please check browser storage permissions.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.listingLifeSettingsPage = new ListingLifeSettingsPage();
});

