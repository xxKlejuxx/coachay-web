/* ═══════════════════════════════════════════════════
   COACHAY — Firebase Cloud Functions
   Obsługa powiadomień server-side
   ═══════════════════════════════════════════════════ */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const https = require('https');

const WHATSAPP_TOKEN_SECRET    = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID_SECRET = defineSecret('WHATSAPP_PHONE_ID');
const REVENUECAT_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

initializeApp();
const db = getFirestore();

/* ─── helpers ──────────────────────────────────────── */

const TYPE_NAMES = { TRENING: 'Trening', MECZ: 'Mecz', WYJAZD: 'Wyjazd', INNE: 'Wydarzenie' };

const I18N = {
    pl: {
        types: { TRENING: 'Trening', MECZ: 'Mecz', WYJAZD: 'Wyjazd', INNE: 'Wydarzenie' },
        newTitle:       (type) => ({ TRENING: 'Nowy trening', MECZ: 'Nowy mecz', WYJAZD: 'Nowy wyjazd', INNE: 'Nowe wydarzenie' }[type] || 'Nowe wydarzenie'),
        cancelledTitle: (type) => ({ TRENING: 'Odwołany trening', MECZ: 'Odwołany mecz', WYJAZD: 'Odwołany wyjazd', INNE: 'Odwołane wydarzenie' }[type] || 'Odwołane wydarzenie'),
        updatedTitle:   (type) => ({ TRENING: 'Zmiana: trening', MECZ: 'Zmiana: mecz', WYJAZD: 'Zmiana: wyjazd', INNE: 'Zmiana: wydarzenie' }[type] || 'Zmiana: wydarzenie'),
        confirmAction:  'potwierdź obecność',
        dateChange: (d) => `📅 Data: ${d}`,
        timeChange: (t) => `🕐 Godzina: ${t}`,
        placeChange: (p) => `📍 Miejsce: ${p}`,
        locale: 'pl-PL',
    },
    en: {
        types: { TRENING: 'Training', MECZ: 'Match', WYJAZD: 'Away game', INNE: 'Event' },
        newTitle:       (type) => ({ TRENING: 'New training', MECZ: 'New match', WYJAZD: 'New trip', INNE: 'New event' }[type] || 'New event'),
        cancelledTitle: (type) => ({ TRENING: 'Cancelled training', MECZ: 'Cancelled match', WYJAZD: 'Cancelled trip', INNE: 'Cancelled event' }[type] || 'Cancelled event'),
        updatedTitle:   (type) => ({ TRENING: 'Change: training', MECZ: 'Change: match', WYJAZD: 'Change: trip', INNE: 'Change: event' }[type] || 'Change: event'),
        confirmAction:  'confirm attendance',
        dateChange: (d) => `📅 Date: ${d}`,
        timeChange: (t) => `🕐 Time: ${t}`,
        placeChange: (p) => `📍 Location: ${p}`,
        locale: 'en-GB',
    },
};

async function getLang(userId) {
    if (!userId) return 'pl';
    try {
        const doc = await db.collection('users').doc(userId).get();
        return (doc.exists && (doc.data().language || doc.data().lang)) || 'pl';
    } catch (e) { return 'pl'; }
}

function formatDatePL(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day  = d.toLocaleDateString('pl-PL', { weekday: 'short' });
    const date = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return { day, date };
}

function formatDate(dateStr, locale) {
    const d = new Date(dateStr + 'T00:00:00');
    const day  = d.toLocaleDateString(locale, { weekday: 'short' });
    const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return { day, date };
}

// Nowy format: tytuł = krótka kategoria ("Nowy trening"), treść = szczegóły
function buildNotifBody(event, { childName = null, childNames = null, requiresAction = false, confirmLabel = 'potwierdź obecność', changes = null } = {}) {
    const { day, date } = formatDatePL(event.date);
    const parts = [];
    if (event.title) parts.push(event.title);
    if (changes) { parts.push(...changes); }
    if (requiresAction) parts.push(confirmLabel);
    const kids = childNames?.length ? childNames.join(', ') : (childName || null);
    if (kids) parts.push(kids);
    const timeStr = event.timeFrom ? `${event.timeFrom}${event.timeTo ? '–' + event.timeTo : ''}` : '';
    parts.push(`${day} ${date}${timeStr ? ', ' + timeStr : ''}`);
    if (event.location?.venueName) parts.push(event.location.venueName);
    return parts.join(' · ');
}

// Zachowane dla wstecznej kompatybilności (używane w resolveInvitedUserIds path)
function buildBodyText(event) { return buildNotifBody(event); }

async function createNotification(data) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const notifId = 'notif_' + dateStr + '_' + Date.now().toString().slice(-7) + '_' + Math.random().toString(36).slice(2, 6);
    const notif = {
        notificationId: notifId,
        userId:         data.userId,
        teamId:         data.teamId || null,
        type:           data.type || 'INFO',
        title:          data.title || '',
        body:           data.body || '',
        referenceId:    data.referenceId || null,
        referenceType:  data.referenceType || null,
        forPlayerId:    data.forPlayerId || null,
        requiresAction: data.requiresAction || false,
        actionType:     data.actionType || null,
        actionDone:     false,
        actionResult:   null,
        actionComment:  null,
        createdAt:      now.toISOString(),
        readAt:         null,
        isRead:         false,
        priority:       data.priority || 'NORMAL',
        isDemo:         false,
        demoSetId:      null,
        source:         'cloud_function'
    };
    await db.collection('notifications').doc(notifId).set(notif);
    return notif;
}

/**
 * Atomicznie inkrementuje liczniki w platform_metrics/{year_YYYY_month_MM}.
 * updates: { deleted_notifications: 5, deleted_events: 2 } itp.
 */
async function incrementPlatformMetric(year, month, updates) {
    const docId = `year_${year}_month_${String(month).padStart(2, '0')}`;
    const delta = { year, month, updatedAt: FieldValue.serverTimestamp() };
    for (const [key, val] of Object.entries(updates)) {
        delta[key] = FieldValue.increment(val);
    }
    await db.collection('platform_metrics').doc(docId).set(delta, { merge: true });
}

/**
 * Rozwiązuje invited do listy { userId, forPlayerId, playerName }.
 * Obsługuje __TEAM__, jawne player_xxx, user_xxx oraz RODZICÓW (per dziecko).
 * Rodzic z 2 dziećmi dostaje 2 osobne wpisy, każdy z playerName dziecka.
 * Pomija skipUserId (createdBy / updatedBy).
 */
async function resolveInvitedUserIds(evData, skipUserId) {
    const rawInvited = evData.attendance?.invited || [];
    if (rawInvited.length === 0) return [];

    const isTeam = rawInvited.includes('__TEAM__');

    // Pobierz memberships drużyny (jeden query)
    const mbrSnap = await db.collection('memberships')
        .where('teamId', '==', evData.teamId).where('status', 'in', ['active', 'ACTIVE']).get();
    const members = mbrSnap.docs.map(d => d.data());

    // Ustal które playerId są zaproszone
    let invitedPlayerIds;
    if (isTeam) {
        invitedPlayerIds = [...new Set(members.filter(m => m.playerId).map(m => m.playerId))];
    } else {
        invitedPlayerIds = rawInvited.filter(id => id.includes('player_'));
    }

    const results = [];
    const seenCoach = new Set(); // deduplikacja trenerów/userów

    // Trenerzy (zaproszeni przez __TEAM__ lub jawnie jako user_xxx)
    members.forEach(m => {
        if (!m.userId || m.userId === skipUserId) return;
        const isCoach = m.role === 'TRENER_GLOWNY' || m.role === 'TRENER_POMOCNICZY';
        if (isCoach && !seenCoach.has(m.userId)) {
            seenCoach.add(m.userId);
            results.push({ userId: m.userId, forPlayerId: null, playerName: null });
        }
    });

    // Jawnie zaproszeni user_xxx (nie z drużyny)
    if (!isTeam) {
        rawInvited.filter(id => id.startsWith('user_')).forEach(uid => {
            if (uid !== skipUserId && !seenCoach.has(uid)) {
                seenCoach.add(uid);
                results.push({ userId: uid, forPlayerId: null, playerName: null });
            }
        });
    }

    // Zawodnicy i rodzice — per playerId
    const parentChildPairs = []; // { userId, forPlayerId }
    const playerUserMap = {};    // playerId → userId zawodnika

    members.forEach(m => {
        if (!m.userId || !m.playerId || m.userId === skipUserId) return;
        if (!invitedPlayerIds.includes(m.playerId)) return;
        if (m.role === 'ZAWODNIK') {
            playerUserMap[m.playerId] = m.userId;
        } else if (m.role === 'RODZIC' || m.role === 'KIBIC') {
            // FIX (2026-09-03, mobile) — KIBIC tu brakował, więc przy odwołaniu/zmianie eventu
            // kibice nie dostawali powiadomienia, mimo że sendNotificationsForEvent (nowy event,
            // nowo zaproszeni) już ich poprawnie uwzględnia.
            parentChildPairs.push({ userId: m.userId, forPlayerId: m.playerId });
        }
    });

    // Dodaj zawodników
    Object.entries(playerUserMap).forEach(([playerId, userId]) => {
        results.push({ userId, forPlayerId: playerId, playerName: null });
    });

    // Rozwiąż nazwy dzieci dla rodziców (batch po 10)
    if (parentChildPairs.length > 0) {
        const playerIds = [...new Set(parentChildPairs.map(p => p.forPlayerId))];
        const playerNames = {};
        for (let i = 0; i < playerIds.length; i += 10) {
            const chunk = playerIds.slice(i, i + 10);
            const snap = await db.collection('players').where('__name__', 'in', chunk).get();
            snap.forEach(d => { playerNames[d.id] = d.data().name || d.id; });
        }
        parentChildPairs.forEach(p => {
            results.push({ userId: p.userId, forPlayerId: p.forPlayerId, playerName: playerNames[p.forPlayerId] || null });
        });
    }

    return results;
}

