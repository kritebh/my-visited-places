import { customAlphabet } from "nanoid";
import { z } from "zod";
import { requireUserId } from "@/lib/data";
import { User } from "@/models/User";

const slugId = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 8);

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const user = await User.findById(userId, { name: 1, email: 1, isPublic: 1, publicSlug: 1, shareReviews: 1 }).lean();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ profile: user });
}

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  isPublic: z.boolean().optional(),
  shareReviews: z.boolean().optional(),
  publicSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "Use 3–40 letters, numbers or dashes")
    .optional(),
});

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const update: Record<string, unknown> = { ...parsed.data };
  const user = await User.findById(userId);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.publicSlug && parsed.data.publicSlug !== user.publicSlug) {
    if (await User.exists({ publicSlug: parsed.data.publicSlug, _id: { $ne: userId } })) {
      return Response.json({ error: "That link is taken" }, { status: 409 });
    }
  }
  if (parsed.data.isPublic && !user.publicSlug && !parsed.data.publicSlug) update.publicSlug = slugId();

  const updated = await User.findByIdAndUpdate(userId, update, {
    new: true,
    projection: { name: 1, email: 1, isPublic: 1, publicSlug: 1, shareReviews: 1 },
  }).lean();
  return Response.json({ profile: updated });
}
