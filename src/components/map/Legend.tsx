import type { LayerState, Settings } from "@/lib/types";
import { CLOUD_STOPS, EF_COLORS, TEMP_STOPS, WIND_STOPS } from "@/lib/meteo";
import { temp, wind } from "@/lib/units";

function Gradient({ stops, labels }: { stops: [number, string][]; labels: string[] }) {
  const min = stops[0][0];
  const max = stops[stops.length - 1][0];
  const grad = stops.map(([v, c]) => `${c} ${((v - min) / (max - min)) * 100}%`).join(",");
  return (
    <div>
      <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${grad})` }} />
      <div className="mt-1 flex justify-between tt-mono text-[10px] text-tt-muted">
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

// RainViewer "Universal Blue" (scheme 2) — approximate reflectivity colours.
const RADAR_STOPS: [number, string][] = [[10, "#88DDEE"], [20, "#0099CC"], [30, "#0077AA"], [40, "#FFEE00"], [50, "#FF8800"], [60, "#FF0000"], [70, "#FFAAFF"]];

export function Legend({ layers, settings }: { layers: LayerState; settings: Settings }) {
  const blocks: { key: string; title: string; body: React.ReactNode }[] = [];
  if (layers.precipitation)
    blocks.push({
      key: "radar",
      title: "Radar reflectivity (dBZ, approx.)",
      body: <Gradient stops={RADAR_STOPS} labels={["10 light", "40", "70 extreme"]} />,
    });
  if (layers.grid === "temperature")
    blocks.push({ key: "t", title: "Temperature · model grid", body: <Gradient stops={TEMP_STOPS} labels={[temp(-30, settings), temp(0, settings), temp(40, settings)]} /> });
  if (layers.grid === "wind")
    blocks.push({ key: "w", title: "Wind speed · model grid", body: <Gradient stops={WIND_STOPS} labels={[wind(0, settings), wind(60, settings), wind(120, settings)]} /> });
  if (layers.grid === "clouds")
    blocks.push({ key: "c", title: "Cloud cover · model grid", body: <Gradient stops={CLOUD_STOPS} labels={["0%", "50%", "100%"]} /> });
  if (layers.tornadoes || layers.paths)
    blocks.push({
      key: "ef",
      title: `Tornado rating${layers.paths ? " · paths" : ""}`,
      body: (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1">
          {["0", "1", "2", "3", "4", "5", "U"].map((k) => (
            <span key={k} className="flex items-center gap-1 text-[11px] text-tt-text">
              <span className="size-2.5 rounded-full" style={{ background: EF_COLORS[k] }} />
              {k === "U" ? "Unk." : `(E)F${k}`}
            </span>
          ))}
        </div>
      ),
    });
  if (layers.alerts)
    blocks.push({
      key: "al",
      title: "NWS alert polygons",
      body: (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-tt-red" />Tornado / extreme</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-tt-orange" />Warnings</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-tt-cyan" />Advisories</span>
        </div>
      ),
    });
  if (!blocks.length) return null;
  return (
    <div data-testid="map-legend" className="tt-glass w-60 space-y-3 rounded-xl p-3">
      {blocks.map((b) => (
        <div key={b.key}>
          <div className="tt-label mb-1.5 !text-[10px]">{b.title}</div>
          {b.body}
        </div>
      ))}
    </div>
  );
}