/** Sprawdza czy powiadomienie dla tego eventu + usera już istnieje (anty-duplikat) */
async function notifExists(userId, referenceId, forPlayerId = null) {
    const q = db.collection('notifications')
        .where('userId', '==', userId)
        .where('referenceId', '==', referenceId)
        .where('actionDone', '==', false);
    if (forPlayerId) {
        // Sprawdź po forPlayerId
        const snap = await q.where('forPlayerId', '==', forPlayerId).get();
        return !snap.empty;
    }
    const snap = await q.get();
    return !snap.empty;
}

/**
 * Główna funkcja wysyłająca powiadomienia dla eventu.
 * Działa zarówno przy tworzeniu jak i przy dołączeniu nowego membera.
 * skipUserIds — lista userIds którzy już dostali powiadomienie (anty-duplikat).
 */
async function sendNotificationsForEvent(event, skipUserIds = [], filterPlayerIds = null) {
    const rawInvited = event.attendance?.invited || [];
    if (rawInvited.length === 0) return 0;

    // Twórca eventu nigdy nie dostaje powiadomienia — niezależnie od roli
    if (event.createdBy && !skipUserIds.includes(event.createdBy)) {
        skipUserIds = [...skipUserIds, event.createdBy];
    }

    const eventId      = event.eventId || event.id;
    const requiresAction = event.requireConfirmation || false;
    const typeName     = TYPE_NAMES[event.type] || 'Wydarzenie';
    const bodyText     = buildBodyText(event);
    const { day, date } = formatDatePL(event.date);

    // Pobierz memberships drużyny
    const mbrSnap = await db.collection('memberships')
        .where('teamId', '==', event.teamId)
        .where('status', 'in', ['active', 'ACTIVE', 'grace', 'demo'])
        .get();
    const members = mbrSnap.docs.map(d => d.data());

    // Rozwiń __TEAM__ → wszyscy zawodnicy z memberships
    // Uwzględniamy zarówno ZAWODNIK jak i graczy znanych tylko przez RODZIC (brak konta ZAWODNIK)
    let invited = rawInvited.filter(id => id !== '__TEAM__');
    if (rawInvited.includes('__TEAM__')) {
        members.forEach(m => {
            if (!m.playerId) return;
            const isPlayer = m.role === 'ZAWODNIK' || m.role === 'RODZIC';
            if (isPlayer && !invited.includes(m.playerId)) {
                invited.push(m.playerId);
            }
        });
    }

    // Zbuduj mapy: playerId → userId zawodnika, parentUserId → [playerId]
    const playerIds = invited.filter(id => id.includes('player_'));
    const playerUserMap  = {};  // playerId → userId zawodnika
    const parentChildMap = {};  // parentUserId → [playerId]
    // Rola per parentId (2026-09-03, decyzja Rafała) — KIBIC nie potwierdza obecności (to robi
    // rodzic), więc przy evencie z wymaganą akcją KIBIC nie dostaje ŻADNEGO powiadomienia o nim —
    // tylko RODZIC, osobno per dziecko (każde ma własny przycisk Będę/Nie będę, patrz pętla niżej).
    const parentRoleMap = {};

    members.forEach(m => {
        if (!m.userId || !m.playerId) return;
        if (m.role === 'ZAWODNIK' && playerIds.includes(m.playerId)) {
            playerUserMap[m.playerId] = m.userId;
        }
        if ((m.role === 'RODZIC' || m.role === 'KIBIC') && playerIds.includes(m.playerId)) {
            if (!parentChildMap[m.userId]) parentChildMap[m.userId] = [];
            if (!parentChildMap[m.userId].includes(m.playerId)) parentChildMap[m.userId].push(m.playerId);
            parentRoleMap[m.userId] = m.role;
        }
    });

    // Jeśli podano filterPlayerIds — ogranicz do nowo zaproszonych graczy
    if (filterPlayerIds) {
        invited = invited.filter(id => filterPlayerIds.includes(id));
        for (const parentId of Object.keys(parentChildMap)) {
            parentChildMap[parentId] = parentChildMap[parentId].filter(cid => filterPlayerIds.includes(cid));
            if (parentChildMap[parentId].length === 0) delete parentChildMap[parentId];
        }
    }

    // Pobierz aktywne absencje (do pominięcia)
    let activeAbsences = [];
    try {
        const absSnap = await db.collection('absences')
            .where('isActive', '==', true)
            .get();
        activeAbsences = absSnap.docs.map(d => d.data());
    } catch (e) {}

    let created = 0;
    const absentPlayerIds = new Set(
        activeAbsences
            .filter(a => a.dateFrom <= event.date && a.dateTo >= event.date && a.isActive)
            .map(a => a.playerId)
    );

    for (const personId of invited) {
        if (absentPlayerIds.has(personId)) continue;

        const isPlayer = personId.includes('player_');

        if (isPlayer) {
            // Powiadomienie dla zawodnika
            const playerUserId = playerUserMap[personId];
            if (playerUserId && !skipUserIds.includes(playerUserId)) {
                const exists = await notifExists(playerUserId, eventId, personId);
                if (!exists) {
                    await createNotification({
                        userId: playerUserId,
                        teamId: event.teamId,
                        type: requiresAction ? 'EVENT_ATTENDANCE' : 'EVENT_CREATED',
                        title: I18N.pl.newTitle(event.type),
                        body: buildNotifBody(event, { requiresAction, confirmLabel: I18N.pl.confirmAction }),
                        referenceId: eventId,
                        referenceType: 'event',
                        forPlayerId: personId,
                        requiresAction,
                        actionType: requiresAction ? 'ATTENDANCE' : null,
                        priority: 'NORMAL'
                    });
                    created++;
                }
            }
            // Rodzic (nie kibic — kibic nie potwierdza obecności) — osobne powiadomienie per
            // dziecko TYLKO gdy wymagana jest akcja (każde dziecko ma własny przycisk potwierdzenia).
            // Gdy akcja nie jest wymagana, rodzic/kibic dostaje jedno zbiorcze niżej.
            if (requiresAction) {
                for (const [parentId, childIds] of Object.entries(parentChildMap)) {
                    if (!childIds.includes(personId)) continue;
                    if (parentRoleMap[parentId] !== 'RODZIC') continue;
                    if (skipUserIds.includes(parentId)) continue;
                    const exists = await notifExists(parentId, eventId, personId);
                    if (exists) continue;
                    let childName = personId;
                    try {
                        const pd = await db.collection('players').doc(personId).get();
                        if (pd.exists) childName = pd.data().name || personId;
                    } catch (e) {}
                    await createNotification({
                        userId: parentId,
                        teamId: event.teamId,
                        type: 'EVENT_ATTENDANCE',
                        title: I18N.pl.newTitle(event.type),
                        body: buildNotifBody(event, { childName, requiresAction: true, confirmLabel: I18N.pl.confirmAction }),
                        referenceId: eventId,
                        referenceType: 'event',
                        forPlayerId: personId,
                        requiresAction: true,
                        actionType: 'ATTENDANCE',
                        priority: 'NORMAL'
                    });
                    created++;
                }
            }
        } else {
            // Trener / inny user — twórca eventu nie dostaje powiadomienia o własnym evencie
            if (personId === event.createdBy) continue;
            // Rodzic/kibic dostaje zbiorcze powiadomienie w osobnej pętli poniżej
            if (parentChildMap[personId]) continue;
            if (!skipUserIds.includes(personId)) {
                const exists = await notifExists(personId, eventId);
                if (!exists) {
                    await createNotification({
                        userId: personId,
                        teamId: event.teamId,
                        type: 'EVENT_CREATED',
                        title: I18N.pl.newTitle(event.type),
                        body: buildNotifBody(event),
                        referenceId: eventId,
                        referenceType: 'event',
                        forPlayerId: null,
                        requiresAction: false,
                        actionType: null,
                        priority: 'NORMAL'
                    });
                    created++;
                }
            }
        }
    }

    // Zbiorcze powiadomienie dla rodziców/kibiców — 1 na osobę, nawet przy 2+ dzieciach.
    // TYLKO gdy event NIE wymaga akcji — dla wymaganej akcji RODZIC dostał już osobne powiadomienia
    // per dziecko wyżej (własny przycisk), a KIBIC w ogóle nie potwierdza obecności (patrz wyżej).
    if (!requiresAction) {
    for (const [parentId, childIds] of Object.entries(parentChildMap)) {
        if (skipUserIds.includes(parentId)) continue;
        const presentChildIds = childIds.filter(cid => !absentPlayerIds.has(cid));
        if (presentChildIds.length === 0) continue;
        const exists = await notifExists(parentId, eventId);
        if (exists) continue;
        const childNames = [];
        for (const cid of presentChildIds) {
            try {
                const pd = await db.collection('players').doc(cid).get();
                childNames.push(pd.exists ? (pd.data().name || cid) : cid);
            } catch (e) { childNames.push(cid); }
        }
        await createNotification({
            userId: parentId,
            teamId: event.teamId,
            type: 'EVENT_CREATED',
            title: I18N.pl.newTitle(event.type),
            body: buildNotifBody(event, { childNames, requiresAction: false, confirmLabel: I18N.pl.confirmAction }),
            referenceId: eventId,
            referenceType: 'event',
            forPlayerId: null,
            requiresAction: false,
            actionType: null,
            priority: 'NORMAL'
        });
        created++;
    }
    }

    console.log(`✅ sendNotificationsForEvent [${eventId}]: wysłano ${created} powiadomień`);
    return created;
}

