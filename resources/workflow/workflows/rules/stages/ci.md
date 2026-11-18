# ci

Goal: All applicable GitHub CI checks for the latest PR head SHA have completed successfully, and branch protections are not bypassed.

Watch GitHub checks for the PR with gh pr checks --watch (or bounded polling), and inspect statusCheckRollup/required checks for the latest head SHA.
Pending is not failed, missing checks are not green, and results from an older SHA are not evidence.
On a change-caused failure, capture relevant run logs and rework to implement; then repeat local_verify, review and publish on the new commit.
Rerun proven flaky/infrastructure failures at most once. Do not blindly rerun a code failure.
Stop and report if checks fail repeatedly, remain pending beyond the configured operational budget, or require external approval. Do not continue to merge until current-head checks are green.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.

After all required checks pass for the latest HEAD, read the immutable mergePolicy from handoff.json. Recommend merge with ground auto_merge_enabled only for auto policy; recommend report with ground manual_merge_selected for manual policy. Manual mode still requires all review and CI gates and must leave the PR open. Missing policy is BLOCKED.
