import "server-only";
import type { Types } from "mongoose";
import { DeletedVisit } from "@/models/DeletedVisit";
import { Visit } from "@/models/Visit";

/** Two Timeline records are the same stay if they overlap in time (± this slack)… */
export const STAY_SLACK_MS = 15 * 60_000;
/** …and are this close together. */
export const STAY_RADIUS_M = 200;
// Longest stay we look back for when finding overlaps (a visit that started earlier)
const LOOKBACK_MS = 2 * 86_400_000;

export interface Stay {
  lng: number;
  lat: number;
  start: number;
  end: number;
  /** Google place ID when the export has one. */
  placeId?: string;
  /** Stored visit id, so a merged stay can be extended. Absent for tombstones. */
  id?: string;
}

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function sameStay(a: Stay, b: Stay) {
  // Different known places (two shops next door) are never the same stay
  if (a.placeId && b.placeId && a.placeId !== b.placeId) return false;
  return a.start - STAY_SLACK_MS <= b.end && b.start - STAY_SLACK_MS <= a.end && metersBetween(a, b) <= STAY_RADIUS_M;
}

/** Time-sorted pool of known stays with a windowed overlap lookup. */
export class StayIndex {
  private stays: Stay[];
  constructor(stays: Stay[]) {
    this.stays = stays.sort((a, b) => a.start - b.start);
  }
  has(s: Stay) {
    return !!this.find(s);
  }
  find(s: Stay): Stay | undefined {
    // Binary search for the first stay that could still overlap
    let lo = 0;
    let hi = this.stays.length;
    const from = s.start - LOOKBACK_MS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.stays[mid].start < from) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < this.stays.length && this.stays[i].start <= s.end + STAY_SLACK_MS; i++) {
      if (sameStay(this.stays[i], s)) return this.stays[i];
    }
    return undefined;
  }
  add(s: Stay) {
    let i = this.stays.length;
    while (i > 0 && this.stays[i - 1].start > s.start) i--;
    this.stays.splice(i, 0, s);
  }
}

/** Merges the batch's time windows into a few padded ranges for one indexed query. */
export function timeRanges(stays: Stay[]): [Date, Date][] {
  const sorted = [...stays].sort((a, b) => a.start - b.start);
  const ranges: [number, number][] = [];
  for (const s of sorted) {
    const from = s.start - LOOKBACK_MS;
    const to = s.end + STAY_SLACK_MS;
    const last = ranges[ranges.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else ranges.push([from, to]);
  }
  return ranges.map(([a, b]) => [new Date(a), new Date(b)]);
}

type StayDoc = {
  _id?: unknown;
  location?: { coordinates?: number[] } | null;
  visitedAt?: Date | null;
  endAt?: Date | null;
  meta?: { placeId?: unknown } | null;
};

function toStay(d: StayDoc, live: boolean): Stay | null {
  const [lng, lat] = d.location?.coordinates ?? [];
  if (lng === undefined || lat === undefined || !d.visitedAt) return null;
  const start = d.visitedAt.getTime();
  const placeId = typeof d.meta?.placeId === "string" ? d.meta.placeId : undefined;
  return { lng, lat, start, end: Math.max(start, d.endAt?.getTime() ?? start), placeId, id: live ? String(d._id) : undefined };
}

/** Existing Timeline visits and deleted Timeline visits near the batch's times. */
export async function loadKnownStays(userId: Types.ObjectId, batch: Stay[]): Promise<StayIndex> {
  if (!batch.length) return new StayIndex([]);
  const ranges = timeRanges(batch).map(([from, to]) => ({ visitedAt: { $gte: from, $lte: to } }));
  const filter = { userId, source: "timeline" as const, $or: ranges };
  const projection = { location: 1, visitedAt: 1, endAt: 1, "meta.placeId": 1 };
  const [live, deleted] = await Promise.all([
    Visit.find(filter, projection).lean<StayDoc[]>(),
    DeletedVisit.find(filter, projection).lean<StayDoc[]>(),
  ]);
  const stays = [...live.map((d) => toStay(d, true)), ...deleted.map((d) => toStay(d, false))];
  return new StayIndex(stays.filter((s): s is Stay => !!s));
}
