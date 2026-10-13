"use client";

import { ExternalLink, Star } from "lucide-react";
import { formatDate } from "@/lib/client";
import { SOURCE_LABELS, type VisitDTO } from "@/lib/types";

export function SourceBadge({ source }: { source: VisitDTO["source"] }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
      {SOURCE_LABELS[source]}
    </span>
  );
}

const PHOTO_FILE = /\.(jpe?g|png|heic|webp|gif|mp4|mov)$/i;

export function placeTitle(v: Pick<VisitDTO, "source" | "name" | "address" | "stateName" | "countryName">) {
  const region = v.stateName || v.countryName;
  // Photo sidecars only carry a file name, which isn't a useful title
  if ((v.source === "photo" || v.source === "gphotos") && (!v.name || PHOTO_FILE.test(v.name))) {
    return region ? `Photo · ${region}` : "Photo";
  }
  if (v.name || v.address) return v.name || v.address!.split(",")[0];
  // Timeline visits often carry only a place id
  return v.source === "timeline" ? "Visit" : region || "Unnamed place";
}

export function stayLength(v: Pick<VisitDTO, "visitedAt" | "endAt">) {
  if (!v.visitedAt || !v.endAt) return undefined;
  const mins = Math.round((Date.parse(v.endAt) - Date.parse(v.visitedAt)) / 60000);
  if (mins < 1) return undefined;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h >= 24) return `${Math.round(h / 24)}d`;
  return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`;
}

export function VisitItem({ v, onClick, actions }: { v: VisitDTO; onClick?: () => void; actions?: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3 border-b border-line last:border-0">
      <button onClick={onClick} className="min-w-0 flex-1 text-left" disabled={!onClick}>
        <div className="font-medium truncate">{placeTitle(v)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          <span className="tabular">
            {formatDate(v.visitedAt)}
            {v.source === "timeline" && v.visitedAt && ` · ${formatDate(v.visitedAt, { hour: "numeric", minute: "2-digit" })}`}
            {stayLength(v) && ` · ${stayLength(v)}`}
          </span>
          <SourceBadge source={v.source} />
          {v.rating ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="size-3 fill-current" /> {v.rating}
            </span>
          ) : null}
          {(v.stateName || v.countryName) && <span className="truncate">{[v.stateName, v.countryName].filter(Boolean).join(", ")}</span>}
        </div>
      </button>
      {actions}
    </div>
  );
}

export function VisitDetail({ v }: { v: VisitDTO }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <SourceBadge source={v.source} />
        <span className="tabular">
          {formatDate(v.visitedAt, {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric",
            // Manually added visits only have a date
            ...(v.source === "manual" ? { timeZone: "UTC" } : { hour: "numeric", minute: "2-digit" }),
          })}
        </span>
      </div>
      {v.address && <p className="text-sm text-ink-2">{v.address}</p>}
      {(v.stateName || v.countryName) && (
        <p className="text-sm">
          <span className="text-muted">Region:</span> {[v.stateName, v.countryName].filter(Boolean).join(", ")}
        </p>
      )}
      {v.rating ? (
        <div className="flex items-center gap-0.5" aria-label={`${v.rating} out of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={i < v.rating! ? "size-4 fill-[#eda100] text-[#eda100]" : "size-4 text-line"} />
          ))}
        </div>
      ) : null}
      {v.reviewText && <blockquote className="rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-line">{v.reviewText}</blockquote>}
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={v.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 h-9 text-sm font-medium hover:bg-line"
        >
          <ExternalLink className="size-4" /> Open in Google Maps
        </a>
      </div>
    </div>
  );
}
