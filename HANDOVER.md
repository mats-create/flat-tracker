# Flat Tracker — Handover Document

> Senast uppdaterad: 2026-06-05 11:30 CET
> Version: 0.4.0
> Status: Pausat

---

## Arbetssätt och samarbetsprinciper

### Rollfördelning
- **Användaren** är inte utvecklare. Guidning ges när det efterfrågas eller behövs.
- **Användaren** hanterar GitHub manuellt — uppladdning och hämtning av filer, commits, mappstruktur. Ingen terminal eller git-kommandon används.
- **Claude** genererar alla kodfiler och ger tydliga instruktioner om exakt vilka filer som ska laddas upp och var.
- Alla levererade filer har versionsstämpel på rad 1-3 i formatet `// Version: YYYY-MM-DD HH:MM CET`

### GitHub-workflow
- Filer laddas upp manuellt via GitHubs webbgränssnitt
- GitHub Actions bygger `index.html` automatiskt vid push till `src/` eller `build.py`
- `index.html` laddas aldrig upp manuellt — genereras alltid av Actions
- `build.py` ligger i rotnivå, `src/`-filer i `src/`-mappen
- Cloud Functions deployas automatiskt via `.github/workflows/deploy-functions.yml` vid push till `functions/`

### Planering och beslutsfattande
- **Planera först** — tillvägagångssätt utvärderas och presenteras innan kod skrivs
- **Teknik och arkitektur** beslutas av Claude, användaren hålls informerad på ett begripligt sätt
- **Kostnadseffektivitet** prioriteras alltid — billigaste lösning som uppfyller kraven väljs
- Tekniska alternativ presenteras med fokus på **effekt och kostnad**, inte teknisk detaljnivå

### Språk
- Allt UI är på **svenska**
- Kod och kommentarer är på **svenska** där det gäller UI-text och användarmeddelanden
- Variabelnamn och funktioner är på **engelska** (kodkonvention)
- Kommunikation mellan användare och Claude sker på **svenska**

---

## Översikt

Flat Tracker är en mobil-först webapp för lägenhetssökning på den svenska marknaden. Appen ger användare realtidsnotiser när lägenheter publiceras via bevakningsmail från Hemnet, Booli och Boneo, med AI-assistenten Io för marknadsinsikter.

Appen delas av ett hushåll med max 2 medlemmar.

---

## Tech Stack

| Vad | Val | Motivering |
|---|---|---|
| Framework | React 18 (UMD, in-browser Babel) | Samma mönster som Cross Pass, Game Tracker, Job Tracker |
| Språk | JavaScript (ES2020+) | Ingen build-pipeline behövs |
| UI | Custom CSS, Material Design 3 tokens | Ingen extern UI-lib, full kontroll |
| Font | Roboto (Google Fonts) | Material Design standard |
| Backend | Firebase (Auth + Firestore) | Realtid, enkel setup |
| Auth | Google Sign-In | Enkel OAuth utan lösenord |
| AI | Claude API (Haiku) via direkt browser-fetch | Kostnadseffektivt |
| Hosting | GitHub Pages | Gratis, automatisk deploy via Actions |
| Build | Python build.py + GitHub Actions | Konkatenerar src/-filer till index.html |
| Cloud Functions | Firebase gen1, Node.js 20 | Gmail-pipeline och berikningsfunktion |

---

## Projektstruktur

```
flat-tracker/
  src/
    constants.js    — App-konstanter, ENRICH_FUNCTION_URL, CLAUDE_MODEL, IO_SYSTEM_PROMPT
    utils.js        — Hjälpfunktioner: formatPrice, timeAgo, formatSqm, generateInviteCode
    firebase.js     — Dokumentation av Firebase-struktur (init sker i build.py HTML-head)
    components.js   — Delade UI-komponenter: Logo, TopBar, BottomNav, ListingCard,
                      LoginScreen, SettingsMenu, IoFlyout, IoButton
    household.js    — Hushållslogik: createHousehold, joinHousehold, getHouseholdId
    profiles.js     — Bevakningsprofiler: CRUD mot Firestore, ProfileCard, ProfileForm
    screens.js      — FeedScreen (med bakgrundsberikande), AreasScreen
    app.js          — Rot-komponent, auth-flöde, navigation, layout
    style.css       — All CSS, Material Design tokens, responsiv layout
  functions/
    index.js        — Cloud Functions: gmailPush, setupGmailPush, renewGmailPush,
                      enrichListing (inaktiv), enrichListingHttp, pingSearch (test)
    package.json    — firebase-functions ^4.9.0, firebase-admin ^12.0.0, googleapis
  build.py          — Assemblerar index.html från src/-filer + Firebase-config
  manifest.json     — PWA-manifest
  favicon.svg       — Logotyp: platsmarkör (pin) med hussiluett, blå + orange accent
  HANDOVER.md       — Detta dokument
  BACKLOG.md        — Prioriterad backlog och sprints
  TECH_DEBT.md      — Gen2-migreringsplan och övrig teknisk skuld
  POST_MORTEM.md    — Lärdomar från Gmail push-integration
  CLOUD_FUNCTIONS_SETUP.md — Komplett referens för Cloud Functions-deployment
```

