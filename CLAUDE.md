# Witch's Cat Cottage — Design Doc

Oct 21, 2026 · @kxh

## Overview

Witch's Cat Cottage is a cozy, magical browser game about decorating a room in a witch's cottage while the witch's cat keeps you company. You summon items out of a magic inventory through little portals, re-theme the room whenever you like, and keep collecting new things to decorate with. **Decorating comes first, above everything else.** There are no wrong answers: the cat reacts to what you place, but never judges or scores it.

- **Platform:** web first (desktop and phone browser). Wrap as a mobile app later only if v1 proves worth it.
- **v1 goal:** find out whether decorating, with the cat around and new items arriving steadily, holds attention for 15 minutes. It is a learning project, not a commercial release.
- **Tone:** cozy and magical. The default theme is cozy witchy (candles, potions, plants, moons, books). Seasonal, holiday, gothic, and other themes are options the player chooses, not the default.

## Core loop

There's no gate in front of decorating. You decorate the whole time, and the room keeps quietly giving you ways to get more items.

1. **Decorate:** summon items from the magic inventory, then move them and send them back, while the cat wanders the room and reacts to what you add.
2. **Re-theme** the room whenever you like by switching its wallpaper and ground.
3. **Earn** along the way: tap drifting magic motes, and receive the cat's gifts from the portal (optionally, tidy up a messy room too).
4. **Unlock** new items in the shop, and keep decorating.

Decided Oct 22, 2026: the game moved from "clean, then decorate" to "decorate above all, with magic." Cleaning is now one optional way to earn, not a step before decorating.

## The cat: a companion, not a judge

Decided Oct 21, 2026, after the milestone 2 playtest: a scored cat review made decorating feel like a puzzle with wrong answers, and didn't make Asa want to rearrange. The cat is now an ambient companion that lives in the room while you decorate.

- **Always there:** the cat is in the Decorate scene the whole time. It never blocks drops or gets in the way of dragging.
- **No score, no wrong answers:** reactions are always positive, playful, or curious. Nothing is knocked off or sent back to the tray. The one exception: sliding a rug out from under a napping cat gets an offended blink (sits up, one slow unimpressed blink, a quiet "mrr.", a tail flick, then carries on).
- **Tags pick reactions:** every decor item has 1–3 tags (cozy, soft, warm, shiny, spooky, fragile, tall, …). Tags choose *which* reaction the cat does, not whether it approves.
- **Behavior (scripted, with no real AI; it uses simple tile routes on the floor grid only):**
  - The cat walks around furniture on the floor tiles and over rugs. If the only way through is over furniture with a top (table, stool), it hops up, crosses, and hops down. It can't cross items without a top (like the cauldron). If it can't reach a spot, it goes as close as it can.
  - Idle: wanders, sits, grooms, or naps, drifting toward cozy spots (e.g. a rug or near the cauldron) when there are some.
  - When an item is placed or moved, the cat finishes what it's doing (including a nap), then strolls over and reacts. Several new items are visited one at a time, at the cat's own pace.
  - When reacting to something on furniture (e.g. a candle on a table), the cat stands on that item's side of the furniture, or the other side if there's no room.
  - Player actions never interrupt the cat's flow (except the cases below). While the player drags something, an idle cat that's sitting still glances toward it; a walking, napping, or reacting cat carries on.
  - Tapping the cat pets it. If it's idle, it purrs, a heart floats up, and it rolls over. If it's on the move, it slows down happily while petted and keeps going. If it's reacting, a heart floats up and it carries on. Petting never cuts the cat's action short. A drag that starts on the cat still picks up the item underneath.
  - If the item the cat is reacting to is moved or removed (including by moving the furniture or shelf it sits on), it ends that reaction and moves on to the next thing. A moved item is visited again later, after anything else that's waiting.
  - If the item the cat is sitting on is removed or moved, the cat hops down, unbothered.
  - If the rug the cat is napping on is moved or removed, it gives an offended blink: sits up, one slow unimpressed blink, a quiet "mrr.", a tail flick, then carries on; it may stroll over to the moved rug later like any other changed item.
