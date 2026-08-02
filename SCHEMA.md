# SCHEMA.md — Struktura bazy Firestore
> Aktualizuj ten plik przy każdej zmianie struktury kolekcji.
> Wygenerowano: 2026-03-27 na podstawie pełnego skanu wszystkich dokumentów.

---

## absences
*Nieobecności zawodników. 3 dokumenty.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `absenceId` | string | ID dokumentu (=`_id`) | ✅ aktualny | — |
| `playerId` | string | Link do `players` | ✅ aktualny | — |
| `userId` | string\|null | Link do `users` (może być null) | ✅ aktualny | — |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `clubId` | string | Link do `clubs` | ✅ aktualny | — |
| `type` | string | `CHOROBA` \| `KONTUZJA` \| `WYJAZD` | ✅ aktualny | — |
| `dateFrom` | string | Data początku (YYYY-MM-DD) | ✅ aktualny | — |
| `dateTo` | string | Data końca (YYYY-MM-DD) | ✅ aktualny | — |
| `reason` | string | Powód nieobecności | ✅ aktualny | — |
| `isActive` | boolean | Czy nieobecność aktywna | ✅ aktualny | — |
| `approvedBy` | string\|null | userId zatwierdzającego | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string | ID zestawu demo | ✅ aktualny | — |

---

