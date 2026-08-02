#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix czat.html: role-based new message + iPhone-style chat detail"""
import re

PATH = r'C:\Users\rafal\Documents\Claude_AI\Coachay\czat.html'

with open(PATH, encoding='utf-8') as f:
    src = f.read()

# ────────────────────────────────────────────────
# 1. CSS — dodaj style dla separatora dnia, iPhone msg, group filter
# ────────────────────────────────────────────────
NEW_CSS = '''
        /* ── iPhone-style messages ── */
        .konw-msg-wrap {
            display: flex;
            flex-direction: column;
            max-width: 78%;
        }
        .konw-msg-wrap.mine { align-self: flex-end; align-items: flex-end; }
        .konw-msg-wrap.theirs { align-self: flex-start; align-items: flex-start; }
        .konw-msg-sender {
            font-size: 10px;
            font-weight: 700;
            color: var(--szary);
            margin-bottom: 3px;
            padding: 0 4px;
        }
        .konw-msg-time-bubble {
            font-size: 10px;
            color: var(--szary);
            padding: 2px 4px;
            margin-top: 3px;
        }

        .konw-day-sep {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 14px 0 8px;
            flex-shrink: 0;
        }
        .konw-day-sep::before, .konw-day-sep::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--border);
        }
        .konw-day-sep span {
            font-size: 10px;
            font-weight: 700;
            color: var(--szary);
            text-transform: uppercase;
            letter-spacing: 1px;
            white-space: nowrap;
        }

        /* ── Group filter (nowa wiadomosc) ── */
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
        .nowa-simple-opt-icon { font-size: 20px; }
'''

# Wstaw CSS przed zamknięciem </style>
src = src.replace('    </style>\n</head>', NEW_CSS + '    </style>\n</head>', 1)


# ────────────────────────────────────────────────
# 2. HTML — zamień sekcję "Do kogo" na dynamiczny kontener
# ────────────────────────────────────────────────
OLD_DO_KOGO = '''                    <!-- Do kogo -->
                    <div class="nowa-field">
                        <label class="nowa-label">Do kogo</label>
                        <div class="nowa-recipient-type">
                            <button class="nowa-rec-btn active" id="btn-broadcast" onclick="toggleRecipientType('broadcast')">
                                📢 Cała drużyna
                            </button>
                            <button class="nowa-rec-btn" id="btn-select" onclick="toggleRecipientType('select')">
                                👤 Wybierz osoby
                            </button>
                        </div>

                        <!-- Lista osób (ukryta domyślnie) -->
                        <div class="nowa-recipient-list" id="recipient-list" style="display:none;">
                            <!-- Generowane dynamicznie -->
                        </div>
                    </div>'''

NEW_DO_KOGO = '''                    <!-- Do kogo — generowane przez JS w zależności od roli -->
                    <div class="nowa-field" id="recipient-field">
                        <label class="nowa-label">Do kogo</label>
                        <div id="recipient-section"><!-- generowane przez JS --></div>
                    </div>'''

if OLD_DO_KOGO in src:
    src = src.replace(OLD_DO_KOGO, NEW_DO_KOGO, 1)
    print('OK: sekcja Do kogo zamieniona')
else:
    print('BRAK: sekcja Do kogo')


# ────────────────────────────────────────────────
# 3. JS — dodaj zmienną currentUserRole i ustaw ją po getCurrentUser
# ────────────────────────────────────────────────
OLD_VARS = '''        let allMessages = [];
        let currentFilter = 'unread';
        let currentUserId = '';
        let currentConversation = null;'''

NEW_VARS = '''        let allMessages = [];
        let currentFilter = 'unread';
        let currentUserId = '';
        let currentConversation = null;
        let currentUserRole = '';'''

src = src.replace(OLD_VARS, NEW_VARS, 1)

OLD_AFTER_TEAM = '''            loadCtxOverlay(user);
            loadMenuPanel(user);'''

NEW_AFTER_TEAM = '''            loadCtxOverlay(user);
            loadMenuPanel(user);
            // Pobierz rolę z primary kontekstu lub top-level
            const primaryCtx = (user.contexts || []).find(c => c.type === 'DRUZYNA' && c.isPrimary) || (user.contexts || [])[0];
            currentUserRole = (primaryCtx && primaryCtx.role) || user.role || '';'''

