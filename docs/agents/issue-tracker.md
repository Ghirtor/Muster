# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.
Pull requests and CI are the code host's business: `docs/agents/code-host.md`.

This file is the only place the skills learn how the tracker works. The project's skills
(`/issue-work`, `/issue-batch` and the skills they run) name operations (**Fetch an issue**,
**Mark started**, ...) and do what the matching section says, so moving to another tracker means
rewriting this file, not the skills.

## Identifiers

- **Issue reference** — how the tracker names an issue: `#<n>`, where `<n>` is its number.
- **Issue key** — how commits and branches name it: `FEAT-<n>`, the same number (`#12` is
  `FEAT-12`). The `commit-msg` hook requires `FEAT-<n>: <summary>`.
- **Branch name** — `FEAT-<n>/<Title_words_joined_by_underscores>`: the key, a slash, then the
  title in alphanumerics and underscores only, accents dropped, 6–8 meaningful words at most, e.g.
  `FEAT-12/Lock_queue_for_one_per_machine_rigs`. The key of the work in progress is read off the
  checked-out branch. The slash nests whatever is named after the branch (work log, worktree,
  evidence folder) under a `FEAT-<n>/` folder; create it first. Never name a branch `FEAT-<n>`
  alone: git cannot keep it beside `FEAT-<n>/...`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue** (**Fetch an issue**): `gh issue view <number> --json number,title,body,labels,assignees,state,comments`.
  The comments are part of the ticket, and triage's Agent Brief lives in one.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
  A label must exist first: `gh label create <name> --color <hex>` once per repo.
- **Assign**: `gh issue edit <number> --add-assignee <login>` (`@me` for yourself).
- **Close**: `gh issue close <number> --comment "..."`. Merging a PR whose body says `Closes #<n>`
  closes it on its own.

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## Workflow operations

The issue-work flow (`issue-start`, `issue-handoff`, `/issue-batch`) moves an issue through three
states. GitHub has no status field, so labels carry them; create the two labels once per repo:

```
gh label create in-progress --color FBCA04 --description "An agent or a person is on it"
gh label create in-review --color 0E8A16 --description "Its pull request awaits review"
```

- **Is it ready for an agent?** — its labels include the `ready-for-agent` string from
  `docs/agents/triage-labels.md`, and a comment holds an `## Agent Brief` (the latest one wins).
- **Mark started**: `gh issue edit <n> --add-assignee @me --add-label in-progress`. Skip it when
  the issue already carries `in-progress`.
- **Mark in review**: `gh issue edit <n> --remove-label in-progress --add-label in-review`, then
  assign the reviewers listed in `docs/agents/code-host.md` (**Reviewers**), if any.
- **Post the test plan**: **Comment on an issue** with this body:

  ```markdown
  PR: <PR url>

  ## Test plan

  - [ ] <scenario>
  ```

- **Has it been started?** — it carries `in-progress` or `in-review`, an open PR names it
  (`gh pr list --search "FEAT-<n> in:title" --state open`), or this machine has its work log or
  worktree (`.claude/worklog/FEAT-<n>*` or `.claude/worktrees/FEAT-<n>*` exists).
- **List my ready issues** (for `/issue-batch`), most urgent first:
  `gh issue list --assignee @me --label ready-for-agent --state open --json number,title,labels`.
  There is no priority field: put issues labelled `priority:high` first, then oldest first.
- **Link an issue from a change request**: put `Closes #<n>` in the PR body.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
