import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { Marker, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Alert, Basemap, GridVar, MapPoint, RadarFrame, Settings, Tornado } from "@/lib/types";
import { CLOUD_STOPS, magColor, ramp, severityTone, TEMP_STOPS, TONE_COLOR, WIND_STOPS } from "@/lib/meteo";
import { useAlerts, useGrid, useRadar } from "@/lib/hooks";
import { temp, wind } from "@/lib/units";

export const BASEMAPS: Record<Basemap, { label: string; url: string; attribution: string; maxZoom: number; maxNativeZoom: number; labels?: string }> = {
  standard: {
    label: "Standard",
    url: "/tiles/osm/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  dark: {
    label: "Dark",
    url: "/tiles/esri-dark/{z}/{y}/{x}",
    attribution: "Base map &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    maxZoom: 18,
    maxNativeZoom: 16,
    labels: "/tiles/esri-dark-labels/{z}/{y}/{x}",
  },
  satellite: {
    label: "Satellite",
    url: "/tiles/esri-satellite/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
    maxNativeZoom: 18,
    labels: "/tiles/esri-reference/{z}/{y}/{x}",
  },
};

// RainViewer's public tiles are produced up to zoom 7; Leaflet upscales them beyond that.
export const RADAR_NATIVE_ZOOM = 7;

export function BaseTiles({ basemap }: { basemap: Basemap }) {
  const map = useMap();
  const b = BASEMAPS[basemap];
  useEffect(() => {
    map.setMaxZoom(b.maxZoom);
    if (map.getZoom() > b.maxZoom) map.setZoom(b.maxZoom);
  }, [map, b.maxZoom]);
  return (
    <>
      <TileLayer key={basemap} url={b.url} attribution={b.attribution} maxZoom={b.maxZoom} maxNativeZoom={b.maxNativeZoom} subdomains="abc" />
      {b.labels && <TileLayer key={`${basemap}-labels`} url={b.labels} maxZoom={b.maxZoom} maxNativeZoom={b.maxNativeZoom} zIndex={650} />}
    </>
  );
}

export function RadarTiles({ frames, index, opacity, host }: { frames: RadarFrame[]; index: number; opacity: number; host: string }) {
  const [readyFrames, setReadyFrames] = useState<Set<string>>(() => new Set());
  const [displayedPath, setDisplayedPath] = useState<string | null>(null);
  const frameSignature = frames.map((frame) => frame.path).join("|");
  useEffect(() => {
    setReadyFrames(new Set());
    setDisplayedPath(null);
  }, [frameSignature]);
  if (!frames.length) return null;
  const active = Math.min(Math.max(index, 0), frames.length - 1);
  const activePath = frames[active].path;
  const displayedIndex = readyFrames.has(activePath)
    ? active
    : frames.findIndex((frame) => frame.path === displayedPath);
  // Keep the visible frame on screen while the selected frame's tiles load.
  // Preload the next frame as well, but avoid mounting every timestamp at once.
  const warm = new Set([active, (active + 1) % frames.length, displayedIndex].filter((i) => i >= 0));
  return (
    <>
      {frames.map((f, i) => warm.has(i) && (
        <TileLayer
          key={f.path}
          url={`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`}
          opacity={i === displayedIndex ? opacity : 0}
          maxNativeZoom={RADAR_NATIVE_ZOOM}
          maxZoom={20}
          zIndex={400 + i}
          eventHandlers={{
            load: () => {
              setReadyFrames((ready) => ready.has(f.path) ? ready : new Set(ready).add(f.path));
              if (frames[active]?.path === f.path) setDisplayedPath(f.path);
            },
          }}
          attribution='Radar &copy; <a href="https://www.rainviewer.com/api.html">RainViewer</a>'
        />
      ))}
    </>
  );
}

/** Latest observed radar frame (used on dashboard-style maps without a timeline). */
export function LatestRadar({ opacity }: { opacity: number }) {
  const { data } = useRadar();
  const past = data?.frames.filter((f) => f.kind === "past") ?? [];
  if (!data || !past.length) return null;
  return <RadarTiles frames={[past[past.length - 1]]} index={0} opacity={opacity} host={data.host} />;
}

