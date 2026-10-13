import { admin1For } from "@/lib/geo/regions";

/** States/provinces for visited countries outside India: /api/geo/admin1?countries=FR,AE */
export async function GET(req: Request) {
  const codes = (new URL(req.url).searchParams.get("countries") ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{2,3}$/.test(c))
    .slice(0, 60);
  return Response.json(admin1For(codes), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
