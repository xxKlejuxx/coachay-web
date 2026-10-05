const path = require('path');
const FT = path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools');
const { configstore } = require(path.join(FT, 'lib', 'configstore'));
const { getAccessToken } = require(path.join(FT, 'lib', 'auth'));
const PROJECT = 'coachay-5c3c9';
const USER = 'demo_rodzic_anna';

// ---- dokładne kopie funkcji z functions/index.js (bez zmian) ----
function _warsawLocalToMs(dateStr, timeStr) {
    const [y, mo, d] = (dateStr || '').split('-').map(Number);
    const [hh, mm]   = (timeStr || '00:00').split(':').map(Number);
    const guess = Date.UTC(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    const offMin = (t) => {
        const s = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'longOffset' })
            .formatToParts(new Date(t)).find(x => x.type === 'timeZoneName').value;
        const m = s.match(/GMT([+-])(\d{2}):(\d{2})/);
        return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
    };
    let res = guess - offMin(guess) * 60000;
    res = guess - offMin(res) * 60000;
    return res;
}
function _warsawDateStr(ms) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
function _isEventInBadgeWindow(ev, nowMs) {
    if (!ev || ev.status === 'CANCELLED' || !ev.date) return false;
    const today = _warsawDateStr(nowMs);
    const maxDay = _warsawDateStr(nowMs + 7 * 86400000);
    if (ev.date < today || ev.date > maxDay) return false;
    const rh = ev.reminderHoursBefore != null ? ev.reminderHoursBefore : (ev.reminderDays != null ? ev.reminderDays : 7) * 24;
    if (rh > 0) {
        const evTime = _warsawLocalToMs(ev.date, ev.timeFrom || '00:00');
        if (nowMs < evTime - rh * 3600000) return false;
    }
    return true;
}
function _badgeCalc(memDatas, events, absences, tasks, msgs, nowMs) {
    const evByTeam = {};
    for (const ev of events) {
        if (!ev.teamId || !ev.requireConfirmation) continue;
        if (ev.type === 'MECZ' && ev.matchData?.matchStatus === 'FINISHED') continue;
        if (!_isEventInBadgeWindow(ev, nowMs)) continue;
        (evByTeam[ev.teamId] = evByTeam[ev.teamId] || []).push(ev);
    }
    const pendingKeys = {};
    const debugLines = [];
    for (const m of memDatas) {
        if (!m.userId || !m.teamId) continue;
        if (String(m.status || '').toUpperCase() !== 'ACTIVE') continue;
        let ids = [];
        if (m.role === 'RODZIC') ids = [...new Set([...(m.childrenIds || []), ...(m.playerId ? [m.playerId] : [])])];
        else if (m.role === 'ZAWODNIK') ids = m.playerId ? [m.playerId] : [];
        else continue;
        for (const ev of (evByTeam[m.teamId] || [])) {
            const att = ev.attendance || {};
            const inv = att.invited || [], conf = att.confirmed || [], decl = att.declined || [];
            for (const pid of ids) {
                if (!inv.includes('__TEAM__') && !inv.includes(pid)) continue;
                if (conf.includes(pid) || decl.includes(pid)) continue;
                if (absences.some(a => a.playerId === pid && a.dateFrom <= ev.date && a.dateTo >= ev.date)) continue;
                (pendingKeys[m.userId] = pendingKeys[m.userId] || new Set()).add(ev.id + '|' + pid);
                if (m.userId === USER) debugLines.push(`  PENDING: event ${ev.id} (${ev.date} ${ev.timeFrom||''}, type=${ev.type}) player=${pid}`);
            }
        }
    }
    const tasksBy = {};
    for (const t of tasks) {
        if (t.status !== 'PENDING') continue;
        for (const uid of (t.assignedTo || [])) {
            if ((t.completedBy || []).includes(uid) || (t.rejectedBy || []).includes(uid)) continue;
            tasksBy[uid] = (tasksBy[uid] || 0) + 1;
        }
    }
    const msgBy = {};
    for (const n of msgs) { if (n.userId && n.referenceType === 'message' && n.isRead === false) msgBy[n.userId] = (msgBy[n.userId] || 0) + 1; }
    if (USER) console.log('\n--- DEBUG: pending event branches for ' + USER + ' ---\n' + (debugLines.join('\n') || '  (brak)'));
    return (uid) => ({ events: pendingKeys[uid]?.size || 0, tasks: tasksBy[uid] || 0, messages: msgBy[uid] || 0 });
}

