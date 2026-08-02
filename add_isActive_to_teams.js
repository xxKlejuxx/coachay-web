const https = require('https');
const fs = require('fs');

async function addIsActiveToTeams() {
    try {
        console.log('=== Dodawanie pola isActive do dru¿yn ===');
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
        
        // 2. Dodaj pole isActive do ka¿dej dru¿yny
        console.log('2. Dodawanie pola isActive...');
        
        for (let i = 0; i < teams.length; i++) {
            const team = teams[i];
            const teamId = team.name.split('/').pop();
            const fields = team.fields || {};
            
            // Sprawd¼ czy pole isActive ju¿ istnieje
            if (fields.isActive !== undefined) {
                console.log(`${i + 1}. ${teamId} - pole isActive ju¿ istnieje`);
                continue;
            }
            
            // Dodaj pole isActive = true
            const updateData = {
                fields: {
                    isActive: { booleanValue: true }
                }
            };
            
            const updateResponse = await httpsPatch(`${baseUrl}/teams/${teamId}?updateMask.fieldPaths=isActive`, updateData);
            
            if (updateResponse.statusCode === 200) {
                console.log(`${i + 1}. ${teamId} - dodano isActive: true`);
            } else {
                console.log(`${i + 1}. ${teamId} - b³ad: ${updateResponse.statusCode}`);
                console.log('Response:', updateResponse.body);
            }
        }
        
        console.log('');
        console.log('=== Zakoñczono dodawanie pola isActive ===');
        
    } catch (error) {
        console.error('B³ad podczas dodawania isActive:', error.message);
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

addIsActiveToTeams();
