# repository_setup

Goal: The working tree is clean, based on the remote default branch with all latest changes pulled and orphan branches removed.

Validate the requested issue repository against the current git remote BEFORE any mutation. Resolve the issue identity using the Research rules, without performing the full investigation yet. Inspect dirty work and discover the actual default branch. Follow Safe Git preparation in the shared rules: fetch origin --prune, preserve unrelated branches and all uncommitted work, and delete only a confirmed issue-local merged orphan with git branch -d. Never use git branch -D. Safely switch to the default branch and pull --ff-only only when clean and compatible; otherwise record the blocker. Do not create a feature branch. Record original/current branch, default branch, before/after SHAs, dirty status, fetch/pull results and every retained/deleted branch with evidence in repository-setup.md.

Read the shared rules and artifact contract supplied in your handoff. Execute ONLY this stage. Any instruction above to transition means record the recommended transition/ground in result.json; only the coordinator calls workflow tools. Write all evidence before returning. Never rely on another agent conversation.
