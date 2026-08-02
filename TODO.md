# COACHAY — TODO i priorytety
Wersja: 4.7 | Data: 2026-04-17


## 🔥 Aktywne

### Social login
- [x] Firebase Auth — Google OAuth (dla wszystkich ról oprócz OWNER — "Mam kod" path)
- [~] Firebase Auth — Apple OAuth (wymagany iOS App Store) — kod gotowy (`login.html`), czeka na:
  - [ ] Założenie Apple Developer Account (developer.apple.com, $99/rok)
  - [ ] Konfiguracja Firebase Console → Authentication → Sign-in providers → Apple

### DEMO — porządki (zdecydowane 2026-07-28)
- Decyzja: **4 persony demo zostają** (Trener/Rodzic/Zawodnik/Kibic) — nadal trwa faza testów, są potrzebne. Plan z ARCHITEKTURA.md "jeden user demo_user, fixed TRENER_GLOWNY" **odrzucony** — realny koszt: ktoś mógłby łatwo "sklonować" całą appkę mając dostęp do wszystkich 4 typów usera przez publiczny ekran logowania.
- [ ] **Priorytet niski, na koniec** — ukryć na `login.html` 3 z 4 przycisków demo (Rodzic/Zawodnik/Kibic), zostawić tylko Trener widoczny. Konta/logika (`loginAsDemo()`, `demo_rodzic_anna` itd.) zostają nietknięte w kodzie — tylko UI znika z ekranu logowania. Do ustalenia przy realizacji: czy zostaje furtka (ukryty link typu `?demo=rodzic`) czy zero dostępu bez ręcznej zmiany kodu.
- [ ] Znaleziony przy okazji: `requireWriteAccess()` (blokada zapisu przez `isReadOnly`, `coachay-core.js:693`) jest realnie użyta tylko w `klub.html` (3 miejsca) — reszta 14 plików (34 miejsc) blokuje zapisy w demo przez rozrzucone ręczne `isDemoMode()` checki. Ryzyko: nowy przycisk zapisu bez takiego checka = demo/zawieszony/grace-period user może faktycznie coś zapisać. Do zrobienia: audyt i zamiana na jednolite `requireWriteAccess()`.

### Onboarding — pierwsze kroki per rola — ✅ zbudowane 2026-07-24, do przetestowania na telefonie
- [x] `onboarding.html` — nowy ekran, config-driven (`ONBOARDING_STEPS`, wzorzec jak `RAPORTY_REJESTR` w raporty.html): jeden krok = jeden realny ekran (Start/Klub/Drużyna/Kalendarz/Ustawienia) z realnymi fragmentami HTML/CSS (nie zrzuty ekranu — żyją z `_global.css`, aktualizują się same przy zmianie stylu) + numerowane znaczniki i krótka legenda zamiast długich opisów
- [x] `users.onboardingDone` → wykrywanie pierwszego uruchomienia, sprawdzane w `start.html` przed resztą dashboardu (pomija demo mode i ZAWODNIKA — brak dla niego treści)
- [x] TRENER_GLOWNY / TRENER_POMOCNICZY (5 kroków): Start → Klub (załóż drużynę) → Drużyna (dodaj zawodnika + kod zaproszenia) → Kalendarz (utwórz trening/mecz + przypomnienie) → Ustawienia (sezon)
- [x] RODZIC (2 kroki): Start (dziecko, mecz, potwierdź/odrzuć obecność, zadania, menu) → Drużyna (profil dziecka)
- [x] KIBIC (1 krok): Start (mecz na żywo, menu)
- [ ] ZAWODNIK — świadomie pominięty (decyzja z sesji), brak treści onboardingowej
- [x] Link "Jak zacząć" w bocznym menu (14 plików, ukryty dla ZAWODNIK) — dostęp do tury w dowolnym momencie, nie tylko przy pierwszym uruchomieniu
- [ ] Do zrobienia później: krok o płatnościach (na razie pominięty — funkcja niedokończona), kroki o generowaniu kodów dla rodzica/kibica

---

## ⚖️ RODO / Usuwanie danych

### Zasada ogólna (ustalona 2026-07-28, patrz sesja niżej dla pełnego uzasadnienia)
Dane klubowe (`players`, `trainers`, denormalizacje w `memberships`) są własnością klubu/trenera — kasowalne/anonimizowalne tylko przez TRENER_GLOWNY/OWNER. Konto osobiste (`users` + Firebase Auth) jest własnością danej osoby, może mieć aktywne memberships w wielu klubach jednocześnie (potwierdzone: `getUserTeams()`, ctx-switcher) — nigdy nie kasować/anonimizować automatycznie jako efekt uboczny akcji trenera. Odwrotnie też: usunięcie własnego konta przez rodzica/zawodnika nie może kasować/anonimizować `players`/`trainers` (to nie jego dane) — zawodnik po prostu wraca do stanu "zarządzany tylko przez trenera" (to stan domyślny, nic specjalnego do zbudowania).

### Zawodnik — druzyna.html — "Usuń zawodnika" zbudowane i zdeployowane 2026-07-28
Zamiast pełnego 3-poziomowego bottom-sheet (Dezaktywuj/Anonimizuj/Usuń całkowicie) — jedna, prostsza akcja "🗑️ Usuń zawodnika" na dole okna zawodnika (`usunZawodnika()`, TRENER_GLOWNY only, zgodnie z tabelą uprawnień w ARCHITEKTURA.md — TRENER_POMOCNICZY nie ma tego prawa):
- [x] Odłącza wszystkich aktywnych rodziców/kibiców (reużywa dzisiejszej `odlaczOpiekunaOdZawodnika()`)
- [x] Anonimizuje: `firstName`/`lastName`→`''`, `name`→`"Usunięty zawodnik"`, `photoURL`→`''`, `guardianPhones`→`[]`, `guardianData`→`null`, `coachOnlyData.coachNotes`→`''`
- [x] **`birthDate` NIE jest czyszczony** — decyzja 2026-07-28: bez nazwiska sama data urodzenia nikogo nie identyfikuje, a jest przydatna do historycznych statystyk wiekowych
- [x] Zostają nietknięte: `number`, `position`, `squad`, `teams[]`, `publicData.*` — historia/statystyki zachowane
- [x] Nowe pole `players.isActive` (domyślnie `true` dla nowych zawodników, `false` po usunięciu) + `deletedAt`/`deletedBy`
- [x] `druzyna.html` — lista chowa usuniętych domyślnie, checkbox "Pokaż usuniętych" (widoczny tylko dla trenera) odsłania, z czerwonym badge "Usunięty" na karcie
- [x] `kalendarz.html` — tworzenie nowego eventu **automatycznie i zawsze** pomija usuniętych zawodników (`isActive !== false`), bez opcji/checkboxa — nowy event nigdy nie powinien objąć usuniętego zawodnika
- [ ] Nie zbudowane (odłożone): osobna "Dezaktywacja" (odwracalna, bez czyszczenia danych) i "Twarde usunięcie" (OWNER only) — dziś jest tylko ten jeden, środkowy wariant (anonimizacja)
- [ ] `memberships.displayName` (denormalizacja) dla usuniętego zawodnika — nie zaktualizowane w tej rundzie (dotyczy tylko jego własnego membershipu ZAWODNIK, jeśli miał konto — rzadki przypadek)

### Trener — trenerzy.html
- [ ] Dezaktywacja → rozszerzyć o powiadomienie do trenera
- [ ] Anonimizacja (OWNER only): `displayName → "Były trener"`, PII → null (`firstName`/`lastName`/`displayName`/`email`/`coachProfile.phone`/`coachProfile.bio`)
- [ ] Filtr "Pokaż nieaktywnych"
- [x] **Ryzyko osieroconej drużyny — zbudowane i zdeployowane 2026-07-28:** `removeTrainerFromClub()` (`trenerzy.html`) sprawdza przed usunięciem czy trener ma jakiekolwiek aktywne przypisanie do drużyny (`memberships`, rola TRENER_GLOWNY/TRENER_POMOCNICZY/TRENER, status active/grace, z `teamId`) — jeśli tak, blokuje usunięcie komunikatem "Oddaj drużynę innemu trenerowi przed usunięciem konta, lub zgłoś się do zarządcy klubu". Brak przypisań → usuwanie przechodzi normalnie.
- [x] **`releaseClubLicenseSlot()` wpięta — zdeployowane 2026-07-28:** wywoływana w `blockTrainer()` (tylko scope='CLUB', nie 'TEAM' — trener z innym aktywnym przypisaniem w klubie nadal legalnie zajmuje slot) i w `removeTrainerFromClub()` (zawsze, bo usuwa ze wszystkich drużyn klubu naraz). Ważna kolejność: wywołanie **przed** zmianą statusu membershipu na BLOCKED/REMOVED, bo funkcja szuka membershipu po statusie active/ACTIVE — po zmianie statusu nie znalazłaby nic i cicho nic by nie zrobiła. Funkcja sama sprawdza `licenseSource==='CLUB'` więc bezpieczna do wywołania zawsze, nawet gdy trener nie korzystał z puli klubowej (no-op)
- **Uwaga/decyzja 2026-07-28:** guard "osieroconej drużyny" działa tylko na ścieżce OWNER-usuwa-trenera (`trenerzy.html`). Trener nie ma dziś **żadnego** dedykowanego samoobsługowego "usuń mój profil" (sprawdzone: brak w `profil.html` i `ustawienia.html`) — jedyna ścieżka to ogólny mailto w `rodo.html` ("Usuń moje konto i dane", wspólny dla wszystkich ról, bez automatyzacji). Decyzja: **zostaje tak jak jest** — self-service usunięcia konta trenera nie budujemy teraz, prośba idzie do supportu, człowiek ręcznie sprawdza kwestię drużyny