/* ═══════════════════════════════════════════════════
   TRIGGER 1: Nowy event → wyślij powiadomienia
   ═══════════════════════════════════════════════════ */
exports.onEventCreated = onDocumentCreated('events/{eventId}', async (event) => {
    const data = event.data.data();
    if (!data || !data.teamId) return;

    // Pomiń przeszłe eventy (np. import danych)
    const today = new Date().toISOString().slice(0, 10);
    if (data.date < today) {
        console.log(`⏭ Pominięto przeszły event: ${data.date}`);
        return;
    }

    try {
        await sendNotificationsForEvent({ ...data, id: event.params.eventId });
    } catch (e) {
        console.error('❌ onEventCreated:', e);
    }
});

/* ═══════════════════════════════════════════════════
   TRIGGER 1b: Event zaktualizowany
   Obsługuje:
     A) status → CANCELLED  → EVENT_CANCELLED do wszystkich zaproszonych
     B) zmiana daty/godziny/miejsca → EVENT_UPDATED do wszystkich zaproszonych
   Omija notifExists() — nie blokuje aktualizacji.
   Guard: pomija zmiany tylko w matchData (live-score, wyniki).
   ═══════════════════════════════════════════════════ */
exports.onEventUpdated = onDocumentUpdated('events/{eventId}', async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (!before || !after) return;

    const eventId = event.params.eventId;
    const today   = new Date().toISOString().slice(0, 10);
    if (after.date < today) return; // Przeszłe eventy — bez powiadomień

    // Guard: jeśli żadne istotne pole się nie zmieniło, zakończ od razu
    // (live-score update lub zmiana attendance nie generuje powiadomień)
    const significantChange =
        before.status     !== after.status     ||
        before.date       !== after.date       ||
        before.timeFrom   !== after.timeFrom   ||
        before.timeTo     !== after.timeTo     ||
        (before.location?.venueName || '') !== (after.location?.venueName || '');
    if (!significantChange) return;

    // Określ język na podstawie osoby która anulowała / edytowała
    const senderLang = await getLang(after.cancelledBy || after.updatedBy || after.createdBy);
    const i18n = I18N[senderLang] || I18N.pl;
    const typeName = i18n.types[after.type] || i18n.types.INNE;
    const { day, date } = formatDate(after.date, i18n.locale);
    const eventLabel = after.title || `${typeName} ${day} ${date}`;

    try {
        // ── A: Odwołanie eventu ──────────────────────────────────────────
        if (before.status !== 'CANCELLED' && after.status === 'CANCELLED') {
            const notifBody  = [
                typeName, `${day} ${date}`,
                after.timeFrom ? `${after.timeFrom}${after.timeTo ? '–' + after.timeTo : ''}` : null,
                after.location?.venueName || null,
            ].filter(Boolean).join(' · ');

            // Dezaktywuj stare notyfikacje ATTENDANCE/CREATED dla tego eventu
            try {
                const oldSnap = await db.collection('notifications')
                    .where('referenceId', '==', eventId)
                    .where('actionDone', '==', false)
                    .get();
                const batch = db.batch();
                oldSnap.forEach(doc => {
                    batch.update(doc.ref, { actionDone: true, actionResult: 'expired', isRead: true, readAt: new Date().toISOString() });
                });
                if (!oldSnap.empty) await batch.commit();
            } catch (e) { console.warn('onEventUpdated CANCELLED — dezaktywacja notif:', e); }

            const recipients = await resolveInvitedUserIds(after, after.cancelledBy || after.createdBy);
            let sent = 0;
            for (const { userId, forPlayerId, playerName } of recipients) {
                await createNotification({
                    userId, teamId: after.teamId,
                    type: 'EVENT_CANCELLED',
                    title: i18n.cancelledTitle(after.type),
                    body: buildNotifBody(after, { childName: playerName || null }),
                    referenceId: eventId, referenceType: 'event',
                    forPlayerId: forPlayerId || null, requiresAction: false,
                });
                sent++;
            }
            console.log(`✅ onEventUpdated [${eventId}] CANCELLED: ${sent} powiadomień`);
            return;
        }

        // ── B: Zmiana daty / godziny / miejsca ──────────────────────────
        if (after.status !== 'CANCELLED') {
            const changes = [];
            if (before.date !== after.date) {
                const { day: nd, date: ndt } = formatDate(after.date, i18n.locale);
                changes.push(i18n.dateChange(`${nd} ${ndt}`));
            }
            if (before.timeFrom !== after.timeFrom || before.timeTo !== after.timeTo) {
                changes.push(i18n.timeChange(`${after.timeFrom || '—'}–${after.timeTo || '—'}`));
            }
            if ((before.location?.venueName || '') !== (after.location?.venueName || '')) {
                changes.push(i18n.placeChange(after.location?.venueName || '—'));
            }
            if (changes.length === 0) return;

            const skipBy     = after.updatedBy || after.createdBy;

            const recipients = await resolveInvitedUserIds(after, skipBy);
            let sent = 0;
            for (const { userId, forPlayerId, playerName } of recipients) {
                await createNotification({
                    userId, teamId: after.teamId,
                    type: 'EVENT_UPDATED',
                    title: i18n.updatedTitle(after.type),
                    body: buildNotifBody(after, { childName: playerName || null, changes }),
                    referenceId: eventId, referenceType: 'event',
                    forPlayerId: forPlayerId || null, requiresAction: false,
                });
                sent++;
            }
            console.log(`✅ onEventUpdated [${eventId}] UPDATED: ${sent} powiadomień (${changes.join(', ')})`);
        }
    } catch (e) {
        console.error('❌ onEventUpdated:', e);
    }

    // ── C: Nowo zaproszeni gracze (np. trener dodał zawodnika do istniejącego eventu) ──
    try {
        const beforeInvited = before.attendance?.invited || [];
        const afterInvited  = after.attendance?.invited  || [];
        const newlyAdded    = afterInvited.filter(id => !beforeInvited.includes(id));
        if (newlyAdded.length > 0) {
            const cnt = await sendNotificationsForEvent({ ...after, id: eventId }, [], newlyAdded);
            console.log(`✅ onEventUpdated [${eventId}] NEWLY_ADDED: ${cnt} powiadomień (${newlyAdded.join(', ')})`);
        }
    } catch (e) {
        console.error('❌ onEventUpdated [NEWLY_ADDED]:', e);
    }
});