- **Reactions (first match wins; values in `src/data/cat.ts`):**
  - soft (rug): curls up and naps.
  - shiny or fragile on a shelf or the wall: reaches up and paws at it; the item wobbles but stays put.
  - warm (cauldron, candle): sits beside it and slow-blinks.
  - shiny within reach: bats at it; the item wobbles.
  - has a top (table, stool): hops up and loafs on it.
  - spooky: ears perk, it stares.
  - anything else: a curious sniff.
- **Portal moments (milestone 3b):** now and then, the cat dives into a portal and floats around the magic inventory before hopping back out. It's scripted, and the floating cat never covers inventory slots or blocks a drag.
  - **When:** a dive is due every 60–120s of play time (counted only while the tab is visible). The cat dives the next time it's free to pick an idle activity: queued item visits come first, and a dive never interrupts a reaction, nap, pet, or walk.
  - **Dive:** it walks to a free tile in the front floor row, says "meow!", and shrinks and fades down into a small floor portal.
  - **Float:** it comes out of a portal on one spellbook page at 80% size and floats lazily for about 6–8s, drawn behind the book's items. It drifts behind one item on that page and reacts by its tags (shiny: paws at the air; warm: slow blink; spooky: ears perk, it stares; soft: a little curl-up; else a sniff). Book items never move, wobble, or scale. On an empty page it just floats. Dragging from the book works as normal meanwhile; a tap on a book item never pets the cat, and tapping the floating cat elsewhere gets a heart only.
  - **Return:** it sinks into a page portal and hops back out of a floor portal at the tile it left from (or the nearest free front-row tile), at full size, and carries on. Items placed or moved while it was away are visited after it's back.
  - **Gifts** come in milestone 5 (see "Earning and unlocks"); the return has a hook for them.
  - **Dev builds only:** a small "✦ dive" button (top-right) makes the cat dive at its next free moment. It isn't in production builds.
- **Customizable (milestone 6):** the player names the cat and picks its coat from a set of preset coats, at any time in the game, e.g. to match the room's theme. Presets only in v1; no free color picker. Until a name is chosen, it's "the cat".
- Its reactions are fixed in v1.

## Magic inventory and portals

The tray is a **magic inventory**, e.g. an open spellbook or a witch's satchel along the bottom of the screen. Drag controls work exactly as described in "Decorating" below; magic only changes how things look.

- **Summon:** dragging an item out of the inventory opens a small portal it comes through. Dropping it in the room settles it with a little sparkle.
- **Send back:** dragging an item back to the inventory, or a removal that sends items back, plays a poof or swirl into a portal.
- **Never slower:** the effects must never delay a drag or a drop. If an effect makes dragging feel laggy on a phone, cut the effect.

## Room themes

There's one room, and the player re-themes it.

- **Wallpaper and ground are switched separately**, so any wallpaper can go with any ground. v1 ships about 3 of each, starting with cozy witchy. Seasons, holidays, gothic, and so on come as content later.
- **Items aren't locked to a theme.** Any item can go in any theme; mixing gothic with spring is a valid choice. Items can be designed with a theme in mind, which is just a tag.
- **Data-driven:** a wallpaper or ground is a data entry with a sprite id, like an item. Adding one means editing data, not code.
- **Switching themes never moves or removes items,** and the cat carries on.

## Earning and unlocks

Earning exists to keep new items arriving; it is never a bottleneck. A player who's decorating should always have something new on the way without grinding. If a playtest shows waiting or grinding for items, make earning more generous before adding anything else.

