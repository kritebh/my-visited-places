// MapLibre v6 locates its web worker relative to its own module URL, which
// breaks once bundled. Serve the worker from /public and point setWorkerUrl at it.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
fs.copyFileSync(
  path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
  path.join(root, "public/maplibre-gl-worker.mjs"),
);
