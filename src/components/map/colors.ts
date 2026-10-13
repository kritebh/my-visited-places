import type { ExpressionSpecification } from "maplibre-gl";

/** Visit-count buckets for region heat colours. */
export const BUCKETS = [
  { min: 1, label: "1–2" },
  { min: 3, label: "3–5" },
  { min: 6, label: "6–14" },
  { min: 15, label: "15–39" },
  { min: 40, label: "40+" },
];

// Single-hue blue sequential ramp; dark mode steps run the other way so more
// visits always read as "more ink" against the surface.
// Stops short of the darkest steps so heavy regions stay calm, not harsh.
export const RAMP = {
  light: ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"],
  dark: ["#184f95", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef"],
};

export const UNVISITED = { light: "#ecebe6", dark: "#262624" };
export const OUTLINE = { light: "#ffffff", dark: "#0d0d0d" };
export const BORDER = { light: "#a8a69f", dark: "#5c5b57" };
export const POINT = { light: "#eb6834", dark: "#e0703f" };
export const SELECTED = { light: "#0b0b0b", dark: "#f0efec" };
export const GLOW = { light: "#2a78d6", dark: "#5598e7" };

export function fillColor(scheme: "light" | "dark"): ExpressionSpecification {
  const visits: ExpressionSpecification = ["coalesce", ["feature-state", "visits"], 0];
  const r = RAMP[scheme];
  return [
    "case",
    [">", visits, 0],
    ["step", visits, r[0], BUCKETS[1].min, r[1], BUCKETS[2].min, r[2], BUCKETS[3].min, r[3], BUCKETS[4].min, r[4]],
    UNVISITED[scheme],
  ];
}