- **Magic motes:** small wisps that drift through the room now and then. Tap one to collect it. It's ambient and satisfying, not a clicker: no upgrades, multipliers, or idle numbers.
- **Cat gifts:** after a portal moment, the cat sometimes brings back an item or some coins.
- **Optional cleaning:** a tidy-up activity is one more way to earn, never a gate in front of decorating (see "Optional cleaning").
- **Shop:** coins buy items, and later wallpapers and grounds. Prices and drop rates live in data files.
- **Cat moments scrapbook (milestone 5):** a page that collects the cat's moments as you discover them, as a gentle reason to try new items. Decorating with a variety of items stays the main goal; the scrapbook only supports it.
  - A light completionist pull is fine (e.g. a few undiscovered hints or a soft count), but it must never feel like a checklist you decorate to tick off.
  - Not tied to coins at first; revisit when tuning earning at milestone 5.
  - Entry type is decided at milestone 5; leaning toward hand-written moments over one entry per item and reaction.
- **No fail state and no score.**

## Optional cleaning

Built in milestone 5 at the earliest, and only if it's still wanted then. It's a short, satisfying tidy-up the player can choose to do, never a gate. If it feels like a chore, cut it.

- **Trash** (wrappers, broken vials, dust bunnies) → drag to a bin or banish it through a portal.
- **Misplaced items** → drag to their matching home: books to the shelf, potions to the cabinet, scrolls to the desk.
- **Spills and cobwebs** → tap or swipe to wipe.
- **No fail state and no timer.** Hand-authored layouts stored as data files; no procedural generation in v1.

## Decorating

Decorating is the core of the game, so it gets built and playtested first (see Milestones).

- **Grid (front-facing view):** the room is 12 columns wide, with 3 rows of wall slots above 3 rows of floor (back to front). Items in front rows draw on top of items behind them.
- **Footprints:** floor items take 1×1, 2×1, or 2×2 tiles. Wall items are always 1×1, since multi-tile wall art is out of v1.
- **Layers:** rug (floor coverings), floor (chairs, tables, cauldron), wall (frames, shelves, moon charts), and surface (candles, potions, plants placed on top of furniture or shelves).
- **Rug rules:** rugs share the floor's rows but sit under furniture. A rug can't overlap another rug, but furniture can stand on it. Moving a rug slides it out alone; furniture on it stays put. A rug that's fully covered can't be grabbed until what's on it is moved.
- **Surface rules:**
  - Some furniture has a top with one surface slot per tile of width (a 2×1 table has 2 slots). Shelves are 1×1 wall items with 1 slot. Rugs, the cauldron, and other wall items have no top.
  - Surface items (candles, potions, plants) take one slot and can only sit on a surface.
  - Moving furniture moves whatever sits on it. Removing furniture sends whatever sits on it back to the tray.
  - Moving a wall, floor, or rug item onto exactly one other item on the same layer swaps them (blue highlight on both destinations). Anything sitting on either item moves with it.
    - Same footprint: the two trade exact spots, snapping a half-overlapping drop onto the other item's spot.
    - Different footprints: the dragged item lands where it's dropped, and the other item takes the nearest spot that covers part of the dragged item's old footprint (e.g. a table shifts left if the stool was against the right wall). If no such spot fits, the drop is blocked.
    - Drops covering two items, and tray drops onto occupied tiles, stay blocked.
  - Dropping a surface item onto an occupied slot:
    - From another slot in the room: the two items swap places if each fits in the other's spot (blue highlight).
    - From the tray, or if a swap doesn't fit: the new item replaces what's there, and the replaced item goes back to the tray (amber highlight).
  - Dropping an item where it doesn't fit snaps it back to where it came from; the drop highlight shows green for a free spot and red only over a spot where the item can't be placed. A surface item over empty space (no furniture or shelf under it) shows no highlight.
- **Controls:** drag from the magic inventory (the tray, in code) to place; drag to move; drag back to the inventory to remove. Mouse and touch both work. No rotation in v1.
- **Catalog size:** 25–30 decor items for v1.

## Scope

Anything not on the "In v1" list is out until v1 is playable end to end. Claude Code should ask before building anything from the right column.

