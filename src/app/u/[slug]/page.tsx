import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { PublicProfile } from "@/components/PublicProfile";
import { Spinner } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { publicStats, statsFor } from "@/lib/data";
import { shareText } from "@/lib/shareCard";
import { User } from "@/models/User";

export async function generateMetadata({ params }: PageProps<"/u/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // Per-request data (and Mongoose's internal Date use) must not be prerendered
  await connection();
  const h = await headers();
  await connectDB();
  const user = await User.findOne({ publicSlug: slug, isPublic: true }, { name: 1, dataVersion: 1 }).lean();
  if (!user) return { title: "Travel map" };

  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const stats = publicStats(await statsFor(String(user._id), user.dataVersion ?? 0, {}));
  const title = user.name ? `${user.name}'s travel map` : "Travel map";
  const description = shareText(stats, user.name ?? undefined);
  const image = { url: `${origin}/api/card?slug=${encodeURIComponent(slug)}`, width: 1200, height: 630, alt: description };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "profile" },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

async function Profile({ params }: { params: Promise<{ slug: string }> }) {
  // Marks the page as per-request so the metadata above can read the database
  await connection();
  const { slug } = await params;
  return <PublicProfile slug={slug} />;
}

export default function PublicProfilePage({ params }: PageProps<"/u/[slug]">) {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted"><Spinner /></div>}>
      <Profile params={params} />
    </Suspense>
  );
}
