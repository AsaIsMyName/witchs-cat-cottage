import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the build works from a GitHub Pages subpath (/witchs-cat-cottage/).
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
