const https = require('https');
const fs = require('fs');

async function fixTeamNames() {
    try {
        console.log('=== Naprawianie pól teamName w dru¿ynach ===');
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
        
        // 2. Popraw pola teamName w dru¿ynach w klubie
        console.log('2. Poprawianie pól teamName...');
        
        const clubId = 'club_20260401_1576695';
        const clubTeams = teams.filter(doc => {
            const fields = doc.fields || {};
            const teamClubId = fields.clubId?.stringValue;
            return teamClubId === clubId;
        });
        
        console.log(`Dru¿yny w klubie ${clubId}: ${clubTeams.length}`);
        
        // Nazwy dla dru¿yn
        const teamNames = {
            'team_20260401_3209500': 'Dru¿yna A',
            'team_20260401_3649395': 'Dru¿yna B', 
            'team_20260401_7035579': 'Dru¿yna C'
        };
        
        for (let i = 0; i < clubTeams.length; i++) {
            const team = clubTeams[i];
            const teamId = team.name.split('/').pop();
            const fields = team.fields || {};
            
            const teamName = teamNames[teamId] || `Dru¿yna ${i + 1}`;
            
            // Dodaj/zmieñ pole teamName (g³ówne pole u¿ywane w aplikacji)
            const updateData = {
                fields: {
                    teamName: { stringValue: teamName }
                }
            };
            
            const updateResponse = await httpsPatch(`${baseUrl}/teams/${teamId}?updateMask.fieldPaths=teamName`, updateData);
            
            if (updateResponse.statusCode === 200) {
                console.log(`${i + 1}. ${teamId} - ustawiono teamName: ${teamName}`);
            } else {
                console.log(`${i + 1}. ${teamId} - b³ad: ${updateResponse.statusCode}`);
                console.log('Response:', updateResponse.body);
            }
        }
        
        console.log('');
        console.log('=== Zakoñczono poprawianie teamName ===');
        
    } catch (error) {
        console.error('B³ad podczas poprawiania teamName:', error.message);
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

fixTeamNames();
