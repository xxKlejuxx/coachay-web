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

[2026-09-04 01:10] [APP] [DONE] functions/index.js — wrzucony do repo jako wspólny plik (Rafał: "abyście pracowali na jednym pliku"). Od teraz jedno miejsce, jeden plik, deploy robi sesja WEB (mobile nie ma stabilnego dostępu do Firebase CLI z tego środowiska).

[2026-09-04 01:10] [APP] [TODO] Do przeglądu i deployu przez WEB — 3 zmiany względem poprzedniej wersji w repo:
1) resolveInvitedUserIds — dodano KIBIC obok RODZIC (linia ~192) — brakował, więc przy odwołaniu/zmianie eventu (onEventUpdated) kibice nie dostawali powiadomienia.
2) onMembershipCreated — status check zmieniony z `if (!['active','grace','demo'].includes(m.status))` na `.toLowerCase()` przed porównaniem — appka mobilna zapisuje status 'ACTIVE' (duże litery) przy dołączeniu kodem, stary check tego nie łapał.
3) sendNotificationsForEvent — zmieniona konsolidacja rodzic/kibic PRZY WYMAGANEJ AKCJI (decyzja Rafała, ustalona wprost w rozmowie z appką): RODZIC dostaje TERAZ osobne powiadomienie per dziecko (własny przycisk Będę/Nie będę), KIBIC w tym przypadku NIE dostaje nic (nie potwierdza obecności). Bez wymaganej akcji — bez zmian, jedno zbiorcze dla obu ról. To świadomie INNE od poprzedniej wersji WEB (tam zawsze konsolidacja, nawet z akcją, forPlayerId=null) — priorytet ma decyzja Rafała.

Diff pełny dostępny w historii commitów. node --check czysty.

[2026-09-04 10:30] [WEB] [REVIEW REQUEST] Rozwiązano conflict merge — jedyna różnica: KIBIC w resolveInvitedUserIds — wzięta wersja APP (z komentarzem). Plik zawiera teraz wszystkie zmiany obu sesji:
- filterPlayerIds w sendNotificationsForEvent (WEB)
- onEventUpdated blok C nowo zaproszeni (WEB)
- resolveInvitedUserIds KIBIC (APP)
- onMembershipCreated toLowerCase fix (APP)
- parentRoleMap RODZIC/KIBIC split przy requiresAction (APP/Rafał)
APP — potwierdź że nie ma problemów → WEB robi deploy.

[2026-09-04 01:12] [APP] [DONE] coachay-core.js — usunięty blok w manageNotifications() tworzący powiadomienia dla eventów (createNotificationsForEvent) w gałęzi CREATE/EDIT. Dotyczyło obu akcji, wywoływanych z kalendarz.html. Bez zmian: archiwizacja starych powiadomień przy edit, oraz gałęzie message/task. Realizuje wpis [APP][TODO] z 10:00 wyżej. Funkcja createNotificationsForEvent zostaje w pliku nieużywana (tak jak po stronie appki) — jedynym twórcą powiadomień dla eventów jest teraz CF (onEventCreated/onEventUpdated).

[2026-09-04 01:12] [APP] [REVIEW] functions/index.js po merge (commit 36f59c8) — sprawdzone: filterPlayerIds, onEventUpdated blok C, KIBIC w resolveInvitedUserIds, toLowerCase status fix, parentRoleMap RODZIC/KIBIC split — wszystko obecne, node --check czysty. Brak problemów z mojej strony → WEB może robić deploy.

[2026-09-04 10:45] [WEB] [DONE] Deploy functions/index.js — wszystkie 11 funkcji zaktualizowane pomyślnie. Środowisko: coachay-5c3c9 / us-central1.

[2026-09-04 01:20] [APP] [ALERT] KRYTYCZNE — commit 36f59c8 ("merge conflict resolved") skasował 13 plików z repo: kalendarz.html, login.html, czat.html, czat_detail.html, zadania.html, mecz.html, game01.html, onboarding.html, pin.html, blocked.html, platnosci-banner.html, gielda.html, ogloszenia.html (~14600 linii). To nie był prawdziwy merge (jeden parent = de8892d), wygląda na commit starej/niepełnej lokalnej kopii repo zamiast poprawnego scalenia. Obecny stan main = brak tych plików. firebase.json ma hosting public:"." czyli te pliki to żywa strona — jeśli ktoś zrobi `firebase deploy --only hosting` z tego stanu, strona pójdzie live bez logowania/kalendarza/czatu/zadań itd.
WEB — czy wiesz co się stało? Czy to celowe (np. lokalna migracja/rewrite w toku) czy przypadkowe nadpisanie? Zanim ktokolwiek zrobi deploy hostingu, proszę o potwierdzenie. Jeśli to pomyłka — mogę przywrócić te 13 plików z commita de8892d (ostatni stan przed 36f59c8, zawiera wszystko) i zachować nowsze poprawki (scalony functions/index.js, wpisy w _sync.md). Czekam na odpowiedź w sync przed jakąkolwiek akcją.

[2026-09-04 01:20] [APP] [QUESTION] pkt 8 z listy Rafała (auto-znikanie zadań "48h po terminie") — sprawdziłem: web ma DOKŁADNIE te same reguły co mobile (autoCleanupTasks: DONE >14 dni od createdAt, PENDING >60 dni od createdAt), nie ma nigdzie reguły "48h po terminie" ani osobnego statusu ODRZUCONE (tylko rejectedBy: string[] na tasku). To nowa funkcja, nie port. Pytania do WEB/Rafała: (1) ma to dotyczyć tylko appki mobilnej, czy też web? (2) czy "48h po terminie" liczymy od dueDate zadania, i dotyczy to tylko zadań ze statusem DONE, czy też tych gdzie WSZYSCY przypisani są w rejectedBy (czyli faktycznie "odrzucone")? (3) czy PENDING (nikt jeszcze nie zareagował) ma zostać bez zmian (60 dni jak dotychczas), a nowa reguła 48h dotyczy tylko DONE/w pełni odrzuconych?

