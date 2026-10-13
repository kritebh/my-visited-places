/* eslint-disable @typescript-eslint/no-explicit-any -- export JSON is untyped */
import type { NormalizedVisit, Source } from "../types";
import { compact, fromE7, timestampFromFilename, toIso, visit } from "./util";

/** `Maps (your places)/Reviews.json`: GeoJSON FeatureCollection. */
export function parseReviews(json: any): NormalizedVisit[] {
  return compact(
    (json?.features ?? []).map((f: any) => {
      const [lng, lat] = f?.geometry?.coordinates ?? [];
      const p = f?.properties ?? {};
      return visit({
        source: "review",
        lat,
        lng,
        visitedAt: toIso(p.date),
        name: p.location?.name,
        address: p.location?.address,
        rating: typeof p.five_star_rating_published === "number" ? p.five_star_rating_published : undefined,
        reviewText: p.review_text_published,
        mapsUrl: p.google_maps_url,
      });
    }),
  );
}

/** `My labelled places/Labelled places.json`: Home, Work, … (undated). */
export function parseLabelledPlaces(json: any): NormalizedVisit[] {
  return compact(
    (json?.features ?? []).map((f: any) => {
      const [lng, lat] = f?.geometry?.coordinates ?? [];
      const p = f?.properties ?? {};
      return visit({ source: "labelled", lat, lng, name: p.name, address: p.address });
    }),
  );
}

/**
 * Photo sidecar JSON, used both by Maps "Photos and videos" and Google Photos
 * Takeout (`*.json` / `*.supplemental-metadata.json`).
 */
export function parsePhotoSidecar(json: any, source: Source = "photo"): NormalizedVisit[] {
  const geo = [json?.geoData, json?.geoDataExif].find((g) => g && (g.latitude || g.longitude));
  if (!geo) return [];
  const v = visit({
    source,
    lat: geo.latitude,
    lng: geo.longitude,
    visitedAt: toIso(json?.photoTakenTime?.timestamp ?? json?.creationTime?.timestamp),
    name: json?.title,
    meta: json?.url ? { url: json.url } : undefined,
  });
  return v ? [v] : [];
}

/** `Suggested edits to business establishments/<epochMs>.json` */
export function parseSuggestedEdit(json: any, path: string): NormalizedVisit[] {
  const point = (json?.pointChange?.operations ?? []).map((o: any) => o?.point).find(Boolean);
  if (!point) return [];
  const name = (json?.nameChange?.operations ?? []).map((o: any) => o?.text?.text).find(Boolean);
  const v = visit({
    source: "edit",
    lat: fromE7(point.latE7)!,
    lng: fromE7(point.lngE7)!,
    visitedAt: timestampFromFilename(path),
    name,
    mapsUrl: json?.placeUrl,
    meta: json?.editAction ? { action: json.editAction } : undefined,
  });
  return v ? [v] : [];
}

/** `Geocode contributions/<epochMs>.json` */
export function parseGeocodeContribution(json: any, path: string): NormalizedVisit[] {
  return compact(
    (json?.geocodes ?? []).map((g: any) =>
      visit({
        source: "geocode",
        lat: fromE7(g?.point?.latE7)!,
        lng: fromE7(g?.point?.lngE7)!,
        visitedAt: timestampFromFilename(path),
        address: g?.address?.text,
      }),
    ),
  );
}

/** `Commute routes/Commute routes.json` (undated). */
export function parseCommuteRoutes(json: any): NormalizedVisit[] {
  return compact(
    (json?.trips ?? []).flatMap((t: any) =>
      (t?.place_visit ?? []).map((pv: any) => {
        const ll = pv?.place?.lat_lng;
        if (!ll) return null;
        return visit({ source: "commute", lat: ll.latitude, lng: ll.longitude, name: "Commute destination" });
      }),
    ),
  );
}
