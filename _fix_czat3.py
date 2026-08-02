#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Przepisz sekcję odbiorców w czat.html na styl kalendarza"""

PATH = r'C:\Users\rafal\Documents\Claude_AI\Coachay\czat.html'
with open(PATH, encoding='utf-8') as f:
    src = f.read()

# ──────────────────────────────────────────────
# 1. Zastąp stary CSS grup/listy → styl kalendarza
# ──────────────────────────────────────────────
OLD_CSS = '''        /* ── Group filter (nowa wiadomosc) ── */
        .nowa-group-filters {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }
        .nowa-group-btn {
            padding: 7px 14px;
            border-radius: 20px;
            background: var(--tlo-karta);
            border: 1px solid var(--border);
            color: var(--szary);
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s;
            white-space: nowrap;
        }
        .nowa-group-btn.active {
            background: var(--akcent);
            color: #fff;
            border-color: var(--akcent);
        }
        .nowa-simple-opts {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .nowa-simple-opt {
            padding: 14px 16px;
            background: var(--tlo-karta);
            border: 1px solid var(--border);
            border-radius: 12px;
            color: var(--bialy);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: border-color 0.15s;
        }
        .nowa-simple-opt.active {
            border-color: var(--akcent);
            background: rgba(59,130,246,0.08);
        }
        .nowa-simple-opt-icon { font-size: 20px; }'''

NEW_CSS = '''        /* ── Sekcja odbiorców — styl jak kalendarz ── */
        .vis-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .vis-chip {
            padding: 8px 14px;
            border-radius: var(--r-pill, 999px);
            background: var(--tlo-karta);
            border: 1.5px solid var(--border2);
            font-size: 12px;
            font-weight: 800;
            color: var(--szary);
            cursor: pointer;
            transition: all 0.15s;
        }
        .vis-chip.selected {
            border-color: var(--akcent);
            color: var(--akcent);
            background: rgba(59,130,246,0.08);
        }
        .person-list-wrap {
            background: var(--tlo-karta);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
        }
        .person-list-toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
        }
        .person-list-btn {
            font-size: 11px;
            font-weight: 800;
            color: var(--akcent);
            cursor: pointer;
            padding: 4px 0;
        }
        .person-list-count {
            font-size: 11px;
            font-weight: 700;
            color: var(--szary);
            margin-left: auto;
        }
        .person-check-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 11px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--border);
            transition: background 0.12s;
        }
        .person-check-row:last-child { border-bottom: none; }
        .person-check-row:active { background: var(--tlo-karta2, rgba(255,255,255,0.04)); }
        .person-cb {
            width: 20px;
            height: 20px;
            border-radius: 6px;
            border: 2px solid var(--border2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 900;
            color: #fff;
            flex-shrink: 0;
            transition: all 0.15s;
        }
        .person-check-row.checked .person-cb {
            background: var(--akcent);
            border-color: var(--akcent);
        }
        .person-check-name {
            flex: 1;
            font-size: 13px;
            font-weight: 700;
            color: var(--bialy);
        }
        .person-check-role {
            font-size: 11px;
            font-weight: 600;
            color: var(--szary);
        }
        .nowa-simple-opts { display: flex; flex-direction: column; gap: 8px; }
        .nowa-simple-opt {
            padding: 14px 16px;
            background: var(--tlo-karta);
            border: 1.5px solid var(--border2);
            border-radius: 12px;
            color: var(--bialy);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: border-color 0.15s;
        }
        .nowa-simple-opt.selected {
            border-color: var(--akcent);
            background: rgba(59,130,246,0.08);
        }
        .nowa-simple-opt-icon { font-size: 20px; }'''

if OLD_CSS in src:
    src = src.replace(OLD_CSS, NEW_CSS, 1)
    print('OK CSS')
else:
    print('BRAK CSS')

# ──────────────────────────────────────────────
# 2. Przepisz buildRecipientUI (trener — nowy styl)
# ──────────────────────────────────────────────
OLD_BUILD = '''        let _activeGroups = new Set(); // aktywne grupy (puste = wszyscy)

        function buildRecipientUI() {
            const isTrainer = ['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'OWNER'].includes(currentUserRole);
            const section = document.getElementById('recipient-section');

            if (isTrainer) {
                _activeGroups = new Set();
                selectedRecipients = [];
                recipientType = 'select';
                section.innerHTML = `
                    <div class="nowa-group-filters" id="group-filters">
                        <button class="nowa-group-btn active" data-group="all" onclick="toggleGroupBtn(this)">Wszyscy</button>
                        <button class="nowa-group-btn" data-group="ZAWODNIK" onclick="toggleGroupBtn(this)">Zawodnicy</button>
                        <button class="nowa-group-btn" data-group="RODZIC" onclick="toggleGroupBtn(this)">Rodzice</button>
                        <button class="nowa-group-btn" data-group="TRENER_GLOWNY,TRENER_POMOCNICZY" onclick="toggleGroupBtn(this)">Trenerzy</button>
                    </div>
                    <div class="nowa-recipient-list" id="recipient-list"></div>
                `;
                loadRecipientList();
            } else {'''

