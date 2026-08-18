import { decryptJson, encryptJson } from '../lib/crypto.js';
import { insertClaimTrace, insertIntakeEvent, insertIntakeOutput, getIntakeSession, getLatestIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { gateProofDetails, publicGateSummary, runPrivacyGate } from '../lib/privacy-gate.js';
import { validateDnaOutput } from '../lib/validate-output.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';

function retentionMetadata(category = 'first_intake') {
  const now = new Date();
  const review = new Date(now);
  if (category === 'draft') review.setDate(review.getDate() + 30);
  else review.setMonth(review.getMonth() + 24);
  return {
    retentionPolicyVersion: '2026-07-30-v1',
    retentionCategory: category,
    scheduledReviewDate: review.toISOString(),
    deletionRequestPathAvailable: true
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPrivacyRedactions(text, redactionMap = []) {
  let output = String(text || '');
  const entries = [...(redactionMap || [])]
    .filter(item => item && item.original && item.token)
    .sort((a, b) => String(b.original).length - String(a.original).length);
  for (const item of entries) {
    output = output.replace(new RegExp(escapeRegExp(item.original), 'g'), item.token);
  }
  return output;
}

function extractField(prompt, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = prompt.match(re);
  return match ? match[1].trim() : '';
}

function addMapping(map, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!map[placeholder]) map[placeholder] = cleaned;
}

function replaceAllLiteral(text, value, placeholder) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(escapeRegExp(value), 'g'), placeholder);
}

