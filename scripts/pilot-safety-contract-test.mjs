#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function requireBefore(source, earlier, later, label) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.ok(earlierIndex >= 0, `${label}: missing ${earlier}`);
  assert.ok(laterIndex >= 0, `${label}: missing ${later}`);
  assert.ok(earlierIndex < laterIndex, `${label}: ${earlier} must appear before ${later}`);
}

const draftApi = read('api/draft.js');
const aiApi = read('api/generate-dna.js');
const reportApi = read('api/report-pack.js');
const notificationApi = read('api/send-email.js');
const intakePage = read('index.html');
const testerPage = read('private-test-page.html');
const vercelConfig = read('vercel.json');
const draftAccessSource = read('lib/draft-access.js');
const draftAccess = await import('../lib/draft-access.js');

assert.match(draftApi, /assertDraftAccess\(draftAccessToken, clientDraftId\)/, 'existing draft saves require a capability');
assert.match(draftApi, /assertDraftAccess\(draftAccessToken, id\)/, 'draft loads and deletes require a capability');
assert.match(aiApi, /assertDraftAccess\(draftAccessToken, clientDraftId\)/, 'AI generation requires a capability');
assert.match(reportApi, /assertDraftAccess\(req\.body\?\.draftAccessToken, clientDraftId\)/, 'free report requests require a capability');
assert.match(aiApi, /runPrivacyGate\(prompt, \{ purpose: 'venture_dna_generation_prompt' \}\)/, 'full AI prompt is scanned by the privacy gate');
assert.match(aiApi, /runPrivacyGate\(participantPrivacySource, \{ purpose: 'venture_dna_generation_participant' \}\)/, 'participant source is independently scanned by the privacy gate');
assert.match(aiApi, /sanitizedPrompt: promptGate\.sanitizedText/, 'only the sanitized full prompt is sent onward');
assert.match(reportApi, /const bccRecipient = process\.env\.INTAKE_BCC_RECIPIENT \|\| '';/, 'free-report BCC has no hard-coded recipient');
assert.match(reportApi, /\.\.\.\(bccRecipient \? \{ bcc: \[bccRecipient\] \} : \{\}\)/, 'free-report payload omits BCC when none is configured');
assert.match(reportApi, /const continueInterviewUrl = `\$\{publicBaseUrl\}\/snapshot`;/, 'free-report link does not expose a draft ID');
assert.match(reportApi, /function assertPreviewRecipientAllowed\(email\)/, 'Preview report delivery requires an approved recipient');
assert.match(reportApi, /Preview public base URL is not configured/, 'Preview report delivery fails closed without a Preview base URL');
assert.match(draftAccessSource, /const DEFAULT_TTL_DAYS = 30;/, 'draft capability lifetime matches the pilot retention window');

requireBefore(
  aiApi,
  "String(process.env.BTAI_ENABLE_AUTOMATED_AI || '').toLowerCase() !== 'true'",
  'await callClaude(',
  'AI feature switch'
);
requireBefore(
  reportApi,
  "String(process.env.BTAI_ENABLE_CLIENT_REPORT_PACK || '').toLowerCase() !== 'true'",
  'return res.status(200).json(await generateFreeAndEmail(clientDraftId));',
  'client report feature switch'
);
requireBefore(
  notificationApi,
  "String(process.env.BTAI_ENABLE_COMPLETION_NOTIFICATIONS || '').toLowerCase() !== 'true'",
  "fetch('https://api.resend.com/emails'",
  'completion notification feature switch'
);
assert.doesNotMatch(intakePage, /await sendEmailWithDNA\(\)/, 'interview completion cannot send an email automatically');
assert.match(testerPage, /<meta name="robots" content="noindex, nofollow, noarchive">/, 'private tester page is excluded from indexing');
assert.match(testerPage, /<meta http-equiv="refresh" content="0; url=\/\?campaign=snapshot_first">/, 'tester page immediately opens the short Snapshot mode');
assert.match(vercelConfig, /"source": "\/snapshot", "destination": "\/\?campaign=snapshot_first"/, 'legacy Snapshot route redirects to the current Snapshot mode');

const savedSecret = process.env.BTAI_DRAFT_ACCESS_SECRET;
process.env.BTAI_DRAFT_ACCESS_SECRET = 'v1.72.25-contract-test-secret-with-32-plus-characters';
const token = draftAccess.issueDraftAccess('synthetic-record-a', 1);
assert.doesNotThrow(() => draftAccess.assertDraftAccess(token, 'synthetic-record-a'));
assert.throws(
  () => draftAccess.assertDraftAccess(token, 'synthetic-record-b'),
  error => error?.statusCode === 403,
  'a capability cannot be reused for a different draft'
);
assert.throws(
  () => draftAccess.assertDraftAccess('', 'synthetic-record-a'),
  error => error?.statusCode === 403,
  'a draft ID alone cannot grant access'
);
if (savedSecret === undefined) delete process.env.BTAI_DRAFT_ACCESS_SECRET;
else process.env.BTAI_DRAFT_ACCESS_SECRET = savedSecret;

console.log('pilot safety contract tests passed');
