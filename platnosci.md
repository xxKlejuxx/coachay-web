# COACHAY — System Płatności

_Ostatnia aktualizacja: 2026-04-20_

---

## 1. Model Danych (Firestore)

### Kolekcja `access_rights/{id}`
Główna brama dostępu — sprawdzana przy każdym wejściu do ekranów klubu.
ID dokumentu: `${uid}_${clubId}`
```
uid:              string       // ID użytkownika
club_id:          string       // ID klubu
product_id:       string       // "sub_individual_monthly" | "sub_individual_yearly"
                               // "sub_family_monthly" | "sub_family_yearly"
source:           string       // "personal" | "family" | "club_pool" | "apple" | "google"
provider:         string       // "przelewy24" | "stripe" | "apple" | "google" | "manual_support"
valid_until:      Timestamp    // koniec opłaconego okresu
renewed_at:       Timestamp    // kiedy ostatnio odnowiono
card_token:       string|null  // token karty Przelewy24/Stripe (płatności cykliczne)
auto_renew:       boolean      // czy płatność cykliczna aktywna
// tylko dla source == "family":
slots_total:      number|null  // 6 dla pakietu rodzinnego
slots_used:       number|null  // ile slotów zajętych (właściciel RODZIC = 1 przy zakupie)
```

**Uwaga dot. nazw pól:** W kolekcji `access_rights` pola to `uid` i `club_id` (nie `userId`/`clubId`).
Wszystkie zapytania muszą używać tych nazw. Helper `getFamilySlots(uid, clubId)` w `coachay-core.js`
enkapsuluje nazwy — ekrany nie odpytują `access_rights` bezpośrednio.

### Kolekcja `clubs/{clubId}` — pole licencji klubowej B2B
```
license: {
  total:          number,     // liczba zakupionych licencji (10 / 50 / 100 / 500)
  used:           number,     // aktualnie przypisanych slotów
  valid_until:    Timestamp,  // koniec opłaconego okresu klubowego
  renewed_at:     Timestamp,  // kiedy admin kupił/odnowił licencję (używane do reset slotów)
  product_id:     string,     // "club_license_10" | ... | "club_license_500"
  provider:       string,     // "stripe" | "przelewy24" | "manual_support"
  auto_renew:     boolean,
  card_token:     string|null,
  scope:          string,     // "all" | "trainers_only" | "custom"
  roles:          string[]    // tylko gdy scope == "custom", np. ["TRENER_GLOWNY","RODZIC"]
  force_club_pool: boolean    // true = RODZIC pomija własną licencję, używa B2B (patrz sekcja 8)
} | null                      // null = brak aktywnej licencji B2B
```

### Kolekcja `clubs/{clubId}` — pole statusu licencji (wyliczane przez CF)
```
licenseStatus:          string    // 'ACTIVE' | 'TRIAL' | 'GRACE' | 'EXPIRED'
licenseStatusSource:    string    // 'club_license' | 'admin_personal' | 'trial' | null
licenseStatusUpdatedAt: Timestamp // kiedy CF ostatnio zaktualizowała
```
**Uwaga:** Pole `licenseStatus` jest ustawiane przez Cloud Function `updateClubLicenseStatuses`
codziennie o 06:00. Klient czyta to pole zamiast samodzielnie liczyć.

### Kolekcja `memberships/{id}` — dodatkowe pola płatności
```
licenseSource:        string|null    // "CLUB" | "FAMILY" | null
licenseStatus:        string|null    // "ACTIVE" | null
poolClaimedAt:        Timestamp|null // kiedy pobrano slot z puli B2B (null = nie pobrano)
familySlotParent:     string|null    // dla KIBIC — uid rodzica którego family license pokrywa kibica
familySlotClaimedAt:  Timestamp|null // kiedy KIBIC pobrał slot z puli family (lazy claim)
```
**Uwaga:** `parentUserId` nie jest używane — P4 używa `playerId → memberships RODZIC → userId`.
**Uwaga:** ZAWODNIK zawsze ma `licenseSource: null` — nie uczestniczy w systemie płatności.

`poolClaimedAt` służy też do wykrywania nieaktualnych slotów: jeśli
`poolClaimedAt < clubs.license.renewed_at` → slot jest nieaktualny → re-claim przy logowaniu.

