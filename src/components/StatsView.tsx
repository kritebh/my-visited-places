"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Spinner } from "./ui";
import { YearSelect } from "./YearSelect";
import { apiUrl, formatDate, useApi } from "@/lib/client";
import { SOURCE_LABELS, type StatsResponse } from "@/lib/types";
import { useColorScheme } from "@/lib/useMedia";

const CHART = {
  light: { bar: "#2a78d6", grid: "#e1e0d9", tick: "#898781", cursor: "#f0efec" },
  dark: { bar: "#3987e5", grid: "#2c2c2a", tick: "#898781", cursor: "#262624" },
};

export function StatsView({ slug, year, onYearChange, hideTiles }: { slug?: string; year?: number; onYearChange: (y?: number) => void; hideTiles?: boolean }) {
  const c = CHART[useColorScheme()];
  const { data: s, loading } = useApi<StatsResponse>(apiUrl("/api/stats", { slug, year }));

  if (!s) return <div className="py-10 text-center text-muted">{loading ? <Spinner /> : "Couldn't load stats"}</div>;

  const tiles = [
    { label: "Indian states & UTs", value: s.indiaStates, of: s.indiaStatesTotal },
    { label: "Countries", value: s.countries },
    { label: "Places", value: s.places },
    { label: "Visits", value: s.totalVisits },
  ];
  const maxState = Math.max(1, ...s.topStates.map((t) => t.visits));
  const maxSource = Math.max(1, ...s.bySource.map((t) => t.visits));

  return (
    <div className="space-y-4">
      {s.byYear.length > 0 && <YearSelect years={s.byYear} year={year} onChange={onYearChange} />}

      {/* The travel card above already shows the all-time totals */}
      <div className={hideTiles && !year ? "hidden" : "grid grid-cols-2 gap-3 sm:grid-cols-4"}>
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="text-xs text-ink-2">{t.label}</div>
            <div className="mt-1 text-3xl font-semibold">
              {t.value.toLocaleString()}
              {t.of && <span className="text-lg font-normal text-muted">/{t.of}</span>}
            </div>
            {t.of && (
              <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${(t.value / t.of) * 100}%` }} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="text-xs text-ink-2">First visit</div>
          <div className="mt-1 font-semibold">{formatDate(s.firstVisit)}</div>
        </Card>
        <Card>
          <div className="text-xs text-ink-2">Most recent</div>
          <div className="mt-1 font-semibold">{formatDate(s.lastVisit)}</div>
        </Card>
      </div>

      {s.byYear.length > 0 && (
        <Card>
          <h2 className="font-semibold">Visits per year</h2>
          <p className="text-xs text-ink-2">Tap a bar to filter by that year</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.byYear} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.tick, fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: c.cursor }}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", fontSize: 13 }}
                  labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
                  formatter={(v) => [`${v} visits`, ""]}
                  separator=""
                />
                <Bar
                  dataKey="visits"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  className="cursor-pointer"
                  onClick={(d) => {
                    const y = (d as unknown as { year: number }).year;
                    onYearChange(year === y ? undefined : y);
                  }}
                >
                  {s.byYear.map((d) => (
                    <Cell key={d.year} fill={c.bar} fillOpacity={year && d.year !== year ? 0.35 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {s.topStates.length > 0 && (
          <Card>
            <h2 className="font-semibold">Top states & provinces</h2>
            <ul className="mt-3 space-y-2.5">
              {s.topStates.map((t) => (
                <li key={t.code}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className="tabular text-ink-2">{t.visits}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(t.visits / maxState) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {s.bySource.length > 0 && (
          <Card>
            <h2 className="font-semibold">Where the data came from</h2>
            <p className="text-xs text-ink-2">Entries per source. A visit to one place on one day counts once, however many entries it has.</p>
            <ul className="mt-3 space-y-2.5">
              {s.bySource.map((t) => (
                <li key={t.source}>
                  <div className="flex justify-between text-sm">
                    <span>{SOURCE_LABELS[t.source]}</span>
                    <span className="tabular text-ink-2">{t.visits}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(t.visits / maxSource) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {s.undated > 0 && <p className="mt-3 text-xs text-ink-2">{s.undated} undated places (e.g. labelled places) only appear under All time.</p>}
          </Card>
        )}
      </div>
    </div>
  );
}
