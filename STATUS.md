# Status

## Oct 21, 2026 — Milestone 1: Decorate sandbox (built, awaiting playtest)

**Done**
- Front-facing bedroom: 12 columns, 3 wall rows above 3 floor rows, with an item tray below.
- 10 rectangle items in `src/data/items.ts`: 4 wall, 4 floor (table and stool have tops), 2 surface (candle, potion). One of each to start.
- Drag from the tray to place, drag to move, drag back to the tray to remove. A green/red highlight shows whether a drop fits; a refused drop snaps back.
- Surface items sit on furniture, move with it, and return to the tray with it.
- Local save (versioned). A broken or old save starts the room fresh.
- Grid, surface, and save logic in `src/logic/` with 48 unit tests; the game-wide checks pass.

**Not verified**
- Dragging has not been tried in a real browser yet: automated browser testing didn't work on this machine. The page loads and draws correctly. Asa's phone playtest is the first real drag test.

**Known limits (possible playtest feedback)**
- Rugs block furniture: a rug is a floor item, so nothing can stand on it.
- The tray doesn't scroll; it fits the 10 starter items only.
- On a phone in portrait the game is small; landscape is the intended view.
- No "reset room" button. To start over, drag everything back to the tray.

**Next**
- Asa playtests on a phone. Go/no-go question: *is arranging things satisfying on its own?*
- Fix whatever the playtest turns up, then milestone 2 (cat reactor).

## Oct 21, 2026 — Milestone 0: Setup

- Vite + Phaser 4 + TypeScript project, Vitest and typecheck scripts, CLAUDE.md, GitHub Pages auto-deploy.
- Phone playtest passed. Camera view decided: front-facing.
