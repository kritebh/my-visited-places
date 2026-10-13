import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFiles } from "@/lib/parsers/detect";
import { parseLatLngString } from "@/lib/parsers/util";
import type { InputFile } from "@/lib/parsers/util";

const TAKEOUT = path.resolve(__dirname, "../../Takeout");

function readTree(dir: string, prefix = "Takeout"): InputFile[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    const rel = `${prefix}/${e.name}`;
    if (e.isDirectory()) return readTree(full, rel);
    return e.name.endsWith(".json") ? [{ path: rel, text: fs.readFileSync(full, "utf8") }] : [];
  });
}

describe.skipIf(!fs.existsSync(TAKEOUT))("sample Takeout", () => {
  const result = parseFiles(readTree(TAKEOUT));

  it("extracts visits from every geo-bearing Maps file", () => {
    expect(result.counts).toEqual({
      review: 138, // 150 reviews, 12 without coordinates
      photo: 111,
      labelled: 4,
      edit: 9,
      geocode: 1,
      commute: 1,
    });
    expect(result.errors).toEqual([]);
  });

  it("keeps review details", () => {
    const r = result.visits.find((v) => v.name === "A3 Billiards & Snooker Academy")!;
    expect(r).toMatchObject({ source: "review", rating: 5, visitedAt: "2026-10-06T14:51:03.580Z" });
    expect(r.lat).toBeCloseTo(12.8974685, 5);
  });

  it("dates photos by when they were taken", () => {
    const p = result.visits.find((v) => v.name === "2017-12-22-d51a6849.jpg")!;
    expect(p.visitedAt).toBe("2017-10-03T15:13:08.000Z");
  });

  it("dates suggested edits from the file name", () => {
    const e = result.visits.find((v) => v.name === "Shyam Vastralaya")!;
    expect(e.visitedAt).toBe(new Date(1516339873564).toISOString());
  });
});

describe("timeline formats", () => {
  it("parses Android semanticSegments", () => {
    const json = {
      semanticSegments: [
        {
          startTime: "2024-05-01T10:00:00.000+05:30",
          endTime: "2024-05-01T12:00:00.000+05:30",
          visit: { topCandidate: { placeId: "abc", semanticType: "HOME", placeLocation: { latLng: "12.9716°, 77.5946°" } } },
        },
        { startTime: "2024-05-01T12:00:00.000+05:30", activity: {} },
        { timelinePath: [{ point: "12.9°, 77.5°", time: "2024-05-01T12:10:00.000+05:30" }] },
      ],
    };
    const r = parseFiles([{ path: "Timeline.json", text: JSON.stringify(json) }]);
    expect(r.visits).toEqual([
      {
        source: "timeline",
        lat: 12.9716,
        lng: 77.5946,
        visitedAt: "2024-05-01T04:30:00.000Z",
        endAt: "2024-05-01T06:30:00.000Z",
        name: "Home",
        meta: { placeId: "abc" },
      },
    ]);
  });

  it("parses iOS array export", () => {
    const json = [
      {
        startTime: "2023-01-02T09:00:00.000Z",
        endTime: "2023-01-02T10:00:00.000Z",
        visit: { topCandidate: { placeID: "x", semanticType: "Unknown", placeLocation: "geo:48.858370,2.294481" } },
      },
      { startTime: "2023-01-02T10:00:00.000Z", activity: { start: "geo:48.85,2.29" } },
    ];
    const r = parseFiles([{ path: "location-history.json", text: JSON.stringify(json) }]);
    expect(r.counts).toEqual({ timeline: 1 });
    expect(r.visits[0]).toMatchObject({ lat: 48.85837, lng: 2.294481, visitedAt: "2023-01-02T09:00:00.000Z" });
  });

  it("parses legacy Semantic Location History", () => {
    const json = {
      timelineObjects: [
        {
          placeVisit: {
            location: { latitudeE7: 285244000, longitudeE7: 772185000, name: "Qutub Minar", address: "Delhi" },
            duration: { startTimestamp: "2019-03-01T05:00:00Z", endTimestamp: "2019-03-01T07:00:00Z" },
          },
        },
        { activitySegment: {} },
      ],
    };
    const r = parseFiles([{ path: "Takeout/Location History/Semantic Location History/2019/2019_MARCH.json", text: JSON.stringify(json) }]);
    expect(r.visits[0]).toMatchObject({ name: "Qutub Minar", lat: 28.5244, lng: 77.2185 });
  });

  it("collapses raw Records.json to one point per cell per day", () => {
    const locations = [
      { latitudeE7: 129716000, longitudeE7: 775946000, timestamp: "2020-01-01T01:00:00Z" },
      { latitudeE7: 129717000, longitudeE7: 775947000, timestamp: "2020-01-01T02:00:00Z" },
      { latitudeE7: 129716000, longitudeE7: 775946000, timestampMs: String(Date.parse("2020-01-02T01:00:00Z")) },
    ];
    const r = parseFiles([{ path: "Records.json", text: JSON.stringify({ locations }) }]);
    expect(r.visits).toHaveLength(2);
  });

  it("parses Google Photos sidecars and skips 0,0", () => {
    const files = [
      { path: "Takeout/Google Photos/Trip/IMG_1.jpg.supplemental-metadata.json", text: JSON.stringify({ title: "IMG_1.jpg", photoTakenTime: { timestamp: "1700000000" }, geoData: { latitude: 27.1751, longitude: 78.0421 } }) },
      { path: "Takeout/Google Photos/Trip/IMG_2.jpg.json", text: JSON.stringify({ title: "IMG_2.jpg", photoTakenTime: { timestamp: "1700000000" }, geoData: { latitude: 0, longitude: 0 } }) },
      { path: "Takeout/Google Photos/Trip/metadata.json", text: JSON.stringify({ title: "Trip" }) },
    ];
    const r = parseFiles(files);
    expect(r.counts).toEqual({ gphotos: 1 });
  });
});

describe("parseLatLngString", () => {
  it.each([
    ["12.97°, 77.59°", { lat: 12.97, lng: 77.59 }],
    ["geo:-33.86,151.2", { lat: -33.86, lng: 151.2 }],
    ["nonsense", undefined],
  ])("%s", (input, expected) => expect(parseLatLngString(input)).toEqual(expected));
});

describe("truncated files", () => {
  it("recovers complete segments from a Timeline.json cut off mid-file", () => {
    const full = JSON.stringify(
      {
        semanticSegments: [
          { startTime: "2025-01-01T10:00:00Z", visit: { topCandidate: { placeLocation: { latLng: "12.97°, 77.59°" } } } },
          { startTime: "2025-01-02T10:00:00Z", visit: { topCandidate: { placeLocation: { latLng: "25.16°, 86.09°" } } } },
        ],
        rawSignals: [{ wifiScan: { devicesRecords: [{ mac: 1, rawRssi: -70 }, { mac: 2, rawRssi: -71 }] } }],
      },
      null,
      2,
    );
    const cut = full.slice(0, full.indexOf('"rawRssi": -71') + 5);
    const r = parseFiles([{ path: "Timeline.json", text: cut }]);
    expect(r.counts).toEqual({ timeline: 2 });
    expect(r.truncated).toEqual(["Timeline.json"]);
    expect(r.errors).toEqual([]);
  });

  it("still reports files that are not JSON at all", () => {
    const r = parseFiles([{ path: "x.json", text: "not json" }]);
    expect(r.errors).toHaveLength(1);
  });
});
