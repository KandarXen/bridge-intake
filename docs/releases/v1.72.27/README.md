# BTAI Intake v1.72.27 — Claude review remediation

## Purpose

This private-Preview-only build addresses the concrete findings from Claude's v1.72.26 independent review. It does not authorize a Production deployment, email delivery change, or service-configuration change.

## Fixed

- Admin recovery now anonymizes both the current `Business Description` label and the legacy `Business Category` label before model analysis.
- A resumed legacy draft retains its recognized category metadata, so its established tailoring pack does not silently change after a save.
- Generic manufacturing receives a non-food manufacturing/operations pack; food-specific manufacturing remains food-specific.
- `bookkeeping` now matches the professional-services pack.
- The first Snapshot question no longer repeats the welcome question, and the optional field-help copy is visibly styled.
- AI context uses one business-description line instead of duplicating the same text as a separate niche.

## Verification required

- Run the focused business-description and recovery-anonymization tests.
- Run the existing privacy and pilot-safety contract tests.
- Independently review the exact diff and current source before broader tester use.

## Environment boundary

- Public Production remains v1.72.23 on `main`.
- This release is limited to the private Preview branch.
