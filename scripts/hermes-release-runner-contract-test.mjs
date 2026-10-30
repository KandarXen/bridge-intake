#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = args => JSON.parse(execFileSync(process.execPath, ['scripts/hermes-release-runner.mjs', ...args], { cwd: root, encoding: 'utf8' }));

const status = run(['status']);
assert.equal(status.release.version, 'v1.72.26');
assert.equal(status.release.candidate, 'c81e2fe5cd88af1c459d96c9eaf54fe992ea3eea');
assert.match(status.release.packet, /CLAUDE_V1\.72\.26_COMPLETE_REVIEW_PACKET\.md$/);

const preparation = run(['prepare', '--dry-run']);
assert.equal(preparation.dryRun, true);
assert.equal(preparation.nextCommand, 'BTAI REVIEW v1.72.26');
assert.match(preparation.task, /OUTBOX[\\/]CLAUDE[\\/]v1\.72\.26-review-001\.md$/);

const check = run(['check']);
assert.equal(check.action, 'awaiting_claude_review');
assert.equal(check.nextCommand, 'BTAI REVIEW v1.72.26');

console.log('Hermes release runner contract tests passed');
