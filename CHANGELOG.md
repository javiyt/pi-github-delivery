# Changelog

## [0.1.3] - 2026-11-18

- The `--select` prompt now asks how you want to assign models: choose a model and thinking level for each stage individually, keep the current model for every stage, or use one model for every stage.
- Model lists are narrowed to the models your Pi session can actually use, so the picker no longer drowns in unrelated catalog entries; per-stage selection remains available from the first prompt.
- Sync the lock file version with the manifest.

## [0.1.2] - 2026-11-18

- `/issue-setup --select` chooses the model and thinking level for the coordinator and every workflow stage interactively, from all models registered in Pi.
- `pi-github-delivery-setup --select` runs the same selection from a terminal and lists models from the Pi model registry.
- Selections are saved to the local model profile and applied on install; cancelling leaves the previous profile and resources unchanged.

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
