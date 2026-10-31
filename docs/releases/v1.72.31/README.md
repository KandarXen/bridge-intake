# BTAI Intake v1.72.31 — privacy-boundary corrective candidate

## Release boundary

Private Preview candidate only. Production remains v1.72.23 on `main`.
This candidate does not deploy Production, enable delivery, change email gates,
change AI enablement, or widen tester access.

## Corrective scope

This candidate responds to Claude review `review-001` findings R1–R4:

1. Identity matching now assigns separate tokens for separate people with the
   same role, covers known-name parts and all-caps variants, and avoids lower-
   case ordinary-word matching.
2. Mastery follow-up constructs its model prompt only after the Privacy Gate;
   the captured-request contract test proves raw names and payroll amount do
   not enter that request.
3. DNA/recovery heuristic detection receives participant answer text rather
   than the generated instruction template. Common labels and tools remain
   unchanged in the expanded regression test.
4. The report reads a saved re-identification map only when both its draft ID
   and output type match. Proof flags use computed replacement counts.

## Evidence

Run from the repository root:

```powershell
node scripts/identity-redaction-test.mjs
node scripts/adaptive-probe-contract-test.mjs
node scripts/generate-dna-anonymization-test.mjs
node scripts/recover-dna-anonymization-test.mjs
node scripts/report-identity-redaction-contract-test.mjs
```

All five scripts passed locally before this candidate was prepared. The
complete Claude handoff packet is in
`docs/review-packages/v1.72.31-claude-test/`.

## Deferred items

- People block and people nudge work (D2: after privacy items 1–5).
- Bracketed-token rejection is recommended, not part of this corrective scope.
- Preview credential separation, Anthropic spend limit, Preview reachability,
  and rate-limit storage need environment evidence; no environment setting was
  changed by this build.
