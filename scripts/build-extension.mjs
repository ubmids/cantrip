// Builds the Chrome extension into dist/extension:
// the side panel as a normal page, the service worker and the content script as single classic files.
import { build } from "vite";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve("dist/extension");
const common = { configFile: false, logLevel: "warn", envDir: process.cwd() };

await build({
  ...common,
  base: "./",
  build: { outDir: out, emptyOutDir: true, target: "es2022", rollupOptions: { input: resolve("sidepanel.html") } },
});

for (const name of ["background", "content"]) {
  await build({
    ...common,
    build: {
      outDir: out,
      emptyOutDir: false,
      target: "es2022",
      lib: { entry: resolve(`src/extension/${name}.ts`), formats: ["iife"], name: `cantrip_${name}`, fileName: () => `${name}.js` },
    },
  });
}

mkdirSync(out, { recursive: true });
cpSync("extension/manifest.json", `${out}/manifest.json`);
cpSync("extension/icon-128.png", `${out}/icon-128.png`);
console.log("Built the extension in dist/extension. Load it at chrome://extensions with Developer mode on.");
