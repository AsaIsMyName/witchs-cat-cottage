---
name: workflow
description: Branch, commit, and merge rules — commit on Feature_InitialBranch, never merge or push to main
metadata:
  type: feedback
---

Commit on `Feature_InitialBranch` (with the attribution line the caller gives). Never merge into or push to `main` yourself.

**Why:** pushing to `main` deploys to GitHub Pages. Asa merges only after a local playtest, a review by both reviewer agents (code-reviewer-opus and code-reviewer-sonnet) with no blockers, and Asa's go.
**How to apply:** each task ends with `npm run check` passing, a commit on the feature branch, and a STATUS.md entry with Done, Not verified, Re-test, Next. Leave merging to the caller/Asa. See [[asa-preferences]].
