# BTAI model command protocol

This protocol makes Darren the product owner—not the technical go-between.

## Shared-repository mode (preferred)

All three models have access to the same BTAI repository. Claude writes its review report to the designated inbox; Codex reads it from there. Darren only passes the short command between chats.

### Command 1 — start an independent Claude review

Send Claude this exact command:

```text
BTAI REVIEW CURRENT
```

Claude must:

1. Read `docs/AI_HANDOFF/00_ACTIVE_RELEASE.md`, `MODEL_ROLES.md`, and this file.
2. Review the linked canonical evidence packet—without changing code or external services.
3. Write one report to `docs/AI_HANDOFF/INBOX/CLAUDE/<version>-review-001.md`.
4. End its response with the next command for Codex.

### Command 2 — send Claude’s findings to Codex

Send Codex the exact command Claude supplied, which must have this form:

```text
BTAI HANDOFF CLAUDE <version> review-001
```

Codex must:

1. Read `docs/AI_HANDOFF/00_ACTIVE_RELEASE.md` and the named Claude report.
2. Classify each item as accepted, rejected with evidence, or needing Darren’s decision.
3. Implement only accepted, in-scope fixes.
4. Run appropriate checks, update the active release file, and create a new complete evidence packet.
5. End with the next Claude command only if independent re-review is genuinely needed.

### Command 3 — re-review a fixed candidate

Codex will return this only when there was a material fix:

```text
BTAI REVIEW <version>
```

Claude writes `...-review-002.md`, then returns:

```text
BTAI HANDOFF CLAUDE <version> review-002
```

## Attachment fallback (when Claude cannot write to the repository)

If Claude cannot access or write to the shared repository, it must create a single Markdown file named `<version>-review-001.md` using the inbox format. Darren attaches that one file to Codex and sends:

```text
BTAI HANDOFF CLAUDE <version> review-001 (attached)
```

Codex saves it into the inbox before acting. No terminal commands, diffs, or extra evidence collection are required from Darren.

## Anti-loop rule

- Re-review only after a material fix: customer-flow defect, safety/privacy/access-control issue, release blocker, or substantive regression.
- Do not loop on copy preference, style, formatting, or speculative concerns.
- After two review/fix cycles on the same release, Codex summarizes remaining trade-offs for Darren instead of starting a third cycle automatically.
- A reviewer must cite a file/line or an explicit missing-evidence item. Unsupported concerns are non-findings.

## Authority limits

These commands never authorize Production deployment, emailing customers, enabling delivery, changing credentials/settings, or spending money. Darren approves those separately.
