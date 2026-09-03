# Claude Session Sync

Format wpisu: `[YYYY-MM-DD HH:MM] [WEB|APP] [DONE|TODO|INFO] treść`

---

[2026-09-04 10:00] [WEB] [DONE] functions/index.js — sendNotificationsForEvent: dodano param filterPlayerIds (null = wszyscy, array player_xxx = tylko ci)

[2026-09-04 10:00] [WEB] [DONE] functions/index.js — onEventUpdated: dodano blok C — wykrywa nowo zaproszonych graczy (diff attendance.invited before/after) i wysyła im EVENT_ATTENDANCE/EVENT_CREATED przez sendNotificationsForEvent z filterem

[2026-09-04 10:00] [APP] [TODO] coachay-core.js — funkcja manageNotifications: usuń cały blok poniżej (dotyczy create i edit — CF obsługuje oba):
```js
if (referenceType === 'event') {
    const { event, absences = [] } = payload;
    await createNotificationsForEvent(event, absences);
}
```
CF triggers: onEventCreated (nowy event) + onEventUpdated blok C (nowo zaproszeni przy edycji).
Chat i task zostają w frontend — CF nie ma dla nich triggerów.

[2026-09-04 00:50] [APP] [DONE] src/lib/calendar.ts — usunięto tworzenie powiadomień client-side dla eventów (create + edit), zgodnie z wpisem WEB wyżej. Edit-path zostaje tylko expireNotificationsForReference (wygaszanie starych) — nowe tworzy wyłącznie CF (onEventCreated / onEventUpdated blok B+C).

[2026-09-04 00:50] [APP] [DONE] functions/index.js zsynchronizowane z wersją WEB (identyczna baza) + dołożone: KIBIC w resolveInvitedUserIds (brakował, obejmuje tylko odwołanie/zmianę eventu), fix wielkości liter statusu w onMembershipCreated ((m.status||'').toLowerCase()) — appka mobilna zapisuje status membershipu jako 'ACTIVE' (duże litery) przy dołączeniu kodem, ten check tego nie łapał.

[2026-09-04 00:50] [APP] [INFO] sendNotificationsForEvent — zmieniona konsolidacja rodzic/kibic (decyzja Rafała, świadomie inna niż wcześniejsza wersja WEB): przy wymaganej akcji (Będę/Nie będę) RODZIC dostaje osobne powiadomienie per dziecko (własny przycisk), KIBIC w tym przypadku NIE dostaje żadnego powiadomienia (nie potwierdza obecności). Bez wymaganej akcji — jak dotychczas, jedno zbiorcze dla obu ról. Czeka na deploy po stronie Rafała.
