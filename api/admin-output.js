import { decryptJson } from '../lib/crypto.js';
import { getLatestIntakeOutput } from '../lib/supabase-rest.js';

function authorized(req) {
  const expected = process.env.BTAI_ADMIN_SECRET;
  if (!expected) return false;
  const provided = req.headers['x-btai-admin-secret'] || req.body?.adminSecret;
  return provided && String(provided) === String(expected);
}

function safeFilename(value) {
  return String(value || 'Venture_DNA')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
    const output = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
    if (!output) return res.status(404).json({ error: 'No Venture DNA output found for that record ID' });

    const decrypted = decryptJson(output.encrypted_payload);
    const dnaContent = decrypted.dnaContent || '';
    if (!dnaContent) return res.status(404).json({ error: 'Output record did not contain DNA content' });

    const filenameBase = safeFilename(req.body?.filename || clientDraftId);
    return res.status(200).json({
      success: true,
      clientDraftId,
      outputId: output.id,
      createdAt: output.created_at,
      filename: `${filenameBase}_VENTURE_DNA.md`,
      dnaContent
    });
  } catch (err) {
    console.error('admin-output error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
