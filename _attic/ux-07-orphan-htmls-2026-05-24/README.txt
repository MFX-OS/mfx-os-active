UX-07: Orphan project-root HTMLs — 2026-05-24

These HTML files were sitting at the project root (NOT under public/), so
Firebase Hosting was never serving them. If any of them is needed, move
back to public/ and add a reference. Otherwise these are dead.

Files moved here:
  - mfx-os-scoreboard.html
  - mfx-os-status.html
  - mfx-pipeline-audit.html
  - mfx-pipeline-v3.html
