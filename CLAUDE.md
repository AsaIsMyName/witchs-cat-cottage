# Witch's Cat Cottage — Design Doc

Oct 21, 2026 · @kxh

## Overview

Witch's Cat Cottage is a short, cozy browser game: tidy a messy room in a witch's cottage, then decorate it to please the witch's cat. Cleaning is a brief warm-up; decorating is the main activity and the reward.

- **Platform:** web first (desktop and phone browser). Wrap as a mobile app later only if v1 proves worth it.
- **v1 goal:** find out whether the clean-then-decorate loop holds attention for 15 minutes. It is a learning project, not a commercial release.
- **Tone:** cozy witchy, not Halloween. Candles, potions, plants, moons, books. Playable year-round.

## Core loop

One room takes about 5–10 minutes: a short clean, a longer decorate, then the cat's verdict.

1. **Enter** a messy room.
2. **Clean** (60–120 seconds): drag trash to the bin, return misplaced items to their spots.
3. **Reward:** earn coins, scaled by how tidy and quick the clean was.
4. **Decorate:** place, move, and remove items from your collection on the room grid.
5. **Cat review:** tap Done. The cat walks the room and reacts to each item.
6. **Payoff:** a cat-happiness score, bonus coins, and unlocks tied to what the cat liked. Move to the next room or keep rearranging.

## The cat: reactor system

The cat gives decorating a goal. Without it, decorating is an empty sandbox; with it, every placement is a small guess about what the cat will like.

- **Tags:** every decor item has 1–3 tags, e.g. cozy, soft, warm, shiny, plant, spooky, fragile, tall.
- **Preferences:** in v1 the cat has fixed likes and dislikes over those tags (for example, likes soft, warm, shiny; dislikes fragile items on high surfaces).
- **Reactions:** liked item → the cat sits on it, naps, or purrs. Neutral → a sniff. Disliked → the cat knocks it over, and it lands on the floor where the player can put it back.
- **Score:** cat happiness from 0 to 100, shown as hearts.
- **Discoverability:** dislikes must be learnable, not punishing. The cat's reactions and short hint text teach its preferences over a few rooms.
- **v1 behavior is scripted:** the cat walks a fixed path visiting items in order. No real pathfinding or AI in v1.

## Cleaning phase

Cleaning is a short, satisfying gate of 60–120 seconds. If playtesting shows it feels like a chore tax, shorten it before adding to it.

- **Trash** (wrappers, broken vials, dust bunnies) → drag to the bin.
- **Misplaced items** → drag to their matching home: books to the shelf, potions to the cabinet, scrolls to the desk.
- **Spills and cobwebs** → tap or swipe to wipe.
- **8–15 items per room**, from hand-authored room layouts stored as data files. No procedural generation in v1.
- **No fail state and no hard timer.** Speed and tidiness only affect the coin reward.

## Decorating phase and unlocks

Decorating is the core of the game, so it gets built and playtested first (see Milestones).

- **Grid (front-facing view):** each room is 12 columns wide, with 3 rows of wall slots above 3 rows of floor (back to front). Items in front rows draw on top of items behind them.
- **Footprints:** floor items take 1×1, 2×1, or 2×2 tiles. Wall items are always 1×1, since multi-tile wall art is out of v1.
- **Layers:** rug (floor coverings), floor (chairs, tables, cauldron), wall (frames, shelves, moon charts), and surface (candles, potions, plants placed on top of furniture or shelves).
- **Rug rules:** rugs share the floor's rows but sit under furniture. A rug can't overlap another rug, but furniture can stand on it. Moving a rug slides it out alone; furniture on it stays put. A rug that's fully covered can't be grabbed until what's on it is moved.
- **Surface rules:**
  - Some furniture has a top with one surface slot per tile of width (a 2×1 table has 2 slots). Shelves are 1×1 wall items with 1 slot. Rugs, the cauldron, and other wall items have no top.
  - Surface items (candles, potions, plants) take one slot and can only sit on a surface.
  - Moving furniture moves whatever sits on it. Removing furniture sends whatever sits on it back to the tray.
  - Moving a wall, floor, or rug item onto exactly one other item on the same layer with the same footprint swaps their places, snapping to the other item's exact spot (blue highlight on both spots). Anything sitting on either item moves with it. Different footprints, drops covering two items, and tray drops onto occupied tiles stay blocked.
  - Dropping a surface item onto an occupied slot:
    - From another slot in the room: the two items swap places if each fits in the other's spot (blue highlight).
    - From the tray, or if a swap doesn't fit: the new item replaces what's there, and the replaced item goes back to the tray (amber highlight).
  - Dropping an item where it doesn't fit snaps it back to where it came from; the drop highlight shows green for a free spot and red where it doesn't fit.
