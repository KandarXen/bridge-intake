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

function countFilled(values) {
  return Array.isArray(values)
    ? values.filter(value => String(value || '').trim()).length
    : 0;
}

function progressSummary(row, payload) {
  const status = String(row.status || '').toLowerCase();
  const decryptError = !!payload.decryptError;
  const questionCount = Number(payload.baseQuestionCount || 0) || (Array.isArray(payload.answers) ? payload.answers.length : 0);
  const scenarioSteps = payload.intakeVariant === 'full_diagnostic' ? 2 : 0;
  const totalSteps = Math.max(1, Number(payload.progressTotalSteps || 0) || questionCount + scenarioSteps || 1);
  const currentQuestion = Number.isInteger(row.current_question)
    ? row.current_question
    : Number.isInteger(payload.currentQ) ? payload.currentQ : null;
  const fallbackStep = currentQuestion === null ? 0 : Math.min(totalSteps, scenarioSteps + currentQuestion + 1);
  const currentStep = Math.max(0, Math.min(totalSteps, Number(payload.progressCurrentStep || 0) || fallbackStep));
  const answeredPromptCount = Number(payload.answeredPromptCount || 0) ||
    countFilled(payload.answers) +
    countFilled(payload.masteryFollowups) +
    (payload.scenarioGood ? 1 : 0) +
    (payload.scenarioBad ? 1 : 0) +
    Object.values(payload.domainProbes || {}).filter(probe => String(probe?.answer || '').trim()).length;
  const progressPercent = status === 'complete'
    ? 100
    : Math.max(0, Math.min(100, Number(payload.progressPercent || 0) || Math.round((currentStep / totalSteps) * 100)));
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : 0;
  const idleHours = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 36_000) / 100) : null;
  const likelyAbandoned = status === 'draft' && idleHours !== null && idleHours >= 24;
  let bucket = 'Not started';
  if (decryptError) bucket = 'Encrypted - previous key needed';
  else if (status === 'complete' || progressPercent >= 100) bucket = 'Complete';
  else if (progressPercent >= 75) bucket = 'Near finish';
  else if (progressPercent >= 40) bucket = 'Midway';
  else if (progressPercent > 0) bucket = 'Early';
  if (likelyAbandoned) bucket = `${bucket} - likely abandoned`;

  return {
    progressPercent,
    progressCurrentStep: currentStep,
    progressTotalSteps: totalSteps,
    answeredPromptCount,
    abandonmentBucket: bucket,
    likelyAbandoned,
    idleHours,
    progressLabel: decryptError ? 'Encrypted' : `${progressPercent}% (${currentStep}/${totalSteps})`
  };
}

function sessionSummary(row) {
  let payload = {};
  try {
    payload = row.encrypted_payload ? decryptJson(row.encrypted_payload) : {};
  } catch (err) {
    payload = { decryptError: err.message || 'Could not decrypt session payload' };
  }
  const progress = progressSummary(row, payload);
  const encryptedLabel = payload.decryptError ? 'Encrypted - previous key needed' : 'Not captured';
  return {
    recordId: row.client_draft_id || '',
    status: row.status || '',
    businessName: safeText(payload.businessName || row.business_name_label || encryptedLabel),
    clientName: safeText(payload.clientName || row.client_name_label || encryptedLabel),
    clientEmail: safeText(payload.clientEmail || encryptedLabel, 220),
    businessCategory: safeText(payload.businessCategory || row.business_category || encryptedLabel),
    businessNiche: safeText(payload.businessNiche || encryptedLabel),
    partner: safeText(payload.campaignPartner || payload.partner || 'BTAI'),
    campaign: safeText(payload.campaignId || payload.campaign || 'general_intake'),
    currentStep: row.current_step || '',
    currentQuestion: row.current_question,
    ...progress,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    decryptError: payload.decryptError || ''
  };
}

async function listRecords(req, res) {
  const limit = Math.max(1, Math.min(Number(req.body?.limit) || 100, 500));
  const days = Math.max(1, Math.min(Number(req.body?.days) || 120, 1095));
  const status = String(req.body?.status || 'all').trim();
  const rows = await getRecentIntakeSessions({ limit, days, status });
  await logAdminAccess('admin-record-index', 'admin_record_index_retrieved', 'success', {
    adminAction: 'list_intake_records',
    rawDnaAccessed: false,
    returnedCount: rows.length,
    lookbackDays: days,
    statusFilter: status
  });
  return res.status(200).json({
    success: true,
    count: rows.length,
    generatedAt: new Date().toISOString(),
    records: rows.map(sessionSummary)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'admin-output', limit: 20, windowMs: 60_000 });
  } catch (err) {
    return safeError(res, err);
  }
  if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });

  const action = String(req.body?.action || 'download-md').trim();
  if (action === 'list-records') {
    try {
      return await listRecords(req, res);
    } catch (err) {
      console.error('admin record index error:', err);
      return res.status(500).json({ error: 'Server error', message: err.message });
    }
  }

  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
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
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
