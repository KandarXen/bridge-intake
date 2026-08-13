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

export async function getRecentIntakeSessions({ limit = 100, status = '', days = 120 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const safeDays = Math.max(1, Math.min(Number(days) || 120, 1095));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const filters = [
    `created_at=gte.${encodeURIComponent(since)}`,
    'select=*',
    'order=created_at.desc',
    `limit=${safeLimit}`
  ];
  const safeStatus = String(status || '').trim();
  if (safeStatus && safeStatus.toLowerCase() !== 'all') {
    filters.unshift(`status=${eq(safeStatus)}`);
  }
  const data = await request(`intake_sessions?${filters.join('&')}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
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

export async function getLatestIntakeOutput(clientDraftId, outputType = 'venture_dna_markdown') {
  const data = await request(
    `intake_outputs?client_draft_id=${eq(clientDraftId)}&output_type=${eq(outputType)}&select=*&order=created_at.desc&limit=1`,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data[0] || null : null;
}

export async function getIntakeEvents(clientDraftId, limit = 80) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));
  const data = await request(
    `intake_events?client_draft_id=${eq(clientDraftId)}&select=*&order=created_at.asc&limit=${safeLimit}`,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data : [];
}

export async function getPartnerKpiEvents({ partner = 'AFPA', campaign = '', days = 120, limit = 5000 } = {}) {
  const safePartner = String(partner || 'AFPA').trim();
  const safeCampaign = String(campaign || '').trim();
  const safeDays = Math.max(1, Math.min(Number(days) || 120, 1095));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5000, 10000));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const filters = [
    `partner=${eq(safePartner)}`,
    `created_at=gte.${encodeURIComponent(since)}`,
    'select=*',
    'order=created_at.desc',
    `limit=${safeLimit}`
  ];
  if (safeCampaign && safeCampaign.toLowerCase() !== 'all') {
    filters.unshift(`campaign=${eq(safeCampaign)}`);
  }
  const data = await request(`intake_kpi_events?${filters.join('&')}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

export async function getIntakeOutputsByTypes(outputTypes = [], { limit = 1000 } = {}) {
  const types = Array.isArray(outputTypes) ? outputTypes.map(value => String(value || '').trim()).filter(Boolean) : [];
  if (!types.length) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 10000));
  const encodedTypes = types.map(type => encodeURIComponent(type)).join(',');
  const data = await request(
    `intake_outputs?output_type=in.(${encodedTypes})&select=*&order=created_at.desc&limit=${safeLimit}`,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data : [];
}
