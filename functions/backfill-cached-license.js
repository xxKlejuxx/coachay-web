/**
 * backfill-cached-license.js
 * Jednorazowy skrypt backfill: uzupełnia cachedUserSubscription / cachedClubLicense / cachedFamilySlot
 * na wszystkich istniejących memberships.
 *
 * Uruchomienie (z katalogu functions/):
 *   node backfill-cached-license.js
 *
 * Wymaga: GOOGLE_APPLICATION_CREDENTIALS lub firebase-admin z domyślnymi credentialami.
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'coachay-5c3c9' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const BATCH_SIZE = 499;

async function writeBatches(updates) {
    const entries = Object.entries(updates);
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const chunk = entries.slice(i, i + BATCH_SIZE);
        const b = db.batch();
        for (const [refPath, data] of chunk) {
            b.update(db.doc(refPath), data);
        }
        await b.commit();
        console.log(`  ✓ batch ${i / BATCH_SIZE + 1}: ${chunk.length} zapisów`);
    }
}

async function main() {
    console.log('Backfill cachedLicense — start');

    // 1. Preload users (subscription)
    console.log('\n[1/5] Ładowanie users...');
    const usersSnap = await db.collection('users').get();
    const userSubs = {};
    for (const d of usersSnap.docs) {
        const sub = d.data().subscription;
        if (sub?.status) userSubs[d.id] = { status: sub.status, expiresAt: sub.expiresAt || null, productId: sub.productId || null };
    }
    console.log(`  ${Object.keys(userSubs).length} userów z subscription`);

    // 2. Preload clubs (license)
    console.log('[2/5] Ładowanie clubs...');
    const clubsSnap = await db.collection('clubs').get();
    const clubLics = {};
    for (const d of clubsSnap.docs) {
        const lic = d.data().license;
        const raw = lic?.valid_until ?? lic?.expiresAt;
        clubLics[d.id] = {
            validUntil: raw?.toDate ? raw.toDate() : (raw ? new Date(raw) : null),
            scope: lic?.scope || 'all',
        };
    }
    console.log(`  ${Object.keys(clubLics).length} klubów`);

    // 3. Preload access_rights (family)
    console.log('[3/5] Ładowanie access_rights (family)...');
    const arSnap = await db.collection('access_rights').where('source', '==', 'family_license').get();
    const familyAr = {}; // key: `${uid}_${clubId}`
    for (const d of arSnap.docs) {
        const ar = d.data();
        const raw = ar.valid_until;
        familyAr[`${ar.uid}_${ar.club_id}`] = {
            validUntil: raw?.toDate ? raw.toDate() : (raw ? new Date(raw) : null),
            slotsTotal: ar.slots_total || null,
            slotsUsed:  ar.slots_used  || null,
        };
    }
    console.log(`  ${Object.keys(familyAr).length} rekordów family access_rights`);

    // 4. Pobierz wszystkie memberships
    console.log('[4/5] Ładowanie memberships...');
    const memSnap = await db.collection('memberships').get();
    console.log(`  ${memSnap.size} memberships`);

    // 5. Oblicz updates
    console.log('[5/5] Obliczanie i zapis...');
    const updates = {};
    let skipped = 0;

    for (const doc of memSnap.docs) {
        const m = doc.data();
        const uid    = m.userId;
        const clubId = m.clubId;
        const role   = (m.role || '').toUpperCase();
        const path   = doc.ref.path;
        const fields = {};

        // cachedUserSubscription
        if (uid && userSubs[uid]) {
            fields.cachedUserSubscription = {
                ...userSubs[uid],
                updatedAt: FieldValue.serverTimestamp(),
            };
        }

        // cachedClubLicense
        if (clubId && clubLics[clubId]) {
            fields.cachedClubLicense = {
                ...clubLics[clubId],
                updatedAt: FieldValue.serverTimestamp(),
            };
        }

        // cachedFamilySlot (tylko KIBIC z familySlotParent)
        if (role === 'KIBIC' && m.familySlotParent && clubId) {
            const key = `${m.familySlotParent}_${clubId}`;
            if (familyAr[key]) {
                fields.cachedFamilySlot = {
                    ...familyAr[key],
                    updatedAt: FieldValue.serverTimestamp(),
                };
            }
        }

        if (Object.keys(fields).length === 0) { skipped++; continue; }
        updates[path] = fields;
    }

    console.log(`  Do zapisu: ${Object.keys(updates).length}, pominięto: ${skipped}`);
    await writeBatches(updates);

    console.log('\n✅ Backfill zakończony!');
    process.exit(0);
}

main().catch(e => { console.error('❌ Błąd:', e); process.exit(1); });
