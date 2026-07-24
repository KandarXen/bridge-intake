import { decryptJson } from './_crypto.js';
import { getIntakeSession } from './_supabase-rest.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
    const record = await getIntakeSession(clientDraftId);
    if (!record) return res.status(200).json({ found: false });

    const payload = decryptJson(record.encrypted_payload);
    return res.status(200).json({
      found: true,
      status: record.status,
      savedAt: record.updated_at,
      payload
    });
  } catch (err) {
    console.error('draft-load error:', err);
    return res.status(500).json({ found: false, error: err.message });
  }
}
