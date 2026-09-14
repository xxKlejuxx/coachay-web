# TODO: Nowa architektura przydzielania slotów klubowych

> Dokument roboczy — zebranie całego planu z sesji 2026-09-14.
> Jeśli implementacja się zatnie, tu jest pełny kontekst.

---

## Kontekst: co mamy teraz (i co jest nie tak)

### System A — `usedSlot` (CF proaktywny)
Pole `usedSlot` na dokumencie membership (`0` lub `1`) jest ustawiane przez Cloud Functions:
- `assignExpiredTrialSlots` — odpala się co 24h, skanuje WSZYSTKIE kluby, potem WSZYSTKICH memberów każdego klubu, dla każdego kandydata robi `db.collection('users').doc(m.userId).get()` żeby sprawdzić `clubs_trial[clubId]`. Bardzo drogie przy skali.
- `onClubLicenseUpdated` — trigger gdy admin zmienia `license.total` lub `scope`. Już działa poprawnie.

### System B — lazy-claim (`licenseSource / licenseStatus / poolClaimedAt`)
Przy logowaniu `getAccessStatus()` w `coachay-core.js` sprawdza te pola na membership i próbuje `claimClubLicenseSlot()`. Powoduje bugi:
- `renewedAt=null` na ręcznie aktywowanych licencjach → `slotFresh=true` zawsze → user dostaje ACTIVE mimo braku ważnej licencji
- Stale fields: user może mieć `licenseStatus='ACTIVE'` z dawnego claim mimo że nie ma ważnego slotu
- `claimClubLicenseSlot()` nie sprawdza `usedSlot` przed transakcją → ryzyko podwójnego przypisania
- Brak priorytetu ról: RODZIC może zabrać slot przed TRENER_GLOWNY

### Trial — gdzie jest zapisany
Aktualnie trial jest w `users/{userId}.clubs_trial[clubId]` (NIE na membership). Dlatego CF musi czytać dokument `users` dla każdego kandydata — O(n) drogich odczytów.

---

## Nowa architektura — 4 mechanizmy

```
[RevenueCat EXPIRATION] → onRevenueCatWebhook      → slot w sekundy (real-time)
[Admin dokupuje]        → onClubLicenseUpdated      → slot natychmiast (już działa ✓)
[Nightly 2:00]          → assignExpiredTrialSlotsV2  → slot dla trial-only userów
[Logowanie]             → lazy-claim v2 (fallback)   → slot jeśli triggery padły
```

---

## Krok 1: Nowe pole `trialEndsAt` na membership

### Co
Dodać pole `trialEndsAt: Timestamp` na każdy dokument membership przy jego tworzeniu.

### Wartość
```
trialEndsAt = (membership.joinedAt ?? membership.createdAt) + 90 dni, godzina 23:55:00 UTC
```

### Gdzie pisać
**`onMembershipCreated`** w `functions/index.js` (~linia 676):
- Pisać dla WSZYSTKICH ról (włącznie z KIBIC i ZAWODNIK) — pole nie szkodzi, może być przydatne dla bramki płatności
- Bez warunku na `_MBR_EXCLUDE_ROLES` dla `trialEndsAt` (inaczej niż dla `usedSlot` który ma ten warunek)
- Jeśli `existingTrial` już jest w `users.clubs_trial[clubId]` → użyj tej daty jako źródła (zachowanie wsteczne)
- Nowy membership: wylicz z `joinedAt ?? createdAt`

**Uwaga**: `clubs_trial` w `users` pozostaje — nie usuwamy (backwards compat), ale `trialEndsAt` na membership jest nowym source of truth dla CF v2.

### Przykładowy kod (fragment do wstawienia w onMembershipCreated):
```javascript
// Pole trialEndsAt na membership — dla CF v2 i payment gate
const baseDate = m.joinedAt?.toDate?.() ?? m.createdAt?.toDate?.() ?? new Date();
const trialEnd = new Date(baseDate);
trialEnd.setDate(trialEnd.getDate() + 90);
trialEnd.setUTCHours(23, 55, 0, 0);
await event.data.ref.update({ trialEndsAt: trialEnd });
```

---

## Krok 2: Migracja istniejących membership

### Co
Backfill pola `trialEndsAt` na wszystkich istniejących dokumentach membership które go nie mają.

### Źródło danych
`(membership.joinedAt ?? membership.createdAt) + 90 dni @ 23:55:00 UTC`  
**NIE** czytamy `users.clubs_trial[clubId]` — wyliczamy na nowo z membership.

