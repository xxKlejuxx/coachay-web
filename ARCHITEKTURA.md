# COACHAY — Architektura i schemat danych
Wersja: 4.0 | Data: 2026-03-27

---

## Schemat kolekcji Firestore


### Decyzja: kolekcja `clubs` + hierarchia club → teams
- [ ] Migracja: każdy obecny `team` → nowy `club` + jeden domyślny `team` wewnątrz
- [ ] Schemat `clubs`: clubId, name, createdBy, createdAt
- [ ] Schemat `teams`: dodać `clubId` (FK do clubs), `headCoachId`
- [ ] `memberships`, `events`, `messages` — zostają na poziomie `teamId` (bez zmian)
- [ ] `login.html` — przy rejestracji TRENER_GLOWNY tworzy `club` + `team` (zamiast tylko `team`)
- [ ] `coachay-core.js` — `currentClubId` obok `currentTeamId`

### `users`

Dane **globalne** — niezależne od klubu. Wszystko co dotyczy relacji z klubem → `memberships`.

```javascript
{
  uid: string,
  displayName: string,           // NIE 'name'!
  email: string | null,
  hasEmail: boolean,             // false = konto przez social login lub phone
  authProvider: 'email' | 'google' | 'apple' | 'facebook' | 'phone',

  // USUNIĘTE v3.7 → przeniesione do memberships:
  // role, playerId, trainerId, children[], observedChildren[]

  // Awatar
  avatarUrl: string | null,
  avatarGender: 'male' | 'female' | null,

  // Auth
  pinHash: string | null,        // SHA-256 4-cyfrowego PINu blokady ekranu (Web Crypto API)
  // coachProfile USUNIĘTE v3.0 → przeniesione do trainers collection

  // Zgody RODO (v3.7)
  photoConsent: boolean,         // zgoda na używanie zdjęcia/awatara
  termsAcceptedAt: string | null,   // ISO — kiedy zaakceptował regulamin
  rodoAcceptedAt: string | null,    // ISO — kiedy zaakceptował politykę prywatności

  // Status konta
  accountStatus: 'active' | 'banned',  // ban globalny — tylko ADMIN_PLATFORMY
  // Ochrona przed spamem botów → Firebase App Check (nie accountStatus)
  isReadOnly: boolean,           // globalny przełącznik zapisu — patrz: memberships.isReadOnly

  language: string,              // 'pl'
  createdAt: timestamp,
  lastLoginAt: timestamp,
  isDemo: boolean,
  demoSetId: string
}
```

> **DECYZJA v4.2 (2026-04-11):** `pinHash` — SHA-256 4-cyfrowego PINu liczone client-side przez Web Crypto API. Nie jest to hasło Firebase Auth. PIN jest globalny dla użytkownika (jeden dla wszystkich klubów). Ekran blokady odpala się po 5 min nieaktywności (`localStorage.appLastActive`). Brak PINu → obowiązkowy setup przy pierwszym `initSession()`. Demo mode i impersonacja omijają PIN check. Reset: "Nie pamiętam PINu" → usuwa `pinHash` z Firestore + wylogowuje → po ponownym loginie wymagany setup.

> **DECYZJA v3.7:** `users` przechowuje wyłącznie dane personalne i auth (globalne). Rola, relacje z zawodnikami/drużynami → `memberships`.
> **DECYZJA v4.1:** `contexts[]` USUNIĘTE z `users`. Zastąpione zapytaniem `memberships.where('userId == uid')` przy starcie aplikacji. Powód: contexts[] musiałoby być synchronizowane przy każdej zmianie membership → ryzyko niespójności. Memberships i tak jest pobierane przy starcie (potrzebne isReadOnly, status, playerId, trainerRole) — zero dodatkowych odczytów.
> **DECYZJA v3.7:** `accountStatus: 'banned'` — tylko dla globalnego bana przez ADMIN_PLATFORMY (naruszenie regulaminu w wielu klubach). Ochrona przed spam botami → Firebase App Check (infrastruktura, nie dane).

### `players`
```javascript
{
  playerId: string,              // 'demo_player_jasiek'
  name: string,
  birthDate: string,             // 'YYYY-MM-DD'
  position: string,
  number: number,
  squad: 'FIRST' | 'SECOND' | 'THIRD',  // ← NOWE v2.7
  photoURL: string,              // URL DiceBear lub własne zdjęcie
  photoConsent: boolean,
  guardianIds: [],               // ← ZMIANA v2.8 (było: guardianId string)
  guardianData: { guardianName, guardianEmail, guardianPhone, address },
  history: [],
  teams: [{ teamId, status: 'ACTIVE' | 'INACTIVE' }],
  coachOnlyData: {
    coachNotes: string,
    level: string                // Liga — widoczne tylko dla trenera
  },
  publicData: {
    goals: number,
    assists: number,
    matches: number,
    attendance: string,          // TODO: przenieść do osobnej kolekcji
    yellowCards: number,
    redCards: number,
    cleanSheets: number
  },
  userAccountId: string | null,  // userId jeśli ma konto
  createdAt: timestamp,
  createdBy: string,
  isDemo: boolean,
  demoSetId: string,
  demoVisibleFor: [],
  demoEditableBy: []
}
```

> **DECYZJA v2.7:** Kolekcja `players` osobno od `users`. Player = rekord sportowy (statystyki, skład, zgody). User = konto w aplikacji.
> **DECYZJA v2.7:** Statystyki docelowo w osobnej kolekcji z podziałem per drużyna/okres.

### `trainers`
```javascript
{
  trainerId: string,             // 'trainer_YYYYMMDD_XXXXX'
  userId: string,                // klucz do users (konto w aplikacji)
  clubId: string,
  teamIds: [string],             // drużyny trenera
  teamNames: [string],           // denormalizacja nazw drużyn
  role: 'TRENER_GLOWNY' | 'TRENER_POMOCNICZY' | 'OWNER',
  displayName: string,
  email: string | null,
  isActive: boolean,             // false = archiwum (nie usuwa danych)
  coachProfile: {
    bio: string,
    experienceYears: number,
    licenseLevel: string,        // np. 'UEFA B', 'UEFA A'
    specialization: string,
    phone: string | null,
    phoneVisible: boolean,       // widoczny dla rodziców/zawodników
    emailVisible: boolean,
    photoURL: string | null,
    photoConsent: boolean
  },
  createdAt: string,             // ISO timestamp
  createdBy: string,             // userId trenera głównego
  isDemo: boolean,
  demoSetId: string
}
```

> **DECYZJA v3.0:** Kolekcja `trainers` osobno od `users` — analogicznie jak `players`. Trener = rekord sportowy (profil, historia, obecności na treningach/meczach). User = konto w aplikacji. `users.trainerId` → `trainers.trainerId`. Usunięto `users.coachProfile`.
> **DECYZJA v3.0:** `isActive: false` zamiast usuwania rekordu — zachowanie historii obecności trenera na zajęciach.

### `teams`
```javascript
{
  teamId: string,
  teamName: string,
  displayName: string,
  clubId: string,
  clubName: string,              // denormalizacja
  coachId: string,
  assistantCoaches: [],
  category: string,
  teamColor: string,
  colors: { primary, secondary, text },
  settings: {
    attendanceThreshold: number,
    sessionDuration: number,
    dashboard: { matchDays: 7 },
    season: {                    // bieżący sezon — używany do obliczania frekwencji
      start: string,             // 'YYYY-MM-DD'
      end: string,               // 'YYYY-MM-DD'
      name: string               // np. 'Sezon 2025/2026'
    } | null,
    seasonHistory: [             // archiwum — arrayUnion przy zmianie sezonu
      { start, end, name }
    ],
    positions: {                 // konfiguracja pozycji zawodników
      show: boolean,             // czy pokazywać pozycje w UI
      enabled: string[]          // ['Bramkarz','Obrońca','Pomocnik','Napastnik',...]
    },
    matchLive: {
      parentsCanAssist: true,
      resultVisibleDuring: 'FULL',
      resultVisibleAfter: 'OUTCOME_ONLY'
    }
  },
  periods: [],
  isDemo: boolean,
  demoSetId: string
}
```

### `events`
```javascript
{
  eventId: string,               // 'event_RRRRMMDD_NNNNNNN'
  teamId: string,
  clubId: string,
  type: 'TRENING' | 'MECZ' | 'WYJAZD' | 'INNE',
  priority: number,              // 1=TRENING, 2=MECZ, 3=WYJAZD, 999=INNE
  title: string,
  description: string,
  date: string,                  // 'YYYY-MM-DD' LOKALNIE (nie UTC!)
  timeFrom: string,
  timeTo: string,
  location: { venueName, address },
  reminderHoursBefore: number,   // 0 = zawsze widoczny w 7-dniowym oknie
  requireConfirmation: boolean,
  showInAnnouncements: boolean,
  visibility: [],
  visibleTo: [],                 // userIds rodziców + kibicow (NIE w invited)
  attendance: {
    invited: [],                 // playerIds + trener userIds (BEZ rodziców/kibicow)
    confirmed: [],
    declined: [],
    declineReasons: {},
    markedAbsent: [],
    decidedBy: {}                // { playerId: { by, byName, byRole, at } }
  },
  matchData: {                   // tylko type=MECZ
    opponent: string,
    homeAway: 'HOME' | 'AWAY',
    matchStatus: 'UPCOMING' | 'LIVE' | 'FINISHED',
    result: { our, opponent, outcome: 'WIN'|'LOSS'|'DRAW'|null, updatedBy, updatedAt },
    liveAssistant: { userId, displayName, claimedAt },
    takeoverRequest: { userId, displayName, requestedAt },
    endedAt: null,
    endedBy: null,
    playerEvents: [{ type:'GOAL', playerId, minute, addedBy, addedAt }],
    lineup: []
  },
  topicId: string | null,
  seriesId: string | null,       // 'series_RRRRMMDD_NNNNNNN'
  createdBy: string,
  createdAt: string,
  isDemo: boolean,
  demoSetId: string
}
```

