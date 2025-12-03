// Dark Mode Toggle Functionality
(function() {
    'use strict';

    // Initialize dark mode on page load
    function initDarkMode() {
        const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
        const toggle = document.getElementById('darkModeToggle');
        
        if (toggle) {
            toggle.checked = darkModeEnabled;
            applyDarkMode(darkModeEnabled);
        }
    }

    // Apply dark mode
    function applyDarkMode(enabled) {
        const html = document.documentElement;
        const body = document.body;
        
        if (enabled) {
            html.setAttribute('data-theme', 'dark');
            // Set body background for dark mode (prevents flash)
            if (body) {
                body.style.backgroundColor = '#0a0a0a';
            }
        } else {
            html.removeAttribute('data-theme');
            // Clear inline body background style to use CSS variable instead
            if (body) {
                body.style.backgroundColor = '';
            }
        }
        localStorage.setItem('darkMode', enabled.toString());
    }

    // Toggle dark mode
    function toggleDarkMode() {
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            applyDarkMode(toggle.checked);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initDarkMode();
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) {
                toggle.addEventListener('change', toggleDarkMode);
            }
        });
    } else {
        initDarkMode();
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            toggle.addEventListener('change', toggleDarkMode);
        }
    }
})();

