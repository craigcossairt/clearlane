import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The stage app lives in app/; public/ (data and derived JSON) is served at the site root.
export default defineConfig({
  root: here("./app"),
  publicDir: here("./public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@contracts": here("./contracts"),
      "@engine": here("./engine/src"),
    },
  },
  build: { outDir: here("./dist"), emptyOutDir: true },
});
