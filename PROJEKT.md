# COACHAY — Dokument projektowy
Wersja: 3.0 | Data: 2026-04-09

---

## Podstawowe dane

- **Nazwa:** COACHAY | **Domena:** coachay.com
- **Tagline:** do ustalenia
- **Język startowy:** polski, architektura i18n od pierwszej linii kodu (i18next)
- **Cel:** Platforma do zarządzania drużyną sportową dla trenerów amatorskich
- **Kalendarz = dziennik trenera** (urzędowy wymóg — lista obecności, tematy treningów, raporty PDF/CSV)

---

## Technologia

- Firebase Authentication, Firestore (europe-west), Hosting, Cloud Messaging
- Vanilla HTML/CSS/JS (bieżące demo)
- Docelowo: **.NET MAUI** (Android priorytet, iOS później)
- i18n: i18next — żaden tekst UI nie może być hardcoded

---

## Role użytkowników

| # | Rola w kodzie | Nazwa w UI | Opis |
|---|--------------|------------|------|
| 1 | ADMIN_PLATFORMY | Admin | Operator (Rafał) |
| 2 | TRENER_GLOWNY | Trener główny | Pełny dostęp, zarządza drużyną |
| 3 | TRENER_POMOCNICZY | Trener pomocniczy | Ograniczony (bez zarządzania kontami) |
| 4 | RODZIC | Rodzic/Opiekun | Widzi swoje dzieci, potwierdza obecność, płatności |
| 5 | ZAWODNIK | Zawodnik | Własne konto (za zgodą rodzica), ograniczony widok |
| 6 | OBSERWATOR | Kibic | Tylko odczyt, płaci osobno |
| 7 | SĘDZIA / RATOWNIK | Sędzia / Ratownik | Marketplace (przyszłość) |

> **UWAGA:** W kodzie i bazie rola nadal `OBSERWATOR` — zmiana dotyczy wyłącznie UI (etykiety). Zaimplementowane w v2.7.

---

## Wielokontekstowość

Jeden user = wiele ról w różnych klubach. Ekran startowy pokazuje listę klubów — user wybiera klub, aplikacja automatycznie wie jaką ma rolę w tym klubie.

- `users.contexts[]` — tablica kontekstów z polami: `type`, `contextId`, `role`, `isPrimary`, `teamName`, `clubName`, `teamColor`
- Ten sam userId może mieć różne role w różnych klubach (np. trener w Klubie A, rodzic w Klubie B, kibic w Klubie C)
- Jeśli user ma dwie role w jednym klubie (np. trener + rodzic) → dodatkowy przełącznik roli tylko w tym klubie
- Kolekcja `memberships` — źródło prawdy dla dostępu, płatności i ostrzeżeń (szczegóły w ARCHITEKTURA.md)

---

## Logika widoczności eventów

### Architektura invited + visibleTo
- `invited[]` = kto MA PRZYJŚĆ: playerIds zawodników + userIds trenerów
- `visibleTo[]` = kto WIDZI event ale NIE jest na liście obecności: userIds rodziców + kibicow
- Rodzice **NIGDY** nie trafiają do `invited` — są automatycznie w `visibleTo` przez `players.guardianIds`
- Kibice **ZAWSZE** automatycznie w `visibleTo` przy tworzeniu eventu

| Rola | W invited? | W visibleTo? | Potwierdza? |
|------|-----------|-------------|-------------|
| Trener | ✅ userId | — | nie (zarządza) |
| Zawodnik | ✅ playerId | — | tak (swój status) |
| Rodzic | ❌ | ✅ auto z guardianIds | tak (per dziecko) |
| Kibic | ❌ | ✅ auto zawsze | nie |

### Fallback dla starych eventów
Jeśli `visibleTo` nie istnieje lub puste → stara logika: szukaj userId w `invited`.

---

## Mecze jako eventy

- Mecze = eventy z `type: 'MECZ'` + pole `matchData`
- Kolekcja `matches` → **DO USUNIĘCIA** z Firebase
- Widoczność wyniku: LIVE → pełny dla wszystkich; FINISHED → outcome only dla rodziców/kibicow, pełny tylko trener
- Cofnięcie zakończenia: FINISHED → LIVE (przycisk dla trenera)

---

## Kody dostępu

### Typy kodów
| Typ | Kto generuje | Dla kogo | Gdzie generowany |
|-----|-------------|----------|-----------------|
| RODZIC | Trener | Rodzic dziecka | Profil zawodnika → Drużyna |
| ZAWODNIK | Trener lub rodzic | Zawodnik | Profil zawodnika → Drużyna |
| KIBIC | Trener lub rodzic | Kibic (per zawodnik) | Profil zawodnika → Drużyna |
| TRENER | Właściciel klubu | Nowy trener | Ustawienia → Dostęp do klubu (TODO) |

### Zasady
- Kod jednorazowy, 30 dni ważności
- Jeden zawodnik może mieć wiele kodów (2 rodziców = 2 kody RODZIC)
- Przy generowaniu z aktywnym kodem → modal z 3 opcjami: dezaktywuj stary / zachowaj stary / anuluj
- Po użyciu kodu → `onUserRegisteredWithCode()` w `coachay-core.js` → aktualizuje `guardianIds`, `children`, powiadomienie do trenera

---

## Płatności (model v4.0 — decyzja 2026-04-09)

Szczegóły techniczne: `platnosci.md`

### Kto płaci

