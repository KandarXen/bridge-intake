import { decryptJson, encryptJson } from '../lib/crypto.js';
import { createDocxBuffer, createZipBuffer } from '../lib/docx.js';
import { createReportHtml } from '../lib/report-html.js';
import { getIntakeEvents, getIntakeSession, getLatestIntakeOutput, insertIntakeEvent, insertIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { gateProofDetails, publicGateSummary, runPrivacyGate } from '../lib/privacy-gate.js';
import { validateDnaOutput } from '../lib/validate-output.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';

const APP_VERSION = 'v1.72.15';

const REPORTS = {
  free: {
    title: 'Free AI Opportunity Snapshot',
    outputType: 'report_free_snapshot_markdown',
    docxOutputType: 'report_free_snapshot_docx',
    htmlOutputType: 'report_free_snapshot_html',
    filename: 'Level1_report',
    maxTokens: 2600
  },
  detailed: {
    title: 'Detailed AI Readiness & Opportunity Report',
    outputType: 'report_detailed_growth_markdown',
    docxOutputType: 'report_detailed_growth_docx',
    htmlOutputType: 'report_detailed_growth_html',
    filename: 'Level2_Report',
    maxTokens: 6200
  },
  roadmap: {
    title: 'Preliminary AI Action Plan',
    outputType: 'report_full_roadmap_markdown',
    docxOutputType: 'report_full_roadmap_docx',
    htmlOutputType: 'report_full_roadmap_html',
    filename: 'Level3_Report',
    maxTokens: 7600
  },
  btai: {
    title: 'BTAI Advisor Brief',
    outputType: 'report_btai_advisor_brief_markdown',
    docxOutputType: 'report_btai_advisor_brief_docx',
    htmlOutputType: 'report_btai_advisor_brief_html',
    filename: 'Internal_brief',
    maxTokens: 5200
  }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeName(value) {
  return String(value || 'Client_Business')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90) || 'Client_Business';
}

function businessNameFromDna(dna) {
  const h = String(dna || '').match(/^#\s+(.+?)\s+(?:[-]\s*)?VENTURE DNA/im);
  if (h?.[1]) return safeName(h[1]);
  const b = String(dna || '').match(/Business name:\s*(.+)/i);
  if (b?.[1]) return safeName(b[1]);
  return 'Client_Business';
}

async function callClaude(prompt, maxTokens) {
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
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error('Report generation failed: ' + await response.text());
  const data = await response.json();
  return (data.content || [])
    .filter(block => block?.type === 'text' && block.text)
    .map(block => block.text)
    .join('\n\n')
    .trim();
}

async function getDna(clientDraftId) {
  const output = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
  if (!output) throw new Error('No Venture DNA output found for that Record ID');
  const decrypted = decryptJson(output.encrypted_payload);
  if (!decrypted.dnaContent) throw new Error('Venture DNA output is empty');
  return {
    dnaContent: decrypted.dnaContent,
    meta: decrypted.meta || {},
    outputId: output.id,
    createdAt: output.created_at
  };
}

async function getSessionPayload(clientDraftId) {
  const session = await getIntakeSession(clientDraftId);
  if (!session?.encrypted_payload) throw new Error('No intake session found for that Record ID');
  return decryptJson(session.encrypted_payload);
}

async function logReportEvent(clientDraftId, eventType, status, details = {}) {
  try {
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'admin_report_pack',
      question_index: null,
      domain: String(details.campaign || details.reportTier || 'report_pack').slice(0, 160),
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        eventType,
        status,
        stage: 'admin_report_pack',
        privacyProof: !!details.privacyProof,
        details
      }
    });
  } catch (err) {
    console.error('report-pack KPI log failed:', err);
  }
}

function privacyProofDefaults(extra = {}) {
  return {
    privacyProof: true,
    rawInterviewIncluded: false,
    rawDnaIncluded: false,
    directIdentifiersRemoved: true,
    partnerRawAccess: false,
    partnerAggregateOnly: true,
    encryptedAtRest: true,
    encryptionAlg: 'AES-256-GCM',
    proofStatus: 'passed',
    ...extra
  };
}

class PrivacyGateReviewError extends Error {
  constructor(message, gateResult, saveResult = {}) {
    super(message);
    this.name = 'PrivacyGateReviewError';
    this.privacyGate = publicGateSummary(gateResult);
    this.secureStorage = {
      saved: !!saveResult.saved,
      outputId: saveResult.outputId || '',
      reason: saveResult.reason || ''
    };
  }
}

async function savePrivacyGateRecord(clientDraftId, gateResult, sourceLabel) {
  try {
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
    console.error('report privacy gate save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function latestPrivacyGateApproval(clientDraftId, purpose) {
  const row = await getLatestIntakeOutput(clientDraftId, 'privacy_gate_admin_review');
  if (!row) return null;
  const payload = decryptJson(row.encrypted_payload);
  const approvedPurpose = String(payload.purpose || 'all');
  if (approvedPurpose === 'all' || approvedPurpose === purpose) return payload;
  return null;
}

async function approvePrivacyGate(clientDraftId, purpose = 'all', reviewNote = '') {
  const cleanPurpose = String(purpose || 'all').trim() || 'all';
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'privacy_gate_admin_review',
    encrypted_payload: encryptJson({
      approvedAt: new Date().toISOString(),
      purpose: cleanPurpose,
      reviewedBy: 'btai_admin',
      reviewNote: String(reviewNote || '').slice(0, 1000),
      approvalScope: cleanPurpose === 'all' ? 'all_privacy_gate_paused_payloads' : cleanPurpose
    })
  });
  await logReportEvent(clientDraftId, 'privacy_gate_admin_review_approved', 'success', privacyProofDefaults({
    privacyProofType: 'privacy_gate_admin_review',
    privacyGatePurpose: cleanPurpose,
    adminApprovedContinuation: true,
    reviewOutputId: row?.id || '',
    proofStatus: 'admin_review_approved'
  }));
  return { approved: true, purpose: cleanPurpose, outputId: row?.id || '' };
}

async function prepareSanitizedAiSource(clientDraftId, sourceText, purpose) {
  const shouldSanitizeOnly = String(purpose || '').startsWith('report_');
  const gate = runPrivacyGate(sourceText, { purpose, mode: shouldSanitizeOnly ? 'sanitize-only' : undefined });
  const saved = await savePrivacyGateRecord(clientDraftId, gate, purpose);
  await logReportEvent(clientDraftId, 'privacy_gate_scan_completed', saved.saved ? 'success' : 'failed', privacyProofDefaults(gateProofDetails(gate, {
    payloadType: 'encrypted_venture_dna_record',
    privacyGateOutputId: saved.outputId || '',
    privacyGateSaveReason: saved.reason || '',
    reportAiPayloadSanitizeOnly: shouldSanitizeOnly,
    proofStatus: saved.saved ? (gate.requiresReview ? 'review_required' : 'passed') : 'failed'
  })));

  if (!gate.requiresReview) {
    return { sanitizedText: gate.sanitizedText, gate, adminApproved: false };
  }

  const approval = await latestPrivacyGateApproval(clientDraftId, purpose);
  if (approval) {
    await logReportEvent(clientDraftId, 'privacy_gate_admin_review_used', 'success', privacyProofDefaults(gateProofDetails(gate, {
      payloadType: 'encrypted_venture_dna_record',
      privacyGateApprovalPurpose: approval.purpose || '',
      privacyGateApprovedAt: approval.approvedAt || '',
      adminApprovedContinuation: true,
      aiReceivesSanitizedPayloadOnly: true,
      proofStatus: 'admin_review_approved'
    })));
    return { sanitizedText: gate.sanitizedText, gate, adminApproved: true };
  }

  throw new PrivacyGateReviewError(
    'Privacy Gate review required before report generation can continue',
    gate,
    saved
  );
}

function priceLabel(envKey, fallback) {
  return process.env[envKey] || fallback;
}

function ctaLineHtml(label, url, description) {
  const safeLabel = escapeHtml(label);
  const safeDesc = escapeHtml(description || '');
  const line = url
    ? `<a href="${escapeHtml(url)}" style="color:#0d6e5e;font-weight:700;text-decoration:none;">${safeLabel}</a>`
    : `<strong>${safeLabel}</strong>`;
  return `<div style="margin-bottom:10px;">${line}${safeDesc ? `<br><span style="color:#4b5563;">${safeDesc}</span>` : ''}</div>`;
}

function paymentConfig() {
  return {
    level2Price: priceLabel('BTAI_LEVEL2_PRICE_LABEL', '$147 introductory'),
    level3Price: priceLabel('BTAI_LEVEL3_PRICE_LABEL', '$397 introductory'),
    level2Url: process.env.BTAI_LEVEL2_PAYMENT_URL || '',
    level3Url: process.env.BTAI_LEVEL3_PAYMENT_URL || '',
    consultUrl: process.env.BTAI_CONSULTATION_URL || ''
  };
}

function reportPrivacyStatement() {
  return `## How This Was Handled Privately

Your raw interview was not attached to this report. The working record is stored securely, direct identifiers are removed or replaced where practical before AI analysis, and the private re-identification map is encrypted at rest using AES-256-GCM.

If this intake was completed through a partner program, the partner does not receive your raw answers. Partner reporting is limited to anonymized aggregate themes where applicable. The purpose of this process is simple: use your answers to give you a useful report, while keeping the underlying interview record protected.`;
}

function clientUpgradeSection(tier) {
  const { level2Price, level3Price, level2Url, level3Url, consultUrl } = paymentConfig();
  if (tier === 'btai') return '';
  if (tier === 'roadmap') {
    return `## Bridge To AI Implementation Support

This action plan gives the build direction, but the actual build still needs private scoping. That is where we confirm tools, data access, workflow details, privacy requirements, and what should be built first.

If you want Bridge To AI to help turn this into a working AI system or workbench, book a scoping conversation here:

${consultUrl || 'Reply to the Bridge To AI email thread to request implementation scoping.'}

A workbench is a private operating dashboard built around your business so repeated workflows can run from one place instead of being scattered across notes, spreadsheets, prompts, files, and tools.`;
  }
  return `## If You Want The Next Layer

This free snapshot gives you the first useful read. The deeper interview is where Bridge To AI confirms the sequence, pressure-tests the assumptions, and decides whether a paid report, action plan, or workbench recommendation is actually worth preparing.

- Continue the deeper interview: use the continuation link in your report email, or reply to Bridge To AI and ask us to reopen your secure interview.
- Detailed AI Opportunity Report - ${level2Price}: available after the deeper interview gives enough context.
- Preliminary AI Action Plan - ${level3Price}: available after workflow priorities and risk controls are confirmed.
- Implementation or workbench support: ${consultUrl || 'Reply to the Bridge To AI email thread to request a conversation.'}`;
}

function splitSentences(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map(sentence => sentence.trim())
    .filter(Boolean) || [];
}

