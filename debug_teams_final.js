const https = require('https');
const fs = require('fs');

async function debugTeamsAgain() {
    try {
        console.log('=== Debugowanie listy dru¿yn (po dodaniu isActive) ===');
        console.log('');
        
        // Pobierz token z pliku konfiguracyjnego Firebase
        const token = fs.readFileSync('C:/Users/rafal/.config/configstore/firebase-tools.json', 'utf8')
            .split('\n')
            .find(line => line.includes('access_token'))
            ?.split(':')[1]
            ?.trim();
            
        if (!token) {
            console.log('ERROR: Nie znaleziono tokena w pliku konfiguracyjnym');
            return;
        }
        
        console.log('Token uzyskany:', token.substring(0, 20) + '...');
        console.log('');
        
        // Konfiguracja projektu
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
        
        // 1. Sprawd¿ wszystkie dru¿yny w klubie
        console.log('1. Sprawdzanie wszystkich dru¿yn w klubie...');
        const allTeamsResponse = await httpsGet(`${baseUrl}/teams`);
        
        if (allTeamsResponse.statusCode !== 200) {
            console.log('ERROR: Nie mo¿na pobraæ dru¿yn');
            return;
        }
        
        const allTeams = allTeamsResponse.body.documents || [];
        console.log(`Znaleziono ${allTeams.length} dru¿yn w bazie danych`);
        
        // 2. Filtruj dru¿yny po klubie i statusie isActive
        const clubId = 'club_20260401_1576695'; // Z poprzedniego sprawdzania
        const activeTeams = allTeams.filter(doc => {
            const fields = doc.fields || {};
            const teamClubId = fields.clubId?.stringValue;
            const isActive = fields.isActive?.booleanValue;
            return teamClubId === clubId && isActive === true;
        });
        
        console.log(`Aktywnych dru¿yn w klubie ${clubId}: ${activeTeams.length}`);
        
        if (activeTeams.length === 0) {
            console.log('Brak aktywnych dru¿yn w klubie!');
            console.log('');
            console.log('Wszystkie dru¿yny w klubie:');
            allTeams.filter(doc => {
                const fields = doc.fields || {};
                const teamClubId = fields.clubId?.stringValue;
                return teamClubId === clubId;
            }).forEach((doc, index) => {
                const fields = doc.fields || {};
                const teamId = doc.name.split('/').pop();
                const name = fields.name?.stringValue || 'Brak nazwy';
                const isActive = fields.isActive?.booleanValue;
                console.log(`${index + 1}. ${name} (${teamId}) - active: ${isActive}`);
            });
        } else {
            console.log('Aktywne dru¿yny:');
            activeTeams.forEach((doc, index) => {
                const fields = doc.fields || {};
                const teamId = doc.name.split('/').pop();
                const name = fields.name?.stringValue || 'Brak nazwy';
                const mainTrainerId = fields.mainTrainerId?.stringValue || 'Brak';
                console.log(`${index + 1}. ${name} (${teamId}) - mainTrainer: ${mainTrainerId}`);
            });
        }
        
        // 3. Sprawd¼ czy indeks dzia³a (symulacja zapytania)
        console.log('');
        console.log('2. Sprawdzanie indeksu...');
        
        // Zapytanie z wieloma polami (jak w aplikacji)
        const complexQueryUrl = `${baseUrl}/teams:runQuery`;
        const queryData = {
            structuredQuery: {
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            {
                                field: {
                                    fieldPath: 'clubId'
                                },
                                op: 'EQUAL',
                                value: {
                                    stringValue: clubId
                                }
                            },
                            {
                                field: {
                                    fieldPath: 'isActive'
                                },
                                op: 'EQUAL',
                                value: {
                                    booleanValue: true
                                }
                            }
                        ]
                    }
                },
                orderBy: [
                    {
                        field: {
                            fieldPath: 'name'
                        },
                        direction: 'ASCENDING'
                    }
                ]
            }
        };
        
        try {
            const queryResponse = await https.post(complexQueryUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(queryData)
            });
            
            if (queryResponse.statusCode === 200) {
                const queryResults = queryResponse.body || [];
                console.log(`Zapytanie zwróci³o ${queryResults.length || 0} wyników`);
                if (queryResults.length > 0) {
                    console.log('Indeks dzia³a poprawnie!');
                }
            } else {
                console.log(`B³ad zapytania: ${queryResponse.statusCode}`);
                console.log('Response:', queryResponse.body);
            }
        } catch (e) {
            console.log('B³d podczas testowania zapytania:', e.message);
        }
        
        console.log('');
        console.log('=== Koniec debugowania ===');
        
    } catch (error) {
        console.error('B³ad podczas debugowania:', error.message);
    }
}

debugTeamsAgain();