| Rola | Model |
|------|-------|
| TRENER_GLOWNY / POMOCNICZY | Trial 90 dni → B2C lub licencja klubowa B2B |
| RODZIC | Trial 90 dni → B2C lub licencja klubowa B2B |
| ZAWODNIK | **Nie płaci nigdy** — konto przez kod od rodzica |
| KIBIC | Trial 90 dni → B2C sam lub kod z puli rodzinnej rodzica |

### Trial — 90 dni per (user, klub)
- Przypisany do pary `(uid, clubId)` — nie resetuje się przy dołączeniu do nowej drużyny w tym samym klubie
- Przechowywany w `users/{uid}.clubs_trial.{clubId}`

### Grace period — zawsze 7 dni
- Po wygaśnięciu trialu lub opłaconego dostępu — 7 dni na odnowienie
- Dostęp aktywny z banerem ostrzeżenia
- "Chciwy traci x2" — odnowienie liczone od `valid_until`, nie od daty płatności

### 4 produkty subskrypcyjne

| Produkt | Przelewy24 / Google | Apple IAP |
|---------|---------------------|-----------|
| Indywidualny miesięczny | 2 zł/mies | 4 zł/mies |
| Indywidualny roczny | 20 zł/rok | 40 zł/rok |
| Rodzinny miesięczny (6 kont) | 5 zł/mies | 10 zł/mies |
| Rodzinny roczny (6 kont) | 50 zł/rok | 100 zł/rok |

Apple x2 — powód: 30% prowizja + minimalna cena ~3,99 zł w Polsce.

### Pakiet Rodzinny — 6 slotów
- Rodzic zajmuje 1 slot przy zakupie, rozdaje 5 kodów (profil.html)
- Apple/Google = tylko bramka płatnicza; logikę slotów definiuje Firebase
- ZAWODNIK NIE zajmuje slotu

### Licencja klubowa B2B — Floating License
- Klub kupuje pulę (10/50/100/500 licencji), płaci przez Stripe/Przelewy24
- Slot przypisywany automatycznie przy pierwszym logowaniu po trialu (nie ręcznie)
- Admin ustawia zakres: wszyscy / tylko trenerzy / niestandardowy
- ZAWODNIK nigdy nie pobiera slotu z puli

### Metody płatności
- **Przelewy24** — BLIK, karta, przelew; tylko Polska; tokenizacja karty = auto-odnowienie
- **Google Play** — auto-renewal natywny
- **Apple IAP** — auto-renewal natywny; przez RevenueCat
- **Stripe** — tylko B2B (licencje klubowe)

### Ekrany płatności
- `platnosci-banner.html` ✅ — interstitial TRIAL/GRACE przed start.html
- `platnosci.html` ✅ — wybór pakietu + metoda płatności
- `blocked.html` ❌ — rozszerzyć o `?reason=payment_expired`
- `ustawienia.html` ❌ — scope licencji klubowej dla admina

---

## Mapa ekranów

| Ekran | Plik | Status | Uwagi |
|-------|------|--------|-------|
| Logowanie / Rejestracja | login.html | ✅ v3 | Firebase Auth: email, SMS, kod |
| Start / Dashboard | start.html | ✅ v7 | initSession(), brak checkPaymentAccess |
| Drużyna | druzyna.html | ✅ v3.0 | |
| Raporty | raporty.html | ✅ v2.0 | trener-only, moduł raportowy (rejestr raportów), PDF/CSV/XLSX — 2 raporty: Lista obecności, Szczegółowy raport zajęć |
| Mecz | mecz.html | ✅ v2.1 | cofnięcie zakończenia |
| Czat | czat.html | ✅ | |
| Kalendarz | kalendarz.html | ✅ v2.8 | |
| Zadania | zadania.html | ✅ v3.1 | |
| Ogłoszenia | ogloszenia.html | ✅ v1.1 | |
| Profil | profil.html | ✅ v1.1 | kody dla kibica |
| Trenerzy | trenerzy.html | ✅ v2.0 | isClubAdmin, blokada/usunięcie |
| Klub | klub.html | ✅ v1.2 | |
| Ustawienia | ustawienia.html | ⚠️ | HTML bez Firebase, brak scope licencji |
| Zablokowany | blocked.html | ⚠️ | brak obsługi payment_expired |
| TRIAL/GRACE banner | platnosci-banner.html | ✅ | interstitial przed start.html |
| Wybór pakietu | platnosci.html | ✅ | UI gotowy, webhooks TODO |
| Panel platformowy | support.html | ✅ | zrobione|
| Giełda sparingów | gielda.html | ❌ | ukryta na wszystkich ekranach |

---

## Funkcje zaprojektowane, niezbudowane

- Sparring exchange marketplace
- Referee/medic marketplace z kalendarzami dostępności
- Fair play / club culture rating system
- Live match mode (szczegółowy)
- Ekran profilu zawodnika (pełny)
- Raporty PDF/CSV z obecności
- Powiadomienia push (Firebase Cloud Messaging)

---

## Pytania otwarte

- Czy eventy mogą być oznaczone jako "przeczytane" przez usera?
- Event vs Zadanie — czy trener tworzący event generuje jednocześnie zadanie?
- Nowa zakładka "Eventy" — co dokładnie powinna zawierać?
- Regulamin RODO — jak ująć widoczność imion zawodników dla wszystkich ról?
- Model płatności — kto dokładnie płaci za co?