#### Scenariusz testowy do ręcznego sprawdzenia (zapisany 2026-07-28, jeszcze nie wykonany)
**Przygotowanie:** user z uprawnieniem `isClubAdmin: true` (zwykły TRENER_GLOWNY bez tej flagi NIE widzi przycisku "Usuń z klubu" — sprawdzone, gating na `isAdmin` w `trenerzy.html:747`, nie na roli). Trener testowy bez przypisanej drużyny (albo drużyna wcześniej oddana innemu trenerowi) — inaczej guard zablokuje usunięcie na starcie, co też warto osobno przetestować.
1. Admin klubu usuwa trenera przez `trenerzy.html` → "Usuń z klubu"
2. Sprawdzić w Firestore: `memberships` tego trenera w tym klubie → status `REMOVED`; `trainers` doc → `isActive: false`; jeśli miał `licenseSource: 'CLUB'` → `clubs.license.used` zmniejszone o 1
3. Zalogować się jako usunięty trener:
   - Jeśli miał **inny aktywny klub** → oczekiwane: ten klub po prostu znika z ctx-switchera, reszta działa, **brak jakiegokolwiek powiadomienia** że został usunięty (świadomie zaakceptowane, nie naprawiane teraz)
   - Jeśli to był **jedyny klub** → oczekiwane: ląduje na `blocked.html`, karta "🔒 Konto zawieszone — skontaktuj się z administratorem klubu" (komunikat mylący — sugeruje karę, nie usunięcie — znany, zaakceptowany gap, patrz [[project_coachay_overview]] wcześniejsza dyskusja o tym samym dla rodzica) + możliwość wpisania nowego kodu zaproszenia
4. Sprawdzić guard: spróbować usunąć trenera który MA aktywne przypisanie do drużyny → oczekiwany alert "Oddaj drużynę innemu trenerowi przed usunięciem konta, lub zgłoś się do zarządcy klubu", usunięcie nie powinno przejść
- [ ] Uwaga: czat (`czat.html`) pokazuje imię nadawcy **na żywo** przez `getUserName()` (`coachay-core.js:2809`, czyta `users.displayName`) — anonimizacja konta automatycznie poprawia całą historię czatu, nic dodatkowego nie trzeba robić. Powiadomienia (`notifications`) działają odwrotnie — imię jest zapisane na sztywno w `title`/`body` w momencie tworzenia (np. `coachay-core.js:1497`) — stare powiadomienia NIE zaktualizują się automatycznie. Zaakceptowane jako niskie ryzyko (powiadomienia i tak "znikają" z UI po 2-60 dniach przez auto-archiwizację, `status:'DELETE'` soft-delete — dane fizycznie zostają w Firestore, ale nikt tego nie zobaczy)

### Rodzic/Zawodnik — usunięcie własnego konta (formularz w ustawieniach, jeszcze niezbudowany)
Zasięg: **cała appka, wszystkie kluby** (nie jeden klub) — ten sam user może mieć kilkoro dzieci i być w kilku klubach naraz.
1. Znajdź wszystkie aktywne `memberships` tego `userId` (RODZIC/KIBIC, każdy klub) → lista playerId+clubId+teamId
2. Podwójne potwierdzenie z konkretami: pokaż "to dotknie: [dziecko – klub], ..." → potwierdź → drugi dialog z ostrzeżeniem o nieodwracalności → potwierdź ponownie
3. Zwolnij licencje/sloty per klub — użyć **istniejących** helperów `releaseClubLicenseSlot(uid, clubId)` / `releaseFamilySlot(parentUid, clubId)` z `coachay-core.js`. ⚠️ **Korekta 2026-07-28:** sprawdzone bezpośrednio w kodzie — tylko `releaseFamilySlot()` jest realnie użyta (w `profil.html`). `releaseClubLicenseSlot()` **nie jest wywoływana nigdzie** w całej appce mimo że istnieje jako gotowa funkcja — `platnosci.md` sugerował że jest wpięta w `trenerzy.html`/`support.html`, to nieaktualne/błędne. Patrz nowy punkt w sekcji płatności niżej — to trzeba dopiero wpiąć, nie tylko ponownie użyć
4. Wyczyść `guardianId` (+ legacy `guardianData`/`guardianIds`, dopasowane `guardianPhones[]`) na każdym powiązanym `players` doc
5. Dezaktywuj (soft, status→REMOVED) wszystkie memberships z kroku 1
6. Powiadom trenerów każdego dotkniętego klubu/drużyny: "Rodzic X usunięty — zawodnik Y nie ma już opiekuna, wygeneruj nowy kod"
7. Usuń konto: `users` doc + Cloud Function `admin.auth().deleteUser(uid)` (potrzebna nowa CF — dziś nic nie kasuje rekordu Firebase Auth, patrz niżej)
8. Wyloguj, ekran potwierdzenia

### Firebase Auth — usunięcie tożsamości logowania
- [ ] Dziś **nic nie kasuje rekordu Firebase Auth** — `rodo.html` "Usuń moje konto" to tylko mailto (`requestDelete()`), zero automatyzacji. Anonimizacja samego Firestore NIE zwalnia maila/Google/Apple do ponownej rejestracji (Auth i Firestore to niezależne byty)
- [ ] Potrzebna Cloud Function z `admin.auth().deleteUser(uid)` — klient nie ma uprawnień do kasowania cudzego konta Auth (self-service też wygodniej przez CF niż `currentUser.delete()` wymagający re-auth)
- [ ] Rozważyć środkową opcję dla zawieszeń (nie pełnego usunięcia): `admin.auth().updateUser(uid, {disabled:true})` — blokuje logowanie natychmiast, ale nie zwalnia maila. Dziś zawieszony trener (`isReadOnly` w Firestore) technicznie mógłby się nadal zalogować przez Auth
- [ ] Apple Sign-In — po usunięciu i ponownej rejestracji tym samym Apple ID, Apple nie odda już displayName/email (oddaje tylko przy pierwszej autoryzacji dla danej appki) chyba że user ręcznie odłączy Coachay w ustawieniach Apple ID — potrzebny fallback w rejestracji

### Powiązane konta w `druzyna.html` — naprawione i skonsolidowane 2026-07-28, zdeployowane
Zamiast trzech nakładających się, częściowo martwych mechanizmów — jedna wspólna funkcja `odlaczOpiekunaOdZawodnika(userId, typ, membershipIdZnany)`: soft-remove membershipu (status→REMOVED, nie hard-delete), czyszczenie `players.guardianId`/pasującego wpisu w `guardianPhones[]` gdy typ=RODZIC, i powiadomienie (`createNotification()`) do odłączanej osoby ("Utracono dostęp do profilu zawodnika X — skontaktuj się z trenerem, jeśli to pomyłka").
- [x] **"Odłącz" → "Odłącz rodzica"/"Odłącz kibica"** (panel Rodzic/Kibic, dynamiczna etykieta) — teraz woła wspólną funkcję zamiast `db.collection('memberships').doc(id).delete()` (był hard-delete, łamał [[feedback_coachay_no_hard_delete]])
- [x] **Stary "↩ Przejmij z powrotem" przy użytych kodach — usunięty całkowicie** (razem z funkcją `przejmijZawodnika()`, operował na martwych polach `guardianIds`/`users.children`, usunięte w migracji v4.1) — zastąpiony nowym, osobnym przyciskiem opisanym niżej
- [x] **Nowy przycisk "↩ Przejmij zawodnika z powrotem"** — na samym dole okna zawodnika, pod sekcją "Powiązane konta", zawsze widoczny dla trenera (`dp-przejmij-section`). To akcja **zbiorcza**, inna niż punktowe "Odłącz rodzica"/"Odłącz kibica": jednym kliknięciem odłącza **wszystkich** aktywnych rodziców i kibiców naraz (`przejmijZawodnikaZPowrotem()`, iteruje po wspólnej `odlaczOpiekunaOdZawodnika()`). Gdy nikt nie jest podpięty → komunikat "Brak podpiętych rodziców pod zawodnika" zamiast akcji
- [x] **Usunięte całkowicie:** `wyslijOstrzezeniePow()`/przycisk "⚠️ Ostrzeżenie" i `resetujDostepPow()`/przycisk "🔄 Reset dostępu" — obie były pustymi zaślepkami ("W trakcie budowy"), user nie pamiętał po co miało być "Reset dostępu"; "Ostrzeżenie" to osobny temat (pasuje do istniejących pól `warnings`/`warningCount` na membershipie), nie RODO — może wrócić później jako oddzielna funkcja
- `dezaktywujKodPow()` (przycisk "🗑️ Dezaktywuj kod" przy oczekujących kodach) — nietknięty, osobny, wciąż martwy kod (warunek `isPending` nigdy nie spełniony w obecnym flow) — nie było w zakresie tej rundy
- [ ] `blocked.html` — komunikat domyślny (`card-suspended`: "Konto zawieszone — skontaktuj się z administratorem klubu") nadal mylący dla usera bez żadnych aktywnych memberships — nie naprawione w tej rundzie
- [ ] **Mojibake znalezione przy okazji** — `druzyna.html` w okolicy funkcji dodawania zawodnika/pickera awatara ma zepsute polskie znaki w komunikatach/komentarzach (np. "B³ad dodawania zawodnika" zamiast "Błąd...", "mo¿liwe" zamiast "możliwe") — ten sam rodzaj problemu co wcześniej znaleziony i naprawiony w `functions/index.js` (sesja 24.07). Nie naprawione w tej rundzie, zgodnie z [[feedback_dont_dismiss_encoding_glitches]] warto to zweryfikować całościowo, nie tylko punktowo