- **Controls:** drag from an inventory tray to place; drag to move; drag back to the tray to remove. Mouse and touch both work. No rotation in v1.
- **Unlocks:** coins buy items in a simple shop. Items with tags the cat liked are revealed first, so the cat steers your collection.
- **Catalog size:** 25–30 decor items for v1.
- **No fail state.** A low cat score just means fewer coins and hearts.

## Scope

Anything not on the "In v1" list is out until v1 is playable end to end. Claude Code should ask before building anything from the right column.

| In v1 | Not in v1 |
| --- | --- |
| 3 hand-authored rooms (bedroom, potion room, study) | Roguelike runs, procedural rooms |
| 25–30 decor items | Multiple cats or cat customization |
| One cat with fixed preferences | Story, dialogue, quests |
| Clean → decorate → cat review loop | Item rotation, multi-tile wall art |
| Coins and a simple shop | Accounts, cloud save, leaderboards |
| Local save in the browser | Monetization, ads |
| Mouse and touch drag | App store builds |
| Placeholder art, then Claude-made props + a bought cat sprite | Music (basic sound effects are fine in the polish milestone) |

## Tech stack and architecture rules

TypeScript, Phaser (current stable), and Vite, deployed as a static site so it can be played on a phone browser.

- **Logic is separate from rendering.** Grid placement, cat scoring, rewards, and save/load live in plain TypeScript modules with no Phaser imports, so they can be tested.
- **Tests:** those logic modules get unit tests (Vitest). Typecheck and tests must pass before any task is called done.
- **Data-driven content.** Items, rooms, cat preferences, and prices live in data files, not inside scene code. Adding an item should mean editing data, not code.
- **Art is swappable.** Every item is drawn by sprite id. A missing sprite falls back to a colored rectangle with the item's name.
- **Scenes:** Boot, Clean, Decorate, CatReview, Shop.
- **Save:** browser local storage, with a version number in the save format so later changes don't corrupt old saves.
- **Hosting:** a free static host (GitHub Pages or itch.io) so each build can be tested on a phone.

## Art pipeline

Art is the biggest risk in a decorating game, so it is decoupled from code and done in stages.

1. **Rectangles first.** Build and playtest milestones 1–4 with labeled colored rectangles.
2. **Buy the cat sprite pack** (itch.io, roughly $0–15) before generating any props. Its resolution and palette become the game's style.
3. **Claude Code generates props as code:** each sprite is a palette-indexed pixel grid in a source file, and a script renders all grids to PNGs. Generated PNGs are never edited by hand; the grid is the source of truth.
4. **Asa reviews every sprite.** Expect 3–4 feedback rounds per item.
5. **Optional:** touch up weak sprites in Aseprite (about $20).

Style rules: one shared palette file, one outline color, light from the top-left, integer scaling only, no smoothing. Never mix Claude-made props with a pack in a different style.

Visibility rule: a rug must stay visible under furniture (e.g. its edges or back show around a table's legs). With placeholder rectangles a table fully covers a rug; the art pass must fix that.

## Milestones

Decorating is built before cleaning because it is the core of the game; if it isn't fun, the rest doesn't matter. Each milestone ends with a phone playtest and a go/no-go question.

0. **Setup:** repo, Vite + Phaser + TypeScript, this file as CLAUDE.md, git, first deploy to a static host.
1. **Decorate sandbox:** one room grid, 10 rectangle items, drag to place, move, and remove, local save. *Test: is arranging things satisfying on its own?*
2. **Cat reactor:** tags, fixed preferences, scripted walk, reactions, happiness score. *Test: does the cat make you want to rearrange?*
3. **Cleaning phase:** 8–15 items before decorating, coin reward. *Test: does it feel like a warm-up or a chore?*
4. **Progression:** shop, unlocks, all 3 rooms, 25–30 items.
5. **Art pass:** bought cat sprite, Claude-made props in its palette.
6. **Feel pass:** sound effects, small animations, phone control tuning.

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

These need Asa's decision; the first two block the art pass, the third blocks milestone 1.

- [ ] Which cat sprite pack? It sets the palette and resolution for everything else.
- [ ] Prop size: 16×16 or 32×32 pixels?
- [x] Camera view: straight top-down (simplest) or a front-facing room view (prettier, harder)? → **Front-facing room view** (decided Oct 21, 2026).
- [ ] Does the cat have a name and personality, and should its preferences ever change?
- [x] Hosting: GitHub Pages or itch.io? → **GitHub Pages** (decided Oct 21, 2026). Every push to `main` deploys automatically.

## Project commands

- `npm run dev` — local dev server (add `-- --host` to open it from a phone on the same Wi-Fi)
- `npm run typecheck` — TypeScript check
- `npm test` — Vitest unit tests
- `npm run check` — typecheck + tests; must pass before any commit
- `npm run build` — production build into `dist/`

Layout: `src/scenes/` holds Phaser scenes; `src/logic/` holds Phaser-free game logic and its `*.test.ts` files.
