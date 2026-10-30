# Bridge To AI — Global parking lot

Deferred work that is valuable but not justified by the current build stage. These items are not active release work.

## Fully autonomous Hermes release orchestration

**Status:** Parked — do not build the paid API-dispatch layer yet.

**What it would do:** After Darren says **Turn on Hermes**, a local Hermes runner would dispatch a Codex API builder, Claude API reviewer, and—only when needed—Gemini product/research task. It would manage the Build → Review → Fix → Re-review loop, write reports to the shared inbox, enforce the two-cycle limit, and stop at finished markers or a genuine owner decision.

**Why parked:** The current handoff centre, complete evidence packet, and local runner remove the largest manual burden already. At the present single-project, active-build stage, API automation would cost build time and API spend before it saves enough time to justify itself.

**Revisit when one or more is true:**

- BTAI has completed 5–10 comparable build/review cycles.
- Hermes is coordinating several active projects or clients at once.
- Manual relay and review packaging are consuming meaningful weekly time.
- There is an approved recurring API budget and a secure credential-storage plan.

**Prerequisites when resumed:**

- GitHub fine-grained token limited to the required repository permissions.
- OpenAI API key and per-release spend cap for the coding builder.
- Anthropic API key and per-review spend cap for independent review.
- An always-on runner host or a deliberate decision that Hermes runs only when Darren turns it on.
- Explicit approval for which actions may commit, push, create a Preview deployment, or merely prepare a change for review.

**Current value retained:** The local Hermes runner and shared handoff protocol remain in place. They will become the control plane if this item is resumed.