function anonymizePrompt(prompt) {
  const mapping = {};
  addMapping(mapping, '[OWNER_NAME]', extractField(prompt, 'Owner Name'));
  addMapping(mapping, '[BUSINESS_NAME]', extractField(prompt, 'Business Name'));
  addMapping(mapping, '[BUSINESS_CATEGORY]', extractField(prompt, 'Business Category'));
  addMapping(mapping, '[WEBSITE_URL]', extractField(prompt, 'Website URL'));

  let anonymized = prompt;
  Object.entries(mapping)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([placeholder, value]) => {
      anonymized = replaceAllLiteral(anonymized, value, placeholder);
    });

  let emailCount = 0;
  anonymized = anonymized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, match => {
    const placeholder = `[EMAIL_${++emailCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let phoneCount = 0;
  anonymized = anonymized.replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, match => {
    const placeholder = `[PHONE_${++phoneCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let urlCount = 0;
  anonymized = anonymized.replace(/https?:\/\/[^\s)]+/gi, match => {
    if (Object.values(mapping).includes(match)) return '[WEBSITE_URL]';
    const placeholder = `[URL_${++urlCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let moneyAccountCount = 0;
  anonymized = anonymized.replace(/\b(?:\d[ -]*?){13,19}\b/g, match => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    const placeholder = `[FINANCIAL_ACCOUNT_${++moneyAccountCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  const privacyHeader = 'HERMES PRIVACY LAYER ACTIVE:\nThe source interview below has been anonymized before model analysis. Use placeholders exactly as given. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n\n';
  return {
    anonymizedPrompt: privacyHeader + anonymized,
    mapping,
    stats: {
      replacements: Object.keys(mapping).length,
      emails: emailCount,
      phones: phoneCount,
      urls: urlCount,
      financialAccounts: moneyAccountCount
    }
  };
}

function reidentifyText(text, mapping) {
  let output = text || '';
  Object.entries(mapping || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([placeholder, value]) => {
      output = output.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
    });
  return output;
}

function safeText(value, fallback = '(not provided)') {
  const text = String(value || '').trim();
  return text || fallback;
}

function wordCount(text) {
  const cleaned = String(text || '').trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

function answeredItems(payload) {
  const items = [];
  (payload.answers || []).forEach((answer, index) => {
    if (!String(answer || '').trim()) return;
    items.push(`Answer ${index + 1}: ${answer}`);
  });
  (payload.masteryFollowups || []).forEach((answer, index) => {
    if (!String(answer || '').trim()) return;
    const question = payload.masteryFollowupQ?.[index] || 'AI future follow-up';
    items.push(`Follow-up after answer ${index + 1}: ${question}\n${answer}`);
  });
  Object.values(payload.domainProbes || {}).forEach((probe, index) => {
    if (!String(probe?.answer || '').trim()) return;
    items.push(`Adaptive clarification ${index + 1}${probe.domain ? ` (${probe.domain})` : ''}: ${probe.question || 'Clarifying question'}\n${probe.answer}`);
  });
  (payload.snapshotAnswersArchive || []).forEach((item, index) => {
    if (!String(item?.answer || '').trim()) return;
    items.push(`Snapshot archive ${index + 1}${item.domain ? ` (${item.domain})` : ''}: ${item.question || 'Archived question'}\n${item.answer}`);
  });
  if (payload.scenarioGood || payload.scenarioBad) {
    items.push(`Voice and standards scenario: ${payload.scenarioText || '(scenario text not saved)'}`);
    if (payload.scenarioGood) items.push(`Best/proud reply: ${payload.scenarioGood}`);
    if (payload.scenarioBad) items.push(`Off-brand reply: ${payload.scenarioBad}`);
  }
  return items;
}

function privacyScanText(payload) {
  return answeredItems(payload).join('\n\n').trim();
}

function buildRecoveryPrompt(payload, clientDraftId) {
  const items = answeredItems(payload);
  const context = payload.businessContext ? JSON.stringify(payload.businessContext, null, 2) : 'Not available.';
  const interviewMode = String(payload.intakeVariant || payload.questionSet || '').includes('snapshot')
    ? 'a shorter Snapshot First interview designed to generate a practical free AI Opportunity Snapshot and determine whether deeper diagnosis is warranted'
    : 'a Bridge To AI intake interview';

  return `You are a business analyst for Bridge To AI, an AI implementation consulting firm run by Darren Randles in Alberta, Canada.

This is an ADMIN RECOVERY generation. The client already completed the intake, but the first Venture DNA output was paused by the Privacy Gate before the report files were created. Use only the recovered saved interview payload below. If the saved payload lacks a question label, treat the numbered answer as client-stated evidence but do not invent missing facts.

Create a structured Venture DNA source file that downstream Bridge To AI reports can use. Write clearly, practically, and with evidence discipline. Label major claims as Client-stated, Derived, Inferred, or Needs confirmation.

CLIENT INFORMATION:
Owner Name: ${safeText(payload.clientName)}
Owner Email: ${safeText(payload.clientEmail)}
Business Name: ${safeText(payload.businessName)}
Business Category: ${safeText(payload.businessCategory)}
Specific Niche: ${safeText(payload.businessNiche)}
Website URL: ${safeText(payload.websiteUrl)}
Company Size: ${safeText(payload.companySize)}
Owner Work Status: ${safeText(payload.ownerWorkStatus)}
Departments / Functions: ${Array.isArray(payload.departments) ? payload.departments.join(', ') : safeText(payload.departments)}
Share Comfort: ${safeText(payload.shareComfort)}
Partner: ${safeText(payload.campaignPartner || payload.partner || 'BTAI')}
Campaign: ${safeText(payload.campaignId || payload.campaign || 'general_intake')}
Question Set: ${safeText(payload.questionSet || payload.intakeVariant)}
Record ID: ${clientDraftId}

INTERVIEW MODE:
The client completed ${interviewMode}.

PRIVATE BUSINESS CONTEXT PROFILE:
${context}

RECOVERED INTERVIEW ANSWERS:
${items.length ? items.map((item, index) => `\n### Recovered Evidence ${index + 1}\n${item}`).join('\n') : 'No answer text was recovered from the saved payload.'}

OUTPUT STRUCTURE:
# ${safeText(payload.businessName, 'Client Business')} - VENTURE DNA

Include these sections:
1. Business snapshot
2. What the client appears to sell and to whom
3. Current workflow drag and repeated work
4. Information readiness and cleanup needs
5. AI fit scorecard signals
6. First useful AI opportunity
7. What should stay human-reviewed
8. Safe first prompt or next move
9. Potential deeper-report questions
10. Consultant notes for Darren
11. Evidence map tying recommendations back to recovered answers

Do not claim confidential details were provided unless they appear in the recovered interview. Do not expose sensitive raw details unnecessarily. If a privacy-sensitive category appears only as a boundary, treat it as a human-review boundary rather than an operating detail.`;
}

async function logPrivacyProof(clientDraftId, eventType, status, details = {}) {
  try {
    if (!clientDraftId) return;
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'admin_recovery',
      question_index: null,
      domain: 'BTAI Secure Intelligence Layer',
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        eventType,
        status,
        stage: 'admin_recovery',
        privacyProof: true,
        details: {
          rawInterviewIncluded: false,
          rawDnaIncluded: false,
          partnerRawAccess: false,
          encryptedAtRest: true,
          encryptionAlg: 'AES-256-GCM',
          ...details
        }
      }
    });
  } catch (err) {
    console.error('recovery privacy proof log failed:', err);
  }
}

async function callClaude(messages) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages
    })
  });
  if (!response.ok) throw new Error('Anthropic API call failed: ' + await response.text());
  return response.json();
}

async function saveAnonymizationMapping(clientDraftId, mapping, stats) {
  try {
    const hasMapping = mapping && Object.keys(mapping).length > 0;
    if (!hasMapping) return { saved: false, reason: 'No mapping entries' };
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'hermes_reidentification_map',
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        warning: 'PRIVATE RE-IDENTIFICATION MAP. Do not send this file to third-party AI models.',
        stats,
        mapping
      })
    });
    return { saved: true, fileId: row?.id || '' };
  } catch (err) {
    return { saved: false, reason: err.message };
  }
}

async function savePrivacyGateRecord(clientDraftId, gateResult) {
  try {
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'privacy_gate_admin_recovery_venture_dna_generation',
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        gateVersion: gateResult.gateVersion,
        purpose: gateResult.purpose,
        decision: gateResult.decision,
        requiresReview: gateResult.requiresReview,
        adminRecoveryContinuation: true,
        summary: gateResult.summary,
        proofFindings: gateResult.proofFindings,
        originalHash: gateResult.originalHash,
        sanitizedHash: gateResult.sanitizedHash,
        sanitizedText: gateResult.sanitizedText,
        redactionMap: gateResult.redactionMap
      })
    });
    return { saved: true, outputId: row?.id || '' };
  } catch (err) {
    return { saved: false, reason: err.message };
  }
}

async function saveCompletedDna(clientDraftId, dnaContent, meta = {}) {
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'venture_dna_markdown',
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      dnaContent,
      meta: {
        ...meta,
        retention: retentionMetadata('first_intake')
      }
    })
  });
  await updateIntakeSession(clientDraftId, {
    status: 'complete',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return { saved: true, outputId: row?.id || '' };
}

async function saveClaimTrace(clientDraftId, validation) {
  try {
    if (!clientDraftId || !validation?.claims?.length) return { saved: false, reason: 'No evidence-labelled claims found' };
    await Promise.all(validation.claims.map(claim => insertClaimTrace({
      client_draft_id: clientDraftId,
      report_section: claim.reportSection,
      claim_text: claim.claimText,
      evidence_type: claim.evidenceType,
      source_question_id: '',
      source_excerpt: '',
      confidence: null
    })));
    return { saved: true, count: validation.claims.length };
  } catch (err) {
    return { saved: false, reason: err.message };
  }
}

async function generateRecoveredDna(clientDraftId, payload) {
  const prompt = buildRecoveryPrompt(payload, clientDraftId);
  const sourceMeta = {
    partner: payload.campaignPartner || payload.partner || 'BTAI',
    campaign: payload.campaignId || payload.campaign || 'general_intake',
    partnerDisplayName: payload.partnerDisplayName || '',
    intakeVariant: payload.intakeVariant || '',
    questionSet: payload.questionSet || '',
    businessCategory: payload.businessCategory || '',
    businessNiche: payload.businessNiche || '',
    companySize: payload.companySize || '',
    ownerWorkStatus: payload.ownerWorkStatus || '',
    privacyConsent: !!payload.privacyConsent,
    privacyConsentAt: payload.privacyConsentAt || '',
    privacyPolicyVersion: payload.privacyPolicyVersion || '',
    partnerAggregateDisclosureShown: true,
    partnerAggregateDisclosureAccepted: !!payload.privacyConsent,
    crossBorderProcessingNoticePresented: true,
    serviceProviderPolicyAvailable: true,
    privacyContactPresented: true,
    privacyScanText: privacyScanText(payload),
    adminRecovery: true,
    recoveredFromEncryptedSession: true
  };

  const privacyGate = runPrivacyGate(sourceMeta.privacyScanText || prompt, { purpose: 'admin_recovery_venture_dna_generation' });
  const privacyGateSave = await savePrivacyGateRecord(clientDraftId, privacyGate);
  await logPrivacyProof(clientDraftId, 'admin_recovery_privacy_gate_scan_completed', 'success', gateProofDetails(privacyGate, {
    payloadType: 'recovered_encrypted_session_payload',
    privacyGateOutputId: privacyGateSave.outputId || '',
    adminRecoveryContinuation: true,
    proofStatus: privacyGate.requiresReview ? 'admin_review_continued_with_sanitized_payload' : 'passed'
  }));

  const gatedPrompt = applyPrivacyRedactions(prompt, privacyGate.redactionMap);
  const hermesPrivacy = anonymizePrompt(gatedPrompt);
  const mappingSave = await saveAnonymizationMapping(clientDraftId, hermesPrivacy.mapping, hermesPrivacy.stats);
  await logPrivacyProof(clientDraftId, 'admin_recovery_anonymization_completed', 'success', {
    privacyProofType: 'anonymization',
    payloadType: 'sanitized_recovered_interview_prompt',
    aiPayloadType: 'sanitized_anonymized_business_profile',
    directIdentifiersRemoved: true,
    anonymizationReplacements: hermesPrivacy.stats.replacements || 0,
    mappingFileId: mappingSave.fileId || '',
    proofStatus: 'passed'
  });

  const messages = [{ role: 'user', content: hermesPrivacy.anonymizedPrompt }];
  await logPrivacyProof(clientDraftId, 'admin_recovery_ai_analysis_requested', 'success', {
    privacyProofType: 'ai_analysis',
    payloadType: 'anonymized_recovered_prompt',
    aiPayloadType: 'anonymized_business_profile',
    directIdentifiersRemoved: true,
    proofStatus: 'passed'
  });

  let fullText = '';
  let stopReason = null;
  let passes = 0;
  const MAX_PASSES = 4;
  do {
    const data = await callClaude(messages);
    const piece = data.content?.[0]?.text || '';
    fullText += piece;
    stopReason = data.stop_reason;
    passes++;
    if (stopReason === 'max_tokens' && passes < MAX_PASSES) {
      messages.push({ role: 'assistant', content: piece });
      messages.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already written. Pick up mid-sentence if needed.' });
    } else {
      break;
    }
  } while (passes < MAX_PASSES);

  const truncated = stopReason === 'max_tokens';
  if (truncated) fullText += '\n\n> NOTE TO DARREN: This recovered DNA file reached the maximum generation length. Regenerate or extend manually if a later section is cut.';

  const reidentifiedText = reidentifyText(fullText, hermesPrivacy.mapping);
  const validation = validateDnaOutput(reidentifiedText, sourceMeta);
  const claimTraceSave = await saveClaimTrace(clientDraftId, validation);
  const outputSave = await saveCompletedDna(clientDraftId, reidentifiedText, {
    truncated,
    sourceMeta,
    privacyGate: publicGateSummary(privacyGate),
    anonymizationStats: hermesPrivacy.stats,
    adminRecovery: true,
    validation: {
      ...validation,
      claimTraceSaved: !!claimTraceSave.saved,
      claimTraceCount: claimTraceSave.count || 0,
      claimTraceReason: claimTraceSave.reason || ''
    }
  });
  await logPrivacyProof(clientDraftId, 'admin_recovery_secure_output_storage', 'success', {
    privacyProofType: 'secure_storage',
    outputType: 'venture_dna_markdown',
    outputId: outputSave.outputId || '',
    encryptedAtRest: true,
    proofStatus: 'passed'
  });
  return { dnaContent: reidentifiedText, truncated, secureStorage: outputSave, validation };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'recover-dna', limit: 6, windowMs: 60_000 });
    if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });

    const clientDraftId = String(req.body?.clientDraftId || '').trim();
    if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

    const existing = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
    if (existing && !req.body?.forceRegenerate) {
      return res.status(200).json({
        success: true,
        reusedExisting: true,
        clientDraftId,
        outputId: existing.id,
        createdAt: existing.created_at
      });
    }

    const session = await getIntakeSession(clientDraftId);
    if (!session?.encrypted_payload) return res.status(404).json({ error: 'No encrypted intake session found for that Record ID' });
    const payload = decryptJson(session.encrypted_payload);
    const answerCount = answeredItems(payload).filter(item => wordCount(item) > 0).length;
    if (answerCount < 3) return res.status(409).json({ error: 'Saved intake does not contain enough recovered answers to generate Venture DNA' });

    await logPrivacyProof(clientDraftId, 'admin_recovery_started', 'success', {
      privacyProofType: 'admin_recovery',
      recoveredAnswerCount: answerCount,
      priorSessionStatus: session.status || '',
      forceRegenerate: !!req.body?.forceRegenerate,
      proofStatus: 'started'
    });

    const result = await generateRecoveredDna(clientDraftId, payload);
    return res.status(200).json({
      success: true,
      clientDraftId,
      recoveredAnswerCount: answerCount,
      outputId: result.secureStorage.outputId || '',
      truncated: result.truncated,
      validation: result.validation,
      message: 'Recovered Venture DNA created from the encrypted saved intake. You can now generate the free snapshot and full report pack.'
    });
  } catch (err) {
    console.error('recover-dna error:', err);
    return safeError(res, err, 'Recovery request failed');
  }
}
