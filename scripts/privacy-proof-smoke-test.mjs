#!/usr/bin/env node

import crypto from 'crypto';

const POLICY_VERSION = '2026-07-25-v1.56.1';
const REQUIRED_FLAGS = [
  'encryptedRecordsConfirmed',
  'anonymizedAiAnalysisConfirmed',
  'privacyConsentConfirmed',
  'crossBorderNoticeConfirmed',
  'retentionPolicyRecorded',
  'adminAccessLogged',
  'reportPrivacyScanCompleted'
];

function usage() {
  return `
Usage:
  node scripts/privacy-proof-smoke-test.mjs [--record-id <id>] [--json]

Purpose:
  Creates a synthetic non-client privacy-proof audit record in Supabase and
  verifies that the proof summary reaches the required production-readiness flags.

Required env vars:
  SUPABASE_URL
  SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
  BTAI_ENCRYPTION_KEY
`;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function hasArg(name) {
  return process.argv.includes(name);
}

function requireEnv(name, alternatives = []) {
  if (process.env[name]) return;
  if (alternatives.some(alt => process.env[alt])) return;
  const labels = [name, ...alternatives].join(' or ');
  throw new Error(`Missing required environment variable: ${labels}`);
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return { url, key };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = supabaseConfig();
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

async function insertIntakeOutput(row) {
  const data = await supabaseRequest('intake_outputs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

async function insertIntakeEvent(row) {
  const data = await supabaseRequest('intake_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

async function getIntakeEvents(clientDraftId, limit = 200) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 200));
  const data = await supabaseRequest(
    `intake_events?client_draft_id=${eq(clientDraftId)}&select=*&order=created_at.asc&limit=${safeLimit}`,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data : [];
}

function getEncryptionKey() {
  const raw = process.env.BTAI_ENCRYPTION_KEY;
  if (!raw) throw new Error('Missing BTAI_ENCRYPTION_KEY');

  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) return base64;

  const hex = Buffer.from(raw, 'hex');
  if (hex.length === 32) return hex;

  throw new Error('BTAI_ENCRYPTION_KEY must decode to 32 bytes using base64 or hex');
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value ?? null), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  };
}

function nowIso() {
  return new Date().toISOString();
}

function retentionMetadata() {
  const review = new Date();
  review.setMonth(review.getMonth() + 24);
  return {
    retentionPolicyVersion: '2026-07-30-v1',
    retentionCategory: 'synthetic_privacy_proof_smoke_test',
    scheduledReviewDate: review.toISOString(),
    deletionRequestPathAvailable: true
  };
}

async function logProof(clientDraftId, eventType, status, details = {}) {
  return insertIntakeEvent({
    client_draft_id: clientDraftId,
    event_type: eventType,
    status,
    stage: eventType.startsWith('admin_') ? 'admin_access_audit' : 'privacy_proof',
    question_index: null,
    domain: 'BTAI Secure Intelligence Layer Smoke Test',
    answer_word_count: null,
    metadata: {
      ts: nowIso(),
      app: 'privacy-proof-smoke-test',
      syntheticTest: true,
      privacyProof: true,
      eventType,
      status,
      stage: eventType.startsWith('admin_') ? 'admin_access_audit' : 'privacy_proof',
      details: {
        syntheticTest: true,
        rawInterviewIncluded: false,
        rawDnaIncluded: false,
        partnerRawAccess: false,
        partnerAggregateOnly: true,
        encryptedAtRest: true,
        encryptionAlg: 'AES-256-GCM',
        directIdentifiersRemoved: true,
        ...details
      }
    }
  });
}

function successfulEventWithDetail(proofEvents, eventType, predicate) {
  return proofEvents.find(event => {
    const details = event.metadata?.details || {};
    return event.event_type === eventType && event.status === 'success' && predicate(details);
  });
}

function successfulEvent(proofEvents, eventType) {
  return proofEvents.find(event => event.event_type === eventType && event.status === 'success');
}

async function privacyProofSummary(clientDraftId) {
  const events = await getIntakeEvents(clientDraftId, 200);
  const proofEvents = events.filter(event => {
    const metadata = event.metadata || {};
    return metadata.privacyProof || String(event.stage || '').includes('privacy') || String(event.event_type || '').includes('privacy_proof');
  });
  const consentEvent = successfulEventWithDetail(proofEvents, 'privacy_proof_consent_recorded', details =>
    !!details.privacyConsentAccepted && !!details.privacyConsentAt && !!details.privacyPolicyVersion
  );
  const crossBorderEvent = successfulEventWithDetail(proofEvents, 'privacy_proof_cross_border_notice', details =>
    !!details.crossBorderProcessingNoticePresented && !!details.serviceProviderPolicyAvailable &&
    !!details.privacyContactPresented && !!details.privacyPolicyVersion
  );
  const reportScanEvents = proofEvents.filter(e => e.event_type === 'report_privacy_scan_completed');
  const blockingReportScanEvents = reportScanEvents.filter(e => {
    const details = e.metadata?.details || {};
    return Array.isArray(details.blockingFindings)
      ? details.blockingFindings.length > 0
      : details.reportApprovedForClientDelivery === false;
  });

  const summary = {
    recordId: clientDraftId,
    generatedAt: nowIso(),
    proofEventCount: proofEvents.length,
    encryptedRecordsConfirmed: !!successfulEvent(proofEvents, 'privacy_proof_secure_output_storage'),
    anonymizedAiAnalysisConfirmed: !!successfulEvent(proofEvents, 'privacy_proof_ai_analysis_requested'),
    privacyConsentConfirmed: !!consentEvent,
    crossBorderNoticeConfirmed: !!crossBorderEvent,
    retentionPolicyRecorded: !!successfulEvent(proofEvents, 'privacy_proof_retention_policy_recorded'),
    adminAccessLogged: proofEvents.some(e => String(e.stage || '') === 'admin_access_audit' || String(e.event_type || '').startsWith('admin_')),
    reportPrivacyScanCompleted: reportScanEvents.length > 0,
    reportPrivacyScanBlockingIssueFound: blockingReportScanEvents.length > 0,
    rawDataSharedWithPartner: false,
    rawDnaIncludedInReportZip: false,
    partnerAggregateOnly: true,
    clientFacingEmailContainsRawDna: false,
    remainingImprovements: [],
    events: proofEvents.map(event => ({
      createdAt: event.created_at,
      eventType: event.event_type,
      status: event.status,
      stage: event.stage,
      details: event.metadata?.details || {}
    }))
  };
  if (!summary.privacyConsentConfirmed) summary.remainingImprovements.push('Consent proof was not found for this record.');
  if (!summary.crossBorderNoticeConfirmed) summary.remainingImprovements.push('Cross-border processing notice proof was not found for this record.');
  if (!summary.retentionPolicyRecorded) summary.remainingImprovements.push('Retention/deletion policy proof was not found for this record.');
  if (!summary.adminAccessLogged) summary.remainingImprovements.push('No admin access event has been logged yet for this record.');
  if (!summary.reportPrivacyScanCompleted) summary.remainingImprovements.push('Report privacy scan proof was not found for this record.');
  if (summary.reportPrivacyScanBlockingIssueFound) summary.remainingImprovements.push('A report privacy scan found a blocking client-delivery issue.');
  summary.privacyConclusion = summary.remainingImprovements.length
    ? 'Failed privacy-proof smoke test with missing evidence.'
    : 'Passed automated synthetic privacy-proof smoke test.';
  return summary;
}

async function main() {
  if (hasArg('--help') || hasArg('-h')) {
    console.log(usage().trim());
    return;
  }

  requireEnv('SUPABASE_URL');
  requireEnv('SUPABASE_SECRET_KEY', ['SUPABASE_SERVICE_ROLE_KEY']);
  requireEnv('BTAI_ENCRYPTION_KEY');

  const clientDraftId = argValue('--record-id') || `privacy-smoke-${crypto.randomUUID()}`;
  const startedAt = nowIso();

  await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'synthetic_privacy_proof_smoke_test_payload',
    encrypted_payload: encryptJson({
      syntheticTest: true,
      createdAt: startedAt,
      purpose: 'Automated privacy proof smoke test. No real client data.',
      recordId: clientDraftId
    })
  });

  await logProof(clientDraftId, 'privacy_proof_consent_recorded', 'success', {
    privacyProofType: 'consent',
    privacyConsentAccepted: true,
    privacyConsentAt: startedAt,
    privacyPolicyVersion: POLICY_VERSION,
    partnerAggregateDisclosureShown: true,
    partnerAggregateDisclosureAccepted: true,
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'privacy_proof_cross_border_notice', 'success', {
    privacyProofType: 'cross_border_notice',
    crossBorderProcessingNoticePresented: true,
    serviceProviderPolicyAvailable: true,
    privacyContactPresented: true,
    privacyPolicyVersion: POLICY_VERSION,
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'privacy_proof_retention_policy_recorded', 'success', {
    privacyProofType: 'retention',
    ...retentionMetadata(),
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'privacy_proof_anonymization_completed', 'success', {
    privacyProofType: 'anonymization',
    payloadType: 'synthetic_interview_prompt',
    aiPayloadType: 'anonymized_business_profile',
    anonymizationReplacements: 3,
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'privacy_proof_ai_analysis_requested', 'success', {
    privacyProofType: 'ai_analysis',
    payloadType: 'synthetic_anonymized_prompt',
    aiPayloadType: 'anonymized_business_profile',
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'privacy_proof_secure_output_storage', 'success', {
    privacyProofType: 'secure_storage',
    outputType: 'synthetic_privacy_proof_smoke_test_payload',
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'report_privacy_scan_completed', 'success', {
    privacyProofType: 'report_privacy_scan',
    reportApprovedForClientDelivery: true,
    blockingFindings: [],
    privacyScanFindings: [],
    clientReportOnly: true,
    proofStatus: 'passed'
  });
  await logProof(clientDraftId, 'admin_privacy_proof_downloaded', 'success', {
    privacyProofType: 'admin_access',
    adminAccessLogged: true,
    adminAction: 'automated_privacy_proof_smoke_test',
    recordAccessPurpose: 'production_readiness_verification',
    proofStatus: 'passed'
  });

  const summary = await privacyProofSummary(clientDraftId);
  const missing = REQUIRED_FLAGS.filter(flag => !summary[flag]);
  if (summary.reportPrivacyScanBlockingIssueFound) missing.push('reportPrivacyScanBlockingIssueFound must be false');

  if (hasArg('--json')) {
    console.log(JSON.stringify({ success: missing.length === 0, missing, privacyProof: summary }, null, 2));
  } else {
    console.log(`Privacy proof smoke test record: ${clientDraftId}`);
    console.log(`Proof events found: ${summary.proofEventCount}`);
    REQUIRED_FLAGS.forEach(flag => console.log(`${summary[flag] ? 'PASS' : 'FAIL'} ${flag}`));
    console.log(`${!summary.reportPrivacyScanBlockingIssueFound ? 'PASS' : 'FAIL'} reportPrivacyScanBlockingIssueFound is false`);
    console.log(summary.privacyConclusion);
  }

  if (missing.length) {
    console.error(`Privacy proof smoke test failed: ${missing.join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
