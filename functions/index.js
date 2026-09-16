/**
 * Stacklens Cloud Functions
 * Secrets: ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * (secret versions bind at deploy time — redeploy after adding a new version)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

// Cap how much capacity this project reserves, for two reasons.
//
// Deploys were failing: "Quota exceeded for total allowable CPU per project
// per region". Each gen2 function is a Cloud Run service, and with no
// maxInstances set Firebase defaults each to 100. Nineteen functions therefore
// ask GCP to reserve up to 1,900 concurrent CPUs in us-central1, which exceeds
// the regional quota — so one function failed to deploy and the whole job
// failed with it.
//
// And cost: a runaway loop or a traffic spike against an unbounded function
// bills for as many instances as it can start. Ten each is far above anything
// this product's traffic needs and puts a ceiling on the damage.
//
// ── cpu: 0.5 ────────────────────────────────────────────────────────────────
//
// maxInstances: 10 was not enough, because the quota counts the CPU that
// RUNNING instances hold, not the cap. From firebase-functions' own docs:
//
//   cpu … "Defaults to 1 for functions with <= 2GB RAM and increases for
//   larger memory sizes. This is different from the defaults when using the
//   gcloud utility and is different from the fixed amount assigned in Cloud
//   Functions (1st gen)."
//
// Twenty functions at one full vCPU each is 20,000 milli vCPU, and
// "Total CPU allocation, in milli vCPU, per project per region" for
// us-central1 is 20,000. Exactly the ceiling, no headroom at all — which is
// why a deploy fails whenever a batch's new revisions boot while the previous
// batch's instances are still warm. Run #663 died that way on
// purgeClientOrgs, the twentieth and last function in the last batch.
//
// GCP will not raise the limit: the console answers "Based on your service
// usage history, you are not eligible for a quota increase at this time",
// with the field capped at its current 20,000. So the allocation has to come
// down instead.
//
// At 0.5 the twenty functions hold 10,000 milli — half the ceiling — and a
// deploy has room for every batch plus the instances draining behind it.
//
// The cost, also from those docs: "A value of null restores the default
// concurrency (80 when CPU >= 1, 1 otherwise). Concurrency cannot be set to
// any value other than 1 if `cpu` is less than 1." So each instance now
// serves one request at a time rather than eighty, and ten instances per
// function means ten concurrent requests per function. That is how 1st gen
// behaved for years and is far above this product's traffic. If a function
// ever needs more, raise ITS maxInstances — raising cpu back to 1 puts the
// deploy back against the ceiling.
setGlobalOptions({ maxInstances: 10, cpu: 0.5 });
const { defineSecret } = require('firebase-functions/params');
// firebase-admin v14 removed the legacy namespaced API (admin.auth(), admin.firestore(), …)
// — only the modular entry points exist now.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAppCheck } = require('firebase-admin/app-check');
const {
  MEMBER_ROLES, CHUNKED_KEYS, findMembership, assertCanWrite, buildSafeUpdate, sliceCollection,
  isClientOrgId, newClientOrgId, cleanOrgName, resolveWorkspaceAccess, WorkspaceWriteError,
  effectivePlan,
  currencySymbol,
  RETENTION_DAYS, softDeleteFields, restoreFields, isOrgDeleted, daysUntilPurge, isPurgeDue,
  REV_FIELD, revOf, nextRev, isStaleWrite,
  monthlySpend, billedToolCount, NOT_BILLED_STATUS,
} = require('./workspace-write.js');
const { purgeAccount } = require('./purge-account.js');
const { shouldAlert, recordAlert, MAX_PER_HOUR } = require('./crash-alerts.js');

// Explicitly allow stacklens.fr and Firebase preview domains
const ALLOWED_ORIGINS = [
  'https://stacklens.fr',
  'https://www.stacklens.fr',
  'https://accessguard-v2.web.app',
  'https://accessguard-v2.firebaseapp.com',
];

const cors = require('cors')({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed for: ' + origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

initializeApp();

const ANTHROPIC_API_KEY     = defineSecret('ANTHROPIC_API_KEY');
// Bank-provider credentials live in the server-only /app_config/bankfeed
// Firestore doc (set via the founderops 'setBankCreds' action), NOT in
// Secret Manager: declared-but-unset secrets repeatedly broke the whole
// functions deploy, and the provider is due to change (GoCardless closed
// signups; Bridge is next). Default-deny rules keep the doc server-only.
const STRIPE_SECRET_KEY     = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

const RATE_LIMIT          = { maxCalls: 20, windowMs: 60 * 60 * 1000 };
const CHECKOUT_RATE_LIMIT = { maxCalls: 5,  windowMs: 60 * 60 * 1000 };
const SYNCUSER_RATE_LIMIT = { maxCalls: 30, windowMs: 60 * 60 * 1000 };
const BANKFEED_RATE_LIMIT  = { maxCalls: 30,  windowMs: 60 * 60 * 1000 };
const WORKSPACE_RATE_LIMIT = { maxCalls: 120, windowMs: 60 * 60 * 1000 };

async function verifyAuth(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing auth token' }); return null; }
  try { return await getAuth().verifyIdToken(token); }
  catch (err) {
    // Log the reason server-side; the client only needs to know the token was rejected.
    console.error('verifyIdToken failed:', err?.code, err?.message);
    res.status(401).json({ error: 'Invalid auth token' });
    return null;
  }
}

// App Check runs in MONITORING mode (matching the console posture for Auth and
// Firestore). The web client does not attach an App Check token to these calls,
// and hard-blocking on it here returned 401 to legitimate, signed-in users —
// which broke checkout/portal/AI entirely. We still verify a token when one is
// present (so real signal is kept once the reCAPTCHA registration is restored
// and the client starts sending tokens), but we never hard-block on it. The
// enforced gates for these endpoints remain verifyAuth + per-user rate limits.
async function verifyAppCheck(req) {
  const appCheckToken = req.headers['x-firebase-appcheck'];
  if (!appCheckToken) return true;
  try {
    await getAppCheck().verifyToken(appCheckToken);
  } catch {
    console.warn('App Check token present but failed verification — allowing (monitoring mode).');
  }
  return true;
}


async function checkRateLimit(uid, res, limit = RATE_LIMIT, keyPrefix = 'ai') {
  // Founder accounts are exempt — they test every flow repeatedly.
  if (FOUNDER_UIDS.includes(uid)) return true;
  const db = getFirestore();
  const now = Date.now();
  const windowStart = now - limit.windowMs;
  const ref = db.collection('rate_limits').doc(`${keyPrefix}_${uid}`);
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : { calls: [], blocked_until: null };
      if (data.blocked_until && now < data.blocked_until)
        return { allowed: false, minutesLeft: Math.ceil((data.blocked_until - now) / 60000) };
      const recentCalls = (data.calls || []).filter(t => t > windowStart);
      if (recentCalls.length >= limit.maxCalls) {
        tx.set(ref, { calls: recentCalls, blocked_until: now + limit.windowMs }, { merge: true });
        return { allowed: false, minutesLeft: Math.ceil(limit.windowMs / 60000) };
      }
      recentCalls.push(now);
      tx.set(ref, { calls: recentCalls, blocked_until: null, uid });
      return { allowed: true };
    });
    if (!result.allowed) { res.status(429).json({ error: `Rate limit exceeded. Try again in ${result.minutesLeft} minutes.` }); return false; }
    return true;
  } catch (err) { console.error('checkRateLimit error:', err); res.status(503).json({ error: 'Service temporarily unavailable, please try again.' }); return false; }
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length > 20) return null;
  return messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 10000) }));
}

async function getOrCreateCustomer(stripe, uid, email, name) {
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();
  // If we have a stored customer ID, verify it exists in current Stripe mode
  if (snap.exists && snap.data().stripe_customer_id) {
    try {
      await stripe.customers.retrieve(snap.data().stripe_customer_id);
      return snap.data().stripe_customer_id;
    } catch (err) {
      // Customer doesn't exist in current mode (test vs live switch) — create new one
      console.log('Stored customer ID invalid, creating new customer for uid:', uid);
    }
  }
  const customer = await stripe.customers.create({ email: email || '', name: name || '', metadata: { firebase_uid: uid } });
  await db.collection('users').doc(uid).set({ stripe_customer_id: customer.id }, { merge: true });
  return customer.id;
}

function getPlanFromSubscription(sub) {
  const priceId = sub.items?.data?.[0]?.price?.id || '';
  const PLAN_MAP = {
    // Live mode price IDs (stacklens.fr)
    'price_1TMhOt1yFs6IziIVgJGBbzoG': 'starter',        // Starter monthly €29
    'price_1TMhfK1yFs6IziIVOtbhpy23': 'starter',        // Starter annual €278
    'price_1TWxAB1yFs6IziIVjxw3CG2V':      'hr_finance',     // HR & Finance monthly €49  ← fill after Stripe
    'price_1TWxFd1yFs6IziIVjPZnA8XT':       'hr_finance',     // HR & Finance annual €470  ← fill after Stripe
    'price_1TMhNW1yFs6IziIV5hwlssrt': 'pro',            // Pro monthly €79
    'price_1TMhNW1yFs6IziIVMxiacXD7': 'pro',            // Pro annual €758
    'price_1TMhNk1yFs6IziIVPkv7RiLc': 'enterprise',     // Enterprise monthly €299
    'price_1TMhNk1yFs6IziIViMLzewdQ': 'enterprise',     // Enterprise annual €2870
    'price_1TMhND1yFs6IziIVFqZSPoGR': 'free',           // Trial/free
    // Legacy test-mode price IDs (kept for backwards compatibility)
    'price_1T9X4k0E2aOcllaPRKLOAgiK': 'starter',
    'price_1T9XaZ0E2aOcllaPORiPFfGp': 'starter',
    'price_1T9X5G0E2aOcllaP1KncPTsP': 'pro',
    'price_1T9Xaa0E2aOcllaPRA4P9Cy8': 'pro',
    'price_1TBUkO0E2aOcllaPOuw3UBPM': 'enterprise',
    'price_1TBUoe0E2aOcllaP5J7bvqWK': 'enterprise',
    'price_1T9X610E2aOcllaPp1dSFIcL': 'free',
  };
  return PLAN_MAP[priceId] || 'free';
}

// ── /ai ──────────────────────────────────────────────────────
exports.ai = onRequest({ secrets: [ANTHROPIC_API_KEY], cors: true, timeoutSeconds: 60 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!await verifyAppCheck(req, res)) return;
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const allowed = await checkRateLimit(decoded.uid, res); if (!allowed) return;
    const sanitized = sanitizeMessages(req.body.messages);
    if (!sanitized) return res.status(400).json({ error: 'Invalid messages' });
    const system = req.body.system ? String(req.body.system).slice(0, 5000) : undefined;
    const max_tokens = Math.min(Number(req.body.max_tokens) || 2000, 4000);
    try {
      // claude-sonnet-4-20250514 was retired 2026-06-15; claude-sonnet-5 is its
      // designated replacement. Thinking disabled to keep the old latency/token
      // behavior (Sonnet 5 defaults to adaptive thinking, which spends output
      // tokens inside max_tokens and could truncate the JSON analyses).
      const body = { model: 'claude-sonnet-5', max_tokens, thinking: { type: 'disabled' }, messages: sanitized };
      if (system) body.system = system;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.value(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.error?.message || 'AI error' });
      return res.json(data);
    } catch (err) { console.error('AI error:', err); return res.status(500).json({ error: 'Internal error' }); }
  });
});

// ── /createCheckout ──────────────────────────────────────────
exports.createCheckout = onRequest({ secrets: [STRIPE_SECRET_KEY], cors: true, timeoutSeconds: 30 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!await verifyAppCheck(req, res)) return;
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const allowed = await checkRateLimit(decoded.uid, res, CHECKOUT_RATE_LIMIT, 'checkout'); if (!allowed) return;
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId required' });
    const ALLOWED_PRICE_IDS = new Set([
      'price_1TMhOt1yFs6IziIVgJGBbzoG','price_1TMhfK1yFs6IziIVOtbhpy23',
      'price_1TWxAB1yFs6IziIVjxw3CG2V','price_1TWxFd1yFs6IziIVjPZnA8XT',
      'price_1TMhNW1yFs6IziIV5hwlssrt','price_1TMhNW1yFs6IziIVMxiacXD7',
      'price_1TMhNk1yFs6IziIVPkv7RiLc','price_1TMhNk1yFs6IziIViMLzewdQ',
      'price_1T9X4k0E2aOcllaPRKLOAgiK','price_1T9XaZ0E2aOcllaPORiPFfGp',
      'price_1T9X5G0E2aOcllaP1KncPTsP','price_1T9Xaa0E2aOcllaPRA4P9Cy8',
      'price_1TBUkO0E2aOcllaPOuw3UBPM','price_1TBUoe0E2aOcllaP5J7bvqWK',
    ]);
    if (!ALLOWED_PRICE_IDS.has(priceId)) return res.status(400).json({ error: 'Invalid priceId' });
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
    try {
      const customerId = await getOrCreateCustomer(stripe, decoded.uid, decoded.email, decoded.name);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: 'https://stacklens.fr/settings?success=true',
        cancel_url: 'https://stacklens.fr/settings?cancelled=true',
        subscription_data: { metadata: { firebase_uid: decoded.uid } },
        allow_promotion_codes: true,
        // Collect the billing address and (for businesses) a VAT/tax ID so
        // invoices are legally complete per the buyer's jurisdiction.
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { name: 'auto', address: 'auto' },
        // Stripe Tax is configured in the dashboard (France head office, SaaS
        // category, FR registration) — calculates the right VAT per country.
        automatic_tax: { enabled: true },
        // Require an explicit "I agree to the Terms of Service" checkbox on
        // the payment page. Stripe stores the consent with the session — the
        // contract-acceptance proof. Uses the Terms URL set in Stripe
        // Dashboard → Settings → Public details.
        consent_collection: { terms_of_service: 'required' },
      });
      return res.json({ url: session.url });
    } catch (err) {
      console.error('Checkout error:', err);
      let detail = err.message;
      // "No such price/customer" means the bound secret key belongs to a
      // different Stripe account than the one holding our live objects.
      // Surface which account the key is for so the mismatch is visible.
      if (err.code === 'resource_missing') {
        try {
          const acct = await stripe.accounts.retrieve();
          detail += ` — server key belongs to Stripe account ${acct.id}`;
        } catch { detail += ' — could not identify the Stripe account of the server key'; }
      }
      return res.status(500).json({ error: detail });
    }
  });
});

// ── /createPortal ────────────────────────────────────────────
exports.createPortal = onRequest({ secrets: [STRIPE_SECRET_KEY], cors: true, timeoutSeconds: 30 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!await verifyAppCheck(req, res)) return;
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const allowed = await checkRateLimit(decoded.uid, res, CHECKOUT_RATE_LIMIT, 'portal'); if (!allowed) return;
    try {
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
      const snap = await getFirestore().collection('users').doc(decoded.uid).get();
      const customerId = snap.exists ? snap.data().stripe_customer_id : null;
      if (!customerId) return res.status(400).json({ error: 'No billing account found' });
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: 'https://stacklens.fr/app/settings?tab=billing' });
      return res.json({ url: session.url });
    } catch (err) { console.error('Portal error:', err); return res.status(500).json({ error: err.message }); }
  });
});

// ── /stripeWebhook ───────────────────────────────────────────
exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], cors: false, timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
  let event;
  try { event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value()); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
  const db = getFirestore();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Try metadata first, then fall back to customer ID lookup
        let uid = session.subscription_data?.metadata?.firebase_uid || session.metadata?.firebase_uid;
        if (!uid && session.customer) {
          const snap = await db.collection('users').where('stripe_customer_id', '==', session.customer).limit(1).get();
          if (!snap.empty) uid = snap.docs[0].id;
        }
        if (uid && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const plan = getPlanFromSubscription(sub);
          await db.collection('users').doc(uid).set({ plan, stripe_subscription_id: sub.id, stripe_customer_id: session.customer, subscription_status: sub.status, plan_updated_at: Date.now() }, { merge: true });
          await getAuth().setCustomUserClaims(uid, { plan });
          console.log(`Plan updated for uid=${uid} to ${plan}`);
        } else {
          console.warn('checkout.session.completed: could not find uid for customer', session.customer);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        let uid = sub.metadata?.firebase_uid;
        if (!uid && sub.customer) {
          const snap = await db.collection('users').where('stripe_customer_id', '==', sub.customer).limit(1).get();
          if (!snap.empty) uid = snap.docs[0].id;
        }
        if (uid) {
          const plan = getPlanFromSubscription(sub);
          await db.collection('users').doc(uid).set({ plan, subscription_status: sub.status, plan_updated_at: Date.now() }, { merge: true });
          await getAuth().setCustomUserClaims(uid, { plan });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        let uid = sub.metadata?.firebase_uid;
        if (!uid && sub.customer) {
          const snap = await db.collection('users').where('stripe_customer_id', '==', sub.customer).limit(1).get();
          if (!snap.empty) uid = snap.docs[0].id;
        }
        if (uid) {
          await db.collection('users').doc(uid).set({ plan: 'free', subscription_status: 'cancelled', stripe_subscription_id: null, plan_updated_at: Date.now() }, { merge: true });
          await getAuth().setCustomUserClaims(uid, { plan: 'free' });
        }
        break;
      }
    }
    return res.json({ received: true });
  } catch (err) { console.error('Webhook error:', err); return res.status(500).json({ error: 'Handler failed' }); }
});

// Sign-in location lookup removed.
//
// This used to send the request IP to ipwho.is to record an approximate
// country and city, shown as a flag on the internal founder-admin screen and
// nowhere else. That meant every user's IP address went to a third party that
// retains it for 30-90 days across a global edge network, with no transfer
// mechanism agreed and no mention on a sub-processor page that states it is
// complete — in exchange for a cosmetic column only we could see. For a
// product whose differentiation is EU data residency, that is not a trade
// worth making.
//
// last_seen_at is kept: it is genuinely useful, and it needs no third party.
// The stale location fields are removed from each user's record the next time
// they sign in, so no separate migration is needed.
const GEO_FIELDS = ['last_country', 'last_country_code', 'last_city', 'last_region'];

// ── /syncuser ────────────────────────────────────────────────
exports.syncuser = onRequest({ cors: true }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!await verifyAppCheck(req, res)) return;
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const allowed = await checkRateLimit(decoded.uid, res, SYNCUSER_RATE_LIMIT, 'syncuser'); if (!allowed) return;
    const { email, displayName, photoURL } = req.body;
    const uid = decoded.uid;
    const userRef = getFirestore().collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await userRef.set({ uid, email: decoded.email || email || '', displayName: displayName || decoded.name || '', photoURL: photoURL || decoded.picture || '', plan: 'free', createdAt: Date.now(), updatedAt: Date.now(), last_seen_at: Date.now() });
      return res.json({ isNew: true });
    } else {
      await userRef.update({
        updatedAt: Date.now(), last_seen_at: Date.now(),
        // Clear location recorded by the removed lookup, one record per sign-in.
        ...Object.fromEntries(GEO_FIELDS.map(f => [f, FieldValue.delete()])),
      });
      const d = snap.data();
      return res.json({ isNew: false, plan: d.plan || 'free', stripe_customer_id: d.stripe_customer_id || null, subscription_status: d.subscription_status || null });
    }
  });
});

// Recipient for scheduled mail. /userdata is a client-written blob, so the
// email inside it is attacker-controlled — a user could point Stacklens-branded
// SendGrid mail at any third-party address. Firebase Auth is the authority.
async function verifiedEmailForUid(uid) {
  try {
    const user = await getAuth().getUser(uid);
    return user?.email || '';
  } catch { return ''; }
}

// ── /refreshClaims — force-refresh custom claims on client token ──────────
exports.refreshClaims = onRequest({ cors: true }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    // Read current Firestore plan and sync it to claims
    const snap = await getFirestore().collection('users').doc(decoded.uid).get();
    // Claims outlive the request that set them, so baking a stale 'trial' into
    // a token is the one place an expired trial would persist longest.
    const plan = effectivePlan(snap.exists ? snap.data() : null);
    await getAuth().setCustomUserClaims(decoded.uid, { plan });
    return res.json({ plan });
  });
});

// ── /sendInvite — email a team invite link via SendGrid ───────────────────
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY'); // rotated 2026-07-21 — redeploy binds the new version

exports.sendInvite = onRequest({ cors: true, secrets: [SENDGRID_API_KEY] }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;

    const { inviteeEmail, inviterName, orgName } = req.body;
    if (!inviteeEmail || !inviteeEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Rate limit: 20 invites per hour
    const limited = await checkRateLimit(decoded.uid, res, { maxCalls: 20, windowMs: 60 * 60 * 1000 }, 'invite');
    if (!limited) return;

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(SENDGRID_API_KEY.value());

      const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const signupUrl = 'https://stacklens.fr/?signup=true';
      const from = esc(inviterName || decoded.name || 'Your team');
      const org  = esc(orgName || 'Stacklens');

      await sgMail.send({
        to: inviteeEmail,
        from: { email: 'hello@stacklens.fr', name: 'Stacklens' },
        subject: `${from} invited you to join ${org} on Stacklens`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f172a;border-radius:12px;overflow:hidden">
          <div style="padding:24px;background:#1e293b">
            <h1 style="color:white;margin:0 0 4px;font-size:22px">Stacklens</h1>
            <p style="color:#94a3b8;margin:0">SaaS Stack Intelligence</p>
          </div>
          <div style="padding:28px">
            <h2 style="color:white;margin:0 0 12px">${from} invited you to ${org}</h2>
            <p style="color:#94a3b8;margin:0 0 24px">You've been invited to join your team on Stacklens — the platform that gives your team full visibility into your SaaS stack, costs, and access rights.</p>
            <div style="text-align:center;margin-bottom:24px">
              <a href="${signupUrl}" style="background:#3b82f6;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:16px">Accept Invitation →</a>
            </div>
            <p style="color:#475569;font-size:12px;margin:0">If you weren't expecting this invitation, you can ignore this email.</p>
          </div>
        </div>`,
      });
      return res.json({ sent: true });
    } catch (err) {
      console.error('sendInvite error:', err);
      return res.status(500).json({ error: 'Failed to send invite' });
    }
  });
});

// ── /founderops (renamed from founderAdmin — 'admin' URLs get eaten by ad-blockers) ─────────────────────────────────────────────────────────
// Privileged operations (extend trial, set plan) for users with is_founder=true.
// Uses Admin SDK so it bypasses Firestore rules — the caller's founder status is
// checked server-side before any write.
const FOUNDER_RATE_LIMIT = { maxCalls: 30, windowMs: 60 * 60 * 1000 };
const VALID_PLANS = ['free', 'trial', 'starter', 'hr_finance', 'pro', 'enterprise', 'scale'];
// Founder allowlist, kept in sync with firestore.rules and src/lib/constants.js.
// The UID entry exists because the founder's Google sign-in carries no email
// claim, so neither the email check nor the is_founder doc flag can identify them.
const FOUNDER_UIDS   = ['bxIYrZ76z1QKo5ZMpGvEG8GGbNM2'];
const FOUNDER_EMAILS = ['rolanddzoagbe@gmail.com'];

exports.founderops = onRequest({ cors: true, timeoutSeconds: 30, secrets: [SENDGRID_API_KEY] }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const decoded = await verifyAuth(req, res);
    if (!decoded) return;

    if (!await checkRateLimit(decoded.uid, res, FOUNDER_RATE_LIMIT, 'founderAdmin')) return;

    const db = getFirestore();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    const isFounderCaller =
      FOUNDER_UIDS.includes(decoded.uid) ||
      FOUNDER_EMAILS.includes((decoded.email || '').toLowerCase()) ||
      (callerSnap.exists && callerSnap.data().is_founder === true);
    if (!isFounderCaller) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { action, targetUid, plan, extraDays, to } = req.body;

    try {
      // Diagnostic: send a real email through SendGrid right now and report the
      // exact provider response, so email-delivery problems can be isolated
      // from "the scheduled job hasn't fired / found nothing to send".
      if (action === 'testEmail') {
        const dest = String(to || FOUNDER_EMAILS[0] || '').trim();
        if (!dest) return res.status(400).json({ error: 'No destination email' });
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(SENDGRID_API_KEY.value());
        try {
          const [resp] = await sgMail.send({
            to: dest,
            from: { email: 'hello@stacklens.fr', name: 'Stacklens' },
            subject: '✅ Stacklens test email',
            html: '<div style="font-family:sans-serif;padding:24px"><h2>It works.</h2><p>This is a Stacklens delivery test. If you received it, alert and digest emails will reach you too.</p></div>',
          });
          return res.json({ ok: true, sent_to: dest, status: resp?.statusCode || null });
        } catch (mailErr) {
          // SendGrid attaches the useful detail on err.response.body
          const body = mailErr?.response?.body;
          return res.status(200).json({
            ok: false,
            sent_to: dest,
            sendgrid_status: mailErr?.code || null,
            sendgrid_error: body?.errors?.map(e => e.message).join('; ') || mailErr?.message || 'Unknown SendGrid error',
          });
        }
      }
      // Backfill displayName/email on /users docs from Firebase Auth. Accounts
      // created while syncuser was broken (firebase-admin v14 outage) have bare
      // docs; Auth still knows their profile, so copy it over once.
      if (action === 'enrichProfiles') {
        const snap = await db.collection('users').get();
        const missing = snap.docs.filter(d => !d.data().displayName || !d.data().email);
        let updated = 0;
        for (let i = 0; i < missing.length; i += 100) {
          const batch = missing.slice(i, i + 100);
          const result = await getAuth().getUsers(batch.map(d => ({ uid: d.id })));
          const byUid = new Map(result.users.map(au => [au.uid, au]));
          const writeBatch = db.batch();
          let hasWrites = false;
          for (const d of batch) {
            const au = byUid.get(d.id);
            if (!au) continue;
            const data = d.data();
            const authEmail = au.email || au.providerData?.[0]?.email || null;
            const authName  = au.displayName || au.providerData?.[0]?.displayName || null;
            const updates = {};
            if (!data.displayName && authName) updates.displayName = authName;
            if (!data.email && authEmail) updates.email = authEmail;
            if (Object.keys(updates).length) {
              writeBatch.update(d.ref, updates);
              hasWrites = true;
              updated++;
            }
          }
          if (hasWrites) await writeBatch.commit();
        }
        return res.json({ ok: true, checked: missing.length, updated });
      }

      // Configure Bridge bank-provider credentials (see the bankfeed section).
      if (action === 'setBankCreds') {
        const { clientId, clientSecret } = req.body || {};
        if (!clientId || !clientSecret) return res.status(400).json({ error: 'clientId and clientSecret required' });
        await db.collection('app_config').doc('bankfeed').set({
          client_id: String(clientId).trim(),
          client_secret: String(clientSecret).trim(),
          updated_at: new Date().toISOString(),
        });
        return res.json({ ok: true });
      }
      // Whether Bridge credentials are configured (no secrets returned).
      if (action === 'bankCredsStatus') {
        const cfg = await db.collection('app_config').doc('bankfeed').get();
        return res.json({ configured: cfg.exists && !!cfg.data().client_id });
      }
      // Recent client-side crashes captured by the clientErrors endpoint.
      if (action === 'listErrors') {
        const snap = await db.collection('client_errors').orderBy('at', 'desc').limit(50).get();
        return res.json({ errors: snap.docs.map(d => d.data()) });
      }

      // ── Actions below require a target user ──
      if (!targetUid || typeof targetUid !== 'string') {
        return res.status(400).json({ error: 'targetUid required' });
      }
      if (action === 'extendTrial') {
        const days = typeof extraDays === 'number' ? extraDays : 7;
        const newStartMs = Date.now() - (7 - days) * 24 * 60 * 60 * 1000;
        await db.collection('users').doc(targetUid).update({
          plan: 'trial',
          trial_started_at: Timestamp.fromMillis(newStartMs),
        });
        return res.json({ ok: true });
      }
      if (action === 'setPlan') {
        if (typeof plan !== 'string' || !VALID_PLANS.includes(plan)) {
          return res.status(400).json({ error: 'Invalid plan' });
        }
        await db.collection('users').doc(targetUid).update({ plan });
        return res.json({ ok: true });
      }
      // Permanently remove a user and everything belonging to them.
      //
      // This used to delete the Auth user, /users and /userdata — and leave
      // /userdata/{uid}/chunks behind, because Firestore does not cascade to
      // subcollections. That is where employees, access and audit_log live, so
      // the personal data of the customer's staff survived the deletion
      // indefinitely. It also left backups, API keys, stored vendor
      // credentials and memberships. purgeAccount is now the one definition of
      // the job, shared with the self-service path below.
      if (action === 'deleteUser') {
        if (FOUNDER_UIDS.includes(targetUid) || targetUid === decoded.uid) {
          return res.status(400).json({ error: 'Cannot delete the founder account' });
        }
        let targetEmail = '';
        try {
          targetEmail = (await getAuth().getUser(targetUid))?.email || '';
        } catch (err) {
          if (err.code !== 'auth/user-not-found') throw err;
        }
        const counts = await purgeAccount(db, targetUid, {
          email: targetEmail,
          deleteAuthUser: async (u) => {
            try { await getAuth().deleteUser(u); }
            catch (err) { if (err.code !== 'auth/user-not-found') throw err; }
          },
        });
        console.warn('founderops deleteUser purged', targetUid, JSON.stringify(counts));
        return res.json({ ok: true, purged: counts });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('founderAdmin error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });
});

// ── Client crash reporting ───────────────────────────────────────────────
// The SPA posts uncaught errors here (see src/main.jsx). No auth: crashes can
// happen before sign-in. Abuse is bounded by strict size caps, a small
// per-instance throttle, and the capped client_errors collection (pruned to
// ~300 docs). Client access to the collection is blocked by default-deny rules.
let _errReports = 0;
setInterval(() => { _errReports = 0; }, 60 * 1000).unref?.();
exports.clientErrors = onRequest({
  cors: true,
  timeoutSeconds: 10,
  // Needed to mail the founder when the live site starts crashing. Without
  // this the crashes were recorded and nobody was told, which is the same as
  // not recording them.
  secrets: [SENDGRID_API_KEY],
}, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (_errReports++ > 120) return res.status(429).json({ error: 'Too many reports' });
    try {
      const b = req.body || {};
      const doc = {
        message: String(b.message || '').slice(0, 500),
        stack:   String(b.stack   || '').slice(0, 1500),
        url:     String(b.url     || '').slice(0, 200),
        ua:      String(b.ua      || '').slice(0, 200),
        at: new Date().toISOString(),
      };
      if (!doc.message) return res.status(400).json({ error: 'message required' });
      console.error('CLIENT ERROR:', doc.message, '@', doc.url);
      const db = getFirestore();
      await db.collection('client_errors').add(doc);

      // ── Tell somebody ────────────────────────────────────────────────────
      //
      // Never let this fail the report. The caller is a browser that has just
      // crashed; the one thing it must get back is a 200, so the crash is
      // recorded even if the mail, the secret or the transaction is broken.
      // A swallowed alert costs a notification. A thrown one costs the record.
      try {
        const stateRef = db.collection('crash_alert_state').doc('state');
        // A transaction, because a bad deploy sends these in parallel: two
        // concurrent crashes reading the same state would both decide to mail.
        const decision = await db.runTransaction(async (tx) => {
          const snap = await tx.get(stateRef);
          const state = snap.exists ? snap.data() : {};
          const d = shouldAlert(state, doc.message);
          if (d.alert) tx.set(stateRef, recordAlert(state, d.fp));
          return d;
        });

        if (decision.alert) {
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(SENDGRID_API_KEY.value());
          await sgMail.send({
            to: FOUNDER_EMAILS[0],
            from: { email: 'hello@stacklens.fr', name: 'Stacklens' },
            subject: `Stacklens crash: ${doc.message.slice(0, 80)}`,
            text: [
              'A visitor hit an uncaught error on the live site.',
              '',
              `Message: ${doc.message}`,
              `Page:    ${doc.url || '(unknown)'}`,
              `Browser: ${doc.ua || '(unknown)'}`,
              `At:      ${doc.at}`,
              '',
              doc.stack ? `Stack:\n${doc.stack}` : '(no stack)',
              '',
              `The same crash will not be reported again for 24 hours, and at most ${MAX_PER_HOUR}`,
              'alerts are sent per hour however many distinct crashes appear — so this is',
              'one email about a problem, not one per affected visitor.',
              '',
              'Full history: Firestore /client_errors, newest first. Sentry has the same',
              'crash with more context if its alerting is configured.',
            ].join('\n'),
          });
          console.warn('crash alert sent:', decision.fp);
        } else {
          // Logged deliberately: "why did nobody tell me" has to be answerable,
          // or the first instinct will be to assume alerting is broken.
          console.log('crash alert suppressed:', decision.reason, '—', decision.fp);
        }
      } catch (err) {
        console.error('crash alert failed (the crash itself was recorded):', err?.message);
      }

      if (Math.random() < 0.05) {
        const old = await db.collection('client_errors').orderBy('at', 'desc').offset(300).limit(100).get();
        if (!old.empty) {
          const batch = db.batch();
          old.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'failed' }); }
  });
});


// ── API keys + public read-only REST API ─────────────────────────────────
// Keys are random secrets shown once; only their SHA-256 hash is stored (as
// the doc ID, so lookup is a direct get). API calls are Enterprise-plan gated.
const nodeCrypto = require('crypto');
const API_RATE_LIMIT = { maxCalls: 120, windowMs: 60 * 60 * 1000 };
const API_PLANS = new Set(['enterprise', 'scale', 'unlimited', 'professional', 'trial']);
const MAX_API_KEYS_PER_USER = 5;

function hashApiKey(secret) {
  return nodeCrypto.createHash('sha256').update(secret).digest('hex');
}

// Large arrays (employees, access, audit_log) are stored as slices in the
// /userdata/{uid}/chunks subcollection (Firestore 1MB doc limit — see the
// client's saveUserData). Every server-side reader of userdata must reassemble
// through this helper; pre-chunking docs pass through unchanged.
async function assembleUserdata(docSnap) {
  const data = docSnap.exists ? docSnap.data() : {};
  if (data._chunks) {
    const chunkSnap = await docSnap.ref.collection('chunks').get();
    const byId = {};
    chunkSnap.forEach(d => { byId[d.id] = d.data().items || []; });
    for (const [key, count] of Object.entries(data._chunks)) {
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(...(byId[`${key}_${i}`] || []));
      data[key] = arr;
    }
  }
  return data;
}

// Authenticated key management for the Settings → API keys tab.
exports.apikeys = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const db = getFirestore();
    const { action, name, keyId } = req.body || {};
    try {
      if (action === 'list') {
        const snap = await db.collection('api_keys').where('uid', '==', decoded.uid).get();
        const keys = snap.docs
          .map(d => {
            const k = d.data();
            return {
              keyId: d.id,
              name: k.name,
              prefix: k.prefix,
              created_at: k.created_at?.toDate?.()?.toISOString() || null,
              last_used_at: k.last_used_at?.toDate?.()?.toISOString() || null,
            };
          })
          .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        return res.json({ keys });
      }
      if (action === 'create') {
        // The tab is gated now, but the endpoint is reachable with any signed-in
        // token, so a key must not be mintable by a plan the API will refuse.
        // Minting one and 403ing every call is worse than saying no here.
        if (!FOUNDER_UIDS.includes(decoded.uid)) {
          const userSnap = await db.collection('users').doc(decoded.uid).get();
          const plan = effectivePlan(userSnap.exists ? userSnap.data() : null);
          if (!API_PLANS.has(plan) && userSnap.data()?.is_founder !== true) {
            return res.status(403).json({ error: 'API access requires the Enterprise plan.' });
          }
        }
        const existing = await db.collection('api_keys').where('uid', '==', decoded.uid).get();
        if (existing.size >= MAX_API_KEYS_PER_USER) {
          return res.status(400).json({ error: `Key limit reached (${MAX_API_KEYS_PER_USER}). Revoke a key first.` });
        }
        const secret = 'sk_live_' + nodeCrypto.randomBytes(24).toString('hex');
        const prefix = secret.slice(0, 15) + '…';
        await db.collection('api_keys').doc(hashApiKey(secret)).set({
          uid: decoded.uid,
          name: String(name || 'API key').slice(0, 60),
          prefix,
          created_at: Timestamp.now(),
          last_used_at: null,
        });
        return res.json({ key: secret, prefix });
      }
      if (action === 'revoke') {
        if (!keyId || typeof keyId !== 'string') return res.status(400).json({ error: 'keyId required' });
        const ref = db.collection('api_keys').doc(keyId);
        const snap = await ref.get();
        if (!snap.exists || snap.data().uid !== decoded.uid) return res.status(404).json({ error: 'Key not found' });
        await ref.delete();
        return res.json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('apikeys error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });
});

// Public read-only API: GET .../api/v1/{tools|employees|spend}
// Auth: Authorization: Bearer sk_live_...
exports.api = onRequest({ timeoutSeconds: 30 }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const header = req.headers.authorization || '';
  const secret = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!secret || !secret.startsWith('sk_live_')) {
    return res.status(401).json({ error: 'Missing API key. Send it as: Authorization: Bearer sk_live_...' });
  }

  try {
    const db = getFirestore();
    const keySnap = await db.collection('api_keys').doc(hashApiKey(secret)).get();
    if (!keySnap.exists) return res.status(401).json({ error: 'Invalid API key' });
    const { uid } = keySnap.data();

    const userSnap = await db.collection('users').doc(uid).get();
    const plan = effectivePlan(userSnap.exists ? userSnap.data() : null);
    const isFounder = FOUNDER_UIDS.includes(uid) || (userSnap.exists && userSnap.data().is_founder === true);
    if (!API_PLANS.has(plan) && !isFounder) {
      return res.status(403).json({ error: 'API access requires the Enterprise plan.' });
    }

    if (!await checkRateLimit(uid, res, API_RATE_LIMIT, 'api')) return;
    keySnap.ref.update({ last_used_at: Timestamp.now() }).catch(() => {});

    const dataSnap = await db.collection('userdata').doc(uid).get();
    const data = await assembleUserdata(dataSnap);
    const tools = Array.isArray(data.tools) ? data.tools : [];
    const employees = Array.isArray(data.employees) ? data.employees : [];

    const path = (req.path || '/').replace(/\/+$/, '') || '/';
    const ENDPOINTS = ['/v1/tools', '/v1/employees', '/v1/spend'];

    if (path === '/' || path === '/v1') {
      return res.json({ ok: true, version: 'v1', endpoints: ENDPOINTS, docs: 'https://stacklens.fr/settings?tab=api' });
    }
    if (path === '/v1/tools') {
      return res.json({
        count: tools.length,
        data: tools.map(t => ({
          id: t.id, name: t.name, category: t.category, status: t.status,
          cost_per_month: t.cost_per_month ?? null, owner_email: t.owner_email || null,
          criticality: t.criticality || null, risk_score: t.risk_score || null,
          last_used_date: t.last_used_date || null, url: t.url || null,
        })),
      });
    }
    if (path === '/v1/employees') {
      return res.json({
        count: employees.length,
        data: employees.map(e => ({
          id: e.id, full_name: e.full_name, email: e.email, department: e.department || null,
          role: e.role || null, status: e.status || null,
          start_date: e.start_date || null, end_date: e.end_date || null,
        })),
      });
    }
    if (path === '/v1/spend') {
      const active = tools.filter(t => t.status !== 'cancelled');
      const total = active.reduce((s, t) => s + (Number(t.cost_per_month) || 0), 0);
      const byCategory = {};
      active.forEach(t => {
        const c = t.category || 'other';
        byCategory[c] = (byCategory[c] || 0) + (Number(t.cost_per_month) || 0);
      });
      return res.json({
        currency: 'EUR',
        total_monthly: total,
        total_annual: total * 12,
        tool_count: active.length,
        by_category: byCategory,
      });
    }
    return res.status(404).json({ error: 'Unknown endpoint', available: ENDPOINTS });
  } catch (err) {
    console.error('api error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});


// ── Bank feed (GoCardless Bank Account Data / open banking) ──────────────
// The user connects their company bank once; 'sync' pulls 90 days of booked
// transactions and detects recurring outflows (same counterparty in 2+
// distinct months) — SaaS, hosting, telecom, leases — with real amounts.
// Nothing is written to the user's data blob server-side: candidates are
// returned for client-side review and applied by the client.
// Provider: Bridge (bridgeapi.io) aggregation API v3. User-centric flow —
// create a Bridge user keyed by our uid, mint a 2h access token, open a
// hosted Connect session for the user to link their bank, then read
// transactions. Credentials live in /app_config/bankfeed (client_id/secret),
// set from the Founder Admin page — never in Secret Manager (that broke deploys).
const BRIDGE_API = 'https://api.bridgeapi.io/v3';
const BRIDGE_VERSION = '2025-01-15';

async function bridgeCreds() {
  const cfg = await getFirestore().collection('app_config').doc('bankfeed').get();
  const { client_id, client_secret } = cfg.exists ? cfg.data() : {};
  if (!client_id || !client_secret) throw new Error('Bank provider credentials are not configured yet');
  return { client_id: String(client_id).trim(), client_secret: String(client_secret).trim() };
}
function bridgeHeaders(creds, token) {
  const h = {
    'Content-Type': 'application/json',
    'Bridge-Version': BRIDGE_VERSION,
    'Client-Id': creds.client_id,
    'Client-Secret': creds.client_secret,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
// Ensure the Bridge user exists (idempotent — ignore "already exists"), then
// return a fresh user access token.
async function bridgeUserToken(creds, externalUserId) {
  await fetch(`${BRIDGE_API}/aggregation/users`, {
    method: 'POST', headers: bridgeHeaders(creds),
    body: JSON.stringify({ external_user_id: externalUserId }),
  }).catch(() => {});
  const res = await fetch(`${BRIDGE_API}/aggregation/authorization/token`, {
    method: 'POST', headers: bridgeHeaders(creds),
    body: JSON.stringify({ external_user_id: externalUserId }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out?.message || 'Bridge authentication failed — check the Client ID / Secret');
  return out.access_token;
}
function normalizeBridgeTx(t) {
  return {
    name: t.clean_description || t.provider_description || '',
    amount: Number(t.amount || 0),
    date: t.date || '',
  };
}

// Group outflows by counterparty; recurring = seen in 2+ distinct months.
// Input: normalized [{ name, amount (negative=outflow), date 'YYYY-MM-DD' }].
function detectRecurring(items) {
  const groups = {};
  (items || []).forEach(tx => {
    const amount = Number(tx.amount || 0);
    if (!(amount < 0)) return; // outflows only
    const name = (tx.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[0-9]/g, '').replace(/\s+/g, ' ').slice(0, 40).trim();
    if (!key) return;
    if (!groups[key]) groups[key] = { name: name.slice(0, 80), amounts: [], months: new Set(), last: '' };
    const g = groups[key];
    g.amounts.push(Math.abs(amount));
    const date = tx.date || '';
    if (date) { g.months.add(date.slice(0, 7)); if (date > g.last) g.last = date; }
  });
  return Object.values(groups)
    .filter(g => g.months.size >= 2)
    .map(g => {
      const sorted = [...g.amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return {
        vendor: g.name,
        amount: Math.round(median * 100) / 100,
        monthly: Math.round(median * 100) / 100,
        billing_cycle: 'monthly',
        currency: 'EUR',
        invoice_date: g.last || null,
        occurrences: g.amounts.length,
        source: 'bank',
      };
    })
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 60);
}

exports.bankfeed = onRequest({ cors: true, timeoutSeconds: 120 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    // Each sync fans out up to a dozen paginated Bridge calls; cap the burst.
    if (!await checkRateLimit(decoded.uid, res, BANKFEED_RATE_LIMIT, 'bankfeed')) return;
    // Bank connectivity is an Enterprise-tier feature (founders exempt).
    if (!FOUNDER_UIDS.includes(decoded.uid)) {
      const userSnap = await getFirestore().collection('users').doc(decoded.uid).get();
      const plan = effectivePlan(userSnap.exists ? userSnap.data() : null);
      if (!API_PLANS.has(plan) && userSnap.data()?.is_founder !== true) {
        return res.status(403).json({ error: 'Bank connectivity requires an Enterprise plan' });
      }
    }
    const db = getFirestore();
    const reqRef = db.collection('bank_requisitions').doc(decoded.uid);
    const { action } = req.body || {};
    const userEmail = (decoded.email || req.body?.email || FOUNDER_EMAILS[0] || 'user@stacklens.fr').toLowerCase();
    try {
      if (action === 'connect') {
        const creds = await bridgeCreds();
        const token = await bridgeUserToken(creds, decoded.uid);
        const resp = await fetch(`${BRIDGE_API}/aggregation/connect-sessions`, {
          method: 'POST', headers: bridgeHeaders(creds, token),
          body: JSON.stringify({ user_email: userEmail, callback_url: 'https://stacklens.fr/finance?bank=connected' }),
        });
        const out = await resp.json();
        if (!resp.ok) throw new Error(out?.message || 'Could not start the bank connection');
        await reqRef.set({ status: 'pending', created_at: new Date().toISOString() });
        return res.json({ link: out.url || out.redirect_url });
      }
      if (action === 'status') {
        const snap = await reqRef.get();
        return res.json({ connected: snap.exists });
      }
      if (action === 'disconnect') {
        await reqRef.delete();
        return res.json({ ok: true });
      }
      if (action === 'sync') {
        const snap = await reqRef.get();
        if (!snap.exists) return res.status(400).json({ error: 'No bank connected yet' });
        const creds = await bridgeCreds();
        const token = await bridgeUserToken(creds, decoded.uid);
        const minDate = new Date(); minDate.setDate(minDate.getDate() - 90);
        let url = `${BRIDGE_API}/aggregation/transactions?min_date=${minDate.toISOString().slice(0, 10)}&limit=500`;
        const all = [];
        for (let i = 0; i < 12 && url; i++) {
          const r = await fetch(url, { headers: bridgeHeaders(creds, token) });
          const out = await r.json();
          if (!r.ok) throw new Error(out?.message || 'Could not fetch transactions');
          all.push(...(out.resources || []));
          const next = out.pagination?.next_uri;
          url = next ? (next.startsWith('http') ? next : `https://api.bridgeapi.io${next}`) : null;
        }
        if (!all.length) return res.status(400).json({ error: 'No transactions yet — finish linking your bank in the Bridge window first, then sync.' });
        await reqRef.set({ status: 'linked', last_sync: new Date().toISOString() }, { merge: true });
        return res.json({ candidates: detectRecurring(all.map(normalizeBridgeTx)), transactions_scanned: all.length });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('bankfeed error:', err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  });
});

// ── Directory integrations (credentials held server-side) ────────────────
// Vendor tokens used to sit in localStorage, readable by any XSS. They now
// live in /integration_credentials/{uid}, which has an explicit
// `allow read, write: if false` in firestore.rules — the browser posts them
// once and can never read them back.
//
// One endpoint for every vendor. Per-vendor fetching and normalisation live in
// ./integrations.js, so adding a seventh is one entry there, not another
// endpoint here.
const { VENDORS, IntegrationError } = require('./integrations');
const INTEGRATION_RATE_LIMIT = { maxCalls: 60, windowMs: 60 * 60 * 1000 };

exports.integrations = onRequest({ cors: true, timeoutSeconds: 120 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    if (!await checkRateLimit(decoded.uid, res, INTEGRATION_RATE_LIMIT, 'integrations')) return;

    const { vendor, action } = req.body || {};
    const spec = VENDORS[vendor];
    if (!spec) return res.status(400).json({ error: 'Unknown integration' });

    const ref = getFirestore().collection('integration_credentials').doc(decoded.uid);

    try {
      if (action === 'connect') {
        const creds = {};
        for (const field of spec.required) {
          const value = String(req.body?.credentials?.[field] || '').trim();
          if (!value) return res.status(400).json({ error: `Missing ${field}` });
          creds[field] = value;
        }
        // Optional extras (Salesforce loginUrl) are stored but not required.
        for (const [k, v] of Object.entries(req.body?.credentials || {})) {
          if (!(k in creds) && typeof v === 'string' && v.trim()) creds[k] = v.trim();
        }
        // Prove the credentials work before storing them, so a typo surfaces
        // now rather than at the first sync.
        await spec.listUsers(creds);
        await ref.set({ [vendor]: { ...creds, connected_at: new Date().toISOString() } }, { merge: true });
        return res.json({ ok: true });
      }

      if (action === 'status') {
        const snap = await ref.get();
        const v = snap.exists ? snap.data()[vendor] : null;
        // Never echo credentials back — only whether they are set.
        return res.json({ connected: !!v, connected_at: v?.connected_at || null, last_sync: v?.last_sync || null });
      }

      if (action === 'disconnect') {
        await ref.set({ [vendor]: FieldValue.delete() }, { merge: true });
        return res.json({ ok: true });
      }

      if (action === 'sync') {
        const snap = await ref.get();
        const creds = snap.exists ? snap.data()[vendor] : null;
        if (!creds) return res.status(400).json({ error: 'Not connected yet' });
        const users = await spec.listUsers(creds);
        await ref.set({ [vendor]: { last_sync: new Date().toISOString() } }, { merge: true });
        return res.json({ users });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      if (err instanceof IntegrationError) {
        console.warn(`integrations/${vendor}:`, err.message);
        return res.status(err.httpStatus).json({ error: err.message });
      }
      console.error(`integrations/${vendor} error:`, err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  });
});

// ── Workspace sharing (read-only viewers) ────────────────────────────────
// An owner invites teammates by email; when the invitee signs in with that
// email, the client offers the shared workspace and reads it THROUGH THIS
// ENDPOINT only. Viewers never receive Firestore credentials for the owner's
// data — /workspace_members is server-only and no security rule was widened.
const MAX_WORKSPACE_MEMBERS = 10;
// An agency managing more than this is past what a single-console product
// serves well, and the cap keeps one account from filling the collection.
const MAX_CLIENT_ORGS = 50;
// Enough for a trialling agency to load two real clients and see whether the
// cross-client story works for them, without running a book of business free.
const TRIAL_CLIENT_ORGS = 3;

exports.workspace = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    // 'read' assembles an entire userdata blob (metadata + every chunk), so an
    // unmetered caller is a read amplifier. Generous enough for normal use:
    // 'mine' runs on app load.
    if (!await checkRateLimit(decoded.uid, res, WORKSPACE_RATE_LIMIT, 'workspace')) return;
    const db = getFirestore();
    const { action, email, id, ownerUid, role, name } = req.body || {};
    // SECURITY: only trust the token's email for authorization when Firebase
    // has verified ownership of that mailbox. Otherwise an attacker could
    // register (email/password) under an invited address they don't own — the
    // token still carries the email claim with email_verified=false — and match
    // a pending invite to read the owner's entire workspace. Google and
    // magic-link sign-ins are verified; unverified email/password users must
    // verify before an email-based invite resolves.
    const callerEmail = decoded.email_verified ? (decoded.email || '').toLowerCase() : '';
    const col = db.collection('workspace_members');
    try {
      if (action === 'invite') {
        const target = String(email || '').toLowerCase().trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return res.status(400).json({ error: 'Valid email required' });
        if (target === callerEmail) return res.status(400).json({ error: 'You cannot invite yourself' });
        // Team sharing is a paid feature (founders exempt).
        if (!FOUNDER_UIDS.includes(decoded.uid)) {
          const userSnap = await db.collection('users').doc(decoded.uid).get();
          const plan = effectivePlan(userSnap.exists ? userSnap.data() : null);
          if (['free', 'trial'].includes(plan) && userSnap.data()?.is_founder !== true) {
            return res.status(403).json({ error: 'Team sharing requires a paid plan' });
          }
        }
        const existing = await col.where('owner_uid', '==', decoded.uid).get();
        if (existing.size >= MAX_WORKSPACE_MEMBERS) return res.status(400).json({ error: `Maximum ${MAX_WORKSPACE_MEMBERS} members` });
        if (existing.docs.some(d => d.data().member_email === target)) return res.status(400).json({ error: 'Already invited' });
        const ref = await col.add({
          owner_uid: decoded.uid,
          owner_email: callerEmail || null,
          member_email: target,
          member_uid: null,
          role: 'viewer',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        return res.json({ ok: true, id: ref.id });
      }
      if (action === 'members') {
        const snap = await col.where('owner_uid', '==', decoded.uid).get();
        return res.json({ members: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      if (action === 'revoke') {
        const snap = await col.doc(String(id || '')).get();
        if (!snap.exists || snap.data().owner_uid !== decoded.uid) return res.status(404).json({ error: 'Not found' });
        await snap.ref.delete();
        return res.json({ ok: true });
      }
      if (action === 'mine') {
        // Workspaces shared WITH the caller: match by bound uid, plus by email
        // for pending invites (bind uid on first sight).
        const byUid = await col.where('member_uid', '==', decoded.uid).get();
        const out = byUid.docs.map(d => ({ id: d.id, ...d.data() }));
        if (callerEmail) {
          const byEmail = await col.where('member_email', '==', callerEmail).get();
          for (const d of byEmail.docs) {
            if (out.some(o => o.id === d.id)) continue;
            await d.ref.update({ member_uid: decoded.uid, status: 'accepted' });
            out.push({ id: d.id, ...d.data(), member_uid: decoded.uid, status: 'accepted' });
          }
        }
        return res.json({ workspaces: out.map(w => ({ owner_uid: w.owner_uid, owner_email: w.owner_email, role: w.role })) });
      }
      // ── Client workspaces owned by this agency ──────────────────────
      // A workspace with no owning user, for an MSP managing several
      // companies. The id is deliberately not an auth uid, so isOwner(uid) in
      // firestore.rules can never match it and there is no direct-database
      // path to one: every read and write comes through here.
      if (action === 'createorg') {
        let clientName;
        try { clientName = cleanOrgName(name); }
        catch (err) { return res.status(err.httpStatus || 400).json({ error: err.message }); }

        // Client workspaces are a paid capability, but a trial has to be able
        // to reach them or it cannot evaluate the thing it is trialling. The
        // audience for this feature is an agency managing several companies;
        // blocking them until they pay means the only feature they care about
        // is the one they cannot see. A free plan stays blocked; a trial gets
        // a small allowance, enough to judge it and not enough to run an
        // agency on indefinitely.
        const userSnap = await db.collection('users').doc(decoded.uid).get();
        // effectivePlan, not the raw field: nothing ever rewrites plan from
        // 'trial' back to 'free' when the seven days are up, so reading the
        // field directly kept granting the trial allowance indefinitely.
        const plan = effectivePlan(userSnap.exists ? userSnap.data() : null);
        const privileged = FOUNDER_UIDS.includes(decoded.uid) || userSnap.data()?.is_founder === true;
        if (!privileged && plan === 'free') {
          return res.status(403).json({ error: 'Managing client workspaces requires a trial or a paid plan' });
        }

        const orgsCol = db.collection('client_orgs');
        const existing = await orgsCol.where('owner_uid', '==', decoded.uid).get();
        // Only live ones count. A deleted workspace is kept for the retention
        // window, and holding a slot hostage for ninety days would make a
        // trial's three effectively one.
        const liveCount = existing.docs.filter(d => !isOrgDeleted(d.data())).length;
        const cap = privileged ? MAX_CLIENT_ORGS
          : plan === 'trial' ? TRIAL_CLIENT_ORGS : MAX_CLIENT_ORGS;
        if (liveCount >= cap) {
          return res.status(400).json({
            error: plan === 'trial'
              ? `A trial covers ${TRIAL_CLIENT_ORGS} client workspaces. Subscribe to add more.`
              : `Maximum ${MAX_CLIENT_ORGS} client workspaces`,
          });
        }

        let orgId;
        try { orgId = newClientOrgId(nodeCrypto.randomBytes(16).toString('hex')); }
        catch (err) { return res.status(500).json({ error: err.message }); }

        await orgsCol.doc(orgId).set({
          org_id: orgId, owner_uid: decoded.uid, owner_email: callerEmail || null,
          name: clientName, created_at: Date.now(),
        });
        // Seed an empty workspace so `read` has something to return.
        await db.collection('userdata').doc(orgId).set({
          _uid: orgId, _updatedAt: Date.now(),
          user: { company: clientName, is_client_org: true },
          tools: [], employees: [], access: [],
        });
        return res.json({ org: { org_id: orgId, name: clientName } });
      }

      if (action === 'listorgs') {
        const snap = await db.collection('client_orgs').where('owner_uid', '==', decoded.uid).get();
        const live = [];
        const deleted = [];

        // ── Spend and tool count per client ───────────────────────────────
        //
        // A list of client names told an agency nothing: the only way to see
        // what was inside one was to open it, which swaps the whole app into
        // that customer's data and back out again.
        //
        // One read per client, of the workspace's main document only. `tools`
        // lives there; only employees, access and audit_log are chunked, so
        // this does not touch the chunks subcollection and its cost does not
        // grow with the size of a workspace. Capped by the plan's
        // client-workspace limit, and this endpoint is rate-limited.
        //
        // Each figure carries its own currency. A client workspace has its
        // own currency setting and amounts are never converted (see
        // src/lib/currency.js), so the rows must not be totalled — and
        // nothing here totals them.
        const summaryOf = async (orgId) => {
          try {
            const docSnap = await db.collection('userdata').doc(orgId).get();
            if (!docSnap.exists) return { tools: 0, monthly_spend: 0, currency: '', updated_at: null };
            const data = docSnap.data();
            return {
              tools: billedToolCount(data),
              monthly_spend: monthlySpend(data),
              currency: currencySymbol(data),
              updated_at: data._updatedAt || null,
            };
          } catch (err) {
            // A summary is decoration; the list is the feature. A failed read
            // must not take the page down with it, so the row renders without
            // its numbers rather than not at all.
            console.error('listorgs summary failed for', orgId, err?.message);
            return null;
          }
        };

        for (const d of snap.docs) {
          const o = d.data();
          const row = { org_id: d.id, name: o.name, created_at: o.created_at };
          if (isOrgDeleted(o)) {
            deleted.push({ ...row, deleted_at: o.deleted_at, days_left: daysUntilPurge(o) });
          } else {
            // Deleted workspaces deliberately get no summary: they are frozen,
            // the numbers are no longer a fact about anything being paid for,
            // and it is one read each for data nobody is acting on.
            live.push({ ...row, summary: await summaryOf(d.id) });
          }
        }
        // `orgs` keeps its old shape and meaning: the workspaces you can work
        // in. A deleted one is not one of those, so it must not appear there.
        return res.json({ orgs: live, deleted, retention_days: RETENTION_DAYS });
      }

      if (action === 'deleteorg') {
        // Marks the record and keeps the data. purgeClientOrgs removes it for
        // good once the retention window closes. Destroying a client's whole
        // inventory on one click of a prompt-confirmed name was not a risk
        // worth carrying for the sake of freeing a Firestore document early.
        const orgId = String(id || '');
        if (!isClientOrgId(orgId)) return res.status(400).json({ error: 'Not a client workspace id' });
        const ref = db.collection('client_orgs').doc(orgId);
        const snap = await ref.get();
        if (!snap.exists || snap.data().owner_uid !== decoded.uid) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (isOrgDeleted(snap.data())) {
          return res.json({ ok: true, already: true, days_left: daysUntilPurge(snap.data()) });
        }
        const fields = softDeleteFields();
        await ref.update(fields);
        return res.json({ ok: true, days_left: daysUntilPurge(fields), retention_days: RETENTION_DAYS });
      }

      if (action === 'restoreorg') {
        const orgId = String(id || '');
        if (!isClientOrgId(orgId)) return res.status(400).json({ error: 'Not a client workspace id' });
        const ref = db.collection('client_orgs').doc(orgId);
        const snap = await ref.get();
        if (!snap.exists || snap.data().owner_uid !== decoded.uid) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (!isOrgDeleted(snap.data())) return res.json({ ok: true, already: true });
        // Past the window the purge may not have run yet, but the promise was
        // ninety days: restoring on day 95 would be restoring data the
        // customer was told is gone.
        if (isPurgeDue(snap.data())) {
          return res.status(410).json({ error: `The ${RETENTION_DAYS}-day recovery window has passed` });
        }
        await ref.update(restoreFields());
        return res.json({ ok: true });
      }

      if (action === 'read') {
        const target = String(ownerUid || '');
        const orgSnap = isClientOrgId(target)
          ? await db.collection('client_orgs').doc(target).get() : null;
        const snap = await col.where('owner_uid', '==', target).get();
        const access = resolveWorkspaceAccess({
          clientOrg: orgSnap?.exists ? orgSnap.data() : null,
          memberships: snap.docs.map(d => d.data()),
          callerUid: decoded.uid, callerEmail,
        });
        if (!access) return res.status(403).json({ error: 'Not a member of this workspace' });
        const me = snap.docs.find(d => d.data().member_uid === decoded.uid ||
          (callerEmail && d.data().member_email === callerEmail));
        if (me && !me.data().member_uid) await me.ref.update({ member_uid: decoded.uid, status: 'accepted' });
        const dataSnap = await db.collection('userdata').doc(target).get();
        if (!dataSnap.exists) return res.status(404).json({ error: 'Workspace has no data yet' });
        const data = await assembleUserdata(dataSnap);
        // Owner's billing internals never leave the server.
        const u = data.user || {};
        // A client workspace has no owning user and therefore no plan of its
        // own. It runs on the agency's entitlement, read fresh here so a plan
        // change takes effect without touching every client record.
        let planSource = u;
        if (access.via === 'client_org') {
          const agency = await db.collection('users').doc(decoded.uid).get();
          planSource = agency.exists ? agency.data() : {};
        }
        data.user = {
          email: u.email || null, displayName: u.displayName || null, company: u.company || null,
          plan: effectivePlan(planSource),
          subscription_plan: planSource.subscription_plan || planSource.plan || 'free',
          is_founder: planSource.is_founder === true,
          is_client_org: u.is_client_org === true,
        };
        delete data._uid;
        return res.json({ data, role: access.role });
      }

      // Owner promotes or demotes a member. Only the owner of the workspace
      // may change a role, and only between the two member roles — an owner
      // cannot mint an 'owner' or 'admin' member through this path.
      if (action === 'setrole') {
        const snap = await col.doc(String(id || '')).get();
        if (!snap.exists || snap.data().owner_uid !== decoded.uid) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (!MEMBER_ROLES.includes(role)) {
          return res.status(400).json({ error: `role must be one of ${MEMBER_ROLES.join(', ')}` });
        }
        await snap.ref.update({ role });
        return res.json({ ok: true, role });
      }

      // A member with the editor role writes the owner's data.
      //
      // The tenant boundary for this path is function code rather than
      // firestore.rules, because the caller is not the owner and the rules say
      // isOwner(uid). Every decision it rests on lives in workspace-write.js
      // with its own tests, including the two ways this destroys the owner's
      // data if written naively: accepting the member's cut-down `user` record
      // back, and syncing a copy their browser trimmed to fit localStorage.
      if (action === 'write') {
        const target = String(ownerUid || '');
        if (!target) return res.status(400).json({ error: 'ownerUid required' });

        const orgSnap = isClientOrgId(target)
          ? await db.collection('client_orgs').doc(target).get() : null;
        // Frozen, not gone: a deleted workspace stays readable for the
        // retention window so its data can be exported and handed back, but
        // it must not accept edits — otherwise "deleted" means nothing, and
        // an edit made in one would vanish at the purge.
        if (orgSnap?.exists && isOrgDeleted(orgSnap.data())) {
          return res.status(409).json({
            error: 'This client workspace is deleted. Restore it before making changes.',
          });
        }
        const snap = await col.where('owner_uid', '==', target).get();
        const access = resolveWorkspaceAccess({
          clientOrg: orgSnap?.exists ? orgSnap.data() : null,
          memberships: snap.docs.map(d => d.data()),
          callerUid: decoded.uid, callerEmail,
        });
        try {
          assertCanWrite(access && { role: access.role });
        } catch (err) {
          return res.status(err.httpStatus || 403).json({ error: err.message });
        }

        const ownerRef = db.collection('userdata').doc(target);
        const ownerSnap = await ownerRef.get();
        if (!ownerSnap.exists) return res.status(404).json({ error: 'Workspace has no data yet' });
        const ownerData = await assembleUserdata(ownerSnap);

        let merged;
        try {
          merged = buildSafeUpdate(ownerData, req.body?.data);
        } catch (err) {
          return res.status(err.httpStatus || 400).json({ error: err.message });
        }

        // Same chunk layout the owner's own browser writes — see the drift
        // test in src/lib/chunk-format.test.js.
        const meta = { ...merged, _uid: target, _updatedAt: Date.now() };
        const chunkCounts = {};
        const chunksRef = ownerRef.collection('chunks');
        const chunkWrites = [];
        for (const key of CHUNKED_KEYS) {
          const slices = sliceCollection(merged[key]);
          delete meta[key];
          chunkCounts[key] = slices.length;
          slices.forEach((items, i) => chunkWrites.push([chunksRef.doc(`${key}_${i}`), { items }]));
        }
        meta._chunks = chunkCounts;

        // Slices left behind by a previous, larger save.
        const existingChunks = await chunksRef.get();
        const staleChunks = [];
        existingChunks.forEach(d => {
          const m = d.id.match(/^(.+)_(\d+)$/);
          if (!m || !(m[1] in chunkCounts) || Number(m[2]) >= chunkCounts[m[1]]) {
            staleChunks.push(d.ref);
          }
        });

        // The revision this editor's copy was based on. Before this check the
        // write was an unconditional overwrite of the owner's whole document:
        // an owner and an editor working the same afternoon each deleted the
        // other's work, silently, and neither ever found out.
        //
        // Read from the raw payload rather than `merged`, because
        // buildSafeUpdate strips it — a member must not be able to pin the
        // counter and defeat the check for everyone.
        const baseRev = revOf(req.body?.data);
        let committedRev;
        try {
          committedRev = await db.runTransaction(async (tx) => {
            // Re-read inside the transaction. The earlier read above is what
            // the merge was built on; if anyone committed between the two, the
            // revision has moved and this refuses rather than overwrites.
            const fresh = await tx.get(ownerRef);
            const storedRev = fresh.exists ? revOf(fresh.data()) : null;
            if (fresh.exists && isStaleWrite(storedRev, baseRev)) {
              const stale = new Error('stale');
              stale.code = 'STALE_WRITE';
              stale.storedRev = storedRev;
              throw stale;
            }
            const rev = nextRev(storedRev);
            meta[REV_FIELD] = rev;
            tx.set(ownerRef, meta);
            for (const [ref, value] of chunkWrites) tx.set(ref, value);
            for (const ref of staleChunks) tx.delete(ref);
            return rev;
          });
        } catch (err) {
          if (err?.code === 'STALE_WRITE') {
            // 409, and the client must not retry the same payload — that is
            // the overwrite this check exists to prevent. The client shows the
            // choice instead: take theirs, or knowingly replace it.
            return res.status(409).json({
              error: 'This workspace was changed by someone else while you were editing.',
              conflict: true,
              rev: err.storedRev,
            });
          }
          throw err;
        }
        return res.json({ ok: true, rev: committedRev });
      }

      // ── Delete my own account ────────────────────────────────────────────
      //
      // Self-service deletion cannot be done from the browser. The client
      // version removed the Auth user first, and the Firestore rules are
      // isOwner(uid) — so its own follow-up deletes were unauthenticated by
      // the time they ran, and very likely denied. It also could never reach
      // the chunks subcollection, the backups, the stored vendor credentials
      // or the memberships: several are server-only by rule, which is correct
      // and means only a function can clear them.
      //
      // It lives on this endpoint rather than in a function of its own because
      // the deploy pipeline sits exactly at the regional CPU ceiling at twenty
      // functions; a twenty-first is a failed deploy. This endpoint already
      // authorises per action and already owns workspace data lifecycle.
      //
      // Requires the caller's email to be verified, and requires them to type
      // it back. A GDPR erasure is irreversible and unauthenticated deletion
      // of somebody else's account is the worst thing this endpoint could do,
      // so the confirmation is a second, independent check against a
      // token that has been replayed or mis-scoped.
      if (action === 'deleteaccount') {
        if (FOUNDER_UIDS.includes(decoded.uid)) {
          return res.status(400).json({ error: 'The founder account cannot be deleted here' });
        }
        if (!callerEmail) {
          return res.status(403).json({
            error: 'Verify your email address before deleting your account',
          });
        }
        if (String(req.body?.confirmEmail || '').toLowerCase().trim() !== callerEmail) {
          return res.status(400).json({
            error: 'Type your email address exactly to confirm deletion',
          });
        }
        const counts = await purgeAccount(db, decoded.uid, {
          email: callerEmail,
          deleteAuthUser: async (u) => {
            try { await getAuth().deleteUser(u); }
            catch (err) { if (err.code !== 'auth/user-not-found') throw err; }
          },
        });
        console.warn('self-service account deletion purged', decoded.uid, JSON.stringify(counts));
        return res.json({ ok: true, purged: counts });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('workspace error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });
});

// ── Invoice email inbox ──────────────────────────────────────────────────
// Each user gets a unique address invoices-{token}@in.stacklens.fr. SendGrid
// Inbound Parse posts incoming mail to invoiceInbound; PDF attachments are
// text-extracted and AI-parsed server-side, then staged in /inbox_invoices
// for review in the Budget tab. Nothing touches the user's data blob until
// they apply the rows client-side (client remains the blob's only writer).
const INBOX_DOMAIN = 'in.stacklens.fr';

exports.invoiceInbox = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const db = getFirestore();
    const { action, ids } = req.body || {};
    try {
      if (action === 'get') {
        const userRef = db.collection('users').doc(decoded.uid);
        const snap = await userRef.get();
        let token = snap.exists ? snap.data().invoice_inbox_token : null;
        if (!token) {
          token = nodeCrypto.randomBytes(6).toString('hex');
          await db.collection('inbox_tokens').doc(token).set({ uid: decoded.uid, created_at: new Date().toISOString() });
          await userRef.set({ invoice_inbox_token: token }, { merge: true });
        }
        return res.json({ address: `invoices-${token}@${INBOX_DOMAIN}` });
      }
      if (action === 'list') {
        const snap = await db.collection('inbox_invoices').doc(decoded.uid)
          .collection('items').orderBy('received_at', 'desc').limit(50).get();
        return res.json({ items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      if (action === 'ack') {
        if (!Array.isArray(ids) || !ids.length || ids.length > 100) return res.status(400).json({ error: 'ids required' });
        const batch = db.batch();
        ids.forEach(id => batch.delete(
          db.collection('inbox_invoices').doc(decoded.uid).collection('items').doc(String(id))));
        await batch.commit();
        return res.json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('invoiceInbox error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });
});

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const Busboy = require('busboy');
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024, files: 8 } });
    const fields = {}; const files = [];
    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', c => chunks.push(c));
      stream.on('limit', () => stream.resume());
      stream.on('end', () => files.push({ filename: info.filename || name, mimeType: info.mimeType || '', buffer: Buffer.concat(chunks) }));
    });
    bb.on('error', reject);
    bb.on('finish', () => resolve({ fields, files }));
    bb.end(req.rawBody);
  });
}

const INVOICE_EXTRACT_PROMPT = `You are an invoice data extractor. Below are one or more supplier invoices (raw text). For EACH invoice, extract the fields and return ONLY a JSON array (no markdown, no commentary):
[{"file_index": 1, "vendor": "supplier name", "amount": 123.45, "currency": "EUR", "invoice_date": "YYYY-MM-DD", "period_start": "YYYY-MM-DD or null", "period_end": "YYYY-MM-DD or null", "billing_cycle": "monthly" | "yearly" | "quarterly" | "one_time"}]
Rules: amount is the total including tax. billing_cycle is your best inference from the service period or wording (a 12-month period = yearly). Use null when a field is not present. vendor is the company SELLING the service.`;

async function extractInvoicesWithAI(apiKey, texts) {
  const rows = [];
  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5);
    const content = INVOICE_EXTRACT_PROMPT + '\n\n' +
      batch.map((b, j) => `--- INVOICE ${j + 1} (${b.name}) ---\n${b.text}`).join('\n\n');
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-5', max_tokens: 2000, thinking: { type: 'disabled' },
          messages: [{ role: 'user', content }],
        }),
      });
      const out = await resp.json();
      if (!resp.ok) { console.warn('extractInvoicesWithAI api error:', out?.error?.message); continue; }
      const raw = (out.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      (Array.isArray(parsed) ? parsed : []).forEach(p => {
        const amount = Number(p.amount || 0);
        const vendor = String(p.vendor || '').trim().slice(0, 120);
        if (!vendor || !(amount > 0)) return;
        rows.push({
          vendor, amount,
          currency: String(p.currency || 'EUR').slice(0, 8),
          invoice_date: p.invoice_date || null,
          period_start: p.period_start || null,
          period_end: p.period_end || null,
          billing_cycle: ['monthly', 'yearly', 'quarterly', 'one_time'].includes(p.billing_cycle) ? p.billing_cycle : 'one_time',
          file: batch[(p.file_index || 1) - 1]?.name || '',
          source: 'email',
        });
      });
    } catch (e) { console.warn('extractInvoicesWithAI failed:', e?.message); }
  }
  return rows;
}

// SendGrid Inbound Parse webhook. Unauthenticated by nature — bounded by the
// token lookup (unknown tokens dropped), attachment caps, and a per-instance
// throttle. Always answers 200 so SendGrid never retry-loops.
let _inboundCount = 0;
setInterval(() => { _inboundCount = 0; }, 60 * 1000).unref?.();
exports.invoiceInbound = onRequest({ cors: false, timeoutSeconds: 120, memory: '512MiB', secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  if (_inboundCount++ > 60) return res.status(200).send('throttled');
  try {
    const { fields, files } = await parseMultipart(req);
    const to = String(fields.to || fields.envelope || '');
    const m = to.match(/invoices-([a-z0-9]{8,16})@/i);
    if (!m) return res.status(200).send('ignored');
    const db = getFirestore();
    const tokenSnap = await db.collection('inbox_tokens').doc(m[1].toLowerCase()).get();
    if (!tokenSnap.exists) return res.status(200).send('unknown token');
    const uid = tokenSnap.data().uid;

    const pdfParse = require('pdf-parse');
    const texts = [];
    for (const f of files.slice(0, 5)) {
      if (!f.buffer?.length || f.buffer.length > 8 * 1024 * 1024) continue;
      if (!(/pdf/i.test(f.mimeType) || /\.pdf$/i.test(f.filename))) continue;
      try {
        const out = await pdfParse(f.buffer);
        if (out.text && out.text.trim().length > 40) texts.push({ name: f.filename, text: out.text.slice(0, 3000) });
      } catch (e) { console.warn('invoiceInbound pdf failed:', f.filename, e?.message); }
    }
    // No readable attachments — many vendors put the invoice in the email body.
    if (!texts.length && fields.text && String(fields.text).trim().length > 80) {
      texts.push({ name: 'email body', text: String(fields.text).slice(0, 3000) });
    }
    if (!texts.length) return res.status(200).send('no readable content');

    const rows = await extractInvoicesWithAI(ANTHROPIC_API_KEY.value(), texts);
    if (rows.length) {
      const batch = db.batch();
      const col = db.collection('inbox_invoices').doc(uid).collection('items');
      rows.forEach(r => batch.set(col.doc(), {
        ...r,
        from: String(fields.from || '').slice(0, 200),
        subject: String(fields.subject || '').slice(0, 200),
        received_at: new Date().toISOString(),
      }));
      await batch.commit();
    }
    console.log('invoiceInbound:', uid, texts.length, 'docs →', rows.length, 'invoices staged');
    return res.status(200).send('ok');
  } catch (err) {
    console.error('invoiceInbound error:', err);
    return res.status(200).send('error');
  }
});

// ── Daily Alerts (SendGrid) ──────────────────────────────────────────────
const { onSchedule } = require('firebase-functions/v2/scheduler');

// ── /purgeClientOrgs — the end of the retention window ────────────────────
//
// deleteorg marks a client workspace and keeps its data for RETENTION_DAYS so
// it can be restored or exported. This is the half that makes that promise
// true in both directions: without it, "deleted" would mean hidden forever,
// the data would sit in Firestore indefinitely, and telling a customer their
// records were erased after ninety days would be false.
//
// Runs daily. A workspace whose window has closed loses its chunks, its
// userdata document and its org record — the same hard delete deleteorg used
// to do immediately, now on a schedule the customer was told about.
exports.purgeClientOrgs = onSchedule({
  schedule: 'every day 04:00',
  timeZone: 'Europe/Paris',
  region: 'us-central1',
  timeoutSeconds: 540,
}, async () => {
  const db = getFirestore();
  const snap = await db.collection('client_orgs').get();
  let purged = 0;
  for (const orgSnap of snap.docs) {
    if (!isPurgeDue(orgSnap.data())) continue;
    try {
      const dataRef = db.collection('userdata').doc(orgSnap.id);
      const chunks = await dataRef.collection('chunks').get();
      const batch = db.batch();
      chunks.forEach(c => batch.delete(c.ref));
      batch.delete(dataRef);
      batch.delete(orgSnap.ref);
      await batch.commit();
      purged++;
    } catch (err) {
      // One unremovable record must not stop the rest: a retention promise
      // that silently stops running is worse than one that logs and continues.
      console.error('purgeClientOrgs', orgSnap.id, err?.message);
    }
  }
  if (purged) console.warn(`purgeClientOrgs: removed ${purged} client workspace(s)`);
});

// ── Daily data backup ────────────────────────────────────────────────────
// Copies every /userdata doc (+ its chunks subcollection) into /backups so a
// client-side bug that corrupts or wipes a user's blob can be recovered from a
// copy no client code can touch (default-deny rules; Admin SDK only).
//
// Was weekly, which meant up to seven days of work could be lost to recover
// from anything. Daily costs almost nothing at this data volume — a snapshot
// is a few documents per workspace — and turns "we lost your week" into "we
// lost your morning".
//
// The export is still called weeklyBackup, which is a wart, and deliberate.
// The deploy pipeline installs functions with `--only functions:<explicit
// list>`, which never removes a function that disappeared from the source. So
// renaming the export would create dailyBackup and leave weeklyBackup
// deployed and still firing — a twenty-first function holding a vCPU against
// the regional ceiling that has already failed three deploys. A misleading
// identifier is a wart; a zombie scheduled function is an outage. Renaming it
// safely means deleting the old one in the Firebase console first, which is a
// separate deliberate step.
//
// BACKUP_RETENTION_DAYS is held to the window the DPA and the privacy page
// promise, by src/lib/backup-retention.test.js. Snapshots outlive the account
// they belong to otherwise: the pruner is the only thing that eventually
// removes a deleted user's data from /backups, so a window longer than the
// promise makes the promise false.

const BACKUP_RETENTION_DAYS = 30;

exports.weeklyBackup = onSchedule({
  schedule: 'every day 03:00',
  timeZone: 'Europe/Paris',
  region: 'us-central1',
  timeoutSeconds: 540,
}, async () => {
  const db = getFirestore();
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);

  /** Remove one snapshot and the chunks underneath it. */
  const dropSnapshot = async (ref) => {
    const cs = await ref.collection('chunks').get();
    let batch = db.batch(); let n = 0;
    for (const c of cs.docs) {
      batch.delete(c.ref);
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    batch.delete(ref);
    await batch.commit();
  };

  const snap = await db.collection('userdata').get();
  let backed = 0;
  for (const docSnap of snap.docs) {
    try {
      const backupRef = db.collection('backups').doc(`${docSnap.id}__${stamp}`);
      await backupRef.set({ uid: docSnap.id, created_at: stamp, data: docSnap.data() });
      const chunks = await docSnap.ref.collection('chunks').get();
      let batch = db.batch(); let n = 0;
      for (const c of chunks.docs) {
        batch.set(backupRef.collection('chunks').doc(c.id), c.data());
        if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
      }
      if (n % 400 !== 0 || n === 0) await batch.commit();
      backed++;
    } catch (err) {
      console.error('weeklyBackup failed for', docSnap.id, err?.message);
    }
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);
  const olds = await db.collection('backups').where('created_at', '<', cutoff.toISOString().slice(0, 10)).get();
  for (const o of olds.docs) await dropSnapshot(o.ref);

  // ── Snapshots whose account is gone ──────────────────────────────────────
  //
  // Deleting an account removes /users and /userdata. It does not touch
  // /backups, so without this the full workspace — every employee name and
  // email in it — sat here until the age cutoff caught it, which is the one
  // thing the DPA's "deleted within 30 days" cannot afford to be late on.
  //
  // Written as a sweep rather than as a step inside the delete paths on
  // purpose: there are several ways an account can go (self-service, the
  // founder tool, a client workspace purged by purgeClientOrgs), and a sweep
  // that asks "does the source still exist?" covers the one somebody forgets
  // to wire up next year. The delete paths should still do it directly — this
  // is the net underneath them, not a substitute.
  //
  // Conservative by construction: a snapshot is dropped only when the source
  // read SUCCEEDS and reports the document absent. A transient read failure
  // keeps the backup, because the cost of keeping one too long is a late
  // deletion and the cost of getting this wrong is erasing the only copy of a
  // live customer's data.
  const sourceExists = new Map();
  const allBackups = await db.collection('backups').get();
  let orphans = 0;
  for (const b of allBackups.docs) {
    const ownerUid = b.data()?.uid;
    if (!ownerUid) continue;
    if (!sourceExists.has(ownerUid)) {
      try {
        const src = await db.collection('userdata').doc(ownerUid).get();
        sourceExists.set(ownerUid, src.exists);
      } catch (err) {
        console.error('backup orphan check failed for', ownerUid, err?.message);
        continue;
      }
    }
    if (sourceExists.get(ownerUid) === false) {
      try { await dropSnapshot(b.ref); orphans++; }
      catch (err) { console.error('orphan snapshot delete failed', b.id, err?.message); }
    }
  }

  console.log('Daily backup:', backed, 'workspaces backed up;',
    olds.size, 'aged out;', orphans, 'orphaned snapshots removed');
});