### `absences`
```javascript
{
  absenceId: string,
  playerId: string,
  teamId: string,
  clubId: string,
  dateFrom: string,              // 'YYYY-MM-DD'
  dateTo: string,
  reason: string,
  type: string,
  isActive: boolean,
  createdAt: string,
  createdBy: string,
  approvedBy: null,
  userId: null,
  isDemo: boolean
}
```

### `notifications`
```javascript
{
  notificationId: string,
  userId: string,
  teamId: string,
  type: string,                  // EVENT_ATTENDANCE | ATTENDANCE_CONFIRMED | TASK_ASSIGNED | GUARDIAN_ASSIGNED | ...
  title: string,
  body: string,
  referenceId: string,
  referenceType: string,         // 'event' | 'task' | 'message' | 'player' | 'team'
  forPlayerId: string | null,    // kluczowe — rodzic potwierdza DZIECKO nie siebie
  requiresAction: boolean,
  actionType: string | null,     // 'ATTENDANCE' | 'TASK' | 'TAKEOVER'
  actionDone: boolean,
  actionResult: string | null,   // 'confirmed' | 'declined' | 'expired' | 'absence' | 'completed' | 'rejected'
  actionComment: string | null,
  createdAt: string,             // ISO
  isRead: boolean,
  readAt: string | null,
  priority: string               // 'NORMAL' | 'HIGH'
}
```

### `messages`
```javascript
{
  // Pola wspólne
  from: string,                  // userId nadawcy
  to: [string] | null,           // userIds odbiorców (null dla BROADCAST)
  type: 'MESSAGE' | 'BROADCAST', // MESSAGE = wiadomość, BROADCAST = ogłoszenie do drużyny
  teamId: string,
  title: string,                 // temat
  body: string,                  // treść
  createdAt: timestamp,
  readBy: [string],              // userIds którzy przeczytali
  replyTo: string | null,        // id wiadomości nadrzędnej (odpowiedź w wątku)
  archived: boolean,             // true = zarchiwizowane (ukryte, nie usunięte)

  // Tylko BROADCAST
  expiresAt: timestamp,          // data wygaśnięcia (WYMAGANE dla nowych BROADCAST)
  visibleDays: number,           // ile dni od dziś (1/3/7/14/30)
  isPinned: boolean,             // przypięte na górze listy

  // Po edycji
  editedBy: string,              // userId edytującego
  editedAt: timestamp
}
```

> **DECYZJA v2.9:** BROADCAST = ogłoszenia trenera — **jedyne źródło prawdy to kolekcja `messages`**.
> Kolekcja `announcements` przechowuje wyłącznie auto-generowane typy: BIRTHDAY, MATCH, INFO, WARNING, ACHIEVEMENT, TASK.
> `getTeamAnnouncements()` agreguje oba źródła.

> **DECYZJA v2.9:** Ogłoszenia **archiwizujemy** (archived: true), nie usuwamy — dane zostają w bazie.

### `announcements`
```javascript
// Tylko auto-generowane przez system — NIE tworzone ręcznie przez trenera
// Typy: BIRTHDAY | MATCH | INFO | WARNING | ACHIEVEMENT | TASK
{
  teamId: string,
  type: string,                  // jeden z AUTO_TYPES powyżej
  title: string,
  body: string,
  createdBy: string,
  createdAt: timestamp,
  isPinned: boolean,
  isDemo: boolean
}
```

### `memberships`

Centralna kolekcja — źródło prawdy dla dostępu, płatności, ostrzeżeń i kodów zaproszeń. Scala dotychczasową kolekcję `inviteCodes`. Jeden rekord = jeden user w jednym klubie z jedną rolą.

```javascript
{
  membershipId: string,          // 'mbr_RRRRMMDD_NNNNNNN'
  clubId: string,
  userId: string | null,         // null = kod jeszcze nieaktywowany (status: 'pending')
  role: 'TRENER' | 'ZAWODNIK' | 'RODZIC' | 'KIBIC',
  teamId: string | null,         // dla ZAWODNIK i TRENER
  playerId: string | null,       // dla RODZIC i KIBIC — do którego zawodnika

  // Lifecycle — jeden rekord od wygenerowania kodu do wygaśnięcia
  status: 'pending'              // kod wygenerowany, czeka na aktywację
        | 'active'               // user zarejestrowany, dostęp aktywny
        | 'grace'                // płatność wygasła, grace period 7 dni
        | 'expired'              // brak dostępu
        | 'deactivated',         // ręcznie dezaktywowany przez trenera/admina

  // Kod zaproszenia (scalone z inviteCodes — v3.7)
  code: string | null,           // 6-znakowy alfanumeryczny
  pinHash: string | null,        // hash PIN (tylko dla email+PIN auth)
  codeCreatedBy: string,         // userId który wygenerował kod
  codeCreatedAt: timestamp,
  codeExpiresAt: timestamp,      // domyślnie +30 dni od wygenerowania
  codeUsedAt: timestamp | null,
  // Po aktywacji: userId uzupełniony, status → 'active'

  // Stan zawodnika — kto nim zarządza
  managedBy: 'trener' | 'rodzic',   // dla rekordów ZAWODNIK
  guardianMembershipIds: [],         // membershipIds aktywnych rodziców tego zawodnika

  // Ostrzeżenia
  warnings: [{ date, reason, issuedBy, issuedByRole }],
  warningCount: 0,               // 0–3 → po 3 blokada komunikacji
  commsBlockedUntil: null,       // timestamp | null — blokada TYLKO komunikacji
  // Blokada komunikacji = rodzic nie może pisać do trenera (tylko czyta)
  // Rodzic nadal potwierdza obecność dziecka — dostęp do appki nienaruszony

  // Płatności
  paidBy: 'club' | 'user' | null,
  subscriptionTier: 'KIBIC' | 'RODZIC' | null,  // tier jeśli paidBy: 'user'
  subscriptionExpiry: null,      // timestamp
  gracePeriodEnd: null,          // timestamp — 7 dni po expiry

  // Powiadomienia
  notificationsEnabled: true,

  // Dostęp tylko do odczytu — ogólny mechanizm (v4.0)
  isReadOnly: boolean,           // true = blokada zapisu (demo, zawieszony, audytor)
  // Przypadki użycia isReadOnly:
  //   isDemo: true          → demo user (trener bez zapisu)
  //   trial wygasł          → grace period, można przeglądać ale nie edytować
  //   trener zawieszony     → OWNER zawiesił tymczasowo
  //   audytor zewnętrzny    → przyszłość

  // Meta
  createdAt: timestamp,
  createdBy: string,
  isDemo: boolean,
  demoSetId: string
}
```

> **DECYZJA v3.7:** `memberships` scala `inviteCodes` — jeden rekord od momentu wygenerowania kodu (`status: 'pending'`) do końca cyklu życia. Kolekcja `inviteCodes` do usunięcia z Firebase po migracji.

> **DECYZJA v3.7:** Blokada komunikacji (`commsBlockedUntil`) ≠ blokada dostępu. Zablokowany rodzic nadal może potwierdzać obecność dziecka.

> **DECYZJA v3.7:** Jeden zawodnik może mieć dwa rekordy RODZIC (mama + tata) — każdy z własnym kodem, PINem i historią ostrzeżeń.

### `inviteCodes`
```javascript
{
  codeId: string,
  code: string,                  // 6-znakowy alfanumeryczny
  pin: string,
  pinHash: string,
  type: 'RODZIC' | 'ZAWODNIK' | 'KIBIC' | 'TRENER',
  playerId: string | null,
  teamId: string | null,
  clubId: string | null,
  createdBy: string,
  createdAt: timestamp,
  expiresAt: timestamp,          // domyślnie +30 dni
  isUsed: boolean,
  usedAt: timestamp | null,
  usedBy: string | null,         // userId lub 'DEZAKTYWOWANY_PRZEZ_TRENERA'
  emailsSent: [],
  transferTo: null,
  observedPlayerId: null,
  observerName: null,
  isDemo: boolean,
  demoSetId: string
}
```

---

## Logika widoczności powiadomień

### `isEventInReminderWindow(event)` — w `coachay-core.js`
```javascript
// rh = 0  → zawsze widoczny (okno 7 dni)
// rh > 0  → widoczny gdy now >= eventTime - rh*3600000
```
Używana w:
- `loadAndRenderNotifications()` — ukrywa powiadomienia poza oknem
- `loadUpcomingEvents()` w start.html — filtruje eventy
- `loadNextMatch()` w start.html — filtruje mecze

### `manageNotifications(action, referenceType, referenceId, payload)` — v3.0
Globalna funkcja w `coachay-core.js` — jeden punkt zarządzania powiadomieniami:
- `create` → tylko tworzy nowe powiadomienia
- `edit` → wygasza stare (`isRead: true`) + tworzy nowe
- `delete` → kasuje powiadomienia z Firestore

Payload per typ:
- `event` → `{ event, absences }` — deleguje do `createNotificationsForEvent`
- `message` → `{ teamId, senderId, senderName, title, body, recipients, msgSubtype }` — `recipients: null` = BROADCAST
- `task` → `{ teamId, assignees, title, dueDate }`

### Auto-deaktywacja powiadomień
- Event przeszły → `actionResult: 'expired'`
- Mecz FINISHED → `actionResult: 'expired'`
- Gracz z absencją → `actionResult: 'absence'`
- Event usunięty → deaktywacja
- `expired` → ukrywane z widoku całkowicie (nie pokazuje "Termin minął")

### Auto-cleanup powiadomień
- Przeczytane > 14 dni → usuń
- Nieprzeczytane > 60 dni → usuń

---

## Logika frekwencji

