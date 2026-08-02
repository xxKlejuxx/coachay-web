#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix navigation in czat.html, ogloszenia.html, gielda.html, ustawienia.html"""
import os

BASE = r'C:\Users\rafal\Documents\Claude_AI\Coachay'

# ────────────────────────────────────────────────
# Canonical blocks (from start.html)
# ────────────────────────────────────────────────
TOP_BAR_CANONICAL = '''        <div class="top-bar">
            <div class="ctx-switcher" onclick="toggleCtxOv()">
                <div class="ctx-dot" id="ctx-dot"></div>
                <div class="ctx-text"><span class="ctx-klub" id="ctx-klub"></span><span class="ctx-team" id="ctx-team"></span></div>
                <span class="ctx-arrow">▾</span>
            </div>
            <div class="top-bar-right">
                <button class="bell-btn" onclick="toggleNotifOv()">🔔<span class="bell-count" id="bell-count" style="display:none"></span></button>
                <div class="menu-btn" id="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
            </div>
        </div>'''

CTX_NOTIF_OVERLAYS = '''        <div class="ctx-overlay" id="ctx-ov">
            <div class="ov-label">Wybierz klub i zespół</div>
            <div class="ctx-klub-row" id="ctx-klub-row"><div class="ctx-klub-dot" id="ctx-ov-dot"></div><span class="ctx-klub-name" id="ctx-ov-klub-name"></span><span class="ctx-klub-role" id="ctx-ov-klub-role"></span></div>
            <div class="ctx-teams" id="ctx-teams"></div>
        </div>
        <div class="notif-overlay" id="notif-ov">
            <div class="notif-hdr"><span class="notif-tytul">Powiadomienia</span><span class="notif-clear" onclick="clearNotifs()">Wyczyść przeczytane</span></div>
        </div>'''

LOGIN_OVERLAY = '''        <div class="login-overlay" id="login-ov">
            <div class="login-handle" onclick="closeLogin()"><div class="login-handle-bar"></div></div>
            <button class="login-close" onclick="closeLogin()">✕</button>
            <div class="login-body">
                <div class="login-logo"><div class="login-logo-txt">COACHAY</div><div class="login-logo-sub">Platforma dla trenerów i drużyn</div></div>
                <div class="auth-tabs"><button class="auth-tab active" onclick="authTab(this,'login')">Logowanie</button><button class="auth-tab" onclick="authTab(this,'register')">Rejestracja</button></div>
                <div id="auth-login">
                    <div class="form-group"><label class="form-lbl">E-mail</label><input type="email" class="form-inp" placeholder="twoj@email.pl"></div>
                    <div class="form-group"><label class="form-lbl">Hasło</label><input type="password" class="form-inp" placeholder="••••••••"></div>
                    <button class="btn-primary" style="width:100%;padding:15px" onclick="closeLogin()">Zaloguj się →</button>
                    <div class="auth-div"><div class="auth-div-line"></div><span class="auth-div-txt">lub</span><div class="auth-div-line"></div></div>
                    <div class="social-btns"><button class="social-btn"><span style="font-size:17px;font-weight:900">G</span> Google</button><button class="social-btn"><span style="font-size:17px">🍎</span> Apple</button></div>
                </div>
                <div id="auth-register" style="display:none">
                    <div class="form-group"><label class="form-lbl">Kod dostępu</label><input type="text" class="form-inp" placeholder="7K2M4X" style="letter-spacing:4px;font-weight:900;text-transform:uppercase;text-align:center;font-family:var(--font-d);font-size:18px"></div>
                    <div class="form-group"><label class="form-lbl">Imię i nazwisko</label><input type="text" class="form-inp" placeholder="Jan Kowalski"></div>
                    <div class="form-group"><label class="form-lbl">E-mail</label><input type="email" class="form-inp" placeholder="twoj@email.pl"></div>
                    <div class="form-group"><label class="form-lbl">Hasło</label><input type="password" class="form-inp" placeholder="min. 8 znaków"></div>
                    <button class="btn-primary" style="width:100%;padding:15px" onclick="closeLogin()">Zarejestruj się →</button>
                    <div class="kod-info"><div class="kod-info-txt">🔑 Kod dostępu otrzymasz od trenera lub opiekuna.<br>Jednorazowy · ważny 7 dni</div></div>
                </div>
            </div>
        </div>'''