#### Scenariusz testowy do ręcznego sprawdzenia (zapisany 2026-07-28, jeszcze nie wykonany)
Przetestowane częściowo przez konsolę przeglądarki na demo (`demo_trener_jan` → Jasiek Kowalski, rodzic `demo_rodzic_anna`/Anna Kowalska, kibic `demo_obserwator_babcia`/Maria Kowalska) — logika i DOM potwierdzone poprawne (`otworzDanePowiazanego()` bez błędu, modal otwiera się, `innerHTML` zawiera "Odłącz"). Do zrobienia jeszcze realny test klikania na urządzeniu/przeglądarce użytkownika (nie tylko wywołanie z konsoli):
1. **"Odłącz rodzica"/"Odłącz kibica"** — kliknij wpis aktywnego rodzica/kibica w "Powiązane konta" → modal się otwiera → kliknij "Odłącz rodzica" → potwierdź. Sprawdzić: membership tej osoby → status `REMOVED` (nie hard-delete); jeśli to był `players.guardianId` → wyczyszczony; osoba dostaje `notifications` doc ("Utracono dostęp do profilu zawodnika X")
2. **"↩ Przejmij zawodnika z powrotem"** (nowy przycisk na dole okna zawodnika) — z aktywnym rodzicem i/lub kibicem: kliknij → potwierdź → wszyscy aktywni na raz dostają status `REMOVED` + powiadomienie, sekcja "Powiązane konta" odświeża się do pustej
3. **Pusty stan** — na zawodniku bez żadnych podpiętych rodziców/kibiców kliknij "↩ Przejmij zawodnika z powrotem" → oczekiwany komunikat "Brak podpiętych rodziców pod zawodnika", zero zapisu do bazy
4. Sprawdzić że stary przycisk "↩ Przejmij z powrotem" przy użytych kodach w zakładce "Kody dostępu" **już się nie pojawia** (usunięty razem z funkcją `przejmijZawodnika()`)
5. Sprawdzić że "⚠️ Ostrzeżenie" i "🔄 Reset dostępu" **nie pojawiają się już nigdzie** w modalu Powiązane konta

### Ogólne RODO
- [x] Polityka prywatności — `polityka-prywatnosci.html` (2026-07-23), pełny dokument prawny; zaadaptowana z polityki Nexwise. Administrator na razie jako "Operator serwisu Coachay" (bez pełnej nazwy prawnej — do uzupełnienia przed launchem/płatnościami), NIP 771-222-88-03, kontakt support@coachay.com. Linkowana z `rodo.html` ("📄 Pełna polityka prywatności")
- [ ] Prawo do bycia zapomnianym — formularz w ustawieniach (patrz sekcja "Rodzic/Zawodnik — usunięcie własnego konta" wyżej)
- [ ] Rozwiązanie drużyny przez klub — wizard 4-krokowy (ARCHITEKTURA.md)

---

## 🎫 Kody zaproszeń — niespójność typów, `profil.html` vs `druzyna.html` — naprawione i zdeployowane 2026-08-02

**Zasada (potwierdzona przez usera 2026-08-02):** ZAWODNIK (dziecko) nie płaci za dostęp — rejestruje się kodem typu **ZAWODNIK**. KIBIC płaci (lub korzysta z puli licencji rodzinnej/klubowej) — rejestruje się kodem typu **KIBIC**. Ten podział typów sam w sobie jest już poprawny, niezmieniony.

**Wzorzec z `druzyna.html`** (`generujKod()` ~linia 1378, kod zawsze ma `playerId` konkretnego dziecka) **rozszerzony na `profil.html`:**
- [x] `profil.html`, sekcja **"Dzieci — kody zaproszeń"** (przemianowana z "Kibice — kody zaproszeń") — osobny blok per dziecko rodzica, każdy z własnym przyciskiem "+ Wygeneruj kod" i własną listą kodów (`generateKibicCode()`/`loadKodyKibicow()` sparametryzowane po `playerId`, koniec z `playerId: null`)
- [x] Każdy blok dziecka ma też własną, osobną listę **"Zarejestrowani kibice"** (wcześniej jedna wspólna lista na dole, myląca przy 2+ dzieciach) — `loadRegisteredKibice()` wywoływana per dziecko, `blockKibic()` odświeża właściwy blok
- [x] Generowanie kolejnego kodu KIBIC dla tego samego dziecka, gdy już istnieje aktywny — 3-opcyjny sheet `pokazModalKoduKibic()` (anuluj / dezaktywuj stary / **zachowaj oba**), analogiczny do `pokazModalKodu()` w `druzyna.html` — pozwala mieć równocześnie 2+ aktywne kody dla tego samego dziecka (np. osobno dla babci i dziadka)
- [x] **Bug znaleziony i naprawiony przy okazji:** `redeemInviteCode()` (`profil.html`) nie miało fallbacku dla kodów KIBIC z realnym `playerId` wygenerowanych przez trenera w `druzyna.html` (gdzie `createdBy` to trener, nie rodzic) — próbowało szukać "dzieci rodzica" po `createdBy`, nic nie znajdowało, i pokazywało błąd "Brak zawodników powiązanych z tym kodem". Naprawione: kody z `playerId` tworzą teraz od razu jeden poprawny membership. Ta sama poprawka zastosowana w `login.html` (`_createFirestoreDocsFromPending()`), gdzie wcześniej działało to tylko przez przypadkowy fallback na `dzieci.length === 0`. Stary loop-po-wszystkich-dzieciach zostaje w obu plikach jako fallback tylko dla ewentualnych starych, jeszcze nie wykorzystanych kodów sprzed tej zmiany (`playerId: null`)

**Znane ograniczenie, świadomie zostawione bez zmian (2026-08-02):** brak przycisku "Odblokuj" dla kibica zablokowanego przez rodzica (`blockKibic()` — soft, status `BLOCKED`, zgodnie z [[feedback_coachay_no_hard_delete]]). Jedyna dziś ścieżka odzyskania dostępu: rodzic generuje **nowy** kod dla tego samego dziecka, zablokowana osoba wpisuje go ponownie → tworzy się nowy, osobny, aktywny membership; stary `BLOCKED` zostaje jako historia. Działa, ale to nie to samo co "odblokowanie" — osobna funkcja do rozważenia później, jeśli będzie potrzebna.

- [ ] **Do zweryfikowania (znalezione 2026-08-02, dotyczy rozliczeń — nie łatane na ślepo):** jeden kibic pilnujący 2+ dzieci tego samego rodzica w tym samym klubie (np. babcia z dwójką wnuków) — czy poprawnie zajmuje **1** slot licencji rodzinnej, czy może **2+** (po jednym per dziecko)? `getAccessStatus()` przydziela slot leniwie przez `_getMembershipForClub(uid, clubId)`, która bierze **pierwszy z brzegu** aktywny membership danego usera w klubie (`.limit(1)`, brak filtra po `playerId`) — flaga `familySlotParent`/`familySlotClaimedAt` zapisywana jest **na konkretnym membershipie**, nie na koncie usera. `blockKibic()` (`profil.html`) przy blokowaniu zakłada "kibic to 1 osoba, nie per membership" i zwalnia zawsze tylko 1 slot (`releaseFamilySlot()`), niezależnie od liczby blokowanych memberships tej osoby. Sprawdzone bezpośrednio w bazie (demo `demo_obserwator_babcia`/Maria, 2 aktywne membershipy KIBIC — Jasiek + Ania): dziś żaden z nich nie ma ustawionego `familySlotParent` (slot nigdy nie został realnie przydzielony), bo `demo_rodzic_anna` w ogóle nie ma dokumentu `access_rights` w bazie (brak wykupionego pakietu rodzinnego w danych demo) — więc nie dało się tego przetestować end-to-end na realnym przykładzie z faktycznym limitem slotów. Do zrobienia: przygotować testowe `access_rights` (`slots_total: 3+`) dla rodzica z 2+ dziećmi, zalogować kibica i sprawdzić czy przełączanie się między dziećmi w tym samym klubie rzeczywiście roszczy tylko 1 slot czy więcej — dopiero potem ewentualnie poprawić `blockKibic()`/claim-logikę, jeśli się rozjeżdżają.


## 📋 Priorytet 3 — Ustawienia

### Temat treningu — combobox (wybór + wpisanie własnego) + budowanie słownika (ustalone 2026-07-28)
Dziś niespójne: tworzenie nowego eventu (`kalendarz.html:1040`) ma tylko sztywny dropdown, zero możliwości wpisania własnego tematu. Edycja istniejącego eventu (panel "Zmień temat", `kalendarz.html:1780-1785`) ma dropdown + "Wpisz temat ręcznie", ale wpisany tekst nie trafia do `trainingTopics` — zapisuje się jednorazowo jako `event.title`, nigdy nie pojawia się potem w dropdownie.
- [x] Ujednolicić: ten sam komponent (select + "✏️ Wpisz nowy temat..." → pole tekstowe) w tworzeniu, edycji i szybkiej zmianie tematu eventu — zbudowane 2026-07-28, `resolveTrainingTopic()` w `kalendarz.html`, wspólne dla `saveEvent()`/`saveEventEdit()`/`saveTopicForEvent()`
- [x] Przy zapisie wpisanego tekstu: dopasowanie case-insensitive do istniejącego tematu w `trainingTopics`, albo pytanie (`showConfirmSheet`) "Dodać jako nowy, stały temat?" — Tak → tworzy dokument w `trainingTopics` (buduje słownik), Nie → temat użyty tylko jednorazowo dla tego eventu (`topicId: null`), bez zaśmiecania słownika literówkami
- [ ] Ekran zarządzania tematami (lista, kolejność, dezaktywacja duplikatów) — **odłożone 2026-07-28, niepewne czy w ogóle potrzebne / czy `ustawienia.html` to właściwe miejsce.** Na razie jedyny sposób na usunięcie/scalenie duplikatu to ręcznie w konsoli Firebase — akceptowalne, bo "dodawanie" dzieje się organicznie przy tworzeniu eventów (patrz combobox wyżej), więc presja na zbudowanie tego ekranu jest niska

### Odłożone/porzucone (zdecydowane 2026-07-28)
- ~~Dashboard settings (matchDays, attendancePeriod)~~ — nieaktualne: `matchDays` już działa z domyślną wartością (`start.html`, `DEFAULT_MATCH_DAYS=7`), `attendancePeriod` już zastąpiony przez `teams.settings.season` (sesja 04-11)
- ~~Konfigurowalne pole grupowania zawodników~~ — pomijamy
- ~~Konfigurowalne pole "Liga"~~ — pomijamy
- ~~Widoczność ogłoszeń per rola~~ — sprawdzone: dziś wszystkie typy ogłoszeń widzi każda rola identycznie, `loadAnnouncements()` nie filtruje wcale. Brak konkretnego uzasadnionego przypadku użycia — odłożone, wraca tylko jeśli pojawi się realny powód