- **Mianownik** = liczba eventów danego typu gdzie `playerId` jest w `attendance.invited`
- **Licznik** = ile z tych eventów ma `playerId` w `attendance.confirmed`
- **Okres** = `teams.settings.season` — od `season.start` do `season.end` (lub dzisiaj). Brak sezonu → frekwencja nie jest liczona (statystyki wyświetlają `—`)
- Typy: TRENING / MECZ / WYJAZD / INNE — osobno
- Eventy tylko do dziś włącznie (nie przyszłe)

---

## Logika asystenta meczowego

- `teams.settings.matchLive.parentsCanAssist: true` (domyślnie)
- **Trener** — ZAWSZE może przejąć (natychmiast, bez pytania)
- **Rodzic** (gdy parentsCanAssist=true) — może przejąć wolny mecz
- **Rodzic** → "Poproś o przejęcie" → powiadomienie do aktualnego asystenta
- Trener może cofnąć FINISHED → LIVE

---

## Nomenklatura ID

- `eventId`: `event_RRRRMMDD_NNNNNNN`
- `seriesId`: `series_RRRRMMDD_NNNNNNN`
- `playerId`: `player_RRRRMMDD_NNNNNNN` (demo: `demo_player_jasiek`)
- `userId`: Firebase Auth UID (demo: `demo_trener_jan`)
- `teamId`: `team_NAZWKLUBU_kategoria` (demo: `team_orly_u10`)
- `absenceId`: `absence_RRRRMMDD_NNNNNNN`
- `codeId`: `code_RRRRMMDD_NNNNNNN`

---

## Tryb DEMO (v4.0)

> **Aktualizacja 2026-07-28:** plan "jeden user demo, tylko TRENER" opisany niżej został **odrzucony** — patrz TODO.md sekcja "DEMO — porządki". Zostają 4 persony (Trener/Rodzic/Zawodnik/Kibic), docelowo (niski priorytet) ukryte zostaną tylko 3 przyciski na `login.html`, bez zmian w kontach/logice.

### Jeden user DEMO — tylko rola TRENER (plan odrzucony, patrz notka wyżej)

Demo prezentuje aplikację z perspektywy trenera (TRENER_GLOWNY) — ma on największy zakres uprawnień więc demo pokazuje maksimum funkcji. Brak przełącznika ról.

```javascript
// users/demo_user
{
  uid: 'demo_user',
  displayName: 'Demo Trener',
  isDemo: true,
  isReadOnly: true              // globalny przełącznik — blokada wszystkich zapisów
  // brak demoRole — rola fixed: TRENER_GLOWNY
}

// memberships/demo_mbr_trener — jeden rekord
{
  userId: 'demo_user',
  role: 'TRENER',
  status: 'demo',
  isDemo: true,
  isReadOnly: true,
  teamId: 'team_orly_u10',
  clubId: 'club_orly_praga'
}
```

### `isReadOnly` — ogólny mechanizm blokady zapisu (v4.0)

`isReadOnly` to reużywalny przełącznik dla dowolnego usera, nie tylko demo:

| Przypadek | isReadOnly | Kto ustawia |
|---|---|---|
| Demo user | ✅ | system (stały) |
| Trener zawieszony przez OWNER | ✅ | OWNER (tymczasowo) |
| Grace period po wygaśnięciu | ✅ | system (auto) |
| Audytor / obserwator | ✅ | ADMIN_PLATFORMY |
| Normalny aktywny user | ❌ | — |

### Tabela uprawnień — operacje zapisu

| Operacja | OWNER | TRENER_GLOWNY | TRENER_POMOCNICZY | RODZIC | ZAWODNIK | KIBIC | isReadOnly |
|----------|-------|--------------|-------------------|--------|----------|-------|------------|
| Wyślij wiadomość czat | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Utwórz ogłoszenie | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dodaj zawodnika | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edytuj zawodnika | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Usuń / dezaktywuj zawodnika | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dodaj trenera | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edytuj trenera | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generuj kod dostępu | ✅ | ✅ | ❌ | ✅** | ❌ | ❌ | ❌ |
| Utwórz event | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edytuj event | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Potwierdź obecność | — | — | — | ✅ | ✅ | ❌ | ❌ |
| Utwórz zadanie | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Oznacz zadanie wykonane | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Wyślij ostrzeżenie | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edytuj profil własny | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Zarządzaj klubem | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> \* Trener główny edytuje tylko swój profil, OWNER edytuje wszystkich trenerów
> \*\* Rodzic generuje tylko kod KIBIC dla swojego dziecka

### Implementacja — `requireWriteAccess()`

```javascript
// coachay-core.js — przed każdą operacją zapisu
function requireWriteAccess(message = 'Tryb podglądu — operacje zapisu są niedostępne.') {
  const user = getCurrentUserData();
  if (user?.isReadOnly) {
    showToast(message);
    return false;  // caller: if (!requireWriteAccess()) return;
  }
  return true;
}

// Użycie:
async function dodajZawodnika() {
  if (!requireWriteAccess()) return;
  // ... logika zapisu
}
```

---

## Typy eventów i kolory

| Typ | Kolor | Priorytet |
|-----|-------|-----------|
| TRENING | #3B82F6 (niebieski) | 1 |
| MECZ | #10B981 (zielony) | 2 |
| WYJAZD | #F59E0B (pomarańczowy) | 3 |
| INNE | #6B7280 (szary) | 999 |

---

## Grupy zawodników (squad)

| Wartość | Etykieta UI | Uwagi |
|---------|-------------|-------|
| FIRST | Pierwsza | Domyślna |
| SECOND | Druga | |
| THIRD | Trzecia | |

> **TODO Priorytet 4:** Nazwa i wartości konfigurowalne w Ustawieniach.

---

## Typy powiadomień

| Typ | Opis |
|-----|------|
| EVENT_ATTENDANCE | Potwierdź obecność (przyciski Będę/Nie będę) |
| EVENT_CREATED | Informacyjne — nowy event |
| ATTENDANCE_CONFIRMED | Dla trenera — ktoś potwierdził |
| ATTENDANCE_DECLINED | Dla trenera — ktoś odmówił |
| ATTENDANCE_UPDATE | Krzyżowe rodzic↔zawodnik |
| ABSENCE_CREATED | Nowa długa nieobecność |
| TASK_ASSIGNED | Nowe zadanie |
| TASK_COMPLETED | Zadanie wykonane |
| TASK_REJECTED | Zadanie odrzucone |
| TASK_UPDATED | Zadanie zmienione |
| MATCH_TAKEOVER_REQUEST | Prośba o przejęcie meczu |
| MATCH_TAKEOVER_APPROVED | Prośba zatwierdzona |
| MATCH_TAKEOVER_REJECTED | Prośba odrzucona |
| NEW_MESSAGE | Nowa wiadomość prywatna |
| NEW_ANNOUNCEMENT | Nowe ogłoszenie (BROADCAST) |
| GUARDIAN_ASSIGNED | Rodzic/kibic zarejestrował się kodem |

---

## Logika czatu i ogłoszeń (v2.9)

### Kolekcja `messages` — dwa tryby

| Pole `type` | Opis | Widoczność |
|-------------|------|------------|
| `MESSAGE` | Wiadomość bezpośrednia (1:1 lub 1:wielu) | Nadawca + odbiorcy |
| `BROADCAST` | Ogłoszenie do całej drużyny | Cała drużyna |

### `getTeamAnnouncements(teamId)` — agregacja
Funkcja w `coachay-core.js` łączy dwa źródła:
1. `announcements` → tylko `AUTO_TYPES`: BIRTHDAY / MATCH / INFO / WARNING / ACHIEVEMENT / TASK
2. `messages` → tylko `type == BROADCAST` i `archived != true`

Sortowanie: przypięte (`isPinned`) najpierw, potem wg `createdAt` malejąco.

### Filtrowanie na Start (`validAnns`)
- `archived: true` → pomiń
- `_fromMessages: true` bez `expiresAt` → pomiń (stare dane bez daty ważności)
- `isDemo: true` bez `expiresAt` → pomiń
- `expiresAt` w przeszłości → pomiń
- pozostałe → pokaż (max 3)

### Archiwizacja ogłoszeń
- Przycisk 🗑️ w panelu ogłoszenia (tylko TRENER)
- Ustawia `archived: true` na dokumencie w `messages`
- Ogłoszenie **nie jest usuwane** — zostaje w bazie
- Po archiwizacji znika natychmiast z `allMessages` w pamięci i odświeża listę

### Role a dostęp do czatu
| Rola | Ogłoszenia | Wiadomości |
|------|-----------|------------|
| TRENER_GLOWNY / TRENER_POMOCNICZY | tworzy + edytuje + archiwizuje | tworzy do kogo chce |
| RODZIC | tylko odczyt | może pisać do trenerów |
| ZAWODNIK | tylko odczyt | może pisać do trenerów |
| KIBIC | tylko odczyt | brak |

---

## Rejestracja i multi-klub (v3.2)

### Zasada: jeden email = jedno konto Firebase Auth

Trainer może być w wielu klubach. Firebase Auth używa emaila jako globalnego identyfikatora.
Ten sam email = ten sam `userId` = jedno konto = wiele kontekstów.

### Flow rejestracji trenera — pierwszy klub

```
1. Admin klubu A tworzy rekord trainers (clubId: A) + generuje inviteCode (type: TRENER)
2. Trener dostaje kod → otwiera app → wpisuje kod + email + hasło
3. Firebase Auth tworzy nowe konto (email → uid)
4. System tworzy:
   - users/{uid} z contexts: [{ clubId: A, teamId: X, role: TRENER_GLOWNY, isPrimary: true }]
   - trainers/{trainerId} z userId: uid, clubId: A
5. inviteCode oznaczony jako isUsed: true
```

### Flow rejestracji trenera — drugi klub (ten sam email)

