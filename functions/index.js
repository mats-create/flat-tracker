const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// ─── Apify-konfiguration ───────────────────────────────────────────────────
// Actor-ID för Hemnet och Booli på Apify
const HEMNET_ACTOR_ID = "lexis-solutions/hemnet-se-scraper";
const BOOLI_ACTOR_ID = "lexis-solutions/booli-se-scraper";

// Sökparametrar för Malmö (utökas med fler städer senare)
const SEARCH_LOCATIONS = ["Malmö"];

// ─── Hjälpfunktioner ────────────────────────────────────────────────────────

/**
 * Kör en Apify-actor och väntar på resultatet.
 * Returnerar array med rådata från Apify.
 */
async function runApifyActor(actorId, input, apiToken) {
  try {
    // Starta körning
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`,
      input,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        params: { waitForFinish: 120 }, // vänta max 2 minuter
      }
    );

    const runId = runResponse.data.data.id;
    const datasetId = runResponse.data.data.defaultDatasetId;

    // Hämta resultat från datasetet
    const dataResponse = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
        params: { format: "json", limit: 200 },
      }
    );

    return dataResponse.data || [];
  } catch (error) {
    console.error(`Fel vid körning av Apify-actor ${actorId}:`, error.message);
    return [];
  }
}

/**
 * Normaliserar ett Hemnet-objekt till vår gemensamma listingstruktur.
 */
function normalizeHemnetListing(raw) {
  try {
    return {
      source: "hemnet",
      externalId: String(raw.id || raw.booliId || raw.listingId || ""),
      url: raw.url || raw.listingUrl || "",
      title: raw.streetAddress || raw.title || "",
      street: raw.streetAddress || "",
      area: raw.area || raw.district || raw.neighborhood || "",
      city: raw.municipality || raw.city || "",
      price: Number(raw.askingPrice || raw.listPrice || raw.price || 0),
      sqm: Number(raw.livingArea || raw.sqm || raw.area_sqm || 0),
      rooms: Number(raw.numberOfRooms || raw.rooms || 0),
      floor: raw.floor != null ? Number(raw.floor) : null,
      isGroundFloor: raw.floor === 0 || raw.floor === 1 || false,
      hasBalcony: Boolean(raw.hasBalcony || raw.balcony || false),
      hasElevator: Boolean(raw.hasElevator || raw.elevator || false),
      isNewConstruction: Boolean(raw.isNewConstruction || raw.newConstruction || false),
      monthlyFee: Number(raw.monthlyFee || raw.avgift || 0),
      imageUrl: raw.imageUrl || raw.image || raw.thumbnail || "",
      publishedAt: raw.publishedAt
        ? admin.firestore.Timestamp.fromDate(new Date(raw.publishedAt))
        : admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      matchedHouseholds: [],
    };
  } catch (e) {
    console.error("Fel vid normalisering av Hemnet-annons:", e.message, raw);
    return null;
  }
}

/**
 * Normaliserar ett Booli-objekt till vår gemensamma listingstruktur.
 */
function normalizeBooliListing(raw) {
  try {
    return {
      source: "booli",
      externalId: String(raw.booliId || raw.id || ""),
      url: raw.url || raw.listingUrl || "",
      title: raw.streetAddress || raw.title || "",
      street: raw.streetAddress || raw.location?.address?.streetAddress || "",
      area: raw.area || raw.location?.region?.municipalityName || "",
      city: raw.municipality || raw.location?.region?.municipalityName || "",
      price: Number(raw.listPrice || raw.price || 0),
      sqm: Number(raw.livingArea || raw.sqm || 0),
      rooms: Number(raw.rooms || raw.numberOfRooms || 0),
      floor: raw.floor != null ? Number(raw.floor) : null,
      isGroundFloor: raw.floor === 0 || raw.floor === 1 || false,
      hasBalcony: Boolean(raw.balcony || raw.hasBalcony || false),
      hasElevator: Boolean(raw.elevator || raw.hasElevator || false),
      isNewConstruction: Boolean(raw.isNewConstruction || false),
      monthlyFee: Number(raw.rent || raw.monthlyFee || 0),
      imageUrl: raw.thumbnail?.path || raw.imageUrl || "",
      publishedAt: raw.published
        ? admin.firestore.Timestamp.fromDate(new Date(raw.published))
        : admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      matchedHouseholds: [],
    };
  } catch (e) {
    console.error("Fel vid normalisering av Booli-annons:", e.message, raw);
    return null;
  }
}

/**
 * Hämtar alla aktiva bevakningsprofiler från alla hushåll i Firestore.
 * Returnerar { householdId, profiles[] }[]
 */
async function getAllActiveProfiles() {
  const householdsSnap = await db.collection("households").get();
  const result = [];

  for (const householdDoc of householdsSnap.docs) {
    const profilesSnap = await db
      .collection("households")
      .doc(householdDoc.id)
      .collection("profiles")
      .where("active", "==", true)
      .get();

    if (!profilesSnap.empty) {
      result.push({
        householdId: householdDoc.id,
        profiles: profilesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    }
  }

  return result;
}

/**
 * Kontrollerar om en annons matchar en bevakningsprofil.
 */
function matchesProfile(listing, profile) {
  if (profile.priceMin && listing.price < Number(profile.priceMin)) return false;
  if (profile.priceMax && listing.price > Number(profile.priceMax)) return false;
  if (profile.sqmMin && listing.sqm < Number(profile.sqmMin)) return false;
  if (profile.sqmMax && listing.sqm > Number(profile.sqmMax)) return false;
  if (profile.roomsMin && listing.rooms < Number(profile.roomsMin)) return false;
  if (profile.roomsMax && listing.rooms > Number(profile.roomsMax)) return false;
  if (profile.noGroundFloor && listing.isGroundFloor) return false;
  if (profile.balconyRequired && !listing.hasBalcony) return false;
  if (profile.elevatorRequired && !listing.hasElevator) return false;
  if (profile.newConstruction && !listing.isNewConstruction) return false;
  return true;
}

/**
 * Beräknar vilka hushåll en annons matchar, baserat på deras aktiva profiler.
 */
function computeMatchedHouseholds(listing, householdProfiles) {
  const matched = [];
  for (const { householdId, profiles } of householdProfiles) {
    const hasMatch = profiles.some((profile) => matchesProfile(listing, profile));
    if (hasMatch) matched.push(householdId);
  }
  return matched;
}

/**
 * Sparar en lista med normaliserade annonser till Firestore.
 * Hoppar över annonser som redan finns (deduplicering via externalId + source).
 */
async function saveListings(listings, householdProfiles) {
  const batch = db.batch();
  let newCount = 0;
  let skipCount = 0;

  for (const listing of listings) {
    if (!listing || !listing.externalId || !listing.source) continue;

    // Kolla om annonsen redan finns
    const docId = `${listing.source}_${listing.externalId}`;
    const existingDoc = await db.collection("listings").doc(docId).get();

    if (existingDoc.exists) {
      skipCount++;
      continue;
    }

    // Beräkna matchning
    listing.matchedHouseholds = computeMatchedHouseholds(listing, householdProfiles);

    // Spara
    const docRef = db.collection("listings").doc(docId);
    batch.set(docRef, listing);
    newCount++;

    // Firestore batch-limit är 500 — commit och börja om vid behov
    if (newCount % 400 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  console.log(`Sparade ${newCount} nya annonser, hoppade över ${skipCount} duplicat.`);
}

// ─── Schemalagd funktion ───────────────────────────────────────────────────

/**
 * Körs var 30:e minut via Cloud Scheduler.
 * Hämtar annonser från Hemnet och Booli via Apify och sparar till Firestore.
 */
exports.fetchListings = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("every 30 minutes")
  .onRun(async (context) => {
    console.log("Startar hämtning av annonser...");

    // Hämta Apify API-token från Firebase environment config
    const apifyToken = functions.config().apify?.token;
    if (!apifyToken) {
      console.error("Apify API-token saknas. Sätt den med: firebase functions:config:set apify.token=DIN_TOKEN");
      return null;
    }

    // Hämta aktiva bevakningsprofiler
    const householdProfiles = await getAllActiveProfiles();
    console.log(`Hittade ${householdProfiles.length} hushåll med aktiva profiler.`);

    const allListings = [];

    // ── Hemnet ──
    for (const location of SEARCH_LOCATIONS) {
      console.log(`Hämtar Hemnet-annonser för ${location}...`);
      const rawHemnet = await runApifyActor(
        HEMNET_ACTOR_ID,
        {
          searchQuery: location,
          propertyTypes: ["bostadsrätt"],
          maxItems: 100,
        },
        apifyToken
      );
      const normalized = rawHemnet
        .map(normalizeHemnetListing)
        .filter(Boolean);
      console.log(`Hemnet ${location}: ${normalized.length} annonser hämtade.`);
      allListings.push(...normalized);
    }

    // ── Booli ──
    for (const location of SEARCH_LOCATIONS) {
      console.log(`Hämtar Booli-annonser för ${location}...`);
      const rawBooli = await runApifyActor(
        BOOLI_ACTOR_ID,
        {
          searchQuery: location,
          objectType: "bostadsrätt",
          maxItems: 100,
        },
        apifyToken
      );
      const normalized = rawBooli
        .map(normalizeBooliListing)
        .filter(Boolean);
      console.log(`Booli ${location}: ${normalized.length} annonser hämtade.`);
      allListings.push(...normalized);
    }

    console.log(`Totalt ${allListings.length} annonser att spara.`);
    await saveListings(allListings, householdProfiles);

    console.log("Klar.");
    return null;
  });

/**
 * HTTP-endpoint för manuell testning.
 * Anropas via: https://[region]-[project].cloudfunctions.net/fetchListingsManual
 */
exports.fetchListingsManual = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onRequest(async (req, res) => {
    // Enkel autentisering — kräv en secret query-param
    const secret = functions.config().apify?.secret;
    if (secret && req.query.secret !== secret) {
      res.status(403).send("Ej behörig.");
      return;
    }

    try {
      await exports.fetchListings.run({});
      res.status(200).send("Klar! Se Firebase-loggar för detaljer.");
    } catch (error) {
      console.error("Fel vid manuell körning:", error);
      res.status(500).send(`Fel: ${error.message}`);
    }
  });
