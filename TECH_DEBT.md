# Flat Tracker — Teknisk Skuld & Migreringsplan

> Skapad: 2026-06-03 16:57 CET
> Syfte: Detaljerad dokumentation för kontrollerad hantering av teknisk skuld

---

## 1. Gen1 → Gen2 Cloud Functions Migrering

### Bakgrund och rotorsak

Projektet använder `firebase-functions: ^4.9.0` (gen1 SDK) för alla funktioner utom
`enrichListing` som är skriven med gen2 API (`firebase-functions/v2/firestore`).
Denna blandning orsakar att `enrichListing` inte får korrekt event-data när den
deployas via `gcloud functions deploy --gen2` — Eventarc CloudEvents levereras
som raw binärdata istället för parsade Firebase-event-objekt.

Rotorsaken: `firebase-functions` v4.x hanterar inte Eventarc CloudEvents korrekt.
Det kräver v5+ för fullt gen2-stöd.

### Nuvarande tillstånd

| Funktion | Generation | SDK-syntax | Deploy-metod | Status |
|---|---|---|---|---|
| `gmailPush` | Gen1 | `functions.runWith().pubsub.onPublish()` | `gcloud` utan `--gen2` | ✅ Fungerar |
| `setupGmailPush` | Gen1 | `functions.runWith().https.onRequest()` | `gcloud` utan `--gen2` | ✅ Fungerar |
| `renewGmailPush` | Gen1 | `functions.runWith().pubsub.schedule()` | `gcloud` utan `--gen2` | ✅ Fungerar |
| `enrichListing` | Gen2 | `onDocumentCreated()` från v2 | `gcloud --gen2` | ❌ Event-data saknas |

### Migreringsstrategi

**Princip:** Migrera ALLA funktioner till gen2 i ett samlat steg.
Aldrig blanda gen1 och gen2 i samma kodbas.

**Ordning:**
1. Uppgradera `firebase-functions` till `^5.1.0` (stöder både v1 och v2 API parallellt)
2. Uppgradera `firebase-admin` till `^13.0.0`
3. Migrera varje funktion till v2-syntax
4. Uppdatera `deploy-functions.yml`
5. Verifiera varje funktion efter deploy

### Gen1 → Gen2 syntaxmappning

#### gmailPush (Pub/Sub trigger)
```javascript
// GEN1 — nuvarande
exports.gmailPush = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB', secrets: ['ANTHROPIC_KEY', 'GMAIL_CREDENTIALS'] })
  .pubsub.topic('gmail-push')
  .onPublish(async function() { ... });

// GEN2 — efter migrering
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
exports.gmailPush = onMessagePublished({
  topic: 'gmail-push',
  timeoutSeconds: 120,
  memory: '512MiB',
  secrets: ['ANTHROPIC_KEY', 'GMAIL_CREDENTIALS'],
  region: 'us-central1',
}, async (event) => { ... });
```

#### setupGmailPush (HTTP trigger)
```javascript
// GEN1 — nuvarande
exports.setupGmailPush = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB', secrets: ['GMAIL_CREDENTIALS'] })
  .https.onRequest(async function(req, res) { ... });

// GEN2 — efter migrering
const { onRequest } = require('firebase-functions/v2/https');
exports.setupGmailPush = onRequest({
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: ['GMAIL_CREDENTIALS'],
  region: 'us-central1',
  cors: false,
}, async (req, res) => { ... });
```

#### renewGmailPush (Schemalagd)
```javascript
// GEN1 — nuvarande
exports.renewGmailPush = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB', secrets: ['GMAIL_CREDENTIALS'] })
  .pubsub.schedule('every 144 hours')
  .onRun(async function() { ... });

// GEN2 — efter migrering
const { onSchedule } = require('firebase-functions/v2/scheduler');
exports.renewGmailPush = onSchedule({
  schedule: 'every 144 hours',
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: ['GMAIL_CREDENTIALS'],
  region: 'us-central1',
}, async (event) => { ... });
```