## announcements
*Ogłoszenia drużynowe. 7 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `announcementId` | string | ID dokumentu | ✅ aktualny | — |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `clubId` | string | Link do `clubs` | ✅ aktualny | — |
| `type` | string | `INFO` \| `MATCH` \| `BIRTHDAY` \| `ACHIEVEMENT` \| `WARNING` | ✅ aktualny | — |
| `title` | string | Tytuł ogłoszenia | ✅ aktualny | — |
| `body` | string | Treść ogłoszenia | ✅ aktualny | — |
| `isPinned` | boolean | Przypięte na górze | ✅ aktualny | — |
| `visibleDays` | number | Ile dni widoczne | ✅ aktualny | — |
| `expiresAt` | string\|null | ISO timestamp wygaśnięcia | ✅ aktualny | — |
| `icon` | string\|null | Emoji lub ikona | ✅ aktualny | — |
| `matchId` | string\|null | Link do eventu (dla type=MATCH) | ✅ aktualny | — |
| `venue` | object\|null | Miejsce (dla type=MATCH) | ✅ aktualny | — |
| `venue.venueName` | string | Nazwa obiektu | ✅ aktualny | — |
| `venue.address.street` | string | Ulica | ✅ aktualny | — |
| `venue.address.houseNumber` | string | Numer domu | ✅ aktualny | — |
| `venue.address.postalCode` | string | Kod pocztowy | ✅ aktualny | — |
| `venue.address.city` | string | Miasto | ✅ aktualny | — |
| `venue.googleMapsUrl` | string\|null | Link do Google Maps | ✅ aktualny | — |
| `editedAt` | string\|null | ISO timestamp edycji | ✅ aktualny | — |
| `editedBy` | string\|null | userId edytującego | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## clubs
*Kluby. 1 dokument.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `clubId` | string | ID dokumentu | ✅ aktualny | — |
| `clubName` | string | Nazwa potoczna | ✅ aktualny | — |
| `legalName` | string | Oficjalna nazwa prawna | ✅ aktualny | — |
| `owner` | string | userId właściciela | ✅ aktualny | — |
| `managers` | string[] | Lista userId managerów | ✅ aktualny | — |
| `nip` | string | NIP | ✅ aktualny | — |
| `regon` | string | REGON | ✅ aktualny | — |
| `founded` | string | Data założenia (YYYY-MM-DD) | ✅ aktualny | — |
| `president` | string | Imię i nazwisko prezesa | ✅ aktualny | — |
| `address` | object | Adres siedziby | ✅ aktualny | — |
| `address.street` | string | Ulica | ✅ aktualny | — |
| `address.houseNumber` | string | Numer domu | ✅ aktualny | — |
| `address.apartmentNumber` | string | Numer lokalu | ✅ aktualny | — |
| `address.postalCode` | string | Kod pocztowy | ✅ aktualny | — |
| `address.city` | string | Miasto | ✅ aktualny | — |
| `address.district` | string | Dzielnica | ✅ aktualny | — |
| `address.voivodeship` | string | Województwo | ✅ aktualny | — |
| `address.country` | string | Kraj | ✅ aktualny | — |
| `contact.email` | string | Email kontaktowy | ✅ aktualny | — |
| `contact.phone` | string | Telefon kontaktowy | ✅ aktualny | — |
| `website` | string\|null | Strona WWW | ✅ aktualny | — |
| `logoURL` | string\|null | URL logo | ✅ aktualny | — |
| `socialMedia.facebook` | string\|null | Facebook URL | ✅ aktualny | — |
| `socialMedia.instagram` | string\|null | Instagram handle | ✅ aktualny | — |
| `transferHistory` | array | Historia transferów (na razie pusta) | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## events
*Wydarzenia (treningi, mecze, wyjazdy). 13 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `eventId` | string | ID dokumentu | ✅ aktualny | — |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `clubId` | string | Link do `clubs` | ✅ aktualny | — |
| `type` | string | `TRENING` \| `MECZ` \| `WYJAZD` | ✅ aktualny | — |
| `title` | string | Tytuł | ✅ aktualny | — |
| `description` | string\|null | Opis | ✅ aktualny | — |
| `date` | string | Data (YYYY-MM-DD) | ✅ aktualny | — |
| `timeFrom` | string | Godzina start (HH:MM) | ✅ aktualny | — |
| `timeTo` | string | Godzina koniec (HH:MM) | ✅ aktualny | — |
| `location.venueName` | string | Nazwa miejsca | ✅ aktualny | — |
| `location.address` | string | Adres (plain text) | ✅ aktualny | — |
| `priority` | number | Priorytet (1=niski, 3=wysoki) | ✅ aktualny | — |
| `visibility` | string[] | Role które widzą: `DRUZYNA`, `TRENERZY`, itd. | ✅ aktualny | — |
| `visibleTo` | string[] | Lista userId (redundantna z visibility?) | ✅ aktualny | — |
| `requireConfirmation` | boolean | Czy wymagane potwierdzenie obecności | ✅ aktualny | — |
| `showInAnnouncements` | boolean | Czy pokazać w ogłoszeniach | ✅ aktualny | — |
| `reminderHoursBefore` | number | Ile h przed przypomnienie | ✅ aktualny | — |
| `seriesId` | string\|null | ID serii (cykliczne) | ✅ aktualny | — |
| `topicId` | string\|null | Link do `trainingTopics` | ✅ aktualny | — |
| `attendance.invited` | string[] | playerId zaproszonych | ✅ aktualny | — |
| `attendance.confirmed` | string[] | playerId potwierdzonych | ✅ aktualny | — |
| `attendance.declined` | string[] | playerId odmawiających | ✅ aktualny | — |
| `attendance.markedAbsent` | string[] | playerId oznaczonych nieobecnymi | ✅ aktualny | — |
| `attendance.declineReasons` | map | `{playerId: powód}` — powody odmów | ✅ aktualny | — |
| `attendance.decidedBy` | map | `{playerId: {by, byName, byRole, at}}` — kto zdecydował | ✅ aktualny | — |
| `matchData` | object\|null | Dane meczu (tylko type=MECZ) | ✅ aktualny | — |
| `matchData.opponent` | string | Nazwa rywala | ✅ aktualny | — |
| `matchData.homeAway` | string | `HOME` \| `AWAY` \| `NEUTRAL` | ✅ aktualny | — |
| `matchData.matchStatus` | string | `UPCOMING` \| `LIVE` \| `FINISHED` | ✅ aktualny | — |
| `matchData.lineup` | array | Skład | ✅ aktualny | — |
| `matchData.playerEvents` | array | Gole, kartki, itd. | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## inviteCodes
*Kody zaproszeniowe. 14 dokumentów. Schemat ewoluował — patrz uwagi.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `codeId` | string | ID dokumentu | ✅ aktualny | — |
| `code` | string | Kod do wpisania przez użytkownika | ✅ aktualny | — |
| `type` | string | `TRENER` \| `RODZIC` \| `PLAYER` \| `OBSERVER` | ✅ aktualny | — |
| `role` | string\|null | Granularna rola: `TRENER_GLOWNY` \| `TRENER_POMOCNICZY` | ✅ aktualny | 2026-03 |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `clubId` | string\|null | Link do `clubs` | ✅ aktualny | — |
| `playerId` | string\|null | Link do `players` (RODZIC, PLAYER) | ✅ aktualny | — |
| `observedPlayerId` | string\|null | Link do `players` (OBSERVER — stary format) | ⚠️ stary | 2024 |
| `trainerId` | string\|null | Link do `trainers` (TRENER) | ✅ aktualny | 2026-03 |
| `forName` | string\|null | Imię odbiorcy kodu | ✅ aktualny | — |
| `observerName` | string\|null | Imię obserwatora (OBSERVER — stary format) | ⚠️ stary | 2024 |
| `isUsed` | boolean | Czy kod został użyty | ✅ aktualny | — |
| `usedBy` | string\|null | userId który użył / `DEZAKTYWOWANY_PRZEZ_TRENERA` | ✅ aktualny | — |
| `usedAt` | string\|null | ISO timestamp użycia | ✅ aktualny | — |
| `pin` | string\|null | PIN (plain text — do usunięcia!) | ⚠️ stary | 2024 |
| `pinHash` | string\|null | Hash PIN | ✅ aktualny | — |
| `expiresAt` | string\|null | ISO timestamp wygaśnięcia | ✅ aktualny | — |
| `emailsSent` | array | `[{to, type, sentAt, status}]` | ✅ aktualny | — |
| `transferTo` | string\|null | Do kogo przekazać kod | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

