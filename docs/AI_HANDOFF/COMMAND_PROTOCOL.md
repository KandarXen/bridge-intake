# BTAI model command protocol

This protocol makes Darren the product owner—not the technical go-between.

## Standalone-packet mode (required)

Darren is never the technical go-between. Every Claude review request is a
single self-contained Markdown packet that Darren can attach directly in
Claude. Claude must be able to review it with no repository, connector, shell,
or live-site access.

Every packet must include the baseline and candidate hashes, exact candidate
diff, full source for each changed file and each dependency needed to judge the
change, full relevant test scripts, captured test output, claimed-resolution
evidence, and any required search/proof output. A packet that only points to
file names or makes assertions is not a review packet.

### Command 1 — start an independent Claude review

Send Claude this exact command:

```text
BTAI REVIEW CURRENT
```

Claude must:

1. Review the attached canonical evidence packet only—without changing code or external services.
2. Return one complete Markdown review in chat.
3. End its response with the next Codex handoff command only if a material fix is needed.

### Command 2 — send Claude’s findings to Codex

Send Codex the exact command Claude supplied, which must have this form:

```text
BTAI HANDOFF CLAUDE <version> review-001
```

Codex must:

1. Read the attached Claude report and the active-release record.
2. Classify each item as accepted, rejected with evidence, or needing Darren’s decision.
3. Implement only accepted, in-scope fixes.
4. Run appropriate checks, update the active release file, and create a new complete evidence packet.
5. End with the next Claude command only if independent re-review is genuinely needed.

### Command 3 — re-review a fixed candidate

Codex will return this only when there was a material fix:

```text
BTAI REVIEW <version>
```

Claude returns `...-review-002.md` in chat, then returns:

```text
BTAI HANDOFF CLAUDE <version> review-002
```

## Attaching a Claude result to Codex

Attach Claude's single Markdown review to Codex and send:

```text
BTAI HANDOFF CLAUDE <version> review-001 (attached)
```

Codex records it in the project handoff history before acting. No terminal
commands, diffs, or extra evidence collection are required from Darren.

## Anti-loop rule

- Re-review only after a material fix: customer-flow defect, safety/privacy/access-control issue, release blocker, or substantive regression.
- Do not loop on copy preference, style, formatting, or speculative concerns.
- After two review/fix cycles on the same release, Codex summarizes remaining trade-offs for Darren instead of starting a third cycle automatically.
- A reviewer must cite a file/line or an explicit missing-evidence item. Unsupported concerns are non-findings.

## Authority limits

These commands never authorize Production deployment, emailing customers, enabling delivery, changing credentials/settings, or spending money. Darren approves those separately.
