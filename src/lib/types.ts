export const SOURCES = [
  "review",
  "photo",
  "labelled",
  "edit",
  "geocode",
  "commute",
  "timeline",
  "gphotos",
  "manual",
] as const;

export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  review: "Review",
  photo: "Maps photo",
  labelled: "Labelled place",
  edit: "Suggested edit",
  geocode: "Geocode contribution",
  commute: "Commute",
  timeline: "Timeline",
  gphotos: "Google Photos",
  manual: "Added manually",
};

/** A visit extracted from an export, before region assignment. */
export interface NormalizedVisit {
  source: Source;
  lat: number;
  lng: number;
  /** ISO timestamp, absent for undated places (e.g. labelled places). */
  visitedAt?: string;
  endAt?: string;
  name?: string;
  address?: string;
  rating?: number;
  reviewText?: string;
  mapsUrl?: string;
  meta?: Record<string, string | number | boolean>;
}

/** Visit as returned by the API. */
export interface VisitDTO extends Omit<NormalizedVisit, "lat" | "lng"> {
  id: string;
  lat: number;
  lng: number;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
}

export interface RegionCount {
  code: string;
  name: string;
  country?: string;
  visits: number;
  places: number;
}

export interface RegionsResponse {
  countries: RegionCount[];
  states: RegionCount[];
}

export interface StatsResponse {
  totalVisits: number;
  places: number;
  countries: number;
  indiaStates: number;
  indiaStatesTotal: number;
  undated: number;
  firstVisit?: string;
  lastVisit?: string;
  byYear: { year: number; visits: number }[];
  bySource: { source: Source; visits: number }[];
  topStates: RegionCount[];
  years: number[];
}

export interface VisitFilters {
  year?: number;
  country?: string;
  state?: string;
}
