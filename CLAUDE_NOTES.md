# CLAUDE_NOTES — Tricki i gotowe snippety
> Tylko rzeczy przetestowane i działające. Nie przepisuj — kopiuj.

## ✅ PostToolUse hook — weryfikacja zapisu pliku

Ustawiony raz na stałe w `~/.claude/settings.json` (globalny):
```json
"hooks": {
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | { read -r f; [ -f \"$f\" ] && [ -s \"$f\" ] && echo \"{\\\"systemMessage\\\": \\\"✓ Saved: $f\\\"}\" || echo \"{\\\"systemMessage\\\": \\\"⚠ WARNING: File not saved: $f\\\"}\"; } 2>/dev/null || true",
      "statusMessage": "Verifying file was saved..."
    }]
  }]
}
```
**Cel:** po każdym Write/Edit sprawdza czy plik istnieje i nie jest pusty. Wyświetla komunikat ✓ lub ⚠.

---

## ⚠️ Nie używaj Bash do operacji na plikach
Bash zawsze pyta użytkownika o pozwolenie. Zamiast tego:
- Sprawdzenie czy plik istnieje → `Glob`
- Szukanie tekstu w plikach → `Grep`
- Czytanie pliku → `Read`
- Listowanie plików → `Glob("**/*")`

---

## ✅ Uprawnienia do katalogu projektu
Ustawione raz na stałe w `C:\Users\rafal\.claude\settings.json`:
```json
{
  "permissions": {
    "additionalDirectories": ["C:\\Users\\rafal\\Documents\\Claude_AI\\Coachay"]
  }
}
```
**Trwałe — nie trzeba ustawiać w każdej sesji.**

---

## 🔥 Firebase — połączenie z bazą (REST API)

**Nie używaj** `firebase-admin` SDK — nie działa bez service account.
**Używaj** Firestore REST API z tokenem z Firebase CLI:

```javascript
const fs = require('fs');
const https = require('https');

const cfg          = JSON.parse(fs.readFileSync('C:/Users/rafal/.config/configstore/firebase-tools.json'));
const ACCESS_TOKEN = cfg.tokens.access_token;
const PROJECT      = 'coachay-5c3c9';
const BASE         = `/v1/projects/${PROJECT}/databases/(default)/documents`;

function httpsRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'firestore.googleapis.com', path, method,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
        }, res => {
            let d = ''; res.on('data', x => d += x);
            res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, body: d }); } });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}
```

⚠️ **Token wygasa po ~1h.** Przy błędzie 401 uruchom w terminalu:
```bash
firebase login
# lub
firebase use coachay-5c3c9
```
Pełny działający skrypt: `scripts/create-memberships.js`

---

## 🔥 Firebase — konwersja typów (JS ↔ Firestore REST)

Firestore REST API nie przyjmuje plain JSON — wymaga opakowywania wartości:

```javascript
function toValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean')        return { booleanValue: v };
    if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return { timestampValue: v };
        return { stringValue: v };
    }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
    if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
    return { stringValue: String(v) };
}
function toFields(obj) { const f = {}; for (const [k,v] of Object.entries(obj)) f[k] = toValue(v); return f; }

function fromValue(v) {
    if (!v) return null;
    if ('nullValue'      in v) return null;
    if ('booleanValue'   in v) return v.booleanValue;
    if ('integerValue'   in v) return Number(v.integerValue);
    if ('doubleValue'    in v) return v.doubleValue;
    if ('stringValue'    in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue'       in v) return fromFields(v.mapValue.fields || {});
    return null;
}
function fromFields(fields) { const o = {}; for (const [k,v] of Object.entries(fields)) o[k] = fromValue(v); return o; }
function docToObj(doc) { return { id: doc.name.split('/').pop(), ...fromFields(doc.fields || {}) }; }
```

---

## 🔥 Firebase — batch write i listAll (REST)

```javascript
// Pobierz wszystkie dokumenty z kolekcji (z paginacją)
async function listAll(collection) {
    const items = []; let pt = null;
    do {
        const res = await httpsRequest('GET', `${BASE}/${collection}?pageSize=300${pt ? '&pageToken='+pt : ''}`);
        (res.body.documents || []).forEach(d => items.push(docToObj(d)));
        pt = res.body.nextPageToken || null;
    } while (pt);
    return items;
}

// Batch write — do 500 dokumentów na raz
async function batchWrite(writes) {
    const res = await httpsRequest('POST',
        `/v1/projects/${PROJECT}/databases/(default)/documents:batchWrite`,
        { writes }
    );
    if (res.body.error) throw new Error(res.body.error.message);
}

// Format pojedynczego zapisu
function makeWrite(collection, id, data) {
    return { update: { name: `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`, fields: toFields(data) } };
}

// Aktualizacja jednego pola (PATCH)
async function patchField(collection, id, fieldName, value) {
    const path = `${BASE}/${collection}/${id}?updateMask.fieldPaths=${fieldName}`;
    return httpsRequest('PATCH', path, { fields: { [fieldName]: toValue(value) } });
}

// Usuń dokument
async function deleteDoc(collection, id) {
    return httpsRequest('DELETE', `${BASE}/${collection}/${id}`);
}
```

