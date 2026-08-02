# COACHAY — Historia sesji
Archiwum zmian | Ostatnia aktualizacja: 2026-03-26

---

## Sesja 2026-03-27 (v3.2)

### `trenerzy.html` — przebudowa i nowe funkcje
- Przebudowa struktury HTML na wzorzec druzyna.html (notch, ctx-switcher, bell-btn, menu-btn-lines)
- Przycisk `+ Zaproś` w nagłówku (tylko TRENER_GLOWNY) → panel zaproszenia
- Panel edycji trenera: imię, rola, bio, coachingSince, licencja, specjalizacja, telefon, toggles widoczności
- Przycisk `Edytuj` w dp-topbar (TRENER_GLOWNY na innych trenerach)
- Przycisk `Usuń trenera z klubu` — dezaktywacja (`isActive: false`), nie kasowanie
- Walidacja: nikt nie może usunąć samego siebie (`t.userId !== currentUserId`)
- `calcExpYears(coachingSince)` — lata obliczane dynamicznie z daty
- Fallback ROLE_LABELS: TRENER_ASYSTENT, ASSISTANT_COACH

### `_szablon.html` — nowy plik
- Gotowy szablon dla nowych ekranów z pełną strukturą (top bar, overlaye, nav, menu panel)
- Komentarze gdzie wstawiać własny content i CSS
- Wzorzec `initEkran()` z pełnym boilerplate

### Architektura — decyzje v3.2
- **Multi-klub**: jeden email = jedno konto Firebase Auth, wiele kontekstów (`contexts[]`)
- **Rejestracja trenera** w nowym klubie: wykrycie istniejącego emaila → dodanie kontekstu
- **Przypisanie trenera**: `teamIds[]` zamiast kontekstu `type: 'KLUB'` — prostsze i wystarczające
- **Historia uprawnień**: `roleHistory[]` z polami `from` + `to` + `changedAt` + `changedBy`
- **isClubAdmin**: flaga w `trainers` + kontekst `type: 'KLUB'` w `users.contexts[]`
- **Wizard rozwiązania drużyny**: 4 kroki, szczegóły w ARCHITEKTURA.md
- **RODO**: anonimizacja przy usuwaniu (nie widoczność historycznych danych osobowych)
- **Zastępstwa**: brak dedykowanego mechanizmu — admin ręcznie zmienia rolę

### Nierozwiązane (TODO)
- Edycja własnego profilu trenera
- Avatar/zdjęcie w panelu edycji
- Historia kodów (wszystkie statusy) + pole email w zaproszeniu
- Walidacja TRENER_GLOWNY przy zmianie roli
- Przypisanie drużyn w edycji trenera

---

## Sesja 2026-03-26 (v3.1)

### `trainers` — nowa kolekcja Firestore
- Nowa kolekcja `trainers` — analogicznie do `players` (rekord sportowy trenera, nie konto)
- Wgrane dwa dokumenty demo:
  - `trainer_20260326_00001`: Jan Kowalski (TRENER_GLOWNY, team_orly_u10)
  - `trainer_20260326_00002`: Tomasz Nowak (TRENER_POMOCNICZY, team_orly_u10)
- Pola: `trainerId`, `userId`, `clubId`, `teamIds`, `teamNames`, `role`, `displayName`, `email`, `isActive`, `coachProfile` (bio, experienceYears, licenseLevel, specialization, phone, phoneVisible, emailVisible, photoConsent)

### `users` — aktualizacja
- Usunięto pole `coachProfile` z dokumentów `demo_trener_jan` i `demo_trener_asystent` (przeniesione do `trainers`)
- Dodano pole `trainerId` linkujące do kolekcji `trainers`

### `trenerzy.html`
- `loadTrainers()` przepisane — query `db.collection('trainers').where('clubId', '==', currentClubId)` zamiast filtrowania całych `users`
- `renderTrainers()` — sortowanie przez `t.role` (nie `t.contexts`)
- `buildTrainerCard(t)` — używa `t.role`, `t.teamNames`, `t.coachProfile`
- `openDetailPanel(t)` — używa `t.role`, `t.teamNames`, `t.coachProfile`, `t.userId`
- Dane kontaktowe: `cp.emailVisible` + `t.email` (email trenera na dokumencie trainera)
- "Wyślij wiadomość" → `czat.html?to=t.userId`
- Filtrowanie `isActive !== false` po stronie JS (brak potrzeby indeksu compound)

### Decyzje architektoniczne
- **TRENER_GLOWNY** może mieć raport obecności trenerów na treningach/meczach w przyszłości
- `isActive: false` zamiast usuwania — historia zachowana (jak `players`)
- `users.coachProfile` → **USUNIĘTE** (v3.1)
- `users.trainerId` → link do `trainers` (v3.1)

