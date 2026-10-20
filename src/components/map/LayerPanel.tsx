import type { Basemap, GridVar, LayerState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BASEMAPS, RADAR_NATIVE_ZOOM } from "./layers";

const GRIDS: { key: GridVar; label: string }[] = [
  { key: "none", label: "None" },
  { key: "temperature", label: "Temperature" },
  { key: "wind", label: "Wind" },
  { key: "clouds", label: "Cloud cover" },
];

function Toggle({ id, label, checked, onChange, hint }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 transition-colors duration-150 hover:bg-white/5">
      <input
        data-testid={`layer-toggle-${id}`}
        type="checkbox"
        className="mt-0.5 size-4 accent-[#A855F7]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm text-tt-text">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-tt-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Slider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block px-1.5">
      <span className="flex justify-between text-[11px] text-tt-muted">
        <span>{label}</span>
        <span className="tt-mono">{Math.round(value * 100)}%</span>
      </span>
      <input
        data-testid={`opacity-slider-${id}`}
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[#A855F7]"
        aria-label={label}
      />
    </label>
  );
}

export function LayerPanel({ layers, onChange, showTornado = true }: { layers: LayerState; onChange: (l: LayerState) => void; showTornado?: boolean }) {
  const set = (patch: Partial<LayerState>) => onChange({ ...layers, ...patch });
  return (
    <div data-testid="layer-panel" className="tt-glass tt-scroll max-h-[70vh] w-72 overflow-y-auto rounded-xl p-3">
      <div className="tt-label mb-2">Base map</div>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
          <button
            key={b}
            data-testid={`basemap-${b}`}
            onClick={() => set({ basemap: b })}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs transition-colors duration-150",
              layers.basemap === b ? "border-tt-accent bg-tt-accent2/30 text-white" : "border-tt-border text-tt-muted hover:text-white",
            )}
          >
            {BASEMAPS[b].label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 px-0.5 text-[11px] text-tt-muted">
        Max zoom {BASEMAPS[layers.basemap].maxZoom} (provider limit
        {BASEMAPS[layers.basemap].maxNativeZoom < BASEMAPS[layers.basemap].maxZoom ? `; imagery native to ${BASEMAPS[layers.basemap].maxNativeZoom}` : ""}).
      </p>

      <div className="tt-label mb-1 mt-4">Weather</div>
      <Toggle
        id="precip"
        label="Precipitation radar"
        checked={layers.precipitation}
        onChange={(v) => set({ precipitation: v })}
        hint={`RainViewer observations · native to zoom ${RADAR_NATIVE_ZOOM}, upscaled beyond`}
      />
      {layers.precipitation && <Slider id="radar" label="Radar opacity" value={layers.radarOpacity} onChange={(v) => set({ radarOpacity: v })} />}
      <div className="mt-2 px-1.5 text-[11px] text-tt-muted">Model grid overlay (Open-Meteo)</div>
      <div className="mt-1 grid grid-cols-2 gap-1.5 px-1.5">
        {GRIDS.map((g) => (
          <button
            key={g.key}
            data-testid={`grid-${g.key}`}
            onClick={() => set({ grid: g.key })}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs transition-colors duration-150",
              layers.grid === g.key ? "border-tt-accent bg-tt-accent2/30 text-white" : "border-tt-border text-tt-muted hover:text-white",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      {layers.grid !== "none" && <div className="mt-2"><Slider id="grid" label="Grid opacity" value={layers.gridOpacity} onChange={(v) => set({ gridOpacity: v })} /></div>}

      <div className="tt-label mb-1 mt-4">Storms</div>
      {showTornado && (
        <>
          <Toggle id="tornadoes" label="Historical tornadoes" checked={layers.tornadoes} onChange={(v) => set({ tornadoes: v })} hint="NOAA SPC start points, clustered" />
          <Toggle id="paths" label="Tornado paths" checked={layers.paths} onChange={(v) => set({ paths: v })} hint="Straight segment between documented start and end points" />
        </>
      )}
      <Toggle id="alerts" label="Severe weather alerts" checked={layers.alerts} onChange={(v) => set({ alerts: v })} hint="Active NWS polygons (United States only)" />
    </div>
  );
}