---

## 🔥 Firebase — deploy

```bash
cd "C:\Users\rafal\Documents\Claude_AI\Coachay"
firebase deploy --only hosting
```
URL: `https://coachay-5c3c9.web.app`

---

## 🔥 Firebase — lista wszystkich kolekcji

```javascript
const res = await httpsRequest('POST',
    `/v1/projects/${PROJECT}/databases/(default)/documents:listCollectionIds`, {}
);
console.log(res.body.collectionIds);
```

---

## 🔥 Firebase — logi Cloud Functions z właściwym projektem

Firebase CLI łapie domyślny projekt z `.firebaserc` w bieżącym katalogu — jeśli terminal jest w innym repo (np. Nexwise), `firebase functions:log`/`firebase deploy` uderzy w **zły projekt** bez ostrzeżenia. Zawsze jawnie:

```bash
cd "C:\Users\rafal\Documents\Claude_AI\Coachay"
firebase functions:log --only <nazwaFunkcji> -n 30 --project coachay-5c3c9
```

---

## 📱 Android — rejestracja appki i google-services.json (bez klikania w konsoli)

```bash
cd "C:\Users\rafal\Documents\Claude_AI\Coachay"
firebase apps:create ANDROID "Nazwa appki" -a com.pakiet.nazwa
# zwraca App ID, np. 1:1009757133308:android:fe95d1e59c216521f67a79

firebase apps:sdkconfig ANDROID <APP_ID> --out android/app/google-services.json
```
Gradle w szablonie Capacitor już warunkowo aplikuje plugin `google-services` jeśli plik istnieje (`android/app/build.gradle`) — nic więcej nie trzeba ręcznie configurować.

---

## 📱 Android — gradlew wymaga JAVA_HOME, Android Studio ma własną Javę

Nie trzeba instalować osobnego JDK — Android Studio ma wbudowaną (JBR):
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug
```
Ustawienie na stałe (`[Environment]::SetEnvironmentVariable(...)`) wymaga **nowego okna terminala** żeby się załapać — nie działa w already-open oknie.

---

## 📱 Android emulator — pułapki

- **Strefa czasowa bywa GMT zamiast lokalnej** na świeżym AVD, co przy północy daje błędną datę o dzień wstecz:
  ```bash
  adb shell service call alarm 3 s16 Europe/Warsaw
  ```
- **Ścieżki ze spacją w `adb shell run-as ... ls "..."`** — Git Bash konwertuje `/data/...` na Windows path. Trzeba:
  ```bash
  MSYS2_ARG_CONV_EXCL="*" adb shell "run-as com.pakiet ls -la '/data/data/com.pakiet/sciezka z spacja/'"
  ```
- **`adb shell am force-stop` + `am start` wklejone razem jako jeden blok** trafiają do historii terminala jako JEDNA pozycja — strzałka w górę odpala oba na raz, co wygląda jak "appka sama się uruchamia z powrotem"
- **`window.confirm()`/`alert()`/`prompt()` nie działają domyślnie w Android WebView** (Capacitor) — brak natywnej obsługi dialogów JS, w przeciwieństwie do pełnej przeglądarki. Trzeba własny modal (Promise-based) zamiast polegać na natywnym confirm()
- **Blob download (`<a download>` + `URL.createObjectURL`) może nie działać w WebView** — znany, nieprzetestowany dotąd problem (blob: URL nie zawsze obsługiwany przez WebView bez dodatkowego kodu natywnego)

---

## ⚠️ ZASADA — nie olewaj dziwnych znaków, nawet w komentarzach

2026-07-24: przy pierwszym dotknięciu `functions/index.js` w tej sesji zauważyłem
zniekształcone znaki (np. "âââ" w komentarzach) i **uznałem to za kosmetykę bez
znaczenia** ("pewnie tylko tak plik był zapisany, nie wpływa na działanie"). To było
błędne założenie — te same zniekształcenia były też w realnych stringach wysyłanych
do userów (tytuły powiadomień pokazywały się jako "potwierdÅº obecnoÅÄ"). Problem
wypłynął dopiero gdy user zobaczył krzaczki w appce, mimo że sygnał był widoczny
od początku.

**Zasada na przyszłość:** jeśli przy odczycie/edycji dowolnego pliku w tym projekcie
zobaczysz podejrzane znaki (Ã, Â, Å, Ä, â w miejscach gdzie nie powinno ich być,
zwłaszcza obok polskich liter) — **zawsze sprawdź od razu**, nie odkładaj:
1. `node --check plik.js` (czy to w ogóle wpływa na runtime, czy tylko komentarz)
2. Szybki skan: `node -e "const t=require('fs').readFileSync('plik','utf8'); t.split('\n').forEach((l,i)=>{if(/[ÃÂÅÄâãÐ]/.test(l))console.log(i+1,l)})"`
3. Jeśli cokolwiek z tego dotyczy stringów które trafiają do usera (tytuły, treści,
   powiadomienia, UI) — napraw od razu tą samą sesją, technika niżej w tym pliku.
   "To pewnie nieistotne" nie jest wystarczającym powodem żeby to zignorować.

**Jak to się mogło pierwotnie zdarzyć (żeby nie powtórzyć):** prawdopodobny winowajca
to zapis pliku przez PowerShell `Set-Content`/`Add-Content`/`Out-File` **bez**
`-Encoding utf8` — te cmdlety domyślnie używają systemowego kodowania ANSI, nie UTF-8,
więc polskie znaki zapisane w ten sposób psują się przy każdym kolejnym odczycie pliku
jako UTF-8 (co robi zarówno Node.js jak i przeglądarka). Zasada: **przy zapisie do
plików tego projektu przez PowerShell zawsze dodawaj `-Encoding utf8`**; jeszcze
lepiej — używaj do tego narzędzi Write/Edit zamiast PowerShell/Bash heredoc, bo to
eliminuje ten cały problem u źródła.

---

## 🔤 Naprawa mojibake (podwójne kodowanie UTF-8 przez Latin-1)

Objaw: polskie znaki w kodzie/danych wyglądają jak "potwierdÅº obecnoÅÄ" zamiast
"potwierdź obecność". Przyczyna: plik źródłowy ma na dysku bajty, które powstały
z potraktowania oryginalnego UTF-8 jako Latin-1 i ponownego zapisania jako UTF-8
(każdy oryginalny bajt → osobny 2-bajtowy znak UTF-8). Zwykłe dopasowanie stringów
(Edit tool) **nie działa** na takim pliku — trzeba naprawiać na poziomie bajtów:

```javascript
const fs = require('fs');
const buf = fs.readFileSync('plik.js');
let latin1 = buf.toString('latin1'); // 1 bajt = 1 znak, bezstratne

