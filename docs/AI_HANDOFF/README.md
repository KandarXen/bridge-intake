# Bridge To AI — AI Handoff Centre

This folder is the single source of truth for collaboration among Codex, Claude, and Gemini on BTAI Intake.

## Read this first

Before starting work, each AI must read, in order:

1. `00_ACTIVE_RELEASE.md`
2. `CURRENT_STATUS.md`
3. `MODEL_ROLES.md`
4. `COMMAND_PROTOCOL.md`
5. `REVIEW_QUEUE.md`

Then read only the linked versioned evidence package needed for its task.

## Operating rule

The user is the product owner, not the technical messenger. Do not ask the user to collect command output, locate a repository folder, or reconcile two AI opinions when the needed evidence can be packaged here.

If an AI cannot access this repository, it must say exactly which handoff file or evidence packet it needs. It must not invent behavior or issue a release verdict without evidence.

## Ownership

- **Codex:** updates this handoff centre after a build, commit, Preview deployment, or material release decision; prepares a single evidence packet for independent review.
- **Claude:** independently tests/reviews the supplied evidence and reports only material findings, evidence gaps, and one recommendation. Claude does not edit, deploy, or alter settings.
- **Gemini:** creates product, business-development, research, and client-facing materials from the approved product state. Gemini does not make source-code or release decisions.

## No ping-pong rule

Do not send minor wording, formatting, or preference differences back and forth between models. Escalate only when there is a material product contradiction, safety/privacy/access-control concern, customer-impacting flow defect, or release blocker. State the evidence and recommended owner once.

## Folder map

- `CURRENT_STATUS.md` — current build, environment, safety posture, and active work.
- `00_ACTIVE_RELEASE.md` — the fixed entry point for the current candidate and its evidence.
- `COMMAND_PROTOCOL.md` — the exact short commands used between Claude and Codex.
- `MODEL_ROLES.md` — firm boundaries and handoff rules.
- `REVIEW_QUEUE.md` — the one active independent review and its complete evidence packet.
- `INBOX/CLAUDE/` — Claude’s structured review reports for Codex to read.
- `../review-packages/` — versioned, self-contained reviewer evidence.
- `../releases/` — concise release notes by version.
