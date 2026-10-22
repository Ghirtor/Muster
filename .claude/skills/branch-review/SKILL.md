---
name: branch-review
description: >
  Use when a feature branch on this repo is implemented and needs reviewing before it is
  pushed or merged — checks it against its ticket, the repo's standards and for bugs,
  taking the decisions made during the work into account, and refactors what the standards
  review names. Triggers on "review this branch",
  "does this do what the ticket asks", or as the review step of `implement-change`.
---

# Branch review — spec, standards and bugs

Review the current branch against its ticket and for bugs, then deal with what the reviews
find. Run it before checking the branch in the real app, so that check runs on the code that
will be pushed.

A **bold** name after "the project doc's", "the tracker doc's" or "the code-host doc's" is a
section of `docs/agents/project.md`, `docs/agents/issue-tracker.md` or `docs/agents/code-host.md`.

## Inputs

- **The branch** — the one checked out.
- **`BASE`** — what the branch is compared against. Take it from the work log's **Ticket**
  section, else the target of the branch's open change request (the code-host doc's **Find the
  change request for a branch**), else ask the user.
- **The ticket** — the issue the branch is named after; `code-review` fetches it through the
  tracker doc. When the change has no issue, the work log's **Ticket** section holds the user's
  request and the criteria derived from it, and that is the spec instead.

The work log is `.claude/worklog/<branch-name>.md` (`.claude/skills/implement-change/worklog.md`
describes it). The ticket alone is not the scope: the log holds what was decided while the
work was done. If there is no log, tell the user the reviewers will judge against the ticket
alone, and carry on.

## Run the reviews at once, on `<BASE>..HEAD`

Give each review the absolute path of the work log, so it judges deliberate choices as
choices rather than as oversights. Two skills share the name `code-review`: call each by the
name given here.

- **Spec and Standards review.** Call the Skill tool with `mattpocock-skills:code-review`,
  fixed point `<BASE>`. Add to its sub-agents' briefs:
  - **Spec** — the work log, and each acceptance criterion as **met**, **partly met** or
    **missing**, with the file:line and the test that show it; logged decisions it thinks are
    wrong, and why; behaviour the ticket asks for that no test covers.
  - **Standards** — the project doc's **Test rules** when the branch changes a test, and the
    project doc's **Code conventions** when it changes a file they cover; they sit outside its
    usual search.
    Tell the sub-agent to read each in full and weigh first what the conventions say the
    linter cannot catch.
- **Bug review.** Run Claude Code's built-in `code-review` skill at `high` on the branch,
  without `--fix`.

## Deal with the findings

No review's findings are orders. Check each one against the code before acting and
drop the ones that are wrong, saying why. Do not act on a finding against a decision the
user made, but if it shows a real risk, raise it with the user. A finding against a decision
made on your own judgement is weighed like any other. Then:

- A confirmed bug, or a partly met or missing criterion, is fixed through `tdd-implement`:
  a failing test first, then the fix.
- A confirmed Standards finding is fixed as a refactor — the refactor `tdd-implement`'s loop
  leaves to this step: a safety-net test first where the behaviour it touches has none, then
  the change with the suite green. A baseline smell is a judgement call: fix the ones that
  hold up against the code, and log the rest as rejected with the reason.
- Out-of-scope changes are reverted, unless the ticket cannot be done without them — then
  keep them, and log the reason under **Decisions**.
- Re-run the `tdd-implement` checks after the fixes. If the fixes went beyond the lines the
  findings named, run the bug review once more; one re-review at most, and anything still
  open goes to the user.

Log every finding and what you did with it — fixed, reverted, rejected with the reason, or
raised with the user — under **Review findings**.
