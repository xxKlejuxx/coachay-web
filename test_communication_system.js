const https = require('https');
const fs = require('fs');

// Konfiguracja projektu Firebase
const projectId = 'coachay-5c3c9';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// Funkcja do pobierania tokena
function getAuthToken() {
    const token = fs.readFileSync('C:/Users/rafal/.config/configstore/firebase-tools.json', 'utf8')
        .split('\n')
        .find(line => line.includes('access_token'))
        ?.split(':')[1]
        ?.trim();
    
    if (!token) {
        console.error('ERROR: Nie znaleziono tokena Firebase');
        process.exit(1);
    }
    
    return token;
}

// Funkcja do zapytań HTTPS
function httpsRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const postData = data ? JSON.stringify(data) : null;
        
        const req = https.request(url, {
            method,
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json',
                ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
            }
        }, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = {
                        statusCode: res.statusCode,
                        body: JSON.parse(responseData)
                    };
                    resolve(result);
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        body: responseData
                    });
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Funkcja do tworzenia powiadomienia
async function createNotification(notificationData) {
    try {
        const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        
        const notification = {
            notificationId,
            userId: notificationData.userId,
            teamId: notificationData.teamId || null,
            type: notificationData.type || 'INFO',
            priority: notificationData.priority || 'NORMAL',
            title: notificationData.title,
            body: notificationData.body,
            actionType: notificationData.actionType || null,
            referenceId: notificationData.referenceId || null,
            forPlayerId: notificationData.forPlayerId || null,
            isRead: false,
            createdAt: new Date().toISOString(),
            createdBy: notificationData.createdBy || 'system',
            isDemo: false
        };
        
        const response = await httpsRequest(`${baseUrl}/notifications/${notificationId}`, 'PATCH', {
            fields: {
                notificationId: { stringValue: notificationId },
                userId: { stringValue: notification.userId },
                teamId: notification.teamId ? { stringValue: notification.teamId } : { nullValue: null },
                type: { stringValue: notification.type },
                priority: { stringValue: notification.priority },
                title: { stringValue: notification.title },
                body: { stringValue: notification.body },
                actionType: notification.actionType ? { stringValue: notification.actionType } : { nullValue: null },
                referenceId: notification.referenceId ? { stringValue: notification.referenceId } : { nullValue: null },
                forPlayerId: notification.forPlayerId ? { stringValue: notification.forPlayerId } : { nullValue: null },
                isRead: { booleanValue: false },
                createdAt: { timestampValue: { seconds: Math.floor(Date.now() / 1000) } },
                createdBy: { stringValue: notification.createdBy },
                isDemo: { booleanValue: false }
            }
        });
        
        if (response.statusCode === 200) {
            console.log(`✅ Powiadomienie utworzone: ${notificationId}`);
            return notificationId;
        } else {
            console.error(`❌ Błąd tworzenia powiadomienia:`, response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ Błąd podczas tworzenia powiadomienia:', error.message);
        return null;
    }
}

// Funkcja do pobierania użytkowników
async function getUsers() {
    try {
        const response = await httpsRequest(`${baseUrl}/users`);
        if (response.statusCode === 200) {
            return response.body.documents || [];
        } else {
            console.error('❌ Błąd pobierania użytkowników:', response.body);
            return [];
        }
    } catch (error) {
        console.error('❌ Błąd podczas pobierania użytkowników:', error.message);
        return [];
    }
}

// Funkcja do pobierania drużyn
async function getTeams() {
    try {
        const response = await httpsRequest(`${baseUrl}/teams`);
        if (response.statusCode === 200) {
            return response.body.documents || [];
        } else {
            console.error('❌ Błąd pobierania drużyn:', response.body);
            return [];
        }
    } catch (error) {
        console.error('❌ Błąd podczas pobierania drużyn:', error.message);
        return [];
    }
}

// Funkcja do pobierania trenerów
async function getTrainers() {
    try {
        const response = await httpsRequest(`${baseUrl}/trainers`);
        if (response.statusCode === 200) {
            return response.body.documents || [];
        } else {
            console.error('❌ Błąd pobierania trenerów:', response.body);
            return [];
        }
    } catch (error) {
        console.error('❌ Błąd podczas pobierania trenerów:', error.message);
        return [];
    }
}

// Funkcja do pobierania zawodników
async function getPlayers() {
    try {
        const response = await httpsRequest(`${baseUrl}/players`);
        if (response.statusCode === 200) {
            return response.body.documents || [];
        } else {
            console.error('❌ Błąd pobierania zawodników:', response.body);
            return [];
        }
    } catch (error) {
        console.error('❌ Błąd podczas pobierania zawodników:', error.message);
        return [];
    }
}

// Funkcja do pobierania członkostw
async function getMemberships() {
    try {
        const response = await httpsRequest(`${baseUrl}/memberships`);
        if (response.statusCode === 200) {
            return response.body.documents || [];
        } else {
            console.error('❌ Błąd pobierania członkostw:', response.body);
            return [];
        }
    } catch (error) {
        console.error('❌ Błąd podczas pobierania członkostw:', error.message);
        return [];
    }
}

// Główna funkcja testowa
async function runTests() {
    console.log('🚀 Rozpoczynanie testów systemu komunikacji...');
    console.log('');
    
    // Pobierz dane testowe
    console.log('📊 Pobieranie danych testowych...');
    const users = await getUsers();
    const teams = await getTeams();
    const trainers = await getTrainers();
    const players = await getPlayers();
    const memberships = await getMemberships();
    
    console.log(`✅ Użytkownicy: ${users.length}`);
    console.log(`✅ Drużyny: ${teams.length}`);
    console.log(`✅ Trenerzy: ${trainers.length}`);
    console.log(`✅ Zawodnicy: ${players.length}`);
    console.log(`✅ Członkowstwa: ${memberships.length}`);
    console.log('');
    
    // Znajdź przykładowych użytkowników
    const exampleTrainer = trainers.find(t => t.fields?.userId?.stringValue);
    const examplePlayer = players.find(p => p.fields?.userAccountId?.stringValue);
    const exampleParent = users.find(u => u.fields?.uid?.stringValue && !trainers.find(t => t.fields?.userId?.stringValue === u.fields.uid.stringValue) && !players.find(p => p.fields?.userAccountId?.stringValue === u.fields.uid.stringValue));
    
    console.log('👥 Przykładowi użytkownicy:');
    if (exampleTrainer) {
        console.log(`   Trener: ${exampleTrainer.fields?.displayName?.stringValue || 'Brak nazwy'} (${exampleTrainer.fields?.userId?.stringValue})`);
    }
    if (examplePlayer) {
        console.log(`   Zawodnik: ${examplePlayer.fields?.name?.stringValue || 'Brak nazwy'} (${examplePlayer.fields?.userAccountId?.stringValue})`);
    }
    if (exampleParent) {
        console.log(`   Rodzic: ${exampleParent.fields?.displayName?.stringValue || 'Brak nazwy'} (${exampleParent.fields?.uid?.stringValue})`);
    }
    console.log('');
    
    // Test 1: Trener wysyła wiadomość do rodzica
    if (exampleTrainer && exampleParent) {
        console.log('📧 Test 1: Trener wysyła wiadomość do rodzica');
        await createNotification({
            userId: exampleParent.fields.uid.stringValue,
            type: 'MESSAGE',
            priority: 'NORMAL',
            title: 'Wiadomość od trenera',
            body: `Trener ${exampleTrainer.fields.displayName.stringValue} wysłał Ci nową wiadomość.`,
            actionType: 'MESSAGE',
            referenceId: 'test_msg_1',
            createdBy: exampleTrainer.fields.userId.stringValue
        });
        console.log('');
    }
    
    // Test 2: Rodzic odpowiada na wiadomość trenera
    if (exampleParent && exampleTrainer) {
        console.log('📧 Test 2: Rodzic odpowiada na wiadomość trenera');
        await createNotification({
            userId: exampleTrainer.fields.userId.stringValue,
            type: 'MESSAGE',
            priority: 'NORMAL',
            title: 'Odpowiedź od rodzica',
            body: `Rodzic ${exampleParent.fields.displayName.stringValue} odpowiedział na Twoją wiadomość.`,
            actionType: 'MESSAGE',
            referenceId: 'test_msg_2',
            createdBy: exampleParent.fields.uid.stringValue
        });
        console.log('');
    }
    
    // Test 3: Powiadomienie o zadaniu
    if (exampleTrainer) {
        console.log('📋 Test 3: Powiadomienie o zadaniu');
        await createNotification({
            userId: exampleTrainer.fields.userId.stringValue,
            type: 'TASK',
            priority: 'HIGH',
            title: 'Nowe zadanie',
            body: 'Masz nowe zadanie do wykonania w systemie.',
            actionType: 'TASK',
            referenceId: 'test_task_1',
            createdBy: 'system'
        });
        console.log('');
    }
    
    // Test 4: Powiadomienie o wydarzeniu
    if (examplePlayer && exampleParent) {
        console.log('📅 Test 4: Powiadomienie o wydarzeniu dla rodzica');
        await createNotification({
            userId: exampleParent.fields.uid.stringValue,
            type: 'EVENT',
            priority: 'NORMAL',
            title: 'Nowe wydarzenie',
            body: 'Zawodnik ma nowe wydarzenie w kalendarzu.',
            actionType: 'EVENT',
            referenceId: 'test_event_1',
            forPlayerId: examplePlayer.fields.playerId.stringValue,
            createdBy: 'system'
        });
        console.log('');
    }
    
    // Test 5: Powiadomienie o meczu
    if (examplePlayer && exampleParent) {
        console.log('⚽ Test 5: Powiadomienie o meczu dla rodzica');
        await createNotification({
            userId: exampleParent.fields.uid.stringValue,
            type: 'MATCH',
            priority: 'HIGH',
            title: 'Mecz zawodnika',
            body: 'Zawodnik ma zaplanowany mecz.',
            actionType: 'MATCH',
            referenceId: 'test_match_1',
            forPlayerId: examplePlayer.fields.playerId.stringValue,
            createdBy: 'system'
        });
        console.log('');
    }
    
    console.log('✅ Testy zakończone!');
}

// Uruchomienie testów
runTests().catch(error => {
    console.error('❌ Błąd podczas uruchamiania testów:', error.message);
    process.exit(1);
});