| In v1 | Not in v1 |
| --- | --- |
| One room, with ~3 wallpapers and ~3 grounds to switch between | Multiple rooms, roguelike runs, procedural rooms |
| 25–30 decor items | Multiple cats |
| One ambient cat with fixed reactions, a player-given name, and preset coats | Free color picker for the cat, story, dialogue, quests |
| Magic inventory, portal effects, cat portal moments | Item rotation, multi-tile wall art |
| Magic motes, cat gifts, coins, and a simple shop | Incremental/idle clicker systems (upgrades, multipliers) |
| Cat moments scrapbook | Accounts, cloud save, leaderboards |
| Optional cleaning (if still wanted at milestone 5) | |
| Local save in the browser | Monetization, ads |
| Mouse and touch drag | App store builds |
| Placeholder art, then Claude-made props + a bought cat sprite | Music (basic sound effects are fine in the polish milestone) |

## Tech stack and architecture rules

TypeScript, Phaser (current stable), and Vite, deployed as a static site so it can be played on a phone browser.

- **Logic is separate from rendering.** Grid placement, cat decisions, earning and rewards, and save/load live in plain TypeScript modules with no Phaser imports, so they can be tested.
- **Tests:** those logic modules get unit tests (Vitest). Typecheck and tests must pass before any task is called done.
- **Data-driven content.** Items, wallpapers, grounds, cat coats, cat behavior, prices, and drop rates live in data files, not inside scene code. Adding an item or a theme should mean editing data, not code.
- **Art is swappable.** Every item, wallpaper, and ground is drawn by sprite id. A missing sprite falls back to a colored rectangle with the item's name, or a flat color for a wallpaper or ground.
- **Scenes:** Boot, Decorate (with the cat, the magic inventory, and theme switching), Shop; Clean only if optional cleaning is built.
- **Save:** browser local storage, with a version number in the save format so later changes don't corrupt old saves.
- **Hosting:** a free static host (GitHub Pages or itch.io) so each build can be tested on a phone.

## Art pipeline

Art is the biggest risk in a decorating game, so it is decoupled from code and done in stages.

1. **Rectangles first.** Build and playtest milestones 1–6 with labeled colored rectangles and flat-color wallpapers and grounds.
2. **Buy the cat sprite pack** (itch.io, roughly $0–15) before generating any props. Its resolution and palette become the game's style. It must be recolorable into the preset coats (e.g. a limited palette that can be swapped). If no pack fits, Claude makes the cat as a pixel grid too, in the same style as the props.
3. **Claude Code generates props as code:** each sprite is a palette-indexed pixel grid in a source file, and a script renders all grids to PNGs. Generated PNGs are never edited by hand; the grid is the source of truth.
4. **Asa reviews every sprite.** Expect 3–4 feedback rounds per item.
5. **Optional:** touch up weak sprites in Aseprite (about $20).

Style rules: one shared palette file, one outline color, light from the top-left, integer scaling only, no smoothing. Never mix Claude-made props with a pack in a different style.