src = src.replace(OLD_AFTER_TEAM, NEW_AFTER_TEAM, 1)


# ────────────────────────────────────────────────
# 4. JS — przepisz openNowaWiadomosc + buildRecipientUI + loadRecipientList
# ────────────────────────────────────────────────
OLD_NOWA_OPEN = '''        function openNowaWiadomosc() {
            document.getElementById('nowa-overlay').classList.add('open');
            loadRecipientList();
        }'''

NEW_NOWA_OPEN = '''        function openNowaWiadomosc() {
            document.getElementById('nowa-overlay').classList.add('open');
            buildRecipientUI();
        }

        function buildRecipientUI() {
            const isTrainer = ['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'OWNER'].includes(currentUserRole);
            const section = document.getElementById('recipient-section');

            if (isTrainer) {
                // Trener: grupy filtrujące + lista
                section.innerHTML = `
                    <div class="nowa-group-filters" id="group-filters">
                        <button class="nowa-group-btn active" onclick="selectGroup(this,'all')">Wszyscy</button>
                        <button class="nowa-group-btn" onclick="selectGroup(this,'ZAWODNIK')">Zawodnicy</button>
                        <button class="nowa-group-btn" onclick="selectGroup(this,'RODZIC')">Rodzice</button>
                        <button class="nowa-group-btn" onclick="selectGroup(this,'TRENER_GLOWNY,TRENER_POMOCNICZY')">Trenerzy</button>
                    </div>
                    <div class="nowa-recipient-type" style="margin-bottom:12px;">
                        <button class="nowa-rec-btn active" id="btn-broadcast" onclick="toggleRecipientType('broadcast')">📢 Cała drużyna</button>
                        <button class="nowa-rec-btn" id="btn-select" onclick="toggleRecipientType('select')">👤 Wybierz osoby</button>
                    </div>
                    <div class="nowa-recipient-list" id="recipient-list" style="display:none;"></div>
                `;
                window._currentGroup = 'all';
                recipientType = 'broadcast';
                selectedRecipients = [];
            } else {
                // Rodzic / Zawodnik: uproszczone opcje
                section.innerHTML = `
                    <div class="nowa-simple-opts">
                        <div class="nowa-simple-opt active" id="opt-trainer" onclick="selectSimpleOpt('trainer')">
                            <span class="nowa-simple-opt-icon">🎽</span>
                            <div><div style="font-size:13px;font-weight:800;color:var(--bialy)">Trener</div><div style="font-size:11px;color:var(--szary)">Wyślij wiadomość do trenera</div></div>
                        </div>
                        <div class="nowa-simple-opt" id="opt-all" onclick="selectSimpleOpt('all')">
                            <span class="nowa-simple-opt-icon">📢</span>
                            <div><div style="font-size:13px;font-weight:800;color:var(--bialy)">Wszyscy z drużyny</div><div style="font-size:11px;color:var(--szary)">Ogłoszenie dla całej drużyny</div></div>
                        </div>
                    </div>
                `;
                window._simpleOpt = 'trainer';
                recipientType = 'trainer';
                selectedRecipients = [];
            }
        }

        function selectGroup(btn, group) {
            document.querySelectorAll('.nowa-group-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window._currentGroup = group;
            const list = document.getElementById('recipient-list');
            if (list && list.style.display !== 'none') loadRecipientList();
        }

        function selectSimpleOpt(opt) {
            window._simpleOpt = opt;
            document.querySelectorAll('.nowa-simple-opt').forEach(b => b.classList.remove('active'));
            document.getElementById('opt-' + opt)?.classList.add('active');
            if (opt === 'all') {
                recipientType = 'broadcast';
            } else {
                recipientType = 'trainer';
            }
        }'''

src = src.replace(OLD_NOWA_OPEN, NEW_NOWA_OPEN, 1)


# ────────────────────────────────────────────────
# 5. JS — closeNowa reset
# ────────────────────────────────────────────────
OLD_CLOSE_NOWA = '''            // Reset formularza
            document.getElementById('nowa-temat').value = '';
            document.getElementById('nowa-tresc').value = '';
            recipientType = 'broadcast';
            selectedRecipients = [];
            document.getElementById('btn-broadcast').classList.add('active');
            document.getElementById('btn-select').classList.remove('active');
            document.getElementById('recipient-list').style.display = 'none';'''

