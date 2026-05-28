/**
 * Stacklens AI Proxy — Cloudflare Worker
 *
 * Proxies Anthropic API calls so the API key stays server-side.
 * Deploy to Cloudflare Workers (free tier: 100k requests/day).
 *
 * Required secrets (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY  — your Anthropic key
 *   APP_SECRET         — a random string you also put in VITE_WORKER_SECRET
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

    // Verify shared secret
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || token !== env.APP_SECRET) {
      return json({ error: 'Unauthorized' }, 401, origin);
    }

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
    const max_tokens = Math.min(Number(body.max_tokens) || DEFAULT_TOKENS, MAX_TOKENS);

    const anthropicBody = {
      model:      'claude-sonnet-4-20250514',
      max_tokens,
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
        return json({ error: data.error?.message || 'AI error' }, 500, origin);
      }

      return json(data, 200, origin);
    } catch (err) {
      console.error('Anthropic fetch error:', err);
      return json({ error: 'Internal error' }, 500, origin);
    }
  },
};
