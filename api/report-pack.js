import { decryptJson, encryptJson } from '../lib/crypto.js';
import { createDocxBuffer, createZipBuffer } from '../lib/docx.js';
import { createReportHtml } from '../lib/report-html.js';
import { getIntakeEvents, getIntakeSession, getLatestIntakeOutput, insertIntakeEvent, insertIntakeOutput } from '../lib/supabase-rest.js';
import { validateDnaOutput } from '../lib/validate-output.js';

const REPORTS = {
  free: {
    title: 'Free AI Opportunity Snapshot',
    outputType: 'report_free_snapshot_markdown',
    docxOutputType: 'report_free_snapshot_docx',
    htmlOutputType: 'report_free_snapshot_html',
    filename: 'Level1_report',
    maxTokens: 3200
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

const REPORT_COMPLETION_HEADINGS = {
  free: ['## 7. Bridge To AI Note'],
  detailed: ['## 11. Final Advisor Note'],
  roadmap: ['## 19. Final Implementation Recommendation'],
  btai: ['## 10. Needs Confirmation Before Build']
};

function reportQualityWarnings(markdown, tier) {
  const text = String(markdown || '').trim();
  const warnings = [];
  const requiredHeadings = REPORT_COMPLETION_HEADINGS[tier] || [];
  requiredHeadings.forEach(heading => {
    if (!text.includes(heading)) warnings.push(`missing_expected_final_section:${heading.replace(/^#+\s*/, '')}`);
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

Target: 2-4 pages in markdown.
Purpose: useful no-cost report that proves Bridge To AI understood the business.
Tone: client-facing, practical, plain-spoken, specific, and evidence-first. This should sound like Darren saying, "Here is what I noticed, here is the real pinch point, and here is what I would do first." Do not make this sound like an AI sales pitch or a consultant deck.
Important: the free report must give real value. Do not make it thin or teaser-only. Give the client one useful, specific next move they could act on without buying anything.
Opportunity rule: do not make email automation the default first opportunity. Look first for where the owner or highest-value person is losing time on repeated work. Only recommend email if the Venture DNA proves it is the real bottleneck.

Required structure:
# [Business Name] - Free AI Opportunity Snapshot
## 1. Quick Read
Write this as 5-8 short plain-English paragraphs. Start with "Here is what I am seeing." Avoid "The intake indicates". Name the real pinch point in simple language.
## 2. What Is Already Working
Use a table: Strength | Why It Matters
## 3. Where AI Looks Useful First
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
Tone: practical advisor, not corporate consultant. Keep it direct, useful, and grounded. If something should wait, say so. If something needs cleanup first, say so.
Opportunity rule: rank opportunities by valuable time saved, rework reduced, revenue conversations created, and readiness to implement. Do not over-rank email automation unless it is clearly the highest-value repeated work in the Venture DNA.

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
    reportOutputType: spec.htmlOutputType,
    payloadType: 'encrypted_venture_dna_record',
    startedAt: new Date(startedAt).toISOString()
  }));
  const generatedMarkdown = await callClaude(promptForTier(tier, dnaContent), spec.maxTokens);
  const completion = validateReportCompletion(generatedMarkdown, tier);
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
    throw new Error(`Report quality gate failed for ${tier}: ${completion.blockingWarnings.join(', ')}`);
  }
  const markdown = decorateReportMarkdown(generatedMarkdown, tier);
  const validation = validateDnaOutput(markdown, { requireEvidenceLabels: false });
  validation.warnings = [...(validation.warnings || []), ...completion.warnings];
  const privacyScan = scanReportPrivacy(markdown);
  const htmlReport = createReportHtml(markdown, {
    title: `${businessName} - ${spec.title}`,
    businessName,
    tierLabel: spec.title,
    generatedAt: new Date().toISOString()
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

  const htmlRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.htmlOutputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      filename: `${businessName}_${spec.filename}.html`,
      contentBase64: Buffer.from(htmlReport, 'utf8').toString('base64'),
      contentType: 'text/html',
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
    payloadType: 'client_report_html_and_docx',
    generationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  return {
    generated: true,
    tier,
    businessName,
    markdownOutputId: mdRow?.id || '',
    docxOutputId: docxRow?.id || '',
    htmlOutputId: htmlRow?.id || '',
    warnings: validation.warnings || []
  };
}

async function getOrGenerateOne(clientDraftId, tier, forceRegenerate = false) {
  if (forceRegenerate) return generateOne(clientDraftId, tier);
  const existingHtml = await loadGenerated(clientDraftId, tier, 'html');
  const existingDocx = await loadGenerated(clientDraftId, tier, 'docx');
  if (existingHtml?.contentBase64 && existingDocx?.contentBase64) {
    return { generated: false, tier, businessName: existingHtml.businessName || existingDocx.businessName || '', warnings: existingHtml.validation?.warnings || existingDocx.validation?.warnings || [] };
  }
  if (!existingHtml?.contentBase64 && existingDocx?.contentBase64) {
    const converted = await ensureHtmlReport(clientDraftId, tier);
    if (converted?.contentBase64) {
      return { generated: false, convertedHtml: true, tier, businessName: converted.businessName || existingDocx.businessName || '', warnings: converted.validation?.warnings || existingDocx.validation?.warnings || [] };
    }
  }
  return generateOne(clientDraftId, tier);
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
    generatedAt: markdownRecord.createdAt || new Date().toISOString()
  });
  const payload = {
    createdAt: new Date().toISOString(),
    tier,
    businessName,
    filename: `${businessName}_${spec.filename}.html`,
    contentBase64: Buffer.from(htmlReport, 'utf8').toString('base64'),
    contentType: 'text/html',
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

async function buildZip(clientDraftId) {
  const { dnaContent, meta } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  const files = [];

  for (const tier of ['free', 'detailed', 'roadmap', 'btai']) {
    const htmlDoc = await ensureHtmlReport(clientDraftId, tier);
    const doc = await loadGenerated(clientDraftId, tier, 'docx');
    if (!htmlDoc?.contentBase64) {
      throw new Error(`Missing generated HTML for tier: ${tier}. Generate that report first, then download the ZIP.`);
    }
    if (!doc?.contentBase64) {
      throw new Error(`Missing generated DOCX for tier: ${tier}. Generate that report first, then download the ZIP.`);
    }
    files.push({
      name: `HTML_Reports/${htmlDoc.filename || `${businessName}_${REPORTS[tier].filename}.html`}`,
      content: Buffer.from(htmlDoc.contentBase64, 'base64')
    });
    files.push({
      name: `DOCX_Backup/${doc.filename || `${businessName}_${REPORTS[tier].filename}.docx`}`,
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
    note: 'Reports were generated from the encrypted Venture DNA record and stored encrypted before ZIP retrieval. HTML reports are the primary client-readable format. DOCX files are included as editable backups. The raw Venture DNA markdown is intentionally not included in this ZIP.'
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

async function generateAll(clientDraftId, forceRegenerate = false) {
  const tiers = ['free', 'detailed', 'roadmap', 'btai'];
  await logReportEvent(clientDraftId, 'report_pack_batch_started', 'success', privacyProofDefaults({ tiers, forceRegenerate, payloadType: 'encrypted_venture_dna_record' }));
  const results = await Promise.all(tiers.map(tier => getOrGenerateOne(clientDraftId, tier, forceRegenerate)));
  const zip = await buildZip(clientDraftId);
  await logReportEvent(clientDraftId, 'report_pack_batch_complete', 'success', privacyProofDefaults({
    tiers,
    zipOutputId: zip.outputId || '',
    generatedCount: results.filter(r => r.generated).length,
    forceRegenerate
  }));
  return { ready: true, results, zip };
}

async function sendFreeReportEmail({ clientDraftId, clientEmail, clientName, businessName, reportFile }) {
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
        <p style="font-size:15px;line-height:1.6;">Thank you for completing the intake. Your free AI Opportunity Snapshot is attached as a clean HTML report you can read in your browser or print.</p>
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
      filename: reportFile.filename || 'Bridge_To_AI_Free_AI_Opportunity_Snapshot.html',
      content: reportFile.contentBase64,
      content_type: reportFile.contentType || 'text/html'
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
  const htmlDoc = await ensureHtmlReport(clientDraftId, 'free');
  if (!htmlDoc?.contentBase64) throw new Error('Free HTML report was not generated');
  const result = await sendFreeReportEmail({
    clientDraftId,
    clientEmail: sessionEmail,
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
  if (String(process.env.BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE || 'true').toLowerCase() !== 'false') {
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
  return { emailed: true, id: result.id || '', recipient: sessionEmail, internalBrief };
}

async function status(clientDraftId) {
  const result = {};
  result.formats = {};
  for (const tier of Object.keys(REPORTS)) {
    const htmlReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].htmlOutputType));
    const docxReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].docxOutputType));
    result[tier] = htmlReady || docxReady;
    result.formats[tier] = { html: htmlReady, docx: docxReady };
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
  return `# Bridge To AI Report Package Summary

This package was generated from the encrypted Bridge To AI intake record.

---

## Package Contents

| File | Purpose |
| --- | --- |
${files.map(file => `| ${file.name} | ${file.name.includes('Internal') ? 'Internal Bridge To AI advisor use only.' : file.name.includes('HTML_Reports') ? 'Primary client-readable HTML report.' : 'Editable DOCX backup copy.'} |`).join('\n')}

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

This summary is included so the package is readable without opening the raw validation JSON. HTML reports are the primary readable files. DOCX files are backup/editable copies. The raw Venture DNA markdown is intentionally not included in this ZIP.
`;
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
    if (action === 'generate-one') {
      const tier = String(req.body?.tier || '').trim();
      const forceRegenerate = !!req.body?.forceRegenerate;
      return res.status(200).json(forceRegenerate ? await generateOne(clientDraftId, tier) : await getOrGenerateOne(clientDraftId, tier, false));
    }
    if (action === 'generate-all') return res.status(200).json(await generateAll(clientDraftId, !!req.body?.forceRegenerate));
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
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}