### Kolekcja `subscriptions/{id}`
Historia wpłat — tylko do raportów i faktur, nie używana do sprawdzania dostępu.
```
owner_uid:    string
club_id:      string
product_id:   string
provider:     string
amount:       number       // kwota w groszach
currency:     string       // "PLN"
paid_at:      Timestamp
period_from:  Timestamp
period_to:    Timestamp
invoice_url:  string|null
```

---

## 2. Trial — 90 dni per klub (nie per user)

**Kluczowa zasada:** trial jest przypisany do klubu na podstawie `clubs.createdAt + 90 dni`.
Nie zależy od tego kiedy konkretny user dołączył do klubu.

- Klub założony 1 stycznia → trial wygasa 1 kwietnia
- Trener B dołącza 1 marca → dostaje 30 dni trialu (do 1 kwietnia)
- Nikt nie może przedłużyć trialu przez dodawanie nowych trenerów

**Podczas trialu żadne sloty nie są konsumowane** — ani B2B, ani FAMILY.
Dopiero po wygaśnięciu trialu system zaczyna przypisywać sloty.

---

## 3. Statusy Dostępu — pełna kolejność priorytetów per rola

Funkcja `getAccessStatus(uid, clubId, { claimSlot = false })` sprawdza kolejno:

### Krok 0 — Trial (globalny, przed wszystkim)
Sprawdź `clubs.createdAt + 90 dni`:
- Trial aktywny → zwróć `TRIAL` lub `GRACE` — **STOP, żaden slot nie jest konsumowany**
- Trial wygasł → kontynuuj do P1

**Wyjątek:** jeśli user ma własne `access_rights` z ważnym `valid_until` (P1) →
zwróć `ACTIVE` nawet podczas trialu (ktoś zapłacił wcześniej).

### Krok 1 — Własna licencja (każda rola)
Sprawdź `access_rights` gdzie `uid == uid AND club_id == clubId`:
- `valid_until > teraz` → `ACTIVE`
- `valid_until > teraz - 7 dni` → `GRACE`
- Brak dokumentu lub wygasł → kontynuuj do P2/P3/P4

### Krok 2 — RODZIC z licencją FAMILY
Dotyczy tylko roli `RODZIC`.
- P1 już obsługuje RODZICA z własną licencją (individual lub family) — RODZIC jako
  właściciel licencji family jest zawsze objęty, niezależnie od `slots_used`
- Jeśli P1 nie zwrócił wyniku → RODZIC nie ma własnej licencji → przejdź do P3

### Krok 3 — Slot B2B klubowy (TRENER i RODZIC)
Dotyczy ról: `TRENER_GLOWNY`, `TRENER_POMOCNICZY`, `OWNER`, `RODZIC`.

**Sprawdzenie scope:**
```
clubs.license.scope == "all"           → TRENER i RODZIC uprawnieni
clubs.license.scope == "trainers_only" → tylko TRENER uprawniony
clubs.license.scope == "custom"        → sprawdź clubs.license.roles[]
```
Jeśli rola nie jest w scope → pomiń P3, przejdź do P4/EXPIRED.

**Sprawdzenie czy `force_club_pool` wpływa na P1:**
Jeśli `clubs.license.force_club_pool == true` AND `clubs.license.valid_until > teraz`
AND rola RODZIC jest w scope:
→ P1 (własna licencja RODZICA) jest pomijana, RODZIC trafia bezpośrednio do P3.
→ Jeśli licencja klubu wygaśnie → flaga `force_club_pool` jest automatycznie ignorowana,
  RODZIC wraca do P1.

**Logika slotu (Floating License):**
```
membership.poolClaimedAt >= clubs.license.renewed_at?
  TAK → slot aktualny → sprawdź clubs.license.valid_until:
    valid_until > teraz → ACTIVE
    valid_until > teraz - 7d → GRACE
    wygasła → EXPIRED (slot nieważny)
  NIE (lub poolClaimedAt null) → slot nieaktualny lub nie pobrany
    → jeśli claimSlot == true: wywołaj claimClubLicenseSlot()
      used < total → claim → ACTIVE
      used >= total → EXPIRED (source: 'club_pool_full')
    → jeśli claimSlot == false → nie claimuj, kontynuuj
```

### Krok 4 — Licencja FAMILY rodzica (tylko KIBIC)
Dotyczy tylko roli `KIBIC`.

Lookup: `membership.playerId` → `memberships gdzie role=RODZIC AND playerId==playerId` → `getFamilySlots(parentUid, clubId)`

