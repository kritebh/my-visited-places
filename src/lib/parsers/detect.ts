import type { NormalizedVisit, Source } from "../types";
import {
  parseCommuteRoutes,
  parseGeocodeContribution,
  parseLabelledPlaces,
  parsePhotoSidecar,
  parseReviews,
  parseSuggestedEdit,
} from "./takeoutMaps";
import {
  parseIosTimeline,
  parseRecords,
  parseSemanticLocationHistory,
  parseSemanticSegments,
} from "./timeline";
import { salvageTruncatedJson } from "./salvage";
import { basename, type InputFile } from "./util";

export interface ParseResult {
  visits: NormalizedVisit[];
  counts: Partial<Record<Source, number>>;
  filesRead: number;
  filesUsed: number;
  errors: { path: string; message: string }[];
  /** Files that were cut off but partly recovered. */
  truncated: string[];
}

/** Picks a parser by path first, then by JSON shape. */
function parseOne(path: string, json: unknown): NormalizedVisit[] | null {
  const p = path.replace(/\\/g, "/");
  const name = basename(p);
  const j = json as Record<string, unknown>;

  if (name === "Reviews.json") return parseReviews(j);
  if (name === "Labelled places.json") return parseLabelledPlaces(j);
  if (name === "Commute routes.json") return parseCommuteRoutes(j);
  if (p.includes("/Suggested edits to business establishments/")) return parseSuggestedEdit(j, p);
  if (p.includes("/Geocode contributions/")) return parseGeocodeContribution(j, p);
  if (p.includes("Maps/Photos and videos/")) return parsePhotoSidecar(j, "photo");

  if (Array.isArray(json)) {
    return json.some((x) => x && typeof x === "object" && ("visit" in x || "timelinePath" in x))
      ? parseIosTimeline(json)
      : null;
  }
  if (!j || typeof j !== "object") return null;
  if ("semanticSegments" in j) return parseSemanticSegments(j);
  if ("timelineObjects" in j) return parseSemanticLocationHistory(j);
  if ("locations" in j && Array.isArray(j.locations)) return parseRecords(j);
  if (("geoData" in j || "geoDataExif" in j) && ("photoTakenTime" in j || "creationTime" in j)) {
    return parsePhotoSidecar(j, "gphotos");
  }
  return null;
}

export function parseFiles(files: InputFile[]): ParseResult {
  const result: ParseResult = { visits: [], counts: {}, filesRead: 0, filesUsed: 0, errors: [], truncated: [] };
  for (const f of files) {
    if (!f.path.toLowerCase().endsWith(".json")) continue;
    result.filesRead++;
    if (!f.text.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(f.text);
    } catch (e) {
      json = salvageTruncatedJson(f.text);
      if (json === undefined) {
        result.errors.push({ path: f.path, message: (e as Error).message });
        continue;
      }
      result.truncated.push(f.path);
    }
    const visits = parseOne(f.path, json);
    if (!visits) continue;
    result.filesUsed++;
    for (const v of visits) {
      result.visits.push(v);
      result.counts[v.source] = (result.counts[v.source] ?? 0) + 1;
    }
  }
  return result;
}

/** Cheap filter so we never read photos/videos or unrelated files out of a zip. */
export function isCandidatePath(path: string): boolean {
  return path.toLowerCase().endsWith(".json") && !basename(path).startsWith("._");
}
