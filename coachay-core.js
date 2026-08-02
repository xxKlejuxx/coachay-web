/* ═══════════════════════════════════════════════════
   COACHAY — GLOBAL JS
   Importuj ten plik w każdym ekranie:
   <script src="_global.js"></script>
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   FIREBASE CONFIG & INITIALIZATION
═══════════════════════════════════════════════════ */

/* COACHAY v4.1 - Updated 2026-03-28 */


// Firebase config — źródło prawdy: firebase-config.js (window.FIREBASE_CONFIG)
const firebaseConfig = window.FIREBASE_CONFIG || {
    apiKey: "AIzaSyAillNLb60TbDdwHXqViWq2ssXkFpFvW94",
    authDomain: "coachay-5c3c9.firebaseapp.com",
    projectId: "coachay-5c3c9",
    storageBucket: "coachay-5c3c9.firebasestorage.app",
    messagingSenderId: "1009757133308",
    appId: "1:1009757133308:web:776d8136fe409e12f67a79"
};

// Firebase services (będą zaimportowane w head każdego HTML)
let db = null;
let auth = null;
let _persistenceReady = Promise.resolve(); // Promise gotowości IndexedDB

// Appka natywna (Capacitor) — WebView nie zawsze zgłasza viewport wąski wystarczająco
// by złapać media query na 430px, więc ramka .phone wymuszana pełnoekranowo bezpośrednio.
// Przy zdalnym server.url bridge Capacitora wstrzykuje się asynchronicznie, więc sprawdzamy
// kilka razy zamiast tylko raz na starcie skryptu.
(function () {
    function markNativeIfDetected() {
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
            document.documentElement.classList.add('native-app');
            return true;
        }
        return false;
    }
    if (!markNativeIfDetected()) {
        document.addEventListener('DOMContentLoaded', markNativeIfDetected);
        window.addEventListener('load', markNativeIfDetected);
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (markNativeIfDetected() || tries > 20) clearInterval(iv);
        }, 100);
    }
})();

// Inicjalizacja Firebase (wywołaj po załadowaniu SDK)
function initFirebase() {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        // Offline persistence — dane w IndexedDB, kolejne wizyty błyskawiczne
        _persistenceReady = db.enablePersistence({ synchronizeTabs: true })
            .then(() => console.log('✅ Persistence: IndexedDB aktywny'))
            .catch(err => {
                if (err.code === 'failed-precondition') console.warn('⚠️ Persistence: wiele kart — wyłączone');
                else if (err.code === 'unimplemented') console.warn('⚠️ Persistence: przeglądarka nie wspiera');
                else console.warn('⚠️ Persistence error:', err.code);
            });
        console.log('✅ Firebase initialized');
    }
}

/* ═══════════════════════════════════════════════════
   DEMO MODE & USER CONTEXT
═══════════════════════════════════════════════════ */

// Sprawdź czy jesteśmy w trybie demo
function isDemoMode() {
    return localStorage.getItem('demoMode') === 'true';
}

// Generuj ID membership z typem roli w nazwie (łatwiejsze wyszukiwanie w bazie)
function makeMbrId(role) {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const rand = Math.floor(Math.random() * 9000000 + 1000000);
    const type = {
        'TRENER_GLOWNY':    'trener',
        'TRENER_POMOCNICZY':'trener',
        'TRENER':           'trener',
        'ZAWODNIK':         'zawodnik',
        'RODZIC':           'rodzic',
        'KIBIC':            'kibic',
    }[role] || 'mbr';
    return `mbr_${type}_${dateStr}_${rand}`;
}

// Generuj ID ogłoszenia: annou_RRRRMMDD_NNNNNNN
function makeAnnouId() {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const rand = Math.floor(Math.random() * 9000000 + 1000000);
    return `annou_${dateStr}_${rand}`;
}

// Generuj ID wiadomości: mess_RRRRMMDD_NNNNNNN
function makeMessId() {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const rand = Math.floor(Math.random() * 9000000 + 1000000);
    return `mess_${dateStr}_${rand}`;
}

// Pobierz aktualną rolę demo
function getDemoRole() {
    return localStorage.getItem('demoRole'); // TRENER_GLOWNY, RODZIC, ZAWODNIK, KIBIC
}

// Pobierz ID aktualnego użytkownika
function getCurrentUserId() {
    return localStorage.getItem('currentUserId');
}

// Sprawdź autoryzację — jeśli brak, redirect do login.html. Zwraca true/false.
function requireAuth() {
    if (isDemoMode()) return true;
    const userId = getCurrentUserId();
    if (!userId) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Pobierz dane aktualnego użytkownika z Firestore
async function getCurrentUser() {
    const userId = getCurrentUserId();
    if (!userId || !db) return null;

    try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
    } catch (error) {
        console.error('Error fetching user:', error);
    }
    return null;
}

// Pobierz drużynę aktualnego usera przez membership (v4.1 — bez contexts[])
async function getCurrentTeam() {
    // Jeśli initSession() już załadował drużynę — zwróć od razu
    const ud = getCurrentUserData();
    if (ud?._rawTeam) return ud._rawTeam;

    const userId = getCurrentUserId();
    if (!userId || !db) return null;

    try {
        const selectedId = localStorage.getItem('selectedMembershipId');
        let membership = null;

        if (selectedId) {
            const mDoc = await db.collection('memberships').doc(selectedId).get();
            if (mDoc.exists) membership = mDoc.data();
        }

        if (!membership) {
            const [snapNew, snapLegacy] = await Promise.all([
                db.collection('memberships')
                    .where('userId', '==', userId)
                    .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
                    .limit(1).get(),
                db.collection('memberships')
                    .where('userId', '==', userId)
                    .where('isActive', '==', true)
                    .limit(1).get()
            ]);
            const doc = snapNew.docs[0] || snapLegacy.docs[0];
            if (!doc) return null;
            const m = doc.data();
            if (m.status === 'BLOCKED' || m.status === 'REMOVED') return null;
            membership = m;
        }

        // Respektuj selectedTeamId z Firestore/localStorage (ctx-switcher)
        const selectedTeamId = localStorage.getItem('selectedTeamId');
        if (selectedTeamId && selectedTeamId !== membership.teamId) {
            // Spróbuj znaleźć membership dla wybranej drużyny
            const selSnap = await db.collection('memberships')
                .where('userId', '==', userId)
                .where('teamId', '==', selectedTeamId)
                .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
                .limit(1).get();
            if (!selSnap.empty) {
                membership = selSnap.docs[0].data();
            }
        }

        if (!membership.teamId) return null;
        const resolvedTeamId = (selectedTeamId && membership.teamId === selectedTeamId)
            ? selectedTeamId
            : membership.teamId;
        const teamDoc = await db.collection('teams').doc(resolvedTeamId).get();
        return teamDoc.exists ? { id: teamDoc.id, ...teamDoc.data() } : null;
    } catch (error) {
        console.error('❌ getCurrentTeam:', error);
        return null;
    }
}

// Zamiennik window.confirm() — natywny confirm() nie działa w Android WebView appki.
// Zwraca Promise<boolean>, więc wywołująca funkcja musi być async i użyć await.
function showConfirmSheet(message, opts = {}) {
    return new Promise((resolve) => {
        if (!document.getElementById('_csStyle')) {
            const style = document.createElement('style');
            style.id = '_csStyle';
            style.textContent = `
                .cs-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:flex-end; justify-content:center; }
                .cs-sheet { background:var(--tlo-karta,#161616); border:1px solid var(--border,#272727); border-radius:20px 20px 0 0; padding:24px 20px calc(20px + env(safe-area-inset-bottom)); width:100%; max-width:480px; box-shadow:0 -10px 40px rgba(0,0,0,0.5); }
                .cs-msg { color:var(--bialy,#fff); font-size:15px; font-weight:600; line-height:1.5; white-space:pre-line; margin-bottom:20px; }
                .cs-btns { display:flex; gap:10px; }
                .cs-btn { flex:1; padding:14px; border-radius:12px; font-weight:700; font-size:14px; border:none; cursor:pointer; font-family:inherit; }
                .cs-btn-cancel { background:var(--tlo-karta2,#1E1E1E); color:var(--szary-j,#AAAAAA); }
                .cs-btn-ok { background:var(--akcent,#3B82F6); color:#fff; }
            `;
            document.head.appendChild(style);
        }
        const overlay = document.createElement('div');
        overlay.className = 'cs-overlay';
        const sheet = document.createElement('div');
        sheet.className = 'cs-sheet';
        const msgEl = document.createElement('div');
        msgEl.className = 'cs-msg';
        msgEl.textContent = message;
        const btns = document.createElement('div');
        btns.className = 'cs-btns';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cs-btn cs-btn-cancel';
        cancelBtn.textContent = opts.cancelLabel || 'Anuluj';
        const okBtn = document.createElement('button');
        okBtn.className = 'cs-btn cs-btn-ok';
        okBtn.textContent = opts.okLabel || 'OK';
        btns.appendChild(cancelBtn);
        btns.appendChild(okBtn);
        sheet.appendChild(msgEl);
        sheet.appendChild(btns);
        overlay.appendChild(sheet);
        document.body.appendChild(overlay);

        function close(result) {
            overlay.remove();
            resolve(result);
        }
        cancelBtn.onclick = () => close(false);
        okBtn.onclick = () => close(true);
        overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    });
}

// Wyloguj (wyczyść tryb demo i wróć do login.html)
async function logout() {
    localStorage.removeItem('demoMode');
    localStorage.removeItem('demoRole');
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('selectedMembershipId');
    localStorage.removeItem('selectedTeamId'); // legacy
    localStorage.removeItem('appLastActive');   // reset PIN timer przy wylogowaniu
    try { if (auth) await auth.signOut(); } catch(e) {}
    window.location.href = 'login.html';
}

/* ═══════════════════════════════════════════════════
   AKTUALNY UŻYTKOWNIK — dane i funkcje pomocnicze
   Ustawiane raz przez setCurrentUserData() przy ładowaniu ekranu.
   Używane globalnie przez isVisible(), getMyPlayerIds() itd.
═══════════════════════════════════════════════════ */

let currentUserData = null;

// Ustaw dane aktualnego użytkownika (wywołaj raz po załadowaniu usera)
function setCurrentUserData(data) {
    currentUserData = data;
}

// Pobierz dane aktualnego użytkownika
function getCurrentUserData() {
    return currentUserData;
}

// Zwróć playerIds powiązane z userem (zawodnik: swój playerId, rodzic: childrenIds)
function getMyPlayerIds() {
    if (!currentUserData) return [];
    // RODZIC/KIBIC — childrenIds (zawodnicy powiązani przez membership)
    if (currentUserData.role === 'RODZIC' || currentUserData.role === 'KIBIC') return currentUserData.childrenIds || [];
    // ZAWODNIK/TRENER — własny playerId
    if (currentUserData.playerId) return [currentUserData.playerId];
    if (currentUserData.childrenIds?.length > 0) return currentUserData.childrenIds;
    return [];
}

// Zwróć obserwowane playerIds (dla kibica) — z membership (v4.1)
function getObservedPlayerIds() {
    if (!currentUserData) return [];
    // Kibic: playerId jest bezpośrednio w membership
    if (currentUserData.observedPlayerIds) return currentUserData.observedPlayerIds;
    return [];
}

// Sprawdź czy user WIDZI event (invited LUB visibleTo)
// invited = zawodnicy (playerId) + trenerzy (userId)  LUB ['__TEAM__'] dla scope DRUZYNA
// visibleTo = rodzice, kibice (userId) — widzą event, ale nie są na liście obecności
function isVisible(event) {
    const invited = event.attendance?.invited || [];
    const visibleTo = event.visibleTo || [];
    const myIds = getMyPlayerIds();
    const observedIds = getObservedPlayerIds();
    const userId = currentUserData?.userId;
    const myTeamId = currentUserData?.teamId;

    // Scope DRUZYNA — __TEAM__ = wszyscy członkowie drużyny (trenerzy, zawodnicy, rodzice, kibice)
    if (invited.includes('__TEAM__') && myTeamId && event.teamId === myTeamId) return true;

    // Trener/zawodnik — sprawdź invited
    if (myIds.some(id => invited.includes(id)) || invited.includes(userId)) return true;

    // Rodzic/kibic — sprawdź visibleTo
    if (visibleTo.includes(userId)) return true;

    // Kibic — sprawdź czy obserwowane dziecko jest w invited
    if (observedIds.some(id => invited.includes(id))) return true;

    // Fallback dla starych eventów bez visibleTo — szukaj userId w invited (stara logika)
    if (visibleTo.length === 0 && invited.includes(userId)) return true;

    return false;
}

// Sprawdź czy event jest w oknie widoczności (reminderHoursBefore)
// rh = 0 → zawsze widoczny (okno 7 dni obsługuje dashboard)
// rh > 0 → widoczny dopiero gdy now >= eventTime - rh*3600000
// Używane w: loadUpcomingEvents (start.html) + loadAndRenderNotifications (tu)
function isEventInReminderWindow(event) {
    const rh = event.reminderHoursBefore || 0;
    if (rh <= 0) return true;
    const evTime = new Date(event.date + 'T' + (event.timeFrom || '00:00')).getTime();
    const reminderStart = evTime - rh * 3600000;
    return Date.now() >= reminderStart;
}

// Sprawdź czy user (lub jego dzieci/playerId) potwierdził/odmówił obecność
// Sprawdź status obecności per zawodnik (zwraca mapę playerId → status)
// Dla rodzica: zwraca status każdego dziecka osobno
// Dla zawodnika: zwraca status samego siebie (playerId)
// Dla trenera: zwraca status po userId
function getAttendanceStatus(att, invited) {
    const myIds = getMyPlayerIds();
    const conf = att.confirmed || [];
    const decl = att.declined || [];
    const inv = invited || att.invited || [];
    const isTeamEvent = inv.includes('__TEAM__');
    const result = {};

    for (const id of myIds) {
        // __TEAM__ = wszyscy z drużyny są zaproszeni
        if (!isTeamEvent && !inv.includes(id)) continue;
        if (conf.includes(id)) result[id] = { status: 'confirmed', reason: null };
        else if (decl.includes(id)) result[id] = { status: 'declined', reason: att.declineReasons?.[id] || null };
        else result[id] = { status: 'pending' };
    }

    // Trener — sprawdź po userId
    const userId = currentUserData?.userId;
    if (Object.keys(result).length === 0 && userId && (isTeamEvent || inv.includes(userId))) {
        if (conf.includes(userId)) result[userId] = { status: 'confirmed', reason: null };
        else if (decl.includes(userId)) result[userId] = { status: 'declined', reason: att.declineReasons?.[userId] || null };
        else result[userId] = { status: 'pending' };
    }

    return result;
}

// Stara funkcja — kompatybilność wsteczna (zwraca pierwszy znaleziony status)
function hasResponded(att) {
    const statuses = getAttendanceStatus(att);
    for (const [id, info] of Object.entries(statuses)) {
        if (info.status === 'confirmed') return { status: 'confirmed', targetId: id };
        if (info.status === 'declined') return { status: 'declined', targetId: id, reason: info.reason };
    }
    return null;
}

// Znajdź targetId do zapisu obecności (playerId dziecka z invited lub userId trenera)
function getTargetId(invited) {
    const myIds = getMyPlayerIds();
    const isTeamEvent = (invited || []).includes('__TEAM__');
    for (const id of myIds) { if (isTeamEvent || invited.includes(id)) return id; }
    if (isTeamEvent || invited.includes(currentUserData?.userId)) return currentUserData.userId;
    return myIds[0] || currentUserData?.userId;
}

/* ═══════════════════════════════════════════════════
   FIRESTORE HELPERS
═══════════════════════════════════════════════════ */

// Pobierz zawodników drużyny
async function getTeamPlayers(teamId) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('players').get();

        // Filtruj lokalnie (bo Firestore nie wspiera array-contains z obiektem)
        const players = snapshot.docs
            .map(doc => {
                const data = doc.data();
                // Normalizuj stare pole guardianId (string) → guardianIds (array) — migracja v2.8
                if (!data.guardianIds) data.guardianIds = data.guardianId ? [data.guardianId] : [];
                return { id: doc.id, ...data };
            })
            .filter(player => {
                return player.teams && player.teams.some(team =>
                    team.teamId === teamId && team.status === 'ACTIVE'
                );
            });

        return players;
    } catch (error) {
        console.error('Error fetching players:', error);
        return [];
    }
}

// Pobierz drużyny użytkownika przez memberships (v4.1 — bez contexts[])
async function getUserTeams(userId) {
    if (!db || !userId) return [];
    try {
        const snap = await db.collection('memberships')
            .where('userId', '==', userId)
            .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
            .get();

        const teams = [];
        const selectedId = localStorage.getItem('selectedMembershipId');

        for (const mDoc of snap.docs) {
            const m = mDoc.data();
            if (!m.teamId) continue;
            const teamDoc = await db.collection('teams').doc(m.teamId).get();
            if (teamDoc.exists) {
                teams.push({
                    id: teamDoc.id,
                    ...teamDoc.data(),
                    isPrimary: mDoc.id === selectedId,
                    membershipId: mDoc.id,
                    membershipRole: m.role,
                    trainerRole: m.trainerRole || null
                });
            }
        }
        return teams;
    } catch (error) {
        console.error('❌ getUserTeams:', error);
        return [];
    }
}

