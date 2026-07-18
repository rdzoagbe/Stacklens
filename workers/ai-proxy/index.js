/**
 * Stacklens AI Proxy — Cloudflare Worker
 *
 * Proxies Anthropic API calls so the API key stays server-side.
 * Deploy to Cloudflare Workers (free tier: 100k requests/day).
 *
 * Required secrets (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY    — your Anthropic key
 *
 * Required vars (set in wrangler.toml or `wrangler secret put`):
 *   FIREBASE_PROJECT_ID  — Firebase project ID (e.g. accessguard-v2)
 *
 * Authentication: callers send a Firebase ID token in Authorization: Bearer <token>.
 * The Worker verifies the token against Google's public JWK endpoint — no shared
 * secret required.
 */

const ALLOWED_ORIGINS = [
  'https://stacklens.fr',
  'https://www.stacklens.fr',
  'https://accessguard-v2.web.app',
  'https://accessguard-v2.firebaseapp.com',
];

const MAX_MESSAGES  = 20;
const MAX_TOKENS    = 4000;
const DEFAULT_TOKENS = 2000;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

const GOOGLE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function base64urlDecode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function verifyFirebaseToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header  = JSON.parse(base64urlDecode(headerB64));
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now)                                              return null;
  if (payload.iat > now + 60)                                         return null;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (payload.aud !== projectId)                                      return null;
  if (!payload.sub)                                                   return null;

  const jwkRes = await fetch(GOOGLE_JWK_URL);
  if (!jwkRes.ok) return null;
  const { keys } = await jwkRes.json();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) return null;

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const sigBytes  = Uint8Array.from(base64urlDecode(sigB64), c => c.charCodeAt(0));
  const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, dataBytes);
  return valid ? payload : null;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) return null;
  return messages.map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 10000),
  }));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return json({ error: 'Unauthorized' }, 401, origin);
    const firebasePayload = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
    if (!firebasePayload) return json({ error: 'Unauthorized' }, 401, origin);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin);
    }

    const sanitized = sanitizeMessages(body.messages);
    if (!sanitized) {
      return json({ error: 'Invalid messages' }, 400, origin);
    }

    const system     = body.system ? String(body.system).slice(0, 5000) : undefined;
    const requestedTokens = Number(body.max_tokens);
    const safeTokens = Number.isFinite(requestedTokens) ? Math.floor(requestedTokens) : DEFAULT_TOKENS;
    const max_tokens = Math.max(1, Math.min(safeTokens, MAX_TOKENS));

    const anthropicBody = {
      // claude-sonnet-4-20250514 was retired 2026-06-15; claude-sonnet-5 is its
      // designated replacement. Thinking disabled to match the old behavior.
      model:      'claude-sonnet-5',
      max_tokens,
      thinking:   { type: 'disabled' },
      messages:   sanitized,
    };
    if (system) anthropicBody.system = system;

    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(anthropicBody),
      });

      const data = await anthropicRes.json();

      if (!anthropicRes.ok) {
        return json({ error: data.error?.message || 'AI error' }, anthropicRes.status, origin);
      }

      return json(data, 200, origin);
    } catch (err) {
      console.error('Anthropic fetch error:', err);
      return json({ error: 'Internal error' }, 500, origin);
    }
  },
};