NEW_BUILD = '''        let _activeVis = new Set(['DRUZYNA']); // aktywne grupy vis
        let _allMembersData = null; // cache danych członków

        function buildRecipientUI() {
            const isTrainer = ['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'OWNER'].includes(currentUserRole);
            const section = document.getElementById('recipient-section');

            if (isTrainer) {
                _activeVis = new Set(['DRUZYNA']);
                _allMembersData = null;
                selectedRecipients = [];
                recipientType = 'select';
                section.innerHTML = `
                    <div class="vis-grid" id="vis-grid">
                        <div class="vis-chip selected" data-vis="DRUZYNA" onclick="toggleVisChip(this)">Drużyna</div>
                        <div class="vis-chip" data-vis="TRENERZY" onclick="toggleVisChip(this)">Trenerzy</div>
                        <div class="vis-chip" data-vis="RODZICE" onclick="toggleVisChip(this)">Rodzice</div>
                    </div>
                    <div class="person-list-wrap">
                        <div class="person-list-toolbar">
                            <div class="person-list-btn" onclick="selectAllPersons()">Zaznacz wszystkich</div>
                            <div class="person-list-btn" onclick="deselectAllPersons()">Odznacz</div>
                            <div class="person-list-count" id="person-count">Ładowanie...</div>
                        </div>
                        <div id="person-list"></div>
                    </div>
                `;
                loadAndRenderPersonList();
            } else {'''

if OLD_BUILD in src:
    src = src.replace(OLD_BUILD, NEW_BUILD, 1)
    print('OK buildRecipientUI')
else:
    print('BRAK buildRecipientUI')

# ──────────────────────────────────────────────
# 3. Przepisz toggleGroupBtn → toggleVisChip
# ──────────────────────────────────────────────
OLD_TOGGLE_GROUP = '''        function toggleGroupBtn(btn) {
            const group = btn.dataset.group;
            const allBtn = document.querySelector('.nowa-group-btn[data-group="all"]');
            if (group === 'all') {
                _activeGroups.clear();
                document.querySelectorAll('.nowa-group-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            } else {
                allBtn.classList.remove('active');
                const roles = group.split(',');
                const allActive = roles.every(r => _activeGroups.has(r));
                if (allActive) {
                    roles.forEach(r => _activeGroups.delete(r));
                    btn.classList.remove('active');
                } else {
                    roles.forEach(r => _activeGroups.add(r));
                    btn.classList.add('active');
                }
                if (_activeGroups.size === 0) allBtn.classList.add('active');
            }
            loadRecipientList();
        }'''