// Pobierz mecze drużyny
async function getTeamMatches(teamId, limit = 10) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('matches')
            .where('teamId', '==', teamId)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching matches:', error);
        return [];
    }
}

// Pobierz wiadomości drużyny
async function getTeamMessages(teamId) {
    console.log('🔥 getTeamMessages wywołana:', teamId);
    console.log('🔥 db istnieje?', !!db);

    if (!db) {
        console.log('❌ db is null!');
        return [];
    }

    try {
        console.log('🔥 Wykonuję query...');
        const snapshot = await db.collection('messages')
            .where('teamId', '==', teamId)
            .get();

        console.log('✅ Snapshot size:', snapshot.size);
        console.log('✅ Docs:', snapshot.docs.length);

        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('✅ Mapped messages:', messages.length);

        return messages;
    } catch (error) {
        console.error('❌ Error fetching messages:', error);
        console.error('❌ Error message:', error.message);
        return [];
    }
}

// Pobierz ogłoszenia drużyny — z announcements (auto-generowane + BROADCAST od trenera) + messages legacy BROADCAST
async function getTeamAnnouncements(teamId) {
    if (!db) return [];
    try {
        const [annSnap, msgSnap] = await Promise.all([
            db.collection('announcements').where('teamId', '==', teamId)
                .orderBy('isPinned', 'desc').orderBy('createdAt', 'desc').get(),
            db.collection('messages').where('teamId', '==', teamId)
                .where('type', '==', 'BROADCAST').get()
        ]);

        // Auto-generowane + BROADCAST od trenera — wszystkie typy z announcements (bez archiwalnych)
        const ALLOWED_TYPES = ['BIRTHDAY', 'MATCH', 'INFO', 'WARNING', 'ACHIEVEMENT', 'TASK', 'BROADCAST'];
        const annItems = annSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(a => ALLOWED_TYPES.includes(a.type) && !a.archived);

        // Wszystkie BROADCAST z messages (źródło prawdy dla ogłoszeń trenera)
        const msgItems = msgSnap.docs
            .filter(doc => !doc.data().archived)
            .map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    teamId: d.teamId,
                    title: d.title || '',
                    body: d.body || '',
                    createdBy: d.editedBy || d.from,
                    createdAt: d.editedAt || d.createdAt,
                    expiresAt: d.expiresAt || null,
                    isPinned: d.isPinned || false,
                    visibleDays: d.visibleDays,
                    type: 'BROADCAST',
                    _fromMessages: true
                };
            });

        const all = [...annItems, ...msgItems];
        // Sortuj: przypięte najpierw, potem wg daty
        all.sort((a, b) => {
            if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0)) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
            const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return tb - ta;
        });
        return all;
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return [];
    }
}

// Pobierz oferty sparingów
async function getSparringOffers(category = null) {
    if (!db) return [];
    try {
        let query = db.collection('sparringOffers');
        if (category) {
            query = query.where('category', '==', category);
        }
        const snapshot = await query
            .orderBy('fairPlayRating.overall', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching sparring offers:', error);
        return [];
    }
}

// ─── Kontrola zapisu i komunikaty ────────────────────────────────

// Pomocnicza — zwraca kontener .phone lub body
function _getPhoneContainer() {
    return document.querySelector('.phone') || document.body;
}

// Toast — prosta informacja (info / sukces / warn / blad)
function pokazKomunikat(tekst, typ = 'info') {
    let toast = document.getElementById('coachay-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'coachay-toast';
        toast.style.cssText = `
            position: absolute; top: 62%; left: 50%;
            transform: translateX(-50%) translateY(-20px); z-index: 9999;
            padding: 11px 18px; border-radius: 999px;
            font-size: 13px; font-weight: 800;
            opacity: 0; transition: opacity 0.2s, transform 0.2s;
            pointer-events: none; white-space: nowrap;
            max-width: calc(100% - 48px); text-align: center;
        `;
        _getPhoneContainer().appendChild(toast);
    }
    const _colors = {
        sukces: { bg: '#16a34a', border: '#15803d' },
        info:   { bg: '#2d2d2d', border: '#444'    },
        warn:   { bg: '#d97706', border: '#b45309' },
        blad:   { bg: '#DC2626', border: '#B91C1C' },
    };
    const c = _colors[typ] || _colors.blad;
    toast.style.background = c.bg;
    toast.style.border = `1px solid ${c.border}`;
    toast.style.color = '#fff';
    toast.innerHTML = tekst;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 2800);
}

// Dialog potwierdzenia — zwraca Promise<boolean>
// Użycie: const ok = await pokazDialog('Czy na pewno?', { tak: 'Tak', nie: 'Anuluj' });
function pokazDialog(tekst, { tak = 'Tak', nie = 'Nie' } = {}) {
    return new Promise(resolve => {
        let overlay = document.getElementById('coachay-dialog');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'coachay-dialog';
            overlay.style.cssText = `
                position: absolute; inset: 0; z-index: 9998;
                background: rgba(0,0,0,0.6); display: flex;
                align-items: flex-end; justify-content: center;
                opacity: 0; transition: opacity 0.2s; pointer-events: none;
            `;
            overlay.innerHTML = `
                <div id="coachay-dialog-box" style="
                    background: var(--tlo-karta, #1a1a1a);
                    border-radius: 20px 20px 0 0;
                    padding: 24px 20px 36px;
                    width: 100%;
                    transform: translateY(100%);
                    transition: transform 0.25s cubic-bezier(.32,.72,0,1);
                ">
                    <div id="coachay-dialog-tekst" style="
                        font-size: 15px; font-weight: 700;
                        color: var(--bialy, #fff); text-align: center;
                        line-height: 1.5; margin-bottom: 20px;
                    "></div>
                    <div style="display: flex; gap: 10px;">
                        <button id="coachay-dialog-nie" style="
                            flex: 1; padding: 13px; border-radius: 12px;
                            border: 1px solid var(--border, #333);
                            background: var(--tlo-karta2, #222);
                            color: var(--szary, #888); font-size: 14px;
                            font-weight: 800; cursor: pointer;
                        "></button>
                        <button id="coachay-dialog-tak" style="
                            flex: 1; padding: 13px; border-radius: 12px;
                            border: none; background: var(--akcent, #3B82F6);
                            color: #fff; font-size: 14px;
                            font-weight: 800; cursor: pointer;
                        "></button>
                    </div>
                </div>`;
            _getPhoneContainer().appendChild(overlay);
        }

        const box = document.getElementById('coachay-dialog-box');
        document.getElementById('coachay-dialog-tekst').textContent = tekst;
        document.getElementById('coachay-dialog-tak').textContent = tak;
        document.getElementById('coachay-dialog-nie').textContent = nie;

        const zamknij = (wynik) => {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            box.style.transform = 'translateY(100%)';
            resolve(wynik);
        };

        document.getElementById('coachay-dialog-tak').onclick = () => zamknij(true);
        document.getElementById('coachay-dialog-nie').onclick = () => zamknij(false);
        overlay.onclick = (e) => { if (e.target === overlay) zamknij(false); };

        overlay.style.pointerEvents = 'all';
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });
}

// Blokada zapisu — sprawdza isReadOnly z currentUserData (v4.1)
function requireWriteAccess(komunikat = 'Tryb podglądu — operacje zapisu są niedostępne.') {
    const ud = getCurrentUserData();
    if (ud?.isReadOnly) {
        pokazKomunikat(komunikat);
        return false;
    }
    return true;
}

// ─── Memberships ─────────────────────────────────────────────────

/* ══════════════════════════════════════════════════════════════════
   getMembership(userId, clubId)
   Pobierz jedno membership usera w danym klubie (aktywne/grace/demo).
   Zwraca obiekt membership lub null.
══════════════════════════════════════════════════════════════════ */
async function getMembership(userId, clubId) {
    if (!db || !userId || !clubId) return null;
    try {
        const snap = await db.collection('memberships')
            .where('userId', '==', userId)
            .where('clubId', '==', clubId)
            .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
            .limit(1)
            .get();
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
        console.error('❌ getMembership:', e);
        return null;
    }
}

/* ══════════════════════════════════════════════════════════════════
   getUserMemberships(userId)
   Pobierz wszystkie aktywne memberships usera (dla context-switchera).
   Zwraca tablicę obiektów membership. Nie zwraca BLOCKED ani REMOVED.
══════════════════════════════════════════════════════════════════ */
async function getUserMemberships(userId) {
    if (!db || !userId) return [];
    try {
        // Nowe memberships mają pole status; legacy mają isActive: true (brak status)
        const [snapNew, snapLegacy] = await Promise.all([
            db.collection('memberships')
                .where('userId', '==', userId)
                .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
                .get(),
            db.collection('memberships')
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .get()
        ]);
        const byId = {};
        snapNew.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
        snapLegacy.docs.forEach(d => {
            if (!byId[d.id]) byId[d.id] = { id: d.id, ...d.data() };
        });
        // Odfiltruj zablokowane/usunięte (mogą się trafić przez isActive)
        return Object.values(byId).filter(m =>
            m.status !== 'BLOCKED' && m.status !== 'REMOVED'
        );
    } catch (e) {
        console.error('❌ getUserMemberships:', e);
        return [];
    }
}

/* ══════════════════════════════════════════════════════════════════
   getArchivedMemberships(userId)
   Pobierz INACTIVE memberships — poprzednie drużyny (archiwum po transferze).
   Zwraca tablicę z flagą _isArchive: true.
══════════════════════════════════════════════════════════════════ */
async function getArchivedMemberships(userId) {
    if (!db || !userId) return [];
    try {
        const snap = await db.collection('memberships')
            .where('userId', '==', userId)
            .where('status', '==', 'INACTIVE')
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data(), _isArchive: true }));
    } catch (e) {
        console.error('❌ getArchivedMemberships:', e);
        return [];
    }
}

/* ══════════════════════════════════════════════════════════════════
   getCurrentMembership()
   Pobierz aktywne membership dla aktualnego użytkownika.
   Respektuje selectedMembershipId z localStorage (context-switcher).
══════════════════════════════════════════════════════════════════ */
async function getCurrentMembership() {
    const userId = getCurrentUserId();
    if (!db || !userId) return null;
    try {
        const selectedId = localStorage.getItem('selectedMembershipId');
        if (selectedId) {
            const doc = await db.collection('memberships').doc(selectedId).get();
            if (doc.exists && doc.data().userId === userId) return { id: doc.id, ...doc.data() };
        }
        const [snapNew, snapLegacy] = await Promise.all([
            db.collection('memberships')
                .where('userId', '==', userId)
                .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
                .limit(1).get(),
            db.collection('memberships')
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .limit(1).get()
        ]);
        const doc = snapNew.docs[0] || snapLegacy.docs[0];
        if (!doc) return null;
        const m = { id: doc.id, ...doc.data() };
        if (m.status === 'BLOCKED' || m.status === 'REMOVED') return null;
        return m;
    } catch (e) {
        console.error('❌ getCurrentMembership:', e);
        return null;
    }
}

/* ══════════════════════════════════════════════════════════════════
   initSession()
   Główna funkcja inicjalizacji sesji dla każdego ekranu (v4.1).
   Zastępuje sekwencję: getCurrentUser() + getCurrentTeam() + setCurrentUserData().

   Ustawia currentUserData z polami kompatybilnymi z istniejącymi ekranami:
     .userId, .role (TRENER_GLOWNY/RODZIC/...), .playerId, .childrenIds,
     .observedPlayerIds, .isReadOnly, .displayName, .teamId, .clubId,
     .membership, .allMemberships, ._raw (user), ._rawTeam

   Użycie w każdym ekranie:
     const session = await initSession();
     if (!session) { window.location.href = 'login.html'; return; }
     const { user, membership, team } = session;
══════════════════════════════════════════════════════════════════ */
async function initSession() {
    const userId = getCurrentUserId();
    if (!userId || !db) return null;

    try {
        // 1. Pobierz dane usera
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) { console.error('❌ Brak usera:', userId); return null; }
        const user = { id: userDoc.id, ...userDoc.data() };

        // 2. Pobierz wszystkie aktywne memberships
        const allMemberships = await getUserMemberships(userId);

        // 3. Wybierz membership — z Firestore user doc lub localStorage (selectedMembershipId)
        //    Priorytet: user.selectedMembershipId (Firestore) > localStorage > pierwsze aktywne
        const selectedId = user.selectedMembershipId || localStorage.getItem('selectedMembershipId');
        let membership = allMemberships.find(m => m.id === selectedId);

        // 3a. Jeśli wybrany membership nie jest aktywny — sprawdź jego status
        if (selectedId && !membership) {
            try {
                const mDoc = await db.collection('memberships').doc(selectedId).get();
                if (mDoc.exists) {
                    const st = mDoc.data().status;
                    if (st === 'BLOCKED' || st === 'REMOVED') {
                        // Szukaj innego aktywnego membership
                        if (allMemberships.length > 0) {
                            membership = allMemberships[0];
                            localStorage.setItem('selectedMembershipId', membership.id);
                            try { await db.collection('users').doc(userId).update({ selectedMembershipId: membership.id }); } catch(e) {}
                        } else {
                            // Brak innych aktywnych → blocked.html
                            if (!window.location.href.includes('blocked.html')) window.location.href = 'blocked.html';
                            return null;
                        }
                    } else if (st === 'INACTIVE') {
                        // Archiwum — pozwól wejść tylko do odczytu
                        membership = { id: mDoc.id, ...mDoc.data(), isReadOnly: true, _isArchive: true };
                    }
                }
            } catch (e) {}
            if (!membership) membership = allMemberships[0];
        }

        // 3b. Brak aktywnych memberships — wyjątek: isPlatformAdmin nie potrzebuje membership
        if (!membership && allMemberships.length === 0) {
            if (user.isPlatformAdmin === true) {
                setCurrentUserData({
                    userId, role: 'TRENER_GLOWNY',
                    playerId: null, childrenIds: [], observedPlayerIds: [],
                    isReadOnly: false, displayName: user.displayName || '',
                    teamId: null, clubId: null, membership: null,
                    allMemberships: [], _raw: user, _rawTeam: null
                });
                console.log(`✅ initSession: ${userId} | isPlatformAdmin`);
                const _pinOkAdmin = await _checkPinLock(user);
                if (!_pinOkAdmin) return null;
                return { user, membership: null, team: null, allMemberships: [] };
            }
            try {
                const anySnap = await db.collection('memberships')
                    .where('userId', '==', userId)
                    .limit(1).get();
                if (!anySnap.empty) {
                    if (!window.location.href.includes('blocked.html')) window.location.href = 'blocked.html';
                    return null;
                }
            } catch (e) {}
            console.error('❌ Brak memberships dla:', userId);
            return null;
        }

        if (!membership) membership = allMemberships[0];

        // Zapisz wybrany membership do localStorage (synchronizacja)
        if (membership.id !== selectedId) {
            localStorage.setItem('selectedMembershipId', membership.id);
        }

        // 4. Pobierz drużynę na podstawie membership.teamId
        const resolvedTeamId = membership.teamId;
        let team = null;
        if (resolvedTeamId) {
            const teamDoc = await db.collection('teams').doc(resolvedTeamId).get();
            if (teamDoc.exists) team = { id: teamDoc.id, ...teamDoc.data() };
        }

        // 5. Wyznacz rolę z membership
        const role = membership.role;
        const effectiveRole = role === 'TRENER'
            ? (membership.trainerRole || 'TRENER_GLOWNY')
            : role;

        // 6. childrenIds — ze wszystkich memberships RODZIC/KIBIC tego usera
        const childrenIds = allMemberships
            .filter(m => (m.role === 'RODZIC' || m.role === 'KIBIC') && m.playerId)
            .map(m => m.playerId);

        // 7. observedPlayerIds — ze wszystkich memberships KIBIC tego usera
        const observedPlayerIds = allMemberships
            .filter(m => m.role === 'KIBIC' && m.playerId)
            .map(m => m.playerId);

        // 8. isReadOnly — z usera LUB membership
        const isReadOnly = user.isReadOnly === true || membership.isReadOnly === true;

        // 9. Ustaw globalny kontekst
        setCurrentUserData({
            userId,
            role:               effectiveRole,
            playerId:           membership.playerId || null,
            childrenIds,
            observedPlayerIds,
            isReadOnly,
            displayName:        user.displayName || '',
            teamId:             membership.teamId || null,
            clubId:             membership.clubId || null,
            membership,
            allMemberships,
            _raw:               user,      // kompatybilność wsteczna
            _rawTeam:           team
        });

        console.log(`✅ initSession: ${userId} | rola: ${effectiveRole} | drużyna: ${membership.teamId} | isReadOnly: ${isReadOnly}`);
        const _pinOk = await _checkPinLock(user);
        if (!_pinOk) return null;
        setupPushNotifications(userId); // fire-and-forget, nie blokuje renderowania ekranu
        return { user, membership, team, allMemberships };

    } catch (e) {
        console.error('❌ initSession:', e);
        return null;
    }
}