**Uwagi dotyczące ewolucji schematu:**
- Stare kody (2024): `type=PLAYER/OBSERVER`, brak pola `role`, używają `observedPlayerId` i `observerName`
- Nowe kody (2026-03): `type=TRENER` + `role=TRENER_GLOWNY/TRENER_POMOCNICZY` + `trainerId`
- Pole `pin` (plain text) powinno być usunięte — zastąpione przez `pinHash`

---

## memberships
*Członkostwa — centralna kolekcja dostępu. 21 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `membershipId` | string | ID dokumentu | ✅ aktualny | 2026-03 |
| `clubId` | string | Link do `clubs` | ✅ aktualny | 2026-03 |
| `userId` | string\|null | Link do `users` (null = pending) | ✅ aktualny | 2026-03 |
| `role` | string | `TRENER` \| `ZAWODNIK` \| `RODZIC` \| `KIBIC` | ✅ aktualny | 2026-03 |
| `trainerRole` | string\|null | `TRENER_GLOWNY` \| `TRENER_POMOCNICZY` (dla roli TRENER) | ✅ aktualny | 2026-03 |
| `teamId` | string\|null | Link do `teams` | ✅ aktualny | 2026-03 |
| `playerId` | string\|null | Link do `players` (ZAWODNIK, RODZIC, KIBIC) | ✅ aktualny | 2026-03 |
| `status` | string | `active` \| `pending` \| `deactivated` \| `demo` \| `grace` \| `expired` | ✅ aktualny | 2026-03 |
| `code` | string\|null | Kod zaproszeniowy | ✅ aktualny | 2026-03 |
| `pinHash` | string\|null | Hash PIN | ✅ aktualny | 2026-03 |
| `codeCreatedBy` | string\|null | userId który stworzył kod | ✅ aktualny | 2026-03 |
| `codeCreatedAt` | string\|null | ISO timestamp stworzenia kodu | ✅ aktualny | 2026-03 |
| `codeExpiresAt` | string\|null | ISO timestamp wygaśnięcia kodu | ✅ aktualny | 2026-03 |
| `codeUsedAt` | string\|null | ISO timestamp użycia kodu | ✅ aktualny | 2026-03 |
| `managedBy` | string\|null | `rodzic` \| `trener` — kto zarządza zawodnikiem | ✅ aktualny | 2026-03 |
| `guardianMembershipIds` | string[] | Lista ID memberships opiekunów | ✅ aktualny | 2026-03 |
| `paidBy` | string\|null | `club` \| `user` — kto płaci | ✅ aktualny | 2026-03 |
| `subscriptionTier` | string\|null | `RODZIC` \| `KIBIC` — tier subskrypcji | ✅ aktualny | 2026-03 |
| `subscriptionExpiry` | string\|null | ISO timestamp końca subskrypcji | ✅ aktualny | 2026-03 |
| `gracePeriodEnd` | string\|null | ISO timestamp końca grace period | ✅ aktualny | 2026-03 |
| `warnings` | array | Lista ostrzeżeń | ✅ aktualny | 2026-03 |
| `warningCount` | number | Liczba ostrzeżeń | ✅ aktualny | 2026-03 |
| `commsBlockedUntil` | string\|null | ISO timestamp blokady komunikacji | ✅ aktualny | 2026-03 |
| `notificationsEnabled` | boolean | Czy powiadomienia włączone | ✅ aktualny | 2026-03 |
| `isReadOnly` | boolean | Blokada zapisu (demo, zawieszony) | ✅ aktualny | 2026-03 |
| `createdAt` | string | ISO timestamp | ✅ aktualny | 2026-03 |
| `createdBy` | string | userId tworzącego | ✅ aktualny | 2026-03 |
| `isDemo` | boolean | Dane demo | ✅ aktualny | 2026-03 |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | 2026-03 |

