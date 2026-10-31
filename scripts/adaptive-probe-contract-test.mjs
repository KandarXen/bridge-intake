#!/usr/bin/env node

import assert from 'node:assert/strict';
import { probe } from '../api/interview-ai.js';

const originalFetch = globalThis.fetch;
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

  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('A quarantined probe must not call the model'); };
  const quarantined = await probe({
    domain: 'Workflow Friction',
    qa: 'Question: What slows down?\nAnswer: Our customer list contains private names and emails.',
    businessNiche: 'bookkeeping practice'
  });
  assert.equal(quarantined.followup, 'NONE', 'a sensitive probe answer is skipped');
  assert.equal(called, false, 'a sensitive probe answer does not reach the model');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('adaptive probe contract tests passed');
