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
} finally {
  globalThis.fetch = originalFetch;
}

console.log('adaptive probe contract tests passed');
