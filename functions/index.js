const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { google } = require('googleapis');

admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_KEY');
const GMAIL_CREDENTIALS = defineSecret('GMAIL_CREDENTIALS');

const GMAIL_LABEL = 'Flat Tracker';
const PUBSUB_TOPIC = 'projects/flattracker-mph/topics/gmail-push';
const GMAIL_USER = 'mats@hultgrensaksi.com';

function getGmailClient(credentialsJson) {
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    clientOptions: { subject: GMAIL_USER },
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  });
  return google.gmail({ version: 'v1', auth });
}

async function getFlatTrackerLabelId(gmail) {
  const res = await gmail.users.labels.list({ userId: 'me' });
  const label = res.data.labels.find(l => l.name === GMAIL_LABEL);
  return label ? label.id : null;
}

function extractPlainText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return '';
}

async function extractListingsWithClaude(mailText, anthropicKey) {
  const prompt = 'Analysera det har bevakningsmaiet fran Hemnet eller Booli och extrahera alla lagenhetsannonser.\n\nReturnera ENBART ett JSON-objekt, ingen annan text:\n{\n  "listings": [\n    {\n      "source": "hemnet" eller "booli",\n      "externalId": "ID fran URL:en",\n      "url": "direktlank till annonsen",\n      "title": "gatuadress",\n      "street": "gatuadress",\n      "area": "stadsdel",\n      "city": "stad",\n      "price": pristal i kronor,\n      "sqm": kvadratmeter,\n      "rooms": antal rum,\n      "monthlyFee": manadsavgift i kronor (0 om okant),\n      "hasBalcony": true/false,\n      "hasElevator": true/false,\n      "isNewConstruction": true/false,\n      "imageUrl": "bild-URL om tillganglig",\n      "publishedAt": "ISO-datum om kant",\n      "agentName": "maklarens namn om tillgangligt, annars null",\n      "agencyName": "maklarfirmans namn om tillgangligt, annars null"\n    }\n  ]\n}\n\nMailinnehall:\n' + mailText.substring(0, 8000);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: 'Du ar en dataextraktor. Returnera ALLTID och ENBART giltig JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error('Claude API-fel: ' + res.status);
  const data = await res.json();
  const text = (data.content && data.content.find(b => b.type === 'text') || {}).text || '{}';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

function matchesProfile(listing, profile) {
  if (profile.priceMin  && listing.price < Number(profile.priceMin))  return false;
  if (profile.priceMax  && listing.price > Number(profile.priceMax))  return false;
  if (profile.sqmMin    && listing.sqm   < Number(profile.sqmMin))    return false;
  if (profile.sqmMax    && listing.sqm   > Number(profile.sqmMax))    return false;
  if (profile.roomsMin  && listing.rooms < Number(profile.roomsMin))  return false;
  if (profile.roomsMax  && listing.rooms > Number(profile.roomsMax))  return false;
  if (profile.noGroundFloor    && listing.isGroundFloor)  return false;
  if (profile.balconyRequired  && !listing.hasBalcony)    return false;
  if (profile.elevatorRequired && !listing.hasElevator)   return false;
  if (profile.newConstruction  && !listing.isNewConstruction) return false;
  return true;
}

async function saveListings(listings) {
  const householdsSnap = await db.collection('households').get();
  let savedCount = 0;
  for (const listing of listings) {
    if (!listing.externalId || !listing.source) continue;
    const docId = listing.source + '_' + listing.externalId;
    const ref = db.collection('listings').doc(docId);
    const existing = await ref.get();
    if (existing.exists) continue;
    const matchedHouseholds = [];
    for (const householdDoc of householdsSnap.docs) {
      const profilesSnap = await db
        .collection('households').doc(householdDoc.id)
        .collection('profiles').where('active', '==', true).get();
      const profiles = profilesSnap.docs.map(d => d.data());
      const hasMatch = profiles.length === 0 || profiles.some(p => matchesProfile(listing, p));
      if (hasMatch) matchedHouseholds.push(householdDoc.id);
    }
    await ref.set({
      ...listing,
      matchedHouseholds,
      createdAt: Date.now(),
      publishedAt: listing.publishedAt ? new Date(listing.publishedAt).getTime() : Date.now(),
    });
    savedCount++;
  }
  return savedCount;
}

exports.gmailPush = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB', secrets: ['ANTHROPIC_KEY', 'GMAIL_CREDENTIALS'] })
  .pubsub.topic('gmail-push')
  .onPublish(async function() {
    const gmail = getGmailClient(GMAIL_CREDENTIALS.value());
    const labelId = await getFlatTrackerLabelId(gmail);
    if (!labelId) { console.error('Label saknas.'); return; }
    const listRes = await gmail.users.messages.list({
      userId: 'me', labelIds: [labelId], q: 'is:unread', maxResults: 10,
    });
    const messages = listRes.data.messages || [];
    if (messages.length === 0) { console.log('Inga olasta mail.'); return; }
    for (const msg of messages) {
      try {
        const mailRes = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const mailText = extractPlainText(mailRes.data.payload);
        if (!mailText || mailText.length < 50) continue;
        const result = await extractListingsWithClaude(mailText, ANTHROPIC_KEY.value());
        const listings = result.listings || [];
        if (listings.length > 0) {
          const saved = await saveListings(listings);
          console.log(saved + ' nya annonser sparade.');
        }
        await gmail.users.messages.modify({
          userId: 'me', id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
      } catch (err) {
        console.error('Fel vid mail ' + msg.id + ': ' + err.message);
      }
    }
  });

exports.renewGmailPush = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB', secrets: ['GMAIL_CREDENTIALS'] })
  .pubsub.schedule('every 144 hours')
  .onRun(async function() {
    const gmail = getGmailClient(GMAIL_CREDENTIALS.value());
    const labelId = await getFlatTrackerLabelId(gmail);
    if (!labelId) return null;
    await gmail.users.watch({
      userId: 'me',
      requestBody: { labelIds: [labelId], topicName: PUBSUB_TOPIC },
    });
    console.log('Gmail push fornyad.');
    return null;
  });

exports.setupGmailPush = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB', secrets: ['GMAIL_CREDENTIALS'] })
  .https.onRequest(async function(req, res) {
    try {
      const gmail = getGmailClient(GMAIL_CREDENTIALS.value());
      const labelId = await getFlatTrackerLabelId(gmail);
      if (!labelId) { res.status(400).send('Gmail-label saknas.'); return; }
      await gmail.users.watch({
        userId: 'me',
        requestBody: { labelIds: [labelId], topicName: PUBSUB_TOPIC },
      });
      res.status(200).send('Gmail push aktiverat.');
    } catch (err) {
      console.error(err);
      res.status(500).send('Fel: ' + err.message);
    }
  });

// enrichListing — Cloud Function som hämtar fullständig annonsdata från Hemnet/Booli
// Triggas automatiskt när en ny annons skapas i Firestore listings/

// db är redan definierad i index.js

// ── Hemnet HTML-parser ───────────────────────────────────────────────
function parseHemnetPage(html) {
  const result = {};

  // Beskrivningstext
  const descMatch = html.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (descMatch) {
    result.description = descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Alla bilder
  const imageUrls = [];
  const imgRegex = /https:\/\/bilder\.hemnet\.se\/images\/[^"'\s]+/g;
  const imgMatches = html.match(imgRegex);
  if (imgMatches) {
    const unique = [...new Set(imgMatches.filter(u => !u.includes('_cut')))];
    imageUrls.push(...unique.slice(0, 20));
  }
  result.imageUrls = imageUrls;

  // Mäklarfirma
  const agencyMatch = html.match(/"broker_agency_name"\s*:\s*"([^"]+)"/i) ||
    html.match(/class="[^"]*broker[^"]*agency[^"]*"[^>]*>([^<]+)</) ||
    html.match(/<span[^>]*class="[^"]*agency[^"]*"[^>]*>([^<]+)<\/span>/i);
  if (agencyMatch) result.agencyName = agencyMatch[1].trim();

  // Mäklare namn
  const agentMatch = html.match(/"broker_name"\s*:\s*"([^"]+)"/i) ||
    html.match(/class="[^"]*broker[^"]*name[^"]*"[^>]*>([^<]+)</) ||
    html.match(/"agent"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i);
  if (agentMatch) result.agentName = agentMatch[1].trim();

  // Mäklare telefon
  const phoneMatch = html.match(/"broker_phone_number"\s*:\s*"([^"]+)"/i) ||
    html.match(/href="tel:([^"]+)"/i);
  if (phoneMatch) result.agentPhone = phoneMatch[1].trim();

  // Mäklare e-post
  const emailMatch = html.match(/"broker_email"\s*:\s*"([^"]+)"/i) ||
    html.match(/href="mailto:([^"]+)"/i);
  if (emailMatch) result.agentEmail = emailMatch[1].trim();

  // Mäklarfirmans URL
  const agencyUrlMatch = html.match(/"broker_agency_url"\s*:\s*"([^"]+)"/i) ||
    html.match(/class="[^"]*broker[^"]*logo[^"]*"[^>]*href="([^"]+)"/i);
  if (agencyUrlMatch) result.agencyUrl = agencyUrlMatch[1].trim();

  // Mäklarfirmans logotyp
  const agencyLogoMatch = html.match(/"broker_agency_logo_url"\s*:\s*"([^"]+)"/i) ||
    html.match(/class="[^"]*broker[^"]*logo[^"]*"[^>]*src="([^"]+)"/i);
  if (agencyLogoMatch) result.agencyLogoUrl = agencyLogoMatch[1].trim();

  // Byggår
  const builtMatch = html.match(/"construction_year"\s*:\s*(\d{4})/i) ||
    html.match(/Byggår[^<]*<[^>]+>(\d{4})/i);
  if (builtMatch) result.builtYear = parseInt(builtMatch[1]);

  // Driftskostnad
  const operatingMatch = html.match(/"operating_cost"\s*:\s*(\d+)/i) ||
    html.match(/Driftskostnad[^<]*<[^>]+>([\d\s]+)kr/i);
  if (operatingMatch) result.operatingCost = parseInt(operatingMatch[1].replace(/\s/g, ''));

  // Månadsavgift (om ej redan känd)
  const feeMatch = html.match(/"fee"\s*:\s*(\d+)/i) ||
    html.match(/Avgift[^<]*<[^>]+>([\d\s]+)kr/i);
  if (feeMatch) result.monthlyFee = parseInt(feeMatch[1].replace(/\s/g, ''));

  // Energiklass
  const energyMatch = html.match(/"energy_class"\s*:\s*"([A-G])"/i) ||
    html.match(/Energiklass[^<]*<[^>]+>([A-G])</i);
  if (energyMatch) result.energyClass = energyMatch[1];

  // Fastighetsbeteckning
  const propDesigMatch = html.match(/"property_designation"\s*:\s*"([^"]+)"/i) ||
    html.match(/Fastighetsbeteckning[^<]*<[^>]+>([^<]+)</i);
  if (propDesigMatch) result.propertyDesignation = propDesigMatch[1].trim();

  // Våningsplan
  const floorMatch = html.match(/"floor"\s*:\s*(\d+)/i) ||
    html.match(/Våning[^<]*<[^>]+>(\d+)/i);
  if (floorMatch) result.floor = parseInt(floorMatch[1]);

  // Antal våningar i byggnaden
  const floorsMatch = html.match(/"number_of_floors"\s*:\s*(\d+)/i);
  if (floorsMatch) result.numberOfFloors = parseInt(floorsMatch[1]);

  // Direktlänk till mäklarens annons — leta efter extern URL i JSON-data
  const brokerUrlMatch = html.match(/"broker_listing_url"\s*:\s*"([^"]+)"/i) ||
    html.match(/"external_url"\s*:\s*"([^"]+)"/i);
  if (brokerUrlMatch) result.brokerListingUrl = brokerUrlMatch[1].trim();

  return result;
}