Obsługuje 2 rodziców — iteruje przez wszystkich rodziców dziecka, bierze pierwszego z wolnym slotem.

**Lazy claim (przy `claimSlot=true`):**
- Sprawdź `membership.familySlotParent == parentUid` → slot już przypisany → pomiń claim
- Jeśli brak → sprawdź `slotsUsed < slotsTotal` → transakcja: `slots_used++` → zapisz `familySlotParent` i `familySlotClaimedAt` na membership

```
parent.access_rights.valid_until > teraz
AND parent.access_rights.slots_total > 1
AND (alreadyClaimed OR slotsUsed < slotsTotal)
→ ACTIVE (source: 'family_license')
```
Jeśli żaden rodzic nie ma access_rights lub wszystkie sloty zajęte → kontynuuj do EXPIRED.

### Krok 5 — ZAWODNIK
ZAWODNIK **nigdy** nie przechodzi przez powyższe kroki.
`getAccessStatus` dla ZAWODNIKA zawsze zwraca `{ status: 'ACTIVE', source: 'player' }`.

### Krok 6 — EXPIRED
Żaden z powyższych kroków nie dał wyniku → `{ status: 'EXPIRED', source: null }`.

---

| Status | Warunek | Dostęp do apki |
|---|---|---|
| `ACTIVE` | `valid_until > teraz` | Tak |
| `TRIAL` | trial klubu jeszcze trwa | Tak |
| `GRACE` | valid_until lub trial wygasł, ale < 7 dni temu | Tak (z banerem) |
| `EXPIRED` | wygasło > 7 dni temu | Zależy od roli (patrz sekcja 9) |

**Grace period: 7 dni** — stały, nie konfigurowalny.

---

## 4. Status Klubu — logika CF (updateClubLicenseStatuses)

Cloud Function odpala się codziennie o 06:00 i zapisuje `clubs.licenseStatus`.

**Priorytet:**
1. `clubs.license.valid_until > teraz` → **ACTIVE** (source: `club_license`)
2. Przynajmniej jeden admin klubu (`trainers.isClubAdmin == true`) ma aktywne `access_rights` → **ACTIVE** (source: `admin_personal`)
3. `clubs.createdAt + 90 dni > teraz` → **TRIAL** (source: `trial`)
4. Którykolwiek z powyższych wygasł < 7 dni temu → **GRACE**
5. Nic → **EXPIRED**

**Hybryda:** Jeśli klub ma `clubs.license` ACTIVE i jednocześnie admin ma personal `access_rights` ACTIVE — `clubs.license` wygrywa (wyższy priorytet). Oba źródła działają niezależnie.

---

## 5. Kto Płaci — zasady per rola

| Rola | Model |
|---|---|
| TRENER_GLOWNY | Trial 90 dni (per klub) → B2C lub licencja klubowa B2B |
| TRENER_POMOCNICZY | Tak samo jak trener główny |
| RODZIC | Trial 90 dni → B2C (individual lub family) lub licencja klubowa B2B |
| ZAWODNIK | **Nie płaci nigdy.** Konto przez kod od rodzica. Nie trafia na blocked.html. |
| KIBIC | Trial 90 dni → B2C sam (individual) lub slot z puli FAMILY rodzica |

**ZAWODNIK** — brak płatności, brak blokady. Jeśli klub nie ma licencji, ZAWODNIK widzi
baner informacyjny na `start.html`: *"⚠ Klub nie ma aktywnej licencji — skontaktuj się z trenerem"*.
Może dalej korzystać z apki.

---

## 6. Scenariusz B2C — Płatności Indywidualne

### Produkty subskrypcyjne

| ID produktu | Nazwa | Przelewy24 / Google | Apple IAP | Czas | Sloty |
|---|---|---|---|---|---|
| `sub_individual_monthly` | Indywidualny | 2 zł/mies | 4 zł/mies | 30 dni | 1 |
| `sub_individual_yearly` | Indywidualny | 20 zł/rok | 40 zł/rok | 365 dni | 1 |
| `sub_family_monthly` | Rodzinny | 5 zł/mies | 10 zł/mies | 30 dni | 6 |
| `sub_family_yearly` | Rodzinny | 50 zł/rok | 100 zł/rok | 365 dni | 6 |

Apple x2 — powód: 30% prowizja Apple + minimalna cena ~3,99 zł.

