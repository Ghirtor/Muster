# Code host doc: template

Write `docs/agents/code-host.md` from this. Each bold item is a section a skill names; replace
its description with this host's commands. Start with how to check the CLI is logged in, and
say never to handle a token: if it is not, the user logs in.

```markdown
# Code host: <host>

<Where `origin` lives, the CLI used, how to check it is logged in.> Issues are the tracker's
business: `docs/agents/issue-tracker.md`.

This file is the only place the skills learn how the code host works. The skills name operations
(**Open a change request**, **Watch CI**, ...) and do what the matching section says, so moving to
another host means rewriting this file, not the skills.

## Identifiers

- **Change request** — what the host calls it (pull request, merge request), how it is written
  (`#12`, `!12`) and its URL.
- **Default branches** — the branches change requests target, and which a feature branch
  targets.
- **Reviewers** — who is asked to review, by the CLI's handle, and the approvals needed.

## Change requests

- **Push** — the command that pushes the branch and sets its upstream.
- **Find the change request for a branch** — the command that finds the open one, and where its
  target branch shows.
- **Open a change request** — the command, taking a description file, the title, the target,
  assignee and **Reviewers**; anything to set after it (an approval rule); how to confirm what
  landed. It must give back the change request's URL.
- **Stacked change request** — what a branch cut from another issue's branch targets, and how
  the parent is made to merge first.
- **Attach evidence** — how a screenshot gets into the description.

## CI

<The CI system, its config file, the runner OS and shell, when it runs.>

- **Find the run for a push** — the command, and how to check it ran on the pushed commit.
- **Watch CI** — how to wait for the run to end without a foreground `sleep`.
- **Read a failed job's log** — the commands that list the jobs and print a failed one's log.
- **The target branch's latest result** — the command.
- **Re-run the failed jobs** — the command, only for failures that are not in the code.
```
