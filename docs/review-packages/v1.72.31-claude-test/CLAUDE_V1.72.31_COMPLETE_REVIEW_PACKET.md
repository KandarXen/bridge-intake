# BTAI Intake v1.72.31 — Claude QA packet

## Review request

Review this private Preview corrective candidate against the v1.72.30
`review-001` report. Do not use connectors, deploy, send email, change
environment settings, invoke production AI, or test live records. Review the
candidate code and synthetic evidence only.

## Candidate facts

| Item | Value |
| --- | --- |
| Version | v1.72.31 private Preview candidate |
| Production | Unchanged: v1.72.23 on `main` |
| Scope | R1–R4 corrective work only |
| External changes | None |

## Claimed resolutions

| Prior finding | Code evidence | Test evidence |
| --- | --- | --- |
| R1 duplicate-role/name-part/case defect | `lib/identity-redaction.js` | `scripts/identity-redaction-test.mjs` |
| R2 raw mastery answer in prompt | `api/interview-ai.js` | `scripts/adaptive-probe-contract-test.mjs` captured model body |
| R3 template treated as participant text | `api/generate-dna.js`, `api/recover-dna.js` | DNA/recovery anonymization tests; normal tool/label regression test |
| R4 evidence/proof integrity | `lib/supabase-rest.js`, `api/report-pack.js`, computed stats in `lib/identity-redaction.js` | report identity-redaction contract test |

## Synthetic test output

```
identity redaction tests passed
adaptive probe contract tests passed
generate-dna anonymization tests passed
recover-dna anonymization tests passed
report identity redaction contract tests passed
```

The mastery test uses a synthetic answer containing two names and a payroll
amount. It captures the outbound model request and asserts that the raw names
and amount are absent before the mocked request returns.

## Required review checks

1. Confirm R1 is actually closed, including two people sharing the same role,
   surname/all-caps matching, and no replacement of ordinary lower-case words.
2. Confirm `masteryFollowup` runs its gate before constructing `prompt`, and
   that no raw `answer` reaches `callClaude`.
3. Confirm generation and recovery pass only `privacyScanText` as the
   heuristic participant source, not prompt templates.
4. Confirm a map addressed by ID is additionally scoped to the same draft and
   `hermes_reidentification_map` output type.
5. Identify any remaining blocker, important pre-wider-test item, or evidence
   gap. Keep inherited environmental gaps separate from code findings.

## Required output

Write the result to `docs/AI_HANDOFF/INBOX/CLAUDE/` using the existing review
format. Mark R1–R4 individually as Resolved or Still open, quote the specific
file/line evidence, issue one recommendation, and include the Codex handoff
command if corrective work remains.
