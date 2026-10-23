# Status

> **New session?** Start with the "Handoff" entry below the 4b entries, then read CLAUDE.md.

## Oct 22, 2026 — 4b fixes: steady facing on walks, varied facing at rest (awaiting playtest)

The two fixes from the 4b playtest feedback below. First task run by `game-coder` by name; its memory (`.claude/agent-memory/game-coder/`) is seeded with the handoff's lessons and the workflow rule.

**Done**
- **No flicker on diagonal walks.** Each leg picks its facing once, before it moves, and keeps it for the whole leg (`legFacing` in `src/logic/cat.ts`).
  - The direction comes from the leg's tiles (exactly straight or exactly diagonal), not the cat's pixel position, so being a few px off a tile's center can no longer tip a diagonal to up/down. Only a step inside one tile (to the exact end point, or across a perch) uses pixels, with the old dead zone.
  - The first leg of a walk turns along its dominant axis, left/right on a tie, so a diagonal walk is sideways.
  - Later legs of the same walk (and legs after a re-plan) keep the current facing while they still head that way by at least half as much as they move across it (`keepWhileWalking` 0.5). Routes are a straight run plus a diagonal run, so e.g. "down 2, then diagonally down-right 3" now faces down the whole way instead of down then right. A real corner (down, then right) still turns.
- **Varied facing at rest.**
  - Arriving from a walk keeps the walk's facing (was: always down). Hopping down from a moved perch keeps its facing too.
  - When an idle action (sit, groom, nap) starts: 60% keeps the arrival facing, otherwise a random one weighted left 4, right 4, up 1, down 1 (`idleFacing`, RNG injected).
  - Reactions still face their item (a loaf or rug nap on the item still faces down). Petting and the drag glance are unchanged.
- All weights in `CAT_FACING` in `src/data/cat.ts`.
- CLAUDE.md "The cat" → Behavior: the facing bullet no longer says a resting cat faces down.
- 184 unit tests pass (7 new: first-leg ties, keeping the facing on later diagonals, real corners, wobbles and the dead zone, idle keep chance, weighted picks, zero weights).
- **Decided (Asa): the cauldron case is accepted until the art pass.** A cauldron (or other tall item) in floor row 1 fully hides the cat while it reacts to a wall item above it in row 0. No code change; revisit with real sprites.