NEW_TOGGLE_GROUP = '''        function toggleVisChip(el) {
            el.classList.toggle('selected');
            const vis = el.dataset.vis;
            if (_activeVis.has(vis)) _activeVis.delete(vis);
            else _activeVis.add(vis);
            loadAndRenderPersonList();
        }

        async function loadAndRenderPersonList() {
            const container = document.getElementById('person-list');
            const countEl = document.getElementById('person-count');
            if (!container) return;
            if (countEl) countEl.textContent = 'Ładowanie...';

            // Pobierz dane jeśli nie ma w cache
            if (!_allMembersData) {
                const team = await getCurrentTeam();
                if (!team) return;
                const [players, allUsers] = await Promise.all([
                    getTeamPlayers(team.teamId),
                    (async () => {
                        if (!db) return [];
                        try {
                            const snap = await db.collection('users').get();
                            return snap.docs.map(d => ({ userId: d.id, ...d.data() }));
                        } catch(e) { return []; }
                    })()
                ]);
                _allMembersData = { players, users: allUsers, teamId: team.teamId };
            }

            // Zapamiętaj zaznaczenia
            const prevChecked = new Set(
                Array.from(container.querySelectorAll('.person-check-row.checked'))
                    .map(r => r.dataset.personId)
            );
            const isFirst = container.children.length === 0;

            // Zbierz osoby
            const persons = [];
            const addedIds = new Set();

            function addP(id, name, role, roleKey) {
                if (addedIds.has(id) || id === currentUserId) return;
                addedIds.add(id);
                persons.push({ id, name, role, roleKey });
            }

            if (_activeVis.has('TRENERZY')) {
                _allMembersData.users.forEach(u => {
                    const ctx = u.contexts?.find(c => c.contextId === _allMembersData.teamId);
                    const role = ctx?.role || u.role || '';
                    if (['TRENER_GLOWNY','TRENER_POMOCNICZY','OWNER'].includes(role)) {
                        addP(u.userId, u.displayName || u.userId, ROLE_LABELS[role] || role, 'TRENER');
                    }
                });
            }

            if (_activeVis.has('DRUZYNA')) {
                _allMembersData.players.forEach(p => {
                    addP(p.id || p.playerId, p.displayName || p.name || p.id, 'Zawodnik', 'ZAWODNIK');
                });
            }

            if (_activeVis.has('RODZICE')) {
                _allMembersData.users.forEach(u => {
                    const ctx = u.contexts?.find(c => c.contextId === _allMembersData.teamId);
                    const role = ctx?.role || u.role || '';
                    if (role === 'RODZIC') {
                        addP(u.userId, u.displayName || u.userId, 'Rodzic', 'RODZIC');
                    }
                });
            }

            // Sortuj: trenerzy → zawodnicy → rodzice
            const order = { TRENER: 0, ZAWODNIK: 1, RODZIC: 2 };
            persons.sort((a, b) => (order[a.roleKey]||9) - (order[b.roleKey]||9) || a.name.localeCompare(b.name,'pl'));

            container.innerHTML = '';
            persons.forEach(p => {
                const isChecked = isFirst ? true : prevChecked.has(p.id);
                const row = document.createElement('div');
                row.className = 'person-check-row' + (isChecked ? ' checked' : '');
                row.dataset.personId = p.id;
                row.onclick = () => {
                    row.classList.toggle('checked');
                    row.querySelector('.person-cb').textContent = row.classList.contains('checked') ? '✓' : '';
                    updatePersonCount();
                };
                row.innerHTML = `
                    <div class="person-cb">${isChecked ? '✓' : ''}</div>
                    <div class="person-check-name">${p.name}</div>
                    <div class="person-check-role">${p.role}</div>
                `;
                container.appendChild(row);
            });

            updatePersonCount();
        }

        function updatePersonCount() {
            const checked = document.querySelectorAll('#person-list .person-check-row.checked').length;
            const total = document.querySelectorAll('#person-list .person-check-row').length;
            const el = document.getElementById('person-count');
            if (el) el.textContent = checked + '/' + total + ' wybranych';
        }

        function selectAllPersons() {
            document.querySelectorAll('#person-list .person-check-row').forEach(r => {
                r.classList.add('checked');
                r.querySelector('.person-cb').textContent = '✓';
            });
            updatePersonCount();
        }

        function deselectAllPersons() {
            document.querySelectorAll('#person-list .person-check-row').forEach(r => {
                r.classList.remove('checked');
                r.querySelector('.person-cb').textContent = '';
            });
            updatePersonCount();
        }

        function getSelectedPersonIds() {
            return Array.from(document.querySelectorAll('#person-list .person-check-row.checked'))
                .map(r => r.dataset.personId);
        }'''

if OLD_TOGGLE_GROUP in src:
    src = src.replace(OLD_TOGGLE_GROUP, NEW_TOGGLE_GROUP, 1)
    print('OK toggleVisChip')
else:
    print('BRAK toggleGroupBtn')

