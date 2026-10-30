#!/usr/bin/env node

/**
 * Hermes Release Runner
 *
 * Local, dependency-free release-loop coordinator. It is intentionally unable
 * to launch an external model unless a local, ignored configuration explicitly
 * enables that adapter. It never deploys, sends email, changes credentials, or
 * enables product features.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handoffRoot = path.join(root, 'docs', 'AI_HANDOFF');
const activeReleasePath = path.join(handoffRoot, '00_ACTIVE_RELEASE.md');
const inboxRoot = path.join(handoffRoot, 'INBOX', 'CLAUDE');
const outboxRoot = path.join(handoffRoot, 'OUTBOX', 'CLAUDE');
const localConfigPath = path.join(handoffRoot, 'hermes-runner.config.local.json');
const localStatePath = path.join(handoffRoot, 'hermes-runner.state.local.json');

const requiredSections = [
  'Release posture',
  'What was verified',
  'Blockers',
  'Important before broader tester use',
  'Non-blocking observations',
  'Safety regression result',
  'Evidence gap, if any',
  'One recommendation',
  'Codex action requirements',
  'Codex handoff'
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function parseRelease() {
  const source = readText(activeReleasePath);
  const value = label => source.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, 'm'))?.[1]?.trim() || '';
  const version = value('Version').match(/v\d+\.\d+\.\d+/)?.[0] || '';
  const candidate = value('Candidate commit').replace(/`/g, '');
  const stage = value('Stage');
  const packet = source.match(/\[[^\]]+\]\(([^)]+CLAUDE_[^)]+_PACKET\.md)\)/)?.[1] || '';
  if (!version || !candidate || !stage || !packet) throw new Error('00_ACTIVE_RELEASE.md is missing version, candidate, stage, or canonical evidence.');
  return { version, candidate, stage, packet };
}

function loadLocalConfig() {
  if (!fs.existsSync(localConfigPath)) {
    return { allowLocalCliDispatch: false, claude: { command: '', args: [] }, gemini: { command: '', args: [] } };
  }
  const config = JSON.parse(readText(localConfigPath));
  return {
    allowLocalCliDispatch: config.allowLocalCliDispatch === true,
    claude: config.claude || { command: '', args: [] },
    gemini: config.gemini || { command: '', args: [] }
  };
}

function latestClaudeReview(version) {
  if (!fs.existsSync(inboxRoot)) return null;
  const pattern = new RegExp(`^${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-review-(\\d{3})\\.md$`);
  const candidates = fs.readdirSync(inboxRoot)
    .map(name => ({ name, match: name.match(pattern) }))
    .filter(item => item.match)
    .sort((a, b) => Number(b.match[1]) - Number(a.match[1]));
  if (!candidates.length) return null;
  return path.join(inboxRoot, candidates[0].name);
}

function validateClaudeReview(filePath, release) {
  const source = readText(filePath);
  const missing = requiredSections.filter(section => !new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(source));
  const reviewMatch = path.basename(filePath).match(/review-(\d{3})\.md$/);
  const reviewId = reviewMatch ? `review-${reviewMatch[1]}` : '';
  const expectedHandoff = `BTAI HANDOFF CLAUDE ${release.version} ${reviewId}`;
  const hasHandoff = source.includes(expectedHandoff);
  const posture = source.match(/^##\s+Release posture\s*\n+([^\n#]+)/mi)?.[1]?.trim() || '';
  return {
    valid: missing.length === 0 && hasHandoff,
    missing,
    expectedHandoff,
    posture,
    reviewId
  };
}

function writeLocalState(state) {
  fs.writeFileSync(localStatePath, `${JSON.stringify({ updatedAt: new Date().toISOString(), ...state }, null, 2)}\n`, 'utf8');
}

function reviewTask(release, reviewId) {
  return [
    `# Hermes task — Claude independent review ${reviewId}`,
    '',
    `- Release: ${release.version}`,
    `- Candidate: ${release.candidate}`,
    `- Evidence: ${release.packet}`,
    '',
    'Read `docs/AI_HANDOFF/00_ACTIVE_RELEASE.md`, `MODEL_ROLES.md`, and `COMMAND_PROTOCOL.md` first.',
    'Review only the canonical evidence packet. Do not use connectors, edit code, deploy, send email, invoke AI generation, or change settings.',
    `Write the completed report to docs/AI_HANDOFF/INBOX/CLAUDE/${release.version}-${reviewId}.md.`,
    `End the report with: BTAI HANDOFF CLAUDE ${release.version} ${reviewId}`,
    ''
  ].join('\n');
}

function commandStatus() {
  const release = parseRelease();
  const review = latestClaudeReview(release.version);
  const result = { release, latestClaudeReview: review ? path.relative(root, review) : null };
  if (review) result.reviewValidation = validateClaudeReview(review, release);
  console.log(JSON.stringify(result, null, 2));
}

function commandPrepare({ dryRun = false } = {}) {
  const release = parseRelease();
  const existing = latestClaudeReview(release.version);
  const previousNumber = existing ? Number(path.basename(existing).match(/review-(\d{3})\.md$/)?.[1] || 0) : 0;
  const reviewId = `review-${String(previousNumber + 1).padStart(3, '0')}`;
  const output = path.join(outboxRoot, `${release.version}-${reviewId}.md`);
  const task = reviewTask(release, reviewId);
  if (!dryRun) {
    ensureDirectory(outboxRoot);
    fs.writeFileSync(output, task, 'utf8');
    writeLocalState({ mode: 'awaiting_claude_review', version: release.version, reviewId, task: path.relative(root, output) });
  }
  console.log(JSON.stringify({ action: 'prepare_claude_review', dryRun, task: path.relative(root, output), nextCommand: `BTAI REVIEW ${release.version}` }, null, 2));
}

function commandCheck() {
  const release = parseRelease();
  const review = latestClaudeReview(release.version);
  if (!review) {
    console.log(JSON.stringify({ action: 'awaiting_claude_review', version: release.version, nextCommand: `BTAI REVIEW ${release.version}` }, null, 2));
    return;
  }
  const validation = validateClaudeReview(review, release);
  writeLocalState({ mode: validation.valid ? 'awaiting_codex_handoff' : 'invalid_claude_report', version: release.version, report: path.relative(root, review), validation });
  console.log(JSON.stringify({ action: validation.valid ? 'handoff_to_codex' : 'repair_claude_report', report: path.relative(root, review), validation, nextCommand: validation.valid ? validation.expectedHandoff : `BTAI REVIEW ${release.version}` }, null, 2));
}

function commandDispatchClaude() {
  const release = parseRelease();
  const config = loadLocalConfig();
  if (!config.allowLocalCliDispatch || !config.claude.command) {
    throw new Error('Claude dispatch is disabled. Add a local ignored configuration only after you approve the exact CLI command and authentication method.');
  }
  const taskPath = path.join(outboxRoot, `${release.version}-review-001.md`);
  if (!fs.existsSync(taskPath)) throw new Error('Prepare the Claude review task first: node scripts/hermes-release-runner.mjs prepare');
  const prompt = readText(taskPath);
  const result = spawnSync(config.claude.command, [...(config.claude.args || []), prompt], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Claude CLI exited with code ${result.status}`);
}

const [command = 'status', ...argumentsList] = process.argv.slice(2);
try {
  if (command === 'status') commandStatus();
  else if (command === 'prepare') commandPrepare({ dryRun: argumentsList.includes('--dry-run') });
  else if (command === 'check') commandCheck();
  else if (command === 'dispatch-claude') commandDispatchClaude();
  else throw new Error('Usage: node scripts/hermes-release-runner.mjs <status|prepare|check|dispatch-claude> [--dry-run]');
} catch (error) {
  console.error(`Hermes runner: ${error.message}`);
  process.exitCode = 1;
}
