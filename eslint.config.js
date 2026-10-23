// Lint rules: ESLint's and typescript-eslint's recommended sets. Formatting is Prettier's job,
// so eslint-config-prettier turns off the rules that would fight it.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  // Claude Code hooks run in Node, not the browser.
  { files: [".claude/hooks/**/*.mjs"], languageOptions: { globals: { process: "readonly" } } },
  // The screenshot script runs in Node 24.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: Object.fromEntries(
        ["process", "console", "Buffer", "fetch", "WebSocket", "setTimeout", "clearTimeout"].map((name) => [name, "readonly"]),
      ),
    },
  },
  prettier,
);
