import { isValidObjectId } from "mongoose";
import { invalidateVisits, requireUserId, resolveViewer, toDTO } from "@/lib/data";
import { assignRegion } from "@/lib/geo/regions";
import { DeletedVisit } from "@/models/DeletedVisit";
import { Visit } from "@/models/Visit";
import { manualVisitSchema } from "../route";

export async function GET(req: Request, ctx: RouteContext<"/api/visits/[id]">) {
  const viewer = await resolveViewer(req);
  const { id } = await ctx.params;
  // Public profiles share the coloured map only, never individual places
  if (!viewer?.isOwner || !isValidObjectId(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const doc = await Visit.findOne({ _id: id, userId: viewer.userId }).lean();
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ visit: toDTO(doc, viewer.showReviews) });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/visits/[id]">) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = manualVisitSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { lat, lng, visitedAt, ...rest } = parsed.data;

  const update: Record<string, unknown> = { ...rest };
  if (visitedAt !== undefined) update.visitedAt = new Date(visitedAt);
  if (lat !== undefined && lng !== undefined) {
    update.location = { type: "Point", coordinates: [lng, lat] };
    Object.assign(update, { countryCode: null, countryName: null, stateCode: null, stateName: null }, assignRegion(lat, lng));
  }
  const doc = await Visit.findOneAndUpdate({ _id: id, userId }, update, { new: true }).lean();
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  await invalidateVisits(userId);
  return Response.json({ visit: toDTO(doc) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/visits/[id]">) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const doc = await Visit.findOneAndDelete({ _id: id, userId }).lean();
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  // Remember imported visits so re-importing the same export doesn't restore them
  if (doc.source !== "manual") {
    await DeletedVisit.updateOne(
      { userId, dedupeKey: doc.dedupeKey },
      { $setOnInsert: { source: doc.source, location: doc.location, visitedAt: doc.visitedAt, endAt: doc.endAt, meta: { placeId: (doc.meta as { placeId?: string } | undefined)?.placeId } } },
      { upsert: true },
    );
  }
  await invalidateVisits(userId);
  return Response.json({ ok: true });
}
