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

const WHATSAPP_TOKEN_SECRET  = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID_SECRET = defineSecret('WHATSAPP_PHONE_ID');

initializeApp();
const db = getFirestore();

/* ─── helpers ──────────────────────────────────────── */

const TYPE_NAMES = { TRENING: 'Trening', MECZ: 'Mecz', WYJAZD: 'Wyjazd', INNE: 'Wydarzenie' };

function formatDatePL(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day  = d.toLocaleDateString('pl-PL', { weekday: 'short' });
    const date = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return { day, date };
}

function buildBodyText(event) {
    const typeName = TYPE_NAMES[event.type] || 'Wydarzenie';
    const { day, date } = formatDatePL(event.date);
    return `${typeName} · ${day} ${date}, ${event.timeFrom || ''}–${event.timeTo || ''} · ${event.location?.venueName || ''}`;
}

function buildNotifTitle(event, requiresAction, suffix = '') {
    const typeName = TYPE_NAMES[event.type] || 'Wydarzenie';
    const { day, date } = formatDatePL(event.date);
    const name = event.title || `${typeName} ${day} ${date}`;
    return suffix ? `${name} — ${suffix}` : name;
}

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
async function sendNotificationsForEvent(event, skipUserIds = []) {
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
        .where('status', 'in', ['active', 'grace', 'demo'])
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

    members.forEach(m => {
        if (!m.userId || !m.playerId) return;
        if (m.role === 'ZAWODNIK' && playerIds.includes(m.playerId)) {
            playerUserMap[m.playerId] = m.userId;
        }
        if (m.role === 'RODZIC' && playerIds.includes(m.playerId)) {
            if (!parentChildMap[m.userId]) parentChildMap[m.userId] = [];
            if (!parentChildMap[m.userId].includes(m.playerId)) parentChildMap[m.userId].push(m.playerId);
        }
    });

    // Pobierz aktywne absencje (do pominięcia)
    let activeAbsences = [];
    try {
        const absSnap = await db.collection('absences')
            .where('isActive', '==', true)
            .get();
        activeAbsences = absSnap.docs.map(d => d.data());
    } catch (e) {}

    const notifiedParents = new Set();
    let created = 0;

    for (const personId of invited) {
        // Pomiń jeśli długa nieobecność
        const hasAbsence = activeAbsences.some(a =>
            a.playerId === personId &&
            a.dateFrom <= event.date &&
            a.dateTo >= event.date &&
            a.isActive
        );
        if (hasAbsence) continue;

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
                        title: buildNotifTitle(event, requiresAction, requiresAction ? 'potwierdź obecność' : ''),
                        body: bodyText,
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

            // Powiadomienie dla rodzica
            for (const [parentId, childIds] of Object.entries(parentChildMap)) {
                if (!childIds.includes(personId)) continue;
                const notifKey = `${parentId}_${personId}`;
                if (notifiedParents.has(notifKey)) continue;
                if (skipUserIds.includes(parentId)) continue;
                notifiedParents.add(notifKey);

                const exists = await notifExists(parentId, eventId, personId);
                if (!exists) {
                    let childName = personId;
                    try {
                        const pd = await db.collection('players').doc(personId).get();
                        if (pd.exists) childName = pd.data().name || personId;
                    } catch (e) {}

                    await createNotification({
                        userId: parentId,
                        teamId: event.teamId,
                        type: requiresAction ? 'EVENT_ATTENDANCE' : 'EVENT_CREATED',
                        title: buildNotifTitle(event, requiresAction, requiresAction ? `potwierdź obecność (${childName})` : ''),
                        body: bodyText,
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
        } else {
            // Trener / inny user — twórca eventu nie dostaje powiadomienia o własnym evencie
            if (personId === event.createdBy) continue;
            if (!skipUserIds.includes(personId)) {
                const exists = await notifExists(personId, eventId);
                if (!exists) {
                    // Trenerzy dostają zawsze informacyjne — nie prosi się ich o potwierdzenie obecności
                    await createNotification({
                        userId: personId,
                        teamId: event.teamId,
                        type: 'EVENT_CREATED',
                        title: buildNotifTitle(event, false),
                        body: bodyText,
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
   TRIGGER 2: Nowy membership → powiadomienia o nadchodzących DRUZYNA eventach
   ═══════════════════════════════════════════════════ */
exports.onMembershipCreated = onDocumentCreated('memberships/{membershipId}', async (event) => {
    const m = event.data.data();
    if (!m || !m.userId) return;
    if (!['active', 'grace', 'demo'].includes(m.status)) return;

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
   TRIGGER: Nowe powiadomienie w Firestore -> push FCM
   Odpala sie dla kazdego dokumentu w notifications (event,
   message, task...) i wysyla realny push na zapisany token
   ----------------------------------------------------- */
exports.onNotificationCreated = onDocumentCreated('notifications/{notificationId}', async (event) => {
    const notif = event.data.data();
    if (!notif || !notif.userId) return;

    try {
        const userDoc = await db.collection('users').doc(notif.userId).get();
        const token = userDoc.exists ? userDoc.data().fcmToken : null;
        if (!token) return; // user nie ma zarejestrowanego urzadzenia (web albo appka bez zgody)

        await getMessaging().send({
            token,
            notification: {
                title: notif.title || 'Coachay',
                body: notif.body || ''
            },
            data: {
                referenceId: notif.referenceId || '',
                referenceType: notif.referenceType || '',
                notificationId: event.params.notificationId
            }
        });
        console.log(`FCM push wyslany do ${notif.userId}`);
    } catch (e) {
        if (e.code === 'messaging/registration-token-not-registered') {
            // Token niewazny (np. appka odinstalowana) -- wyczysc, zeby nie probowac ponownie
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
   3. clubs.createdAt + 90 dni jeszcze trwa → TRIAL
   4. Którykolwiek z powyższych w grace 7 dni → GRACE
   5. Nic → EXPIRED
═══════════════════════════════════════════════════════ */
exports.updateClubLicenseStatuses = onSchedule('every day 06:00', async () => {
    const now       = new Date();
    const GRACE_MS  = 7 * 86400 * 1000;
    const TRIAL_DAYS = 90;

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

            // 3. Trial: clubs.createdAt + 90 dni
            if (status === 'EXPIRED') {
                const createdAt = d.createdAt?.toDate ? d.createdAt.toDate()
                                : (d.createdAt ? new Date(d.createdAt) : null);
                if (createdAt && !isNaN(createdAt)) {
                    const trialEnd = new Date(createdAt.getTime() + TRIAL_DAYS * 86400 * 1000);
                    if (trialEnd > now) {
                        status = 'TRIAL'; source = 'trial'; statusExpiry = trialEnd;
                    } else if (trialEnd > new Date(now - GRACE_MS)) {
                        status = 'GRACE'; source = 'trial'; statusExpiry = trialEnd;
                    }
                }
            }

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

function makeLicenseNotifId() {
    return 'notif_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + Date.now().toString().slice(-7) + '_' + Math.floor(Math.random() * 1000);
}

async function sendLicenseNotification(userId, title, body, teamId) {
    const now = new Date();
    const notif = {
        notificationId: makeLicenseNotifId(),
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
            if (msg) {
                await sendLicenseNotification(ar.uid, 'Coachay — pakiet', msg, ar.club_id);
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

                    // System B
                    const odbiorcyB = new Set();
                    adminsSnap.docs.forEach(d => { if (d.data().userId) odbiorcyB.add(d.data().userId); });
                    trenerzySnap.docs.forEach(d => {
                        const m = d.data();
                        const st = (m.status || '').toLowerCase();
                        if (m.userId && (st === 'active' || st === 'grace')) odbiorcyB.add(m.userId);
                    });
                    for (const uid of odbiorcyB) {
                        await sendLicenseNotification(uid, 'Coachay — licencja klubowa', msgKlub, null);
                        sentB++;
                    }

                    // Etap 3 — osobiste ostrzeżenie dla każdego z aktywnym slotem klubowym
                    const msgSlot = licenseExpiryMessage(daysLeft, `Twój dostęp do Coachay przez pulę klubu "${clubLabel}"`, 'active');
                    if (msgSlot) {
                        for (const d of slotUsersSnap.docs) {
                            const m = d.data();
                            if (!m.userId) continue;
                            await sendLicenseNotification(m.userId, 'Coachay — dostęp przez pulę klubową', msgSlot, clubId);
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
                        if (!m.userId || m.role === 'ZAWODNIK') continue;
                        if (!(st === 'active' || st === 'grace')) continue;
                        if (juzMaP1.has(m.userId)) continue; // już objęty Etapem 1 (własna licencja ważniejsza niż trial)
                        await sendLicenseNotification(m.userId, 'Coachay — okres próbny', msgTrial, clubId);
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
   Cleanup powiadomień — co noc zmienia status na DELETE
   gdy deleteAt minął
═══════════════════════════════════════════════════════ */
exports.cleanupNotifications = onSchedule('every day 03:00', async () => {
    const now = new Date();
    console.log(`cleanupNotifications start: ${now.toISOString()}`);
    try {
        const snap = await db.collection('notifications')
            .where('status', '!=', 'DELETE')
            .where('deleteAt', '<=', now)
            .get();

        if (snap.empty) {
            console.log('cleanupNotifications: brak powiadomień do wyczyszczenia');
            return;
        }

        const batch = db.batch();
        snap.docs.forEach(doc => batch.update(doc.ref, { status: 'DELETE' }));
        await batch.commit();
        console.log(`cleanupNotifications: oznaczono ${snap.size} powiadomień jako DELETE`);
    } catch (e) {
        console.error('cleanupNotifications error:', e);
    }
});
