import { decryptJson, encryptJson } from '../lib/crypto.js';
import { createDocxBuffer, createZipBuffer } from '../lib/docx.js';
import { getLatestIntakeOutput, insertIntakeOutput } from '../lib/supabase-rest.js';
import { validateDnaOutput } from '../lib/validate-output.js';

const REPORTS = {
  free: {
    title: 'Free AI Opportunity Snapshot',
    outputType: 'report_free_snapshot_markdown',
    docxOutputType: 'report_free_snapshot_docx',
    filename: '0-Free_AI_Opportunity_Snapshot',
    maxTokens: 3200
  },
  detailed: {
    title: 'Detailed AI Growth Report',
    outputType: 'report_detailed_growth_markdown',
    docxOutputType: 'report_detailed_growth_docx',
    filename: '1-Detailed_AI_Growth_Report',
    maxTokens: 6200
  },
  roadmap: {
    title: 'Full AI Implementation Roadmap',
    outputType: 'report_full_roadmap_markdown',
    docxOutputType: 'report_full_roadmap_docx',
    filename: '2-Full_AI_Implementation_Roadmap',
    maxTokens: 7600
  },
  btai: {
    title: 'BTAI Advisor Brief',
    outputType: 'report_btai_advisor_brief_markdown',
    docxOutputType: 'report_btai_advisor_brief_docx',
    filename: '3-BTAI_Advisor_Brief_Internal',
    maxTokens: 5200
  }
};

function authorized(req) {
  const expected = process.env.BTAI_ADMIN_SECRET;
  if (!expected) return false;
  const provided = req.headers['x-btai-admin-secret'] || req.body?.adminSecret;
  return provided && String(provided) === String(expected);
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
    outputId: output.id,
    createdAt: output.created_at
  };
}

function sharedRules() {
  return `SOURCE OF TRUTH RULES:
- Use only the supplied Venture DNA markdown as source material.
- Do not invent facts, numbers, tools, revenue, team size, customer segments, timelines, pricing, workflow details, risks, client capabilities, or business claims.
- If information is missing, mark it as Needs Confirmation.
- Every inferred statement must be labeled exactly: [INFERRED].
- Do not present inferred information as confirmed fact.
- Every meaningful paragraph must include at least one concrete detail from the Venture DNA file.
- The client is the hero. Bridge To AI is the guide.
- Avoid generic AI writing patterns, hype, and consultant filler.
- Keep Darren's voice: direct, plain-spoken, practical, specific, warm without being gushy, honest without shaming.`;
}

function promptForTier(tier, dna) {
  if (tier === 'free') {
    return `${sharedRules()}

Generate REPORT 1: Free AI Opportunity Snapshot.

Target: 2-4 pages in markdown.
Purpose: useful no-cost report that proves Bridge To AI understood the business.
Tone: client-facing, encouraging, practical, and specific.

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

Generate REPORT 2: Detailed AI Growth Report.

Target: 6-10 pages in markdown.
Purpose: paid mid-tier report around $97. It must add deeper diagnosis, clearer prioritization, and more actionable next steps than the free snapshot.

Required structure:
# [Business Name] - Detailed AI Growth Report
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
## 9. Success Metrics
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

Generate REPORT 3: Full AI Implementation Roadmap.

Target: 10-18 pages in markdown.
Purpose: premium implementation roadmap around $297. It must give a practical implementation sequence a non-technical business owner could act on.

Required structure:
# [Business Name] - Full AI Implementation Roadmap
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
## 16. Success Metrics And ROI Tracking
## 17. Questions To Confirm Before Build
## 18. Consulting Handoff Recommendation
## 19. Final Implementation Recommendation

VENTURE DNA:
${dna}`;
}

async function generateOne(clientDraftId, tier) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error('Unknown report tier');

  const { dnaContent } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  const markdown = await callClaude(promptForTier(tier, dnaContent), spec.maxTokens);
  const validation = validateDnaOutput(markdown, { requireEvidenceLabels: false });
  const docx = createDocxBuffer(markdown);

  const mdRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.outputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      markdown,
      validation
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
      validation
    })
  });

  return {
    generated: true,
    tier,
    businessName,
    markdownOutputId: mdRow?.id || '',
    docxOutputId: docxRow?.id || '',
    warnings: validation.warnings || []
  };
}

async function loadGenerated(clientDraftId, tier) {
  const spec = REPORTS[tier];
  const row = await getLatestIntakeOutput(clientDraftId, spec.docxOutputType);
  if (!row) return null;
  return decryptJson(row.encrypted_payload);
}

async function buildZip(clientDraftId) {
  const { dnaContent } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  const files = [];

  for (const tier of ['free', 'detailed', 'roadmap', 'btai']) {
    const doc = await loadGenerated(clientDraftId, tier);
    if (!doc?.contentBase64) throw new Error(`Missing generated DOCX for tier: ${tier}`);
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

  return {
    ready: true,
    outputId: row?.id || '',
    filename: `${businessName}_BTAI_Report_Pack.zip`,
    contentBase64: zip.toString('base64')
  };
}

async function status(clientDraftId) {
  const result = {};
  for (const tier of Object.keys(REPORTS)) {
    result[tier] = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].docxOutputType));
  }
  result.zip = !!(await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip'));
  return result;
}

async function downloadZip(clientDraftId) {
  const row = await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip');
  if (!row) return buildZip(clientDraftId);
  const payload = decryptJson(row.encrypted_payload);
  return {
    ready: true,
    outputId: row.id,
    filename: payload.filename,
    contentBase64: payload.contentBase64
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const action = String(req.body?.action || '').trim();
  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
    if (action === 'generate-one') return res.status(200).json(await generateOne(clientDraftId, String(req.body?.tier || '').trim()));
    if (action === 'build-zip') return res.status(200).json(await buildZip(clientDraftId));
    if (action === 'download-zip') return res.status(200).json(await downloadZip(clientDraftId));
    if (action === 'status') return res.status(200).json({ status: await status(clientDraftId) });
    return res.status(400).json({ error: 'Unknown report-pack action' });
  } catch (err) {
    console.error('report-pack error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
