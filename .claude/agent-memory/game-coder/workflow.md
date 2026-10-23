---
name: workflow
description: Branch, commit, and merge rules (commit on Feature_InitialBranch, never merge or push to main); run npm run shots after visual changes
metadata:
  type: feedback
---

Commit on `Feature_InitialBranch` (with the attribution line the caller gives). Never merge into or push to `main` yourself.

**Why:** pushing to `main` deploys to GitHub Pages. Asa merges only after a local playtest, a review by both reviewer agents (code-reviewer-opus and code-reviewer-sonnet) with no blockers, and Asa's go.
**How to apply:** each task ends with `npm run check` passing, a commit on the feature branch, and a STATUS.md entry with Done, Not verified, Re-test, Next. Leave merging to the caller/Asa. See [[asa-preferences]].

After any visual change, run `npm run shots` and Read every PNG in `shots/` before handing the build to Asa to playtest. Say in STATUS.md what the shots showed.

**Why:** Asa's rule (Oct 23, 2026): catch visual mistakes before a playtest, not during it.
**How to apply:** if a drag shot shows the wrong highlight, check whether the layout or the seed changed before blaming the script. The drag already allows for Phaser taking its grab offset after the 4 px threshold.
