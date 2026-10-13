import { filtersFromUrl, pointsFor, resolveViewer } from "@/lib/data";

export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  // Public profiles share the coloured map only, never individual places
  if (!viewer?.isOwner) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await pointsFor(String(viewer.userId), viewer.version, filtersFromUrl(req.url)));
}
