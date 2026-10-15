import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(resolve("public"), { recursive: true });
copyFileSync(
  resolve("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
  resolve("public/maplibre-gl-worker.mjs"),
);
copyFileSync(
  resolve("node_modules/maplibre-gl/LICENSE.txt"),
  resolve("public/maplibre-LICENSE.txt"),
);
