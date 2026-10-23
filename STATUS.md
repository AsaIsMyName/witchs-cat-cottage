# Status

> **New session?** Read the top entries and the "Handoff" entry, then CLAUDE.md. Older entries are in `STATUS-archive.md`; read it only when you need history.

## Oct 23, 2026 — 4c: item names on hover, drop preview

**Done**
- **Hover name:** resting the mouse on an item, in the room or in the inventory, shows its name just above its drawn top. It hides when a drag starts. Touch has no hover, so nothing depends on it.
- **Drop preview:** while dragging, a see-through copy of the item (45% alpha) shows where it would land, at the snapped spot. The item itself still follows the pointer.
  - The preview shows for green, blue (swap) and amber (replace) drops. It is hidden over red (blocked), over the inventory, and over empty space for surface items.
  - It sorts among the room's items like a placed item, so it shows whether it lands in front of or behind things. Rug and wall previews sit under everything standing on the floor.
  - It's built once per drag. Each move only repositions it, so dragging does no extra work per move.
- All in `src/scenes/DecorateScene.ts`. No logic or save change.
- **Shots:** new `12-hover-name`. Drag shots now stop a few pixels off the snapped spot so the preview shows beside the item. I looked at 07–12:
  - `07`: a stool preview at the green spot.
  - `08`: no preview on red.
  - `09`: a frame preview in the clock's slot.
  - `10`: a potion preview over the candle.
  - `12`: "table" above the table.
  - The previews are faint in still frames, partly under the held item.

**Not verified**
- Not run in a real browser: drag feel, hover on a real mouse, and touch (a tap may briefly show the name).
- The other item in a swap and items riding on furniture have no preview, as planned.

**Re-test**
- Hover items in the room and the inventory: the name shows and hides cleanly, never during a drag.
- Drag each kind of item (floor, rug, wall, surface) around: the preview tracks the snapped spot with no lag, sorts in front of or behind furniture correctly, and vanishes over red spots and the inventory.

**Choices to confirm** (Asa, at the playtest)
- The hover name is built now, though placeholder rectangles still show their names. It matters after the art pass.
- Preview alpha is 45%.
- No preview for the other item in a swap. Its blue outline shows where it goes.

**Next**
- Asa playtests 4c.
- Codebase sweep by `code-reviewer-opus`.

## Oct 23, 2026 — Leaner workflow (Asa hit the usage limit)

**Done**
- STATUS.md now keeps only the current entries and the Handoff. Everything older is in `STATUS-archive.md`.
- The design-guardian agent became the `/design-check` skill (`.claude/skills/design-check/`), run inline on feature plans only.
- Agreed: both reviewers only for merges to `main`, one reviewer (Opus) for sweeps; small edits done directly rather than by `game-coder`; short agent reports; a fresh session after each playtest.

**Next**
- 4c (the item name on hover, a drop preview while dragging): coder plans → `/design-check` → coder builds and checks with `npm run shots`.
- Codebase sweep by `code-reviewer-opus` for redundant code and logic improvements; agreed fixes applied.
- Asa playtests 4c and the cleanup, then a fresh session.

## Oct 23, 2026 — `npm run shots` (handoff step 4, part B)

**Done**
- **`npm run shots`** (`scripts/shots.mjs`, plan approved by Asa, guardian verdict "fits"). No new dependencies. It starts its own Vite dev server on a free port, drives headless Edge over CDP (the Edge path is hard-coded for this PC), seeds each scene's save in localStorage, and writes 11 PNGs to the gitignored `shots/` (fixed names, overwritten each run). Viewport 960×540 at 1×. A failure (a timeout, a seed the game rejected, a page error) names the shot and exits 1. Afterwards it stops only the Edge processes using its own scratch profile.
- Shots: `01-empty-room`, `02-busy-room` (rug under the table with a candle, the cauldron, the stool, a shelf with a potion, frame, clock, moon chart), `03`–`06` the cat facing up/down/left/right, `07`–`10` mid-drag highlights (green free spot, red table over two items, blue frame-onto-clock swap, amber tray potion onto the candle), `11-cat-behind-table`.
- The seed rooms live in the script.
- **Dev-only hook** `window.__shots` (`src/scenes/dev-shots.ts`, installed in `DecorateScene.create()` only under `import.meta.env.DEV`). It exposes `pinCat(facing, col, row)`, `placed(uid)`, `tray(itemId)`, `tile(layer, col, row)`, and `settled()` (no tweens running).
- `CatActor.pin()` stops the cat's own decisions (next action, glances) and stands it on a tile. It ships in the build, unused (Asa's OK).
- **Leak check:** after `npm run build`, `__shots` and `pinCat` appear nowhere in `dist/`, so the static import is fine. `dist/` was deleted afterwards.
- All 11 shots were looked at and show what they should. The cat in `11` sticks out past the table's right end, and the table hides the rest.
- **New rule:** whoever finishes a visual task runs `npm run shots` and looks at the PNGs before Asa playtests. It's in CLAUDE.md's "Project commands" (the command only) and the coder's workflow memory.

**Not verified**
- Shots are headless Edge, not Asa's browser. They show still frames only: nothing about motion, timing, or drag feel.
- Works on this PC only (hard-coded Edge path, PowerShell cleanup).

**Next**
- Plan 4c.

## Oct 22, 2026 — 4b signed off; design-guardian agent added

**Done**
- **Milestone 4b is signed off.** Asa re-tested round 3: diagonal walks are fixed. Asa chose to review and merge 4b now, ahead of 4c (handoff steps 4 and 6 swapped for this batch).
- **Design-guardian agent** (`.claude/agents/design-guardian.md`, handoff step 4, part A, approved by Asa): a read-only Opus agent (Read, Grep, Glob only). It checks a plan before the coder starts, or a diff afterwards, against CLAUDE.md's intent and for engineering restraint. It reports a verdict (fits, concerns, or conflicts), at most 5 points citing CLAUDE.md, and questions for Asa.

- **Pre-merge review** of `e71641d..ca7ca39` by both reviewers: merge, no blockers. Four low findings, fixed in one commit (Asa's go):
  - `save.ts`: the v3 comment said 8 floor rows; it's 9 (8-row v3 saves still fit).
  - `package.json`: the description still described the old "tidy, then please the cat" design.
  - `npm run typecheck` runs TS 7's `tsc` by path, since `@typescript/old` (TS 6) also installs a `tsc` command and npm could link either on Linux.
  - CI: a newer push cancels an older run only on the feature branch; a `main` deploy always finishes.
- Players of the live site get a fresh default room once (v2 saves don't fit the new grid). Expected.
- **Merged to `main`** and pushed on Asa's go.

**Not verified**
- The guardian agent now registers by name (the session restarted), but it hasn't been used yet.
- CI's first run passed on both branches: `main` deployed in 40 s; the feature branch ran the check only.

**Next**
- Handoff step 4, part B: `npm run shots` (approved: headless Edge, its own Vite server, seeded saves, a dev-only hook that pauses the cat and sets its facing, PNGs in a gitignored `shots/`). The guardian checks the coder's plan first.
- Then 4c.

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
