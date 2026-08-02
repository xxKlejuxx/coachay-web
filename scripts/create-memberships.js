/**
 * COACHAY — Skrypt tworzenia kolekcji memberships (REST API)
 * v2 — z walidacją: czyści user.children / user.observedChildren
 *       jeśli player nie istnieje, usuwa całą kolekcję memberships i tworzy od nowa
 * Uruchom: node scripts/create-memberships.js
 */

const fs    = require('fs');
const https = require('https');

const PROJECT       = 'coachay-5c3c9';
const BASE_URL      = 'firestore.googleapis.com';
const BASE_PATH     = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const CLI_CFG_PATH  = 'C:/Users/rafal/.config/configstore/firebase-tools.json';

// OAuth credentials Firebase CLI (z firebase-tools/lib/api.js)
const FIREBASE_CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

let ACCESS_TOKEN = '';

// Odśwież access_token przez refresh_token jeśli wygasł
async function ensureToken() {
    const cliConfig = JSON.parse(fs.readFileSync(CLI_CFG_PATH));
    const { access_token, expires_at, refresh_token } = cliConfig.tokens;

    // Sprawdź czy token jest jeszcze ważny (z 60s marginesem)
    if (expires_at && Date.now() < expires_at - 60000) {
        console.log('🔑 Token ważny, używam istniejącego.');
        ACCESS_TOKEN = access_token;
        return;
    }

    console.log('🔄 Token wygasł — odświeżam przez refresh_token...');
    const newTokens = await new Promise((resolve, reject) => {
        const body = new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token,
            client_id:     FIREBASE_CLIENT_ID,
            client_secret: FIREBASE_CLIENT_SECRET
        }).toString();

        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path:     '/token',
            method:   'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }, res => {
            let d = '';
            res.on('data', x => d += x);
            res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    if (newTokens.error) throw new Error(`Refresh token error: ${newTokens.error_description}`);

    ACCESS_TOKEN = newTokens.access_token;

    // Zapisz nowy token do pliku
    cliConfig.tokens.access_token = newTokens.access_token;
    cliConfig.tokens.expires_at   = Date.now() + newTokens.expires_in * 1000;
    fs.writeFileSync(CLI_CFG_PATH, JSON.stringify(cliConfig, null, '\t'));
    console.log('✅ Token odświeżony i zapisany.');
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────

function httpsRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path,
            method,
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ── Firestore value converters ────────────────────────────────────────────────

function toValue(v) {
    if (v === null || v === undefined)   return { nullValue: null };
    if (typeof v === 'boolean')          return { booleanValue: v };
    if (typeof v === 'number')           return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return { timestampValue: v };
        return { stringValue: v };
    }
    if (Array.isArray(v))      return { arrayValue: { values: v.map(toValue) } };
    if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
    return { stringValue: String(v) };
}

function toFields(obj) {
    const fields = {};
    for (const [k, val] of Object.entries(obj)) fields[k] = toValue(val);
    return fields;
}

function fromValue(v) {
    if (!v) return null;
    if ('nullValue'     in v) return null;
    if ('booleanValue'  in v) return v.booleanValue;
    if ('integerValue'  in v) return Number(v.integerValue);
    if ('doubleValue'   in v) return v.doubleValue;
    if ('stringValue'   in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue'    in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue'      in v) return fromFields(v.mapValue.fields || {});
    return null;
}

function fromFields(fields) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) obj[k] = fromValue(v);
    return obj;
}

function docToObj(doc) {
    const id = doc.name.split('/').pop();
    return { id, ...fromFields(doc.fields || {}) };
}

// ── Firestore REST operations ────────────────────────────────────────────────

