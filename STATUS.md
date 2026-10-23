# Status

## Oct 22, 2026 — Milestone 3b: the cat's portal dive (awaiting playtest)

**Done**
- Now and then the cat dives into a portal, floats around a spellbook page behind its items, reacts to one item, and hops back out into the room. CLAUDE.md "Portal moments" now describes the concrete behaviour.
- Timing (`src/logic/cat.ts`, tested):
  - `nextActivity(queued, playTime, diveDueAt)`: queued visits first, then a dive once due, else idle. `next()` asks it where it used to go straight to `pickIdle`, so a dive only starts when the cat is free.
  - `nextDiveAt(playTime, range, random)`: the next dive is 60–120s of play time later. Drawn at scene start and after every dive.
  - Play time is counted per frame from the scene's update delta, only while `document.visibilityState` is visible (Phaser also stops its loop on a hidden tab).
- Sequence (`cat-actor.ts`):
  - Walks (routed) to the free front-row tile nearest it (new pure `nearestFreeTile` in `route.ts`, tested). If the whole front row is taken, it skips this dive and idles.
  - Says "meow!", a floor portal opens under it (`openPortal` now takes duration, radius, and depth), and it shrinks, fades, and sinks 6px into the ring.
  - Comes out of a page portal at 0.8 scale on a random page. Its path stays inside `pageItemArea` of that page (clamped for its size and bob). It drifts behind one random item on the page, reacts (`bookReactionFor`, tested: shiny paws at the air, warm slow blink, spooky ears perk, soft curl-up, else sniff), drifts on, and sinks into another page portal. A couple of small sparkles, drawn behind the items too. Total float about 6–8s. On an empty page it just floats.
  - Book items are only read (position and tags), never moved, scaled, or touched.
  - Back out of a floor portal at the tile it left from, or the nearest free front-row tile (then any row) if that's taken now. Full size, then `finish()` and the normal idle loop.
  - `bringGift()` is an empty hook for milestone 5's gifts.
- Depth: the floating cat is at `DEPTH_BOOK_CAT` (5), above the book's drawing (0) and below its items, ×N counts, heading, and "reset room", which all moved to `DEPTH_BOOK_ITEMS` (100, as the tray items already were). `updateDepth()` returns book depth only while floating, and room depth once it's back.
- Taps: the cat isn't interactive, so drags from the book work as normal while it floats. On pointerup, DecorateScene no longer pets the cat if a book item is under the pointer. Tapping the floating cat elsewhere gets a heart only (it's busy). `hitTest` scales with the cat and ignores it while it's mostly through a portal.
- Room changes while it's away queue as usual. It has no perch, rug, or visit target while diving, so `roomChanged` only queues.
- Interrupts: if anything ever interrupts a dive once it's started sinking, `interrupt()` puts the cat back on its exit tile at full scale, alpha 1, and room depth (`landFromDive`), and draws the next due time. Cut off on the walk there, it just dives at its next free moment. Scale/alpha tweens are token-guarded, `finish()` and `interrupt()` restore scale and alpha, and `resetParts()` now also restores face x (for the sniff).
- Speech bubble is clamped in y as well as x, and sits lower over the smaller floating cat.
- Dev-only "✦ dive" button, top-right in the margin beside the room, inside `if (import.meta.env.DEV)`: the next dive is due now, and a cat waiting between activities dives right away (after queued visits). `npm run build` output doesn't contain it (grepped dist for the label and ✦).
- Data in `src/data/cat.ts` (`DIVE`, `DIVE_LINE`, `BOOK_REACTION_RULES`, `BOOK_REACTION_LINES`) and `src/data/magic.ts` (`catPortal`).
- 164 unit tests pass (10 new). Save format unchanged.

**Not verified**
- Not run in a real browser; `npm run check` can't check movement, depth, or taps.
- The speech bubble stays at bubble depth, so a reaction line in the book can briefly overlap an item (it isn't interactive and doesn't block drags).

**Re-test** (use "✦ dive" in `npm run dev`)
- Does the dive read: walk to the front row, "meow!", sink into the ring, pop out on a page?
- Is the floating cat clearly behind the book's items and counts, and never outside the page?
- Does it drift behind one item and do a small reaction that suits it, with the item never moving?
- While it floats: drag items out of the book (it keeps floating); tap a book item over the cat (no heart); tap the cat where there's no item (heart only).
- Place and move items while it's away: does it visit them after it's back?
- Put a cauldron on the tile it dove from: does it come back out on the nearest free front-row tile?
- Tap "✦ dive" while it's mid-reaction or napping: does it finish first, then dive?
- Without the button: does a dive come along every minute or two, and does it feel rare enough?
- Phone: does the bob look smooth, and does dragging stay lag-free while it floats?

**Next**
- Asa playtests 3b.
- Then milestone 4 (room themes and the larger catalog), with gifts in milestone 5.

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
