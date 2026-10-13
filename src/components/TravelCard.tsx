import type { StatsResponse } from "@/lib/types";

/** Headline stats in the same layout as the shareable image card. */
export function TravelCard({ stats: s, name }: { stats: StatsResponse; name?: string }) {
  const pct = Math.round((s.indiaStates / s.indiaStatesTotal) * 100);
  const since = s.years[0];
  const tiles = [
    { value: s.countries, label: s.countries === 1 ? "Country" : "Countries" },
    { value: s.places.toLocaleString(), label: "Places" },
    { value: s.years.length, label: s.years.length === 1 ? "Year" : "Years" },
  ];
  const top = s.topStates.filter((t) => t.country === "IN").slice(0, 3);

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#0f2f5c] via-[#1c5cab] to-[#2a78d6] p-5 text-white shadow-lg shadow-[#1c5cab]/20 sm:p-6">
      <p className="text-sm text-[#c9dcf6]">
        {name ? `${name}'s travel map` : "Travel map"}
        {since ? ` · since ${since}` : ""}
      </p>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-6xl font-semibold leading-none tracking-tight tabular">{s.indiaStates}</span>
        <span className="pb-1 text-2xl text-[#9cc0ee] tabular">/{s.indiaStatesTotal}</span>
        <span className="ml-1 pb-1 text-sm leading-tight">
          Indian states & UTs
          <span className="block text-[#9cc0ee]">{pct}% of India explored</span>
        </span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="India explored">
        <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-white/12 px-3 py-2.5">
            <div className="text-2xl font-semibold tabular">{t.value}</div>
            <div className="text-xs text-[#c9dcf6]">{t.label}</div>
          </div>
        ))}
      </div>
      {top.length > 0 && (
        <p className="mt-4 truncate text-sm text-[#c9dcf6]">
          Most visited: <span className="text-white">{top.map((t) => t.name).join(" · ")}</span>
        </p>
      )}
    </section>
  );
}
