import { isValidObjectId, Types, type AnyBulkWriteOperation } from "mongoose";
import { z } from "zod";
import { dedupeKey, invalidateVisits, requireUserId } from "@/lib/data";
import { loadKnownStays, type Stay } from "@/lib/dedupe";
import { assignRegion } from "@/lib/geo/regions";
import { SOURCES } from "@/lib/types";
import { DeletedVisit } from "@/models/DeletedVisit";
import { ImportJob } from "@/models/ImportJob";
import { Visit } from "@/models/Visit";

const visitSchema = z.object({
  source: z.enum(SOURCES).exclude(["manual"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  visitedAt: z.string().optional(),
  endAt: z.string().optional(),
  name: z.string().max(300).optional(),
  address: z.string().max(1000).optional(),
  rating: z.number().optional(),
  reviewText: z.string().max(10000).optional(),
  mapsUrl: z.string().max(2000).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const bodySchema = z.object({
  jobId: z.string().optional(),
  fileName: z.string().max(300).optional(),
  counts: z.record(z.string(), z.number()).optional(),
  visits: z.array(visitSchema).max(1000),
});

/**
 * Receives one batch of parsed visits. The client sends the first batch without
 * a jobId and passes the returned jobId with the rest.
 *
 * Each visit is dropped if it is (in order): already imported (same dedupeKey),
 * one the user deleted before (tombstone), or a Timeline stay that overlaps a
 * known one in time and place (e.g. the same visit from an older export).
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { jobId, fileName, counts, visits } = parsed.data;

  const docs = visits.map((v) => {
    const visitedAt = v.visitedAt ? new Date(v.visitedAt) : undefined;
    const endAt = v.endAt ? new Date(v.endAt) : undefined;
    const { lat, lng, ...rest } = v;
    return {
      ...rest,
      userId,
      visitedAt: visitedAt && !Number.isNaN(visitedAt.getTime()) ? visitedAt : undefined,
      endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : undefined,
      location: { type: "Point" as const, coordinates: [lng, lat] },
      ...assignRegion(lat, lng),
      dedupeKey: dedupeKey(v),
    };
  });

  // 1. Exact re-imports and 2. visits the user deleted before
  const keys = docs.map((d) => d.dedupeKey);
  const [existing, tombstones] = await Promise.all([
    Visit.find({ userId, dedupeKey: { $in: keys } }, { dedupeKey: 1, _id: 0 }).lean(),
    DeletedVisit.find({ userId, dedupeKey: { $in: keys } }, { dedupeKey: 1, _id: 0 }).lean(),
  ]);
  const existingKeys = new Set(existing.map((d) => d.dedupeKey));
  const deletedKeys = new Set(tombstones.map((d) => d.dedupeKey));

  // 3. The same Timeline stay from another export (slightly different time or spot)
  const stayOf = (d: (typeof docs)[number]): Stay | null => {
    if (d.source !== "timeline" || !d.visitedAt) return null;
    const start = d.visitedAt.getTime();
    const [lng, lat] = d.location.coordinates;
    const placeId = typeof d.meta?.placeId === "string" ? d.meta.placeId : undefined;
    return { lng, lat, start, end: Math.max(start, d.endAt?.getTime() ?? start), placeId };
  };
  const fresh = docs.filter((d) => !existingKeys.has(d.dedupeKey) && !deletedKeys.has(d.dedupeKey));
  const known = await loadKnownStays(userId, fresh.map(stayOf).filter((x): x is Stay => !!x));

  let skipped = 0;
  let ignoredDeleted = 0;
  let merged = 0;
  const seen = new Set<string>();
  const toInsert: typeof docs = [];
  const batchDoc = new Map<Stay, (typeof docs)[number]>();
  const extend = new Map<string, Date>();
  for (const d of docs) {
    if (existingKeys.has(d.dedupeKey) || seen.has(d.dedupeKey)) {
      skipped++;
      continue;
    }
    if (deletedKeys.has(d.dedupeKey)) {
      ignoredDeleted++;
      continue;
    }
    const stay = stayOf(d);
    const match = stay && known.find(stay);
    if (stay && match) {
      merged++;
      // Google often splits one stay in two; keep one record spanning both
      if (stay.end > match.end) {
        match.end = stay.end;
        const pending = batchDoc.get(match);
        if (pending) pending.endAt = new Date(stay.end);
        else if (match.id) extend.set(match.id, new Date(stay.end));
      }
      continue;
    }
    if (stay) {
      known.add(stay);
      batchDoc.set(stay, d);
    }
    seen.add(d.dedupeKey);
    toInsert.push(d);
  }

  // Upsert rather than insert so two tabs importing at once still can't duplicate
  const ops: AnyBulkWriteOperation[] = toInsert.map((doc) => ({
    updateOne: { filter: { userId, dedupeKey: doc.dedupeKey }, update: { $setOnInsert: doc }, upsert: true },
  }));
  for (const [id, endAt] of extend) {
    ops.push({ updateOne: { filter: { _id: new Types.ObjectId(id), userId }, update: { $max: { endAt } } } });
  }
  const res = ops.length ? await Visit.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0 };
  const inserted = res.upsertedCount;
  skipped += toInsert.length - inserted;
  if (inserted || extend.size) await invalidateVisits(userId);

  let job;
  if (jobId && isValidObjectId(jobId)) {
    job = await ImportJob.findOneAndUpdate(
      { _id: jobId, userId },
      { $inc: { received: visits.length, inserted, skipped, merged, ignoredDeleted } },
      { new: true },
    );
  } else {
    job = await ImportJob.create({ userId, fileName, counts, received: visits.length, inserted, skipped, merged, ignoredDeleted });
  }
  return Response.json({ jobId: job ? String(job._id) : undefined, inserted, skipped, merged, ignoredDeleted });
}
