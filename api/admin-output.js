import { decryptJson } from '../lib/crypto.js';
import { getLatestIntakeOutput, getRecentIntakeSessions, insertIntakeEvent } from '../lib/supabase-rest.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';

function safeFilename(value) {
  return String(value || 'Venture_DNA')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

async function logAdminAccess(clientDraftId, eventType, status, details = {}) {
  try {
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'admin_access_audit',
      question_index: null,
      domain: 'admin_access',
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        privacyProof: true,
        eventType,
        status,
        stage: 'admin_access_audit',
        details: {
          privacyProofType: 'admin_access',
          adminAccessLogged: true,
          encryptedAtRest: true,
          encryptionAlg: 'AES-256-GCM',
          partnerRawAccess: false,
          recordAccessPurpose: 'admin_secure_retrieval',
          ...details
        }
      }
    });
  } catch (err) {
    console.error('admin access audit log failed:', err);
  }
}

function safeText(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function sessionSummary(row) {
  let payload = {};
  try {
    payload = row.encrypted_payload ? decryptJson(row.encrypted_payload) : {};
  } catch (err) {
    payload = { decryptError: err.message || 'Could not decrypt session payload' };
  }
  return {
    recordId: row.client_draft_id || '',
    status: row.status || '',
    businessName: safeText(payload.businessName || row.business_name_label || 'Not captured'),
    clientName: safeText(payload.clientName || row.client_name_label || 'Not captured'),
    clientEmail: safeText(payload.clientEmail || 'Not captured', 220),
    businessCategory: safeText(payload.businessCategory || row.business_category || 'Not captured'),
    businessNiche: safeText(payload.businessNiche || 'Not captured'),
    partner: safeText(payload.campaignPartner || payload.partner || 'BTAI'),
    campaign: safeText(payload.campaignId || payload.campaign || 'general_intake'),
    currentStep: row.current_step || '',
    currentQuestion: row.current_question,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    decryptError: payload.decryptError || ''
  };
}

function isRetiredLostKeyRecord(row) {
  const haystack = [
    row?.status,
    row?.client_draft_id,
    row?.current_step,
    row?.business_name_label,
    row?.business_category
  ].map(value => String(value || '').toLowerCase());
  return haystack.some(value => value.includes('retired_lost_key'));
}

async function listRecords(req, res) {
  const limit = Math.max(1, Math.min(Number(req.body?.limit) || 100, 500));
  const days = Math.max(1, Math.min(Number(req.body?.days) || 120, 1095));
  const status = String(req.body?.status || 'all').trim();
  const rows = await getRecentIntakeSessions({ limit, days, status });
  const visibleRows = rows.filter(row => !isRetiredLostKeyRecord(row));
  await logAdminAccess('admin-record-index', 'admin_record_index_retrieved', 'success', {
    adminAction: 'list_intake_records',
    rawDnaAccessed: false,
    returnedCount: visibleRows.length,
    hiddenRetiredLostKeyCount: rows.length - visibleRows.length,
    lookbackDays: days,
    statusFilter: status
  });
  return res.status(200).json({
    success: true,
    count: visibleRows.length,
    hiddenRetiredLostKeyCount: rows.length - visibleRows.length,
    generatedAt: new Date().toISOString(),
    records: visibleRows.map(sessionSummary)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'admin-output', limit: 20, windowMs: 60_000 });
    if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });

    const action = String(req.body?.action || 'download-md').trim();
    if (action === 'list-records') {
      return await listRecords(req, res);
    }

    const clientDraftId = String(req.body?.clientDraftId || '').trim();
    if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

    const output = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
    if (!output) return res.status(404).json({ error: 'No Venture DNA output found for that record ID' });

    const decrypted = decryptJson(output.encrypted_payload);
    const dnaContent = decrypted.dnaContent || '';
    if (!dnaContent) return res.status(404).json({ error: 'Output record did not contain DNA content' });

    const filenameBase = safeFilename(req.body?.filename || clientDraftId);
    await logAdminAccess(clientDraftId, 'admin_raw_dna_retrieved', 'success', {
      adminAction: 'download_venture_dna_markdown',
      rawDnaAccessed: true,
      rawDnaSharedWithPartner: false,
      outputId: output.id
    });
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
    return safeError(res, err, 'Admin output request failed');
  }
}
