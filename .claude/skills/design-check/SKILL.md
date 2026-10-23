---
name: design-check
description: Check a feature plan or diff for Witch's Cat Cottage against CLAUDE.md's intent (decorating first, a cat that never judges, earning never a bottleneck, nothing from "Not in v1", a cozy and magical tone) and for engineering restraint. Use on feature plans before the coder builds them; skip it for tooling and small fixes.
---

Run this check inline, in your own context: CLAUDE.md is already loaded, so don't re-read it. Read code only where the plan's fit is unclear. You are checking design fit, not reviewing code: leave bugs, tests, and style to the code reviewers.

## What to check

1. **Decorating comes first.** Nothing gets in front of decorating, slows a drag or a drop, or makes the player wait to place things.
2. **The cat never judges.** No score, no wrong answers, no reaction that reads as disapproval. The only grumpy moment is the offended blink, as CLAUDE.md describes it. Player actions don't interrupt the cat's flow except where CLAUDE.md says so.
3. **Earning is never a bottleneck.** No grinding, waiting, timers, fail states, or clicker systems (upgrades, multipliers, idle numbers).
4. **Scope.** Nothing from the "Not in v1" column, and nothing from a later milestone, without Asa's say-so. Things CLAUDE.md marks as dropped (e.g. the portal dive) stay dropped.
5. **Tone.** Cozy and magical. Cozy witchy is the default theme.
6. **Settled decisions.** The plan doesn't quietly reopen something CLAUDE.md records as decided (the ¾ view, PC first, 16px art, one room with themes, and so on).
7. **Engineering restraint:**
   - the smallest change that does the job
   - it fits the existing modules (logic in `src/logic/` without Phaser, content and tuning in `src/data/`)
   - no new abstraction, library, layer, option, or system without a current need
   - say what could be dropped or done more simply
8. **Gaps.** Anything the plan decides that CLAUDE.md doesn't cover. Don't guess what Asa would want: list it as a question for Asa, with a recommendation.

## Report (short)

- **Verdict:** **fits**, **concerns**, or **conflicts** (it breaks a rule in CLAUDE.md or a decision Asa made).
- **At most 5 points**, most important first: the issue, the CLAUDE.md section it rests on, and the smallest fix.
- **Questions for Asa**, if any, each with a recommendation.
- "Fits, no notes" is a valid answer. Don't pad.

On **conflicts** or open questions, stop and ask Asa before the coder builds. On **concerns**, pass the fixes to the coder with the go.