### Build-ordning (JS_FILES i build.py)
```
constants.js → utils.js → firebase.js → components.js →
household.js → profiles.js → screens.js → app.js
```

---

## Nuvarande tillstånd (2026-06-05)

### Vad som fungerar
- **Gmail push-pipeline**: Hemnet/Booli/Boneo-bevakningsmail → `gmailPush` → Firestore
- **Grunddata**: adress, pris, rum, storlek, källa, visningstider sparas automatiskt
- **Berikningsdata**: `enrichListingHttp` hämtar description, byggår, våning, energiklass, mäklarnamn, ansvarig mäklare via Hemnet-sida + Claude Haiku
- **Bakgrundsberikande**: appen triggar berikandet automatiskt när flödet laddas
- **Datastatus**: grön ✓ (fullständig) / grå ○ (grunddata) per annons
- **Flödeslistan**: sortering, filtrering, visningstider, Mer info-sektion
- **Bevaka**: stjärnmarkera annonser, Io-analys för bevakade
- **Io-assistent**: Haiku-baserad, flyout-panel, markdown-rendering
- **Bevakningsprofiler**: max 5, kriterier för pris/storlek/rum/balkong/hiss etc.
- **Hushållsstruktur**: 2 medlemmar, inbjudningskod, delad API-nyckel
- **Responsiv layout**: mobil bottom nav, desktop sidebar med expand/collapse

### Vad som inte fungerar / är olöst
- **Berikningsstrategi**: web search-steget (DuckDuckGo) är implementerat men ej verifierat — det är oklart om det fungerar från Cloud Run. Loggarna har aldrig visat `söker efter mäklarannons` vilket tyder på att steget hoppas över eller misslyckas tyst.
- **Bilder**: `imageUrls` är konsekvent tom array — Hemnet blockerar bildextraktionen
- **Kontaktinfo**: `agentPhone` och `agentEmail` är null — finns inte i mailtext eller HTML
- **Booli och Boneo**: ej testade eller verifierade som datakällor
- **Mäklarens direktlänk**: `brokerListingUrl` är null — hittas inte i Hemnet-HTML
- **Gen1/Gen2-blandning**: se TECH_DEBT.md

---

## Datapipeline

### Flöde
```
Hemnet/Booli/Boneo publicerar annons
  → Bevakningsmail till mats@hultgrensaksi.com
  → Gmail-filter: label "Flat Tracker"
  → Gmail push → Pub/Sub topic "gmail-push"
  → Cloud Function: gmailPush
  → Claude Haiku extraherar grunddata från mailtext
  → Sparas i Firestore: listings/{listingId}
  → Appen laddas → FeedScreen identifierar oberikat material
  → Cloud Function: enrichListingHttp anropas
  → Steg 0: hämtar agencyName från Hemnet om saknas
  → Steg 1: DuckDuckGo web search → mäklarens URL (EJ VERIFIERAT)
  → Steg 2: hämtar mäklarens sajt → Claude-extraktion (EJ VERIFIERAT)
  → Steg 3: fallback → Hemnet HTML + Claude Haiku (FUNGERAR)
  → Firestore uppdateras: enriched: true
  → Appen uppdateras i realtid via Firestore-lyssnare
```

### Berikningsdata som hämtas (via fallback)
- `agencyName` — mäklarfirmans namn
- `agentName` — ansvarig mäklare
- `description` — beskrivningstext
- `builtYear` — byggår
- `floor` — våning
- `energyClass` — energiklass (A-G)
- `propertyDesignation` — fastighetsbeteckning/BRF-namn
- `monthlyFee` — månadsavgift (kr)
- `operatingCost` — driftskostnad (kr/år)
- `viewings` — visningstider med datum och tid

