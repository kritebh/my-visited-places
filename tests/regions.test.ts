import { beforeAll, describe, expect, it } from "vitest";
import { assignRegion } from "@/lib/geo/regions";

describe("assignRegion", () => {
  // Loading the boundary files is slow on a busy machine; keep it out of the first case
  beforeAll(() => {
    assignRegion(0, 0);
  }, 60_000);

  it.each([
    ["Bengaluru", 12.9716, 77.5946, "IN", "IN-KA"],
    ["Lakhisarai", 25.164, 86.0927, "IN", "IN-BR"],
    ["Bhilai", 21.2348, 81.3457, "IN", "IN-CT"],
    ["Munnar", 10.5443, 76.1384, "IN", "IN-KL"],
    ["Leh", 34.1526, 77.5771, "IN", "IN-LA"],
    ["Gilgit (Indian claim)", 35.92, 74.31, "IN", "IN-LA"],
    ["Mumbai coast", 18.922, 72.8347, "IN", "IN-MH"],
    ["Paris", 48.8566, 2.3522, "FR", "FR-75"],
    ["Kathmandu", 27.7172, 85.324, "NP", undefined],
    ["Dubai", 25.1972, 55.2744, "AE", "AE-DU"],
  ])("%s", (_name, lat, lng, country, state) => {
    const r = assignRegion(lat, lng);
    expect(r.countryCode).toBe(country);
    if (state) expect(r.stateCode).toBe(state);
  });

  it("returns empty for open ocean", () => {
    expect(assignRegion(-30, -140)).toEqual({});
  });
});