```
1. Admin klubu B tworzy rekord trainers (clubId: B) + generuje inviteCode (type: TRENER)
2. Trener dostaje kod → otwiera app → wpisuje kod + ten sam email
3. System wykrywa: email już istnieje w Firebase Auth
4. Loguje trenera (nie tworzy nowego konta)
5. Pyta: "Chcesz dołączyć do [Nazwa Klubu B]?"
6. Po potwierdzeniu:
   - Dodaje context do istniejącego users/{uid}
   - Tworzy trainers/{trainerId2} z userId: uid, clubId: B
   - inviteCode oznaczony jako isUsed: true
7. Ctx-switcher pokazuje teraz oba kluby
```

### Kolekcja `trainers` — dwa rekordy dla jednego trenera

```javascript
// Ten sam userId, różne clubId
trainers/trainer_ClubA_jan → { userId: 'jan_uid', clubId: 'club_a', role: 'TRENER_GLOWNY' }
trainers/trainer_ClubB_jan → { userId: 'jan_uid', clubId: 'club_b', role: 'TRENER_POMOCNICZY' }
```

Profil trenera (bio, licencja, zdjęcie) może się różnić per klub.
Historia obecności liczona per klub osobno.

### Zasada: 1 TRENER_GLOWNY per drużyna

- Jedna drużyna może mieć tylko jednego TRENER_GLOWNY
- Ten sam trener może być TRENER_GLOWNY w wielu drużynach jednocześnie
- Przy generowaniu kodu TRENER_GLOWNY dla drużyny która już go ma → ostrzeżenie:
  "Ta drużyna ma już trenera głównego. Zastąpić?"
  - Tak → stary TRENER_GLOWNY staje się TRENER_POMOCNICZY
  - Nie → anuluj

### Metody logowania (v3.8)

| Metoda | Założyciel klubu | Trener | Rodzic | Zawodnik | Kibic |
|--------|-----------------|--------|--------|----------|-------|
| Email + hasło | ✅ obowiązek | ✅ | ✅ | ✅ | — |
| Google OAuth | ❌ nigdy | ✅ | ✅ | ✅ | ✅ |
| Apple OAuth | ❌ nigdy | ✅ | ✅ | ✅ | ✅ |
| Phone SMS | ❌ nigdy | 🔮 gotowe, wyłączone | 🔮 gotowe, wyłączone | 🔮 gotowe, wyłączone | ✅ aktywne |
| Facebook OAuth | — | 🔮 opcjonalnie po launchu | 🔮 opcjonalnie | 🔮 opcjonalnie | 🔮 opcjonalnie |

Konfiguracja w kodzie — włączanie SMS per rola bez refaktoryzacji:
```javascript
const AUTH_METHODS = {
  OWNER:     { email: true,  google: false, apple: false, phone: false },
  TRENER:    { email: true,  google: true,  apple: true,  phone: false }, // phone: false → true gdy rynek wymaga
  RODZIC:    { email: true,  google: true,  apple: true,  phone: false },
  ZAWODNIK:  { email: true,  google: true,  apple: true,  phone: false },
  KIBIC:     { email: false, google: true,  apple: true,  phone: true  }
}
```

> **DECYZJA v3.8:** Wewnętrzny email `kb_xxx@coachay.app` — **usunięty**. Zastąpiony przez social login (Google/Apple) lub Phone auth.

> **DECYZJA v3.8:** SMS zaprojektowany dla wszystkich ról, aktywny tylko dla KIBIC. Włączenie dla innych ról = jedna zmiana flagi — zero refaktoryzacji.

> **DECYZJA v3.8:** Ochrona przed abuse Phone Auth → reCAPTCHA (wbudowane w Firebase SDK) + region policy tylko `+48` + App Check.

> **DECYZJA v3.8:** Firebase Phone Auth kosztuje $0,03/SMS dla Polski. SMS wysyłany TYLKO przy: (1) rejestracji kibica — jednorazowo, (2) reset PIN — sporadycznie. Koszt marginalny (~$0,03 per kibic lifetime).

### Zakładanie klubu — flow rejestracji OWNER (v3.8)

```
1. Email + hasło — OBOWIĄZKOWO (bez social login, bez SMS)
2. Weryfikacja emaila (klik w link) → dopiero wtedy klub aktywny
3. Dane klubu: nazwa, miasto
4. NIP — opcjonalny, tylko jeśli chce FV (brak walidacji przy rejestracji)
5. Trial startuje automatycznie po weryfikacji emaila
```

**NIP:** brak walidacji na wejściu. Jeśli błędny → user nie dostanie FV. Admin (ADMIN_PLATFORMY) może weryfikować ręcznie przez `support.html`.

**Weryfikacja klubów:** panel `support.html` — oznaczanie jako zweryfikowane, flagowanie podejrzanych, blokowanie. Nie jest wymagana do działania appki.

### Wymagalność emaila przy rejestracji (v3.8)

| Rola | Wymagany email? | Uwagi |
|------|----------------|-------|
| OWNER | ✅ obowiązek + weryfikacja | Zakładanie klubu — pełna weryfikacja |
| TRENER | ✅ lub Google/Apple | Kod zaproszenia od klubu |
| RODZIC | ✅ lub Google/Apple | Kod zaproszenia od trenera |
| ZAWODNIK | opcjonalnie | Młodzi często bez konta |
| KIBIC | ❌ nie wymagany | Google/Apple lub Phone SMS |

### Wykrywanie istniejącego konta (v3.4)

Podczas rejestracji z kodem, po wpisaniu emaila:

```
1. Sprawdź Firebase Auth: czy email już istnieje?
   - NIE → utwórz nowe konto Firebase Auth → normalny flow
   - TAK → wyświetl: "Ten email jest już zarejestrowany. Zaloguj się aby dołączyć do nowego klubu/drużyny."
     → Logowanie emailem + PIN
     → Po zalogowaniu: dodaj nowy context do users/{uid}.contexts[]
     → Powiąż istniejące konto z nowym inviteCode
```

### PIN jako hasło (v3.4)

- **Docelowo**: 6-cyfrowy PIN jako hasło Firebase Auth
- **Sesja**: PIN wpisywany raz — Firebase Auth utrzymuje sesję
- **Reset**: trener/admin może wygenerować nowy jednorazowy PIN → użytkownik zmienia w `profil.html`
- **Bezpieczeństwo**: 6 cyfr = 1M kombinacji (wystarczające dla prywatnej appki, nie bank)

---

## Ekran profil.html — Mój profil (v3.6)

Jeden ekran dla wszystkich ról (TRENER, OWNER, RODZIC, ZAWODNIK, KIBIC).
Widoczny tylko dla zalogowanego użytkownika — nikt inny nie ma dostępu.

### Zawartość ekranu

| Sekcja | Opis |
|--------|------|
| Hero | Awatar 80px + imię + rola. Klik na awatar → picker |
| Dane konta | Imię i nazwisko (editable), email (read-only), rola (read-only) |
| Subskrypcja | Chip statusu + do kiedy + kto płaci — tylko informacyjnie |
| Zmiana PIN | Stary PIN → nowy → potwierdź (6 cyfr, Firebase Auth) |
| Wyloguj | Przycisk z potwierdzeniem |

### Czego NIE ma w profil.html (→ platnosci.html)

- Przycisk "Zarządzaj subskrypcją"
- Kod promocyjny / aktywacja kodu

### Avatar sync

Zmiana awatara w `profil.html` zapisuje:
```javascript
// Zawsze
users/{uid}.avatarUrl = selectedAvatarUrl
users/{uid}.avatarGender = selectedGender

// Dodatkowo jeśli rola TRENER/OWNER
trainers/{trainerId}.coachProfile.avatarUrl = selectedAvatarUrl
trainers/{trainerId}.coachProfile.avatarGender = selectedGender
```

### Dane subskrypcji (read-only w profilu)

Czytane z `users/{uid}.accessStatus`:
```javascript
{
  hasAccess: boolean,
  isTrial: boolean,
  validUntil: Timestamp,
  paidBy: null | 'club' | userId | 'promo'
}
```

Logika płatności i kodów promocyjnych → `platnosci.html`

---

## Model dostępu rodzic i kibic (v3.7)

### Kibic — rola i ograniczenia

- Kibic: **tylko podgląd** — nie może nic dodawać, komentować, potwierdzać
- Kibic jest powiązany z konkretnym zawodnikiem (poprzez `memberships.playerId`)
- Wszyscy rodzice danego zawodnika zarządzają jego kibicami **krzyżowo** (niezależnie kto dodał)
- W `memberships` przechowujemy `codeCreatedBy` — info kto wygenerował kod (dla historii)

### Widoczność "Powiązanych kont" na profilu zawodnika

Sekcja na profilu zawodnika w `druzyna.html`:

| Rola | Widzi rodziców | Widzi kibiców | Może zarządzać |
|------|---------------|---------------|----------------|
| TRENER | ✅ wszyscy | ✅ wszyscy | ostrzeżenia + reset dostępu |
| RODZIC | ✅ wszyscy (współopiekunowie) | ✅ wszyscy | reset dostępu kibiców |
| KIBIC | ❌ | ❌ | — |
| ZAWODNIK | ❌ | ❌ | — |

### Zawodnik bez własnego konta

Młodzi zawodnicy nie mają własnego konta Firebase Auth. Zawodnik istnieje jako rekord `players`, ale konto (`users`) może nie istnieć.

- **Stan domyślny**: zawodnik "pod trenerem" (`managedBy: 'trener'`)
- **Po aktywacji kodu rodzica**: `managedBy: 'rodzic'`, trener dostaje powiadomienie
- Rodzic "przejmuje" zarządzanie zawodnikiem — widzi go w swojej liście dzieci

### Co się dzieje gdy rodzic przestaje płacić

