# Muster

Muster runs local app rigs for checkouts on one machine, and decides which checkout may run one.

## Language

**Rig**:
The set of processes one app needs running, started in order and watched together.
_Avoid_: stack, environment

**Checkout**:
One working copy of an app's repository on this machine; the unit that holds or waits for a rig.
_Avoid_: repo, worktree, instance

**Instance mode**:
How many rigs of one app may run at once: one per machine, one per checkout, or up to N.
_Avoid_: lock mode

**Lock**:
A checkout's claim on one of an app's slots, naming the checkout, its branch and its reason.
_Avoid_: hold, lease

**Holder**:
The checkout whose lock fills a slot.
_Avoid_: owner

**Stale lock**:
A lock whose checkout no longer runs anything, which the next launch takes over.

**Queue**:
The checkouts waiting for a slot, served in the order they asked.

**Foreign rig**:
A one-per-machine rig whose ports are in use while no checkout holds it: started outside Muster.
_Avoid_: unknown, orphan

**Launch verdict**:
What a launch from an app's own checkout would meet right now: the checkout already holds the rig, a slot is free, it would have to queue, or a foreign rig is in the way.
_Avoid_: taken, busy
