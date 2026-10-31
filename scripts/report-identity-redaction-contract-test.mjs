#!/usr/bin/env node

import assert from 'node:assert/strict';
import { callClaude } from '../api/report-pack.js';
import { reidentify, retokenizeWithMapping } from '../lib/identity-redaction.js';

const mapping = {
  '[OWNER_NAME]': 'Darren Randles',
  '[BUSINESS_NAME]': 'Acme Foods',
  '[EMAIL_1]': 'owner@example.test',
  '[WEBSITE_URL]': 'https://acme.example.test'
};
const rawDna = 'Darren Randles runs Acme Foods. Contact owner@example.test or https://acme.example.test.';
const tokenized = retokenizeWithMapping(rawDna, mapping);
assert.doesNotMatch(tokenized, /Darren Randles|Acme Foods|owner@example\.test|acme\.example\.test/i, 'report source is retokenized before model analysis');

const originalFetch = globalThis.fetch;
const originalKey = process.env.ANTHROPIC_API_KEY;
let captured = '';
process.env.ANTHROPIC_API_KEY = 'synthetic-test-key';
globalThis.fetch = async (_url, options) => {
  captured = options.body;
  return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Report for [OWNER_NAME] at [BUSINESS_NAME].' }] }) };
};
try {
  const modelOutput = await callClaude(tokenized, 100);
  assert.doesNotMatch(captured, /Darren Randles|Acme Foods|owner@example\.test|acme\.example\.test/i, 'captured model request contains no raw identifiers');
  assert.match(captured, /\[OWNER_NAME\]|\[BUSINESS_NAME\]/, 'captured model request uses placeholders');
  assert.equal(reidentify(modelOutput, mapping), 'Report for Darren Randles at Acme Foods.', 'participant report restores placeholders after model output');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
}

console.log('report identity redaction contract tests passed');
