# plan

Goal: A scoped plan with file changes, tests, risks, dependencies and acceptance criteria is recorded and internally checked.

Read the research record. Produce an explicit implementation plan BEFORE changing code.
Include: issue goal, known dependencies, files to inspect/change, interface or data migration impacts, test strategy, local commands matching CI, acceptance-criteria mapping, and rollback/risks.
Save the plan in the external state directory as plan.md. Present a brief plan summary to the user.
Do not ask for approval solely because planning is complete: the user's request authorizes the normal implementation, PR and merge flow. Stop for input only when scope, missing permissions, destructive work, or conflicting project requirements make autonomous progress unsafe.
Do not use plan_mode_complete or any unrelated Plan Mode extension tools; use workflow_transition only.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.
