# Current BTAI Intake status

**Last updated:** 2026-10-31

## Environment boundary

- **Public Production:** `main`, baseline v1.72.23. Do not change or deploy without Darren’s explicit approval.
- **Private Preview branch:** `release/v1.72.24-secure-intake`.
- **Current private Preview build:** v1.72.27 candidate, commit `fa4ed1888a3c2006ba978b1ae0cc3a971b1f8158`.
- **Private Preview URL:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Preview protection:** Vercel-protected. A reviewer who reaches a Vercel login page has not reached the product and must not treat that as a product defect.

## Current product change

v1.72.27 remediates Claude's v1.72.26 findings while preserving the one required question:

> What does your business do?

The response populates the established compatibility field used by existing draft, report, and internal API paths. This build retains recognized legacy category metadata on resume, adds distinct generic-manufacturing tailoring, fixes `bookkeeping` matching, and restores admin-recovery anonymization for the current business-description label.

## Safety posture

- No Production deployment was made.
- No email-delivery setting was enabled or changed.
- No draft capability, email switch, report-delivery switch, or AI switch logic was changed in v1.72.27.
- No real tester data, report delivery, or AI generation was used for this release verification.

## Active work

**Claude independent re-review of v1.72.27 is pending.** The complete evidence packet is linked in `REVIEW_QUEUE.md`.

## Maintenance rule

Codex updates this file immediately after any build, commit, Preview deployment, material safety change, or review decision. Other models read it; they do not overwrite it.
