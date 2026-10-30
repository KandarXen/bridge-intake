# Claude review inbox

Claude writes exactly one report per review pass here:

```text
vX.XX.XX-review-001.md
vX.XX.XX-review-002.md
```

## Required report format

```markdown
# BTAI Intake vX.XX.XX — Claude review NNN

## Release posture
Ready for private Preview / Not ready / Needs evidence

## What was verified

## Blockers

## Important before broader tester use

## Non-blocking observations

## Safety regression result

## Evidence gap, if any

## One recommendation

## Codex action requirements
- `Required` / `Recommended` / `No action`
- A short, testable description of each action.
- The evidence that makes the action necessary.

## Codex handoff
BTAI HANDOFF CLAUDE vX.XX.XX review-NNN
```

## Evidence rule

Each finding must cite a file/line, an observed test result, or a precise missing-evidence item. Do not restate intended behavior as a finding. Do not use connectors or alter the system.