/* ═══════════════════════════════════════════════════
   TRIGGER 2: Nowy membership → powiadomienia o nadchodzących DRUZYNA eventach
   ═══════════════════════════════════════════════════ */
exports.onMembershipCreated = onDocumentCreated('memberships/{membershipId}', async (event) => {
    const m = event.data.data();
    if (!m || !m.userId) return;
    // FIX (2026-09-03, mobile) — porównanie było case-sensitive, appka mobilna zapisuje status
    // membershipu jako 'ACTIVE' (wielkie litery) przy dołączeniu kodem.
    if (!['active', 'grace', 'demo'].includes((m.status || '').toLowerCase())) return;

    /* ── Trial per (uid, clubId) — ZAWODNIK nie dostaje triala ── */
    if (m.clubId && m.role !== 'ZAWODNIK') {
        try {
            const userRef = db.collection('users').doc(m.userId);
            const userDoc = await userRef.get();
            const existingTrial = userDoc.exists && userDoc.data()?.clubs_trial?.[m.clubId];
            if (!existingTrial) {
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 90);
                await userRef.update({
                    [`clubs_trial.${m.clubId}`]: trialEnd
                });
                console.log(`✓ Trial utworzony: ${m.userId} w klubie ${m.clubId} do ${trialEnd.toISOString().slice(0,10)}`);
            } else {
                console.log(`→ Trial już istnieje: ${m.userId} w klubie ${m.clubId}`);
            }
        } catch (e) {
            console.error('✗ Trial creation error:', e);
        }
    }

    if (!m.teamId) return;

    const today = new Date().toISOString().slice(0, 10);
    const maxDate = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10); // 60 dni do przodu

    try {
        const evSnap = await db.collection('events')
            .where('teamId', '==', m.teamId)
            .where('date', '>=', today)
            .where('date', '<=', maxDate)
            .get();

        let total = 0;
        for (const doc of evSnap.docs) {
            const ev = { ...doc.data(), id: doc.id };
            // Tylko eventy dla całej drużyny (scope DRUZYNA)
            if (!(ev.attendance?.invited || []).includes('__TEAM__')) continue;

            // Wyślij powiadomienie tylko dla nowego usera (skipUserIds = wszyscy oprócz niego)
            // Trick: przekazujemy pustą listę skipUserIds — notifExists() zadba o duplikaty
            await sendNotificationsForEvent(ev, []);
            total++;
        }
        console.log(`✅ onMembershipCreated [${m.userId}]: sprawdzono ${total} eventów`);
    } catch (e) {
        console.error('❌ onMembershipCreated:', e);
    }
});

/* ═══════════════════════════════════════════════════
   TRIGGER 3: Harmonogram — przypomnienia (co godzinę)
   Wysyła EVENT_REMINDER gdy jesteśmy w oknie reminderHoursBefore
   ═══════════════════════════════════════════════════ */
/* -----------------------------------------------------
   TRIGGER: Nowe powiadomienie w Firestore -> push
   Dual-path: Expo push (native) lub FCM (web)
   ----------------------------------------------------- */
const { Expo } = require('expo-server-sdk');
const expo = new Expo(); // v2

// Badge = obecności do potwierdzenia + nieprzeczytane chaty + zadania niewykonane
async function calcBadgeCount(userId, teamId) {
    const _now = Date.now();
    const _DAY7 = 7 * 24 * 60 * 60 * 1000;
    const queries = [
        db.collection('notifications').where('userId', '==', userId).get()
    ];
    if (teamId) {
        queries.push(
            db.collection('tasks')
                .where('teamId', '==', teamId)
                .where('assignedTo', 'array-contains', userId)
                .where('status', '==', 'PENDING')
                .get()
        );
    }
    const [notifSnap, taskSnap] = await Promise.all(queries);
    let count = 0;
    for (const d of notifSnap.docs) {
        const n = d.data();
        if (n.status === 'DELETE' || n.actionResult === 'expired') continue;
        if (n.visibleFrom && new Date(n.visibleFrom).getTime() > _now) continue;
        // Obecność do potwierdzenia — tylko przyszłe eventy w oknie 7 dni
        if (n.requiresAction && !n.actionDone) {
            if (n.eventDate) {
                const evMs = new Date(n.eventDate).getTime();
                if (evMs < _now) continue; // event już minął
                if (evMs - _now > _DAY7) continue; // za daleko w przyszłości
            }
            count++;
            continue;
        }
        // Nieprzeczytany czat
        if (n.referenceType === 'message' && !n.isRead) {
            count++;
        }
    }
    if (taskSnap) {
        for (const d of taskSnap.docs) {
            const t = d.data();
            if (!(t.completedBy || []).includes(userId) && !(t.rejectedBy || []).includes(userId)) {
                count++;
            }
        }
    }
    return count;
}

exports.onNotificationCreated = onDocumentCreated('notifications/{notificationId}', async (event) => {
    const notif = event.data.data();
    if (!notif || !notif.userId) return;

    try {
        const userDoc = await db.collection('users').doc(notif.userId).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data();

        // Filtruj puste/null tokeny
        const expoToken = (userData.pushToken || '').trim() || null;
        const fcmToken  = (userData.fcmToken  || '').trim() || null;

        const title = (notif.title || '').trim() || 'Coachay';
        const body  = (notif.body  || '').trim();
        const notifData = {
            referenceId:    notif.referenceId    || '',
            referenceType:  notif.referenceType  || '',
            notificationId: event.params.notificationId
        };

        // --- Expo push (natywna aplikacja iOS/Android) ---
        const isValidExpoToken = expoToken && Expo.isExpoPushToken(expoToken);
        if (isValidExpoToken) {
            const badgeCount = await calcBadgeCount(notif.userId, notif.teamId || null);

            const chunks = expo.chunkPushNotifications([{
                to: expoToken, sound: 'default', badge: badgeCount,
                title, body, data: notifData
            }]);
            for (const chunk of chunks) {
                await expo.sendPushNotificationsAsync(chunk);
            }
            console.log(`Expo push wyslany do ${notif.userId}`);
        }

        // --- FCM push (web) — tylko jeśli brak Expo tokenu, żeby nie dublować na iOS ---
        if (fcmToken && !isValidExpoToken) {
            await getMessaging().send({
                token: fcmToken,
                notification: { title, body },
                data: notifData
            });
            console.log(`FCM push wyslany do ${notif.userId}`);
        }

        if (!isValidExpoToken && !fcmToken) {
            console.log(`User ${notif.userId} nie ma tokenu push.`);
        }
    } catch (e) {
        if (e.code === 'messaging/registration-token-not-registered') {
            await db.collection('users').doc(notif.userId).update({ fcmToken: FieldValue.delete() }).catch(() => {});
        } else {
            console.error('onNotificationCreated error:', e);
        }
    }
});

exports.sendReminders = onSchedule('every 60 minutes', async () => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(now + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    try {
        const evSnap = await db.collection('events')
            .where('date', '>=', today)
            .where('date', '<=', tomorrow)
            .get();

        for (const doc of evSnap.docs) {
            const ev = { ...doc.data(), id: doc.id };
            if (!ev.reminderHoursBefore || ev.reminderHoursBefore <= 0) continue;

            const evTime = new Date(ev.date + 'T' + (ev.timeFrom || '00:00')).getTime();
            const reminderStart = evTime - ev.reminderHoursBefore * 3600000;

            // Sprawdź czy jesteśmy w oknie: start <= now < start+1h
            if (now < reminderStart || now >= reminderStart + 3600000) continue;

            console.log(`⏰ Reminder dla eventu ${ev.id} (${ev.date} ${ev.timeFrom})`);
            // Użyj sendNotificationsForEvent — notifExists() zapobiega duplikatom
            await sendNotificationsForEvent(ev, []);
        }
    } catch (e) {
        console.error('❌ sendReminders:', e);
    }
});
/* 
   TRIGGER 4: Automatyczne zakończenie meczy o północy
   Codziennie o 00:00 zakancza mecze LIVE z dnia poprzedniego
*/
exports.autoFinishMatches = onSchedule('every day 00:00', async () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    
    console.log(`Północ: sprawdzanie meczy z dnia ${yesterday} do automatycznego zakończenia`);
    
    try {
        const matchesSnap = await db.collection('events')
            .where('type', '==', 'MECZ')
            .where('date', '==', yesterday)
            .where('matchData.matchStatus', '==', 'LIVE')
            .get();
            
        let finishedCount = 0;
        
        for (const doc of matchesSnap.docs) {
            const matchData = doc.data().matchData || {};
            const our = matchData.result?.our ?? 0;
            const opp = matchData.result?.opponent ?? 0;
            const outcome = our > opp ? 'WIN' : our < opp ? 'LOSS' : 'DRAW';
            
            await db.collection('events').doc(doc.id).update({
                'matchData.matchStatus': 'FINISHED',
                'matchData.endedAt': new Date().toISOString(),
                'matchData.endedBy': 'SYSTEM_AUTO',
                'matchData.result.outcome': outcome,
                'matchData.result.updatedBy': 'SYSTEM_AUTO',
                'matchData.result.updatedAt': new Date().toISOString(),
                'matchData.autoFinished': true,
                'matchData.autoFinishedAt': new Date().toISOString()
            });
            
            finishedCount++;
            console.log(`Auto-zakończono mecz ${doc.id}: ${our}:${opp} (${outcome})`);
            
        }
        
        console.log(`Zakończono ${finishedCount} meczy automatycznie`);

    } catch (e) {
        console.error('Błąd autoFinishMatches:', e);
    }
});

