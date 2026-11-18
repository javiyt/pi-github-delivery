# Detailed artifacts and stage handoffs

Artifacts are the durable source of delivery context. Write enough factual detail for a fresh worker to continue without reading any prior conversation. Prefer completeness and traceability over short notes; concise chat output must never mean abbreviated evidence on disk. Do not invent padding, hidden reasoning, measurements or successes.

## Layout and ownership

The coordinator supplies absolute STATE_PATH, RUN_PATH and ATTEMPT_PATH. Do not derive a different location. Each attempt writes its own immutable evidence under `ATTEMPT_PATH`; use relative references inside that directory and absolute references in the routing manifest. Never overwrite previous attempts. During an active attempt files may be updated; once the completion receipt is published, treat that attempt as immutable.

Write the stage's full report in the attempt directory, then publish a complete canonical copy under the state root for existing consumers. Canonical files are latest-view conveniences, never sufficient proof of freshness by themselves. Include run/attempt and immutable source path in every canonical copy. Write artifacts atomically via a temporary file and rename; publish `result.json` LAST, after all report/log writes and canonical copies succeed. Do not delete earlier runs or evidence during final cleanup.

| Stage | Canonical report | Required detail |
| --- | --- | --- |
| repository_setup | repository-setup.md | Issue/repository validation, initial dirty state, base/branch/SHAs, fetch/pull evidence and orphan branch decisions |
| investigate | context.md | Full issue and relevant comments/references (without secrets), acceptance IDs, dependencies and states, architecture/symbol/file references, baseline commands and failures, open questions |
| plan | plan.md | Requirement-to-change-to-test mapping, file/component changes, interfaces/migrations, implementation sequence, alternatives with reasons, risks, rollback and invalidation conditions |
| implement | implementation.md | Branch creation/resume evidence, per-file changes and purpose, design decisions, all acceptance IDs, tests added/changed, rework finding dispositions, outstanding gaps |
| local_verify | local-checks.md | Every check's exact command, cwd, UTC times, exit code, complete safe stdout/stderr log paths, test/coverage counts where available, baseline comparison and diff fingerprint |
| review | review.md | DECISION, REVIEWED_HEAD, complete diff fingerprint, acceptance-by-acceptance assessment, severity/path/line/evidence/failure mode/fix advice, validation gaps and uncertainty |
| publish | publish.md | Intended file list, review/check linkage, approved-content comparison, commit SHA, safe push result, PR identity/base/head/URL and complete PR body |
| ci | ci.md | Latest head, expected/required checks, each job/run ID/URL/state/times, raw safe status snapshots/logs, failure classification, rerun/fix counters and final gate outcome |
| merge | merge.md | Refreshed safeguards and observed head, approvals/protection evidence, exact merge command/outcome, mergedAt/mergeCommit/state verification |
| report | report.md | Shared-rules final report with verified issue/PR status, outcome, limitations, concrete next step and links/paths to all run evidence |

Read request.md, handoff.json, your task and shared rules first, then required input artifacts. Typical dependencies: plan reads context; implement reads context/plan plus precise rework findings; verification reads context/plan/implementation and CI definitions; review reads all four; publish reads validation/review/implementation; CI reads publication/check policy; merge reads publication/review/CI; report reads the stage outcomes and rechecks live final state. Use immutable attempt paths from the manifest to avoid accidentally reading stale canonical copies. For manual merge, report reads the explicit CI-to-report transition and mergePolicy instead of merge.md; record that merge was skipped by user choice and the PR remains open. Missing other required inputs mean BLOCKED, not a guess from conversation.

## Common evidence sections

Every report includes stage/run/attempt identity, issue URL, repository path, immutable mergePolicy (auto/manual), start/end UTC, input artifact paths, actual branch/base/HEAD before and after, and observed outcome. Use stable acceptance IDs (AC-1, AC-2, ...), distinguish observations from assumptions, explain decisions and rejected alternatives where relevant, and identify unresolved risks/blockers. Include source links, file/line or symbol references, exact commands and safe logs that substantiate conclusions. Capture live snapshots where they matter. Store full useful safe logs separately and link them rather than truncating away failure details. Redact secrets and sensitive values before persistence; record redaction without revealing the original value.

For source-sensitive gates record `git status --porcelain=v1`, base SHA, HEAD SHA and hashes of committed/staged/unstaged diffs plus intended untracked file contents. Explain the exact fingerprint commands. HEAD alone does not identify uncommitted content. Never claim a previous review still applies after content changes. A fresh rework attempt reads prior failure artifacts, records each finding's disposition and preserves earlier failed evidence.

## Completion manifest and compact response

Write ATTEMPT_PATH/result.json containing:

```json
{
  "stage": "stage-id",
  "mergePolicy": "auto | manual",
  "run": "absolute run path",
  "attempt": 1,
  "outcome": "COMPLETE | REWORK | BLOCKED",
  "issueUrl": "verified issue URL",
  "repository": "absolute repository path",
  "branch": "observed branch",
  "head": "observed SHA",
  "inputs": ["absolute immutable input paths"],
  "artifacts": ["absolute report and evidence paths"],
  "goalEvidence": ["path plus precise section identifying verified goal evidence"],
  "nextStage": "existing graph target or null",
  "ground": "declared rework ground or null",
  "decision": "APPROVE | REQUEST_CHANGES | BLOCKED | null",
  "blockers": [],
  "summary": "short factual outcome"
}
```

Use real JSON null and real values, not the illustrative alternatives above. Missing facts remain null with an explanation; do not fabricate values. COMPLETE requires the stage goal actually holds; for review this requires APPROVE. REQUEST_CHANGES yields REWORK; inability to inspect yields BLOCKED. Use only declared workflow edges/grounds. The final report stage may be COMPLETE with a documented blocked delivery outcome if it has truthfully reported that outcome; never mark an unmerged ticket delivered.

Return at most about 12 lines: STAGE, OUTCOME, RESULT_PATH, ARTIFACT_PATHS, HEAD, DECISION (review), NEXT_STAGE/GROUND and a short blocker/summary. Put detailed explanations, review findings and command output in artifacts, not in the final child response. The plan summary for the user should be one or two sentences in the receipt; the full plan stays in plan.md. The coordinator presents the final report to the user.
