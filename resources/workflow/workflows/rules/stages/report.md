# report

Goal: The user receives a complete, evidence-based status report with issue, branch, changes, local checks, review, PR, CI, merge, Projects and orphan branches.

Confirm the final issue and PR state from GitHub. If merged, optionally safely delete only the issue-local branch using git branch -d; leave other branches untouched.
Preserve issue notes and evidence in the external state directory. Never claim auto-closure without checking the issue status.
Follow the required Final report format in the shared rules. State clearly any step that was skipped or blocked.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.

With mergePolicy manual, verify that the PR is still OPEN and current-head checks passed. State that merge was deliberately skipped by user choice and that the PR is ready for manual merge. A merge.md artifact is not required for that route; cite the CI result and saved policy instead. Do not claim the issue was closed or mark the planned manual handoff as blocked.
