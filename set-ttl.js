/**
 * Ustawia TTL policy na kolekcji notifications (pole deleteAt)
 * Uruchom: node set-ttl.js
 */
const { execSync } = require('child_process');
const https = require('https');

const PROJECT_ID = 'coachay-5c3c9';

// Pobierz token z Firebase CLI
let token;
try {
    token = execSync('firebase --token "" auth:export /dev/null 2>&1 || firebase login --no-localhost 2>&1').toString().trim();
} catch (e) {}

// Pobierz token z pliku kredencjałów Firebase CLI
const os = require('os');
const fs = require('fs');
const path = require('path');

function getFirebaseToken() {
    const configPaths = [
        path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'firebase-tools', 'lib', 'auth.js'),
    ];
    for (const p of configPaths) {
        if (fs.existsSync(p)) {
            try {
                const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                const tokens = data.tokens || data.user?.tokens;
                if (tokens?.access_token) return tokens.access_token;
                if (tokens?.refresh_token) {
                    console.log('Znaleziono refresh_token, odświeżam...');
                    // OAuth refresh
                    return refreshToken(tokens.refresh_token);
                }
            } catch (e) {}
        }
    }
    return null;
}

function refreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
        const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8ywKVx3i2D3ehy2cd`;
        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                resolve(parsed.access_token);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function setTTL(accessToken) {
    // updateMask=ttlConfig bez ttlConfig w body — wyłącza TTL
    const body = JSON.stringify({ name: `projects/${PROJECT_ID}/databases/(default)/collectionGroups/notifications/fields/deleteAt` });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/notifications/fields/deleteAt?updateMask=ttlConfig`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                const parsed = JSON.parse(data);
                if (res.statusCode === 200) {
                    console.log('✅ TTL policy wyłączona! ttlConfig:', parsed.ttlConfig || 'brak (usunięte)');
                } else {
                    console.error('❌ Błąd:', JSON.stringify(parsed, null, 2));
                }
                resolve(parsed);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    console.log('Szukam tokenu Firebase CLI...');
    const tok = getFirebaseToken();
    const accessToken = tok instanceof Promise ? await tok : tok;

    if (!accessToken) {
        console.error('❌ Nie znaleziono tokenu. Uruchom najpierw: firebase login');
        process.exit(1);
    }
    console.log('✅ Token znaleziony, ustawiam TTL...');
    await setTTL(accessToken);
})();