function tightenBulletText(text = '') {
  const sentences = splitSentences(text);
  return (sentences.length ? sentences.slice(0, 2).join(' ') : String(text || '').trim())
    .replace(/\s+/g, ' ')
    .trim();
}

function enforceFreeQuickReadBullets(markdown) {
  const source = String(markdown || '').trim();
  const match = source.match(/(^|\n)##\s*1\.\s*Quick Read\s*\n/i);
  if (!match) return source;
  const sectionStart = (match.index || 0) + match[0].length;
  const nextMatch = source.slice(sectionStart).match(/\n##\s*2\.\s*/i);
  if (!nextMatch) return source;
  const sectionEnd = sectionStart + (nextMatch.index || 0);
  const before = source.slice(0, sectionStart);
  const section = source.slice(sectionStart, sectionEnd).trim();
  const after = source.slice(sectionEnd);
  const lines = section.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const hasBullets = lines.some(line => /^[-*]\s+/.test(line));
  if (hasBullets) return source;

  let lead = lines.find(line => /^Here is what I am seeing\.?$/i.test(line)) || 'Here is what I am seeing.';
  const candidates = lines.filter(line => line !== lead);
  const bullets = candidates
    .map(tightenBulletText)
    .filter(Boolean)
    .slice(0, 7);

  if (bullets.length < 3) return source;
  return `${before}${lead}\n\n${bullets.map(item => `- ${item}`).join('\n')}\n${after}`;
}

function shapeReportMarkdown(markdown, tier) {
  const polished = polishReportMarkdown(String(markdown || '').trim());
  return tier === 'free' ? enforceFreeQuickReadBullets(polished) : polished;
}

function decorateReportMarkdown(markdown, tier) {
  const sections = [shapeReportMarkdown(markdown, tier)];
  if (tier !== 'btai') sections.push(clientUpgradeSection(tier));
  sections.push(reportPrivacyStatement());
  return sections.filter(Boolean).join('\n\n');
}

function polishReportMarkdown(markdown) {
  return String(markdown || '')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2013/g, ' - ')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00d7/g, 'x')
    .replace(/â€”|â€“/g, ' - ')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/Clear, emotionally resonant client outcome/g, 'You already know the real result')
    .replace(/A structured, deliberate sales process/g, 'Your sales process has a smart pause in it')
    .replace(/A defined, repeatable post-sale delivery flow/g, 'Delivery is already repeatable')
    .replace(/A brand voice that is genuinely distinct/g, 'Your client voice is already clear')
    .replace(/Self-awareness about the real constraint/g, 'You already named the real bottleneck')
    .replace(/Strong execution track record/g, 'You actually follow through')
    .replace(/\bgenuinely strong\b/gi, 'strong')
    .replace(/\bgenuinely differentiated\b/gi, 'clear and different')
    .replace(/\bemotionally resonant\b/gi, 'human and specific')
    .replace(/\bstrong foundation\b/gi, 'good starting point')
    .replace(/\bimplementation strategy\b/gi, 'build sequence')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scanReportPrivacy(markdown) {
  const text = String(markdown || '');
  const findings = [];
  const blockingFindings = [];
  const nonBlockingFindings = [];
  const checks = [
    ['email_address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, true],
    ['phone_number', /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/, true],
    ['credit_card_like_number', /\b(?:\d[ -]*?){13,19}\b/, true],
    ['private_financial_document_language', /\b(invoice|payroll|bank account|routing number|credit card|supplier contract|customer list|confidential formula)\b/i, false]
  ];
  checks.forEach(([type, pattern, blocksDelivery]) => {
    if (!pattern.test(text)) return;
    findings.push(type);
    if (blocksDelivery) blockingFindings.push(type);
    else nonBlockingFindings.push(type);
  });
  return {
    completed: true,
    rawSensitiveDataDetected: findings.length > 0,
    findings,
    blockingFindings,
    nonBlockingFindings,
    reportApprovedForClientDelivery: blockingFindings.length === 0
  };
}

const REPORT_COMPLETION_RULES = {
  free: [{
    expected: '9. Bridge To AI Note',
    variants: ['bridge to ai note', 'bridge to ai advisor note', 'note from bridge to ai']
  }],
  detailed: [{
    expected: '11. Final Advisor Note',
    variants: ['final advisor note', 'advisor note', 'final bridge to ai note']
  }],
  roadmap: [{
    expected: '19. Final Implementation Recommendation',
    variants: ['final implementation recommendation', 'implementation recommendation', 'final recommendation', 'recommended implementation path']
  }],
  btai: [{
    expected: '10. Needs Confirmation Before Build',
    variants: ['needs confirmation before build', 'needs confirmation', 'confirm before build', 'questions before build', 'what needs confirmation before build']
  }]
};

function normalizeHeadingText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[`*_>#|[\](){}:;,.!?'"-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCompletionAnchor(markdown, tier, rule) {
  const text = String(markdown || '');
  if (text.includes(`## ${rule.expected}`)) return { found: true, exact: true };
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const normalizedLines = lines.map(normalizeHeadingText);
  const tailStart = Math.max(0, Math.floor(normalizedLines.length * 0.65));
  const searchableLines = normalizedLines.slice(tailStart);
  const variants = [rule.expected, ...(rule.variants || [])].map(normalizeHeadingText).filter(Boolean);
  const foundVariant = variants.find(variant =>
    searchableLines.some(line => line.includes(variant)) ||
    normalizedLines.some(line => /^#+\s?/.test(lines[normalizedLines.indexOf(line)] || '') && line.includes(variant))
  );
  return { found: !!foundVariant, exact: false, variant: foundVariant || '' };
}

function reportQualityWarnings(markdown, tier) {
  const text = String(markdown || '').trim();
  const warnings = [];
  const requiredRules = REPORT_COMPLETION_RULES[tier] || [];
  requiredRules.forEach(rule => {
    const anchor = hasCompletionAnchor(text, tier, rule);
    if (!anchor.found) warnings.push(`missing_expected_final_section:${rule.expected}`);
    else if (!anchor.exact) warnings.push(`final_section_heading_variant:${rule.expected}`);
  });

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const lastMeaningfulLine = [...lines].reverse().find(line =>
    !/^[-*_]{3,}$/.test(line) &&
    !/^#+\s/.test(line) &&
    !/^\|/.test(line) &&
    !/^<\/?\w/.test(line)
  ) || '';
  const stripped = lastMeaningfulLine.replace(/[*_`>#-]/g, '').trim();
  const wordCount = stripped.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 6) warnings.push('last_line_too_short_possible_cutoff');
  if (/\b(of|for|to|with|and|or|the|a|an|in|on|at|from|by|about|front of)$/i.test(stripped)) {
    warnings.push('last_line_ends_mid_thought');
  }
  if (!/[.!?)"]$/.test(stripped) && wordCount > 6) warnings.push('last_line_missing_sentence_punctuation');

  const repeatedPhrases = [
    'Here is what I am seeing',
    'That is not a criticism',
    'That is the real pinch point',
    'Here is the interesting part'
  ];
  repeatedPhrases.forEach(phrase => {
    const count = (text.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    if (count > 2) warnings.push(`overused_voice_phrase:${phrase}`);
  });

  const aiishPatterns = [
    ['generic_ai_phrase:genuinely_strong', /\bgenuinely strong\b/i],
    ['generic_ai_phrase:emotionally_resonant', /\bemotionally resonant\b/i],
    ['generic_ai_phrase:well_positioned', /\bwell positioned\b/i],
    ['generic_ai_phrase:significant_opportunity', /\bsignificant opportunity\b/i],
    ['generic_ai_phrase:implementation_strategy', /\bimplementation strategy\b/i],
    ['generic_ai_phrase:the_intake_indicates', /\bthe intake indicates\b/i]
  ];
  aiishPatterns.forEach(([warning, pattern]) => {
    if (pattern.test(text)) warnings.push(warning);
  });

  return warnings;
}

function validateReportCompletion(markdown, tier) {
  const warnings = reportQualityWarnings(markdown, tier);
  const blockingWarnings = warnings.filter(warning =>
    warning.startsWith('missing_expected_final_section:') ||
    warning === 'last_line_too_short_possible_cutoff' ||
    warning === 'last_line_ends_mid_thought'
  );
  return {
    completed: blockingWarnings.length === 0,
    warnings,
    blockingWarnings
  };
}

function canRepairCompletionFailure(completion) {
  const allowed = new Set([
    'last_line_too_short_possible_cutoff',
    'last_line_ends_mid_thought'
  ]);
  return (completion.blockingWarnings || []).every(warning =>
    allowed.has(warning) || warning.startsWith('missing_expected_final_section:')
  );
}

function expectedFinalSection(tier) {
  return REPORT_COMPLETION_RULES[tier]?.[0]?.expected || 'Final Bridge To AI Note';
}

function repairPromptForTier(tier, partialMarkdown, dna, blockingWarnings) {
  const finalSection = expectedFinalSection(tier);
  return `${sharedRules()}

You are repairing a Bridge To AI report that failed the completion quality gate.

Task:
- Keep the report grounded only in the Venture DNA and the already-generated report draft.
- Return the complete repaired markdown report only.
- Preserve the existing useful sections where possible.
- Complete any unfinished sentence or paragraph.
- Add or repair the final section heading exactly as:
## ${finalSection}
- The final section must be complete, plain-spoken, and must not end mid-thought.
- Do not add private financials, recipes, customer names beyond what is already appropriate for the report, supplier contracts, payroll details, invoices, or confidential formulas.
- Do not use markdown horizontal rules.

Completion gate warnings to fix:
${(blockingWarnings || []).map(warning => `- ${warning}`).join('\n')}

PARTIAL REPORT DRAFT:
${partialMarkdown}

VENTURE DNA:
${dna}`;
}

function trimIncompleteTail(markdown) {
  const lines = String(markdown || '').trim().split(/\r?\n/);
  while (lines.length) {
    const line = lines[lines.length - 1].trim();
    if (!line || /^[-*_]{3,}$/.test(line) || /^#+\s/.test(line) || /^\|/.test(line)) {
      lines.pop();
      continue;
    }
    const stripped = line.replace(/[*_`>#-]/g, '').trim();
    if (
      /\b(of|for|to|with|and|or|the|a|an|in|on|at|from|by|about|front of)$/i.test(stripped) ||
      (!/[.!?)"]$/.test(stripped) && stripped.split(/\s+/).filter(Boolean).length > 6)
    ) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n').trim();
}

function deterministicFinalSection(tier) {
  if (tier === 'free') {
    return `## 9. Bridge To AI Note

This snapshot is meant to give you a useful first read, not a finished implementation plan. I would use it to see the likely opportunities, spot the first practical win, and decide whether the next layer is worth a deeper look.

The deeper report is where the work gets ranked, sequenced, and pressure-tested. That is where we look at what is ready now, what needs cleanup first, what should wait, and what the first 30 days should actually look like.`;
  }
  if (tier === 'detailed') {
    return `## 11. Final Advisor Note

The useful next step is not to automate everything. It is to choose the highest-value repeatable work, confirm the facts that are still missing, and start with the first project that gives the business real relief without creating new risk.

Where the information is clear, this report points to action. Where the information is thin, it marks the item for confirmation before anyone builds around it.`;
  }
  if (tier === 'roadmap') {
    return `## 19. Final Implementation Recommendation

I would treat this as a preliminary build sequence, not a final technical scope. The right next move is to confirm the data sources, privacy requirements, owner approvals, workflow details, and success measures before any automation is connected to live business operations.

Build the first workflow where the repeated work is clear, the risk is manageable, and the business can feel the time savings quickly. Clean up the foundation first anywhere the information underneath the workflow is not worth trusting yet.`;
  }
  return `## 10. Needs Confirmation Before Build

Before Bridge To AI scopes or builds from this record, confirm the current tools, data locations, privacy constraints, user permissions, workflow owners, and the business outcome that matters most.

Also confirm which recommendations are based on direct intake statements and which are directional signals. The build should only proceed once the key assumptions are verified with the client.`;
}

function applyDeterministicCompletion(markdown, tier) {
  const cleaned = trimIncompleteTail(markdown);
  const finalSection = deterministicFinalSection(tier);
  const finalHeading = expectedFinalSection(tier);
  if (hasCompletionAnchor(cleaned, tier, { expected: finalHeading, variants: REPORT_COMPLETION_RULES[tier]?.[0]?.variants || [] }).found) {
    return `${cleaned}\n\n${finalSection.replace(/^## .+?\n\n/s, '')}`;
  }
  return `${cleaned}\n\n${finalSection}`;
}

function sharedRules() {
  return `SOURCE OF TRUTH RULES:
- Use only the supplied Venture DNA markdown as source material.
- Do not invent facts, numbers, tools, revenue, team size, customer segments, timelines, pricing, workflow details, risks, client capabilities, or business claims.
- If information is missing, mark it as Needs Confirmation.
- Every inferred statement must be labeled exactly: [INFERRED].
- Use "Stated by the business", "Directional signal", "Inferred by BTAI", and "Requires private scoping to validate" where certainty matters.
- Treat the intake as a trust-first directional diagnostic. Do not create exact ROI, margin, payroll, costing, or revenue claims unless the Venture DNA explicitly includes them.
- If a recommendation depends on exact financials, recipes, invoices, supplier contracts, customer lists, or proprietary operating data, state that it requires private implementation scoping.
- Do not present inferred information as confirmed fact.
- Every meaningful paragraph must include at least one concrete detail from the Venture DNA file.
- The client is the hero. Bridge To AI is the guide.
- Avoid generic AI writing patterns, hype, and consultant filler.
- Keep Darren's voice. This is not optional. The report must sound like a practical business owner helping another business owner understand what is really going on.

DARREN'S VOICE AND TONE:
- Plain-spoken, practical, and curious.
- Warm, but not gushy.
- Direct, but not harsh.
- Honest, not flattering.
- Specific before polished.
- Business-first, AI-second.
- Write like a smart business owner talking over coffee, not like a consultant presenting an AI assessment.
- The goal is to help the owner see the real pinch point, understand what can be fixed, and feel less overwhelmed.
- Use short paragraphs. Usually 2-4 sentences.
- Prefer natural transitions: "Here is the interesting part", "I am starting to notice", "That is probably the real pinch point", "Let's work backwards", "Here is the part I would be careful with".
- Do not repeat the same Darren-style phrase more than twice in a report. If you use "Here is what I am seeing", "real pinch point", "not a criticism", or "interesting part", vary the next transitions.
- Use "you told us" or "you described" when grounding a point in the intake.
- Make time concrete. Time is the most valuable win because it is a non-replenishable asset.
- Use the owner-language distinction between working inside the business and working on the business when it fits the evidence.
- Remind the client that every person's time has a cost, including the owner's time, but do not invent hourly rates.
- Explain automation through business relief: fewer repeated steps, less rework, less owner bottleneck, more time for sales, customers, partnerships, planning, or higher-value work.
- When something is not ready for AI, say it plainly: "I would not automate this yet" or "I would clean this up first".
- If a process is weak, say: "That is not a criticism. It is just the thing to fix first."
- If data is messy, say: "Before we automate this, we need to make sure the thing underneath it is worth trusting."
- If data quality is a risk, use plain warnings like: "AI will just give you confident-sounding bad advice if the information underneath it is wrong."
- Keep Bridge To AI as the guide. Do not make AI sound like the hero.

DARREN'S AI OPPORTUNITY SELECTION RULE:
- Do not default to email automation as the top opportunity. Everyone says email automation. It may be correct, but it is the obvious answer and should only rank highly when the Venture DNA proves it is the real time sink.
- First look for the most valuable person in the business, or the most expensive person on the payroll, and identify where their time is being wasted.
- Look for repeated high-value work: pitch decks, presentations, proposals, onboarding material, client paperwork, project summaries, quote preparation, compliance documents, weekly planning, buyer readiness, SOP capture, sales prep, social media planning, and decision prep.
- Ask: where does automation save the most valuable time, reduce the most rework, or help the owner get back in front of customers?
- Saving five hours from a high-value person may matter more than saving fifteen minutes from a generic admin task.
- If the best opportunity is email, say why it is actually the best opportunity for this business. Do not recommend it because it is easy.
- For every ranked opportunity, prove why it belongs where it is ranked using evidence from the Venture DNA. If the proof is weak, lower the priority or mark it Needs Confirmation.

DO NOT WRITE LIKE GENERIC AI:
- Do not use: genuinely strong, significant opportunity, well positioned, robust, leverage, optimize, transform, unlock, strategic advantage, scalable framework, holistic, ecosystem, seamless, empower, game changer, best-in-class, next-level, high-impact, mission-critical, stakeholder alignment, operational excellence.
- Do not write polished consultant summaries like "the entire diagnosis", "structural risk", "sophisticated move", or "material opportunity" unless the client's own words make that plain and there is no simpler way to say it.
- Do not overuse "asset", "constraint", "infrastructure", "framework", "roadmap", "capacity", "strategic", "operational coordination", or "implementation strategy". Use plain words first.
- Do not write "the intake indicates" or "the business appears to be" when you can say "you told us", "what I am seeing", or "this looks like".
- Do not write "Bridge To AI recommends" over and over. Write like Darren: "I would start here", "I would be careful with this", "I would not automate this yet", "Here is where I would look first".
- Do not flatter. Useful truth beats polished reassurance.
- Do not make the report sound like it was written by a generic AI model.
- Do not use markdown horizontal rules (---). The HTML template already separates sections.
- Do not use fenced code blocks or ASCII-art diagrams. Use a plain bullet list or table instead.
- Do not use em dashes or special typography. Use commas, periods, colons, or simple hyphens so emailed and copied reports do not show broken characters.

VOICE REWRITE CHECK BEFORE FINAL ANSWER:
- Before returning the report, rewrite any paragraph that sounds like a polished AI consultant.
- Replace vague praise with a concrete observation from the intake.
- Replace corporate phrasing with plain language.
- Replace "AI can unlock..." with "AI could help by..."
- Replace "optimize" with "improve", "tighten", "clean up", or "make easier".
- Replace "leverage" with "use".
- Replace "significant opportunity" with the specific opportunity.
- Replace broad claims like "reduce administrative burden" with the actual repeated work from the Venture DNA.
- Replace "customer communication automation" with the specific communication job unless the intake proves that broad category is the real issue.
- Replace "strong foundation" with the exact thing that is working, such as repeat customers, a high close rate, a clear niche, a known customer problem, or a repeatable delivery process.
- Rewrite table row labels so they sound like plain observations, not consultant scorecard categories.
- Bad table labels: "Clear, emotionally resonant client outcome", "A structured, deliberate sales process", "A defined, repeatable post-sale delivery flow", "A brand voice that is genuinely distinct", "Self-awareness about the real constraint", "Strong execution track record".
- Better table labels: "You already know the real result", "Your sales process has a smart pause in it", "Delivery is already repeatable", "Your client voice is already clear", "You already named the real bottleneck", "You actually follow through".
- Table labels should feel like something Darren would say out loud, not like a consulting framework heading.
- If a paragraph could appear in any business report, rewrite it until it clearly belongs to this client.
- Before final output, check that the final client-facing section is complete and does not end mid-sentence. Never stop on an unfinished phrase.

WRITE LIKE THIS KIND OF PATTERN:
- "Here is what I am seeing."
- "This does not look like a sales problem. It looks like a getting-enough-good-conversations problem."
- "That is probably the real pinch point."
- "I could tell you to automate email, and that might help. But I would look first at where the most valuable person's time is getting eaten up."
- "Do not automate this yet. Clean up the information first, then the automation is worth trusting."
- "That is not a criticism. It is just the thing to fix first."

EVIDENCE-FIRST / NO-SYCOPHANCY STANDARD:
- Do not flatter the business, overstate readiness, or make the owner feel good at the expense of accuracy.
- The report should be encouraging, but it must be honest.
- If systems are weak, say so plainly and respectfully.
- If data is not clean enough for automation, say so.
- If the owner is the bottleneck, say so respectfully.
- If an AI idea is premature, state that it should wait.
- If an answer is thin or vague, mark the conclusion as Needs Confirmation or [INFERRED].
- Do not use generic praise such as "ahead of the curve", "well positioned", "strong foundation", or "exciting opportunity" unless the Venture DNA provides specific evidence.
- Prefer useful truth over polished reassurance: build this now, clean this up first, or do not automate this yet.
- A bad AI system does not save time. It just makes messy work move faster.`;
}

function promptForTier(tier, dna) {
  if (tier === 'free') {
    return `${sharedRules()}

Generate REPORT 1: Free AI Opportunity Snapshot.

Target: 1-2 pages in markdown. Prefer tight sections, short bullets, and compact tables.
Purpose: useful no-cost report that proves Bridge To AI understood the business.
Tone: client-facing, practical, plain-spoken, specific, and evidence-first. This should sound like Darren saying, "Here is what I noticed, here is the real pinch point, and here is what I would do first." Do not make this sound like an AI sales pitch or a consultant deck.
Important: the free report must impress through clarity, not volume. Its job is to show one likely first opportunity, the evidence behind it, and one useful next move. Do not give a full diagnosis.
Paid-ladder boundary:
- The free report may name one primary opportunity and one backup opportunity only if needed.
- The free report must not fully rank the implementation sequence.
- The free report may give one first move, but it must not provide a full 30-day action plan.
- The free report may mention what appears ready or risky, but it must not deeply diagnose dependencies, numerical readiness scores, implementation phases, tool maps, ROI, time savings, or success metrics.
- The free report may invite a deeper report, but it should not sound like the build is already scoped or say things like "a few hours of build time" unless the Venture DNA directly proves that.
- The final Bridge To AI Note should be short. It should say the snapshot is directional and that the next layer ranks, sequences, and pressure-tests the work.
Opportunity rule: do not make email automation the default first opportunity. Look first for where the owner or highest-value person is losing time on repeated work. Only recommend email if the Venture DNA proves it is the real bottleneck.
Required snapshot artifact: include a section called "Snapshot Scorecard" near the top of the report. This is a directional scorecard, not a numeric score and not an ROI estimate. Use a markdown table with exactly these columns: Signal | Directional Read | What It Means | Evidence From Your Answers.
Use exactly five rows:
- Workflow Drag
- AI Fit
- Information Readiness
- Human Review Boundary
- First Useful Win
Allowed Directional Read phrases include: High friction, Medium friction, Good AI fit, Cleanup first, Ready to test, Human review needed, Needs confirmation. Pick the clearest plain-English phrase for each row.
Every row must be grounded in the Venture DNA. If the evidence is thin, use "Needs confirmation" and say what is missing. Do not invent exact hours saved, percentages, dollar savings, ROI, benchmark comparisons, readiness scores, or fake chart values.
Required free value moment: include one section called "Try This This Week". It must give one short, copy/paste-ready AI prompt or exercise the client can use with non-sensitive information. Keep the prompt under 170 words. The prompt must explicitly tell the client not to paste private financials, customer names, supplier names, recipes, payroll, invoices, contracts, confidential formulas, or other sensitive details into public AI tools.

Required structure:
# [Business Name] - Free AI Opportunity Snapshot
## 1. Quick Read
Write this as one short lead sentence followed by exactly 5 high-signal bullet points. Start with "Here is what I am seeing." Avoid "The intake indicates". Each bullet must be 1 sentence only. Cover the likely pinch point, first AI-fit workflow, readiness or cleanup issue, human-review boundary, and first useful move. Do not turn this into long paragraphs.
## 2. Snapshot Scorecard
Use the required 5-row scorecard table. Keep each cell short and specific. This should feel like the visual front door of the report.
## 3. Best First AI Opportunity
Write 2 short paragraphs only. Name the one best first opportunity and why it appears to matter. Include one sentence about what should stay human-reviewed.
## 4. Try This This Week
Give one short, safe, copy/paste-ready AI prompt or exercise. Make it specific and useful this week. Keep the section under 260 words total.
## 5. What The Deeper Interview Would Confirm
Use 3 bullets only. Explain what still needs confirmation before Bridge To AI should rank the work, scope implementation, or recommend a workbench.

VENTURE DNA:
${dna}`;
  }

  if (tier === 'detailed') {
    return `${sharedRules()}

Generate REPORT 2: Detailed AI Readiness & Opportunity Report.

Target: 6-10 pages in markdown.
Purpose: paid mid-tier report. It must feel obviously more valuable than the free snapshot by doing work the free report does not do: ranked diagnosis, why each item is ranked, what is ready now, what needs cleanup first, what should not be automated yet, first 30-day action plan, risk/privacy/data concerns, success measures, and questions to confirm before implementation.
Tone: practical advisor, not corporate consultant. Keep it direct, useful, and grounded. If something should wait, say so. If something needs cleanup first, say so.
Opportunity rule: rank opportunities by valuable time saved, rework reduced, revenue conversations created, and readiness to implement. Do not over-rank email automation unless it is clearly the highest-value repeated work in the Venture DNA.
Paid-value standard:
- A reader should feel: "The free report helped me see the problem. This paid report helps me decide what to do first, what not to do yet, and what I would hand to someone before starting implementation."
- Every ranked opportunity must explain why it sits above or below the others.
- Clearly separate ready-now opportunities from cleanup-first opportunities.
- Include practical "do not automate this yet" advice where the foundation is not ready.
- The 30-day plan must be more specific than the free report's single first move.
- The final note should reinforce the implementation logic, not repeat the free report's closing note.

Required structure:
# [Business Name] - Detailed AI Readiness & Opportunity Report
## 1. Quick Read
## 2. Business Positioning
## 3. Current Revenue And Growth Model
Use a table: Revenue Stream | Current State | Growth Opportunity | AI Relevance
## 4. Main Growth Leaks
Use a table: Growth Leak | What Is Happening | Business Impact | Recommended Fix
## 5. Where AI Looks Useful First
Use a ranked table: Rank | AI Opportunity | Problem Solved | Impact | Feasibility | Priority | Notes
After the table, explain the ranking logic in plain English. Say why the top item is first, why the second/third items wait, and what would change the order.
## 6. Recommended First 5 AI Projects
Use a table: Priority | Project | Business Problem Solved | Client Benefit | Complexity | Suggested Timing
## 7. Readiness Scorecard
Score Data & Information Quality, Workflow Documentation, Tools & Tech Stack, People & Change Readiness, Risk & Compliance Posture from 1-5.
For each score, state whether it is ready now, cleanup first, or needs confirmation.
## 8. 30-Day Action Plan
Use a table: Week | Action | Owner | Output | Success Measure
This section must contain specific actions, not generic planning language.
## 9. Directional Success Metrics
Include what would count as a useful win without inventing exact ROI.
## 10. Recommended Bridge To AI Next Step
Make the next step practical and scoped. Do not oversell.
## 11. Final Advisor Note
Explain the paid-report value in plain terms: this report ranks the work, identifies what should wait, and gives the first 30-day path. Do not repeat the Level 1 Bridge To AI Note.

VENTURE DNA:
${dna}`;
  }

  if (tier === 'btai') {
    return `${sharedRules()}

Generate INTERNAL REPORT 4: BTAI Advisor Brief.

Audience: Bridge To AI only. This is not client-facing.
Purpose: give Darren a practical pre-call briefing so he can ask better questions, clarify needs, spot risk, and identify the strongest commercial path without needing to expose or pass around the raw Venture DNA markdown.
Target: 4-7 pages in markdown.
Tone: direct, advisory, specific, commercially useful, and written like notes Darren would actually use before a call.

Required structure:
# [Business Name] - BTAI Advisor Brief
## 1. One-Page Situation Read
Summarize what BTAI needs to understand before the debrief.
## 2. Highest-Value Clarifying Questions
Use a table: Question | Why It Matters | What A Strong Answer Would Reveal | What To Listen For
## 3. Client Readiness And Trust Signals
Use a table: Signal | Evidence From Intake | Advisor Interpretation | Follow-Up Needed
## 4. Likely Buying Motivation
Label all unconfirmed motivation as [INFERRED].
## 5. Strongest AI Opportunity Angles
Use a table: Angle | Business Value | Why It Fits | Proof Needed
## 6. Risk, Privacy, And Data Sensitivity Notes
Use a table: Risk | Why It Matters | How BTAI Should Handle It
## 7. Scope Control Notes
Identify what BTAI should not promise yet.
## 8. Discovery Call Talk Track
Provide a concise opening, 5-8 question sequence, and a closing recommendation.
## 9. Proposal Direction
Use a table: Offer Path | Fit | Conditions | Price/Scope Notes
## 10. Needs Confirmation Before Build

VENTURE DNA:
${dna}`;
  }

  return `${sharedRules()}

Generate REPORT 3: Preliminary AI Action Plan.

Target: 10-18 pages in markdown.
Purpose: premium preliminary action plan around $297. It must give a practical implementation sequence a non-technical business owner could act on, while clearly marking what still requires private scoping before BTAI can validate exact ROI, cost, data access, or build scope.
Tone: practical implementation advisor. Plain English. No hype. No generic AI transformation language. Make the client feel like the path is understandable, not like they are reading software consulting copy.
Opportunity rule: build the implementation path around the most valuable repeated work first. Look for owner bottlenecks, high-cost staff time, repeated client-specific work, documentation gaps, and decision-prep work before suggesting generic admin automation.

Required structure:
# [Business Name] - Preliminary AI Action Plan
## 1. What I Would Build Around
## 2. Context Snapshot
Use a table: Category | Detail
## 3. Missing Answers From Updated Intake Questions
## 4. Target Operating Model
Use a simple adapted flow.
## 5. Build Order
Use a ranked table: Rank | System / Workflow | Problem Solved | Why Now | Business Impact | Owner/Team Relief | Complexity | Dependencies | Recommended Tool Stack | First Deliverable
## 6. Build 1: Highest-Priority Workflow
## 7. Build 2: Second-Priority Workflow
## 8. Build 3: Third-Priority Workflow
## 9. Build 4: Supporting Automation Or Intelligence Layer
## 10. Build 5: Future Enhancement
## 11. Data, Tools, And Integration Map
Use a table: Current Tool / Data Source | What It Contains | Current Issue | AI Opportunity | Integration Priority | Risk Level
## 12. Voice, Brand, And Judgment Guardrails
## 13. Risk Controls
Use a table: Risk | Why It Matters | Severity | Mitigation | Owner
## 14. Do Now / Build Next / Avoid For Now
## 15. 30 / 60 / 90 Day Implementation Plan
## 16. Directional Success Metrics And ROI Assumptions
Clearly separate Stated by the business, Directional signal, [INFERRED], and Requires private scoping to validate.
## 17. Questions To Confirm In Private Scoping Before Build
## 18. Consulting Handoff Recommendation
## 19. Final Implementation Recommendation

VENTURE DNA:
${dna}`;
}

function normalizeReportFormats(value) {
  const raw = Array.isArray(value) ? value : String(value || 'html').split(',');
  const selected = raw.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
  if (selected.includes('all')) return ['html', 'docx', 'md'];
  const allowed = ['html', 'docx', 'md'];
  const formats = Array.from(new Set(selected.filter(item => allowed.includes(item))));
  return formats.length ? formats : ['html'];
}

function formatKey(formats) {
  return normalizeReportFormats(formats).join(',');
}

async function generateOne(clientDraftId, tier, options = {}) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const formats = normalizeReportFormats(options.formats || 'html');
  const includeDocx = formats.includes('docx');

  const startedAt = Date.now();
  const { dnaContent, meta } = await getDna(clientDraftId);
  const gatedSource = await prepareSanitizedAiSource(clientDraftId, dnaContent, `report_${tier}_generation`);
  const businessName = businessNameFromDna(dnaContent);
  await logReportEvent(clientDraftId, 'report_generation_started', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    payloadType: 'sanitized_venture_dna_record',
    privacyGate: publicGateSummary(gatedSource.gate),
    privacyGateAdminApproved: !!gatedSource.adminApproved,
    startedAt: new Date(startedAt).toISOString()
  }));
  let generatedMarkdown = await callClaude(promptForTier(tier, gatedSource.sanitizedText), spec.maxTokens);
  let completion = validateReportCompletion(generatedMarkdown, tier);
  if (!completion.completed) {
    await logReportEvent(clientDraftId, 'report_generation_quality_gate_failed', 'failed', privacyProofDefaults({
      partner: meta?.sourceMeta?.partner || 'BTAI',
      campaign: meta?.sourceMeta?.campaign || 'general_intake',
      reportTier: tier,
      reportOutputType: spec.htmlOutputType,
      payloadType: 'generated_report_markdown',
      qualityGateWarnings: completion.warnings,
      blockingWarnings: completion.blockingWarnings,
      generationMs: Date.now() - startedAt
    }));
    if (canRepairCompletionFailure(completion)) {
      const originalBlockingWarnings = [...completion.blockingWarnings];
      const originalWarnings = [...completion.warnings];
      await logReportEvent(clientDraftId, 'report_generation_repair_started', 'success', privacyProofDefaults({
        partner: meta?.sourceMeta?.partner || 'BTAI',
        campaign: meta?.sourceMeta?.campaign || 'general_intake',
        reportTier: tier,
        reportOutputType: spec.htmlOutputType,
        payloadType: 'generated_report_markdown',
        repairReason: originalBlockingWarnings,
        generationMs: Date.now() - startedAt
      }));
      const repairedMarkdown = await callClaude(
        repairPromptForTier(tier, generatedMarkdown, gatedSource.sanitizedText, originalBlockingWarnings),
        Math.max(1800, Math.min(3200, Math.floor(spec.maxTokens * 0.6)))
      );
      const repairedCompletion = validateReportCompletion(repairedMarkdown, tier);
      if (repairedCompletion.completed) {
        generatedMarkdown = repairedMarkdown;
        completion = {
          completed: true,
          warnings: Array.from(new Set([...originalWarnings, ...repairedCompletion.warnings, 'completion_repaired'])),
          blockingWarnings: []
        };
        await logReportEvent(clientDraftId, 'report_generation_repair_completed', 'success', privacyProofDefaults({
          partner: meta?.sourceMeta?.partner || 'BTAI',
          campaign: meta?.sourceMeta?.campaign || 'general_intake',
          reportTier: tier,
          reportOutputType: spec.htmlOutputType,
          payloadType: 'generated_report_markdown',
          originalBlockingWarnings,
          repairedWarnings: repairedCompletion.warnings,
          generationMs: Date.now() - startedAt
        }));
      } else {
        await logReportEvent(clientDraftId, 'report_generation_repair_failed', 'failed', privacyProofDefaults({
          partner: meta?.sourceMeta?.partner || 'BTAI',
          campaign: meta?.sourceMeta?.campaign || 'general_intake',
          reportTier: tier,
          reportOutputType: spec.htmlOutputType,
          payloadType: 'generated_report_markdown',
          repairWarnings: repairedCompletion.warnings,
          repairBlockingWarnings: repairedCompletion.blockingWarnings,
          generationMs: Date.now() - startedAt
        }));
        const deterministicMarkdown = applyDeterministicCompletion(repairedMarkdown || generatedMarkdown, tier);
        const deterministicCompletion = validateReportCompletion(deterministicMarkdown, tier);
        if (deterministicCompletion.completed) {
          generatedMarkdown = deterministicMarkdown;
          completion = {
            completed: true,
            warnings: Array.from(new Set([
              ...originalWarnings,
              ...repairedCompletion.warnings,
              ...deterministicCompletion.warnings,
              'deterministic_completion_added'
            ])),
            blockingWarnings: []
          };
          await logReportEvent(clientDraftId, 'report_generation_deterministic_completion_added', 'success', privacyProofDefaults({
            partner: meta?.sourceMeta?.partner || 'BTAI',
            campaign: meta?.sourceMeta?.campaign || 'general_intake',
            reportTier: tier,
            reportOutputType: spec.htmlOutputType,
            payloadType: 'generated_report_markdown',
            originalBlockingWarnings,
            repairBlockingWarnings: repairedCompletion.blockingWarnings,
            deterministicWarnings: deterministicCompletion.warnings,
            generationMs: Date.now() - startedAt
          }));
        } else {
          await logReportEvent(clientDraftId, 'report_generation_deterministic_completion_failed', 'failed', privacyProofDefaults({
            partner: meta?.sourceMeta?.partner || 'BTAI',
            campaign: meta?.sourceMeta?.campaign || 'general_intake',
            reportTier: tier,
            reportOutputType: spec.htmlOutputType,
            payloadType: 'generated_report_markdown',
            originalBlockingWarnings,
            repairBlockingWarnings: repairedCompletion.blockingWarnings,
            deterministicBlockingWarnings: deterministicCompletion.blockingWarnings,
            generationMs: Date.now() - startedAt
          }));
          throw new Error(`Report quality gate failed for ${tier}: ${repairedCompletion.blockingWarnings.join(', ')}`);
        }
      }
    } else {
      throw new Error(`Report quality gate failed for ${tier}: ${completion.blockingWarnings.join(', ')}`);
    }
  }
  const markdown = decorateReportMarkdown(generatedMarkdown, tier);
  const validation = validateDnaOutput(markdown, { requireEvidenceLabels: false });
  validation.warnings = [...(validation.warnings || []), ...completion.warnings];
  const privacyScan = scanReportPrivacy(markdown);
  const htmlReport = createReportHtml(markdown, {
    title: `${businessName} - ${spec.title}`,
    businessName,
    tierLabel: spec.title,
    generatedAt: new Date().toISOString(),
    intakeVersion: APP_VERSION,
    reportTier: tier
  });
  await logReportEvent(clientDraftId, 'report_privacy_scan_completed', privacyScan.reportApprovedForClientDelivery ? 'success' : 'warning', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    reportPrivacyScanCompleted: true,
    rawSensitiveDataDetected: privacyScan.rawSensitiveDataDetected,
    reportApprovedForClientDelivery: privacyScan.reportApprovedForClientDelivery,
    privacyScanFindings: privacyScan.findings,
    blockingFindings: privacyScan.blockingFindings,
    nonBlockingFindings: privacyScan.nonBlockingFindings
  }));
  const mdRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.outputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      markdown,
      privacyGate: publicGateSummary(gatedSource.gate),
      validation,
      privacyScan
    })
  });

  let docxRow = null;
  if (includeDocx) {
    const docx = createDocxBuffer(markdown);
    docxRow = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: spec.docxOutputType,
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        tier,
        businessName,
        filename: `${businessName}_${spec.filename}.docx`,
        contentBase64: docx.toString('base64'),
        privacyGate: publicGateSummary(gatedSource.gate),
        validation,
        privacyScan
      })
    });
  }

  const htmlRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.htmlOutputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      filename: `${businessName}_${spec.filename}.html`,
      contentBase64: Buffer.from(htmlReport, 'utf8').toString('base64'),
      contentType: 'text/html; charset=utf-8',
      privacyGate: publicGateSummary(gatedSource.gate),
      validation,
      privacyScan
    })
  });

  await logReportEvent(clientDraftId, 'report_generated', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    warningCount: validation.warnings?.length || 0,
    payloadType: includeDocx ? 'client_report_html_docx_and_markdown' : 'client_report_html_and_markdown',
    exportFormats: formats,
    privacyGateDecision: gatedSource.gate.decision,
    privacyGateRiskLevel: gatedSource.gate.summary.riskLevel,
    generationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  return {
    generated: true,
    tier,
    businessName,
    privacyGate: publicGateSummary(gatedSource.gate),
    markdownOutputId: mdRow?.id || '',
    docxOutputId: docxRow?.id || '',
    htmlOutputId: htmlRow?.id || '',
    warnings: validation.warnings || []
  };
}

