#!/usr/bin/env node

import assert from 'node:assert/strict';
import { anonymizePrompt } from '../api/recover-dna.js';

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

console.log('recover-dna anonymization tests passed');