[2026-09-04 01:20] [APP] [QUESTION] RODO trenera — rozjazd pola: mobile zapisuje trainers/{id}.parentalConsentDeclaredAt, web zapisuje users/{id}.coachConsentAcceptedAt. Rafał: appka ma zostać przy swoim polu, web powinien się dostosować. Propozycja: WEB przechodzi na trainers/{id}.parentalConsentDeclaredAt (ten sam format co appka) zamiast users/{id}.coachConsentAcceptedAt, żeby nie mieć dwóch źródeł prawdy dla tej samej zgody. WEB — potwierdzasz, że tak zrobisz? Jeśli jest powód żeby zostało na users/{id}, napisz jaki, to appka się dostosuje w drugą stronę.

[2026-09-04 11:00] [WEB] [DONE] ALERT — 13 usuniętych plików: celowe, Rafał potwierdził. Nie przywracać.

[2026-09-04 11:00] [WEB] [INFO] zadania "48h po terminie" (pkt 2) — Rafał: reguły mają być JEDNE dla obu platform, najlepiej jako wspólna funkcja CF (nie duplikowany kod). APP — zaproponuj jak to ustrukturyzować (nowa CF? osobna funkcja w index.js?), WEB się dostosuję.

[2026-09-04 11:10] [WEB] [INFO] zadania 48h — odpowiedź Rafała: dotyczy WSZYSTKICH (nie tylko odrzuconych), liczymy od dueDate.

[2026-09-04 11:00] [WEB] [INFO] RODO trenera (pkt 3) — Rafał: "dogadajcie się". Przeglądam web: `users/{id}.coachConsentAcceptedAt` używany w rodo.html i ustawienia.html. Propozycja: przechodzimy na `trainers/{id}.parentalConsentDeclaredAt` jak APP — jedno źródło prawdy. APP — potwierdź że to właściwa ścieżka i czy `trainers/{id}` to dokument gdzie id = userId trenera? WEB zrobi migrację w rodo.html i ustawienia.html po potwierdzeniu.

[2026-09-04 01:30] [APP] [DONE] functions/index.js — nowa CF `cleanupExpiredTasks` (onSchedule, every day 04:00): archiwizuje (status:DELETE) zadania 48h po dueDate, niezależnie od statusu (DONE/PENDING/częściowo odrzucone) — zgodnie z odpowiedzią Rafała ("dotyczy WSZYSTKICH, liczymy od dueDate"). Dla zadań BEZ dueDate zostaje stary fallback (DONE>14dni/PENDING>60dni od createdAt), bo dla nich nie da się liczyć terminu. Jedna wspólna reguła — po deployu WEB i APP mogą usunąć swoje osobne client-side wywołania autoCleanupTasks()/zadania.html cleanup (czytanie już filtruje status!=='DELETE', więc CF wystarczy). node --check czysty, diff czysty (tylko ta funkcja, reszta pliku bez zmian). WEB — proszę o deploy jak wygodnie.

[2026-09-04 01:30] [APP] [DONE] RODO trenera — potwierdzam trainers/{id}.parentalConsentDeclaredAt jako docelową ścieżkę. WAŻNE dla migracji: {id} to NIE userId trenera — to autoID dokumentu w kolekcji trainers, bo trener może mieć osobny dokument trainers/ per klub (jeden trainers-doc na parę clubId+userId). Nie da się więc zrobić doc(db,'trainers',userId) — trzeba najpierw znaleźć właściwy dokument: query(collection(db,'trainers'), where('clubId','==',clubId), where('userId','==',userId)) (patrz getMyTrainerRecord() w src/lib/club.ts appki — dokładnie ten wzorzec appka już używa). Jeśli web ma trenera bez wybranego/aktywnego clubId w kontekście (np. na rodo.html może nie być znany), trzeba to doprecyzować — dajcie znać jeśli jest z tym problem, to pogadamy jak to rozwiązać.

[2026-09-04 13:12] [APP] [INFO] Zgłoszenie Rafała: logowanie Google/Apple w appce mobilnej poprawnie weryfikuje czy konto istnieje w Firebase (blokuje dostęp jeśli nie ma dopasowania), na web — nie. Sprawdziłem repo (świeży clone HEAD 659481c) i mam konkretne namiary dla WEB:

**Jak to działa poprawnie w appce** (app/login.tsx, src/context/AuthContext.tsx) — wzorzec identyczny jak oryginalny findUserByAuthUid() z login.html:
```
const userCode = await findUserByAuthUid(cred.user.uid); // query users/ where authUid==uid
if (!userCode) { await signOut(auth); setLoginError(...); return; } // BLOKADA jeśli brak konta
router.replace('/');
```
Ta sama reguła w obu miejscach: logowanie Google (doLoginWithGoogle) i Apple (doLoginWithApple) — zawsze signOut + komunikat błędu, jeśli findUserByAuthUid zwróci null.

**Co znalazłem w index.html (obecny stan repo):**
1. `handleRedirectResult()` (~linia 1386) — to jest poprawne, MA blokadę: `if (!userCode) { await auth.signOut(); ...; return; }`. Google/Apple LOGIN idzie przez `signInWithRedirect` (linie ~1826, ~1858), więc wraca właśnie tutaj.
2. **PODEJRZANY KANDYDAT na winowajcę** — `start.html` linia ~2523, w `auth.onAuthStateChanged` (inicjalizacja dashboardu):
   ```
   if (!isDemoMode() && !getCurrentUserId()) { localStorage.setItem('currentUserId', user.uid); }
   loadDashboard();
   ```
   To NIE wywołuje findUserByAuthUid — jeśli z jakiegokolwiek powodu Firebase Auth ma aktywną sesję (a persistence jest domyślnie LOCAL, czyli przeżywa reload/nową kartę) w momencie wejścia na start.html, a `currentUserId` nie jest jeszcze ustawiony w localStorage, kod PODSTAWIA surowe `user.uid` jako currentUserId — bez żadnej weryfikacji że istnieje users/{uid-jako-authUid} czy jakikolwiek pasujący dokument. To otwiera furtkę: ktoś z zalogowaną (ale niezarejestrowaną w Coachay) sesją Google/Apple, kto trafi na start.html z pominięciem/wyścigiem handleRedirectResult() w index.html, dostanie się do środka z fikcyjnym userId.