---

## Sesja 2026-03-26 (v3.0)

### `coachay-core.js`
- `manageNotifications(action, referenceType, referenceId, payload)` — globalna funkcja zarządzania powiadomieniami
  - `action`: `'create'` | `'edit'` | `'delete'`
  - `referenceType`: `'event'` | `'message'` | `'task'`
  - `edit` → wygasza stare powiadomienia (isRead: true) + tworzy nowe
  - `delete` → kasuje powiadomienia całkowicie z Firestore
  - `create` → tylko tworzy nowe
  - Zastępuje wszystkie ręczne bloki createNotification w czat/kalendarz/zadania

### `czat.html`
- Powiadomienia `NEW_MESSAGE` wysyłane przy odpowiedzi w wątku (`sendReply`)
- Fix: `recipientId` obliczany jako "ktokolwiek w rozmowie kto NIE jest currentUserId" (wcześniej błędna logika from/to)
- Fix: `_latestReplyFrom` aktualizowane optimistycznie po wysłaniu odpowiedzi (lista wiadomości odświeża się bez reload)
- `sendNowaWiadomosc` i `saveKonwEdit` — używają `manageNotifications` zamiast ręcznego kodu

### `zadania.html`
- Fix: edycja zadania tworzyła NOWE zamiast edytować — `closeDetailPanel(keepTask=true)` zachowuje `detailTask`
- Walidacja daty wstecz dodana do `saveTaskEdit()` (była tylko w `saveTask`)
- Sortowanie zadań: najnowsze (`createdAt` malejąco) zamiast po `dueDate`
- `saveTask`, `saveTaskEdit`, `deleteTask` — używają `manageNotifications`

### `kalendarz.html`
- `saveEvent` i `saveEventEdit` — używają `manageNotifications` zamiast bezpośredniego `createNotificationsForEvent`

### Decyzje architektoniczne
- Jeden punkt zarządzania powiadomieniami → łatwiejsze zmiany i testowanie
- `referenceType: 'message'` używany dla MESSAGE i BROADCAST (rozróżnienie przez `type` powiadomienia)

### Naprawione bugi
| Bug | Fix |
|-----|-----|
| Odpowiedź trenera nie generowała powiadomienia dla rodzica | Błędny `recipientId` — nowa logika `participants.find(id !== currentUserId)` |
| Lista wiadomości nie odświeżała nadawcy po odpowiedzi | Brak aktualizacji `_latestReplyFrom` w optimistycznym UI |
| Edycja zadania tworzyła nowe zamiast edytować | `closeDetailPanel()` nullował `detailTask` — dodano parametr `keepTask` |

---

## Sesja 2026-03-26 (v2.9)

### `coachay-core.js` (cache buster: `?v=20260326b`)
- `getTeamAnnouncements()` przepisane — agreguje `announcements` (AUTO_TYPES) + `messages` (BROADCAST)
- BROADCAST z `archived: true` filtrowane po stronie JS (bez nowego indeksu Firestore)
- Stare pole `mergeAnnouncementDates()` usunięte (nie potrzebne)

### `czat.html`
- Zakładki: 💬 Wiadomości | 📢 Ogłoszenia z `switchTab()` + `currentTab`
- FAB widoczność per rola: `updateFabVisibility()` — trener: obie zakładki; rodzic/zawodnik: tylko Wiadomości; kibic: brak
- `sendNowaWiadomosc()` — BROADCAST zapisywany **tylko do `messages`** z `expiresAt` i `visibleDays`
- Formularz ogłoszenia: chip-selector "Widoczne przez" (1/3/7/14/30 dni)
- `saveKonwEdit()` — edytuje tylko `messages`, zachowuje `expiresAt`
- `deleteOgloszenie()` — archiwizuje (`archived: true`), nie usuwa; znika natychmiast z listy
- `allMessages` — filtr `archived: true` we wszystkich 3 miejscach ładowania
- `isTrainer` check: `currentUserRole.includes('TRENER') || === 'OWNER'` (pokrywa wszystkie warianty roli)
- Fix: po zapisaniu BROADCAST → zostaje na zakładce Ogłoszenia (bug: `closeNowa()` resetował `selectedMsgType`)
- Fix: `createMessageCard` pokazuje `editedBy`/`editedAt` dla BROADCAST po edycji
- Fix: `msg-validity` — zielone dla aktywnych, przekreślone szare dla wygasłych

### `start.html`
- `validAnns` filter: pomija `archived`, `_fromMessages` bez `expiresAt`, `isDemo` bez `expiresAt`
- `MAX_ANN` zwiększone z 2 do 3