MENU_PANEL = '''        <div class="menu-panel-overlay" id="menu-overlay" onclick="closeMenu()"></div>
        <div class="menu-panel" id="menu-panel">
            <div class="menu-panel-top"><div class="menu-panel-avatar" id="menu-avatar"></div><div class="menu-panel-name" id="menu-name"></div><div class="menu-panel-role" id="menu-role"></div></div>
            <div class="menu-panel-items">
                <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">👤</div><span class="menu-item-label">Profil</span><span class="menu-item-arrow">›</span></div>
                <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">🎽</div><span class="menu-item-label">Trenerzy</span><span class="menu-item-arrow">›</span></div>
                <div class="menu-item" onclick="window.location.href='gielda.html'"><div class="menu-item-icon">🤝</div><span class="menu-item-label">Giełda sparingów</span><span class="menu-item-arrow">›</span></div>
                <div class="menu-item" onclick="window.location.href='ustawienia.html'"><div class="menu-item-icon">⚙️</div><span class="menu-item-label">Ustawienia</span><span class="menu-item-arrow">›</span></div>
                <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">💳</div><span class="menu-item-label">Płatności</span><span class="menu-item-arrow">›</span></div>
                <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">📋</div><span class="menu-item-label">Historia ogłoszeń</span><span class="menu-item-arrow">›</span></div>
                <div class="menu-item" onclick="window.location.href='zadania.html'"><div class="menu-item-icon">✅</div><span class="menu-item-label">Historia zadań</span><span class="menu-item-arrow">›</span></div>
            </div>
            <div class="menu-panel-bottom"><div class="menu-logout" onclick="closeMenu()"><span class="menu-logout-icon">🚪</span><span class="menu-logout-txt">Wyloguj się</span></div></div>
        </div>'''

BOTTOM_NAV_CZAT = '''        <div class="bottom-nav">
            <a class="nav-item" href="start.html"><span class="nav-icon">🏠</span><span class="nav-label">Start</span></a>
            <a class="nav-item" href="druzyna.html"><span class="nav-icon">👥</span><span class="nav-label">Drużyna</span></a>
            <a class="nav-item nav-mecz" href="mecz.html"><div class="nav-mecz-bubble">🏆</div><span class="nav-label">Mecz</span></a>
            <a class="nav-item active" href="czat.html"><span class="nav-icon">💬</span><span class="nav-label">Czat</span></a>
            <a class="nav-item" href="kalendarz.html"><span class="nav-icon">📅</span><span class="nav-label">Kalendarz</span></a>
        </div>'''

BOTTOM_NAV_OGLOSZENIA = '''  <div class="bottom-nav">
    <a class="nav-item" href="start.html"><span class="nav-icon">🏠</span><span class="nav-label">Start</span></a>
    <a class="nav-item" href="druzyna.html"><span class="nav-icon">👥</span><span class="nav-label">Drużyna</span></a>
    <a class="nav-item nav-mecz" href="mecz.html"><div class="nav-mecz-bubble">🏆</div><span class="nav-label">Mecz</span></a>
    <a class="nav-item" href="czat.html"><span class="nav-icon">💬</span><span class="nav-label">Czat</span></a>
    <a class="nav-item" href="kalendarz.html"><span class="nav-icon">📅</span><span class="nav-label">Kalendarz</span></a>
  </div>'''

MENU_PANEL_OGLOSZENIA = '''  <div class="menu-panel-overlay" id="menu-overlay" onclick="closeMenu()"></div>
  <div class="menu-panel" id="menu-panel">
    <div class="menu-panel-top"><div class="menu-panel-avatar" id="menu-avatar"></div><div class="menu-panel-name" id="menu-name"></div><div class="menu-panel-role" id="menu-role"></div></div>
    <div class="menu-panel-items">
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">👤</div><span class="menu-item-label">Profil</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">🎽</div><span class="menu-item-label">Trenerzy</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="window.location.href='gielda.html'"><div class="menu-item-icon">🤝</div><span class="menu-item-label">Giełda sparingów</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="window.location.href='ustawienia.html'"><div class="menu-item-icon">⚙️</div><span class="menu-item-label">Ustawienia</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">💳</div><span class="menu-item-label">Płatności</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">📋</div><span class="menu-item-label">Historia ogłoszeń</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="window.location.href='zadania.html'"><div class="menu-item-icon">✅</div><span class="menu-item-label">Historia zadań</span><span class="menu-item-arrow">›</span></div>
    </div>
    <div class="menu-panel-bottom"><div class="menu-logout" onclick="closeMenu()"><span class="menu-logout-icon">🚪</span><span class="menu-logout-txt">Wyloguj się</span></div></div>
  </div>'''

