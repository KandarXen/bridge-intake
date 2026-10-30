# Bridge To AI — v1.72.25 Claude Re-review Package

Everything Claude needs for the follow-up review is in this folder.

## Send these files to Claude

1. `00-claude-original-review.md` — Claude's first review, retained for context.
2. `01-review-evidence.md` — review range, reported test output, redacted configuration state, and the requested review focus.
3. `02-code-diff.patch` — focused source changes from `8bd45a6` through `027b0c6`.
4. `03-send-email.js` — full current completion-notification handler; included because the handler did not change in the follow-up diff.
5. `04-private-test-page.html` — full static tester landing page.

## Paste this message into Claude

```text
Please re-review the attached v1.72.25 package. Use the response structure in 01-review-evidence.md. Do not use connectors or make external changes.
```

## Packaging rule going forward

Each release/review stage receives its own folder under `docs/review-packages/`.
Existing files are preserved until the owner explicitly approves archival or deletion.
