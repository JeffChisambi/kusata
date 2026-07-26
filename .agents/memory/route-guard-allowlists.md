---
name: Route guard allowlists
description: Durable reminder about keeping role-based route guards aligned with navigation.
---

Role-based route guards can make a valid navigation link appear broken when the destination path is missing from the role's allowlist: the router loads the route, then immediately redirects back to the dashboard.

**Why:** A broker Orders link existed and the Orders route built correctly, but the root auth guard excluded `/orders`, producing a silent redirect that looked like a dead click.

**How to apply:** Whenever adding or renaming a protected route, search the root/router role allowlists and update them in the same change as the sidebar navigation.