/* ═══════════════════════════════════════════════════════
   TRIGGER 5: Aktualizacja licenseStatus dla wszystkich klubów
   Codziennie o 06:00 — oblicza status każdego klubu i zapisuje
   do clubs/{clubId}.licenseStatus żeby klient nie liczył samemu.

   Kolejność priorytetów:
   1. clubs.license.valid_until aktywne → ACTIVE (club_license)
   2. Admin klubu ma access_rights aktywne → ACTIVE (admin_personal)
   3. Nic → EXPIRED
   (Trial liczony per-user w getAccessStatus() na podstawie memberships.createdAt)
═══════════════════════════════════════════════════════ */
exports.updateClubLicenseStatuses = onSchedule('every day 06:00', async () => {
    const now       = new Date();
    const GRACE_MS  = 7 * 86400 * 1000;

    console.log(`updateClubLicenseStatuses start: ${now.toISOString()}`);

    try {
        // Pobierz wszystko równolegle
        const [clubsSnap, adminsSnap, arSnap] = await Promise.all([
            db.collection('clubs').get(),
            db.collection('trainers').where('isClubAdmin', '==', true).get(),
            db.collection('access_rights').get(),
        ]);

        // Mapa: clubId → Set(adminUserId)
        const adminsByClub = {};
        adminsSnap.docs.forEach(d => {
            const { clubId, userId } = d.data();
            if (!clubId || !userId) return;
            if (!adminsByClub[clubId]) adminsByClub[clubId] = new Set();
            adminsByClub[clubId].add(userId);
        });

        // Mapa: clubId → najdalszy valid_until aktywnego access_rights admina
        const adminArByClub = {};
        arSnap.docs.forEach(d => {
            const { club_id: cid, uid, valid_until } = d.data();
            if (!cid || !uid || !valid_until) return;
            if (!adminsByClub[cid]?.has(uid)) return; // nie admin tego klubu
            const expiry = valid_until.toDate ? valid_until.toDate() : new Date(valid_until);
            if (!adminArByClub[cid] || expiry > adminArByClub[cid]) {
                adminArByClub[cid] = expiry;
            }
        });

        const batch = db.batch();
        let updated = 0;

        for (const doc of clubsSnap.docs) {
            const d        = doc.data();
            const clubRef  = doc.ref;
            const prevStatus = d.licenseStatus || null;

            let status = 'EXPIRED';
            let source = null;
            let statusExpiry = null;

            // 1. Licencja klubowa B2B / support
            if (d.license) {
                const raw    = d.license.valid_until ?? d.license.expiresAt;
                const expiry = raw?.toDate ? raw.toDate() : (raw ? new Date(raw) : null);
                if (expiry) {
                    if (expiry > now) {
                        status = 'ACTIVE'; source = 'club_license'; statusExpiry = expiry;
                    } else if (expiry > new Date(now - GRACE_MS)) {
                        status = 'GRACE'; source = 'club_license'; statusExpiry = expiry;
                    }
                }
            }

            // 2. Aktywna licencja indywidualna admina klubu
            if (status === 'EXPIRED' && adminArByClub[doc.id]) {
                const expiry = adminArByClub[doc.id];
                if (expiry > now) {
                    status = 'ACTIVE'; source = 'admin_personal'; statusExpiry = expiry;
                } else if (expiry > new Date(now - GRACE_MS)) {
                    status = 'GRACE'; source = 'admin_personal'; statusExpiry = expiry;
                }
            }

            // Trial liczony per-user w getAccessStatus() (memberships.createdAt) — nie tutaj

            // Zapisz tylko jeśli status się zmienił (oszczędność zapisów)
            if (status !== prevStatus) {
                batch.update(clubRef, {
                    licenseStatus:          status,
                    licenseStatusSource:    source,
                    licenseStatusUpdatedAt: FieldValue.serverTimestamp(),
                });
                updated++;
                console.log(`Club ${doc.id}: ${prevStatus} → ${status} (${source})`);
            }
        }

        await batch.commit();
        console.log(`updateClubLicenseStatuses: zaktualizowano ${updated}/${clubsSnap.size} klubów`);

    } catch (e) {
        console.error('updateClubLicenseStatuses error:', e);
    }
});

/* ═══════════════════════════════════════════════════════
   Powiadomienia o kończącej się licencji (zaprojektowane i zbudowane 2026-07-28)

   System A (Etap 1) — per-user, płacący indywidualnie lub rodzinnie:
   iteruje `access_rights` (P1 własna I P4 rodzinna — obie żyją w tej samej kolekcji,
   rodzinna ma dodatkowo slots_total/slots_used, ale valid_until liczy się tak samo)
   → powiadamia bezpośrednio `uid` (płatnika). Kibic korzystający ze slotu rodzinnego
   (lazy-claim, nie ma własnego access_rights) świadomie NIE dostaje powiadomienia —
   jeśli rodzic nie odnowi, kibic straci dostęp bez ostrzeżenia, ale może kupić sobie sam.

   System B — pula klubowa B2B, kontekst biznesowy: iteruje `clubs.license.valid_until`
   → powiadamia admina klubu (isClubAdmin) ORAZ wszystkich aktywnych trenerów tego klubu,
   nie tylko admina — OWNER może w ogóle nie używać appki, trenerzy mają większą szansę
   zauważyć.

   Etap 3 — osobiste ostrzeżenie dla KAŻDEGO (dowolna rola, nie tylko trener), kto
   aktualnie ma aktywny slot z puli klubowej (`licenseSource:'CLUB', licenseStatus:'ACTIVE'`)
   — wypełnia lukę Systemu B, który nie obejmuje np. rodzica korzystającego z puli
   (scope='all'), tylko trenerów i admina.

   Etap 2 — TRIAL liczony od `clubs.createdAt` (90 dni), dzielony przez WSZYSTKICH
   aktywnych członków klubu (poza ZAWODNIK, zawsze bezpłatny) którzy nie mają własnego
   `access_rights` (P1 ma priorytet nad trialem nawet w oknie trialowym — patrz
   `getAccessStatus()` w coachay-core.js, kolejność P1→P0→P3→P4).

   Progi dni: {15,10,5,1,0} przed końcem opłaconego okresu/trialu, {0,7} w trakcie
   7-dniowego grace.
═══════════════════════════════════════════════════════ */
const LICENSE_NOTIF_DAYS = [15, 10, 5, 1, 0];
const LICENSE_GRACE_MARKS = [0, 7];
const TRIAL_DAYS_MS = 90 * 86400 * 1000;

function makeLicenseNotifId(userId, title, daysLeft) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const slug = title.replace(/[^a-zA-Z]/g, '').slice(0, 8).toLowerCase();
    const dl = daysLeft >= 0 ? 'd' + daysLeft : 'g' + Math.abs(daysLeft);
    return `licnotif_${today}_${userId}_${slug}_${dl}`;
}

async function sendLicenseNotification(userId, title, body, teamId, daysLeft) {
    const now = new Date();
    const notif = {
        notificationId: makeLicenseNotifId(userId, title, daysLeft ?? 0),
        userId,
        teamId: teamId || null,
        type: 'LICENSE_EXPIRING',
        title, body,
        referenceId: null,
        referenceType: 'license',
        forPlayerId: null,
        requiresAction: false,
        actionType: null,
        actionDone: false,
        actionResult: null,
        actionComment: null,
        createdAt: now.toISOString(),
        readAt: null,
        isRead: false,
        priority: 'HIGH',
        isDemo: false,
        demoSetId: null,
        deleteAt: new Date(now.getTime() + 60 * 86400 * 1000)
    };
    await db.collection('notifications').doc(notif.notificationId).set(notif);
}

