import { defineConfig } from "vite";

// The web app. The Chrome extension has its own config (vite.extension.config.ts).
export default defineConfig({
  build: { outDir: "dist/web", target: "es2022" },
});
