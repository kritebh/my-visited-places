"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import Map, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type LngLatBoundsLike, type Map as MaplibreMap, type MapSourceDataEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import bbox from "@turf/bbox";
import type { RegionsResponse } from "@/lib/types";
import { useColorScheme } from "@/lib/useMedia";
import { BORDER, fillColor, GLOW, OUTLINE, POINT, SELECTED } from "./colors";

// See scripts/copy-maplibre-worker.mjs
setWorkerUrl("/maplibre-gl-worker.mjs");

export type View = "india" | "world";
export type RegionSelection = { kind: "country" | "state"; code: string; name: string };

export interface MapCanvasHandle {
  flyTo(lng: number, lat: number, zoom?: number): void;
  getCenter(): { lng: number; lat: number };
}

const INDIA_BOUNDS: LngLatBoundsLike = [[68.1, 6.5], [97.4, 37.1]];
const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
// Zoom at which world view switches from countries to states/provinces
const STATE_ZOOM = 3.5;
const REGION_SOURCES = ["countries", "india", "admin1"];

/**
 * The OpenFreeMap dark style asks for "circle-11" but its sprite only has
 * "circle_11". Serve such icons under the hyphenated name, waiting for the
 * sprite if tiles render before it has loaded.
 */
function aliasSpriteImages(map: MaplibreMap) {
  map.setMissingStyleImageResolver(async (id) => {
    const alias = id.replaceAll("-", "_");
    if (alias === id) return;
    if (!map.hasImage(alias)) {
      await new Promise<void>((resolve) => {
        const done = () => {
          if (!map.hasImage(alias)) return;
          map.off("data", done);
          resolve();
        };
        map.on("data", done);
        setTimeout(() => (map.off("data", done), resolve()), 5000);
      });
    }
    const img = map.hasImage(alias) && !map.hasImage(id) ? map.getImage(alias) : undefined;
    if (img) map.addImage(id, img.data, { pixelRatio: img.pixelRatio, sdf: img.sdf });
  });
}

interface Props {
  view: View;
  regions?: RegionsResponse;
  /** [minLng, minLat, maxLng, maxLat] of all visits, framed by the world view. */
  worldBounds?: [number, number, number, number];
  points?: FeatureCollection;
  admin1?: FeatureCollection;
  selected?: RegionSelection | null;
  onRegionClick?: (r: RegionSelection) => void;
  onPointClick?: (id: string) => void;
  /** Region details show in a small bottom card rather than a sheet/side panel. */
  compactPanel?: boolean;
  ref?: Ref<MapCanvasHandle>;
}