// Zwraca treść powiadomienia dla danego daysLeft, albo null jeśli żaden próg nie pasuje.
// tryb: 'active' (już płaci, "odnów") | 'trial' (jeszcze nie płaci, "kup pakiet")
function licenseExpiryMessage(daysLeft, podmiot, tryb) {
    const czasownik = tryb === 'trial' ? 'Kup pakiet' : 'Odnów';
    const czasownikWarunek = tryb === 'trial' ? 'kupisz pakietu' : 'odnowisz';
    if (daysLeft >= 0 && LICENSE_NOTIF_DAYS.includes(daysLeft)) {
        return daysLeft === 0
            ? `${podmiot} kończy się dziś. ${czasownik}, żeby nie stracić dostępu.`
            : `${podmiot} kończy się za ${daysLeft} ${daysLeft === 1 ? 'dzień' : 'dni'}. ${czasownik} w Płatnościach.`;
    }
    if (daysLeft < 0) {
        const graceDay = Math.round(-daysLeft);
        if (graceDay <= 7 && LICENSE_GRACE_MARKS.includes(graceDay)) {
            return graceDay === 0
                ? `${podmiot} wygasł(a). Masz 7 dni okresu karencji — jeśli nie ${czasownikWarunek}, stracisz dostęp.`
                : `Dziś ostatni dzień okresu karencji dla: ${podmiot}. Jeśli nie ${czasownikWarunek}, stracisz dostęp.`;
        }
    }
    return null;
}