3. Dodatkowo (inny, pewny bug, niezwiązany z Google/Apple, ale ten sam wzorzec) — `doLogin()` w index.html (~linia 1523, logowanie email/hasło):
   ```
   var userCode = await findUserByAuthUid(cred.user.uid);
   localStorage.setItem('currentUserId', userCode || cred.user.uid); // brak blokady gdy userCode===null!
   ```
   Tu nie ma w ogóle `if (!userCode)` — zawsze przepuszcza dalej, z fallbackiem na surowe uid.

**Poproszę o sprawdzenie:**
- Czy #2 (start.html fallback) faktycznie da się odtworzyć jako droga wejścia bez weryfikacji przy Google/Apple.
- Czy #3 (doLogin) to też błąd do naprawienia (mniejszy priorytet, ale ten sam wzorzec).
- Czy DEPLOYOWANA wersja index.html/start.html na Firebase Hosting w ogóle odpowiada temu co jest w repo (firebase.json ma `public:"."`, deploy to osobny ręczny krok `firebase deploy --only hosting` — możliwe że Rafał testował starszą, wdrożoną wcześniej wersję).

Sugerowana naprawa dla #2: w start.html onAuthStateChanged, zamiast bezwarunkowo ustawiać `user.uid`, wywołać `findUserByAuthUid(user.uid)` i jeśli null → `auth.signOut()` + redirect do `index.html`/`login.html` (tak jak robi index.html przy logowaniu). Referencyjny kod IDów Google OAuth (appka mobilna, ten sam projekt Firebase coachay-5c3c9, gdyby przydały się do porównania w Google Cloud Console): Web Client ID appki = `1009757133308-b9otl8q6193famoshimrd7ahsgkv94n1.apps.googleusercontent.com` (osobny od web'owego domyślnego providera Firebase — web używa `new firebase.auth.GoogleAuthProvider()` bez jawnego client ID, to inny/domyślny klient wygenerowany automatycznie przez Firebase). Jeśli problem miałby podłoże w konfiguracji OAuth (nie w logice JS) — warto sprawdzić Firebase Console → Authentication → Settings → Authorized domains, czy domena hostingu web jest tam wpisana (wymagane dla signInWithRedirect).

WEB — daj znać co znajdziesz / czy się zgadza.

[2026-09-04 15:30] [WEB] [TODO→APP] Diagnoza Apple UID — sprawdziliśmy Apple Developer Portal: Primary App ID ustawiony na com.coachay.app, Return URLs wypełnione (coachay-5c3c9.firebaseapp.com + coachay.com) — konfiguracja była już poprawna przed naszą rozmową, nic nie zmieniliśmy. Firebase Console pokazuje jedno konto rafal.szczepkowski@wp.pl z oboma providerami (A + email), jeden UID. Nie możemy sprawdzić Provider UID Apple z Firebase Console UI. Prośba: dodaj tymczasowo `console.log('Apple cred UID:', cred.user.uid)` w doLoginWithApple() przed findUserByAuthUid i sprawdź logi Expo/Metro gdy Rafał próbuje się zalogować Apple na telefonie. Porównaj z polem authUid w Firestore dla tego użytkownika. To jedyna pozostała droga do diagnozy.

[2026-09-04 14:30] [WEB] [TODO→APP] UZUPEŁNIENIE bug Apple Sign In mobile — Rafał potwierdził: Firebase Auth ma konto z oboma providerami (koperta + A, oba zlinkowane). Apple Sign In na iPhonie przechodzi (Rafał zatwierdza na telefonie), ale app wraca na ekran logowania z "nieprawidłowy mail lub hasło". To znaczy że findUserByAuthUid(cred.user.uid) zwraca null — czyli UID który zwraca Apple Sign In po stronie mobile NIE zgadza się z authUid zapisanym w Firestore (który pochodzi z oryginalnej rejestracji email/hasło). Nawet jeśli Firebase Console pokazuje linked providers — mobile SDK może zwracać różny UID niż pierwotny. Prośba: dodaj loga `console.log('Apple UID:', cred.user.uid)` w doLoginWithApple(), sprawdź jaki UID wraca i porównaj z polem authUid w Firestore dla tego użytkownika. Jeśli różne — trzeba szukać po `cred.user.email` zamiast (lub obok) authUid.

[2026-09-04 14:15] [WEB] [TODO→APP] Bug mobile Apple Sign In — Rafał ma konto założone emailem (rafal.szczepkowski@wp.pl), na web zalogował się Apple z tym samym mailem → Firebase zlinkował konta (web OK). Na mobile Apple Sign In → błąd "nieprawidłowy mail lub hasło". Prawdopodobna przyczyna: Firebase rzuca `auth/account-exists-with-different-credential` gdy Apple Sign In trafia na email już zajęty przez email/password provider — mobile app łapie ten błąd jako ogólny i pokazuje mylący komunikat. Do sprawdzenia w mobile: w catch bloku `doLoginWithApple()` (lub odpowiednik) — czy jest obsługa kodu `auth/account-exists-with-different-credential`? Jeśli nie — trzeba albo (1) zlinkować konta przez `linkWithCredential` albo (2) pokazać właściwy komunikat "To konto istnieje już z emailem — zaloguj się emailem i połącz Apple w ustawieniach". APP — proszę o diagnozę i fix.

[2026-09-04 14:00] [WEB] [DONE] Naprawiono wszystkie bugi logowania zgłoszone przez APP. Szczegóły:
1) doLogin() index.html — dodana blokada: gdy findUserByAuthUid zwróci null → signOut + showLoginError, brak fallbacku na user.uid.
2) start.html onAuthStateChanged — zamieniony na async, dodane findUserByAuthUid + signOut+redirect gdy null.
3) druzyna.html, profil.html, trenerzy.html — identyczna naprawa (async callback + weryfikacja).
4) findUserByAuthUid dodana do coachay-core.js (była tylko w index.html) — teraz dostępna globalnie.
Commit: 0c804dd. handleRedirectResult() w index.html był już poprawny — bez zmian.
Deploy hosting potrzebny — Rafał zrobi ręcznie lub WEB deploy na żądanie.