export function ClusterLayer({ points, onSelect, cluster = true }: { points: MapPoint[]; onSelect: (id: string) => void; cluster?: boolean }) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const cb = useRef(onSelect);
  cb.current = onSelect;

  useEffect(() => {
    const g: L.LayerGroup = cluster
      ? L.markerClusterGroup({
          chunkedLoading: true,
          showCoverageOnHover: false,
          maxClusterRadius: 42,
          spiderfyOnMaxZoom: true,
          iconCreateFunction: (c) => L.divIcon({ html: `<div>${c.getChildCount()}</div>`, className: "marker-cluster-tt", iconSize: L.point(40, 40) }),
        })
      : L.layerGroup();
    map.addLayer(g);
    groupRef.current = g;
    return () => {
      map.removeLayer(g);
    };
  }, [map, cluster]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.clearLayers();
    const markers = points.map((p) =>
      L.circleMarker([p.start_lat, p.start_lon], {
        radius: 4 + (p.mag ?? 0) * 0.9,
        color: "#0D1220",
        weight: 1,
        fillColor: magColor(p.mag),
        fillOpacity: 0.95,
      })
        .bindTooltip(`<b>${p.rating}</b> · ${p.date} · ${p.state}${p.fatalities ? ` · ${p.fatalities} fatalities` : ""}`)
        .on("click", () => cb.current(p.id)),
    );
    if (g instanceof L.MarkerClusterGroup) g.addLayers(markers);
    else markers.forEach((m) => g.addLayer(m));
  }, [points, cluster]);
  return null;
}

export function PathsLayer({ points, onSelect }: { points: MapPoint[]; onSelect: (id: string) => void }) {
  const map = useMap();
  const cb = useRef(onSelect);
  cb.current = onSelect;
  useEffect(() => {
    const renderer = L.canvas({ padding: 0.3 });
    const g = L.layerGroup();
    points.forEach((p) => {
      if (p.end_lat == null || p.end_lon == null) return;
      L.polyline([[p.start_lat, p.start_lon], [p.end_lat, p.end_lon]], {
        color: magColor(p.mag),
        weight: 2 + (p.mag ?? 0) * 0.6,
        opacity: 0.85,
        renderer,
      })
        .bindTooltip(`${p.rating} path · ${p.date} · ${p.length_mi ?? "?"} mi (documented start→end)`, { sticky: true })
        .on("click", () => cb.current(p.id))
        .addTo(g);
    });
    g.addTo(map);
    return () => {
      map.removeLayer(g);
    };
  }, [map, points]);
  return null;
}

export function SelectedTornadoLayer({ t }: { t: Tornado }) {
  const map = useMap();
  useEffect(() => {
    const g = L.layerGroup();
    const start = L.circleMarker([t.start_lat, t.start_lon], { radius: 8, color: "#F8FAFC", weight: 2, fillColor: "#A855F7", fillOpacity: 1 })
      .bindTooltip("Documented start point");
    start.addTo(g);
    if (t.end_lat != null && t.end_lon != null) {
      L.polyline([[t.start_lat, t.start_lon], [t.end_lat, t.end_lon]], { color: "#C4B5FD", weight: 6, opacity: 0.95 }).addTo(g);
      L.circleMarker([t.end_lat, t.end_lon], { radius: 7, color: "#F8FAFC", weight: 2, fillColor: "#0D1220", fillOpacity: 1 })
        .bindTooltip("Documented end point")
        .addTo(g);
    }
    g.addTo(map);
    return () => {
      map.removeLayer(g);
    };
  }, [map, t]);
  return null;
}

