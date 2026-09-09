/**
 * fix_legacy_kibic.js — naprawia legacy memberships KIBIC bez clubId
 *
 * Uruchom z katalogu functions/:
 *   node fix_legacy_kibic.js
 *
 * Wymaga Application Default Credentials:
 *   firebase login (już masz)
 *   gcloud auth application-default login
 *   -- LUB --
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\sciezka\do\service-account.json
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'coachay-5c3c9' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

(async function fixLegacyKibic() {
    console.log('[fix-kibic] Start...');

    // 1. Znajdź wszystkie nie-demo KIBIC memberships
    const kibicSnap = await db.collection('memberships')
        .where('role', '==', 'KIBIC')
        .where('isDemo', '==', false)
        .get();

    const toFix = kibicSnap.docs.filter(d => !d.data().clubId);
    console.log('[fix-kibic] KIBIC memberships z clubId=null:', toFix.length);

    if (toFix.length === 0) {
        console.log('[fix-kibic] Nic do naprawy. Koniec.');
        process.exit(0);
    }

    let fixed = 0, skipped = 0;
    const authUpdates = {}; // authUid -> { userId, clubIds: Set }

    for (const doc of toFix) {
        const m = doc.data();
        let clubId = null;

        if (m.playerId) {
            // Resolve via RODZIC membership dla tego samego zawodnika
            const parentSnap = await db.collection('memberships')
                .where('playerId', '==', m.playerId)
                .where('role', '==', 'RODZIC')
                .limit(1).get();
            if (!parentSnap.empty) {
                clubId = parentSnap.docs[0].data().clubId || null;
            }

            // Fallback: szukaj przez teamId zawodnika
            if (!clubId && m.teamId) {
                const playerSnap = await db.collection('memberships')
                    .where('teamId', '==', m.teamId)
                    .where('role', '==', 'ZAWODNIK')
                    .limit(1).get();
                if (!playerSnap.empty) {
                    clubId = playerSnap.docs[0].data().clubId || null;
                }
            }
        }

        if (!clubId) {
            console.warn('[fix-kibic] SKIP — nie znaleziono clubId:', doc.id, '| userId:', m.userId, '| playerId:', m.playerId);
            skipped++;
            continue;
        }

        // Zaktualizuj membership
        await doc.ref.update({ clubId });
        console.log('[fix-kibic] membership zaktualizowany:', doc.id, '→ clubId:', clubId);

        // Zbierz authIndex updates
        if (m.userId) {
            const userDoc = await db.collection('users').doc(m.userId).get();
            if (userDoc.exists) {
                const authUid = userDoc.data().authUid;
                if (authUid) {
                    if (!authUpdates[authUid]) authUpdates[authUid] = { userId: m.userId, clubIds: new Set() };
                    authUpdates[authUid].clubIds.add(clubId);
                }
            }
        }

        fixed++;
    }

    // 3. Zaktualizuj authIndex (Admin SDK omija reguły — może pisać do cudzych dokumentów)
    for (const [authUid, data] of Object.entries(authUpdates)) {
        await db.collection('authIndex').doc(authUid).set(
            { userId: data.userId, clubIds: FieldValue.arrayUnion(...Array.from(data.clubIds)) },
            { merge: true }
        );
        console.log('[fix-kibic] authIndex zaktualizowany:', authUid, '→', Array.from(data.clubIds));
    }

    console.log(`\n[fix-kibic] GOTOWE. Naprawiono: ${fixed}, pominięto: ${skipped}`);
    process.exit(0);
})().catch(e => { console.error('[fix-kibic] BŁĄD:', e); process.exit(1); });
