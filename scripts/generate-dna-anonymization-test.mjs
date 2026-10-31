#!/usr/bin/env node

import assert from 'node:assert/strict';
import { anonymizePrompt, getParticipantPrivacySource } from '../api/generate-dna.js';

const current = anonymizePrompt('Business Description: tax prep for self-employed contractors');
assert.equal(current.mapping['[BUSINESS_DESCRIPTION]'], 'tax prep for self-employed contractors', 'the primary report path tokenizes the current business-description label');
assert.doesNotMatch(current.anonymizedPrompt, /tax prep for self-employed contractors/i, 'the primary report path removes the current description before model analysis');

const legacy = anonymizePrompt('Business Category: Professional Services');
assert.equal(legacy.mapping['[BUSINESS_DESCRIPTION]'], 'Professional Services', 'the primary report path still tokenizes the legacy label');

const template = '### Revenue Engine\n## Quick Read\nGoogle Drive is used for planning.\nParticipant answer: Sarah Nguyen called.';
const participant = 'Sarah Nguyen called.';
const participantOnly = anonymizePrompt(template, participant);
assert.match(participantOnly.anonymizedPrompt, /Revenue Engine|Quick Read|Google Drive/, 'template headings and common tools are not scanned as participant names');
assert.doesNotMatch(participantOnly.anonymizedPrompt, /Sarah|Nguyen/i, 'participant names are replaced before the DNA model request');

const noParticipant = anonymizePrompt(template, '');
assert.match(noParticipant.anonymizedPrompt, /Revenue Engine|Quick Read/, 'an empty participant-text value disables heuristic template scanning');

assert.equal(getParticipantPrivacySource({ privacyScanText: 'Answer: Sarah Nguyen quotes.' }), 'Answer: Sarah Nguyen quotes.', 'a supplied participant privacy source is retained');
assert.equal(getParticipantPrivacySource({}), '', 'a missing privacy source is identifiable so generation can fail closed');

console.log('generate-dna anonymization tests passed');