// Rollout switch: was true during live validation (founder-only). Flipped to
// false 2026-07 — every user with daily_alerts enabled now receives digests.
// Users can opt out via user.daily_alerts === false (checked below).
const ALERTS_FOUNDERS_ONLY = false;

// Server-side twin of src/lib/budget.js allocateSpendByDepartment.
function allocSpendByDept(data) {
  const empDept = {};
  // Lowercase keys — mirrors src/lib/budget.js ("Sales" and "sales" are one department)
  (data.employees || []).forEach(e => { empDept[e.id] = (e.department || '').trim().toLowerCase() || 'other'; });
  const seatsByTool = {};
  (data.access || []).filter(a => a.status === 'active').forEach(a => {
    const dept = empDept[a.employee_id];
    if (!dept) return;
    if (!seatsByTool[a.tool_id]) seatsByTool[a.tool_id] = {};
    seatsByTool[a.tool_id][dept] = (seatsByTool[a.tool_id][dept] || 0) + 1;
  });
  const byDept = {};
  (data.tools || []).filter(t => t.status !== 'archived').forEach(tool => {
    const cost = Number(tool.cost_per_month || tool.cost_monthly || tool.cost || 0);
    if (!cost) return;
    const seats = seatsByTool[tool.id];
    const totalSeats = seats ? Object.values(seats).reduce((s, n) => s + n, 0) : 0;
    if (!totalSeats) return; // unallocated spend has no department budget to breach
    Object.entries(seats).forEach(([dept, n]) => {
      byDept[dept] = (byDept[dept] || 0) + cost * (n / totalSeats);
    });
  });
  return byDept;
}

