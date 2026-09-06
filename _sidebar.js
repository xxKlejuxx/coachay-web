/* _sidebar.js — wstrzykuje sidebar na każdy ekran desktop */
(function () {
    // Czcionki Google — preconnect + stylesheet (szybciej niż @import w CSS)
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        var pc1 = document.createElement('link'); pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com';
        var pc2 = document.createElement('link'); pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = '';
        var fl  = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Syne:wght@700;800&display=block';
        document.head.appendChild(pc1);
        document.head.appendChild(pc2);
        document.head.appendChild(fl);
        if (document.body) {
            document.body.style.visibility = 'hidden';
            document.fonts.ready.then(function(){ document.body.style.visibility = 'visible'; });
        }
    }

    // _desktop.css ładowany natychmiast (skrypt jest w <head>)
    if (!document.querySelector('link[href*="_desktop.css"]')) {
        var lnk = document.createElement('link');
        lnk.rel = 'stylesheet';
        lnk.href = '_desktop.css';
        document.head.appendChild(lnk);
    }

    function applyI18nToSidebar() {
        var sidebar = document.getElementById('app-sidebar');
        if (!sidebar || typeof t !== 'function') return;
        sidebar.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });
    }

    function openSidebar() {
        var s = document.getElementById('app-sidebar');
        var o = document.getElementById('sidebar-overlay');
        if (s) s.classList.add('mobile-open');
        if (o) o.classList.add('open');
    }

    function closeSidebar() {
        var s = document.getElementById('app-sidebar');
        var o = document.getElementById('sidebar-overlay');
        if (s) s.classList.remove('mobile-open');
        if (o) o.classList.remove('open');
    }

    window._sidebarOpen  = openSidebar;
    window._sidebarClose = closeSidebar;

    function inject() {
        if (document.getElementById('app-sidebar')) return;
        var html = [
            '<div id="sidebar-overlay" onclick="window._sidebarClose()"></div>',
            '<aside class="sidebar" id="app-sidebar">',
            '  <div class="sidebar-brand">COACHAY</div>',
            '  <div class="sidebar-brand-sub" data-i18n="sidebar.tagline">Platforma dla trenerów</div>',
            '  <div class="sidebar-section sidebar-flex">',
            '    <a class="sidebar-link" href="start.html"><span class="sidebar-link-icon">🏠</span> <span data-i18n="sidebar.start">Start</span></a>',
            '    <a class="sidebar-link" href="druzyna.html"><span class="sidebar-link-icon">👥</span> <span data-i18n="sidebar.team">Drużyna</span></a>',
            '    <a class="sidebar-link" href="klub.html"><span class="sidebar-link-icon">🏟️</span> <span data-i18n="sidebar.club">Klub</span></a>',
            '    <a class="sidebar-link" href="trenerzy.html"><span class="sidebar-link-icon">🎽</span> <span data-i18n="sidebar.trainers">Trenerzy</span></a>',
            '    <a class="sidebar-link" href="raporty.html"><span class="sidebar-link-icon">📊</span> <span data-i18n="sidebar.reports">Raporty</span></a>',
            '    <a class="sidebar-link" href="ustawienia.html"><span class="sidebar-link-icon">⚙️</span> <span data-i18n="sidebar.settings">Ustawienia</span></a>',
            '    <a class="sidebar-link" href="platnosci.html"><span class="sidebar-link-icon">💳</span> <span data-i18n="sidebar.payments">Płatności</span></a>',
            '    <a class="sidebar-link" id="sidebar-support" href="support.html" style="display:none"><span class="sidebar-link-icon">🛠️</span> <span>Support</span></a>',
            '  </div>',
            '  <div class="sidebar-bottom">',
            '    <a class="sidebar-link" href="profil.html"><span class="sidebar-link-icon">👤</span> <span data-i18n="sidebar.profile">Mój profil</span></a>',
            '    <button class="sidebar-link sidebar-logout" onclick="logout()"><span class="sidebar-link-icon">🚪</span> <span data-i18n="sidebar.logout">Wyloguj</span></button>',
            '  </div>',
            '</aside>'
        ].join('\n');

        document.body.insertAdjacentHTML('afterbegin', html);

        // Hamburger + logout — wstaw do top-bar jeśli istnieje
        var topBar = document.querySelector('.top-bar');
        if (topBar) {
            // Logout button (mobile only)
            var logoutBtn = document.createElement('button');
            logoutBtn.id = 'sidebar-logout-btn';
            logoutBtn.innerHTML = '🚪';
            logoutBtn.style.display = 'none';
            logoutBtn.onclick = function() { if (typeof logout === 'function') logout(); };
            topBar.appendChild(logoutBtn);

            // Hamburger
            var btn = document.createElement('button');
            btn.id = 'sidebar-hamburger';
            btn.innerHTML = '☰';
            btn.style.display = 'none'; // ukryty domyślnie; _desktop.css pokaże na mobile
            btn.onclick = openSidebar;
            topBar.insertBefore(btn, topBar.firstChild);
        }

        // Aktywny link — dopasuj do bieżącej strony
        var page = location.pathname.split('/').pop() || 'start.html';
        document.querySelectorAll('#app-sidebar .sidebar-link').forEach(function (a) {
            if (a.getAttribute('href') === page) a.classList.add('active');
        });

        // Zastosuj i18n po załadowaniu tłumaczeń
        if (typeof onI18nReady === 'function') {
            onI18nReady(applyI18nToSidebar);
        }
    }

    if (document.body) {
        inject();
    } else {
        document.addEventListener('DOMContentLoaded', inject);
    }
})();