# ──────────────────────────────────────────────
# 4. Usuń stary loadRecipientList i toggleRecipient (zastąpione)
# ──────────────────────────────────────────────
OLD_LOAD = '''        async function loadRecipientList() {
            const container = document.getElementById('recipient-list');
            if (!container) return;
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--szary);">Ładowanie...</div>';

            const team = await getCurrentTeam();
            if (!team) return;

            const clubId = team.clubId || 'club_orly_praga';
            const users = await getClubMembers(clubId, team.teamId);
            let filtered = users.filter(u => u.userId !== currentUserId);

            // Filtruj po aktywnych grupach
            if (_activeGroups && _activeGroups.size > 0) {
                filtered = filtered.filter(u => _activeGroups.has(u.role));
            }

            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--szary);font-size:13px;">Brak osób w tej grupie</div>';
                return;
            }

            filtered.forEach(user => {
                const roleLabel = ROLE_LABELS[user.role] || user.role || '';
                const alreadySelected = selectedRecipients.includes(user.userId);
                const item = document.createElement('div');
                item.className = 'nowa-rec-item' + (alreadySelected ? ' selected' : '');
                item.innerHTML = `
                    <div class="nowa-rec-checkbox">${alreadySelected ? '✓' : ''}</div>
                    <div style="flex:1;">
                      <div class="nowa-rec-name">${user.displayName}</div>
                      <div style="font-size:11px;color:var(--szary);margin-top:2px;">${roleLabel}</div>
                    </div>
                `;
                item.onclick = () => toggleRecipient(item, user.userId);
                container.appendChild(item);
            });
        }

        function toggleRecipient(element, userId) {
            const isNowSelected = !element.classList.contains('selected');
            element.classList.toggle('selected', isNowSelected);
            const checkbox = element.querySelector('.nowa-rec-checkbox');
            if (checkbox) checkbox.textContent = isNowSelected ? '✓' : '';

            if (selectedRecipients.includes(userId)) {
                selectedRecipients = selectedRecipients.filter(id => id !== userId);
            } else {
                selectedRecipients.push(userId);
            }
        }'''

NEW_LOAD = '''        // loadRecipientList zastąpiony przez loadAndRenderPersonList (styl kalendarza)'''

if OLD_LOAD in src:
    src = src.replace(OLD_LOAD, NEW_LOAD, 1)
    print('OK loadRecipientList usuniete')
else:
    print('BRAK loadRecipientList')

# ──────────────────────────────────────────────
# 5. Napraw sendNowaWiadomosc — użyj getSelectedPersonIds()
# ──────────────────────────────────────────────
OLD_SEND_SEL = '''            } else if (selectedRecipients.length > 0) {
                // Wybrano konkretne osoby
                toField = selectedRecipients; msgType = 'PRIVATE';
            } else {
                // Nikt nie zaznaczony = do wszystkich (broadcast)
                toField = null; msgType = 'BROADCAST';
            }'''

NEW_SEND_SEL = '''            } else {
                // Trener: pobierz zaznaczonych z person-list
                const sel = getSelectedPersonIds ? getSelectedPersonIds() : selectedRecipients;
                const total = document.querySelectorAll('#person-list .person-check-row').length;
                if (sel.length > 0 && sel.length < total) {
                    toField = sel; msgType = 'PRIVATE';
                } else {
                    toField = null; msgType = 'BROADCAST';
                }
            }'''

if OLD_SEND_SEL in src:
    src = src.replace(OLD_SEND_SEL, NEW_SEND_SEL, 1)
    print('OK sendNowaWiadomosc')
else:
    print('BRAK sendNowaWiadomosc')

# ──────────────────────────────────────────────
# 6. Napraw selectSimpleOpt (rodzic/zawodnik) — 'selected' zamiast 'active'
# ──────────────────────────────────────────────
OLD_SIMPLE = '''        function selectSimpleOpt(opt) {
            window._simpleOpt = opt;
            document.querySelectorAll('.nowa-simple-opt').forEach(b => b.classList.remove('active'));
            document.getElementById('opt-' + opt)?.classList.add('active');'''

NEW_SIMPLE = '''        function selectSimpleOpt(opt) {
            window._simpleOpt = opt;
            document.querySelectorAll('.nowa-simple-opt').forEach(b => b.classList.remove('selected'));
            document.getElementById('opt-' + opt)?.classList.add('selected');'''

if OLD_SIMPLE in src:
    src = src.replace(OLD_SIMPLE, NEW_SIMPLE, 1)
    print('OK selectSimpleOpt')
else:
    print('BRAK selectSimpleOpt')

OLD_SIMPLE_HTML = '''                        <div class="nowa-simple-opt active" id="opt-trainer" onclick="selectSimpleOpt(\'trainer\')">'''
NEW_SIMPLE_HTML = '''                        <div class="nowa-simple-opt selected" id="opt-trainer" onclick="selectSimpleOpt(\'trainer\')">'''
if OLD_SIMPLE_HTML in src:
    src = src.replace(OLD_SIMPLE_HTML, NEW_SIMPLE_HTML, 1)
    print('OK simple-opt HTML')

# ──────────────────────────────────────────────
# 7. Bump wersja JS
# ──────────────────────────────────────────────
src = src.replace('coachay-core.js?v=20260324g', 'coachay-core.js?v=20260324h')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)
print('OK zapisano czat.html')
