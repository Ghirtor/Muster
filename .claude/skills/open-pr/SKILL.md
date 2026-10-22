---
name: open-pr
description: >
  Use when a pushed branch on this repo needs its change request (pull or merge request) opened
  — title from its issue, description from the PR template with test and screenshot evidence,
  reviewers, the right target for a stacked branch. Triggers on "open a PR", "open the MR",
  "create the change request", or as Step 3 of `issue-handoff`.
---

# Open PR — open the branch's change request

A **bold** name after "the project doc's", "the tracker doc's" or "the code-host doc's" is a
section of `docs/agents/project.md`, `docs/agents/issue-tracker.md` or `docs/agents/code-host.md`.

## Inputs

- **The branch** — the one checked out, already pushed (the code-host doc's **Push** if it is
  not).
- **The issue** — its key is in the branch name (the tracker doc's **Identifiers**). The tracker
  doc's **Fetch an issue** for its exact title. With no issue, the work log's **Ticket** section
  holds the request; ask the user which key to use in the title.
- **`TARGET_BRANCH`** — the work log's source branch, else ask the user. When the branch was cut
  from another issue's branch, follow the code-host doc's **Stacked change request**.

## Write the description

**REQUIRED SUB-SKILL:** `mattpocock-skills:pr` — its template (Summary, Evidence, Merge Danger)
is the whole description. Write it to a file outside the repo's tracked files. Then do what the
tracker doc's **Link an issue from a change request** asks of the title or the description.

Fill **Evidence** from the branch's work log (`.claude/worklog/<branch-name>.md`): the tests that
went red then green, and the screenshots `app-verify` saved under
`.claude/worklog/<branch-name>/`, put where the description can show them by the code-host
doc's **Attach evidence**.

## Open it

The code-host doc's **Open a change request** with the title `<ISSUE_KEY>: <exact issue title>`,
the description file, and the code-host doc's **Reviewers**. Confirm what landed as that section
says, and hand the change request's URL back to the caller: the tracker doc's **Post the test
plan** needs it.
