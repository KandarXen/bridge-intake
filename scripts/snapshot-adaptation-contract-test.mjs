#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(source, /const SNAPSHOT_QUESTIONS = \[/, 'Snapshot question set exists');
assert.match(source, /'People & Decision-Making\|Who Is Involved': \{\s*text: 'Which parts of this work do you personally handle before it is finished\?'/s, 'solo-owner wording is available');
assert.match(source, /'Operations & Delivery\|Handoff & Delay Point': \{/, 'Snapshot handoff wording is industry-aware');
assert.match(source, /function snapshotBottleneckFollowup\(/, 'bottleneck follow-up selector exists');
assert.match(source, /function maybeRunSnapshotBottleneckFollowup\(/, 'Snapshot follow-up flow exists');
assert.match(source, /const snapshotFollowupShown = maybeRunSnapshotBottleneckFollowup\(currentQ, val\);/, 'Snapshot follow-up runs after the bottleneck answer');
assert.doesNotMatch(source, /fetch\([^\n]*snapshotBottleneckFollowup/, 'deterministic follow-up does not make its own AI request');

console.log('snapshot adaptation contract tests passed');
