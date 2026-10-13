"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileArchive, FolderOpen, Info } from "lucide-react";
import { Button, Card, Spinner } from "@/components/ui";
import { api, formatDate } from "@/lib/client";
import { parseFiles, type ParseResult } from "@/lib/parsers/detect";
import { readInputFiles } from "@/lib/parsers/readInput";
import { SOURCE_LABELS, type Source } from "@/lib/types";

interface ImportTotals {
  inserted: number;
  skipped: number;
  merged: number;
  ignoredDeleted: number;
}

type Stage =
  | { name: "idle" }
  | { name: "reading"; done: number; total: number }
  | { name: "preview"; result: ParseResult; fileName: string }
  | { name: "uploading"; sent: number; total: number }
  | ({ name: "done" } & ImportTotals)
  | { name: "error"; message: string };

const BATCH = 500;

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    try {
      setStage({ name: "reading", done: 0, total: 0 });
      const inputs = await readInputFiles(files, (done, total) => setStage({ name: "reading", done, total }));
      // Let the progress UI paint before the synchronous parse
      await new Promise((r) => setTimeout(r, 0));
      const result = parseFiles(inputs);
      const fileName = files.length === 1 ? files[0].name : files[0].webkitRelativePath?.split("/")[0] || `${files.length} files`;
      setStage({ name: "preview", result, fileName });
    } catch (e) {
      setStage({ name: "error", message: (e as Error).message });
    }
  }

  async function upload(result: ParseResult, fileName: string) {
    const visits = result.visits;
    let jobId: string | undefined;
    const totals: ImportTotals = { inserted: 0, skipped: 0, merged: 0, ignoredDeleted: 0 };
    try {
      for (let i = 0; i < visits.length; i += BATCH) {
        setStage({ name: "uploading", sent: i, total: visits.length });
        const res = await api<{ jobId?: string } & ImportTotals>("/api/import", {
          method: "POST",
          json: { jobId, fileName, counts: jobId ? undefined : result.counts, visits: visits.slice(i, i + BATCH) },
        });
        jobId ??= res.jobId;
        for (const k of Object.keys(totals) as (keyof ImportTotals)[]) totals[k] += res[k] ?? 0;
      }
      setStage({ name: "done", ...totals });
    } catch (e) {
      setStage({ name: "error", message: (e as Error).message });
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Import your places</h1>
        <p className="mt-1 text-ink-2">Files are read on this device. Only the extracted locations are uploaded, never your photos.</p>
      </header>

      {(stage.name === "idle" || stage.name === "error") && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-accent bg-accent/5" : "border-line bg-surface"}`}
          >
            <FileArchive className="mx-auto size-10 text-accent" />
            <p className="mt-3 font-medium">
              <span className="md:hidden">Pick your Takeout .zip or Timeline.json</span>
              <span className="hidden md:inline">Drop a Takeout .zip, Timeline.json or folder here</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">Google Maps Takeout, phone Timeline export, or Google Photos Takeout</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button className="w-full sm:w-auto" onClick={() => fileInput.current?.click()}>
                <FileArchive className="size-4" /> Choose .zip / .json
              </Button>
              <Button variant="secondary" className="hidden md:inline-flex" onClick={() => folderInput.current?.click()}>
                <FolderOpen className="size-4" /> Choose folder
              </Button>
            </div>
            <input ref={fileInput} type="file" accept=".zip,.json,application/zip,application/json" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
            <input
              ref={folderInput}
              type="file"
              hidden
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            />
          </div>
          {stage.name === "error" && <p className="text-sm text-danger" role="alert">{stage.message}</p>}
          <HowTo />
        </>
      )}

      {stage.name === "reading" && (
        <Card className="flex items-center gap-3">
          <Spinner className="text-accent" />
          <span className="tabular">Reading files… {stage.total ? `${stage.done} / ${stage.total}` : ""}</span>
        </Card>
      )}

      {stage.name === "preview" && <Preview stage={stage} onCancel={() => setStage({ name: "idle" })} onImport={() => upload(stage.result, stage.fileName)} />}

      {stage.name === "uploading" && (
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <Spinner className="text-accent" />
            <span className="tabular">Saving {stage.sent} / {stage.total} visits…</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${(stage.sent / Math.max(stage.total, 1)) * 100}%` }} />
          </div>
        </Card>
      )}

      {stage.name === "done" && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-[#0ca30c]" /> Import complete
          </div>
          <p className="text-ink-2 tabular">
            {stage.inserted.toLocaleString()} new {stage.inserted === 1 ? "entry" : "entries"} added.
          </p>
          {(stage.skipped > 0 || stage.merged > 0 || stage.ignoredDeleted > 0) && (
            <ul className="space-y-1 text-sm text-ink-2 tabular">
              {stage.skipped > 0 && <li>{stage.skipped.toLocaleString()} already imported, skipped</li>}
              {stage.merged > 0 && <li>{stage.merged.toLocaleString()} matched a Timeline stay you already have, merged</li>}
              {stage.ignoredDeleted > 0 && <li>{stage.ignoredDeleted.toLocaleString()} you deleted before, kept deleted</li>}
            </ul>
          )}
          <div className="flex gap-2">
            <Link href="/map" className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink">View map</Link>
            <Button variant="secondary" onClick={() => setStage({ name: "idle" })}>Import more</Button>
          </div>
        </Card>
      )}
    </main>
  );
}

function Preview({ stage, onCancel, onImport }: { stage: Extract<Stage, { name: "preview" }>; onCancel: () => void; onImport: () => void }) {
  const { result, fileName } = stage;
  const dates = result.visits.map((v) => v.visitedAt).filter(Boolean).sort() as string[];
  const entries = Object.entries(result.counts) as [Source, number][];
  const tl = result.visits.filter((v) => v.source === "timeline" && v.visitedAt).map((v) => Date.parse(v.visitedAt!));
  // reduce, not Math.max(...tl): raw Records.json can hold millions of points
  const spanDays = tl.length ? (tl.reduce((a, b) => Math.max(a, b)) - tl.reduce((a, b) => Math.min(a, b))) / 86400000 : 0;
  const shortTimeline = tl.length > 0 && spanDays < 730;
  const timelineSpan = spanDays < 60 ? `${Math.max(1, Math.round(spanDays))} days` : `${Math.round(spanDays / 30)} months`;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold truncate">{fileName}</h2>
        <p className="text-sm text-ink-2 tabular">
          {result.filesRead} JSON files read · {result.filesUsed} with locations
        </p>
      </div>
      {entries.length ? (
        <>
          <table className="w-full text-sm">
            <tbody>
              {entries.sort((a, b) => b[1] - a[1]).map(([src, n]) => (
                <tr key={src} className="border-b border-line last:border-0">
                  <td className="py-2">{SOURCE_LABELS[src]}</td>
                  <td className="py-2 text-right tabular font-medium">{n}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 font-semibold">Total</td>
                <td className="pt-2 text-right tabular font-semibold">{result.visits.length}</td>
              </tr>
            </tbody>
          </table>
          {dates.length > 0 && (
            <p className="text-sm text-ink-2">
              From <b className="text-ink">{formatDate(dates[0])}</b> to <b className="text-ink">{formatDate(dates[dates.length - 1])}</b>
            </p>
          )}
          {shortTimeline && (
            <details className="rounded-xl bg-surface-2 p-3 text-sm">
              <summary className="cursor-pointer font-medium">This Timeline only covers {timelineSpan}. Missing older years?</summary>
              <div className="mt-2"><OlderHistoryTips /></div>
            </details>
          )}
          <p className="text-xs text-ink-2">Places you&apos;ve already imported are skipped, so it&apos;s safe to import the same export again.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={onImport} className="flex-1">Import {result.visits.length} visits</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2">No locations found in these files. Make sure the export includes the <b>Maps</b> and <b>Maps (your places)</b> folders, or a Timeline export.</p>
          <Button variant="secondary" onClick={onCancel}>Try another file</Button>
        </>
      )}
      {result.truncated.length > 0 && (
        <p className="rounded-xl bg-[#fab219]/15 p-3 text-xs text-ink">
          <b>{result.truncated.map((p) => p.split("/").pop()).join(", ")}</b> looks incomplete (the file ends early, usually because the
          transfer from your phone didn&apos;t finish). Everything before the cut-off was recovered. To be sure nothing is missing,
          export it again and copy it over in full.
        </p>
      )}
      {result.errors.length > 0 && <p className="text-xs text-danger">{result.errors.length} files couldn&apos;t be read and were ignored.</p>}
    </Card>
  );
}

function HowTo() {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><Info className="size-4 text-accent" /> Where to get your data</h2>
      <Card>
        <h3 className="font-medium">Google Takeout (reviews, photos, labelled places)</h3>
        <ol className="mt-2 list-decimal pl-5 text-sm text-ink-2 space-y-1">
          <li>Open <a className="text-accent" href="https://takeout.google.com" target="_blank" rel="noreferrer">takeout.google.com</a> and click <b>Deselect all</b>.</li>
          <li>Tick <b>Maps</b> and <b>Maps (your places)</b>. Optionally tick <b>Google Photos</b> for photo locations.</li>
          <li>Create the export, download the .zip and drop it here. You don&apos;t need to unzip it.</li>
        </ol>
      </Card>
      <Card>
        <h3 className="font-medium">Timeline (the full history of where you&apos;ve been)</h3>
        <p className="mt-1 text-sm text-ink-2">Google keeps Timeline on your phone now, so it isn&apos;t in Takeout.</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-ink-2 space-y-1">
          <li><b>Android:</b> Settings → Location → Location services → Timeline → <b>Export Timeline data</b>.</li>
          <li><b>iPhone:</b> Google Maps → your profile → Settings → Personal content → <b>Export Timeline data</b>.</li>
          <li>Then import the <code>Timeline.json</code> file here. Older <code>Semantic Location History</code> and <code>Records.json</code> exports also work.</li>
        </ul>
      </Card>
      <Card>
        <h3 className="font-medium">Only seeing about a year of Timeline?</h3>
        <p className="mt-1 text-sm text-ink-2">
          When Timeline moved onto phones (2024–25), many people lost older history unless backup was on. A phone can only export what it still has.
        </p>
        <div className="mt-2"><OlderHistoryTips /></div>
      </Card>
    </div>
  );
}

function OlderHistoryTips() {
  return (
    <ol className="list-decimal pl-5 text-sm text-ink-2 space-y-1.5">
      <li>
        <b>Restore your backup:</b> Google Maps → profile → Your Timeline → tap the <b>cloud icon</b>. If a backup is listed, import it, then export Timeline again.
      </li>
      <li><b>Check older phones:</b> Timeline is stored per device, so export from any phone that still has it.</li>
      <li>
        <b>Old Takeout downloads:</b> search Google Drive or Downloads for earlier Takeout zips containing <code>Location History</code>. Drop them here as they are.
      </li>
      <li>
        <b>Fill older years from photos:</b> export just <b>Google Photos</b> at{" "}
        <a className="text-accent" href="https://takeout.google.com" target="_blank" rel="noreferrer">takeout.google.com</a>. Every geotagged photo becomes a dated visit, and only the small JSON files are read.
      </li>
      <li><b>Keep it from happening again:</b> Timeline settings → Auto-delete → <b>Don&apos;t auto-delete</b>, and turn Backup on.</li>
    </ol>
  );
}
