/**
 * COACHAY — Migracja users i memberships do schematu v4.1
 *
 * Co robi:
 *   users     — usuwa: role, contexts, children, observedChildren, playerId, trainerId
 *             — dodaje: hasEmail, authProvider, avatarUrl, avatarGender, loginPinHash,
 *                       photoConsent, termsAcceptedAt, rodoAcceptedAt, accountStatus,
 *                       isReadOnly, language, createdAt, lastLoginAt
 *             — tworzy: demo_user (jeśli brak)
 *   memberships — dodaje brakujące pola: trainerRole, managedBy, guardianMembershipIds,
 *                 warningCount, warnings, commsBlockedUntil, notificationsEnabled
 *
 * IDs nie są zmieniane.
 * Uruchom: node scripts/migrate-users-memberships.js
 */

const fs    = require('fs');
const https = require('https');

const PROJECT      = 'coachay-5c3c9';
const BASE_PATH    = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const CLI_CFG_PATH = 'C:/Users/rafal/.config/configstore/firebase-tools.json';

const FIREBASE_CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

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

/* ── Zapis pełnego dokumentu (zastępuje cały dokument) ── */
async function writeDoc(collection, id, data) {
    const path = `${BASE_PATH}/${collection}/${id}`;
    const res  = await request('PATCH', path, { fields: toFields(data) });
    if (res.status !== 200) throw new Error(`Błąd zapisu ${collection}/${id}: ${JSON.stringify(res.body)}`);
}

/* ── Patch — tylko wybrane pola (nie rusza pozostałych) ── */
async function patchDoc(collection, id, data) {
    const fields  = Object.keys(data);
    const mask    = fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const path    = `${BASE_PATH}/${collection}/${id}?${mask}`;
    const res     = await request('PATCH', path, { fields: toFields(data) });
    if (res.status !== 200) throw new Error(`Błąd patch ${collection}/${id}: ${JSON.stringify(res.body)}`);
}

/* ── Sprawdź czy dokument istnieje ── */
async function docExists(collection, id) {
    const res = await request('GET', `${BASE_PATH}/${collection}/${id}`);
    return res.status === 200;
}

/* ══════════════════════════════════════════════════════
   DANE DOCELOWE — users
══════════════════════════════════════════════════════ */

// Pola do usunięcia z users (przez patch z wartością null nie działa w Firestore REST)
// Strategia: piszemy pełny nowy dokument, bez starych pól
const USERS_NEW = {
    demo_trener_jan: {
        uid:             'demo_trener_jan',
        displayName:     'Jan Kowalski',
        email:           'jan.kowalski@demo.coachay.pl',
        hasEmail:        true,
        authProvider:    'email',
        avatarUrl:       'https://api.dicebear.com/7.x/adventurer/svg?seed=jan_kowalski&backgroundColor=3B82F6',
        avatarGender:    'male',
        loginPinHash:    null,
        photoConsent:    true,
        termsAcceptedAt: '2026-01-01T00:00:00.000Z',
        rodoAcceptedAt:  '2026-01-01T00:00:00.000Z',
        accountStatus:   'active',
        isReadOnly:      false,
        language:        'pl',
        createdAt:       '2026-01-01T00:00:00.000Z',
        lastLoginAt:     '2026-03-28T00:00:00.000Z',
        isDemo:          true,
        demoSetId:       'demo_orly_u10'
    },
    demo_trener_asystent: {
        uid:             'demo_trener_asystent',
        displayName:     'Tomasz Nowak',
        email:           'tomasz.nowak@demo.coachay.pl',
        hasEmail:        true,
        authProvider:    'email',
        avatarUrl:       'https://api.dicebear.com/7.x/adventurer/svg?seed=tomasz_nowak&backgroundColor=6B7280',
        avatarGender:    'male',
        loginPinHash:    null,
        photoConsent:    true,
        termsAcceptedAt: '2026-01-15T00:00:00.000Z',
        rodoAcceptedAt:  '2026-01-15T00:00:00.000Z',
        accountStatus:   'active',
        isReadOnly:      false,
        language:        'pl',
        createdAt:       '2026-01-15T00:00:00.000Z',
        lastLoginAt:     '2026-03-28T00:00:00.000Z',
        isDemo:          true,
        demoSetId:       'demo_orly_u10'
    },
    demo_rodzic_anna: {
        uid:             'demo_rodzic_anna',
        displayName:     'Anna Kowalska',
        email:           'anna.kowalska@demo.coachay.pl',
        hasEmail:        true,
        authProvider:    'email',
        avatarUrl:       'https://api.dicebear.com/7.x/adventurer/svg?seed=anna_kowalska&backgroundColor=EC4899',
        avatarGender:    'female',
        loginPinHash:    null,
        photoConsent:    true,
        termsAcceptedAt: '2026-01-10T00:00:00.000Z',
        rodoAcceptedAt:  '2026-01-10T00:00:00.000Z',
        accountStatus:   'active',
        isReadOnly:      false,
        language:        'pl',
        createdAt:       '2026-01-10T00:00:00.000Z',
        lastLoginAt:     '2026-03-28T00:00:00.000Z',
        isDemo:          true,
        demoSetId:       'demo_orly_u10'
    },
    demo_zawodnik_jasiek: {
        uid:             'demo_zawodnik_jasiek',
        displayName:     'Jasiek Kowalski',
        email:           null,
        hasEmail:        false,
        authProvider:    'phone',
        avatarUrl:       'https://api.dicebear.com/7.x/adventurer/svg?seed=jasiek_kowalski&backgroundColor=10B981',
        avatarGender:    'male',
        loginPinHash:    null,
        photoConsent:    true,
        termsAcceptedAt: null,
        rodoAcceptedAt:  null,
        accountStatus:   'active',
        isReadOnly:      false,
        language:        'pl',
        createdAt:       '2026-01-10T00:00:00.000Z',
        lastLoginAt:     '2026-03-28T00:00:00.000Z',
        isDemo:          true,
        demoSetId:       'demo_orly_u10'
    },
    demo_obserwator_babcia: {
        uid:             'demo_obserwator_babcia',
        displayName:     'Maria Kowalska',
        email:           null,
        hasEmail:        false,
        authProvider:    'phone',
        avatarUrl:       'https://api.dicebear.com/7.x/adventurer/svg?seed=maria_kowalska&backgroundColor=F59E0B',
        avatarGender:    'female',
        loginPinHash:    null,
        photoConsent:    true,
        termsAcceptedAt: null,
        rodoAcceptedAt:  null,
        accountStatus:   'active',
        isReadOnly:      false,
        language:        'pl',
        createdAt:       '2026-02-01T00:00:00.000Z',
        lastLoginAt:     '2026-03-28T00:00:00.000Z',
        isDemo:          true,
        demoSetId:       'demo_orly_u10'
    },
    // v4.0 — nowe konto demo (tylko trener, isReadOnly)
    demo_user: {
        uid:             'demo_user',
        displayName:     'Demo Trener',
        email:           null,
        hasEmail:        false,
        authProvider:    'email',
        avatarUrl:       'https://api.dicebear.com/7.x/adventurer/svg?seed=demo_trener&backgroundColor=3B82F6',
        avatarGender:    'male',
        loginPinHash:    null,
        photoConsent:    true,
        termsAcceptedAt: null,
        rodoAcceptedAt:  null,
        accountStatus:   'active',
        isReadOnly:      true,
        language:        'pl',
        createdAt:       '2026-01-01T00:00:00.000Z',
        lastLoginAt:     null,
        isDemo:          true,
        demoSetId:       'demo_orly_u10'
    }
};