```
Rodzic przestaje płacić:
  → grace period 7 dni (powiadomienia do rodzica)
  → po 7 dniach: membership.subscriptionStatus: 'expired'
  → jeśli drugi rodzic nadal aktywny → zawodnik ZOSTAJE pod rodzicem (B)
  → dopiero gdy OBOJE rodzice wygasną:
      players.managedBy → 'trener'
      powiadomienie do trenera: "Zawodnik X nie ma aktywnego opiekuna"

Rodzic usuwa konto:
  → natychmiastowe wygaśnięcie (bez grace period)
  → kibice przez niego utworzeni → blokada (jeśli nie ma drugiego rodzica)
  → j.w. sprawdzenie czy jest drugi aktywny rodzic

Trener/owner usuwa rodzica z systemu:
  → natychmiastowe wygaśnięcie
  → zawodnik wraca do trenera (jeśli brak drugiego rodzica)
```

### Ponowna aktywacja rodzica

Gdy rodzic płaci ponownie (lub klub go pokrywa):
- `memberships.subscriptionStatus` → `active`
- **Automatyczny powrót** dostępu do swoich dzieci — brak konieczności ponownego kodu
- Trener dostaje powiadomienie: "Rodzic [imię] ponownie aktywował dostęp do [zawodnik]"

### System ostrzeżeń

Ostrzeżenia wystawia **trener** — dotyczą zachowania przy meczach (fizycznie), nie w aplikacji (kibic tylko ogląda).

```
Trener wystawia ostrzeżenie kibicowi zawodnika X:
  → ostrzeżenie trafia do RODZICA zawodnika X (nie bezpośrednio do kibica)
  → powiadomienie: "Wystawiono ostrzeżenie osobie obserwującej [zawodnik X]"
  → po 3 ostrzeżeniach → commsBlockedUntil (automatyczna blokada komunikacji)
```

Blokada komunikacji dla rodzica:
- Rodzic **nie może wysyłać** wiadomości do trenera
- Rodzic **widzi** wiadomości od trenera (tylko czyta)
- Rodzic **nadal potwierdza** obecność dziecka (brak blokady dostępu)

### Model płatności — dwa systemy (v3.7)

**User subscription** (user płaci Coachay, dostęp do wszystkich klubów):

| Tier | Uprawnienia |
|------|-------------|
| KIBIC | kibic w dowolnej liczbie klubów |
| RODZIC | rodzic + kibic wszędzie (wyższy tier zawiera niższy) |

**Club subscription** (klub płaci Coachay):
- Zawsze pokrywa trenerów
- Opcjonalnie: `clubs.billingConfig.coversParents: true` → rodzice klubu gratis

```javascript
// Logika sprawdzania dostępu rodzica do klubu X:
const hasAccess =
  club.billingConfig.coversParents === true          // klub pokrywa
  || user.subscriptionTier === 'RODZIC'              // sam płaci
  || isInGracePeriod(membership);                    // grace period 7 dni
```

---

## Zarządzanie trenerami — decyzje v3.2

### Przypisanie trenera do drużyn

Trener ma `teamIds[]` i `teamNames[]` — może być przypisany do jednej, kilku lub wszystkich drużyn klubu. Brak osobnego kontekstu `type: 'KLUB'` dla trenera — prostsze i wystarczające.

```javascript
// Mały klub — Jan prowadzi wszystkie drużyny
trainers/jan: { teamIds: ['u8','u10','u12'], role: 'TRENER_GLOWNY' }

// Duży klub — specjalizacja
trainers/tomek: { teamIds: ['u10'], role: 'TRENER_POMOCNICZY' }
```

Routing wiadomości od rodziców: `parent.teamId → trainers gdzie teamIds zawiera teamId → znajdź TRENER_GLOWNY`.

### Flaga admina klubu

Przechowywana w dwóch miejscach jednocześnie:
- `users.contexts[]` → `{ type: 'KLUB', role: 'ADMIN', clubId }` — używane do sprawdzania uprawnień w locie
- `trainers.isClubAdmin: boolean` — używane w UI (wyświetlanie, zarządzanie)

Przy zmianie → aktualizować oba dokumenty.

### Historia uprawnień — roleHistory[]

Każda zmiana roli dopisuje wpis do `trainers.roleHistory[]`:

```javascript
roleHistory: [
  {
    from:      'TRENER_POMOCNICZY',   // poprzednia rola
    to:        'TRENER_GLOWNY',       // nowa rola
    changedAt: '2026-03-27T10:00:00.000Z',
    changedBy: 'userId_admina',
    reason:    'awans'                // opcjonalne
  }
]
```

Zaleta: `from` + `to` w jednym wpisie — pełna historia bez dodatkowych zapytań.

### Walidacja TRENER_GLOWNY

Przy generowaniu kodu z rolą TRENER_GLOWNY dla drużyny X:
- Sprawdź `trainers` gdzie `teamIds zawiera X` i `role == TRENER_GLOWNY`
- Jeśli istnieje → pytaj: "Zastąpić [imię]? Stanie się Trenerem Pomocniczym."
- Jeśli nie → generuj normalnie

### Zastępstwa

Brak dedykowanego mechanizmu — admin ręcznie zmienia rolę i zmienia z powrotem po powrocie. Historia uprawnień (`roleHistory`) dokumentuje te zmiany automatycznie.

### Przekazanie władzy — akceptacja

| Zmiana | Akceptacja odbiorcy | Powiadomienie |
|--------|-------------------|---------------|
| Zmiana roli trenera (Pomocniczy ↔ Główny) | NIE | INFO do trenera |
| Przekazanie uprawnień admina | TAK (akceptuj/odrzuć) | Do czasu akceptacji stary admin aktywny |
| Przekazanie OWNER (billing) | TAK + potwierdzenie email obu stron | Ścisły proces |

### Nikt nie może usunąć/zdegradować samego siebie

Walidacja po stronie UI i backendu: `if (targetUserId === currentUserId) → blokuj`.

---

## Usuwanie danych — pełna sekcja (v3.4)

### Zasada ogólna — 3 tryby usuwania

| Tryb | Co robi | Kiedy stosować |
|---|---|---|
| **Dezaktywacja** | `isActive: false` — ukryty z list, dane nienaruszone | Zawodnik odszedł tymczasowo, może wrócić |
| **Anonimizacja** | PII → null/placeholder, dane zbiorcze zostają | RODO — osoba żąda usunięcia danych osobowych |
| **Twarde usunięcie** | DELETE dokumentu | Tylko jeśli zawodnik nigdy nie miał żadnej aktywności (np. dodany przez pomyłkę) |

Twarde usunięcie tylko gdy: brak attendance, brak w events.invited, brak messages. W każdym innym przypadku → anonimizacja.

### Kto może usuwać

| Akcja | TRENER_GLOWNY | TRENER_POMOCNICZY | OWNER |
|---|---|---|---|
| Dezaktywuj zawodnika | ✅ | ❌ | ✅ |
| Anonimizuj zawodnika | ✅ | ❌ | ✅ |
| Twarde usuń zawodnika | ❌ | ❌ | ✅ |
| Dezaktywuj trenera | ✅ | ❌ | ✅ |
| Anonimizuj trenera | ❌ | ❌ | ✅ |

---

### Usuwanie zawodnika (druzyna.html)

#### UI — dialog wyboru trybu

Kliknięcie "Usuń zawodnika" (TRENER_GLOWNY/OWNER) otwiera bottom-sheet z wyborem:

```
🔒 Dezaktywuj
   Zawodnik znika z listy. Dane zachowane.
   Można przywrócić w każdej chwili.

👤 Usuń dane osobowe (RODO)
   Imię → "Były zawodnik", kontakt opiekuna → usunięty.
   Statystyki i frekwencja zostają (anonimowo).
   Nieodwracalne.

🗑️ Usuń całkowicie          [tylko OWNER, tylko jeśli brak aktywności]
   Usuwa zawodnika z systemu.
   Nieodwracalne.
```

#### Dezaktywacja zawodnika

```javascript
players.doc(playerId).update({
  isActive: false,
  deactivatedAt: now,
  deactivatedBy: currentUserId
})
// Dezaktywuj powiązane kody dostępu
inviteCodes.where('playerId', '==', playerId).where('isUsed', '==', false)
  → isUsed: true, usedBy: 'DEZAKTYWOWANY'
// Powiadomienie: wyczyść requiresAction dla tego zawodnika
```

#### Anonimizacja zawodnika (RODO)

```javascript
// players — anonimizacja PII
players.doc(playerId).update({
  name: 'Były zawodnik',
  isActive: false,
  isAnonymized: true,
  anonymizedAt: now,
  anonymizedBy: currentUserId,
  // PII → null
  dateOfBirth: null,
  guardianIds: [],        // odłącz opiekunów
  notes: null,
  // Dane zbiorcze zostają (bez PII)
  // position, number, group, teamId — zostają (do statystyk)
})

// users — konta rodziców powiązanych TYLKO z tym dzieckiem
// jeśli rodzic ma inne dzieci → tylko usuń to dziecko z children[]
// jeśli to jedyne dziecko → dezaktywuj konto rodzica (nie usuń)
users.where('children', 'array-contains', { childId: playerId })
  → children = children.filter(c => c.childId !== playerId)
  → jeśli children.length === 0 → accountStatus: 'DEACTIVATED'

// inviteCodes — dezaktywuj wszystkie dla tego zawodnika
inviteCodes.where('playerId', '==', playerId)
  → isUsed: true (jeśli nie były)

// attendance — zostają (anonimowe — playerId zostaje ale name jest 'Były zawodnik')
// NIE ruszamy attendance (dane statystyczne drużyny)

// events.invited — usuń playerId z listy zaproszonych w przyszłych eventach
events.where('date', '>', now).where('invited', 'array-contains', playerId)
  → invited = invited.filter(id => id !== playerId)

// messages/announcements — NIE ruszamy (treści historyczne)
// Jeśli wiadomość zawiera imię → nie da się retroaktywnie zmienić bez skanowania treści
// Decyzja: imię w wiadomościach historycznych zostaje (treść ≠ PII w sensie profilu)

// notifications — usuń aktywne powiadomienia dotyczące tego zawodnika
notifications.where('forPlayerId', '==', playerId).where('isRead', '==', false)
  → delete lub isHidden: true
```