LOGIN_OVERLAY_OGLOSZENIA = '''  <div class="login-overlay" id="login-ov">
    <div class="login-handle" onclick="closeLogin()"><div class="login-handle-bar"></div></div>
    <button class="login-close" onclick="closeLogin()">✕</button>
    <div class="login-body">
      <div class="login-logo"><div class="login-logo-txt">COACHAY</div><div class="login-logo-sub">Platforma dla trenerów i drużyn</div></div>
      <div class="auth-tabs"><button class="auth-tab active" onclick="authTab(this,'login')">Logowanie</button><button class="auth-tab" onclick="authTab(this,'register')">Rejestracja</button></div>
      <div id="auth-login">
        <div class="form-group"><label class="form-lbl">E-mail</label><input type="email" class="form-inp" placeholder="twoj@email.pl"></div>
        <div class="form-group"><label class="form-lbl">Hasło</label><input type="password" class="form-inp" placeholder="••••••••"></div>
        <button class="btn-primary" style="width:100%;padding:15px" onclick="closeLogin()">Zaloguj się →</button>
        <div class="auth-div"><div class="auth-div-line"></div><span class="auth-div-txt">lub</span><div class="auth-div-line"></div></div>
        <div class="social-btns"><button class="social-btn"><span style="font-size:17px;font-weight:900">G</span> Google</button><button class="social-btn"><span style="font-size:17px">🍎</span> Apple</button></div>
      </div>
      <div id="auth-register" style="display:none">
        <div class="form-group"><label class="form-lbl">Kod dostępu</label><input type="text" class="form-inp" placeholder="7K2M4X" style="letter-spacing:4px;font-weight:900;text-transform:uppercase;text-align:center;font-family:var(--font-d);font-size:18px"></div>
        <div class="form-group"><label class="form-lbl">Imię i nazwisko</label><input type="text" class="form-inp" placeholder="Jan Kowalski"></div>
        <div class="form-group"><label class="form-lbl">E-mail</label><input type="email" class="form-inp" placeholder="twoj@email.pl"></div>
        <div class="form-group"><label class="form-lbl">Hasło</label><input type="password" class="form-inp" placeholder="min. 8 znaków"></div>
        <button class="btn-primary" style="width:100%;padding:15px" onclick="closeLogin()">Zarejestruj się →</button>
        <div class="kod-info"><div class="kod-info-txt">🔑 Kod dostępu otrzymasz od trenera lub opiekuna.<br>Jednorazowy · ważny 7 dni</div></div>
      </div>
    </div>
  </div>'''


# ────────────────────────────────────────────────────────────────
# Helper
# ────────────────────────────────────────────────────────────────
def patch(path, replacements):
    """Apply list of (old, new) string replacements to a file."""
    with open(path, encoding='utf-8') as f:
        src = f.read()
    for old, new in replacements:
        if old not in src:
            print(f'  BRAK w {os.path.basename(path)}: {repr(old[:60])}')
        else:
            src = src.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f'  OK {os.path.basename(path)}')


# ────────────────────────────────────────────────────────────────
# czat.html
# ────────────────────────────────────────────────────────────────
print('Fixing czat.html...')
czat = os.path.join(BASE, 'czat.html')
patch(czat, [
    # 1. Fix top bar
    (
        '''        <div class="top-bar">
            <div class="ctx-switcher" onclick="toggleCtxOv()">
                <div class="ctx-dot" id="ctx-dot">O</div>
                <div class="ctx-text">
                    <span class="ctx-klub" id="ctx-klub">Orły Praga FC</span>
                    <span class="ctx-team" id="ctx-team">U10 Orły</span>
                </div>
                <span class="ctx-arrow">▾</span>
            </div>
            <div class="top-bar-right">
                <button class="bell-btn" onclick="toggleNotifOv()">🔔<span class="bell-count">3</span></button>
                <div class="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
            </div>
        </div>''',
        TOP_BAR_CANONICAL + '\n' + CTX_NOTIF_OVERLAYS
    ),
    # 2. Fix bottom nav (add nav-mecz class, change Giełda → Kalendarz)
    (
        '''        <div class="bottom-nav">
            <a class="nav-item" href="start.html"><span class="nav-icon">🏠</span><span class="nav-label">Start</span></a>
            <a class="nav-item" href="druzyna.html"><span class="nav-icon">👥</span><span class="nav-label">Drużyna</span></a>
            <a class="nav-item" href="mecz.html"><div class="nav-mecz-bubble">🏆</div><span class="nav-label">Mecz</span></a>
            <a class="nav-item active" href="czat.html"><span class="nav-icon">💬</span><span class="nav-label">Czat</span></a>
            <a class="nav-item" href="gielda.html"><span class="nav-icon">🤝</span><span class="nav-label">Giełda</span></a>
        </div>''',
        BOTTOM_NAV_CZAT
    ),
    # 3. Add login-overlay and menu-panel before closing phone div
    (
        '''        </div>

    <script src="coachay-core.js?v=20260324">''',
        '''        </div>

''' + LOGIN_OVERLAY + '\n\n' + MENU_PANEL + '''

    </div>

    <script src="coachay-core.js?v=20260324">'''
    ),
])