// Rejestracja push notifications (FCM) — tylko w appce natywnej (Capacitor), web push w WebView jest niepewny
let _pushRegistered = false;
async function setupPushNotifications(userId) {
    if (_pushRegistered) return;
    if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
    const PushNotifications = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if (!PushNotifications) return;
    _pushRegistered = true;

    try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        PushNotifications.addListener('registration', async (token) => {
            try {
                await db.collection('users').doc(userId).update({ fcmToken: token.value });
                console.log('✅ FCM token zarejestrowany');
            } catch (e) { console.warn('⚠️ Zapis fcmToken:', e); }
        });
        PushNotifications.addListener('registrationError', (err) => {
            console.warn('⚠️ Push registration error:', err);
        });

        // Appka otwarta na pierwszym planie — Android nie pokazuje wtedy systemowego
        // powiadomienia sam z siebie, więc odświeżamy dzwonek ręcznie
        PushNotifications.addListener('pushNotificationReceived', () => {
            loadAndRenderNotifications().catch(e => console.warn('⚠️ Odświeżenie dzwonka po push:', e));
        });

        await PushNotifications.register();
    } catch (e) {
        console.warn('⚠️ setupPushNotifications:', e);
    }
}

// Pobierz powiązane memberships dla zawodnika (RODZIC + KIBIC)
async function getMembershipsForPlayer(playerId) {
    if (!db) { console.warn('❌ db is null'); return { rodzice: [], kibice: [], userMap: {} }; }
    try {
        // { source: 'server' } — omija IndexedDB cache, zawsze świeże dane
        const snap = await db.collection('memberships')
            .where('playerId', '==', playerId)
            .get({ source: 'server' });

        const wszystkie = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const isStatusActive = s => s && ['active','ACTIVE','grace','GRACE'].includes(s);

        const rodzice = wszystkie.filter(m => m.role === 'RODZIC');
        const kibice  = wszystkie.filter(m => m.role === 'KIBIC');

        // Pobierz dane userów dla aktywnych memberships (obsługuje lowercase i uppercase)
        const userIds = [...new Set(
            wszystkie
                .filter(m => m.userId && isStatusActive(m.status))
                .map(m => m.userId)
        )];

        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try {
                const uDoc = await db.collection('users').doc(uid).get();
                if (uDoc.exists) userMap[uid] = uDoc.data();
            } catch (e) {}
        }));

        return { rodzice, kibice, userMap };
    } catch (e) {
        console.error('❌ Błąd getMembershipsForPlayer:', e);
        return { rodzice: [], kibice: [], userMap: {} };
    }
}

// Pobierz zadania drużyny
async function getTeamTasks(teamId, limit = 20) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('tasks')
            .where('teamId', '==', teamId)
            .limit(limit)
            .get();
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ukryj DELETE (zarchiwizowane) oraz DONE starsze niż 24h
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const visible = tasks.filter(t => {
            if (t.status === 'DELETE') return false;
            if (t.status !== 'DONE') return true;
            const done = t.completedAt ? new Date(t.completedAt).getTime() : 0;
            return done > cutoff;
        });
        // Sortuj: PENDING najpierw, potem DONE, w ramach grupy po dueDate
        visible.sort((a, b) => {
            if (a.status !== b.status) return a.status === 'PENDING' ? -1 : 1;
            const dateA = a.dueDate || '';
            const dateB = b.dueDate || '';
            return dateA < dateB ? -1 : 1;
        });
        return visible;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }
}

// Pobierz wydarzenia drużyny
async function getTeamEvents(teamId) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('events')
            .where('teamId', '==', teamId)
            .get({ source: 'server' });
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(e => e.status !== 'DELETE');
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
}

// Pobierz tematy treningów klubu
async function getClubTopics(clubId) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('trainingTopics')
            .where('clubId', '==', clubId)
            .where('isActive', '==', true)
            .get();
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    } catch (error) {
        console.error('Error fetching topics:', error);
        return [];
    }
}

// Pobierz kody dostępu utworzone przez użytkownika
async function getInviteCodes(userId) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('inviteCodes')
            .where('createdBy', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching invite codes:', error);
        return [];
    }
}

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS SYSTEM
═══════════════════════════════════════════════════ */