---

## 📋 Priorytet 4 — Porządki techniczne

- [x] Usunąć kolekcję `matches` z Firebase
- [x] `players.guardianIds` — migracja danych demo
- [x] Weryfikacja wszystkich ról na wszystkich ekranach
- [ ] Dodać `sport: "FOOTBALL"` do clubs/teams - parkujemy na pozniej

---

## 📋 Priorytet 6 — Polish i monetyzacja

- [ ] i18n (i18next)
- [x] Push notifications (Firebase Cloud Messaging) — Android gotowe 2026-07-24 (Cloud Function `onNotificationCreated` + `@capacitor/push-notifications`); iOS jeszcze nie skonfigurowane
- [x] Raporty PDF/CSV/XLSX z obecności — `raporty.html`, 2026-07-22
- [ ] Testy wszystkich ról (m.in. scenariusz usunięcia trenera z klubu — patrz sekcja RODO → Trener wyżej)
- [x] **`profil.html` — subskrypcja: decyzja finalna 2026-07-30, cofnięta poprzednia (2026-07-28).** Wcześniej dodałem `if (isDemoMode())` na początku `renderSubscription()` pokazujący sztywny chip "Demo" zamiast prawdziwego statusu — usunięte na życzenie użytkownika ("kto zabroni komuś kupowania własnej licencji na koncie demo?"). Teraz **każde** konto (demo i realne) pokazuje faktyczny wynik `getAccessStatus()`, z normalnymi przyciskami/zachowaniem, bez sztucznego maskowania. Dodana też **etykieta źródła** obok daty (`SOURCE_MAP`: `individual→"Własna licencja"`, `trial→"Okres próbny"`, `club_license→"Licencja klubowa"`, `family_license→"Pakiet rodzinny"`, `admin_personal→"Własna licencja (admina)"`) — wcześniej pokazywała się tylko data, bez informacji skąd dostęp pochodzi. **Zweryfikowane na żywo** (Browser tool, demo_rodzic_anna): "Licencja klubowa · 2026-09-12 · AKTYWNA" — potwierdza że cały łańcuch (scope, `getAccessStatus()` P3, resolve roli) działa end-to-end

### Cennik (zaktualizowany 2026-04-17)

**Kto płaci:** Trener, Rodzic, Kibic. Zawodnik — bezpłatny zawsze.
**Trial:** 3 miesiące gratis. Roczny = 10x miesięczny (2 miesiące gratis).

| Plan | Web PL (Przelewy24/BLIK) | Apple iOS (tier) | Netto Apple (~70%) |
|------|--------------------------|------------------|--------------------|
| Individual / mies | **5 PLN** | 5.99 PLN | ~4.19 PLN |
| Individual / rok | **50 PLN** | ~59.99 PLN | ~42 PLN |
| Family 3 / mies | **13 PLN** | 11.99 PLN | ~8.39 PLN |
| Family 3 / rok | **130 PLN** | ~119.99 PLN | ~84 PLN |
| Family 6 / mies | **25 PLN** | 23.99 PLN | ~16.79 PLN |
| Family 6 / rok | **250 PLN** | ~239.99 PLN | ~168 PLN |

**Family plan — mechanika:** `access_rights.slots_total` (3 lub 6). Rodzic zajmuje 1 slot automatycznie, rozdaje kody na pozostałe. Zwolnienie slotu → rodzic blokuje usera z panelu profilu.

**Licencja klubowa B2B** — osobna półka (negocjowana), opcje scope: tylko trenerzy / trenerzy + rodzice (1 licencja per zawodnik).

---

### System płatności — architektura zaprojektowana 2026-04-09 (platnosci.md)
- [x] Architektura: trial per (uid,clubId), grace 7 dni, floating license, 4 produkty, Apple x2
- [x] Firestore schema: `access_rights`, `subscriptions`, `clubs.license`, `users.clubs_trial`
- [x] `platnosci-banner.html` — interstitial TRIAL/GRACE ✅
- [x] `platnosci.html` — wybór pakietu + 3 metody płatności ✅
- [x] `coachay-core.js` — `getAccessStatus()`, `shouldShowTrialBanner()`, `checkPaymentAccess()`
- [x] `functions/index.js` — `onMembershipCreated` tworzy `clubs_trial`
- [x] `support.html` — panel platformowy (ADMIN_PLATFORMY): aktywacja licencji klubowych, impersonacja
- [x] `start.html` — dodać `checkPaymentAccess()` po `initSession()`
- [x] `blocked.html` — rozszerzyć o `?reason=payment_expired`
### Powiadomienia o kończących się licencjach — Etap 1/2/3 + System B zbudowane i zdeployowane 2026-07-28
Cloud Function `checkExpiringLicenses` (`functions/index.js`, `onSchedule('every day 07:00')`, po `updateClubLicenseStatuses` o 06:00) — potwierdzone wdrożone (`firebase deploy --only functions`, "Successful update/create operation").
- [x] **Etap 1 (System A, `access_rights`)** — iteruje kolekcję `access_rights` (pola `uid`/`club_id`). Obejmuje jednym zapytaniem P1 (własna) i P4 (rodzinna) — obie mają `valid_until`. Próg dni {15,10,5,1,0} + grace {0,7} → `notifications` (typ `LICENSE_EXPIRING`) do `uid`, FCM push przez istniejący trigger `onNotificationCreated`. Buduje też `arByClub` (clubId→Set(uid) z aktywnym P1) używane przez Etap 2. Świadomie NIE obejmuje kibica na slocie rodzinnym (lazy-claim, może kupić sobie sam)
- [x] **System B (pula klubowa)** — iteruje `clubs.license.valid_until`, wysyła do admina klubu (`trainers.isClubAdmin`) **oraz** wszystkich aktywnych trenerów klubu (rola TRENER_*, status active/grace) — zdeduplikowane w `Set`
- [x] **Etap 3** — dla tego samego `clubs.license.valid_until`: osobne, dodatkowe powiadomienie do **każdego** (dowolna rola, nie tylko trener) z aktywnym slotem klubowym (`memberships` gdzie `licenseSource:'CLUB'`, `licenseStatus:'ACTIVE'`) — wypełnia lukę Systemu B, który pomijał np. rodzica na puli ze scope='all'
- [x] **Etap 2** — TRIAL liczony od `clubs.createdAt` + 90 dni, dla wszystkich aktywnych członków klubu (poza `ZAWODNIK`, zawsze bezpłatny) którzy NIE mają aktywnego `access_rights` (sprawdzone przez `arByClub` z Etapu 1 — P1 ma priorytet nad trialem nawet w oknie trialowym, zgodnie z kolejnością P1→P0→P3→P4 w `getAccessStatus()`)
- [ ] Link w treści powiadomienia → `platnosci.html` (dziś tylko tekst, brak `referenceId`/deep-linku do ekranu płatności)
- [ ] **Nie przetestowane na żywo** (scheduled CF, trudne do ręcznego wywołania bez Firebase Console/emulatora) — do zweryfikowania przy najbliższej realnej okazji (np. testowy `access_rights`/`clubs.license` z bliskim `valid_until` i poczekać do 07:00, albo ręczne wywołanie z Firebase Console/`gcloud scheduler jobs run`)

