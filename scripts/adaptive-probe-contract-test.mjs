#!/usr/bin/env node

import assert from 'node:assert/strict';
import { probe, masteryFollowup } from '../api/interview-ai.js';

const originalFetch = globalThis.fetch;
let capturedModelBody = '';
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    content: [{ text: JSON.stringify({
      ask_followup: true,
      question_type: 'clarify',
      domain: 'Workflow Friction',
      question: 'About how often does that delay happen in a typical week?',
      why_needed: 'Frequency is missing.',
      sensitivity_level: 'low',
      uses_approved_category: true
    }) }]
  })
});

try {
  const result = await probe({
    domain: 'Workflow Friction',
    qa: 'Question: Where does work slow down?\nAnswer: Sometimes it is slow.',
    businessNiche: 'bookkeeping practice',
    companySize: '6-10',
    sourceQuestionType: 'Bottleneck'
  });
  assert.equal(typeof result.followup, 'object', 'a well-formed model response is parsed into a follow-up object');
  assert.equal(result.followup.ask_followup, true, 'the parsed follow-up preserves the model decision');
  assert.match(result.followup.question, /how often/i, 'the parsed follow-up preserves the model question');

  globalThis.fetch = async (_url, options) => {
    capturedModelBody = options.body;
    return { ok: true, json: async () => ({ content: [{ text: JSON.stringify({ ask_followup: false, question: '' }) }] }) };
  };
  await probe({
    domain: 'Workflow Friction',
    qa: 'Question: What slows down?\nAnswer: Darren Randles at Acme Foods emails owner@example.test.',
    businessNiche: 'Acme Foods',
    identity: { clientName: 'Darren Randles', businessName: 'Acme Foods', clientEmail: 'owner@example.test' }
  });
  assert.doesNotMatch(capturedModelBody, /Darren Randles|Acme Foods|owner@example\.test/i, 'the model-bound probe request excludes known owner, business, and email values');
  assert.match(capturedModelBody, /\[OWNER_NAME\]|\[PERSON_1\]/, 'the model-bound probe request contains placeholders instead');

  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('A quarantined probe must not call the model'); };
  const quarantined = await probe({
    domain: 'Workflow Friction',
    qa: 'Question: What slows down?\nAnswer: Our customer list contains private names and emails.',
    businessNiche: 'bookkeeping practice'
  });
  assert.equal(quarantined.followup, 'NONE', 'a sensitive probe answer is skipped');
  assert.equal(called, false, 'a sensitive probe answer does not reach the model');

  capturedModelBody = '';
  globalThis.fetch = async (_url, options) => {
    capturedModelBody = options.body;
    return { ok: true, json: async () => ({ content: [{ text: 'What would change if that step were easier?' }] }) };
  };
  await masteryFollowup({
    area: 'payroll review',
    answer: 'Darren Randles checks the $8,250 payroll adjustment with Sarah Nguyen.',
    businessNiche: 'bookkeeping practice',
    identity: { clientName: 'Darren Randles' }
  });
  assert.doesNotMatch(capturedModelBody, /Darren Randles|Sarah Nguyen|8,250/i, 'the mastery model request excludes raw names and sensitive amount');
  assert.match(capturedModelBody, /\[ANONYMIZED_PERSON\]|\[OWNER_NAME\]|\[PERSON_DETECTED_1\]/, 'the mastery request contains identity placeholders');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('adaptive probe contract tests passed');
