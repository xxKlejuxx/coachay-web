const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function checkTrainer() {
    try {
        const snap = await db.collection('trainers')
            .where('displayName', '==', 'Nadia Testowa')
            .get();
            
        if (snap.empty) {
            console.log('Nie znaleziono trenera o nazwie: Nadia Testowa');
        } else {
            console.log('Znaleziono trenera:');
            snap.docs.forEach(doc => {
                const data = doc.data();
                console.log(`ID: ${doc.id}`);
                console.log(`DisplayName: ${data.displayName}`);
                console.log(`Email: ${data.email}`);
                console.log(`Status: ${data.status}`);
                console.log(`Club ID: ${data.clubId}`);
                console.log(`User ID: ${data.userId}`);
                console.log('---');
            });
        }
    } catch (e) {
        console.error('Błąd podczas sprawdzania trenera:', e);
    }
}

checkTrainer();