### Skrypt (F12 lub Node.js)
```javascript
// Uruchomić w konsoli Firebase z uprawnieniami admin
const snapshot = await db.collection('memberships')
    .where('trialEndsAt', '==', null)  // lub: bez pola
    .get();

const batch = db.batch();
let count = 0;
for (const doc of snapshot.docs) {
    const m = doc.data();
    const baseDate = m.joinedAt?.toDate?.() ?? m.createdAt?.toDate?.() ?? null;
    if (!baseDate) continue;
    const trialEnd = new Date(baseDate);
    trialEnd.setDate(trialEnd.getDate() + 90);
    trialEnd.setUTCHours(23, 55, 0, 0);
    batch.update(doc.ref, { trialEndsAt: trialEnd });
    count++;
    if (count % 500 === 0) { await batch.commit(); /* nowy batch */ }
}
await batch.commit();
console.log(`Zmigrowano: ${count} membership`);
```

**Uwaga**: Firestore batch max 500 operacji — skrypt musi dzielić na batche.

---

## Krok 3: Composite Index w Firestore

### Plik: `firestore.indexes.json`
```json
{
  "indexes": [
    {
      "collectionGroup": "memberships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status",      "order": "ASCENDING" },
        { "fieldPath": "usedSlot",    "order": "ASCENDING" },
        { "fieldPath": "trialEndsAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Dlaczego taka kolejność
Query CF v2: `WHERE status IN ['ACTIVE','grace'] AND usedSlot==0 AND trialEndsAt<=now`
- Firestore `IN` rozdziela na N sub-queries z equality filter na `status`
- `usedSlot` — equality (filtruje tylko te bez slotu)
- `trialEndsAt` — range (musi być ostatni w indexie)

Deploy: `firebase deploy --only firestore:indexes`

---

## Krok 4: `assignExpiredTrialSlotsV2` (nowy CF, nightly)

### Cel
Zastąpić drogie skanowanie wszystkich klubów jednym celowanym zapytaniem.  
**Stara funkcja zostaje** — nowa to `assignExpiredTrialSlotsV2` (testujemy równolegle).

### Harmonogram
```javascript
exports.assignExpiredTrialSlotsV2 = onSchedule(
    { schedule: '0 2 * * *', timeZone: 'Europe/Warsaw' },
    async () => { ... }
);
```

### Algorytm
```
1. Zapytanie do Firestore:
   memberships WHERE status IN ['ACTIVE','grace']
                AND usedSlot == 0
                AND trialEndsAt <= now()

2. Dedup po userId:
   Jeden user może mieć wiele membership (różne kluby).
   Dla każdego userId trzymaj tylko to z najwcześniejszym trialEndsAt.
   → Map: userId → { membershipRef, clubId, role, trialEndsAt, eligibleAt }

3. Group by clubId:
   → Map: clubId → [lista kandydatów]

4. Dla każdego klubu:
   a. Pobierz dokument clubs/{clubId} → license.total, license.used, license.scope, license.valid_until
   b. Sprawdź czy licencja ważna (valid_until > now)
   c. wolne = total - used
   d. Jeśli wolne <= 0 → skip klub

5. Sortuj kandydatów klubu wg priorytetu:
   - TRENER_GLOWNY (eligibleAt ASC)
   - TRENER / TRENER_POMOCNICZY (eligibleAt ASC)  
   - RODZIC (eligibleAt ASC) — tylko jeśli scope !== 'trainers_only'
   - KIBIC / ZAWODNIK → pomiń (nie dostają slotu klubowego)
   - `maxOneParentPerChild`: jeśli `club.license.maxOneParentPerChild === true`, jeden `playerId` może mieć tylko jednego rodzica na puli. Przed przydzieleniem RODZIC sprawdź czy `playerId` już jest zajęty przez innego slottowanego rodzica.
   - **TODO — zweryfikować**: czy `license.used` zawsze równa się rzeczywistej liczbie `usedSlot=1` w tym klubie? Ryzyko rozbieżności gdy: admin ręcznie zmienia wartości, user jest usuwany bez `releaseClubLicenseSlot()`, CF rzuca błąd w połowie transakcji. Przy nowej architekturze rozważyć: zamiast inkrementować licznik ręcznie (`used + 1`), po każdym przydziale lub zwolnieniu slotu przeliczyć `used` jako `COUNT(memberships WHERE clubId==X AND usedSlot==1)`. Droższe per-operacja ale zawsze spójne. Alternatywa: dodać pomocniczy CF `recalculateLicenseUsed` wywoływany z support.html gdy admin podejrzewa rozbieżność.

