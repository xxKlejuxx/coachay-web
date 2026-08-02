/**
 * COACHAY — Migracja players.guardianId → guardianIds (array)
 *
 * Co robi:
 *   - Pobiera wszystkie dokumenty z kolekcji `players`
 *   - Dla każdego gracza który ma stare pole `guardianId` (string)
 *     a NIE ma `guardianIds` (array) — dodaje `guardianIds: [guardianId]`
 *   - Nie rusza dokumentów, które już mają `guardianIds`
 *   - Tryb dry-run domyślnie (--apply żeby zapisać)
 *
 * Uruchom podgląd:  node scripts/migrate-guardian-ids.js
 * Uruchom zapis:    node scripts/migrate-guardian-ids.js --apply
 */

const fs    = require('fs');
const https = require('https');

const PROJECT      = 'coachay-5c3c9';
const BASE_PATH    = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const CLI_CFG_PATH = 'C:/Users/rafal/.config/configstore/firebase-tools.json';

const FIREBASE_CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const DRY_RUN = !process.argv.includes('--apply');

let ACCESS_TOKEN = '';

/* ── Token ── */
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
    cfg.tokens.expires_at   = Date.now() + data.expires_in * 1000;
    fs.writeFileSync(CLI_CFG_PATH, JSON.stringify(cfg, null, 2));
    console.log('✅ Token odświeżony');
}

/* ── HTTP ── */
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'firestore.googleapis.com', path, method,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
        }, res => {
            let d = ''; res.on('data', x => d += x);
            res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, body: d }); } });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

/* ── Firestore typy ── */
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
    for (const [k, v] of Object.entries(obj)) f[k] = toValue(v);
    return f;
}

/* ── Odczyt wartości z Firestore ── */
function fromValue(v) {
    if (!v) return null;
    if ('stringValue'  in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return parseInt(v.integerValue);
    if ('doubleValue'  in v) return v.doubleValue;
    if ('nullValue'    in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue'   in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue'     in v) return fromFields(v.mapValue.fields || {});
    return null;
}
function fromFields(fields) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) obj[k] = fromValue(v);
    return obj;
}

/* ── Patch — tylko wybrane pola ── */
async function patchDoc(collection, id, data) {
    const fields  = Object.keys(data);
    const mask    = fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const path    = `${BASE_PATH}/${collection}/${id}?${mask}`;
    const res     = await request('PATCH', path, { fields: toFields(data) });
    if (res.status !== 200) throw new Error(`Błąd patch ${collection}/${id}: ${JSON.stringify(res.body)}`);
}

/* ── Pobierz wszystkie dokumenty z kolekcji ── */
async function listCollection(collection, pageToken = null) {
    let path = `${BASE_PATH}/${collection}?pageSize=100`;
    if (pageToken) path += `&pageToken=${pageToken}`;
    const res = await request('GET', path);
    if (res.status !== 200) throw new Error(`Błąd listowania ${collection}: ${JSON.stringify(res.body)}`);
    return res.body;
}

async function getAllDocs(collection) {
    const docs = [];
    let pageToken = null;
    do {
        const data = await listCollection(collection, pageToken);
        if (data.documents) {
            for (const doc of data.documents) {
                const id = doc.name.split('/').pop();
                docs.push({ id, fields: fromFields(doc.fields || {}) });
            }
        }
        pageToken = data.nextPageToken || null;
    } while (pageToken);
    return docs;
}

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
async function main() {
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  COACHAY — Migracja guardianId → guardianIds');
    console.log('══════════════════════════════════════════');
    console.log(DRY_RUN ? '  Tryb: DRY RUN (podgląd, brak zapisu)' : '  Tryb: APPLY (zapis do Firestore)');
    console.log('');

    await ensureToken();

    console.log('📋 Pobieranie wszystkich players...');
    const players = await getAllDocs('players');
    console.log(`   Znaleziono: ${players.length} dokumentów\n`);

    let toMigrate    = [];
    let alreadyOk    = [];
    let noGuardian   = [];

    for (const p of players) {
        const f = p.fields;
        const hasGuardianIds = Array.isArray(f.guardianIds);
        const hasGuardianId  = typeof f.guardianId === 'string' && f.guardianId.length > 0;

        if (hasGuardianIds) {
            alreadyOk.push(p);
        } else if (hasGuardianId) {
            toMigrate.push(p);
        } else {
            noGuardian.push(p);
        }
    }

    console.log(`✅ Już mają guardianIds:    ${alreadyOk.length}`);
    console.log(`🔧 Do migracji (mają guardianId): ${toMigrate.length}`);
    console.log(`ℹ️  Bez opiekuna (brak obu pól): ${noGuardian.length}`);
    console.log('');

    if (toMigrate.length === 0 && noGuardian.length === 0) {
        console.log('🎉 Wszystkie dokumenty są już w nowym formacie. Nic do zrobienia.');
        return;
    }

    if (toMigrate.length > 0) {
        console.log('🔧 Dokumenty do migracji:');
        for (const p of toMigrate) {
            const name = p.fields.name || p.fields.displayName || p.id;
            console.log(`   [${p.id}] ${name} — guardianId: "${p.fields.guardianId}" → guardianIds: ["${p.fields.guardianId}"]`);
        }
        console.log('');
    }

    if (noGuardian.length > 0) {
        console.log('ℹ️  Dokumenty bez opiekuna (dodaję guardianIds: []):');
        for (const p of noGuardian) {
            const name = p.fields.name || p.fields.displayName || p.id;
            console.log(`   [${p.id}] ${name}`);
        }
        console.log('');
    }

    if (DRY_RUN) {
        console.log('⏸️  DRY RUN — brak zapisu. Uruchom z --apply żeby zapisać.');
        console.log('   node scripts/migrate-guardian-ids.js --apply');
        return;
    }

    // Migracja — dodaj guardianIds z istniejącego guardianId
    let ok = 0, err = 0;
    for (const p of toMigrate) {
        try {
            await patchDoc('players', p.id, { guardianIds: [p.fields.guardianId] });
            const name = p.fields.name || p.fields.displayName || p.id;
            console.log(`✅ [${p.id}] ${name}`);
            ok++;
        } catch (e) {
            console.error(`❌ [${p.id}] Błąd: ${e.message}`);
            err++;
        }
    }

    // Dokumenty bez opiekuna — dodaj pustą tablicę
    for (const p of noGuardian) {
        try {
            await patchDoc('players', p.id, { guardianIds: [] });
            const name = p.fields.name || p.fields.displayName || p.id;
            console.log(`✅ [${p.id}] ${name} — guardianIds: []`);
            ok++;
        } catch (e) {
            console.error(`❌ [${p.id}] Błąd: ${e.message}`);
            err++;
        }
    }

    console.log('');
    console.log(`══ Gotowe: ${ok} ok, ${err} błędów ══`);
}

main().catch(e => { console.error('❌ Błąd krytyczny:', e); process.exit(1); });
