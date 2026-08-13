import { encryptJson, decryptJson } from '../lib/crypto.js';
import { getIntakeSession, updateIntakeSession, upsertIntakeSession } from '../lib/supabase-rest.js';
import { assertRateLimit, assertTrustedOrigin, safeError, timingSafeEqualText } from '../lib/security.js';
import { isLostKeyDecryptError, isRetiredLostKeyRecord, retiredLostKeyMessage } from '../lib/retirement.js';

const DEFAULT_INVALIDATED_DRAFT_IDS = new Set([
  'b376650f-1021-41ef-a254-0458af10bf74',
  '7a124715-be84-48b8-8412-84f0e65fd40b'
]);

function invalidatedDraftIds() {
  const configured = String(process.env.BTAI_INVALIDATED_DRAFT_IDS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_INVALIDATED_DRAFT_IDS, ...configured]);
}

function isInvalidatedDraftId(clientDraftId) {
  return invalidatedDraftIds().has(String(clientDraftId || '').trim().toLowerCase());
}

function retiredDraftResponse(status = 200) {
  return {
    status,
    body: {
      found: false,
      saved: false,
      expired: true,
      retiredLostKey: true,
      reason: retiredLostKeyMessage()
    }
  };
}

function publicLabels(payload) {
  const allowLabels = String(process.env.BTAI_STORE_RECORD_LABELS || '').toLowerCase() === 'true';
  return {
    client_name_label: allowLabels ? String(payload.clientName || '').slice(0, 120) : '',
    business_name_label: allowLabels ? String(payload.businessName || '').slice(0, 160) : ''
  };
}

async function saveDraft(payload) {
  const clientDraftId = String(payload?.clientDraftId || '').trim();
  if (!clientDraftId) return { status: 400, body: { error: 'Missing clientDraftId' } };
  if (isInvalidatedDraftId(clientDraftId)) return retiredDraftResponse(409);
  const existing = await getIntakeSession(clientDraftId);
  if (isRetiredLostKeyRecord(existing)) return retiredDraftResponse(409);
  const draftResumeToken = String(payload?.draftResumeToken || '').trim();
  if (draftResumeToken.length < 32) return { status: 400, body: { error: 'Missing draft resume token' } };

  const now = new Date().toISOString();
  const encrypted = encryptJson(payload);
  const labels = publicLabels(payload);
  await upsertIntakeSession({
    client_draft_id: clientDraftId,
    status: payload.interviewStarted ? 'draft' : 'created',
    business_category: String(payload.businessCategory || '').slice(0, 160),
    ...labels,
    current_step: String(payload.scenarioStage || payload.subStep || 'welcome').slice(0, 120),
    current_question: Number.isInteger(payload.currentQ) ? payload.currentQ : null,
    encrypted_payload: encrypted,
    updated_at: now
  });

  return { status: 200, body: { saved: true, clientDraftId, at: now } };
}

function canAccessDraft(payload, providedToken) {
  const expectedToken = String(payload?.draftResumeToken || '').trim();
  const token = String(providedToken || '').trim();
  if (expectedToken && token) return timingSafeEqualText(token, expectedToken);
  return String(process.env.BTAI_ALLOW_LEGACY_DRAFT_LOAD || '').toLowerCase() === 'true';
}

async function loadDraft(clientDraftId, draftResumeToken) {
  const id = String(clientDraftId || '').trim();
  if (!id) return { status: 400, body: { error: 'Missing clientDraftId' } };
  if (isInvalidatedDraftId(id)) return retiredDraftResponse(200);

  const record = await getIntakeSession(id);
  if (!record) return { status: 200, body: { found: false } };
  if (isRetiredLostKeyRecord(record)) return retiredDraftResponse(200);
  let payload;
  try {
    payload = decryptJson(record.encrypted_payload);
  } catch (err) {
    if (isLostKeyDecryptError(err)) return retiredDraftResponse(200);
    throw err;
  }
  if (!canAccessDraft(payload, draftResumeToken)) return { status: 403, body: { error: 'Draft resume token required' } };

  return {
    status: 200,
    body: {
      found: true,
      status: record.status,
      savedAt: record.updated_at,
      payload
    }
  };
}

async function deleteDraft(clientDraftId, draftResumeToken) {
  const id = String(clientDraftId || '').trim();
  if (!id) return { status: 200, body: { deleted: false, reason: 'No clientDraftId' } };
  if (isInvalidatedDraftId(id)) return retiredDraftResponse(200);
  const record = await getIntakeSession(id);
  if (isRetiredLostKeyRecord(record)) return retiredDraftResponse(200);
  if (record?.encrypted_payload) {
    let payload;
    try {
      payload = decryptJson(record.encrypted_payload);
    } catch (err) {
      if (isLostKeyDecryptError(err)) return retiredDraftResponse(200);
      throw err;
    }
    if (!canAccessDraft(payload, draftResumeToken)) return { status: 403, body: { error: 'Draft resume token required' } };
  }

  await updateIntakeSession(id, {
    status: 'abandoned',
    encrypted_payload: encryptJson({
      clientDraftId: id,
      deletedAt: new Date().toISOString(),
      deletionType: 'client_abandoned_draft',
      privacyNote: 'Draft payload erased from active encrypted record by client-side clear action.'
    }),
    updated_at: new Date().toISOString()
  });
  return { status: 200, body: { deleted: true } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'draft', limit: 60, windowMs: 60_000 });
    const action = String(req.body?.action || '').trim();
    let result;
    if (action === 'save') {
      result = await saveDraft(req.body?.payload || req.body);
    }
    else if (action === 'load') result = await loadDraft(req.body?.clientDraftId, req.body?.draftResumeToken);
    else if (action === 'delete') result = await deleteDraft(req.body?.clientDraftId, req.body?.draftResumeToken);
    else result = { status: 400, body: { error: 'Unknown draft action' } };

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('draft endpoint error:', err);
    return safeError(res, err);
  }
}
