# Changelog

## [0.1.1] - 2026-11-18

- Translate the README, command help, notifications, merge-policy selection, generated workflow requests and progress panel into English.
- Preserve existing workflow behavior, model profiles and merge-policy safeguards.

## [0.1.0] - 2026-11-18

- `/issue URL` starts GitHub issue delivery from repository setup through an evidenced final report.
- Initial merge-policy selection, with `--merge` / `--no-merge` and an explicit CI-to-report route for manual merge.
- Fresh subagent session for every stage and retry, with detailed artifact-based handoffs.
- Independent review, bounded correction loops, current-head CI checks and guarded squash merge.
- `/issue-setup` installs portable resources, detects local changes, backs up adopted files and supports restoration.
- Current-model and optional per-stage oMLX profiles with Coder 30B implementation and GLM review.
- UI-only subagent progress panel, with no model calls or conversation injection.
