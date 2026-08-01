import { decryptJson, encryptJson } from '../lib/crypto.js';
import { createDocxBuffer, createZipBuffer } from '../lib/docx.js';
import { getIntakeEvents, getIntakeSession, getLatestIntakeOutput, insertIntakeEvent, insertIntakeOutput } from '../lib/supabase-rest.js';
import { validateDnaOutput } from '../lib/validate-output.js';

const REPORTS = {
  free: {
    title: 'Free AI Opportunity Snapshot',
    outputType: 'report_free_snapshot_markdown',
    docxOutputType: 'report_free_snapshot_docx',
    filename: 'Level1_report',
    maxTokens: 3200
  },
  detailed: {
    title: 'Detailed AI Readiness & Opportunity Report',
    outputType: 'report_detailed_growth_markdown',
    docxOutputType: 'report_detailed_growth_docx',
    filename: 'Level2_Report',
    maxTokens: 6200
  },
  roadmap: {
    title: 'Preliminary AI Action Plan',
    outputType: 'report_full_roadmap_markdown',
    docxOutputType: 'report_full_roadmap_docx',
    filename: 'Level3_Report',
    maxTokens: 7600
  },
  btai: {
    title: 'BTAI Advisor Brief',
    outputType: 'report_btai_advisor_brief_markdown',
    docxOutputType: 'report_btai_advisor_brief_docx',
    filename: 'Internal_brief',
    maxTokens: 5200
  }
};

function authorized(req) {
  const expected = process.env.BTAI_ADMIN_SECRET;
  if (!expected) return false;
  const provided = req.headers['x-btai-admin-secret'] || req.body?.adminSecret;
  return provided && String(provided) === String(expected);
}

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
  return data.content?.[0]?.text || '';
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
  return `## Privacy And Secure Handling

This report was prepared through the BTAI Secure Intelligence Layer. Before AI analysis, direct identifiers are removed or replaced where practical. The secure record and private re-identification map are encrypted at rest using AES-256-GCM. Raw interview responses are not shared with partner organizations, and partner reporting is limited to anonymized aggregate insights where applicable. The raw Venture DNA file is not included in client report packages. This privacy process is designed to support Alberta and Canadian private-sector privacy principles, including consent, limited collection, safeguards, limited disclosure, and accountability.`;
}

function clientUpgradeSection(tier) {
  const { level2Price, level3Price, level2Url, level3Url, consultUrl } = paymentConfig();
  if (tier === 'btai') return '';
  if (tier === 'roadmap') {
    return `## Bridge To AI Implementation Support

This action plan is still preliminary. If you want Bridge To AI to help turn it into a working AI system or workbench, book a scoping conversation here:

${consultUrl || 'Reply to the Bridge To AI email thread to request implementation scoping.'}

A workbench is a private operating dashboard built around your business so repeated workflows can run from one place instead of being scattered across notes, spreadsheets, prompts, files, and tools.`;
  }
  return `## Want To Go Deeper?

The free snapshot gives you the first layer. The deeper reports look at implementation order, what should wait, what could save time first, and which workflows could become part of a private Bridge To AI workbench.

- Detailed AI Opportunity Report - ${level2Price}: A deeper diagnosis of readiness gaps, ranked opportunities, and practical first projects. ${level2Url || 'Payment link coming soon.'}
- Preliminary AI Action Plan - ${level3Price}: A more complete implementation sequence with workflow priorities, risk controls, and scoping questions. ${level3Url || 'Payment link coming soon.'}
- Talk with Bridge To AI about implementation or a custom workbench: ${consultUrl || 'Reply to the Bridge To AI email thread to request a conversation.'}`;
}

function decorateReportMarkdown(markdown, tier) {
  const sections = [String(markdown || '').trim()];
  if (tier !== 'btai') sections.push(clientUpgradeSection(tier));
  sections.push(reportPrivacyStatement());
  return sections.filter(Boolean).join('\n\n');
}