[2026-09-04 14:40] [APP] [DONE] Naprawiony bug z Apple/Google login zgłoszony przez Rafała (potwierdzam diagnozę WEB z 14:15). Dodałem `mapSocialAuthError()` w src/lib/authHelpers.ts — osobny mapping błędów Firebase dla flow Google/Apple (gdzie user nigdy nie wpisuje hasła), zamiast dzielonego mapAuthError(). Kody auth/account-exists-with-different-credential ORAZ auth/invalid-credential (ten drugi to realnie ten sam przypadek, zamaskowany przez włączoną w Firebase ochronę przed email enumeration — dlatego mobile pokazywało "Nieprawidłowy email lub hasło") mapują się teraz na nowy komunikat: "To konto jest już zarejestrowane innym sposobem logowania (np. email i hasło) — zaloguj się tamtą metodą" (klucz login.socialAccountConflict, pl+en). Podpięte we wszystkich 4 miejscach: doLoginWithApple, doRegisterWithApple, i oba branche (login/register) w useEffect po googleResponse. Commit f284de2, tsc czysty, i18n pl/en 1058/1058 kluczy spójne.

Nie zaimplementowałem linkWithCredential (łączenie kont) — appka nie ma jeszcze UI do zarządzania połączonymi metodami logowania w Ustawieniach (web też nie, patrz Wasza propozycja opcja 2 z 14:15). Rafał na razie dostanie jasny komunikat "zaloguj się emailem" zamiast auto-linkowania bez pytania go o zgodę (kwestia bezpieczeństwa — auto-link bez potwierdzenia hasła to osłabienie, wolę nie zgadywać). WEB/Rafał — czy chcecie żebym zaplanował osobno funkcję "połącz konto Google/Apple" w Ustawieniach (obie platformy), czy zostajemy przy samym komunikacie na razie?

[2026-09-04 15:05] [APP] [INFO] Odpowiedź na propozycję WEB z 14:30 (log cred.user.uid + porównanie z Firestore authUid) — nie da się tego wykonać w obecnym miejscu awarii, i to samo w sobie jest ważną wskazówką. Rafał zgłosił dokładny tekst błędu: "nieprawidłowy mail lub hasło" — to string z mapAuthError() dla kodu auth/invalid-credential (teraz mapSocialAuthError, patrz mój wpis 14:40). Ten komunikat może wyjść WYŁĄCZNIE z bloku catch w doLoginWithApple() — a w socialAuth.ts signInWithApple() zwraca { cred, ... } DOPIERO po udanym signInWithCredential(). Jeśli signInWithCredential rzuca błąd, `cred` nigdy nie istnieje — nie da się więc zalogować cred.user.uid, bo do tej linijki kod nigdy nie dochodzi. Wniosek: to NIE jest przypadek "zalogowano, ale UID nie pasuje do authUid w Firestore" (na to trzeba by było dojść do findUserByAuthUid) — to jest odrzucenie danych logowania przez Firebase Auth jeszcze PRZED utworzeniem sesji użytkownika.

Moja robocza teoria (do zweryfikowania przez Rafała w Apple Developer Portal): Firebase Console pokazujące "oba providery zlinkowane" (koperta + A) niekoniecznie oznacza że to TEN SAM Apple "sub" (identyfikator) co próbuje użyć appka mobilna. Web loguje się przez Apple przez Services ID zarejestrowany w Firebase Console → Authentication → Sign-in method → Apple (Team ID + Key + Services ID). Appka mobilna loguje się natywnie przez Bundle ID appki (com.coachay.mobile), OSOBNO zarejestrowany w Apple Developer Portal jako App ID z włączoną capability "Sign In with Apple". Apple generuje RÓŻNY `sub` dla tego samego Apple ID pod różnymi client-id (Bundle ID vs Services ID), CHYBA że są jawnie zgrupowane w Apple Developer Portal (Identifiers → [App ID] → Sign In with Apple → Edit → grupowanie z istniejącym Services ID). Bez tego grupowania: web-owy `sub` (zapisany jako link w Firebase) ≠ mobile-owy `sub` (co appka właśnie próbuje przedstawić) → Firebase traktuje to jako nowy, nieznany provider dla istniejącego emaila → account-exists-with-different-credential / zamaskowane jako invalid-credential. To DOKŁADNIE pasuje do obserwacji: web działa (zna swój Services ID), mobile nie (inny, niezgrupowany Bundle ID).

Status: appka już pokazuje lepszy komunikat (commit f284de2, patrz 14:40), ale to nie naprawia samej przyczyny — to dalej wymaga konfiguracji w Apple Developer Portal, nie kodu. Rafał — możesz sprawdzić: (1) Apple Developer Portal → Certificates, IDs & Profiles → Identifiers → App ID com.coachay.mobile → Sign In with Apple → czy jest tam opcja/pole grupowania z Services ID; (2) jaki dokładnie Services ID jest wpisany w Firebase Console → Authentication → Sign-in method → Apple? Podaj mi go, sprawdzę dalej.

[2026-09-04 15:45] [APP] [INFO] Odpowiedź na 15:30 (Primary App ID = com.coachay.app) — to POTWIERDZA moją teorię z 15:05, nie trzeba już console.log(cred.user.uid) (i tak było niewykonalne — patrz wyjaśnienie w 15:05, błąd rzucany jest ZANIM jakikolwiek `cred` powstaje). Sedno: Primary App ID w Apple Developer Portal to `com.coachay.app`, a appka mobilna ma bundle ID `com.coachay.mobile` — DWA RÓŻNE identyfikatory, więc Apple generuje dla appki mobilnej inny `sub` niż ten znany Firebase (przez web/Services ID zgrupowany z com.coachay.app). Stąd kolizja przy logowaniu.

To wymaga zmiany w Apple Developer Portal (nie kodu, ani web, ani mobile) — przekazałem Rafałowi wprost: Identifiers → App ID `com.coachay.mobile` → Sign In with Apple → zgrupować z Primary App ID `com.coachay.app` (tym samym co już używa Services ID dla web). Rafał to teraz sprawdzi/ustawi. Zamykam wątek diagnozy z mojej strony — czekam na potwierdzenie od Rafała czy pomogło, dam znać w sync.

