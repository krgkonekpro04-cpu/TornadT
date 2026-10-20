import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Layers, Pause, Play, RotateCcw } from "lucide-react";
import { MapView, defaultLayers } from "@/components/map/MapView";
import { ErrorState } from "@/components/common/ui";
import { useApp } from "@/lib/appState";
import { useRadar, useSettings } from "@/lib/hooks";
import type { GridVar, LayerState } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function RadarPage() {
  const settings = useSettings();
  const { location } = useApp();
  const radar = useRadar();
  const frames = radar.data?.frames.filter((f) => f.kind === "past") ?? [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState<LayerState>(() => ({ ...defaultLayers(settings.default_basemap), precipitation: true, tornadoes: false, paths: false, alerts: false }));
  useEffect(() => { if (frames.length) setIndex(frames.length - 1); }, [frames.length]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % frames.length), 800);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);
  const mapLayers = useMemo(() => layers, [layers]);
  const active = frames[index];
  const time = active ? new Date(active.time * 1000) : null;
  const selected = (name: string, on: () => void, value: boolean) => <button onClick={on} className={cn("rounded-md border px-2.5 py-1.5 text-xs", value ? "border-tt-accent bg-tt-accent/20 text-tt-lilac" : "border-tt-border text-tt-muted hover:text-white")}>{name}</button>;

  return (
    <div className="flex h-full min-h-[620px] flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 data-testid="page-title" className="text-2xl font-semibold tracking-tight">Live Radar</h1>
          <p className="text-sm text-tt-muted">Precipitation radar mosaic from <a className="text-tt-lilac hover:underline" href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a> — observed frames from the past 2 hours.</p>
        </div>
        <div className="max-w-[480px] rounded-xl border border-tt-cyan/30 bg-tt-cyan/5 px-3 py-2 text-xs leading-relaxed text-tt-cyan">
          Radar frames show observations, not forecasts. RainViewer map tiles are available through zoom 7 and are enlarged at closer views. Coverage depends on local radar networks.
        </div>
      </div>
      {radar.isError && <ErrorState message="Live radar is temporarily unavailable. Try refreshing in a moment." onRetry={() => radar.refetch()} />}
      <div className="relative min-h-[500px] flex-1 overflow-hidden rounded-2xl">
        <MapView
          id="radar"
          className="absolute inset-0 h-full rounded-2xl"
          layers={mapLayers}
          onLayersChange={setLayers}
          center={[20, 0]}
          zoom={2}
          place={location}
          showTornadoLayers={false}
          radar={radar.data && frames.length ? { host: radar.data.host, frames, index } : null}
          hud={
            <div className="tt-glass absolute bottom-3 left-1/2 z-[900] w-[min(820px,calc(100%-24px))] -translate-x-1/2 rounded-2xl p-3 shadow-2xl">
              <div className="flex items-center gap-2">
                <button aria-label="Previous radar frame" onClick={() => setIndex((i) => Math.max(0, i - 1))} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-tt-border hover:text-tt-lilac"><ChevronLeft className="size-4" /></button>
                <button aria-label={playing ? "Pause radar animation" : "Play radar animation"} onClick={() => setPlaying((v) => !v)} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tt-accent2 text-white">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
                <button aria-label="Next radar frame" onClick={() => setIndex((i) => Math.min(frames.length - 1, i + 1))} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-tt-border hover:text-tt-lilac"><ChevronRight className="size-4" /></button>
                <div className="min-w-0 flex-1 px-2">
                  <input aria-label="Radar timeline" type="range" min={0} max={Math.max(0, frames.length - 1)} value={Math.min(index, Math.max(0, frames.length - 1))} onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} className="w-full accent-tt-accent" />
                  <div className="flex justify-between text-[10px] text-tt-muted"><span>{frames[0] ? new Date(frames[0].time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span><span>{frames.length ? (index + 1) + "/" + frames.length : "Loading radar…"}</span><span>{frames.at(-1) ? new Date(frames.at(-1)!.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>
                </div>
                <div className="shrink-0 text-right"><div className="font-mono text-sm">{time ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC" : "—"}</div><div className="text-[10px] text-tt-cyan">{active ? "OBSERVED" : radar.isLoading ? "FETCHING" : "NO FRAME"}</div></div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-tt-border/70 pt-2">
                <span className="mr-1 flex items-center gap-1.5 text-xs text-tt-muted"><Layers className="size-3.5" /> Layers</span>
                {selected("Radar", () => setLayers((s) => ({ ...s, precipitation: !s.precipitation })), layers.precipitation)}
                {(["none", "wind"] as GridVar[]).map((grid) => selected(grid === "none" ? "Wind off" : "Wind", () => setLayers((s) => ({ ...s, grid })), layers.grid === grid))}
                {selected("NWS alerts", () => setLayers((s) => ({ ...s, alerts: !s.alerts })), layers.alerts)}
                <label className="ml-auto flex items-center gap-2 text-[11px] text-tt-muted">Radar opacity <input aria-label="Radar opacity" type="range" min="20" max="100" value={Math.round(layers.radarOpacity * 100)} onChange={(e) => setLayers((s) => ({ ...s, radarOpacity: Number(e.target.value) / 100 }))} className="w-24 accent-tt-accent" /></label>
                <button aria-label="Refresh radar" onClick={() => radar.refetch()} className="flex size-8 items-center justify-center rounded-lg border border-tt-border hover:text-tt-lilac"><RotateCcw className="size-3.5" /></button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