### Licencja klubowa B2B — zakup przez admina klubu w `ustawienia.html`
- [x] **Scope licencji + max 1 rodzic na dziecko — UI zbudowane i zdeployowane 2026-07-28/30.** Nowa pozycja "Licencja klubowa" w sekcji Drużyna (`ustawienia.html`, widoczna tylko gdy `clubs.license` istnieje — inaczej komunikat "klub nie ma aktywnej licencji, skontaktuj się z supportem"). Na górze panelu: **pasek wykorzystania puli** (`used`/`total`, kolor zielony/żółty≥80%/czerwony≥100%) + **data ważności** (`valid_until`). Scope **uproszczony do 2 opcji** (2026-07-30, "Niestandardowy" usunięty na życzenie użytkownika): **"Trenerzy"** / **"Trenerzy i rodzice"** → `clubs.license.scope` (`trainers_only`/`all`), `roles[]` zawsze `[]` (pole zostaje w schemacie dla wstecznej zgodności, ale nic go już nie zapisuje). Toggle "Max 1 rodzic na dziecko" → `clubs.license.maxOneParentPerChild` (widoczny tylko gdy scope = "Trenerzy i rodzice")
- [x] **Znaleziony i naprawiony 2026-07-30 (przy okazji, w kodzie już wcześniej istniejącym w produkcji): `getAccessStatus()` nie rozróżniał TRENER_GLOWNY/TRENER_POMOCNICZY.** `memberships.role` dla trenerów to zawsze generyczne `'TRENER'` (podtyp w osobnym polu `trainerRole`) — `_isRoleInB2BScope()` porównywała surowe `'TRENER'` do wartości scope, więc rozróżnienie "tylko trener główny" nigdy by nie zadziałało (choć dziś to już nieistotne, bo "Niestandardowy" i tak usunięty — fix zostawiony jako niegroźna, ogólna poprawka poprawności). Naprawione: `role` w `getAccessStatus()` teraz rozwiązuje efektywną rolę tym samym wzorcem co reszta appki (`role==='TRENER' ? trainerRole : role`)
- [x] **`force_club_pool` USUNIĘTY CAŁKOWICIE — decyzja 2026-07-28, dotyczy logiki już wcześniej istniejącej w produkcji, nie czegoś zbudowanego dziś.** Flaga pozwalała pominąć WAŻNĄ własną licencję rodzica (P1) i wepchnąć go na pulę klubową mimo że jego okres jeszcze trwał — uznane za niedopuszczalne (marnuje slot z puli + ignoruje opłacony okres). Sprawdzone: naturalna kolejność P1→grace(7dni)→P3 w `getAccessStatus()` **już sama** poprawnie przenosi rodzica na pulę klubową dopiero gdy jego własna licencja faktycznie wygaśnie — `force_club_pool` był zbędny obok tego. Usunięte: `skipOwnLicense`/`forceClubActive` w `coachay-core.js` (zakomentowane, nie skasowane), toggle "Wymuś licencję klubową dla rodziców" w `ustawienia.html` (zakomentowany), `saveLicencja()` teraz jawnie zapisuje `force_club_pool: false` żeby wyczyścić ewentualne stare `true` w bazie
- [ ] **WAŻNE — `maxOneParentPerChild` jest tylko ZAPISYWANY, nie wymuszany.** UI pozwala włączyć ustawienie, ale nic w kodzie go jeszcze nie sprawdza przy realnym pobieraniu slotu (`claimClubLicenseSlot()` w `coachay-core.js`) — trzeba tam dodać: przed przyznaniem slotu RODZICOWI, sprawdzić czy inny aktywny rodzic tego samego `playerId` już ma `licenseSource:'CLUB'` na swoim membershipie, i jeśli tak a flaga włączona — odmówić
- [x] **Zawężenie scope zwalnia sloty + ostrzega — zbudowane i zdeployowane 2026-07-30.** `saveLicencja()` teraz, tylko gdy `_licScope !== _licScopeOriginal` (scope faktycznie się zmienia — nie odpala się przy każdym zapisie): `znajdzTraconyDostepKlubowy()` — unikalni userzy (po `userId`, nie po membershipie) z aktywnym slotem klubowym (`licenseSource:'CLUB'`/`licenseStatus:'ACTIVE'`) poza nowym scope → `maWlasnaLicencje()` odfiltrowuje tych z ważną własną licencją (`access_rights`, dla nich zwolnienie slotu jest nieszkodliwe — automatycznie spadną na P1) → dla reszty ("zagrożeni") `showConfirmSheet` z konkretnymi imionami przed zapisem → po potwierdzeniu `releaseClubLicenseSlot()` dla wszystkich (poprawnie zmniejsza `used`) + `createNotification()` tylko do zagrożonych → dopiero wtedy zapis nowego scope + odświeżenie paska wykorzystania puli
- [ ] Nie przetestowane na żywo (wymaga testowych danych: dwóch userów na slocie klubowym, jednego z i jednego bez własnej licencji, zmiana scope z "Trenerzy i rodzice" na "Trenerzy")
- [ ] `ustawienia.html` — formularz **zakupu** puli (dziś zakłada że `clubs.license` już istnieje, np. utworzone ręcznie przez support — sam zakup/aktywacja z poziomu klubu nadal niezrobiona)
- [ ] CF webhook → `clubs.license.total/used/valid_until`
- [ ] floating pool: slot pobierany przy pierwszym logowaniu po trialu
- [ ] **Gap znaleziony 2026-07-28:** `releaseClubLicenseSlot(uid, clubId)` istnieje w `coachay-core.js`, ale nie jest wywoływana nigdzie — trzeba wpiąć w `trenerzy.html` (blokowanie/usuwanie trenera lub rodzica z klubowej puli) i w plan usunięcia konta rodzica (sekcja RODO wyżej). Bez tego `clubs.license.used` tylko rośnie, nigdy nie maleje
- [ ] Licencja rodzinna B2C — zakup przez rodzica w `platnosci.html`
  - [ ] `platnosci.html` — pakiet Rodzinny → `access_rights.slots_total: 6`
  - [ ] generowanie kodów z puli rodzinnej (profil.html, istniejący system)
- [ ] Cloud Functions: webhooki RevenueCat → `renewAccess()` (Android/iOS)
- [ ] Cloud Functions: webhook Przelewy24 → `renewAccess()` (web PL)
- [ ] `support.html` — broadcast PLATFORM_MSG do wybranego / wszystkich klubów (osobne od Systemu A/B wyżej — ręczna wiadomość od supportu, nie automatyczna)
  - [ ] Nowy typ powiadomienia `PLATFORM_MSG` — banner w `start.html`
- [ ] Strona marketingowa coachay.pl
  - [ ] Firebase Hosting — landing page (lub osobny projekt)
  - [ ] Formularz "Zostaw email" → Firestore `leads` collection
  - [ ] Przycisk "Zarejestruj się" → `login.html?ref=landing`

---

## 📱 Roadmapa Android / iOS (.NET MAUI)

### ✅ Android — wrapper Capacitor wdrożony 2026-07-24 (alternatywa/pomost przed pełnym MAUI)
Zamiast czekać na pełną migrację natywną, appka webowa jest opakowana w natywny kontener Android
(Capacitor) — instalowalny `.apk`, 100% istniejącego kodu, bez przepisywania ekranów. Projekt:
`C:\Users\rafal\Documents\Claude_AI\coachay-android`. Zbudowane i przetestowane w tej sesji:
- [x] Projekt Capacitor + `server.url` → `coachay.com` (appka ładuje żywą stronę, nie lokalne pliki)
- [x] Ramka "telefonu" (dekoracja pod desktop) usuwana automatycznie w appce natywnej (`.native-app` class wykrywana przez `Capacitor.isNativePlatform()`)
- [x] Sesja przeżywa zimny restart appki — `login.html` pomija ekran logowania jeśli user już zalogowany (wcześniej: zimny start zawsze wracał do loginu mimo ważnej sesji w localStorage)
- [x] Push notifications (FCM) — token rejestrowany w `users.fcmToken`, Cloud Function `onNotificationCreated` wysyła push, `pushNotificationReceived` odświeża dzwonek gdy appka jest otwarta
- [x] Live-update meczu (`onSnapshot` w `mecz.html`) — gole/wynik widoczne na żywo bez odświeżania, niezależnie od web/appki
- [x] `window.confirm()` nie działa w Android WebView — zastąpiony wspólnym `showConfirmSheet()` w `coachay-core.js` (31 miejsc w 14 plikach)
- [x] Ikona appki — czarne tło + litera "C" fontem Syne (zgodnie z logo marki)
- [x] Eksport raportów (`raporty.html`) — potwierdzony problem: `<a download>` + `blob:` URL (i wewnętrzne `doc.save()`/`XLSX.writeFile()`) nic nie robiły w Android WebView ("raport wygenerowany, nic się nie otwiera"). Naprawione: `@capacitor/filesystem` zapisuje plik lokalnie, `@capacitor-community/file-opener` otwiera go od razu w domyślnej appce PDF/Excel/CSV (fallback na `@capacitor/share` jeśli brak appki do otwarcia); web bez zmian (już działał)
- [ ] iOS — nie robione w tej sesji (wymaga Maca do budowania)

### Przed migracją na pełne MAUI — dokończyć w web
- [x] Offline persistence — Firestore `enablePersistence()` — już zaimplementowane w `coachay-core.js` (odkryte 2026-07-24, nieoznaczone wcześniej)
- [ ] FCM + CF notifications (TRIAL/GRACE/licencje) — scheduled przypomnienia, osobne od podstawowego push wdrożonego 2026-07-24 — działa niezależnie od platformy
- [ ] RevenueCat webhooks zaprojektowane (zastąpią Przelewy24 w mobile)
- [ ] Google OAuth w web (logika biznesowa do przeniesienia)
- [ ] DEMO uproszczenie (jeden demo_user)
- [ ] Onboarding pierwsze kroki

### Migracja → .NET MAUI
- [ ] Projekt .NET MAUI — Firebase REST API lub Xamarin.Firebase binding
- [ ] Port ekranów: start → druzyna → kalendarz → mecz → czat → zadania → ogloszenia
- [ ] Native Google Sign-In SDK
- [ ] Apple Sign-In SDK (wymaga konta Apple Developer)
- [ ] Google Play In-App Purchases przez RevenueCat (zastępuje Przelewy24)
- [ ] Apple IAP przez RevenueCat
- [ ] FCM natywny token rejestracji (nie web push)
- [ ] MediaPicker API — zdjęcie avatara
- [ ] Biometrics — zastąpić PIN fingerprint/Face ID
- [ ] MAUI Shell — zastąpić `window.location.href`
- [ ] Jak appka mobilna będzie gotowa — zaktualizować treść wiadomości WhatsApp z kodem (`wyslijWhatsAppBtn()` w `druzyna.html`), żeby zamiast/obok linku do `coachay.com` kierować do pobrania appki

---

## 🔮 Backlog

- **"Poproś o kod" — WhatsApp — zdecydowane 2026-07-28: nie robimy tego** (przeniesione z Aktywnych, gdzie tylko zajmowało miejsce). Pełna spec (wymagania Meta Business + numer telefonu, zmiany schematu `players.guardianPhones`/`inviteCodes.status`/`trainers.phone`, flow login.html, reverse lookup CF, `sendCodeViaWhatsApp`, `codeRequests` audit trail) — patrz historia TODO.md sprzed 2026-07-28, jeśli temat kiedyś wróci
  - **Odkryte tego samego dnia:** `sendCodeViaWhatsApp`/`onWhatsAppWebhook` już istniały jako **działający, wdrożony kod** w `functions/index.js` (publiczne, nieautoryzowane `onRequest` endpointy, tylko rate-limit po telefonie) — najwyraźniej z wcześniejszej, nieudokumentowanej sesji. Usunięte z produkcji 2026-07-28 (`firebase functions:delete onWhatsAppWebhook sendCodeViaWhatsApp`) — same wywołania robiły odczyty/zapisy Firestore nawet bez skonfigurowanego Meta, więc wisiały jako niepotrzebny koszt/powierzchnia ataku. Kod **zakomentowany, nie usunięty** w `functions/index.js` (blok zaczyna się "WYŁĄCZONE 2026-07-28") — gotowy do odkomentowania + redeployu gdy temat wróci
