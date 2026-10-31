# Active BTAI release — static entry point

This is the fixed starting file for all model work. It is updated by Codex after each build, but its path never changes.

## Current release

- **Version:** v1.72.29 private Preview
- **Candidate commit:** `88a153bce4641ac5333e285aa78297d27e61ed57`
- **Baseline commit:** `09a3b5fd6019d7b08a4a97c4a68ef3fb86a6012c`
- **Branch:** `release/v1.72.24-secure-intake`
- **Preview:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Production:** unchanged at v1.72.23 on `main`
- **Stage:** independent Claude re-review pending (R2 search and adaptive-probe privacy boundary added)

## Canonical evidence

Claude must review this one complete packet after Codex generates it:

[v1.72.29 complete Claude review packet](../review-packages/v1.72.29-claude-test/CLAUDE_V1.72.29_COMPLETE_REVIEW_PACKET.md)

## Required outcome

Claude creates one review report in `INBOX/CLAUDE/` using the format in `INBOX/CLAUDE/README.md`, then issues the matching Codex handoff command from `COMMAND_PROTOCOL.md`.

## Safety boundary

No Production deployment, external email, report delivery, AI invocation, or service-setting change is authorized by a review command. A review is evidence-only.