### Pula rodzinna (FAMILY)
- `slots_total: 6` — właściciel (RODZIC który kupił licencję) zajmuje **1 slot przy zakupie**
  (`slots_used = 1` od razu po zakupie)
- Pozostałe **5 slotów** → kody generowane w `profil.html` → kibice, znajomi
- **ZAWODNIK NIE zajmuje slotu** — konto zawodnika działa przez osobny kod bez płatności
- Każdy kibic który użyje kodu → `slots_used++` (w transakcji Firestore)
- Rodzic blokuje kibica → `slots_used--` + `membership.status = 'BLOCKED'`
- Wyświetlanie w `profil.html`: pasek `slots_used - 1` / `slots_total - 1`
  (odejmujemy 1 bo rodzic sam zajmuje slot, pasek pokazuje tylko kibiców)
- Może być 2 rodziców z oddzielnymi licencjami FAMILY dla tych samych dzieci —
  każdy ma własny dokument `access_rights` z własną pulą

### Generowanie kodów

| Kto generuje | Dla kogo | Gdzie w UI |
|---|---|---|
| Trener | RODZIC | `druzyna.html` → szczegóły zawodnika |
| Rodzic | ZAWODNIK | TBD |
| Rodzic | KIBIC | `profil.html` → sekcja kody |

Przed wygenerowaniem kodu dla kibica: sprawdź `slots_used < slots_total`.
Jeśli pełna → toast "Wszystkie sloty licencji są zajęte".

### Grace period — zasada "chciwy traci"
Odnowienie liczy się od `valid_until` (data wygaśnięcia), **nie od daty płatności**.
- Odnawia dzień przed końcem → dostaje pełny okres
- Odnawia 7 dni po końcu (ostatni dzień grace) → dostaje okres minus 7 dni

---

## 7. Scenariusz B2B — Pakiet Licencji Klubowych

### Pakiety i ceny

| Pakiet | Miesięczny | Roczny |
|---|---|---|
| 10 licencji | 20 zł/mies | 200 zł/rok |
| 50 licencji | 100 zł/mies | 1 000 zł/rok |
| 100 licencji | 200 zł/mies | 2 000 zł/rok |
| 500 licencji | 1 000 zł/mies | 10 000 zł/rok |

Przelicznik: 2 zł/user/mies. Płatność: Stripe lub Przelewy24 (nie przez sklepy).
Klub płaci poza apką — admin platformy aktywuje przez `support.html`.

### Floating License — mechanizm przypisywania slotów
Licencje są **pływające** — slot przypisywany automatycznie przy pierwszym logowaniu
po końcu trialu (lub przy każdym logowaniu gdy slot nieaktualny).

**Nieaktualny slot** = `membership.poolClaimedAt < clubs.license.renewed_at`.
Kiedy admin kupuje nową licencję (nawet odnowienie), `renewed_at` jest aktualizowane.
Przy następnym logowaniu każdy user wykonuje re-claim — pierwsi N dostają slot, reszta EXPIRED.
Z perspektywy usera który dostaje slot → **przezroczyste** (automatyczne).
Z perspektywy usera który nie dostaje → `blocked.html` "pula wyczerpana".

### Scope licencji
- **`all`** — trenerzy + rodzice
- **`trainers_only`** — tylko trenerzy; rodzice muszą płacić sami (B2C)
- **`custom`** — admin zaznacza które role (pole `roles[]`)

### Priorytet przy logowaniu
1. Trial aktywny → dostęp OK, **żaden slot nie jest konsumowany**
2. Własna licencja personal (access_rights) → dostęp OK, **NIE rusza puli klubu**
   *(chyba że `force_club_pool = true` i licencja klubu aktywna — patrz sekcja 8)*
3. Klub ma aktywną pulę + user w scope + wolne miejsce → slot przypisany → dostęp OK
4. Pula pełna → "Pula wyczerpana — skontaktuj się z administratorem"
5. Brak puli → "Kup licencję lub zgłoś się do trenera"

---

## 8. force_club_pool — wymuszenie licencji klubowej dla rodziców

### Gdzie ustawiane
`ustawienia.html` → sekcja widoczna tylko dla `TRENER_GLOWNY` / `OWNER` z flagą `isClubAdmin`.
Toggle: "Rodzice korzystają z licencji klubowej" (domyślnie: off).

Zapisywane jako `clubs.license.force_club_pool: boolean`.

