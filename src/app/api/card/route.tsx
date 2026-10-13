import { publicStats, resolveViewer, statsFor } from "@/lib/data";
import { renderShareCard } from "@/lib/shareCard";
import { User } from "@/models/User";

/** PNG summary card for the signed-in user, or a public profile via `?slug=`. */
export async function GET(req: Request) {
  const viewer = await resolveViewer(req);
  if (!viewer) return Response.json({ error: "Not found" }, { status: 404 });
  const [stats, user] = await Promise.all([statsFor(String(viewer.userId), viewer.version, {}), User.findById(viewer.userId, { name: 1 }).lean()]);
  const res = renderShareCard(viewer.isOwner ? stats : publicStats(stats), user?.name ?? undefined);
  res.headers.set("Cache-Control", viewer.isOwner ? "private, no-store" : "public, max-age=600");
  return res;
}
