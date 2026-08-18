import { encryptJson, decryptJson } from '../lib/crypto.js';
import { getIntakeSession, updateIntakeSession, upsertIntakeSession } from '../lib/supabase-rest.js';

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

  const now = new Date().toISOString();
  const encrypted = encryptJson(payload);
  const labels = publicLabels(payload);
  const existing = await getIntakeSession(clientDraftId);
  const protectedStatuses = new Set(['complete', 'privacy_review_required']);
  const nextStatus = protectedStatuses.has(existing?.status)
    ? existing.status
    : payload.interviewStarted ? 'draft' : 'created';
  await upsertIntakeSession({
    client_draft_id: clientDraftId,
    status: nextStatus,
    business_category: String(payload.businessCategory || '').slice(0, 160),
    ...labels,
    current_step: String(payload.scenarioStage || payload.subStep || 'welcome').slice(0, 120),
    current_question: Number.isInteger(payload.currentQ) ? payload.currentQ : null,
    encrypted_payload: encrypted,
    updated_at: now
  });

  return { status: 200, body: { saved: true, clientDraftId, at: now } };
}

async function loadDraft(clientDraftId) {
  const id = String(clientDraftId || '').trim();
  if (!id) return { status: 400, body: { error: 'Missing clientDraftId' } };

  const record = await getIntakeSession(id);
  if (!record) return { status: 200, body: { found: false } };

  return {
    status: 200,
    body: {
      found: true,
      status: record.status,
      savedAt: record.updated_at,
      payload: decryptJson(record.encrypted_payload)
    }
  };
}

async function deleteDraft(clientDraftId) {
  const id = String(clientDraftId || '').trim();
  if (!id) return { status: 200, body: { deleted: false, reason: 'No clientDraftId' } };

  const existing = await getIntakeSession(id);
  const protectedStatuses = new Set(['complete', 'privacy_review_required']);
  if (!protectedStatuses.has(existing?.status)) {
    await updateIntakeSession(id, {
      status: 'abandoned',
      updated_at: new Date().toISOString()
    });
  }
  return { status: 200, body: { deleted: true } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const action = String(req.body?.action || '').trim();
    let result;
    if (action === 'save') result = await saveDraft(req.body?.payload || req.body);
    else if (action === 'load') result = await loadDraft(req.body?.clientDraftId);
    else if (action === 'delete') result = await deleteDraft(req.body?.clientDraftId);
    else result = { status: 400, body: { error: 'Unknown draft action' } };

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('draft endpoint error:', err);
    return res.status(500).json({ error: err.message });
  }
}