exports.checkExpiringLicenses = onSchedule('every day 07:00', async () => {
    const now = new Date();
    console.log(`checkExpiringLicenses start: ${now.toISOString()}`);
    let sentA = 0, sentB = 0, sentEtap2 = 0, sentEtap3 = 0;
    // Globalny dedup: userId → już dostał powiadomienie w tej iteracji (niezależnie od etapu)
    const notifiedUsers = new Set();

    try {
        // ── System A (Etap 1): access_rights (P1 własna + P4 rodzinna) ──
        // Zbieramy też arByClub: clubId → Set(uid) z aktywnym P1, żeby Etap 2 (trial)
        // mógł pominąć userów już objętych własną licencją.
        const arByClub = new Map();
        const arSnap = await db.collection('access_rights').get();
        for (const doc of arSnap.docs) {
            const ar = doc.data();
            if (!ar.uid || !ar.valid_until || !ar.club_id) continue;
            const validUntil = ar.valid_until.toDate ? ar.valid_until.toDate() : new Date(ar.valid_until);

            if (validUntil > now) {
                if (!arByClub.has(ar.club_id)) arByClub.set(ar.club_id, new Set());
                arByClub.get(ar.club_id).add(ar.uid);
            }

            const daysLeft = Math.ceil((validUntil - now) / 86400000);
            const msg = licenseExpiryMessage(daysLeft, 'Twój pakiet Coachay', 'active');
            if (msg && !notifiedUsers.has(ar.uid)) {
                await sendLicenseNotification(ar.uid, 'Coachay — pakiet', msg, ar.club_id, daysLeft);
                notifiedUsers.add(ar.uid);
                sentA++;
            }
        }

        // ── System B + Etap 3 + Etap 2: wszystko co dotyczy poszczególnych klubów ──
        const clubsSnap = await db.collection('clubs').get();
        for (const clubDoc of clubsSnap.docs) {
            const cd = clubDoc.data();
            const clubId = clubDoc.id;
            const clubLabel = cd.clubName || cd.legalName || clubId;
            const lic = cd.license;

            // System B (admin + trenerzy) + Etap 3 (każdy z aktywnym slotem klubowym)
            if (lic && lic.valid_until) {
                const validUntil = lic.valid_until.toDate ? lic.valid_until.toDate() : new Date(lic.valid_until);
                const daysLeft = Math.ceil((validUntil - now) / 86400000);
                const msgKlub = licenseExpiryMessage(daysLeft, `Licencja klubowa "${clubLabel}"`, 'active');

                if (msgKlub) {
                    const [adminsSnap, trenerzySnap, slotUsersSnap] = await Promise.all([
                        db.collection('trainers').where('clubId', '==', clubId).where('isClubAdmin', '==', true).get(),
                        db.collection('memberships')
                            .where('clubId', '==', clubId)
                            .where('role', 'in', ['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'TRENER'])
                            .get(),
                        db.collection('memberships')
                            .where('clubId', '==', clubId)
                            .where('licenseSource', '==', 'CLUB')
                            .where('licenseStatus', '==', 'ACTIVE')
                            .get()
                    ]);

                    // System B — admini pierwsi (priorytet), potem trenerzy
                    const odbiorcyB = new Set();
                    adminsSnap.docs.forEach(d => { if (d.data().userId) odbiorcyB.add(d.data().userId); });
                    trenerzySnap.docs.forEach(d => {
                        const m = d.data();
                        const st = (m.status || '').toLowerCase();
                        if (m.userId && (st === 'active' || st === 'grace')) odbiorcyB.add(m.userId);
                    });
                    for (const uid of odbiorcyB) {
                        if (notifiedUsers.has(uid)) continue; // już dostał powiadomienie w tym przebiegu
                        await sendLicenseNotification(uid, 'Coachay — licencja klubowa', msgKlub, null, daysLeft);
                        notifiedUsers.add(uid);
                        sentB++;
                    }

                    // Etap 3 — osobiste ostrzeżenie dla każdego z aktywnym slotem klubowym
                    const msgSlot = licenseExpiryMessage(daysLeft, `Twój dostęp do Coachay przez pulę klubu "${clubLabel}"`, 'active');
                    if (msgSlot) {
                        for (const d of slotUsersSnap.docs) {
                            const m = d.data();
                            if (!m.userId || notifiedUsers.has(m.userId)) continue;
                            // Rodzic i kibic nie mogą odnowić licencji — pomijamy
                            if (['RODZIC', 'KIBIC', 'ZAWODNIK'].includes(m.role)) continue;
                            await sendLicenseNotification(m.userId, 'Coachay — dostęp przez pulę klubową', msgSlot, clubId, daysLeft);
                            notifiedUsers.add(m.userId);
                            sentEtap3++;
                        }
                    }
                }
            }

            // Etap 2 — TRIAL liczony od clubs.createdAt, dzielony przez członków bez P1
            const createdAt = cd.createdAt?.toDate ? cd.createdAt.toDate() : (cd.createdAt ? new Date(cd.createdAt) : null);
            if (createdAt && !isNaN(createdAt)) {
                const trialEnd = new Date(createdAt.getTime() + TRIAL_DAYS_MS);
                const daysLeftTrial = Math.ceil((trialEnd - now) / 86400000);
                const msgTrial = licenseExpiryMessage(daysLeftTrial, `Twój darmowy okres próbny w klubie "${clubLabel}"`, 'trial');

                if (msgTrial) {
                    const juzMaP1 = arByClub.get(clubId) || new Set();
                    const membersSnap = await db.collection('memberships').where('clubId', '==', clubId).get();
                    for (const d of membersSnap.docs) {
                        const m = d.data();
                        const st = (m.status || '').toLowerCase();
                        if (!m.userId || ['ZAWODNIK', 'RODZIC', 'KIBIC'].includes(m.role)) continue;
                        if (!(st === 'active' || st === 'grace')) continue;
                        if (juzMaP1.has(m.userId)) continue;
                        if (notifiedUsers.has(m.userId)) continue; // już dostał inny typ powiadomienia
                        await sendLicenseNotification(m.userId, 'Coachay — okres próbny', msgTrial, clubId, daysLeftTrial);
                        notifiedUsers.add(m.userId);
                        sentEtap2++;
                    }
                }
            }
        }

        console.log(`checkExpiringLicenses: A=${sentA}, B=${sentB}, Etap2(trial)=${sentEtap2}, Etap3(slot klubowy)=${sentEtap3}`);
    } catch (e) {
        console.error('checkExpiringLicenses error:', e);
    }
});

/* ═══════════════════════════════════════════════════════
   TRIGGER 6: WhatsApp Webhook
   GET  — weryfikacja przez Meta (hub.challenge)
   POST — odbiór wiadomości + wysyłka kodu
═══════════════════════════════════════════════════════ */

const WHATSAPP_VERIFY_TOKEN = 'coachay_whatsapp_2026';

function waRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'graph.facebook.com',
            path,
            method,
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }, res => {
            let d = '';
            res.on('data', x => d += x);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
                catch (e) { resolve({ status: res.statusCode, body: d }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function sendWhatsAppText(phone, text) {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    return waRequest('POST', `/v19.0/${phoneId}/messages`, {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text }
    });
}

async function findCodeForPhone(phone, role) {
    if (role === 'TRENER') {
        // Szukaj trenera po numerze telefonu
        const snap = await db.collection('trainers')
            .where('coachProfile.phone', '==', phone)
            .where('isActive', '==', true)
            .limit(1).get();
        if (snap.empty) return null;
        const trainer = snap.docs[0].data();
        const codeSnap = await db.collection('memberships')
            .where('role', '==', 'TRENER')
            .where('status', '==', 'pending')
            .where('codeCreatedBy', '==', trainer.userId)
            .limit(1).get();
        return codeSnap.empty ? null : codeSnap.docs[0].data();
    }
    if (role === 'RODZIC') {
        // Szukaj zawodnika po guardianPhones
        const snap = await db.collection('players')
            .where('guardianPhones', 'array-contains', phone)
            .limit(1).get();
        if (snap.empty) return null;
        const player = snap.docs[0].data();
        const codeSnap = await db.collection('memberships')
            .where('playerId', '==', player.playerId)
            .where('role', '==', 'RODZIC')
            .where('status', '==', 'pending')
            .limit(1).get();
        return codeSnap.empty ? null : codeSnap.docs[0].data();
    }
    return null;
}

async function checkRateLimit(phone) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const snap = await db.collection('codeRequests')
        .where('phone', '==', phone)
        .where('sentAt', '>=', since)
        .get();
    return snap.size >= 3;
}

async function logCodeRequest(phone, role, foundCode) {
    const now = new Date().toISOString();
    const id = 'req_' + Date.now();
    await db.collection('codeRequests').doc(id).set({
        requestId: id,
        phone,
        role,
        foundCode,
        sentAt: now
    });
}

/* ═══════════════════════════════════════════════════════
   WhatsApp "Poproś o kod" — WYŁĄCZONE 2026-07-28.
   Kod działający, ale funkcja sparkowana (brak konta Meta Business + numeru telefonu,
   patrz TODO.md Backlog). Zakomentowane, nie usunięte, żeby zdjąć publiczne, nieautoryzowane
   endpointy (onRequest, tylko rate-limit po telefonie) z produkcji — bez tego ktoś mógłby je
   bezcelowo bombardować, generując zapisy/odczyty Firestore mimo że WhatsApp i tak nie wyśle
   (brak realnych sekretów Meta). Odkomentować gdy temat wróci.

// ── sendCodeViaWhatsApp — wywoływane przez login.html ──
exports.sendCodeViaWhatsApp = onRequest(
    { secrets: [WHATSAPP_TOKEN_SECRET, WHATSAPP_PHONE_ID_SECRET], cors: true },
    async (req, res) => {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

        const { phone, role } = req.body || {};
        if (!phone || !role) return res.status(400).json({ error: 'Missing phone or role' });

        // Rate limit
        const limited = await checkRateLimit(phone);
        if (limited) {
            await logCodeRequest(phone, role, false);
            return res.json({ sent: false, rateLimited: true });
        }

        const membership = await findCodeForPhone(phone, role);
        await logCodeRequest(phone, role, !!membership);

        if (!membership || !membership.code) {
            return res.json({ sent: false, rateLimited: false });
        }

        await sendWhatsAppText(phone,
            `✅ Twój kod dostępu do Coachay:\n\n*${membership.code}*\n\nWpisz go na stronie logowania Coachay.\nJeśli masz problemy, skontaktuj się ze swoim trenerem.`
        );

        // Oznacz wysłanie
        const mbrSnap = await db.collection('memberships')
            .where('code', '==', membership.code).limit(1).get();
        if (!mbrSnap.empty) {
            await mbrSnap.docs[0].ref.update({
                sentViaWhatsApp: true,
                sentAt: new Date().toISOString()
            });
        }

        return res.json({ sent: true });
    }
);

exports.onWhatsAppWebhook = onRequest({ secrets: [WHATSAPP_TOKEN_SECRET, WHATSAPP_PHONE_ID_SECRET] }, async (req, res) => {
    // GET — weryfikacja webhook przez Meta
    if (req.method === 'GET') {
        const mode      = req.query['hub.mode'];
        const token     = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
            console.log('WhatsApp webhook verified');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    // POST — odbiór wiadomości od użytkownika
    if (req.method === 'POST') {
        try {
            const entry    = req.body?.entry?.[0];
            const changes  = entry?.changes?.[0];
            const value    = changes?.value;
            const message  = value?.messages?.[0];

            if (!message || message.type !== 'text') {
                return res.status(200).send('OK');
            }

            const phone = '+' + message.from; // Meta daje bez +
            const text  = (message.text?.body || '').trim().toUpperCase();

            // Format: "TRENER" lub "RODZIC" lub "KOD TRENER" itp.
            let role = null;
            if (text.includes('TRENER'))  role = 'TRENER';
            if (text.includes('RODZIC'))  role = 'RODZIC';

            if (!role) {
                await sendWhatsAppText(phone,
                    'Witaj w Coachay! 👋\n\nAby otrzymać kod dostępu, napisz:\n• *TRENER* — jeśli jesteś trenerem\n• *RODZIC* — jeśli jesteś rodzicem zawodnika'
                );
                return res.status(200).send('OK');
            }

            const limited = await checkRateLimit(phone);
            if (limited) {
                await sendWhatsAppText(phone,
                    '⚠️ Przekroczono limit prób (3/dobę). Spróbuj ponownie jutro lub skontaktuj się z trenerem.'
                );
                await logCodeRequest(phone, role, false);
                return res.status(200).send('OK');
            }

            const membership = await findCodeForPhone(phone, role);
            await logCodeRequest(phone, role, !!membership);

            if (!membership || !membership.code) {
                await sendWhatsAppText(phone,
                    '❌ Nie znaleźliśmy kodu dla Twojego numeru.\n\nUpewnij się że trener już wygenerował Twój kod, a numer telefonu jest zapisany w systemie.'
                );
                return res.status(200).send('OK');
            }

            const code = membership.code;
            const pin  = membership.pinHash ? '' : ''; // PIN jest zahashowany — nie możemy go odtworzyć
            await sendWhatsAppText(phone,
                `✅ Twój kod dostępu do Coachay:\n\n*${code}*\n\nWpisz go na stronie logowania Coachay.\nJeśli masz problemy, skontaktuj się ze swoim trenerem.`
            );

            // Oznacz że wysłano
            const mbrSnap = await db.collection('memberships')
                .where('code', '==', code).limit(1).get();
            if (!mbrSnap.empty) {
                await mbrSnap.docs[0].ref.update({
                    sentViaWhatsApp: true,
                    sentAt: new Date().toISOString()
                });
            }

        } catch (e) {
            console.error('onWhatsAppWebhook POST error:', e);
        }
        return res.status(200).send('OK');
    }

    return res.status(405).send('Method Not Allowed');
});
*/

/* ═══════════════════════════════════════════════════════
   Cleanup powiadomień — 3-fazowy hard-delete
   Faza 1: soft-delete gdy deleteAt minął (zachowane)
   Faza 2: hard-delete status=DELETE (oczekujące na purge)
   Faza 3: hard-delete starsze niż 60 dni (niezależnie od statusu)
   Przed hard-delete: zapis do platform_metrics
═══════════════════════════════════════════════════════ */
exports.cleanupNotifications = onSchedule('every day 03:00', async () => {
    const now = new Date();
    console.log(`cleanupNotifications start: ${now.toISOString()}`);

    // Faza 1: soft-delete (istniejące zachowanie)
    try {
        const softSnap = await db.collection('notifications')
            .where('status', '!=', 'DELETE')
            .where('deleteAt', '<=', now)
            .get();
        if (!softSnap.empty) {
            const batch = db.batch();
            softSnap.docs.forEach(doc => batch.update(doc.ref, { status: 'DELETE' }));
            await batch.commit();
            console.log(`cleanupNotifications F1: soft-deleted ${softSnap.size}`);
        }
    } catch (e) { console.error('cleanupNotifications F1:', e); }

    // Faza 2+3: hard-delete — status=DELETE + starsze niż 60 dni
    try {
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString();
        const [deleteStatusSnap, oldSnap] = await Promise.all([
            db.collection('notifications').where('status', '==', 'DELETE').get(),
            db.collection('notifications').where('createdAt', '<=', sixtyDaysAgo).get(),
        ]);

        // Deduplikacja po doc.id
        const toDelete = new Map();
        deleteStatusSnap.docs.forEach(d => toDelete.set(d.id, d.ref));
        oldSnap.docs.forEach(d => toDelete.set(d.id, d.ref));

        if (toDelete.size > 0) {
            await incrementPlatformMetric(now.getFullYear(), now.getMonth() + 1, {
                deleted_notifications: toDelete.size,
            });
            const refs = [...toDelete.values()];
            for (let i = 0; i < refs.length; i += 500) {
                const batch = db.batch();
                refs.slice(i, i + 500).forEach(ref => batch.delete(ref));
                await batch.commit();
            }
            console.log(`cleanupNotifications F2/F3: hard-deleted ${toDelete.size}`);
        } else {
            console.log('cleanupNotifications: brak powiadomień do hard-delete');
        }
    } catch (e) { console.error('cleanupNotifications F2/F3:', e); }
});

/* ═══════════════════════════════════════════════════════
   Cleanup eventów — hard-delete soft-deleted eventów po 14 dniach
   Events ze status=DELETE i deletedAt starszym niż 14 dni.
   Historyczne mecze/treningi (bez DELETE) zostają nieruszone.
   Przed delete: zapis do platform_metrics.
═══════════════════════════════════════════════════════ */
exports.cleanupEvents = onSchedule('every day 03:30', async () => {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    console.log(`cleanupEvents start: ${now.toISOString()}`);
    try {
        const snap = await db.collection('events').where('status', '==', 'DELETE').get();
        if (snap.empty) { console.log('cleanupEvents: brak eventów do usunięcia'); return; }

        // Filtruj tylko te gdzie deletedAt > 14 dni temu
        const toDelete = snap.docs.filter(doc => {
            const deletedAt = doc.data().deletedAt;
            if (!deletedAt) return true; // brak deletedAt = usuń od razu
            return new Date(deletedAt) <= fourteenDaysAgo;
        });

        if (toDelete.length === 0) { console.log('cleanupEvents: żaden event nie przekroczył 14 dni'); return; }

        await incrementPlatformMetric(now.getFullYear(), now.getMonth() + 1, {
            deleted_events: toDelete.length,
        });

        for (let i = 0; i < toDelete.length; i += 500) {
            const batch = db.batch();
            toDelete.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        console.log(`cleanupEvents: hard-deleted ${toDelete.length} eventów`);
    } catch (e) { console.error('cleanupEvents error:', e); }
});

/* ═══════════════════════════════════════════════════════
   Cleanup zadań — soft-delete (status: DELETE) zadania 48h po terminie (dueDate),
   NIEZALEŻNIE od statusu (DONE/PENDING/częściowo odrzucone) — decyzja Rafała (2026-09-04,
   pkt 8 z listy, ustalone przez sync z sesją web): "dotyczy WSZYSTKICH, liczymy od dueDate".
   Jedna wspólna reguła dla web+app zamiast zdublowanej logiki klienckiej (dawne
   autoCleanupTasks() w tasks.ts / zadania.html: DONE>14dni, PENDING>60dni liczone od
   createdAt — ta reguła zostaje jako FALLBACK tylko dla zadań BEZ dueDate, bo dla nich nie
   da się liczyć "48h po terminie").
   Web i mobile mogą po wdrożeniu usunąć swoje client-side wywołania cleanupu — czytanie
   zadań już filtruje status!=='DELETE', więc wystarczy że CF ustawia to pole.
═══════════════════════════════════════════════════════ */
exports.cleanupExpiredTasks = onSchedule('every day 04:00', async () => {
    const now = new Date();
    console.log(`cleanupExpiredTasks start: ${now.toISOString()}`);
    try {
        const snap = await db.collection('tasks').where('status', 'in', ['PENDING', 'DONE']).get();
        if (snap.empty) { console.log('cleanupExpiredTasks: brak zadań do sprawdzenia'); return; }

        const toArchive = [];
        const D14 = 14 * 24 * 3600 * 1000;
        const D60 = 60 * 24 * 3600 * 1000;
        const H48 = 48 * 3600 * 1000;

        snap.docs.forEach(doc => {
            const t = doc.data();
            if (t.dueDate) {
                // Format dueDate: 'YYYY-MM-DD' (tak samo jak w tasks.ts/isTaskOverdue)
                const dueMs = new Date(`${t.dueDate}T00:00:00`).getTime();
                if (!isNaN(dueMs) && (now.getTime() - dueMs) > H48) toArchive.push(doc.ref);
            } else {
                // Fallback dla zadań bez terminu — stara reguła (createdAt-based)
                const age = now.getTime() - new Date(t.createdAt || 0).getTime();
                const archive = (t.status === 'DONE' && age > D14) || (t.status === 'PENDING' && age > D60);
                if (archive) toArchive.push(doc.ref);
            }
        });

        if (toArchive.length === 0) { console.log('cleanupExpiredTasks: żadne zadanie nie przekroczyło progu'); return; }

        for (let i = 0; i < toArchive.length; i += 500) {
            const batch = db.batch();
            toArchive.slice(i, i + 500).forEach(ref => batch.update(ref, { status: 'DELETE' }));
            await batch.commit();
        }
        console.log(`cleanupExpiredTasks: zarchiwizowano ${toArchive.length} zadań`);
    } catch (e) { console.error('cleanupExpiredTasks error:', e); }
});

/* ═══════════════════════════════════════════════════════
   RevenueCat Webhook — obsługa subskrypcji indywidualnych
   POST /revenuecat-webhook
   Zdarzenia: INITIAL_PURCHASE, RENEWAL → ACTIVE
              CANCELLATION, EXPIRATION   → EXPIRED
═══════════════════════════════════════════════════════ */
exports.revenuecatWebhook = onRequest(
    { secrets: [REVENUECAT_WEBHOOK_SECRET] },
    async (req, res) => {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

        // Weryfikacja authorization header
        const authHeader = req.headers['authorization'] || '';
        const expected   = REVENUECAT_WEBHOOK_SECRET.value();
        if (!expected || authHeader !== expected) {
            console.warn('revenuecatWebhook: nieprawidłowy token autoryzacji');
            return res.status(401).send('Unauthorized');
        }

        const event = req.body?.event;
        if (!event) return res.status(400).send('Bad Request: brak pola event');

        const { type, app_user_id, expiration_at_ms, product_id, store } = event;
        if (!app_user_id) return res.status(400).send('Bad Request: brak app_user_id');

        console.log(`revenuecatWebhook: type=${type} user=${app_user_id}`);

        const ACTIVE_EVENTS  = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION'];
        const EXPIRED_EVENTS = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'];

        if (!ACTIVE_EVENTS.includes(type) && !EXPIRED_EVENTS.includes(type)) {
            // Zdarzenie ignorowane (np. TEST, TRANSFER itp.)
            console.log(`revenuecatWebhook: zdarzenie ${type} zignorowane`);
            return res.status(200).send('OK');
        }

        try {
            // Znajdź użytkownika po app_user_id (= userId w Coachay)
            const userSnap = await db.collection('users').doc(app_user_id).get();
            if (!userSnap.exists) {
                // Fallback — szukaj po polu userId jeśli nie ma dokumentu pod tym kluczem
                const byField = await db.collection('users')
                    .where('userId', '==', app_user_id).limit(1).get();
                if (byField.empty) {
                    console.warn(`revenuecatWebhook: user ${app_user_id} nie istnieje`);
                    return res.status(200).send('OK'); // 200 żeby RC nie retry'ował
                }
                await applyLicenseUpdate(byField.docs[0].ref, type, expiration_at_ms, product_id, store, ACTIVE_EVENTS);
            } else {
                await applyLicenseUpdate(userSnap.ref, type, expiration_at_ms, product_id, store, ACTIVE_EVENTS);
            }

            return res.status(200).send('OK');
        } catch (e) {
            console.error('revenuecatWebhook error:', e);
            return res.status(500).send('Internal Server Error');
        }
    }
);

async function applyLicenseUpdate(userRef, type, expiration_at_ms, product_id, store, ACTIVE_EVENTS) {
    const isActive = ACTIVE_EVENTS.includes(type);
    const updates = {
        'subscription.status':    isActive ? 'ACTIVE' : 'EXPIRED',
        'subscription.updatedAt': FieldValue.serverTimestamp(),
    };
    if (product_id) updates['subscription.productId'] = product_id;
    if (store)      updates['subscription.store']     = store;
    if (expiration_at_ms) {
        updates['subscription.expiresAt'] = new Date(expiration_at_ms);
    } else if (!isActive) {
        updates['subscription.expiresAt'] = FieldValue.serverTimestamp();
    }
    await userRef.update(updates);
    console.log(`revenuecatWebhook: user ${userRef.id} → subscription.status=${updates['subscription.status']}`);
}
