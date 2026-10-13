import { ImageResponse } from "next/og";
import type { StatsResponse } from "./types";

export const CARD_SIZE = { width: 1200, height: 630 };

/** Year the person has been travelling since, from dated visits. */
export function sinceYear(s: Pick<StatsResponse, "years">) {
  return s.years.length ? s.years[0] : undefined;
}

/** One-line brag used for the native share sheet and link previews. */
export function shareText(s: StatsResponse, name?: string) {
  const who = name ? `${name} has` : "I've";
  const parts = [`${s.indiaStates} of ${s.indiaStatesTotal} Indian states & UTs`];
  if (s.countries > 1) parts.push(`${s.countries} countries`);
  parts.push(`${s.places.toLocaleString("en-IN")} places`);
  return `${who} been to ${parts.join(", ")}.`;
}

/** 1200×630 summary card, used for Open Graph previews and "Share as image". */
export function renderShareCard(s: StatsResponse, name?: string) {
  const pct = Math.round((s.indiaStates / s.indiaStatesTotal) * 100);
  const since = sinceYear(s);
  const tiles = [
    { value: s.countries, label: s.countries === 1 ? "Country" : "Countries" },
    { value: s.places.toLocaleString("en-IN"), label: "Places" },
    // Public cards carry no dates, so fall back to the visit count
    s.years.length
      ? { value: s.years.length, label: s.years.length === 1 ? "Year of travel" : "Years of travel" }
      : { value: s.totalVisits.toLocaleString("en-IN"), label: "Visits" },
  ];
  const top = s.topStates.filter((t) => t.country === "IN").slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 72px",
          color: "#ffffff",
          background: "linear-gradient(135deg, #0f2f5c 0%, #1c5cab 55%, #2a78d6 100%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#c9dcf6" }}>
          {`${name ? `${name}'s travel map` : "My travel map"}${since ? ` · exploring since ${since}` : ""}`}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 28 }}>
          <div style={{ display: "flex", fontSize: 144, lineHeight: 1, letterSpacing: -5 }}>{s.indiaStates}</div>
          <div style={{ display: "flex", fontSize: 56, lineHeight: 1.2, color: "#9cc0ee", marginLeft: 12 }}>{`/${s.indiaStatesTotal}`}</div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, marginBottom: 16, fontSize: 34 }}>
            <div style={{ display: "flex" }}>Indian states & UTs</div>
            <div style={{ display: "flex", color: "#9cc0ee", fontSize: 28 }}>{`${pct}% of India explored`}</div>
          </div>
        </div>

        <div style={{ display: "flex", height: 14, marginTop: 28, borderRadius: 7, background: "rgba(255,255,255,0.18)" }}>
          <div style={{ display: "flex", width: `${Math.max(pct, 2)}%`, borderRadius: 7, background: "#ffffff" }} />
        </div>

        <div style={{ display: "flex", marginTop: 36, gap: 24 }}>
          {tiles.map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "20px 28px",
                borderRadius: 24,
                background: "rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ display: "flex", fontSize: 52, lineHeight: 1.1 }}>{t.value}</div>
              <div style={{ display: "flex", fontSize: 26, color: "#c9dcf6" }}>{t.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#c9dcf6" }}>
          <div style={{ display: "flex" }}>{top.length ? `Most visited: ${top.map((t) => t.name).join(" · ")}` : ""}</div>
          <div style={{ display: "flex", color: "#ffffff" }}>My Places</div>
        </div>
      </div>
    ),
    CARD_SIZE,
  );
}
