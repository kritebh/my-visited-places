"use client";

import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import { isCandidatePath } from "./detect";
import type { InputFile } from "./util";

export type Progress = (done: number, total: number) => void;

/**
 * Reads only JSON entries from the selected files. Zips are read through their
 * central directory, so photos/videos inside are never decompressed.
 */
export async function readInputFiles(files: File[], onProgress?: Progress): Promise<InputFile[]> {
  const out: InputFile[] = [];
  const plain = files.filter((f) => !f.name.toLowerCase().endsWith(".zip"));
  const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));

  const plainJson = plain.filter((f) => isCandidatePath(f.webkitRelativePath || f.name));
  let total = plainJson.length;
  let done = 0;

  const zipEntries = await Promise.all(
    zips.map(async (zip) => {
      const reader = new ZipReader(new BlobReader(zip));
      const entries = (await reader.getEntries()).filter((e) => !e.directory && isCandidatePath(e.filename));
      total += entries.length;
      return { reader, entries };
    }),
  );

  for (const f of plainJson) {
    out.push({ path: f.webkitRelativePath || f.name, text: await f.text() });
    onProgress?.(++done, total);
  }

  for (const { reader, entries } of zipEntries) {
    for (const e of entries) {
      if (e.directory) continue;
      out.push({ path: e.filename, text: await e.getData(new TextWriter()) });
      onProgress?.(++done, total);
    }
    await reader.close();
  }
  return out;
}