### Jak działa
Gdy `force_club_pool = true` AND `clubs.license.valid_until > teraz`:
- RODZIC przy sprawdzaniu dostępu **pomija P1** (własna licencja)
- Trafia bezpośrednio do P3 (slot B2B)
- Jeśli jest wolny slot → dostaje go (niewidoczne dla usera)
- Jeśli brak slotu → `blocked.html`

Gdy `force_club_pool = true` BUT `clubs.license` wygasła lub null:
- Flaga jest **automatycznie ignorowana**
- RODZIC wraca do normalnego priorytetu (P1 własna licencja → P3 → EXPIRED)
- Chroni przed sytuacją gdy admin nie odnowi B2B a rodzice mają własne licencje

### Cykl włącz → wyłącz → włącz
- Wyłączenie flagi NIE zwalnia automatycznie slotów B2B u rodziców
- Slot (`licenseSource='CLUB'`) zostaje na membership jako cache
- Gdy flaga off: `getAccessStatus` sprawdza P1 (własna licencja) pierwsze → używa jej
- Gdy flaga z powrotem on: membership ma `licenseSource='CLUB'` → fast path, slot już przypisany
- Jeśli `poolClaimedAt < renewed_at` (nowy zakup po wyłączeniu) → re-claim automatycznie

### Co się dzieje gdy licencja wygasa przy force_club_pool=true
- `clubs.license.valid_until` < teraz → flaga ignorowana (opis wyżej)
- Admin kupuje nowe licencje (nawet mniejszą pulę) → `renewed_at` zaktualizowane
- Wszyscy re-claimują przy logowaniu → pierwsi N dostają, reszta EXPIRED
- Rodzice z własnymi licencjami: jeśli `force_club_pool=true` i nowa pula aktywna →
  dalej pomijają własną licencję i używają B2B

---

## 9. Zakup nowej licencji z mniejszą pulą — flow w support.html

Gdy admin kupuje licencję z `nowy total < stary total`:

### Krok 1 — Ostrzeżenie
Support.html pokazuje informację:
> "Zmniejszasz pulę licencji z **X** do **Y**."

### Krok 2 — Analiza scope i zużycia
Sprawdź `clubs.license.scope`:

**Scope = `all` (trenerzy + rodzice):**
- Pobierz memberships z `licenseSource='CLUB'` i `poolClaimedAt >= stary renewed_at`
- Policz: ile trenerów, ile rodziców aktualnie używa slotów
- Wyświetl: *"Aktualnie: X trenerów + Y rodziców korzysta z licencji klubowej (łącznie Z/staryTotal)"*
- Jeśli Z > nowy total: *"Po zakupie pierwsze [nowy total] osób które się zalogują otrzymają slot automatycznie. Pozostałe [Z - nowy total] zobaczy ekran płatności."*

**Scope = `trainers_only`:**
- Policz tylko memberships trenerów z `licenseSource='CLUB'`
- Wyświetl: *"Aktualnie: X trenerów korzysta z licencji (X/staryTotal)"*
- Jeśli X > nowy total: *"[X - nowy total] trenerów straci slot przy następnym logowaniu"*

**Scope = `custom`:**
- Policz per każda rola z `clubs.license.roles[]`

### Krok 3 — Co oznacza "reset" slotów
Admin widzi komunikat:
> "Sloty zostaną przypisane ponownie automatycznie przy następnym logowaniu każdego użytkownika.
> Użytkownicy którzy dostaną slot — nie zauważą żadnej zmiany.
> Użytkownicy ponad limit — zobaczą ekran płatności."

### Krok 4 — Potwierdzenie i zapis
Admin klika [Potwierdź zakup]:
```javascript
await db.collection('clubs').doc(clubId).update({
  'license.total':      nowyTotal,
  'license.used':       0,          // reset licznika
  'license.valid_until': nowaData,
  'license.renewed_at':  serverTimestamp()  // klucz do invalidacji starych slotów
});
```

**Nie dotykamy memberships** — invalidacja przez porównanie `poolClaimedAt` vs `renewed_at`.

### Krok 5 — Przy logowaniu usera (getAccessStatus)
```
membership.poolClaimedAt < clubs.license.renewed_at?
  → slot nieaktualny → re-claim:
    used < total → claim (used++, poolClaimedAt = now) → ACTIVE (przezroczyste)
    used >= total → EXPIRED → blocked.html
```

---

## 10. Ekran Blokady `blocked.html`

Widoczny tylko gdy status `EXPIRED`. Zachowanie zależy od roli:

