/**
 * backfill-badge-counts.js
 * Jednorazowy skrypt: uzupełnia users/{userId}.badgeCounts dla wszystkich userów.
 *
 * Uruchomienie (z katalogu functions/):
 *   node backfill-badge-counts.js
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'coachay-5c3c9' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const BATCH_SIZE = 499;

async function main() {
    console.log('Backfill badgeCounts — start\n');

    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Wszyscy userzy
    console.log('[1/5] Ładowanie users...');
    const usersSnap = await db.collection('users').get();
    console.log(`  ${usersSnap.size} userów`);

    // 2. Memberships — grupuj po userId: { teamIds, playerIds }
    console.log('[2/5] Ładowanie memberships...');
    const memSnap = await db.collection('memberships').get();
    const userMem = {}; // userId -> { teamIds: Set, playerIds: Set }
    for (const d of memSnap.docs) {
        const m = d.data();
        if (!m.userId) continue;
        if (!userMem[m.userId]) userMem[m.userId] = { teamIds: new Set(), playerIds: new Set([m.userId]) };
        if (m.teamId)  userMem[m.userId].teamIds.add(m.teamId);
        if (m.playerId) userMem[m.userId].playerIds.add(m.playerId);
        if (Array.isArray(m.childrenIds)) m.childrenIds.forEach(id => userMem[m.userId].playerIds.add(id));
    }
    console.log(`  ${Object.keys(userMem).length} userów z memberships`);

    // 3. Eventy przyszłe (od dziś) — załaduj raz, pogrupuj po teamId
    console.log('[3/5] Ładowanie przyszłych eventów...');
    const evSnap = await db.collection('events').where('date', '>=', todayStr).get();
    const eventsByTeam = {}; // teamId -> ev[]
    for (const d of evSnap.docs) {
        const ev = { id: d.id, ...d.data() };
        if (!ev.teamId) continue;
        if (!eventsByTeam[ev.teamId]) eventsByTeam[ev.teamId] = [];
        eventsByTeam[ev.teamId].push(ev);
    }
    console.log(`  ${evSnap.size} eventów w ${Object.keys(eventsByTeam).length} teamach`);

    // 4. Zadania PENDING — pogrupuj po assignedTo (userId)
    console.log('[4/5] Ładowanie zadań PENDING...');
    const taskSnap = await db.collection('tasks').where('status', '==', 'PENDING').get();
    const tasksByUser = {}; // userId -> count
    for (const d of taskSnap.docs) {
        const t = d.data();
        for (const uid of (t.assignedTo || [])) {
            if ((t.completedBy || []).includes(uid)) continue;
            if ((t.rejectedBy  || []).includes(uid)) continue;
            tasksByUser[uid] = (tasksByUser[uid] || 0) + 1;
        }
    }
    console.log(`  ${taskSnap.size} zadań`);

    // 5. Nieprzeczytane wiadomości (notifications referenceType=message, isRead=false)
    console.log('[5/5] Ładowanie nieprzeczytanych wiadomości...');
    const msgSnap = await db.collection('notifications')
        .where('referenceType', '==', 'message')
        .where('isRead', '==', false)
        .get();
    const msgByUser = {}; // userId -> count
    for (const d of msgSnap.docs) {
        const n = d.data();
        if (!n.userId) continue;
        msgByUser[n.userId] = (msgByUser[n.userId] || 0) + 1;
    }
    console.log(`  ${msgSnap.size} nieprzeczytanych wiadomości\n`);

    // Oblicz badgeCounts dla każdego usera
    console.log('Obliczanie i zapis...');
    const updates = {};

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const mem = userMem[userId];
        const playerIds = mem ? [...mem.playerIds] : [userId];
        const teamIds   = mem ? [...mem.teamIds]   : [];

        // Eventy niepotwierdzone w oknie reminderHoursBefore
        let eventsCount = 0;
        for (const teamId of teamIds) {
            for (const ev of (eventsByTeam[teamId] || [])) {
                const rh = ev.reminderHoursBefore != null ? ev.reminderHoursBefore : 48;
                if (rh <= 0) continue;
                const evTime = new Date(ev.date + 'T' + (ev.timeFrom || '00:00')).getTime();
                if (evTime < now) continue;
                if (now < evTime - rh * 3600000) continue;
                const att = ev.attendance || {};
                const invited   = att.invited   || [];
                const confirmed = new Set(att.confirmed || []);
                const declined  = new Set(att.declined  || []);
                const isInvited = playerIds.some(pid => invited.includes(pid));
                const isDecided = playerIds.some(pid => confirmed.has(pid) || declined.has(pid));
                if (isInvited && !isDecided) eventsCount++;
            }
        }

        const badgeCounts = {
            events:   eventsCount,
            tasks:    tasksByUser[userId]  || 0,
            messages: msgByUser[userId]    || 0,
            updatedAt: FieldValue.serverTimestamp(),
        };

        updates[userDoc.ref.path] = { badgeCounts };
    }

    console.log(`  Do zapisu: ${Object.keys(updates).length} userów\n`);

    // Zapis w batchach
    const entries = Object.entries(updates);
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const chunk = entries.slice(i, i + BATCH_SIZE);
        const b = db.batch();
        for (const [path, data] of chunk) b.update(db.doc(path), data);
        await b.commit();
        console.log(`  ✓ batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} zapisów`);
    }

    console.log('\n✅ Backfill badgeCounts zakończony!');
    process.exit(0);
}

main().catch(e => { console.error('❌ Błąd:', e); process.exit(1); });
