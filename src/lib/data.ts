import "server-only";
import { createHash } from "node:crypto";
import { Types, type PipelineStage } from "mongoose";
import { cacheLife } from "next/cache";
import { auth } from "@/auth";
import { connectDB } from "./db";
import { User } from "@/models/User";
import { Visit } from "@/models/Visit";
import type { NormalizedVisit, RegionsResponse, StatsResponse, VisitDTO, VisitFilters } from "./types";

export const INDIA_STATES_TOTAL = 36;

export interface Viewer {
  userId: Types.ObjectId;
  /** User.dataVersion, so cached reads are keyed to the latest data. */
  version: number;
  /** Public profile viewers can't see review text unless the owner opted in. */
  isOwner: boolean;
  showReviews: boolean;
}

/**
 * The signed-in user, or a public profile when `?slug=` is passed.
 * Returns null when neither applies.
 */
export async function resolveViewer(req: Request): Promise<Viewer | null> {
  // Read the request first: it marks GET handlers as dynamic, so the build
  // doesn't try to prerender them (and connect to MongoDB) without a request
  const slug = new URL(req.url).searchParams.get("slug");
  await connectDB();
  if (slug) {
    const user = await User.findOne({ publicSlug: slug, isPublic: true }, { shareReviews: 1, dataVersion: 1 }).lean();
    if (!user) return null;
    return { userId: user._id as Types.ObjectId, version: user.dataVersion ?? 0, isOwner: false, showReviews: !!user.shareReviews };
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = new Types.ObjectId(session.user.id);
  const user = await User.findById(userId, { dataVersion: 1 }).lean();
  return { userId, version: user?.dataVersion ?? 0, isOwner: true, showReviews: true };
}

export async function requireUserId(): Promise<Types.ObjectId | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  await connectDB();
  return new Types.ObjectId(session.user.id);
}

export function filtersFromUrl(url: string): VisitFilters {
  const p = new URL(url).searchParams;
  const year = Number(p.get("year"));
  return {
    year: Number.isInteger(year) && year > 1900 ? year : undefined,
    country: p.get("country") || undefined,
    state: p.get("state") || undefined,
  };
}

function match(userId: Types.ObjectId, f: VisitFilters) {
  const m: Record<string, unknown> = { userId };
  if (f.year) m.visitedAt = { $gte: new Date(Date.UTC(f.year, 0, 1)), $lt: new Date(Date.UTC(f.year + 1, 0, 1)) };
  if (f.country) m.countryCode = f.country;
  if (f.state) m.stateCode = f.state;
  return m;
}

// Places = distinct ~100m cells, so repeated visits to one spot count once.
const PLACE_KEY = {
  $concat: [
    { $toString: { $round: [{ $arrayElemAt: ["$location.coordinates", 1] }, 3] } },
    ",",
    { $toString: { $round: [{ $arrayElemAt: ["$location.coordinates", 0] }, 3] } },
  ],
};

/** Calendar day used to count visits; set DAY_TIMEZONE for a non-Indian audience. */
const DAY_TZ = process.env.DAY_TIMEZONE ?? "Asia/Kolkata";
const DAY = { $ifNull: [{ $dateToString: { format: "%Y-%m-%d", date: "$visitedAt", timezone: DAY_TZ } }, "undated"] };

/*
 * A "visit" is a distinct place-day: a Timeline stay, three photos and a review
 * at the same spot on the same day count once. Undated items count once per
 * place. bySource still reports raw records.
 */

