DATA-08 — Nested duplicate directories moved here on 2026-05-24

Items moved:
  - MFX-OS-copy-nested/   (was at: ./MFX-OS copy/  — divergent snapshot of project)
  - crm-worktrees/        (was at: ./crm/.claude/worktrees/  — three agent worktrees)

Why moved: these were old copies that had drifted from the top-level project
(~465 lines different in core.js). Future edits to the wrong tree would silently
revert when the right one rebuilt. Grep results were also polluted with these
copies.

If you discover the live deploy needed any of these, copy back from this attic.
Otherwise delete this folder after a week of verifying nothing broke.
