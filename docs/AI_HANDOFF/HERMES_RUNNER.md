# Hermes local release runner

## What this is

The Hermes Release Runner is a small, local Node.js coordinator for the BTAI release loop. It reads the fixed handoff files, prepares a Claude review task, validates Claude’s report, tracks the current loop state locally, and produces the next command for Codex.

It does **not** deploy, send emails, invoke report generation, alter credentials, or call an external model by default.

## Commands

Run from the BTAI repository root:

```powershell
node scripts/hermes-release-runner.mjs status
node scripts/hermes-release-runner.mjs prepare
node scripts/hermes-release-runner.mjs check
```

- `status` reads the current release and shows the latest Claude report, if present.
- `prepare` writes a review task into `OUTBOX/CLAUDE/` and records local state.
- `check` validates the latest Claude report and prints either the Codex handoff command or the exact report-format repair required.

Use `prepare --dry-run` to inspect the task without creating files.

## Local model adapters — deliberately disabled

`dispatch-claude` is included but disabled. It can run only when an ignored local configuration file explicitly enables it:

`docs/AI_HANDOFF/hermes-runner.config.local.json`

That file must define the exact installed Claude CLI command and arguments for Darren’s account. It is ignored by Git and must never contain source code, customer data, or committed credentials.

Before enabling it, Hermes needs confirmation of:

1. Which local Claude command is installed and supports unattended use.
2. Whether it uses subscription login or an API key.
3. The approved budget/cap if API billing applies.
4. Whether Gemini is also to be automated, and by which local command or API.

## What still needs a decision

The runner can coordinate files today. Fully hands-off model dispatch requires at least one authenticated model adapter. Codex desktop itself is not exposed as a general local command-line worker by this runner, so its later adapter must be deliberately chosen rather than guessed.

## Safety rules

- The runner stops after a report and does not apply a code change on its own.
- It validates the required Claude report sections and exact handoff command.
- It tracks local runner state in an ignored file, so no private operational state is committed.
- A future dispatch adapter must preserve the two-cycle maximum defined in `COMMAND_PROTOCOL.md`.
