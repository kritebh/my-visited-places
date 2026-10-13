import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  await connectDB();
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email })) {
    return Response.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  await User.create({ name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
  return Response.json({ ok: true }, { status: 201 });
}
