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
    businessCategory: String(body.businessCategory || '').slice(0, 160),
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
      departments: Array.isArray(details.departments) ? details.departments.slice(0, 20).map(v => String(v).slice(0, 80)) : undefined,
      section: details.section ? String(details.section).slice(0, 160) : undefined,
      durationSeconds: Number.isFinite(details.durationSeconds) ? details.durationSeconds : undefined,
      questionCount: Number.isFinite(details.questionCount) ? details.questionCount : undefined,
      totalWordCount: Number.isFinite(details.totalWordCount) ? details.totalWordCount : undefined,
      repetitiveProbe: typeof details.repetitiveProbe === 'boolean' ? details.repetitiveProbe : undefined,
      autosaveTarget: details.autosaveTarget ? String(details.autosaveTarget).slice(0, 120) : undefined,
      draftSaved: typeof details.draftSaved === 'boolean' ? details.draftSaved : undefined,
      privacyAnonymized: typeof details.privacyAnonymized === 'boolean' ? details.privacyAnonymized : undefined,
      anonymizationReplacements: Number.isFinite(details.anonymizationReplacements) ? details.anonymizationReplacements : undefined,
      driveSaved: typeof details.driveSaved === 'boolean' ? details.driveSaved : undefined,
      driveReason: details.driveReason ? String(details.driveReason).slice(0, 400) : undefined,
      emailDelivered: typeof details.emailDelivered === 'boolean' ? details.emailDelivered : undefined,
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
      domain: event.domain,
      answer_word_count: event.answerWordCount,
      metadata: event
    });

    return res.status(200).json({ logged: true, id: row?.id || '' });
  } catch (err) {
    console.error('hermes-log error:', err);
    return res.status(200).json({ logged: false, reason: err.message });
  }
}

