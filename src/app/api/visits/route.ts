import { z } from "zod";
import { dedupeKey, filtersFromUrl, invalidateVisits, listVisits, requireUserId, resolveViewer, toDTO } from "@/lib/data";
import { assignRegion } from "@/lib/geo/regions";
import type { Source } from "@/lib/types";
import { DeletedVisit } from "@/models/DeletedVisit";
import { Visit } from "@/models/Visit";

export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  // Public profiles share the coloured map only, never individual places
  if (!viewer?.isOwner) return Response.json({ error: "Not found" }, { status: 404 });
  const p = new URL(req.url).searchParams;
  const visits = await listVisits(viewer, filtersFromUrl(req.url), {
    limit: Number(p.get("limit")) || 200,
    before: p.get("offset") ?? undefined,
    q: p.get("q") ?? undefined,
  });
  return Response.json({ visits });
}

export const manualVisitSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  visitedAt: z.iso.datetime({ offset: true }).optional().or(z.iso.date().optional()),
  reviewText: z.string().max(5000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = manualVisitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const v = parsed.data;
  const visitedAt = v.visitedAt ? new Date(v.visitedAt).toISOString() : undefined;
  const doc = await Visit.create({
    userId,
    source: "manual",
    name: v.name,
    address: v.address,
    reviewText: v.reviewText,
    rating: v.rating,
    location: { type: "Point", coordinates: [v.lng, v.lat] },
    visitedAt,
    ...assignRegion(v.lat, v.lng),
    // Manual entries are always distinct, even at the same spot and minute
    dedupeKey: `${dedupeKey({ source: "manual", lat: v.lat, lng: v.lng, visitedAt })}:${Date.now()}`,
  });
  await invalidateVisits(userId);
  return Response.json({ visit: toDTO(doc.toObject()) }, { status: 201 });
}

/**
 * Deletes every visit of the signed-in user (Settings → delete all data).
 * This is a fresh start, so tombstones go too and a re-import adds everything back.
 */
export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const source = new URL(req.url).searchParams.get("source") as Source | null;
  const filter = source ? { userId, source } : { userId };
  const [{ deletedCount }] = await Promise.all([Visit.deleteMany(filter), DeletedVisit.deleteMany(filter)]);
  await invalidateVisits(userId);
  return Response.json({ deleted: deletedCount });
}