async function runQuery(token, coll, fieldFilters, extra) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const structuredQuery = { from: [{ collectionId: coll }], ...(extra||{}) };
  if (fieldFilters && fieldFilters.length) structuredQuery.where = fieldFilters.length === 1 ? fieldFilters[0] : { compositeFilter: { op: 'AND', filters: fieldFilters } };
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }) });
  const data = await res.json();
  if (data.error) { console.error('QUERY ERROR', coll, JSON.stringify(data.error)); return []; }
  return data.filter(d => d.document).map(d => d.document);
}
function eqStr(f, v) { return { fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: { stringValue: v } } }; }
function inArr(f, arr) { return { fieldFilter: { field: { fieldPath: f }, op: 'IN', value: { arrayValue: { values: arr.map(v=>({stringValue:v})) } } } }; }
function toJs(doc) {
  const out = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) out[k] = fv(v);
  return out;
}
function fv(x) {
  if (x.stringValue !== undefined) return x.stringValue;
  if (x.booleanValue !== undefined) return x.booleanValue;
  if (x.integerValue !== undefined) return parseInt(x.integerValue, 10);
  if (x.doubleValue !== undefined) return x.doubleValue;
  if (x.nullValue !== undefined) return null;
  if (x.timestampValue !== undefined) return x.timestampValue;
  if (x.arrayValue !== undefined) return (x.arrayValue.values || []).map(fv);
  if (x.mapValue !== undefined) { const o = {}; for (const [k,v] of Object.entries(x.mapValue.fields||{})) o[k]=fv(v); return o; }
  return undefined;
}

(async () => {
  const rt = configstore.get('tokens')?.refresh_token;
  if (!rt) { console.error('brak refresh tokena w firebase-tools configstore'); return; }
  const { access_token } = await getAccessToken(rt, []);
  const token = access_token;

  const nowMs = Date.now();
  console.log('nowMs =', nowMs, '=', new Date(nowMs).toISOString(), '| Warsaw date =', _warsawDateStr(nowMs));

  // 1. wszystkie membershipy usera (nie tylko ACTIVE, dla kontekstu)
  const memDocs = await runQuery(token, 'memberships', [eqStr('userId', USER)]);
  const memberships = memDocs.map(toJs);
  console.log('\n=== MEMBERSHIPS (' + USER + ') ===');
  memberships.forEach(m => console.log(' -', JSON.stringify(m)));

  const activeTeamIds = [...new Set(memberships.filter(m => String(m.status||'').toUpperCase()==='ACTIVE').map(m=>m.teamId).filter(Boolean))];
  console.log('\nAktywne teamIds:', activeTeamIds);

  // 2. eventy dla tych zespołów
  let events = [];
  if (activeTeamIds.length) {
    const evDocs = await runQuery(token, 'events', [inArr('teamId', activeTeamIds)]);
    events = evDocs.map(toJs);
  }
  console.log('\n=== EVENTS (teamId in aktywne, wszystkie daty) — liczba:', events.length, '===');
  events.forEach(ev => console.log(' -', ev.id, ev.date, ev.timeFrom, 'type='+ev.type, 'reqConf='+ev.requireConfirmation, 'status='+ev.status, 'rh='+ev.reminderHoursBefore, 'invited='+JSON.stringify(ev.attendance?.invited), 'confirmed='+JSON.stringify(ev.attendance?.confirmed), 'declined='+JSON.stringify(ev.attendance?.declined)));

  // 3. absencje (isActive)
  const absDocs = await runQuery(token, 'absences', [{ fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } } }]);
  const absences = absDocs.map(toJs);
  console.log('\n=== ABSENCES isActive=true — liczba:', absences.length, '===');

  // 4. taski przypisane userowi
  const taskDocs = await runQuery(token, 'tasks', [{ fieldFilter: { field: { fieldPath: 'assignedTo' }, op: 'ARRAY_CONTAINS', value: { stringValue: USER } } }]);
  const tasks = taskDocs.map(toJs);
  console.log('\n=== TASKS assignedTo zawiera', USER, '— liczba:', tasks.length, '===');
  tasks.forEach(t => console.log(' -', t.id, 'status='+t.status, 'completedBy='+JSON.stringify(t.completedBy), 'rejectedBy='+JSON.stringify(t.rejectedBy)));

  // 5. notifications usera
  const notifDocs = await runQuery(token, 'notifications', [eqStr('userId', USER)]);
  const notifs = notifDocs.map(toJs);
  console.log('\n=== NOTIFICATIONS userId=', USER, '— liczba:', notifs.length, '===');
  const unreadMsgs = notifs.filter(n => n.referenceType==='message' && n.isRead===false);
  console.log('  z tego nieprzeczytane wiadomości (referenceType=message, isRead=false):', unreadMsgs.length);

  // 6. cache w users/{USER}.badgeCounts
  const userDoc = await runQuery(token, 'users', [{ fieldFilter: { field: { fieldPath: '__name__' }, op: 'EQUAL', value: { referenceValue: `projects/${PROJECT}/databases/(default)/documents/users/${USER}` } } }]);
  const userJs = userDoc.length ? toJs(userDoc[0]) : null;
  console.log('\n=== users/' + USER + '.badgeCounts (cache) ===');
  console.log(JSON.stringify(userJs?.badgeCounts));

  // === PRZELICZENIE dokładnie wg _badgeCalc/_computeBadgeCountsFor ===
  const calc = _badgeCalc(memberships, events, absences, tasks, notifs, nowMs);
  const result = calc(USER);
  console.log('\n=== WYNIK NIEZALEŻNEGO PRZELICZENIA (dokładnie wg logiki produkcyjnej) dla', USER, '===');
  console.log(JSON.stringify(result));
})();