# ────────────────────────────────────────────────────────────────
# ogloszenia.html
# ────────────────────────────────────────────────────────────────
print('Fixing ogloszenia.html...')
ogl = os.path.join(BASE, 'ogloszenia.html')
with open(ogl, encoding='utf-8') as f:
    src = f.read()

# 1. Fix top bar (has emoji rendering issues - ? placeholders)
old_topbar = '''  <!-- TOP BAR -->
  <div class="top-bar">
    <div class="ctx-switcher" onclick="toggleCtxOv()">
      <div class="ctx-dot" id="ctx-dot">O</div>
      <div class="ctx-text">
        <span class="ctx-klub" id="ctx-klub">Orły Praga FC</span>
        <span class="ctx-team" id="ctx-team">U10 Orły</span>
      </div>
      <span class="ctx-arrow">?</span>
    </div>
    <div class="top-bar-right">
      <button class="bell-btn" onclick="toggleNotifOv()">??<span class="bell-count" id="bell-count">3</span></button>
      <div class="menu-btn" id="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
    </div>
  </div>'''
new_topbar = '''  <!-- TOP BAR -->
  <div class="top-bar">
    <div class="ctx-switcher" onclick="toggleCtxOv()">
      <div class="ctx-dot" id="ctx-dot"></div>
      <div class="ctx-text"><span class="ctx-klub" id="ctx-klub"></span><span class="ctx-team" id="ctx-team"></span></div>
      <span class="ctx-arrow">▾</span>
    </div>
    <div class="top-bar-right">
      <button class="bell-btn" onclick="toggleNotifOv()">🔔<span class="bell-count" id="bell-count" style="display:none"></span></button>
      <div class="menu-btn" id="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
    </div>
  </div>'''

# 2. Fix overlays
old_overlays = '''  <!-- OVERLAYS -->
  <div class="ctx-overlay" id="ctx-ov"></div>
  <div class="notif-overlay" id="notif-ov"></div>'''
new_overlays = '''  <!-- OVERLAYS -->
  <div class="ctx-overlay" id="ctx-ov">
    <div class="ov-label">Wybierz klub i zespół</div>
    <div class="ctx-klub-row" id="ctx-klub-row"><div class="ctx-klub-dot" id="ctx-ov-dot"></div><span class="ctx-klub-name" id="ctx-ov-klub-name"></span><span class="ctx-klub-role" id="ctx-ov-klub-role"></span></div>
    <div class="ctx-teams" id="ctx-teams"></div>
  </div>
  <div class="notif-overlay" id="notif-ov">
    <div class="notif-hdr"><span class="notif-tytul">Powiadomienia</span><span class="notif-clear" onclick="clearNotifs()">Wyczyść przeczytane</span></div>
  </div>'''

# 3. Fix bottom nav (old bn-item classes → nav-item)
old_bn = '''  <!-- BOTTOM NAV -->
  <div class="bottom-nav">
    <a href="start.html" class="bn-item"><div class="bn-icon">??</div><div class="bn-label">Start</div></a>
    <a href="druzyna.html" class="bn-item"><div class="bn-icon">??</div><div class="bn-label">Drużyna</div></a>
    <a href="mecz.html" class="bn-item"><div class="bn-icon">?</div><div class="bn-label">Mecz</div></a>
    <a href="czat.html" class="bn-item"><div class="bn-icon">??</div><div class="bn-label">Czat</div></a>
    <a href="gielda.html" class="bn-item"><div class="bn-icon">??</div><div class="bn-label">Giełda</div></a>
  </div>'''