6. Przydziel sloty (do wyczerpania wolnych):
   t.update(membershipRef, { usedSlot: 1 })
   t.update(clubRef, { 'license.used': used + przydzielono })
   → Firestore transaction (atomowy update licznika i membership)
```

### Kluczowe warunki (nie pominąć)
- `status` — sprawdzaj dokładnie (`.toUpperCase() === 'ACTIVE'` lub `=== 'GRACE'`)
- `scope` — jeśli `club.license.scope === 'trainers_only'` → pomiń RODZIC w całości
- `trialEndsAt` — musi być `<= now`, nie samo istnienie pola
- `eligibleAt` — to jest data od kiedy user jest uprawniony (np. joinedAt lub data wygaśnięcia trial) — sprawdź jak jest używany w istniejącym CF
- Jeden user może należeć do wielu klubów → dedup per userId jest ważny, ale assignment może się odbyć do każdego klubu oddzielnie (slot w każdym klubie niezależny)

---

## Krok 5: `onRevenueCatWebhook` (nowy CF, HTTP trigger)

### Cel
Przydzielić slot w sekundy gdy user traci subskrypcję indywidualną/family w RevenueCat.

### Event
RevenueCat wysyła `EXPIRATION` gdy subskrypcja wygasła (włącznie z końcem grace period).

### Endpoint
```javascript
exports.onRevenueCatWebhook = onRequest(async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    // Weryfikacja (opcjonalne: shared secret w headerze X-RevenueCat-Webhook-Secret)
    
    const event = req.body?.event;
    if (!event || event.type !== 'EXPIRATION') return res.status(200).send('ignored');
    
    const uid = event.app_user_id; // = Firebase UID
    if (!uid) return res.status(400).send('no uid');
    
    // Znajdź membership usera bez slotu, trial wygasły
    const memberships = await db.collection('memberships')
        .where('userId', '==', uid)
        .where('usedSlot', '==', 0)
        .get();
    
    for (const mDoc of memberships.docs) {
        const m = mDoc.data();
        // Sprawdź trial wygasł
        const trialEnd = m.trialEndsAt?.toDate?.();
        if (!trialEnd || trialEnd > new Date()) continue;
        
        // Sprawdź czy rola kwalifikuje
        const role = (m.role || '').toUpperCase();
        if (['KIBIC', 'ZAWODNIK'].includes(role)) continue; // brak slotu klubowego
        
        // Pobierz klub i przydziel slot
        await assignSlotToMembership(mDoc, m); // współdzielona funkcja
    }
    
    res.status(200).send('ok');
});
```

### Uwagi
- RevenueCat wymaga skonfigurowania URL webhooka w dashboardzie RevenueCat → Settings → Integrations → Webhooks
- URL endpointu: `https://us-central1-{project-id}.cloudfunctions.net/onRevenueCatWebhook`
- RevenueCat retryuje failed webhooks — funkcja musi być idempotentna (sprawdza `usedSlot` przed przypisaniem)
- Shared secret do weryfikacji: przechować w Firebase Secret Manager

---

## Krok 6: Lazy-claim v2 (rewrite w `coachay-core.js`)

### Aktualna funkcja — `claimClubLicenseSlot()` (~linia 3368)
**Problem**: pisze stare pola `licenseSource/licenseStatus/poolClaimedAt`, nie sprawdza `usedSlot` przed transakcją, brak priorytetu.

### Co zmienić
Przepisać `claimClubLicenseSlot()` tak żeby:

1. **Przed transakcją**: sprawdź `if (membershipDoc.data().usedSlot === 1) return { success: true, alreadyClaimed: true }` → unikamy podwójnego przypisania
2. **W transakcji**: pisz `usedSlot: 1` zamiast `licenseSource/licenseStatus/poolClaimedAt`
3. **Priorytet**: BRAK w lazy-claim fallback (first-come-first-served) — priorytet zapewniają CF/webhook w normalnym flow. Akceptowalne bo lazy-claim to edge case (oba triggery padły jednocześnie).
4. **Warunek roli**: nie przydzielaj KIBIC/ZAWODNIK