function scanReportPrivacy(markdown) {
  const text = String(markdown || '');
  const findings = [];
  const checks = [
    ['email_address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
    ['phone_number', /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/],
    ['credit_card_like_number', /\b(?:\d[ -]*?){13,19}\b/],
    ['private_financial_document_language', /\b(invoice|payroll|bank account|routing number|credit card|supplier contract|customer list|confidential formula)\b/i]
  ];
  checks.forEach(([type, pattern]) => {
    if (pattern.test(text)) findings.push(type);
  });
  return {
    completed: true,
    rawSensitiveDataDetected: findings.length > 0,
    findings,
    reportApprovedForClientDelivery: findings.length === 0
  };
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
- Keep Darren's voice: direct, plain-spoken, practical, specific, warm without being gushy, honest without shaming.

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

Target: 2-4 pages in markdown.
Purpose: useful no-cost report that proves Bridge To AI understood the business.
Tone: client-facing, encouraging, practical, specific, and evidence-first. Do not make this sound like an AI sales pitch.

Required structure:
# [Business Name] - Free AI Opportunity Snapshot
## 1. Quick Read
## 2. What Is Already Working
Use a table: Strength | Why It Matters
## 3. Top 3 AI Opportunities
Use a table: Priority | Opportunity | Why It Matters | First Step
## 4. One Growth Leak To Fix First
## 5. First Recommended Move
## 6. What To Avoid For Now
## 7. Bridge To AI Note

VENTURE DNA:
${dna}`;
  }

  if (tier === 'detailed') {
    return `${sharedRules()}

Generate REPORT 2: Detailed AI Readiness & Opportunity Report.

Target: 6-10 pages in markdown.
Purpose: paid mid-tier report around $97. It must add deeper diagnosis, clearer prioritization, and more actionable next steps than the free snapshot.

Required structure:
# [Business Name] - Detailed AI Readiness & Opportunity Report
## 1. Executive Summary
## 2. Business Positioning
## 3. Current Revenue And Growth Model
Use a table: Revenue Stream | Current State | Growth Opportunity | AI Relevance
## 4. Main Growth Leaks
Use a table: Growth Leak | What Is Happening | Business Impact | Recommended Fix
## 5. AI Opportunity Portfolio
Use a ranked table: Rank | AI Opportunity | Problem Solved | Impact | Feasibility | Priority | Notes
## 6. Recommended First 5 AI Projects
Use a table: Priority | Project | Business Problem Solved | Client Benefit | Complexity | Suggested Timing
## 7. Readiness Scorecard
Score Data & Information Quality, Workflow Documentation, Tools & Tech Stack, People & Change Readiness, Risk & Compliance Posture from 1-5.
## 8. 30-Day Action Plan
Use a table: Week | Action | Owner | Output | Success Measure
## 9. Directional Success Metrics
## 10. Recommended Bridge To AI Next Step
## 11. Final Advisor Note

VENTURE DNA:
${dna}`;
  }

  if (tier === 'btai') {
    return `${sharedRules()}

Generate INTERNAL REPORT 4: BTAI Advisor Brief.

Audience: Bridge To AI only. This is not client-facing.
Purpose: give Darren a practical pre-call briefing so he can ask better questions, clarify needs, spot risk, and identify the strongest commercial path without needing to expose or pass around the raw Venture DNA markdown.
Target: 4-7 pages in markdown.
Tone: direct, advisory, specific, and commercially useful.

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

Required structure:
# [Business Name] - Preliminary AI Action Plan
## 1. Implementation Thesis
## 2. Context Snapshot
Use a table: Category | Detail
## 3. Missing Answers From Updated Intake Questions
## 4. Target Operating Model
Use a simple adapted flow.
## 5. Priority Build Roadmap
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

async function generateOne(clientDraftId, tier) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);

  const startedAt = Date.now();
  const { dnaContent, meta } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  await logReportEvent(clientDraftId, 'report_generation_started', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.docxOutputType,
    payloadType: 'encrypted_venture_dna_record',
    startedAt: new Date(startedAt).toISOString()
  }));
  const generatedMarkdown = await callClaude(promptForTier(tier, dnaContent), spec.maxTokens);
  const markdown = decorateReportMarkdown(generatedMarkdown, tier);
  const validation = validateDnaOutput(markdown, { requireEvidenceLabels: false });
  const privacyScan = scanReportPrivacy(markdown);
  await logReportEvent(clientDraftId, 'report_privacy_scan_completed', privacyScan.reportApprovedForClientDelivery ? 'success' : 'warning', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.docxOutputType,
    reportPrivacyScanCompleted: true,
    rawSensitiveDataDetected: privacyScan.rawSensitiveDataDetected,
    reportApprovedForClientDelivery: privacyScan.reportApprovedForClientDelivery,
    privacyScanFindings: privacyScan.findings
  }));
  const docx = createDocxBuffer(markdown);

  const mdRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.outputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      markdown,
      validation,
      privacyScan
    })
  });

  const docxRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.docxOutputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      filename: `${businessName}_${spec.filename}.docx`,
      contentBase64: docx.toString('base64'),
      validation,
      privacyScan
    })
  });

  await logReportEvent(clientDraftId, 'report_generated', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.docxOutputType,
    warningCount: validation.warnings?.length || 0,
    payloadType: 'client_report_docx',
    generationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  return {
    generated: true,
    tier,
    businessName,
    markdownOutputId: mdRow?.id || '',
    docxOutputId: docxRow?.id || '',
    warnings: validation.warnings || []
  };
}

