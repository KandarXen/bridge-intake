#!/usr/bin/env node

// Builds a standalone review artifact. Claude must be able to review this file
// with no repository or connector access.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = 'dc0fddc';
const candidate = process.argv[2] || 'HEAD';
const files = [
  'api/generate-dna.js', 'api/interview-ai.js', 'api/recover-dna.js',
  'api/report-pack.js', 'index.html', 'lib/identity-redaction.js',
  'lib/privacy.js', 'lib/supabase-rest.js', 'lib/privacy-gate.js',
  'lib/security.js', 'lib/draft-access.js', 'scripts/identity-redaction-test.mjs',
  'scripts/adaptive-probe-contract-test.mjs',
  'scripts/generate-dna-anonymization-test.mjs',
  'scripts/recover-dna-anonymization-test.mjs',
  'scripts/report-identity-redaction-contract-test.mjs',
  'docs/releases/v1.72.33/README.md'
];
const tests = [
  'scripts/identity-redaction-test.mjs', 'scripts/adaptive-probe-contract-test.mjs',
  'scripts/generate-dna-anonymization-test.mjs',
  'scripts/recover-dna-anonymization-test.mjs',
  'scripts/report-identity-redaction-contract-test.mjs'
];
const outputPath = path.join(root, 'docs', 'review-packages', 'v1.72.33-claude-test', 'CLAUDE_V1.72.33_COMPLETE_REVIEW_PACKET.md');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const fence = file => file.endsWith('.html') ? 'html' : file.endsWith('.js') || file.endsWith('.mjs') ? 'javascript' : 'markdown';
const candidateHash = git(['rev-parse', candidate]).trim();

function runTest(file) {
  try {
    const output = execFileSync(process.execPath, [file], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return `Exit code: 0\n${output.trim()}`;
  } catch (error) {
    return `Exit code: ${error.status ?? 'unknown'}\n${String(error.stdout || '').trim()}\n${String(error.stderr || '').trim()}`.trim();
  }
}

const diff = git(['diff', `${baseline}..${candidate}`, '--', ...files]);
const sources = files.map(file => ({ file, source: git(['show', `${candidate}:${file}`]) }));
const testResults = tests.map(file => ({ file, output: runTest(file) }));
const privacySearch = git(['grep', '-n', '-E', 'masteryFollowup|participantText|privacyScanText|identifiersReplaced|reidentificationMappingOutputId', candidate, '--', 'api', 'lib', 'index.html']);
const parts = [
  '# BTAI Intake v1.72.33 — Complete independent Claude QA packet', '',
  '> This is a self-contained evidence packet. Review this packet only. Do not use connectors, repository access, a live URL, or external systems. Do not change code, deploy, alter settings, send email, submit an intake, or make an AI call.', '',
  '## Review target', '',
  `- Baseline: \`${baseline}\``, `- Candidate: \`${candidateHash}\``,
  '- Branch: `release/v1.72.24-secure-intake`',
  '- Private Preview: Vercel-protected; no live-browser observation is required for this code review.',
  '- Production: unchanged at v1.72.23 on `main`.',
  '- Scope: correct v1.72.32 review-001 I-A without changing delivery, email, credentials, AI enablement, access settings, or Production.', '',
  '## Required review response', '',
  'Return exactly these sections: **Release posture**, **What was verified**, **Blockers**, **Important before broader tester use**, **Non-blocking observations**, **Safety regression result**, **Evidence gap, if any**, and **One recommendation**.', '',
  'Use file and line citations from this packet. Do not infer unspecified behavior. Do not treat missing live-browser or environment-only evidence as a code blocker; list it separately as an evidence gap.', '',
  '## Resolution claims to verify', '',
  '| Prior finding | Candidate claim |', '| --- | --- |',
  '| I-A | Missing or empty `privacyScanText` blocks DNA and recovery AI generation rather than silently disabling third-party-name detection. |',
  '| N2 | The ambiguous-owner marker is registered only if a bare owner first-name reference appears. |',
  '| N3 | A month word in a detected name is not replaced elsewhere as an ordinary month. |', '',
  '## Exact candidate diff', '', '```diff', diff.trimEnd(), '```', '',
  '## Targeted source search', '', '```text', privacySearch.trimEnd(), '```', '',
  '## Captured local test results', '',
  ...testResults.flatMap(({ file, output }) => [`### ${file}`, '', '```text', output, '```', '']),
  '## Full candidate source evidence', '',
  ...sources.flatMap(({ file, source }) => [`### ${file}`, '', '```' + fence(file), source.trimEnd(), '```', ''])
];
fs.writeFileSync(outputPath, `${parts.join('\n')}\n`, 'utf8');
console.log(outputPath);
