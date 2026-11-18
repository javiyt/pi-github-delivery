# Pi GitHub Delivery

Implement a GitHub issue from Pi with a single command:

```text
/issue https://github.com/owner/repo/issues/123
```

The command selects the delivery agent, starts the workflow at its first stage, and coordinates investigation, planning, implementation, local validation, independent review, PR publication, CI, optional squash merge, and a final report. Every stage and retry runs in a fresh subagent session. Detailed artifacts outside the repository carry the context between stages.

A progress panel above the editor displays the active subagent's responses and tool output without adding them to the coordinator's context.

## Installation

Requires Node.js 22+, Pi, `pi-agent-suite`, Git, and an authenticated GitHub CLI. Locally validated with Pi 1.5.0 and pi-agent-suite 2.22.3. This package does not include or modify GitHub or model-provider credentials.

```sh
pi install npm:pi-agent-suite
pi install git:github.com/javiyt/pi-github-delivery
```

Restart Pi, then configure the resources once:

```text
/issue-setup
```

This installs the agents, rules, and workflow, then reloads Pi. From the repository you want to work on, run:

```text
/issue https://github.com/owner/repo/issues/123
```

You can also use `/issue 123` or `/issue #123` against the current repository. Pull request URLs are not accepted. You do not need to select agents or activate workflows manually.

At startup, Pi asks whether to merge the PR automatically or leave it open. You can also specify the policy directly:

```text
/issue https://github.com/owner/repo/issues/123 --no-merge
/issue https://github.com/owner/repo/issues/123 --merge
```

`--no-merge` runs implementation, validation, review, publication, and CI, then moves directly to the final report and leaves the PR open for manual merge. `--merge` adds the squash-merge stage, subject to the repository's safeguards. Canceling the selection starts no work. Non-interactive use requires an explicit option. The policy is saved in the run artifacts; issue content cannot override it.

The initial configuration uses the model selected in Pi for every stage and the reviewer, in independent sessions. Choose a model that supports tools. The workflow checks the repository and issue requirements before changing code.

## Models by stage

The optional oMLX profile uses this allocation:

```text
/issue-setup omlx
```

| Work | Model | Thinking |
| --- | --- | --- |
| Repository setup, publication, and merge | Qwen3.5-9B-MLX-8bit | off |
| Investigation, validation, CI, and reporting | Qwen3.5-9B-MLX-8bit | low |
| Planning | Qwen3.8-27B-4bit | medium |
| Implementation | Qwen3-Coder-30B-A3B-Instruct-MLX-4bit | off |
| Review | GLM-4.7-Flash-MLX-8bit | off |

All use the `omlx` provider. Install the models and register their IDs in Pi before running `/issue`. This package does not download models, configure inference servers, or modify Pi's `models.json`. Preferences are saved in `<suite>/github-issue-delivery/models.json` and preserved across updates.

For another provider, copy `profiles/current.json`, add `coordinator` and `stages` entries using `{ "id": "provider/model", "thinking": "medium" }`, and install the profile through the CLI:

```sh
node bin/setup.mjs --profile /path/to/my-profile.json
```

Alternatively, edit the local preferences file and run `/issue-setup` without arguments. `/issue-setup current` returns to the selected model. The reviewer uses the review stage's model; the general worker inherits the active stage's settings. The coordinator also switches models by stage.

### Selecting models interactively

```text
/issue-setup --select
```

Walks through the coordinator and every workflow stage with Pi's model picker: choose the model for each role from all registered chat models (or type a `provider/model` ID for a model that is not listed), then choose its thinking level. The resulting profile is saved to `<suite>/github-issue-delivery/models.json` and applied to the workflow. Cancelling at any prompt leaves the previous profile and resources unchanged.

The same selection runs from a terminal without Pi:

```sh
node bin/setup.mjs --select
```

## Updating and existing files

To follow updates on the main branch, install without a tag:

