/* ═══════════════════════════════════════════
   COACHAY — _i18n.js  v3.0
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
    const LOCALE_V  = '20260910d';

    let _lang = localStorage.getItem('coachay_lang') || 'pl';
    if (!SUPPORTED.includes(_lang)) _lang = 'pl';

    let _data  = {};
    let _ready = false;
    const _queue = [];

    const CACHE_KEY = 'coachay_i18n_' + _lang;
    const CACHE_VER = 'coachay_i18n_ver_' + _lang;

    /* ── KROK 1: Natychmiastowe załadowanie z localStorage ── */
    try {
        var _cv = localStorage.getItem(CACHE_VER);
        var _cd = localStorage.getItem(CACHE_KEY);
        if (_cd && _cv === LOCALE_V) {
            _data = JSON.parse(_cd);
        }
    } catch (e) {}

    if (Object.keys(_data).length > 0) {
        _ready = true;
    }

    /* ── Helpers ── */
    function resolve(key) {
        return key.split('.').reduce(function (o, k) {
            return (o !== null && o !== undefined) ? o[k] : null;
        }, _data);
    }

    function interpolate(str, vars) {
        if (!vars || typeof str !== 'string') return str;
        return str.replace(/\{\{(\w+)\}\}/g, function (_, k) {
            return vars[k] !== undefined ? vars[k] : '{{' + k + '}}';
        });
    }

    /* ── API publiczne ── */
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

    function _markReady() {
        _ready = true;
        if (document.readyState !== 'loading') {
            applyI18n();
        } else {
            document.addEventListener('DOMContentLoaded', applyI18n);
        }
        _queue.forEach(function (fn) { fn(); });
        _queue.length = 0;
    }

    /* ── KROK 2 & 3: Sprawdź wersję i aktualizuj cache ── */
    function _fetchAndCache(lang, onSuccess, onError) {
        return fetch('locales/' + lang + '.json?v=' + LOCALE_V)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(onSuccess)
            .catch(onError);
    }

    window._i18nReady = Promise.resolve();

    var _cachedVer = localStorage.getItem(CACHE_VER);

    if (_ready && _cachedVer === LOCALE_V) {
        /* ── Cache aktualny: nic do roboty ── */
        window._i18nReady = Promise.resolve();

    } else if (_ready && _cachedVer !== LOCALE_V) {
        /* ── Stare tłumaczenia w cache, nowa wersja w tle ──
           Strona działa na starym cache. Po pobraniu nowego → reload.        */
        window._i18nReady = _fetchAndCache(
            _lang,
            function (data) {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
                    localStorage.setItem(CACHE_VER, LOCALE_V);
                } catch (e) {}
                window.location.reload();
            },
            function () { /* sieć nie działa — zostajemy na starym cache */ }
        );

    } else {
        /* ── Brak cache (pierwsza wizyta / czyszczenie storage) ──
           Fetch blokujący dla _i18nReady; po sukcesie: zapisz i reload.
           Strona w tym czasie może pokazać surowe klucze przez chwilę,
           ale natychmiast po zapisie przeładuje się z gotowym cache.         */
        window._i18nReady = _fetchAndCache(
            _lang,
            function (data) {
                _data = data;
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
                    localStorage.setItem(CACHE_VER, LOCALE_V);
                } catch (e) {}
                /* Przeładuj — teraz cache jest gotowy, tłumaczenia będą instant */
                window.location.reload();
            },
            function () {
                /* Fetch główny się wywalił — spróbuj pl jako fallback */
                if (_lang !== 'pl') {
                    _fetchAndCache('pl',
                        function (data) {
                            _data = data;
                            _markReady();
                        },
                        function () { _markReady(); }
                    );
                } else {
                    _markReady();
                }
            }
        );
    }
})();