// ── Hämta Hemnet-sida ────────────────────────────────────────────────
async function fetchHemnetPage(url) {
  // Rensa UTM-parametrar och normalisera URL
  const cleanUrl = url.replace(/\?.*$/, '').replace(/[^/]+-(\d+)$/, (_, id) => {
    return url.includes('hemnet') ? `bostad/-${id}` : url;
  });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} vid hämtning av ${url}`);
  return await res.text();
}

// ── Cloud Function: Berika annons ────────────────────────────────────
exports.enrichListing = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('listings/{listingId}')
  .onCreate(async (snap, context) => {
    const listing = snap.data();
    const listingId = context.params.listingId;

    // Hoppa över om det inte finns en URL att hämta
    if (!listing.url) {
      console.log(`Annons ${listingId}: ingen URL, hoppar över berikande.`);
      return;
    }

    // Hoppa över om redan berikad
    if (listing.enriched) {
      console.log(`Annons ${listingId}: redan berikad.`);
      return;
    }

    console.log(`Berikare ${listingId}: hämtar ${listing.url}`);

    try {
      // Kort fördröjning för att undvika bot-detektering
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

      const html = await fetchHemnetPage(listing.url);
      const enriched = parseHemnetPage(html);

      // Uppdatera Firestore med berikad data
      await snap.ref.update({
        ...enriched,
        enriched: true,
        enrichedAt: Date.now(),
      });

      const fieldsFound = Object.keys(enriched).filter(k => enriched[k] !== null && enriched[k] !== undefined).length;
      console.log(`Annons ${listingId}: berikad med ${fieldsFound} nya fält.`);

    } catch (err) {
      console.error(`Annons ${listingId}: fel vid berikande: ${err.message}`);
      // Markera som försökt men ej lyckad — försök inte om igen automatiskt
      await snap.ref.update({
        enriched: false,
        enrichError: err.message,
        enrichedAt: Date.now(),
      }).catch(() => {});
    }
  });