# 4. Fix menu panel (old structure)
old_menu = '''  <!-- MENU PANEL -->
  <div class="menu-overlay" id="menu-overlay" onclick="closeMenu()"></div>
  <div class="menu-panel" id="menu-panel">
    <div class="menu-panel-header">
      <div class="menu-panel-user">
        <div class="menu-panel-avatar">JK</div>
        <div class="menu-panel-info">
          <div class="menu-panel-name" id="menu-user-name">Jan Kowalski</div>
          <div class="menu-panel-role" id="menu-user-role">Trener Główny</div>
        </div>
      </div>
    </div>
        <div class="menu-panel-body">
      <a href="start.html" class="menu-item"><span class="menu-item-icon">??</span><span class="menu-item-txt">Start</span></a>
      <a href="ogloszenia.html" class="menu-item"><span class="menu-item-icon">??</span><span class="menu-item-txt">Ogłoszenia</span></a>
      <a href="druzyna.html" class="menu-item"><span class="menu-item-icon">??</span><span class="menu-item-txt">Drużyna</span></a>
      <a href="#" class="menu-item"><span class="menu-item-icon">??</span><span class="menu-item-txt">Kody dostępu</span></a>
      <a href="#" class="menu-item"><span class="menu-item-icon">??</span><span class="menu-item-txt">Statystyki</span></a>
      <a href="#" class="menu-item"><span class="menu-item-icon">??</span><span class="menu-item-txt">Ustawienia</span></a>
    </div>
    <div class="menu-panel-bottom">
      <div class="menu-logout" onclick="logout()"><span class="menu-logout-icon">??</span><span class="menu-logout-txt">Wyloguj się</span></div>
    </div>
  </div>'''

for old, new in [
    (old_topbar, new_topbar),
    (old_overlays, new_overlays),
    (old_bn, BOTTOM_NAV_OGLOSZENIA),
    (old_menu, LOGIN_OVERLAY_OGLOSZENIA + '\n\n' + MENU_PANEL_OGLOSZENIA),
]:
    if old not in src:
        print(f'  BRAK: {repr(old[:60])}')
    else:
        src = src.replace(old, new, 1)

with open(ogl, 'w', encoding='utf-8') as f:
    f.write(src)
print('  OK ogloszenia.html')


