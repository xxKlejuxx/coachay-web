// Cleanup duplikatów memberships trenerów
// Uruchom: node cleanup_memberships.js

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'coachay-5c3c9'
});

const db = admin.firestore();

async function run() {
    const teamsSnap = await db.collection('teams').get();
    console.log(`Drużyny: ${teamsSnap.size}`);

    for (const teamDoc of teamsSnap.docs) {
        const teamId = teamDoc.id;
        const teamName = teamDoc.data().teamName || teamId;
        const snap = await db.collection('memberships').where('teamId', '==', teamId).get();

        // Grupuj po userId, tylko trenerzy
        const byUser = {};
        snap.docs.forEach(d => {
            const m = d.data();
            if (!['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'TRENER'].includes(m.role)) return;
            if (!m.userId) return;
            if (!byUser[m.userId]) byUser[m.userId] = [];
            byUser[m.userId].push({ id: d.id, ref: d.ref, ...m });
        });

        for (const [userId, mbrs] of Object.entries(byUser)) {
            // Sortuj: ACTIVE przed REMOVED, TRENER_GLOWNY przed POMOCNICZY
            mbrs.sort((a, b) => {
                const aActive = ['ACTIVE', 'active'].includes(a.status) ? 1 : 0;
                const bActive = ['ACTIVE', 'active'].includes(b.status) ? 1 : 0;
                if (aActive !== bActive) return bActive - aActive;
                if (a.role === 'TRENER_GLOWNY' && b.role !== 'TRENER_GLOWNY') return -1;
                if (b.role === 'TRENER_GLOWNY' && a.role !== 'TRENER_GLOWNY') return 1;
                return 0;
            });

            const keep = mbrs[0];
            const dups = mbrs.slice(1);

            // Normalizuj status do ACTIVE
            if (['ACTIVE', 'active'].includes(keep.status) && keep.status !== 'ACTIVE') {
                await keep.ref.update({ status: 'ACTIVE' });
                console.log(`  ✓ [${teamName}] ${userId} → status: ACTIVE`);
            }

            // Usuń duplikaty
            for (const dup of dups) {
                await dup.ref.delete();
                console.log(`  ✗ [${teamName}] usunieto duplikat ${dup.id} (${dup.role} ${dup.status})`);
            }
        }
    }

    console.log('\n✅ Cleanup zakończony');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