**Konwencja ID:**
| Typ | Format | Przykład |
|-----|--------|---------|
| Trener | `mbr_{userId}` | `mbr_demo_trener_jan` |
| Zawodnik | `mbr_{userId}` | `mbr_demo_zawodnik_jasiek` |
| Rodzic (per dziecko) | `mbr_{userId}_{playerId}` | `mbr_demo_rodzic_anna_demo_player_jasiek` |
| Kibic (per zawodnik) | `mbr_{userId}_{playerId}` | `mbr_demo_obserwator_babcia_demo_player_jasiek` |
| Z kodu | `mbr_code_{codeId}` | `mbr_code_code_babcia_jasiek` |

---

## messages
*Wiadomości. 56 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `messageId` | string | ID dokumentu | ✅ aktualny | — |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `type` | string | `MESSAGE` \| `BROADCAST` \| `PRIVATE` \| `GROUP` | ✅ aktualny | — |
| `from` | string | userId nadawcy | ✅ aktualny | — |
| `to` | string[] | Lista userId odbiorców | ✅ aktualny | — |
| `title` | string | Temat wiadomości | ✅ aktualny | — |
| `body` | string | Treść wiadomości | ✅ aktualny | — |
| `readBy` | string[] | Lista userId którzy przeczytali | ✅ aktualny | — |
| `replyTo` | string\|null | ID wiadomości-rodzica | ✅ aktualny | — |
| `announcementId` | string\|null | Link do ogłoszenia | ✅ aktualny | — |
| `attachments` | array | Załączniki | ✅ aktualny | — |
| `archived` | boolean | Czy zarchiwizowana | ✅ aktualny | — |
| `editedAt` | string\|null | ISO timestamp edycji | ✅ aktualny | — |
| `editedBy` | string\|null | userId edytującego | ✅ aktualny | — |
| `visibleDays` | number\|null | Ile dni widoczna | ✅ aktualny | — |
| `expiresAt` | string\|null | ISO timestamp wygaśnięcia | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## notifications
*Powiadomienia push/in-app. 15 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `notificationId` | string | ID dokumentu | ✅ aktualny | — |
| `userId` | string | Link do `users` — odbiorca | ✅ aktualny | — |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `type` | string | `EVENT_ATTENDANCE` \| `NEW_ANNOUNCEMENT` \| `NEW_MESSAGE` | ✅ aktualny | — |
| `title` | string | Tytuł powiadomienia | ✅ aktualny | — |
| `body` | string | Treść powiadomienia | ✅ aktualny | — |
| `priority` | string | `NORMAL` \| `HIGH` | ✅ aktualny | — |
| `referenceType` | string | Typ powiązanego obiektu (`event`, `announcement`, itp.) | ✅ aktualny | — |
| `referenceId` | string | ID powiązanego obiektu | ✅ aktualny | — |
| `forPlayerId` | string\|null | playerId którego dotyczy | ✅ aktualny | — |
| `requiresAction` | boolean | Czy wymaga akcji użytkownika | ✅ aktualny | — |
| `actionType` | string\|null | `ATTENDANCE` \| ... | ✅ aktualny | — |
| `actionDone` | boolean | Czy akcja wykonana | ✅ aktualny | — |
| `actionResult` | string\|null | Wynik akcji (`expired`, itp.) | ✅ aktualny | — |
| `actionComment` | string\|null | Komentarz do akcji | ✅ aktualny | — |
| `isRead` | boolean | Czy przeczytane | ✅ aktualny | — |
| `readAt` | string\|null | ISO timestamp przeczytania | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## players
*Zawodnicy. 16 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `playerId` | string | ID dokumentu | ✅ aktualny | — |
| `name` | string | Imię i nazwisko | ✅ aktualny | — |
| `number` | number | Numer na koszulce | ✅ aktualny | — |
| `position` | string | Pozycja na boisku | ✅ aktualny | — |
| `birthDate` | string | Data urodzenia (YYYY-MM-DD) | ✅ aktualny | — |
| `photoURL` | string\|null | URL zdjęcia | ✅ aktualny | — |
| `photoConsent` | boolean | Zgoda na publikację zdjęć | ✅ aktualny | — |
| `squad` | string\|null | Skład / sekcja | ✅ aktualny | — |
| `teams` | array | `[{teamId, status, isPrimary, joinedAt}]` | ✅ aktualny | — |
| `userAccountId` | string\|null | Link do `users` jeśli zawodnik ma konto | ✅ aktualny | — |
| `guardianId` | string\|null | userId głównego rodzica/opiekuna | ✅ aktualny | — |
| `guardianIds` | string[]\|null | Tablica userId opiekunów — **może być pusta `[]`** | ⚠️ nie używany | 2024 |
| `guardianData` | object | Dane kontaktowe opiekuna | ✅ aktualny | — |
| `guardianData.guardianName` | string | Imię i nazwisko opiekuna | ✅ aktualny | — |
| `guardianData.guardianPhone` | string | Telefon opiekuna | ✅ aktualny | — |
| `guardianData.guardianEmail` | string | Email opiekuna | ✅ aktualny | — |
| `guardianData.address` | object | Adres zamieszkania | ✅ aktualny | — |
| `coachOnlyData` | object | Dane widoczne tylko dla trenera | ✅ aktualny | — |
| `coachOnlyData.level` | string | Poziom zawodnika (np. `2A`) | ✅ aktualny | — |
| `coachOnlyData.coachNotes` | string | Notatki trenera | ✅ aktualny | — |
| `publicData` | object | Statystyki publiczne | ✅ aktualny | — |
| `publicData.goals` | number | Gole | ✅ aktualny | — |
| `publicData.assists` | number | Asysty | ✅ aktualny | — |
| `publicData.matches` | number | Mecze | ✅ aktualny | — |
| `publicData.attendance` | string | Frekwencja (np. `"75%"`) | ✅ aktualny | — |
| `publicData.yellowCards` | number | Żółte kartki | ✅ aktualny | — |
| `publicData.redCards` | number | Czerwone kartki | ✅ aktualny | — |
| `publicData.cleanSheets` | number | Czyste konta (bramkarze) | ✅ aktualny | — |
| `history` | array | `[{action, details, by, at}]` — log zmian | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |
| `demoVisibleFor` | string[] | Role które widzą zawodnika w trybie demo | ✅ aktualny | — |
| `demoEditableBy` | string[] | Role które mogą edytować w trybie demo | ✅ aktualny | — |

