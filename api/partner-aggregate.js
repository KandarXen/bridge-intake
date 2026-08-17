import { createReportHtml } from '../lib/report-html.js';
import { getPartnerKpiEvents } from '../lib/supabase-rest.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';

function safeName(value) {
  return String(value || 'AFPA')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'AFPA';
}

function pct(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function avg(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function duration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 'Not enough data';
  const mins = Math.round(n / 60);
  return mins < 1 ? `${Math.round(n)} seconds` : `${mins} minutes`;
}

function countBy(rows, key) {
  const counts = new Map();
  rows.forEach(row => {
    const value = String(row[key] || '').trim() || 'Not captured';
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function topRows(rows, key, total, limit = 8) {
  const items = countBy(rows, key).slice(0, limit);
  if (!items.length) return '| No data captured yet | 0 | 0% |';
  return items.map(item => `| ${item.label} | ${item.count} | ${pct(item.count, total)} |`).join('\n');
}

function groupByRecord(events) {
  const map = new Map();
  events.forEach(event => {
    const id = String(event.client_draft_id || '').trim();
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(event);
  });
  return map;
}

function isTestRecord(clientDraftId, recordEvents) {
  const id = String(clientDraftId || '').toLowerCase();
  if (id.includes('test') || id.includes('demo_test') || id.startsWith('completion_test_')) return true;
  return recordEvents.some(event => {
    const type = String(event.event_type || '').toLowerCase();
    const status = String(event.status || '').toLowerCase();
    const metaText = JSON.stringify(event.metadata || {}).toLowerCase();
    return type.includes('test_mode') ||
      type.includes('completion_page_test') ||
      status.includes('test') ||
      metaText.includes('completion page test mode') ||
      metaText.includes('test mode: no report email sent');
  });
}

function excludeTestEvents(events) {
  const excludedIds = new Set();
  for (const [clientDraftId, recordEvents] of groupByRecord(events).entries()) {
    if (isTestRecord(clientDraftId, recordEvents)) excludedIds.add(clientDraftId);
  }
  return {
    events: events.filter(event => !excludedIds.has(String(event.client_draft_id || '').trim())),
    excludedRecordCount: excludedIds.size
  };
}

function latestValue(events, key) {
  for (const event of events) {
    const value = event[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function recordSummaries(events) {
  return Array.from(groupByRecord(events).entries()).map(([clientDraftId, recordEvents]) => {
    const completed = recordEvents.some(event =>
      ['interview_submission_complete', 'interview_completed_answers'].includes(event.event_type) && event.status === 'success'
    );
    const started = recordEvents.some(event => event.event_type === 'interview_started' && event.status === 'success');
    const freeReportSent = recordEvents.some(event => event.event_type === 'free_report_delivery_result' && event.status === 'success');
    const followupYes = recordEvents.some(event => event.btai_followup_interest === 'yes');
    const followupMaybe = recordEvents.some(event => event.btai_followup_interest === 'maybe');
    const completionRows = recordEvents.filter(event => ['interview_submission_complete', 'interview_completed_answers'].includes(event.event_type));
    const completion = completionRows[0] || recordEvents[0] || {};
    return {
      clientDraftId,
      started,
      completed,
      freeReportSent,
      followupYes,
      followupMaybe,
      business_category: latestValue(recordEvents, 'business_category') || 'Not captured',
      business_niche: latestValue(recordEvents, 'business_niche') || 'Not captured',
      company_size: latestValue(recordEvents, 'company_size') || 'Not captured',
      share_comfort: latestValue(recordEvents, 'share_comfort') || 'Not captured',
      owner_work_status: latestValue(recordEvents, 'owner_work_status') || 'Not captured',
      average_words_per_answer: completion.average_words_per_answer,
      short_answer_rate: completion.short_answer_rate,
      answered_prompt_count: completion.answered_prompt_count,
      generated_probe_count: completion.generated_probe_count,
      answered_probe_count: completion.answered_probe_count,
      duration_seconds: completion.duration_seconds
    };
  });
}

function educationRecommendations(summary) {
  const lines = [];
  if (summary.avgShortAnswerRate !== null && summary.avgShortAnswerRate >= 0.35) {
    lines.push('| Getting better business input from AI | Many members are giving short answers, so training should show how to describe a workflow, constraint, and desired result without exposing confidential details. |');
  }
  if (summary.generatedProbeTotal > 0) {
    lines.push('| Practical AI scoping | Adaptive follow-ups are being triggered, which means members often need help turning vague pain into clear use cases. |');
  }
  if (summary.lowComfortCount > 0) {
    lines.push('| Trust, privacy, and safe use | Some members are cautious about what to share. AFPA training should include what not to put into AI tools and how secure workflows are structured. |');
  }
  lines.push('| Workflow-first AI adoption | Teach members to find repeated work, stuck revenue, admin drag, and data cleanup needs before buying tools. |');
  lines.push('| Build-now vs clean-up-first decisions | Members need help understanding when AI is appropriate and when messy data or undocumented processes should be cleaned up first. |');
  return lines.join('\n');
}

function aggregateReportMarkdown({ partner, campaign, days, events, excludedRecordCount = 0 }) {
  const records = recordSummaries(events);
  const completed = records.filter(record => record.completed);
  const totalRecords = records.length;
  const completedCount = completed.length;
  const startedCount = records.filter(record => record.started).length;
  const freeSentCount = records.filter(record => record.freeReportSent).length;
  const followupYesCount = records.filter(record => record.followupYes).length;
  const followupMaybeCount = records.filter(record => record.followupMaybe).length;
  const avgDuration = avg(completed.map(record => record.duration_seconds));
  const avgWords = avg(completed.map(record => record.average_words_per_answer));
  const avgShortAnswerRate = avg(completed.map(record => record.short_answer_rate));
  const generatedProbeTotal = completed.reduce((sum, record) => sum + (Number(record.generated_probe_count) || 0), 0);
  const answeredProbeTotal = completed.reduce((sum, record) => sum + (Number(record.answered_probe_count) || 0), 0);
  const lowComfortCount = records.filter(record => /low|cautious|limited/i.test(record.share_comfort || '')).length;
  const summary = { avgShortAnswerRate, generatedProbeTotal, lowComfortCount };

  return `# ${partner} Aggregate AI Intake Intelligence Report

## 1. Executive Read

This report summarizes the privacy-safe aggregate signals captured from the ${partner} intake link over the last ${days} days${campaign && campaign.toLowerCase() !== 'all' ? ` for campaign \`${campaign}\`` : ''}. It does not include raw member interviews, business names, client emails, recipes, financials, customer lists, supplier information, payroll details, or individual Venture DNA files.

The purpose is to help ${partner} understand what members appear to need from practical AI education and where Bridge To AI can support members who want deeper implementation help.

## 2. Participation Funnel

| Metric | Count | Rate |
| --- | ---: | ---: |
| Unique intake records observed, after test-data exclusion | ${totalRecords} | 100% |
| Test/demo records excluded | ${excludedRecordCount} | Not included |
| Started interview | ${startedCount} | ${pct(startedCount, totalRecords)} |
| Completed interview | ${completedCount} | ${pct(completedCount, totalRecords)} |
| Free report delivery logged | ${freeSentCount} | ${pct(freeSentCount, completedCount)} |
| Asked to talk about next steps | ${followupYesCount} | ${pct(followupYesCount, completedCount)} |
| Maybe later / send free report first | ${followupMaybeCount} | ${pct(followupMaybeCount, completedCount)} |

## 3. Member Segments Showing Up

| Business Category | Records | Share |
| --- | ---: | ---: |
${topRows(records, 'business_category', totalRecords)}

| Business Niche | Records | Share |
| --- | ---: | ---: |
${topRows(records, 'business_niche', totalRecords)}

| Company Size | Records | Share |
| --- | ---: | ---: |
${topRows(records, 'company_size', totalRecords)}

## 4. Intake Quality And Readiness Signals

| Signal | Aggregate Result | Why AFPA Should Care |
| --- | --- | --- |
| Average interview time | ${duration(avgDuration)} | Shows whether the intake is realistic as a course prerequisite. |
| Average words per answer | ${avgWords === null ? 'Not enough data' : Math.round(avgWords)} | Indicates how much detail members are comfortable providing. |
| Average short-answer rate | ${avgShortAnswerRate === null ? 'Not enough data' : pct(avgShortAnswerRate, 1)} | High short-answer rates suggest members need prompting examples and reassurance. |
| Adaptive follow-ups generated | ${generatedProbeTotal} | Shows where the intake needed more context to avoid shallow recommendations. |
| Adaptive follow-ups answered | ${answeredProbeTotal} | Shows whether members stayed engaged when asked for clarification. |
| Low/cautious sharing comfort signals | ${lowComfortCount} | Helps AFPA plan privacy-first AI education. |

## 5. What Members Appear To Need From AI Education

| Training Theme | Why It Belongs In The Program |
| --- | --- |
${educationRecommendations(summary)}

## 6. Privacy Boundary For Partner Reporting

| Boundary | Status |
| --- | --- |
| Raw member interviews included | No |
| Raw Venture DNA files included | No |
| Business names or contact details included | No |
| Individual answers included | No |
| Partner report uses aggregate KPI signals only | Yes |
| Member-level follow-up handled by Bridge To AI consent path | Yes |

## 7. Recommended Next Conversation With ${partner}

1. Confirm which member segments ${partner} most wants to support first.
2. Ask whether ${partner} wants one aggregate report before the December course, multiple progress reports, or a final post-intake education plan.
3. Ask whether ${partner} wants to add 2-4 partner-specific questions for course planning.
4. Confirm the minimum sample size ${partner} is comfortable reporting on before showing segmented results.
5. Define the commercial arrangement for Bridge To AI: setup fee, monthly reporting fee, per-member report revenue, or a blended partner program.

## 8. Notes And Limitations

This report is directional. It reflects only members who used the tagged intake link and only the privacy-safe KPI/event fields captured by the system. It should not be treated as a full market study, legal opinion, or complete member-needs analysis.

Test and completion-page demo records are excluded by default so partner reporting reflects real intake activity as closely as possible.
`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'partner-aggregate', limit: 12, windowMs: 60_000 });
    if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });

    const partner = safeName(req.body?.partner || 'AFPA');
    const campaign = String(req.body?.campaign || 'all').trim() || 'all';
    const days = Math.max(1, Math.min(Number(req.body?.days) || 120, 1095));
    const format = String(req.body?.format || 'markdown').toLowerCase();

    const rawEvents = await getPartnerKpiEvents({ partner, campaign, days });
    const filtered = excludeTestEvents(rawEvents);
    const events = filtered.events;
    const markdown = aggregateReportMarkdown({ partner, campaign, days, events, excludedRecordCount: filtered.excludedRecordCount });
    const generatedAt = new Date().toISOString();
    if (format === 'html') {
      const html = createReportHtml(markdown, {
        title: `${partner} Aggregate AI Intake Intelligence Report`,
        businessName: partner,
        tierLabel: 'Aggregate AI Intake Intelligence Report',
        generatedAt
      });
      return res.status(200).json({
        success: true,
        filename: `${partner}_${campaign}_Aggregate_AI_Intake_Report.html`.replace(/[^a-zA-Z0-9_.-]+/g, '_'),
        content: html,
        contentType: 'text/html',
        eventCount: events.length,
        excludedTestRecordCount: filtered.excludedRecordCount
      });
    }
    return res.status(200).json({
      success: true,
      filename: `${partner}_${campaign}_Aggregate_AI_Intake_Report.md`.replace(/[^a-zA-Z0-9_.-]+/g, '_'),
      markdown,
      eventCount: events.length,
      excludedTestRecordCount: filtered.excludedRecordCount
    });
  } catch (err) {
    console.error('partner-aggregate error:', err);
    return safeError(res, err, 'Could not build partner aggregate report');
  }
}
