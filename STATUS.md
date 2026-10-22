# Status

## Oct 22, 2026 — Milestone 3a: spellbook inventory and portal effects (awaiting playtest)

**Done**
- The tray is drawn as an open spellbook: an amber-trimmed cover, two page panels, a dark spine down the middle, and a small "magic inventory" heading. Item layout, `TRAY_Y`, and the drop-to-remove area are unchanged. "reset room" moved a few px (to x −14, y +6) so it sits inside the right page, level with the heading. The green outline when dragging back over the book stays.
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
  - Does the book read as a spellbook, and are all item labels, ×N counts, the heading, and "reset room" readable? (The spine runs through the middle of the item row.)
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
- An interrupted walk doesn't reset the cat's draw depth, so it can draw over front furniture until its next walk.
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
