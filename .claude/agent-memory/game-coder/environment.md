---
name: environment
description: Windows environment quirks for running npm, the dev server, and reading files in this repo
metadata:
  type: reference
---

- Node isn't on PATH in PowerShell. Prefix commands with `$env:Path = "C:\Program Files\nodejs;$env:Path";`. Git Bash has no `npm` either, so run npm from PowerShell.
- The dev server's port changes between sessions (5173 or 5174 so far): use the port in the caller's note. Don't start or kill it unless asked.
- Never take line numbers from `cat -n` over several files at once: the numbering runs on across files. Read one file at a time when you need line numbers for an edit.
- Headless Edge screenshots against the dev server worked in 4a/4b for checking visuals, but they don't count as Asa's browser playtest.
- No Python on this machine (`python` opens the Store stub). For scripted multi-line edits from Git Bash, use `"/c/Program Files/nodejs/node" - <<'EOF'` and make the script throw when a search string isn't found exactly once: some files are CRLF, so a silent `String.replace` can miss.
- **For screenshots, use `npm run shots`** (scripts/shots.mjs). Its CDP client and Edge cleanup are a starting point for one-off measuring scripts.
- **Headless measuring works without extra deps:** spawn Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new --remote-debugging-port=N --user-data-dir=<scratch>`), drive it over CDP with Node 24's global `WebSocket`, and expose the actor with a temporary `window.__x = this`. For pixel evidence, `gl.readPixels` inside `game.events.on("postrender")`. Headless runs ~160–240fps, not 60; `game.loop.setFPSLimit(60)` (Phaser 4.2+) caps it for frame-cadence measurements. A temporary `window.__floorPoint = floorPoint` next to the actor hook lets a script call `walkTo` on chosen tiles. Killing the spawned parent leaves dozens of msedge children: stop them afterwards by filtering `Win32_Process` CommandLine on the scratch profile path (never kill Asa's own Edge).
- **TypeScript 7 has no compiler API.** `typescript` in package.json is an alias for `@typescript/typescript6` (for typescript-eslint), and `@typescript/native` is TS 7, which provides `tsc`. Don't "fix" the alias.
- **The pre-commit hook fires on any Bash/PowerShell command whose text contains `git commit`**, even an echo. It runs the full `npm run check` and blocks on failure. So a commit only goes through once check passes, and test strings shouldn't mention it casually.
- Claude Code hands hooks `CLAUDE_PROJECT_DIR` with a lower-case drive (`c:\…`). Vitest started from such a cwd loads twice and every suite fails with "reading 'config'". Use `realpathSync.native` on paths from Claude Code.
