"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Crosshair, Plus, Upload, X } from "lucide-react";
import clsx from "clsx";
import { apiUrl, useApi } from "@/lib/client";
import { useColorScheme } from "@/lib/useMedia";
import type { RegionsResponse, StatsResponse, VisitDTO } from "@/lib/types";
import { Sheet } from "../Sheet";
import { VisitDetail, VisitItem, placeTitle } from "../VisitItem";
import { YearSelect } from "../YearSelect";
import { Spinner } from "../ui";
import { AddVisitPanel } from "./AddVisitPanel";
import { BUCKETS, RAMP, UNVISITED } from "./colors";
import type { MapCanvasHandle, RegionSelection, View } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted">
      <Spinner />
    </div>
  ),
});

type Panel = { kind: "region"; region: RegionSelection } | { kind: "visit"; id: string } | { kind: "add" } | null;

export function MapExplorer({
  slug,
  year,
  onYearChange,
}: {
  /** Public profile slug; omit for the signed-in user's own map. */
  slug?: string;
  year?: number;
  onYearChange?: (y?: number) => void;
}) {
  const readOnly = !!slug;
  const mapRef = useRef<MapCanvasHandle>(null);
  const [chosenView, setView] = useState<View | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [version, setVersion] = useState(0);

  const params = { slug, year, v: version };
  const stats = useApi<StatsResponse>(apiUrl("/api/stats", params));
  const regions = useApi<RegionsResponse>(apiUrl("/api/regions", params));
  // Public maps show coloured regions only, never individual places
  const points = useApi<FeatureCollection>(readOnly ? null : apiUrl("/api/points", params));

  // States/provinces for foreign countries the user has been to
  const foreign = useMemo(
    () => (regions.data?.countries ?? []).map((c) => c.code).filter((c) => c !== "IN").sort().join(","),
    [regions.data],
  );
  const admin1 = useApi<FeatureCollection>(foreign ? apiUrl("/api/geo/admin1", { countries: foreign }) : null);

  // Start on the world map only if there's travel outside India
  const view: View | null =
    chosenView ?? (regions.data ? (regions.data.countries.some((c) => c.code !== "IN") ? "world" : "india") : null);

  // World view frames everywhere you've been rather than a fixed globe
  const worldBounds = useMemo(() => {
    const coords = points.data?.features.map((f) => (f.geometry as GeoJSON.Point).coordinates) ?? [];
    if (!coords.length) return undefined;
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number];
  }, [points.data]);

  const onRegionClick = useCallback((region: RegionSelection) => setPanel({ kind: "region", region }), []);
  const onPointClick = useCallback((id: string) => setPanel({ kind: "visit", id }), []);

  const s = stats.data;
  const empty = s && s.totalVisits === 0 && !year;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        ref={mapRef}
        view={view ?? "india"}
        regions={regions.data}
        worldBounds={worldBounds}
        points={points.data}
        admin1={admin1.data}
        selected={panel?.kind === "region" ? panel.region : null}
        onRegionClick={onRegionClick}
        onPointClick={onPointClick}
        compactPanel={readOnly}
      />

      {/* Soft wash so the floating controls sit cleanly over busy map areas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-28 bg-gradient-to-b from-bg/70 to-transparent" />

      {/* Top bar: view toggle, year dropdown, add */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className={clsx(GLASS, "pointer-events-auto flex p-1")} role="tablist" aria-label="Map view">
          {(["india", "world"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={clsx(
                "rounded-[10px] px-3.5 h-8 text-sm font-medium transition",
                view === v ? "bg-ink text-bg shadow-sm" : "text-ink-2 hover:text-ink",
              )}
            >
              {v === "india" ? "India" : "World"}
            </button>
          ))}
        </div>
        {onYearChange && s && s.byYear.length > 0 && (
          <YearSelect years={s.byYear} year={year} onChange={onYearChange} className={clsx("pointer-events-auto", !year && GLASS, !year && "h-10 border-0")} />
        )}
        <div className="flex-1" />
        {!readOnly && panel?.kind !== "add" && (
          <button
            onClick={() => setPanel({ kind: "add" })}
            aria-label="Add place"
            className="pointer-events-auto inline-flex size-10 md:w-auto md:px-4 items-center justify-center gap-1.5 rounded-2xl bg-accent text-sm font-medium text-accent-ink shadow-[0_6px_20px_rgba(42,120,214,0.35)] transition hover:brightness-110"
          >
            <Plus className="size-5 md:size-4" /> <span className="hidden md:inline">Add place</span>
          </button>
        )}
      </div>

      {!panel && <CoverageCard stats={s} year={year} />}

      {panel?.kind === "add" && (
        <div className="pointer-events-none absolute left-1/2 top-[30%] md:top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-ink">
          <Crosshair className="size-8 drop-shadow" strokeWidth={2.5} />
        </div>
      )}

      {empty && !readOnly && !panel && (
        <div className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-xl">
          <p className="font-semibold">Your map is empty</p>
          <p className="mt-1 text-sm text-ink-2">Import your Google Maps Takeout or phone Timeline export to colour in the places you&apos;ve been.</p>
          <Link href="/import" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 h-10 text-sm font-medium text-accent-ink">
            <Upload className="size-4" /> Import data
          </Link>
        </div>
      )}

      {panel?.kind === "region" && (
        <RegionPanel
          region={panel.region}
          year={year}
          regions={regions.data}
          countsOnly={readOnly}
          onClose={() => setPanel(null)}
          onVisit={(id) => setPanel({ kind: "visit", id })}
        />
      )}
      {panel?.kind === "visit" && !readOnly && <VisitPanel id={panel.id} onClose={() => setPanel(null)} />}
      {panel?.kind === "add" && (
        <Sheet title="Add a place" subtitle="Saved as a manual visit" onClose={() => setPanel(null)}>
          <AddVisitPanel
            getCenter={() => mapRef.current?.getCenter() ?? { lng: 0, lat: 0 }}
            flyTo={(lng, lat) => mapRef.current?.flyTo(lng, lat, 14)}
            onCancel={() => setPanel(null)}
            onSaved={() => {
              setPanel(null);
              setVersion((v) => v + 1);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

const GLASS = "rounded-2xl border border-white/50 dark:border-white/10 bg-surface/80 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)]";

/** Coverage summary + colour key, bottom-left. */
function CoverageCard({ stats, year }: { stats?: StatsResponse; year?: number }) {
  const scheme = useColorScheme();
  const colors = [UNVISITED[scheme], ...RAMP[scheme]];
  return (
    <div className={clsx(GLASS, "absolute z-10 left-3 bottom-8 w-[11.5rem] md:w-56 p-3")}>
      {stats && (
        <div className="mb-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{year ? `Covered in ${year}` : "Covered"}</div>
          <div className="mt-0.5 flex items-baseline gap-1 tabular">
            <span className="text-2xl font-semibold leading-none">{stats.indiaStates}</span>
            <span className="text-sm text-ink-2">/ {stats.indiaStatesTotal} states</span>
          </div>
          <div className="mt-1 text-xs text-ink-2 tabular">
            {stats.countries} {stats.countries === 1 ? "country" : "countries"} · {stats.places.toLocaleString()} places
          </div>
        </div>
      )}
      <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
        {colors.map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-1 flex text-[10px] text-muted tabular">
        {["0", ...BUCKETS.map((b) => (b.min >= 40 ? "40+" : String(b.min)))].map((l) => (
          <span key={l} className="flex-1 text-center">{l}</span>
        ))}
      </div>
      <div className="mt-0.5 text-[10px] text-muted">Visits per region</div>
    </div>
  );
}

function RegionPanel({
  region,
  year,
  regions,
  countsOnly,
  onClose,
  onVisit,
}: {
  region: RegionSelection;
  year?: number;
  regions?: RegionsResponse;
  /** Public maps: just the name and totals, no list of places. */
  countsOnly?: boolean;
  onClose: () => void;
  onVisit: (id: string) => void;
}) {
  const filter = region.kind === "country" ? { country: region.code } : { state: region.code };
  const { data, loading } = useApi<{ visits: VisitDTO[] }>(countsOnly ? null : apiUrl("/api/visits", { year, limit: 300, ...filter }));
  const count = (region.kind === "country" ? regions?.countries : regions?.states)?.find((r) => r.code === region.code);

  if (countsOnly) {
    return (
      <div role="dialog" aria-label={region.name} className={clsx(GLASS, "absolute z-20 left-3 right-14 bottom-8 flex items-center gap-3 p-4 md:right-auto md:w-80")}>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-tight">{region.name}</h2>
          <p className="mt-0.5 text-sm text-ink-2 tabular">
            {count
              ? `${count.visits.toLocaleString()} ${count.visits === 1 ? "visit" : "visits"} · ${count.places.toLocaleString()} ${count.places === 1 ? "place" : "places"}`
              : "Not visited yet"}
          </p>
        </div>
        <button onClick={onClose} className="-m-1 rounded-full p-2.5 text-muted hover:bg-surface-2" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
    );
  }


  return (
    <Sheet
      title={region.name}
      subtitle={
        count ? (
          <span className="tabular">
            {count.visits.toLocaleString()} {count.visits === 1 ? "visit" : "visits"} · {count.places.toLocaleString()} {count.places === 1 ? "place" : "places"}
            {year ? ` in ${year}` : ""}
          </span>
        ) : (
          `Not visited${year ? ` in ${year}` : " yet"}`
        )
      }
      onClose={onClose}
    >
      {loading && !data ? (
        <div className="py-6 text-center text-muted"><Spinner /></div>
      ) : data?.visits.length ? (
        <div>
          {data.visits.map((v) => (
            <VisitItem key={v.id} v={v} onClick={() => onVisit(v.id)} />
          ))}
        </div>
      ) : (
        <p className="py-4 text-sm text-ink-2">No visits recorded here.</p>
      )}
    </Sheet>
  );
}

function VisitPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useApi<{ visit: VisitDTO }>(`/api/visits/${id}`);
  return (
    <Sheet title={data ? placeTitle(data.visit) : "…"} onClose={onClose}>
      {loading && !data ? <div className="py-6 text-center text-muted"><Spinner /></div> : data && <VisitDetail v={data.visit} />}
    </Sheet>
  );
}
