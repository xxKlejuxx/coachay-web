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
