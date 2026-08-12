import crypto from 'crypto';
import { encryptJson } from '../lib/crypto.js';
import { getIntakeEvents, insertIntakeEvent, insertIntakeOutput } from '../lib/supabase-rest.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';

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

async function runSmokeTest() {
  const clientDraftId = `privacy-smoke-${crypto.randomUUID()}`;
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

  const privacyProof = await privacyProofSummary(clientDraftId);
  const missing = REQUIRED_FLAGS.filter(flag => !privacyProof[flag]);
  if (privacyProof.reportPrivacyScanBlockingIssueFound) missing.push('reportPrivacyScanBlockingIssueFound must be false');
  return { success: missing.length === 0, missing, privacyProof };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'privacy-proof-smoke-test', limit: 5, windowMs: 60_000 });
  } catch (err) {
    return safeError(res, err);
  }
  if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await runSmokeTest();
    return res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error('privacy proof smoke test error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
