/* eslint-disable @typescript-eslint/no-explicit-any -- export JSON is untyped */
import type { NormalizedVisit } from "../types";
import { compact, fromE7, parseLatLngString, toIso, visit } from "./util";

const label = (semanticType?: string) =>
  semanticType && !/UNKNOWN|SEARCHED_ADDRESS/i.test(semanticType)
    ? semanticType.replace(/^TYPE_/, "").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
    : undefined;

/** Android on-device Timeline export (`Timeline.json` with `semanticSegments`). */
export function parseSemanticSegments(json: any): NormalizedVisit[] {
  return compact(
    (json?.semanticSegments ?? []).map((seg: any) => {
      const cand = seg?.visit?.topCandidate;
      if (!cand) return null;
      const ll = parseLatLngString(cand.placeLocation?.latLng ?? cand.placeLocation);
      if (!ll) return null;
      return visit({
        source: "timeline",
        ...ll,
        visitedAt: toIso(seg.startTime),
        endAt: toIso(seg.endTime),
        name: label(cand.semanticType),
        meta: cand.placeId ? { placeId: cand.placeId } : undefined,
      });
    }),
  );
}

/** iOS Timeline export: top-level array of `{ startTime, endTime, visit | activity | timelinePath }`. */
export function parseIosTimeline(json: any[]): NormalizedVisit[] {
  return compact(
    json.map((item: any) => {
      const cand = item?.visit?.topCandidate;
      if (!cand) return null;
      const ll = parseLatLngString(cand.placeLocation);
      if (!ll) return null;
      return visit({
        source: "timeline",
        ...ll,
        visitedAt: toIso(item.startTime),
        endAt: toIso(item.endTime),
        name: label(cand.semanticType),
        meta: cand.placeID ? { placeId: cand.placeID } : undefined,
      });
    }),
  );
}

/** Legacy Takeout `Semantic Location History/YYYY/YYYY_MONTH.json`. */
export function parseSemanticLocationHistory(json: any): NormalizedVisit[] {
  return compact(
    (json?.timelineObjects ?? []).map((obj: any) => {
      const pv = obj?.placeVisit;
      if (!pv) return null;
      const loc = pv.location ?? {};
      const d = pv.duration ?? {};
      return visit({
        source: "timeline",
        lat: fromE7(loc.latitudeE7)!,
        lng: fromE7(loc.longitudeE7)!,
        visitedAt: toIso(d.startTimestamp ?? d.startTimestampMs),
        endAt: toIso(d.endTimestamp ?? d.endTimestampMs),
        name: loc.name ?? label(loc.semanticType),
        address: loc.address,
        meta: loc.placeId ? { placeId: loc.placeId } : undefined,
      });
    }),
  );
}

/**
 * Legacy raw `Records.json` (`locations[]`). These can hold millions of
 * points, so collapse them to one visit per ~5km cell per day.
 */
export function parseRecords(json: any): NormalizedVisit[] {
  const seen = new Map<string, NormalizedVisit>();
  for (const r of json?.locations ?? []) {
    const lat = fromE7(r?.latitudeE7);
    const lng = fromE7(r?.longitudeE7);
    const at = toIso(r?.timestamp ?? r?.timestampMs);
    if (lat === undefined || lng === undefined || !at) continue;
    const key = `${at.slice(0, 10)}:${Math.round(lat * 20)}:${Math.round(lng * 20)}`;
    if (seen.has(key)) continue;
    const v = visit({ source: "timeline", lat, lng, visitedAt: at, meta: { raw: true } });
    if (v) seen.set(key, v);
  }
  return [...seen.values()];
}