# ────────────────────────────────────────────────────────────────
# gielda.html
# ────────────────────────────────────────────────────────────────
print('Fixing gielda.html...')
gielda = os.path.join(BASE, 'gielda.html')
patch(gielda, [
    # 1. Fix top bar (remove hardcoded content)
    (
        '''  <div class="top-bar">
    <div class="ctx-switcher" onclick="toggleCtxOv()">
      <div class="ctx-dot" id="ctx-dot">O</div>
      <div class="ctx-text">
        <span class="ctx-klub" id="ctx-klub">Orły Praga FC</span>
        <span class="ctx-team" id="ctx-team">U10 Orły</span>
      </div>
      <span class="ctx-arrow">▾</span>
    </div>
    <div class="top-bar-right">
      <button class="bell-btn" onclick="toggleNotifOv()">🔔<span class="bell-count" id="bell-count">3</span></button>
      <div class="menu-btn" id="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
    </div>
  </div>''',
        '''  <div class="top-bar">
    <div class="ctx-switcher" onclick="toggleCtxOv()">
      <div class="ctx-dot" id="ctx-dot"></div>
      <div class="ctx-text"><span class="ctx-klub" id="ctx-klub"></span><span class="ctx-team" id="ctx-team"></span></div>
      <span class="ctx-arrow">▾</span>
    </div>
    <div class="top-bar-right">
      <button class="bell-btn" onclick="toggleNotifOv()">🔔<span class="bell-count" id="bell-count" style="display:none"></span></button>
      <div class="menu-btn" id="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
    </div>
  </div>'''
    ),
    # 2. Fix ctx-overlay (add ctx-klub-row and ctx-teams)
    (
        '''  <div class="ctx-overlay" id="ctx-ov">
    <div class="ov-label">Wybierz klub i zespół</div>
  </div>''',
        '''  <div class="ctx-overlay" id="ctx-ov">
    <div class="ov-label">Wybierz klub i zespół</div>
    <div class="ctx-klub-row" id="ctx-klub-row"><div class="ctx-klub-dot" id="ctx-ov-dot"></div><span class="ctx-klub-name" id="ctx-ov-klub-name"></span><span class="ctx-klub-role" id="ctx-ov-klub-role"></span></div>
    <div class="ctx-teams" id="ctx-teams"></div>
  </div>'''
    ),
    # 3. Fix notif-overlay (add notif-clear)
    (
        '''  <div class="notif-overlay" id="notif-ov">
    <div class="notif-hdr"><span class="notif-tytul">Powiadomienia</span></div>
  </div>''',
        '''  <div class="notif-overlay" id="notif-ov">
    <div class="notif-hdr"><span class="notif-tytul">Powiadomienia</span><span class="notif-clear" onclick="clearNotifs()">Wyczyść przeczytane</span></div>
  </div>'''
    ),
    # 4. Fix bottom nav: Giełda active → Kalendarz (not active)
    (
        '    <a class="nav-item active" href="gielda.html"><span class="nav-icon">🤝</span><span class="nav-label">Giełda</span></a>',
        '    <a class="nav-item" href="kalendarz.html"><span class="nav-icon">📅</span><span class="nav-label">Kalendarz</span></a>'
    ),
    # 5. Fix menu panel: add Giełda sparingów after Trenerzy, fix Ustawienia onclick, fix avatar/name/role ids
    (
        '''    <div class="menu-panel-top">
      <div class="menu-panel-avatar">JK</div>
      <div class="menu-panel-name">Jan Kowalski</div>
      <div class="menu-panel-role">Trener Główny · Orły Praga FC</div>
    </div>
    <div class="menu-panel-items">
        <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">👤</div><span class="menu-item-label">Profil</span><span class="menu-item-arrow">›</span></div>
        <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">🎽</div><span class="menu-item-label">Trenerzy</span><span class="menu-item-arrow">›</span></div>
        <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">⚙️</div><span class="menu-item-label">Ustawienia</span><span class="menu-item-arrow">›</span></div>
        <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">💳</div><span class="menu-item-label">Płatności</span><span class="menu-item-arrow">›</span></div>
        <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">📋</div><span class="menu-item-label">Historia ogłoszeń</span><span class="menu-item-arrow">›</span></div>
        <div class="menu-item" onclick="window.location.href='zadania.html'">
            <div class="menu-item-icon">✅</div>
            <span class="menu-item-label">Historia zadań</span>
            <span class="menu-item-arrow">›</span>
        </div>
    </div>''',
        '''    <div class="menu-panel-top"><div class="menu-panel-avatar" id="menu-avatar"></div><div class="menu-panel-name" id="menu-name"></div><div class="menu-panel-role" id="menu-role"></div></div>
    <div class="menu-panel-items">
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">👤</div><span class="menu-item-label">Profil</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">🎽</div><span class="menu-item-label">Trenerzy</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="window.location.href='gielda.html'"><div class="menu-item-icon">🤝</div><span class="menu-item-label">Giełda sparingów</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="window.location.href='ustawienia.html'"><div class="menu-item-icon">⚙️</div><span class="menu-item-label">Ustawienia</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">💳</div><span class="menu-item-label">Płatności</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">📋</div><span class="menu-item-label">Historia ogłoszeń</span><span class="menu-item-arrow">›</span></div>
      <div class="menu-item" onclick="window.location.href='zadania.html'"><div class="menu-item-icon">✅</div><span class="menu-item-label">Historia zadań</span><span class="menu-item-arrow">›</span></div>
    </div>'''
    ),
])


# ────────────────────────────────────────────────────────────────
# ustawienia.html
# ────────────────────────────────────────────────────────────────
print('Fixing ustawienia.html...')
ust = os.path.join(BASE, 'ustawienia.html')
with open(ust, encoding='utf-8') as f:
    src = f.read()

# 1. Fix top bar (remove hardcoded content) + remove duplicate ctx-text/arrow after top-bar
old_topbar_ust = '''        <!-- TOP BAR -->
        <div class="top-bar">
            <div class="ctx-switcher" onclick="toggleCtxOv()">
                <div class="ctx-dot" id="ctx-dot">O</div>
                <div class="ctx-text">
                    <span class="ctx-klub" id="ctx-klub">Orły Praga FC</span>
                    <span class="ctx-team" id="ctx-team">U10 Orły</span>
                </div>
                <span class="ctx-arrow">▾</span>
            </div>
            <div class="top-bar-right">
                <button class="bell-btn" onclick="toggleNotifOv()">
                    🔔
                    <span class="bell-count" id="bell-count">3</span>
                </button>
                <div class="menu-btn" id="menu-btn" onclick="toggleMenu()">
                    <div class="menu-btn-lines">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        </div>

        <div class="ctx-text">
            <span class="ctx-klub" id="ctx-klub">Orły Praga FC</span>
            <span class="ctx-team" id="ctx-team">U10 Orły</span>
        </div>
        <span class="ctx-arrow">▾</span>
    </div>'''
