import crypto from 'crypto';

function headerValue(req, name) {
  return req.headers?.[name] || req.headers?.[name.toLowerCase()] || '';
}

export function assertTrustedOrigin(req) {
  const origin = headerValue(req, 'origin');
  if (!origin) return;

  const host = headerValue(req, 'host');
  let sameOrigin = false;
  try {
    const parsed = new URL(origin);
    sameOrigin = !!host && parsed.host === host && ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    sameOrigin = false;
  }
  const allowed = String(process.env.BTAI_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (sameOrigin || allowed.includes(origin.replace(/\/$/, ''))) return;
  const err = new Error('Untrusted request origin');
  err.statusCode = 403;
  throw err;
}

export function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function authorizedAdmin(req) {
  const expected = process.env.BTAI_ADMIN_SECRET;
  if (!expected || String(expected).length < 24) return false;
  const provided = headerValue(req, 'x-btai-admin-secret');
  return timingSafeEqualText(provided, expected);
}

export function bearerToken(req) {
  const authorization = headerValue(req, 'authorization');
  const match = String(authorization || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function getSupabaseUser(accessToken) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !accessToken) return null;
  const resp = await fetch(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function getAdminProfile(userId) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return null;
  const resp = await fetch(`${url}/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  if (!resp.ok) return null;
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function authorizedAdminAccount(req) {
  const token = bearerToken(req);
  const claims = decodeJwtPayload(token);
  if (!claims || claims.aal !== 'aal2') return false;
  const user = await getSupabaseUser(token);
  const appMeta = user?.app_metadata || {};
  const appAdmin = !!(user?.id && (appMeta.btai_admin === true || appMeta.role === 'btai_admin'));
  if (!appAdmin) return false;
  const profile = await getAdminProfile(user.id);
  return !profile || profile.active === true;
}

export async function authorizedAdminRequest(req) {
  if (await authorizedAdminAccount(req)) return true;
  const emergencyEnabled = String(process.env.BTAI_ENABLE_EMERGENCY_ADMIN_SECRET || '').toLowerCase() === 'true';
  return emergencyEnabled && authorizedAdmin(req);
}

const rateBuckets = new Map();

export function assertRateLimit(req, { key = 'global', limit = 30, windowMs = 60_000 } = {}) {
  const ip = headerValue(req, 'x-forwarded-for').split(',')[0].trim() || headerValue(req, 'x-real-ip') || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  if (bucket.count <= limit) return;
  const err = new Error('Too many requests');
  err.statusCode = 429;
  throw err;
}

export async function assertTurnstile(req, token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  const response = String(token || req.body?.turnstileToken || '').trim();
  if (!response) {
    const err = new Error('Human verification required');
    err.statusCode = 403;
    throw err;
  }
  const remoteip = headerValue(req, 'x-forwarded-for').split(',')[0].trim();
  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      response,
      remoteip: remoteip || undefined
    })
  });
  const data = await verification.json().catch(() => ({}));
  if (data.success) return;
  const err = new Error('Human verification failed');
  err.statusCode = 403;
  throw err;
}

export function safeError(res, err, fallback = 'Server error') {
  const status = Number(err?.statusCode) || 500;
  return res.status(status).json({
    error: status === 500 ? fallback : err.message
  });
}
