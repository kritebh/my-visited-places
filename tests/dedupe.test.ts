import { describe, expect, it } from "vitest";
import { metersBetween, sameStay, StayIndex, timeRanges, type Stay } from "@/lib/dedupe";

const t = (iso: string) => new Date(iso).getTime();
const stay = (lat: number, lng: number, start: string, end?: string): Stay => ({ lat, lng, start: t(start), end: t(end ?? start) });

describe("stay matching", () => {
  it("measures distance", () => {
    // ~111 m per 0.001° latitude
    expect(metersBetween({ lat: 12.97, lng: 77.59 }, { lat: 12.971, lng: 77.59 })).toBeGreaterThan(105);
    expect(metersBetween({ lat: 12.97, lng: 77.59 }, { lat: 12.971, lng: 77.59 })).toBeLessThan(115);
  });

  it("treats overlapping nearby records as one stay", () => {
    const phone = stay(12.9716, 77.5946, "2023-05-01T10:00:00Z", "2023-05-01T12:00:00Z");
    // Older export: start a few minutes off, centroid ~80 m away
    const takeout = stay(12.9723, 77.5948, "2023-05-01T10:07:00Z", "2023-05-01T11:58:00Z");
    expect(sameStay(phone, takeout)).toBe(true);
  });

  it("keeps separate visits apart", () => {
    const morning = stay(12.9716, 77.5946, "2023-05-01T08:00:00Z", "2023-05-01T09:00:00Z");
    expect(sameStay(morning, stay(12.9716, 77.5946, "2023-05-01T15:00:00Z", "2023-05-01T16:00:00Z"))).toBe(false); // later same day
    expect(sameStay(morning, stay(12.99, 77.5946, "2023-05-01T08:30:00Z"))).toBe(false); // 2 km away
    // Back-to-back stays within the 15 min slack do merge
    expect(sameStay(morning, stay(12.9717, 77.5946, "2023-05-01T09:10:00Z"))).toBe(true);
  });

  it("finds overlaps with long stays that started earlier", () => {
    const idx = new StayIndex([stay(10, 76, "2023-05-01T20:00:00Z", "2023-05-02T09:00:00Z")]); // overnight
    expect(idx.has(stay(10.0005, 76, "2023-05-02T07:00:00Z"))).toBe(true);
    expect(idx.has(stay(10.0005, 76, "2023-05-03T07:00:00Z"))).toBe(false);
    idx.add(stay(11, 77, "2023-05-01T05:00:00Z"));
    expect(idx.has(stay(11, 77, "2023-05-01T05:05:00Z"))).toBe(true);
  });

  it("merges batch times into few query ranges", () => {
    const r = timeRanges([
      stay(0, 0, "2023-05-01T10:00:00Z"),
      stay(0, 0, "2023-05-01T18:00:00Z"),
      stay(0, 0, "2024-01-01T10:00:00Z"),
    ]);
    expect(r).toHaveLength(2);
  });
});

describe("place IDs", () => {
  it("never merges two different known places next door", () => {
    const cafe = { ...stay(12.9716, 77.5946, "2023-05-01T10:00:00Z", "2023-05-01T10:40:00Z"), placeId: "cafe" };
    const shop = { ...stay(12.9717, 77.5947, "2023-05-01T10:45:00Z", "2023-05-01T11:30:00Z"), placeId: "shop" };
    expect(sameStay(cafe, shop)).toBe(false);
    expect(sameStay(cafe, { ...shop, placeId: "cafe" })).toBe(true);
    expect(sameStay(cafe, { ...shop, placeId: undefined })).toBe(true);
  });
});
