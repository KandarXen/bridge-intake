# Active BTAI release — static entry point

This is the fixed starting file for all model work. It is updated by Codex after each build, but its path never changes.

## Current release

- **Version:** v1.72.32 private Preview corrective candidate
- **Candidate commit:** `dc0fddc`
- **Baseline commit:** `4731a9e`
- **Branch:** `release/v1.72.24-secure-intake`
- **Preview:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Production:** unchanged at v1.72.23 on `main`
- **Stage:** independent Claude re-review pending (v1.72.31 review-001 B1 and I1–I3 corrective work)

## Canonical evidence

Claude must review this one complete packet after Codex generates it:

[v1.72.32 complete Claude review packet](../review-packages/v1.72.32-claude-test/CLAUDE_V1.72.32_COMPLETE_REVIEW_PACKET.md)

## Required outcome

Claude reviews the attached complete packet and returns one review report in chat, then issues the matching Codex handoff command from `COMMAND_PROTOCOL.md` only when a material fix is needed.

## Safety boundary

No Production deployment, external email, report delivery, AI invocation, or service-setting change is authorized by a review command. A review is evidence-only.
