# Current BTAI Intake status

**Last updated:** 2026-10-30

## Environment boundary

- **Public Production:** `main`, baseline v1.72.23. Do not change or deploy without Darren’s explicit approval.
- **Private Preview branch:** `release/v1.72.24-secure-intake`.
- **Current private Preview build:** v1.72.26, commit `c81e2fe5cd88af1c459d96c9eaf54fe992ea3eea`.
- **Private Preview URL:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Preview protection:** Vercel-protected. A reviewer who reaches a Vercel login page has not reached the product and must not treat that as a product defect.

## Current product change

v1.72.26 replaces the food-heavy category selector and optional niche field with one required question:

> What does your business do?

The response populates the established compatibility field used by existing draft, report, and internal API paths. It drives the same industry matching and question tailoring.

## Safety posture

- No Production deployment was made.
- No email-delivery setting was enabled or changed.
- No draft capability, privacy gate, or AI-switch logic was changed in v1.72.26.
- No real tester data, report delivery, or AI generation was used for this release verification.

## Active work

**Claude independent review of v1.72.26 is pending.** The complete evidence packet is linked in `REVIEW_QUEUE.md`.

## Maintenance rule

Codex updates this file immediately after any build, commit, Preview deployment, material safety change, or review decision. Other models read it; they do not overwrite it.
