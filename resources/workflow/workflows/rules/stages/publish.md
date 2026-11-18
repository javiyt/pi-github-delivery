# publish

Goal: The issue branch is pushed and exactly one open PR targets the correct default branch, links the issue and describes local evidence.

Inspect git status and verify the expected issue branch. Stage only intended files, excluding all external work artifacts and local secrets.
Commit with Refs #N for incremental commits or Closes #N for the final commit. Push without rewriting history.
Look up any existing PR for this head branch; update it if present, otherwise create one against the actual default branch.
The PR body MUST contain a standalone Closes #N and a concise change summary, test results and any unresolved non-blocking risk.
Record PR number, branch and head commit SHA. Do not merge in this stage.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.
