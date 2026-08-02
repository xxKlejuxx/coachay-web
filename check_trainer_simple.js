const https = require('https');
const fs = require('fs');

async function checkTrainer() {
    try {
        console.log('=== Sprawdzanie trenera "Nadia Testowa" w Firebase ===');
        console.log('');
        
        // Pobierz token z pliku konfiguracyjnego Firebase
        const configPath = 'C:/Users/rafal/.config/configstore/firebase-tools.json';
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const token = config.tokens.access_token;
        
        if (!token) {
            console.log('ERROR: Nie znaleziono tokena w pliku konfiguracyjnym');
            console.log('Uruchom: firebase login');
            return;
        }
        
        console.log('Token uzyskany:', token.substring(0, 20) + '...');
        console.log('');
        
        // Konfiguracja
        const projectId = 'coachay-5c3c9';
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
        
        // Funkcja do zapyta HTTPS
        function httpsGet(url) {
            return new Promise((resolve, reject) => {
                const req = https.get(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const result = {
                                statusCode: res.statusCode,
                                body: JSON.parse(data)
                            };
                            resolve(result);
                        } catch (e) {
                            resolve({
                                statusCode: res.statusCode,
                                body: data
                            });
                        }
                    });
                });
                
                req.on('error', reject);
                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
        }
        
        // Sprawdzenie trenera
        console.log('1. Sprawdzanie trenera...');
        const trainerResponse = await httpsGet(`${baseUrl}/trainers`);
        
        if (trainerResponse.statusCode !== 200) {
            console.log('ERROR: Baza danych nie jest dostepna');
            console.log('Status:', trainerResponse.statusCode);
            return;
        }
        
        // Znajd trenera "Nadia Testowa"
        const trainers = trainerResponse.body.documents || [];
        const nadiaTrainer = trainers.find(doc => {
            const fields = doc.fields || {};
            return fields.displayName?.stringValue === 'Nadia Testowa';
        });
        
        if (!nadiaTrainer) {
            console.log('ERROR: Nie znaleziono trenera "Nadia Testowa"');
            console.log('Dostepni trenerzy:');
            trainers.forEach(doc => {
                const fields = doc.fields || {};
                const name = fields.displayName?.stringValue || 'Brak nazwy';
                console.log(`- ${name}`);
            });
            return;
        }
        
        console.log('SUCCESS: Znaleziono trenera');
        const trainerId = nadiaTrainer.name.split('/').pop();
        const trainerFields = nadiaTrainer.fields || {};
        
        console.log('');
        console.log('DANE TRENERA:');
        console.log('ID:', trainerId);
        console.log('DisplayName:', trainerFields.displayName?.stringValue || 'Brak');
        console.log('Email:', trainerFields.email?.stringValue || 'Brak');
        console.log('Status:', trainerFields.status?.stringValue || 'Brak');
        console.log('Club ID:', trainerFields.clubId?.stringValue || 'Brak');
        console.log('User ID:', trainerFields.userId?.stringValue || 'Brak');
        console.log('Role:', trainerFields.role?.stringValue || 'Brak');
        console.log('Is Club Admin:', trainerFields.isClubAdmin?.booleanValue || false);
        console.log('Team IDs:', JSON.stringify(trainerFields.teamIds?.arrayValue?.values || []));
        
        const userId = trainerFields.userId?.stringValue;
        if (!userId || userId === 'null') {
            console.log('');
            console.log('WARNING: Trener nie ma userId - nie ma konta');
            console.log('To wyjaania dlaczego nie ma przycisku "Odepnij od tej druyny"');
            return;
        }
        
        // Sprawdzenie memberships
        console.log('');
        console.log('2. Sprawdzanie memberships...');
        const membershipResponse = await httpsGet(`${baseUrl}/memberships?where=userId=="${userId}"`);
        
        if (membershipResponse.statusCode !== 200) {
            console.log('ERROR: Nie mozna sprawdzic memberships');
            return;
        }
        
        const memberships = membershipResponse.body.documents || [];
        console.log('SUCCESS: Znaleziono', memberships.length, 'memberships');
        
        if (memberships.length === 0) {
            console.log('WARNING: Trener nie ma zadnych memberships');
            console.log('To wyjasania dlaczego nie ma przycisku "Odepnij od tej druyny"');
        } else {
            memberships.forEach((doc, index) => {
                const fields = doc.fields || {};
                console.log('');
                console.log(`--- Membership ${index + 1} ---`);
                console.log('ID:', doc.name.split('/').pop());
                console.log('Club ID:', fields.clubId?.stringValue || 'Brak');
                console.log('Team ID:', fields.teamId?.stringValue || 'Brak');
                console.log('Role:', fields.role?.stringValue || 'Brak');
                console.log('Status:', fields.status?.stringValue || 'Brak');
                console.log('Joined At:', fields.joinedAt?.timestampValue || 'Brak');
                console.log('Added By:', fields.addedBy?.stringValue || 'Brak');
                
                const teamId = fields.teamId?.stringValue;
                if (teamId && teamId !== 'null') {
                    console.log('-> Ma przypisanie do druyny:', teamId);
                } else {
                    console.log('-> Przypisanie tylko do klubu (bez druyny)');
                }
            });
        }
        
        console.log('');
        console.log('=== KONIEC ANALIZY ===');
        console.log('');
        console.log('WNIOSEK:');
        if (!userId || userId === 'null') {
            console.log('Trener "Nadia Testowa" nie ma konta (brak userId)');
            console.log('Dlatego nie ma przycisku "Odepnij od tej druyny"');
        } else {
            console.log('Trener ma konto, ale moze nie byc przypisany do zadnej druyny');
            console.log('Lub currentTeamId jest puste w aplikacji');
        }
        
    } catch (error) {
        console.log('ERROR:', error.message);
    }
}

checkTrainer();
