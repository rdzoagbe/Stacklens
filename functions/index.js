/**
 * Stacklens Cloud Functions
 * Secrets: ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
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
      const body = { model: 'claude-sonnet-4-20250514', max_tokens, messages: sanitized };
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
    try {
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
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
      });
      return res.json({ url: session.url });
    } catch (err) { console.error('Checkout error:', err); return res.status(500).json({ error: err.message }); }
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

// ── /founderAdmin ─────────────────────────────────────────────────────────
// Privileged operations (extend trial, set plan) for users with is_founder=true.
// Uses Admin SDK so it bypasses Firestore rules — the caller's founder status is
// checked server-side before any write.
const FOUNDER_RATE_LIMIT = { maxCalls: 30, windowMs: 60 * 60 * 1000 };
const VALID_PLANS = ['free', 'trial', 'starter', 'hr_finance', 'pro', 'enterprise', 'scale'];

exports.founderAdmin = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const decoded = await verifyAuth(req, res);
    if (!decoded) return;

    if (!await checkRateLimit(decoded.uid, res, FOUNDER_RATE_LIMIT, 'founderAdmin')) return;

    const db = getFirestore();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists || !callerSnap.data().is_founder) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { action, targetUid, plan, extraDays } = req.body;
    if (!targetUid || typeof targetUid !== 'string') {
      return res.status(400).json({ error: 'targetUid required' });
    }

    try {
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
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('founderAdmin error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });
});


// ── Renewal Alert Emails (SendGrid) ──────────────────────────────────────
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.renewalAlerts = onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'Europe/London',
  region: 'us-central1',
  secrets: [SENDGRID_API_KEY],
}, async () => {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(SENDGRID_API_KEY.value());
  const db = getFirestore();
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const todayStr = today.toISOString().slice(0,10);
  const in30Str = in30.toISOString().slice(0,10);

  let sent = 0;
  const seenEmails = new Set();
  let lastDoc = null;
  const BATCH_SIZE = 100;

  while (true) {
    let q = db.collection('userdata').limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snapshot = await q.get();
    if (snapshot.empty) break;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Field absence means opted-in (default on); only skip explicit opt-out
      if (data?.user?.renewal_alerts === false) continue;
      const email = data?.user?.email;
      const tools = data?.tools || [];
      if (!email) continue;
      if (seenEmails.has(email)) continue;
      const upcoming = tools.filter(t => t.renewal_date >= todayStr && t.renewal_date <= in30Str);
      if (!upcoming.length) continue;
      const rows = upcoming.map(t => {
        const days = Math.floor((new Date(t.renewal_date) - today) / 86400000);
        const cost = t.cost_per_month ? '$' + (t.cost_per_month * 12).toLocaleString() + '/yr' : '-';
        const color = days <= 7 ? '#ef4444' : '#f59e0b';
        return `<tr><td style="padding:8px;color:#e2e8f0;border-bottom:1px solid #334155">${t.name}</td><td style="padding:8px;color:#94a3b8;border-bottom:1px solid #334155">${t.renewal_date}</td><td style="padding:8px;color:${color};border-bottom:1px solid #334155;font-weight:bold">${days} days</td><td style="padding:8px;color:#e2e8f0;border-bottom:1px solid #334155">${cost}</td></tr>`;
      }).join('');
      const critical = upcoming.filter(t => Math.floor((new Date(t.renewal_date) - today) / 86400000) <= 7);
      await sgMail.send({
        to: email,
        from: { email: 'hello@stacklens.fr', name: 'Stacklens' },
        subject: critical.length ? `🚨 ${critical.length} contract(s) renewing in 7 days` : `🔔 ${upcoming.length} upcoming SaaS renewal(s)`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#1e293b"><h1 style="color:white;margin:0 0 4px;font-size:22px">Stacklens</h1><p style="color:#94a3b8;margin:0">Upcoming SaaS Renewals</p></div><div style="padding:24px"><p style="color:#94a3b8;margin:0 0 16px">You have <strong style="color:white">${upcoming.length} contract(s)</strong> renewing in the next 30 days.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;text-align:left;color:#3b82f6;font-size:11px;text-transform:uppercase">Tool</th><th style="padding:8px;text-align:left;color:#3b82f6;font-size:11px;text-transform:uppercase">Renewal Date</th><th style="padding:8px;text-align:left;color:#3b82f6;font-size:11px;text-transform:uppercase">Days Left</th><th style="padding:8px;text-align:left;color:#3b82f6;font-size:11px;text-transform:uppercase">Annual Cost</th></tr></thead><tbody>${rows}</tbody></table><div style="text-align:center;margin-top:24px"><a href="https://stacklens.fr/finance" style="background:#3b82f6;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Review Renewals →</a></div></div><div style="padding:16px;text-align:center;border-top:1px solid #1e293b"><p style="color:#475569;font-size:12px;margin:0">Stacklens · <a href="https://stacklens.fr/settings" style="color:#475569">Manage notifications</a></p></div></div>`,
      });
      seenEmails.add(email);
      sent++;
    }

    if (snapshot.docs.length < BATCH_SIZE) break;
  }

  console.log('Renewal alerts sent:', sent);
});

// ── Weekly Summary Email (every Monday 09:00 Europe/Paris) ───────────────
exports.weeklySummary = onSchedule({
  schedule: 'every monday 09:00',
  timeZone: 'Europe/Paris',
  region: 'us-central1',
  secrets: [SENDGRID_API_KEY],
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
    const data  = docSnap.data();
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
        subject: `📊 Your weekly SaaS summary — €${fmt(monthlySpend)}/mo · Score ${healthScore}`,
        html,
      });
      sent++;
    } catch (err) {
      console.error('weeklySummary send failed for', email, err?.message);
    }
  }
  console.log('Weekly summaries sent:', sent);
});
