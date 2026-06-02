# Flat Tracker — Backlog

> Senast uppdaterad: 2026-06-02 (session 3)

---

## ✅ Slutförda sprints

### Sprint 1 — Projektscaffold
- React + Firebase setup, samma mönster som Cross Pass/Game Tracker/Job Tracker
- 4-tab navigation (Flöde, Bevakning, Io, Områden)
- Material Design tema, mobil-först
- Google Sign-In
- Mock-data för lägenheter och områden
- GitHub Actions auto-build workflow
- GitHub secret_scanning.yml
- Firebase Auth + Firestore konfigurerat
- PWA manifest

### Sprint 2 — Hushållsstruktur
- Hushåll med max 2 medlemmar
- Skapa hushåll → inbjudningskod (6 tecken)
- Gå med i hushåll via kod
- Firestore-struktur och säkerhetsregler för hushåll
- Allt UI på svenska

### Sprint 2b — Responsiv layout
- Desktop sidebar (≥ 768px) med vänsternavigation
- Mobil bottom nav (< 768px)
- Brytpunkt 768px
- Kortgrid på stora skärmar

### Sprint 3 — Polish & infrastruktur
- Favicon: SVG-logotyp (platsmarkör med hussiluett, blå + orange)
- Inställningsmeny bakom ⚙️/avatar
- Inbjudningskod synlig i inställningar med kopiera-knapp
- Anthropic API-nyckel i inställningar (bara synlig för hushållsägare)
- Medsökarens vy av Io-status
- Kugghjul dolt i toppraden på desktop

### Sprint 4 — Io AI-assistent
- Io ersätter Hunter (namnbyte)
- Flyout-panel istället för egen flik
- Desktop: glider in från höger, skjuter mittspaltens utrymme
- Mobil: bottom sheet (85vh)
- FAB-knapp följer med app-body på desktop
- Haiku-modell (kostnadseffektiv)
- API-nyckel från hushållets Firestore-dokument
- Korrekt browser-header: anthropic-dangerous-direct-browser-access

### Sprint 5 — Bevakningsprofiler
- Max 5 profiler per hushåll
- Kriterier: pris, storlek, rum, bottenvåning, balkong, hiss, nyproduktion
- Aktiv/inaktiv toggle
- Skapa, redigera, ta bort
- Sparas i Firestore, delas i realtid med hushållet
- Toggle och checkbox UI-komponenter

### Sprint 6 — Datapipeline: Gmail push → Firestore
- Gmail push-integration via Cloud Functions
- Automatisk hämtning av bevakningsmail från Hemnet och Booli
- Claude API extraherar strukturerad annonsdata från mailtext
- Firestore-index för listings-query
- FeedScreen ersätter mock-data med realtidslyssnare mot Firestore
- GitHub Actions deployment via gcloud functions deploy
- Tre Cloud Functions: gmailPush, setupGmailPush, renewGmailPush
- Dokumentation: CLOUD_FUNCTIONS_SETUP.md och POST_MORTEM.md

### Sprint 7 — Flödet: listvy och användbarhet (pågående)
- Ny ListingCard med mäklare, ansvarig säljare, visningstider
- Sortering: datum, rum, storlek, pris
- Filtrering: källa, mäklare, område, gata, bevakade
- Bevaka-knapp per annons med Firestore-persistens
- Io-analys som expanderbar sektion per annons
- Importknapp borttagen — statusrad istället
- Logga ut uppflyttad i inställningar
- Login-skärm och spinner centrerade i viewport
- Io-flyout på desktop som overlay (ingen layout-shift)

---

## 🔄 Pågående

### Gaturegister — Malmö Innerstad
- 26 delområden kartlagda med föräldradistrikt och gränsgator
- ~196 unika gatunamn mappade till respektive område
- Prioritetsregler definierade för gator som löper längs områdesgränser
- JSON-fil framtagen, redo att integreras i Firestore
- Google Maps API utvärderat: Maps JS för kartvy, Geocoding som fallback vid delade gator

---

## 📋 Planerat

### Sprint 8 — Annonsberikare: hämta fullständig annonsdata
> Prioritet: hög — kärndata för meningsfull Io-analys och användarbeslut.

**Trigger**
- Cloud Function triggas automatiskt när en ny annons sparas i Firestore
- Hämtar annonsens Hemnet/Booli-URL och besöker sidan

**Data som hämtas från annonssidan**
- Mäklarfirmans namn och logotyp-URL
- Ansvarig mäklares namn, telefonnummer och e-post
- Direktlänk till mäklarens profil på mäklarfirmans sajt
- Direktlänk till annonsen hos mäklaren (ej bara Hemnet)
- Fullständig beskrivningstext (rumsbeskrivningar, skick, standard m.m.)
- Alla bilder — lista med URL:er lagrade i Firestore
- Visningstider med datum och klockslag
- Driftskostnad, taxeringsvärde, byggår, energiklass, tomträtt/äganderätt
- Fastighetsbeteckning

**Arkitektur**
- Ny Cloud Function: enrichListing — triggas av Firestore onWrite på listings/
- Uppdaterar befintligt Firestore-dokument med berikad data
- Deployed via GitHub Actions precis som övriga funktioner
- Fel-tolerant: partiell data sparas, saknade fält är null

