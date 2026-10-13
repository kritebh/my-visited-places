import "server-only";
import fs from "node:fs";
import path from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

type Props = { code: string; name: string; country?: string; continent?: string };
type Shape = Feature<Polygon | MultiPolygon, Props> & { box: [number, number, number, number] };

export interface RegionMatch {
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
}

const GEO_DIR = path.join(process.cwd(), "data", "geo");

let index: { countries: Shape[]; india: Shape[]; admin1ByCountry: Map<string, Shape[]> } | null = null;

function load(file: string): Shape[] {
  const fc = JSON.parse(fs.readFileSync(path.join(GEO_DIR, file), "utf8")) as FeatureCollection<
    Polygon | MultiPolygon,
    Props
  >;
  return fc.features
    .filter((f) => f.geometry)
    .map((f) => ({ ...f, box: bbox(f) as [number, number, number, number] }));
}

function getIndex() {
  if (!index) {
    const admin1ByCountry = new Map<string, Shape[]>();
    for (const s of load("admin1.json")) {
      const c = s.properties.country!;
      if (!admin1ByCountry.has(c)) admin1ByCountry.set(c, []);
      admin1ByCountry.get(c)!.push(s);
    }
    index = { countries: load("countries.json"), india: load("india-states.json"), admin1ByCountry };
  }
  return index;
}

function find(shapes: Shape[], lng: number, lat: number): Shape | undefined {
  for (const s of shapes) {
    const [minX, minY, maxX, maxY] = s.box;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (booleanPointInPolygon([lng, lat], s)) return s;
  }
  return undefined;
}

// ~0.2° rings (≈ 20–25 km) for points just offshore or on simplified coastlines
const NUDGES: [number, number][] = [
  [0, 0],
  ...[0.05, 0.1, 0.2].flatMap((d) => [
    [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [d, -d], [-d, d], [-d, -d],
  ] as [number, number][]),
];

function findNear(shapes: Shape[], lng: number, lat: number): Shape | undefined {
  for (const [dx, dy] of NUDGES) {
    const hit = find(shapes, lng + dx, lat + dy);
    if (hit) return hit;
  }
  return undefined;
}

// People revisit the same spots (home, office), so memoise lookups on an ~11 m
// grid. Bounded so a long-running server can't grow it without limit.
const memo = new Map<string, RegionMatch>();
const MEMO_MAX = 100_000;

export function assignRegion(lat: number, lng: number): RegionMatch {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = memo.get(key);
  if (hit) return { ...hit };
  const match = lookupRegion(lat, lng);
  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(key, match);
  return { ...match };
}

function lookupRegion(lat: number, lng: number): RegionMatch {
  const { countries, india, admin1ByCountry } = getIndex();

  // India's state polygons define its territory precisely; check them first.
  const inState = find(india, lng, lat);
  if (inState) {
    return { countryCode: "IN", countryName: "India", stateCode: inState.properties.code, stateName: inState.properties.name };
  }

  const country = findNear(countries, lng, lat);
  if (!country) return {};
  const countryCode = country.properties.code;
  const match: RegionMatch = { countryCode, countryName: country.properties.name };

  const states = countryCode === "IN" ? india : admin1ByCountry.get(countryCode);
  const state = states && findNear(states, lng, lat);
  if (state) {
    match.stateCode = state.properties.code;
    match.stateName = state.properties.name;
  }
  return match;
}

/** Admin-1 features for the given (non-India) countries, for map rendering. */
export function admin1For(countryCodes: string[]): FeatureCollection {
  const { admin1ByCountry } = getIndex();
  const features = countryCodes
    .filter((c) => c !== "IN")
    .flatMap((c) => admin1ByCountry.get(c) ?? [])
    .map((s) => ({ type: s.type, geometry: s.geometry, properties: s.properties }));
  return { type: "FeatureCollection", features };
}
