/**
 * migrate-license-slots.js
 *
 * Jednorazowy skrypt migracji — ustawia pole `usedSlot` (0 lub 1) na
 * wszystkich memberships i przelicza `clubs.license.used` zgodnie z
 * nową architekturą licencji klubowych.
 *
 * Użycie:
 *   cd functions
 *   node migrate-license-slots.js           ← DRY RUN (tylko raport, brak zmian)
 *   DRY_RUN=false node migrate-license-slots.js  ← zapis do Firestore
 *
 * Wymaga: zalogowania przez Firebase CLI (`firebase login`) lub
 *         zmiennej środowiskowej GOOGLE_APPLICATION_CREDENTIALS.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fs                      = require('fs');
const path                    = require('path');

const DRY_RUN    = process.env.DRY_RUN !== 'false';
const PROJECT_ID = 'coachay-5c3c9';
const TRIAL_DAYS = 90;

const TRAINER_ROLES  = new Set(['TRENER', 'TRENER_GLOWNY', 'TRENER_POMOCNICZY']);
const EXCLUDE_ROLES  = new Set(['KIBIC', 'ZAWODNIK']);
const BLOCKED_STATUS = new Set(['BLOCKED', 'REMOVED']);

// Szuka serviceAccountKey.json w tym samym folderze
const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
    console.error('BŁĄD: brak pliku serviceAccountKey.json w folderze functions/');
    console.error('Pobierz go z: Firebase Console → Project Settings → Service accounts → Generate new private key');
    process.exit(1);
}
initializeApp({ credential: cert(require(keyPath)), projectId: PROJECT_ID });
const db = getFirestore();

/* ─── helpers ─────────────────────────────────────────────────────────── */

function getMembershipDate(m) {
    if (m.createdAt?.toDate) return m.createdAt.toDate();
    if (m.joinedAt)          return new Date(m.joinedAt);
    return null;
}

function isTrialExpired(earliestDate) {
    if (!earliestDate) return false; // brak daty → zakładamy że w trialu (bezpieczne)
    return Date.now() > earliestDate.getTime() + TRIAL_DAYS * 24 * 3600 * 1000;
}

/* ─── main ────────────────────────────────────────────────────────────── */

