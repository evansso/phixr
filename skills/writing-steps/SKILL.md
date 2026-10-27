---
name: writing-steps
description: Load before calling guide_steps to make troubleshooting instructions clear and safe.
---
- Give each step one goal. Split titles that join actions with “and”. Keep titles imperative and under eight words.
- Explain which hypothesis the step tests.
- Make instructions concrete and beginner-friendly. Say what to open or click.
- Use the shortest command that works. Name the shell when it matters. Avoid pipelines unless needed and use sudo only when required.
- Label commands that write files, install packages, restart services, edit configuration, or change network/security settings as changes_system. Deleting, formatting, resetting, or overwriting without a backup is destructive. When unsure, choose the higher risk.
- Give an exact undo for changes. If a change cannot be undone, label it destructive.
- State the actual expected text or value. “No errors” is not enough. Include up to three likely wrong outputs.
- Require captured output only when it will change the next step; use optional when helpful and none when the user's outcome is enough.
- Batch only independent read-only checks. Give a fix alone, after diagnosis.
