/* ═══════════════════════════════════════════
   COACHAY — _i18n.js  v1.0
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

    var LOCALE_V = '20260820c';
    function load(lang) {
        return fetch('locales/' + lang + '.json?v=' + LOCALE_V)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                _data = data;
                _ready = true;
                if (document.readyState !== 'loading') {
                    applyI18n();
                } else {
                    document.addEventListener('DOMContentLoaded', applyI18n);
                }
                _queue.forEach(function (fn) { fn(); });
                _queue.length = 0;
            })
            .catch(function () {
                if (lang !== 'pl') return load('pl');
            });
    }

    window._i18nReady = load(_lang);
})();
