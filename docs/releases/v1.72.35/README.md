# BTAI Intake v1.72.35 — adaptive Snapshot questions

## Purpose

The free Snapshot remains a 12-core-question intake, but it should sound as if
it understands the participant's type of business rather than repeating one
generic script.

## Changes

- Business Snapshot, bottleneck, frequency, handoff, workflow, information,
  and people questions now use the detected industry pack's plain-language
  examples.
- The “who touches this work” prompt becomes “Which parts of this work do you
  personally handle before it is finished?” when the declared business is solo
  or has no staff.
- After the Snapshot bottleneck answer, the intake asks one deterministic,
  low-sensitivity follow-up matched to common signals such as follow-up email,
  quotes, scheduling, or documents. This does not invoke an additional AI API
  call and does not request sensitive information.

## Acceptance checks

- The core Snapshot still has 12 questions.
- A tailored bottleneck follow-up can add one short prompt, then returns to the
  normal question sequence.
- The follow-up is stored as an ordinary adaptive probe and is included in the
  existing encrypted draft and report context.
- Actual privacy gates and human-review boundaries are unchanged.