NEW_CLOSE_NOWA = '''            // Reset formularza
            document.getElementById('nowa-temat').value = '';
            document.getElementById('nowa-tresc').value = '';
            recipientType = 'broadcast';
            selectedRecipients = [];
            document.getElementById('recipient-section').innerHTML = '';'''

src = src.replace(OLD_CLOSE_NOWA, NEW_CLOSE_NOWA, 1)


# ────────────────────────────────────────────────
# 6. JS — toggleRecipientType (trener) — loadRecipientList na select
# ────────────────────────────────────────────────
OLD_TOGGLE = '''        function toggleRecipientType(type) {
            recipientType = type;

            document.getElementById('btn-broadcast').classList.toggle('active', type === 'broadcast');
            document.getElementById('btn-select').classList.toggle('active', type === 'select');
            document.getElementById('recipient-list').style.display = type === 'select' ? 'block' : 'none';
        }'''

NEW_TOGGLE = '''        function toggleRecipientType(type) {
            recipientType = type;
            const btnB = document.getElementById('btn-broadcast');
            const btnS = document.getElementById('btn-select');
            const list = document.getElementById('recipient-list');
            if (btnB) btnB.classList.toggle('active', type === 'broadcast');
            if (btnS) btnS.classList.toggle('active', type === 'select');
            if (list) {
                list.style.display = type === 'select' ? 'block' : 'none';
                if (type === 'select') loadRecipientList();
            }
        }'''

src = src.replace(OLD_TOGGLE, NEW_TOGGLE, 1)


# ────────────────────────────────────────────────
# 7. JS — loadRecipientList z filtrowaniem po grupie
# ────────────────────────────────────────────────
OLD_LOAD_LIST = '''        async function loadRecipientList() {
            const container = document.getElementById('recipient-list');
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--szary);">Ładowanie...</div>';

            const team = await getCurrentTeam();
            if (!team) return;

            // Pobierz wszystkich członków zespołu (oprócz siebie)
            //const team = await getCurrentTeam();
            const clubId = team.clubId || 'club_orly_praga';  // Pobierz clubId z team
            const users = await getClubMembers(clubId, team.teamId);
            //const users = await getTeamMembers(team.teamId);
            const filteredUsers = users.filter(u => u.userId !== currentUserId);

            container.innerHTML = '';

            filteredUsers.forEach(user => {
                // Określ etykietę roli
                let roleLabel = '';
                let roleInfo = '';

                if (user.role === 'TRENER_GLOWNY') {
                    roleLabel = 'Trener główny';
                } else if (user.role === 'TRENER_POMOCNICZY') {
                    roleLabel = 'Trener pomocniczy';
                } else if (user.role === 'RODZIC') {
                    roleLabel = 'Rodzic';
                    // Pobierz inicjały dzieci
                    if (user.children && user.children.length > 0) {
                        const initials = user.children.map(child => {
                            const name = child.childName || '';
                            const parts = name.split(' ');
                            if (parts.length >= 2) return parts[0][0] + parts[1][0];
                            return name.substring(0, 2);
                        }).join(', ');
                        roleInfo = ` • ${initials}`;
                    }
                } else if (user.role === 'ZAWODNIK') {
                    roleLabel = 'Zawodnik';
                }

                const item = document.createElement('div');
                item.className = 'nowa-rec-item';
                item.innerHTML = `
                    <div class="nowa-rec-checkbox"></div>
                    <div style="flex:1;">
                      <div class="nowa-rec-name">${user.displayName}</div>
                      <div style="font-size:11px;color:var(--szary);margin-top:2px;">${roleLabel}${roleInfo}</div>
                    </div>
                  `;
                item.onclick = () => toggleRecipient(item, user.userId);
                container.appendChild(item);
            });
        }'''