**Uwaga:** `guardianIds` (plural, array) pojawia się w bazie jako puste `[]` w niektórych dokumentach — nie jest używane. Aktywne pole to `guardianId` (singular, string).

---

## sparringOffers
*Oferty sparingowe. 4 dokumenty.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `offerId` | string | ID dokumentu | ✅ aktualny | — |
| `coachId` | string | userId trenera oferującego | ✅ aktualny | — |
| `coachName` | string | Imię trenera | ✅ aktualny | — |
| `clubName` | string | Nazwa klubu | ✅ aktualny | — |
| `teamName` | string | Nazwa drużyny | ✅ aktualny | — |
| `category` | string | Kategoria wiekowa (np. `U10`) | ✅ aktualny | — |
| `level` | string | Poziom (np. `Amatorzy`) | ✅ aktualny | — |
| `location` | string | Lokalizacja (plain text) | ✅ aktualny | — |
| `venue` | object\|null | Szczegóły boiska | ✅ aktualny | — |
| `venue.venueName` | string | Nazwa obiektu | ✅ aktualny | — |
| `venue.address` | object | Adres obiektu | ✅ aktualny | — |
| `venue.coordinates.lat` | number | Szerokość geogr. | ✅ aktualny | — |
| `venue.coordinates.lng` | number | Długość geogr. | ✅ aktualny | — |
| `venue.googleMapsUrl` | string\|null | Link do Google Maps | ✅ aktualny | — |
| `dates` | string[] | Dostępne daty (YYYY-MM-DD) | ✅ aktualny | — |
| `description` | string | Opis oferty | ✅ aktualny | — |
| `fieldPreference` | string | `HOME` \| `AWAY` \| `NEUTRAL_OR_AWAY` | ✅ aktualny | — |
| `distance` | number | Odległość w km | ✅ aktualny | — |
| `matchesPlayed` | number | Liczba rozegranych sparingów | ✅ aktualny | — |
| `sparingsThroughApp` | number | Sparingi przez aplikację | ✅ aktualny | — |
| `fairPlayRating` | object | Ocena fair play | ✅ aktualny | — |
| `fairPlayRating.overall` | number | Ocena ogólna | ✅ aktualny | — |
| `fairPlayRating.sportLevel` | number | Poziom sportowy | ✅ aktualny | — |
| `fairPlayRating.teamFairPlay` | number | Fair play drużyny | ✅ aktualny | — |
| `fairPlayRating.fansBehavior` | number | Zachowanie kibiców | ✅ aktualny | — |
| `fairPlayRating.reviewsCount` | number | Liczba ocen | ✅ aktualny | — |
| `lastReview` | object\|null | Ostatnia recenzja | ✅ aktualny | — |
| `lastReview.date` | string | Data recenzji | ✅ aktualny | — |
| `lastReview.rating` | number | Ocena | ✅ aktualny | — |
| `lastReview.from` | string | Od kogo | ✅ aktualny | — |
| `lastReview.comment` | string | Komentarz | ✅ aktualny | — |
| `warningLevel` | string\|null | `LOW` \| `MEDIUM` \| `HIGH` | ✅ aktualny | — |
| `warningReason` | string\|null | Opis powodu ostrzeżenia | ✅ aktualny | — |
| `featuredBadge` | string\|null | Wyróżnienie | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |
| `demoVisibleFor` | string[] | Role które widzą ofertę w trybie demo | ✅ aktualny | — |
| `demoEditableBy` | string[] | Role które mogą edytować w trybie demo | ✅ aktualny | — |