async function migrate() {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`MIGRATE LICENSE SLOTS — ${DRY_RUN ? 'DRY RUN (tylko raport)' : '⚠ ZAPIS DO FIRESTORE'}`);
    console.log(`${'═'.repeat(60)}\n`);

    // 1. Wszystkie kluby z licencją
    const clubsSnap = await db.collection('clubs')
        .where('license.total', '>', 0)
        .get();
    console.log(`Kluby z licencją: ${clubsSnap.size}\n`);

    // 2. Preload: users z aktywną własną subskrypcją (RevenueCat/WEB)
    const activeSubSnap = await db.collection('users')
        .where('subscription.status', '==', 'ACTIVE')
        .get();
    const usersWithOwnSub = new Set(activeSubSnap.docs.map(d => d.id));
    console.log(`Userzy z własną subskrypcją (ACTIVE): ${usersWithOwnSub.size}\n`);

    let totalMembershipUpdates = 0;
    let totalClubUpdates       = 0;
    const report               = [];

    for (const clubDoc of clubsSnap.docs) {
        const club   = clubDoc.data();
        const clubId = clubDoc.id;
        const scope  = (club.license?.scope || 'trainers_and_parents').toLowerCase();
        const total  = club.license?.total  || 0;
        const oldUsed = club.license?.used  || 0;

        // 3. Wszystkie memberships dla tego klubu
        const memSnap = await db.collection('memberships')
            .where('clubId', '==', clubId)
            .get();
        const allMems = memSnap.docs.map(d => ({ _id: d.id, _ref: d.ref, ...d.data() }));

        // 4. Znajdź najwcześniejszą datę membership per userId (na potrzeby trialu)
        const earliestDateByUser = {};
        for (const m of allMems) {
            if (!m.userId) continue;
            const d = getMembershipDate(m);
            if (!d) continue;
            if (!earliestDateByUser[m.userId] || d < earliestDateByUser[m.userId]) {
                earliestDateByUser[m.userId] = d;
            }
        }

        // 5. Wybierz kandydatów do usedSlot=1
        //    Reguły:
        //    - KIBIC, ZAWODNIK → wykluczone zawsze
        //    - BLOCKED/REMOVED → wykluczone
        //    - RODZIC jeśli scope=only_trainers → wykluczone
        //    - User z własną subskrypcją → wykluczone
        //    - RODZIC w trialu (< 90 dni) → wykluczone
        //    - TRENER: eligible od razu (bez trialu)
        //    - RODZIC: eligible po 90 dniach

        const candidates = []; // { m, eligibleAt } — data kiedy stał się eligible

        for (const m of allMems) {
            const role   = (m.role   || '').toUpperCase();
            const status = (m.status || '').toUpperCase();
            const userId = m.userId;

            if (!userId)                       continue;
            if (EXCLUDE_ROLES.has(role))       continue; // KIBIC, ZAWODNIK
            if (BLOCKED_STATUS.has(status))    continue; // BLOCKED, REMOVED
            if (usersWithOwnSub.has(userId))   continue; // własna subskrypcja

            const isTrainer = TRAINER_ROLES.has(role);
            const isParent  = role === 'RODZIC';

            if (!isTrainer && !isParent) continue; // nieznana rola → pomiń

            if (isParent && scope === 'trainers_only') continue; // klub tylko dla trenerów

            const earliest  = earliestDateByUser[userId] || null;

            if (isParent && !isTrialExpired(earliest)) continue; // RODZIC w trialu

            // Data eligible: trener → data dołączenia, rodzic → data końca trialu
            const mDate      = getMembershipDate(m) || new Date(0);
            const eligibleAt = isTrainer
                ? mDate
                : new Date((earliest?.getTime() || 0) + TRIAL_DAYS * 24 * 3600 * 1000);

            candidates.push({ m, role, isTrainer, isParent, eligibleAt });
        }

        // 6. Dedup po userId: jeden slot per człowiek
        //    Dla każdego userId zostawiamy NAJSTARSZY rekord (wg eligibleAt, potem createdAt)
        const byUser = {};
        for (const c of candidates) {
            const uid = c.m.userId;
            if (!byUser[uid]) {
                byUser[uid] = c;
            } else {
                // zostaw starszy (mniejszy eligibleAt)
                if (c.eligibleAt < byUser[uid].eligibleAt) byUser[uid] = c;
            }
        }
        const dedupedCandidates = Object.values(byUser);

        // 7. Sortowanie kolejki: trenerzy pierwsi (po eligibleAt), potem rodzice (po eligibleAt)
        const trainersQueue = dedupedCandidates.filter(c => c.isTrainer)
            .sort((a, b) => a.eligibleAt - b.eligibleAt);
        const parentsQueue  = dedupedCandidates.filter(c => c.isParent)
            .sort((a, b) => a.eligibleAt - b.eligibleAt);
        const queue = [...trainersQueue, ...parentsQueue];

        // 8. Przydziel sloty (max = total)
        const slotWinners = new Set(); // _id membership który dostaje usedSlot=1
        let   newUsed     = 0;
        for (const c of queue) {
            if (newUsed >= total) break;
            slotWinners.add(c.m._id);
            newUsed++;
        }

        // 9. Oblicz wymagane zmiany
        const membershipUpdates = [];
        for (const m of allMems) {
            const expectedSlot = slotWinners.has(m._id) ? 1 : 0;
            const currentSlot  = m.usedSlot ?? -1; // -1 = pole nie istnieje
            if (expectedSlot !== currentSlot) {
                membershipUpdates.push({ ref: m._ref, id: m._id, userId: m.userId,
                    role: m.role, status: m.status,
                    from: currentSlot, to: expectedSlot });
            }
        }
        const clubNeedsUpdate = oldUsed !== newUsed;

        // 10. Loguj
        console.log(`Club: ${clubId} (${club.clubName || club.name || '?'})`);
        console.log(`  scope=${scope}  total=${total}  used: ${oldUsed} → ${newUsed}  memberships=${allMems.length}  candidates=${queue.length}`);

        if (membershipUpdates.length === 0 && !clubNeedsUpdate) {
            console.log(`  ✓ brak zmian\n`);
        } else {
            for (const u of membershipUpdates) {
                const arrow = u.from === -1 ? `(nowe)→${u.to}` : `${u.from}→${u.to}`;
                console.log(`  ${u.to === 1 ? '↑ SLOT' : '↓ brak'} membership ${u.id}  userId=${u.userId}  role=${u.role}  status=${u.status}  usedSlot=${arrow}`);
            }
            if (clubNeedsUpdate) {
                console.log(`  ✎ clubs.license.used: ${oldUsed} → ${newUsed}`);
            }
            console.log('');
        }

        report.push({ clubId, oldUsed, newUsed, membershipUpdates, clubNeedsUpdate });
        totalMembershipUpdates += membershipUpdates.length;
        if (clubNeedsUpdate) totalClubUpdates++;

        // 11. Zapis (tylko jeśli nie DRY_RUN)
        if (!DRY_RUN && (membershipUpdates.length > 0 || clubNeedsUpdate)) {
            const BATCH_SIZE = 400;
            for (let i = 0; i < membershipUpdates.length; i += BATCH_SIZE) {
                const batch = db.batch();
                for (const u of membershipUpdates.slice(i, i + BATCH_SIZE)) {
                    batch.update(u.ref, { usedSlot: u.to });
                }
                if (i === 0 && clubNeedsUpdate) {
                    batch.update(clubDoc.ref, { 'license.used': newUsed });
                }
                await batch.commit();
            }
            // Jeśli nie było membership updates ale klub wymaga update
            if (membershipUpdates.length === 0 && clubNeedsUpdate) {
                await clubDoc.ref.update({ 'license.used': newUsed });
            }
        }
    }

    // Podsumowanie
    console.log(`${'─'.repeat(60)}`);
    console.log(`PODSUMOWANIE:`);
    console.log(`  Kluby do aktualizacji:      ${totalClubUpdates}`);
    console.log(`  Memberships do aktualizacji: ${totalMembershipUpdates}`);
    console.log(DRY_RUN
        ? `\n  ℹ DRY RUN — brak zmian w bazie.`
        : `\n  ✅ Zmiany zapisane do Firestore.`);
    console.log(`${'─'.repeat(60)}\n`);
}

migrate()
    .catch(err => { console.error('BŁĄD:', err); process.exit(1); })
    .finally(() => process.exit(0));
