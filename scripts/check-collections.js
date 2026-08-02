/**
 * COACHAY — Podgląd kolekcji users i memberships
 * Uruchom: node scripts/check-collections.js
 */

const fs    = require('fs');
const https = require('https');

const PROJECT      = 'coachay-5c3c9';
const BASE_PATH    = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const CLI_CFG_PATH = 'C:/Users/rafal/.config/configstore/firebase-tools.json';

const FIREBASE_CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

let ACCESS_TOKEN = '';

async function ensureToken() {
    const cfg = JSON.parse(fs.readFileSync(CLI_CFG_PATH));
    const { access_token, expires_at, refresh_token } = cfg.tokens;
    if (expires_at && Date.now() < expires_at - 60000) {
        ACCESS_TOKEN = access_token;
        return;
    }
    console.log('🔄 Odświeżam token...');
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token, client_id: FIREBASE_CLIENT_ID, client_secret: FIREBASE_CLIENT_SECRET }).toString();
    const data = await new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, res => {
            let d = ''; res.on('data', x => d += x); res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject); req.write(body); req.end();
    });
    ACCESS_TOKEN = data.access_token;
    cfg.tokens.access_token = data.access_token;
    cfg.tokens.expires_at = Date.now() + data.expires_in * 1000;
    fs.writeFileSync(CLI_CFG_PATH, JSON.stringify(cfg, null, 2));
}

function httpsGet(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'firestore.googleapis.com', path, method: 'GET', headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }, res => {
            let d = ''; res.on('data', x => d += x); res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject); req.end();
    });
}

function fromValue(v) {
    if (!v) return null;
    if ('nullValue'    in v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue'  in v) return v.doubleValue;
    if ('stringValue'  in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue'   in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue'     in v) return fromFields(v.mapValue.fields || {});
    return null;
}
function fromFields(fields) { const o = {}; for (const [k, v] of Object.entries(fields)) o[k] = fromValue(v); return o; }
function docToObj(doc) { return { _id: doc.name.split('/').pop(), ...fromFields(doc.fields || {}) }; }

async function listAll(collection) {
    const items = []; let pt = null;
    do {
        const res = await httpsGet(`${BASE_PATH}/${collection}?pageSize=300${pt ? '&pageToken=' + pt : ''}`);
        (res.documents || []).forEach(d => items.push(docToObj(d)));
        pt = res.nextPageToken || null;
    } while (pt);
    return items;
}

async function main() {
    await ensureToken();

    console.log('\n══════════════════════════════════════');
    console.log('  USERS');
    console.log('══════════════════════════════════════');
    const users = await listAll('users');
    console.log(`Łącznie: ${users.length} dokumentów\n`);
    for (const u of users) {
        console.log(`▸ ${u._id}`);
        console.log(`  displayName: ${u.displayName || '—'}`);
        console.log(`  role: ${u.role || '—'}`);
        console.log(`  contexts: ${JSON.stringify(u.contexts || [])}`);
        console.log(`  isDemo: ${u.isDemo}`);
        console.log(`  isReadOnly: ${u.isReadOnly ?? '—'}`);
        const children = u.children || u.childrenIds || [];
        if (children.length) console.log(`  children: ${JSON.stringify(children)}`);
        console.log('');
    }

    console.log('\n══════════════════════════════════════');
    console.log('  MEMBERSHIPS');
    console.log('══════════════════════════════════════');
    const mbs = await listAll('memberships');
    console.log(`Łącznie: ${mbs.length} dokumentów\n`);
    for (const m of mbs) {
        console.log(`▸ ${m._id}`);
        console.log(`  userId: ${m.userId || '(null — pending)'}`);
        console.log(`  role: ${m.role} | trainerRole: ${m.trainerRole || '—'}`);
        console.log(`  teamId: ${m.teamId || '—'} | playerId: ${m.playerId || '—'}`);
        console.log(`  status: ${m.status} | isReadOnly: ${m.isReadOnly ?? '—'}`);
        console.log(`  code: ${m.code || '—'} | isDemo: ${m.isDemo}`);
        console.log('');
    }
}

main().catch(console.error);