export default function MapCanvas({ view, regions, worldBounds, points, admin1, selected, onRegionClick, onPointClick, compactPanel, ref }: Props) {
  const scheme = useColorScheme();
  const mapRef = useRef<MapRef>(null);
  // Layer to slot our fills under. It belongs to one basemap style, so it is
  // ignored while a different style (light ↔ dark) loads.
  const [anchor, setAnchor] = useState<{ scheme: string; id?: string }>({ scheme });
  const beforeId = anchor.scheme === scheme ? anchor.id : undefined;
  const [styleReady, setStyleReady] = useState(0);

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat, zoom = 13) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200 }),
    getCenter: () => {
      const c = mapRef.current?.getCenter();
      return { lng: c?.lng ?? 0, lat: c?.lat ?? 0 };
    },
  }));

  const schemeRef = useRef(scheme);
  useEffect(() => {
    schemeRef.current = scheme;
  }, [scheme]);

  // Tidy the basemap: hide its borders (we draw our own), use English-only
  // labels with strong halos so they stay crisp over coloured regions, and
  // slot our fills above roads/rails but beneath every label.
  const onStyleLoad = useCallback(() => {
    const map = mapRef.current?.getMap() as MaplibreMap | undefined;
    // Mid style switch there is no style yet; "style.load" calls us again
    const style = map?.getStyle();
    if (!map || !style) return;
    const dark = schemeRef.current === "dark";
    // Only the basemap's layers; this also runs after our own layers exist
    const OWN = new Set(["countries", "admin1", "india", "points"]);
    const layers = (style.layers ?? []).filter((l) => !("source" in l && OWN.has(l.source as string)));
    for (const l of layers) {
      if (/^boundary/.test(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
      if (/^label_(village|other)|^place_(other|suburb|village)|^highway-shield|^road_shield|^airport/.test(l.id)) {
        map.setLayoutProperty(l.id, "visibility", "none");
        continue;
      }
      if (l.type !== "symbol" || !JSON.stringify(l.layout?.["text-field"] ?? "").includes("name")) continue;
      map.setLayoutProperty(l.id, "text-field", ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]);
      if (!/country/.test(l.id)) map.setLayoutProperty(l.id, "text-transform", "none");
      if (/water/.test(l.id)) continue; // keep the basemap's subtle sea/river names
      map.setPaintProperty(l.id, "text-color", dark ? "#e4e2dc" : "#3d3b37");
      map.setPaintProperty(l.id, "text-halo-color", dark ? "rgba(13,13,13,0.9)" : "rgba(255,255,255,0.95)");
      map.setPaintProperty(l.id, "text-halo-width", 1.6);
      map.setPaintProperty(l.id, "text-halo-blur", 0.4);
    }
    const lastLine = layers.findLastIndex((l) => (l.type === "line" || l.type === "fill") && !/^boundary/.test(l.id));
    setAnchor({ scheme: schemeRef.current, id: layers.slice(lastLine + 1).find((l) => l.type === "symbol")?.id });
    setStyleReady((n) => n + 1);
  }, []);

  // Push visit counts into feature-state so the fill expressions can read them.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !styleReady || !regions) return;
    const apply = () => {
      for (const src of REGION_SOURCES) {
        if (map.getSource(src)) map.removeFeatureState({ source: src });
      }
      for (const c of regions.countries) {
        if (map.getSource("countries")) map.setFeatureState({ source: "countries", id: c.code }, { visits: c.visits });
      }
      for (const s of regions.states) {
        const src = s.country === "IN" ? "india" : "admin1";
        if (map.getSource(src)) map.setFeatureState({ source: src, id: s.code }, { visits: s.visits });
      }
    };
    apply();
    // Style switches (light ↔ dark) recreate our sources and drop their
    // feature-state, however long the new style takes, so re-apply whenever
    // one of them is added again.
    const onSource = (e: MapSourceDataEvent) => {
      if (e.sourceDataType === "metadata" && REGION_SOURCES.includes(e.sourceId)) apply();
    };
    map.on("sourcedata", onSource);
    return () => {
      map.off("sourcedata", onSource);
    };
  }, [regions, admin1, styleReady]);

  // Camera follows the view toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (view === "india") {
      map.fitBounds(INDIA_BOUNDS, { padding: 24, duration: 900 });
    } else if (worldBounds) {
      const [x0, y0, x1, y1] = worldBounds;
      // Pad generously so a single-country history still shows its neighbours
      map.fitBounds([[x0 - 25, Math.max(y0 - 15, -60)], [x1 + 25, Math.min(y1 + 15, 75)]], { padding: 24, maxZoom: 3, duration: 900 });
    } else {
      map.flyTo({ center: [40, 22], zoom: 1.2, duration: 900 });
    }
  }, [view, styleReady > 0, !!worldBounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current;
      if (!map || !e.features?.length) return;
      const byLayer = (id: string) => e.features!.find((f) => f.layer.id === id);

      const cluster = byLayer("clusters");
      if (cluster) {
        const src = map.getSource("points") as GeoJSONSource;
        src.getClusterExpansionZoom(cluster.properties.cluster_id).then((zoom) => {
          const [lng, lat] = (cluster.geometry as GeoJSON.Point).coordinates;
          map.easeTo({ center: [lng, lat], zoom });
        });
        return;
      }
      const point = byLayer("point");
      if (point) return onPointClick?.(point.properties.id);

      const showStates = view === "india" || map.getZoom() >= STATE_ZOOM;
      const state = showStates ? byLayer("india-fill") ?? byLayer("admin1-fill") : undefined;
      const region = state ?? byLayer("countries-fill");
      if (!region) return;
      onRegionClick?.({ kind: state ? "state" : "country", code: region.properties.code, name: region.properties.name });

      // Frame the region in the part of the map the detail sheet leaves visible
      const [minX, minY, maxX, maxY] = bbox(region);
      const el = map.getContainer();
      const mobile = el.clientWidth < 768;
      map.fitBounds([[minX, minY], [maxX, maxY]], {
        padding: compactPanel
          ? { top: 90, left: 24, right: 24, bottom: 130 }
          : mobile
            ? { top: 110, left: 24, right: 24, bottom: el.clientHeight * 0.62 + 16 }
            : { top: 110, left: 40, bottom: 40, right: 420 },
        maxZoom: Math.max(map.getZoom(), 7),
        duration: 700,
      });
    },
    [view, onPointClick, onRegionClick, compactPanel],
  );

  // Fills fade at street level so the basemap stays readable when zoomed in
  const fade = (base: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 7, base, 10, base * 0.45, 13, base * 0.18];
  const statesOpacity = useMemo(
    () =>
      (view === "india"
        ? fade(0.82)
        : ["interpolate", ["linear"], ["zoom"], STATE_ZOOM - 1, 0, STATE_ZOOM, 0.82, 7, 0.82, 10, 0.37, 13, 0.15]) as ExpressionSpecification,
    [view],
  );
  const statesLineOpacity = useMemo(
    () =>
      view === "india"
        ? 0.95
        : (["interpolate", ["linear"], ["zoom"], STATE_ZOOM - 1, 0, STATE_ZOOM, 0.95] as ExpressionSpecification),
    [view],
  );
  const selCode = selected?.code ?? "";
  const round = { "line-join": "round", "line-cap": "round" } as const;

  return (
    <Map
      ref={(r) => {
        mapRef.current = r;
        if (r) aliasSpriteImages(r.getMap());
      }}
      mapStyle={STYLE[scheme]}
      initialViewState={{ bounds: INDIA_BOUNDS, fitBoundsOptions: { padding: 24 } }}
      onLoad={(e) => {
        onStyleLoad();
        // Fires once each later style (light ↔ dark) has fully loaded
        e.target.on("style.load", onStyleLoad);
      }}
      interactiveLayerIds={["clusters", "point", "india-fill", "admin1-fill", "countries-fill"]}
      onClick={onClick}
      cursor="pointer"
      dragRotate={false}
      touchPitch={false}
      maxPitch={0}
      fadeDuration={200}
      attributionControl={{ compact: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
      <GeolocateControl position="bottom-right" />

      <Source id="countries" type="geojson" data="/geo/countries.json" promoteId="code">
        <Layer
          id="countries-fill"
          type="fill"
          beforeId={beforeId}
          paint={{
            "fill-color": fillColor(scheme),
            // India view: neighbours recede so India's full outline stands out
            "fill-opacity":
              view === "india"
                ? ["interpolate", ["linear"], ["zoom"],
                    7, ["case", ["==", ["get", "code"], "IN"], 0.82, 0.3],
                    10, ["case", ["==", ["get", "code"], "IN"], 0.37, 0.15],
                    13, ["case", ["==", ["get", "code"], "IN"], 0.15, 0.08]]
                : fade(0.82),
          }}
        />
        <Layer
          id="countries-line"
          type="line"
          beforeId={beforeId}
          layout={round}
          paint={{ "line-color": OUTLINE[scheme], "line-opacity": 0.9, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.3, 6, 1] }}
        />
      </Source>

      <Source id="admin1" type="geojson" data={admin1 ?? EMPTY} promoteId="code">
        <Layer id="admin1-fill" type="fill" beforeId={beforeId} paint={{ "fill-color": fillColor(scheme), "fill-opacity": statesOpacity }} />
        <Layer id="admin1-line" type="line" beforeId={beforeId} layout={round} paint={{ "line-color": OUTLINE[scheme], "line-width": 0.7, "line-opacity": statesLineOpacity }} />
      </Source>

      <Source id="india" type="geojson" data="/geo/india-states.json" promoteId="code">
        <Layer id="india-fill" type="fill" beforeId={beforeId} paint={{ "fill-color": fillColor(scheme), "fill-opacity": statesOpacity }} />
        <Layer
          id="india-line"
          type="line"
          beforeId={beforeId}
          layout={round}
          paint={{ "line-color": OUTLINE[scheme], "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 8, 1.6], "line-opacity": statesLineOpacity }}
        />
      </Source>

      {/* India's national outline: a soft halo under a fine line */}
      <Layer
        id="india-border-glow"
        type="line"
        source="countries"
        beforeId={beforeId}
        filter={["==", ["get", "code"], "IN"]}
        layout={round}
        paint={{ "line-color": GLOW[scheme], "line-opacity": 0.18, "line-blur": 4, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 5, 8, 12] }}
      />
      <Layer
        id="india-border"
        type="line"
        source="countries"
        beforeId={beforeId}
        filter={["==", ["get", "code"], "IN"]}
        layout={round}
        paint={{ "line-color": BORDER[scheme], "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 1.4] }}
      />

      {/* Selected region: soft glow + crisp outline, from whichever source holds it */}
      {(["countries", "india", "admin1"] as const).flatMap((src) => {
        const filter: ExpressionSpecification = ["==", ["get", "code"], (selected?.kind === "country") === (src === "countries") ? selCode : ""];
        return [
          <Layer
            key={`${src}-glow`}
            id={`${src}-selected-glow`}
            type="line"
            source={src}
            beforeId={beforeId}
            filter={filter}
            layout={round}
            paint={{ "line-color": GLOW[scheme], "line-width": 8, "line-blur": 6, "line-opacity": 0.45 }}
          />,
          <Layer
            key={src}
            id={`${src}-selected`}
            type="line"
            source={src}
            beforeId={beforeId}
            filter={filter}
            layout={round}
            paint={{ "line-color": SELECTED[scheme], "line-width": 1.8 }}
          />,
        ];
      })}

      <Source id="points" type="geojson" data={points ?? EMPTY} cluster clusterRadius={48} clusterMaxZoom={13}>
        <Layer
          id="clusters-halo"
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": POINT[scheme],
            "circle-opacity": 0.18,
            "circle-blur": 0.4,
            "circle-radius": ["step", ["get", "point_count"], 17, 10, 20, 50, 24, 200, 27, 1000, 31],
          }}
        />
        <Layer
          id="clusters"
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": POINT[scheme],
            "circle-radius": ["step", ["get", "point_count"], 11, 10, 13, 50, 16, 200, 18, 1000, 21],
            "circle-stroke-width": 2,
            "circle-stroke-color": OUTLINE[scheme],
            "circle-stroke-opacity": 0.95,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Bold"],
            "text-size": ["step", ["get", "point_count"], 11, 50, 12, 1000, 13],
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#ffffff" }}
        />
        <Layer
          id="point-halo"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{ "circle-color": POINT[scheme], "circle-opacity": 0.2, "circle-blur": 0.4, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 7, 12, 12] }}
        />
        <Layer
          id="point"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": POINT[scheme],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3.5, 12, 6],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": OUTLINE[scheme],
          }}
        />
      </Source>
    </Map>
  );
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