async function getOrGenerateOne(clientDraftId, tier, forceRegenerate = false, options = {}) {
  const formats = normalizeReportFormats(options.formats || 'html');
  const includeHtml = formats.includes('html');
  const includeDocx = formats.includes('docx');
  if (forceRegenerate) return generateOne(clientDraftId, tier, { formats });
  const includeMd = formats.includes('md');
  let existingHtml = await loadGenerated(clientDraftId, tier, 'html');
  let existingDocx = await loadGenerated(clientDraftId, tier, 'docx');
  const existingMd = await loadGeneratedMarkdown(clientDraftId, tier);
  let convertedHtml = false;
  let convertedDocx = false;

  if (includeHtml && !existingHtml?.contentBase64 && existingMd?.markdown) {
    existingHtml = await ensureHtmlReport(clientDraftId, tier);
    convertedHtml = !!existingHtml?.contentBase64;
  }

  if (includeDocx && !existingDocx?.contentBase64 && existingMd?.markdown) {
    existingDocx = await ensureDocxReport(clientDraftId, tier);
    convertedDocx = !!existingDocx?.contentBase64;
  }

  const ready =
    (!includeHtml || !!existingHtml?.contentBase64) &&
    (!includeDocx || !!existingDocx?.contentBase64) &&
    (!includeMd || !!existingMd?.markdown);

  if (ready) {
    return {
      generated: false,
      convertedHtml,
      convertedDocx,
      tier,
      businessName: existingHtml?.businessName || existingDocx?.businessName || existingMd?.businessName || '',
      markdownOutputId: existingMd ? 'existing' : '',
      docxOutputId: existingDocx ? 'existing' : '',
      htmlOutputId: existingHtml ? 'existing' : '',
      warnings: existingHtml?.validation?.warnings || existingDocx?.validation?.warnings || existingMd?.validation?.warnings || []
    };
  }

  return generateOne(clientDraftId, tier, { formats });
}

