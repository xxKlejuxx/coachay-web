# COACHAY — Zasady pracy i instrukcja techniczna
Wersja: 2.8 | Data: 2026-03-24

---

## Zasady pracy z Claude

1. Użytkownik zawsze uploaduje aktualne pliki na początku sesji.
2. Do czytania plików zawsze używaj narzędzia VIEW — nigdy grep ani strings.
3. Nie czytaj tych samych plików wielokrotnie — czytaj raz i pamiętaj do końca sesji.
4. Numery linii z VIEW są wiarygodne — z innych narzędzi nie.
5. Przed zmianą CSS sprawdź czy selektor nie występuje wcześniej (duplikaty!).
6. Przed zmianą JS sprawdź czy funkcja nie jest już zdefiniowana.
7. Gdy usuwasz wiele elementów — podawaj numery linii od dołu pliku.
8. Przy wątpliwościach co do numeru linii — sprawdź VIEW zamiast zgadywać.
9. Nie edytuj pliku MD z zasadami — użytkownik aktualizuje go sam po każdej sesji.
10. Użytkownik ma minimalną wiedzę o programowaniu — podawaj szczegółowe instrukcje krok po kroku.
11. Nigdy nie każ użytkownikowi sprawdzać co jest w kodzie jeśli czytałeś plik — sam to wiesz.
12. Podając instrukcje zmian zawsze podawaj: typ elementu (funkcja JS / tag HTML / reguła CSS), starą całą linię i nową docelową linię.
13. **Nie twórz żadnych plików i nie koduj bez wyraźnej zgody użytkownika.**
14. Najpierw rozmowa i ustalenia — dopiero potem kodowanie.
15. Nie powtarzaj błędów które już były naprawione.
16. Przy wątpliwościach — zapytaj zamiast zgadywać.
17. Jeśli masz utworzyć plik — zawsze zapisuj w kodowaniu UTF-8 z pełnymi polskimi znakami (ą, ę, ś, ź, ż, ó, ć, ń, ł).
18. Zachowuj się jak profesjonalny CTO i SEO specialist.
19. Nie proś użytkownika o wgrywanie pliku jeśli znasz już strukturę kodu.
20. Bierz najlepsze sprawdzone wzorce UX z innych aplikacji — nie wymyślaj koła na nowo.
21. Aktywnie proponuj sprawdzone rozwiązania bez czekania na pytanie.
22. Wszystkie pliki i komentarze w kodzie pisz po polsku z pełnymi polskimi znakami.
23. Nigdy nie dawaj użytkownikowi zmian do naniesienia ręcznie — sam twórz/aktualizuj pliki.
24. Dane JSON do importu zawsze w formacie `{"nazwaKolekcji": [...]}` — gotowym do wklejenia w admin-importer.html.
25. **Nigdy nie zmieniaj nazw plików JS/CSS** — użytkownik ma skrypt PowerShell do referencji.
26. **Przy edycji plików Pythonem: ZAWSZE weryfikuj duplikaty funkcji i balans nawiasów przed outputem.**
27. **Przy każdym zapisie pliku HTML, aktualizuj wersję `coachay-core.js?v=TIMESTAMP`** w tagu `<script src="coachay-core.js">` aby Firebase Hosting nie trzymał starego cache. Przykład: `<script src="coachay-core.js?v=20260324"></script>`

---

## Struktura plików projektu

```
coachay-5c3c9.web.app/
├── _global.css          — style globalne, zmienne CSS
├── coachay-core.js      — globalny JS (Firebase, powiadomienia, UI)
├── login.html           — logowanie i rejestracja
├── start.html           — dashboard (ekran startowy)
├── druzyna.html         — lista zawodników, profile, kody
├── mecz.html            — obsługa meczu na żywo
├── czat.html            — wiadomości
├── kalendarz.html       — kalendarz / dziennik trenera
├── gielda.html          — giełda sparingów
├── zadania.html         — zadania drużyny
├── ustawienia.html      — ustawienia (w budowie)
└── admin-importer.html  — narzędzie importu danych JSON
```

