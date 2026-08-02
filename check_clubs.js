const fs = require('fs');
const https = require('https');

// Firebase config z CLAUDE_NOTES.md
const cfg = JSON.parse(fs.readFileSync('C:/Users/rafal/.config/configstore/firebase-tools.json'));
const ACCESS_TOKEN = cfg.tokens.access_token;
const PROJECT = 'coachay-5c3c9';
const BASE = `/v1/projects/${PROJECT}/databases/(default)/documents`;

function httpsRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'firestore.googleapis.com', 
            path, 
            method,
            headers: { 
                'Authorization': `Bearer ${ACCESS_TOKEN}`, 
                'Content-Type': 'application/json' 
            }
        }, res => {
            let d = ''; 
            res.on('data', x => d += x);
            res.on('end', () => { 
                try { 
                    resolve({ status: res.statusCode, body: JSON.parse(d) }); 
                } catch(e) { 
                    resolve({ status: res.statusCode, body: d }); 
                } 
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function toValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean')        return { booleanValue: v };
    if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return { timestampValue: v };
        return { stringValue: v };
    }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
    if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
    return { stringValue: String(v) };
}

function toFields(obj) { 
    const f = {}; 
    for (const [k,v] of Object.entries(obj)) f[k] = toValue(v); 
    return f; 
}

function fromValue(v) {
    if (!v) return null;
    if ('nullValue'      in v) return null;
    if ('booleanValue'   in v) return v.booleanValue;
    if ('integerValue'   in v) return Number(v.integerValue);
    if ('doubleValue'    in v) return v.doubleValue;
    if ('stringValue'    in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue'       in v) return fromFields(v.mapValue.fields || {});
    return null;
}

function fromFields(fields) { 
    const o = {}; 
    for (const [k,v] of Object.entries(fields)) o[k] = fromValue(v); 
    return o; 
}

function docToObj(doc) { 
    return { id: doc.name.split('/').pop(), ...fromFields(doc.fields || {}) }; 
}

async function listAll(collection) {
    const items = []; 
    let pt = null;
    do {
        const res = await httpsRequest('GET', `${BASE}/${collection}?pageSize=300${pt ? '&pageToken='+pt : ''}`);
        (res.body.documents || []).forEach(d => items.push(docToObj(d)));
        pt = res.body.nextPageToken || null;
    } while (pt);
    return items;
}

async function main() {
    console.log('Sprawdzam kolekcje w Firebase...');
    
    try {
        // Sprawdzenie czy kolekcja clubs istnieje
        const res = await httpsRequest('POST',
            `/v1/projects/${PROJECT}/databases/(default)/documents:listCollectionIds`, {}
        );
        
        console.log('Status odpowiedzi:', res.status);
        console.log('Cialo odpowiedzi:', JSON.stringify(res.body, null, 2));
        
        if (res.status === 200 && res.body && res.body.collectionIds) {
            console.log('Dostepne kolekcje:', res.body.collectionIds);
            
            if (res.body.collectionIds.includes('clubs')) {
                console.log('Kolekcja clubs istnieje!');
                
                // Pobierz kluby
                const clubs = await listAll('clubs');
                console.log(`\nZnaleziono ${clubs.length} klubów:`);
                clubs.forEach(club => {
                    console.log(`- ${club.name} (${club.id})`);
                });
                
                // Pobierz druyny
                const teams = await listAll('teams');
                console.log(`\nZnaleziono ${teams.length} druzyn:`);
                teams.forEach(team => {
                    console.log(`- ${team.teamName || team.name} (${team.id}) - clubId: ${team.clubId || 'BRAK'}`);
                });
                
            } else {
                console.log('Kolekcja clubs NIE istnieje');
            }
        } else {
            console.log('Blad odpowiedzi lub brak danych');
        }
        
    } catch (error) {
        console.error('Blad:', error.message);
        console.error('Stack:', error.stack);
    }
}

main().catch(console.error);
