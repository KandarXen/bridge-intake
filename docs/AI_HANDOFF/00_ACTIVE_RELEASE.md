# Active BTAI release — static entry point

This is the fixed starting file for all model work. It is updated by Codex after each build, but its path never changes.

## Current release

- **Version:** v1.72.28 private Preview
- **Candidate commit:** `09a3b5fd6019d7b08a4a97c4a68ef3fb86a6012c`
- **Baseline commit:** `fa4ed1888a3c2006ba978b1ae0cc3a971b1f8158`
- **Branch:** `release/v1.72.24-secure-intake`
- **Preview:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Production:** unchanged at v1.72.23 on `main`
- **Stage:** independent Claude re-review pending (R2 closed in code; review the complete corrective build)

## Canonical evidence

Claude must review this one complete packet after Codex generates it:

[v1.72.28 complete Claude review packet](../review-packages/v1.72.28-claude-test/CLAUDE_V1.72.28_COMPLETE_REVIEW_PACKET.md)

## Required outcome

Claude creates one review report in `INBOX/CLAUDE/` using the format in `INBOX/CLAUDE/README.md`, then issues the matching Codex handoff command from `COMMAND_PROTOCOL.md`.

## Safety boundary

No Production deployment, external email, report delivery, AI invocation, or service-setting change is authorized by a review command. A review is evidence-only.
