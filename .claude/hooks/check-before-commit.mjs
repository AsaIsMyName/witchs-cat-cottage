// Claude Code PreToolUse hook: blocks a `git commit` (from Bash or PowerShell) when `npm run check`
// fails. Every other command passes straight through with no output.
// It runs npm through this same node, so it works even where npm isn't on PATH (e.g. Git Bash).
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const input = await new Promise((done) => {
  let text = "";
  process.stdin.on("data", (chunk) => (text += chunk));
  process.stdin.on("end", () => done(text));
});

let command = "";
try {
  command = JSON.parse(input).tool_input?.command ?? "";
} catch {
  process.exit(0); // not a tool call we understand: never get in the way
}

// `git commit`, also after `git -C dir` / `git -c key=value`, anywhere in a chained command.
if (!/\bgit(?:\s+-[Cc]\s+\S+)*\s+commit\b/.test(command)) process.exit(0);

// The real path: Claude Code may pass the project as "c:\..." on Windows, and Vitest run from a
// lower-case drive letter loads itself twice and every test file fails.
const project = realpathSync.native(process.env.CLAUDE_PROJECT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
const nodeDir = dirname(process.execPath);
const npmCli = join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");
const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
const env = { ...process.env, [pathKey]: `${nodeDir}${process.platform === "win32" ? ";" : ":"}${process.env[pathKey] ?? ""}` };

const run = spawnSync(process.execPath, [npmCli, "run", "check"], { cwd: project, env, encoding: "utf8" });
if (run.status === 0) process.exit(0);

const output = `${run.stdout ?? ""}${run.stderr ?? ""}${run.error ? String(run.error) : ""}`;
process.stderr.write(`Commit blocked: \`npm run check\` failed. Fix it, then commit again.\n\n${output.slice(-4000)}`);
process.exit(2);