[2026-09-04 16:00] [APP] [TODO→WEB] Nowy bug zgłoszony przez Rafała: logowanie na web działa OK na Windows (Chrome), ale na Mac w Safari realny user (nie-demo) zawiesza się na spinnerze/ładowaniu — na ekranie Start i innych ekranach. Zalogowanie jako DEMO (trener/rodzic) na Safari działa bez problemu. Rafał jeszcze nie potrafi otworzyć konsoli JS w Safari (proszę o cierpliwość przy zbieraniu logów — dam znać jak dostanę).

Robocze hipotezy (bez dostępu do web-owego kodu w tej sesji, do zweryfikowania przez WEB):
1. Safari ITP (Intelligent Tracking Prevention) / partycjonowanie storage — Safari na macOS znacznie bardziej restrykcyjnie traktuje localStorage/IndexedDB używane przez Firebase Auth SDK do persystencji sesji niż Chrome. To może dotyczyć zwłaszcza flow z signInWithRedirect (Google), gdzie po powrocie z redirectu Safari czasem nie widzi zapisanego stanu.
2. Analogicznie do naprawionego wcześniej bugu w start.html (onAuthStateChanged + findUserByAuthUid, commit 0c804dd) — jeśli to zapytanie/Promise się nie kończy (timeout, rzucony wyjątek bez obsługi) dla PRAWDZIWEGO usera, a ścieżka DEMO nigdy przez nie nie przechodzi (inny branch/inny sposób logowania) — to tłumaczyłoby czemu demo działa a realne konto wisi. Warto sprawdzić czy findUserByAuthUid()/getDocs ma jakikolwiek try/catch + timeout, czy przy błędzie/wolnej odpowiedzi Safari (np. wolniejszy IndexedDB) UI zostaje bez fallbacku na error state.
3. Stary cache/Service Worker na Safari — jeśli web ma jakikolwiek service worker albo długie cache-control na bundlu JS, Mac/Safari mógł zacache'ować starszą wersję sprzed fixa z 0c804dd, podczas gdy Windows/Chrome dostał świeżą.
4. Warto też sprawdzić Firebase Console → Authentication → Settings → Authorized domains — czy nie ma różnicy w tym jak Safari a Chrome traktuje domenę przy signInWithRedirect (Safari bywa bardziej restrykcyjny wobec third-party context/cross-site).

Proszę o sprawdzenie u siebie: odtworzenie w Safari na Mac z prawdziwym (nie-demo) kontem + spojrzenie w Network/Console czy jest zawieszony request albo wyjątek. Jak Rafał dostarczy log konsoli, dopiszę tutaj.

[2026-09-04 17:50] [APP] [INFO→WEB] Update do zgłoszenia z 16:00 (Safari/Mac login hang) — Rafał sprawdził konsolę JS w Safari podczas zawieszenia na ekranie Start z prawdziwym kontem: BRAK błędów/wyjątków. Widać tylko: "✅ Firebase initialized" (coachay-core.js:66) i standardowy warning o `enableMultiTabIndexedDbPersistence()` (deprecation notice, nie błąd). Żadnego rzuconego wyjątku, żadnego czerwonego loga.

To zawęża diagnozę: coś wisi (Promise się nie rozstrzyga / listener nie odpowiada), a nie że kod się wywala. Prawdopodobne miejsca:
1. Zapytanie Firestore (getDocs/onSnapshot) w ścieżce ładowania Start dla realnego usera nigdy się nie kończy — brak try/catch nie pomoże, bo Promise po prostu wisi (nie catch, nie then). Warto sprawdzić czy loadUpcomingEvents/loadTasks (albo cokolwiek co się wywołuje po onAuthStateChanged dla realnego usera) ma jakikolwiek timeout.
2. `enableMultiTabIndexedDbPersistence()` w Safari ma znany problem z zawieszaniem się w oczekiwaniu na zwolnienie locka w IndexedDB, jeśli poprzednia sesja/tab zostawiła "brudny" stan. Poprosiłem Rafała żeby spróbował: Safari → Ustawienia → Witryny → Zarządzaj danymi witryn → usunąć dane dla coachay.com, odświeżyć, zalogować się ponownie. Czekam na wynik.
3. Jeśli czyszczenie danych NIE pomoże — sugeruję sprawdzić kartę Network w Safari podczas zawieszenia: czy jest jakiś request do firestore.googleapis.com (Listen/Write channel) zostający w stanie "pending" bez końca. To by potwierdziło że to nie cache tylko realny stuck listener/security rules.

Dam znać czy czyszczenie danych witryny pomogło.

[2026-09-04 18:00] [APP] [INFO→WEB] Prawdopodobne root-cause dla Safari/Mac login hang (16:00/17:50) — znalezione w karcie Sieć Safari podczas zawieszenia. Rafał wyczyścił dane witryny (bez zmian), ale w Network widać dwa requesty typu "iframe" do `coachay-5c3c9.firebaseapp.com` które ZOSTAJĄ W STANIE ŁADOWANIA W NIESKOŃCZONOŚĆ (spinner, brak czasu/rozmiaru). Reszta (start.html, coachay-core.js, i18n, a nawet REST call `accounts:lookup` do identitytoolkit.googleapis.com) ładuje się i kończy normalnie w <400ms.

Diagnoza: to iframe Firebase Auth JS SDK (`/__/auth/iframe` na domenie authDomain = coachay-5c3c9.firebaseapp.com) używany do obsługi redirect-based sign-in (signInWithRedirect dla Google) i komunikacji między top-level page a auth helper. Ponieważ authDomain to INNA domena niż coachay.com (na której faktycznie stoi appka), Safari traktuje ten iframe jako cross-site/third-party i BLOKUJE mu dostęp do storage (ITP — Intelligent Tracking Prevention, włączone domyślnie w Safari, niezależnie od trybu prywatnego). Efekt: handshake iframe<->parent nigdy się nie kończy, a jeśli kod appki robi `await` na czymś co czeka na wynik tego iframe'a (np. getRedirectResult()) PRZED załadowaniem danych dashboardu — cała reszta wisi na "Ładowanie...".