**Not verified**
- Not run in a browser at all, headless or real. Only typecheck and unit tests. The scene wiring (`walkLeg`'s tile direction, `arrive`, `hopDown`, `wander`) is untested by Vitest.

**Re-test**
- Long diagonal and near-diagonal walks across the room: one facing per stretch, no flicker. A pure diagonal faces sideways; a mostly-vertical walk with a diagonal end stays up or down.
- Walks around furniture still turn at real corners.
- Sit, groom, nap after a wander: mostly the way it walked in, sometimes a new way, mostly sideways, now and then up (back to you) or down.
- Reactions still face their item: up at a wall clock, toward the table or cauldron from beside it, down on a loaf or rug nap.
- Petting when it faces up or sideways: the roll and heart still look right, and it doesn't turn.
- Move a table it's loafing on: it hops down without turning to face you.

**Next**
- Asa playtests the fixes and signs off 4b.
- Tooling task (to propose first, not built yet): ESLint + Prettier in `npm run check`, a GitHub Actions gate before the Pages deploy, and a Claude Code pre-commit hook.

## Oct 22, 2026 — 4b playtest feedback (done; see the entry above)

Asa playtested 4b: **working as expected overall.** Before 4b is signed off, there are two fixes. Do them as the **first task of the new session, using `game-coder` by name** (seed its memory first; see the handoff). Then continue with the tooling steps.

1. **Done:** **Facing flickers on diagonal walks.** On a diagonal the cat mostly stays sideways, which is fine (left/right wins ties), but it flickers between directions.
   - Choose the facing once per leg, from the leg's overall direction, and keep it for the whole leg. Or add hysteresis, so small wobbles near 45° don't flip it.
   - It should never change direction mid-leg.
2. **Done:** **Actions always face the player, which feels unnatural.** Today a resting cat faces down by default, and sit, groom, nap, and arriving from a walk all end up looking at the player. Asa wants more variety now that there are four directions.
   - Idle actions (sit, groom, nap) and arrivals should pick a natural facing: e.g. keep the direction it walked in, or pick a random one weighted toward the sides, with up and down sometimes.
   - Reactions still face the item they're about, and petting still faces wherever the cat is.
   - Asa hasn't specified exact weights, so propose a simple rule and put the weights in `src/data/cat.ts`.
   - Update the CLAUDE.md bullet that says a resting cat faces down.

**Decided: accept it until the art pass** (Asa, Oct 22, 2026). Was: a cauldron in floor row 1 fully hides the cat while it reacts to a wall item above it in row 0. Options:
- accept it until the art pass (recommended)
- pick a nearby uncovered spot for wall reactions

## Oct 22, 2026 — Milestone 4b: the cat in ¾ (awaiting playtest)

The cat now faces four ways, hides behind tall furniture, and walks at its old pace in tiles. Routing, reactions, petting, the offended blink, perch hop-down, and the visit queue are unchanged.

**Done**
- 4-direction facing. `facing: 1 | -1` is replaced by `Facing` ("up" | "down" | "left" | "right") in `src/logic/cat.ts`, with pure helpers:
  - `facingFor(dx, dy, current, deadZone)`: the dominant axis, left/right on a tie; inside the dead zone (no movement) it keeps the current way.
  - `facingStep` (a unit step toward what it faces, for nudges) and `facingSign` (-1 facing left, else 1, for the scaleX flip and the pet roll).
- When it turns (`cat-actor.ts`):
  - Each walk leg and hop faces its direction. `turnTo` takes a point, with a `TILE / 8` dead zone (was 4px on x only).
  - Reactions: a wall item, or something on a shelf, faces up. Beside furniture, it faces the furniture's footprint center, so a tall item beside it reads as beside it. On the item itself (a loaf, a nap on the rug) it faces down. A loaf or rug it couldn't reach faces the item.
  - A resting cat faces down: on arriving from a walk, and after hopping down from a moved perch. A visit then turns it toward the item, and it keeps that facing until its next walk.
  - Glances at a drag use the pointer's x and y (`startWatching`/`glanceAt` now take y), so dragging in the book makes it look down. The offended blink turns toward the rug's new spot in x and y.
- Placeholder drawing: `makeCat()` builds the parts and a new `drawFacing()` lays them out per facing, redoing the draw order with `bringToTop`.
  - Left/right: the side view as before (flipped for left).
  - Down: a narrower 13×13 body reaching up the screen, the head at its front edge with both ears, and the tail rising behind it.
  - Up: the same body, a smaller head behind it (only its top and ears show over the far end), and the tail hanging toward the viewer from its base.
  - The blink's rest position (`faceY`) is re-read on every turn.
- Depth: checked headless, no change needed. On the floor the cat sorts by its feet (`depthForBottom`) every frame. A cauldron in the row in front hides it; in the row behind, the cat draws over it; up on a table it draws over the table and its candle (host + 2). At the wall-reaction spot (back floor row, facing up) it draws over the wall band, and only an item standing in the row in front of it can cover it.
- Timing (`CAT_TIMING`), now in tiles so it holds at any tile size; the scene multiplies by `TILE`:
  - `walkSpeed` 1.875 tiles/s (60 px/s; the old 90 px/s at 48px tiles). Measured headless: exactly 60 px/s.
  - `topWalkSpeed` 1.25 tiles/s (40 px/s; the old 60 px/s).
  - `hop` 400ms and `hopDown` 350ms, unchanged. `hopArc` 0.16 tiles (5px; was 4px).
- Nudges from `TILE`: bat 3px, sniff 2px, stare hop 4px, groom bob 2px, blink dip 2px, item wobble 3px.
- `pickIdle` already picks uniformly over the room's columns and floor rows; a new test checks it reaches col 15, row 8 of a 16×9 floor.
- CLAUDE.md "The cat" → Behavior: a bullet on 4-way facing and passing behind taller furniture.
- 177 unit tests pass (6 new: facing rules, diagonals, ties, dead zone, steps, and the 16×9 wander). `npm run build` passes (the usual chunk-size warning).

**Not verified**
- Checked only in headless Edge against the dev server: zoomed shots of each facing, the cat behind/beside/in front of a cauldron, behind and loafing on a table, under a wall clock facing up, a measured straight walk, and a few seconds of the cat's own routine. Not run in a real browser by Asa. Hops, the pet roll in each facing, and the offended blink weren't watched.
- A cauldron (or other tall item) in floor row 1 fully hides a cat reacting to a wall item above it in row 0: it's correctly behind it, but you can't see the reaction. The cat is shorter than a tile, so anything standing a tile tall in front hides all of it, not just its lower part.

**Re-test**
- Watch it walk around: does it face the way it's going, including up toward the wall and down toward you? Do the up and down placeholders read as a cat facing away and toward you?
- Diagonal routes: it shouldn't flicker between facings on a near-diagonal leg.
- Reactions: a clock or moon chart (faces up), the cauldron and a candle on the table (faces the furniture from beside it), a loaf and a rug nap (face down).
- Drag something while it sits: does it glance toward the item, including down when you drag in the book?
- Walk it behind the cauldron and the table: hidden behind them, in front of things behind it. Loaf on the table: over the table and its candle.
- Pace: does a 1.9 tiles/s stroll feel cozy across 16 columns, and is the hop arc visible but small?
- Pet it facing up and down: roll-over, tail wiggle, and the heart still look right.
- Pull the rug out from under a nap: the blink still reads in whatever way it turned.

**Next**
- Asa playtests 4b.
- 4c: hover name and drop preview.

## Oct 22, 2026 — Handoff: where the project stands, and what's next

Written before a session restart so the next session can pick up cleanly. Read this first, then CLAUDE.md.

**Where things stand**
- **Live on `main` (GitHub Pages):** `e71641d`. It has milestones 0–3a, the cat's floor routing and climbing, and the magic redesign of CLAUDE.md.
- **On `Feature_InitialBranch`, not merged yet:**
  - the 3b portal dive, reverted (dropped)
  - the PC-first and ¾-view redesign of CLAUDE.md
  - **4a, the ¾ room view** (signed off): 960×540, 32px tiles of 16px art, 16 columns, 2 wall rows, 9 floor rows, the book sized to its contents
  - **4b, the cat in ¾** (`a971456`, built, awaiting Asa's playtest): 4-direction facing, hiding behind tall furniture, movement tuned for 32px tiles. Its own entry above has the details.
- **Milestone 4 = ¾ room view:** 4a is signed off, and 4b is built and awaiting playtest. 4c (the item name on hover and a drop preview) comes after the tooling steps below.
- **Merge rule:** see the note under "Workflow". Nothing goes to `main` without Asa's go.

**Next steps, in this order (agreed with Asa)**
1. **Finish 4b:** Asa playtests it locally and signs off.
2. **Restart the session** so the agents in `.claude/agents/` are properly registered. Then use `game-coder`, `code-reviewer-opus`, and `code-reviewer-sonnet` **by name**. Until now they were run as general agents told to read their files, so the coder's `memory: project` was never used.
   - The first time `game-coder` runs, ask it to report its memory folder.
   - Seed it with the lessons below.
3. **Tooling (one small task):**
   - add ESLint and Prettier to `npm run check`
   - add a GitHub Actions gate so `main` only deploys a build that passes `npm run check`
   - add a Claude Code hook that runs the checks before commits

   Asa approved all three in principle; propose the details first.
4. **Design-guardian agent and screenshots:**
   - A read-only agent that checks plans and diffs against CLAUDE.md's intent, before the coder starts: decorating first, the cat never judges, earning never a bottleneck, nothing from "Not in v1", cozy and magical tone.
     - It also gets an **engineering-restraint check** on plans (decided Oct 22, 2026, instead of a separate architect agent): the smallest change that works, it fits the existing modules, and no new abstraction, library, or system without a current need.
     - Already added: both reviewers flag overbuilding in diffs, and have a **milestone sweep** mode (whole-codebase shape, at most 3 suggestions with "why now"). Run a sweep at each milestone boundary, starting at the end of milestone 4. Revisit a dedicated architect agent around milestone 6.
   - An `npm run shots` script that captures fixed scenes (empty room, busy room, each cat facing, drag highlights) from seeded saves. Check the screenshots after each visual task, before Asa playtests. Headless screenshots worked during 4a.
5. **4c:** the item name on hover and a drop preview while dragging.
6. **Review and merge:** both reviewers on everything since `e71641d`, then merge on Asa's go.
7. **Later:** milestone 5 (room themes and 25–30 items; revisit the book layout and paging then). A content-designer agent could draft item data. The art pass (milestone 8) could use a sprite-artist agent and a style-check script.

**Lessons for the coder's memory** (durable; seed these)
- **Environment:**
  - Node isn't on PATH in PowerShell. Prefix commands with `$env:Path = "C:\Program Files\nodejs;$env:Path";`. Git Bash has no `npm`.
  - The dev server usually runs on port 5173. Don't start or kill it unless asked.
  - Never take line numbers from `cat -n` over several files: the numbering runs on across files.
- **Codebase pitfalls:**
  - **Views are rebuilt:** `renderItems()` destroys and rebuilds every item view on each state change. Never hold an `ItemView` across a walk or delay; look it up again by uid.
  - **Interrupts:** cat delays and tweens go through `later()` / `tween()`, which are guarded by the interrupt token. Movement tweens drive a progress counter, so `interrupt()` must remove `this.move` explicitly.
  - **Drop math** reads `view.x/y`. Visual effects (`ItemView.setScale`, pops) only change what's drawn.
  - **One source of truth:** book geometry is `BOOK_PAGES` / `pageItemArea`. The room layout is derived from `TRAY_Y` and `BEDROOM`. Depth is by bottom edge (`depthForBottom`).
  - **Logic lives in `src/logic`** (no Phaser) with Vitest tests. Content and tuning live in `src/data`.
- **Asa's preferences:**
  - Ask when a decision isn't in CLAUDE.md, and offer a recommendation with the question.
  - Asa's feedback is specific and visual. Always state plainly what wasn't verified in a browser.
  - The theme is cozy and magical, decorating comes first, and the cat never judges.

**Workflow**
- Work on `Feature_InitialBranch`, and commit there with the attribution line. Each task ends with a STATUS.md entry: Done, Not verified, Re-test, Next.
- Merge to `main` only after Asa's local playtest, a review by both reviewers with no blockers, and Asa's go. Then fast-forward `main` and push; that deploys.
- Run the dev server with `npm run dev` from the project folder, then open http://localhost:5173.

## Oct 22, 2026 — Milestone 4a: ¾ room view (signed off)

Playtest: **signed off** (Oct 22, 2026). Asa's decisions on the open questions:
- A cauldron in the back floor row hiding the wall slot behind it is fine. Keep it.
- The left-heavy book (only the potion on the right page) stays as is until milestone 5's paging, when Asa will revisit what feels best.
- The room should be taller: shrink the book to fit its contents and add a 9th floor row (done below).

**Follow-up: a 9th floor row, and the book sized to its contents**
- `BEDROOM.floorRows` is 9. Still 16 columns, 2 wall rows, 32px tiles on 960×540.
- The book is now sized from its contents and sits 4px above the screen's bottom edge. Its page height is the heading space (10), the tallest book item (read from the catalog, today the cauldron at 64), the count space (22), and the page's trim and padding. `TRAY_Y`, and then the room above it, are derived from the book.
- New numbers:
  - Room x 224–736. Wall top edge y 34–42, wall band y 42–106, floor (9 rows) y 106–394.
  - `TRAY_Y` 406. Cover 952×128 at (4, 408). Pages 465×118 at y 413 (left x 10, right x 485). Item areas 443×96 at y 424 (left x 21–464, right x 496–939). Items' bottom is 498 as before (the cauldron tops out at 434, just under the heading at 416), and the ×N counts sit at 504.
- Saves: a 9-row room accepts every 8-row placement, so `SAVE_VERSION` stays 3 and Asa's layout is kept. A new save test loads a v3 room filled out to the old room's edges (front row 7, wall corners, surface items) and checks it against the real `BEDROOM`.
- 171 unit tests pass; `npm run build` passes.
- Re-test: does the taller room feel right, and is the book still comfortable to drag from and back to?

The room is now a Stardew-style ¾ top-down room on a bigger canvas, still with rectangles. Grid rules, swaps, highlights, and the cat's routing logic are unchanged; only the space and the drawing changed.

**Done**
- Canvas 960×540 (was 768×432), still `Scale.FIT` and `pixelArt: true`. Tiles are 32 screen px: 16px art at 2×.
- `BEDROOM` is 16 columns, 2 wall rows, 8 floor rows (was 12, 3, 3). `SAVE_VERSION` is 3, so old saves start fresh once.
- Layout (`room-view.ts`):
  - Room x 224–736. The wall's top edge is drawn at y 32–40, the wall band (2 rows of wall slots) at y 40–104, the floor (8 rows) at y 104–360.
  - Book: `TRAY_Y` 372, cover 952×162 at (4, 374). Pages 465×152 at y 379: left x 10, right x 485, spine 475–485. Item areas 443×130 at y 390: left x 21–464, right x 496–939. Items' bottom is at 498 (the tallest, the cauldron, tops out at 434), and the ×N counts sit at 504.
- Stand height: new catalog field `standHeight` (tiles a floor item stands above its footprint), replacing `visualHeight`. Pure model in new `src/logic/stand.ts` (`standShape`): the top face is the footprint lifted by the stand height, the front face fills the gap down to the footprint's front edge. Table 0.75, stool 0.6, cauldron 1 (drawn two tiles tall); rugs are flat.
- Drawing: the floor is a lighter area with a faint tile grid, and the wall band has a darker top edge and faint slot lines. Placeholders draw a lighter top face (the item's color) over a darker front face. Wall items fill their slot; a shelf is a 10px ledge at the bottom of its slot with a 4px top. Surface items stand on their host's top face, 65% of the way into it (`seatY`), and a loafing cat sits at the same spot.
- Draw order: floor items, surface items, and the cat sort by bottom edge via one helper, `depthForBottom` (100 + screen y of a footprint's front edge, or of the cat's feet). Surface items draw at host + 1, a cat up on furniture at host + 2. Rugs stay under everything on the floor (50 + row), wall items at 10. The old row-based `depthAt` in `cat-actor.ts` is gone.
- Hit areas: an item's `body` rectangle covers its whole drawn shape (top and front face), so it can be grabbed anywhere on it. The top face is a separate, non-interactive rectangle. A fully covered rug still can't be grabbed, by hit testing as before. Drops still target the footprint (the view's x/y stay the footprint's top-left), so a tall item dragged by its top lands where its bottom visibly is.
- Highlights: the fill draws under the dragged item and the outline over it, since a standing item now covers its own footprint. Surface highlights are drawn where the item would stand in the slot (`surfaceSlotBox`).
- Cat: body, head, ears, and tail sizes come from `TILE`; feet rest `TILE / 8` above the tile's front edge. Walk 64 px/s (about 2 tiles a second), on top 40 px/s, hop arc 4px. 4-direction facing is not in yet (4b).
- Effects: portal, sparkle, and swirl sizes in `MAGIC_FX` are now in tiles, scaled by `TILE` in `magic-fx.ts`.
- Tests: new `stand.test.ts`; a catalog check that only floor items stand up (0–2 tiles); a save test that v2 saves are rejected; the tray test uses today's 32px widths and the new book. 170 unit tests pass. `npm run build` passes (the usual chunk-size warning).
- CLAUDE.md: concrete numbers in "Room view", the "Grid" bullet describes the ¾ grid, and the prop-size question is resolved to 16×16.

**Not verified**
- Only two headless screenshots were checked (the empty room, and a seeded room with a table on a rug, a cauldron behind it, a shelf with a candle, wall items, a stool, and a rug). Nothing was dragged, and the cat's movement wasn't watched. Not run in a real browser by Asa.
- Exact integer scaling of the whole canvas is left for the art pass: with `FIT`, a window that isn't a multiple of 960×540 scales by a fraction, so pixels may be uneven.

**Re-test**
- Drag each item from the book into the room and back. Does a tall item (cauldron, table) land where its bottom is, even when grabbed by its top?
- Green, red, blue, and amber highlights: still clear now that the fill is under the item and the outline over it? Swap a table and a stool, and two stools.
- Candles and potions on the table, the stool, and a shelf: do they look like they stand on the top? Is each slot easy to hit?
- Put a table over a rug: the rug can't be grabbed. Move the table off: it can.
- Walk the cat behind the cauldron and the table: is it hidden behind them, and in front of things behind it? Loaf on the table and stool: does it sit on the top face?
- A cauldron in the back floor row rises over the wall band and hides the wall slot behind it, so a wall item there can't be grabbed until the cauldron moves (like a covered rug). OK?
- Walk and hop speeds on the bigger floor: comfortable, or too slow across 16 columns?
- The book: today's inventory fills the left page and only the potion goes to the right one (pages fill left first). Fine until milestone 5's paging?

**Next**
- 4b: the cat's 4-direction facing and polish.
- 4c: hover name and drop preview.

## Oct 22, 2026 — 3b dropped; PC-first and ¾ view decided

**Playtest of 3b (the cat's portal dive): no-go.** It didn't give the vibe Asa wanted. The cat mostly vanished behind a book item with only a text bubble, so it never felt like it was playing with the items. It was reverted (`fe083ce` reverts `e9bb911`). Milestone 3 is closed with 3a only.

**Decided**
- **PC first:** mouse click-and-drag in a desktop browser. Phones stay playable but untuned, and phone playtests are optional.
- **¾ view:** a Stardew-style top-down view replaces the front-facing view. It's the new milestone 4, and the later milestones move down by one (themes 5, earning 6, cat customization 7, art 8, feel 9).
- **Portal dive:** dropped for now. How the cat delivers gifts is now an open question for milestone 6.
- **Cat pack:** its resolution should be chosen in milestone 4's plan, since it sets the tile size, and it must have 4-direction walking. Candidates, all unverified:
  - [AbyssalHunter](https://abyssalhunter.itch.io/cat-animations-walk-4-directions-idle-sleep-sit-threaten): the best fit on paper. 4-direction walk, idle, sleep, sit, threaten, 6 colors, about $3.
  - [Silas Games](https://silasgamedev.itch.io/animated-pixel-cats-5-unique-32x32-sprites-with-4-direction-walk-cycles): 32×32, 4-direction walk, few behaviors.
  - [Elthen](https://elthen.itch.io/2d-pixel-art-cat-sprites): rich behaviors, but probably side-view only.
- CLAUDE.md updated throughout.

**Next**
- Milestone 4 plan (¾ room view) for Asa's approval.

## Oct 22, 2026 — Cat walks around furniture, climbs if stuck (awaiting playtest)

From the playtest: the cat walked straight (often diagonally) over placed items, and drew on top of things it should pass behind.

**Follow-up: pre-merge cleanup (from both code reviews; Asa approved, movement already signed off)**
- Climbing never ties with walking around: every hop adds a tiny `HOP_TIE_BREAK` (1e-6) in `route.ts`, so on equal cost the route with fewer hops wins. A test builds a genuine tie (climbCost 2, stool vs. a 4-step detour through the front row) that climbed before the fix.
- Step-off is always legal: a blocked start now steps only to a free orthogonal neighbour (a diagonal is never nearer than its corners, and past a blocked one it would cut the corner). Boxed in, it returns no legs and stays put, as the scene already handled.
- The last leg re-plans if the room changed during it and the cat ended on a blocked tile (e.g. a cauldron dropped on its goal). New pure helper `canStand`.
- Scene leg fix-ups moved to a new pure `planWalk` (exact-spot leg on the goal tile, edge tile before hopping off mid-table, final hop then walk to the spot), now unit tested. New: perched with the goal on that perch, it walks across the top to the exact spot instead of reacting from where it stands.
- Comments: fixed the mojibake `×` in route.ts; removed the redundant perch reset in `visit()` (it re-set the same `groundY`) and fixed its comment.
- 17 new tests (route, `planWalk`, `canStand`); the "doesn't step back" test asserts exact legs. 154 unit tests pass.
- Re-test (should look unchanged): loaf on the table and dismount from the middle; wall it in with tables; drop a cauldron right on the cat, and on the spot it's walking to just before it arrives.

**Follow-up (Asa's playtest of e6e9cb4): slower arcing hops, edge climbs, natural dismounts**
- Hops are slower and arc: a hop on, off, or between tops takes `CAT_TIMING.hop` 400ms (was 300). The straight hop down when a perch is moved or removed takes `hopDown` 350ms (was 250). Both rise `hopArc` 6px above a straight line mid-hop. Movement tweens now drive a progress counter, and `interrupt()` removes the current one.
- Dismounts: starting a walk while perched no longer drops straight down first. The route starts on top, so the cat walks to the edge it's heading for (from the middle of a table, first to that edge tile's center) and hops off in one arc onto the next floor tile of its route.
  - The straight "hop down, unbothered" stays only for a moved or removed perch. Interrupts still snap the cat to the floor instantly.
- Edge climbs: hops always land on the tile next to the one the cat hops from, never mid-table.
  - A loaf aims for the table tile nearest the cat. The cat hops onto it, then walks across the top to the loaf spot (the table's middle).
  - A stool is still a single hop up and down.
- Route costs changed in `route.ts`:
  - `climbCost` (4) is now paid once per hop up, not per tile, so once up the cat walks across the top instead of hopping off early and doubling back.
  - New `frontBackHopCost` (0.5) makes it prefer hopping on and off from the side.
  - Walking around is still preferred over climbing. Going around through the rows behind or in front is unchanged, as is staying drawn in front when climbing over.
- Six new route tests: edge hop then walk to the loaf spot, side over behind, from the front only when it must, hop off toward the goal not back, walk to the far edge when starting on top, stool single hops.
- 137 unit tests pass.
- Re-test:
  - Do hops read at a comfortable speed, and is the arc visible but subtle?
  - Loaf on the table from the left, then from the right: does it hop onto the near end and walk to the middle?
  - From a loaf, send it somewhere on the other side: does it walk to that edge and hop off forward, with no drop and walk back?
  - Wall it in with tables: does it hop on at one edge, walk across, and hop off the far edge?
  - Stool: a single hop up and down.
  - Move the table it's loafing on: still a straight hop down. Move it mid-crossing: still lands on the floor at once.
  - Petting mid-hop still slows it.

**Done**
- New pure module `src/logic/route.ts` (`findRoute`), with 17 tests in `route.test.ts`. It plans a route on the 12×3 floor grid:
  - Floor items block their tiles. Rugs and wall items don't.
  - Diagonal steps only between free tiles, and only when both corner tiles are free.
  - Furniture with a top (table, stool) can be crossed at an extra cost per tile (`CAT_TIMING.climbCost`, 4 steps), so the cat walks around when it can. Items without a top (cauldron) can't be crossed.
  - Straight runs collapse into one leg. Each hop on, off, or between two tops is its own leg.
  - A loaf perch routes onto the table and ends on top. Any other spot on furniture, or one that can't be reached, ends at the nearest free tile the cat can reach, and it reacts from there.
  - Starting on a blocked tile (something dropped where it stands, or just hopped down from a perch): it first steps to the nearest free tile, preferring forward or sideways over stepping back through the item.
- `cat-actor.ts`: `walkTo` plans a route and walks it leg by leg (`walkRoute`, `walkLeg`, `arrive`).
  - Floor legs run at `walkSpeed`, and the cat's depth follows its y every frame, so it passes behind front-row items.
  - Hops on and off take `CAT_TIMING.hop` (300ms). Walking on top runs at `topWalkSpeed` (60 px/s), drawn above the furniture and anything on it.
  - Up on furniture mid-walk counts as a `crossing` perch. Moving that furniture, or any interrupt, drops the cat to the floor in front of it.
  - If the room changes mid-walk, the rest of the route is re-planned at the next leg boundary.
  - Petting slows every leg, since each one goes through `startMove`. Perch-at-start hop-down, and the visit/roomChanged checks, are unchanged.
- CLAUDE.md "The cat" → Behavior updated to describe tile routes and climbing.
- 132 unit tests pass.

**Not verified**
- Not run in a real browser; `npm run check` can't check movement or drawing order. Asa, please re-test:
  - Place a table in the middle row, then something on the far side: does the cat walk around the table, not across it, and never cut a corner?
  - Walk it behind a front-row item: is it hidden behind it while passing, then in front of back-row items?
  - Wall it in with tables (or a table and a stool) across all three rows: does it hop up, cross, and hop down on the far side? Does a candle on the table stay drawn under it?
  - A line of cauldrons across all rows: does it stop at the near side and react from there, not walk through?
  - Put the table down for a loaf: does it hop onto the top from a sensible side and loaf there?
  - Drop a cauldron right on the cat: does it step off sideways or forward, never teleport?
  - Move the table while the cat is crossing it: does it drop to the floor in front and carry on, not float?
  - Pet it mid-route: does the slowdown carry across corners and hops?
  - Does the walk look smooth, or too zig-zaggy along tile centers?

**Next**
- Asa playtests the walk.
- Then back to 3a's playtest and task 3b (the cat's portal moment).

## Oct 22, 2026 — Milestone 3a: spellbook inventory and portal effects (signed off)

Playtest: **signed off** for now (Oct 22, 2026). The book looks much better after the per-page layout fix. Not merged to `main` yet: Asa wants the pathfinding change playtested and the whole batch since `c215175` reviewed by both reviewer agents first.

**Follow-up (Asa's first look): items now sit on the pages**
- The first version laid the book's items out as one centered row across the spine. Now they fill the left page, then the right, each row centered inside its page's trim with 8px padding. Order is unchanged, and nothing crosses the spine or a page edge.
- Page geometry has one source of truth: `BOOK_PAGES`, `pageItemArea`, `TRAY_HEADING_Y`, and `TRAY_ITEM_BOTTOM` in `room-view.ts`. Both the drawing and the item layout read them.
- The split is a new pure helper, `layoutTrayRow`, in `src/logic/tray.ts` (tested, including today's starting inventory).
  - If both pages are full, extra items stay on the right page and spill over its edges. Real paging comes in milestone 4.
  - Items are never scaled.
- Numbers (`TRAY_Y` 316, unchanged):
  - Pages are 369×100 at y 323: the left page starts at x 10, the right at x 389. The spine is at 379–389.
  - Item areas are 347×78 at y 334–412: x 21–368 on the left page, x 400–747 on the right.
  - Item bottom is 390, so the tallest item's top is at 348, and the ×N counts sit at 396–~408.
  - The heading's and the reset button's text both start at y 326. The reset button's padded box ends at about 342, and its right edge lines up with the right item area's edge.
- Today's inventory:
  - Left page: frame, moon chart, shelf ×2, clock, table (336px wide).
  - Right page: stool, rug, cauldron, candle ×2, potion ×2 (288px wide).
- 115 unit tests pass.

**Done**
- The tray is drawn as an open spellbook: an amber-trimmed cover, two page panels, a dark spine down the middle, and a small "magic inventory" heading. `TRAY_Y` and the drop-to-remove area are unchanged. The green outline when dragging back over the book stays.
- Summon: dragging from the book opens a two-ring portal at the item's book spot that fades and shrinks out (~280ms), and the item pops from 0.85 to full size over 120ms.
- Land: a successful place or move (including swaps and amber replaces) throws six small four-point stars out from the dragged item's final spot (~360ms).
- Send back: anything that leaves the room spins and shrinks into a small swirl (~360ms): an item dragged to the book, surface items riding on removed furniture, the item an amber replace sends back, and everything on "reset room". The ghost is a separate copy, so it outlives the re-render. It starts where the item's view last was (for a drag to the book, that's where it was dropped).
- A refused drop still just snaps back, with no effect.
- New `src/scenes/magic-fx.ts` (`openPortal`, `popIn`, `sparkle`, `sendBack`) and `src/data/magic.ts` (`MAGIC_FX`: durations, sizes, colors, counts). Every effect object is destroyed when its tween completes.
- `ItemView.setScale` scales only what's drawn, around the visual center. The view's x/y (which `targetFor` reads) never change, so drop math is untouched. The pop is guarded so a drop mid-pop is harmless.
- Ghosts are built by `itemGhost` in `room-view.ts`: not interactive, not in `placedViews`, so the cat never sees them.
- New pure helper `placementsNotIn` in `src/logic/grid.ts` (tested): what went back (prev vs next) and what was newly placed (next vs prev).
- 110 unit tests pass. Save format unchanged. CLAUDE.md unchanged (matches "Magic inventory and portals").

**Not verified**
- Not run in a real browser; `npm run check` can't check visuals or feel. Asa, please re-test locally and on a phone:
  - Does the book read as a spellbook? Does each page's row sit clear of the spine and inside the trim? Are all item labels, ×N counts, the heading, and "reset room" readable?
  - Drag from the book: does the item stick to your finger from the first frame, with no lag? Is the portal ring visible behind it?
  - Drop a tray item, move an item, and swap two items: one small sparkle on the dragged item each time?
  - Drag the table (with a candle on it) to the book: do both spin away? Amber replace a candle: does the old one spin away?
  - "reset room" with a full room: does everything swirl away at once without a stutter on the phone?
  - Refused drop (red): snaps back, no effect.
  - The cat behaves exactly as before, and ignores the ghosts.

**Next**
- Asa playtests 3a on a phone.
- Then task 3b: the cat's portal moment.

## Oct 22, 2026 — Direction change: magic theme, decorate above all

Asa redirected the game; CLAUDE.md is rewritten to match. No code changed.

**Decided**
- Decorating comes first. Cleaning is now one optional way to earn, not a step before decorating.
- The tray becomes a magic inventory, with portal summon and send-back effects. The cat sometimes tumbles into a portal and floats in the inventory, and may bring a gift.
- One room, with wallpaper and ground switched separately (about 3 of each in v1). Items aren't locked to themes.
- Earning comes from magic motes and cat gifts, tuned so new items are never a bottleneck. No incremental clicker.
- The player names the cat and picks a preset coat.
- New milestone order:
  - 3: magic layer
  - 4: room themes and 25–30 items
  - 5: earning, shop, scrapbook, optional cleaning
  - 6: cat customization
  - 7: art pass
  - 8: feel pass

**Open (CLAUDE.md)**
- Are wallpapers and grounds free from the start, or shop unlocks? (milestone 4)
- What's the currency called? (milestone 5)

**Next**
- Milestone 3: magic layer. Plan first, for Asa's approval.

## Oct 22, 2026 — Milestone 2: go. Cat moments scrapbook decided

Ambient-cat playtest: **go.** The cat makes decorating feel cozier. All cat fixes through `c215175` are merged to `main` and deployed.

**Decided**
- A "cat moments" scrapbook, built in milestone 4 once the catalog is 25–30 items. Decorating with a variety of items stays the main goal.
- A light completionist touch is welcome, but it must not turn into a checklist. Not tied to coins at first.
- Entry type is decided at milestone 4. Asa is leaning toward hand-written moments.
- CLAUDE.md updated: decorating section, scope table, milestone 4, open questions.

**Can wait (from the pre-merge reviews, all low)**
- ~~An interrupted walk doesn't reset the cat's draw depth.~~ Mostly fixed: floor legs now track depth every frame, and `interrupt()` updates it when it drops the cat to the floor.
- A pet right as a groom ends can leave the cat up to 2px off the floor.
- Picking up the item the cat is walking to makes it give up and come back later.
- An interrupted climb snaps the cat straight down instead of back to its row.

**Next**
- ~~Milestone 3: cleaning phase.~~ Superseded by the direction change above.

## Oct 22, 2026 — The cat stands on the item's side of the table (awaiting playtest)

**Done**
- When the cat reacts to a candle, potion, or plant on floor furniture, it stands on the side of the furniture that item is on: left slot of the table → left side, right slot → right side. If that side has no room (room edge), it uses the other side. A 1-slot host like the stool keeps the old behavior (left if there's room, else right). Wall shelves and non-surface items are unchanged.
- New pure helper `slotSide` in `src/logic/cat.ts` (tested); `approach()` in `src/scenes/cat-actor.ts` uses it, and now also checks the right room edge.
- Asa's call: the cat can keep loafing on a table that has items on it. Loafing is unchanged.
- Moving a candle to the other slot of the same table now changes the stand point, so the mid-walk "item moved" check sees it as moved (intended).
- CLAUDE.md "The cat": added the stand-on-the-item's-side note.
- 107 unit tests pass. Save format unchanged.

**Not verified**
- Not run in a real browser. Asa, please re-test locally:
  - Put a candle in the table's left slot, then the right slot: does the cat walk to the matching side?
  - Push the table against the left or right wall and use the slot on that side: does the cat go to the other side instead?
  - Candle on the stool: same as before.
  - Move a candle to the other slot while the cat walks to it: it should give up and come back to the new side later.

**Next**
- Asa playtests on a phone.

## Oct 21, 2026 — Gentler petting, moved items end reactions, offended blink (awaiting playtest)

Asa's local playtest: petting cut the cat's actions short, moving an item mid-reaction made the cat restart in place, and the grumpy wake-up was a bit aggressive.

**Done**
- Petting never cuts the cat's action short. On the move (walking, climbing up, hopping down) it slows to 0.4× for a second, eases back, and keeps going to the same spot, with a tail-up wiggle, a heart, and "purr purr". Mid-reaction or mid-idle-action (sit, groom, nap) it just gets a heart. Only a cat with nothing going on purrs and rolls over. Repeated taps restart the slowdown instead of stacking it. Values are in `CAT_TIMING`.
- Root cause of the restart: nothing ended a reaction when its item moved. The reaction played out, and meanwhile the drop had queued the item again, so the cat visited it right after. When the cat's stand point hadn't changed (e.g. a candle moved to the other slot of the same table), it reacted again on the spot. Moving furniture didn't count as moving the candle on it at all.
- Now, if the item the cat is walking to or reacting to is moved or removed (including by moving its table or shelf), the cat stops right away and moves on. A moved item goes to the back of the queue. Picking an item up or a refused drop changes nothing. New pure helpers `displaced` and `toBack` in `src/logic/cat.ts` (tested).
- The grumpy wake-up is now an offended blink: the cat sits up, turns toward where the rug went, does one slow blink (a head dip, since the placeholder has no eyes), says "mrr.", flicks its tail, then carries on.
- CLAUDE.md "The cat": petting, moved-item, and rug wake-up bullets updated.
- 104 unit tests pass. Save format unchanged.

**Not verified**
- Not run in a real browser (the dev server compiles the module). Asa, please re-test locally:
  - Pet the cat while it walks, while it climbs onto a table, and while it hops down. Does it slow down and still arrive? Does tapping fast keep it slow forever (it shouldn't)?
  - Pet it mid-reaction and mid-nap: heart only, nothing interrupted.
  - Pet it when it's just standing around: the full roll-over.
  - Move a candle while the cat reacts to it, to the other slot on the same table and to a shelf. Also move the table under it. The cat should stop and move on, and come back to the candle later.
  - Pick up the item it's reacting to and drop it back where it was (or somewhere it doesn't fit): the reaction carries on.
  - Slide the rug out from under a napping cat: does the blink read as "unimpressed" with the head dip?

**Next**
- Asa playtests on a phone.

## Oct 21, 2026 — Cat fixes from code review, and a grumpy wake-up (awaiting playtest)

Two code reviews of the ambient cat found five bugs; Asa also made three design calls.

**Done**
- If an item moves or disappears while the cat is walking to it, the cat no longer reacts to the old spot (or loafs in mid-air). It gives up, hops down if it was climbing, and visits the moved item later.
- Petting the cat on its way to (or during) a reaction no longer loses that reaction; the item goes back to the front of its queue.
- Petting mid-hop, mid-climb, or mid-jump always lands the cat on the ground (or its perch), never in mid-air.
- Wobbles no longer fight a drag: they skip items being carried (and their riders), redrawn items, and items already wobbling; they're cancelled if the cat is interrupted first.
- A cat on an idle cozy visit counts as busy, so it no longer turns toward drags mid-reaction.
- New: sliding a rug out from under a napping cat (or removing it) wakes it right away: it puffs up, shakes, says "hmph!", then carries on. Line and timing in `src/data/cat.ts`; the rug check is `movedOrRemoved` in `src/logic/cat.ts` (tested).
- CLAUDE.md: shiny/fragile paw-up covers the wall too; the grumpy exception; red highlight shows only where an item can't be placed, none over empty space.
- 99 unit tests pass. Save format unchanged.

**Not verified**
- None of this has run in a real browser. Especially worth checking on the phone: the grumpy puff/shake looks cute rather than upset, moving a table while the cat walks up onto it, and petting mid-hop.

**Next**
- Asa playtests the cat on a phone.

## Oct 21, 2026 — Ambient cat: don't interrupt the cat (awaiting playtest)

Ambient-cat playtest: wandering is "definitely the right direction", but the cat stopping every time Asa picked up an item broke its flow.

**Done**
- Picking up an item no longer interrupts the cat. A walking, napping, or reacting cat carries on; an idle cat sitting still just glances toward what's being dragged.
- Dropping an item no longer cuts the cat's current action short (even a nap); it finishes, then comes over.
- Only exception: if the furniture it's sitting on is moved or removed, it hops down right away.

**Next**
- Asa playtests the cat's flow on a phone.

## Oct 21, 2026 — Milestone 2, take 2: Ambient cat (built, awaiting playtest)

Scored-review playtest: nothing broke, but **no-go** on the design. The score made decorating feel like a puzzle with wrong answers, and the cat didn't make Asa want to rearrange. CLAUDE.md now describes the cat as an ambient companion.

**Done**
- Removed the score, hearts, knock-overs, the "show the cat" button, and the CatReview scene.
- The cat lives in the Decorate scene (`src/scenes/cat-actor.ts`): wanders, sits, grooms, naps, drifts to cozy spots; walks over to react to items you place or move (one at a time, at its own pace); turns to watch while you drag; tap it to pet it; hops down if its perch is moved or removed.
- Reactions by tag (`src/data/cat.ts`): nap on soft, paw at shiny/fragile things up high (they wobble, never fall), warm up by warm things, bat at shiny things, loaf on tables/stools, stare at spooky things, sniff anything else.
- Decision logic in `src/logic/cat.ts` with tests (97 total pass).

**Not verified**
- Reactions, watching, and petting haven't run in a real browser yet; screenshots confirm the cat draws and the scene runs.

**Next**
- Asa playtests. Go/no-go question: *does having the cat around make decorating feel cozier and make you want to keep going?*
- Then decide on the "cat moments" journal (open question in CLAUDE.md).

## Oct 21, 2026 — Milestone 2, take 1: Scored cat review (dropped)

Different-size swap playtest: passed. Milestone 1 closed.

**Done**
- Tags on all 10 items; cat likes soft, warm, shiny and dislikes fragile items on shelves (rules in CLAUDE.md, values in `src/data/cat.ts`).
- Review logic in `src/logic/cat.ts`: reactions, left-to-right visit order, score (+15 like, −20 dislike, 0–100), knockovers back to the tray. 92 unit tests pass.
- "▶ show the cat" button opens the CatReview scene: the placeholder cat walks the room, hops and shows a heart for likes, sniffs neutral items, and knocks disliked items to the floor with a hint line. Ends with hearts, a summary, and "◀ keep decorating". "speed up ▶▶" fast-forwards.
- Room drawing shared between scenes (`room-view.ts`, `room-store.ts`).

**Not verified**
- The review animation hasn't run in a real browser yet (automated browser testing doesn't work on this machine). Asa's phone playtest is its first run.

**Next**
- Asa playtests. Go/no-go question: *does the cat make you want to rearrange?*
- Tune scores and hint text from feedback.

## Oct 21, 2026 — Swaps between different sizes (awaiting playtest)

Same-footprint swap playtest: passed.

**Done**
- Items of different sizes swap (e.g. stool and table): the dragged item lands where it's dropped, and the other item takes the nearest spot covering part of the dragged item's old spot, shifting left/right/up as needed. Blocked if nothing fits. Highlight outlines both destinations in blue.
- 72 unit tests pass. Save format unchanged.

**Watch in playtest**
- Any drop that overlaps exactly one item now swaps, so a table dropped one tile too close to the stool swaps with it instead of showing red.

**Next**
- Asa playtests stool/table swaps on a phone.
- Then milestone 2: cat reactor.

## Oct 21, 2026 — Same-footprint swaps

**Done**
- Wall, floor, and rug items swap places with a same-footprint item on the same layer (e.g. an empty shelf and a shelf holding a candle; two tables). Items on top ride along. The swap snaps to exact spots, and the highlight outlines both spots in blue.
- Different footprints, drops covering two items, and tray drops onto occupied tiles stay blocked.
- 66 unit tests pass. Save format unchanged.

**Next**
- Asa playtests swaps on a phone.
- Then milestone 2: cat reactor.

## Oct 21, 2026 — Swap places in the room

- Moving a candle or potion onto another one in the room swaps their places (blue highlight). From the tray it still replaces and sends the old item to the tray (amber). Playtest: passed.

## Oct 21, 2026 — Surface swapping

Rugs, shelves, and reset playtest: passed. Placeholder tables fully hide rugs; Asa accepted that for now, and CLAUDE.md now requires the art pass to keep rugs visible.

**Done**
- Dropping a candle or potion on an occupied shelf or table slot replaces what's there; the old item goes back to the tray. Works from the tray and when moving from another slot. Amber highlight means "will replace".
- 59 unit tests pass. Save format unchanged.

**Next**
- Asa playtests swapping on a phone.
- Then milestone 2: cat reactor.

## Oct 21, 2026 — Milestone 1 follow-up: finer control

Milestone 1 playtest: **go.** Arranging is satisfying; Asa asked for finer control.

**Done**
- Rugs are their own layer under furniture: furniture can stand on rugs; rugs can't overlap each other; moving a rug leaves furniture in place.
- Shelves have a 1-slot top for candles and potions, and carry them when moved.
- Starting tray: 2 shelves, 2 candles, 2 potions, 1 of everything else.
- "reset room" button in the tray (tap twice to confirm) returns everything to the tray.
- Save format bumped to v2, so existing saves start fresh once.
- 54 unit tests pass.

**Next**
- Asa playtests rugs, shelves, and reset on a phone.
- Then milestone 2: cat reactor.

## Oct 21, 2026 — Milestone 1: Decorate sandbox

**Done**
- Front-facing bedroom: 12 columns, 3 wall rows above 3 floor rows, with an item tray below.
- 10 rectangle items in `src/data/items.ts`: 4 wall, 4 floor (table and stool have tops), 2 surface (candle, potion). One of each to start.
- Drag from the tray to place, drag to move, drag back to the tray to remove. A green/red highlight shows whether a drop fits; a refused drop snaps back.
- Surface items sit on furniture, move with it, and return to the tray with it.
- Local save (versioned). A broken or old save starts the room fresh.
- Grid, surface, and save logic in `src/logic/` with 48 unit tests; the game-wide checks pass.

**Known limits**
- The tray doesn't scroll; it fits the 10 starter items only.
- On a phone in portrait the game is small; landscape is the intended view.
- Automated browser testing doesn't work on this machine; drag behavior is verified by Asa's phone playtests.

## Oct 21, 2026 — Milestone 0: Setup

- Vite + Phaser 4 + TypeScript project, Vitest and typecheck scripts, CLAUDE.md, GitHub Pages auto-deploy.
- Phone playtest passed. Camera view decided: front-facing.
