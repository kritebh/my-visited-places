"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, ImageDown, Settings, Share2 } from "lucide-react";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { TravelCard } from "@/components/TravelCard";
import { ThemeButton } from "@/components/ThemeToggle";
import { api, formatDate, useApi } from "@/lib/client";
import type { StatsResponse } from "@/lib/types";

interface Profile {
  name?: string;
  email: string;
  isPublic: boolean;
  publicSlug?: string;
  shareReviews: boolean;
}

export default function ProfilePage() {
  const { data: p } = useApi<{ profile: Profile }>("/api/profile");
  const { data: stats } = useApi<StatsResponse>("/api/stats");
  if (!p || !stats) return <div className="py-10 text-center text-muted"><Spinner /></div>;
  return <ProfileView initial={p.profile} stats={stats} />;
}

function ProfileView({ initial, stats }: { initial: Profile; stats: StatsResponse }) {
  const [profile, setProfile] = useState(initial);
  const name = profile.name ?? undefined;

  const busiest = stats.byYear.reduce<{ year: number; visits: number } | undefined>((b, y) => (!b || y.visits > b.visits ? y : b), undefined);
  const topState = stats.topStates[0];
  const highlights = [
    { label: "First visit", value: formatDate(stats.firstVisit) },
    { label: "Most recent", value: formatDate(stats.lastVisit) },
    busiest && { label: "Busiest year", value: `${busiest.year} · ${busiest.visits.toLocaleString()} visits` },
    topState && { label: "Favourite state", value: `${topState.name} · ${topState.visits.toLocaleString()} visits` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10 space-y-4">
      <header className="flex items-center gap-2">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-ink" aria-hidden>
          {(name ?? profile.email).charAt(0).toUpperCase()}
        </div>
        <div className="ml-1 min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{name ?? "Profile"}</h1>
          <p className="truncate text-sm text-ink-2">{profile.email}</p>
        </div>
        <ThemeButton />
        <Link href="/settings" className="rounded-xl p-2.5 text-ink-2 hover:bg-surface-2" aria-label="Settings">
          <Settings className="size-5" />
        </Link>
      </header>

      {stats.totalVisits > 0 ? (
        <TravelCard stats={stats} name={name} />
      ) : (
        <Card className="text-center">
          <p className="font-medium">No places yet</p>
          <p className="mt-1 text-sm text-ink-2">Import your Google data to build your travel card.</p>
          <Link href="/import" className="mt-3 inline-block text-sm font-medium text-accent">Import data →</Link>
        </Card>
      )}

      <ShareCard profile={profile} onChange={setProfile} canShare={stats.totalVisits > 0} />

      {stats.totalVisits > 0 && (
        <Card>
          <h2 className="font-semibold">Highlights</h2>
          <dl className="mt-2 divide-y divide-line">
            {highlights.map((h) => (
              <div key={h.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="text-ink-2">{h.label}</dt>
                <dd className="truncate text-right font-medium">{h.value}</dd>
              </div>
            ))}
          </dl>
          <Link href="/stats" className="mt-2 inline-block text-sm font-medium text-accent">All stats →</Link>
        </Card>
      )}
    </main>
  );
}

function ShareCard({ profile, onChange, canShare }: { profile: Profile; onChange: (p: Profile) => void; canShare: boolean }) {
  const [slug, setSlug] = useState(profile.publicSlug ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [copied, setCopied] = useState(false);
  const link = profile.publicSlug ? `${window.location.origin}/u/${profile.publicSlug}` : "";
  const title = profile.name ? `${profile.name}'s travel map` : "My travel map";

  async function update(patch: Partial<Profile>) {
    setError(undefined);
    try {
      const { profile: next } = await api<{ profile: Profile }>("/api/profile", { method: "PATCH", json: patch });
      onChange(next);
      setSlug(next.publicSlug ?? "");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareLink() {
    if (navigator.share) await navigator.share({ title, url: link }).catch(() => {});
    else await copy();
  }

  async function shareImage() {
    setBusy("image");
    setError(undefined);
    try {
      const res = await fetch("/api/card");
      if (!res.ok) throw new Error("Couldn't create the image");
      const file = new File([await res.blob()], "my-travel-map.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, ...(link ? { url: link } : {}) }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Share your map</h2>
        <p className="text-sm text-ink-2">
          {profile.isPublic
            ? "Anyone with the link sees your coloured map with visit counts per state and country. Places, dates and your timeline stay private."
            : "Create a link friends can open to see your coloured map, or share your card as an image. Places, dates and your timeline stay private."}
        </p>
      </div>

      {profile.isPublic && link ? (
        <>
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1 pl-3 text-sm">
            <span className="flex-1 truncate">{link.replace(/^https?:\/\//, "")}</span>
            <button className="rounded-lg p-2.5 hover:bg-line" aria-label="Copy link" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="rounded-lg p-2.5 hover:bg-line" aria-label="Open public profile">
              <ExternalLink className="size-4" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={shareLink}><Share2 className="size-4" /> Share link</Button>
            <Button variant="secondary" onClick={shareImage} disabled={!canShare || !!busy}>
              {busy ? <Spinner /> : <ImageDown className="size-4" />} Share image
            </Button>
          </div>
          <details className="group rounded-xl border border-line px-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex h-11 cursor-pointer items-center justify-between text-sm font-medium">
              Link options <span className="text-muted transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-2 pb-3">
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  update({ publicSlug: slug });
                }}
              >
                <div className="flex-1">
                  <Input label="Link name" value={slug} onChange={(e) => setSlug(e.target.value)} autoCapitalize="none" autoCorrect="off" />
                </div>
                <Button type="submit" variant="secondary" disabled={slug === profile.publicSlug}>Save</Button>
              </form>
              <Button variant="ghost" className="w-full text-danger" onClick={() => update({ isPublic: false })}>Stop sharing</Button>
            </div>
          </details>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => update({ isPublic: true })} disabled={!canShare}><Share2 className="size-4" /> Create link</Button>
          <Button variant="secondary" onClick={shareImage} disabled={!canShare || !!busy}>
            {busy ? <Spinner /> : <ImageDown className="size-4" />} Share image
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
