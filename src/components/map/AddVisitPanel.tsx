"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button, Input, Spinner } from "../ui";
import { api } from "@/lib/client";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; city?: string; state?: string; country?: string; osm_id: number };
}

const describe = (p: PhotonFeature["properties"]) => [p.city, p.state, p.country].filter(Boolean).join(", ");

/**
 * Search a place (Photon geocoder, no key needed) or pan the map under the
 * crosshair, then save it as a manual visit.
 */
export function AddVisitPanel({
  getCenter,
  flyTo,
  onSaved,
  onCancel,
}: {
  getCenter: () => { lng: number; lat: number };
  flyTo: (lng: number, lat: number) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`, { signal: ctrl.signal });
        setResults(((await res.json()).features ?? []) as PhotonFeature[]);
      } catch {
        /* aborted or offline */
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function pick(f: PhotonFeature) {
    const [lng, lat] = f.geometry.coordinates;
    flyTo(lng, lat);
    setName(f.properties.name ?? f.properties.street ?? "");
    setAddress(describe(f.properties));
    setQ("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const { lng, lat } = getCenter();
    setSaving(true);
    setError(undefined);
    try {
      await api("/api/visits", {
        method: "POST",
        json: { name, address: address || undefined, lat, lng, visitedAt: date || undefined },
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input placeholder="Search a place…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search a place" />
        {searching && <Spinner className="absolute right-3 top-3.5 text-muted" />}
      </div>
      {q.trim().length >= 3 && results.length > 0 && (
        <ul className="rounded-xl border border-line divide-y divide-line">
          {results.map((f) => (
            <li key={f.properties.osm_id}>
              <button type="button" onClick={() => pick(f)} className="w-full px-3 py-2 text-left hover:bg-surface-2">
                <div className="text-sm font-medium">{f.properties.name ?? f.properties.street}</div>
                <div className="text-xs text-ink-2">{describe(f.properties)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-2">Or move the map so the crosshair sits on the place.</p>
      <form onSubmit={save} className="space-y-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="Date visited" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={saving || !name} className="flex-1">{saving && <Spinner />} Save visit</Button>
        </div>
      </form>
    </div>
  );
}