NEW_LOAD_LIST = '''        const ROLE_LABELS = {
            'TRENER_GLOWNY': 'Trener główny',
            'TRENER_POMOCNICZY': 'Trener pomocniczy',
            'RODZIC': 'Rodzic',
            'ZAWODNIK': 'Zawodnik',
            'OWNER': 'Właściciel'
        };

        async function loadRecipientList() {
            const container = document.getElementById('recipient-list');
            if (!container) return;
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--szary);">Ładowanie...</div>';

            const team = await getCurrentTeam();
            if (!team) return;

            const clubId = team.clubId || 'club_orly_praga';
            const users = await getClubMembers(clubId, team.teamId);
            let filtered = users.filter(u => u.userId !== currentUserId);

            // Filtruj po grupie (trener)
            const group = window._currentGroup || 'all';
            if (group !== 'all') {
                const roles = group.split(',');
                filtered = filtered.filter(u => roles.includes(u.role));
            }

            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--szary);font-size:13px;">Brak osób w tej grupie</div>';
                return;
            }

            filtered.forEach(user => {
                const roleLabel = ROLE_LABELS[user.role] || user.role || '';
                const item = document.createElement('div');
                item.className = 'nowa-rec-item';
                item.innerHTML = `
                    <div class="nowa-rec-checkbox"></div>
                    <div style="flex:1;">
                      <div class="nowa-rec-name">${user.displayName}</div>
                      <div style="font-size:11px;color:var(--szary);margin-top:2px;">${roleLabel}</div>
                    </div>
                `;
                item.onclick = () => toggleRecipient(item, user.userId);
                container.appendChild(item);
            });
        }'''

src = src.replace(OLD_LOAD_LIST, NEW_LOAD_LIST, 1)


# ────────────────────────────────────────────────
# 8. JS — sendNowaWiadomosc: obsłuż trainer type
# ────────────────────────────────────────────────
OLD_SEND_CHECK = '''            if (recipientType === 'select' && selectedRecipients.length === 0) {
                alert('Wybierz co najmniej jednego odbiorcę');
                return;
            }

            const team = await getCurrentTeam();
            if (!team) return;

            const messageData = {
                from: currentUserId,
                to: recipientType === 'broadcast' ? null : selectedRecipients,
                type: recipientType === 'broadcast' ? 'BROADCAST' : 'PRIVATE','''

NEW_SEND_CHECK = '''            if (recipientType === 'select' && selectedRecipients.length === 0) {
                alert('Wybierz co najmniej jednego odbiorcę');
                return;
            }

            const team = await getCurrentTeam();
            if (!team) return;

            // Trenerzy znalezieni dla opcji "trainer" (rodzic/zawodnik)
            let toField = null;
            let msgType = 'BROADCAST';
            if (recipientType === 'broadcast') {
                toField = null; msgType = 'BROADCAST';
            } else if (recipientType === 'trainer') {
                // Wyślij do trenerów drużyny (pobierz ich id)
                const clubId = team.clubId || 'club_orly_praga';
                const allUsers = await getClubMembers(clubId, team.teamId);
                toField = allUsers.filter(u => ['TRENER_GLOWNY','TRENER_POMOCNICZY'].includes(u.role)).map(u => u.userId);
                msgType = 'PRIVATE';
            } else {
                toField = selectedRecipients; msgType = 'PRIVATE';
            }

            const messageData = {
                from: currentUserId,
                to: toField,
                type: msgType,'''

src = src.replace(OLD_SEND_CHECK, NEW_SEND_CHECK, 1)


# ────────────────────────────────────────────────
# 9. JS — openConversation: iPhone-style z separatorem dnia
# ────────────────────────────────────────────────
OLD_OPEN_KONW = '''            const container = document.getElementById('konw-messages');
            container.innerHTML = '';

            const originalMsg = document.createElement('div');
            originalMsg.className = msg.from === currentUserId ? 'konw-msg mine' : 'konw-msg theirs';
            originalMsg.innerHTML = `${msg.body || ''}`;
            container.appendChild(originalMsg);
            container.scrollTop = container.scrollHeight;'''

