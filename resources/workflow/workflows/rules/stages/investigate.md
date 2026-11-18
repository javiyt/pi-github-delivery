# investigate

Goal: The issue, acceptance criteria, linked issues and PRs, dependencies, code and baseline checks are understood and documented.

Extract the GitHub issue from the user's URL or number, validate the current repository, and follow the Research section of the shared rules.
Read the complete issue and comments, cross-references, blocking issues, relevant PRs, and project architecture.
Identify already-merged or ongoing implementations before taking action.
Identify the baseline local tests and CI jobs; note any pre-existing failures.
Save a complete, evidence-backed research record as context.md under the external state directory. Do not change source code, create a branch, or modify the remote GitHub project during this stage.
If the ticket is closed, duplicated, already covered by an open PR, or the working repository does not match the issue, resolve the conflict safely before continuing.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.
