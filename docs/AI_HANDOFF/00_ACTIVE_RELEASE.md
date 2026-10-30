# Active BTAI release — static entry point

This is the fixed starting file for all model work. It is updated by Codex after each build, but its path never changes.

## Current release

- **Version:** v1.72.26 private Preview
- **Candidate commit:** `c81e2fe5cd88af1c459d96c9eaf54fe992ea3eea`
- **Baseline commit:** `c899232d39927854ba8053ab07e328e4947fb550`
- **Branch:** `release/v1.72.24-secure-intake`
- **Preview:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Production:** unchanged at v1.72.23 on `main`
- **Stage:** independent Claude review pending

## Canonical evidence

Claude must review this one complete packet:

[v1.72.26 complete Claude review packet](../review-packages/v1.72.26-claude-test/CLAUDE_V1.72.26_COMPLETE_REVIEW_PACKET.md)

## Required outcome

Claude creates one review report in `INBOX/CLAUDE/` using the format in `INBOX/CLAUDE/README.md`, then issues the matching Codex handoff command from `COMMAND_PROTOCOL.md`.

## Safety boundary

No Production deployment, external email, report delivery, AI invocation, or service-setting change is authorized by a review command. A review is evidence-only.
