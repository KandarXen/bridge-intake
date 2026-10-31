#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '09a3b5fd6019d7b08a4a97c4a68ef3fb86a6012c';
const candidate = '88a153bce4641ac5333e285aa78297d27e61ed57';
const files = [
  'index.html',
  'api/generate-dna.js',
  'api/interview-ai.js',
  'api/recover-dna.js',
  'api/send-email.js',
  'api/report-pack.js',
  'api/partner-aggregate.js',
  'lib/privacy.js',
  'lib/privacy-gate.js',
  'lib/security.js',
  'scripts/intake-business-description-contract-test.mjs',
  'scripts/recover-dna-anonymization-test.mjs',
  'scripts/generate-dna-anonymization-test.mjs',
  'scripts/adaptive-probe-contract-test.mjs',
  'scripts/pilot-safety-contract-test.mjs',
  'scripts/privacy-gate-context-test.mjs',
  'docs/releases/v1.72.29/README.md',
  'docs/AI_HANDOFF/INBOX/CLAUDE/v1.72.28-review-001.md'
];
const outputPath = path.join(root, 'docs', 'review-packages', 'v1.72.29-claude-test', 'CLAUDE_V1.72.29_COMPLETE_REVIEW_PACKET.md');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function runTest(relativePath) {
  try {
    const stdout = execFileSync(process.execPath, [relativePath], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return `Exit code: 0\n${stdout.trim()}`;
  } catch (error) {
    return `Exit code: ${error.status ?? 'unknown'}\n${String(error.stdout || '').trim()}\n${String(error.stderr || '').trim()}`.trim();
  }
}

const diff = git(['diff', `${baseline}..${candidate}`, '--', ...files]);
const labelSearch = git(['grep', '-n', '-E', 'Business Category|Specific Niche|BUSINESS_CATEGORY', candidate, '--', 'api', 'lib']);
const sources = files.map(relativePath => ({
  relativePath,
  content: git(['show', `${candidate}:${relativePath}`])
}));
const tests = [
  'scripts/intake-business-description-contract-test.mjs',
  'scripts/recover-dna-anonymization-test.mjs',
  'scripts/generate-dna-anonymization-test.mjs',
  'scripts/adaptive-probe-contract-test.mjs',
  'scripts/pilot-safety-contract-test.mjs',
  'scripts/privacy-gate-context-test.mjs'
].map(relativePath => ({ relativePath, output: runTest(relativePath) }));

const parts = [
  '# BTAI Intake v1.72.29 — Complete independent Claude re-review packet',
  '',
  '> This is a self-contained evidence packet. Review this packet only; do not use connectors, change code, deploy, alter settings, send email, submit an intake, or make an AI call.',
  '',
  '## Review target',
  '',
  `- Baseline: \`${baseline}\``,
  `- Candidate: \`${candidate}\``,
  '- Branch: `release/v1.72.24-secure-intake`',
  '- Private Preview: `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`',
  '- Scope: document the final R2 search, protect optional adaptive probes with the Privacy Gate, and suppress upstream provider errors without weakening safety or changing Production.',
  '',
  '## Required review response',
  '',
  'Return exactly these sections: **Release posture**, **What was verified**, **Blockers**, **Important before broader tester use**, **Non-blocking observations**, **Safety regression result**, **Evidence gap, if any**, and **One recommendation**.',
  '',
  'Use file and line citations. Do not call a missing live-browser observation a blocker: the Preview is Vercel-protected. Do not infer unspecified behavior.',
  '',
  '## Exact candidate diff',
  '',
  '```diff',
  diff.trimEnd(),
  '```',
  '',
  '## R2 repository-wide label search',
  '',
  'The following is the exact candidate search across `api/` and `lib/` for `Business Category`, `Specific Niche`, and `BUSINESS_CATEGORY`:',
  '',
  '```text',
  labelSearch.trimEnd(),
  '```',
  '',
  '## Captured local test results',
  '',
  ...tests.flatMap(({ relativePath, output }) => ['### ' + relativePath, '', '```text', output, '```', '']),
  '## Full candidate source evidence',
  '',
  ...sources.flatMap(({ relativePath, content }) => ['### ' + relativePath, '', '```' + (relativePath.endsWith('.html') ? 'html' : relativePath.endsWith('.js') || relativePath.endsWith('.mjs') ? 'javascript' : 'markdown'), content.trimEnd(), '```', ''])
];

fs.writeFileSync(outputPath, `${parts.join('\n')}\n`, 'utf8');
console.log(outputPath);
