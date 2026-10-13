"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import clsx from "clsx";

/**
 * Compact year filter. A styled pill over a native <select>, so phones get
 * their own wheel/sheet picker.
 */
export function YearSelect({
  years,
  year,
  onChange,
  className,
}: {
  years: { year: number; visits: number }[];
  year?: number;
  onChange: (y?: number) => void;
  className?: string;
}) {
  return (
    <label
      className={clsx(
        "relative inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition",
        year ? "bg-ink text-bg" : "bg-surface text-ink border border-line",
        className,
      )}
    >
      <CalendarDays className="size-4 opacity-70" />
      <span className="tabular whitespace-nowrap">{year ?? "All time"}</span>
      <ChevronDown className="size-4 opacity-60" />
      <select
        aria-label="Filter by year"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={year ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      >
        <option value="">All time</option>
        {[...years].reverse().map((y) => (
          <option key={y.year} value={y.year}>
            {y.year} · {y.visits.toLocaleString()} visits
          </option>
        ))}
      </select>
    </label>
  );
}