// Pobierz powiadomienia dla użytkownika
async function getUserNotifications(userId, limit = 30) {
    if (!db || !userId) return [];
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .limit(limit)
            .get();
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(n => n.status !== 'DELETE');
        // Sortuj: nieprzeczytane najpierw, potem po dacie (najnowsze wyżej)
        notifs.sort((a, b) => {
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });
        return notifs;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

// Oblicz deleteAt dla powiadomienia (używane przy tworzeniu i przy oznaczeniu jako przeczytane)
function calcNotifDeleteAt(type, isRead, readAt) {
    const base = readAt ? new Date(readAt) : new Date();
    const isMsg = type === 'NEW_MESSAGE' || type === 'NEW_ANNOUNCEMENT';
    let ms;
    if (isMsg) {
        ms = isRead
            ? 2  * 24 * 60 * 60 * 1000  // przeczytane → 48h od odczytania
            : 7  * 24 * 60 * 60 * 1000; // nieprzeczytane → 7 dni od teraz
    } else {
        ms = isRead
            ? 14 * 24 * 60 * 60 * 1000  // przeczytane → 14 dni
            : 60 * 24 * 60 * 60 * 1000; // nieprzeczytane → 60 dni
    }
    return firebase.firestore.Timestamp.fromDate(new Date(base.getTime() + ms));
}

// Utwórz powiadomienie
async function createNotification(data) {
    if (!db) return null;
    try {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const type = data.type || 'INFO';
        const notif = {
            notificationId: 'notif_' + dateStr + '_' + Date.now().toString().slice(-7),
            userId: data.userId,
            teamId: data.teamId || null,
            type,
            title: data.title || '',
            body: data.body || '',
            referenceId: data.referenceId || null,
            referenceType: data.referenceType || null,
            forPlayerId: data.forPlayerId || null,
            requiresAction: data.requiresAction || false,
            actionType: data.actionType || null,
            actionDone: false,
            actionResult: null,
            actionComment: null,
            createdAt: now.toISOString(),
            readAt: null,
            isRead: false,
            priority: data.priority || 'NORMAL',
            isDemo: false,
            demoSetId: null,
            deleteAt: calcNotifDeleteAt(type, false, null)
        };
        await db.collection('notifications').doc(notif.notificationId).set(notif);
        return notif;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

// Utwórz powiadomienia dla listy osób (np. przy tworzeniu eventu)
async function createNotificationsForEvent(event, absences) {
    if (!db || !event) return;
    const rawInvited = event.attendance?.invited || [];
    if (rawInvited.length === 0) return;

    const eventDate = event.date;
    const requiresAction = event.requireConfirmation || false;

    const d = new Date(eventDate + 'T00:00:00');
    const dayName = d.toLocaleDateString('pl-PL', { weekday: 'short' });
    const dateStr = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

    const typeNames = { 'TRENING': 'Trening', 'MECZ': 'Mecz', 'WYJAZD': 'Wyjazd', 'INNE': 'Wydarzenie' };
    const typeName = typeNames[event.type] || 'Wydarzenie';
    const bodyText = `${typeName} \u00B7 ${dayName} ${dateStr}, ${event.timeFrom || ''}\u2013${event.timeTo || ''} \u00B7 ${event.location?.venueName || ''}`;

    // Pobierz rodziców i zawodników przez memberships (v4.1 — bez user.children / user.playerId)
    const parentChildMap = {};   // parentUserId → [playerId]
    const playerUserMap  = {};   // playerId → userId (zawodnik z kontem)

    // Krok 1: rozwiń __TEAM__ — zastąp znacznikiem listą playerIds z memberships
    let invited = rawInvited.filter(id => id !== '__TEAM__');
    const isTeamScope = rawInvited.includes('__TEAM__');

    try {
        const mbrSnap = await db.collection('memberships')
            .where('teamId', '==', event.teamId)
            .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
            .get();
        const members = mbrSnap.docs.map(doc => doc.data());

        // Krok 1a: dla __TEAM__ — dodaj wszystkich zawodników do invited
        if (isTeamScope) {
            members.forEach(m => {
                if (m.role === 'ZAWODNIK' && m.playerId && !invited.includes(m.playerId)) {
                    invited.push(m.playerId);
                }
            });
        }

        // Krok 1b: zbuduj mapy na podstawie kompletnej listy invited
        const playerIds = invited.filter(id => id.includes('player_'));
        members.forEach(m => {
            if (!m.userId || !m.playerId) return;
            if (m.role === 'RODZIC' && playerIds.includes(m.playerId)) {
                if (!parentChildMap[m.userId]) parentChildMap[m.userId] = [];
                if (!parentChildMap[m.userId].includes(m.playerId)) parentChildMap[m.userId].push(m.playerId);
            }
            if (m.role === 'ZAWODNIK' && playerIds.includes(m.playerId)) {
                playerUserMap[m.playerId] = m.userId;
            }
        });
    } catch (e) { console.error('❌ parentChildMap:', e); }

    const notifiedParents = new Set();

    let created = 0;
    for (const personId of invited) {
        // Pomiń osoby z długą nieobecnością
        if (absences && absences.length > 0) {
            const hasAbsence = absences.some(a =>
                a.playerId === personId && a.dateFrom <= eventDate && a.dateTo >= eventDate && a.isActive
            );
            if (hasAbsence) continue;
        }

        // Sprawdź czy to player
        const isPlayer = personId.includes('player_');

        if (isPlayer) {
            // Dla playera — powiadomienie do zawodnika (jeśli ma konto w memberships)
            const playerUserId = playerUserMap[personId];
            if (playerUserId) {
                const playerName = personId; // imię pobrane przy tworzeniu eventu
                await createNotification({
                    userId: playerUserId,
                    teamId: event.teamId,
                    type: requiresAction ? 'EVENT_ATTENDANCE' : 'EVENT_CREATED',
                    title: requiresAction ? `${event.title || typeName} \u2014 potwierd\u017A obecno\u015B\u0107` : (event.title || typeName),
                    body: bodyText,
                    referenceId: event.eventId,
                    referenceType: 'event',
                    forPlayerId: personId,
                    requiresAction: requiresAction,
                    actionType: requiresAction ? 'ATTENDANCE' : null,
                    priority: 'NORMAL'
                });
                created++;
            }

            // Dla playera — powiadomienie do rodzica (jeśli ma)
            for (const [parentId, childIds] of Object.entries(parentChildMap)) {
                if (childIds.includes(personId) && invited.includes(personId)) {
                    const notifKey = `${parentId}_${personId}`;
                    if (notifiedParents.has(notifKey)) continue;
                    notifiedParents.add(notifKey);

                    // Znajdź imię dziecka
                    let childName = personId;
                    try {
                        const playerDoc = await db.collection('players').doc(personId).get();
                        if (playerDoc.exists) childName = playerDoc.data().name || personId;
                    } catch (e) { }

                    await createNotification({
                        userId: parentId,
                        teamId: event.teamId,
                        type: requiresAction ? 'EVENT_ATTENDANCE' : 'EVENT_CREATED',
                        title: requiresAction ? `${event.title || typeName} \u2014 potwierd\u017A obecno\u015B\u0107 (${childName})` : (event.title || typeName),
                        body: bodyText,
                        referenceId: event.eventId,
                        referenceType: 'event',
                        forPlayerId: personId,
                        requiresAction: requiresAction,
                        actionType: requiresAction ? 'ATTENDANCE' : null,
                        priority: 'NORMAL'
                    });
                    created++;
                }
            }
        } else {
            // Dla trenera/innego usera — zawsze informacyjne, bez "potwierdź obecność"
            if (personId === event.createdBy) continue; // twórca nie dostaje o własnym evencie
            await createNotification({
                userId: personId,
                teamId: event.teamId,
                type: 'EVENT_CREATED',
                title: event.title || `${typeName} — ${dayName} ${dateStr}`,
                body: bodyText,
                referenceId: event.eventId,
                referenceType: 'event',
                forPlayerId: null,
                requiresAction: false,
                actionType: null,
                priority: 'NORMAL'
            });
            created++;
        }
    }
    console.log(`✅ Utworzono ${created} powiadomień`);
}

// ─── GLOBALNA FUNKCJA ZARZĄDZANIA POWIADOMIENIAMI ───────────────────────────
// action: 'create' | 'edit' | 'delete'
// referenceType: 'event' | 'message' | 'task'
// referenceId: ID dokumentu w Firestore
// payload: dane specyficzne dla typu
//   event   → { event, absences }
//   message → { teamId, senderId, senderName, title, body, recipients, msgSubtype }
//             recipients: null = BROADCAST (cała drużyna), array = konkretni odbiorcy
//             msgSubtype: 'BROADCAST' | 'MESSAGE'
//   task    → { teamId, assignees, title, dueDate }
async function manageNotifications(action, referenceType, referenceId, payload = {}) {
    if (!db) return;

    // DELETE — archiwizuj powiązane powiadomienia (status: DELETE)
    if (action === 'delete') {
        try {
            const snap = await db.collection('notifications').where('referenceId', '==', referenceId).get();
            for (const doc of snap.docs) await doc.ref.update({ status: 'DELETE' });
        } catch (e) { console.warn('manageNotifications delete:', e); }
        return;
    }

    // EDIT — wygaś stare powiadomienia przed wysłaniem nowych
    if (action === 'edit') {
        try {
            const snap = await db.collection('notifications').where('referenceId', '==', referenceId).get();
            for (const doc of snap.docs) {
                const update = { isRead: true, readAt: new Date().toISOString() };
                if (referenceType === 'event') { update.actionDone = true; update.actionResult = 'expired'; }
                await doc.ref.update(update);
            }
        } catch (e) { console.warn('manageNotifications archive:', e); }
    }

    // CREATE / EDIT — wyślij nowe powiadomienia
    try {
        if (referenceType === 'event') {
            const { event, absences = [] } = payload;
            await createNotificationsForEvent(event, absences);

        } else if (referenceType === 'message') {
            const { teamId, senderId, senderName, title, body, recipients, msgSubtype } = payload;
            const bodyShort = (body || '').length > 80 ? body.slice(0, 77) + '…' : (body || '');
            const isAnnouncement = msgSubtype === 'BROADCAST';
            const notifType = isAnnouncement ? 'NEW_ANNOUNCEMENT' : 'NEW_MESSAGE';
            const icon = isAnnouncement ? '📢' : '💬';

            let targetUsers = recipients;
            if (!targetUsers) {
                // BROADCAST — pobierz wszystkich z drużyny przez memberships (v4.1)
                const mbrSnap = await db.collection('memberships')
                    .where('teamId', '==', teamId)
                    .where('status', 'in', ['active', 'grace', 'demo'])
                    .get();
                targetUsers = mbrSnap.docs
                    .map(d => d.data().userId)
                    .filter(uid => uid && uid !== senderId);
            }
            for (const userId of targetUsers) {
                if (userId === senderId) continue;
                await createNotification({
                    userId, teamId, type: notifType,
                    title: `${icon} ${senderName}: ${title}`,
                    body: bodyShort, referenceId, referenceType: 'message'
                });
            }

        } else if (referenceType === 'task') {
            const { teamId, assignees = [], title, dueDate } = payload;
            const notifTitle = action === 'edit' ? 'Zadanie zaktualizowane' : 'Nowe zadanie';
            for (const userId of assignees) {
                await createNotification({
                    userId, teamId, type: 'TASK_ASSIGNED',
                    title: notifTitle,
                    body: `${title} · termin: ${dueDate}`,
                    referenceId, referenceType: 'task',
                    requiresAction: true, actionType: 'TASK', priority: 'NORMAL'
                });
            }
        }
    } catch (e) { console.warn('manageNotifications create:', e); }
}

// Wywołaj po rejestracji rodzica/kibica/zawodnika z kodem
// Wysyła powiadomienie do trenera + aktualizuje powiązanie zawodnik↔opiekun
async function onUserRegisteredWithCode(codeData, newUser) {
    if (!db || !codeData || !newUser) return;

    const typ = codeData.type || 'RODZIC';
    const pid = codeData.playerId || null;
    const teamId = codeData.teamId || null;
    const createdBy = codeData.createdBy || null;

    // Znajdź imię zawodnika
    let playerName = '';
    if (pid) {
        try {
            const pDoc = await db.collection('players').doc(pid).get();
            if (pDoc.exists) playerName = pDoc.data().name || pid;
        } catch (e) { }
    }

    // Znajdź nazwę drużyny
    let teamName = '';
    if (teamId) {
        try {
            const tDoc = await db.collection('teams').doc(teamId).get();
            if (tDoc.exists) teamName = tDoc.data().teamName || tDoc.data().displayName || '';
        } catch (e) { }
    }

    const typLabels = { RODZIC: 'rodzic', ZAWODNIK: 'zawodnik', KIBIC: 'kibic', TRENER: 'trener' };

    // Aktualizuj powiązanie w bazie
    if (pid && (typ === 'RODZIC' || typ === 'KIBIC')) {
        try {
            const playerDoc = await db.collection('players').doc(pid).get();
            if (playerDoc.exists) {
                const gIds = playerDoc.data().guardianIds || [];
                if (!gIds.includes(newUser.userId)) {
                    gIds.push(newUser.userId);
                    await db.collection('players').doc(pid).update({ guardianIds: gIds });
                }
            }
            // v4.1: users.children usunięte — powiązanie rodzic↔dziecko jest w memberships
        } catch (e) { console.error('Błąd powiązania:', e); }
    }

    // Oznacz kod jako użyty
    if (codeData.codeId) {
        try {
            await db.collection('inviteCodes').doc(codeData.codeId).update({
                isUsed: true,
                usedAt: new Date().toISOString(),
                usedBy: newUser.userId
            });
        } catch (e) { }
    }

    if (typ === 'TRENER') {
        // ── Rejestracja trenera — aktywuj rekord trainers i powiadom twórcę ──
        const trainerId = codeData.trainerId || null;
        if (trainerId) {
            try {
                await db.collection('trainers').doc(trainerId).update({
                    userId: newUser.userId,
                    email: newUser.email || null,
                    registrationStatus: 'ACTIVE',
                    registeredAt: new Date().toISOString()
                });
            } catch (e) { console.warn('Błąd aktywacji trenera:', e); }
        }
        if (createdBy && teamId) {
            await createNotification({
                userId: createdBy,
                teamId,
                type: 'TRAINER_REGISTERED',
                title: `${newUser.displayName} dołączył jako trener`,
                body: teamName ? `Drużyna: ${teamName}` : '',
                referenceId: trainerId || teamId,
                referenceType: 'trainer',
                requiresAction: false,
                actionType: null,
                priority: 'NORMAL'
            });
        }
    } else {
        // ── Powiadomienie do trenera (rodzic / zawodnik / kibic) ──
        if (createdBy && teamId) {
            const tytul = playerName
                ? `${newUser.displayName} dołączył jako ${typLabels[typ]} · ${playerName}`
                : `${newUser.displayName} dołączył jako ${typLabels[typ]}`;
            await createNotification({
                userId: createdBy,
                teamId,
                type: 'GUARDIAN_ASSIGNED',
                title: tytul,
                body: teamName ? `Drużyna: ${teamName}` : '',
                referenceId: pid || teamId,
                referenceType: pid ? 'player' : 'team',
                forPlayerId: pid,
                requiresAction: false,
                actionType: null,
                priority: 'NORMAL'
            });
        }
    }

    console.log(`✅ ${newUser.displayName} zarejestrowany jako ${typ}`);
}

// Oznacz powiadomienie jako przeczytane
async function markNotificationRead(notifId) {
    if (!db) return;
    try {
        const readAt = new Date().toISOString();
        // Pobierz typ żeby przeliczyć deleteAt
        let deleteAt;
        try {
            const doc = await db.collection('notifications').doc(notifId).get();
            const type = doc.exists ? (doc.data().type || 'INFO') : 'INFO';
            deleteAt = calcNotifDeleteAt(type, true, readAt);
        } catch (e) {
            deleteAt = calcNotifDeleteAt('INFO', true, readAt);
        }
        await db.collection('notifications').doc(notifId).update({
            isRead: true, readAt, deleteAt
        });
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

// Obsłuż akcję powiadomienia (Będę / Nie będę)
async function handleNotificationAction(notifId, result, comment, referenceId) {
    if (!db) return;
    try {
        await db.collection('notifications').doc(notifId).update({
            actionDone: true, actionResult: result, actionComment: comment || null,
            isRead: true, readAt: new Date().toISOString()
        });

        if (!referenceId) return;
        const eventDoc = await db.collection('events').doc(referenceId).get();
        if (!eventDoc.exists) return;
        const eventData = eventDoc.data();
        const att = eventData.attendance || { invited: [], confirmed: [], declined: [], declineReasons: {}, markedAbsent: [], decidedBy: {} };
        if (!att.decidedBy) att.decidedBy = {};

        const notifDoc = await db.collection('notifications').doc(notifId).get();
        const notifLocal = notifDoc.exists ? notifDoc.data() : {};
        const targetId = notifLocal.forPlayerId || getCurrentUserId();
        const currentUser = getCurrentUserId();

        // Pobierz dane usera
        let userName = currentUser, userRole = 'user';
        try {
            const uDoc = await db.collection('users').doc(currentUser).get();
            if (uDoc.exists) {
                userName = uDoc.data().displayName || currentUser;
                const r = uDoc.data().role || '';
                if (r.includes('TRENER')) userRole = 'trener';
                else if (r === 'RODZIC') userRole = 'rodzic';
                else if (r === 'ZAWODNIK') userRole = 'zawodnik';
                else userRole = r.toLowerCase();
            }
        } catch (e) { }

        // Aktualizuj listy
        att.confirmed = (att.confirmed || []).filter(id => id !== targetId);
        att.declined = (att.declined || []).filter(id => id !== targetId);
        att.markedAbsent = (att.markedAbsent || []).filter(id => id !== targetId);
        if (att.declineReasons) delete att.declineReasons[targetId];

        if (result === 'confirmed') {
            att.confirmed.push(targetId);
        } else if (result === 'declined') {
            att.declined.push(targetId);
            if (comment) {
                if (!att.declineReasons) att.declineReasons = {};
                att.declineReasons[targetId] = comment;
            }
        }

        att.decidedBy[targetId] = { by: currentUser, byName: userName, byRole: userRole, at: new Date().toISOString() };
        await db.collection('events').doc(referenceId).update({ attendance: att });
        console.log(`✅ Obecność: ${targetId} → ${result} (zgł. ${userName})`);

        // Pobierz nazwę zawodnika
        let playerName = targetId;
        try {
            const pDoc = await db.collection('players').doc(targetId).get();
            if (pDoc.exists) playerName = pDoc.data().name || targetId;
        } catch (e) { }

        const d = new Date(eventData.date + 'T00:00:00');
        const dateStr = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
        const typeNames = { 'TRENING': 'Trening', 'MECZ': 'Mecz', 'WYJAZD': 'Wyjazd', 'INNE': 'Wydarzenie' };
        const typeName = typeNames[eventData.type] || 'Wydarzenie';
        const bodyBase = `${typeName} ${dateStr}, ${eventData.timeFrom || ''}\u2013${eventData.timeTo || ''}`;
        const reasonText = comment ? ` \u00B7 Pow\u00F3d: ${comment}` : '';
        const resultVerb = result === 'confirmed' ? 'potwierdzi\u0142(a) obecno\u015B\u0107' : 'zg\u0142osi\u0142(a) nieobecno\u015B\u0107';

        // Powiadomienie krzyżowe: rodzic↔zawodnik
        await sendCrossNotification(targetId, currentUser, userName, userRole, resultVerb, bodyBase, reasonText, eventData, referenceId);
    } catch (error) {
        console.error('Error handling notification action:', error);
    }
}

// Powiadomienie krzyżowe — rodzic↔zawodnik
async function sendCrossNotification(targetPlayerId, deciderId, deciderName, deciderRole, resultVerb, bodyBase, reasonText, eventData, eventId) {
    if (!db) return;
    try {
        if (deciderRole === 'rodzic') {
            // Znajdź userId zawodnika przez membership ZAWODNIK
            const snap = await db.collection('memberships')
                .where('playerId', '==', targetPlayerId)
                .where('role', '==', 'ZAWODNIK')
                .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
                .limit(1).get();
            if (!snap.empty) {
                const playerUserId = snap.docs[0].data().userId;
                await createNotification({
                    userId: playerUserId, teamId: eventData.teamId, type: 'ATTENDANCE_UPDATE',
                    title: `${deciderName} ${resultVerb}`, body: `${bodyBase}${reasonText}`,
                    referenceId: eventId, referenceType: 'event', forPlayerId: targetPlayerId,
                    requiresAction: true, actionType: 'ATTENDANCE', priority: 'NORMAL'
                });
            }
        } else if (deciderRole === 'zawodnik') {
            // Znajdź userId rodzica przez membership RODZIC
            const snap = await db.collection('memberships')
                .where('playerId', '==', targetPlayerId)
                .where('role', '==', 'RODZIC')
                .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
                .get();
            let playerName = targetPlayerId;
            try { const pDoc = await db.collection('players').doc(targetPlayerId).get(); if (pDoc.exists) playerName = pDoc.data().name || targetPlayerId; } catch (e) { }
            for (const doc of snap.docs) {
                const parentUserId = doc.data().userId;
                await createNotification({
                    userId: parentUserId, teamId: eventData.teamId, type: 'ATTENDANCE_UPDATE',
                    title: `${playerName} ${resultVerb}`, body: `${bodyBase}${reasonText}`,
                    referenceId: eventId, referenceType: 'event', forPlayerId: targetPlayerId,
                    requiresAction: true, actionType: 'ATTENDANCE', priority: 'NORMAL'
                });
            }
        }
    } catch (e) { console.error('Error sending cross notification:', e); }
}

// Zlicz nieprzeczytane powiadomienia
async function countUnreadNotifications(userId) {
    if (!db || !userId) return 0;
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('isRead', '==', false)
            .get();
        return snapshot.size;
    } catch (error) {
        console.error('Error counting notifications:', error);
        return 0;
    }
}

/* ── UI: Overlay powiadomień ── */
let notifData = [];

async function loadAndRenderNotifications() {
    const userId = getCurrentUserId();
    if (!userId) return;

    notifData = await getUserNotifications(userId);

    // Auto-cleanup starych powiadomień
    const now = new Date();
    const DAY_2  =  2 * 24 * 60 * 60 * 1000;
    const DAY_7  =  7 * 24 * 60 * 60 * 1000;
    const DAY_14 = 14 * 24 * 60 * 60 * 1000;
    const DAY_60 = 60 * 24 * 60 * 60 * 1000;
    const toDelete = [];
    notifData = notifData.filter(n => {
        const isMsg = n.type === 'NEW_MESSAGE' || n.type === 'NEW_ANNOUNCEMENT';
        let shouldDelete;
        if (isMsg) {
            // Wiadomości: przeczytane → 48h od odczytania, nieprzeczytane → 7 dni od utworzenia
            if (n.isRead) {
                const readAge = now - new Date(n.readAt || n.createdAt || 0);
                shouldDelete = readAge > DAY_2;
            } else {
                const age = now - new Date(n.createdAt || 0);
                shouldDelete = age > DAY_7;
            }
        } else {
            const age = now - new Date(n.createdAt || 0);
            shouldDelete = (n.isRead && age > DAY_14) || (!n.isRead && age > DAY_60);
        }
        if (shouldDelete) toDelete.push(n);
        return !shouldDelete;
    });
    for (const n of toDelete) {
        try { await db.collection('notifications').doc(n.notificationId || n.id).update({ status: 'DELETE' }); } catch (e) { }
    }
    if (toDelete.length > 0) console.log(`📦 Auto-archiwizacja: ${toDelete.length} starych powiadomień`);

    // Auto-deaktywacja powiadomień attendance dla przeszłych/zakończonych eventów i graczy z absencją
    const nowLocal = new Date();
    const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,'0')}-${String(nowLocal.getDate()).padStart(2,'0')}`;

    // Pobierz absencje (dla sprawdzania przy wyświetlaniu)
    let activeAbsences = [];
    try {
        const absSnap = await db.collection('absences').where('isActive', '==', true).get();
        activeAbsences = absSnap.docs.map(d => d.data());
    } catch (e) { }

    const toDeactivate = notifData.filter(n =>
        n.actionType === 'ATTENDANCE' && !n.actionDone && n.referenceId
    );
    for (const n of toDeactivate) {
        try {
            const evDoc = await db.collection('events').doc(n.referenceId).get();
            if (!evDoc.exists) {
                // Event usunięty — deaktywuj powiadomienie
                await db.collection('notifications').doc(n.notificationId || n.id).update({
                    actionDone: true, actionResult: 'expired', isRead: true, readAt: new Date().toISOString()
                });
                n.actionDone = true; n.actionResult = 'expired'; n.isRead = true;
                continue;
            }
            const ev = evDoc.data();
            const isPast = ev.date < todayStr;
            const isFinished = ev.type === 'MECZ' && ev.matchData?.matchStatus === 'FINISHED';

            // Sprawdź absencję gracza (forPlayerId) na datę eventu
            const hasAbsence = n.forPlayerId && activeAbsences.some(a =>
                a.playerId === n.forPlayerId && a.dateFrom <= ev.date && a.dateTo >= ev.date
            );

            // Sprawdź czy gracz już potwierdził/odmówił w attendance eventu
            // (np. kliknął przycisk na dashboardzie zamiast w powiadomieniu)
            const att = ev.attendance || {};
            // forPlayerId dla zawodnika/rodzica; fallback na userId dla trenera
            const targetId = n.forPlayerId || getCurrentUserId();
            let alreadyDecided = false;
            let decidedResult = null;

            // Trener jest twórcą eventu — nie powinien mieć ATTENDANCE notif (błąd legacy danych)
            const isCreatorNotif = !n.forPlayerId && ev.createdBy && ev.createdBy === getCurrentUserId();
            if (isCreatorNotif) { alreadyDecided = true; decidedResult = 'expired'; }

            if (!alreadyDecided && targetId) {
                if ((att.confirmed || []).includes(targetId)) {
                    alreadyDecided = true; decidedResult = 'confirmed';
                } else if ((att.declined || []).includes(targetId)) {
                    alreadyDecided = true; decidedResult = 'declined';
                }
            }

            if (isPast || isFinished || hasAbsence || alreadyDecided) {
                let result = 'expired';
                if (hasAbsence) result = 'absence';
                else if (alreadyDecided) result = decidedResult;
                await db.collection('notifications').doc(n.notificationId || n.id).update({
                    actionDone: true,
                    actionResult: result,
                    isRead: true,
                    readAt: new Date().toISOString()
                });
                n.actionDone = true;
                n.actionResult = result;
                n.isRead = true;
            }
        } catch (e) { }
    }

    // Wygaś potwierdzone/odmówione powiadomienia dla przeszłych/zakończonych eventów
    // (toDeactivate obsługuje tylko !actionDone — ten loop obsługuje już podjęte decyzje)
    const toExpireDecided = notifData.filter(n =>
        n.actionType === 'ATTENDANCE' && n.actionDone &&
        (n.actionResult === 'confirmed' || n.actionResult === 'declined') && n.referenceId
    );
    for (const n of toExpireDecided) {
        try {
            const evDoc = await db.collection('events').doc(n.referenceId).get();
            if (!evDoc.exists) {
                await db.collection('notifications').doc(n.notificationId || n.id).update({ actionResult: 'expired' });
                n.actionResult = 'expired';
                continue;
            }
            const ev = evDoc.data();
            const isPast = ev.date < todayStr;
            const isFinished = ev.type === 'MECZ' && ev.matchData?.matchStatus === 'FINISHED';
            if (isPast || isFinished) {
                await db.collection('notifications').doc(n.notificationId || n.id).update({ actionResult: 'expired' });
                n.actionResult = 'expired';
            }
        } catch (e) { }
    }

    // Auto-deaktywacja powiadomień o wiadomościach — jeśli przeczytana, usunięta lub zarchiwizowana
    const msgNotifs = notifData.filter(n =>
        (n.referenceType || '').toLowerCase() === 'message' && !n.isRead && n.referenceId
    );
    for (const n of msgNotifs) {
        try {
            const msgDoc = await db.collection('messages').doc(n.referenceId).get();
            const msgData = msgDoc.exists ? msgDoc.data() : null;
            // NEW_MESSAGE = powiadomienie o odpowiedzi — NIE auto-markuj na podstawie readBy roota
            // bo root może być przeczytany a nowa odpowiedź jeszcze nie
            const isReplyNotif = n.type === 'NEW_MESSAGE';
            const alreadyRead = !isReplyNotif && msgData && (msgData.readBy || []).includes(userId);
            if (!msgDoc.exists || (msgData && msgData.archived) || alreadyRead) {
                await db.collection('notifications').doc(n.notificationId || n.id).update({
                    isRead: true, readAt: new Date().toISOString()
                });
                n.isRead = true;
            }
        } catch (e) { }
    }

    // Auto-deaktywacja powiadomień o zadaniach — jeśli zadanie usunięte
    const taskNotifs = notifData.filter(n =>
        (n.referenceType || '').toLowerCase() === 'task' && !n.isRead && n.referenceId
    );
    for (const n of taskNotifs) {
        try {
            const taskDoc = await db.collection('tasks').doc(n.referenceId).get();
            if (!taskDoc.exists) {
                await db.collection('notifications').doc(n.notificationId || n.id).update({
                    isRead: true, readAt: new Date().toISOString()
                });
                n.isRead = true;
            }
        } catch (e) { }
    }

    // Auto-oznacz nieprzeczytane nieakcyjne jako przeczytane gdy overlay jest otwarty
    const notifOverlay = document.getElementById('notif-ov');
    if (notifOverlay && notifOverlay.classList.contains('open')) {
        for (const n of notifData) {
            if (!n.isRead && !n.requiresAction) {
                n.isRead = true;
                n.readAt = new Date().toISOString();
                markNotificationRead(n.notificationId || n.id).catch(() => {});
            }
        }
    }

    // Filtruj powiadomienia do wyświetlenia:
    // 1. ATTENDANCE actionDone:false — ukryj jeśli event poza oknem przypomnienia
    // 2. ATTENDANCE actionResult:expired — ukryj całkowicie (event przeszły, po północy znika)
    // 3. Przeczytane informacyjne (requiresAction:false, isRead:true) — widoczne przez 24h, potem znikają
    const visibleNotifData = [];
    for (const n of notifData) {
        // Ukryj powiadomienia z wygasłym terminem — po północy znikają z widoku
        if (n.actionType === 'ATTENDANCE' && n.actionDone && n.actionResult === 'expired') {
            continue;
        }
        // Przeczytane nieakcyjne — NEW_MESSAGE widoczne 48h, pozostałe 24h
        if (n.isRead && !n.requiresAction) {
            const readAgo = n.readAt ? Date.now() - new Date(n.readAt).getTime() : 0;
            const maxAge = (n.type === 'NEW_MESSAGE' || n.type === 'NEW_ANNOUNCEMENT')
                ? 2 * 24 * 60 * 60 * 1000
                : 24 * 60 * 60 * 1000;
            if (readAgo < maxAge) {
                visibleNotifData.push(n);
            }
            continue;
        }
        // Ukryj aktywne ATTENDANCE jeśli event poza oknem przypomnienia
        if (n.actionType === 'ATTENDANCE' && !n.actionDone && n.referenceId) {
            try {
                const evDoc = await db.collection('events').doc(n.referenceId).get();
                if (evDoc.exists) {
                    const ev = evDoc.data();
                    if (!isEventInReminderWindow(ev)) continue;
                }
            } catch (e) { }
        }
        visibleNotifData.push(n);
    }
    notifData = visibleNotifData;

    const unread = notifData.filter(n => !n.isRead).length;

    // Zaktualizuj licznik na dzwonku
    const bellCount = document.getElementById('bell-count');
    if (bellCount) {
        bellCount.textContent = unread > 99 ? '99+' : unread;
        bellCount.style.display = unread > 0 ? '' : 'none';
    }

    renderNotifOverlay();
}

function renderNotifOverlay() {
    const overlay = document.getElementById('notif-ov');
    if (!overlay) return;

    const hdr = overlay.querySelector('.notif-hdr');
    overlay.innerHTML = '';
    if (hdr) overlay.appendChild(hdr);

    if (notifData.length === 0) {
        overlay.innerHTML += '<div style="padding:20px;text-align:center;color:var(--szary);font-size:13px;">Brak powiadomień</div>';
        return;
    }

    notifData.forEach(n => {
        const item = document.createElement('div');
        item.className = 'notif-item';
        item.style.opacity = n.isRead ? '0.5' : '1';
        item.style.cursor = 'pointer';

        const dotClass = n.isRead ? 'notif-dot read' : 'notif-dot';
        const timeAgo = getTimeAgo(n.createdAt);

        let actionsHtml = '';
        if (n.requiresAction && n.actionType === 'ATTENDANCE') {
            if (!n.actionDone) {
                // Jeszcze nie kliknął — pokaż przyciski
                actionsHtml = `
                    <div style="display:flex;gap:8px;margin-top:8px;" onclick="event.stopPropagation()">
                        <button onclick="confirmAttendanceFromNotif('${n.notificationId}','${n.referenceId}')" style="flex:1;padding:7px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.25);border-radius:999px;color:#16A34A;font-size:11px;font-weight:900;cursor:pointer;">✅ Będę</button>
                        <button onclick="declineAttendanceFromNotif('${n.notificationId}','${n.referenceId}')" style="flex:1;padding:7px;background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.20);border-radius:999px;color:#DC2626;font-size:11px;font-weight:900;cursor:pointer;">❌ Nie będę</button>
                    </div>
                `;
            } else {
                // Już kliknął — pokaż decyzję + przycisk zmiany
                if (n.actionResult === 'expired') {
                    actionsHtml = `
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                        <span style="font-size:11px;font-weight:800;color:var(--szary);">⏰ Termin minął</span>
                    </div>
                    `;
                } else if (n.actionResult === 'absence') {
                    actionsHtml = `
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                        <span style="font-size:11px;font-weight:800;color:var(--warn);">🔒 Nieobecność zgłoszona</span>
                    </div>
                    `;
                } else {
                    const resultText = n.actionResult === 'confirmed' ? '✅ Będę' : '❌ Nie będę';
                    const resultColor = n.actionResult === 'confirmed' ? 'var(--sukces)' : 'var(--blad)';
                    const commentHtml = n.actionComment ? `<span style="color:var(--szary);font-style:italic;"> — ${_nt(n.actionComment, 40)}</span>` : '';
                actionsHtml = `
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;" onclick="event.stopPropagation()">
                        <span style="font-size:11px;font-weight:800;color:${resultColor};">${resultText}${commentHtml}</span>
                        <button onclick="resetNotifAction('${n.notificationId}','${n.referenceId}')" style="padding:4px 10px;background:var(--tlo-karta2);border:1px solid var(--border2);border-radius:999px;color:var(--szary);font-size:10px;font-weight:800;cursor:pointer;">Zmień</button>
                    </div>
                `;
                }
            }
        }
        if (n.requiresAction && n.actionType === 'TASK') {
            if (!n.actionDone) {
                actionsHtml = `
                <div style="display:flex;gap:8px;margin-top:8px;" onclick="event.stopPropagation()">
                    <button onclick="completeTaskFromNotif('${n.notificationId}','${n.referenceId}')" style="flex:1;padding:7px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.25);border-radius:999px;color:#16A34A;font-size:11px;font-weight:900;cursor:pointer;">✅ Wykonane</button>
                    <button onclick="rejectTaskFromNotif('${n.notificationId}','${n.referenceId}')" style="flex:1;padding:7px;background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.20);border-radius:999px;color:#DC2626;font-size:11px;font-weight:900;cursor:pointer;">❌ Odrzuć</button>
                </div>
            `;
            } else {
                const resultText = n.actionResult === 'completed' ? '✅ Wykonane' : '❌ Odrzucone';
                const resultColor = n.actionResult === 'completed' ? 'var(--sukces)' : 'var(--blad)';
                const commentHtml = n.actionComment ? `<span style="color:var(--szary);font-style:italic;"> — ${n.actionComment}</span>` : '';
                actionsHtml = `
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;" onclick="event.stopPropagation()">
                    <span style="font-size:11px;font-weight:800;color:${resultColor};">${resultText}${commentHtml}</span>
                    <button onclick="resetTaskNotifAction('${n.notificationId}','${n.referenceId}')" style="padding:4px 10px;background:var(--tlo-karta2);border:1px solid var(--border2);border-radius:999px;color:var(--szary);font-size:10px;font-weight:800;cursor:pointer;">Zmień</button>
                </div>
            `;
            }
        }

        if (n.requiresAction && n.actionType === 'TAKEOVER') {
            if (!n.actionDone) {
                actionsHtml = `
                <div style="display:flex;gap:8px;margin-top:8px;" onclick="event.stopPropagation()">
                    <button onclick="approveTakeoverFromNotif('${n.notificationId}','${n.referenceId}')" style="flex:1;padding:7px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.25);border-radius:999px;color:#16A34A;font-size:11px;font-weight:900;cursor:pointer;">✅ Zgadzam się</button>
                    <button onclick="rejectTakeoverFromNotif('${n.notificationId}','${n.referenceId}')" style="flex:1;padding:7px;background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.20);border-radius:999px;color:#DC2626;font-size:11px;font-weight:900;cursor:pointer;">❌ Odrzucam</button>
                </div>
            `;
            } else {
                const resultText = n.actionResult === 'approved' ? '✅ Przekazano' : '❌ Odrzucono';
                const resultColor = n.actionResult === 'approved' ? 'var(--sukces)' : 'var(--blad)';
                actionsHtml = `
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;" onclick="event.stopPropagation()">
                    <span style="font-size:11px;font-weight:800;color:${resultColor};">${resultText}</span>
                </div>
            `;
            }
        }

        const _nt = (s, max) => s && s.length > max ? s.substring(0, max) + '…' : (s || '');
        item.innerHTML = `
            <div class="${dotClass}"></div>
            <div style="flex:1;min-width:0;overflow:hidden;">
                <div class="notif-msg">${_nt(n.title, 55)}</div>
                <div style="font-size:12px;color:var(--szary-j);margin-top:2px;font-weight:600;">${_nt(n.body, 90)}</div>
                ${actionsHtml}
                <div class="notif-time">${timeAgo}</div>
            </div>
        `;

        item.onclick = async () => {
            if (!n.isRead) {
                await markNotificationRead(n.notificationId || n.id);
                n.isRead = true;
                n.readAt = new Date().toISOString();
                loadAndRenderNotifications();
            }
            const rt = (n.referenceType || '').toLowerCase();
            const rid = n.referenceId || '';
            const t = n.type || '';
            if (rt === 'message') {
                window.location.href = `czat_detail.html?msgId=${rid}`;
            } else if (rt === 'event') {
                window.location.href = 'kalendarz.html' + (rid ? `?eventId=${rid}` : '');
            } else if (rt === 'task') {
                window.location.href = 'zadania.html';
            }
        };

        overlay.appendChild(item);
    });
}

// Globalna synchronizacja — po akcji na powiadomieniu odśwież powiadomienia + ekran (jeśli callback zarejestrowany)
async function afterNotifAction() {
    await loadAndRenderNotifications();
    if (typeof window.onNotifAction === 'function') window.onNotifAction();
}

// Akcja: Będę
async function confirmAttendanceFromNotif(notifId, eventId) {
    await handleNotificationAction(notifId, 'confirmed', null, eventId);
    await afterNotifAction();
}

// Akcja: Nie będę (z powodem)
async function declineAttendanceFromNotif(notifId, eventId) {
    const reason = prompt('Podaj powód nieobecności (opcjonalnie):');
    await handleNotificationAction(notifId, 'declined', reason, eventId);
    await afterNotifAction();
}

// Zmiana decyzji — resetuje akcję i pokazuje przyciski ponownie
async function resetNotifAction(notifId, eventId) {
    if (!db) return;
    try {
        // Blokada — nie można zmieniać decyzji dla przeszłych eventów
        if (eventId) {
            const evCheck = await db.collection('events').doc(eventId).get();
            if (evCheck.exists) {
                const nowLocal = new Date();
                const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,'0')}-${String(nowLocal.getDate()).padStart(2,'0')}`;
                const isFinished = evCheck.data().type === 'MECZ' && evCheck.data().matchData?.matchStatus === 'FINISHED';
                if (evCheck.data().date < todayStr || isFinished) {
                    console.warn('⛔ Miniony event — brak możliwości zmiany');
                    return;
                }
            }
        }

        // Pobierz forPlayerId przed resetem
        const notifDoc = await db.collection('notifications').doc(notifId).get();
        const targetId = notifDoc.exists ? (notifDoc.data().forPlayerId || getCurrentUserId()) : getCurrentUserId();

        // Resetuj powiadomienie
        await db.collection('notifications').doc(notifId).update({
            actionDone: false,
            actionResult: null,
            actionComment: null,
            isRead: false,
            readAt: null
        });

        // Usuń z confirmed/declined w evencie
        if (eventId) {
            const eventDoc = await db.collection('events').doc(eventId).get();
            if (eventDoc.exists) {
                const att = eventDoc.data().attendance || {};
                att.confirmed = (att.confirmed || []).filter(id => id !== targetId);
                att.declined = (att.declined || []).filter(id => id !== targetId);
                if (att.declineReasons) delete att.declineReasons[targetId];
                await db.collection('events').doc(eventId).update({ attendance: att });
            }
        }

        await afterNotifAction();
    } catch (e) {
        console.error('Error resetting action:', e);
    }
}

