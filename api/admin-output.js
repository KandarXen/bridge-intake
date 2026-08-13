import { decryptJson } from '../lib/crypto.js';
import { createZipBuffer } from '../lib/docx.js';
import { getIntakeOutputsByTypes, getLatestIntakeOutput, getRecentIntakeSessions, insertIntakeEvent } from '../lib/supabase-rest.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';
import { isLostKeyDecryptError, retiredLostKeyMessage } from '../lib/retirement.js';

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
  const retiredLostKey = row.retired_lost_key === true || String(row.status || '').toLowerCase() === 'retired_lost_key';
  const encryptedLabel = retiredLostKey ? 'Retired trial record - lost key' : payload.decryptError ? 'Encrypted - previous key needed' : 'Not captured';
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
    retiredLostKey,
    decryptError: retiredLostKey ? retiredLostKeyMessage() : payload.decryptError || ''
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

const HTML_REPORT_OUTPUT_TYPES = [
  'report_free_snapshot_html',
  'report_detailed_growth_html',
  'report_full_roadmap_html',
  'report_btai_advisor_brief_html'
];

function reportFolder(outputType) {
  if (outputType === 'report_free_snapshot_html') return 'Free_Snapshots';
  if (outputType === 'report_detailed_growth_html') return 'Detailed_Reports';
  if (outputType === 'report_full_roadmap_html') return 'Action_Plans';
  if (outputType === 'report_btai_advisor_brief_html') return 'Advisor_Briefs';
  return 'HTML_Reports';
}

function uniqueZipName(baseName, usedNames) {
  const cleaned = String(baseName || 'report.html')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 140) || 'report.html';
  const stem = cleaned.toLowerCase().endsWith('.html') ? cleaned.slice(0, -5) : cleaned;
  let candidate = `${stem || 'report'}.html`;
  let i = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem || 'report'}_${i}.html`;
    i += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

async function exportHtmlReports(req, res) {
  const rows = await getIntakeOutputsByTypes(HTML_REPORT_OUTPUT_TYPES, { limit: 10000 });
  const files = [];
  const manifest = {
    generatedAt: new Date().toISOString(),
    outputTypes: HTML_REPORT_OUTPUT_TYPES,
    totalRowsScanned: rows.length,
    includedReports: 0,
    skippedReports: 0,
    skipped: []
  };
  const usedNames = new Set();

  for (const row of rows) {
    const item = {
      outputId: row.id,
      recordId: row.client_draft_id || '',
      outputType: row.output_type || '',
      createdAt: row.created_at || '',
      retiredLostKey: !!row.retired_lost_key
    };

    if (row.retired_lost_key) {
      manifest.skippedReports += 1;
      manifest.skipped.push({ ...item, reason: 'retired_lost_key' });
      continue;
    }

    let payload;
    try {
      payload = row.encrypted_payload ? decryptJson(row.encrypted_payload) : null;
    } catch (err) {
      manifest.skippedReports += 1;
      manifest.skipped.push({
        ...item,
        reason: isLostKeyDecryptError(err) ? 'decrypt_failed_lost_or_previous_key' : 'decrypt_failed',
        message: err.message || ''
      });
      continue;
    }

    if (!payload?.contentBase64) {
      manifest.skippedReports += 1;
      manifest.skipped.push({ ...item, reason: 'no_html_contentBase64' });
      continue;
    }

    const fallbackName = `${safeFilename(payload.businessName || row.client_draft_id || 'Bridge_To_AI')}_${safeFilename(row.output_type)}.html`;
    const filename = uniqueZipName(payload.filename || fallbackName, usedNames);
    files.push({
      name: `${reportFolder(row.output_type)}/${filename}`,
      content: Buffer.from(payload.contentBase64, 'base64')
    });
    manifest.includedReports += 1;
  }

  files.push({
    name: 'MANIFEST.json',
    content: JSON.stringify(manifest, null, 2)
  });
  files.push({
    name: 'README.txt',
    content: [
      'Bridge To AI HTML report export',
      `Generated: ${manifest.generatedAt}`,
      `Rows scanned: ${manifest.totalRowsScanned}`,
      `HTML reports included: ${manifest.includedReports}`,
      `Rows skipped: ${manifest.skippedReports}`,
      '',
      'Skipped rows are listed in MANIFEST.json. Retired/lost-key or undecryptable rows were not included.'
    ].join('\n')
  });

  const zip = createZipBuffer(files);
  await logAdminAccess('all-html-reports', 'admin_all_html_reports_exported', 'success', {
    adminAction: 'export_all_html_reports_zip',
    rawDnaAccessed: false,
    reportFilesIncluded: manifest.includedReports,
    skippedReports: manifest.skippedReports,
    outputRowsScanned: manifest.totalRowsScanned,
    retiredLostKeySkipped: manifest.skipped.filter(item => item.reason === 'retired_lost_key').length
  });

  return res.status(200).json({
    success: true,
    filename: `BTAI_All_HTML_Reports_${new Date().toISOString().slice(0, 10)}.zip`,
    contentBase64: zip.toString('base64'),
    manifest
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

  if (action === 'export-html-reports') {
    try {
      return await exportHtmlReports(req, res);
    } catch (err) {
      console.error('admin HTML report export error:', err);
      return res.status(Number(err?.statusCode) || 500).json({ error: err.message || 'HTML report export failed' });
    }
  }

  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
    const output = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
    if (!output) return res.status(404).json({ error: 'No Venture DNA output found for that record ID' });

    let decrypted;
    try {
      decrypted = decryptJson(output.encrypted_payload);
    } catch (err) {
      if (isLostKeyDecryptError(err)) {
        await logAdminAccess(clientDraftId, 'admin_raw_dna_retired_lost_key', 'blocked', {
          adminAction: 'download_venture_dna_markdown',
          rawDnaAccessed: false,
          retiredLostKey: true,
          proofStatus: 'blocked_retired_lost_key'
        });
        return res.status(410).json({ error: retiredLostKeyMessage(), retiredLostKey: true });
      }
      throw err;
    }
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
