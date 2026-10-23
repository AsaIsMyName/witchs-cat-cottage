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
  prettier,
);