### Berikningsdata som saknas
- `imageUrls` — bilder (alltid tom)
- `agentPhone` — telefon (alltid null)
- `agentEmail` — e-post (alltid null)
- `brokerListingUrl` — mäklarens direktlänk (alltid null)

---

## Cloud Functions

| Funktion | Generation | Region | Trigger | Status |
|---|---|---|---|---|
| `gmailPush` | Gen1 | us-central1 | Pub/Sub gmail-push | ✅ Fungerar |
| `setupGmailPush` | Gen1 | us-central1 | HTTP | ✅ Fungerar |
| `renewGmailPush` | Gen1 | us-central1 | Pub/Sub gmail-push | ✅ Fungerar |
| `enrichListingHttp` | Gen1* | europe-west1 | HTTP | ✅ Fungerar (fallback) |
| `enrichListing` | Gen2 | europe-west1 | Firestore onCreate | ❌ Inaktiv, borttagen |
| `pingSearch` | Gen1 | us-central1 | HTTP | ⚠️ Deploy-problem |

*`enrichListingHttp` deployas via `gcloud functions deploy` utan `--gen2` men körs som Cloud Run-tjänst i europe-west1. Oautentiserad åtkomst aktiverad via `gcloud run services add-iam-policy-binding`.

**Viktigt:** `enrichlisting` (gamla Firestore-triggern) är borttagen från Cloud Run. Om den dyker upp igen stör den pipeline.

---

## Firebase-struktur

### Firestore Collections

```
users/{uid}
  householdId, email, displayName, updatedAt

households/{householdId}
  name, members[uid1,uid2], inviteCode, createdBy, createdAt, anthropicKey

households/{householdId}/profiles/{profileId}
  name, priceMin/Max, sqmMin/Max, roomsMin/Max,
  noGroundFloor, balconyRequired, elevatorRequired, newConstruction,
  active, updatedAt

listings/{listingId}
  — Grunddata (från gmailPush):
  source, externalId, url, title, street, area, city,
  price, sqm, rooms, monthlyFee, hasBalcony, hasElevator,
  isNewConstruction, imageUrl, publishedAt, agentName, agencyName,
  matchedHouseholds[], createdAt

  — Berikningsdata (från enrichListingHttp):
  enriched (boolean), enrichMethod, enrichedAt, enrichAttempts, enrichFailedAt,
  description, builtYear, floor, numberOfFloors, energyClass,
  propertyDesignation, operatingCost, imageUrls[], viewings[],
  agentPhone, agentEmail, agencyUrl, agencyLogoUrl, brokerListingUrl
```

### Firestore Index
Krävs för listings-queryn:
- Collection: `listings`
- Fält 1: `matchedHouseholds` (Arrays)
- Fält 2: `createdAt` (Descending)

---

## GCP-konfiguration

### Projekt
- **Projekt-ID:** `flattracker-mph`
- **Firestore region:** `eur3` (europe-west)

### Secret Manager
| Namn | Innehåll |
|---|---|
| `ANTHROPIC_KEY` | Anthropic API-nyckel |
| `GMAIL_CREDENTIALS` | JSON-nyckel för `gmail-reader` tjänstkonto |

### Tjänstkonton
- `firebase-adminsdk-fbsvc@flattracker-mph.iam.gserviceaccount.com` — deploy (GitHub Actions)
- `flattracker-mph@appspot.gserviceaccount.com` — runtime
- `gmail-reader@flattracker-mph.iam.gserviceaccount.com` — Gmail domain-wide delegation

### Gmail
- Label: `Flat Tracker` (ID: `Label_1511809523074583918`)
- Filter: från `*@hemnet.se`, `*@booli.se`, `*@boneo.se`
- Push-prenumeration: förnyas var 6:e dag via `renewGmailPush`
- Manuell förnyelse: `https://us-central1-flattracker-mph.cloudfunctions.net/setupGmailPush`

---

## Olöst: Berikningsstrategin

### Problemet
Hemnet, Booli och Boneo skyddar sitt innehåll mot automatisk hämtning. Cloud Run kör på Googles datacenter-IP:er som kan identifieras och blockeras. Bevakningsmailen innehåller minimal data — mäklarnamn saknas, bilder saknas, kontaktinfo saknas.

