# Bridge To AI — Shared Release Verification Guardrail

Applies to every AI working on a tester-facing Bridge To AI change.

## Definition of ready

Never tell the owner a tester link is ready until all applicable checks pass:

1. The exact shared URL opens the intended current build, not an older deployment or static file.
2. The URL opens the intended campaign and question set: Snapshot, AFPA, or full diagnostic.
3. Route rules, redirects, rewrites, clean URLs, and same-named static files have been checked for collisions.
4. The visible version label matches the candidate build.
5. Any resume, continue, or report link stays in the intended environment and works as described.
6. The user-facing route was tested end-to-end before it is handed to the owner.

## Evidence standard

Report only:

- Exact tested URL.
- Candidate commit/build.
- Checks performed and result.
- Known limitation, if any.

If any check cannot be completed, say **not ready for owner testing**. Do not hand the owner a link as though it were complete.

## Efficiency rule

Use one focused preflight, not repeated broad audits:

1. Static route/collision check.
2. Exact deployment route check.
3. One final human-path verification.

Do not add extra review rounds unless a material change affects the path, privacy, email, AI use, or production behavior.
