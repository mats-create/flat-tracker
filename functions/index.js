const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

admin.initializeApp();
const db = admin.firestore();

const GMAIL_LABEL = 'Flat Tracker';
const PUBSUB_TOPIC = 'projects/flattracker-mph/topics/gmail-push';

// ── Hjälp: Gmail-klient ──────────────────────────────────────────────
function getGmailClient() {
  const credentials = JSON.parse(process.env.GMAIL_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    clientOptions: {
      subject: process.env.GMAIL_USER,
    },
  });
  return google.gmail({ version: 'v1', auth });
}

// ── Hjälp: Hämta label-ID ────────────────────────────────────────────
async function getFlatTrackerLabelId(gmail) {
  const res = await gmail.users.labels.list({ userId: 'me' });
  const label = res.data.labels.find(l => l.name === GMAIL_LABEL);
  return label ? label.id : null;
}

// ── Hjälp: Läs mailtext ─────────────────────────────────────────────
function extractPlainText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
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

// ── Hjälp: Extrahera annonser via Claude ────────────────────────────
async function extractListingsWithClaude(mailText) {
  const prompt = `Analysera det här bevakningsmaiet från Hemnet eller Booli och extrahera alla lägenhetsannonser.

Returnera ENBART ett JSON-objekt, ingen annan text:
{
  "listings": [
    {
      "source": "hemnet" eller "booli",
      "externalId": "ID från URL:en",
      "url": "direktlänk till annonsen",
      "title": "gatuadress",
      "street": "gatuadress",
      "area": "stadsdel",
      "city": "stad",
      "price": pristal i kronor,
      "sqm": kvadratmeter,
      "rooms": antal rum,
      "monthlyFee": månadsavgift i kronor (0 om okänt),
      "hasBalcony": true/false,
      "hasElevator": true/false,
      "isNewConstruction": true/false,
      "imageUrl": "bild-URL om tillgänglig",
      "publishedAt": "ISO-datum om känt"
    }
  ]
}

Mailinnehåll:
${mailText.substring(0, 8000)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: 'Du är en dataextraktor. Returnera ALLTID och ENBART giltig JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API-fel: ${res.status}`);
  const data = await res.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '{}';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ── Hjälp: Matcha mot profiler ───────────────────────────────────────
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

// ── Hjälp: Spara i Firestore ─────────────────────────────────────────
async function saveListings(listings) {
  const householdsSnap = await db.collection('households').get();
  let savedCount = 0;

  for (const listing of listings) {
    if (!listing.externalId || !listing.source) continue;
    const docId = `${listing.source}_${listing.externalId}`;
    const ref = db.collection('listings').doc(docId);
    const existing = await ref.get();
    if (existing.exists) continue;

    const matchedHouseholds = [];
    for (const householdDoc of householdsSnap.docs) {
      const profilesSnap = await db
        .collection('households').doc(householdDoc.id)
        .collection('profiles')
        .where('active', '==', true)
        .get();
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

// ── Cloud Function: Ta emot Gmail push ──────────────────────────────
exports.gmailPush = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.topic('gmail-push')
  .onPublish(async () => {
    console.log('Gmail push-notis mottagen.');
    const gmail = getGmailClient();
    const labelId = await getFlatTrackerLabelId(gmail);
    if (!labelId) { console.error('Label saknas.'); return; }

    const listRes = await gmail.users.messages.list({
      userId: 'me', labelIds: [labelId], q: 'is:unread', maxResults: 10,
    });
    const messages = listRes.data.messages || [];
    if (messages.length === 0) { console.log('Inga olästa mail.'); return; }

    for (const msg of messages) {
      try {
        const mailRes = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const mailText = extractPlainText(mailRes.data.payload);
        if (!mailText || mailText.length < 50) continue;
        const result = await extractListingsWithClaude(mailText);
        const listings = result.listings || [];
        if (listings.length > 0) {
          const saved = await saveListings(listings);
          console.log(`${saved} nya annonser sparade från mail ${msg.id}.`);
        }
        await gmail.users.messages.modify({
          userId: 'me', id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
      } catch (err) {
        console.error(`Fel vid mail ${msg.id}:`, err.message);
      }
    }
  });

// ── Cloud Function: Förnya Gmail push var 6:e dag ────────────────────
exports.renewGmailPush = functions
  .runWith({ timeoutSeconds: 60, memory: '128MB' })
  .pubsub.schedule('every 144 hours')
  .onRun(async () => {
    const gmail = getGmailClient();
    const labelId = await getFlatTrackerLabelId(gmail);
    if (!labelId) return null;
    await gmail.users.watch({
      userId: 'me',
      requestBody: { labelIds: [labelId], topicName: PUBSUB_TOPIC },
    });
    console.log('Gmail push-prenumeration förnyad.');
    return null;
  });

// ── Cloud Function: Aktivera Gmail push (körs en gång) ───────────────
exports.setupGmailPush = functions
  .runWith({ timeoutSeconds: 60, memory: '128MB' })
  .https.onRequest(async (req, res) => {
    try {
      const gmail = getGmailClient();
      const labelId = await getFlatTrackerLabelId(gmail);
      if (!labelId) { res.status(400).send('Gmail-label saknas.'); return; }
      await gmail.users.watch({
        userId: 'me',
        requestBody: { labelIds: [labelId], topicName: PUBSUB_TOPIC },
      });
      res.status(200).send('Gmail push aktiverat.');
    } catch (err) {
      console.error(err);
      res.status(500).send(`Fel: ${err.message}`);
    }
  });
