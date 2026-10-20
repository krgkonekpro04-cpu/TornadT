import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSaveSettings, useSettings } from "@/lib/hooks";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LocationSearch } from "@/components/common/LocationSearch";
import { PageHeader, Panel } from "@/components/common/ui";
import { isUsageAnalyticsConfigured, isUsageAnalyticsEnabled, setUsageAnalyticsEnabled } from "@/lib/usageAnalytics";

function Choice<K extends keyof Settings>({ k, label, options, value, onChange }: { k: K; label: string; options: [Settings[K], string][]; value: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-tt-border bg-tt-bg2 p-1">
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            data-testid={`settings-${String(k)}-${String(v)}`}
            onClick={() => onChange({ ...value, [k]: v })}
            className={cn("rounded-md px-3 py-1 text-xs transition-colors duration-150", value[k] === v ? "bg-tt-accent2 text-white" : "text-tt-muted hover:text-white")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const SOURCES = [
  ["Historical tornadoes", "NOAA SPC actual tracks, 1950–2025, plus a daily-checked NOAA NCEI 2026 Storm Events archive", "https://www.spc.noaa.gov/wcm/#data"],
  ["Current-year tornadoes", "NOAA NCEI Storm Events details archive; current-year records can be incomplete or revised", "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/"],
  ["Canada tornadoes", "Northern Tornadoes Project public event summaries; live records from 2017 onward, no API key required", "https://www.uwo.ca/ntp/"],
  ["Weather & forecasts", "Open-Meteo forecast and geocoding APIs (free, no key, CC BY 4.0)", "https://open-meteo.com/en/docs"],
  ["Radar", "RainViewer public weather maps API — observed radar frames", "https://www.rainviewer.com/api.html"],
  ["Severe alerts", "U.S. National Weather Service API (api.weather.gov)", "https://www.weather.gov/documentation/services-web-api"],
  ["Articles & photos", "Wikipedia (MediaWiki API) and Wikimedia Commons metadata", "https://www.mediawiki.org/wiki/API:Main_page"],
  ["Base maps", "OpenStreetMap, CARTO dark, Esri World Imagery", "https://www.openstreetmap.org/copyright"],
];

export default function SettingsPage() {
  const saved = useSettings();
  const save = useSaveSettings();
  const [s, setS] = useState<Settings>(saved);
  const [usageAnalyticsEnabled, setUsageAnalyticsEnabledState] = useState(isUsageAnalyticsEnabled);
  useEffect(() => setS(saved), [saved]);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader
        title="Settings"
        subtitle="Units, time display and map defaults. Saved on this device."
        actions={
          <Button data-testid="settings-save-btn" disabled={!dirty || save.isPending} onClick={() => save.mutate(s, { onSuccess: () => toast.success("Settings saved"), onError: () => toast.error("Could not save settings") })}>
            {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-12 lg:col-span-7" title="Units & display">
          <div className="divide-y divide-tt-border/70">
            <Choice k="temp_unit" label="Temperature" value={s} onChange={setS} options={[["C", "Celsius °C"], ["F", "Fahrenheit °F"]]} />
            <Choice k="wind_unit" label="Wind speed" value={s} onChange={setS} options={[["kmh", "km/h"], ["mph", "mph"], ["ms", "m/s"], ["kn", "knots"]]} />
            <Choice k="distance_unit" label="Distance & path size" value={s} onChange={setS} options={[["km", "km / m"], ["mi", "mi / yd"]]} />
            <Choice k="precip_unit" label="Precipitation" value={s} onChange={setS} options={[["mm", "mm"], ["in", "inches"]]} />
            <Choice k="time_format" label="Alert & radar times" value={s} onChange={setS} options={[["local", "Local"], ["utc", "UTC"]]} />
            <Choice k="default_basemap" label="Default base map" value={s} onChange={setS} options={[["dark", "Dark"], ["standard", "Standard"], ["satellite", "Satellite"]]} />
          </div>
        </Panel>
        <Panel className="col-span-12 lg:col-span-5" title="Home location">
          <p className="mb-2 text-sm">Current: <span data-testid="settings-home-name" className="text-tt-lilac">{s.home_name}</span> <span className="tt-mono text-xs text-tt-muted">({s.home_lat.toFixed(2)}, {s.home_lon.toFixed(2)})</span></p>
          <LocationSearch testId="settings-home-search" onSelect={(p) => setS({ ...s, home_name: p.name, home_lat: p.lat, home_lon: p.lon })} />
          <p className="mt-2 text-[11px] text-tt-muted">Used as the default location for the dashboard and weather page.</p>
        </Panel>
        <Panel className="col-span-12" title="Anonymous usage analytics">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl space-y-1">
              <p className="text-sm">Help the TornadT developer understand how many people use the app.</p>
              <p className="text-xs leading-relaxed text-tt-muted">
                When enabled, TornadT sends an anonymous app-open event and an active-use ping every five minutes to PostHog. It does not send your name, email, location, searches, or tornado records. A random ID is stored on this device so active devices can be counted. Usage data is visible only in the developer’s private PostHog account. You can turn this off at any time.
              </p>
              {!isUsageAnalyticsConfigured() && <p className="text-xs text-tt-orange">Analytics is not configured in this build, so no usage events are sent.</p>}
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usageAnalyticsEnabled}
                onChange={(event) => {
                  setUsageAnalyticsEnabledState(event.target.checked);
                  setUsageAnalyticsEnabled(event.target.checked);
                }}
                className="size-4 accent-tt-accent"
              />
              Share anonymous usage
            </label>
          </div>
        </Panel>
        <Panel className="col-span-12" title="Data sources & limitations">
          <ul className="space-y-2 text-sm">
            {SOURCES.map(([k, d, u]) => (
              <li key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="w-44 shrink-0 text-tt-muted">{k}</span>
                <a className="text-tt-lilac hover:underline" href={u} target="_blank" rel="noreferrer">{d}</a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-tt-muted">
            No API keys or TornadT server are required. NOAA tornado records are bundled with the app; settings, saved places and bookmarks are stored on this device. Weather and geocoding use Open-Meteo. Radar comes from RainViewer, and U.S. alerts come from the National Weather Service. Public data services can occasionally be unavailable.
            Weather grid overlays are coarse model analyses, not observations. Tornado paths are straight lines between documented start and end points.
          </p>
        </Panel>
      </div>
    </div>
  );
}
