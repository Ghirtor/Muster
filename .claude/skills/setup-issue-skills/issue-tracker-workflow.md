# Tracker doc: the issue skills' sections

Append these to `docs/agents/issue-tracker.md`, after the base Matt Pocock's setup wrote. Each
bullet is a section a skill names; replace its description with how this tracker does it.

```markdown
This file is the only place the skills learn how the tracker works. The skills name operations
(**Fetch an issue**, **Mark started**, ...) and do what the matching section says, so moving to
another tracker means rewriting this file, not the skills.

## Identifiers

- **Issue key** and **issue reference** — the key starts commits and change request titles
  (`<ISSUE_KEY>: <summary>`); the reference is how the tracker itself writes an issue, when
  that differs (`#12` for `FEAT-12`). How to get one from the other.
- **Branch name** — the rule a new branch is named by, starting with the issue key, with an
  example. How to read the key back from the checked-out branch.

## Workflow operations

What `/issue-work`, `/issue-batch` and the skills they run ask of the tracker:

- **Fetch an issue** — the command that reads an issue with its comments: triage's Agent Brief
  lives in one.
- **Is it ready for an agent?** — its labels include `ready-for-agent`
  (`docs/agents/triage-labels.md`) and a comment holds an `## Agent Brief`; the latest wins.
- **Mark started** — what moves the issue to in progress (a status, a label, an assignee).
- **Mark in review** — what moves it to in review, and who it is assigned to then.
- **Post the test plan** — how to comment the test-plan checklist on the issue, starting with a
  link to the change request, in the format the tracker renders as checkboxes.
- **Has it been started?** — the issue is in progress or in review, or a work log
  `.claude/worklog/<branch-name>.md` or worktree `.claude/worktrees/<branch-name>` of a branch
  named after it exists (write the glob the **Branch name** rule gives).
- **List my ready issues** — the query for issues assigned to the user, labelled
  `ready-for-agent`, not done, most urgent first.
- **Link an issue from a change request** — what in the change request's title or description
  makes the tracker link the issue (a key at the start of the title, `Closes #12`, ...).
```
