import { filtersFromUrl, regionsFor, resolveViewer } from "@/lib/data";

export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  if (!viewer) return Response.json({ error: "Not found" }, { status: 404 });
  // Public profiles always show all-time totals (no year filter)
  return Response.json(await regionsFor(String(viewer.userId), viewer.version, viewer.isOwner ? filtersFromUrl(req.url) : {}));
}