// Zadanie — Wykonane z powiadomienia
async function completeTaskFromNotif(notifId, taskId) {
    if (!db) return;
    try {
        // Oznacz powiadomienie
        await db.collection('notifications').doc(notifId).update({
            actionDone: true, actionResult: 'completed', isRead: true, readAt: new Date().toISOString()
        });

        // Zaktualizuj zadanie
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) return;
        const task = taskDoc.data();
        const completed = task.completedBy || [];
        const assigned = task.assignedTo || [];
        const rejected = task.rejectedBy || [];
        const userId = getCurrentUserId();

        if (!completed.includes(userId)) completed.push(userId);
        const cleanRejected = rejected.filter(id => id !== userId);
        const active = assigned.filter(id => !cleanRejected.includes(id));
        const status = (completed.length >= active.length && active.length > 0) ? 'DONE' : 'PENDING';

        await db.collection('tasks').doc(taskId).update({
            completedBy: completed, rejectedBy: cleanRejected, status: status, completedAt: new Date().toISOString()
        });

        // Powiadomienie dla twórcy
        if (task.createdBy && task.createdBy !== userId) {
            const userName = await getUserName(userId);
            await createNotification({
                userId: task.createdBy, teamId: task.teamId, type: 'TASK_COMPLETED',
                title: `${userName} — zadanie wykonane`,
                body: `${task.title} · termin: ${task.dueDate || ''}`,
                referenceId: taskId, referenceType: 'task', requiresAction: false, priority: 'NORMAL'
            });
        }
        await afterNotifAction();
    } catch (e) { console.error('❌ Błąd:', e); }
}

// Zadanie — Odrzuć z powiadomienia
async function rejectTaskFromNotif(notifId, taskId) {
    const reason = prompt('Podaj powód odrzucenia (opcjonalnie):');
    if (!db) return;
    try {
        await db.collection('notifications').doc(notifId).update({
            actionDone: true, actionResult: 'rejected', actionComment: reason || null, isRead: true, readAt: new Date().toISOString()
        });

        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) return;
        const task = taskDoc.data();
        const completed = (task.completedBy || []).filter(id => id !== getCurrentUserId());
        const rejected = task.rejectedBy || [];
        const reasons = task.rejectReasons || {};
        const userId = getCurrentUserId();

        if (!rejected.includes(userId)) rejected.push(userId);
        if (reason) reasons[userId] = reason;

        const assigned = task.assignedTo || [];
        const active = assigned.filter(id => !rejected.includes(id));
        const status = (completed.length >= active.length && active.length > 0) ? 'DONE' : 'PENDING';

        await db.collection('tasks').doc(taskId).update({
            completedBy: completed, rejectedBy: rejected, rejectReasons: reasons, status: status
        });

        if (task.createdBy && task.createdBy !== userId) {
            const userName = await getUserName(userId);
            const reasonText = reason ? ` · Powód: ${reason}` : '';
            await createNotification({
                userId: task.createdBy, teamId: task.teamId, type: 'TASK_REJECTED',
                title: `${userName} — zadanie odrzucone`,
                body: `${task.title}${reasonText}`,
                referenceId: taskId, referenceType: 'task', requiresAction: false, priority: 'NORMAL'
            });
        }
        await afterNotifAction();
    } catch (e) { console.error('❌ Błąd:', e); }
}

// Zadanie — Zmień decyzję
async function resetTaskNotifAction(notifId, taskId) {
    if (!db) return;
    try {
        const userId = getCurrentUserId();
        await db.collection('notifications').doc(notifId).update({
            actionDone: false, actionResult: null, actionComment: null, isRead: false, readAt: null
        });

        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (taskDoc.exists) {
            const task = taskDoc.data();
            const completed = (task.completedBy || []).filter(id => id !== userId);
            const rejected = (task.rejectedBy || []).filter(id => id !== userId);
            const reasons = task.rejectReasons || {};
            delete reasons[userId];
            await db.collection('tasks').doc(taskId).update({
                completedBy: completed, rejectedBy: rejected, rejectReasons: reasons, status: 'PENDING'
            });
        }
        await afterNotifAction();
    } catch (e) { console.error('❌ Błąd:', e); }
}