new_topbar_ust = '''        <!-- TOP BAR -->
        <div class="top-bar">
            <div class="ctx-switcher" onclick="toggleCtxOv()">
                <div class="ctx-dot" id="ctx-dot"></div>
                <div class="ctx-text"><span class="ctx-klub" id="ctx-klub"></span><span class="ctx-team" id="ctx-team"></span></div>
                <span class="ctx-arrow">▾</span>
            </div>
            <div class="top-bar-right">
                <button class="bell-btn" onclick="toggleNotifOv()">🔔<span class="bell-count" id="bell-count" style="display:none"></span></button>
                <div class="menu-btn" id="menu-btn" onclick="toggleMenu()"><div class="menu-btn-lines"><span></span><span></span><span></span></div></div>
            </div>
        </div>'''

# 2. Fix ctx-overlay (replace hardcoded content with dynamic ids)
old_ctx_ov = '''    <!-- OVERLAY KONTEKST -->
    <div class="ctx-overlay" id="ctx-ov">
        <div class="ov-label">Wybierz klub i zespół</div>
        <div class="ctx-klub-row">
            <div class="ctx-klub-dot">OP</div>
            <span class="ctx-klub-name">Orły Praga FC</span>
            <span class="ctx-klub-role">Trener Główny</span>
        </div>
        <div class="ctx-teams">
            <div class="ctx-team-opt selected" onclick="pickCtx(this,'Orły Praga FC','U10 Orły','O','linear-gradient(135deg,#3B82F6,#1D4ED8)','Trener Główny')">
                <div class="ctx-team-color" style="background:#3B82F6"></div>
                <span class="ctx-team-name">U10 Orły</span><span class="ctx-team-role">Trener Główny</span><span class="ctx-team-check">✓</span>
            </div>
            <div class="ctx-team-opt" onclick="pickCtx(this,'Orły Praga FC','U12 Lwy','L','linear-gradient(135deg,#16A34A,#166534)','Pomocniczy')">
                <div class="ctx-team-color" style="background:#16A34A"></div>
                <span class="ctx-team-name">U12 Lwy</span><span class="ctx-team-role">Pomocniczy</span><span class="ctx-team-check">✓</span>
            </div>
            <div class="ctx-team-opt" onclick="pickCtx(this,'Orły Praga FC','U8 Tygrysy','T','linear-gradient(135deg,#DC2626,#991B1B)','Trener Główny')">
                <div class="ctx-team-color" style="background:#DC2626"></div>
                <span class="ctx-team-name">U8 Tygrysy</span><span class="ctx-team-role">Trener Główny</span><span class="ctx-team-check">✓</span>
            </div>
        </div>
    </div>'''
new_ctx_ov = '''    <!-- OVERLAY KONTEKST -->
    <div class="ctx-overlay" id="ctx-ov">
        <div class="ov-label">Wybierz klub i zespół</div>
        <div class="ctx-klub-row" id="ctx-klub-row"><div class="ctx-klub-dot" id="ctx-ov-dot"></div><span class="ctx-klub-name" id="ctx-ov-klub-name"></span><span class="ctx-klub-role" id="ctx-ov-klub-role"></span></div>
        <div class="ctx-teams" id="ctx-teams"></div>
    </div>'''

# 3. Fix notif-overlay (remove hardcoded notification items)
old_notif_ov_start = '''    <!-- OVERLAY POWIADOMIENIA -->
    <div class="notif-overlay" id="notif-ov">
        <div class="notif-hdr"><div class="notif-tytul">Powiadomienia</div><button class="notif-clear" onclick="clearNotifs()">Wyczyść</button></div>
        <div class="notif-item"><div class="notif-dot"></div><div><div class="notif-msg">[U10 Orły] Jasiek potwierdził obecność · Sob. 8 marca</div><div class="notif-time">5 min temu</div></div></div>
        <div class="notif-item"><div class="notif-dot"></div><div><div class="notif-msg">[U10 Orły] Mama Bartka: "Bartek nie przyjedzie"</div><div class="notif-time">23 min temu</div></div></div>'''
