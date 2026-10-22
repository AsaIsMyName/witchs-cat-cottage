# Status

## Oct 21, 2026 — Same-footprint swaps (awaiting playtest)

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