- Sparring exchange marketplace (gielda.html — częściowo)
- Referee/medic marketplace
- Live match mode (bramki, kartki, zmienni — szczegółowy)
- Historia zadań (osobny ekran)
- Składy zawodników
- **Powoływanie zawodników między drużynami klubu** — trener tworzy event (mecz/trening) dla swojej drużyny i może dołączyć zawodników z innej drużyny tego samego klubu; zaproszeni zawodnicy widzą event jak własny, trener ich drużyny dostaje powiadomienie o powołaniu

---

## ✅ Zrobione

### Sesja 2026-07-30
- `profil.html` — sekcja "Zarejestrowani kibice" (`loadRegisteredKibice()`) pokazywała nieaktualne imię z denormalizowanego `membership.displayName` zamiast aktualnego `users.displayName` — **znaleziony przez użytkownika na żywym przykładzie**: ten sam kibic (`demo_obserwator_babcia`) pokazywał się jako "Babcia Kowalska" na profilu rodzica, ale jako "Maria Kowalska" (poprawne, aktualne imię z `users`) na profilu zawodnika w `druzyna.html`. Naprawione — teraz też pobiera świeże `users.displayName`, spójnie z `druzyna.html`. Zweryfikowane na żywo
- `profil.html` — `renderSubscription()`: cofnięty wcześniejszy fix z 07-28 (chip "Demo" na sztywno dla kont demo) na życzenie użytkownika — teraz każde konto pokazuje faktyczny `getAccessStatus()`, plus nowa etykieta źródła dostępu obok daty (Licencja klubowa/Własna licencja/Okres próbny/Pakiet rodzinny). Zweryfikowane na żywo (demo_rodzic_anna → "Licencja klubowa · 2026-09-12 · AKTYWNA")
- `ustawienia.html` — panel "Licencja klubowa": scope uproszczony z 3 opcji do 2 ("Trenerzy" / "Trenerzy i rodzice"), "Niestandardowy" usunięty całkowicie na życzenie użytkownika
- `coachay-core.js` — **`force_club_pool` usunięty całkowicie** (zakomentowany) z `getAccessStatus()` — pozwalał pominąć ważną własną licencję rodzica i wepchnąć go na pulę klubową mimo trwającego opłaconego okresu, uznane za niedopuszczalne. Naturalna kolejność P1→grace(7dni)→P3 już sama poprawnie przenosi rodzica na pulę dopiero po faktycznym wygaśnięciu jego licencji
- `coachay-core.js` — naprawiony `getAccessStatus()`: nie rozwiązywał efektywnej roli trenera (`memberships.role` to generyczne `'TRENER'`, podtyp w `trainerRole`) — teraz spójne z resztą appki
- `ustawienia.html` — zawężenie scope licencji klubowej teraz zwalnia sloty (`releaseClubLicenseSlot()`) i ostrzega zagrożonych userów przed zapisem (`showConfirmSheet` z imionami), z rozróżnieniem czy dana osoba ma własną licencję jako fallback
- Ustawiony `isClubAdmin: true` na `demo_trener_jan` (trainers + memberships) i testowa `clubs.license` (5/20 slotów, potem Anna dodana jako user puli) na `club_orly_praga` — do testowania powyższego na żywo

### Sesja 2026-07-28
- `start.html` — przycisk "📋 Obsługuję mecz" dla rodzica ograniczony do dnia meczu (`isMatchDay = match.date === todayStr`, `renderMatchCard()`) — wcześniej pokazywał się dla dowolnego meczu w oknie `matchDays` (nawet za tydzień). Dodane też zabezpieczenie w `claimMatch()` (świeże sprawdzenie daty z Firestore) na wypadek nieodświeżonego widoku. Zdeployowane
- `kalendarz.html` — temat treningu: combobox (wybór z listy + wpisanie własnego) ujednolicony między tworzeniem eventu, edycją i szybką zmianą tematu; nowy `resolveTrainingTopic()` dopasowuje case-insensitive albo pyta (`showConfirmSheet`) czy dodać nowy temat na stałe do `trainingTopics` — buduje słownik bez ręcznego CRUD. Wcześniej: tworzenie eventu w ogóle nie pozwalało wpisać własnego tematu, a panel "Zmień temat" pozwalał, ale nigdy nie zapisywał do słownika (jednorazowy tekst). Zdeployowane
- RODO — obszerna analiza zawodnik/trener/rodzic (usuwanie/anonimizacja), patrz sekcja "⚖️ RODO" wyżej: ustalona zasada własności danych (klubowe vs kontowe), rozpisany pełny flow usunięcia konta rodzica (kaskada cross-club, zwolnienie licencji, powiadomienia), znalezione i udokumentowane 4 martwe/zepsute funkcje w `druzyna.html` + hard-delete bug + mylący komunikat na `blocked.html`. Nic jeszcze nie zaimplementowane — to specyfikacja do zbudowania
- **Audyt menu bocznego** (14 ekranów sprawdzonych przez subagenta, porównanie pozycja-po-pozycji) — znalezione i naprawione: (1) `klub.html` — własna pozycja "Drużyny klubu" straciła `id="menu-klub"` przy zamianie na wariant "jesteś tu", przez co `loadMenuPanel()` cicho nie chował jej dla nie-trenerów na tym jednym ekranie — dodany z powrotem; (2) `support.html` (panel ADMIN_PLATFORMY, dostęp bramkowany osobną flagą `users.isPlatformAdmin`, nie rolą) — pozycja menu istniała tylko w `start.html`, na sztywno `display:none`, i **nic jej nigdy nie odsłaniało nawet dla admina** — `loadMenuPanel()` w `coachay-core.js` dostał nową logikę: pokazuje `#menu-support` gdy `user.isPlatformAdmin === true`; (3) **realny bug znaleziony po zgłoszeniu przez użytkownika** — `profil.html:399` wołał `loadMenuPanel(user)` z jednym argumentem zamiast `loadMenuPanel(user, membership, team)` jak wszędzie indziej. Efekt: `membership` w środku funkcji było `undefined` → `effectiveRole` zawsze pusty → Raporty i Drużyny klubu **znikały z menu na `profil.html` nawet dla trenera**, plus prawdopodobnie zepsuta etykieta roli/klubu w nagłówku menu. Naprawione. Ten sam błąd (`loadMenuPanel(user)` z jednym argumentem) siedzi też w `_szablon.html:184` — ale ten plik jest osobnym, większym problemem (patrz niżej), nie naprawiane teraz w izolacji
- [x] **`_szablon.html` usunięty — decyzja 2026-07-28.** Był przestarzały względem architektury v4.1 (`user.contexts`/`user.children`, pola usunięte w migracji na `memberships`; `getCurrentTeam()` zamiast `initSession()`) i nikt go nie aktualizował. Zamiast utrzymywać osobny plik-szablon, który stale wypada z synchronizacji z resztą appki: **wzorcem dla nowych ekranów jest zawsze jakiś aktualny, realny ekran** (np. `mecz.html`) — kopiuje się z niego chrome (sesja, menu, powiadomienia) na żywo, zamiast z martwego pliku
- [x] `zadania.html` — dopisana brakująca pozycja "Zadania" (wariant "jesteś tu", `class="menu-item active" onclick="closeMenu()"`, ten sam wzorzec co `profil.html`/`trenerzy.html`/`ustawienia.html`) — zdeployowane 2026-07-28
- Przy okazji zmiany w `coachay-core.js`: zbumpowana wersja `?v=` na `_global.css`/`coachay-core.js` we **wszystkich 23 plikach** na `20260728b` (zgodnie z zasadą — zmiana we wspólnym pliku wymaga bumpu wszędzie, nie tylko w edytowanym ekranie)

