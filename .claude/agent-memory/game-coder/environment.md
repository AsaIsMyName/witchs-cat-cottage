---
name: environment
description: Windows environment quirks for running npm, the dev server, and reading files in this repo
metadata:
  type: reference
---

- Node isn't on PATH in PowerShell. Prefix commands with `$env:Path = "C:\Program Files\nodejs;$env:Path";`. Git Bash has no `npm` either, so run npm from PowerShell.
- The dev server usually runs on port 5173 (`npm run dev`, http://localhost:5173). Don't start or kill it unless asked.
- Never take line numbers from `cat -n` over several files at once: the numbering runs on across files. Read one file at a time when you need line numbers for an edit.
- Headless Edge screenshots against the dev server worked in 4a/4b for checking visuals, but they don't count as Asa's browser playtest.
- No Python on this machine (`python` opens the Store stub). For scripted multi-line edits from Git Bash, use `"/c/Program Files/nodejs/node" - <<'EOF'` and make the script throw when a search string isn't found exactly once: some files are CRLF, so a silent `String.replace` can miss.