export async function getRegions(userId: Types.ObjectId, f: VisitFilters): Promise<RegionsResponse> {
  const base = match(userId, f);
  const group = (by: Record<string, string>, field: string): PipelineStage[] => [
    { $match: { ...base, [field]: { $exists: true, $ne: null } } },
    { $group: { _id: { ...by, cell: PLACE_KEY, day: DAY } } },
    {
      $group: {
        _id: Object.fromEntries(Object.keys(by).map((k) => [k, `$_id.${k}`])),
        visits: { $sum: 1 },
        places: { $addToSet: "$_id.cell" },
      },
    },
    { $project: { _id: 0, code: "$_id.code", name: "$_id.name", country: "$_id.country", visits: 1, places: { $size: "$places" } } },
    { $sort: { visits: -1 } },
  ];
  const [countries, states] = await Promise.all([
    Visit.aggregate(group({ code: "$countryCode", name: "$countryName" }, "countryCode")),
    Visit.aggregate(group({ code: "$stateCode", name: "$stateName", country: "$countryCode" }, "stateCode")),
  ]);
  return { countries, states };
}

export async function getStats(userId: Types.ObjectId, f: VisitFilters): Promise<StatsResponse> {
  const base = match(userId, f);
  const [summary] = await Visit.aggregate([
    { $match: base },
    { $addFields: { cell: PLACE_KEY, day: DAY } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              places: { $addToSet: "$cell" },
              countries: { $addToSet: "$countryCode" },
              firstVisit: { $min: "$visitedAt" },
              lastVisit: { $max: "$visitedAt" },
              undated: { $sum: { $cond: [{ $ifNull: ["$visitedAt", false] }, 0, 1] } },
            },
          },
        ],
        placeDays: [{ $group: { _id: { cell: "$cell", day: "$day" } } }, { $count: "n" }],
        indiaStates: [{ $match: { countryCode: "IN", stateCode: { $ne: null } } }, { $group: { _id: "$stateCode" } }],
        bySource: [{ $group: { _id: "$source", visits: { $sum: 1 } } }, { $sort: { visits: -1 } }],
        topStates: [
          { $match: { stateCode: { $ne: null } } },
          { $group: { _id: { code: "$stateCode", name: "$stateName", country: "$countryCode", cell: "$cell", day: "$day" } } },
          {
            $group: {
              _id: { code: "$_id.code", name: "$_id.name", country: "$_id.country" },
              visits: { $sum: 1 },
              places: { $addToSet: "$_id.cell" },
            },
          },
          { $sort: { visits: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);
  // Year breakdown ignores the year filter so the dropdown/chart always show every year.
  const byYear = await Visit.aggregate<{ _id: number; visits: number }>([
    { $match: { ...match(userId, { ...f, year: undefined }), visitedAt: { $ne: null } } },
    { $group: { _id: { year: { $year: "$visitedAt" }, cell: PLACE_KEY, day: DAY } } },
    { $group: { _id: "$_id.year", visits: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const t = summary.totals[0];
  return {
    totalVisits: summary.placeDays[0]?.n ?? 0,
    places: t?.places.length ?? 0,
    countries: (t?.countries ?? []).filter(Boolean).length,
    indiaStates: summary.indiaStates.length,
    indiaStatesTotal: INDIA_STATES_TOTAL,
    undated: t?.undated ?? 0,
    firstVisit: t?.firstVisit?.toISOString(),
    lastVisit: t?.lastVisit?.toISOString(),
    byYear: byYear.map((y) => ({ year: y._id, visits: y.visits })),
    bySource: summary.bySource.map((s: { _id: string; visits: number }) => ({ source: s._id, visits: s.visits })),
    topStates: summary.topStates.map((s: { _id: { code: string; name: string; country: string }; visits: number; places: string[] }) => ({
      ...s._id,
      visits: s.visits,
      places: s.places.length,
    })),
    years: byYear.map((y) => y._id),
  };
}

/*
 * Per-user read cache. Map, stats and points are keyed by the user's
 * dataVersion, which every write bumps (invalidateVisits), so repeat views and
 * public-profile traffic skip the aggregations while a fresh import shows up on
 * the very next request. (revalidateTag applies asynchronously, so a reload
 * straight after an import could still see the old numbers.)
 */
export async function invalidateVisits(userId: Types.ObjectId | string) {
  // Driver-level write: a model compiled before this field existed (dev hot
  // reload) would otherwise drop the $inc under strict mode.
  await User.collection.updateOne({ _id: new Types.ObjectId(String(userId)) }, { $inc: { dataVersion: 1 } });
}

export async function regionsFor(userId: string, version: number, f: VisitFilters) {
  "use cache";
  cacheLife("hours");
  void version; // cache key only
  await connectDB();
  return getRegions(new Types.ObjectId(userId), f);
}

export async function statsFor(userId: string, version: number, f: VisitFilters) {
  "use cache";
  cacheLife("hours");
  void version;
  await connectDB();
  return getStats(new Types.ObjectId(userId), f);
}

export async function pointsFor(userId: string, version: number, f: VisitFilters) {
  "use cache";
  cacheLife("hours");
  void version;
  await connectDB();
  return getPoints(new Types.ObjectId(userId), f);
}

type LeanVisit = {
  _id: Types.ObjectId | unknown;
  location?: { coordinates: number[] } | null;
  visitedAt?: Date | null;
  endAt?: Date | null;
  [k: string]: unknown;
};

/** Coverage numbers only: public profiles never expose dates or sources. */
export function publicStats(s: StatsResponse): StatsResponse {
  return {
    ...s,
    undated: 0,
    firstVisit: undefined,
    lastVisit: undefined,
    byYear: [],
    bySource: [],
    years: [],
  };
}

export function toDTO(v: LeanVisit, showReviews = true): VisitDTO {
  const [lng, lat] = v.location?.coordinates ?? [0, 0];
  return {
    id: String(v._id),
    source: v.source as VisitDTO["source"],
    lat,
    lng,
    visitedAt: v.visitedAt?.toISOString(),
    endAt: v.endAt?.toISOString(),
    name: v.name as string | undefined,
    address: v.address as string | undefined,
    rating: v.rating as number | undefined,
    reviewText: showReviews ? (v.reviewText as string | undefined) : undefined,
    mapsUrl: v.mapsUrl as string | undefined,
    countryCode: v.countryCode as string | undefined,
    countryName: v.countryName as string | undefined,
    stateCode: v.stateCode as string | undefined,
    stateName: v.stateName as string | undefined,
    meta: v.meta as VisitDTO["meta"],
  };
}

export async function listVisits(
  viewer: Viewer,
  f: VisitFilters,
  opts: { limit?: number; before?: string; q?: string } = {},
): Promise<VisitDTO[]> {
  const m = match(viewer.userId, f);
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    m.$or = [{ name: rx }, { address: rx }, { stateName: rx }, { countryName: rx }];
  }
  const docs = await Visit.find(m)
    .sort({ visitedAt: -1, _id: -1 })
    .skip(Number(opts.before) || 0)
    .limit(Math.min(opts.limit ?? 200, 1000))
    .lean<LeanVisit[]>();
  return docs.map((d) => toDTO(d, viewer.showReviews));
}

/** Minimal GeoJSON for clustered map points. */
export async function getPoints(userId: Types.ObjectId, f: VisitFilters) {
  const docs = await Visit.find(match(userId, f), { location: 1, name: 1, source: 1, visitedAt: 1 })
    .sort({ visitedAt: -1 })
    .limit(20000)
    .lean<LeanVisit[]>();
  return {
    type: "FeatureCollection" as const,
    features: docs.map((d) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: d.location?.coordinates ?? [0, 0] },
      properties: { id: String(d._id), name: (d.name as string) ?? "", source: d.source as string, date: d.visitedAt?.toISOString() ?? "" },
    })),
  };
}

/** Same place + time + name from the same source counts once, so re-imports are no-ops. */
export function dedupeKey(v: Pick<NormalizedVisit, "source" | "lat" | "lng" | "visitedAt" | "name">) {
  const minute = v.visitedAt ? v.visitedAt.slice(0, 16) : "undated";
  return createHash("sha1")
    .update(`${v.source}|${v.lat.toFixed(4)}|${v.lng.toFixed(4)}|${minute}|${v.name ?? ""}`)
    .digest("hex");
}