### Decyzje architektoniczne
- BROADCAST = jedyne źródło prawdy w `messages` (nie duplikowane w `announcements`)
- `announcements` tylko dla AUTO_TYPES (system)
- Archiwizacja zamiast usuwania (`archived: true`)
- Nowe BROADCAST zawsze mają `expiresAt` (stare bez expiresAt pomijane na Start)

### Naprawione bugi
| Bug | Fix |
|-----|-----|
| Po zapisaniu ogłoszenia przełączało na Wiadomości | `closeNowa()` resetował `selectedMsgType` — użyto lokalnej zmiennej `msgType` |
| Zarchiwizowane ogłoszenia widoczne do odświeżenia | `allMessages.filter(m => m.id !== msgId)` po archiwizacji + `renderMessages()` |
| Przycisk Edytuj/Usuń nie pojawiał się | `isTrainer` sprawdzał tylko `TRENER_GLOWNY` — zmienione na `.includes('TRENER')` |
| Stare BROADCAST bez `expiresAt` na Start | Filtr `_fromMessages && !expiresAt → false` |

---

## Sesja 2026-03-24 (v2.8)

### `coachay-core.js`
- `isEventInReminderWindow(event)` — globalna funkcja, jedna logika dla dashboardu i dzwonka
- Powiadomienia `expired` ukrywane z widoku (filtr w `loadAndRenderNotifications`)
- Synchronizacja attendance → powiadomienie: po kliknięciu na dashboardzie `att.confirmed/declined` → `actionDone: true`
- `onUserRegisteredWithCode(codeData, newUser)` — rejestracja z kodem, aktualizacja `guardianIds`, powiadomienie trenera

### `start.html`
- `MAX_EVENTS = 3` eventów + `MAX_ANN = 2` ogłoszeń osobno na dashboardzie
- Filtr `isEventInReminderWindow` zastępuje ręczny warunek w `loadUpcomingEvents` i `loadNextMatch`

### `mecz.html`
- `setCurrentUserData()` przy inicjalizacji
- `isVisible()` przy filtrowaniu meczy
- Komunikat "Brak meczy w kalendarzu drużyny na dziś"

### `druzyna.html` — pełna przebudowa od zera (v2.8)
- Lista zawodników: awatary DiceBear Adventurer, sortowanie, liga tylko dla trenera
- Profil zawodnika: frekwencja per typ eventu (X/Y + paski %), absencje aktywne
- Picker awatara: grid 20 losowych miniaturek, "Generuj ponownie", styl chłopiec/dziewczynka
- Kody dostępu: typy RODZIC/ZAWODNIK/KIBIC, lista z historią, modal 3 opcji (dezaktywuj/zachowaj/anuluj)
- Dodawanie/edycja zawodnika: imię*, data urodzenia*, grupa*, pozycja, numer, liga
- Notatki trenera, generowanie kodu dostępu
- Absencje: panel zgłaszania, lista aktywnych, usuwanie
- `guardianIds: []` zamiast `guardianId: string` w nowych zawodnikach
- Globalne komponenty: top-bar, ctx-overlay, notif-overlay, menu-panel, bottom-nav

---

## Sesja 2026-03-23/24 (v2.7)

### `coachay-core.js` v2.7 (1627 linii)
- Globalne: `currentUserData`, `setCurrentUserData()`, `getMyPlayerIds()`, `getObservedPlayerIds()`
- `isVisible(event)` — sprawdza invited + visibleTo + fallback
- `getAttendanceStatus(att, invited)` — status per zawodnik (mapa)
- `hasResponded()` — szuka TYLKO po playerIds (nie userId rodzica)
- `getTargetId()` — przeniesiony z ekranów do core
- Obserwator → Kibic w `loadCtxOverlay` i `loadMenuPanel`
- Auto-deaktywacja powiadomień: przeszłe, FINISHED, absencje, usunięte eventy
- Sprawdzanie absencji w powiadomieniach
- Lokalna data zamiast UTC w porównaniach

### `start.html` v6 (1237 linii)
- Per-dziecko potwierdzanie: osobne wiersze per zawodnik
- Forma gramatyczna per rola (rodzic: Będzie/Nie będzie, zawodnik: Będę/Nie będę)
- Sprawdzanie absencji przy wyświetlaniu eventów
- Blokada potwierdzania po terminie / FINISHED
- `reopenMatch()` — cofnięcie zakończenia meczu
- Karuzela: description pod tytułem, ellipsis, usunięty label z góry
- Filtr `reminderHoursBefore` na karuzeli i eventach
- Sortowanie: eventy z potwierdzeniem → chronologicznie → ogłoszenia
- `playerNamesCache` — cache imion zawodników
- Usunięte lokalne funkcje (przeniesione do core)

