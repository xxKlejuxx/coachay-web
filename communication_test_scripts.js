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

// Funkcja do tworzenia wiadomości
async function createMessage(messageData) {
    try {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        
        const message = {
            messageId,
            teamId: messageData.teamId || null,
            senderId: messageData.senderId,
            senderName: messageData.senderName,
            recipientId: messageData.recipientId,
            recipientType: messageData.recipientType, // 'PLAYER', 'PARENT', 'TRAINER'
            content: messageData.content,
            type: messageData.type || 'TEXT',
            priority: messageData.priority || 'NORMAL',
            isRead: false,
            createdAt: new Date().toISOString(),
            isDemo: false
        };
        
        const response = await httpsRequest(`${baseUrl}/messages/${messageId}`, 'PATCH', {
            fields: {
                messageId: { stringValue: messageId },
                teamId: message.teamId ? { stringValue: message.teamId } : { nullValue: null },
                senderId: { stringValue: message.senderId },
                senderName: { stringValue: message.senderName },
                recipientId: { stringValue: message.recipientId },
                recipientType: { stringValue: message.recipientType },
                content: { stringValue: message.content },
                type: { stringValue: message.type },
                priority: { stringValue: message.priority },
                isRead: { booleanValue: false },
                createdAt: { timestampValue: { seconds: Math.floor(Date.now() / 1000) } },
                isDemo: { booleanValue: false }
            }
        });
        
        if (response.statusCode === 200) {
            console.log(`✅ Wiadomość utworzona: ${messageId}`);
            return messageId;
        } else {
            console.error(`❌ Błąd tworzenia wiadomości:`, response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ Błąd podczas tworzenia wiadomości:', error.message);
        return null;
    }
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

// Skrypt testowy dla trenera
async function trainerScript() {
    console.log('👨‍🏫 Skrypt testowy dla trenera');
    console.log('');
    
    // Pobierz dane
    const users = await getUsers();
    const teams = await getTeams();
    const trainers = await getTrainers();
    const players = await getPlayers();
    
    // Znajdź trenera testowego
    const trainer = trainers.find(t => t.fields?.userId?.stringValue);
    const parent = users.find(u => u.fields?.uid?.stringValue && !trainers.find(t => t.fields?.userId?.stringValue === u.fields.uid.stringValue) && !players.find(p => p.fields?.userAccountId?.stringValue === u.fields.uid.stringValue));
    const team = teams.find(t => t.fields?.teamId?.stringValue);
    
    if (!trainer) {
        console.error('❌ Nie znaleziono trenera testowego');
        return;
    }
    
    if (!parent) {
        console.error('❌ Nie znaleziono rodzica testowego');
        return;
    }
    
    const trainerId = trainer.fields.userId.stringValue;
    const parentId = parent.fields.uid.stringValue;
    const trainerName = trainer.fields.displayName.stringValue || 'Trener Testowy';
    const parentName = parent.fields.displayName.stringValue || 'Rodzic Testowy';
    const teamId = team?.fields?.teamId?.stringValue || 'test_team';
    
    console.log(`📋 Dane testowe:`);
    console.log(`   Trener: ${trainerName} (${trainerId})`);
    console.log(`   Rodzic: ${parentName} (${parentId})`);
    console.log(`   Drużyna: ${teamId}`);
    console.log('');
    
    // 1. Trener wysyła wiadomość do rodzica
    console.log('📧 1. Trener wysyła wiadomość do rodzica...');
    const messageId = await createMessage({
        teamId,
        senderId: trainerId,
        senderName: trainerName,
        recipientId: parentId,
        recipientType: 'PARENT',
        content: `Szanowny Rodzicu,\n\nChciałbym poinformować, że ${new Date().toLocaleDateString('pl-PL')} o godzinie ${new Date().toLocaleTimeString('pl-PL')} odbędzie się dodatkowy trening.\n\nProszę o potwierdzenie obecności.\n\nZ poważaniem,\n${trainerName}`,
        type: 'TEXT',
        priority: 'NORMAL'
    });
    
    if (messageId) {
        console.log('✅ Wiadomość wysłana pomyślnie');
    } else {
        console.error('❌ Błąd wysyłania wiadomości');
        return;
    }
    
    // 2. Powiadomienie dla rodzica o nowej wiadomości
    console.log('🔔 2. Tworzenie powiadomienia dla rodzica...');
    await createNotification({
        userId: parentId,
        teamId,
        type: 'MESSAGE',
        priority: 'NORMAL',
        title: 'Nowa wiadomość od trenera',
        body: `Otrzymałeś nową wiadomość od trenera ${trainerName}.`,
        actionType: 'MESSAGE',
        referenceId: messageId,
        createdBy: trainerId
    });
    
    console.log('✅ Powiadomienie utworzone');
    console.log('');
    
    // 3. Trener wysyła wiadomość do zawodnika
    const player = players.find(p => p.fields?.userAccountId?.stringValue);
    if (player) {
        console.log('📧 3. Trener wysyła wiadomość do zawodnika...');
        const playerId = player.fields.playerId.stringValue;
        const playerName = player.fields.name.stringValue || 'Zawodnik Testowy';
        
        const messageToPlayerId = await createMessage({
            teamId,
            senderId: trainerId,
            senderName: trainerName,
            recipientId: playerId,
            recipientType: 'PLAYER',
            content: `Cześć ${playerName},\n\nGratuluję dobrej gry na ostatnim meczu! Kolejny trening już w środę.\n\nDo zobaczenia!\n${trainerName}`,
            type: 'TEXT',
            priority: 'NORMAL'
        });
        
        if (messageToPlayerId) {
            console.log('✅ Wiadomość do zawodnika wysłana pomyślnie');
            
            // Powiadomienie dla zawodnika
            await createNotification({
                userId: player.fields.userAccountId.stringValue,
                teamId,
                type: 'MESSAGE',
                priority: 'NORMAL',
                title: 'Nowa wiadomość od trenera',
                body: `Otrzymałeś nową wiadomość od trenera ${trainerName}.`,
                actionType: 'MESSAGE',
                referenceId: messageToPlayerId,
                createdBy: trainerId
            });
            
            console.log('✅ Powiadomienie dla zawodnika utworzone');
        }
    }
    
    console.log('');
    console.log('✅ Skrypt trenera zakończony!');
}

// Skrypt testowy dla rodzica
async function parentScript() {
    console.log('👨‍👩‍👧‍👦 Skrypt testowy dla rodzica');
    console.log('');
    
    // Pobierz dane
    const users = await getUsers();
    const teams = await getTeams();
    const trainers = await getTrainers();
    const players = await getPlayers();
    
    // Znajdź rodzica i trenera
    const parent = users.find(u => u.fields?.uid?.stringValue && !trainers.find(t => t.fields?.userId?.stringValue === u.fields.uid.stringValue) && !players.find(p => p.fields?.userAccountId?.stringValue === u.fields.uid.stringValue));
    const trainer = trainers.find(t => t.fields?.userId?.stringValue);
    const team = teams.find(t => t.fields?.teamId?.stringValue);
    
    if (!parent) {
        console.error('❌ Nie znaleziono rodzica testowego');
        return;
    }
    
    if (!trainer) {
        console.error('❌ Nie znaleziono trenera testowego');
        return;
    }
    
    const parentId = parent.fields.uid.stringValue;
    const trainerId = trainer.fields.userId.stringValue;
    const parentName = parent.fields.displayName.stringValue || 'Rodzic Testowy';
    const trainerName = trainer.fields.displayName.stringValue || 'Trener Testowy';
    const teamId = team?.fields?.teamId?.stringValue || 'test_team';
    
    console.log(`📋 Dane testowe:`);
    console.log(`   Rodzic: ${parentName} (${parentId})`);
    console.log(`   Trener: ${trainerName} (${trainerId})`);
    console.log(`   Drużyna: ${teamId}`);
    console.log('');
    
    // 1. Rodzic odpowiada na wiadomość trenera
    console.log('📧 1. Rodzic odpowiada na wiadomość trenera...');
    const messageId = await createMessage({
        teamId,
        senderId: parentId,
        senderName: parentName,
        recipientId: trainerId,
        recipientType: 'TRAINER',
        content: `Szanowny Panie Trenerze,\n\nDziękuję za informację. ${new Date().toLocaleDateString('pl-PL')} o godzinie ${new Date().toLocaleTimeString('pl-PL')} potwierdzam obecność mojego dziecka na dodatkowym treningu.\n\nZ pozdrowieniami,\n${parentName}`,
        type: 'TEXT',
        priority: 'NORMAL'
    });
    
    if (messageId) {
        console.log('✅ Wiadomość wysłana pomyślnie');
    } else {
        console.error('❌ Błąd wysyłania wiadomości');
        return;
    }
    
    // 2. Powiadomienie dla trenera o odpowiedzi rodzica
    console.log('🔔 2. Tworzenie powiadomienia dla trenera...');
    await createNotification({
        userId: trainerId,
        teamId,
        type: 'MESSAGE',
        priority: 'NORMAL',
        title: 'Odpowiedź od rodzica',
        body: `Otrzymałeś odpowiedź od rodzica ${parentName}.`,
        actionType: 'MESSAGE',
        referenceId: messageId,
        createdBy: parentId
    });
    
    console.log('✅ Powiadomienie utworzone');
    console.log('');
    
    // 3. Rodzic wysyła wiadomość do trenera z pytaniem
    console.log('📧 3. Rodzic wysyła wiadomość z pytaniem...');
    const questionMessageId = await createMessage({
        teamId,
        senderId: parentId,
        senderName: parentName,
        recipientId: trainerId,
        recipientType: 'TRAINER',
        content: `Szanowny Panie Trenerze,\n\nMam pytanie dotyczące najbliższego meczu. Czy zawodnicy powinni zabrać ze sobą dodatkowy sprzęt?\n\nZ góry dziękuję za odpowiedź.\n${parentName}`,
        type: 'TEXT',
        priority: 'HIGH'
    });
    
    if (questionMessageId) {
        console.log('✅ Wiadomość z pytaniem wysłana pomyślnie');
        
        // Powiadomienie o wiadomości z wysokim priorytetem
        await createNotification({
            userId: trainerId,
            teamId,
            type: 'MESSAGE',
            priority: 'HIGH',
            title: 'Pytanie od rodzica',
            body: `Otrzymałeś pytanie od rodzica ${parentName} (wysoki priorytet).`,
            actionType: 'MESSAGE',
            referenceId: questionMessageId,
            createdBy: parentId
        });
        
        console.log('✅ Powiadomienie o pytaniu utworzone');
    }
    
    console.log('');
    console.log('✅ Skrypt rodzica zakończony!');
}

// Skrypt hybrydowy - test komunikacji dwukierunkowej
async function hybridScript() {
    console.log('🔄 Skrypt hybrydowy - test komunikacji dwukierunkowej');
    console.log('');
    
    // Pobierz dane
    const users = await getUsers();
    const teams = await getTeams();
    const trainers = await getTrainers();
    const players = await getPlayers();
    
    // Znajdź użytkowników
    const trainer = trainers.find(t => t.fields?.userId?.stringValue);
    const parent = users.find(u => u.fields?.uid?.stringValue && !trainers.find(t => t.fields?.userId?.stringValue === u.fields.uid.stringValue) && !players.find(p => p.fields?.userAccountId?.stringValue === u.fields.uid.stringValue));
    const team = teams.find(t => t.fields?.teamId?.stringValue);
    
    if (!trainer || !parent) {
        console.error('❌ Nie znaleziono użytkowników testowych');
        return;
    }
    
    const trainerId = trainer.fields.userId.stringValue;
    const parentId = parent.fields.uid.stringValue;
    const trainerName = trainer.fields.displayName.stringValue || 'Trener Testowy';
    const parentName = parent.fields.displayName.stringValue || 'Rodzic Testowy';
    const teamId = team?.fields?.teamId?.stringValue || 'test_team';
    
    console.log(`📋 Dane testowe:`);
    console.log(`   Trener: ${trainerName} (${trainerId})`);
    console.log(`   Rodzic: ${parentName} (${parentId})`);
    console.log(`   Drużyna: ${teamId}`);
    console.log('');
    
    // 1. Trener wysyła wiadomość z prośbą o informację
    console.log('📧 1. Trener wysyła wiadomość z prośbą...');
    const requestMessageId = await createMessage({
        teamId,
        senderId: trainerId,
        senderName: trainerName,
        recipientId: parentId,
        recipientType: 'PARENT',
        content: `Szanowny Rodzicu,\n\nProszę o informację, czy Twoje dziecko ma jakieś ograniczenia zdrowotne na najbliższy trening.\n\nPozdrawiam,\n${trainerName}`,
        type: 'TEXT',
        priority: 'NORMAL'
    });
    
    if (requestMessageId) {
        console.log('✅ Wiadomość z prośbą wysłana pomyślnie');
        
        // Powiadomienie dla rodzica
        await createNotification({
            userId: parentId,
            teamId,
            type: 'MESSAGE',
            priority: 'NORMAL',
            title: 'Prośba od trenera',
            body: `Trener ${trainerName} prosi o informację dotyczącą Twojego dziecka.`,
            actionType: 'MESSAGE',
            referenceId: requestMessageId,
            createdBy: trainerId
        });
        
        console.log('✅ Powiadomienie o prośbie utworzone');
    }
    
    // Poczekaj chwilę (symulacja czasu)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Rodzic odpowiada z informacją
    console.log('📧 2. Rodzic odpowiada z informacją...');
    const responseMessageId = await createMessage({
        teamId,
        senderId: parentId,
        senderName: parentName,
        recipientId: trainerId,
        recipientType: 'TRAINER',
        content: `Szanowny Panie Trenerze,\n\nDziękuję za wiadomość. Moje dziecko jest w pełni zdrowe i może uczestniczyć w najbliższym treningu bez żadnych ograniczeń.\n\nPozdrawiam,\n${parentName}`,
        type: 'TEXT',
        priority: 'NORMAL'
    });
    
    if (responseMessageId) {
        console.log('✅ Wiadomość z odpowiedzią wysłana pomyślnie');
        
        // Powiadomienie dla trenera
        await createNotification({
            userId: trainerId,
            teamId,
            type: 'MESSAGE',
            priority: 'NORMAL',
            title: 'Odpowiedź od rodzica',
            body: `Otrzymałeś odpowiedź od rodzica ${parentName} na swoją prośbę.`,
            actionType: 'MESSAGE',
            referenceId: responseMessageId,
            createdBy: parentId
        });
        
        console.log('✅ Powiadomienie o odpowiedzi utworzone');
    }
    
    // Poczekaj chwilę (symulacja czasu)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Trener potwierdza otrzymanie informacji
    console.log('📧 3. Trener potwierdza otrzymanie informacji...');
    const confirmationMessageId = await createMessage({
        teamId,
        senderId: trainerId,
        senderName: trainerName,
        recipientId: parentId,
        recipientType: 'PARENT',
        content: `Szanowny Rodzicu,\n\nDziękuję za szybką odpowiedź. Bardzo się cieszę, że Twoje dziecko będzie mogło uczestniczyć w treningu.\n\nDo zobaczenia na treningu!\n${trainerName}`,
        type: 'TEXT',
        priority: 'LOW'
    });
    
    if (confirmationMessageId) {
        console.log('✅ Wiadomość z potwierdzeniem wysłana pomyślnie');
        
        // Powiadomienie dla rodzica
        await createNotification({
            userId: parentId,
            teamId,
            type: 'MESSAGE',
            priority: 'LOW',
            title: 'Potwierdzenie od trenera',
            body: `Trener ${trainerName} potwierdza otrzymanie Twojej odpowiedzi.`,
            actionType: 'MESSAGE',
            referenceId: confirmationMessageId,
            createdBy: trainerId
        });
        
        console.log('✅ Powiadomienie o potwierdzeniu utworzone');
    }
    
    console.log('');
    console.log('✅ Skrypt hybrydowy zakończony!');
}

// Menu wyboru skryptu
function showMenu() {
    console.log('🚀 System testowy komunikacji Coachay');
    console.log('');
    console.log('Wybierz skrypt do uruchomienia:');
    console.log('1. Skrypt dla trenera - wysyłanie wiadomości');
    console.log('2. Skrypt dla rodzica - odpowiadanie na wiadomości');
    console.log('3. Skrypt hybrydowy - komunikacja dwukierunkowa');
    console.log('4. Uruchom wszystkie skrypty');
    console.log('5. Wyjście');
    console.log('');
}

// Główna funkcja
async function main() {
    showMenu();
    
    // W trybie automatycznym można przekazać argument
    const args = process.argv.slice(2);
    let choice = args[0] || null;
    
    if (!choice) {
        // Interaktywny wybór
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('Wybierz opcję (1-5): ', (answer) => {
            choice = answer.trim();
            rl.close();
            executeScript(choice);
        });
    } else {
        executeScript(choice);
    }
}

// Wykonanie wybranego skryptu
async function executeScript(choice) {
    switch (choice) {
        case '1':
            await trainerScript();
            break;
        case '2':
            await parentScript();
            break;
        case '3':
            await hybridScript();
            break;
        case '4':
            await trainerScript();
            console.log('');
            await parentScript();
            console.log('');
            await hybridScript();
            break;
        case '5':
            console.log('👋 Do widzenia!');
            process.exit(0);
        default:
            console.error('❌ Nieprawidłowy wybór. Wybierz 1-5.');
            process.exit(1);
    }
}

// Uruchomienie
main().catch(error => {
    console.error('❌ Błąd podczas uruchamiania skryptu:', error.message);
    process.exit(1);
});