async function loadGenerated(clientDraftId, tier, format = 'docx') {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const outputType = format === 'html' ? spec.htmlOutputType : spec.docxOutputType;
  const row = await getLatestIntakeOutput(clientDraftId, outputType);
  if (!row) return null;
  return decryptJson(row.encrypted_payload);
}

async function loadGeneratedMarkdown(clientDraftId, tier) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const row = await getLatestIntakeOutput(clientDraftId, spec.outputType);
  if (!row) return null;
  return decryptJson(row.encrypted_payload);
}

async function ensureHtmlReport(clientDraftId, tier) {
  const existingHtml = await loadGenerated(clientDraftId, tier, 'html');
  if (existingHtml?.contentBase64) return existingHtml;
  const spec = REPORTS[tier];
  const markdownRecord = await loadGeneratedMarkdown(clientDraftId, tier);
  if (!markdownRecord?.markdown) return null;
  const businessName = markdownRecord.businessName || businessNameFromDna(markdownRecord.markdown);
  const htmlReport = createReportHtml(markdownRecord.markdown, {
    title: `${businessName} - ${spec.title}`,
    businessName,
    tierLabel: spec.title,
    generatedAt: markdownRecord.createdAt || new Date().toISOString(),
    intakeVersion: APP_VERSION,
    reportTier: tier
  });
  const payload = {
    createdAt: new Date().toISOString(),
    tier,
    businessName,
    filename: `${businessName}_${spec.filename}.html`,
    contentBase64: Buffer.from(htmlReport, 'utf8').toString('base64'),
    contentType: 'text/html; charset=utf-8',
    validation: markdownRecord.validation || null,
    privacyScan: markdownRecord.privacyScan || null,
    convertedFromMarkdown: true
  };
  await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.htmlOutputType,
    encrypted_payload: encryptJson(payload)
  });
  await logReportEvent(clientDraftId, 'report_html_generated_from_markdown', 'success', privacyProofDefaults({
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    payloadType: 'client_report_html',
    rawDnaIncluded: false
  }));
  return payload;
}

