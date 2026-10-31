#!/usr/bin/env node

import assert from 'node:assert/strict';
import { anonymizePrompt, buildRecoveryPrompt } from '../api/recover-dna.js';

const current = anonymizePrompt([
  'Owner Name: Test Owner',
  'Business Name: Test Business',
  'Business Description: bookkeeping practice',
  'Website URL: https://example.test'
].join('\n'));

assert.equal(current.mapping['[BUSINESS_DESCRIPTION]'], 'bookkeeping practice', 'the current business-description label is tokenized');
assert.doesNotMatch(current.anonymizedPrompt, /bookkeeping practice/i, 'the current description is removed from the anonymized prompt');

const legacy = anonymizePrompt('Business Category: Bakery / Grains');
assert.equal(legacy.mapping['[BUSINESS_DESCRIPTION]'], 'Bakery / Grains', 'the legacy business-category label remains tokenized');

const recoveryPrompt = buildRecoveryPrompt({
  clientName: 'Test Owner',
  businessName: 'Test Business',
  businessNiche: 'bookkeeping practice',
  answers: []
}, 'test-record');
const recoveryResult = anonymizePrompt(recoveryPrompt);
assert.equal(recoveryResult.mapping['[BUSINESS_DESCRIPTION]'], 'bookkeeping practice', 'the real recovery template feeds its description to the anonymizer');
assert.doesNotMatch(recoveryResult.anonymizedPrompt, /bookkeeping practice/i, 'the real recovery template does not expose the description to model analysis');

const participantRecovery = anonymizePrompt('## Customer Service\nSarah Nguyen called.', 'Sarah Nguyen called.');
assert.match(participantRecovery.anonymizedPrompt, /Customer Service/, 'recovery templates are not scanned as participant answers');
assert.doesNotMatch(participantRecovery.anonymizedPrompt, /Sarah|Nguyen/i, 'recovery participant names are replaced');

console.log('recover-dna anonymization tests passed');
