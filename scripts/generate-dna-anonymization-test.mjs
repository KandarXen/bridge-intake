#!/usr/bin/env node

import assert from 'node:assert/strict';
import { anonymizePrompt } from '../api/generate-dna.js';

const current = anonymizePrompt('Business Description: tax prep for self-employed contractors');
assert.equal(current.mapping['[BUSINESS_DESCRIPTION]'], 'tax prep for self-employed contractors', 'the primary report path tokenizes the current business-description label');
assert.doesNotMatch(current.anonymizedPrompt, /tax prep for self-employed contractors/i, 'the primary report path removes the current description before model analysis');

const legacy = anonymizePrompt('Business Category: Professional Services');
assert.equal(legacy.mapping['[BUSINESS_DESCRIPTION]'], 'Professional Services', 'the primary report path still tokenizes the legacy label');

console.log('generate-dna anonymization tests passed');