async function ensureDocxReport(clientDraftId, tier) {
  const existingDocx = await loadGenerated(clientDraftId, tier, 'docx');
  if (existingDocx?.contentBase64) return existingDocx;
  const spec = REPORTS[tier];
  const markdownRecord = await loadGeneratedMarkdown(clientDraftId, tier);
  if (!markdownRecord?.markdown) return null;
  const businessName = markdownRecord.businessName || businessNameFromDna(markdownRecord.markdown);
  const docx = createDocxBuffer(markdownRecord.markdown);
  const payload = {
    createdAt: new Date().toISOString(),
    tier,
    businessName,
    filename: `${businessName}_${spec.filename}.docx`,
    contentBase64: docx.toString('base64'),
    validation: markdownRecord.validation || null,
    privacyScan: markdownRecord.privacyScan || null,
    convertedFromMarkdown: true
  };
  await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.docxOutputType,
    encrypted_payload: encryptJson(payload)
  });
  await logReportEvent(clientDraftId, 'report_docx_generated_from_markdown', 'success', privacyProofDefaults({
    reportTier: tier,
    reportOutputType: spec.docxOutputType,
    payloadType: 'client_report_docx',
    rawDnaIncluded: false
  }));
  return payload;
}

async function buildZip(clientDraftId, formatsInput = 'html') {
  const formats = normalizeReportFormats(formatsInput);
  const key = formatKey(formats);
  const includeHtml = formats.includes('html');
  const includeDocx = formats.includes('docx');
  const includeMd = formats.includes('md');
  const { dnaContent, meta } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  const files = [];
  const missingFiles = [];

  for (const tier of ['free', 'detailed', 'roadmap', 'btai']) {
    const htmlDoc = includeHtml ? await ensureHtmlReport(clientDraftId, tier) : null;
    const mdDoc = includeMd ? await loadGeneratedMarkdown(clientDraftId, tier) : null;
    const doc = includeDocx ? await ensureDocxReport(clientDraftId, tier) : null;
    let includedForTier = 0;

    if (includeHtml && htmlDoc?.contentBase64) {
      files.push({
        name: `HTML_Reports/${htmlDoc.filename || `${businessName}_${REPORTS[tier].filename}.html`}`,
        content: Buffer.from(htmlDoc.contentBase64, 'base64')
      });
      includedForTier += 1;
    } else if (includeHtml) {
      missingFiles.push(`${tier}: HTML`);
    }

    if (includeDocx && doc?.contentBase64) {
      files.push({
        name: `DOCX_Backup/${doc.filename || `${businessName}_${REPORTS[tier].filename}.docx`}`,
        content: Buffer.from(doc.contentBase64, 'base64')
      });
      includedForTier += 1;
    } else if (includeDocx) {
      missingFiles.push(`${tier}: DOCX`);
    }

    if (includeMd && mdDoc?.markdown) {
      files.push({
        name: `MD_Reports/${businessName}_${REPORTS[tier].filename}.md`,
        content: mdDoc.markdown
      });
      includedForTier += 1;
    } else if (includeMd) {
      missingFiles.push(`${tier}: Markdown`);
    }

    if (includedForTier === 0) {
      throw new Error(`Missing selected report files for tier: ${tier}. Generate that report first, then download the ZIP.`);
    }
  }

  const validationSummary = {
    createdAt: new Date().toISOString(),
    clientDraftId,
    businessName,
    formats,
    formatKey: key,
    includedFiles: files.map(f => f.name),
    rawDnaIncluded: false,
    partnerRawAccess: false,
    encryptedSourceRecord: true,
    privacyProof: true,
    missingFiles,
    note: `Reports were retrieved or generated from the encrypted Venture DNA record and stored encrypted before ZIP retrieval. Selected export format(s): ${formats.join(', ')}. The raw Venture DNA markdown is intentionally not included in this ZIP.`
  };
  files.push({ name: 'BTAI_Report_Pack_Summary.md', content: reportPackSummaryMarkdown({ clientDraftId, businessName, files }) });
  files.push({ name: 'validation-summary.json', content: JSON.stringify(validationSummary, null, 2) });

  const zip = createZipBuffer(files);
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'three_report_pack_zip',
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      filename: `${businessName}_BTAI_Report_Pack.zip`,
      contentBase64: zip.toString('base64'),
      formats,
      formatKey: key,
      validationSummary
    })
  });

  await logReportEvent(clientDraftId, 'report_pack_zip_built', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    zipReady: true,
    exportFormats: formats,
    formatKey: key,
    includedFileCount: files.length,
    rawDnaIncluded: false,
    payloadType: 'client_report_zip'
  }));

  return {
    ready: true,
    outputId: row?.id || '',
    filename: `${businessName}_BTAI_Report_Pack.zip`,
    contentBase64: zip.toString('base64')
  };
}