new_notif_ov_start = '''    <!-- OVERLAY POWIADOMIENIA -->
    <div class="notif-overlay" id="notif-ov">
        <div class="notif-hdr"><span class="notif-tytul">Powiadomienia</span><span class="notif-clear" onclick="clearNotifs()">Wyczyść przeczytane</span></div>'''

# 4. Fix bottom nav: ⚽→🏆, last item Ustawienia active → Kalendarz
old_bn_ust = '''    <div class="bottom-nav">
        <a class="nav-item" href="start.html"><span class="nav-icon">🏠</span><span class="nav-label">Start</span></a>
        <a class="nav-item" href="druzyna.html"><span class="nav-icon">👥</span><span class="nav-label">Drużyna</span></a>
        <a class="nav-item nav-mecz" href="mecz.html"><div class="nav-mecz-bubble">⚽</div><span class="nav-label">Mecz</span></a>
        <a class="nav-item" href="czat.html"><span class="nav-icon">💬</span><span class="nav-label">Czat</span></a>
        <a class="nav-item active" href="ustawienia.html"><span class="nav-icon">⚙️</span><span class="nav-label">Ustawienia</span></a>
    </div>'''
new_bn_ust = '''    <div class="bottom-nav">
        <a class="nav-item" href="start.html"><span class="nav-icon">🏠</span><span class="nav-label">Start</span></a>
        <a class="nav-item" href="druzyna.html"><span class="nav-icon">👥</span><span class="nav-label">Drużyna</span></a>
        <a class="nav-item nav-mecz" href="mecz.html"><div class="nav-mecz-bubble">🏆</div><span class="nav-label">Mecz</span></a>
        <a class="nav-item" href="czat.html"><span class="nav-icon">💬</span><span class="nav-label">Czat</span></a>
        <a class="nav-item" href="kalendarz.html"><span class="nav-icon">📅</span><span class="nav-label">Kalendarz</span></a>
    </div>'''

# 5. Fix menu panel: add Giełda sparingów after Trenerzy
old_menu_ust = '''        <div class="menu-panel-items">
            <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">👤</div><span class="menu-item-label">Profil</span><span class="menu-item-arrow">›</span></div>
            <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">🎽</div><span class="menu-item-label">Trenerzy</span><span class="menu-item-arrow">›</span></div>
            <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">⚙️</div><span class="menu-item-label">Ustawienia</span><span class="menu-item-arrow">›</span></div>'''
new_menu_ust = '''        <div class="menu-panel-items">
            <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">👤</div><span class="menu-item-label">Profil</span><span class="menu-item-arrow">›</span></div>
            <div class="menu-item" onclick="closeMenu()"><div class="menu-item-icon">🎽</div><span class="menu-item-label">Trenerzy</span><span class="menu-item-arrow">›</span></div>
            <div class="menu-item" onclick="window.location.href='gielda.html'"><div class="menu-item-icon">🤝</div><span class="menu-item-label">Giełda sparingów</span><span class="menu-item-arrow">›</span></div>
            <div class="menu-item" onclick="window.location.href='ustawienia.html'"><div class="menu-item-icon">⚙️</div><span class="menu-item-label">Ustawienia</span><span class="menu-item-arrow">›</span></div>'''

# 6. Fix menu panel avatar/name/role ids
old_avatar_ust = '''        <div class="menu-panel-top">
            <div class="menu-panel-avatar">JK</div>
            <div class="menu-panel-name">Jan Kowalski</div>
            <div class="menu-panel-role">Trener Główny · Orły Praga FC</div>
        </div>'''
new_avatar_ust = '''        <div class="menu-panel-top"><div class="menu-panel-avatar" id="menu-avatar"></div><div class="menu-panel-name" id="menu-name"></div><div class="menu-panel-role" id="menu-role"></div></div>'''

for old, new in [
    (old_topbar_ust, new_topbar_ust),
    (old_ctx_ov, new_ctx_ov),
    (old_notif_ov_start, new_notif_ov_start),
    (old_bn_ust, new_bn_ust),
    (old_avatar_ust, new_avatar_ust),
    (old_menu_ust, new_menu_ust),
]:
    if old not in src:
        print(f'  BRAK: {repr(old[:70])}')
    else:
        src = src.replace(old, new, 1)

with open(ust, 'w', encoding='utf-8') as f:
    f.write(src)
print('  OK ustawienia.html')

print('\nWszystko gotowe!')
