import re

with open('czat.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. CSS: dodaj style dla konw-to, konw-broadcast-body, konw-edit-panel ──────
old_css = '''        .konw-subject {
            font-size: 14px;
            font-weight: 700;
            color: var(--bialy);
        }'''

new_css = '''        .konw-subject {
            font-size: 14px;
            font-weight: 700;
            color: var(--bialy);
            margin-bottom: 4px;
        }

        .konw-to {
            font-size: 12px;
            color: var(--szary);
            font-weight: 600;
            margin-top: 4px;
        }

        .konw-header-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
        }

        .konw-edit-btn {
            background: rgba(59,130,246,0.12);
            color: var(--akcent);
            border: 1.5px solid var(--akcent);
            border-radius: 8px;
            padding: 5px 14px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
        }

        .konw-broadcast-body {
            padding: 16px;
            font-size: 14px;
            color: var(--bialy);
            line-height: 1.6;
            white-space: pre-wrap;
            flex: 1;
            overflow-y: auto;
        }

        /* Panel edycji ogłoszenia */
        .konw-edit-panel {
            display: none;
            flex-direction: column;
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            gap: 12px;
        }
        .konw-edit-panel.open { display: flex; }
        .konw-edit-label {
            font-size: 11px;
            font-weight: 800;
            color: var(--szary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .konw-edit-input {
            background: var(--tlo-karta);
            border: 1.5px solid var(--border2);
            border-radius: 10px;
            color: var(--bialy);
            font-size: 14px;
            padding: 10px 12px;
            width: 100%;
            box-sizing: border-box;
            font-family: var(--font-d);
        }
        .konw-edit-textarea {
            background: var(--tlo-karta);
            border: 1.5px solid var(--border2);
            border-radius: 10px;
            color: var(--bialy);
            font-size: 14px;
            padding: 10px 12px;
            width: 100%;
            box-sizing: border-box;
            font-family: var(--font-d);
            resize: none;
            min-height: 100px;
        }
        .konw-edit-actions {
            display: flex;
            gap: 8px;
            margin-top: 4px;
        }
        .konw-edit-save {
            flex: 1;
            background: var(--akcent);
            color: #fff;
            border: none;
            border-radius: 10px;
            padding: 12px;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
        }
        .konw-edit-cancel {
            background: var(--tlo-karta);
            color: var(--szary);
            border: 1.5px solid var(--border2);
            border-radius: 10px;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
        }'''

html = html.replace(old_css, new_css, 1)

# ── 2. HTML: konw-panel – dodaj konw-to, przyciski edycji, panel edycji ────────
old_html = '''                <div class="konw-header">
                    <div class="konw-from" id="konw-from"></div>
                    <div class="konw-meta" id="konw-meta"></div>
                    <div class="konw-subject" id="konw-subject"></div>
                </div>
                <div class="konw-messages" id="konw-messages"></div>
                <div class="konw-input-wrap" id="konw-input-wrap">
                    <textarea class="konw-input" id="konw-input" placeholder="Wpisz wiadomość..."></textarea>
                    <button class="konw-send" onclick="sendReply()">➤</button>
                </div>'''

new_html = '''                <div class="konw-header">
                    <div class="konw-from" id="konw-from"></div>
                    <div class="konw-meta" id="konw-meta"></div>
                    <div class="konw-subject" id="konw-subject"></div>
                    <div class="konw-to" id="konw-to"></div>
                    <div class="konw-header-actions" id="konw-header-actions" style="display:none">
                        <button class="konw-edit-btn" onclick="openKonwEdit()">✏️ Edytuj ogłoszenie</button>
                    </div>
                </div>
                <div class="konw-messages" id="konw-messages"></div>
                <!-- Panel edycji ogłoszenia -->
                <div class="konw-edit-panel" id="konw-edit-panel">
                    <div>
                        <div class="konw-edit-label">Temat</div>
                        <input class="konw-edit-input" id="konw-edit-temat" type="text" placeholder="Temat ogłoszenia...">
                    </div>
                    <div>
                        <div class="konw-edit-label">Treść</div>
                        <textarea class="konw-edit-textarea" id="konw-edit-tresc" rows="6" placeholder="Treść ogłoszenia..."></textarea>
                    </div>
                    <div>
                        <div class="konw-edit-label">Widoczne przez</div>
                        <div class="vis-grid" id="konw-edit-days-grid">
                            <div class="vis-chip" data-days="1" onclick="selectEditDays(this)">1 dzień</div>
                            <div class="vis-chip selected" data-days="3" onclick="selectEditDays(this)">3 dni</div>
                            <div class="vis-chip" data-days="7" onclick="selectEditDays(this)">7 dni</div>
                            <div class="vis-chip" data-days="14" onclick="selectEditDays(this)">14 dni</div>
                            <div class="vis-chip" data-days="30" onclick="selectEditDays(this)">30 dni</div>
                        </div>
                    </div>
                    <div class="konw-edit-actions">
                        <button class="konw-edit-cancel" onclick="closeKonwEdit()">Anuluj</button>
                        <button class="konw-edit-save" onclick="saveKonwEdit()">Zapisz zmiany</button>
                    </div>
                </div>
                <div class="konw-input-wrap" id="konw-input-wrap">
                    <textarea class="konw-input" id="konw-input" placeholder="Wpisz wiadomość..."></textarea>
                    <button class="konw-send" onclick="sendReply()">➤</button>
                </div>'''

html = html.replace(old_html, new_html, 1)

# ── 3. JS: zastąp openConversation + sendReply + dodaj appendMsgBubble + edit fns
old_js = '''        async function openConversation(msg) {
            currentConversation = msg;

            const fromName = await getUserName(msg.from);
            const isBroadcast = msg.type === 'BROADCAST';
            const date = msg.createdAt ? formatDate(msg.createdAt.toDate()) + ' · ' + formatTime(msg.createdAt.toDate()) : '';

            document.getElementById('konw-from').innerHTML = fromName + (isBroadcast ? '<span class="konw-broadcast-badge">Ogłoszenie</span>' : '');
            document.getElementById('konw-meta').textContent = date;
            document.getElementById('konw-subject').textContent = msg.title || 'Brak tematu';

            // Ukryj pole odpowiedzi dla ogłoszeń
            document.getElementById('konw-input-wrap').style.display = isBroadcast ? 'none' : 'flex';

            const container = document.getElementById('konw-messages');
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
            container.scrollTop = container.scrollHeight;

            document.getElementById('konw-overlay').classList.add('open');

            // Oznacz jako przeczytane w Firebase
            if (db && msg.id && !(msg.readBy || []).includes(currentUserId)) {
                db.collection('messages').doc(msg.id).update({
                    readBy: firebase.firestore.FieldValue.arrayUnion(currentUserId)
                }).catch(e => console.warn('readBy:', e));
                msg.readBy = [...(msg.readBy || []), currentUserId];
            }
        }

        function closeKonw(event) {
            if (event && event.target !== event.currentTarget && !event.target.classList.contains('konw-handle-wrap')) return;
            document.getElementById('konw-overlay').classList.remove('open');
            currentConversation = null;
        }

        function sendReply() {
            const input = document.getElementById('konw-input');
            const content = input.value.trim();
            if (!content || !currentConversation) return;

            console.log('Wysyłanie:', content);

            const container = document.getElementById('konw-messages');'''

new_js = '''        // ── Pomocnicza: dodaj bąbelek wiadomości ───────────────────────────────
        function appendMsgBubble(container, msg, fromName) {
            const isMine = msg.from === currentUserId;
            const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : (msg.createdAt || new Date());
            const wrap = document.createElement('div');
            wrap.className = 'konw-msg-wrap ' + (isMine ? 'mine' : 'theirs');
            if (!isMine) {
                const senderEl = document.createElement('div');
                senderEl.className = 'konw-msg-sender';
                senderEl.textContent = fromName;
                wrap.appendChild(senderEl);
            }
            const bubble = document.createElement('div');
            bubble.className = 'konw-msg ' + (isMine ? 'mine' : 'theirs');
            bubble.textContent = msg.body || '';
            const timeEl = document.createElement('div');
            timeEl.className = 'konw-msg-time-bubble';
            timeEl.textContent = formatTime(msgDate);
            wrap.appendChild(bubble);
            wrap.appendChild(timeEl);
            container.appendChild(wrap);
        }

        async function openConversation(msg) {
            currentConversation = msg;

            const fromName = await getUserName(msg.from);
            const isBroadcast = msg.type === 'BROADCAST';
            const isTrainer = ['TRENER_GLOWNY', 'TRENER_POMOCNICZY', 'OWNER'].includes(currentUserRole);
            const date = msg.createdAt ? formatDate(msg.createdAt.toDate()) + ' · ' + formatTime(msg.createdAt.toDate()) : '';

            document.getElementById('konw-from').innerHTML = fromName + (isBroadcast ? '<span class="konw-broadcast-badge">Ogłoszenie</span>' : '');
            document.getElementById('konw-meta').textContent = date;
            document.getElementById('konw-subject').textContent = msg.title || 'Brak tematu';

            // "Do" info
            const toEl = document.getElementById('konw-to');
            if (isBroadcast) {
                toEl.textContent = 'Cała drużyna';
            } else if (!msg.to || msg.to.length === 0) {
                toEl.textContent = '';
            } else if (msg.to.length === 1) {
                const toName = await getUserName(msg.to[0]);
                toEl.textContent = 'Do: ' + toName;
            } else {
                toEl.textContent = 'Do: ' + msg.to.length + ' osób';
            }

            // Przycisk edycji (tylko trener + ogłoszenie)
            const actions = document.getElementById('konw-header-actions');
            if (actions) actions.style.display = (isBroadcast && isTrainer) ? 'flex' : 'none';

            // Ukryj pole odpowiedzi i panel edycji dla ogłoszeń
            document.getElementById('konw-input-wrap').style.display = isBroadcast ? 'none' : 'flex';
            document.getElementById('konw-edit-panel').classList.remove('open');

            const container = document.getElementById('konw-messages');
            container.innerHTML = '';
            container.style.display = 'flex';

            if (isBroadcast) {
                // Ogłoszenie: treść na całą szerokość
                const bodyEl = document.createElement('div');
                bodyEl.className = 'konw-broadcast-body';
                bodyEl.textContent = msg.body || '';
                container.appendChild(bodyEl);
            } else {
                // Wiadomość: wątek (oryginał + odpowiedzi)
                const msgDate = msg.createdAt ? msg.createdAt.toDate() : new Date();
                let lastDateStr = '';
                const addSepIfNeeded = (date) => {
                    const ds = date.toDateString();
                    if (ds !== lastDateStr) { addDaySeparator(container, date); lastDateStr = ds; }
                };
                addSepIfNeeded(msgDate);
                appendMsgBubble(container, msg, fromName);

                // Wczytaj odpowiedzi z Firebase
                if (db && msg.id) {
                    try {
                        const repliesSnap = await db.collection('messages')
                            .where('replyTo', '==', msg.id)
                            .orderBy('createdAt', 'asc')
                            .get();
                        for (const doc of repliesSnap.docs) {
                            const reply = { id: doc.id, ...doc.data() };
                            const replyDate = reply.createdAt?.toDate ? reply.createdAt.toDate() : new Date();
                            addSepIfNeeded(replyDate);
                            const replyFrom = await getUserName(reply.from);
                            appendMsgBubble(container, reply, replyFrom);
                        }
                    } catch (e) { console.warn('replies:', e); }
                }
            }

            container.scrollTop = container.scrollHeight;
            document.getElementById('konw-overlay').classList.add('open');

            // Oznacz jako przeczytane w Firebase
            if (db && msg.id && !(msg.readBy || []).includes(currentUserId)) {
                db.collection('messages').doc(msg.id).update({
                    readBy: firebase.firestore.FieldValue.arrayUnion(currentUserId)
                }).catch(e => console.warn('readBy:', e));
                msg.readBy = [...(msg.readBy || []), currentUserId];
            }
        }

        function closeKonw(event) {
            if (event && event.target !== event.currentTarget && !event.target.classList.contains('konw-handle-wrap')) return;
            document.getElementById('konw-overlay').classList.remove('open');
            document.getElementById('konw-edit-panel').classList.remove('open');
            currentConversation = null;
        }

        // ── Edycja ogłoszenia ─────────────────────────────────────────────────
        let _editDays = 3;

        function selectEditDays(chip) {
            document.querySelectorAll('#konw-edit-days-grid .vis-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            _editDays = parseInt(chip.dataset.days);
        }

        function openKonwEdit() {
            if (!currentConversation) return;
            document.getElementById('konw-edit-temat').value = currentConversation.title || '';
            document.getElementById('konw-edit-tresc').value = currentConversation.body || '';
            // Ustaw dni (na podstawie expiresAt jeśli dostępne)
            _editDays = currentConversation.visibleDays || 3;
            document.querySelectorAll('#konw-edit-days-grid .vis-chip').forEach(c => {
                c.classList.toggle('selected', parseInt(c.dataset.days) === _editDays);
            });
            document.getElementById('konw-messages').style.display = 'none';
            document.getElementById('konw-edit-panel').classList.add('open');
        }

        function closeKonwEdit() {
            document.getElementById('konw-edit-panel').classList.remove('open');
            document.getElementById('konw-messages').style.display = 'flex';
        }

        async function saveKonwEdit() {
            if (!currentConversation || !db) return;
            const temat = document.getElementById('konw-edit-temat').value.trim();
            const tresc = document.getElementById('konw-edit-tresc').value.trim();
            if (!temat || !tresc) { alert('Wypełnij temat i treść'); return; }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + _editDays);
            const expiresTs = firebase.firestore.Timestamp.fromDate(expiresAt);

            try {
                // Aktualizuj messages
                await db.collection('messages').doc(currentConversation.id).update({
                    title: temat, body: tresc, visibleDays: _editDays
                });
                // Aktualizuj announcements (szukaj po teamId + tytule lub announcementId)
                const annId = currentConversation.announcementId;
                if (annId) {
                    await db.collection('announcements').doc(annId).update({
                        title: temat, body: tresc,
                        expiresAt: expiresTs, visibleDays: _editDays
                    });
                } else {
                    // fallback: szukaj po starym tytule + teamId
                    const snap = await db.collection('announcements')
                        .where('teamId', '==', currentConversation.teamId)
                        .where('title', '==', currentConversation.title)
                        .limit(1).get();
                    if (!snap.empty) {
                        await snap.docs[0].ref.update({
                            title: temat, body: tresc,
                            expiresAt: expiresTs, visibleDays: _editDays
                        });
                    }
                }

                // Odśwież UI
                currentConversation.title = temat;
                currentConversation.body = tresc;
                currentConversation.visibleDays = _editDays;
                document.getElementById('konw-subject').textContent = temat;
                const bodyEl = document.querySelector('.konw-broadcast-body');
                if (bodyEl) bodyEl.textContent = tresc;

                closeKonwEdit();
                console.log('Ogloszenie zaktualizowane');
            } catch (e) {
                console.error('saveKonwEdit:', e);
                alert('Blad zapisu: ' + e.message);
            }
        }

        async function sendReply() {
            const input = document.getElementById('konw-input');
            const content = input.value.trim();
            if (!content || !currentConversation) return;

            const container = document.getElementById('konw-messages');'''

html = html.replace(old_js, new_js, 1)

# ── 4. sendReply: uproszczona wersja (replyTo zamiast nowej wiadomości) ─────────
old_reply_end = '''            input.value = '';
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
            }
        }'''

new_reply_end = '''            input.value = '';
            input.style.height = 'auto';

            // Optymistyczny UI — babelek od razu
            appendMsgBubble(container, {
                from: currentUserId, body: content,
                createdAt: { toDate: () => new Date() }
            }, 'Ty');
            container.scrollTop = container.scrollHeight;

            // Zapis do Firebase — replyTo linkuje do oryginalu
            if (db && currentConversation) {
                const originalId = currentConversation.id;
                const recipientId = currentConversation.from === currentUserId
                    ? (currentConversation.to || [])[0]
                    : currentConversation.from;
                db.collection('messages').add({
                    from: currentUserId,
                    to: recipientId ? [recipientId] : [],
                    type: 'MESSAGE',
                    teamId: currentConversation.teamId,
                    title: currentConversation.title || '',
                    body: content,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    readBy: [currentUserId],
                    replyTo: originalId
                }).catch(e => console.error('sendReply error:', e));
            }
        }'''

html = html.replace(old_reply_end, new_reply_end, 1)

# ── 5. sendNowaWiadomosc: zapisz announcementId do messages ──────────────────────
old_ann_save = '''                if (msgType === 'BROADCAST') {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + selectedDays);
                    await db.collection('announcements').add({
                        teamId: team.teamId,
                        clubId: team.clubId || '',
                        title: temat,
                        body: tresc,
                        createdBy: currentUserId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                        isPinned: false,
                        visibleDays: selectedDays
                    });
                }'''

new_ann_save = '''                if (msgType === 'BROADCAST') {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + selectedDays);
                    const annRef = await db.collection('announcements').add({
                        teamId: team.teamId,
                        clubId: team.clubId || '',
                        title: temat,
                        body: tresc,
                        createdBy: currentUserId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                        isPinned: false,
                        visibleDays: selectedDays
                    });
                    // Zapisz announcementId do wiadomosci aby edycja dzialala
                    await db.collection('messages').doc(
                        (await db.collection('messages')
                            .where('teamId','==',team.teamId)
                            .where('type','==','BROADCAST')
                            .where('title','==',temat)
                            .orderBy('createdAt','desc').limit(1).get()
                        ).docs[0]?.id
                    ).update({ announcementId: annRef.id }).catch(()=>{});
                }'''

html = html.replace(old_ann_save, new_ann_save, 1)

with open('czat.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done - czat4 applied")