### Sesja 2026-07-24
- **Android wrapper (Capacitor)** — nowy projekt `coachay-android` (osobny katalog obok `Coachay/`), `server.url` → `coachay.com`, `.apk` debug budowany i instalowany na emulatorze (Pixel 10, API 36.1) oraz gotowy do instalacji na fizycznym telefonie. Zarejestrowana appka Android w Firebase (`com.coachay.app`), `google-services.json` pobrany przez `firebase apps:sdkconfig`
- **Bug: `status` membershipów `'ACTIVE'` vs `'active'`** — niespójność casingu w danych (13 rekordów `'active'`, 11 `'ACTIVE'`) powodowała pomijanie userów w zapytaniach Firestore. Naprawione w 5 miejscach `coachay-core.js`: `createNotificationsForEvent()` (przez to Jasiek nie dostawał powiadomień o evencie), `getUserTeams()`, `getMembership()`, `sendCrossNotification()` (oba warianty rodzic/zawodnik), `getTeamMembers()`, `getClubMembers()`. Sprawdzone bezpośrednio w Firestore (REST API + token z `firebase-tools.json`, wzorzec w `CLAUDE_NOTES.md`) — `REMOVED`/`INACTIVE`/`demo` nie mają tego problemu (tylko jedna wersja casingu w danych)
- **Ramka telefonu w appce natywnej** — `_global.css`/`login.html` mają dekoracyjną ramkę `.phone` do podglądu na desktopie; w WebView renderowała się jako "telefon w telefonie". Naprawione: `coachay-core.js` dodaje klasę `native-app` do `<html>` gdy wykryje `Capacitor.isNativePlatform()` (z retry co 100ms przez 2s — bridge Capacitora dla zdalnego `server.url` wstrzykuje się asynchronicznie), CSS chowa ramkę gdy klasa obecna. `login.html` miał osobny, niepowiązany z `_global.css` CSS — wymagał osobnej poprawki
- **Offline persistence** — odkryte że `enablePersistence({synchronizeTabs:true})` już był zaimplementowany w `initFirebase()` (nieoznaczone wcześniej w TODO). `czat.html` już poprawnie obsługuje podwójny callback cache+serwer z `onSnapshot` (ignoruje pierwszy strzał, dedup po id) — bezpieczne do włączenia
- **Live-update meczu** — `mecz.html` nie miał żadnego real-time listenera (tylko `.get()` jednorazowo), więc gole/wynik nie docierały do widzów na żywo. Dodany `onSnapshot` na dokument meczu: nasłuchuje od otwarcia ekranu aż do `matchStatus === 'FINISHED'` (łapie też moment startu UPCOMING→LIVE), z bezpiecznikiem do północy danego dnia
- **Bug: `endMatchFromScreen()` nie zapisywał wyniku** — liczyła `our`/`opponent` lokalnie do wiadomości potwierdzenia i obliczenia `outcome`, ale nigdy nie zapisywała tych pól do Firestore `matchData.result` — po zakończeniu meczu wynik pokazywał się jako "undefined : undefined" wszędzie indziej (np. `start.html`). Naprawione + poprawiony istniejący rekord testowy w bazie
- **Push notifications (FCM)** — Cloud Function `onNotificationCreated` (trigger na `notifications/{id}`, `functions/index.js`) wysyła push przez `firebase-admin/messaging` na token zapisany w `users.fcmToken`; czyści nieważny token przy `messaging/registration-token-not-registered`. Klient: `setupPushNotifications()` w `coachay-core.js` (tylko appka natywna — `Capacitor.isNativePlatform()`), prosi o zgodę, rejestruje token, `pushNotificationReceived` odświeża dzwonek (`loadAndRenderNotifications()`) gdy appka jest otwarta na pierwszym planie (Android nie pokazuje wtedy systemowego powiadomienia automatycznie). Przetestowane end-to-end (wiadomość Anna→Jan, log CF potwierdził wysyłkę)
- **Ikona appki** — czarne tło (`#0A0A0A`, zgodne z `--tlo`) + litera "C" fontem Syne 800 (ten sam co wordmark "COACHAY" na `login.html`), wygenerowana programistycznie (canvas + Google Fonts), pełny komplet adaptive icon (foreground/background) + legacy fallback dla wszystkich gęstości (mdpi–xxxhdpi)
- **Bug: sesja nie przeżywała zimnego restartu appki** — `index.html` bezwarunkowo przekierowuje do `login.html` (żadnej zmiany), a `login.html` nigdy nie sprawdzał czy user jest już zalogowany — na webie nieistotne, ale appka natywna ładuje `coachay.com` od zera przy każdym cold-starcie (np. po usunięciu z listy otwartych aplikacji), więc wyglądało to jak wylogowanie mimo że `localStorage` (potwierdzone: przetrwał na dysku WebView) był nietknięty. Naprawione: `login.html` sprawdza `isDemoMode() || getCurrentUserId()` na starcie i przekierowuje prosto do `start.html`
- **Bug: `window.confirm()` nie działa w Android WebView** — brak natywnej obsługi dialogów JS w WebView (w przeciwieństwie do pełnej przeglądarki) powodował że przyciski z `confirm()` nic nie robiły — w tym **"Zakończ mecz" było całkowicie zablokowane** i wylogowanie nie działało. Dodany wspólny `showConfirmSheet()` w `coachay-core.js` (bottom-sheet, Promise<boolean>) — zamienione 31 wystąpień w 14 plikach: `klub.html`, `zadania.html`, `druzyna.html`, `mecz.html`, `ustawienia.html`, `kalendarz.html`, `trenerzy.html`, `support.html`, `start.html`, `profil.html`, `rodo.html`, `pin.html`, `ogloszenia.html`, `czat.html`. Działa identycznie na web i w appce (zwykły JS/CSS, nic natywnego)
- `start.html` — dodana etykieta "Wynik:" (mała, przygaszona) przed wynikiem meczu, czcionka wyniku zwiększona 18→19px
- **Bug: menu boczne (hamburger) niespójne między ekranami** — pozycje menu są wklejone osobno w każdym z 18 plików (`loadMenuPanel()` w `coachay-core.js` wypełnia tylko awatar/rolę, nie generuje listy). Znalezione i naprawione: (1) "Płatności" miało `onclick="closeMenu()"` zamiast nawigacji w 12 plikach (działało tylko w `profil.html`/`ustawienia.html`); (2) "Wyloguj się" miało `onclick="closeMenu()"` zamiast `logout()` w `czat.html`/`kalendarz.html`/`mecz.html` — wylogowanie z bocznego menu nie działało na tych ekranach; (3) `_szablon.html` (szablon dla nowych ekranów) brakowało pozycji "Drużyny klubu"; (4) `zadania.html` miało inną strukturę (separatory, aktualna strona jako `active`+`closeMenu()`) i brakowało linku "Raporty" — ujednolicone do tej samej konwencji co reszta ekranów (pomijanie linku do siebie samego)
- **Bug: menu boczne pokazywało "Raporty"/"Drużyny klubu"/"Płatności" wszystkim rolom** — `raporty.html` i `klub.html` to funkcje trenerskie (raporty.html już blokował samą stronę dla nie-trenerów, ale link w menu był widoczny dla każdego), a Płatności jest bez znaczenia dla ZAWODNIKA (zawsze bezpłatny, patrz cennik). Dodane `id="menu-raporty"`/`id="menu-klub"`/`id="menu-platnosci"` do pozycji menu w 14 plikach, `loadMenuPanel()` w `coachay-core.js` chowa je wg roli (Raporty/Drużyny klubu tylko TRENER_GLOWNY/TRENER_POMOCNICZY, Płatności ukryte dla ZAWODNIK)
- **Onboarding — pierwsze kroki** — nowy `onboarding.html`, config-driven (`ONBOARDING_STEPS`), jeden krok = jeden realny ekran (Start/Klub/Drużyna/Kalendarz/Ustawienia) z prawdziwymi fragmentami HTML/CSS (żyją z `_global.css`, aktualizują się same przy zmianie stylu) + numerowane znaczniki przyklejone bezpośrednio do konkretnego elementu (`.hotspot`, nie zgadywane globalnie) + krótka legenda pod makietą. TRENER (5 kroków), RODZIC (2 kroki, w tym prawdziwy przycisk "📋 Obsługuję mecz" dla `parentsCanAssist`), KIBIC (1 krok). Link "Jak zacząć" w bocznym menu (ukryty dla ZAWODNIKA), `start.html` przekierowuje tam automatycznie przy pierwszym uruchomieniu (`users.onboardingDone`)
- **Bug: mojibake w treści powiadomień** ("potwierdÅº obecnoÅÄ" zamiast "potwierdź obecność") — `functions/index.js` miał na dysku faktycznie zepsute bajty (podwójne kodowanie UTF-8 przez Latin-1, nie tylko kosmetyczny problem w komentarzach jak wcześniej zakładano) — dotyczyło realnych stringów wysyłanych do Firestore, nie tylko logów. Naprawione na poziomie bajtów (6 wzorców, 137 podmian w całym pliku — ó/ą/ę/ć/ń/ł/ż/ś/ź, myślniki, strzałka, emoji w logach), zdeployowane, oraz naprawione 8 już istniejących zepsutych rekordów w bazie

