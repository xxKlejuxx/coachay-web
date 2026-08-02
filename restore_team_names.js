const https = require('https');
const fs = require('fs');

async function restoreOriginalTeamNames() {
    try {
        console.log('=== Przywracanie oryginalnych nazw dru¿yn ===');
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
        function httpsPatch(url, data) {
            return new Promise((resolve, reject) => {
                const postData = JSON.stringify(data);
                const req = https.request(url, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
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
                req.write(postData);
                req.end();
            });
        }
        
        // 1. Pobierz wszystkie dru¿yny
        console.log('1. Pobieranie wszystkich dru¿yn...');
        const teamsResponse = await httpsGet(baseUrl + '/teams');
        
        if (teamsResponse.statusCode !== 200) {
            console.log('ERROR: Nie mo¿na pobraæ dru¿yn');
            return;
        }
        
        const teams = teamsResponse.body.documents || [];
        console.log(`Znaleziono ${teams.length} dru¿yn`);
        
        // 2. Usuñ moje nazwy z dru¿yn w klubie
        console.log('2. Usuwanie nazw z dru¿yn...');
        
        const clubId = 'club_20260401_1576695';
        const clubTeams = teams.filter(doc => {
            const fields = doc.fields || {};
            const teamClubId = fields.clubId?.stringValue;
            return teamClubId === clubId;
        });
        
        console.log(`Dru¿yny w klubie ${clubId}: ${clubTeams.length}`);
        
        for (let i = 0; i < clubTeams.length; i++) {
            const team = clubTeams[i];
            const teamId = team.name.split('/').pop();
            const fields = team.fields || {};
            
            // Sprawd¼ czy mam dodane pola name lub displayName
            const hasMyName = fields.name?.stringValue;
            const hasMyDisplayName = fields.displayName?.stringValue;
            
            if (!hasMyName && !hasMyDisplayName) {
                console.log(`${i + 1}. ${teamId} - brak moich nazw do usuniêcia`);
                continue;
            }
            
            // Usuñ pola name i displayName (zostaw tylko teamName je¿eli istnieje)
            const fieldsToRemove = [];
            if (hasMyName) fieldsToRemove.push('name');
            if (hasMyDisplayName) fieldsToRemove.push('displayName');
            
            const updateMask = fieldsToRemove.map(field => `updateMask.fieldPaths=${field}`).join('&');
            
            const updateResponse = await httpsPatch(`${baseUrl}/teams/${teamId}?${updateMask}`, {
                fields: {}
            });
            
            if (updateResponse.statusCode === 200) {
                console.log(`${i + 1}. ${teamId} - usuniêto pola: ${fieldsToRemove.join(', ')}`);
            } else {
                console.log(`${i + 1}. ${teamId} - b³ad: ${updateResponse.statusCode}`);
                console.log('Response:', updateResponse.body);
            }
        }
        
        console.log('');
        console.log('=== Zakoñczono usuwanie nazw ===');
        
    } catch (error) {
        console.error('B³ad podczas usuwania nazw:', error.message);
    }
}

// Funkcja pomocnicza do GET
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const token = fs.readFileSync('C:/Users/rafal/.config/configstore/firebase-tools.json', 'utf8')
            .split('\n')
            .find(line => line.includes('access_token'))
            ?.split(':')[1]
            ?.trim();
            
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

restoreOriginalTeamNames();
