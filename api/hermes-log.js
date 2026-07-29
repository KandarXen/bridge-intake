// api/hermes-log.js
// Hermes intake monitor. Stores sanitized event metadata in Supabase.
// No answer bodies are logged.

import { insertIntakeEvent, supabaseConfigured } from '../lib/supabase-rest.js';

function sanitizeEvent(body) {
  const details = body.details && typeof body.details === 'object' ? body.details : {};
  const allowLabels = String(process.env.BTAI_STORE_RECORD_LABELS || '').toLowerCase() === 'true';
  return {
    ts: new Date().toISOString(),
    app: 'intake.bridgetoai.ca',
    clientDraftId: String(body.clientDraftId || '').slice(0, 80),
    clientName: allowLabels ? String(body.clientName || '').slice(0, 120) : '',
    businessName: allowLabels ? String(body.businessName || '').slice(0, 160) : '',
    partner: String(body.partner || details.partner || 'BTAI').slice(0, 80),
    campaign: String(body.campaign || details.campaign || 'general_intake').slice(0, 120),
    businessCategory: String(body.businessCategory || '').slice(0, 160),
    businessNiche: String(body.businessNiche || details.businessNiche || '').slice(0, 160),
    shareComfort: String(body.shareComfort || details.shareComfort || '').slice(0, 120),
    companySize: String(body.companySize || '').slice(0, 80),
    ownerWorkStatus: String(body.ownerWorkStatus || '').slice(0, 160),
    eventType: String(body.eventType || 'unknown').slice(0, 80),
    status: String(body.status || 'info').slice(0, 40),
    stage: String(body.stage || '').slice(0, 120),
    questionIndex: Number.isFinite(body.questionIndex) ? body.questionIndex : null,
    questionType: String(body.questionType || '').slice(0, 120),
    domain: String(body.domain || '').slice(0, 160),
    answerWordCount: Number.isFinite(body.answerWordCount) ? body.answerWordCount : null,
    details: {
      hasWebsite: !!details.hasWebsite,
      businessNiche: details.businessNiche ? String(details.businessNiche).slice(0, 160) : undefined,
      shareComfort: details.shareComfort ? String(details.shareComfort).slice(0, 120) : undefined,
      departments: Array.isArray(details.departments) ? details.departments.slice(0, 20).map(v => String(v).slice(0, 80)) : undefined,
      partner: String(body.partner || details.partner || 'BTAI').slice(0, 80),
      campaign: String(body.campaign || details.campaign || 'general_intake').slice(0, 120),
      privacyConsent: typeof details.privacyConsent === 'boolean' ? details.privacyConsent : undefined,
      privacyPolicyVersion: details.privacyPolicyVersion ? String(details.privacyPolicyVersion).slice(0, 80) : undefined,
      btaiFollowupInterest: details.btaiFollowupInterest ? String(details.btaiFollowupInterest).slice(0, 40) : undefined,
      answerQualityBucket: details.answerQualityBucket ? String(details.answerQualityBucket).slice(0, 40) : undefined,
      isShortAnswer: typeof details.isShortAnswer === 'boolean' ? details.isShortAnswer : undefined,
      hasNumber: typeof details.hasNumber === 'boolean' ? details.hasNumber : undefined,
      hasExampleLanguage: typeof details.hasExampleLanguage === 'boolean' ? details.hasExampleLanguage : undefined,
      section: details.section ? String(details.section).slice(0, 160) : undefined,
      durationSeconds: Number.isFinite(details.durationSeconds) ? details.durationSeconds : undefined,
      questionCount: Number.isFinite(details.questionCount) ? details.questionCount : undefined,
      totalWordCount: Number.isFinite(details.totalWordCount) ? details.totalWordCount : undefined,
      baseQuestionCount: Number.isFinite(details.baseQuestionCount) ? details.baseQuestionCount : undefined,
      answeredPromptCount: Number.isFinite(details.answeredPromptCount) ? details.answeredPromptCount : undefined,
      averageWordsPerAnswer: Number.isFinite(details.averageWordsPerAnswer) ? details.averageWordsPerAnswer : undefined,
      shortAnswerCount: Number.isFinite(details.shortAnswerCount) ? details.shortAnswerCount : undefined,
      shortAnswerRate: Number.isFinite(details.shortAnswerRate) ? details.shortAnswerRate : undefined,
      richAnswerCount: Number.isFinite(details.richAnswerCount) ? details.richAnswerCount : undefined,
      generatedProbeCount: Number.isFinite(details.generatedProbeCount) ? details.generatedProbeCount : undefined,
      answeredProbeCount: Number.isFinite(details.answeredProbeCount) ? details.answeredProbeCount : undefined,
      maxAdaptiveProbes: Number.isFinite(details.maxAdaptiveProbes) ? details.maxAdaptiveProbes : undefined,
      rejectedReason: details.rejectedReason ? String(details.rejectedReason).slice(0, 160) : undefined,
      proposedQuestionType: details.proposedQuestionType ? String(details.proposedQuestionType).slice(0, 80) : undefined,
      sensitivityLevel: details.sensitivityLevel ? String(details.sensitivityLevel).slice(0, 80) : undefined,
      questionType: details.questionType ? String(details.questionType).slice(0, 80) : undefined,
      repetitiveProbe: typeof details.repetitiveProbe === 'boolean' ? details.repetitiveProbe : undefined,
      autosaveTarget: details.autosaveTarget ? String(details.autosaveTarget).slice(0, 120) : undefined,
      draftSaved: typeof details.draftSaved === 'boolean' ? details.draftSaved : undefined,
      privacyAnonymized: typeof details.privacyAnonymized === 'boolean' ? details.privacyAnonymized : undefined,
      anonymizationReplacements: Number.isFinite(details.anonymizationReplacements) ? details.anonymizationReplacements : undefined,
      driveSaved: typeof details.driveSaved === 'boolean' ? details.driveSaved : undefined,
      driveReason: details.driveReason ? String(details.driveReason).slice(0, 400) : undefined,
      emailDelivered: typeof details.emailDelivered === 'boolean' ? details.emailDelivered : undefined,
      reportTier: details.reportTier ? String(details.reportTier).slice(0, 80) : undefined,
      reportOutputType: details.reportOutputType ? String(details.reportOutputType).slice(0, 120) : undefined,
      zipReady: typeof details.zipReady === 'boolean' ? details.zipReady : undefined,
      privacyProofType: details.privacyProofType ? String(details.privacyProofType).slice(0, 120) : undefined,
      privacyPolicyVersion: details.privacyPolicyVersion ? String(details.privacyPolicyVersion).slice(0, 80) : undefined,
      consentVersion: details.consentVersion ? String(details.consentVersion).slice(0, 80) : undefined,
      rawInterviewIncluded: typeof details.rawInterviewIncluded === 'boolean' ? details.rawInterviewIncluded : undefined,
      rawDnaIncluded: typeof details.rawDnaIncluded === 'boolean' ? details.rawDnaIncluded : undefined,
      directIdentifiersRemoved: typeof details.directIdentifiersRemoved === 'boolean' ? details.directIdentifiersRemoved : undefined,
      partnerRawAccess: typeof details.partnerRawAccess === 'boolean' ? details.partnerRawAccess : undefined,
      partnerAggregateOnly: typeof details.partnerAggregateOnly === 'boolean' ? details.partnerAggregateOnly : undefined,
      encryptedAtRest: typeof details.encryptedAtRest === 'boolean' ? details.encryptedAtRest : undefined,
      encryptionAlg: details.encryptionAlg ? String(details.encryptionAlg).slice(0, 60) : undefined,
      payloadType: details.payloadType ? String(details.payloadType).slice(0, 120) : undefined,
      aiPayloadType: details.aiPayloadType ? String(details.aiPayloadType).slice(0, 120) : undefined,
      piiMappingStoredEncrypted: typeof details.piiMappingStoredEncrypted === 'boolean' ? details.piiMappingStoredEncrypted : undefined,
      clientReportOnly: typeof details.clientReportOnly === 'boolean' ? details.clientReportOnly : undefined,
      recordIdHash: details.recordIdHash ? String(details.recordIdHash).slice(0, 120) : undefined,
      proofStatus: details.proofStatus ? String(details.proofStatus).slice(0, 80) : undefined,
      generationMs: Number.isFinite(details.generationMs) ? details.generationMs : undefined,
      emailMs: Number.isFinite(details.emailMs) ? details.emailMs : undefined,
      startedAt: details.startedAt ? String(details.startedAt).slice(0, 80) : undefined,
      completedAt: details.completedAt ? String(details.completedAt).slice(0, 80) : undefined,
      error: details.error ? String(details.error).slice(0, 500) : undefined,
      resumeUsed: typeof details.resumeUsed === 'boolean' ? details.resumeUsed : undefined
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseConfigured()) {
    return res.status(200).json({ logged: false, reason: 'Supabase not configured' });
  }

  try {
    const event = sanitizeEvent(req.body || {});
    const row = await insertIntakeEvent({
      client_draft_id: event.clientDraftId || null,
      event_type: event.eventType,
      status: event.status,
      stage: event.stage,
      question_index: event.questionIndex,
      domain: event.domain || event.campaign,
      answer_word_count: event.answerWordCount,
      metadata: event
    });

    return res.status(200).json({ logged: true, id: row?.id || '' });
  } catch (err) {
    console.error('hermes-log error:', err);
    return res.status(200).json({ logged: false, reason: err.message });
  }
}

