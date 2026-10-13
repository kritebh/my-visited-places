"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { VisitDetail, VisitItem, placeTitle } from "@/components/VisitItem";
import { YearSelect } from "@/components/YearSelect";
import { useYear } from "@/components/YearContext";
import { api, apiUrl, useApi } from "@/lib/client";
import type { StatsResponse, VisitDTO } from "@/lib/types";

const PAGE = 200;

export default function TimelinePage() {
  const { year, setYear } = useYear();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<{ key?: string; visits: VisitDTO[]; hasMore: boolean }>({ visits: [], hasMore: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const { visits, hasMore } = list;
  const setVisits = (fn: (prev: VisitDTO[]) => VisitDTO[]) => setList((l) => ({ ...l, visits: fn(l.visits) }));
  const [selected, setSelected] = useState<VisitDTO | null>(null);
  const [editing, setEditing] = useState(false);
  const stats = useApi<StatsResponse>(apiUrl("/api/stats", {}));

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const key = `${year ?? ""}|${query}`;
  const fetchPage = (offset: number) =>
    api<{ visits: VisitDTO[] }>(apiUrl("/api/visits", { year, q: query, limit: PAGE, offset })).then((r) => r.visits);

  useEffect(() => {
    let cancelled = false;
    fetchPage(0).then((page) => !cancelled && setList({ key, visits: page, hasMore: page.length === PAGE }));
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    setLoadingMore(true);
    const page = await fetchPage(visits.length);
    setList((l) => ({ ...l, visits: [...l.visits, ...page], hasMore: page.length === PAGE }));
    setLoadingMore(false);
  }
  const loading = list.key !== key || loadingMore;

  const groups = useMemo(() => {
    const map = new Map<string, VisitDTO[]>();
    for (const v of visits) {
      const key = v.visitedAt ? new Date(v.visitedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Undated";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return [...map.entries()];
  }, [visits]);

  async function remove(v: VisitDTO) {
    if (!confirm(`Delete "${placeTitle(v)}"?`)) return;
    await api(`/api/visits/${v.id}`, { method: "DELETE" });
    setVisits((prev) => prev.filter((x) => x.id !== v.id));
    setSelected(null);
  }

  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:py-10">
      <h1 className="text-2xl font-semibold">Timeline</h1>
      <div className="mt-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input placeholder="Search places, states, countries…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search visits" />
        </div>
        {stats.data && stats.data.byYear.length > 0 && <YearSelect years={stats.data.byYear} year={year} onChange={setYear} />}
      </div>

      <div className="mt-4">
        {groups.map(([month, items]) => (
          <section key={month} className="mb-4">
            <h2 className="sticky top-0 z-10 bg-bg/95 py-2 text-sm font-semibold text-ink-2 backdrop-blur">
              {month} <span className="font-normal text-muted tabular">· {items.length}</span>
            </h2>
            <div className="rounded-2xl border border-line bg-surface px-4">
              {items.map((v) => (
                <VisitItem
                  key={v.id}
                  v={v}
                  onClick={() => {
                    setSelected(v);
                    setEditing(false);
                  }}
                  actions={
                    <button onClick={() => remove(v)} className="self-center rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Delete visit">
                      <Trash2 className="size-4" />
                    </button>
                  }
                />
              ))}
            </div>
          </section>
        ))}
        {loading && <div className="py-6 text-center text-muted"><Spinner /></div>}
        {!loading && !visits.length && <p className="py-10 text-center text-ink-2">No visits{year ? ` in ${year}` : ""}{query ? ` matching “${query}”` : ""}.</p>}
        {hasMore && !loading && (
          <Button variant="secondary" className="w-full" onClick={loadMore}>Load more</Button>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30 md:bg-black/10" onClick={() => setSelected(null)} />
          <Sheet
              title={placeTitle(selected)}
              onClose={() => setSelected(null)}
            >
              {editing ? (
                <EditVisit
                  v={selected}
                  onSaved={(v) => {
                    setVisits((prev) => prev.map((x) => (x.id === v.id ? v : x)));
                    setSelected(v);
                    setEditing(false);
                  }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <VisitDetail v={selected} />
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
                    <Button variant="ghost" className="text-danger" onClick={() => remove(selected)}><Trash2 className="size-4" /> Delete</Button>
                  </div>
                </>
              )}
          </Sheet>
        </div>
      )}
    </main>
  );
}

function EditVisit({ v, onSaved, onCancel }: { v: VisitDTO; onSaved: (v: VisitDTO) => void; onCancel: () => void }) {
  const [name, setName] = useState(v.name ?? "");
  const [date, setDate] = useState(v.visitedAt?.slice(0, 10) ?? "");
  const [error, setError] = useState<string>();

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const { visit } = await api<{ visit: VisitDTO }>(`/api/visits/${v.id}`, {
        method: "PATCH",
        json: { name: name || undefined, visitedAt: date || undefined },
      });
      onSaved(visit);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Date visited" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1">Save</Button>
      </div>
    </form>
  );
}
