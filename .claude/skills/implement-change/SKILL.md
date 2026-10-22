---
name: implement-change
description: >
  Use when a change on this repo should be implemented test-first, reviewed and checked in
  the real app, without opening a change request — whether it comes from a tracked issue or
  from a request the user makes with no ticket at all. Triggers on "implement this and check
  it", "make this change properly", or as step 2 of `/issue-work`.
---

# Implement change — implement, review, verify

Run three sub-skills in order on the current branch: `tdd-implement`, `branch-review`,
`app-verify`, then hold a review checkpoint with the user, looping back until they approve.
It stops before anything leaves the machine — no push, no change request, no tracker update.

## Inputs

- **What to build** — the issue the branch is named after, or the user's request when
  there is no issue.
- **`BASE`** — what the branch is compared against in review. Take it from the work log's
  **Ticket** section, else the target of the branch's open change request
  (`docs/agents/code-host.md`, **Find the change request for a branch**), else ask the user.

Work on the branch that is checked out. If it is `main`, stop and ask
which branch to use.

## Step 1 — Make sure the work log exists

The work log is `.claude/worklog/<branch-name>.md`, laid out as
`.claude/skills/implement-change/worklog.md` describes. `issue-start` has already opened it when
there is an issue.

With no issue, create it and fill the **Ticket** section from the request: the user's
words as they gave them, `BASE`, and acceptance criteria you derive from the request, one per
line. Those criteria are what `branch-review` will hold the change to.

When the log has no **Seams** section filled in, call the Skill tool with
`mattpocock-skills:grilling` and grill the user on the request before the sequence starts. Its
frontier holds every question the request leaves open, the criteria, and the seams, described
as `issue-start` Step 5 describes them. Done when the frontier is empty and the user has
confirmed every seam; log what it settles as `issue-start` Step 5 does.

## Step 2 — Run the sequence

1. **`tdd-implement`** — implement test-first, logging decisions and TDD exemptions.
2. **`branch-review`** with `BASE` — review against the spec, the standards and for bugs, refactor and fix the confirmed findings
   through `tdd-implement`.
3. **`app-verify`** — check the reviewed branch in the running app, fixing what it turns
   up through `tdd-implement`.

Run them without stopping, apart from questions a sub-skill says to ask; the first planned
stop is the Step 3 checkpoint. Review comes before app verification so the app is checked on
the code that will be pushed.

## Step 3 — Review checkpoint

**Stop and let the user review the branch.** Nothing leaves the machine until they approve
it here. Show them what is on it:

```
git log --oneline <BASE>..HEAD
git diff --stat <BASE>..HEAD
```

Summarize the commits and changed files, and from the work log: the decisions made on your
own judgement, the TDD exemptions, the review findings with what was done with each, and
what the app verification did and did not exercise. Then ask the user to approve.

- **Approved** — log it under **Checkpoint** with the approved commit (`git rev-parse HEAD`).
- **Not approved** — log the user's feedback under **Decisions** with source `user`, and go
  back to Step 2 with it: `tdd-implement` makes the changes, then `branch-review` and
  `app-verify` run again on what changed. Then come back to this checkpoint. Repeat until
  the user approves.

When called on its own, stop once approved. Pushing is a separate step: offer `issue-handoff`
when the branch has an issue, or `open-pr` to push and open a change request when it does
not.
