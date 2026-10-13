import { requireUserId } from "@/lib/data";
import { DeletedVisit } from "@/models/DeletedVisit";

/** How many deleted visits imports will keep skipping. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ count: await DeletedVisit.countDocuments({ userId }) });
}

/** Forget deletions so the next import can add those visits back. */
export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { deletedCount } = await DeletedVisit.deleteMany({ userId });
  return Response.json({ cleared: deletedCount });
}
