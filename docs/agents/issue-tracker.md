# Issue tracker: GitHub

Issues for this repo live as GitHub Issues on the repo's GitHub remote. Use the `gh` CLI for every
operation; it infers the repo from `git remote -v` when run inside a clone. Pull requests and CI
are the code host's business: `docs/agents/code-host.md`.

This file is the only place the skills learn how the tracker works. The skills name operations
(**Fetch an issue**, **Mark started**, ...) and do what the matching section says, so moving to
another tracker means rewriting this file, not the skills.

## Identifiers

- **Issue reference** — how the tracker names an issue: `#<n>`, where `<n>` is its number.
- **Issue key** — how commits and branches name it: `FEAT-<n>`, the same number (`#12` is
  `FEAT-12`). The `commit-msg` hook requires `FEAT-<n>: <summary>`.
- **Branch name** — `FEAT-<n>-<Title_words_joined_by_underscores>`: alphanumerics and underscores
  only, accents dropped, 6–8 meaningful words at most, e.g.
  `FEAT-12-Lock_queue_for_one_per_machine_rigs`. The key of the work in progress is read off the
  checked-out branch.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>`. Use a heredoc or a file
  for multi-line bodies.
- **Fetch an issue**: `gh issue view <n> --json number,title,body,labels,assignees,state,comments`.
  The comments are part of the ticket, and triage's Agent Brief lives in one.
- **List issues**: `gh issue list --state open --json number,title,labels,assignees` with `--label`,
  `--assignee` and `--search` filters.
- **Comment on an issue**: `gh issue comment <n> --body-file <file>`. Bodies are GitHub markdown;
  a test plan is a `- [ ]` task list.
- **Apply / remove labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`. They
  leave the other labels alone. A label must exist before it is applied:
  `gh label create <name> --color <hex>` once per repo (`gh label list` to check).
- **Assign**: `gh issue edit <n> --add-assignee <login>` (`@me` for yourself).
- **Close**: `gh issue close <n> --comment "..."`. Merging a PR whose body says `Closes #<n>`
  closes it on its own.

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

- **Has it been started?** — it carries `in-progress` or `in-review`, or an open PR names it
  (`gh pr list --search "FEAT-<n> in:title" --state open`).
- **List my ready issues** (for `/issue-batch`), most urgent first:
  `gh issue list --assignee @me --label ready-for-agent --state open --json number,title,labels`.
  There is no priority field: put issues labelled `priority:high` first, then oldest first.
- **Link an issue from a change request**: put `Closes #<n>` in the PR body.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

**Fetch an issue** above, comments included.
