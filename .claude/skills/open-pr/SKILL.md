---
name: open-pr
description: >
  Use when a pushed branch on this repo needs its change request (pull request) opened — title
  from its issue, description from the PR template with test and screenshot evidence, reviewers,
  the right target for a stacked branch. Triggers on "open a PR", "create the pull request",
  "open the MR", or as Step 3 of `issue-handoff`.
---

# Open PR — open the branch's change request

Every code-host operation named in **bold** is done as `docs/agents/code-host.md` describes it,
and every tracker one as `docs/agents/issue-tracker.md` does; this skill never assumes which host
or tracker that is.

## Inputs

- **The branch** — the one checked out, already pushed (**Push** if it is not).
- **The issue** — its key is in the branch name (the tracker doc's **Identifiers**). **Fetch an
  issue** for its exact title. With no issue, the work log's **Ticket** section holds the request;
  ask the user which key to use in the title.
- **`TARGET_BRANCH`** — the work log's source branch, else ask the user. When the branch was cut
  from another issue's branch, follow **Stacked change request**.

## Write the description

**REQUIRED SUB-SKILL:** `mattpocock-skills:pr` — its template (Summary, Evidence, Merge Danger)
is the whole description. Write it to `pr-body.md` outside the repo's tracked files, with the
tracker doc's **Link an issue from a change request** line under Summary.

Fill **Evidence** from the branch's work log (`.claude/worklog/<branch-name>.md`): the tests that
went red then green, and the screenshots `app-verify` saved under
`.claude/worklog/<branch-name>/`, put where the description can show them by **Attach evidence**.

## Open it

**Open a change request** with the title `<ISSUE_KEY>: <exact issue title>`, the description file,
and the host doc's **Reviewers**. Confirm the target, assignee and reviewers landed, and hand the
change request's URL back to the caller: the tracker's **Post the test plan** needs it.