### `kalendarz.html` v2.7 (2803 linii)
- `setCurrentUserData()` w `initCalendar` — `isVisible()` działa
- `isVisible()` filtruje eventy w siatce i liście (nie-trenerzy)
- Wszyscy widzą pełną listę obecności (bez filtrowania per rola)
- Fix reminder 0 (`parseInt || 48` → `isNaN ? 48 : value`)
- Liczniki znaków: tytuł 25 (MECZ) / 40 (reszta) + opis 50
- Usunięte chipy "Rodzice" i "Kibice" — automatyczne visibleTo
- visibleTo budowane z `players.guardianId` + kibice zawsze
- Auto-decline graczy z absencją przy tworzeniu eventu
- Bug chipów naprawiony — zaznaczenia zachowane przy przełączaniu
- Nagłówki składów (FIRST/SECOND/THIRD) na liście osób
- Obserwator → Kibic w ROLE_LABELS

---

## Sesja 2026-03-23 (v2.6)

### `start.html` v5, `coachay-core.js` v2.6, `mecz.html` przebudowa od zera
- Kolekcja `matches` → `events` z `matchData`
- Asystent meczowy: trener ZAWSZE może przejąć, rodzic za zgodą
- ctx-overlay i menu-panel — globalne funkcje w coachay-core.js
- Dashboard v5: kompletna przebudowa
- mecz.html: przebudowa od zera z Firebase

---

## Sesja 2026-03-20/21 (v2.4-2.5)

### `start.html` v4 — kompletna przebudowa dashboardu
- Dynamiczne dane z Firebase
- Karuzela meczy (scroll-snap)
- Najbliższe wydarzenia z potwierdzaniem
- Zadania z Firebase

---

## Sesja 2026-03-17

### System powiadomień w `coachay-core.js`
- Pełny CRUD + UI overlay
- Przyciski Będę/Nie będę, `forPlayerId`, `decidedBy`
- Powiadomienia krzyżowe rodzic↔zawodnik
- Auto-cleanup (14/60 dni)

---

## Sesja 2026-03-15/16

### Nowe ekrany i Firebase
- `start.html` v2 — dynamiczne Firebase
- `kalendarz.html` — nowy ekran od zera
- Kolekcje: `events`, `absences`, `tasks`, `trainingTopics`
- `admin-importer.html` naprawiony
- Bottom nav: Giełda → Kalendarz

---

## Sesja 2026-03-10

### `czat.html`
- Lista wiadomości z Firebase
- Filtry, overlay nowa wiadomość
- TODO: wysyłanie

---

## Sesja 2026-03-09 #1-2

### Fundamenty
- Firebase setup
- `druzyna.html` — pierwsza wersja
- `mecz.html` — pierwsza wersja

---

## Kluczowe decyzje architektoniczne (chronologicznie)

| Data | Decyzja |
|------|---------|
| 03-09 | Firebase Authentication + Firestore jako backend |
| 03-15 | Kalendarz = dziennik trenera (wymóg urzędowy) |
| 03-15 | `invited` puste ≠ "wszyscy" — puste = nikt |
| 03-17 | Rodzic potwierdza DZIECKO nie siebie — `forPlayerId` kluczowy |
| 03-20 | Kolekcja `matches` → `events` z `matchData` |
| 03-23 | `decidedBy` — kto zgłosił, nie kto jest na liście |
| 03-23 | Trener ZAWSZE może przejąć mecz (bez pytania) |
| 03-24 | `invited` = tylko playerIds + trenerzy. Rodzice i kibice w `visibleTo` |
| 03-24 | Kolekcja `players` osobno od `users` |
| 03-24 | Statystyki docelowo w osobnej kolekcji z podziałem per drużyna/okres |
| 03-24 | `guardianId` (string) → `guardianIds` (array) |
| 03-24 | Obserwator → Kibic (UI tylko, baza nadal OBSERWATOR) |

---

## Naprawione bugi (archiwum)

| Bug | Fix |
|-----|-----|
| Firebase Hosting cache agresywny | `?v=timestamp` w URL pliku JS |
| `array-contains` NIE DZIAŁA na obiektach | Filtruj w JS po fetch |
| `orderBy` powoduje silent hangs | Usuń `orderBy`, sortuj w JS |
| CSS slide-in overlay nie działa z `display:none` | Użyj `opacity` + `visibility` |
| Notif bell auto-load — `firebase.apps.length` w DOMContentLoaded | Polling 500ms |
| `parseInt('0') \|\| 48` daje 48 | Użyj `isNaN` check lub `??` |
| UTC vs lokalna data w filtrach | `toLocaleDateString` lub manualna budowa stringa |
| Duplikaty funkcji po edycji Pythonem | Zawsze weryfikuj przed outputem |
| `invited` = [] nie znaczy "wszyscy" | Pusta lista = nikt zaproszony |