// Spent-to-date per department, matching the Budget tab: recorded monthly
// snapshots where they exist, run-rate fallback elsewhere.
function spentToDateByDept(data, byDeptMonthly, now) {
  const year = now.getFullYear();
  const hist = Object.fromEntries((data.spend_history || []).map(s => [s.month, s]));
  const completed = now.getMonth();
  const frac = (now.getDate() - 1) / new Date(year, now.getMonth() + 1, 0).getDate();
  const out = {};
  Object.entries(byDeptMonthly).forEach(([dept, monthly]) => {
    let sum = 0;
    for (let m = 0; m < completed; m++) {
      const snap = hist[`${year}-${String(m + 1).padStart(2, '0')}`];
      sum += snap?.by_department?.[dept] ?? monthly;
    }
    out[dept] = sum + monthly * frac;
  });
  return out;
}

exports.dailyAlerts = onSchedule({
  schedule: 'every day 08:30',
  timeZone: 'Europe/Paris',
  region: 'us-central1',
  secrets: [SENDGRID_API_KEY],
}, async () => {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(SENDGRID_API_KEY.value());
  const db = getFirestore();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const fmt = (n) => Math.round(n).toLocaleString('en-GB');
  let sent = 0;

  const snapshot = await db.collection('userdata').get();
  for (const docSnap of snapshot.docs) {
    const uid = docSnap.id;
    if (ALERTS_FOUNDERS_ONLY && !FOUNDER_UIDS.includes(uid)) continue;
    const data = await assembleUserdata(docSnap);
    const email = await verifiedEmailForUid(uid);
    const cur = currencySymbol(data);
    if (!email) continue;
    if (data?.user?.daily_alerts === false) continue;

    // Memory of what was already alerted — one email per event, ever.
    const stateRef = db.collection('alert_state').doc(uid);
    const stateSnap = await stateRef.get();
    const sentKeys = stateSnap.exists ? (stateSnap.data().sent || {}) : {};
    const newKeys = {};
    const alerts = { renewals: [], budgets: [], security: [] };

    // 1) Renewals crossing the 30-day and 7-day thresholds (once each).
    if (data?.user?.renewal_alerts !== false) {
      (data.tools || []).forEach(t => {
        if (!t.renewal_date || t.renewal_date < todayStr) return;
        const days = Math.floor((new Date(t.renewal_date) - now) / 86400000);
        const idBase = `renewal_${t.id || t.name}_${t.renewal_date}`;
        for (const threshold of [30, 7]) {
          const key = `${idBase}_${threshold}`;
          if (days <= threshold && !sentKeys[key] && !newKeys[key]) {
            newKeys[key] = todayStr;
            alerts.renewals.push({ name: t.name, date: t.renewal_date, days, annual: (Number(t.cost_per_month) || 0) * 12 });
            break; // one line per tool per run — the tighter threshold wins
          }
        }
      });
    }

    // 2) Department budgets crossing 80% / 100% consumption (once each per year).
    const year = now.getFullYear();
    const budgets = (data.budgets || []).filter(b => b.year === year && b.annual > 0);
    if (budgets.length) {
      const byDeptMonthly = allocSpendByDept(data);
      const spent = spentToDateByDept(data, byDeptMonthly, now);
      budgets.forEach(b => {
        // One lookup, computed once: the percentage and the amount in the
        // email must come from the same key or they contradict each other.
        const deptKey = (b.department || '').toLowerCase();
        const deptSpent = spent[deptKey] || 0;
        const pct = (deptSpent / b.annual) * 100;
        for (const threshold of [100, 80]) {
          const key = `budget_${year}_${b.department}_${threshold}`;
          if (pct >= threshold && !sentKeys[key] && !newKeys[key]) {
            newKeys[key] = todayStr;
            alerts.budgets.push({ department: b.department, pct: Math.round(pct), budget: b.annual, spent: Math.round(deptSpent) });
            break;
          }
        }
      });
    }

    // 3) Former employees whose access is still active (once per employee).
    const inactive = (data.employees || []).filter(e => e.status && e.status !== 'active');
    const inactiveById = Object.fromEntries(inactive.map(e => [e.id, e]));
    const flagged = new Set();
    (data.access || []).forEach(a => {
      const emp = inactiveById[a.employee_id];
      if (!emp || a.status === 'revoked' || flagged.has(emp.id)) return;
      const key = `exaccess_${emp.id}`;
      if (sentKeys[key] || newKeys[key]) return;
      flagged.add(emp.id);
      newKeys[key] = todayStr;
      const count = (data.access || []).filter(x => x.employee_id === emp.id && x.status !== 'revoked').length;
      alerts.security.push({ name: emp.full_name || emp.email, count });
    });

    const total = alerts.renewals.length + alerts.budgets.length + alerts.security.length;
    if (!total) continue;

    const section = (title, rows) => rows.length ? `
      <div style="margin-top:20px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#3b82f6;margin-bottom:8px">${title}</div>${rows.join('')}</div>` : '';
    const line = (text, detail, color = '#e2e8f0') => `
      <div style="padding:10px 12px;background:#1e293b;border-radius:8px;margin-bottom:6px">
        <span style="color:${color};font-weight:700;font-size:14px">${text}</span>
        <span style="color:#94a3b8;font-size:13px"> — ${detail}</span>
      </div>`;

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:12px;overflow:hidden">
      <div style="padding:24px;background:#1e293b"><h1 style="color:white;margin:0 0 4px;font-size:22px">Stacklens</h1><p style="color:#94a3b8;margin:0">${total} new alert${total > 1 ? 's' : ''} in your environment</p></div>
      <div style="padding:24px">
        ${section('Upcoming renewals', alerts.renewals.map(r => line(r.name, `renews ${r.date} (${r.days} days)` + (r.annual ? ` · ${cur}${fmt(r.annual)}/yr` : ''), r.days <= 7 ? '#ef4444' : '#f59e0b')))}
        ${section('Budget thresholds', alerts.budgets.map(b => line(b.department, `${b.pct}% of annual budget consumed (${cur}${fmt(b.spent)} of ${cur}${fmt(b.budget)})`, b.pct >= 100 ? '#ef4444' : '#f59e0b')))}
        ${section('Access security', alerts.security.map(s => line(s.name, `no longer active but still holds ${s.count} access grant${s.count > 1 ? 's' : ''}`, '#ef4444')))}
        <div style="text-align:center;margin-top:24px"><a href="https://stacklens.fr/dashboard" style="background:#3b82f6;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Open Stacklens →</a></div>
      </div>
      <div style="padding:16px;text-align:center;border-top:1px solid #1e293b"><p style="color:#475569;font-size:12px;margin:0">Stacklens · <a href="https://stacklens.fr/settings" style="color:#475569">Manage notifications</a></p></div>
    </div>`;

    const worst = alerts.security.length ? `🚨 ${alerts.security[0].name} still has access`
      : alerts.budgets.length ? `⚠️ ${alerts.budgets[0].department} budget at ${alerts.budgets[0].pct}%`
      : `🔔 ${alerts.renewals[0].name} renews in ${alerts.renewals[0].days} days`;

    try {
      await sgMail.send({
        to: email,
        from: { email: 'hello@stacklens.fr', name: 'Stacklens' },
        subject: total > 1 ? `${worst} (+${total - 1} more)` : worst,
        html,
      });
      // Only remember alerts that were actually delivered; prune entries older
      // than 400 days so the doc never grows unbounded.
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 400);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const pruned = Object.fromEntries(Object.entries({ ...sentKeys, ...newKeys }).filter(([, d]) => d >= cutoffStr));
      await stateRef.set({ sent: pruned }, { merge: false });
      sent++;
    } catch (err) {
      console.error('dailyAlerts send failed for', email, err?.message);
    }
  }
  console.log('Daily alerts sent:', sent);
});

// ── Weekly Summary Email (every Monday 09:00 Europe/Paris) ───────────────
// One short, plain-language insight paragraph for the weekly email, written by
// the AI from this week's facts. Best-effort: any failure returns '' and the
// email goes out without it.
async function weeklyAiInsight(apiKey, facts) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `You are the SaaS spend advisor inside Stacklens. Based on this week's facts for one customer, write 2-3 short, friendly, plain-English sentences for the top of their Monday summary email. Lead with the single most valuable action (money wasted, ex-employee access, or an imminent renewal). No greetings, no markdown, no bullet points — just the sentences. Facts: ${JSON.stringify(facts)}`,
        }],
      }),
    });
    const out = await res.json();
    if (!res.ok) return '';
    return (out.content?.[0]?.text || '').trim();
  } catch {
    return '';
  }
}

