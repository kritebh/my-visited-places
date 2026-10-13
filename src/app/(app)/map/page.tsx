"use client";

import { MapExplorer } from "@/components/map/MapExplorer";
import { useYear } from "@/components/YearContext";

export default function MapPage() {
  const { year, setYear } = useYear();
  return (
    <div className="h-[calc(100dvh-60px-env(safe-area-inset-bottom))] md:h-dvh">
      <MapExplorer year={year} onYearChange={setYear} />
    </div>
  );
}
