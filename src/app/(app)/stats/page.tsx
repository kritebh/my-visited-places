"use client";

import { StatsView } from "@/components/StatsView";
import { useYear } from "@/components/YearContext";

export default function StatsPage() {
  const { year, setYear } = useYear();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <h1 className="mb-4 text-2xl font-semibold">Stats</h1>
      <StatsView year={year} onYearChange={setYear} />
    </main>
  );
}
