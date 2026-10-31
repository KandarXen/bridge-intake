# Current BTAI Intake status

**Last updated:** 2026-10-31

## Environment boundary

- **Public Production:** `main`, baseline v1.72.23. Do not change or deploy without Darren’s explicit approval.
- **Private Preview branch:** `release/v1.72.24-secure-intake`.
- **Current private Preview build:** v1.72.29 candidate, commit `88a153bce4641ac5333e285aa78297d27e61ed57`.
- **Private Preview URL:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Preview protection:** Vercel-protected. A reviewer who reaches a Vercel login page has not reached the product and must not treat that as a product defect.

## Current product change

v1.72.29 records the full R2 label search and protects adaptive follow-up prompts with the Privacy Gate while preserving the one required question:

> What does your business do?

The response populates the established compatibility field used by existing draft, report, and internal API paths. Sensitive optional probe answers are not sent to the model; permitted probes use sanitized text. Both current and legacy labels remain anonymized in the primary and recovery report paths.

## Safety posture

- No Production deployment was made.
- No email-delivery setting was enabled or changed.
- No draft capability, email switch, report-delivery switch, or AI-enable switch was changed in v1.72.29.
- No real tester data, report delivery, or AI generation was used for this release verification.

## Active work

**Claude independent re-review of v1.72.29 is pending.** The complete evidence packet is linked in `REVIEW_QUEUE.md`.

## Maintenance rule

Codex updates this file immediately after any build, commit, Preview deployment, material safety change, or review decision. Other models read it; they do not overwrite it.
