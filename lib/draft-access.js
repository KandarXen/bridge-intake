import crypto from 'crypto';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_DAYS = 30;

function secret() {
  const value = String(process.env.BTAI_DRAFT_ACCESS_SECRET || '');
  if (value.length < 32) {
    const err = new Error('Draft access is not configured');
    err.statusCode = 503;
    throw err;
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function sameSignature(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function issueDraftAccess(clientDraftId, { ttlDays = DEFAULT_TTL_DAYS } = {}) {
  const id = String(clientDraftId || '').trim();
  if (!id) throw new Error('Missing clientDraftId');
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ v: TOKEN_VERSION, id, iat: now, exp: now + (ttlDays * 24 * 60 * 60) });
  return `${payload}.${sign(payload)}`;
}

export function assertDraftAccess(token, clientDraftId) {
  const [encoded, signature, ...extra] = String(token || '').split('.');
  const id = String(clientDraftId || '').trim();
  const payload = !extra.length && encoded && signature && sameSignature(signature, sign(encoded)) ? decode(encoded) : null;
  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.v !== TOKEN_VERSION || payload.id !== id || !Number.isInteger(payload.exp) || payload.exp <= now) {
    const err = new Error('Draft access is invalid or expired');
    err.statusCode = 403;
    throw err;
  }
  return payload;
}
