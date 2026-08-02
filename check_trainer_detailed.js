const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function checkTrainerAndMemberships() {
    try {
        console.log('=== Sprawdzanie trenera "Nadia Testowa" ===');
        
        // Najpierw sprawdź trenera
        const trainerSnap = await db.collection('trainers')
            .where('displayName', '==', 'Nadia Testowa')
            .get();
            
        if (trainerSnap.empty) {
            console.log('❌ Nie znaleziono trenera o nazwie: Nadia Testowa');
            return;
        }
        
        console.log('✅ Znaleziono trenera:');
        const trainer = trainerSnap.docs[0].data();
        const trainerId = trainerSnap.docs[0].id;
        
        console.log('ID trenera:', trainerId);
        console.log('DisplayName:', trainer.displayName);
        console.log('Email:', trainer.email);
        console.log('Status:', trainer.status);
        console.log('Club ID:', trainer.clubId);
        console.log('User ID:', trainer.userId);
        console.log('Role:', trainer.role);
        console.log('Is Club Admin:', trainer.isClubAdmin);
        console.log('Team IDs:', trainer.teamIds);
        console.log('---');
        
        // Teraz sprawdź memberships
        console.log('=== Sprawdzanie memberships dla trenera ===');
        const membershipSnap = await db.collection('memberships')
            .where('userId', '==', trainer.userId || 'unknown')
            .get();
            
        if (membershipSnap.empty) {
            console.log('❌ Nie znaleziono żadnych memberships dla tego trenera');
        } else {
            console.log(`✅ Znaleziono ${membershipSnap.docs.length} memberships:`);
            membershipSnap.docs.forEach((doc, index) => {
                const membership = doc.data();
                console.log(`\n--- Membership ${index + 1} ---`);
                console.log('ID:', doc.id);
                console.log('Club ID:', membership.clubId);
                console.log('Team ID:', membership.teamId);
                console.log('Role:', membership.role);
                console.log('Status:', membership.status);
                console.log('Joined At:', membership.joinedAt);
                console.log('Added By:', membership.addedBy);
                
                if (membership.teamId) {
                    console.log('→ Ma przypisanie do drużyny');
                } else {
                    console.log('→ Przypisanie tylko do klubu (bez drużyny)');
                }
            });
        }
        
        console.log('=== Koniec sprawdzania ===');
        
    } catch (e) {
        console.error('Błąd podczas sprawdzania:', e);
    }
}

checkTrainerAndMemberships();