### Sesja 2026-07-23
- `raporty.html` — przebudowany na moduł raportowy zamiast jednego sztywnego raportu: `RAPORTY_REJESTR` (rejestr raportów, każdy wpis = etykieta + `generujDane(ctx)`), generyczny kształt danych `{tytul, naglowek, kolumny, wiersze, nazwaBazowa}`, generyczne `pobierzCSV()`/`pobierzXLSX()`/`pobierzPDF()` które nie wiedzą nic o konkretnym raporcie — dodanie kolejnego raportu = nowy wpis w rejestrze + własna funkcja `budujPakiet...()`, bez ruszania eksportu; nowy przełącznik "Typ raportu" w UI
- Drugi raport: **Szczegółowy raport zajęć** — poprawiony po pierwszej wersji (kolumny = zajęcia nie mieściły się przy kilku treningach/tydzień). Teraz format listy: wiersz = 1 zawodnik na 1 zajęciach (Zawodnik/Data/Treść/Status jako czytelny tekst — "Obecny"/"Nieobecny"/"Absencja zgłoszona", bez kodów 1/0/2), rośnie w dół zamiast wszerz — nie ma limitu szerokości strony. PDF w orientacji pionowej (stary raport dzień-po-dniu zostaje poziomy — ma dużo kolumn)
- Generyczny kształt pakietu rozszerzony: `wiersze` to teraz zwykłe tablice komórek 1:1 z `kolumny` (nie sztywny `{label,cells,obecny,...}`), `legenda` i `orientacja` opcjonalne per-raport — dzięki temu dwa raporty o zupełnie różnym kształcie tabeli używają tego samego eksportu
- Zweryfikowano regresję — stary raport "Lista obecności" działa identycznie jak przed refaktorem
- Okres raportu uogólniony z (rok, miesiąc) na zakres dat (`dataOd`/`dataDo`) — otwiera drogę do dowolnych zakresów w przyszłości; dodany checkbox **"Na dzień"** w sekcji Okres, przełącza selektory miesiąc/rok na pojedyncze pole daty — oba raporty poprawnie zawężają się do jednego dnia
- Etykieta "Typ raportu" → **"Lista raportów:"**
- `kalendarz.html` — przycisk "📊 Raport obecności" w pasku typu na górze panelu szczegółów eventu (widoczny tylko dla trenera, tylko dla TRENING/MECZ/WYJAZD) → `idzDoRaportuZajecia()` przenosi na `raporty.html?raport=szczegolowy&typ=...&data=...`; `raporty.html` odczytuje te parametry przy starcie (`wypelnijZParametrowUrl()`) i wypełnia formularz (typ raportu, "Na dzień" + data, checkbox typu zajęć) — trener tylko wybiera format i klika Generuj, moduł raportowy sam w sobie nietknięty
- Kolumna **Lp** dodana jako pierwsza w każdym raporcie — wspólna funkcja `dodajLp()` w `generujRaport()`, dokładana raz do każdego pakietu przed eksportem, więc automatycznie obejmuje też każdy przyszły raport bez dodatkowej pracy
- **Bug fix:** raport dla eventów z zaproszoną "całą drużyną" (sentinel `__TEAM__` w `attendance.invited` zamiast wypisanych playerId — patrz mecz.html) wychodził pusty, bo raport sprawdzał tylko dosłowne dopasowanie ID. Dodana `jestZaproszony(e, pid)` (uwzględnia `__TEAM__`) używana w obu raportach
- **Bug fix:** "Treść" dla treningu w Szczegółowym raporcie brała tylko `event.title`, ale temat treningu to osobne, niezależne pole (`topicId` → kolekcja `trainingTopics`, wybierane z listy rozwijalnej w kalendarz.html — `title`/`description` to zupełnie inne pola wypełniane przy tworzeniu eventu). Dodana `pobierzTematyTreningow()` + mapowanie `topicId → title`, z priorytetem: temat z listy → tytuł → opis → "—"
- `polityka-prywatnosci.html` — nowa strona, pełny dokument prawny (adaptacja polityki Nexwise pod Coachay: coachay.com, NIP 771-222-88-03, support@coachay.com, hosting Firebase/Google Cloud, sekcja o danych małoletnich zawodników zamiast nexwise'owej sekcji o enova365/DPA). Linkowana z `rodo.html` (nowa karta "📄 Pełna polityka prywatności"), która zostaje jako krótkie podsumowanie w appce. Przy okazji poprawiony błędny kontakt w `rodo.html` (`kontakt@coachay.pl` → `support@coachay.com`, było na złej domenie)

### Sesja 2026-07-22
- `raporty.html` — nowy ekran, trener-only: raport listy obecności (dziennik trenera) za wybrany miesiąc/rok, osobno dla Treningów/Meczów/Wyjazdów (min. 1 wybrany), eksport PDF (A4 poziomo, jspdf + autotable, jedna strona per typ)/CSV (jeden plik per typ)/XLSX (jeden plik, jeden arkusz per typ, SheetJS); komórki: 1=obecny, 0=nieobecny, 2=absencja zgłoszona (cross-referencja z kolekcją `absences`), puste=brak zajęć tego dnia; podsumowanie per zawodnik (Obecny/Nieobecny/Absencja); nagłówek z imieniem trenera i okresem; PDF bez polskich znaków diakrytycznych (ograniczenie fontów jsPDF), CSV/XLSX pełne UTF-8
- Pozycja "📊 Raporty" dodana do bocznego menu we wszystkich 12 ekranach + `_szablon.html`
- `druzyna.html` — naprawiony `ReferenceError: dlaRodzica2` przy generowaniu kodu RODZIC (zła zmienna scope'owana w bloku try); race condition przy przełączaniu zakładek kodów (sequence guard); domyślnie ukryte użyte/wygasłe kody + checkbox "Pokaż nieaktywne kody" (przemianowany, bo kolidował nazwą z checkboxem przy powiązanych kontach); status "🚫 Dezaktywowany" odróżniony od "✅ Użyty"; usunięty automatyczny popup WhatsApp po generowaniu kodu → kopiowanie do schowka; link WhatsApp bez wskazanego numeru (`wa.me/?text=`, user sam wybiera kontakt) zamiast zgadywania między rodzicami; treść wiadomości ujednolicona między Kopiuj/WhatsApp (`budujTrescKodu()`), link zaktualizowany na `coachay.com`; etykieta typu kodu (Rodzic/Zawodnik/Kibic) na każdym kodzie; absencje spoza bieżącego miesiąca już się nie wyświetlają na profilu zawodnika; dodana godzina do znacznika czasu wygenerowania kodu; przełącznik sezonu (aktualny + `seasonHistory[]`) przy Frekwencji na profilu zawodnika
- `firebase.json` — `Cache-Control: no-cache` dla `.html`/`.js`, żeby kolejne deploye były widoczne od razu bez czyszczenia cache przeglądarki

### Sesja 2026-04-17
- `login.html` — Google OAuth dla "Mam kod" path: rejestracja + logowanie przez Google; poprawny userId (`generateUserId(ic.role)`); nazwa z Google tylko dla RODZIC/OBSERWATOR (trener zachowuje nazwę z invite code)
- `trenerzy.html` — admin może edytować siebie; usunięte przypisanie drużyn z panelu edycji; email widoczny w edycji + szczegółach (fallback z `users` doc); drużyny w szczegółach jako read-only badges z membership; `saveEditTrainer()` aktualizuje membership + users + trainers doc; dual-status query (`ACTIVE`/`active`) dla memberships
- `klub.html` — lista trenerów pod każdą drużyną (karta + panel szczegółów) z ★ dla TRENER_GLOWNY; `isGlowny` wyłącznie z `membership.role` (nie z `trainers.role` ani `membership.trainerRole`)

### Sesja 2026-04-16
- `coachay-core.js` — `logout()` czyści `appLastActive` → PIN timer resetowany przy wylogowaniu (nie odpala przy ponownym logowaniu)
- `blocked.html` — `invite-card` margin-top: 16px (nie zachodzi na kartę blokady); usunięty przycisk "Sprawdź kod" → auto-submit po 6 znakach
- `profil.html` — usunięty przycisk "Sprawdź kod" → auto-submit po 6 znakach
- `start.html` + `blocked.html` — zintegrowany `checkPaymentAccess()` (blokada wygasłej licencji) ✅

### Sesja 2026-04-11
- `profil.html` — przycisk "Zapisz" w nagłówku karty, subskrypcja z `getAccessStatus()` + data RRRR-MM-DD, karta PIN uproszczona (przycisk → bottom sheet z klawiaturą)
- `coachay-core.js` — `sha256()`, `_checkPinLock()` wbudowane w `initSession()` (automatyczna blokada PIN na wszystkich stronach), `getAccessStatus()` zwraca teraz `expiryDate`
- `pin.html` — nowy ekran blokady/setup: 4-cyfrowy PIN, SHA-256 hash w `users/{uid}.pinHash`, tryby `setup` / `unlock`, "Nie pamiętam PINu" → usuwa hash + wylogowuje, wygląd wzorowany na `platnosci-banner.html`
- `ustawienia.html` — kompletny rewrite: usunięto 9 elementów, zostały 3 sekcje: Drużyna (TRENER_GLOWNY/isClubAdmin), Aplikacja (wszyscy), Prawne (wszyscy); daty sezonu z arkuszem wyboru (zmień aktualny / dodaj nowy + archiwum do `seasonHistory[]`); pozycje zawodników z toggleami (zapis do `settings.positions`); Polityka → `rodo.html`
- `rodo.html` — nowy ekran: 4 karty RODO, przycisk "Usuń moje konto" → mailto, animacje fadeUp
- `druzyna.html` — frekwencja oparta o sezon (`teams.settings.season`): usunięto martwy kod `attendancePeriod`, brak sezonu → statystyki wyświetlają `—` (brak zapytania Firestore), info o sezonie nad statystykami w panelu zawodnika
- `ARCHITEKTURA.md` — zaktualizowane pole `pinHash` (było `loginPinHash`, 6 cyfr → 4 cyfry SHA-256), dodana decyzja v4.2; `teams.settings.season` + `positions` + `seasonHistory`, frekwencja oparta o sezon

### Sesja 2026-04-09
- Architektura płatności: trial per (uid,clubId), grace 7 dni, floating license, 4 produkty, Apple x2
- Firestore schema: `access_rights`, `subscriptions`, `clubs.license`, `users.clubs_trial`
- `platnosci-banner.html` — interstitial TRIAL/GRACE
- `platnosci.html` — wybór pakietu + 3 metody płatności (SVG logo)
- `coachay-core.js` — `getAccessStatus()`, `shouldShowTrialBanner()`, `checkPaymentAccess()`
- `functions/index.js` — `onMembershipCreated` tworzy `clubs_trial` (ZAWODNIK wykluczony)

### Sesja 2026-04-07
- `initSession()` wdrożone na wszystkich ekranach zamiast `getCurrentTeam()` + `getCurrentMembership()`
- KIBIC uprawnienia: start.html, druzyna.html, mecz.html, kalendarz.html
- `profil.html` — kody dla kibica, karta "Kibice" dla RODZIC
- System powiadomień — bugi: cross-sync, `__TEAM__` expansion dla RODZIC, TASK_COMPLETED
- Brak internetu — overlay globalny w `coachay-core.js`
- `blocked.html` — ctx-switcher, sekcja "Masz kod", Arkanoid easter egg
- `trenerzy.html` — `grantAdminRole()`, `revokeAdminRole()`
- Demo mode fix — `auth.signInAnonymously()` przed redirectem

### Sesja 2026-04-01
- `mecz.html` — obsługa `__TEAM__` sentinel (zawodnicy przy scope DRUZYNA)
- `mecz.html` — obsługa gości z innych drużyn (scalanie teamPlayerIds + invitedPlayerIds)
- `mecz.html` — `firstName` field: fallback `p.firstName || p.name`
- `mecz.html` — CSS text-overflow ellipsis (selektor, lista meczy, karty zawodników)
- Weryfikacja: punkty 1-5 z poprzedniej sesji już zaimplementowane

### Sesja 2026-03-31
- Firebase Auth zaimplementowane: email+hasło, SMS, kod zaproszenia
- `login.html` — `generateUserId(role)` → `user_ROLA_RRRRMMDD_NNNNNNN`
- `login.html` — `findUserByAuthUid()` → query users where authUid == uid
- Cloud Functions wdrożone: onEventCreated, onMembershipCreated, sendReminders, anty-duplikat
- Migracja `users`: dodane `authUid` + `firstName` + `lastName` do wszystkich rekordów
- Projekt na planie Blaze
- `profil.html` v1.0
- `ogloszenia.html` ✅
- `czat_detail.html` ✅

### Sesja 2026-03-27 i wcześniejsze
- `memberships` kolekcja — zaprojektowana i zbudowana
- `druzyna.html` v2.8 — pełna przebudowa
- `kalendarz.html` v2.7 — chipy scope, serie eventów, cloud functions
- `zadania.html` v3
- `czat.html` + `czat_detail.html`
- `start.html` v6
- Cloud Functions powiadomień
- `coachay-core.js` — isVisible, setCurrentUserData, manageNotifications, logout