**Io-systemprompt uppdateras**
- Io känner till alla berikade datafält och kan referera till dem i analys

### Sprint 9 — Io bildanalys
> Prioritet: medel — kräver att Sprint 8 är klar (bild-URL:er måste finnas i Firestore).

**Modellstrategi**
- Io-chatten fortsätter på Haiku (billig, snabb för textsvar)
- Annonsspecifik Io-analys (Bevaka-knappen) körs på Sonnet 4.6 (stöder vision)
- Motivering: bildanalys görs sällan och ger stort värde — kostnaden är försumbar

**Vad Io kan analysera i bilder**
- Allmänt skick och standard (nyrenoverat, slitet, genomsnittligt)
- Rumskaraktär: ljusinsläpp, takhöjd, planlösning, snickerier
- Kökets standard och utrustning
- Badrumsstandard
- Golvmaterial och ytskikt
- Eventuella renoveringsbehov som syns
- Övergripande känsla och stil

**Flöde**
- Annonsens bild-URL:er hämtas från Firestore (lagrade av Sprint 8)
- Claude Sonnet anropas med upp till 5 bilder + annonsdata som kontext
- Analysen sparas i Firestore under annonsen (cachas, görs bara en gång)
- Visas i expanderbar Io-analys-sektion i ListingCard

### Sprint 10 — Annonsvy (detaljsida)
> Prioritet: medel — kompletterar listvy med fullständig annonsinfo och bildgalleri.

- Detaljvy för enskild annons (tap/klick på annonskortet)
- Bildgalleri med alla bilder från Sprint 8
- Alla tillgängliga datapunkter visas strukturerat
- Direktlänkar till Hemnet och mäklarens sajt
- Kommentarer per annons (delas med hushållet i realtid)
- Statusspårning: Ny → Intressant → Visning bokad → Bud → Avslutad

### Sprint 11 — Områden och gator: grund
> Prioritet: hög — kärnfunktionalitet för granulär bevakning.

- Skapa och hantera bevakade områden (stad → stadsdel)
- Lägga till gator per område
- Koppla bevakningsprofiler till områden/gator
- Bevakning aktiv/inaktiv per gata
- Sparas i Firestore under hushållet
- Ladda gaturegistret (Malmö Innerstad) som grunddata vid första uppstart
- Inkluderande och exkluderande gator per profil
- Fritextsök på gatunamn med autocomplete

### Sprint 12 — Områden och gator: kartvy och Io-stöd
> Prioritet: medel — kräver att sprint 11 är stabil.

- Kartvy (Google Maps JS) för visuell gatuselektion
- Grön/röd distinktion för inkluderade/exkluderade gator
- Io kan föreslå, lägga till och ta bort gator via naturligt språk
- Io kan sammanfatta aktiva sökvillkor

### Sprint 13 — Notiser
- Push-notiser när ny annons matchar profil
- Firebase Cloud Messaging (FCM)
- Notis-inställningar per profil

### Sprint 14 — Io: utökad kontext och analysläge
- Spara chatthistorik i Firestore (per hushåll)
- Io känner till hushållets aktiva profiler och bevakade områden
- Io kan på begäran analysera specifik lägenhet, gata eller område
- Io-analys triggas från annonskortet eller explicit begäran
- Analysen visas i expanderbar sektion — inte i chattfönstret

### Sprint 15 — Områdesinsikter
- Riktiga områdesprofiler (ersätt mock-data)
- Snittpris per m² per område
- Prisutveckling över tid
- Popularitetsindikator
- Gatunivå-statistik

### Sprint 16 — Fastighets- och föreningsdata
- Insamling startar när annons bevakas
- BRF-data: årsredovisningar, skuldsättning, underhållsplan
- Alternativa källor: Bolagsverket, allabolag.se, Lantmäteriet
- Io analyserar och ger rekommendationer baserat på samlad data

---

## 💡 Idéer och diskussionspunkter

- **Budgivningsläge** — spåra aktiva budgivningar på intressanta objekt
- **Prisvarningar** — notis när priserna sjunker i ett bevakat område
- **Visningskalender** — integrera bokade visningar i en kalendervy
- **Jämförelsevy** — ställ två annonser mot varandra, inklusive Io-analys av båda
- **Exportfunktion** — exportera sparade annonser som PDF
- **Boneo-prioritet** — mindre känd källa, kan ha mindre konkurrens
- **Io proaktiva tips** — Io föreslår annonser baserat på profil utan att frågas

---

## 🐛 Kända buggar och teknisk skuld

- Io-chatthistorik försvinner vid sidomladdning (ej Firestore-persisterad)
- `favicon-192.png` saknas (ofarligt, favicon.svg används)
- Bekräftelsedialog för profilborttagning använder native window.confirm — bör ersättas med custom modal
- Io FAB syns även på desktop (ska kanske döljas där Io-länken finns i sidebar)
- Mock-data används fortfarande i Områden-skärmen
- renewGmailPush schemalagd via Pub/Sub istället för Cloud Scheduler (teknisk skuld)
- Node.js 20 deprecated i Cloud Functions — bör uppgraderas till Node.js 22 innan oktober 2026