### Plik globalny `coachay-core.js` — funkcje

**Firebase:** `initFirebase`, `isDemoMode`, `getDemoRole`, `getCurrentUserId`, `getCurrentUser`, `getCurrentTeam`, `logout`, `getTeamPlayers`, `getTeamMatches`, `getTeamAnnouncements`, `getSparringOffers`, `getTeamMessages`, `getUserName`, `getUserTeams`, `getTeamMembers`, `getClubMembers`, `getTeamTasks`, `getTeamEvents`, `getClubTopics`, `getInviteCodes`

**Użytkownik:** `setCurrentUserData`, `getCurrentUserData`, `getMyPlayerIds`, `getObservedPlayerIds`, `isVisible`, `isEventInReminderWindow`, `getAttendanceStatus`, `hasResponded`, `getTargetId`

**Powiadomienia:** `getUserNotifications`, `createNotification`, `createNotificationsForEvent`, `onUserRegisteredWithCode`, `handleNotificationAction`, `sendCrossNotification`, `markNotificationRead`, `countUnreadNotifications`, `loadAndRenderNotifications`, `renderNotifOverlay`, `clearNotifs`, `resetNotifAction`, `confirmAttendanceFromNotif`, `declineAttendanceFromNotif`, `getTimeAgo`, `afterNotifAction`, `completeTaskFromNotif`, `rejectTaskFromNotif`, `resetTaskNotifAction`, `approveTakeoverFromNotif`, `rejectTakeoverFromNotif`

**UI:** `toggleCtxOv`, `pickCtx`, `toggleNotifOv`, `closeNotifOv`, `openLogin`, `closeLogin`, `authTab`, `toggleMenu`, `closeMenu`, `openPanel`, `closePanel`, `mzChange`, `loadCtxOverlay`, `loadMenuPanel`

**Daty:** `formatDateTimeDisplay`, `formatDateDisplay`, `formatDateShort`

---

## Firebase

- **Projekt:** coachay-5c3c9
- **Region:** europe-west
- **Usługi:** Authentication, Firestore, Hosting, Cloud Messaging (planowane)
- **Demo mode:** `localStorage.demoMode = 'true'`, `localStorage.demoRole`, `localStorage.currentUserId`

### Kolekcje Firestore

| Kolekcja | Opis |
|----------|------|
| users | Konta użytkowników |
| teams | Drużyny |
| clubs | Kluby |
| players | Rekordy sportowe zawodników (osobno od users) |
| events | Wszystkie eventy (treningi, mecze, wyjazdy, inne) |
| absences | Długoterminowe nieobecności zawodników |
| notifications | Powiadomienia (tymczasowe — auto-cleanup) |
| messages | Wiadomości czatu |
| announcements | Ogłoszenia |
| tasks | Zadania |
| trainingTopics | Tematy treningów |
| inviteCodes | Kody dostępu (RODZIC / ZAWODNIK / KIBIC / TRENER) |
| sparringOffers | Oferty sparingów |

### Kluczowe pola

```javascript
// users
{ uid, displayName, role, contexts: [], children: [], playerId, guardianIds: [] }

// players — osobno od users! player = rekord sportowy, user = konto
{ playerId, name, birthDate, squad, position, number,
  guardianIds: [],        // ← tablica (nie guardianId string!)
  teams: [{ teamId, status }],
  coachOnlyData: { coachNotes, level },
  publicData: { goals, matches, ... } }

// events
{ eventId, teamId, type, date, attendance: {
    invited: [],          // playerIds + trener userIds (BEZ rodziców/kibicow)
    confirmed: [], declined: [], decidedBy: {}
  },
  visibleTo: [],          // userId rodziców + kibicow
  matchData: { matchStatus, result, liveAssistant, ... }
}

// inviteCodes
{ codeId, code, type: 'RODZIC'|'ZAWODNIK'|'KIBIC'|'TRENER',
  playerId, teamId, createdBy, createdAt, expiresAt,
  isUsed, usedAt, usedBy }

// notifications
{ notificationId, userId, teamId, type, title, body,
  referenceId, referenceType, forPlayerId,
  requiresAction, actionType, actionDone, actionResult,
  createdAt, isRead, priority }
```

