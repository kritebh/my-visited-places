"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronRight, LogOut, Trash2 } from "lucide-react";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { InstallButton } from "@/components/InstallButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, useApi } from "@/lib/client";

interface Profile {
  name?: string;
  email: string;
  isPublic: boolean;
  publicSlug?: string;
  shareReviews: boolean;
}

export default function SettingsPage() {
  const { data } = useApi<{ profile: Profile }>("/api/profile");
  if (!data) return <div className="py-10 text-center text-muted"><Spinner /></div>;
  return <Settings initial={data.profile} />;
}

function Settings({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [name, setName] = useState(initial.name ?? "");
  const [error, setError] = useState<string>();
  const tombstones = useApi<{ count: number }>("/api/visits/deleted");

  async function deleteAll() {
    if (!confirm("Delete ALL your visits? This can't be undone. Importing your files again will add everything back.")) return;
    const { deleted } = await api<{ deleted: number }>("/api/visits", { method: "DELETE" });
    tombstones.reload();
    alert(`Deleted ${deleted} visits.`);
  }

  async function forgetDeleted() {
    await api("/api/visits/deleted", { method: "DELETE" });
    tombstones.reload();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card className="space-y-3">
        <div>
          <div className="text-sm text-ink-2">Signed in as</div>
          <div className="font-medium">{profile.email}</div>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(undefined);
            try {
              const res = await api<{ profile: Profile }>("/api/profile", { method: "PATCH", json: { name } });
              setProfile(res.profile);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <div className="flex-1">
            <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === profile.name}>Save</Button>
        </form>
        <p className="text-xs text-ink-2">Shown on your profile and shared card.</p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>

      <Link href="/profile" className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
        <span>
          <span className="block font-semibold">Public profile & sharing</span>
          <span className="block text-sm text-ink-2">{profile.isPublic ? "Your map is shared" : "Not shared"} · manage on your profile</span>
        </span>
        <ChevronRight className="size-5 text-muted" />
      </Link>

      <Card className="space-y-3">
        <h2 className="font-semibold">Appearance</h2>
        <ThemeToggle />
        <p className="text-xs text-ink-2">System follows your phone&apos;s light or dark setting.</p>
      </Card>

      <InstallButton />

      <Card className="space-y-3">
        <h2 className="font-semibold">Data</h2>
        {!!tombstones.data?.count && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="text-ink-2">
              {tombstones.data.count.toLocaleString()} deleted {tombstones.data.count === 1 ? "visit stays" : "visits stay"} deleted when you import again.
            </span>
            <Button variant="secondary" className="h-9 shrink-0 bg-surface" onClick={forgetDeleted}>Allow re-import</Button>
          </div>
        )}
        <Button variant="danger" onClick={deleteAll}><Trash2 className="size-4" /> Delete all visits</Button>
      </Card>

      <Button variant="secondary" onClick={async () => {
          navigator.serviceWorker?.controller?.postMessage("clear-user-cache");
          // Navigate ourselves: the server-built redirect URL can point at the container's 0.0.0.0 address
          await signOut({ redirect: false });
          window.location.assign("/");
        }} className="w-full">
        <LogOut className="size-4" /> Log out
      </Button>
    </main>
  );
}
