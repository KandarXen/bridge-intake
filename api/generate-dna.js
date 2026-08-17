// api/generate-dna.js
// Server-side function that calls Claude to compile the DNA file.
// Keeps the Anthropic API key hidden from the browser.
// Hermes privacy layer: anonymizes obvious identifiers before sending the
// prompt to Claude, then re-identifies the final output before returning it.

import { encryptJson } from '../lib/crypto.js';
import { insertClaimTrace, insertIntakeEvent, insertIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { gateProofDetails, publicGateSummary, runPrivacyGate } from '../lib/privacy-gate.js';
import { validateDnaOutput } from '../lib/validate-output.js';

async function logPrivacyProof(clientDraftId, eventType, status, details = {}) {
  try {
    if (!clientDraftId) return;
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'privacy_proof',
      question_index: null,
      domain: 'BTAI Secure Intelligence Layer',
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        eventType,
        status,
        stage: 'privacy_proof',
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
    console.error('privacy proof log failed:', err);
  }
}

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

async function callClaude(messages) {
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
  if (!response.ok) {
    const error = await response.text();
    throw new Error('Anthropic API call failed: ' + error);
  }
  return response.json();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMapping(map, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!map[placeholder]) map[placeholder] = cleaned;
}

function extractField(prompt, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = prompt.match(re);
  return match ? match[1].trim() : '';
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

  const privacyHeader = `HERMES PRIVACY LAYER ACTIVE:\nThe source interview below has been anonymized before model analysis. Use placeholders exactly as given. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n\n`;

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

async function saveAnonymizationMapping(clientDraftId, mapping, stats) {
  try {
    const hasMapping = mapping && Object.keys(mapping).length > 0;
    if (!hasMapping) return { saved: false, reason: 'No mapping entries' };
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for mapping storage' };

    const business = mapping['[BUSINESS_NAME]'] || 'Client_Business';
    const safeBusiness = business.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const content = {
      createdAt: new Date().toISOString(),
      warning: 'PRIVATE RE-IDENTIFICATION MAP. Do not send this file to third-party AI models.',
      label: `${safeBusiness}_HERMES_PRIVATE_MAPPING_${dateStr}.json`,
      stats,
      mapping
    };

    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'hermes_reidentification_map',
      encrypted_payload: encryptJson(content)
    });
    return { saved: true, fileId: row?.id || '', link: '' };
  } catch (err) {
    console.error('Hermes mapping save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function savePrivacyGateRecord(clientDraftId, gateResult, sourceLabel = 'venture_dna_generation') {
  try {
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for privacy gate storage' };
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: `privacy_gate_${sourceLabel}`,
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        gateVersion: gateResult.gateVersion,
        purpose: gateResult.purpose,
        decision: gateResult.decision,
        requiresReview: gateResult.requiresReview,
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
    console.error('Privacy Gate secure save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function saveCompletedDna(clientDraftId, dnaContent, meta = {}) {
  try {
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for output storage' };
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
  } catch (err) {
    console.error('Completed DNA secure save failed:', err);
    return { saved: false, reason: err.message };
  }
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
    console.error('Claim trace save failed:', err);
    return { saved: false, reason: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, clientDraftId, sourceMeta } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    await logPrivacyProof(clientDraftId, 'privacy_proof_consent_recorded', sourceMeta?.privacyConsent ? 'success' : 'failed', {
      privacyProofType: 'consent',
      privacyConsentAccepted: !!sourceMeta?.privacyConsent,
      privacyConsentAt: sourceMeta?.privacyConsentAt || '',
      privacyPolicyVersion: sourceMeta?.privacyPolicyVersion || '',
      partnerAggregateDisclosureShown: !!sourceMeta?.partnerAggregateDisclosureShown,
      partnerAggregateDisclosureAccepted: !!sourceMeta?.partnerAggregateDisclosureAccepted,
      proofStatus: sourceMeta?.privacyConsent ? 'passed' : 'failed'
    });
    const crossBorderNoticePassed = !!(
      sourceMeta?.crossBorderProcessingNoticePresented &&
      sourceMeta?.serviceProviderPolicyAvailable &&
      sourceMeta?.privacyContactPresented &&
      sourceMeta?.privacyPolicyVersion
    );
    await logPrivacyProof(clientDraftId, 'privacy_proof_cross_border_notice', crossBorderNoticePassed ? 'success' : 'failed', {
      privacyProofType: 'cross_border_notice',
      crossBorderProcessingNoticePresented: !!sourceMeta?.crossBorderProcessingNoticePresented,
      serviceProviderPolicyAvailable: !!sourceMeta?.serviceProviderPolicyAvailable,
      privacyContactPresented: !!sourceMeta?.privacyContactPresented,
      privacyPolicyVersion: sourceMeta?.privacyPolicyVersion || '',
      proofStatus: crossBorderNoticePassed ? 'passed' : 'failed'
    });
    await logPrivacyProof(clientDraftId, 'privacy_proof_retention_policy_recorded', 'success', {
      privacyProofType: 'retention',
      ...retentionMetadata('first_intake'),
      proofStatus: 'passed'
    });
    const privacyGate = runPrivacyGate(prompt, { purpose: 'venture_dna_generation' });
    const privacyGateSave = await savePrivacyGateRecord(clientDraftId, privacyGate, 'venture_dna_generation');
    await logPrivacyProof(clientDraftId, 'privacy_gate_scan_completed', privacyGateSave.saved ? 'success' : 'failed', gateProofDetails(privacyGate, {
      payloadType: 'raw_interview_prompt',
      privacyGateOutputId: privacyGateSave.outputId || '',
      privacyGateSaveReason: privacyGateSave.reason || '',
      proofStatus: privacyGateSave.saved ? (privacyGate.requiresReview ? 'review_required' : 'passed') : 'failed'
    }));

    if (privacyGate.requiresReview) {
      if (clientDraftId) {
        await updateIntakeSession(clientDraftId, {
          status: 'privacy_review_required',
          updated_at: new Date().toISOString()
        });
      }
      await logPrivacyProof(clientDraftId, 'privacy_gate_quarantine_created', 'success', gateProofDetails(privacyGate, {
        payloadType: 'raw_interview_prompt',
        aiPayloadBlocked: true,
        aiReceivesSanitizedPayloadOnly: false,
        proofStatus: 'review_required'
      }));
      return res.status(409).json({
        error: 'Privacy review required',
        message: 'The interview appears to include sensitive information. The encrypted original has been preserved, a sanitized payload was created, and AI generation has been paused for Bridge To AI review.',
        privacyGate: publicGateSummary(privacyGate),
        secureStorage: {
          saved: !!privacyGateSave.saved,
          outputId: privacyGateSave.outputId || '',
          reason: privacyGateSave.reason || ''
        }
      });
    }

    const hermesPrivacy = anonymizePrompt(privacyGate.sanitizedText);
    await logPrivacyProof(clientDraftId, 'privacy_proof_anonymization_completed', 'success', {
      privacyProofType: 'anonymization',
      payloadType: 'sanitized_interview_prompt',
      aiPayloadType: 'sanitized_anonymized_business_profile',
      privacyGateVersion: privacyGate.gateVersion,
      privacyGateDecision: privacyGate.decision,
      sanitizedAiPayloadCreated: true,
      directIdentifiersRemoved: true,
      anonymizationReplacements: hermesPrivacy.stats.replacements || 0,
      proofStatus: 'passed'
    });
    const mappingSave = await saveAnonymizationMapping(clientDraftId, hermesPrivacy.mapping, hermesPrivacy.stats);
    await logPrivacyProof(clientDraftId, 'privacy_proof_mapping_storage', mappingSave.saved ? 'success' : 'info', {
      privacyProofType: 'reidentification_map',
      piiMappingStoredEncrypted: !!mappingSave.saved,
      mappingFileId: mappingSave.fileId || '',
      proofStatus: mappingSave.saved ? 'passed' : 'not_required',
      note: mappingSave.reason || ''
    });
    const messages = [{ role: 'user', content: hermesPrivacy.anonymizedPrompt }];
    await logPrivacyProof(clientDraftId, 'privacy_proof_ai_analysis_requested', 'success', {
      privacyProofType: 'ai_analysis',
      payloadType: 'anonymized_prompt',
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
      const piece = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
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

    const truncated = (stopReason === 'max_tokens');
    if (truncated) {
      fullText += '\n\n> NOTE TO DARREN: This DNA file reached the maximum generation length. The content above is complete through where it stops; regenerate or extend manually if a later section is cut.';
    }

    const reidentifiedText = reidentifyText(fullText, hermesPrivacy.mapping);
    const validation = validateDnaOutput(reidentifiedText, sourceMeta || {});
    const claimTraceSave = await saveClaimTrace(clientDraftId, validation);
    const outputSave = await saveCompletedDna(clientDraftId, reidentifiedText, {
      truncated,
      sourceMeta: sourceMeta || {},
      privacyGate: publicGateSummary(privacyGate),
      anonymizationStats: hermesPrivacy.stats,
      validation: {
        ...validation,
        claimTraceSaved: !!claimTraceSave.saved,
        claimTraceCount: claimTraceSave.count || 0,
        claimTraceReason: claimTraceSave.reason || ''
      }
    });
    await logPrivacyProof(clientDraftId, 'privacy_proof_secure_output_storage', outputSave.saved ? 'success' : 'failed', {
      privacyProofType: 'secure_storage',
      outputType: 'venture_dna_markdown',
      encryptedAtRest: !!outputSave.saved,
      encryptionAlg: 'AES-256-GCM',
      rawDnaIncluded: false,
      partnerRawAccess: false,
      claimTraceSaved: !!claimTraceSave.saved,
      proofStatus: outputSave.saved ? 'passed' : 'failed',
      error: outputSave.reason || ''
    });

    return res.status(200).json({
      dnaContent: reidentifiedText,
      truncated,
      secureStorage: {
        saved: !!outputSave.saved,
        outputId: outputSave.outputId || '',
        reason: outputSave.reason || '',
        validation: {
          ...validation,
          claimTraceSaved: !!claimTraceSave.saved,
          claimTraceCount: claimTraceSave.count || 0,
          claimTraceReason: claimTraceSave.reason || ''
        }
      },
      hermesPrivacy: {
        anonymized: true,
        stats: hermesPrivacy.stats,
        mappingSaved: !!mappingSave.saved,
        mappingSaveReason: mappingSave.reason || '',
        mappingFileId: mappingSave.fileId || ''
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}

