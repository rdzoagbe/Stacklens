/**
 * Stacklens Cloud Functions
 * Secrets: ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * (secret versions bind at deploy time — redeploy after adding a new version)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
// firebase-admin v14 removed the legacy namespaced API (admin.auth(), admin.firestore(), …)
// — only the modular entry points exist now.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAppCheck } = require('firebase-admin/app-check');

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
// GoCardless Bank Account Data (open banking). Create both secrets in Secret
// Manager BEFORE deploying (placeholder values are fine until the feature is
// activated; both secrets exist with placeholder versions as of 2026-07-21).
// activated) — a declared-but-missing secret fails the whole functions deploy.
const GOCARDLESS_SECRET_ID  = defineSecret('GOCARDLESS_SECRET_ID');
const GOCARDLESS_SECRET_KEY = defineSecret('GOCARDLESS_SECRET_KEY');
const STRIPE_SECRET_KEY     = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

const RATE_LIMIT          = { maxCalls: 20, windowMs: 60 * 60 * 1000 };
const CHECKOUT_RATE_LIMIT = { maxCalls: 5,  windowMs: 60 * 60 * 1000 };
const SYNCUSER_RATE_LIMIT = { maxCalls: 30, windowMs: 60 * 60 * 1000 };

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
      await userRef.set({ uid, email: email || decoded.email || '', displayName: displayName || decoded.name || '', photoURL: photoURL || decoded.picture || '', plan: 'free', createdAt: Date.now(), updatedAt: Date.now() });
      return res.json({ isNew: true });
    } else {
      await userRef.update({ updatedAt: Date.now() });
      const d = snap.data();
      return res.json({ isNew: false, plan: d.plan || 'free', stripe_customer_id: d.stripe_customer_id || null, subscription_status: d.subscription_status || null });
    }
  });
});

// ── /refreshClaims — force-refresh custom claims on client token ──────────
exports.refreshClaims = onRequest({ cors: true }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    // Read current Firestore plan and sync it to claims
    const snap = await getFirestore().collection('users').doc(decoded.uid).get();
    const plan = snap.exists ? (snap.data().plan || 'free') : 'free';
    await getAuth().setCustomUserClaims(decoded.uid, { plan });
    return res.json({ plan });
  });
});

// ── /sendInvite — email a team invite link via SendGrid ───────────────────
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');

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

exports.founderops = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
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

    const { action, targetUid, plan, extraDays } = req.body;

    try {
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
      // Permanently remove a user: Auth account + /users doc + /userdata doc.
      if (action === 'deleteUser') {
        if (FOUNDER_UIDS.includes(targetUid) || targetUid === decoded.uid) {
          return res.status(400).json({ error: 'Cannot delete the founder account' });
        }
        try {
          await getAuth().deleteUser(targetUid);
        } catch (err) {
          if (err.code !== 'auth/user-not-found') throw err;
        }
        await db.collection('users').doc(targetUid).delete();
        await db.collection('userdata').doc(targetUid).delete();
        return res.json({ ok: true });
      }
      // Recent client-side crashes captured by the clientErrors endpoint.
      if (action === 'listErrors') {
        const snap = await db.collection('client_errors').orderBy('at', 'desc').limit(50).get();
        return res.json({ errors: snap.docs.map(d => d.data()) });
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
exports.clientErrors = onRequest({ cors: true, timeoutSeconds: 10 }, async (req, res) => {
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
const API_PLANS = new Set(['enterprise', 'scale', 'unlimited', 'professional']);
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
    const plan = userSnap.exists ? (userSnap.data().plan || 'free') : 'free';
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
const GC_API = 'https://bankaccountdata.gocardless.com/api/v2';

async function gcToken() {
  const res = await fetch(`${GC_API}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: GOCARDLESS_SECRET_ID.value().trim(), secret_key: GOCARDLESS_SECRET_KEY.value().trim() }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out?.detail || 'GoCardless auth failed — check the GOCARDLESS_* secrets');
  return out.access;
}
async function gcGet(token, path) {
  const res = await fetch(`${GC_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const out = await res.json();
  if (!res.ok) throw new Error(out?.detail || `GoCardless error on ${path}`);
  return out;
}

// Group booked outflows by counterparty; recurring = seen in 2+ distinct months.
function detectRecurring(transactions) {
  const groups = {};
  (transactions || []).forEach(tx => {
    const amount = Number(tx.transactionAmount?.amount || 0);
    if (!(amount < 0)) return; // outflows only
    const name = (tx.creditorName || tx.remittanceInformationUnstructured || '').trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[0-9]/g, '').replace(/\s+/g, ' ').slice(0, 40).trim();
    if (!key) return;
    if (!groups[key]) groups[key] = { name: name.slice(0, 80), amounts: [], months: new Set(), last: '' };
    const g = groups[key];
    g.amounts.push(Math.abs(amount));
    const date = tx.bookingDate || '';
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

exports.bankfeed = onRequest({ cors: true, timeoutSeconds: 120, secrets: [GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY] }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    // Bank connectivity is an Enterprise-tier feature (founders exempt).
    if (!FOUNDER_UIDS.includes(decoded.uid)) {
      const userSnap = await getFirestore().collection('users').doc(decoded.uid).get();
      const plan = userSnap.exists ? (userSnap.data().plan || userSnap.data().subscription_plan || 'free') : 'free';
      if (!API_PLANS.has(plan) && userSnap.data()?.is_founder !== true) {
        return res.status(403).json({ error: 'Bank connectivity requires an Enterprise plan' });
      }
    }
    const db = getFirestore();
    const reqRef = db.collection('bank_requisitions').doc(decoded.uid);
    const { action, institutionId, country } = req.body || {};
    try {
      if (action === 'institutions') {
        const token = await gcToken();
        const list = await gcGet(token, `/institutions/?country=${encodeURIComponent(country || 'FR')}`);
        return res.json({ institutions: (list || []).map(i => ({ id: i.id, name: i.name, logo: i.logo })) });
      }
      if (action === 'connect') {
        if (!institutionId) return res.status(400).json({ error: 'institutionId required' });
        const token = await gcToken();
        const reqz = await fetch(`${GC_API}/requisitions/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            redirect: 'https://stacklens.fr/finance?bank=connected',
            institution_id: institutionId,
            reference: `${decoded.uid}_${Date.now()}`,
          }),
        });
        const out = await reqz.json();
        if (!reqz.ok) throw new Error(out?.detail || 'Could not start the bank connection');
        await reqRef.set({ requisition_id: out.id, institution_id: institutionId, status: 'pending', created_at: new Date().toISOString() });
        return res.json({ link: out.link });
      }
      if (action === 'status') {
        const snap = await reqRef.get();
        return res.json({ connected: snap.exists, institution_id: snap.exists ? snap.data().institution_id : null });
      }
      if (action === 'disconnect') {
        await reqRef.delete();
        return res.json({ ok: true });
      }
      if (action === 'sync') {
        const snap = await reqRef.get();
        if (!snap.exists) return res.status(400).json({ error: 'No bank connected yet' });
        const token = await gcToken();
        const reqz = await gcGet(token, `/requisitions/${snap.data().requisition_id}/`);
        if (!reqz.accounts?.length) return res.status(400).json({ error: 'Bank connection not completed yet — finish the bank authorization first' });
        const all = [];
        for (const acct of reqz.accounts.slice(0, 3)) {
          try {
            const tx = await gcGet(token, `/accounts/${acct}/transactions/`);
            all.push(...(tx.transactions?.booked || []));
          } catch (e) { console.warn('bankfeed account read failed:', e?.message); }
        }
        await reqRef.set({ status: 'linked', last_sync: new Date().toISOString() }, { merge: true });
        return res.json({ candidates: detectRecurring(all), transactions_scanned: all.length });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('bankfeed error:', err);
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

exports.workspace = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const decoded = await verifyAuth(req, res); if (!decoded) return;
    const db = getFirestore();
    const { action, email, id, ownerUid } = req.body || {};
    const callerEmail = (decoded.email || '').toLowerCase();
    const col = db.collection('workspace_members');
    try {
      if (action === 'invite') {
        const target = String(email || '').toLowerCase().trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return res.status(400).json({ error: 'Valid email required' });
        if (target === callerEmail) return res.status(400).json({ error: 'You cannot invite yourself' });
        // Team sharing is a paid feature (founders exempt).
        if (!FOUNDER_UIDS.includes(decoded.uid)) {
          const userSnap = await db.collection('users').doc(decoded.uid).get();
          const plan = userSnap.exists ? (userSnap.data().plan || userSnap.data().subscription_plan || 'free') : 'free';
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
      if (action === 'read') {
        const target = String(ownerUid || '');
        const snap = await col.where('owner_uid', '==', target).get();
        const me = snap.docs.find(d => d.data().member_uid === decoded.uid ||
          (callerEmail && d.data().member_email === callerEmail));
        if (!me) return res.status(403).json({ error: 'Not a member of this workspace' });
        if (!me.data().member_uid) await me.ref.update({ member_uid: decoded.uid, status: 'accepted' });
        const dataSnap = await db.collection('userdata').doc(target).get();
        if (!dataSnap.exists) return res.status(404).json({ error: 'Workspace has no data yet' });
        const data = await assembleUserdata(dataSnap);
        // Owner's billing internals never leave the server.
        const u = data.user || {};
        data.user = {
          email: u.email || null, displayName: u.displayName || null, company: u.company || null,
          plan: u.plan || u.subscription_plan || 'free', subscription_plan: u.subscription_plan || u.plan || 'free',
          is_founder: u.is_founder === true,
        };
        delete data._uid;
        return res.json({ data });
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

// ── Weekly data backup ───────────────────────────────────────────────────
// Copies every /userdata doc (+ its chunks subcollection) into /backups so a
// client-side bug that corrupts or wipes a user's blob can be recovered from a
// copy no client code can touch (default-deny rules; Admin SDK only). Keeps
// ~5 weeks, pruning older snapshots.
exports.weeklyBackup = onSchedule({
  schedule: 'every sunday 03:00',
  timeZone: 'Europe/Paris',
  region: 'us-central1',
  timeoutSeconds: 540,
}, async () => {
  const db = getFirestore();
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
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
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 35);
  const olds = await db.collection('backups').where('created_at', '<', cutoff.toISOString().slice(0, 10)).get();
  for (const o of olds.docs) {
    const cs = await o.ref.collection('chunks').get();
    let batch = db.batch(); let n = 0;
    for (const c of cs.docs) {
      batch.delete(c.ref);
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    batch.delete(o.ref);
    await batch.commit();
  }
  console.log('Weekly backup:', backed, 'users backed up;', olds.size, 'old snapshots pruned');
});

// Rollout switch: while true, alert emails only go to founder accounts so the
// feature can be validated live before customers receive anything. Flip to
// false to enable for everyone (replaces the old always-on renewalAlerts).
const ALERTS_FOUNDERS_ONLY = true;

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
    const email = data?.user?.email;
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
        const pct = ((spent[(b.department || '').toLowerCase()] || 0) / b.annual) * 100;
        for (const threshold of [100, 80]) {
          const key = `budget_${year}_${b.department}_${threshold}`;
          if (pct >= threshold && !sentKeys[key] && !newKeys[key]) {
            newKeys[key] = todayStr;
            alerts.budgets.push({ department: b.department, pct: Math.round(pct), budget: b.annual, spent: Math.round(spent[b.department] || 0) });
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
        ${section('Upcoming renewals', alerts.renewals.map(r => line(r.name, `renews ${r.date} (${r.days} days)` + (r.annual ? ` · €${fmt(r.annual)}/yr` : ''), r.days <= 7 ? '#ef4444' : '#f59e0b')))}
        ${section('Budget thresholds', alerts.budgets.map(b => line(b.department, `${b.pct}% of annual budget consumed (€${fmt(b.spent)} of €${fmt(b.budget)})`, b.pct >= 100 ? '#ef4444' : '#f59e0b')))}
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
    const email = data?.user?.email;
    if (!email) continue;
    // Respect opt-out (default: send)
    if (data?.user?.weekly_summary === false) continue;

    const tools     = data?.tools     || [];
    const employees = data?.employees || [];
    const access    = data?.access    || [];

    // ── Metrics ──────────────────────────────────────────────────────────
    const activeTools   = tools.filter(t => t.status !== 'decommissioned');
    const monthlySpend  = activeTools.reduce((s, t) => s + (Number(t.cost_per_month) || 0), 0);
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
      monthly_spend_eur: monthlySpend,
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
      const cost = t.cost_per_month ? `€${fmt(t.cost_per_month * 12)}/yr` : '—';
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
    if (idleMonthly > 0) alerts.push(`💸 <strong style="color:#f59e0b">€${fmt(idleMonthly)}/mo</strong> going to ${idleTools.length} unused or orphaned tool${idleTools.length > 1 ? 's' : ''} — €${fmt(idleMonthly * 12)}/yr recoverable`);
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
        ${statCard('Monthly Spend', `€${fmt(monthlySpend)}`, `€${fmt(monthlySpend * 12)}/yr`, '#e2e8f0')}
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
          ? `📊 Weekly SaaS summary — €${fmt(monthlySpend)}/mo · €${fmt(idleMonthly)}/mo recoverable`
          : `📊 Your weekly SaaS summary — €${fmt(monthlySpend)}/mo · Score ${healthScore}`,
        html,
      });
      sent++;
    } catch (err) {
      console.error('weeklySummary send failed for', email, err?.message);
    }
  }
  console.log('Weekly summaries sent:', sent);
});
