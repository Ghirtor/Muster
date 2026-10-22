# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## GitHub specifics

An issue carries at most one triage label at a time, next to any area labels (`server`, `web`,
...) and the workflow labels `in-progress` / `in-review` that `docs/agents/issue-tracker.md`
describes. When moving it to a new role, remove the old triage label and add the new one; leave
the others alone.

GitHub refuses a label that does not exist yet, so create the five once per repo:

```
gh label create needs-triage --color D4C5F9
gh label create needs-info --color FEF2C0
gh label create ready-for-agent --color 0052CC
gh label create ready-for-human --color 5319E7
gh label create wontfix --color FFFFFF
```
