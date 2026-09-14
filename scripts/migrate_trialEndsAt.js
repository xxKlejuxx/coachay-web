/**
 * Migracja: backfill pola trialEndsAt na istniejących membership
 *
 * Uruchomić w konsoli Firebase (F12) na stronie z uprawnieniami admin,
 * gdzie `db` jest dostępny globalnie (np. support.html lub ustawienia.html).
 *
 * Źródło: (membership.joinedAt ?? membership.createdAt) + 90 dni @ 23:55:00 UTC
 */
(async function migrateTrial() {
    let processed = 0, updated = 0, skipped = 0, errors = 0;

    const snapshot = await db.collection('memberships').get();
    console.log(`Znaleziono ${snapshot.size} membership — startuję migrację...`);

    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        processed++;
        const m = doc.data();

        // Już ma pole — pomijamy
        if (m.trialEndsAt) { skipped++; continue; }

        // Brak daty bazowej — pomijamy
        const baseRaw = m.joinedAt ?? m.createdAt;
        if (!baseRaw) { skipped++; console.warn(`Brak daty bazowej: ${doc.id}`); continue; }

        try {
            const baseDate = baseRaw.toDate?.() ?? new Date(baseRaw);
            const trialEnd = new Date(baseDate);
            trialEnd.setDate(trialEnd.getDate() + 90);
            trialEnd.setUTCHours(23, 55, 0, 0);

            batch.update(doc.ref, { trialEndsAt: trialEnd });
            batchCount++;
            updated++;

            // Firestore batch max 500 operacji
            if (batchCount >= 490) {
                await batch.commit();
                console.log(`  Batch committed (${updated} zaktualizowanych dotąd)...`);
                batch = db.batch();
                batchCount = 0;
            }
        } catch (e) {
            errors++;
            console.error(`Błąd dla ${doc.id}:`, e);
        }
    }

    if (batchCount > 0) await batch.commit();

    console.log(`\n✅ Migracja zakończona:`);
    console.log(`   Przetworzono: ${processed}`);
    console.log(`   Zaktualizowano: ${updated}`);
    console.log(`   Pominięto (już miały pole lub brak daty): ${skipped}`);
    console.log(`   Błędy: ${errors}`);
})();
