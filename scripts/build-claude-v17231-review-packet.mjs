#!/usr/bin/env node

// Builds a standalone review artifact. Claude must be able to review this file
// with no repository or connector access.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '3260ac30f5e38c3a8ef420eab46c940e07211594';
const candidate = '4731a9e';
const files = [
  'api/generate-dna.js', 'api/interview-ai.js', 'api/recover-dna.js',
  'api/report-pack.js', 'index.html', 'lib/identity-redaction.js',
  'lib/privacy.js', 'lib/supabase-rest.js', 'lib/privacy-gate.js',
  'lib/security.js', 'lib/draft-access.js', 'scripts/identity-redaction-test.mjs',
  'scripts/adaptive-probe-contract-test.mjs',
  'scripts/generate-dna-anonymization-test.mjs',
  'scripts/recover-dna-anonymization-test.mjs',
  'scripts/report-identity-redaction-contract-test.mjs',
  'docs/releases/v1.72.31/README.md'
];
const tests = [
  'scripts/identity-redaction-test.mjs', 'scripts/adaptive-probe-contract-test.mjs',
  'scripts/generate-dna-anonymization-test.mjs',
  'scripts/recover-dna-anonymization-test.mjs',
  'scripts/report-identity-redaction-contract-test.mjs'
];
const outputPath = path.join(root, 'docs', 'review-packages', 'v1.72.31-claude-test', 'CLAUDE_V1.72.31_COMPLETE_REVIEW_PACKET.md');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const fence = file => file.endsWith('.html') ? 'html' : file.endsWith('.js') || file.endsWith('.mjs') ? 'javascript' : 'markdown';

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
  '# BTAI Intake v1.72.31 — Complete independent Claude QA packet', '',
  '> This is a self-contained evidence packet. Review this packet only. Do not use connectors, repository access, a live URL, or external systems. Do not change code, deploy, alter settings, send email, submit an intake, or make an AI call.', '',
  '## Review target', '',
  `- Baseline: \`${baseline}\``, `- Candidate: \`${candidate}\``,
  '- Branch: `release/v1.72.24-secure-intake`',
  '- Private Preview: Vercel-protected; no live-browser observation is required for this code review.',
  '- Production: unchanged at v1.72.23 on `main`.',
  '- Scope: correct v1.72.30 review-001 findings R1–R4 without changing delivery, email, credentials, AI enablement, access settings, or Production.', '',
  '## Required review response', '',
  'Return exactly these sections: **Release posture**, **What was verified**, **Blockers**, **Important before broader tester use**, **Non-blocking observations**, **Safety regression result**, **Evidence gap, if any**, and **One recommendation**.', '',
  'Use file and line citations from this packet. Do not infer unspecified behavior. Do not treat missing live-browser or environment-only evidence as a code blocker; list it separately as an evidence gap.', '',
  '## Resolution claims to verify', '',
  '| Prior finding | Candidate claim |', '| --- | --- |',
  '| R1 | Distinct same-role names receive distinct tokens; known name parts and all-caps forms are replaced without replacing ordinary lower-case words. |',
  '| R2 | The mastery prompt is constructed only after the gate; its captured request body contains no raw names or payroll amount. |',
  '| R3 | DNA/recovery receive `privacyScanText` rather than scanning generated prompt templates; labels and common tools remain intact. |',
  '| R4 | Map lookup is scoped by draft and output type; replacement/proof flags are computed from actual replacements. |', '',
  '## Exact candidate diff', '', '```diff', diff.trimEnd(), '```', '',
  '## Targeted source search', '', '```text', privacySearch.trimEnd(), '```', '',
  '## Captured local test results', '',
  ...testResults.flatMap(({ file, output }) => [`### ${file}`, '', '```text', output, '```', '']),
  '## Full candidate source evidence', '',
  ...sources.flatMap(({ file, source }) => [`### ${file}`, '', '```' + fence(file), source.trimEnd(), '```', ''])
];
fs.writeFileSync(outputPath, `${parts.join('\n')}\n`, 'utf8');
console.log(outputPath);