```sh
pi install git:github.com/javiyt/pi-github-delivery
pi update --extensions
```

Then restart Pi and run `/issue-setup`. An installation pinned to a tag does not automatically move to another version; install a newer tag to upgrade it.

The installer manages only its own resources. It detects existing or locally modified files and stops before replacing them. To adopt an earlier configuration of this workflow, inspect the changes first:

```text
/issue-setup omlx --dry-run --adopt
/issue-setup omlx --adopt
```

`--adopt` creates backups before replacing resources. Normal updates are allowed when managed files match their last installed contents. Customize models through the local profile; direct edits to rules are treated as local changes that require review before updating.

If you previously installed the standalone `github-issue-delivery.ts` and `subagent-progress.ts` extensions in `~/.pi/agent/extensions/`, move them to a backup directory outside `extensions/` before loading this package. This avoids duplicate `/issue` commands and progress panels. Keep the backups if you want to restore the earlier installation.

## Progress panel

- `/subagent-progress off`: hide the panel.
- `/subagent-progress on`: show it.
- `/subagent-progress clear`: clear the display until the next subagent update.
- `/subagents` or `Ctrl+Alt+S`: open agent-suite's full history view.

The panel displays up to six recent lines and refreshes approximately every 600 ms. With concurrent subagents, it shows the active session with the most recent activity and indicates how many sessions are active. It does not display thinking or every token. It uses temporary files separated by root session, with no model calls or additional context messages. Pi continues saving its sessions and delivering agent-suite's final receipts.

Child processes must load this extension. Agent-suite's default configuration (`subagents.extensions.mode: all`) allows this. In `explicit` mode, include this package's `extensions/subagent-progress.ts`; in `none` mode, child activity cannot be displayed.

## Artifacts and safeguards

Artifacts are saved under `$HOME/.pi/agent/issue-delivery/<OWNER>/<REPO>/<NUMBER>/`: the original request, research, plan, implementation, validation, review, publication, CI, merge, and final report, with logs and results for each attempt. Failed evidence and retry counters are preserved. These files are excluded from delivery commits.

The workflow preserves unrelated work, avoids force-push and destructive cleanup, requires review and validation, and checks CI for the current HEAD before merging. Retries are bounded, and the workflow stops when blocked. `/issue` authorizes opening or updating the PR. Squash merge is authorized only when you select automatic merge at startup and all repository checks and protection requirements pass.

Pi must remain running to watch CI and fix failures. Subagent conversations are fresh, but they share the filesystem. The coordinator retains brief dispatches and receipts. Read/write and reviewer restrictions are agent policies, not an operating-system sandbox. Models are not guaranteed to follow every instruction; verify results before using this workflow on important repositories.

## Uninstalling

Before removing the package, run:

```text
/issue-setup --uninstall
```

This removes unmodified managed resources and restores adopted files from their original backups, if applicable. Backups, model preferences, and issue artifacts are preserved. Then remove the package:

```sh
pi remove git:github.com/javiyt/pi-github-delivery
```

Use the same source you originally installed. This does not uninstall pi-agent-suite.

## Development

```sh
npm ci --ignore-scripts
npm test
npm pack --dry-run
```

To install from a local checkout:

```sh
pi install ./
node bin/setup.mjs --profile omlx --dry-run
```

`PI_AGENT_SUITE_DIR` overrides the agent-suite directory. The CLI also accepts `--suite-dir DIR`, `--profile current|omlx|FILE`, `--adopt`, `--dry-run`, and `--uninstall`. Commands inside Pi respect its active agent directory.

Tests use temporary directories and Pi API test doubles to verify installation, conflict handling, restoration, commands, and the visual progress channel. They do not implement or merge real issues. CI runs on Node.js 22 and 24. Workflow source files live in `resources/`; installation paths are resolved during setup.

MIT license. [Pi packages](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md) · [Pi Agent Suite](https://github.com/n-r-w/pi-agent-suite).