NEW_OPEN_KONW = '''            const container = document.getElementById('konw-messages');
            container.innerHTML = '';

            const msgDate = msg.createdAt ? msg.createdAt.toDate() : new Date();
            addDaySeparator(container, msgDate);

            const isMineMsg = msg.from === currentUserId;
            const wrap = document.createElement('div');
            wrap.className = 'konw-msg-wrap ' + (isMineMsg ? 'mine' : 'theirs');
            if (!isMineMsg && !isBroadcast) {
                const senderEl = document.createElement('div');
                senderEl.className = 'konw-msg-sender';
                senderEl.textContent = fromName;
                wrap.appendChild(senderEl);
            }
            const bubble = document.createElement('div');
            bubble.className = 'konw-msg ' + (isMineMsg ? 'mine' : 'theirs');
            bubble.textContent = msg.body || '';
            const timeEl = document.createElement('div');
            timeEl.className = 'konw-msg-time-bubble';
            timeEl.textContent = formatTime(msgDate);
            wrap.appendChild(bubble);
            wrap.appendChild(timeEl);
            container.appendChild(wrap);
            container.scrollTop = container.scrollHeight;'''

src = src.replace(OLD_OPEN_KONW, NEW_OPEN_KONW, 1)


# ────────────────────────────────────────────────
# 10. JS — dodaj helper addDaySeparator i zaktualizuj sendReply (iPhone style)
# ────────────────────────────────────────────────
OLD_FORMAT_DATE = '''        function formatDate(date) {'''

NEW_FORMAT_DATE = '''        function addDaySeparator(container, date) {
            const label = formatDateFull(date);
            const last = container.querySelector('.konw-day-sep:last-of-type');
            if (last && last.dataset.date === label) return;
            const sep = document.createElement('div');
            sep.className = 'konw-day-sep';
            sep.dataset.date = label;
            sep.innerHTML = `<span>${label}</span>`;
            container.appendChild(sep);
        }

        function formatDateFull(date) {
            const now = new Date();
            const d = new Date(date);
            if (d.toDateString() === now.toDateString()) return 'Dzisiaj';
            const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) return 'Wczoraj';
            return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        function formatDate(date) {'''

src = src.replace(OLD_FORMAT_DATE, NEW_FORMAT_DATE, 1)


# ────────────────────────────────────────────────
# 11. JS — sendReply: iPhone-style bubble
# ────────────────────────────────────────────────
OLD_SEND_REPLY_BUBBLE = '''            const container = document.getElementById('konw-messages');
            const replyMsg = document.createElement('div');
            replyMsg.className = 'konw-msg mine';
            replyMsg.innerHTML = `${content}<div class="konw-msg-time">Teraz</div>`;
            container.appendChild(replyMsg);
            container.scrollTop = container.scrollHeight;

            input.value = '';
            input.style.height = 'auto';

            alert('TODO: Zapis do Firebase');'''

NEW_SEND_REPLY_BUBBLE = '''            const container = document.getElementById('konw-messages');
            const now = new Date();
            addDaySeparator(container, now);
            const wrap = document.createElement('div');
            wrap.className = 'konw-msg-wrap mine';
            const bubble = document.createElement('div');
            bubble.className = 'konw-msg mine';
            bubble.textContent = content;
            const timeEl = document.createElement('div');
            timeEl.className = 'konw-msg-time-bubble';
            timeEl.textContent = formatTime(now);
            wrap.appendChild(bubble);
            wrap.appendChild(timeEl);
            container.appendChild(wrap);
            container.scrollTop = container.scrollHeight;

            input.value = '';
            input.style.height = 'auto';

            // Zapis do Firebase
            if (db && currentConversation) {
                db.collection('messages').add({
                    from: currentUserId,
                    to: [currentConversation.from === currentUserId ? (currentConversation.to || [])[0] : currentConversation.from],
                    type: 'PRIVATE',
                    teamId: currentConversation.teamId,
                    title: 'Re: ' + (currentConversation.title || ''),
                    body: content,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    readBy: [currentUserId],
                    replyTo: currentConversation.id || null
                }).catch(e => console.error('sendReply error:', e));
            }'''

src = src.replace(OLD_SEND_REPLY_BUBBLE, NEW_SEND_REPLY_BUBBLE, 1)


# ────────────────────────────────────────────────
# 12. Bump wersja JS
# ────────────────────────────────────────────────
src = src.replace('coachay-core.js?v=20260324d', 'coachay-core.js?v=20260324e')

# ────────────────────────────────────────────────
with open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)
print('OK czat.html zapisany')
