# local_verify

Goal: All runnable local checks relevant to the issue pass, or an evidenced external/pre-existing blocker is explicitly identified.

Identify the canonical commands in Makefile, project scripts and .github/workflows.
Run the applicable tests, race/integration tests if required, lint, security scans, formatting, generated-code checks and coverage thresholds.
Never claim success from missing, skipped or incomplete checks. Save exact commands and results in the external state directory.
On a change-caused failure, use the rework transition to implement. Do not publish a PR with unfixed change-caused failures.
If checks cannot run because of environment-only issues, document evidence and apply the stop conditions in the shared rules.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.