/* ══════════════════════════════════════════════════════
   DANE DOCELOWE — memberships (patch brakujących pól)
══════════════════════════════════════════════════════ */

// Domyślne pola dla każdego membership
const MBR_DEFAULTS = {
    warningCount:          0,
    warnings:              [],
    commsBlockedUntil:     null,
    notificationsEnabled:  true,
    managedBy:             null,
    guardianMembershipIds: []
};

// Patch per membership — tylko pola które różnią się od defaults lub brakują
const MEMBERSHIPS_PATCH = {
    'mbr_demo_trener_jan': {
        ...MBR_DEFAULTS,
        trainerRole: 'TRENER_GLOWNY',
        clubId:      'club_orly_praga'
    },
    'mbr_demo_trener_asystent': {
        ...MBR_DEFAULTS,
        trainerRole: 'TRENER_POMOCNICZY',
        clubId:      'club_orly_praga'
    },
    'mbr_demo_zawodnik_jasiek': {
        ...MBR_DEFAULTS,
        managedBy:             'rodzic',
        guardianMembershipIds: ['mbr_demo_rodzic_anna_demo_player_jasiek']
    },
    'mbr_demo_rodzic_anna_demo_player_jasiek': {
        ...MBR_DEFAULTS,
        clubId: 'club_orly_praga'
    },
    'mbr_demo_rodzic_anna_demo_player_ania': {
        ...MBR_DEFAULTS,
        clubId: 'club_orly_praga'
    },
    'mbr_demo_obserwator_babcia_demo_player_jasiek': {
        ...MBR_DEFAULTS,
        clubId: 'club_orly_praga'
    },
    'mbr_demo_user': {
        ...MBR_DEFAULTS,
        trainerRole: 'TRENER_GLOWNY',
        clubId:      'club_orly_praga'
    }
};

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
async function main() {
    await ensureToken();

    // 1. Migracja users
    console.log('\n══════════════════════════════════════');
    console.log('  MIGRACJA USERS');
    console.log('══════════════════════════════════════');
    for (const [id, data] of Object.entries(USERS_NEW)) {
        await writeDoc('users', id, data);
        console.log(`✅ users/${id}`);
    }

    // 2. Migracja memberships
    console.log('\n══════════════════════════════════════');
    console.log('  MIGRACJA MEMBERSHIPS');
    console.log('══════════════════════════════════════');
    for (const [id, data] of Object.entries(MEMBERSHIPS_PATCH)) {
        await patchDoc('memberships', id, data);
        console.log(`✅ memberships/${id}`);
    }

    console.log('\n✅ Migracja zakończona.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
