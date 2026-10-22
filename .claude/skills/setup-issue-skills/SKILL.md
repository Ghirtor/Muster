---
name: setup-issue-skills
description: >
  Use when this repo needs setting up for the issue skills (`/issue-work`, `/issue-batch` and the
  skills they run), or when one of them stops because an agent doc or a section it names is
  missing. Installs and enables Matt Pocock's skills, then writes the agent docs that say how
  this project's tracker, code host, checks and app work. Triggers on "set up the issue skills",
  "configure the workflow skills for this repo", or a copy of these skills landing in a new repo.
---

# Setup issue skills — make this repo ready for `/issue-work`

The issue skills (`issue-start`, `implement-change`, `tdd-implement`, `branch-review`,
`app-verify`, `issue-handoff`, `open-pr`, `ci-watch`, and the commands `/issue-work` and
`/issue-batch`) are the same in every repo. All they know of a repo comes from three files,
whose sections they name in **bold**:

| File                           | What it says                                         | Template                                                 |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| `docs/agents/issue-tracker.md` | the tracker: identifiers, the workflow's operations  | [issue-tracker-workflow.md](./issue-tracker-workflow.md) |
| `docs/agents/code-host.md`     | the code host: pushing, change requests, CI          | [code-host.md](./code-host.md)                           |
| `docs/agents/project.md`       | the project: branches, commits, checks, the app      | [project.md](./project.md)                               |

They also run Matt Pocock's skills (`mattpocock-skills:tdd`, `:grilling`, `:code-review`,
`:diagnosing-bugs`, `:pr`, `:triage`, `:retro`), whose own setup writes the tracker doc's base,
`docs/agents/triage-labels.md` and `docs/agents/domain.md`.

This is a prompt-driven skill, not a script: explore, draft, confirm with the user, then write.
Never overwrite what a doc already says; fill in the sections it lacks.

## Step 1 — Matt Pocock's skills

Check `mattpocock-skills` is among your available skills. If it is not, ask the user to install
it (it is in the official marketplace):

```
claude plugin install mattpocock-skills@claude-plugins-official
```

Then enable it for everyone who clones the repo, in the committed `.claude/settings.json`
(create the file if needed, keep what is there):

```json
{ "enabledPlugins": { "mattpocock-skills@claude-plugins-official": true } }
```

If `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` or `docs/agents/domain.md` is
missing, or `CLAUDE.md` / `AGENTS.md` has no `## Agent skills` block, stop and ask the user to
run Matt Pocock's setup, which only they can invoke, then to run this skill again:

```
/mattpocock-skills:setup-matt-pocock-skills
```

## Step 2 — Explore

Read what exists before asking anything:

- `git remote -v` — the code host (GitHub, GitLab, other), and the repo's path on it.
- The tracker doc Step 1 left, and any `docs/agents/code-host.md` or `docs/agents/project.md`.
- The branches: `git branch -r`, the default branch, and which ones are protected (release
  branches, `main`, `dev`).
- The CI config (`.github/workflows/`, `.gitlab-ci.yml`, ...): its jobs and the runner OS.
- How the project installs, lints, type-checks, tests, formats and builds: `package.json`
  scripts, a `Makefile`, `*.csproj`, `pyproject.toml`, the README, `CLAUDE.md`.
- Commit hooks (`core.hooksPath`, `.husky/`, `.git/hooks/commit-msg`) and the commit-message
  format `git log --oneline -20` shows.
- Rule files the repo keeps for agents (`.claude/rules/`, `CONTRIBUTING.md`): test and code
  conventions.
- How the app runs for a person checking a change: dev-server commands, ports, a desktop
  shell, project skills that drive it (`.claude/skills/*-ctl`), hardware it needs.
- Whether `.claude/worklog/` and `.claude/worktrees/` are ignored already (`git check-ignore -v`).

## Step 3 — Draft the three docs

Write each from its template, which lists every section the skills name and what that section
must say. Fill the sections from what exploration found, and mark each one you had to guess.

1. **Tracker** — append the template's **Identifiers** and **Workflow operations** sections to
   `docs/agents/issue-tracker.md`, written in this tracker's own commands (MCP tools, `gh`,
   `glab`, ...). Keep the base Matt Pocock's setup wrote.
2. **Code host** — `docs/agents/code-host.md` from its template.
3. **Project** — `docs/agents/project.md` from its template.

Then take the user through the drafts one doc at a time, guessed sections first, and let them
edit before anything is written. Ask about what exploration cannot settle: who reviews change
requests, what marks an issue started or in review, the branch-name rule, which scenarios the
app is prone to, what the machine cannot stand in for.

## Step 4 — Write

Write the three docs. Then, keeping everything else in each file:

- `.gitignore` — add `.claude/worklog/` and `.claude/worktrees/` unless `git check-ignore` shows
  them ignored already.
- The `## Agent skills` block in `CLAUDE.md` (or `AGENTS.md`) — add, after **Domain docs**:

  ```markdown
  ### Code host

  [one-line summary: host, CLI, where change requests target]. See `docs/agents/code-host.md`.

  ### Project

  [one-line summary: how it installs, checks and runs]. See `docs/agents/project.md`.

  The issue skills (`/issue-work`, `/issue-batch` and the skills they run) name operations in
  bold and look them up in these files. To move to another tracker, host or project, rewrite
  the files, not the skills.
  ```

## Step 5 — Check every section the skills name

Each skill names its sections as "the tracker doc's **…**", "the code-host doc's **…**" or "the
project doc's **…**", sometimes wrapped across lines. List them and check each doc has every one, as a heading or a bold item:

```bash
find .claude/skills .claude/commands -name '*.md' -exec cat {} + | tr -s '\n ' ' ' |
  grep -oE "(tracker|code-host|project) doc's \*\*[^*]+\*\*" | sort -u
```

Report what you wrote, and any section left marked as a guess. `/issue-batch` starts sessions
with the Claude desktop app's session tools; say so if the user runs Claude Code elsewhere.
