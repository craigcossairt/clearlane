import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@contracts": here("./contracts"),
      "@engine": here("./engine/src"),
    },
  },
  test: {
    include: ["engine/test/**/*.test.ts", "app/src/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
    environment: "node",
  },
});