// Przejęcie meczu — Zgadzam się
async function approveTakeoverFromNotif(notifId, eventId) {
    if (!db) return;
    try {
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return;
        const md = eventDoc.data().matchData || {};
        const req = md.takeoverRequest;
        if (!req || !req.userId) { alert('Brak oczekującej prośby'); return; }

        await db.collection('events').doc(eventId).update({
            'matchData.liveAssistant': {
                userId: req.userId,
                displayName: req.displayName || req.userId,
                claimedAt: new Date().toISOString()
            },
            'matchData.takeoverRequest': null
        });

        await db.collection('notifications').doc(notifId).update({
            actionDone: true, actionResult: 'approved',
            isRead: true, readAt: new Date().toISOString()
        });

        await createNotification({
            userId: req.userId,
            teamId: eventDoc.data().teamId,
            type: 'MATCH_TAKEOVER_APPROVED',
            title: 'Przejęcie meczu zatwierdzone',
            body: `${eventDoc.data().title || ''} · Teraz obsługujesz ten mecz`,
            referenceId: eventId, referenceType: 'event',
            requiresAction: false, priority: 'HIGH'
        });

        console.log('✅ Przejęcie zatwierdzone dla:', req.displayName);
        await afterNotifAction();
    } catch (e) { console.error('❌ Błąd:', e); }
}

// Przejęcie meczu — Odrzucam
async function rejectTakeoverFromNotif(notifId, eventId) {
    if (!db) return;
    try {
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return;
        const md = eventDoc.data().matchData || {};
        const req = md.takeoverRequest;

        await db.collection('events').doc(eventId).update({
            'matchData.takeoverRequest': null
        });

        await db.collection('notifications').doc(notifId).update({
            actionDone: true, actionResult: 'rejected',
            isRead: true, readAt: new Date().toISOString()
        });

        if (req && req.userId) {
            const currentUser = await getCurrentUser();
            await createNotification({
                userId: req.userId,
                teamId: eventDoc.data().teamId,
                type: 'MATCH_TAKEOVER_REJECTED',
                title: 'Prośba o przejęcie odrzucona',
                body: `${eventDoc.data().title || ''} · ${currentUser?.displayName || ''} odrzucił(a) prośbę`,
                referenceId: eventId, referenceType: 'event',
                requiresAction: false, priority: 'NORMAL'
            });
        }

        console.log('✅ Przejęcie odrzucone');
        await afterNotifAction();
    } catch (e) { console.error('❌ Błąd:', e); }
}

// Helper: czas temu
function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return 'teraz';
    if (diffMin < 60) return `${diffMin} min temu`;
    if (diffH < 24) return `${diffH} godz. temu`;
    if (diffD === 1) return 'wczoraj';
    if (diffD < 7) return `${diffD} dni temu`;
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

/* ── Globalne formatery dat ── */

