document.addEventListener('DOMContentLoaded', () => {
    const updateActiveNav = (target) => {
        document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
            btn.classList.toggle('menu-btn-active', btn.dataset.navTarget === target);
        });
    };

    updateActiveNav('home');

    document.querySelectorAll('.menu-btn[data-nav-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = btn.dataset.navTarget;
            if (target === 'home') {
                updateActiveNav('home');
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

    const getStartedBtn = document.getElementById('landingGetStarted');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.setItem('listingLifeSkipHome', 'true');
            window.location.href = './ebaylistings.html?skipHome=1';
        });
    }
});

