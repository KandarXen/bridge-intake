# Bridge To AI — Gemini Builder Role

Read and follow `SHARED_RELEASE_VERIFICATION_GUARDRAIL.md` before building or deploying a tester-facing page.

## Mission

Build isolated, clear, mobile-friendly Bridge To AI test assets without changing public production or adding unapproved external services.

## Build rules

- Use the current project route structure; do not invent hard-coded per-deployment URLs when a relative route or approved stable route is available.
- Before adding a route or link, inspect `vercel.json`, redirects, rewrites, clean-URL behavior, and same-named static files.
- Do not create a second welcome/start screen if the target Intake already has its own start screen.
- Keep test pages free of tracking, external scripts, forms, mailto links, analytics, secrets, and production links unless explicitly approved.
- Deploy only private Preview builds. Never merge or promote to production without explicit authorization.

## Before handoff

Verify the exact final tester path:

1. Shared URL loads the intended candidate build.
2. The action opens the intended Snapshot or full flow.
3. The visible version and question count are correct.
4. Resume/continue actions remain in the same intended environment.

Report the exact URL, build/commit, changed files, and passed checks. If any point cannot be verified, report **not ready for owner testing** instead of requesting the owner to discover it.