#### Twarde usunięcie (tylko OWNER, tylko jeśli brak aktywności)

```javascript
// Sprawdź przed usunięciem:
const hasAttendance = await attendance.where('playerId', '==', playerId).limit(1).get()
const hasEvents = await events.where('invited', 'array-contains', playerId).limit(1).get()
if (hasAttendance.size > 0 || hasEvents.size > 0) {
  → blokuj: "Zawodnik ma historię aktywności. Użyj anonimizacji."
}
// Jeśli brak aktywności:
players.doc(playerId).delete()
inviteCodes.where('playerId', '==', playerId) → delete
```

---

### Usuwanie trenera (trenerzy.html)

#### UI — dialog wyboru trybu

```
🔒 Dezaktywuj
   Trener traci dostęp. Dane profilu zachowane.
   Można przywrócić.

👤 Usuń dane osobowe (RODO)   [tylko OWNER]
   Imię → "Były trener", email/telefon → usunięty.
   Historia zmian ról zostaje (anonimowo).
   Nieodwracalne.
```

Trener nigdy nie jest twardо usuwany — zawsze ma historię eventów, ogłoszeń, zadań.

#### Dezaktywacja trenera (obecna implementacja — rozszerzyć)

```javascript
trainers.doc(trainerId).update({
  isActive: false,
  deactivatedAt: now,
  deactivatedBy: currentUserId
})
// Usuń z teamIds wszystkich drużyn
// Dezaktywuj oczekujące kody dostępu
// Wyślij powiadomienie do trenera (jeśli ma userId)
```

#### Anonimizacja trenera (RODO)

```javascript
trainers.doc(trainerId).update({
  displayName: 'Były trener',
  isActive: false,
  isAnonymized: true,
  anonymizedAt: now,
  email: null,
  userId: null,
  coachProfile: {
    bio: null, phone: null, licenseLevel: null,
    avatarUrl: null,
    // coachingSince zostaje (nie jest PII)
  }
})
// users — dezaktywuj konto (nie usuń — może mieć inne role/kluby)
users.doc(userId).update({ accountStatus: 'DEACTIVATED' })
// Historyczne treści (ogłoszenia, zadania, eventy przez niego stworzone):
// authorName zostaje jako 'Były trener' — nie skanujemy treści wstecz
// roleHistory — zostaje ale changedBy może wskazywać na usuniętego usera → OK (audit log)
```

---

### Przywracanie dezaktywowanego zawodnika / trenera

Widok w druzyna.html / trenerzy.html: filtr "Pokaż nieaktywnych" (tylko TRENER_GLOWNY/OWNER).

```javascript
// Przywróć zawodnika
players.doc(playerId).update({
  isActive: true,
  restoredAt: now,
  restoredBy: currentUserId
})
// Wygeneruj nowy kod dostępu jeśli potrzebny
```

Przywrócenie NIE jest możliwe po anonimizacji — dane PII są bezpowrotnie usunięte.

---

### Powiadomienia przy usuwaniu

| Akcja | Powiadomienie do |
|---|---|
| Dezaktywacja zawodnika | Rodzice/opiekunowie: "Konto zawodnika zostało dezaktywowane" |
| Anonimizacja zawodnika | Rodzice: "Dane Twojego dziecka zostały usunięte z systemu" |
| Dezaktywacja trenera | Trener (jeśli ma userId): "Twój dostęp do drużyny został cofnięty" |
| Przywrócenie zawodnika | Rodzice: "Konto zawodnika zostało przywrócone" |

---

## Rozwiązanie drużyny (v3.2)

### Wizard — 4 kroki (UI w klub.html)

```
Krok 1: Ostrzeżenie z podsumowaniem (ilu zawodników, trenerów, przyszłych eventów)
Krok 2: Co z zawodnikami?
  A) Przenieś do innej drużyny (wybór z listy)
  B) Archiwizuj bez przypisania
  C) Usuń z systemu (anonimizacja RODO)
Krok 3: Co z przyszłymi wydarzeniami?
  A) Anuluj i wyślij powiadomienia
  B) Pozostaw bez zmian
Krok 4: Potwierdzenie — wpisz nazwę drużyny
```

### Operacje po potwierdzeniu (docelowo Cloud Function — atomowa)

```javascript
// teams
teams/teamId: { isActive: false, dissolvedAt, dissolvedBy, dissolvedReason }

// players — zależnie od wyboru w kroku 2
players[].teams[].status = 'ARCHIVED'          // archiwizacja
players[].teams[] → nowy teamId                // przeniesienie
players → anonimizacja PII                     // usunięcie (RODO)

// trainers — usuń teamId z listy
trainers[].teamIds = teamIds.filter(id !== dissolvedTeamId)
// jeśli brak innych drużyn → powiadomienie dla trenera

// events — przyszłe (jeśli wybrano anuluj)
events[date > today].status = 'CANCELLED'
// + powiadomienia do wszystkich invited

// tasks — otwarte
tasks[status='PENDING'].status = 'CANCELLED'
// + powiadomienia do assignee

// inviteCodes — oczekujące
inviteCodes[teamId=X, isUsed=false].isUsed = true

// messages/announcements/history — NIE ruszać (archiwum)
// dostępne tylko dla ADMIN/OWNER przez osobny widok archiwum
```

### Dostęp po rozwiązaniu

| Rola | Efekt |
|------|-------|
| Rodzic / Zawodnik | Traci dostęp natychmiast, konto aktywne |
| Trener (ma inne drużyny) | Ctx-switcher pokazuje pozostałe |
| Trener (bez innych drużyn) | Ekran "Brak aktywnych drużyn" |
| Admin / Owner | Widzi drużynę w archiwum (szara), może pobrać raport |

### Retencja danych po rozwiązaniu

- Dane historyczne (eventy, attendance, wiadomości): przechowywane min. 2 lata
- PII (imiona, emaile, telefony): zgodnie z decyzją RODO — anonimizacja po X dniach od rozwiązania
- Raport PDF z historią drużyny: do pobrania przez ADMIN przed ostatecznym usunięciem

### MVP vs docelowo

- **MVP**: sekwencyjne operacje w JS z obsługą błędów
- **Docelowo**: Cloud Function z transakcją Firestore (atomowa — albo wszystko albo nic)

---

## Autentykacja i bezpieczeństwo (v3.3)

### PIN zamiast hasła — decyzja

**Decyzja: PIN 6-cyfrowy** (nie 4-cyfrowy, nie hasło tekstowe)

| Opcja | Kombinacje | Dla starszych | Decyzja |
|---|---|---|---|
| PIN 4-cyfry | 10 000 | ✅ łatwy | ❌ za słabe |
| PIN 6-cyfr | 1 000 000 | ✅ łatwy | ✅ **wybrany** |
| Hasło tekstowe | praktycznie ∞ | ❌ trudne | ❌ |
| Magic link | n/d | ✅ łatwy | 🔮 opcjonalnie w przyszłości |

- Firebase Auth przechowuje PIN zahashowany (jako password w Firebase Auth)
- Firebase Auth rate limiting chroni przed brute-force
- "Zapomniałem PIN" → Firebase wysyła link resetujący na email → standard
- PIN NIE jest przechowywany w Firestore w plaintext

### Reset dostępu (utrata maila / zmiana maila logowania)

**Problem**: Firebase Auth email nie można zmienić po stronie admina bez Cloud Functions.

**Rozwiązanie**: "Resetuj dostęp" — ponowna rejestracja na nowy email, dane profilu zostają.

**Warunek**: Reset dostępu MUSI być bezpieczny względem płatności:
- Subskrypcja musi być powiązana z `trainerId` lub `clubId`, **NIE z Firebase Auth UID / userId**
- Po resecie nowy `userId` zostaje powiązany z istniejącym `trainerId` → subskrypcja nienaruszona
- Stare konto Firebase Auth staje się sierotą (do wyczyszczenia przez Cloud Function w przyszłości)

**Do zaimplementowania**: po zaprojektowaniu modelu płatności.

---

## Model płatności (v3.3) — decyzje do podjęcia / wdrożenia

### Kto płaci — elastyczny model

| Rola | Kto może płacić |
|---|---|
| TRENER | sam **lub** klub |
| RODZIC | sam **lub** klub |
| ZAWODNIK | sam **lub** klub **lub** rodzic |
| KIBIC | sam **lub** rodzic (sponsor) |

Kibic nigdy nie jest opłacany przez klub (nie wnosi wartości operacyjnej dla klubu).

### Modele subskrypcji klubu

**Model A — Klub płaci za wszystkich** (`coversTrainers: true, coversParents: true`)
- Klub ma plan z limitem: X trenerów, Y drużyn, Z rodziców
- Trenerzy i rodzice logują się bez własnej płatności
- Klub rozlicza się miesięcznie/rocznie

**Model B — Każdy płaci sam**
- Brak subskrypcji klubowej (lub plan FREE)
- Każdy trener/rodzic ma własną subskrypcję indywidualną
- Klub tylko zarządza, nie płaci

**Model C — Mieszany** (rekomendowany)
- Klub konfiguruje per rola: `billingConfig: { coversTrainers: bool, coversParents: bool }`
- Jeśli `coversTrainers: false` → trener musi mieć własną subskrypcję
- Jeśli `coversTrainers: true` → trener loguje się w ramach planu klubu

### Sponsorowanie kibiców przez rodzica

- Rodzic może "sponsorować" konta KIBIC (np. dziadkowie)
- `subscriptions[].paidBy: 'self' | userId_sponsora`
- Sponsor widzi listę sponsorowanych w swoim koncie, może je anulować
- Kibic ma `sponsorId: userId` w swoim rekordzie users/subscriptions

### Schemat kolekcji `subscriptions`