### Nowa logika (pseudokod)
```javascript
async function claimClubLicenseSlot(uid, clubId, membershipDoc) {
    const mData = membershipDoc.data();
    
    // Już ma slot → nic nie rób
    if (mData.usedSlot === 1) return { success: true };
    
    // Rola nie kwalifikuje
    const role = (mData.role || '').toUpperCase();
    if (!_MBR_TRAINER_ROLES.has(role) && role !== 'RODZIC') 
        return { success: false, source: 'role_excluded' };
    
    // Sprawdź scope
    const clubSnap = await db.collection('clubs').doc(clubId).get();
    const lic = clubSnap.data()?.license;
    if (!lic?.valid_until) return { success: false, source: 'no_license' };
    if (lic.valid_until.toDate() <= new Date()) return { success: false, source: 'club_license_expired' };
    if (lic.scope === 'trainers_only' && role === 'RODZIC') 
        return { success: false, source: 'scope_excluded' };
    
    // Transakcja
    await db.runTransaction(async t => {
        const freshClub = await t.get(clubSnap.ref);
        const freshLic = freshClub.data().license;
        const used = freshLic.used || 0;
        const total = freshLic.total || 0;
        if (used >= total) throw new Error('POOL_FULL');
        
        t.update(freshClub.ref, { 'license.used': used + 1 });
        t.update(membershipDoc.ref, { usedSlot: 1 }); // tylko usedSlot, bez starych pól
    });
    
    return { success: true, source: 'club_license' };
}
```

### Gdzie wywoływana
W `getAccessStatus()` w P3 (~linia 3535) — gdy user nie ma indywidualnej/family licencji, trial wygasł, `usedSlot === 0` → próbuj lazy-claim.

**WAŻNE**: `coachay-core.js` jest SST (Single Source of Truth) — zmiany muszą być skoordynowane z repo mobilnym. Nie modyfikuj samodzielnie bez zgody Rafała.

---

## Krok 7: Usunięcie starych pól (opcjonalnie, później)

Po wdrożeniu i stabilizacji nowej architektury:
- Usunąć `licenseSource`, `licenseStatus`, `poolClaimedAt` z logiki `getAccessStatus()`
- Usunąć `claimClubLicenseSlot()` (zastąpiona przez v2)
- Wyczyścić te pola ze wszystkich membership w bazie (skrypt migracyjny)
- Zostawić `users.clubs_trial[clubId]` na razie (backwards compat)

---

## Kolejność implementacji

```
[ ] 1. Dodaj trialEndsAt w onMembershipCreated (functions/index.js)
[ ] 2. Napisz skrypt migracji trialEndsAt (F12 lub Node)
[ ] 3. Dodaj composite index (firestore.indexes.json) + firebase deploy --only firestore:indexes
[ ] 4. Napisz assignExpiredTrialSlotsV2 (functions/index.js) — nie usuwaj starej
[ ] 5. Napisz onRevenueCatWebhook (functions/index.js) — skonfiguruj URL w RevenueCat dashboard
[ ] 6. Przepisz claimClubLicenseSlot → v2 (coachay-core.js) — skoordynuj z repo mobilnym
[ ] 7. Przetestuj: kup licencję, daj slot manualnie, sprawdź triggery
[ ] 8. Wpisz do _sync.md
[ ] 9. firebase deploy --only functions,firestore:indexes
```

---

## Pliki do modyfikacji

| Plik | Co |
|------|----|
| `functions/index.js` | `onMembershipCreated` (+trialEndsAt), nowy `assignExpiredTrialSlotsV2`, nowy `onRevenueCatWebhook` |
| `firestore.indexes.json` | Nowy composite index |
| `coachay-core.js` | Rewrite `claimClubLicenseSlot` → v2 (SST — ostrożnie) |
| `_sync.md` | Dokumentacja zmian |

---

## Funkcje pomocnicze (do współdzielenia między CF)

Warto wyciągnąć do wspólnej funkcji `assignSlotToMembership(mDoc, m, clubData)`:
- sprawdza `usedSlot`, rolę, scope
- robi transakcję: `usedSlot=1` + `license.used++`
- używana przez: `assignExpiredTrialSlotsV2`, `onRevenueCatWebhook`, `onClubLicenseUpdated`

---

## Pytania otwarte

- ~~`eligibleAt`~~ — **wyjaśnione**: to `trialEndMs` (data końca triala). Im wcześniej trial wygasł → wyżej w kolejce (w obrębie grupy ról). W v2: `trialEndsAt` na membership pełni tę samą rolę.
- RevenueCat shared secret — gdzie będzie przechowywany? Firebase Secret Manager?
- Czy `onRevenueCatWebhook` ma też obsługiwać event `BILLING_ISSUE` (user w grace period)?
- Kiedy usuwamy stary `assignExpiredTrialSlots`? Po stabilizacji v2 (np. po 2 tygodniach działania)