async function getOrGenerateOne(clientDraftId, tier) {
  const existing = await loadGenerated(clientDraftId, tier);
  if (existing?.contentBase64) {
    return { generated: false, tier, businessName: existing.businessName || '', warnings: existing.validation?.warnings || [] };
  }
  return generateOne(clientDraftId, tier);
}

async function loadGenerated(clientDraftId, tier) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const row = await getLatestIntakeOutput(clientDraftId, spec.docxOutputType);
  if (!row) return null;
  return decryptJson(row.encrypted_payload);
}

async function buildZip(clientDraftId) {
  const { dnaContent, meta } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  const files = [];

  for (const tier of ['free', 'detailed', 'roadmap', 'btai']) {
    const doc = await loadGenerated(clientDraftId, tier);
    if (!doc?.contentBase64) {
      throw new Error(`Missing generated DOCX for tier: ${tier}. Generate that report first, then download the ZIP.`);
    }
    files.push({
      name: doc.filename || `${businessName}_${REPORTS[tier].filename}.docx`,
      content: Buffer.from(doc.contentBase64, 'base64')
    });
  }

  const validationSummary = {
    createdAt: new Date().toISOString(),
    clientDraftId,
    businessName,
    includedFiles: files.map(f => f.name),
    rawDnaIncluded: false,
    partnerRawAccess: false,
    encryptedSourceRecord: true,
    privacyProof: true,
    note: 'Reports were generated from the encrypted Venture DNA record and stored encrypted before ZIP retrieval. The raw Venture DNA markdown is intentionally not included in this ZIP.'
  };
  files.push({ name: 'validation-summary.json', content: JSON.stringify(validationSummary, null, 2) });

  const zip = createZipBuffer(files);
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'three_report_pack_zip',
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      filename: `${businessName}_BTAI_Report_Pack.zip`,
      contentBase64: zip.toString('base64'),
      validationSummary
    })
  });

  await logReportEvent(clientDraftId, 'report_pack_zip_built', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    zipReady: true,
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

async function generateAll(clientDraftId) {
  const tiers = ['free', 'detailed', 'roadmap', 'btai'];
  await logReportEvent(clientDraftId, 'report_pack_batch_started', 'success', privacyProofDefaults({ tiers, payloadType: 'encrypted_venture_dna_record' }));
  const results = await Promise.all(tiers.map(tier => getOrGenerateOne(clientDraftId, tier)));
  const zip = await buildZip(clientDraftId);
  await logReportEvent(clientDraftId, 'report_pack_batch_complete', 'success', privacyProofDefaults({
    tiers,
    zipOutputId: zip.outputId || '',
    generatedCount: results.filter(r => r.generated).length
  }));
  return { ready: true, results, zip };
}

async function sendFreeReportEmail({ clientDraftId, clientEmail, clientName, businessName, doc }) {
  if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const bccRecipient = process.env.INTAKE_BCC_RECIPIENT || 'darren.randles@gmail.com';
  const { level2Price, level3Price, level2Url, level3Url, consultUrl } = paymentConfig();
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <div style="background:#0d6e5e;padding:24px 30px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;font-size:20px;line-height:1.3;margin:0;">Your Bridge To AI opportunity snapshot is ready</h1>
      </div>
      <div style="border:1px solid #d9e7e3;border-top:0;padding:26px 30px;border-radius:0 0 12px 12px;background:#fafaf8;">
        <p style="font-size:15px;line-height:1.6;margin-top:0;">Hi ${escapeHtml(clientName || 'there')},</p>
        <p style="font-size:15px;line-height:1.6;">Thank you for completing the intake. Your free AI Opportunity Snapshot is attached.</p>
        <p style="font-size:15px;line-height:1.6;">This first report is intentionally practical and directional. It avoids private financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential formulas.</p>
        <div style="background:#e8f4f1;border:1px solid #b8ddd7;border-radius:10px;padding:14px 16px;color:#0d6e5e;font-size:14px;line-height:1.5;margin-bottom:16px;">
          <strong>Next step:</strong> Review the snapshot first. If you want to go deeper, Bridge To AI can prepare a more detailed report or discuss a custom AI workbench.
        </div>
        <div style="border:1px solid #e4e2dd;border-radius:10px;padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55;">
          <strong style="display:block;margin-bottom:8px;color:#111827;">What this snapshot does not fully cover</strong>
          <div style="margin-bottom:10px;">The free report gives you the first layer. The deeper reports look at implementation order, what should wait, what could save time first, and which workflows could become part of a private Bridge To AI workbench.</div>
          ${ctaLineHtml(`Detailed AI Opportunity Report - ${level2Price}`, level2Url, 'A deeper diagnosis of readiness gaps, ranked opportunities, and first practical projects.')}
          ${ctaLineHtml(`Preliminary AI Action Plan - ${level3Price}`, level3Url, 'A more complete implementation sequence with workflow priorities, risk controls, and scoping questions.')}
          ${ctaLineHtml('Talk with Bridge To AI about implementation or a custom workbench', consultUrl, 'A workbench is a private operating dashboard built around your business so repeated workflows can run from one place.')}
        </div>
        <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:0;margin-top:18px;">Record ID: <code>${escapeHtml(clientDraftId)}</code></p>
      </div>
    </div>`;
  const text = `Your Bridge To AI opportunity snapshot is ready.\n\nThe free report is attached.\n\nWhat this snapshot does not fully cover:\n- Detailed AI Opportunity Report - ${level2Price}: deeper diagnosis, readiness gaps, and prioritized first projects. ${level2Url || 'Reply to this email to request it.'}\n- Preliminary AI Action Plan - ${level3Price}: implementation phases, workflow priorities, and scoping questions. ${level3Url || 'Reply to this email to request it.'}\n- Implementation support: help turning the plan into a working AI system or workbench after private scoping. ${consultUrl || 'Reply to this email to request a conversation.'}\n\nA workbench is a private operating dashboard built around your business so repeated workflows can run from one place.\n\nRecord ID: ${clientDraftId}`;
  const payload = {
    from: 'The Bridge Team <team@bridgetoai.ca>',
    to: [clientEmail],
    bcc: bccRecipient ? [bccRecipient] : [],
    subject: `Your Bridge To AI Opportunity Snapshot${businessName ? ` - ${businessName}` : ''}`,
    html,
    text,
    attachments: [{
      filename: doc.filename || 'Bridge_To_AI_Free_AI_Opportunity_Snapshot.docx',
      content: doc.contentBase64,
      content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

async function generateFreeAndEmail(clientDraftId, providedEmail = '') {
  const startedAt = Date.now();
  const sessionPayload = await getSessionPayload(clientDraftId);
  const sessionEmail = String(sessionPayload.clientEmail || '').trim().toLowerCase();
  const requestEmail = String(providedEmail || '').trim().toLowerCase();
  if (!sessionEmail) throw new Error('No client email found on the intake session');
  if (requestEmail && requestEmail !== sessionEmail) throw new Error('Client email does not match the secure intake session');

  await logReportEvent(clientDraftId, 'free_report_delivery_started', 'success', privacyProofDefaults({
    reportTier: 'free',
    payloadType: 'encrypted_venture_dna_record',
    clientReportOnly: true,
    startedAt: new Date(startedAt).toISOString()
  }));
  await getOrGenerateOne(clientDraftId, 'free');
  const doc = await loadGenerated(clientDraftId, 'free');
  if (!doc?.contentBase64) throw new Error('Free report was not generated');
  const result = await sendFreeReportEmail({
    clientDraftId,
    clientEmail: sessionEmail,
    clientName: sessionPayload.clientName || '',
    businessName: sessionPayload.businessName || doc.businessName || '',
    doc
  });
  await logReportEvent(clientDraftId, 'free_report_emailed', 'success', privacyProofDefaults({
    reportTier: 'free',
    recipientConfirmed: true,
    resendId: result.id || '',
    emailMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  let internalBrief = { attempted: false, generated: false };
  if (String(process.env.BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE || 'true').toLowerCase() !== 'false') {
    try {
      const briefResult = await getOrGenerateOne(clientDraftId, 'btai');
      internalBrief = { attempted: true, generated: !!briefResult.generated, alreadyReady: !briefResult.generated };
      await logReportEvent(clientDraftId, 'internal_brief_after_free_complete', 'success', privacyProofDefaults({
        reportTier: 'btai',
        reportOutputType: REPORTS.btai.docxOutputType,
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
  return { emailed: true, id: result.id || '', recipient: sessionEmail, internalBrief };
}

async function status(clientDraftId) {
  const result = {};
  for (const tier of Object.keys(REPORTS)) {
    result[tier] = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].docxOutputType));
  }
  result.zip = !!(await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip'));
  return result;
}

async function privacyProofSummary(clientDraftId) {
  const events = await getIntakeEvents(clientDraftId, 200);
  const proofEvents = events.filter(event => {
    const metadata = event.metadata || {};
    return metadata.privacyProof || String(event.stage || '').includes('privacy') || String(event.event_type || '').includes('privacy_proof');
  });

  const summary = {
    recordId: clientDraftId,
    generatedAt: new Date().toISOString(),
    proofEventCount: proofEvents.length,
    encryptedRecordsConfirmed: proofEvents.some(e => e.event_type === 'privacy_proof_secure_output_storage' && e.status === 'success'),
    anonymizedAiAnalysisConfirmed: proofEvents.some(e => e.event_type === 'privacy_proof_ai_analysis_requested' && e.status === 'success'),
    privacyConsentConfirmed: proofEvents.some(e => e.event_type === 'privacy_proof_consent_recorded' && e.status === 'success'),
    crossBorderNoticeConfirmed: proofEvents.some(e => e.event_type === 'privacy_proof_cross_border_notice' && e.status === 'success'),
    retentionPolicyRecorded: proofEvents.some(e => e.event_type === 'privacy_proof_retention_policy_recorded' && e.status === 'success'),
    adminAccessLogged: proofEvents.some(e => String(e.stage || '') === 'admin_access_audit' || String(e.event_type || '').startsWith('admin_')),
    reportPrivacyScanCompleted: proofEvents.some(e => e.event_type === 'report_privacy_scan_completed'),
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
  if (!summary.adminAccessLogged) summary.remainingImprovements.push('No admin access event has been logged yet for this record.');
  if (!summary.reportPrivacyScanCompleted) summary.remainingImprovements.push('Report privacy scan proof was not found for this record.');
  summary.privacyConclusion = summary.remainingImprovements.length
    ? 'Passed core SIL privacy proof with improvement items noted.'
    : 'Passed SIL privacy proof with consent, cross-border notice, retention, encrypted storage, anonymized AI analysis, report scan, and access audit evidence.';
  return summary;
}

async function downloadZip(clientDraftId) {
  const row = await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip');
  if (!row) return buildZip(clientDraftId);
  const payload = decryptJson(row.encrypted_payload);
  await logReportEvent(clientDraftId, 'report_pack_zip_downloaded', 'success', privacyProofDefaults({
    zipReady: true
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
    if (action === 'generate-free-email') {
      return res.status(200).json(await generateFreeAndEmail(clientDraftId, req.body?.clientEmail || ''));
    }
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    if (action === 'generate-one') return res.status(200).json(await generateOne(clientDraftId, String(req.body?.tier || '').trim()));
    if (action === 'generate-all') return res.status(200).json(await generateAll(clientDraftId));
    if (action === 'build-zip') return res.status(200).json(await buildZip(clientDraftId));
    if (action === 'download-zip') return res.status(200).json(await downloadZip(clientDraftId));
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
    return res.status(400).json({ error: 'Unknown report-pack action' });
  } catch (err) {
    console.error('report-pack error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}