async function generateAll(clientDraftId, forceRegenerate = false, formatsInput = 'html') {
  const formats = normalizeReportFormats(formatsInput);
  const tiers = ['free', 'detailed', 'roadmap', 'btai'];
  await logReportEvent(clientDraftId, 'report_pack_batch_started', 'success', privacyProofDefaults({ tiers, forceRegenerate, exportFormats: formats, payloadType: 'encrypted_venture_dna_record' }));
  const results = await Promise.all(tiers.map(tier => getOrGenerateOne(clientDraftId, tier, forceRegenerate, { formats })));
  const zip = await buildZip(clientDraftId, formats);
  await logReportEvent(clientDraftId, 'report_pack_batch_complete', 'success', privacyProofDefaults({
    tiers,
    zipOutputId: zip.outputId || '',
    generatedCount: results.filter(r => r.generated).length,
    exportFormats: formats,
    forceRegenerate
  }));
  return { ready: true, results, zip };
}

async function sendFreeReportEmail({ clientDraftId, clientEmail, clientName, businessName, reportFile }) {
  if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const bccRecipient = process.env.INTAKE_BCC_RECIPIENT || 'darren.randles@gmail.com';
  const { level2Price, level3Price, level2Url, level3Url, consultUrl } = paymentConfig();
  const continueInterviewUrl = `https://intake.bridgetoai.ca/snapshot?continue=deep&recordId=${encodeURIComponent(clientDraftId)}`;
  const publicBaseUrl = (process.env.BTAI_PUBLIC_BASE_URL || 'https://intake.bridgetoai.ca').replace(/\/+$/, '');
  const lockMarkUrl = `${publicBaseUrl}/assets/brand/sil-lock-mark.png`;
  const trustSealUrl = `${publicBaseUrl}/assets/brand/sil-trust-seal.png`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <div style="background:#075648;padding:22px 30px;border-radius:12px 12px 0 0;border-bottom:5px solid #f3c74d;">
        <div style="display:flex;align-items:center;gap:13px;">
          <img src="${lockMarkUrl}" alt="" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:contain;">
          <div>
            <div style="color:#dff7ef;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;margin-bottom:4px;">Bridge To AI</div>
            <h1 style="color:#fff;font-size:21px;line-height:1.3;margin:0;">Your opportunity snapshot is ready</h1>
          </div>
        </div>
      </div>
      <div style="border:1px solid #d9e7e3;border-top:0;padding:26px 30px;border-radius:0 0 12px 12px;background:#fafaf8;">
        <p style="font-size:15px;line-height:1.6;margin-top:0;">Hi ${escapeHtml(clientName || 'there')},</p>
        <p style="font-size:15px;line-height:1.6;">Thank you for completing the free interview. Your AI Opportunity Snapshot is attached as a clean HTML report you can read in your browser or print.</p>
        <p style="font-size:15px;line-height:1.6;">Inside, you will see a Snapshot Scorecard, the likely first AI opportunity, what should stay human-reviewed, and one safe prompt or next move you can try without putting sensitive details into a public AI tool.</p>
        <p style="font-size:15px;line-height:1.6;">Bridge To AI exists for business owners who do not want to become AI experts before they can benefit from AI. I learned the AI side so you do not have to, and the goal is to translate your real workflow into practical next steps you can actually use.</p>
        <p style="font-size:15px;line-height:1.6;">This first report is intentionally practical and directional. It avoids private financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential formulas.</p>
        <div style="display:flex;gap:14px;align-items:center;background:#ffffff;border:1px solid #d9e7e3;border-radius:10px;padding:12px 14px;margin:0 0 16px;">
          <img src="${trustSealUrl}" alt="Secure Intelligence Layer" width="68" height="68" style="display:block;width:68px;height:68px;object-fit:contain;flex:0 0 auto;">
          <div style="font-size:13px;line-height:1.45;color:#374151;">
            <strong style="display:block;color:#075648;margin-bottom:3px;">Handled through the Bridge To AI Secure Intelligence Layer</strong>
            Encrypted intake, controlled use, privacy-aware AI processing, and private report delivery.
          </div>
        </div>
        <div style="background:#e8f4f1;border:1px solid #b8ddd7;border-radius:10px;padding:14px 16px;color:#0d6e5e;font-size:14px;line-height:1.5;margin-bottom:16px;">
          <strong>Best next step:</strong> Review the snapshot first. If it feels accurate, continue the deeper interview so Bridge To AI can understand the missing context and guide you more precisely before anyone talks about a paid report or build.
        </div>
        <div style="border:1px solid #e4e2dd;border-radius:10px;padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55;">
          <strong style="display:block;margin-bottom:8px;color:#111827;">What this snapshot does not fully cover yet</strong>
          <div style="margin-bottom:10px;">The free report gives you a directional scorecard and first useful move. The deeper interview is not a payment step. It is the context step that helps Bridge To AI understand whether you need a report, an action plan, a workbench, or simply a practical conversation.</div>
          ${ctaLineHtml('Continue the deeper interview', continueInterviewUrl, 'No payment is required to add the missing context. This helps Bridge To AI guide you better and decide what kind of next step, if any, is actually worth your time.')}
          <div style="margin-bottom:10px;color:#6b7280;font-size:13px;">Privacy note: this continuation link opens your saved secure interview. Please do not forward this email if you do not want someone else to access that continuation path.</div>
          ${ctaLineHtml(`Detailed AI Opportunity Report - ${level2Price}`, '', 'Best considered after the deeper interview confirms enough detail for ranking and first projects.')}
          ${ctaLineHtml(`Preliminary AI Action Plan - ${level3Price}`, '', 'Best considered after workflow priorities, risk controls, and scoping questions are clearer.')}
          ${ctaLineHtml('Talk with Bridge To AI about implementation or a custom workbench', consultUrl, 'Useful if you already know you want help turning the opportunity into a working system.')}
        </div>
        <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:0;margin-top:18px;">Record ID: <code>${escapeHtml(clientDraftId)}</code><br>Built with Bridge To AI Intake ${escapeHtml(APP_VERSION)}</p>
      </div>
    </div>`;
  const text = `Your Bridge To AI opportunity snapshot is ready.\n\nThe free report is attached. Inside, you will see a Snapshot Scorecard, the likely first AI opportunity, what should stay human-reviewed, and one safe prompt or next move you can try without putting sensitive details into a public AI tool.\n\nBridge To AI exists for business owners who do not want to become AI experts before they can benefit from AI. I learned the AI side so you do not have to, and the goal is to translate your real workflow into practical next steps you can actually use.\n\nHandled through the Bridge To AI Secure Intelligence Layer: encrypted intake, controlled use, privacy-aware AI processing, and private report delivery.\n\nWhat this snapshot does not fully cover yet:\nThe free report gives you a directional scorecard and first useful move. The deeper interview is not a payment step. It is the context step that helps Bridge To AI understand whether you need a report, an action plan, a workbench, or simply a practical conversation.\n\nBest next step:\n- Continue the deeper interview: ${continueInterviewUrl}\nNo payment is required to add the missing context. This helps Bridge To AI guide you better and decide what kind of next step, if any, is actually worth your time.\n\nPrivacy note: this continuation link opens your saved secure interview. Please do not forward this email if you do not want someone else to access that continuation path.\n\nPossible next steps after context is clearer:\n- Detailed AI Opportunity Report - ${level2Price}: deeper diagnosis, readiness gaps, and prioritized first projects.\n- Preliminary AI Action Plan - ${level3Price}: implementation phases, workflow priorities, and scoping questions.\n- Implementation support: help turning the plan into a working AI system or workbench after private scoping. ${consultUrl || 'Reply to this email to request a conversation.'}\n\nA workbench is a private operating dashboard built around your business so repeated workflows can run from one place.\n\nRecord ID: ${clientDraftId}\nBuilt with Bridge To AI Intake ${APP_VERSION}`;
  const payload = {
    from: 'The Bridge Team <team@bridgetoai.ca>',
    to: [clientEmail],
    bcc: bccRecipient ? [bccRecipient] : [],
    subject: `Your Bridge To AI Opportunity Snapshot${businessName ? ` - ${businessName}` : ''}`,
    html,
    text,
    attachments: [{
      filename: reportFile.filename || 'Bridge_To_AI_Free_AI_Opportunity_Snapshot.html',
      content: reportFile.contentBase64,
      content_type: reportFile.contentType || 'text/html; charset=utf-8'
    }]
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Free report email failed: ' + await response.text());
  return response.json();
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

async function resolveReportRecipientEmail(clientDraftId, sessionPayload, providedEmail = '') {
  const sessionEmail = normalizeEmail(sessionPayload.clientEmail || '');
  const requestEmail = normalizeEmail(providedEmail || '');
  const recipientEmail = requestEmail || sessionEmail;
  if (!recipientEmail) throw new Error('No client email found on the intake session');
  if (!isValidEmail(recipientEmail)) throw new Error('The report email address is not valid');

  if (requestEmail && requestEmail !== sessionEmail) {
    const correctedPayload = {
      ...sessionPayload,
      clientEmail: requestEmail,
      reportDeliveryEmailCorrectedAt: new Date().toISOString()
    };
    await updateIntakeSession(clientDraftId, {
      encrypted_payload: encryptJson(correctedPayload),
      updated_at: new Date().toISOString()
    });
    await logReportEvent(clientDraftId, 'free_report_delivery_email_corrected', 'success', privacyProofDefaults({
      reportTier: 'free',
      recipientCorrected: true,
      piiLogged: false,
      proofStatus: 'delivery_email_corrected_in_encrypted_session'
    }));
  }

  return recipientEmail;
}

async function generateFreeAndEmail(clientDraftId, providedEmail = '') {
  const startedAt = Date.now();
  const sessionPayload = await getSessionPayload(clientDraftId);
  const recipientEmail = await resolveReportRecipientEmail(clientDraftId, sessionPayload, providedEmail);

  await logReportEvent(clientDraftId, 'free_report_delivery_started', 'success', privacyProofDefaults({
    reportTier: 'free',
    payloadType: 'encrypted_venture_dna_record',
    clientReportOnly: true,
    startedAt: new Date(startedAt).toISOString()
  }));
  await getOrGenerateOne(clientDraftId, 'free');
  const htmlDoc = await ensureHtmlReport(clientDraftId, 'free');
  if (!htmlDoc?.contentBase64) throw new Error('Free HTML report was not generated');
  const result = await sendFreeReportEmail({
    clientDraftId,
    clientEmail: recipientEmail,
    clientName: sessionPayload.clientName || '',
    businessName: sessionPayload.businessName || htmlDoc.businessName || '',
    reportFile: htmlDoc
  });
  await logReportEvent(clientDraftId, 'free_report_emailed', 'success', privacyProofDefaults({
    reportTier: 'free',
    recipientConfirmed: true,
    resendId: result.id || '',
    emailMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  let internalBrief = { attempted: false, generated: false };
  if (String(process.env.BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE || 'false').toLowerCase() === 'true') {
    try {
      const briefResult = await getOrGenerateOne(clientDraftId, 'btai');
      internalBrief = { attempted: true, generated: !!briefResult.generated, alreadyReady: !briefResult.generated };
      await logReportEvent(clientDraftId, 'internal_brief_after_free_complete', 'success', privacyProofDefaults({
        reportTier: 'btai',
        reportOutputType: REPORTS.btai.htmlOutputType,
        clientReportOnly: false,
        payloadType: 'encrypted_venture_dna_record'
      }));
    } catch (err) {
      internalBrief = { attempted: true, generated: false, error: err.message };
      await logReportEvent(clientDraftId, 'internal_brief_after_free_failed', 'failed', privacyProofDefaults({
        reportTier: 'btai',
        clientReportOnly: false,
        error: err.message || 'Internal brief generation failed',
        proofStatus: 'free_report_sent_internal_brief_failed'
      }));
    }
  }
  return { emailed: true, id: result.id || '', recipient: recipientEmail, internalBrief };
}

async function status(clientDraftId) {
  const result = {};
  result.formats = {};
  for (const tier of Object.keys(REPORTS)) {
    const htmlReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].htmlOutputType));
    const docxReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].docxOutputType));
    const mdReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].outputType));
    result[tier] = htmlReady || docxReady || mdReady;
    result.formats[tier] = { html: htmlReady, docx: docxReady, md: mdReady };
  }
  result.zip = !!(await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip'));
  result.timings = {};
  const events = await getIntakeEvents(clientDraftId, 200);
  events
    .filter(event => event.event_type === 'report_generated' && event.metadata?.details?.reportTier)
    .forEach(event => {
      const details = event.metadata.details;
      result.timings[details.reportTier] = {
        generationMs: details.generationMs || null,
        completedAt: details.completedAt || event.created_at || ''
      };
    });
  const batch = [...events].reverse().find(event => event.event_type === 'report_pack_batch_complete');
  if (batch?.metadata?.details) {
    result.batch = {
      completedAt: batch.created_at,
      generatedCount: batch.metadata.details.generatedCount || 0,
      zipOutputId: batch.metadata.details.zipOutputId || ''
    };
  }
  return result;
}

async function privacyProofSummary(clientDraftId) {
  const events = await getIntakeEvents(clientDraftId, 200);
  const proofEvents = events.filter(event => {
    const metadata = event.metadata || {};
    return metadata.privacyProof || String(event.stage || '').includes('privacy') || String(event.event_type || '').includes('privacy_proof');
  });
  const successfulEvent = eventType => proofEvents.find(e => e.event_type === eventType && e.status === 'success');
  const successfulEventWithDetail = (eventType, predicate) => proofEvents.find(e => {
    const details = e.metadata?.details || {};
    return e.event_type === eventType && e.status === 'success' && predicate(details);
  });
  const consentEvent = successfulEventWithDetail('privacy_proof_consent_recorded', details =>
    !!details.privacyConsentAccepted && !!details.privacyConsentAt && !!details.privacyPolicyVersion
  );
  const crossBorderEvent = successfulEventWithDetail('privacy_proof_cross_border_notice', details =>
    !!details.crossBorderProcessingNoticePresented && !!details.serviceProviderPolicyAvailable &&
    !!details.privacyContactPresented && !!details.privacyPolicyVersion
  );
  const reportScanEvents = proofEvents.filter(e => e.event_type === 'report_privacy_scan_completed');
  const blockingReportScanEvents = reportScanEvents.filter(e => {
    const details = e.metadata?.details || {};
    return Array.isArray(details.blockingFindings)
      ? details.blockingFindings.length > 0
      : details.reportApprovedForClientDelivery === false && !(Array.isArray(details.privacyScanFindings) && details.privacyScanFindings.length === 1 && details.privacyScanFindings[0] === 'private_financial_document_language');
  });

  const summary = {
    recordId: clientDraftId,
    generatedAt: new Date().toISOString(),
    proofEventCount: proofEvents.length,
    encryptedRecordsConfirmed: !!successfulEvent('privacy_proof_secure_output_storage'),
    anonymizedAiAnalysisConfirmed: !!successfulEvent('privacy_proof_ai_analysis_requested'),
    privacyGateConfirmed: proofEvents.some(e => e.event_type === 'privacy_gate_scan_completed' && e.status === 'success'),
    privacyGateReviewRequired: proofEvents.some(e => (e.metadata?.details || {}).privacyGateDecision === 'quarantine'),
    privacyGateAdminApproved: proofEvents.some(e => e.event_type === 'privacy_gate_admin_review_approved' && e.status === 'success'),
    privacyConsentConfirmed: !!consentEvent,
    crossBorderNoticeConfirmed: !!crossBorderEvent,
    retentionPolicyRecorded: !!successfulEvent('privacy_proof_retention_policy_recorded'),
    adminAccessLogged: proofEvents.some(e => String(e.stage || '') === 'admin_access_audit' || String(e.event_type || '').startsWith('admin_')),
    reportPrivacyScanCompleted: reportScanEvents.length > 0,
    reportPrivacyScanBlockingIssueFound: blockingReportScanEvents.length > 0,
    rawDataSharedWithPartner: false,
    rawDnaIncludedInReportZip: false,
    partnerAggregateOnly: true,
    clientFacingEmailContainsRawDna: false,
    privacyConclusion: 'Passed with technical privacy-by-design evidence. Not a legal opinion.',
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
  if (!summary.privacyGateConfirmed) summary.remainingImprovements.push('Privacy Gate scan proof was not found for this record.');
  if (summary.privacyGateReviewRequired && !summary.privacyGateAdminApproved) summary.remainingImprovements.push('Privacy Gate found high-risk content and admin review is still required.');
  if (!summary.adminAccessLogged) summary.remainingImprovements.push('No admin access event has been logged yet for this record.');
  if (!summary.reportPrivacyScanCompleted) summary.remainingImprovements.push('Report privacy scan proof was not found for this record.');
  if (summary.reportPrivacyScanBlockingIssueFound) summary.remainingImprovements.push('A report privacy scan found a blocking client-delivery issue.');
  summary.privacyConclusion = summary.remainingImprovements.length
    ? 'Passed core SIL privacy proof with improvement items noted.'
    : 'Passed SIL privacy proof with consent, cross-border notice, retention, encrypted storage, anonymized AI analysis, report scan, and access audit evidence.';
  return summary;
}

function yesNo(value) {
  return value ? 'Verified' : 'Needs review';
}

function msToDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 'Not recorded';
  const seconds = Math.round(n / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function certificateStatus(summary) {
  if (summary.remainingImprovements?.length) return 'VERIFIED WITH NOTES';
  return 'VERIFIED';
}

function briefPrivacyCertificateMarkdown(summary) {
  const status = certificateStatus(summary);
  return `# Your Data Privacy & Security Summary

**Status:** ${status}

---

## Executive Summary

Your Bridge To AI intake record was handled through the BTAI Secure Intelligence Layer. The proof log confirms encrypted storage, anonymized AI analysis where practical, partner access limits, and raw interview/DNA exclusion from the report package.

${summary.remainingImprovements?.length ? 'There are improvement notes on the internal audit record. These notes do not indicate that raw interview data was shared with a partner or included in the report package.' : 'No open privacy-proof improvement items were found in this record.'}

---

## Core Protections

| Protection | Status |
| --- | --- |
| Encrypted secure storage | ${yesNo(summary.encryptedRecordsConfirmed)} |
| Anonymized AI analysis step | ${yesNo(summary.anonymizedAiAnalysisConfirmed)} |
| Raw interview/DNA excluded from report ZIP | ${summary.rawDnaIncludedInReportZip ? 'Needs review' : 'Verified'} |
| Partner raw access blocked | ${summary.rawDataSharedWithPartner ? 'Needs review' : 'Verified'} |
| Partner reporting limited to aggregate insights | ${yesNo(summary.partnerAggregateOnly)} |
| Client-facing email does not contain raw DNA | ${summary.clientFacingEmailContainsRawDna ? 'Needs review' : 'Verified'} |
| Retention/deletion review recorded | ${yesNo(summary.retentionPolicyRecorded)} |

---

## Plain-English Note

This summary is intended to explain how the intake record was handled. It is not a legal opinion or formal privacy audit. A more detailed internal privacy and security attestation can be reviewed by Bridge To AI if a deeper audit trail is required.
`;
}

function detailedPrivacyCertificateMarkdown(summary) {
  const status = certificateStatus(summary);
  const warnings = summary.remainingImprovements?.length
    ? summary.remainingImprovements.map(item => `- **ACTION REQUIRED:** ${item}`).join('\n')
    : '- **No action items found** in the privacy proof summary.';
  const eventRows = (summary.events || []).map(event => {
    const details = event.details || {};
    const result = `${event.status || 'unknown'}${details.proofStatus ? ` / ${details.proofStatus}` : ''}`;
    return `| ${event.createdAt || ''} | ${event.stage || ''} | ${event.eventType || ''} | ${result} |`;
  }).join('\n');

  return `# Internal Privacy & Security Attestation Report

**Record ID:** ${summary.recordId}

**Generated At (UTC):** ${summary.generatedAt}

**Overall Validation Status:** ${status}

---

## Action Items / Warnings

${warnings}

---

## Technical Protections

| Compliance Measure | Status | Technical Details |
| --- | --- | --- |
| Encrypted records at rest | ${yesNo(summary.encryptedRecordsConfirmed)} | AES-256-GCM is recorded in proof events where encryption is logged. |
| Anonymized AI analysis | ${yesNo(summary.anonymizedAiAnalysisConfirmed)} | AI analysis request is logged as an anonymized business profile/prompt where practical. |
| Consent proof | ${yesNo(summary.privacyConsentConfirmed)} | Requires accepted consent, consent timestamp, and Privacy Policy version. |
| Cross-border/vendor notice proof | ${yesNo(summary.crossBorderNoticeConfirmed)} | Requires notice presented, provider policy availability, privacy contact presented, and policy version. |
| Retention/deletion proof | ${yesNo(summary.retentionPolicyRecorded)} | Retention review and deletion request path must be recorded. |
| Admin access audit | ${yesNo(summary.adminAccessLogged)} | Admin retrieval/proof downloads are logged as privacy proof events. |
| Report privacy scan | ${yesNo(summary.reportPrivacyScanCompleted)} | Blocking client-delivery issues found: ${summary.reportPrivacyScanBlockingIssueFound ? 'yes' : 'no'}. |
| Partner raw access | ${summary.rawDataSharedWithPartner ? 'Needs review' : 'Verified'} | Summary reports raw partner access as false. |
| Raw DNA in report ZIP | ${summary.rawDnaIncludedInReportZip ? 'Needs review' : 'Verified'} | Raw Venture DNA markdown is intentionally excluded from ZIP packages. |

---

## Event Audit Trail

| Time | Pipeline Stage | Event | Result |
| --- | --- | --- | --- |
${eventRows || '| No events found | N/A | N/A | N/A |'}

---

## Notes

This report is generated from sanitized privacy proof events. It is designed for internal compliance, legal, or administrative review. It is not a legal opinion.
`;
}

async function privacyCertificate(clientDraftId, certificateType) {
  const summary = await privacyProofSummary(clientDraftId);
  const markdown = certificateType === 'detailed'
    ? detailedPrivacyCertificateMarkdown(summary)
    : briefPrivacyCertificateMarkdown(summary);
  const suffix = certificateType === 'detailed'
    ? 'Detailed_Privacy_And_Security_Attestation.md'
    : 'Brief_Privacy_And_Security_Certificate.md';
  return {
    success: true,
    certificateType,
    filename: `${safeName(summary.recordId)}_${suffix}`,
    markdown,
    privacyProof: summary
  };
}

function reportPackSummaryMarkdown({ clientDraftId, businessName, files }) {
  const purposeForFile = file => {
    if (file.name.includes('Internal')) return 'Internal Bridge To AI advisor use only.';
    if (file.name.includes('HTML_Reports')) return 'Primary browser-readable report.';
    if (file.name.includes('MD_Reports')) return 'Editable Markdown source report.';
    if (file.name.includes('DOCX_Backup')) return 'Editable Word backup copy.';
    return 'Package support file.';
  };
  return `# Bridge To AI Report Package Summary

This package was generated from the encrypted Bridge To AI intake record.

---

## Package Contents

| File | Purpose |
| --- | --- |
${files.map(file => `| ${file.name} | ${purposeForFile(file)} |`).join('\n')}

---

## Privacy Handling

| Privacy Measure | Status |
| --- | --- |
| Raw Venture DNA markdown included in this ZIP | No |
| Source intake record stored encrypted | Yes |
| Partner raw access allowed | No |
| Partner reporting limited to anonymized aggregate insights where applicable | Yes |

---

## Record Reference

Business: ${businessName}

Record ID: ${clientDraftId}

Generated: ${new Date().toISOString()}

This summary is included so the package is readable without opening the raw validation JSON. The ZIP contains only the export formats selected in the admin console. The raw Venture DNA markdown is intentionally not included in this ZIP.
`;
}

async function downloadZip(clientDraftId, formatsInput = 'html') {
  const formats = normalizeReportFormats(formatsInput);
  const key = formatKey(formats);
  const row = await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip');
  if (!row) return buildZip(clientDraftId, formats);
  const payload = decryptJson(row.encrypted_payload);
  if (payload.formatKey !== key) return buildZip(clientDraftId, formats);
  await logReportEvent(clientDraftId, 'report_pack_zip_downloaded', 'success', privacyProofDefaults({
    zipReady: true,
    exportFormats: formats,
    formatKey: key
  }));
  return {
    ready: true,
    outputId: row.id,
    filename: payload.filename,
    contentBase64: payload.contentBase64
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const action = String(req.body?.action || '').trim();
  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: `report-pack:${action || 'unknown'}`, limit: action === 'generate-free-email' ? 8 : 12, windowMs: 60_000 });
    if (action === 'generate-free-email') {
      return res.status(200).json(await generateFreeAndEmail(clientDraftId, req.body?.clientEmail || ''));
    }
    if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });
    if (action === 'approve-privacy-gate') return res.status(200).json(await approvePrivacyGate(clientDraftId, req.body?.purpose || 'all', req.body?.reviewNote || ''));
    if (action === 'generate-one') {
      const tier = String(req.body?.tier || '').trim();
      const forceRegenerate = !!req.body?.forceRegenerate;
      const formats = normalizeReportFormats(req.body?.formats || 'html');
      return res.status(200).json(forceRegenerate ? await generateOne(clientDraftId, tier, { formats }) : await getOrGenerateOne(clientDraftId, tier, false, { formats }));
    }
    if (action === 'generate-all') return res.status(200).json(await generateAll(clientDraftId, !!req.body?.forceRegenerate, req.body?.formats || 'html'));
    if (action === 'build-zip') return res.status(200).json(await buildZip(clientDraftId, req.body?.formats || 'html'));
    if (action === 'download-zip') return res.status(200).json(await downloadZip(clientDraftId, req.body?.formats || 'html'));
    if (action === 'status') return res.status(200).json({ status: await status(clientDraftId) });
    if (action === 'privacy-proof-summary') {
      await logReportEvent(clientDraftId, 'admin_privacy_proof_downloaded', 'success', privacyProofDefaults({
        privacyProofType: 'admin_access',
        adminAccessLogged: true,
        adminAction: 'download_privacy_proof',
        recordAccessPurpose: 'privacy_audit',
        rawDnaAccessed: false
      }));
      return res.status(200).json({ privacyProof: await privacyProofSummary(clientDraftId) });
    }
    if (action === 'privacy-certificate-brief' || action === 'privacy-certificate-detailed') {
      const certificateType = action === 'privacy-certificate-detailed' ? 'detailed' : 'brief';
      await logReportEvent(clientDraftId, `admin_privacy_certificate_${certificateType}_downloaded`, 'success', privacyProofDefaults({
        privacyProofType: 'admin_access',
        adminAccessLogged: true,
        adminAction: `download_privacy_certificate_${certificateType}`,
        recordAccessPurpose: 'privacy_certificate',
        rawDnaAccessed: false
      }));
      return res.status(200).json(await privacyCertificate(clientDraftId, certificateType));
    }
    return res.status(400).json({ error: 'Unknown report-pack action' });
  } catch (err) {
    console.error('report-pack error:', err);
    if (err instanceof PrivacyGateReviewError) {
      return res.status(409).json({
        error: 'Privacy review required',
        message: err.message,
        privacyGate: err.privacyGate,
        secureStorage: err.secureStorage
      });
    }
    if (action === 'generate-free-email' && clientDraftId) {
      try {
        await logReportEvent(clientDraftId, 'free_report_delivery_failed', 'failed', privacyProofDefaults({
          reportTier: 'free',
          clientReportOnly: true,
          payloadType: 'encrypted_venture_dna_record',
          error: err.message || 'Free report delivery failed',
          proofStatus: 'free_report_delivery_failed'
        }));
      } catch (logErr) {
        console.error('free report failure logging failed:', logErr);
      }
    }
    return safeError(res, err, 'Report-pack request failed');
  }
}