// Wzorce znalezione empirycznie (sprawdź hex konkretnego przypadku, mogą się różnić):
const fixes = [
  ['c382c2b7', '·'], ['c3a2c280c293', '–'], ['c3a2c280c294', '—'],
  ['c385c2ba', 'ź'], ['c385c29b', 'ś'], ['c384c287', 'ć'],
  ['c385c282', 'ł'], ['c385c284', 'ń'], ['c385c2bc', 'ż'],
  ['c383c2b3', 'ó'], ['c384c285', 'ą'], ['c384c299', 'ę'],
  ['c3a2c294c280', '─'], ['c3a2c295c290', '═'], ['c3a2c286c292', '→'],
];
fixes.forEach(([hex, repl]) => {
    const oldStr = Buffer.from(hex, 'hex').toString('latin1');
    const newStr = Buffer.from(repl, 'utf8').toString('latin1');
    latin1 = latin1.split(oldStr).join(newStr);
});
fs.writeFileSync('plik.js', Buffer.from(latin1, 'latin1'));
```

Weryfikacja: `node --check plik.js` (składnia) + ponowny skan `/[ÃÂÅÄâãÐ]/` na liniach z polskimi literami. Dla danych już zapisanych w Firestore (np. treść powiadomień) — string zwrócony przez REST API jest już poprawnym JS stringiem, więc naprawa inna: `[...str].map(c => c.codePointAt(0))` da oryginalne bajty (bo Latin1 code point == wartość bajtu), potem `Buffer.from(codePoints).toString('utf8')` = oryginalny tekst.

**Najlepsza długoterminowa ochrona:** zamiast liczyć na to że plik zawsze zostanie zapisany jako UTF-8, używać `\uXXXX` escape'ów w stringach z polskimi znakami (jak w `coachay-core.js`) — to jest odporne na encoding pliku, bo JS dekoduje `ź` do właściwego code pointu niezależnie od tego jak zapisany jest sam plik.

---

## 🌐 Browser pane (Claude Code) — file:// nie wykonuje JS

Otwieranie lokalnego pliku przez `navigate` z `file://` renderuje się jako statyczny snapshot (CSP `script-src 'none'`) — bez względu na to, w którym folderze plik leży. Żeby wykonać JS (np. canvas do generowania obrazków), trzeba serwować przez `http://localhost`:
```bash
cd folder_ze_scratchpad
python -m http.server 8822
```
(uruchomione przez Bash z `run_in_background: true`, NIE przez `&`/`disown` w tle — inaczej proces ginie po zakończeniu wywołania narzędzia). Potem `navigate` do `http://127.0.0.1:8822/plik.html` — pełne wykonanie JS działa. Do zapisywania danych z przeglądarki na dysk (np. wygenerowany canvas → PNG) — własny mini-serwer Pythona z obsługą POST zamiast ręcznego przepisywania base64 (podatne na błędy transkrypcji).
