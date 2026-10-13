import type { NormalizedVisit } from "../types";

export interface InputFile {
  /** Path inside the export, e.g. "Takeout/Maps/My labelled places/Labelled places.json" */
  path: string;
  text: string;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function fromE7(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n / 1e7 : undefined;
}

/** Parses "12.9716°, 77.5946°", "geo:12.97,77.59" or "12.97,77.59". */
export function parseLatLngString(s: unknown): { lat: number; lng: number } | undefined {
  if (typeof s !== "string") return undefined;
  const m = s.replace(/^geo:/, "").match(/(-?\d+(?:\.\d+)?)\s*°?\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return isValidCoord(lat, lng) ? { lat, lng } : undefined;
}

export function toIso(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  let d: Date;
  if (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v))) {
    const n = Number(v);
    // Seconds vs milliseconds
    d = new Date(n < 1e11 ? n * 1000 : n);
  } else if (typeof v === "string") {
    d = new Date(v);
  } else {
    return undefined;
  }
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Epoch-ms timestamp from a Takeout file name like "1516339873564.json". */
export function timestampFromFilename(path: string): string | undefined {
  const m = basename(path).match(/^(\d{10,13})\.json$/);
  return m ? toIso(m[1]) : undefined;
}

export function visit(v: NormalizedVisit): NormalizedVisit | null {
  if (!isValidCoord(v.lat, v.lng)) return null;
  const clean: NormalizedVisit = { ...v, lat: round(v.lat, 6), lng: round(v.lng, 6) };
  for (const k of Object.keys(clean) as (keyof NormalizedVisit)[]) {
    if (clean[k] === undefined || clean[k] === "") delete clean[k];
  }
  return clean;
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((x): x is T => x != null);
}
