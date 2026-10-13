"use client";

import Link from "next/link";
import { MapPinned } from "lucide-react";
import { MapExplorer } from "@/components/map/MapExplorer";
import { ThemeButton } from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui";
import { useApi } from "@/lib/client";

/** Read-only shared map: coloured regions and counts, no places or dates. */
export function PublicProfile({ slug }: { slug: string }) {
  const { data, error } = useApi<{ name?: string }>(`/api/public/${slug}`);

  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">This map isn&apos;t public</p>
        <Link href="/" className="text-accent">Make your own map →</Link>
      </main>
    );
  }
  if (!data) return <div className="flex-1 flex items-center justify-center text-muted"><Spinner /></div>;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 h-14 shrink-0">
        <MapPinned className="size-5 text-accent" />
        <h1 className="flex-1 truncate font-semibold">{data.name ? `${data.name}'s travel map` : "Travel map"}</h1>
        <ThemeButton className="-mr-2 p-2" />
      </header>
      <div className="flex-1 min-h-0">
        <MapExplorer slug={slug} />
      </div>
      <footer className="shrink-0 border-t border-line bg-surface px-4 py-2 text-center text-xs text-ink-2 pb-safe">
        <Link href="/" className="text-accent">Make your own travel map</Link>
      </footer>
    </div>
  );
}