export function AlertsLayer({ alerts, onSelect }: { alerts?: Alert[]; onSelect?: (a: Alert) => void }) {
  const map = useMap();
  const { data } = useAlerts("active");
  const list = alerts ?? data?.items ?? [];
  const cb = useRef(onSelect);
  cb.current = onSelect;
  useEffect(() => {
    const g = L.layerGroup();
    list.forEach((a) => {
      if (!a.geometry) return;
      const color = TONE_COLOR[severityTone(a.severity, a.event)];
      L.geoJSON(a.geometry as GeoJSON.GeoJsonObject, {
        style: { color, weight: 2, fillColor: color, fillOpacity: a.is_active ? 0.18 : 0.06, dashArray: a.is_active ? undefined : "4 4" },
      })
        .bindTooltip(`<b>${a.event}</b><br/>${a.area_desc.slice(0, 120)}`, { sticky: true })
        .on("click", () => cb.current?.(a))
        .addTo(g);
    });
    g.addTo(map);
    return () => {
      map.removeLayer(g);
    };
  }, [map, list]);
  return null;
}

function useDebouncedBounds(): [number, number, number, number] | null {
  const map = useMap();
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const update = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const b = map.getBounds();
      const clamp = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
      setBbox([clamp(b.getSouth(), -84, 84), clamp(b.getWest(), -180, 179), clamp(b.getNorth(), -84, 84), clamp(b.getEast(), -179, 180)]);
    }, 450);
  };
  useMapEvents({ moveend: update });
  useEffect(() => {
    update();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return bbox;
}

function arrowIcon(deg: number, label: string) {
  return L.divIcon({
    className: "",
    iconSize: [44, 30],
    iconAnchor: [22, 15],
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;pointer-events:none">
      <svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${deg + 180}deg)"><path d="M12 2l5 9h-4v11h-2V11H7z" fill="#F8FAFC" stroke="#0D1220" stroke-width="1"/></svg>
      <span style="font:600 10px 'JetBrains Mono Variable',monospace;color:#F8FAFC;text-shadow:0 1px 2px #000">${label}</span></div>`,
  });
}
function textIcon(label: string) {
  return L.divIcon({
    className: "",
    iconSize: [44, 16],
    iconAnchor: [22, 8],
    html: `<div style="text-align:center;font:600 10px 'JetBrains Mono Variable',monospace;color:#F8FAFC;text-shadow:0 1px 2px #000;pointer-events:none">${label}</div>`,
  });
}

export function GridOverlay({ variable, opacity, settings, onMeta }: { variable: Exclude<GridVar, "none">; opacity: number; settings: Settings; onMeta?: (t: string | null, err: boolean) => void }) {
  const bbox = useDebouncedBounds();
  const { data, isError } = useGrid(bbox, true);
  useEffect(() => {
    onMeta?.(data?.model_time ?? null, isError);
  }, [data?.model_time, isError, onMeta]);
  const cells = useMemo(() => data?.cells ?? [], [data]);
  if (!data) return null;
  return (
    <>
      {cells.map((c) => {
        const v = variable === "temperature" ? c.temperature : variable === "wind" ? c.wind_speed : c.cloud_cover;
        if (v == null) return null;
        const color = ramp(variable === "temperature" ? TEMP_STOPS : variable === "wind" ? WIND_STOPS : CLOUD_STOPS, v);
        const bounds: L.LatLngBoundsExpression = [[c.lat - data.dlat / 2, c.lon - data.dlon / 2], [c.lat + data.dlat / 2, c.lon + data.dlon / 2]];
        const label = variable === "temperature" ? temp(v, settings) : variable === "wind" ? wind(v, settings) : `${Math.round(v)}%`;
        return (
          <Rectangle key={`${variable}-${c.lat}-${c.lon}`} bounds={bounds} pathOptions={{ stroke: false, fillColor: color, fillOpacity: opacity * 0.75 }}>
            <Tooltip sticky>{`${label} at ${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}`}</Tooltip>
          </Rectangle>
        );
      })}
      {cells.map((c) => {
        if (variable === "wind" && c.wind_speed != null && c.wind_direction != null)
          return <Marker key={`w-${c.lat}-${c.lon}`} position={[c.lat, c.lon]} icon={arrowIcon(c.wind_direction, wind(c.wind_speed, settings))} interactive={false} />;
        if (variable === "temperature" && c.temperature != null)
          return <Marker key={`t-${c.lat}-${c.lon}`} position={[c.lat, c.lon]} icon={textIcon(temp(c.temperature, settings))} interactive={false} />;
        return null;
      })}
    </>
  );
}
