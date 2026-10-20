import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type L from "leaflet";
import { CircleMarker, MapContainer, ScaleControl, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, Expand, Layers, Minimize, RotateCcw } from "lucide-react";
import { useApp } from "@/lib/appState";
import { useSettings, useTornado } from "@/lib/hooks";
import type { Alert, LayerState, MapPoint, Place, RadarFrame } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertsLayer, BaseTiles, ClusterLayer, GridOverlay, LatestRadar, PathsLayer, RadarTiles, SelectedTornadoLayer } from "./layers";
import { LayerPanel } from "./LayerPanel";
import { Legend } from "./Legend";
import { LocationSearch } from "@/components/common/LocationSearch";

export const defaultLayers = (basemap: LayerState["basemap"] = "dark"): LayerState => ({
  basemap,
  precipitation: false,
  grid: "none",
  tornadoes: true,
  paths: true,
  alerts: true,
  radarOpacity: 0.75,
  gridOpacity: 0.6,
});

function Coords() {
  const [ll, setLl] = useState<{ lat: number; lng: number } | null>(null);
  const [z, setZ] = useState<number | null>(null);
  const map = useMapEvents({
    mousemove: (e) => setLl(e.latlng),
    zoomend: () => setZ(map.getZoom()),
  });
  useEffect(() => setZ(map.getZoom()), [map]);
  return (
    <div data-testid="map-coordinates" className="tt-glass tt-mono pointer-events-none absolute left-2.5 top-14 z-[800] rounded-md px-2 py-1 text-[10px] text-tt-lilac">
      {ll ? `${ll.lat.toFixed(4)}°, ${ll.lng.toFixed(4)}°` : "—"} · z{z}
    </div>
  );
}

function FocusHandler() {
  const map = useMap();
  const { focus } = useApp();
  const last = useRef(0);
  useEffect(() => {
    if (focus && focus.nonce !== last.current) {
      last.current = focus.nonce;
      map.flyToBounds(focus.bounds, { padding: [60, 60], maxZoom: 11, duration: 0.8 });
    }
  }, [focus, map]);
  return null;
}

function FlyTo({ place }: { place: Place | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (place) map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 8), { duration: 0.8 });
  }, [place, map]);
  return null;
}

interface Props {
  id: string;
  layers: LayerState;
  onLayersChange: (l: LayerState) => void;
  points?: MapPoint[];
  center?: [number, number];
  zoom?: number;
  place?: Place | null;
  flyToPlace?: boolean;
  radar?: { host: string; frames: RadarFrame[]; index: number } | null;
  alerts?: Alert[];
  onAlertClick?: (a: Alert) => void;
  cluster?: boolean;
  className?: string;
  hud?: ReactNode;
  showTornadoLayers?: boolean;
  onPlaceSearch?: (p: Place) => void;
  view?: { center: [number, number]; zoom: number };
}

const US_CENTER: [number, number] = [38.5, -96];

