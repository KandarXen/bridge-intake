#!/usr/bin/env node

import assert from 'node:assert/strict';
import { callClaude } from '../api/report-pack.js';
import { reidentify, retokenizeWithMapping } from '../lib/identity-redaction.js';
import { getIntakeOutputById } from '../lib/supabase-rest.js';

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
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SECRET_KEY;
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

let scopedUrl = '';
process.env.SUPABASE_URL = 'https://example.supabase.test';
process.env.SUPABASE_SECRET_KEY = 'synthetic-supabase-key';
globalThis.fetch = async url => {
  scopedUrl = String(url);
  return { ok: true, status: 200, text: async () => '[]' };
};
try {
  await getIntakeOutputById('mapping-1', { clientDraftId: 'draft-1', outputType: 'hermes_reidentification_map' });
  assert.match(scopedUrl, /client_draft_id=eq.draft-1/, 'map lookup is scoped to its draft');
  assert.match(scopedUrl, /output_type=eq.hermes_reidentification_map/, 'map lookup is scoped to the re-identification output type');
} finally {
  globalThis.fetch = originalFetch;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSupabaseKey;
}

console.log('report identity redaction contract tests passed');
