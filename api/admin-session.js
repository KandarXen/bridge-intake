import { assertRateLimit, assertTrustedOrigin, authorizedAdminAccount, bearerToken, getSupabaseUser, safeError } from '../lib/security.js';

function authConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase Auth is not configured');
  return { url, anonKey };
}

async function supabaseAuth(path, { method = 'GET', token = '', body = null } = {}) {
  const { url, anonKey } = authConfig();
  const resp = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: token ? `Bearer ${token}` : `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.msg || data.error_description || data.error || 'Supabase Auth request failed');
    err.statusCode = resp.status;
    throw err;
  }
  return data;
}

async function signIn(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.statusCode = 400;
    throw err;
  }

  const session = await supabaseAuth('token?grant_type=password', {
    method: 'POST',
    body: { email, password }
  });
  const accessToken = session.access_token || '';
  const user = await getSupabaseUser(accessToken);
  const appMeta = user?.app_metadata || {};
  if (!(appMeta.btai_admin === true || appMeta.role === 'btai_admin')) {
    const err = new Error('This account is not authorized for BTAI admin');
    err.statusCode = 403;
    throw err;
  }

  return {
    accessToken,
    refreshToken: session.refresh_token || '',
    expiresIn: session.expires_in || null,
    user: {
      id: user.id,
      email: user.email,
      aal: session.user?.aal || user.aal || null,
      appMetadata: appMeta
    },
    mfaRequired: (session.user?.aal || user.aal) !== 'aal2'
  };
}

async function refresh(body) {
  const refreshToken = String(body?.refreshToken || '').trim();
  if (!refreshToken) {
    const err = new Error('Refresh token is required');
    err.statusCode = 400;
    throw err;
  }
  const session = await supabaseAuth('token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken }
  });
  return {
    accessToken: session.access_token || '',
    refreshToken: session.refresh_token || refreshToken,
    expiresIn: session.expires_in || null,
    mfaRequired: session.user?.aal !== 'aal2'
  };
}

function adminRedirectTo(req) {
  const origins = String(process.env.BTAI_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const host = req.headers?.host || '';
  const fallback = host ? `https://${host}` : origins[0] || '';
  return `${origins[0] || fallback}/btai-records-console`;
}

async function requestPasswordReset(req, body) {
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Valid email is required');
    err.statusCode = 400;
    throw err;
  }
  await supabaseAuth(`recover?redirect_to=${encodeURIComponent(adminRedirectTo(req))}`, {
    method: 'POST',
    body: { email }
  });
  return {
    sent: true,
    message: 'If this email is authorized, a password reset link has been sent.'
  };
}

async function updatePassword(token, body) {
  const password = String(body?.password || '');
  if (password.length < 12) {
    const err = new Error('Password must be at least 12 characters');
    err.statusCode = 400;
    throw err;
  }
  await supabaseAuth('user', {
    method: 'PUT',
    token,
    body: { password }
  });
  return { updated: true };
}

async function enrollMfa(token) {
  if (!token) {
    const err = new Error('Sign in before enrolling MFA');
    err.statusCode = 401;
    throw err;
  }
  const data = await supabaseAuth('factors', {
    method: 'POST',
    token,
    body: {
      factor_type: 'totp',
      friendly_name: 'BTAI Admin Authenticator'
    }
  });
  return {
    factorId: data.id,
    type: data.factor_type || data.type || 'totp',
    friendlyName: data.friendly_name || 'BTAI Admin Authenticator',
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || '',
    uri: data.totp?.uri || ''
  };
}

async function factors(token) {
  const data = await supabaseAuth('factors', { token });
  const all = Array.isArray(data) ? data : data.factors || [];
  return {
    factors: all
      .filter(factor => factor.status === 'verified')
      .map(factor => ({
        id: factor.id,
        type: factor.factor_type || factor.type,
        friendlyName: factor.friendly_name || ''
      }))
  };
}

async function challengeAndVerify(token, body) {
  const factorId = String(body?.factorId || '').trim();
  const code = String(body?.code || '').trim();
  if (!factorId || !code) {
    const err = new Error('Factor ID and code are required');
    err.statusCode = 400;
    throw err;
  }
  const challenge = await supabaseAuth(`factors/${encodeURIComponent(factorId)}/challenge`, {
    method: 'POST',
    token,
    body: {}
  });
  const verified = await supabaseAuth(`factors/${encodeURIComponent(factorId)}/verify`, {
    method: 'POST',
    token,
    body: {
      challenge_id: challenge.id,
      code
    }
  });
  return {
    accessToken: verified.access_token || '',
    refreshToken: verified.refresh_token || '',
    expiresIn: verified.expires_in || null,
    mfaRequired: false
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'admin-session', limit: 12, windowMs: 60_000 });
    const action = String(req.body?.action || '').trim();
    if (action === 'sign-in') return res.status(200).json(await signIn(req.body));
    if (action === 'request-password-reset') return res.status(200).json(await requestPasswordReset(req, req.body));
    if (action === 'update-password') return res.status(200).json(await updatePassword(bearerToken(req), req.body));
    if (action === 'enroll-mfa') return res.status(200).json(await enrollMfa(bearerToken(req)));
    if (action === 'refresh') return res.status(200).json(await refresh(req.body));
    if (action === 'factors') return res.status(200).json(await factors(bearerToken(req)));
    if (action === 'verify-mfa') return res.status(200).json(await challengeAndVerify(bearerToken(req), req.body));
    if (action === 'check') return res.status(200).json({ authorized: await authorizedAdminAccount(req) });
    return res.status(400).json({ error: 'Unknown admin-session action' });
  } catch (err) {
    console.error('admin-session error:', err);
    return safeError(res, err, 'Admin session request failed');
  }
}
