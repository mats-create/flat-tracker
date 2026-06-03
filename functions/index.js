// index.js — Cloud Functions för Flat Tracker
// Version: 2026-06-03 15:55 CET
// Ändringar: enrichListing läser från Firestore direkt när event.data är undefined (gcloud deploy-mismatch)

const functions = require('firebase-functions');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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

// ════════════════════════════════════════════════════════════════════
// enrichListing — berika annons med fullständig data från källsajten
// Triggas automatiskt vid ny annons i Firestore listings/
// Strategi: försök __NEXT_DATA__ JSON → fallback Claude-extraktion
// ════════════════════════════════════════════════════════════════════

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

async function fetchListingPage(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} för ${url}`);
  return await res.text();
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type=\"application\/json\">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseHemnetNextData(nextData) {
  const result = {};
  try {
    const props = nextData?.props?.pageProps || {};
    const listing = props.listing || props.property || props.home || {};
    const broker = listing.broker || listing.agent || {};
    const agency = listing.brokerAgency || listing.agency || broker.agency || {};

    if (listing.description)      result.description        = listing.description;
    if (listing.constructionYear) result.builtYear          = listing.constructionYear;
    if (listing.floor)            result.floor              = listing.floor;
    if (listing.numberOfFloors)   result.numberOfFloors     = listing.numberOfFloors;
    if (listing.energyClass)      result.energyClass        = listing.energyClass;
    if (listing.propertyDesignation || listing.cadastralDesignation)
      result.propertyDesignation = listing.propertyDesignation || listing.cadastralDesignation;
    if (listing.fee)              result.monthlyFee         = listing.fee;
    if (listing.operatingCost)    result.operatingCost      = listing.operatingCost;

    const images = listing.images || listing.uploads || [];
    if (images.length > 0) {
      result.imageUrls = images
        .map(i => i.url || i.src || i.original || null)
        .filter(Boolean).slice(0, 20);
    }

    if (broker.name)        result.agentName     = broker.name;
    if (broker.phoneNumber) result.agentPhone    = broker.phoneNumber;
    if (broker.email)       result.agentEmail    = broker.email;
    if (agency.name)        result.agencyName    = agency.name;
    if (agency.url)         result.agencyUrl     = agency.url;
    if (agency.logoUrl || agency.logo)
      result.agencyLogoUrl = agency.logoUrl || agency.logo;
    if (listing.externalUrl || listing.brokerListingUrl)
      result.brokerListingUrl = listing.externalUrl || listing.brokerListingUrl;

    const viewings = listing.viewings || listing.openHouses || [];
    if (viewings.length > 0) {
      result.viewings = viewings.map(v => ({
        date: v.date || v.startTime || null,
        startTime: v.startTime || v.start || null,
        endTime: v.endTime || v.end || null,
      }));
    }
  } catch (err) {
    console.warn('Fel vid parsning av __NEXT_DATA__:', err.message);
  }
  return result;
}

async function enrichWithClaude(html, url, anthropicKey) {
  const source = url.includes('booli') ? 'Booli' : url.includes('boneo') ? 'Boneo' : 'Hemnet';
  const trimmed = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim().substring(0, 6000);

  const prompt = `Extrahera annonsdata från denna ${source}-sida och returnera ENBART ett JSON-objekt:
{
  "agentName": null,
  "agentPhone": null,
  "agentEmail": null,
  "agencyName": null,
  "agencyUrl": null,
  "brokerListingUrl": null,
  "description": null,
  "builtYear": null,
  "floor": null,
  "energyClass": null,
  "propertyDesignation": null,
  "monthlyFee": null,
  "operatingCost": null,
  "imageUrls": [],
  "viewings": []
}
Fyll i de fält du hittar. Sidinnehåll:\n${trimmed}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'Du är en dataextraktor. Returnera ALLTID och ENBART giltig JSON utan kommentarer.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error('Claude API-fel: ' + res.status);
  const data = await res.json();
  const text = (data.content.find(b => b.type === 'text') || {}).text || '{}';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

function isEnrichmentSufficient(enriched) {
  const keyFields = ['agentName', 'agencyName', 'description', 'imageUrls'];
  const found = keyFields.filter(k => enriched[k] &&
    (Array.isArray(enriched[k]) ? enriched[k].length > 0 : String(enriched[k]).length > 0)
  );
  return found.length >= 2;
}

exports.enrichListing = onDocumentCreated(
  {
    document: 'listings/{listingId}',
    region: 'europe-west1',
    secrets: ['ANTHROPIC_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (event) => {
    const listingId = event.params.listingId;

    // Gen2 via gcloud: event.data kan vara undefined — läs direkt från Firestore
    let snap, listing;
    if (event.data) {
      snap = event.data;
      listing = snap.data();
    } else {
      console.log(`${listingId}: event.data undefined, hämtar från Firestore direkt.`);
      const ref = db.collection('listings').doc(listingId);
      snap = await ref.get();
      if (!snap.exists) {
        console.log(`${listingId}: dokument finns inte, hoppar över.`);
        return;
      }
      listing = snap.data();
    }

    if (!listing.url) {
      console.log(`${listingId}: ingen URL, hoppar över.`);
      return;
    }
    if (listing.enriched) {
      console.log(`${listingId}: redan berikad.`);
      return;
    }

    console.log(`${listingId}: berikare startar för ${listing.url}`);

    try {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      const html = await fetchListingPage(listing.url);
      let enriched = {};
      let method = 'none';

      // Strategi A: __NEXT_DATA__ JSON (Hemnet är Next.js)
      if (listing.source === 'hemnet') {
        const nextData = extractNextData(html);
        if (nextData) {
          enriched = parseHemnetNextData(nextData);
          method = 'next_data';
          console.log(`${listingId}: __NEXT_DATA__ hittad, ${Object.keys(enriched).length} fält.`);
        }
      }

      // Strategi B: Claude-fallback (Booli, Boneo, eller om A gav för lite)
      if (!isEnrichmentSufficient(enriched)) {
        console.log(`${listingId}: otillräcklig data (${method}), kör Claude-fallback.`);
        const claudeData = await enrichWithClaude(html, listing.url, ANTHROPIC_KEY.value());
        enriched = { ...claudeData, ...enriched };
        method = method === 'next_data' ? 'next_data+claude' : 'claude';
      }

      const fieldsFound = Object.keys(enriched).filter(k =>
        enriched[k] !== null && enriched[k] !== undefined &&
        (Array.isArray(enriched[k]) ? enriched[k].length > 0 : true)
      ).length;

      await snap.ref.update({
        ...enriched,
        enriched: true,
        enrichMethod: method,
        enrichedAt: Date.now(),
      });

      console.log(`${listingId}: berikad via ${method} med ${fieldsFound} fält.`);

    } catch (err) {
      console.error(`${listingId}: fel vid berikande: ${err.message}`);
      await snap.ref.update({
        enriched: false,
        enrichError: err.message,
        enrichedAt: Date.now(),
      }).catch(() => {});
    }
  }
);