// Wyświetlanie daty z godziną: "2026-03-22 (niedziela) 15:00"
function formatDateTimeDisplay(dateInput) {
    if (!dateInput) return '';
    const d = typeof dateInput === 'string' ? new Date(dateInput.includes('T') ? dateInput : dateInput + 'T00:00:00') :
        (dateInput.toDate ? dateInput.toDate() : new Date(dateInput));
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dayName = d.toLocaleDateString('pl-PL', { weekday: 'long' });
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} (${dayName}) ${hh}:${min}`;
}

// Wyświetlanie samej daty: "2026-03-22 (niedziela)"
function formatDateDisplay(dateInput) {
    if (!dateInput) return '';
    const d = typeof dateInput === 'string' ? new Date(dateInput.includes('T') ? dateInput : dateInput + 'T00:00:00') :
        (dateInput.toDate ? dateInput.toDate() : new Date(dateInput));
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dayName = d.toLocaleDateString('pl-PL', { weekday: 'long' });
    return `${yyyy}-${mm}-${dd} (${dayName})`;
}

// Krótki format daty: "śr. 21 mar"
function formatDateShort(dateInput) {
    if (!dateInput) return '';
    const d = typeof dateInput === 'string' ? new Date(dateInput.includes('T') ? dateInput : dateInput + 'T00:00:00') :
        (dateInput.toDate ? dateInput.toDate() : new Date(dateInput));
    if (isNaN(d.getTime())) return '';
    const dayName = d.toLocaleDateString('pl-PL', { weekday: 'short' });
    const dateStr = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return `${dayName} ${dateStr}`;
}

/* ═══════════════════════════════════════════════════
   NAVIGATION & UI HELPERS
═══════════════════════════════════════════════════ */

/* ── Nawigacja między ekranami (linki w bottom nav) ── */
/* Każdy ekran to osobny plik HTML.
   Bottom nav używa <a href="..."> więc nawigacja działa natywnie. */

/* ── Kontekst overlay (klub > zespół) ── */
function toggleCtxOv() {
    closeNotifOv();
    document.getElementById('ctx-ov').classList.toggle('open');
}
function closeCtxOv() {
    const el = document.getElementById('ctx-ov');
    if (el) el.classList.remove('open');
}


// Wypełnij overlay kontekstu danymi usera (globalna — używana przez każdy ekran)
// user     — dokument users/{uid}
// membership — aktywny dokument memberships (rola, trainerRole)
// team     — dokument teams/{teamId} (teamName, clubName, teamColor)
async function loadCtxOverlay(user, membership, team) {
    if (!team) return;

    const roleNames = {
        'TRENER_GLOWNY': 'Trener główny',
        'TRENER_POMOCNICZY': 'Trener pomocniczy',
        'RODZIC': 'Rodzic',
        'ZAWODNIK': 'Zawodnik',
        'KIBIC': 'Kibic'
    };

    const effectiveRole = membership
        ? (membership.role === 'TRENER' ? (membership.trainerRole || 'TRENER_GLOWNY') : membership.role)
        : '';
    const clubId    = membership?.clubId || team.clubId || '';
    const clubName  = team.clubName  || '';
    const teamName  = team.teamName  || team.displayName || '';
    const teamColor = team.teamColor || 'var(--akcent)';
    const currentTeamId = team.teamId || team.id || '';

    // Baner archiwum — gdy user przegląda poprzednią drużynę (INACTIVE membership)
    if (membership?._isArchive) showArchiveBanner(teamName);

    // Dot w overlay
    const dotEl = document.getElementById('ctx-ov-dot');
    if (dotEl) {
        dotEl.textContent = clubName.charAt(0) || '?';
        dotEl.style.background = teamColor;
    }

    // Nazwa klubu i rola
    const nameEl = document.getElementById('ctx-ov-klub-name');
    const roleEl = document.getElementById('ctx-ov-klub-role');
    if (nameEl) nameEl.textContent = clubName;
    if (roleEl) roleEl.textContent = roleNames[effectiveRole] || effectiveRole;

    // Top-bar dot
    const topDot = document.getElementById('ctx-dot');
    if (topDot) {
        topDot.textContent = teamName.charAt(0) || '?';
        topDot.style.background = teamColor;
    }

    // Top-bar teksty
    const topKlub = document.getElementById('ctx-klub');
    const topTeam = document.getElementById('ctx-team');
    if (topKlub) topKlub.textContent = clubName;
    if (topTeam) topTeam.textContent = teamName;

    // Lista drużyn — wszystkie drużyny klubu (dla adminów) lub przypisane (dla trenerów)
    const teamsEl = document.getElementById('ctx-teams');
    if (!teamsEl) return;
    teamsEl.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--szary);">Ładowanie...</div>';

    try {
        let allTeams = [];
        // isAdmin — sprawdź bieżące membership ORAZ wszystkie aktywne (backfill mogły nie mieć flagi)
        const _cachedMbrs = getCurrentUserData()?.allMemberships || [];
        const isAdmin = !!(membership?.isClubAdmin || _cachedMbrs.some(m => m.isClubAdmin === true));
        const isTrenerGlowny = effectiveRole === 'TRENER_GLOWNY';

        if (clubId && db) {
            if (isAdmin || isTrenerGlowny) {
                // Admin i trener główny widzi wszystkie drużyny klubu
                const snap = await db.collection('teams').where('clubId', '==', clubId).get();
                allTeams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else {
                // Trener pomocniczy, rodzic, zawodnik — tylko swoja drużyna (rozszerzone poniżej o inne aktywne)
                allTeams = [team];
            }
        } else {
            allTeams = [team];
        }

        // Memberships usera — z cache currentUserData (szybkie, bez dodatkowego zapytania)
        // Fallback: zapytanie Firestore jeśli cache niedostępny (np. ekrany bez initSession)
        const userId = getCurrentUserId();
        let activeMemberships = getCurrentUserData()?.allMemberships || [];
        if (activeMemberships.length === 0 && db && userId) {
            try {
                activeMemberships = await getUserMemberships(userId);
            } catch(e) {}
        }
        // Indeks aktywnych po teamId
        const membershipByTeam = {};
        activeMemberships.forEach(m => {
            if (m.teamId) membershipByTeam[m.teamId] = m;
        });

        // Dołącz wszystkie drużyny z aktywnych memberships których jeszcze nie ma na liście
        // (dotyczy każdej roli — np. trener w klubie A i rodzic w klubie B widzi obie drużyny)
        {
            const extraTeamIds = Object.keys(membershipByTeam)
                .filter(tid => !allTeams.some(t => (t.teamId || t.id) === tid));
            if (extraTeamIds.length > 0 && db) {
                try {
                    const extraSnaps = await Promise.all(
                        extraTeamIds.map(tid => db.collection('teams').doc(tid).get())
                    );
                    extraSnaps.forEach(d => { if (d.exists) allTeams.push({ id: d.id, ...d.data() }); });
                } catch(e) { /* ignoruj */ }
            }
        }
        // Pobierz zablokowane/usunięte osobno (by pokazać status)
        const blockedByTeam = {};
        try {
            const blockedSnap = await db.collection('memberships')
                .where('userId', '==', userId)
                .where('status', 'in', ['BLOCKED', 'REMOVED'])
                .get();
            blockedSnap.docs.forEach(d => {
                const m = { id: d.id, ...d.data() };
                if (m.teamId && !membershipByTeam[m.teamId]) blockedByTeam[m.teamId] = m;
            });
        } catch(e) { /* brak indeksu lub brak uprawnień — ignoruj */ }

        // Pobierz archiwalne (INACTIVE) — poprzednie drużyny po transferze
        const archivedByTeam = {};
        try {
            const archivedMbrs = await getArchivedMemberships(userId);
            archivedMbrs.forEach(m => {
                if (m.teamId && !membershipByTeam[m.teamId] && !blockedByTeam[m.teamId])
                    archivedByTeam[m.teamId] = m;
            });
        } catch(e) { /* ignoruj */ }

        // Dla ról innych niż admin/TRENER_GLOWNY — dołącz archiwalne drużyny do listy
        if (!isAdmin && !isTrenerGlowny && Object.keys(archivedByTeam).length > 0) {
            const archivedTeamIds = Object.keys(archivedByTeam).filter(tid => !allTeams.some(t => (t.teamId || t.id) === tid));
            if (archivedTeamIds.length > 0) {
                try {
                    const archSnaps = await Promise.all(
                        archivedTeamIds.map(tid => db.collection('teams').doc(tid).get())
                    );
                    archSnaps.forEach(d => { if (d.exists) allTeams.push({ id: d.id, ...d.data() }); });
                } catch(e) { /* ignoruj */ }
            }
        }

        teamsEl.innerHTML = '';
        allTeams.forEach(t => {
            const tid    = t.teamId || t.id;
            const tName  = t.teamName || t.displayName || tid;
            const tColor = t.teamColor || 'var(--akcent)';
            const isSelected = tid === currentTeamId;

            const mbr        = membershipByTeam[tid];
            const blockedMbr = blockedByTeam[tid];
            const archivedMbr = archivedByTeam[tid];
            const isBlocked  = blockedMbr?.status === 'BLOCKED';
            const isRemoved  = blockedMbr?.status === 'REMOVED';
            const isArchive  = !!archivedMbr;

            // Admin bez aktywnego membership może auto-tworzyć — traktuj jak normalny kafelek
            const adminCanCreate = isAdmin && !mbr;

            const opt = document.createElement('div');
            opt.className = 'ctx-team-opt' + (isSelected ? ' selected' : '') + ((isBlocked || isRemoved) && !adminCanCreate ? ' ctx-team-opt--inactive' : '');
            opt.style.opacity = ((isBlocked || isRemoved) && !adminCanCreate) ? '0.6' : isArchive ? '0.7' : '';

            let statusBadge = '';
            if (isBlocked && !adminCanCreate)  statusBadge = `<span style="font-size:10px;color:#ff6b6b;margin-left:auto;">🔒 zablokowany</span>`;
            else if (isRemoved && !adminCanCreate)  statusBadge = `<span style="font-size:10px;color:var(--szary);margin-left:auto;">usunięty</span>`;
            else if (isArchive)  statusBadge = `<span style="font-size:10px;color:var(--szary);margin-left:auto;">📁 archiwum</span>`;

            // Rola dla tej konkretnej drużyny (może być inna niż bieżąca)
            const tMbr = mbr || blockedMbr || archivedMbr;
            const tRole = tMbr
                ? (tMbr.role === 'TRENER' ? (tMbr.trainerRole || 'TRENER_GLOWNY') : tMbr.role)
                : effectiveRole;
            opt.innerHTML = `
                <div class="ctx-team-color" style="background:${tColor}"></div>
                <span class="ctx-team-name">${tName}</span>
                <span class="ctx-team-role">${roleNames[tRole] || tRole}</span>
                ${isSelected ? '<span class="ctx-team-check">✓</span>' : statusBadge}
            `;

            if (!isSelected) {
                if (isAdmin && !mbr) {
                    // Admin bez aktywnego membership — auto-utwórz (ignoruj REMOVED/BLOCKED/brak)
                    opt.style.opacity = '';
                    opt.onclick = async () => {
                        try {
                            const userId = getCurrentUserId();
                            const userData = getCurrentUserData();
                            const now = new Date();
                            const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
                            const mbrId = makeMbrId('TRENER_GLOWNY');
                            await db.collection('memberships').doc(mbrId).set({
                                membershipId: mbrId,
                                userId,
                                teamId: tid,
                                clubId: t.clubId || clubId || null,
                                role: 'TRENER_GLOWNY',
                                trainerRole: 'TRENER_GLOWNY',
                                status: 'ACTIVE',
                                displayName: userData?.displayName || '',
                                isClubAdmin: true,
                                joinedAt: now.toISOString(),
                                createdAt: now.toISOString()
                            });
                            await switchTeam(mbrId, tName);
                        } catch(e) {
                            console.error('❌ auto-membership admin:', e);
                            showCtxMsg('Błąd podczas przełączania drużyny.');
                        }
                    };
                } else if (isBlocked) {
                    opt.onclick = () => showCtxMsg(`Twój dostęp do drużyny "${tName}" jest zablokowany.`);
                } else if (isRemoved) {
                    opt.onclick = () => showCtxMsg(`Nie jesteś już członkiem drużyny "${tName}".`);
                } else if (isArchive) {
                    opt.onclick = () => switchTeam(archivedMbr.id, tName);
                } else if (mbr) {
                    opt.onclick = () => switchTeam(mbr.id, tName);
                } else {
                    opt.style.opacity = '0.4';
                }
            }
            teamsEl.appendChild(opt);
        });
    } catch(e) {
        console.error('loadCtxOverlay:', e);
        teamsEl.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--szary);">Błąd ładowania</div>';
    }
}

// Pokaż komunikat w overlay (zamiast zamykać)
function showCtxMsg(msg) {
    const el = document.getElementById('ctx-teams');
    if (!el) return;
    const info = document.createElement('div');
    info.style.cssText = 'padding:10px 12px;font-size:12px;color:#ff6b6b;line-height:1.4;border-top:1px solid rgba(255,255,255,0.08);';
    info.textContent = msg;
    // Usuń poprzednie info
    el.querySelectorAll('.ctx-msg-info').forEach(n => n.remove());
    info.className = 'ctx-msg-info';
    el.appendChild(info);
    setTimeout(() => info.remove(), 4000);
}

// Przełącz drużynę (ctx-switcher) — zapisuje selectedMembershipId do localStorage + Firestore
async function switchTeam(membershipId, teamName) {
    if (!db || !membershipId) return;
    const userId = getCurrentUserId();

    // Weryfikacja statusu membership przed przełączeniem
    try {
        const mDoc = await db.collection('memberships').doc(membershipId).get();
        if (!mDoc.exists) { showCtxMsg('Nie znaleziono membership dla tej drużyny.'); return; }
        const st = mDoc.data().status;
        if (st === 'BLOCKED') { showCtxMsg(`Twój dostęp do drużyny "${teamName}" jest zablokowany.`); return; }
        if (st === 'REMOVED') { showCtxMsg(`Nie jesteś już członkiem drużyny "${teamName}".`); return; }
        // INACTIVE — archiwum po transferze, pozwalamy wejść (tryb tylko do odczytu)
    } catch(e) { console.warn('switchTeam weryfikacja:', e); }

    closeCtxOv();
    localStorage.setItem('selectedMembershipId', membershipId);
    try {
        await db.collection('users').doc(userId).update({ selectedMembershipId: membershipId });
    } catch(e) { console.warn('switchTeam zapis Firestore:', e); }
    window.location.reload();
}


/* ══════════════════════════════════════════════════════════════════
   showArchiveBanner(teamName)
   Baner na górze ekranu informujący o trybie archiwum (tylko do odczytu).
   Wywoływana przez ekrany gdy membership._isArchive === true.
══════════════════════════════════════════════════════════════════ */
function showArchiveBanner(teamName) {
    if (document.getElementById('archive-banner')) return; // nie duplikuj
    const banner = document.createElement('div');
    banner.id = 'archive-banner';
    banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
        'background:rgba(30,30,30,0.97)', 'border-bottom:2px solid rgba(255,255,255,0.1)',
        'padding:8px 16px', 'display:flex', 'align-items:center', 'gap:10px',
        'font-size:12px', 'color:var(--szary,#aaa)'
    ].join(';');
    banner.innerHTML = `
        <span style="font-size:16px;">📁</span>
        <span>Przeglądasz archiwum drużyny <strong style="color:#fff">${teamName || ''}</strong> — tryb tylko do odczytu</span>
        <button onclick="switchToActiveTeam()" style="margin-left:auto;font-size:11px;font-weight:700;color:var(--akcent,#3B82F6);background:none;border:none;cursor:pointer;padding:0;">Wróć do aktywnej →</button>
    `;
    document.body.prepend(banner);
    // Przesuń główną treść żeby baner nie zasłaniał
    const main = document.querySelector('.phone-shell, body > main, .screen');
    if (main) main.style.paddingTop = (parseInt(main.style.paddingTop || 0) + 40) + 'px';
}

// Przełącz z powrotem na pierwsze aktywne membership
async function switchToActiveTeam() {
    const userId = getCurrentUserId();
    if (!userId || !db) return;
    try {
        const active = await getUserMemberships(userId);
        if (active.length > 0) {
            localStorage.setItem('selectedMembershipId', active[0].id);
            await db.collection('users').doc(userId).update({ selectedMembershipId: active[0].id });
            window.location.reload();
        }
    } catch(e) { console.error('switchToActiveTeam:', e); }
}

// Wypełnij menu panel danymi usera (globalna — używana przez każdy ekran)
// membership — aktywny dokument memberships (rola)
// team       — dokument teams/{teamId} (clubName)
function loadMenuPanel(user, membership, team) {
    if (!user) return;

    const avatarEl = document.getElementById('menu-avatar');
    const nameEl   = document.getElementById('menu-name');
    const roleEl   = document.getElementById('menu-role');

    const name     = user.displayName || '';
    const initials = name.split(' ').map(w => w.charAt(0).toUpperCase()).join('').slice(0, 2);

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = name;

    const roleNames = {
        'TRENER_GLOWNY': 'Trener Główny',
        'TRENER_POMOCNICZY': 'Trener Pomocniczy',
        'RODZIC': 'Rodzic',
        'ZAWODNIK': 'Zawodnik',
        'KIBIC': 'Kibic'
    };
    const effectiveRole = membership
        ? (membership.role === 'TRENER' ? (membership.trainerRole || 'TRENER_GLOWNY') : membership.role)
        : '';
    const clubName = team?.clubName || '';
    const roleName = roleNames[effectiveRole] || effectiveRole;

    if (roleEl) roleEl.textContent = clubName ? `${roleName} · ${clubName}` : roleName;

    // Widoczność pozycji menu wg roli — Raporty/Drużyny klubu tylko dla trenera, Płatności bez zawodnika
    const isTrener = effectiveRole === 'TRENER_GLOWNY' || effectiveRole === 'TRENER_POMOCNICZY';
    const raportyEl = document.getElementById('menu-raporty');
    if (raportyEl) raportyEl.style.display = isTrener ? '' : 'none';
    const klubEl = document.getElementById('menu-klub');
    if (klubEl) klubEl.style.display = isTrener ? '' : 'none';
    const platnosciEl = document.getElementById('menu-platnosci');
    if (platnosciEl) platnosciEl.style.display = effectiveRole === 'ZAWODNIK' ? 'none' : '';
    const jakZaczacEl = document.getElementById('menu-jakzaczac');
    if (jakZaczacEl) jakZaczacEl.style.display = effectiveRole === 'ZAWODNIK' ? 'none' : '';
    const supportEl = document.getElementById('menu-support');
    if (supportEl) supportEl.style.display = user.isPlatformAdmin === true ? '' : 'none';
}


function pickCtx(el, klub, team, initial, color, rola) {
    document.querySelectorAll('.ctx-team-opt').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('ctx-klub').textContent = klub;
    document.getElementById('ctx-team').textContent = team;
    const dot = document.getElementById('ctx-dot');
    dot.textContent = initial;
    dot.style.background = color;
    setTimeout(closeCtxOv, 200);
}

/* ── Powiadomienia overlay ── */
function toggleNotifOv() {
    closeCtxOv();
    const ov = document.getElementById('notif-ov');
    const isOpening = !ov.classList.contains('open');
    ov.classList.toggle('open');
    if (isOpening) loadAndRenderNotifications();
}

function closeNotifOv() {
    const el = document.getElementById('notif-ov');
    if (el) el.classList.remove('open');
}
async function clearNotifs() {
    if (!db) return;
    if (notifData.length === 0) {
        const userId = getCurrentUserId();
        if (userId) notifData = await getUserNotifications(userId);
    }
    let deleted = 0;
    for (const n of notifData) {
        const canDelete = n.isRead || (n.actionDone && n.requiresAction);
        if (canDelete) {
            try { await db.collection('notifications').doc(n.notificationId || n.id).update({ status: 'DELETE' }); deleted++; } catch (e) { }
        }
    }
    console.log(`📦 Zarchiwizowano ${deleted} przeczytanych powiadomień`);
    await afterNotifAction();
}

/* ── Login overlay ── */
function openLogin() {
    document.getElementById('login-ov').classList.add('open');
}
function closeLogin() {
    document.getElementById('login-ov').classList.remove('open');
}
function authTab(btn, mode) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('auth-login').style.display = mode === 'login' ? '' : 'none';
    document.getElementById('auth-register').style.display = mode === 'register' ? '' : 'none';
}

/* ── Menu panel (slide z prawej) ── */
function toggleMenu() {
    const panel = document.getElementById('menu-panel');
    const overlay = document.getElementById('menu-overlay');
    const btn = document.getElementById('menu-btn');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open');
    overlay.classList.toggle('open');
    btn.classList.toggle('open');
    closeCtxOv(); closeNotifOv();
}
function closeMenu() {
    const panel = document.getElementById('menu-panel');
    const overlay = document.getElementById('menu-overlay');
    const btn = document.getElementById('menu-btn');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (btn) btn.classList.remove('open');
}

// Pobierz nazwę użytkownika po UID
async function getUserName(userId) {
    if (!db) return userId;
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.displayName) return data.displayName;
            if (data.firstName || data.lastName) return [data.firstName, data.lastName].filter(Boolean).join(' ');
            if (data.name) return data.name;
            return userId;
        }
        return userId;
    } catch (error) {
        console.error('Error fetching user:', error);
        return userId;
    }
}

// Pobierz członków zespołu (użytkownicy + ich dane)
async function getTeamMembers(teamId) {
    if (!db) return [];
    try {
        const mbrSnap = await db.collection('memberships')
            .where('teamId', '==', teamId)
            .where('status', 'in', ['active', 'ACTIVE'])
            .get();
        if (mbrSnap.empty) return [];

        const memberships = mbrSnap.docs.map(d => ({ membershipId: d.id, ...d.data() }));
        const userIds = [...new Set(memberships.map(m => m.userId).filter(Boolean))];
        const playerIds = [...new Set(memberships.filter(m => m.playerId).map(m => m.playerId))];

        const [userDocs, playerDocs] = await Promise.all([
            Promise.all(userIds.map(uid => db.collection('users').doc(uid).get())),
            Promise.all(playerIds.map(pid => db.collection('players').doc(pid).get()))
        ]);
        const userMap = {};
        userDocs.forEach(doc => { if (doc.exists) userMap[doc.id] = doc.data(); });
        const playerMap = {};
        playerDocs.forEach(doc => { if (doc.exists) playerMap[doc.id] = doc.data(); });

        const members = memberships.filter(m => m.userId).map(m => {
            const u = userMap[m.userId] || {};
            const p = m.playerId ? (playerMap[m.playerId] || {}) : {};
            const role = m.role === 'TRENER' ? (m.trainerRole || 'TRENER_GLOWNY') : m.role;
            // Dla zawodnika: imię z users.displayName, fallback na players.name (wpisane przez trenera)
            const displayName = u.displayName || p.name || m.displayName || m.userId;
            return {
                userId:      m.userId,
                displayName,
                role,
                membershipId: m.membershipId,
                playerId:    m.playerId || null,
                avatarUrl:   u.avatarUrl || null,
                isReadOnly:  u.isReadOnly || m.isReadOnly || false
            };
        });
        console.log(`✅ getTeamMembers: ${members.length} użytkowników`);
        return members;
    } catch (error) {
        console.error('❌ getTeamMembers:', error);
        return [];
    }
}



async function getClubMembers(clubId, teamId) {
    if (!db) return [];
    try {
        let query = db.collection('memberships')
            .where('clubId', '==', clubId)
            .where('status', 'in', ['active', 'ACTIVE']);
        const mbrSnap = await query.get();
        if (mbrSnap.empty) return [];

        const memberships = mbrSnap.docs.map(d => ({ membershipId: d.id, ...d.data() }));
        const userIds = [...new Set(memberships.map(m => m.userId).filter(Boolean))];
        const userDocs = await Promise.all(userIds.map(uid => db.collection('users').doc(uid).get()));
        const userMap = {};
        userDocs.forEach(doc => { if (doc.exists) userMap[doc.id] = doc.data(); });

        const members = memberships.filter(m => m.userId).map(m => {
            const u = userMap[m.userId] || {};
            const role = m.role === 'TRENER' ? (m.trainerRole || 'TRENER_GLOWNY') : m.role;
            return {
                userId:      m.userId,
                displayName: u.displayName || m.userId,
                role,
                membershipId: m.membershipId,
                playerId:    m.playerId || null,
                teamId:      m.teamId || null,
                avatarUrl:   u.avatarUrl || null,
                isReadOnly:  u.isReadOnly || m.isReadOnly || false
            };
        });
        console.log(`✅ getClubMembers: ${members.length} użytkowników`);
        return members;
    } catch (error) {
        console.error('❌ getClubMembers:', error);
        return [];
    }
}


/* ── Zamknij overlaye tapem w tło ── */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('.phone').addEventListener('click', function (e) {
        const ctxOv = document.getElementById('ctx-ov');
        const notifOv = document.getElementById('notif-ov');
        if (ctxOv && ctxOv.classList.contains('open')
            && !ctxOv.contains(e.target)
            && !e.target.closest('.ctx-switcher')) closeCtxOv();
        if (notifOv && notifOv.classList.contains('open')
            && !notifOv.contains(e.target)
            && !e.target.closest('.bell-btn')) closeNotifOv();
        const menuPanel = document.getElementById('menu-panel');
        if (menuPanel && menuPanel.classList.contains('open')
            && !menuPanel.contains(e.target)
            && !e.target.closest('#menu-btn')) closeMenu();
    });

    /* Swipe w dół zamyka login - ulepszone */
    const loginOv = document.getElementById('login-ov');
    if (loginOv) {
        let _ts = 0;
        loginOv.addEventListener('touchstart', e => {
            _ts = e.touches[0].clientY;
        }, { passive: true });

        loginOv.addEventListener('touchend', e => {
            const _te = e.changedTouches[0].clientY;
            // Zamknij tylko jeśli:
            // 1. Swipe był w dół (> 80px)
            // 2. Użytkownik jest na samej górze przewijanego elementu
            if (_te - _ts > 80 && loginOv.scrollTop === 0) {
                closeLogin();
            }
        }, { passive: true });
    }
});

// Zapisuje listę okresów w dokumencie drużyny
async function saveTeamPeriods(teamId, periods) {
    try {
        await db.collection('teams').doc(teamId).update({
            periods: periods
        });
        console.log("✅ Okresy zapisane pomyślnie");
        return true;
    } catch (error) {
        console.error("❌ Błąd zapisu okresów:", error);
        return false;
    }
}

// Pobiera okresy dla danej drużyny
async function getTeamPeriods(teamId) {
    try {
        const doc = await db.collection('teams').doc(teamId).get();
        return doc.data().periods || [];
    } catch (error) {
        console.error("❌ Błąd pobierania okresów:", error);
        return [];
    }
}

// Uniwersalna funkcja do wgrywania dokumentu do dowolnej kolekcji
async function uploadDocument(collectionName, data) {
    try {
        const customId = data.playerId || data.teamId || data.matchId || data.eventId || data.uid || null;
        if (customId) {
            await db.collection(collectionName).doc(customId).set(data);
        } else {
            await db.collection(collectionName).add(data);
        }
        return true;
    } catch (error) {
        console.error("Błąd wgrywania:", error);
        throw error;
    }
}

// --- FUNKCJE NAWIGACJI I PANELI ---

function openTopMenu() {
    // Przekierowanie do strony ustawień, gdzie jest menu
    window.location.href = 'ustawienia.html';
}

function openPanel(panelId) {
    const panel = document.getElementById('panel-' + panelId);
    if (panel) {
        panel.classList.add('active');
    } else {
        console.warn("Panel nie istnieje na tej stronie: panel-" + panelId);
    }
}

function closePanel(panelId) {
    const panel = document.getElementById('panel-' + panelId);
    if (panel) {
        panel.classList.remove('active');
    }
}

/* ── Counter helper ── */
function mzChange(btn, delta, min, max) {
    const container = btn.closest('.mz-counter, .mw-counter, .score-counter');
    const valEl = container.querySelector('.mzc-val, .mw-val');
    let val = parseInt(valEl.textContent) + delta;
    if (min !== undefined) val = Math.max(min, val);
    if (max !== undefined) val = Math.min(max, val);
    valEl.textContent = val;
}

/* ═══════════════════════════════════════════════════
   BRAK INTERNETU — overlay informacyjny
═══════════════════════════════════════════════════ */

(function () {
    const OVERLAY_ID = 'offline-overlay';

    function pokazBrakInternetu() {
        if (document.getElementById(OVERLAY_ID)) return;
        const div = document.createElement('div');
        div.id = OVERLAY_ID;
        div.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'background:var(--tlo,#0f172a)',
            'color:var(--font,#f1f5f9)',
            'font-family:var(--font-family,system-ui,sans-serif)',
            'padding:32px', 'text-align:center', 'gap:12px'
        ].join(';');
        div.innerHTML = `
            <div style="font-size:48px;line-height:1;">📡</div>
            <div style="font-size:18px;font-weight:800;margin-top:8px;">Brak połączenia z internetem</div>
            <div style="font-size:13px;color:var(--szary,#94a3b8);max-width:260px;line-height:1.5;">
                Sprawdź Wi-Fi lub dane mobilne.<br>Aplikacja wróci automatycznie gdy połączenie zostanie przywrócone.
            </div>
            <div id="offline-spinner" style="margin-top:16px;font-size:12px;color:var(--szary,#94a3b8);">Czekam na połączenie…</div>
        `;
        document.body.appendChild(div);
    }

    function ukrijBrakInternetu() {
        const el = document.getElementById(OVERLAY_ID);
        if (el) {
            // Krótkie opóźnienie — dajemy czas Firebase na reconnect
            setTimeout(() => { window.location.reload(); }, 800);
        }
    }

    // Sprawdź przy starcie
    if (!navigator.onLine) {
        if (document.body) {
            pokazBrakInternetu();
        } else {
            document.addEventListener('DOMContentLoaded', pokazBrakInternetu);
        }
    }

    window.addEventListener('offline', pokazBrakInternetu);
    window.addEventListener('online',  ukrijBrakInternetu);
})();

/* ── Auto-load: licznik powiadomień na dzwonku ── */
document.addEventListener('DOMContentLoaded', function () {
    // Czekaj aż initFirebase zostanie wywołane przez ekran
    let attempts = 0;
    const checkInterval = setInterval(async () => {
        attempts++;
        if (attempts > 20) { clearInterval(checkInterval); return; } // max 10s
        if (typeof db !== 'undefined' && db && auth && auth.currentUser && getCurrentUserId()) {
            clearInterval(checkInterval);
            await loadAndRenderNotifications();
        }
    }, 500);
});

/* ═══════════════════════════════════════════════════════════════
   PIN LOCK — _checkPinLock / sha256
   ═══════════════════════════════════════════════════════════════ */

const _PIN_EXEMPT   = ['pin.html', 'login.html', 'blocked.html', 'platnosci-banner.html'];
const _PIN_TIMEOUT  = 5 * 60 * 1000; // 5 min

async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sprawdza blokadę PINem. Wywoływana wewnątrz initSession().
 * @param {object} user - dokument users/{uid}
 * @returns {boolean} true = kontynuuj, false = redirect do pin.html
 */
async function _checkPinLock(user) {
    const page = window.location.pathname.split('/').pop() || '';
    if (_PIN_EXEMPT.some(p => page.includes(p))) return true;
    if (isDemoMode()) return true;
    if (localStorage.getItem('supportOriginalUserId')) return true;

    const pinHash = user?.pinHash || null;

    if (!pinHash) {
        // Brak PINu — wymuś ustawienie
        localStorage.setItem('pinReturnUrl', 'start.html');
        window.location.replace('pin.html?mode=setup');
        return false;
    }

    const lastActive = parseInt(localStorage.getItem('appLastActive') || '0');
    if (lastActive === 0) {
        // Świeże logowanie — ustaw znacznik, nie blokuj
        localStorage.setItem('appLastActive', Date.now().toString());
        return true;
    }

    if (Date.now() - lastActive > _PIN_TIMEOUT) {
        // Timeout nieaktywności — ekran blokady
        localStorage.setItem('pinReturnUrl', window.location.href);
        window.location.replace('pin.html?mode=unlock');
        return false;
    }

    localStorage.setItem('appLastActive', Date.now().toString());
    return true;
}

/* ═══════════════════════════════════════════════════════════════
   SYSTEM PŁATNOŚCI — getAccessStatus / helpery
   platnosci.md sekcja 3 — pełna kolejność priorytetów
   ═══════════════════════════════════════════════════════════════ */

const GRACE_DAYS = 7;
const TRIAL_SHOW_DAYS = [30, 23, 19, 15, 12, 9, 6, 5, 4, 3, 2, 1];

/** Zwraca pierwsze aktywne membership usera dla danego klubu lub null. */
async function _getMembershipForClub(uid, clubId) {
    const [s1, s2] = await Promise.all([
        db.collection('memberships').where('userId','==',uid).where('clubId','==',clubId).where('status','==','ACTIVE').limit(1).get(),
        db.collection('memberships').where('userId','==',uid).where('clubId','==',clubId).where('status','==','active').limit(1).get()
    ]);
    const docs = [...s1.docs, ...s2.docs];
    return docs.length > 0 ? docs[0] : null;
}

/**
 * Czy rola jest objęta scope licencji B2B klubu.
 * @param {string} role
 * @param {object|null} lic - clubs.license
 */
function _isRoleInB2BScope(role, lic) {
    if (!lic || !lic.valid_until) return false;
    const scope = lic.scope || 'all';
    if (scope === 'all') return true;
    if (scope === 'trainers_only') return ['TRENER_GLOWNY','TRENER_POMOCNICZY','TRENER','OWNER'].includes(role);
    if (scope === 'custom') return (lic.roles || []).includes(role);
    return false;
}

/**
 * Zwraca dane licencji FAMILY dla danego usera (enkapsuluje nazwy pól uid/club_id).
 * @returns {{ slotsTotal, slotsUsed, validUntil, arRef }} | null
 */
async function getFamilySlots(uid, clubId) {
    try {
        const snap = await db.collection('access_rights')
            .where('uid', '==', uid)
            .where('club_id', '==', clubId)
            .limit(1).get();
        if (snap.empty) return null;
        const d = snap.docs[0].data();
        if (!d.slots_total || d.slots_total < 2) return null;
        const validUntil = d.valid_until?.toDate?.() ?? (d.valid_until ? new Date(d.valid_until) : null);
        return { slotsTotal: d.slots_total, slotsUsed: d.slots_used || 0, validUntil, arRef: snap.docs[0].ref };
    } catch (e) {
        console.error('getFamilySlots:', e);
        return null;
    }
}

/**
 * Zwalnia 1 slot z puli FAMILY rodzica (transakcja).
 * Używane w: profil.html (blockKibic).
 */
async function releaseFamilySlot(parentUid, clubId) {
    try {
        const snap = await db.collection('access_rights')
            .where('uid', '==', parentUid)
            .where('club_id', '==', clubId)
            .limit(1).get();
        if (snap.empty) return;
        const arRef = snap.docs[0].ref;
        await db.runTransaction(async tx => {
            const doc = await tx.get(arRef);
            const cur = doc.data().slots_used || 0;
            tx.update(arRef, { slots_used: Math.max(0, cur - 1) });
        });
    } catch (e) {
        console.error('releaseFamilySlot:', e);
    }
}

/**
 * Pobiera slot z puli klubowej B2B dla danego usera (transakcja).
 * @returns {{ success: bool, status?, source?, daysLeft?, expiryDate? }}
 */
async function claimClubLicenseSlot(uid, clubId, membershipDoc) {
    try {
        const clubRef = db.collection('clubs').doc(clubId);
        let claimedExpiry = null;

        await db.runTransaction(async t => {
            const clubSnap = await t.get(clubRef);
            if (!clubSnap.exists) throw new Error('NO_CLUB');
            const lic = clubSnap.data().license;
            if (!lic || !lic.valid_until) throw new Error('NO_LICENSE');

            const expiry = lic.valid_until?.toDate?.() ?? new Date(lic.valid_until);
            if (expiry <= new Date()) throw new Error('LICENSE_EXPIRED');

            const used  = lic.used  || 0;
            const total = lic.total || 0;
            if (used >= total) throw new Error('POOL_FULL');

            claimedExpiry = expiry;
            t.update(clubRef, { 'license.used': used + 1 });
            t.update(membershipDoc.ref, {
                licenseStatus: 'ACTIVE',
                licenseSource: 'CLUB',
                poolClaimedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        const daysLeft = Math.ceil((claimedExpiry - new Date()) / 86400000);
        return { success: true, status: 'ACTIVE', source: 'club_license', daysLeft, expiryDate: claimedExpiry };
    } catch (e) {
        if (e.message === 'POOL_FULL')       return { success: false, source: 'club_pool_full' };
        if (e.message === 'LICENSE_EXPIRED') return { success: false, source: 'club_license_expired' };
        console.error('claimClubLicenseSlot:', e);
        return { success: false, source: 'error' };
    }
}

/**
 * Zwalnia slot z puli klubowej B2B (przy blokowaniu / usuwaniu usera).
 * Używane w: trenerzy.html, support.html.
 */
async function releaseClubLicenseSlot(uid, clubId) {
    try {
        const mDoc = await _getMembershipForClub(uid, clubId);
        if (!mDoc) return;
        const mData = mDoc.data();
        if (mData.licenseSource !== 'CLUB' || mData.licenseStatus !== 'ACTIVE') return;

        const clubRef = db.collection('clubs').doc(clubId);
        await db.runTransaction(async t => {
            const clubSnap = await t.get(clubRef);
            const used = clubSnap.data()?.license?.used || 0;
            if (used > 0) t.update(clubRef, { 'license.used': used - 1 });
            t.update(mDoc.ref, { licenseStatus: null, poolClaimedAt: null });
        });
    } catch (e) {
        console.error('releaseClubLicenseSlot:', e);
    }
}

/**
 * Sprawdza status dostępu do klubu dla danego usera.
 * Kolejność priorytetów wg platnosci.md sekcja 3:
 *   P1 własna licencja → P0 trial → P3 B2B klub → P4 FAMILY rodzica → EXPIRED
 * @param {string} uid
 * @param {string} clubId
 * @param {{ claimSlot?: boolean }} opts  claimSlot=true: pobierz slot B2B gdy potrzebny
 */
async function getAccessStatus(uid, clubId, { claimSlot = false } = {}) {
    const now         = new Date();
    const graceMs     = GRACE_DAYS * 86400 * 1000;
    const graceCutoff = new Date(now.getTime() - graceMs);

    const _r = (status, source, expiry, overrideDays) => {
        let daysLeft = 0;
        if (overrideDays !== undefined) {
            daysLeft = overrideDays;
        } else if (expiry) {
            daysLeft = Math.ceil((expiry - now) / 86400000);
        }
        return { status, source, daysLeft: Math.max(0, daysLeft), expiryDate: expiry || null };
    };

    try {
        // ── Pobierz klub raz ──────────────────────────────────────
        const clubDoc = await db.collection('clubs').doc(clubId).get();
        if (!clubDoc.exists) return _r('EXPIRED', 'no_club', null);
        const cd  = clubDoc.data();
        const lic = cd.license || null;

        // Dane trialu
        const createdAt = cd.createdAt?.toDate?.() ?? (cd.createdAt ? new Date(cd.createdAt) : null);
        const trialEnd  = createdAt ? new Date(createdAt.getTime() + 90 * 86400 * 1000) : null;
        const inTrial      = !!(trialEnd && trialEnd > now);
        const inTrialGrace = !!(trialEnd && !inTrial && trialEnd > graceCutoff);

        // ── Membership i rola ─────────────────────────────────────
        // Rozwiń efektywną rolę: memberships.role dla trenerów to generyczne 'TRENER',
        // konkretny podtyp (TRENER_GLOWNY/TRENER_POMOCNICZY) siedzi w trainerRole —
        // bez tego "Niestandardowy" scope licencji B2B nie mógłby odróżnić trenera
        // głównego od pomocniczego (naprawione 2026-07-30).
        const mDoc    = await _getMembershipForClub(uid, clubId);
        const mData   = mDoc?.data() || {};
        const rawRole = mData.role || '';
        const role    = rawRole === 'TRENER' ? (mData.trainerRole || 'TRENER_GLOWNY') : rawRole;

        // ZAWODNIK — zawsze aktywny, nie uczestniczy w systemie płatności
        if (role === 'ZAWODNIK') return _r('ACTIVE', 'player', null, 999);

        // ── P1: Własna licencja (access_rights) ───────────────────
        // UWAGA 2026-07-28: usunięto force_club_pool/skipOwnLicense. Ta flaga pozwalała
        // pominąć WAŻNĄ własną licencję rodzica i wepchnąć go na pulę klubową mimo że
        // jego P1 jeszcze trwało — uznane za niedopuszczalne (marnuje slot z puli +
        // ignoruje opłacony okres). Naturalna kolejność P1 → grace (7 dni) → P3 już
        // sama poprawnie przenosi rodzica na pulę klubową dopiero gdy jego własna
        // licencja faktycznie wygaśnie — force_club_pool był zbędny obok tego.
        // Kod zachowany zakomentowany, gdyby kiedyś potrzebne było inne uzasadnienie:
        // const forceClubActive = !!(lic?.force_club_pool && licExpiry && licExpiry > now && _isRoleInB2BScope(role, lic));
        // const skipOwnLicense  = role === 'RODZIC' && forceClubActive;
        const licExpiry      = lic?.valid_until?.toDate?.() ?? null;
        const skipOwnLicense = false;

        if (!skipOwnLicense) {
            const arSnap = await db.collection('access_rights')
                .where('uid', '==', uid)
                .where('club_id', '==', clubId)
                .limit(1).get();
            if (!arSnap.empty) {
                const ar         = arSnap.docs[0].data();
                const validUntil = ar.valid_until?.toDate?.() ?? new Date(ar.valid_until);
                if (validUntil > now)
                    return _r('ACTIVE', ar.source || 'individual', validUntil);
                if (validUntil > graceCutoff)
                    return _r('GRACE', ar.source || 'individual', validUntil,
                        Math.ceil((validUntil.getTime() + graceMs - now) / 86400000));
            }
        }

        // ── P0: Trial (po P1 — własna licencja daje ACTIVE nawet w trialu) ──
        if (inTrial)      return _r('TRIAL', 'trial', trialEnd);
        if (inTrialGrace) return _r('GRACE', 'trial', trialEnd,
            Math.ceil((trialEnd.getTime() + graceMs - now) / 86400000));

        // ── P3: Slot B2B klubowy (TRENER, OWNER, RODZIC gdy w scope) ──
        const TRENER_ROLES = ['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'TRENER', 'OWNER'];
        const canUseB2B    = mDoc && _isRoleInB2BScope(role, lic) &&
                             (TRENER_ROLES.includes(role) || role === 'RODZIC');

        if (canUseB2B) {
            const renewedAt  = lic?.renewed_at?.toDate?.() ?? null;
            const claimedAt  = mData.poolClaimedAt?.toDate?.() ?? null;
            // Slot jest aktualny jeśli: claimedAt >= renewedAt (lub renewedAt null = stara licencja)
            const slotFresh  = !renewedAt || (claimedAt && claimedAt >= renewedAt);
            const slotActive = mData.licenseSource === 'CLUB' && mData.licenseStatus === 'ACTIVE' && slotFresh;

            if (slotActive && licExpiry) {
                if (licExpiry > now)         return _r('ACTIVE', 'club_license', licExpiry);
                if (licExpiry > graceCutoff) return _r('GRACE', 'club_license', licExpiry,
                    Math.ceil((licExpiry.getTime() + graceMs - now) / 86400000));
                return _r('EXPIRED', 'club_license_expired', null);
            }

            // Slot nieaktualny lub nie pobrany — spróbuj pobrać
            if (claimSlot && licExpiry && licExpiry > now) {
                const claimed = await claimClubLicenseSlot(uid, clubId, mDoc);
                if (claimed.success)
                    return _r('ACTIVE', claimed.source, claimed.expiryDate, claimed.daysLeft);
                return _r('EXPIRED', claimed.source, null);
            }
        }

        // ── P4: Family — tylko KIBIC ──────────────────────────────
        // Szukamy przez playerId → memberships RODZIC → access_rights rodzica
        // Slot jest claimowany lazy przy pierwszym logowaniu (claimSlot=true)
        if (role === 'KIBIC' && mData.playerId) {
            const parentSnap = await db.collection('memberships')
                .where('playerId', '==', mData.playerId)
                .where('role', '==', 'RODZIC')
                .get();
            for (const parentDoc of parentSnap.docs) {
                const parentUid = parentDoc.data().userId;
                if (!parentUid) continue;
                const fs = await getFamilySlots(parentUid, clubId);
                if (!fs || !fs.validUntil || fs.slotsTotal <= 1) continue;

                const alreadyClaimed = mData.familySlotParent === parentUid;

                if (!alreadyClaimed) {
                    if (!claimSlot) continue;
                    if (fs.slotsUsed >= fs.slotsTotal) continue; // brak wolnych slotów
                    try {
                        await db.runTransaction(async tx => {
                            const arDoc = await tx.get(fs.arRef);
                            const cur = arDoc.data().slots_used || 0;
                            if (cur >= fs.slotsTotal) throw new Error('FULL');
                            tx.update(fs.arRef, { slots_used: cur + 1 });
                        });
                        if (mDoc) await mDoc.ref.update({
                            familySlotParent: parentUid,
                            familySlotClaimedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } catch (e) {
                        if (e.message === 'FULL') continue;
                        console.warn('Błąd family slot claim:', e);
                        continue;
                    }
                }

                if (fs.validUntil > now)
                    return _r('ACTIVE', 'family_license', fs.validUntil);
                if (fs.validUntil > graceCutoff)
                    return _r('GRACE', 'family_license', fs.validUntil,
                        Math.ceil((fs.validUntil.getTime() + graceMs - now) / 86400000));
            }
        }

        // ── Fallback: clubs.licenseStatus z CF (stare konta / role bez slotu) ──
        if (cd.licenseStatus) {
            let expiryDate = null, daysLeft = 0;
            const raw = lic?.valid_until ?? lic?.expiresAt;
            if (raw) {
                expiryDate = raw?.toDate?.() ?? new Date(raw);
                daysLeft   = Math.ceil((expiryDate - now) / 86400000);
            } else if (trialEnd) {
                expiryDate = trialEnd;
                daysLeft   = Math.ceil((trialEnd - now) / 86400000);
            }
            return { status: cd.licenseStatus, source: cd.licenseStatusSource || null,
                     daysLeft: Math.max(0, daysLeft), expiryDate };
        }

    } catch (e) {
        console.error('getAccessStatus error:', e);
        return { status: 'TRIAL', source: 'fallback', daysLeft: 0, expiryDate: null };
    }

    return _r('EXPIRED', null, null);
}

/**
 * Czy pokazać interstitial TRIAL dziś?
 * Pokazuje tylko w konkretnych dniach, raz dziennie.
 */
function shouldShowTrialBanner(daysLeft) {
    if (!TRIAL_SHOW_DAYS.includes(daysLeft)) return false;
    const lastShown = localStorage.getItem('trialBannerShownDay');
    if (lastShown === String(daysLeft)) return false;
    localStorage.setItem('trialBannerShownDay', String(daysLeft));
    return true;
}

/**
 * Główna funkcja wywołana po initSession() na każdym ekranie.
 * Przekierowuje do blocked.html?reason=payment_expired jeśli EXPIRED.
 * Zwraca accessStatus do użycia w ekranie (banner TRIAL/GRACE).
 * Pomija blokadę gdy support admin impersonuje usera (supportOriginalUserId w localStorage).
 */
async function checkPaymentAccess(uid, clubId) {
    if (localStorage.getItem('supportOriginalUserId')) {
        return { status: 'ACTIVE', source: 'support_impersonation', daysLeft: 9999 };
    }
    // claimSlot: true — automatycznie pobierz slot B2B gdy trial wygasł
    const access = await getAccessStatus(uid, clubId, { claimSlot: true });
    if (access.status === 'EXPIRED') {
        const reason = access.source === 'club_pool_full' ? 'club_pool_full' : 'payment_expired';
        window.location.href = `blocked.html?reason=${reason}&clubId=${clubId}`;
        return null;
    }
    return access;
}