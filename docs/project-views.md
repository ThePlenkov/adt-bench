# Project views

The [adt-bench backlog project](https://github.com/orgs/abapify/projects/4) is a GitHub Projects v2 board. This document describes the **6 views** that make it usable for a small team working through v1.1.

## Why 6 views

A project with 16 items and 4 dimensions (Status, Milestone, Priority, Parent) can be sliced many ways. Different audiences need different cuts:

| Audience | "What do I need to see?" | View |
|---|---|---|
| Release manager | "What's planned for v1.1 / v2?" | Roadmap |
| Daily standup | "What's in progress, what's next?" | Active work |
| Solo contributor | "What should I pick up next?" | Next up |
| Tech lead | "Are dependencies unblocked?" | v1.1 epic tree |
| Eng manager | "Who is doing what?" | All work by owner |
| Repo gardener | "What's not on a milestone?" | Backlog (unmilestoned) |

GitHub Projects v2's GraphQL API does **not** currently expose view creation. Views must be created in the web UI. The JSON spec below is a copy-paste-ready description; we will switch to programmatic view creation if GitHub ships a `createProjectV2View` mutation or if a third-party `gh project view` extension appears.

## View definitions

### 1. Roadmap
- **Layout:** Roadmap (timeline)
- **Filter:** `is:open`
- **Group by:** Milestone (v1.1, v2, None)
- **Sort by:** Priority asc
- **Visible fields:** Title, Status, Priority, Sub-issues progress, Milestone
- **Why:** Lets the release manager see v1.1 vs v2 vs infra at a glance. Issues without a milestone cluster at the end.

### 2. Active work
- **Layout:** Board (kanban)
- **Filter:** `is:open status:"Todo" status:"In Progress"`
- **Group by:** Status (Todo / In Progress)
- **Sort by:** Priority asc, then Title asc
- **Visible fields:** Title, Assignees, Priority, Sub-issues progress
- **Why:** The "what is in flight" view. Todo column on the left, In Progress on the right. New work enters at the top of Todo.

### 3. Next up
- **Layout:** Table
- **Filter:** `is:open status:"Todo" priority:P0 priority:P1`
- **Group by:** Priority (P0, P1)
- **Sort by:** Priority asc
- **Visible fields:** Title, Milestone, Sub-issues progress
- **Why:** "What should I pick up next?" for an engineer scanning the backlog. P0 first, then P1, both filtered to non-Done.

### 4. v1.1 epic tree
- **Layout:** Table
- **Filter:** `is:open milestone:"v1.1"`
- **Group by:** Parent issue (top-level issues first, sub-issues underneath)
- **Sort by:** Default
- **Visible fields:** Title, Status, Priority, Sub-issues progress, Blocked by
- **Why:** Shows the dependency cascade for v1.1. Item #1 (real mastracode runner) is the root; its children (#2, #7, #8, #9) are blocked until #1 is done; etc.

### 5. All work by owner
- **Layout:** Board
- **Filter:** `is:open`
- **Group by:** Assignees
- **Sort by:** Priority asc
- **Visible fields:** Title, Status, Priority, Milestone
- **Why:** The "who is doing what" view for 1:1s and standup. Empty (Unassigned) bucket surfaces work that nobody has picked up.

### 6. Backlog (unmilestoned)
- **Layout:** Table
- **Filter:** `is:open no:milestone`
- **Group by:** None
- **Sort by:** Priority asc
- **Visible fields:** Title, Priority, Labels
- **Why:** Triages work that has no milestone assignment. Currently catches issues #6, #10, #11, #13, #16. Useful for the repo gardener to spot and re-classify.

## Filter syntax (GitHub Projects v2)

The `filter` field on a view accepts a GitHub search-like query:

| Token | Meaning |
|---|---|
| `is:open` / `is:closed` | Issue state |
| `status:"<name>"` | Single-select Status field (matches the value name) |
| `priority:"<name>"` | Single-select Priority field |
| `milestone:"<name>"` | Milestone field |
| `no:milestone` | Inverse: issues without a milestone |
| `label:"<name>"` | Label field |
| `assignee:"<login>"` / `no:assignee` | Assignees field |
| `is:issue` / `is:pr` | Item type |
| Combine with spaces (implicit AND) | Multiple constraints |

## How to create these views

For each view above:

1. Open https://github.com/orgs/abapify/projects/4
2. Click **+ New view** (top-right of the project board)
3. Pick a layout: **Table**, **Board**, or **Roadmap**
4. Click **Filter** in the toolbar and paste the filter query from the table
5. Click **Group by** and select the field
6. Click **Sort by** and select the field + direction
7. Use **... menu → Settings** to show/hide fields per the spec
8. Click **... menu → Rename** to give it the name from the spec

This takes ~30 seconds per view. The 6 views are independent, so they can be created in any order.

## Programmatic view creation (future)

When GitHub ships `createProjectV2View` (or when a community `gh extension` lands), the JSON in `tools/project-views.json` will be the source of truth. Today it is hand-maintained and reviewed at every project change.