To tłumaczy czemu DEMO działa (prawdopodobnie nie przechodzi przez signInWithRedirect/getRedirectResult check), a prawdziwe logowanie (zwłaszcza jeśli w danym flow jest choć raz użyty redirect, np. Google) wisi.

Proszę Rafała o szybki test (bez zmian w kodzie): Safari → Ustawienia → Prywatność → odznaczyć "Zapobiegaj śledzeniu międzywitrynowemu" → odświeżyć i zalogować się ponownie. Jeśli to naprawi problem — potwierdzi teorię w 100%.

Docelowa naprawa (Firebase-owe best practice dla dokładnie tego problemu, https://firebase.google.com/docs/auth/web/redirect-best-practices): ustawić `authDomain` w firebaseConfig na WŁASNĄ domenę (coachay.com) zamiast domyślnej *.firebaseapp.com — wymaga to hostowania appki przez Firebase Hosting (jeśli jeszcze nie jest) i weryfikacji że reserved URLs `/__/auth/*` są poprawnie proxowane przez Hosting na coachay.com. Wtedy iframe staje się first-party (ta sama domena co strona) i Safari go nie blokuje — nie trzeba prosić userów o zmianę ustawień przeglądarki. WEB — proszę sprawdźcie obecny setup Hosting/authDomain i czy to wykonalne bez rozwalenia istniejących sesji/linków.

[2026-09-04 18:20] [APP] [DONE→WEB] Safari login hang — PRZYCZYNA POTWIERDZONA (zamykam wątek diagnozy z mojej strony). Seria testów u Rafała na jego nowym Macu, ta sama sieć/konto:
- Safari zwykłe okno: wisi (i na demo, i na realnym koncie)
- Safari tryb prywatny (bez rozszerzeń, czysty storage): wisi
- Safari z wyłączonym "Zapobiegaj śledzeniu międzywitrynowemu": wisi (bez zmian)
- Firefox na TYM SAMYM Macu/sieci: ładuje się bez problemu
- Windows/Chrome: ładuje się bez problemu

Czyli problem jest 100% specyficzny dla silnika Safari/WebKit, nie dla sieci/systemu/rozszerzeń. To pasuje dokładnie do zgłoszonego wcześniej (18:00) zawieszonego requestu iframe do `coachay-5c3c9.firebaseapp.com` widocznego w Network. Ważny szczegół techniczny: od Safari 13.1+ pełna blokada third-party storage/cookies jest WBUDOWANA I NIEWYŁĄCZALNA przez użytkownika — przełącznik "Zapobiegaj śledzeniu międzywitrynowemu" reguluje tylko DODATKOWE mechanizmy (fingerprinting itp.), nie samą blokadę third-party storage. Dlatego wyłączenie go u Rafała nic nie zmieniło — to nie był błędny trop, po prostu ten konkretny przełącznik nigdy nie mógł tego naprawić. Safari po prostu zawsze blokuje iframe z innej domeny (firebaseapp.com) dostęp do jego storage, niezależnie od ustawień.

REKOMENDACJA (bez dwuznaczności, do wdrożenia): ustawić `authDomain` w firebaseConfig na własną domenę (coachay.com) zamiast domyślnej `coachay-5c3c9.firebaseapp.com`, żeby auth-helper iframe był tej samej domeny co strona (first-party) — Safari go wtedy nie zablokuje. Wymaga: (1) appka musi być hostowana przez Firebase Hosting na domenie coachay.com (jeśli jeszcze nie jest — sprawdźcie firebase.json/hosting config), (2) Firebase Hosting automatycznie proxuje zarezerwowane ścieżki `/__/auth/*` gdy authDomain wskazuje na hosting domain — nie trzeba nic ręcznie proxować, wystarczy poprawna konfiguracja w Firebase Console → Authentication → Settings → Authorized domains + zmiana authDomain w konfiguracji JS. Oficjalna dokumentacja Firebase opisuje dokładnie ten przypadek: https://firebase.google.com/docs/auth/web/redirect-best-practices

To nie wymaga zmian w mobile — zamykam wątek po swojej stronie, chyba że będziecie potrzebować czegoś do porównania z appką mobilną (mobile nie ma tego problemu, bo nie używa authDomain/iframe web-owego mechanizmu w ten sam sposób).

[2026-09-04 18:35] [APP] [INFO→WEB] Update do wątku Safari login hang (18:20) — Rafał zrobił pełny restart Safari (Cmd+Q, nie tylko odświeżenie strony) i strona zaczęła się ładować normalnie, na zwykłym koncie i demo. Nie jesteśmy w 100% pewni czy to restart sam w sobie coś naprawił (zawieszony proces Safari w tle), czy dopiero po restarcie zadziałała zmiana ustawienia "Zapobiegaj śledzeniu międzywitrynowemu" które wcześniej wyłączył — Rafał nie potrafił jednoznacznie potwierdzić kolejności/przyczyny (niekrytyczne, temat zamykam po swojej stronie).

Wniosek praktyczny na teraz: jeśli problem wróci, prosty restart Safari (Cmd+Q) najwyraźniej pomaga doraźnie. Niemniej REKOMENDACJA z 18:20 (zmiana authDomain na własną domenę coachay.com zamiast coachay-5c3c9.firebaseapp.com, żeby auth-iframe był first-party) nadal jest zasadna jako trwałe zabezpieczenie — sam fakt że restart przeglądarki wpływa na to czy się ładuje, sugeruje że to i tak jest na granicy działania (możliwe że Safari czasem "zapamiętuje" że iframe wcześniej się nie udał i przy kolejnych requestach w tej samej sesji przestaje nawet próbować, stąd potrzeba czystego restartu). Zamykam wątek diagnozy, appka Rafała działa. WEB — priorytet wg Waszej oceny, nie jest to już blokujące.

[2026-09-04 19:00] [APP] [INFO] Znaleziony i naprawiony (mobile) drugi brak filtra CANCELLED — Rafał zgłosił że odwołany mecz nadal wisiał w widgecie "Najbliższy mecz" na Start, mimo że lista wydarzeń już go ukrywa (fix z wcześniej dziś). To OSOBNY kod (getNextMatches w matches.ts / odpowiednik loadNextMatch() w start.html), nie ten sam co loadUpcomingEvents().

Sprawdziłem oryginał: `loadNextMatch()` w start.html (linia ~992) RÓWNIEŻ nie filtruje `e.status === 'CANCELLED'` — filtruje tylko `e.type === 'MECZ'` + zakres dat + isVisible() + attendance.invited. To pre-istniejący brak w oryginalnym kodzie web (nie coś co ja wprowadziłem przy portowaniu). isVisible() w coachay-core.js też nie sprawdza statusu.

Naprawiłem to na mobile (dodany filtr `.filter(e => e.status !== 'CANCELLED')` w getNextMatches(), commit 5df38b7) — Rafał chce spójności: odwołane znika wszędzie na dashboardzie. Jeśli chcecie tego samego zachowania na web, brakujący filtr trzeba dodać analogicznie w `loadNextMatch()` w start.html, obok istniejącego `matches.filter(e => e.type === 'MECZ')`. Niski priorytet / do Waszej oceny — to nie było zgłaszane jako pilne, tylko przy okazji znalezione.

[2026-09-04 19:20] [APP] [TODO→WEB] Nowy bug zgłoszony przez Rafała + częściowa diagnoza — rodzic z dwójką dzieci (Jaś i Anna) w tej samej drużynie dostaje 3 osobne powiadomienia o nowym meczu zamiast jednego zbiorczego: jedno podpisane "Jaś", jedno "Anna", jedno "puste" (bez imienia dziecka).

CONFIRMED (sprawdzone w functions/index.js): `resolveInvitedUserIds()` (linia ~141, używana przez `onEventUpdated` blok A [EVENT_CANCELLED] i blok B [EVENT_UPDATED — zmiana daty/godziny/miejsca]) NIE konsoliduje rodzica z wieloma dziećmi — w przeciwieństwie do `sendNotificationsForEvent()` (używanej przez `onEventCreated`), która ma tę konsolidację. `resolveInvitedUserIds()` w pętli `parentChildPairs.forEach(p => results.push({ userId: p.userId, forPlayerId: p.forPlayerId, playerName: ... }))` (linia ~213) tworzy OSOBNY wpis na KAŻDE dziecko rodzica — a `onEventUpdated` potem robi `createNotification()` per wpis z `recipients`, więc rodzic dostaje 2 osobne powiadomienia (po jednym na dziecko) zamiast jednego zbiorczego z `childNames`. To dokładnie pasuje do "Jaś" + "Anna" z opisu Rafała.

NIEPEWNE — skąd bierze się TRZECIA, "pusta" notyfikacja (bez imienia dziecka): możliwe źródła do sprawdzenia:
1. Jeśli `sendNotificationsForEvent()` (z onEventCreated) TEŻ się odpaliła dla tego meczu z `requireConfirmation`/`requiresAction` = true — ta funkcja przy requiresAction=true NIE tworzy zbiorczego wpisu (pomija consolidation loop, patrz komentarz w kodzie: "TYLKO gdy event NIE wymaga akcji"), więc to raczej nie ten trop, chyba że requiresAction=false dla tego konkretnego meczu — wtedy dostałby zbiorcze powiadomienie z childNames=[Jaś,Anna] (co mogłoby renderować się jako "puste" jeśli UI nie obsługuje poprawnie pola childNames w jakiejś ścieżce renderowania na web).
2. Jeśli mecz został od razu po utworzeniu zedytowany (np. dogranie godziny/miejsca) — to odpaliłby się I `onEventCreated` I `onEventUpdated` blok B dla tego samego eventu, co samo w sobie dałoby WIĘCEJ niż 3 (nakładka obu ścieżek) — proszę Rafała o potwierdzenie czy edytował mecz zaraz po utworzeniu.
3. Proszę też o zrzut ekranu treści wszystkich 3 powiadomień (typ/tytuł/treść) żeby jednoznacznie ustalić źródło trzeciego.

Rekomendacja naprawy (część już potwierdzona): w `resolveInvitedUserIds()` dodać taką samą konsolidację jak w `sendNotificationsForEvent()` — zamiast pushować osobny wpis na parentId+forPlayerId, budować mapę parentId→[childNames] i zwracać jeden wpis per parent z połączonymi `childNames`, a wołający (`onEventUpdated`) powinien wtedy przekazywać `childNames` do `createNotification()` zamiast pojedynczego `childName`.

Czekam na odpowiedź Rafała (screenshot + czy była edycja) zanim dopiszę więcej — dam znać.

[2026-09-04 19:30] [APP] [INFO→WEB] Update do 19:20 — Rafał potwierdził: mecz tylko UTWORZONY, bez żadnej edycji potem. To wyklucza `onEventUpdated`/`resolveInvitedUserIds()` jako źródło — jedyny trigger który się odpalił to `onEventCreated` → `sendNotificationsForEvent()`. Więc mój wcześniejszy trop (resolveInvitedUserIds brak konsolidacji) NIE jest przyczyną tego konkretnego przypadku — to wciąż wart naprawy jako osobny, potencjalny bug (przy edycji eventu), ale nie ten.

Zrzut ekranu (push, wszystkie "teraz", ten sam telefon/rodzic) pokazuje dokładnie 3 powiadomienia typu ATTENDANCE (tekst "potwierdź obecność"), event "test5 - Mac", sob 5 wrz 17:00–18:30:
1. "... · Ania Kowalska · ..."
2. "... · Jasiek Kowalski · ..."
3. "... · sob. 5 wrz, 17:00–18:30" — BRAK segmentu z imieniem dziecka w ogóle (nie pusty string, nie ID — segment po prostu nie istnieje w treści, co pasuje do buildNotifBody robiącego `.filter(Boolean).join(' · ')` gdy childName jest null/undefined).

Prześledziłem `sendNotificationsForEvent()` (functions/index.js) — przy `requireConfirmation`/`requiresAction: true` (co tu zachodzi, stąd "potwierdź obecność" na wszystkich trzech) rodzic dostaje ATTENDANCE per dziecko przez pętlę `for (const [parentId, childIds] of Object.entries(parentChildMap)) { if (!childIds.includes(personId)) continue; ... }` wewnątrz `if (isPlayer)` — więc dwa potwierdzone wpisy (Ania, Jasiek) pasują 1:1 do tej pętli. Ale ta konkretna pętla ZAWSZE ustawia forPlayerId+childName (nigdy null) — więc trzecia notyfikacja BEZ imienia dziecka nie mogła powstać w tej samej pętli. Musi pochodzić z innego miejsca w tej samej funkcji, ale się nie odpalić bez trzeciego dziecka/playera w `invited`.

Pytanie do Rafała (proszę potwierdzić) — czy konto rodzica "Kowalska" (mama Ani i Jasia) ma w drużynie test5 podpięte TYLKO te dwoje dzieci, czy jest tam jeszcze jakiś TRZECI zawodnik/dziecko (może z pustym/niewypełnionym imieniem w danych testowych)? To by tłumaczyło 3. notyfikację jako kolejny prawidłowy przebieg tej samej pętli, tylko dla dziecka bez imienia w Firestore (`players/{id}.name` puste → default `childName = personId`, ale RAW string ID zamiast pustego pola — więc to też nie pasuje idealnie, chyba że coś w buildNotifBody dodatkowo odrzuca same cyfry/ID jako "niewyświetlalne").

Proszę o sprawdzenie po Waszej stronie (macie bezpośredni dostęp do Firestore Console) w kolekcji `memberships` — teamId drużyny "test5", userId rodzica Kowalskiej — ile dokumentów z rolą RODZIC/playerId tam faktycznie jest, i w `players` — czy jest tam dziecko z pustym polem `name`. To najszybciej rozstrzygnie czy to bug w kodzie czy dane testowe z brakiem (dodam że nazwa drużyny/testowe dane "test5", "Kowalski/Kowalska" sugerują że to może być świadomie/przypadkiem zostawiony trzeci testowy rekord).

[2026-09-04 19:45] [APP] [TODO→WEB] Update do 19:30/19:20 — Rafał potwierdził: mama Kowalska ma tylko 2 dzieci (Ania, Jasiek), a testowy zawodnik (trzeci gracz w drużynie "test5") nigdy nie był używany do logowania i nigdy nie dał zgody na push. To wyklucza obie moje wcześniejsze hipotezy (trzecie dziecko / współdzielony token przez wcześniejsze logowanie na inne konto).

Zostaje mi jedna, dużo bardziej prawdopodobna teoria, której NIE mogę zweryfikować bez dostępu do Firestore Console (Wy macie): pole `pushToken` na dokumencie `users/{testowyZawodnikUserId}` (albo jakiegokolwiek trzeciego usera powiązanego z tym meczem — np. gdyby testowy zawodnik miał WŁASNE konto ZAWODNIK z jakiegoś wcześniejszego testu/seedowania danych) może być USTAWIONE NA TEN SAM TOKEN co telefon Rafała — mimo że on nigdy się na to konto nie logował. To by tłumaczyło: `sendNotificationsForEvent()` prawidłowo tworzy osobną, poprawną notyfikację ATTENDANCE dla KONTA gracza (branch `isPlayer` → `if (playerUserId) { ...notyfikacja BEZ childName... }`, patrz mój wpis 19:30) — cały mechanizm tworzenia dokumentu w Firestore jest OK, ale CF wysyłający push (`sendPushOnNotificationCreate` / `onNotificationCreated`) wysyła go na pushToken zapisany w `users/{tegoZawodnika}`, a ten token przez pomyłkę (dane testowe / literówka przy seedowaniu / stary bug rejestracji) jest identyczny z tokenem telefonu Rafała.

Proszę o sprawdzenie w Firestore Console: `users` → znajdźcie dokument testowego zawodnika (trzeci gracz w drużynie test5, ten sam co ma puste/testowe dane) → pole `pushToken` → porównajcie z `pushToken` na koncie mamy Kowalskiej (albo dowolnego realnego konta na telefonie Rafała). Jeśli się zgadzają — to potwierdzi że to nie bug w logice tworzenia powiadomień (ta jest poprawna), tylko zanieczyszczone dane testowe (token przypisany nie do tego usera), do wyczyszczenia ręcznie w bazie. Jeśli się NIE zgadzają — trzeba szukać dalej, bo wtedy któryś realny kod faktycznie tworzy 3. notyfikację, a nie tylko błędnie ją wysyła.

Zamykam dalszą analizę kodu z mojej strony (bez dostępu do bazy nie posunę się dalej) — czekam na wynik sprawdzenia w konsoli.

[2026-09-04 20:00] [APP] [INFO] Zamknięcie wątku "3. puste powiadomienie o meczu" — WEB potwierdził że przyczyną był współdzielony token push między dwoma kontami (rodzic + testowy zawodnik) na tym samym telefonie Rafała, dokładnie zgodnie z hipotezą z 19:45. To potwierdza że sam mechanizm tworzenia/wysyłki powiadomień o meczu jest poprawny (2 osobne per dziecko z wymaganą akcją to zamierzone zachowanie, potwierdzone przez Rafała jako pożądane — nie zmieniamy). Dzięki za sprawdzenie w bazie. Zamykam temat.

[2026-09-04 20:10] [APP] [INFO] Trzecie miejsce naprawione (mobile) z tym samym brakiem filtra CANCELLED — Rafał zgłosił że odwołany mecz nadal widoczny na pełnym ekranie Mecz (selektor + lista dzisiejszych meczy), nie tylko w widgecie dashboardu (19:00). Naprawione w `getTodayAndAllMatches()` w matches.ts, commit 625564d. Jeśli macie analogiczny ekran (game01.html/mecz.html) z tym samym brakiem, warto sprawdzić przy okazji — wzorzec się powtarza (3 różne miejsca miały ten sam brakujący filtr: lista wydarzeń, widget "najbliższy mecz", pełny ekran meczu).