export function MapView({
  id, layers, onLayersChange, points = [], center = US_CENTER, zoom = 4, place, flyToPlace, radar, alerts, onAlertClick,
  cluster = true, className, hud, showTornadoLayers = true, onPlaceSearch,
  view,
}: Props) {
  const settings = useSettings();
  const { openTornado, selectedTornado } = useApp();
  const { data: selected } = useTornado(selectedTornado);
  const wrap = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fs, setFs] = useState(false);
  const [searchPlace, setSearchPlace] = useState<Place | null>(null);
  const [gridMeta, setGridMeta] = useState<{ t: string | null; err: boolean }>({ t: null, err: false });
  const onMeta = useCallback((t: string | null, err: boolean) => setGridMeta({ t, err }), []);


  useEffect(() => {
    const h = () => {
      setFs(document.fullscreenElement === wrap.current);
      window.setTimeout(() => map?.invalidateSize(), 150);
    };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, [map]);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  };
  const reset = () => map?.flyTo(center, zoom, { duration: 0.6 });
  const shownPlace = searchPlace ?? place ?? null;

  const btn = "tt-glass flex size-9 items-center justify-center rounded-lg text-tt-text transition-colors duration-150 hover:text-tt-lilac focus-visible:outline-2 focus-visible:outline-tt-accent";

  return (
    <div ref={wrap} data-testid={`${id}-map`} className={cn("relative isolate overflow-hidden rounded-2xl border border-tt-border bg-[#0A0E1A]", className)}>
      <MapContainer ref={setMap} center={center} zoom={zoom} minZoom={2} zoomControl={false} worldCopyJump className="h-full w-full" zoomSnap={0.5}>
        <BaseTiles basemap={layers.basemap} />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" />
        {layers.grid !== "none" && <GridOverlay variable={layers.grid} opacity={layers.gridOpacity} settings={settings} onMeta={onMeta} />}
        {layers.precipitation &&
          (radar ? <RadarTiles host={radar.host} frames={radar.frames} index={radar.index} opacity={layers.radarOpacity} /> : <LatestRadar opacity={layers.radarOpacity} />)}
        {layers.alerts && <AlertsLayer alerts={alerts} onSelect={onAlertClick} />}
        {showTornadoLayers && layers.paths && <PathsLayer points={points} onSelect={openTornado} />}
        {showTornadoLayers && layers.tornadoes && <ClusterLayer points={points} onSelect={openTornado} cluster={cluster} />}
        {selected && <SelectedTornadoLayer t={selected} />}
        {shownPlace && (
          <CircleMarker center={[shownPlace.lat, shownPlace.lon]} radius={7} pathOptions={{ color: "#F8FAFC", weight: 2, fillColor: "#06B6D4", fillOpacity: 1 }}>
            <Tooltip direction="top" permanent={false}>{shownPlace.name}</Tooltip>
          </CircleMarker>
        )}
        <FlyTo place={flyToPlace ? place : null} />
        <FlyTo place={searchPlace} />
        {view && <SyncView center={view.center} zoom={view.zoom} />}
        <FocusHandler />
        <Coords />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-[900] flex items-start justify-between gap-2">
        <div className="pointer-events-auto w-full max-w-xs">
          <LocationSearch
            testId={`${id}-map-search`}
            placeholder="Search a place on the map…"
            onSelect={(p) => {
              setSearchPlace(p);
              onPlaceSearch?.(p);
            }}
          />
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            <button data-testid={`${id}-layers-btn`} aria-label="Map layers" className={cn(btn, panelOpen && "!text-tt-accent")} onClick={() => setPanelOpen((v) => !v)}>
              <Layers className="size-4" />
            </button>
            <button data-testid={`${id}-reset-btn`} aria-label="Reset view" className={btn} onClick={reset}>
              <RotateCcw className="size-4" />
            </button>
            {place && (
              <button data-testid={`${id}-locate-btn`} aria-label="Go to selected location" className={btn} onClick={() => map?.flyTo([place.lat, place.lon], 9)}>
                <Crosshair className="size-4" />
              </button>
            )}
            <button data-testid={`${id}-fullscreen-btn`} aria-label="Toggle fullscreen" className={btn} onClick={toggleFs}>
              {fs ? <Minimize className="size-4" /> : <Expand className="size-4" />}
            </button>
          </div>
          {panelOpen && <LayerPanel layers={layers} onChange={onLayersChange} showTornado={showTornadoLayers} />}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-16 left-2.5 z-[850] flex flex-col items-start gap-2">
        {layers.grid !== "none" && (
          <div className="tt-glass rounded-md px-2 py-1 text-[10px] text-tt-muted">
            {gridMeta.err ? "Model grid unavailable right now" : `Open-Meteo model analysis${gridMeta.t ? ` · ${gridMeta.t} UTC` : ""} · not observations`}
          </div>
        )}
        <div className="pointer-events-auto hidden sm:block">
          <Legend layers={layers} settings={settings} />
        </div>
      </div>
      {hud}
    </div>
  );
}

function SyncView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.7 });
  }, [center[0], center[1], zoom, map]);
  return null;
}
