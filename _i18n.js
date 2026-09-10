/* ═══════════════════════════════════════════
   COACHAY — _i18n.js  v2.0
   Internacjonalizacja (PL / EN)

   Użycie:
     t('splash.tagline')                      → string
     t('druzyna.ageYears', { age: 10 })       → "10 lat"
     t('onboarding.steps')                    → array
     setLang('en')                            → reload z EN
     getLang()                                → 'pl' | 'en'

   HTML:
     <span data-i18n="splash.tagline"></span>
     <input data-i18n-placeholder="login.emailPlaceholder">
═══════════════════════════════════════════ */
(function () {
    const SUPPORTED = ['pl', 'en'];
    let _lang = localStorage.getItem('coachay_lang') || 'pl';
    if (!SUPPORTED.includes(_lang)) _lang = 'pl';

    let _data = {};
    let _ready = false;
    const _queue = [];

    // ── Spinner overlay — zakrywa stronę do czasu załadowania locale ──
    var _spinner = null;
    function _showSpinner() {
        if (_spinner) return;
        var style = document.createElement('style');
        style.textContent = [
            '#_i18n_overlay{position:fixed;inset:0;z-index:99999;background:var(--bg,#111);display:flex;align-items:center;justify-content:center;}',
            '#_i18n_overlay svg{width:40px;height:40px;animation:_i18n_spin 0.8s linear infinite;}',
            '@keyframes _i18n_spin{to{transform:rotate(360deg);}}'
        ].join('');
        document.head.appendChild(style);
        _spinner = document.createElement('div');
        _spinner.id = '_i18n_overlay';
        _spinner.innerHTML = '<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="var(--akcent,#3B82F6)" stroke-width="4" stroke-dasharray="80 40"/></svg>';
        document.body ? document.body.appendChild(_spinner) : document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(_spinner); });
    }
    function _hideSpinner() {
        if (_spinner && _spinner.parentNode) _spinner.parentNode.removeChild(_spinner);
        _spinner = null;
    }

    function resolve(key) {
        return key.split('.').reduce(function (o, k) {
            return o !== null && o !== undefined ? o[k] : null;
        }, _data);
    }

    function interpolate(str, vars) {
        if (!vars || typeof str !== 'string') return str;
        return str.replace(/\{\{(\w+)\}\}/g, function (_, k) {
            return vars[k] !== undefined ? vars[k] : '{{' + k + '}}';
        });
    }

    window.t = function (key, vars) {
        var val = resolve(key);
        if (val === null || val === undefined) return key;
        if (typeof val === 'string') return interpolate(val, vars);
        return val;
    };

    window.getLang = function () { return _lang; };

    window.setLang = function (lang) {
        if (!SUPPORTED.includes(lang)) return;
        localStorage.setItem('coachay_lang', lang);
        window.location.reload();
    };

    window.onI18nReady = function (fn) {
        if (_ready) { fn(); } else { _queue.push(fn); }
    };

    function applyI18n() {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var val = window.t(el.getAttribute('data-i18n'));
            if (typeof val === 'string') el.textContent = val;
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var val = window.t(el.getAttribute('data-i18n-html'));
            if (typeof val === 'string') el.innerHTML = val;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var val = window.t(el.getAttribute('data-i18n-placeholder'));
            if (typeof val === 'string') el.placeholder = val;
        });
        document.querySelectorAll('[data-lang]').forEach(function (btn) {
            btn.classList.toggle('lang-active', btn.getAttribute('data-lang') === _lang);
        });
        document.documentElement.lang = _lang;
    }

    function _finish(data) {
        if (data) _data = data;
        _ready = true;
        if (document.readyState !== 'loading') {
            applyI18n();
            _hideSpinner();
        } else {
            document.addEventListener('DOMContentLoaded', function() { applyI18n(); _hideSpinner(); });
        }
        _queue.forEach(function (fn) { fn(); });
        _queue.length = 0;
    }

    var LOCALE_V = '20260910c';
    var TIMEOUT_MS = 3000;

    function load(lang) {
        var timeout = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('timeout')); }, TIMEOUT_MS);
        });
        return Promise.race([
            fetch('locales/' + lang + '.json?v=' + LOCALE_V).then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            }),
            timeout
        ])
        .then(function(data) { _finish(data); })
        .catch(function() {
            if (lang !== 'pl') {
                return fetch('locales/pl.json?v=' + LOCALE_V)
                    .then(function(r) { return r.json(); })
                    .then(function(data) { _finish(data); })
                    .catch(function() { _finish(null); }); // fallback: pusta locale, brak freeze
            }
            _finish(null);
        });
    }

    _showSpinner();
    window._i18nReady = load(_lang);
})();