---

## Zasady techniczne

### CSS i zmienne
- Zmienne globalne w `_global.css`: `--tlo`, `--tlo-karta`, `--border`, `--akcent`, `--sukces`, `--blad`, `--warn`, `--szary`, `--font`, `--font-d`, `--r`, `--r-pill`, `--nav-h`, `--top-h`, `--phone-w: 390px`, `--phone-h: 844px`
- Overlay panele (detail-panel, abs-panel itd.) muszą być **direct children of `.phone`**, nie inside `screen-body`
- Slide-in: używaj `opacity: 0` + `visibility: hidden` (nie `display: none`) dla CSS transitions

### JavaScript
- Nie używaj `orderBy` w Firestore — sortuj w JS
- `array-contains` NIE DZIAŁA na zagnieżdżonych obiektach — filtruj w JS po pobraniu
- Auto-load powiadomień: polling co 500ms (max 10s), nie sprawdzaj `firebase.apps.length` w `DOMContentLoaded`
- `userId ≠ playerId` — zawodnik `demo_zawodnik_jasiek` ma `playerId: demo_player_jasiek`
- `invited` puste ≠ "wszyscy" — puste = nikt zaproszony
- Rodzic potwierdza DZIECKO nie siebie — `forPlayerId` jest kluczowy
- `parseInt('0') || 48` daje 48 bo 0 jest falsy — używaj `isNaN` check lub `??`
- UTC vs lokalna data: `toISOString().slice(0,10)` daje UTC! Używaj lokalnej daty
- **Duplikaty funkcji w JS** — zawsze sprawdzaj po edycji Pythonem

### Daty
- Zapis: ISO string `YYYY-MM-DD`
- Wyświetlanie: `formatDateDisplay()` / `formatDateTimeDisplay()` / `formatDateShort()`
- Zawsze lokalna data, nie UTC

### Firebase Hosting cache
- Agresywnie cachuje pliki JS
- Niezawodna metoda: `<script src="coachay-core.js?v=YYYYMMDD"></script>` — aktualizuj przy każdym wgraniu
- Do testowania: hard refresh (Ctrl+Shift+R) lub incognito

### Firestore jest schemaless
- Zawsze waliduj i dodawaj domyślne wartości w kodzie
- Stare dokumenty mogą nie mieć nowych pól — obsługuj `|| []`, `|| {}`, `?? 0`

---

## Demo dane w Firebase

- **Klub:** `club_orly_praga` (Orły Praga FC)
- **Drużyna:** `team_orly_u10` (U10 Orły)
- **Zawodnicy:** 15 (demo_player_*)
- **Userzy:**
  - `demo_trener_jan` — TRENER_GLOWNY
  - `demo_trener_asystent` — TRENER_POMOCNICZY
  - `demo_rodzic_anna` — RODZIC (dzieci: demo_player_jasiek, demo_player_ania)
  - `demo_zawodnik_jasiek` — ZAWODNIK (playerId: demo_player_jasiek)
  - `demo_obserwator_babcia` — OBSERWATOR/Kibic

### Znane braki w demo danych
- `players.squad` nie ustawione → domyślnie `'FIRST'`
- `players.guardianIds` zamiast `guardianId` — wymaga migracji
- Kolekcja `matches` — DO USUNIĘCIA
- Stare eventy mogą nie mieć `visibleTo` — fallback w `isVisible()` obsługuje

---

## Styl kodu

- Wszystkie komentarze i teksty UI po polsku z pełnymi polskimi znakami
- Nazwy funkcji: camelCase po polsku (`zaladujZawodnikow`, `otworzProfil`)
- Nazwy zmiennych: camelCase po polsku (`aktualnyZawodnik`, `wszyscyZawodnicy`)
- Konsola: `✅ Opis akcji` dla sukcesu, `❌ Błąd` dla błędów
- Brak `alert()` dla błędów UX — używaj własnych modalów lub inline feedback