### Försök som gjorts
1. Direkt hämtning av Hemnet-sida — `__NEXT_DATA__` ger 0 fält (blockeras)
2. Claude-extraktion av HTML — ger grunddata men inte bilder/kontakt
3. DuckDuckGo web search → mäklarens sajt — ej verifierat, troligen blockerat
4. Kombinerad strategi (steg 0-3) — alltid fallback till Hemnet+Claude

### Rekommenderade nästa steg (vid återuppstart)
1. **Verifiera DuckDuckGo** — testa manuellt via Cloud Shell om DDG-anrop fungerar från GCP
2. **Testa Booli** — Booli aggregerar data från alla mäklare och kan ge mer data
3. **Playwright i Cloud Run** — headless browser som beter sig som en människa. Robust lösning, ~$20-30/mån extra. Löser JavaScript-rendering och bot-skydd.
4. **Referer-kedja** — lägg till `Referer: https://www.hemnet.se/` vid hämtning av mäklarens sajt. Underskattat men effektivt.

### Mäklare i Malmö-området (bedömning bot-skydd)
Se `maklare-malmo.md` för fullständig lista. Kortversion:
- **Lågt bot-skydd** (direktfetch fungerar): Croisette, Erik Olsson, Bülow & Lind, Kenson & Ljung, Bolaget, Guldmark, BoDirekt
- **Högt bot-skydd** (kräver Playwright): Bjurfors, Fastighetsbyrån

---

## Teknisk skuld

Se `TECH_DEBT.md` för detaljer. Viktigaste punkterna:

- **Gen1 → Gen2 migrering** — alla funktioner bör migreras samlat, kräver `firebase-functions ^5.1.0`
- **Node.js 20 → 22** — måste göras senast oktober 2026, kräver gen2-migrering först
- **enrichListing (Firestore-trigger)** — pausad, kod finns kvar i index.js men ska tas bort vid gen2-migrering
- **pingSearch/testSearch/testDuckDuckGo** — testfunktioner som ska tas bort när verifiering är gjord

---

## Design

- **Primärfärg:** #1565C0 (MD Blue 800)
- **Accent:** #FF6F00 (MD Amber 900)
- **Bakgrund:** #F5F7FA
- **Typsnitt:** Roboto
- **Responsiv brytpunkt:** 768px

---

## Stänga av och återaktivera projektet

### Stänga av

**Cloud Functions (stoppar all bakgrundsaktivitet och kostnad):**
1. Gå till `https://console.cloud.google.com/functions?project=flattracker-mph`
2. Markera alla funktioner → Delete
3. Gå till `https://console.cloud.google.com/run?project=flattracker-mph`
4. Markera `enrichlistinghttp` → Delete

**Gmail push-prenumeration** slutar fungera automatiskt efter 7 dagar om ingen funktion förnyas den.

**Firebase/Firestore** — inget behöver stängas av. Gratisnivån (Spark) kostar ingenting vid låg aktivitet. Befintlig data ligger kvar.

**GitHub Pages och Actions** — gratis, inget att stänga av.

**Anthropic API** — förbrukas bara när Io används eller berikningsfunktionen körs. Stoppas automatiskt när funktionerna tas bort.

### Återaktivera

1. **Cloud Functions** — pusha en liten ändring i `functions/`-mappen (t.ex. uppdatera versionsstämpeln i `index.js`). GitHub Actions deployar automatiskt alla funktioner.
2. **Gmail push-prenumeration** — öppna en gång i webbläsaren efter deploy:
   `https://us-central1-flattracker-mph.cloudfunctions.net/setupGmailPush`
3. **Firestore-data** — ligger kvar, inget att göra.
4. **Firestore-index** — behövs bara återskapas om hela Firebase-projektet tagits bort.

Allt är återställt inom 5-10 minuter.

---

## Nästa sprint (vid återuppstart)

Enligt prioriteringsordning i BACKLOG.md:
1. **Io-systemprompt** — uppdatera IO_SYSTEM_PROMPT i constants.js med berikad data och faktabaserade riktlinjer
2. **Lös berikningsstrategin** — se rekommendationer ovan
3. **Sprint 11** — Områden och gator med gaturegistret för Malmö innerstad
4. **Sprint 10** — Annonsvy med bildgalleri och statusspårning