exports.weeklySummary = onSchedule({
  schedule: 'every monday 09:00',
  timeZone: 'Europe/Paris',
  region: 'us-central1',
  secrets: [SENDGRID_API_KEY, ANTHROPIC_API_KEY],
}, async () => {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(SENDGRID_API_KEY.value());
  const db = getFirestore();
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str  = in30.toISOString().slice(0, 10);

  const snapshot = await db.collection('userdata').get();
  let sent = 0;

  for (const docSnap of snapshot.docs) {
    const data  = await assembleUserdata(docSnap);
    const email = await verifiedEmailForUid(uid);
    const cur = currencySymbol(data);
    if (!email) continue;
    // Respect opt-out (default: send)
    if (data?.user?.weekly_summary === false) continue;

    const tools     = data?.tools     || [];
    const employees = data?.employees || [];
    const access    = data?.access    || [];

    // ── Metrics ──────────────────────────────────────────────────────────
    const activeTools   = tools.filter(t => t.status !== NOT_BILLED_STATUS);
    // Was its own reduce over the same filter. Identical result, but it was
    // the fifth hand-written definition of this figure and the one customers
    // actually receive by email — so it is the last place that should have
    // its own.
    const monthlySpendValue = monthlySpend(data);
    const orphaned      = activeTools.filter(t => !t.owner_email).length;
    const highRisk      = access.filter(a => a.derived_risk_flag === 'high' || a.access_level === 'admin').length;
    const upcoming      = tools.filter(t => t.renewal_date >= todayStr && t.renewal_date <= in30Str);
    const activeEmps    = employees.filter(e => e.status === 'active').length;

    // Money on the table: unused/orphaned tools still billing every month.
    const idleTools    = activeTools.filter(t => t.status === 'unused' || t.status === 'orphaned');
    const idleMonthly  = idleTools.reduce((s, t) => s + (Number(t.cost_per_month) || 0), 0);
    // Former employees whose access was never revoked.
    const inactiveEmails = new Set(
      employees.filter(e => e.status && e.status !== 'active')
        .map(e => (e.email || '').toLowerCase()).filter(Boolean)
    );
    const exEmployeeAccess = access.filter(a =>
      a.status !== 'revoked' && inactiveEmails.has((a.employee_email || '').toLowerCase())
    ).length;

    const insight = await weeklyAiInsight(ANTHROPIC_API_KEY.value(), {
      monthly_spend_eur: monthlySpendValue,
      idle_spend_eur_per_month: idleMonthly,
      idle_tool_names: idleTools.slice(0, 5).map(t => t.name),
      ex_employee_access_count: exEmployeeAccess,
      renewals_next_30_days: upcoming.slice(0, 5).map(t => ({ name: t.name, date: t.renewal_date, cost_per_month: t.cost_per_month })),
      orphaned_tools: orphaned,
      high_risk_access: highRisk,
    });

    // Health score: same formula as the dashboard
    const healthScore = Math.max(0, Math.round(100 - (highRisk * 10) - (orphaned * 3)));
    const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
    const healthLabel = healthScore >= 80 ? 'Good' : healthScore >= 60 ? 'Fair' : 'Needs attention';

    const fmt = (n) => n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // ── Stat cards ────────────────────────────────────────────────────────
    const statCard = (label, value, sub, color = '#94a3b8') =>
      `<td style="width:25%;padding:0 6px;text-align:center">
        <div style="background:#1e293b;border-radius:10px;padding:16px 8px">
          <div style="font-size:24px;font-weight:800;color:${color}">${value}</div>
          <div style="font-size:11px;font-weight:600;color:#cbd5e1;margin-top:4px">${label}</div>
          ${sub ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${sub}</div>` : ''}
        </div>
      </td>`;

    // ── Upcoming renewals rows ────────────────────────────────────────────
    const renewalRows = upcoming.slice(0, 5).map(t => {
      const days = Math.floor((new Date(t.renewal_date) - today) / 86400000);
      const c    = days <= 7 ? '#ef4444' : '#f59e0b';
      const cost = t.cost_per_month ? `${cur}${fmt(t.cost_per_month * 12)}/yr` : '\u2014';
      return `<tr>
        <td style="padding:8px;color:#e2e8f0;border-bottom:1px solid #1e293b;font-size:13px">${t.name}</td>
        <td style="padding:8px;color:#94a3b8;border-bottom:1px solid #1e293b;font-size:13px">${t.renewal_date}</td>
        <td style="padding:8px;color:${c};border-bottom:1px solid #1e293b;font-size:13px;font-weight:700">${days}d</td>
        <td style="padding:8px;color:#e2e8f0;border-bottom:1px solid #1e293b;font-size:13px">${cost}</td>
      </tr>`;
    }).join('');

    const renewalSection = upcoming.length ? `
      <h3 style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px">
        Renewals in the next 30 days
      </h3>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="padding:6px 8px;text-align:left;color:#3b82f6;font-size:10px;text-transform:uppercase">Tool</th>
          <th style="padding:6px 8px;text-align:left;color:#3b82f6;font-size:10px;text-transform:uppercase">Date</th>
          <th style="padding:6px 8px;text-align:left;color:#3b82f6;font-size:10px;text-transform:uppercase">Days</th>
          <th style="padding:6px 8px;text-align:left;color:#3b82f6;font-size:10px;text-transform:uppercase">Cost</th>
        </tr></thead>
        <tbody>${renewalRows}</tbody>
      </table>
      ${upcoming.length > 5 ? `<p style="color:#64748b;font-size:12px;margin:8px 0 0">+${upcoming.length - 5} more renewal(s) — <a href="https://stacklens.fr" style="color:#3b82f6">view all</a></p>` : ''}
    ` : '';

    // ── Alerts section ────────────────────────────────────────────────────
    const alerts = [];
    if (idleMonthly > 0) alerts.push(`\ud83d\udcb8 <strong style="color:#f59e0b">${cur}${fmt(idleMonthly)}/mo</strong> going to ${idleTools.length} unused or orphaned tool${idleTools.length > 1 ? 's' : ''} \u2014 ${cur}${fmt(idleMonthly * 12)}/yr recoverable`);
    if (exEmployeeAccess > 0) alerts.push(`🚪 <strong style="color:#ef4444">${exEmployeeAccess} access grant${exEmployeeAccess > 1 ? 's' : ''}</strong> still active for former employees`);
    if (orphaned > 0) alerts.push(`⚠️ <strong style="color:#f59e0b">${orphaned} orphaned tool${orphaned > 1 ? 's' : ''}</strong> with no assigned owner`);
    if (highRisk  > 0) alerts.push(`🔴 <strong style="color:#ef4444">${highRisk} high-risk access record${highRisk > 1 ? 's' : ''}</strong> need review`);

    const alertsSection = alerts.length ? `
      <h3 style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px">
        Action needed
      </h3>
      <div style="space-y:8px">
        ${alerts.map(a => `<div style="padding:10px 14px;background:#1e293b;border-left:3px solid #f59e0b;border-radius:6px;margin-bottom:8px;font-size:13px;color:#94a3b8">${a}</div>`).join('')}
      </div>
    ` : '';

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:14px;overflow:hidden">
  <!-- Header -->
  <div style="padding:24px 28px;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-bottom:1px solid #1e293b">
    <h1 style="color:white;margin:0 0 2px;font-size:20px;font-weight:800">Stacklens</h1>
    <p style="color:#64748b;margin:0;font-size:13px">Your weekly SaaS summary</p>
  </div>

  <!-- Body -->
  <div style="padding:24px 28px">
    <p style="color:#94a3b8;font-size:14px;margin:0 0 20px">
      Here's what's happening across your <strong style="color:white">${activeTools.length} active tools</strong>
      and <strong style="color:white">${activeEmps} employees</strong>.
    </p>

    ${insight ? `
    <div style="padding:14px 16px;background:linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%);border-left:3px solid #6366f1;border-radius:8px;margin:0 0 20px">
      <div style="color:#a5b4fc;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">✨ This week's insight</div>
      <div style="color:#e2e8f0;font-size:13px;line-height:1.6">${insight}</div>
    </div>` : ''}

    <!-- Stat cards -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
      <tr>
        ${statCard('Monthly Spend', `${cur}${fmt(monthlySpendValue)}`, `${cur}${fmt(monthlySpendValue * 12)}/yr`, '#e2e8f0')}
        ${statCard('Health Score', `${healthScore}`, healthLabel, healthColor)}
        ${statCard('Renewals Soon', `${upcoming.length}`, 'next 30 days', upcoming.length > 0 ? '#f59e0b' : '#10b981')}
        ${statCard('High-Risk Access', `${highRisk}`, 'records', highRisk > 0 ? '#ef4444' : '#10b981')}
      </tr>
    </table>

    ${renewalSection}
    ${alertsSection}

    <!-- CTA -->
    <div style="text-align:center;margin-top:28px">
      <a href="https://stacklens.fr" style="display:inline-block;background:#3b82f6;color:white;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
        Open Dashboard →
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 28px;border-top:1px solid #1e293b;text-align:center">
    <p style="color:#475569;font-size:12px;margin:0">
      Stacklens &nbsp;·&nbsp;
      <a href="https://stacklens.fr/settings?tab=notifications" style="color:#475569;text-decoration:underline">Manage notifications</a>
    </p>
  </div>
</div>`;

    try {
      await sgMail.send({
        to: email,
        from: { email: 'hello@stacklens.fr', name: 'Stacklens' },
        subject: idleMonthly > 0
          ? `\ud83d\udcca Weekly SaaS summary \u2014 ${cur}${fmt(monthlySpendValue)}/mo \u00b7 ${cur}${fmt(idleMonthly)}/mo recoverable`
          : `\ud83d\udcca Your weekly SaaS summary \u2014 ${cur}${fmt(monthlySpendValue)}/mo \u00b7 Score ${healthScore}`,
        html,
      });
      sent++;
    } catch (err) {
      console.error('weeklySummary send failed for', email, err?.message);
    }
  }
  console.log('Weekly summaries sent:', sent);
});
