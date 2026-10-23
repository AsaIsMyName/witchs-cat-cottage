---
name: codebase-pitfalls
description: Non-obvious traps in the scene/cat code (rebuilt views, interrupt tokens, drop math, single sources of truth)
metadata:
  type: project
---

- **Views are rebuilt:** `renderItems()` destroys and rebuilds every item view on each state change. Never hold an `ItemView` across a walk or a delay; look it up again by uid.
- **Interrupts:** cat delays and tweens go through `later()` / `tween()`, which are guarded by the interrupt token. Movement tweens drive a progress counter, so `interrupt()` must remove `this.move` explicitly.
- **Drop math** reads `view.x/y`. Visual effects (`ItemView.setScale`, pops) only change what's drawn, never where it drops.
- **One source of truth:** book geometry is `BOOK_PAGES` / `pageItemArea`; the room layout is derived from `TRAY_Y` and `BEDROOM`; depth is by bottom edge (`depthForBottom`). Don't add parallel constants.
- Logic in `src/logic` (no Phaser) with Vitest tests; content and tuning in `src/data`. Pure decision helpers take an injected RNG so they can be tested.

**Why:** each of these caused or nearly caused bugs in milestones 1–4b.
**How to apply:** check these before touching `DecorateScene.ts`, `cat-actor.ts`, or `room-view.ts`. See [[workflow]].
