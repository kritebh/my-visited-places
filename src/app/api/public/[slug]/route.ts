import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET(_req: Request, ctx: RouteContext<"/api/public/[slug]">) {
  const { slug } = await ctx.params;
  await connectDB();
  const user = await User.findOne({ publicSlug: slug, isPublic: true }, { name: 1 }).lean();
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ name: user.name });
}
