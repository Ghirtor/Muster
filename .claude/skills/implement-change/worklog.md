# The branch work log

The skills of `/issue-work` (`issue-start`, `implement-change` and the three it runs —
`tdd-implement`, `branch-review`, `app-verify` — and `issue-handoff`) can each run on their
own, in a different session from the one before. They pass what they learned to each other
through one file per branch:

```
.claude/worklog/<branch-name>.md
```

The folder is gitignored, so the log is never committed. It outlives the session, so a skill
started tomorrow in a fresh session reads what yesterday's left behind.

The log lives in the main checkout even when the branch has its own worktree; its
`Worktree:` line then says where every skill runs the branch's code, tests and git commands.

Create the file if it does not exist yet, with the sections below, and keep them in this
order. Each skill only appends to its own sections; edit an earlier entry only to mark it
superseded.

```markdown
# <branch-name>

Worktree: <absolute path> (omitted when the branch is worked in the main checkout)

## Ticket
<ISSUE_KEY> (<issue reference>, if it differs) — <title>. Bug fix | Feature/task. Source branch: <SOURCE_BRANCH>.
Acceptance criteria, one per line. Clarifications the user gave.
(No issue: the user's request in their words, the base branch, and the criteria
derived from it.)

## Decisions
- <what was chosen> — <why>. Rejected: <alternative>. Source: user | ticket comment |
  code constraint | own judgement.

## Seams
- <public interface tested at> — catches: <what>. Misses: <what>. Agreed with the user.

## TDD exemptions
- <change> — <why no suite can observe it>. Covered by: <what checks it instead>.

## Review findings
- [bug|spec|standards] <finding> — fixed | reverted | rejected: <reason> | raised with the user.

## App verification
- <scenario exercised> — <what actually landed>. Not exercised: <what and why>.

## Checkpoint
- Approved by the user at <commit sha>.
```

A choice missing from **Decisions** looks unexplained to the reviewers, so log it when you make
it, not at the end. Answers the user gives while you work are decisions with source `user`.