---

## tasks
*Zadania dla trenerów. 7 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `taskId` | string | ID dokumentu | ✅ aktualny | — |
| `teamId` | string | Link do `teams` | ✅ aktualny | — |
| `title` | string | Tytuł zadania | ✅ aktualny | — |
| `description` | string\|null | Opis zadania | ✅ aktualny | — |
| `assignedTo` | string[] | Lista userId przypisanych | ✅ aktualny | — |
| `status` | string | `PENDING` \| `DONE` | ✅ aktualny | — |
| `dueDate` | string\|null | ISO timestamp terminu | ✅ aktualny | — |
| `completedBy` | string[] | Lista userId którzy ukończyli | ✅ aktualny | — |
| `completedAt` | string\|null | ISO timestamp ukończenia | ✅ aktualny | — |
| `rejectedBy` | string[] | Lista userId którzy odrzucili | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## teams
*Drużyny. 1 dokument.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `teamId` | string | ID dokumentu | ✅ aktualny | — |
| `clubId` | string | Link do `clubs` | ✅ aktualny | — |
| `clubName` | string | Nazwa klubu (denormalizacja) | ✅ aktualny | — |
| `teamName` | string | Pełna nazwa (np. `Rocznik 2015`) | ✅ aktualny | — |
| `displayName` | string | Krótka nazwa (np. `U10 Orły`) | ✅ aktualny | — |
| `category` | string | Kategoria wiekowa (np. `U10`) | ✅ aktualny | — |
| `teamColor` | string | Kolor hex (np. `#3B82F6`) | ✅ aktualny | — |
| `colors.primary` | string | Kolor główny | ✅ aktualny | — |
| `colors.secondary` | string | Kolor dodatkowy | ✅ aktualny | — |
| `colors.text` | string | Kolor tekstu | ✅ aktualny | — |
| `coachId` | string | userId głównego trenera | ✅ aktualny | — |
| `assistantCoaches` | string[] | Lista userId asystentów | ✅ aktualny | — |
| `league` | string | Nazwa ligi | ✅ aktualny | — |
| `homeField` | string | Nazwa i adres boiska domowego | ✅ aktualny | — |
| `location` | string | Miasto/dzielnica | ✅ aktualny | — |
| `founded` | string | Data założenia (YYYY-MM-DD) | ✅ aktualny | — |
| `periods` | array | `[{id, name, start, end}]` — rundy/okresy | ✅ aktualny | — |
| `settings.attendanceThreshold` | number | Próg frekwencji (%) | ✅ aktualny | — |
| `settings.sessionDuration` | number | Czas treningu (min) | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## trainers
*Profile trenerów. 4 dokumenty. Osobna od `users`, połączona przez `userId`.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `trainerId` | string | ID dokumentu | ✅ aktualny | — |
| `userId` | string | Link do `users` | ✅ aktualny | — |
| `clubId` | string | Link do `clubs` | ✅ aktualny | — |
| `teamIds` | string[] | Lista teamId | ✅ aktualny | — |
| `teamNames` | string[] | Nazwy drużyn (denormalizacja) | ✅ aktualny | — |
| `role` | string | `TRENER_GLOWNY` \| `TRENER_POMOCNICZY` | ✅ aktualny | — |
| `displayName` | string | Imię i nazwisko | ✅ aktualny | — |
| `email` | string | Email służbowy | ✅ aktualny | — |
| `isActive` | boolean | Czy aktywny w klubie | ✅ aktualny | — |
| `registrationStatus` | string\|null | Status rejestracji | ✅ aktualny | — |
| `coachProfile.licenseLevel` | string | Licencja (np. `UEFA B`) | ✅ aktualny | — |
| `coachProfile.bio` | string | Biografia | ✅ aktualny | — |
| `coachProfile.specialization` | string | Specjalizacja | ✅ aktualny | — |
| `coachProfile.coachingSince` | string | Rok rozpoczęcia pracy | ✅ aktualny | — |
| `coachProfile.phone` | string\|null | Telefon | ✅ aktualny | — |
| `coachProfile.phoneVisible` | boolean | Czy telefon widoczny | ✅ aktualny | — |
| `coachProfile.emailVisible` | boolean | Czy email widoczny | ✅ aktualny | — |
| `coachProfile.photoConsent` | boolean | Zgoda na zdjęcia | ✅ aktualny | — |
| `roleHistory` | array | `[{from, to, changedAt, changedBy, reason}]` | ✅ aktualny | — |
| `deactivatedAt` | string\|null | ISO timestamp dezaktywacji | ✅ aktualny | — |
| `deactivatedBy` | string\|null | userId dezaktywującego | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `updatedAt` | string | ISO timestamp ostatniej aktualizacji | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## trainingTopics
*Tematy treningów. 8 dokumentów.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `topicId` | string | ID dokumentu | ✅ aktualny | — |
| `clubId` | string | Link do `clubs` | ✅ aktualny | — |
| `title` | string | Nazwa tematu | ✅ aktualny | — |
| `priority` | number | Kolejność wyświetlania | ✅ aktualny | — |
| `isActive` | boolean | Czy aktywny | ✅ aktualny | — |
| `modifiedAt` | string\|null | ISO timestamp modyfikacji | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `createdBy` | string | userId tworzącego | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |

---

## users
*Konta użytkowników. 6 dokumentów. Tylko dane personalne i auth — zero danych o rolach/klubach.*

| Pole | Typ | Opis | Status | Od |
|------|-----|------|--------|----|
| `uid` | string | ID dokumentu (=Firebase Auth UID) | ✅ aktualny | — |
| `displayName` | string | Imię i nazwisko | ✅ aktualny | — |
| `email` | string\|null | Email | ✅ aktualny | — |
| `hasEmail` | boolean | Czy ma email | ✅ aktualny | v4.1 |
| `authProvider` | string | `email` \| `google` \| `apple` \| `phone` | ✅ aktualny | v4.1 |
| `avatarUrl` | string\|null | URL avatara (DiceBear lub własne) | ✅ aktualny | v4.1 |
| `avatarGender` | string\|null | `male` \| `female` | ✅ aktualny | v4.1 |
| `loginPinHash` | string\|null | Hash PIN (6 cyfr) | ✅ aktualny | v4.1 |
| `photoConsent` | boolean | Zgoda na używanie zdjęcia | ✅ aktualny | v4.1 |
| `termsAcceptedAt` | string\|null | ISO — kiedy zaakceptował regulamin | ✅ aktualny | v4.1 |
| `rodoAcceptedAt` | string\|null | ISO — kiedy zaakceptował RODO | ✅ aktualny | v4.1 |
| `accountStatus` | string | `active` \| `banned` (globalny ban przez ADMIN_PLATFORMY) | ✅ aktualny | v4.1 |
| `isReadOnly` | boolean | Globalny przełącznik zapisu (demo, zawieszony, grace) | ✅ aktualny | v4.1 |
| `language` | string | Język (`pl`, `en`) | ✅ aktualny | — |
| `createdAt` | string | ISO timestamp | ✅ aktualny | — |
| `lastLoginAt` | string\|null | ISO timestamp ostatniego logowania | ✅ aktualny | — |
| `isDemo` | boolean | Dane demo | ✅ aktualny | — |
| `demoSetId` | string\|null | ID zestawu demo | ✅ aktualny | — |
| `role` | string | ~~Rola użytkownika~~ | ❌ usunięty | v4.1 → memberships |
| `contexts` | array | ~~Lista kontekstów klubów~~ | ❌ usunięty | v4.1 → memberships |
| `children` | array | ~~Dzieci rodzica~~ | ❌ usunięty | v4.1 → memberships |
| `observedChildren` | array | ~~Obserwowane dzieci~~ | ❌ usunięty | v4.1 → memberships |
| `playerId` | string\|null | ~~Link do players~~ | ❌ usunięty | v4.1 → memberships |
| `trainerId` | string\|null | ~~Link do trainers~~ | ❌ usunięty | v4.1 → memberships |

---

## Legenda

| Status | Znaczenie |
|--------|-----------|
| ✅ aktualny | Pole używane w bieżącym kodzie |
| ⚠️ stary | Pole z poprzedniej wersji schematu — może współistnieć ze starymi dokumentami |
| ❌ usunięty | Pole wycofane — nie dodawać do nowych dokumentów |

---

*Ostatnia aktualizacja: 2026-03-28*
*Następna aktualizacja: przy każdej zmianie struktury kolekcji*
