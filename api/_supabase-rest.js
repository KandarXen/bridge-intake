function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return { url, key };
}

export function supabaseConfigured() {
  return !!(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

async function request(path, options = {}) {
  const { url, key } = config();
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase request failed ${resp.status}: ${text}`);
  }

  if (resp.status === 204) return null;
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

function eq(value) {
  return encodeURIComponent(`eq.${value}`);
}

export async function upsertIntakeSession(row) {
  const data = await request('intake_sessions?on_conflict=client_draft_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function getIntakeSession(clientDraftId) {
  const data = await request(`intake_sessions?client_draft_id=${eq(clientDraftId)}&select=*`, {
    method: 'GET'
  });
  return Array.isArray(data) ? data[0] || null : null;
}

export async function updateIntakeSession(clientDraftId, patch) {
  const data = await request(`intake_sessions?client_draft_id=${eq(clientDraftId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  return Array.isArray(data) ? data[0] || null : data;
}

export async function insertIntakeOutput(row) {
  const data = await request('intake_outputs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function insertIntakeEvent(row) {
  const data = await request('intake_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function insertClaimTrace(row) {
  const data = await request('claim_trace', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}
