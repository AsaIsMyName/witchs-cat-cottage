# Status

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