| Rola | Widok |
|---|---|
| TRENER + klub ma licencję B2B (wolne sloty) | "Klub posiada licencję — skontaktuj się z administratorem" |
| TRENER + brak licencji klubowej | Opcje płatności (Przelewy24, Google, Apple) |
| RODZIC | Opcje płatności |
| KIBIC | Opcje płatności |
| ZAWODNIK | **Nigdy tu nie trafia** — brak blokady, tylko baner informacyjny na start.html |

Wywołanie: `blocked.html?reason=payment_expired&clubId=...`

---

## 11. Panel Support (`support.html`)

Panel dostępny tylko dla `isPlatformAdmin: true` (ręcznie ustawiane w Firestore na `users/{uid}`).
Dostępny z prawego paska menu na `start.html` jako "Support".

### Funkcje panelu

**Statystyki platformy** — liczniki Aktywne / Trial / Wygasłe / Razem (kluby).

**Lista klubów** — każdy klub pokazuje:
- Badge statusu (Aktywna / Trial / Wygasła) + data wygaśnięcia w formacie YYYY-MM-DD
- Liczba drużyn i aktywnych członków
- Liczba slotów: X używanych / Y total (z clubs.license.used i total)
- Po kliknięciu rozwinięcie z akcjami

**Akcje per klub:**
- **✓ Aktywuj licencję** — ręczna aktywacja pakietu B2B: wybór liczby licencji (10/50/100/500) + okres.
  Jeśli nowy total < stary total → flow z sekcji 9 (ostrzeżenie + analiza).
  Zapisuje `clubs.license` z `renewed_at = serverTimestamp()` i `used = 0`.
- **↺ Przedłuż** — otwiera sheet z pre-wypełnioną liczbą licencji. Możliwość zmiany liczby i okresu.
  Liczy od obecnego `valid_until` jeśli aktywna, lub od dzisiaj jeśli wygasła.
  Jeśli zmiana liczby → ten sam flow co aktywacja.
- **👥 Użytkownicy** — lista aktywnych członków klubu. Radio-select + "Zaloguj jako →".
- **⛔ Zablokuj awaryjnie** — ustawia `clubs.license.valid_until` na przeszłość.

**Impersonacja użytkownika:**
- Ustawia `localStorage.currentUserId` na target userId
- Zapisuje oryginalny userId w `localStorage.supportOriginalUserId`
- Redirect do `start.html`
- Baner powrotu na wszystkich ekranach podczas impersonacji

**Status klubu w panelu:**
Czytany z `clubs.licenseStatus` (CF). Fallback: `createdAt + 90 dni`.

---

## 12. Ustawienia Licencji (`ustawienia.html`)

Sekcja widoczna tylko dla `TRENER_GLOWNY` / `OWNER` z flagą `isClubAdmin: true`.

### Dostępne ustawienia
- **Scope licencji B2B** — kto korzysta z puli klubowej:
  `Wszyscy` | `Tylko trenerzy` | `Niestandardowy`
  Zapisywane w `clubs.license.scope` i `clubs.license.roles[]`

- **Wymuś licencję klubową dla rodziców** (`force_club_pool`) — toggle:
  *"Rodzice korzystają z puli klubowej zamiast własnych licencji"*
  Widoczny tylko gdy `clubs.license.scope` obejmuje rodziców.
  Zapisywane w `clubs.license.force_club_pool`.

### Ostrzeżenie przy force_club_pool
Gdy admin włącza toggle:
> "Rodzice będą używać slotów z puli klubowej. Jeśli pula wygaśnie, wrócą automatycznie
> do własnych licencji."

---

## 13. Przepływ po Zalogowaniu (docelowy)

```
initSession() → getAccessStatus(uid, clubId)
  ACTIVE  → start.html (normalnie)
  TRIAL   → shouldShowTrialBanner(daysLeft)?
              tak → platnosci-banner.html?status=TRIAL&days=N → start.html
              nie → start.html
  GRACE   → platnosci-banner.html?status=GRACE&days=N (zawsze)
  EXPIRED → blocked.html?reason=payment_expired&clubId=...
  (ZAWODNIK: zawsze start.html, max. baner informacyjny jeśli klub EXPIRED)
```

---

## 14. Powiadomienia FCM

Cloud Function `scheduled` — codziennie rano.

