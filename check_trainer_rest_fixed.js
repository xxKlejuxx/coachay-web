const https = require('https');
const fs = require('fs');

async function checkTrainerViaREST() {
    try {
        console.log('=== Sprawdzanie trenera "Nadia Testowa" przez REST API ===');
        
        // Odczytaj token z pliku
        const token = fs.readFileSync('C:/Users/rafal/.config/configstore/firebase-tools.json', 'utf8')
            .split('\n')
            .find(line => line.includes('access_token'))
            ?.split(':')[1]
            ?.trim();
            
        if (!token) {
            console.log('❌ Nie znaleziono tokena w pliku konfiguracyjnym');
            return;
        }
        
        console.log('Token Firebase:', token.substring(0, 20) + '...');
        
        // Konfiguracja projektu
        const projectId = 'coachay-5c3c9';
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
        
        // Sprawdź trenera
        const trainerUrl = `${baseUrl}/trainers`;
        const trainerResponse = await https.get(trainerUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const trainerData = JSON.parse(trainerResponse.data);
        
        if (trainerData.documents && trainerData.documents.length > 0) {
            console.log('✅ Znaleziono trenera:');
            const trainer = trainerData.documents[0].fields;
            const trainerId = trainerData.documents[0].name.split('/').pop();
            
            console.log('ID trenera:', trainerId);
            console.log('DisplayName:', trainer.displayName?.stringValue);
            console.log('Email:', trainer.email?.stringValue);
            console.log('Status:', trainer.status?.stringValue);
            console.log('Club ID:', trainer.clubId?.stringValue);
            console.log('User ID:', trainer.userId?.stringValue);
            console.log('Role:', trainer.role?.stringValue);
            console.log('Is Club Admin:', trainer.isClubAdmin?.booleanValue);
            console.log('Team IDs:', trainer.teamIds?.arrayValue?.values || []);
            console.log('---');
            
            // Sprawdź memberships
            console.log('=== Sprawdzanie memberships dla trenera ===');
            const membershipUrl = `${baseUrl}/memberships`;
            const membershipResponse = await https.get(`${membershipUrl}?where=userId=="${trainer.userId?.stringValue}"`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const membershipData = JSON.parse(membershipResponse.data);
            
            if (membershipData.documents && membershipData.documents.length > 0) {
                console.log(`✅ Znaleziono ${membershipData.documents.length} memberships:`);
                membershipData.documents.forEach((doc, index) => {
                    const membership = doc.fields;
                    console.log(`\n--- Membership ${index + 1} ---`);
                    console.log('ID:', doc.name.split('/').pop());
                    console.log('Club ID:', membership.clubId?.stringValue);
                    console.log('Team ID:', membership.teamId?.stringValue);
                    console.log('Role:', membership.role?.stringValue);
                    console.log('Status:', membership.status?.stringValue);
                    console.log('Joined At:', membership.joinedAt?.timestampValue);
                    console.log('Added By:', membership.addedBy?.stringValue);
                    
                    if (membership.teamId?.stringValue) {
                        console.log('→ Ma przypisanie do drużyny:', membership.teamId?.stringValue);
                    } else {
                        console.log('→ Przypisanie tylko do klubu (bez drużyny)');
                    }
                });
            } else {
                console.log('❌ Nie znaleziono żadnych memberships dla tego trenera');
            }
            
        } else {
            console.log('❌ Nie znaleziono trenera o nazwie: Nadia Testowa');
        }
        
        console.log('=== Koniec sprawdzania ===');
        
    } catch (e) {
        console.error('Błąd podczas sprawdzania:', e.message);
    }
}

checkTrainerViaREST();
