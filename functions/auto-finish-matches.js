/* 
   TRIGGER 4: Automatyczne zakoñczenie meczy o pólnocy
   Codziennie o 00:00 zakancza mecze LIVE z dnia poprzedniego
*/
exports.autoFinishMatches = onSchedule('every day 00:00', async () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    
    console.log(`Pólnoc: sprawdzanie meczy z dnia ${yesterday} do automatycznego zakoñczenia`);
    
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
            console.log(`Auto-zakoñczono mecz ${doc.id}: ${our}:${opp} (${outcome})`);
            
            // Wyslij powiadomienie do trenera/asystenta
            const assistantId = matchData.liveAssistant?.userId;
            if (assistantId) {
                await createNotification({
                    userId: assistantId,
                    teamId: doc.data().teamId,
                    type: 'MATCH_AUTO_FINISHED',
                    title: 'Mecz automatycznie zakoñczony',
                    body: `Mecz z dnia ${yesterday} zosta³ automatycznie zakoñczony o pólnocy. Wynik: ${our}:${opp}`,
                    referenceId: doc.id,
                    referenceType: 'event'
                });
            }
        }
        
        console.log(`Zakoñczono ${finishedCount} meczy automatycznie`);
        
    } catch (e) {
        console.error('Blad autoFinishMatches:', e);
    }
});
