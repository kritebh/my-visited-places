import { filtersFromUrl, publicStats, resolveViewer, statsFor } from "@/lib/data";

export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  if (!viewer) return Response.json({ error: "Not found" }, { status: 404 });
  if (!viewer.isOwner) return Response.json(publicStats(await statsFor(String(viewer.userId), viewer.version, {})));
  return Response.json(await statsFor(String(viewer.userId), viewer.version, filtersFromUrl(req.url)));
}
