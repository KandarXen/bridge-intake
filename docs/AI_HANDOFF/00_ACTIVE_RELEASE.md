# Active BTAI release — static entry point

This is the fixed starting file for all model work. It is updated by Codex after each build, but its path never changes.

## Current release

- **Version:** v1.72.31 private Preview corrective candidate
- **Candidate commit:** pending local verification and commit
- **Baseline commit:** `88a153bce4641ac5333e285aa78297d27e61ed57`
- **Branch:** `release/v1.72.24-secure-intake`
- **Preview:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Production:** unchanged at v1.72.23 on `main`
- **Stage:** independent Claude re-review pending (v1.72.30 review-001 R1–R4 corrective work)

## Canonical evidence

Claude must review this one complete packet after Codex generates it:

[v1.72.31 complete Claude review packet](../review-packages/v1.72.31-claude-test/CLAUDE_V1.72.31_COMPLETE_REVIEW_PACKET.md)

## Required outcome

Claude creates one review report in `INBOX/CLAUDE/` using the format in `INBOX/CLAUDE/README.md`, then issues the matching Codex handoff command from `COMMAND_PROTOCOL.md`.

## Safety boundary

No Production deployment, external email, report delivery, AI invocation, or service-setting change is authorized by a review command. A review is evidence-only.
