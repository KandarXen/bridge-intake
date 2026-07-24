import { encryptJson } from './_crypto.js';
import { upsertIntakeSession } from './_supabase-rest.js';

function publicLabels(payload) {
  const allowLabels = String(process.env.BTAI_STORE_RECORD_LABELS || '').toLowerCase() === 'true';
  return {
    client_name_label: allowLabels ? String(payload.clientName || '').slice(0, 120) : '',
    business_name_label: allowLabels ? String(payload.businessName || '').slice(0, 160) : ''
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body?.payload || req.body;
  const clientDraftId = String(payload?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
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

    return res.status(200).json({ saved: true, clientDraftId, at: now });
  } catch (err) {
    console.error('draft-save error:', err);
    return res.status(500).json({ saved: false, error: err.message });
  }
}