Visibility rule: a rug must stay visible under furniture (e.g. its edges or back show around a table's legs). With placeholder rectangles a table fully covers a rug; the art pass must fix that.

Themes multiply art. Keep v1 to about 3 wallpapers and 3 grounds, and add more only after v1 proves fun.

## Milestones

Decorating is built first because it is the core of the game; if it isn't fun, the rest doesn't matter. Each milestone ends with a phone playtest and a go/no-go question. The order of milestones 3–8 was revised on Oct 22, 2026, for the magic theme.

0. **Setup:** repo, Vite + Phaser + TypeScript, this file as CLAUDE.md, git, first deploy to a static host.
1. **Decorate sandbox:** one room grid, 10 rectangle items, drag to place, move, and remove, local save. *Test: is arranging things satisfying on its own?*
2. **Ambient cat:** tags, an always-present cat that wanders, reacts to new items, watches you drag, and can be petted. *Test: does having the cat around make decorating feel cozier and make you want to keep going?* (A first version with a scored review was tried and dropped; see "The cat".)
3. **Magic layer:** the tray becomes the magic inventory, with portal summon and send-back effects, still using rectangles. The cat's portal moment may land here or later. *Test: does it feel more magical without slowing dragging down?*
4. **Room themes:** switchable wallpaper and ground (about 3 of each), and the catalog grows to 25–30 items. *Test: does re-theming make you want to redecorate?*
5. **Earning and unlocks:** magic motes, cat gifts, coins, the shop, the cat moments scrapbook, and optional cleaning if still wanted. *Test: do new items arrive steadily enough that you never feel stuck waiting?*
6. **Cat customization:** a name and preset coats, decided together with the art plan. *Test: do you change the cat to match your room?*
7. **Art pass:** a bought (recolorable) cat sprite, Claude-made props, wallpapers, and grounds in its palette.
8. **Feel pass:** sound effects, small animations, phone control tuning.

Realistic pace at a few hours a week: milestones 0–2 in about 2–4 weeks. The full v1 is a matter of months, not weeks.

## Working rules for Claude Code

These rules keep the codebase from drifting as it grows. Claude Code reads this file at the start of every session.

- Work on one task from the current milestone per session.
- Propose a short plan before writing code; wait for Asa's approval on anything that changes structure.
- Keep changes small. Never build features, libraries, or systems not listed in this doc without asking.
- If a design decision isn't specified here, ask instead of guessing.
- Run typecheck and tests before saying a task is done. Never commit a broken build.
- Commit after each working feature with a clear message.
- End each session by updating a STATUS.md file: what was done, what's broken, what's next.

**Asa's role as manager:** playtest every build on a phone, give specific feedback ("dragging lags behind my finger" rather than "make it better"), read the diff summary, and decide each milestone's go/no-go.

## Open questions

These need Asa's decision; the first two block the art pass.

- [ ] Which cat sprite pack? It sets the palette and resolution for everything else, and must be recolorable into preset coats.
- [ ] Prop size: 16×16 or 32×32 pixels?
- [x] Camera view: straight top-down (simplest) or a front-facing room view (prettier, harder)? → **Front-facing room view** (decided Oct 21, 2026).
- [x] Does the cat have a name and personality, and should its reactions ever change? → **The player names it and picks a preset coat** (decided Oct 22, 2026); reactions stay fixed in v1.
- [x] Should there be a gentle goal, such as a "cat moments" journal collecting the reactions you've discovered? → **Yes, a scrapbook built in milestone 5** (decided Oct 22, 2026). Light completionist touch, not tied to coins at first; entry type decided at milestone 5 (see "Earning and unlocks").
- [x] Without a cat score, what drives coins and unlocks? → **Magic motes and cat gifts, plus optional cleaning, tuned so getting new items is never a bottleneck** (decided Oct 22, 2026). No incremental clicker. Amounts are tuned at milestone 5.
- [x] One room with themes, or several themed rooms? → **One room with separately switchable wallpaper and ground** (decided Oct 22, 2026).
- [ ] Are wallpapers and grounds all available from the start, or unlocked in the shop? Decide at milestone 4.
- [ ] What's the currency called (coins, stardust, …)? Decide at milestone 5.
- [x] Hosting: GitHub Pages or itch.io? → **GitHub Pages** (decided Oct 21, 2026). Every push to `main` deploys automatically.

## Project commands

- `npm run dev` — local dev server (add `-- --host` to open it from a phone on the same Wi-Fi)
- `npm run typecheck` — TypeScript check
- `npm test` — Vitest unit tests
- `npm run check` — typecheck + tests; must pass before any commit
- `npm run build` — production build into `dist/`

Layout: `src/scenes/` holds Phaser scenes; `src/logic/` holds Phaser-free game logic and its `*.test.ts` files.