### TRIAL
| Dni pozostałe | Treść |
|---|---|
| 30 | "Zostało 30 dni okresu próbnego" |
| 15 | "Zostało 15 dni okresu próbnego — sprawdź plany" |
| 7 | "Zostało 7 dni" |
| 3 | "Zostało 3 dni — odnów żeby nie stracić dostępu" |
| 1 | "Ostatni dzień okresu próbnego!" |
| 0 | "Trial wygasł — masz 7 dni grace period na odnowienie" |

### GRACE / opłacony dostęp
| Kiedy | Treść | Warunek |
|---|---|---|
| Dzień wygaśnięcia | "Dostęp wygasł — masz 7 dni grace" | zawsze |
| Dzień 7 grace | "Jutro tracisz dostęp do Coachay" | zawsze |
| 3 dni przed końcem | "Dostęp wygasa za 3 dni — odnów" | tylko `auto_renew == false` i source != apple/google |
| Po auto-odnowieniu | "✓ Pobrano X zł. Dostęp przedłużony do DD.MM.RRRR" | tylko auto_renew |

---

## 15. Helpery w coachay-core.js

Wszystkie zapytania do `access_rights` przechodzą przez helpery — ekrany nie odpytują
kolekcji bezpośrednio (izolacja nazw pól `uid`/`club_id`).

```javascript
getFamilySlots(uid, clubId)
// → { slotsTotal, slotsUsed, arRef, validUntil } | null
// Używane w: profil.html (pasek kibiców), generateKibicCode (limit check)

releaseFamilySlot(parentUid, clubId)
// → dekrementuje slots_used w transakcji
// Używane w: profil.html (blockKibic), trenerzy.html jeśli kibic blokowany przez trenera

claimClubLicenseSlot(uid, clubId, membershipDoc)
// → { success, status, source, daysLeft, expiryDate }
// Używane w: getAccessStatus (claimSlot=true path)

releaseClubLicenseSlot(uid, clubId)
// → dekrementuje clubs.license.used, czyści membership.licenseStatus
// Używane w: trenerzy.html (blokowanie trenera/rodzica), support.html (ręczne zwolnienie)
```

---

## 16. Status Implementacji (2026-04-21)

| Ekran / Feature | Status | Uwagi |
|---|---|---|
| `platnosci-banner.html` | ✅ | Interstitial TRIAL/GRACE |
| `platnosci.html` | ✅ | Wybór planu, placeholder płatności |
| `start.html` — checkPaymentAccess | ✅ | Pomija ZAWODNIK i ADMIN_PLATFORMY i impersonację |
| `blocked.html` — payment_expired | ✅ | Różnicuje widok per rola |
| `blocked.html` — ctx-switcher | ✅ | Kibic może przełączyć klub gdy ma licencję w innym |
| `blocked.html` — dev purchase | ✅ | Zastępcza procedura zakupu (test); weryfikuje przez getAccessStatus |
| `support.html` | ✅ | Panel ADMIN_PLATFORMY (bez flow zmniejszania puli) |
| `getAccessStatus()` — pełna logika P0–P4 | ✅ | Trial, P1 własna, P3 B2B floating, P4 KIBIC family lazy claim, force_club_pool |
| `getFamilySlots()` helper | ✅ | Enkapsuluje pola uid/club_id; używany przez profil.html i getAccessStatus |
| `releaseFamilySlot()` helper | ✅ | Dekrementuje slots_used; używany przez blockKibic |
| CF `updateClubLicenseStatuses` | ✅ | Codziennie 06:00, batch write |
| `profil.html` — family slots UI | ✅ | Pasek slotów, lista kibiców, blokowanie |
| `login.html` — rejestracja kibica | ✅ | Tworzy membership per playerId rodzica; brak inkrementacji slots (lazy) |
| ZAWODNIK baner informacyjny | ✅ | Baner na start.html gdy klub EXPIRED |
| `ustawienia.html` — scope licencji | ❌ | Do zrobienia |
| `ustawienia.html` — force_club_pool | ❌ | Do zrobienia |
| `support.html` — flow zmniejszania puli | ❌ | Ostrzeżenie + analiza scope + used=0 + renewed_at |
| `trenerzy.html` — releaseClubLicenseSlot | ❌ | Przy blokowaniu trenera/rodzica |
| CF webhooks Przelewy24 | ❌ | Do zrobienia |
| CF webhooks RevenueCat | ❌ | Do zrobienia |
| FCM notifications scheduled | ❌ | Do zrobienia |