```javascript
{
  subscriptionId: string,
  // Kto ma subskrypcję
  userId: string,                // Firebase Auth UID użytkownika
  trainerId: string | null,      // NIE Firebase UID — klucz do trainers
  clubId: string | null,         // jeśli subskrypcja klubowa
  // Kto płaci
  paidBy: 'self' | 'club' | userId_sponsora,
  // Plan
  plan: 'FREE' | 'BASIC' | 'PRO',
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'TRIAL',
  trialEndsAt: timestamp | null,
  validUntil: timestamp,
  // Stripe
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  // Meta
  createdAt: timestamp,
  cancelledAt: timestamp | null
}
```

### Kolekcja `clubs.billingConfig`

```javascript
// Pole w dokumencie clubs
billingConfig: {
  plan: 'FREE' | 'BASIC' | 'PRO',
  coversTrainers: boolean,    // klub płaci za trenerów
  coversParents: boolean,     // klub płaci za rodziców
  maxTrainers: number,        // limit trenerów w planie
  maxTeams: number,           // limit drużyn w planie
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  validUntil: timestamp | null
}
```

### Powiązanie subskrypcja ↔ reset dostępu

```
trainers.trainerId  ──→  subscriptions.trainerId  (wiązanie trwałe)
trainers.userId     ──→  Firebase Auth UID         (może się zmienić przy resecie)

Reset dostępu:
  stary userId usuwany z trainers
  nowy userId przypisywany po ponownej rejestracji
  subscriptions.trainerId NIEZMIENIONE → subskrypcja przeżywa reset
```

### Decyzje podjęte (v3.3)

**Zawodnik nigdy nie płaci** (przynajmniej MVP). TODO: zawodnicy 16+ — 2 miesiące free trial, potem płatność indywidualna (osobna funkcja do zaprojektowania).

**Okresy próbne:**
| Rola | Trial |
|---|---|
| TRENER | 6 miesięcy free |
| RODZIC | 2 miesiące free |
| KIBIC | 2 miesiące free |
| ZAWODNIK (<16) | zawsze bezpłatny |
| ZAWODNIK (16+) | TODO: 2 miesiące free, potem płatność |

Trial liczymy od `registeredAt` użytkownika, nie od daty zaproszenia.

### Strategia App Store — model Netflix/Spotify (bez prowizji Apple)

**Decyzja**: Płatności WYŁĄCZNIE przez stronę www (Stripe + BLIK). Zero In-App Purchase w iOS/Android.

**Jak to działa (w pełni legalne)**:
- Użytkownik rejestruje się i płaci na **coachay.pl** w przeglądarce
- Aplikacja mobilna NIE zawiera żadnego przycisku "Kup" / "Ceny" / linku do płatności
- Aplikacja mobilna: tylko "Zaloguj się" / "Mam już konto"
- Apple/Google nie pobierają prowizji (0% zamiast 30%)
- Przykłady: Netflix, Spotify, Amazon Kindle — ten sam model

**Bramka płatności**: Stripe (karty, BLIK, Przelewy24) na stronie www
- BLIK popularny w Polsce, Stripe go obsługuje jako payment method
- Możliwość zmiany/dodania IAP po wejściu do App Store (wymaga tylko aktualizacji apki)

**Platformy**:
- **Mobile** (iOS + Android): codzienna praca trenerów/rodziców, powiadomienia push
- **Web** (coachay.pl): rejestracja, płatności, raporty PDF/CSV, panel admina klubu
- Jeden codebase (PWA lub React Native + shared backend)

### Open questions (do ustalenia przed implementacją płatności)

- [ ] Ceny planów (FREE/BASIC/PRO) — ile drużyn, trenerów, funkcji per plan
- [ ] Model klubowy: kiedy klub może pokryć subskrypcje trenerów/rodziców (od którego planu)
- [ ] Jak obsłużyć sponsorowanie kibiców przez rodzica w Stripe (separate subscription z `metadata.paidBy`)
- [ ] Co z subskrypcją gdy klub ją cofa trenerowi — grace period?

---

## Architektura dostępu i rozliczeń (v3.3)

### Logika dostępu — sprawdzana przy każdym logowaniu

Kolejność sprawdzania (pierwsze spełnione = dostęp):

```
1. TRIAL aktywny?
   registeredAt + TRIAL_DAYS[rola] > now
   TRIAL_DAYS: { TRENER: 180, RODZIC: 60, KIBIC: 60, ZAWODNIK: ∞ }

2. Klub pokrywa tego użytkownika?
   clubs[clubId].billingConfig.status === 'ACTIVE'
   AND clubs[clubId].billingConfig.validUntil > now
   AND billingConfig.coversTrainers === true  (jeśli trener)
   AND billingConfig.coversParents === true   (jeśli rodzic)

3. Indywidualna subskrypcja aktywna?
   subscriptions[userId].status === 'ACTIVE'
   AND subscriptions[userId].validUntil > now

4. Kod promocyjny 100% aktywny?
   (obsłużone przez subscriptions.validUntil — po zastosowaniu kodu pole jest przedłużone)

→ brak któregokolwiek = ACCESS_DENIED → platnosci.html
```

Wynik zapisywany w `users.accessStatus`:
```javascript
accessStatus: {
  hasAccess: boolean,
  reason: 'TRIAL' | 'CLUB' | 'PERSONAL' | 'EXPIRED',
  validUntil: timestamp | null,
  trialEndsAt: timestamp | null,
  checkedAt: timestamp
}
```

`accessStatus` aktualizowany przez Cloud Function (cron dzienny) + przy każdym logowaniu (client-side read).

### Powiadomienia lifecycle subskrypcji

```
T-7 dni:  SUBSCRIPTION_EXPIRING (warning, nierequireAction)
T-3 dni:  SUBSCRIPTION_EXPIRING (urgent, requiresAction)
T=0:      SUBSCRIPTION_EXPIRED  → blokada, platnosci.html
T+7 dni:  przypomnienie (jeśli nadal brak płatności)
```

Generowanie:
- **MVP**: sprawdzenie przy starcie aplikacji w `coachay-core.js`
- **Docelowo**: Cloud Function scheduled (codziennie o 8:00)

### Recurring billing — Stripe Subscriptions

**Jak Stripe automatycznie pobiera opłaty:**

```
Club Owner → Stripe Checkout → podaje kartę → Stripe tworzy Subscription
                                                         ↓
                                              co miesiąc: charge
                                                         ↓
                                     invoice.payment_succeeded → webhook
                                                         ↓
                                              Cloud Function:
                                              clubs.billingConfig.validUntil += 1 miesiąc
                                              clubs.billingConfig.status = 'ACTIVE'
```

**Nieudana płatność:**
```
invoice.payment_failed → webhook → Cloud Function:
  1. Powiadomienie do OWNER klubu: "Płatność nieudana — zaktualizuj dane karty"
  2. Grace period 7 dni (Stripe retry)
  3. Po 3 nieudanych próbach: clubs.billingConfig.status = 'PAST_DUE'
  4. Powiadomienia do trenerów pokrytych przez klub: "Dostęp klubu wygasł — opłać indywidualnie lub skontaktuj się z administratorem"
  5. Po 14 dniach: status = 'CANCELLED'
```

### Billing od klubu — jak klub płaci "za innych"

Klub NIE tworzy osobnych subskrypcji Stripe dla każdego trenera. Jedna subskrypcja klubowa pokrywa wszystkich:

```javascript
// clubs.billingConfig
billingConfig: {
  plan: 'BASIC' | 'PRO',
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED',
  coversTrainers: true,      // plan pokrywa trenerów
  coversParents: false,      // w tym planie rodzice płacą sami
  maxTrainers: 5,            // limit w planie
  maxTeams: 2,
  validUntil: timestamp,
  stripeCustomerId: 'cus_xxx',
  stripeSubscriptionId: 'sub_xxx',
  stripeProductId: 'prod_xxx'
}
```

Access check przy logowaniu trenera:
```javascript
// trainer Jan, clubId: club_orly_praga
const club = await db.collection('clubs').doc(clubId).get();
if (club.billingConfig.coversTrainers && club.billingConfig.status === 'ACTIVE') {
  return { hasAccess: true, reason: 'CLUB' };
}
// Jeśli klub nie pokrywa → sprawdź indywidualną subskrypcję Jana
```

### Indywidualna subskrypcja (Stripe per użytkownik)

Gdy trener/rodzic płaci sam (klub nie pokrywa):

```javascript
// subscriptions kolekcja
{
  subscriptionId: string,
  userId: string,
  trainerId: string | null,   // NIE Firebase UID — przeżywa reset dostępu
  clubId: string | null,
  plan: 'BASIC' | 'PRO',
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED',
  validUntil: timestamp,
  trialEndsAt: timestamp,
  paidBy: 'self' | 'club' | userId,  // sponsorowanie kibica przez rodzica
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  createdAt: timestamp
}
```

### Sponsorowanie kibica przez rodzica

Rodzic chce żeby dziadek (KIBIC) miał dostęp — płaci za niego:

```
Rodzic → platnosci.html → "Dodaj konto sponsorowane" → wpisuje userId kibica
→ Stripe Subscription z metadata: { paidBy: rodzicUserId, beneficiaryId: kibicUserId }
→ webhook → subscriptions[kibicUserId].paidBy = rodzicUserId
→ Kibic dostaje powiadomienie: "Jan Kowalski opłacił Twój dostęp"
```

Rodzic widzi listę sponsorowanych w swoim koncie → może anulować.
Kibic NIE widzi szczegółów płatności, tylko że ktoś opłacił.

### Stripe Webhooks — Cloud Functions (wymagane)

| Webhook event | Akcja |
|---|---|
| `checkout.session.completed` | utwórz/aktualizuj subscription w Firestore |
| `invoice.payment_succeeded` | przedłuż `validUntil`, status = ACTIVE |
| `invoice.payment_failed` | powiadomienie do płatnika, status = PAST_DUE |
| `customer.subscription.deleted` | status = CANCELLED, powiadomienia |
| `customer.subscription.updated` | aktualizuj plan/ilość |