#### enrichListing (Firestore trigger)
```javascript
// GEN2 — redan korrekt syntax, men behöver region europe-west1 för eur3
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
exports.enrichListing = onDocumentCreated({
  document: 'listings/{listingId}',
  region: 'europe-west1',   // Krävs för Firestore eur3
  secrets: ['ANTHROPIC_KEY'],
  timeoutSeconds: 120,
  memory: '512MiB',
}, async (event) => { ... });
// Med v5+ SDK: event.data, event.params, event.document fungerar korrekt
```

### Uppdaterad deploy-functions.yml efter migrering

```yaml
- name: Deploya gmailPush
  run: |
    gcloud functions deploy gmailPush \
      --gen2 \
      --runtime nodejs20 \
      --trigger-topic gmail-push \
      --memory 512MB \
      --timeout 120s \
      --set-secrets ANTHROPIC_KEY=ANTHROPIC_KEY:latest,GMAIL_CREDENTIALS=GMAIL_CREDENTIALS:latest \
      --project ${{ secrets.FIREBASE_PROJECT_ID }} \
      --region us-central1 \
      --source functions \
      --quiet

- name: Deploya setupGmailPush
  run: |
    gcloud functions deploy setupGmailPush \
      --gen2 \
      --runtime nodejs20 \
      --trigger-http \
      --memory 256MB \
      --timeout 60s \
      --set-secrets GMAIL_CREDENTIALS=GMAIL_CREDENTIALS:latest \
      --project ${{ secrets.FIREBASE_PROJECT_ID }} \
      --region us-central1 \
      --source functions \
      --quiet

- name: Deploya renewGmailPush
  run: |
    gcloud functions deploy renewGmailPush \
      --gen2 \
      --runtime nodejs20 \
      --trigger-http \
      --memory 256MB \
      --timeout 60s \
      --set-secrets GMAIL_CREDENTIALS=GMAIL_CREDENTIALS:latest \
      --project ${{ secrets.FIREBASE_PROJECT_ID }} \
      --region us-central1 \
      --source functions \
      --quiet

- name: Deploya enrichListing
  run: |
    gcloud functions deploy enrichListing \
      --gen2 \
      --runtime nodejs20 \
      --region europe-west1 \
      --trigger-location eur3 \
      --trigger-event-filters "type=google.cloud.firestore.document.v1.created" \
      --trigger-event-filters "database=(default)" \
      --trigger-event-filters-path-pattern "document=listings/{listingId}" \
      --memory 512MB \
      --timeout 120s \
      --set-secrets ANTHROPIC_KEY=ANTHROPIC_KEY:latest \
      --project ${{ secrets.FIREBASE_PROJECT_ID }} \
      --source functions \
      --quiet

- name: Deploya enrichListingHttp
  run: |
    gcloud functions deploy enrichListingHttp \
      --gen2 \
      --runtime nodejs20 \
      --trigger-http \
      --memory 512MB \
      --timeout 120s \
      --set-secrets ANTHROPIC_KEY=ANTHROPIC_KEY:latest \
      --project ${{ secrets.FIREBASE_PROJECT_ID }} \
      --region europe-west1 \
      --source functions \
      --quiet
```

### OBS: renewGmailPush trigger-typ

`renewGmailPush` är schemalagd i gen1 via `pubsub.schedule()`. I gen2 används
`onSchedule()` som kräver Cloud Scheduler — samma problem som orsakade att vi
använde Pub/Sub-workaround ursprungligen. Vid migrering: verifiera att
Cloud Scheduler API är aktiverat och att tjänstkontot har `roles/cloudscheduler.admin`.

### Checklista för migrering

Kör I DENNA ORDNING:

