# Active review queue

## v1.72.28 — primary privacy-path and adaptive-follow-up correction

- **Status:** Awaiting Claude independent re-review.
- **Reviewer:** Claude.
- **Candidate:** `09a3b5fd6019d7b08a4a97c4a68ef3fb86a6012c`.
- **Baseline:** `fa4ed1888a3c2006ba978b1ae0cc3a971b1f8158`.
- **Review packet:** [CLAUDE_V1.72.28_COMPLETE_REVIEW_PACKET.md](../review-packages/v1.72.28-claude-test/CLAUDE_V1.72.28_COMPLETE_REVIEW_PACKET.md)

### Reviewer instruction

Run `BTAI REVIEW CURRENT` as specified in `COMMAND_PROTOCOL.md`. Read the complete packet. It contains the reviewer brief, exact corrective diff, the primary privacy-path sources, full current safety-test sources, and captured test results. Do not ask Darren to run commands or collect more source files unless this packet has a concrete evidence omission.

### Completion rule

Claude returns the required structured review. Codex records the result here and updates `CURRENT_STATUS.md`; Darren receives the outcome and only needs to decide on a genuine blocker or release choice.