async function listAll(collection) {
    const items = [];
    let pageToken = null;
    do {
        const qs = `?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await httpsRequest('GET', `${BASE_PATH}/${collection}${qs}`);
        if (res.body.error) throw new Error(`listAll(${collection}): ${res.body.error.message}`);
        (res.body.documents || []).forEach(d => items.push(docToObj(d)));
        pageToken = res.body.nextPageToken || null;
    } while (pageToken);
    return items;
}

async function batchWrite(writes) {
    const CHUNK = 500;
    let total = 0;
    for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const res = await httpsRequest('POST',
            `/v1/projects/${PROJECT}/databases/(default)/documents:batchWrite`,
            { writes: chunk }
        );
        if (res.body.error) throw new Error(`batchWrite: ${res.body.error.message}`);
        total += chunk.length;
        console.log(`   Chunk ${Math.floor(i / CHUNK) + 1}: ${chunk.length} ops`);
    }
    return total;
}

function makeWrite(collection, id, data) {
    return {
        update: {
            name: `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`,
            fields: toFields(data)
        }
    };
}

function makeDeletion(collection, id) {
    return {
        delete: `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`
    };
}

// PATCH pojedynczego pola w dokumencie
async function patchField(collection, id, fieldName, value) {
    const path = `${BASE_PATH}/${collection}/${id}?updateMask.fieldPaths=${encodeURIComponent(fieldName)}`;
    const res = await httpsRequest('PATCH', path, { fields: { [fieldName]: toValue(value) } });
    if (res.body.error) throw new Error(`patchField(${collection}/${id}.${fieldName}): ${res.body.error.message}`);
    return res.body;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🚀 Start tworzenia kolekcji memberships v2...\n');

    // ── 0. Odśwież token jeśli wygasł ────────────────────────────
    await ensureToken();

    // ── 1. Pobierz wszystkie dane ─────────────────────────────────
    console.log('📥 Pobieranie danych...');
    const usersList   = await listAll('users');
    const playersList = await listAll('players');
    const codes       = await listAll('inviteCodes');

    const users   = {};  usersList.forEach(u => { users[u.id]   = u; });
    const players = {};  playersList.forEach(p => { players[p.id] = p; });

    console.log(`   Users: ${usersList.length}, Players: ${playersList.length}, Kody: ${codes.length}`);

    // ── 2. Walidacja + czyszczenie user.children ──────────────────
    console.log('\n🧹 Walidacja user.children (RODZIC)...');
    const userPatches = [];

    for (const user of usersList) {
        if (user.role !== 'RODZIC') continue;
        const children = user.children || [];
        if (children.length === 0) continue;

        const valid   = children.filter(c => !!players[c.childId]);
        const invalid = children.filter(c => !players[c.childId]);

        if (invalid.length > 0) {
            console.log(`   ⚠️  ${user.id}: usuwam ${invalid.length} nieistniejących dzieci:`);
            invalid.forEach(c => console.log(`      ✂️  childId=${c.childId} (name=${c.name || '?'})`));
            // Zapisz patch do wykonania
            userPatches.push({ userId: user.id, fieldName: 'children', value: valid });
            // Aktualizuj lokalnie dla dalszego przetwarzania
            user.children = valid;
        } else {
            console.log(`   ✅ ${user.id}: ${valid.length} dzieci OK`);
        }
    }

    // ── 3. Walidacja + czyszczenie user.observedChildren ─────────
    console.log('\n🧹 Walidacja user.observedChildren (OBSERWATOR)...');

    for (const user of usersList) {
        if (user.role !== 'OBSERWATOR') continue;
        const observed = user.observedChildren || [];
        if (observed.length === 0) continue;

        const valid   = observed.filter(c => !!players[c.childId]);
        const invalid = observed.filter(c => !players[c.childId]);

        if (invalid.length > 0) {
            console.log(`   ⚠️  ${user.id}: usuwam ${invalid.length} nieistniejących dzieci:`);
            invalid.forEach(c => console.log(`      ✂️  childId=${c.childId}`));
            userPatches.push({ userId: user.id, fieldName: 'observedChildren', value: valid });
            user.observedChildren = valid;
        } else {
            console.log(`   ✅ ${user.id}: ${valid.length} obserwowanych OK`);
        }
    }

    // ── 4. Zapisz patchowane pola userów ─────────────────────────
    if (userPatches.length > 0) {
        console.log(`\n💾 Patchuję ${userPatches.length} dokumentów users...`);
        for (const patch of userPatches) {
            await patchField('users', patch.userId, patch.fieldName, patch.value);
            console.log(`   ✅ users/${patch.userId}.${patch.fieldName} zaktualizowane`);
        }
    } else {
        console.log('\n✅ Brak pól do wyczyszczenia w users.');
    }

    // ── 5. Usuń WSZYSTKIE istniejące memberships ──────────────────
    console.log('\n🗑️  Pobieranie istniejących memberships...');
    const existingList = await listAll('memberships');
    console.log(`   Znaleziono ${existingList.length} dokumentów do usunięcia`);

    if (existingList.length > 0) {
        const deletions = existingList.map(m => makeDeletion('memberships', m.id));
        console.log('   Usuwam...');
        await batchWrite(deletions);
        console.log(`   ✅ Usunięto ${deletions.length} memberships`);
    }

    // ── 6. Twórz nowe memberships ─────────────────────────────────
    const writes = [];
    const NOW = new Date().toISOString();

    function addMembership(id, data) {
        const doc = {
            membershipId: id,
            warnings: [],
            warningCount: 0,
            commsBlockedUntil: null,
            guardianMembershipIds: [],
            notificationsEnabled: true,
            isReadOnly: false,
            ...data
        };
        writes.push(makeWrite('memberships', id, doc));
        console.log(`   ✅ ${id} (${data.role} / ${data.status})`);
    }

    // ── 6a. Trenerzy ──────────────────────────────────────────────
    console.log('\n👔 Memberships dla trenerów...');
    for (const user of usersList) {
        const rola = user.role;
        if (rola !== 'TRENER_GLOWNY' && rola !== 'TRENER_POMOCNICZY' && rola !== 'OWNER') continue;

        const ctx    = (user.contexts || []).find(c => c.type === 'DRUZYNA');
        const teamId = ctx?.contextId || null;
        const clubId = ctx?.clubId    || 'club_orly_praga';
        const isDemo = user.isDemo    || user.id.startsWith('demo_');

        addMembership(`mbr_${user.id}`, {
            clubId, userId: user.id,
            role: 'TRENER', teamId, playerId: null,
            status: 'active', code: null, pinHash: null,
            codeCreatedBy: null, codeCreatedAt: null,
            codeExpiresAt: null, codeUsedAt: null,
            managedBy: null, paidBy: 'club',
            subscriptionTier: null, subscriptionExpiry: null, gracePeriodEnd: null,
            createdAt: user.createdAt || NOW, createdBy: user.id,
            isDemo, demoSetId: user.demoSetId || null
        });
    }

    // ── 6b. Zawodnicy z kontem ────────────────────────────────────
    console.log('\n⚽ Memberships dla zawodników...');
    for (const user of usersList) {
        if (user.role !== 'ZAWODNIK') continue;
        const playerId = user.playerId;
        if (!playerId) { console.log(`   ⚠️  ${user.id} — brak playerId, pomijam`); continue; }
        if (!players[playerId]) { console.log(`   ⚠️  ${user.id} — player ${playerId} nie istnieje, pomijam`); continue; }

        const player  = players[playerId];
        const ctx     = (user.contexts || []).find(c => c.type === 'DRUZYNA');
        const teamId  = ctx?.contextId || (player?.teams || [])[0]?.teamId || null;
        const clubId  = ctx?.clubId    || 'club_orly_praga';
        const isDemo  = user.isDemo    || user.id.startsWith('demo_');
        const guardianId = player?.guardianId || (player?.guardianIds || [])[0] || null;

        addMembership(`mbr_${user.id}`, {
            clubId, userId: user.id,
            role: 'ZAWODNIK', teamId, playerId,
            status: 'active', code: null, pinHash: null,
            codeCreatedBy: null, codeCreatedAt: null,
            codeExpiresAt: null, codeUsedAt: null,
            managedBy: guardianId ? 'rodzic' : 'trener',
            guardianMembershipIds: guardianId ? [`mbr_${guardianId}_${playerId}`] : [],
            paidBy: null, subscriptionTier: null, subscriptionExpiry: null, gracePeriodEnd: null,
            createdAt: user.createdAt || NOW, createdBy: user.id,
            isDemo, demoSetId: user.demoSetId || null
        });
    }

    // ── 6c. Rodzice — po jednym membership per dziecko ────────────
    console.log('\n👨‍👩‍👧 Memberships dla rodziców...');
    for (const user of usersList) {
        if (user.role !== 'RODZIC') continue;
        const children = user.children || [];  // już wyczyszczone w kroku 2
        if (children.length === 0) { console.log(`   ⚠️  ${user.id} — brak dzieci, pomijam`); continue; }

        const ctx    = (user.contexts || []).find(c => c.type === 'DRUZYNA');
        const clubId = ctx?.clubId || 'club_orly_praga';
        const isDemo = user.isDemo || user.id.startsWith('demo_');

        for (const child of children) {
            const playerId = child.childId;
            if (!players[playerId]) continue;  // podwójna ochrona

            const teamId = child.teamId || ctx?.contextId || null;
            const mbrId  = `mbr_${user.id}_${playerId}`;

            const usedCode = codes.find(c =>
                c.usedBy === user.id && c.type === 'RODZIC' && c.playerId === playerId
            );

            addMembership(mbrId, {
                clubId, userId: user.id,
                role: 'RODZIC', teamId, playerId,
                status: 'active',
                code:          usedCode?.code      || null,
                pinHash:       null,
                codeCreatedBy: usedCode?.createdBy || null,
                codeCreatedAt: usedCode?.createdAt || null,
                codeExpiresAt: usedCode?.expiresAt || null,
                codeUsedAt:    usedCode?.usedAt    || null,
                managedBy: null, paidBy: 'user',
                subscriptionTier: 'RODZIC', subscriptionExpiry: null, gracePeriodEnd: null,
                createdAt: user.createdAt || NOW, createdBy: user.id,
                isDemo, demoSetId: user.demoSetId || null
            });
        }
    }

    // ── 6d. Obserwatorzy (kibice) ─────────────────────────────────
    console.log('\n👁️  Memberships dla obserwatorów...');
    for (const user of usersList) {
        if (user.role !== 'OBSERWATOR') continue;
        const observed = user.observedChildren || [];  // już wyczyszczone w kroku 3
        if (observed.length === 0) { console.log(`   ⚠️  ${user.id} — brak obserwowanych, pomijam`); continue; }

        const ctx    = (user.contexts || []).find(c => c.type === 'DRUZYNA');
        const clubId = ctx?.clubId || 'club_orly_praga';
        const isDemo = user.isDemo || user.id.startsWith('demo_');

        for (const obs of observed) {
            const playerId = obs.childId;
            if (!players[playerId]) continue;  // podwójna ochrona

            const teamId = obs.teamId || ctx?.contextId || null;
            const mbrId  = `mbr_${user.id}_${playerId}`;

            const usedCode = codes.find(c =>
                c.usedBy === user.id &&
                (c.type === 'OBSERVER' || c.type === 'KIBIC') &&
                (c.playerId === playerId || c.observedPlayerId === playerId)
            );

            addMembership(mbrId, {
                clubId, userId: user.id,
                role: 'KIBIC', teamId, playerId,
                status: 'active',
                code:          usedCode?.code      || null,
                pinHash:       null,
                codeCreatedBy: usedCode?.createdBy || null,
                codeCreatedAt: usedCode?.createdAt || null,
                codeExpiresAt: usedCode?.expiresAt || null,
                codeUsedAt:    usedCode?.usedAt    || null,
                managedBy: null, paidBy: 'user',
                subscriptionTier: 'KIBIC', subscriptionExpiry: null, gracePeriodEnd: null,
                createdAt: user.createdAt || NOW, createdBy: user.id,
                isDemo, demoSetId: user.demoSetId || null
            });
        }
    }

    // inviteCodes → NIE tworzymy memberships
    // pending = nikt się nie zarejestrował → membership powstanie przy rejestracji
    // deactivated = nieważne
    // active = już pokryte przez sekcję users powyżej

    // ── 6f. Demo user ─────────────────────────────────────────────
    console.log('\n🎭 Membership dla demo_user...');
    addMembership('mbr_demo_user', {
        clubId: 'club_orly_praga', userId: 'demo_user',
        role: 'TRENER', teamId: 'team_orly_u10', playerId: null,
        status: 'demo', code: null, pinHash: null,
        codeCreatedBy: null, codeCreatedAt: null,
        codeExpiresAt: null, codeUsedAt: null,
        managedBy: null, paidBy: null,
        subscriptionTier: null, subscriptionExpiry: null, gracePeriodEnd: null,
        isReadOnly: true,
        createdAt: '2026-01-01T10:00:00.000Z', createdBy: 'system',
        isDemo: true, demoSetId: 'demo_orly_u10'
    });

    // ── 7. Commit ─────────────────────────────────────────────────
    console.log(`\n💾 Zapisuję ${writes.length} nowych memberships...`);
    if (writes.length > 0) {
        await batchWrite(writes);
        console.log(`✅ Gotowe!`);
    } else {
        console.log('ℹ️  Nic do zapisania.');
    }

    // ── 8. Podsumowanie ───────────────────────────────────────────
    const finalList = await listAll('memberships');
    console.log(`\n📊 Stan końcowy: ${finalList.length} memberships`);
    finalList.forEach(m => {
        console.log(`   ${m.id}: role=${m.role} status=${m.status} userId=${m.userId || '(pending)'} playerId=${m.playerId || '(null)'}`);
    });
}

main().catch(err => {
    console.error('❌ Błąd:', err.message);
    process.exit(1);
});