1. [ ] Aktivera Cloud Scheduler API (om inte redan aktivt)
2. [ ] Uppgradera `package.json`: `firebase-functions: ^5.1.0`, `firebase-admin: ^13.0.0`
3. [ ] Migrera `gmailPush` till v2-syntax, verifiera lokalt
4. [ ] Migrera `setupGmailPush` till v2-syntax
5. [ ] Migrera `renewGmailPush` till v2-syntax (OBS: Cloud Scheduler)
6. [ ] `enrichListing` är redan v2-syntax — ingen kodändring, bara verifiera att event-data fungerar med ny SDK-version
7. [ ] Ta bort gamla gen1-funktioner från GCP Console innan deploy (undvik gen1/gen2-konflikt)
8. [ ] Uppdatera `deploy-functions.yml` med `--gen2` på alla funktioner
9. [ ] Pusha och verifiera att alla 4 funktioner deployas grönt
10. [ ] Testa hela kedjan: oläst mail → gmailPush → Firestore → enrichListing

---

## 2. Övrig teknisk skuld

### Node.js 20 → 22 uppgradering
**När:** Senast oktober 2026 (Node.js 20 decommissionas 30 okt 2026)
**Vad:** Ändra `"engines": { "node": "20" }` till `"node": "22"` i `package.json`
**OBS:** Node.js 22 stöds INTE i gen1 Cloud Functions — kräver gen2.
Gör detta EFTER gen2-migreringen.

### enrichListing körs i europe-west1, övriga i us-central1
**Rotorsak:** Firestore-databasen är i `eur3` (multi-region), gen1-funktioner
kan inte triggas av eur3-databaser. enrichListing deployas i europe-west1.
**Löses av:** Gen2-migreringen — alla funktioner kan samlas i `europe-west1`.

### renewGmailPush schemalagd via Pub/Sub (inte Cloud Scheduler)
**Rotorsak:** Cloud Scheduler-deploy misslyckades med behörighetsfel vid ursprunglig setup.
**Löses av:** Gen2-migreringen med `onSchedule()`.

### Io-chatthistorik ej Firestore-persisterad
**Vad:** Chatthistorik försvinner vid sidomladdning.
**Sprint:** Sprint 14

### window.confirm för profilborttagning
**Vad:** Native browser-dialog, bör ersättas med custom modal.
**Sprint:** Kan göras när som helst, låg prioritet.

---

## 3. setup-flattracker.sh

Scriptet refereras i CLOUD_FUNCTIONS_SETUP.md men existerar inte.
Ska skapas och innehålla alla gcloud-kommandon för att återskapa GCP-miljön från scratch.

### Innehåll (att implementera)

```bash
#!/bin/bash
# setup-flattracker.sh — Återskapa GCP-miljön för Flat Tracker från scratch
# Kör: bash setup-flattracker.sh

PROJECT_ID="flattracker-mph"

echo "Aktiverar API:er..."
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  gmail.googleapis.com \
  eventarc.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudlogging.googleapis.com \
  --project=$PROJECT_ID

echo "Sätter IAM-roller för deploy-tjänstkontot..."
SA="firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com"
for ROLE in \
  roles/cloudfunctions.admin \
  roles/cloudscheduler.admin \
  roles/datastore.owner \
  roles/firebase.sdkAdminServiceAgent \
  roles/firebaseauth.admin \
  roles/iam.serviceAccountTokenCreator \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor \
  roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA" \
    --role="$ROLE" --quiet
done

echo "Extra IAM-bindning för Cloud Functions deployment..."
gcloud iam service-accounts add-iam-policy-binding \
  204633917365-compute@developer.gserviceaccount.com \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT_ID

echo "Secret Manager accessor för runtime-tjänstkonto..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

echo "Klar! Kom ihåg att manuellt:"
echo "1. Skapa hemligheter i Secret Manager: ANTHROPIC_KEY, GMAIL_CREDENTIALS"
echo "2. Aktivera Gmail push: https://us-central1-${PROJECT_ID}.cloudfunctions.net/setupGmailPush"
echo "3. Skapa Firestore-index: listings / matchedHouseholds (Arrays) + createdAt (Desc)"
```