**Ważne**: Webhooks wymagają Cloud Functions — nie da się obsłużyć po stronie klienta. To jest granica MVP vs. produkcja.

---

## Kody promocyjne i supportowe (v3.3)

### Jeden system — dwa zastosowania

Te same kody `promoCodes` obsługują dwa scenariusze:
- **Support** generuje kod dla konkretnego klienta (100% = free, lub % zniżki)
- **Marketing** generuje kody masowe (np. kampania: "25% przez 3 miesiące")

### Schemat rabatu

```
discountPercent: 100  + durationMonths: 3   →  3 miesiące całkowicie free
discountPercent: 25   + durationMonths: 6   →  25% taniej przez 6 miesięcy
discountPercent: 100  + durationMonths: 1   →  1 miesiąc free (np. za problem techniczny)
```

### Kolekcja `promoCodes`

```javascript
{
  codeId: string,
  code: string,                  // 8-char alfanumeryczny (np. "XKPM2937"), łatwy do dyktowania

  // Zakres — kto może użyć
  targetType: 'ANY' | 'CLUB' | 'TEAM' | 'TRAINER' | 'USER',
  targetId: string | null,       // null jeśli ANY (masowy); konkretne ID jeśli support
  targetLabel: string | null,    // czytelna nazwa dla supportu

  // Rabat
  discountPercent: number,       // 0-100; 100 = całkowicie free
  durationMonths: number,        // na ile miesięcy obowiązuje rabat

  // Ważność samego kodu (do kiedy można wpisać)
  codeExpiresAt: timestamp,      // np. 60 dni od generowania

  // Limity użycia
  maxUses: number | null,        // null = unlimited (dla kodów masowych limit np. 500)
  usedCount: number,             // ile razy użyty

  // Meta
  createdBy: string,             // userId supportu / marketingu
  createdAt: timestamp,
  notes: string | null,          // wewnętrzna notatka (np. "awaria 2026-03")
  source: 'SUPPORT' | 'MARKETING' | 'PARTNERSHIP'
}
```

### Kolekcja `promoCodeUses` (log użyć)

```javascript
{
  useId: string,
  codeId: string,
  code: string,
  userId: string,                // kto użył
  targetId: string,              // clubId / trainerId / userId
  discountPercent: number,
  durationMonths: number,
  appliedAt: timestamp,
  appliedBy: 'client' | 'support',   // czy wpisał sam czy support bezpośrednio
  subscriptionExtendedTo: timestamp  // do kiedy teraz ma dostęp
}
```

### Flow — powiadomienie o wygasaniu + ekran płatności

```
[Cloud Function / cron — codziennie]
  → sprawdź subscriptions gdzie validUntil < now + 3 dni
  → stwórz powiadomienie: type: 'SUBSCRIPTION_EXPIRING'
    title: "Dostęp wygasa za 3 dni"
    body: "Odnów subskrypcję aby zachować dostęp"
    action: → otwiera platnosci.html

[Gdy subskrypcja wygasła]
  → powiadomienie: type: 'SUBSCRIPTION_EXPIRED'
    title: "Dostęp wygasł"
    body: "Odnów subskrypcję aby wrócić do pełnego dostępu"
    requiresAction: true → blokuje ekrany (poza płatnościami)
```

### Ekran `platnosci.html` — flow użytkownika

```
1. Widok subskrypcji: aktualny status, data ważności, plan
2. Opcje odnowienia: BASIC / PRO (ceny, okres)
3. Pole "Mam kod" — wpisz kod promocyjny
     → walidacja: kod istnieje? nie wygasł? targetId pasuje?
     → preview rabatu: "Kod aktywny · 3 miesiące free" lub "25% przez 6 mcy"
     → przy 100%: przycisk "Aktywuj bezpłatny dostęp" (bez Stripe)
     → przy <100%: przycisk "Przejdź do płatności" → Stripe Checkout z couponem
4. W iOS: brak przycisku płatności → "Zarządzaj subskrypcją na coachay.pl"
```

### Wejścia do pola "Mam kod"

1. **Z powiadomienia** (główne) — notification → platnosci.html z otwartym polem kodu
2. **Z Ustawień** (secondary) — dla użytkowników którzy dostali kod bez powiadomienia
3. **Support bezpośrednio** — panel support, bez wpisywania kodu przez klienta

### Zabezpieczenia

- `targetType: 'CLUB'` i `targetId: clubId` → tylko użytkownicy tego klubu mogą użyć
- `targetType: 'ANY'` → masowy, ale `maxUses` limituje nadużycia
- `promoCodeUses` loguje każde użycie — pełny audyt
- 100% = tylko przedłuża `validUntil` w Firestore (bez Stripe)
- <100% = Stripe Coupon aplikowany przy checkout (Stripe pilnuje rabatu)

### Role platformowe (2026-04-04)

Trzy role platformowe — **niezależne od ról klubowych** (TRENER, RODZIC itd.):

| Rola | Kto | Opis |
|------|-----|------|
| `ADMIN_PLATFORMY` | Rafał (1 konto) | Pełny dostęp — stats, płatności, raporty Firebase, zarządzanie rolami platformowymi |
| `SUPPORT` | pracownik supportu | Podgląd danych, kody promo — bez danych finansowych |
| `DEV` | developer | Wszystko co SUPPORT + raw Firestore, logi błędów, impersonacja |

#### Gdzie siedzą role
- **Firebase Auth Custom Claims** — bezpieczne, sprawdzane server-side
- **`platformAdmins` collection** — do wyświetlania listy adminów w panelu

```javascript
// Firebase Auth Custom Claim
{ platformRole: 'ADMIN_PLATFORMY' | 'SUPPORT' | 'DEV' }

// platformAdmins/{userId}
{
  userId: string,
  displayName: string,
  email: string,
  platformRole: 'ADMIN_PLATFORMY' | 'SUPPORT' | 'DEV',
  grantedBy: string,      // userId kto nadał
  grantedAt: Timestamp,
  isActive: boolean
}
```

#### Nadawanie ról
- `ADMIN_PLATFORMY` — ustawiany **jednorazowo ręcznie** przez Cloud Function call (tylko Rafał)
- `SUPPORT` / `DEV` — ADMIN_PLATFORMY generuje kod zaproszenia (jak przy trenerach) → nowy user rejestruje się tym kodem → Cloud Function `onPlatformCodeUsed` ustawia Custom Claim

#### Cloud Function: `setPlatformRole`
Jednorazowe nadanie roli Rafałowi + wywoływana przez `onPlatformCodeUsed` przy rejestracji przez kod platformowy.

---

### Panel support (`support.html`)

**Dostęp:** Firebase Auth Custom Claims — `platformRole` musi być ustawione. Niewidoczny w nawigacji. Link dostępny w `profil.html` tylko dla użytkowników z Custom Claim. **Web-only** (nie w app mobilnej na tym etapie).

#### Uprawnienia per sekcja

| Sekcja | SUPPORT | DEV | ADMIN_PLATFORMY |
|--------|---------|-----|-----------------|
| Szukaj usera po Support ID / email | ✅ | ✅ | ✅ |
| Podgląd: rola, klub, membership, status | ✅ | ✅ | ✅ |
| Kody promo — generowanie i historia | ✅ | ✅ | ✅ |
| Zarządzanie rolami platformowymi | ❌ | ❌ | ✅ |
| Statystyki platformy / raporty Firebase | ❌ | ❌ | ✅ |
| Płatności / subskrypcje | ❌ | ❌ | ✅ |
| Surowe dane Firestore (raw doc) | ❌ | ✅ | ✅ |
| Logi błędów (`errors` collection) | ❌ | ✅ | ✅ |
| Impersonacja (wejdź jako user) | ❌ | ✅ | ✅ |

#### Funkcje szczegółowo
- Wyszukaj klub / trenera / użytkownika (po Support ID, nazwie, emailu)
- Generuj kod (targetType, targetId, discountPercent, durationMonths, codeExpiresAt, notatka)
- **Zastosuj bezpośrednio** bez angażowania klienta → klient dostaje powiadomienie
- Historia kodów i użyć (filtr: aktywne / użyte / wygasłe / źródło)
- Podgląd subskrypcji dowolnego konta
- **Impersonacja** → `window.open('start.html?_imp=USER_ID', '_blank')` — nowa zakładka z banerem "⚠️ Impersonujesz: [imię]" + przycisk Wyjdź

---

### Support ID

Generowany przy rejestracji, zapisywany w `users.supportId`. Widoczny w `profil.html`.

Format: `ORY-JAN-4X2` (3 litery klubu + 3 litery imienia + 3 losowe znaki uppercase)

Użycie: user raportuje błąd → podaje Support ID → admin wpisuje w support.html → widzi pełny kontekst.

---

### Kolekcja `errors` — zarządzanie błędami (2026-04-04)

Ekrany automatycznie raportują błędy do Firestore. Zarządzane z support.html (DEV / ADMIN_PLATFORMY).

```javascript
// errors/{errorId}
{
  errorId: string,
  supportId: string,        // Support ID usera
  userId: string,
  page: string,             // np. 'druzyna.html'
  action: string,           // co robił user
  message: string,          // treść błędu
  stack: string | null,     // stack trace
  userAgent: string,
  timestamp: Timestamp,
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX',
  notes: [{
    text: string,
    addedBy: string,        // userId admina
    addedAt: Timestamp
  }],
  resolution: string | null
}
```

**Plan implementacji (kolejność):**
1. Cloud Function `setPlatformRole` + jednorazowy skrypt dla Rafała
2. Support ID — generowanie przy rejestracji + widok w `profil.html`
3. `support.html` — szkielet + auth check (Custom Claims) + szukaj usera
4. Zarządzanie rolami — generowanie kodów dla SUPPORT/DEV
5. DEV tools — raw Firestore viewer, błędy, impersonacja
6. ADMIN_PLATFORMY — statystyki, płatności
