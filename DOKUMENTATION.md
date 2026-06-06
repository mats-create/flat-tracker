# Flat Tracker — Dokumentationsöversikt

> Skapad: 2026-06-05 11:45 CET
> Syfte: Snabb orientering vid återstart av projektet

---

## Var börjar jag?

Läs filerna i denna ordning:

1. **HANDOVER.md** — börja här. Ger dig hela bilden på en gång.
2. **BACKLOG.md** — vad som är gjort och vad som återstår.
3. **TECH_DEBT.md** — tekniska problem som måste lösas förr eller senare.

De övriga filerna är referensdokumentation — slå upp dem när du behöver specifik information.

---

## Filbeskrivningar

### HANDOVER.md
**Vad:** Projektets huvuddokument. Uppdateras vid varje session.

**Innehåller:**
- Arbetssätt och samarbetsprinciper med Claude
- Tech stack och projektstruktur
- Nuvarande tillstånd — vad som fungerar och vad som inte fungerar
- Hela datapipelinen från bevakningsmail till appen
- Cloud Functions-status och GCP-konfiguration
- Firestore-struktur och säkerhetsregler
- Olöst: berikningsstrategin med rekommenderade nästa steg
- Hur man stänger av och återaktiverar projektet
- Nästa sprint vid återuppstart

**Läs när:** Du startar om projektet och behöver förstå var du är.

---

### BACKLOG.md
**Vad:** Prioriterad lista över alla sprints — slutförda, pågående och planerade.

**Innehåller:**
- Fastställd prioriteringsordning (sprint 8-16)
- Detaljerad beskrivning av varje sprint
- Kända buggar och teknisk skuld (sammanfattning)
- Idéer och diskussionspunkter
- Io förbättringsområden (inklusive webbsökning)

**Läs när:** Du ska besluta vad som ska göras härnäst.

---

### TECH_DEBT.md
**Vad:** Detaljerad plan för att hantera teknisk skuld på ett kontrollerat sätt.

**Innehåller:**
- Gen1 → Gen2 Cloud Functions migrering med exakt syntax för alla funktioner
- Checklista i rätt ordning för migreringen
- Uppdaterad `deploy-functions.yml` för efter migrering
- Node.js 20 → 22 uppgradering (deadline oktober 2026)
- `setup-flattracker.sh` script för att återskapa GCP-miljön från scratch
- Övrig teknisk skuld (Io-chatthistorik, window.confirm-dialog etc.)

**Läs när:** Du ska göra gen2-migreringen eller uppgradera Node.js.

---

### POST_MORTEM.md
**Vad:** Lärdomar från Gmail push-integrationen (Sprint 6).

**Innehåller:**
- Vad som gick fel och varför (18+ misslyckade deploy-försök)
- Rotorsaker: fel deploy-metod, fel tjänstkonto, Apify-kostnader
- Det fungerande GitHub Actions-mönstret med `gcloud functions deploy`
- **Kritisk regel:** Använd alltid `gcloud functions deploy` — aldrig `firebase deploy` med `defineSecret`
- Tidslinje över vad som hände

**Läs när:** Du ska sätta upp nya Cloud Functions eller felsöka deploy-problem.

---

### CLOUD_FUNCTIONS_SETUP.md
**Vad:** Komplett teknisk referens för hela GCP-miljön.

**Innehåller:**
- Alla tre Cloud Functions och deras syfte
- GitHub Actions deployment-workflow
- IAM-roller för deploy- och runtime-tjänstkonton
- Secret Manager-hemligheter
- Aktiverade API:er
- Gmail push-konfiguration (label, filter, Pub/Sub topic)
- Firestore-index
- Underhållsinstruktioner

**Läs när:** Du ska återskapa GCP-miljön från scratch, lägga till nya hemligheter eller felsöka behörighetsproblem.

---

### maklare-malmo.md
**Vad:** Lista över de 15-20 största mäklarfirmorna i Malmö-området.

**Innehåller:**
- Namn, URL och bedömning av bot-skyddsnivå (lågt/medel/högt)
- Vilka mäklare som är lämpliga för direktfetch
- Strategi för datahämtning per mäklare
- Slutsats om success rate vid automatisk datahämtning

**Läs när:** Du ska implementera berikningsstrategin och behöver veta vilka mäklarsajter som är tillgängliga.

---

## Snabbreferens — viktiga URL:er

| Vad | URL |
|---|---|
| Appen | https://mats-create.github.io/flat-tracker/ |
| GitHub-repo | https://github.com/mats-create/flat-tracker |
| GitHub Actions | https://github.com/mats-create/flat-tracker/actions |
| Firebase Console | https://console.firebase.google.com/project/flattracker-mph |
| Firestore | https://console.firebase.google.com/project/flattracker-mph/firestore |
| Cloud Functions (gen1) | https://console.cloud.google.com/functions?project=flattracker-mph |
| Cloud Run | https://console.cloud.google.com/run?project=flattracker-mph |
| Secret Manager | https://console.cloud.google.com/security/secret-manager?project=flattracker-mph |
| Anthropic Console | https://console.anthropic.com |
| Aktivera Gmail push | https://us-central1-flattracker-mph.cloudfunctions.net/setupGmailPush |

---

## Snabbreferens — viktiga beslut

| Beslut | Motivering |
|---|---|
| `gcloud functions deploy`, aldrig `firebase deploy` | Firebase CLI bug #8775 med defineSecret |
| Gen1 för alla funktioner tills vidare | Gen2-migrering kräver samlat arbete, se TECH_DEBT.md |
| `enrichListingHttp` (HTTP) istället för Firestore-trigger | Gen2 Firestore-trigger fungerar inte med gcloud deploy |
| Haiku för Io och berikningsfunktionen | Kostnadseffektivt, tillräcklig kapacitet |
| Gmail push istället för Apify | Apify kostade $29/mån, Gmail push är gratis |
