import { updateIntakeSession } from './_supabase-rest.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(200).json({ deleted: false, reason: 'No clientDraftId' });

  try {
    await updateIntakeSession(clientDraftId, {
      status: 'abandoned',
      updated_at: new Date().toISOString()
    });
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('draft-delete error:', err);
    return res.status(200).json({ deleted: false, reason: err.message });
  }
}
