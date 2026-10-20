import { BookmarkPlus, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/appState";
import { useAddLocation, useProfile, useRemoveLocation, useSettings, useWeather } from "@/lib/hooks";
import { LocationSearch } from "@/components/common/LocationSearch";
import { ErrorState, Loading, PageHeader, Panel } from "@/components/common/ui";
import { CurrentConditions, DailyList, HourlyStrip, SourceLine, WeatherCharts } from "@/components/weather/WeatherWidgets";

export default function WeatherPage() {
  const settings = useSettings();
  const { location, setLocation } = useApp();
  const wx = useWeather(location.lat, location.lon);
  const { data: profile } = useProfile();
  const add = useAddLocation();
  const remove = useRemoveLocation();
  const saved = profile?.locations ?? [];
  const isSaved = saved.some((l) => Math.abs(l.latitude - location.lat) < 0.01 && Math.abs(l.longitude - location.lon) < 0.01);

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader title="Weather" subtitle="Current conditions and forecasts for any city worldwide, from the Open-Meteo forecast API." />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <LocationSearch testId="weather-city-search-input" className="w-full lg:max-w-md" onSelect={(p) => setLocation(p)} />
        <div className="flex flex-wrap items-center gap-1.5">
          {saved.map((l) => (
            <span key={l.id} className="group flex items-center rounded-full border border-tt-border bg-tt-card text-xs">
              <button data-testid={`saved-location-${l.id}`} onClick={() => setLocation({ name: l.name, lat: l.latitude, lon: l.longitude })} className="flex items-center gap-1 py-1 pl-2.5 pr-1 hover:text-tt-lilac">
                <MapPin className="size-3 text-tt-cyan" /> {l.name.split(",")[0]}
              </button>
              <button aria-label={`Remove ${l.name}`} data-testid={`remove-location-${l.id}`} onClick={() => remove.mutate(l.id)} className="pr-2 text-tt-muted hover:text-tt-red"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Panel
          testId="weather-current"
          className="col-span-12 lg:col-span-5"
          title={<span data-testid="weather-location-name">{location.name}</span>}
          action={
            <Button
              data-testid="weather-save-location-btn"
              size="sm"
              variant="outline"
              disabled={isSaved || add.isPending}
              onClick={() => add.mutate({ name: location.name, latitude: location.lat, longitude: location.lon }, { onSuccess: () => toast.success("Location saved") })}
            >
              <BookmarkPlus className="size-3.5" /> {isSaved ? "Saved" : "Save location"}
            </Button>
          }
        >
          <p className="tt-mono mb-3 text-[11px] text-tt-muted">{location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°{wx.data?.elevation != null && ` · elev. ${Math.round(wx.data.elevation)} m`}</p>
          {wx.isLoading && <Loading label="Fetching Open-Meteo data…" />}
          {wx.isError && <ErrorState message="Could not load weather for this location. No conditions are shown rather than placeholder values." onRetry={() => wx.refetch()} />}
          {wx.data && (
            <>
              <CurrentConditions d={wx.data} s={settings} />
              <div className="mt-4"><SourceLine d={wx.data} /></div>
            </>
          )}
        </Panel>
        <Panel testId="weather-charts-panel" className="col-span-12 lg:col-span-7" title="Forecast charts">
          {wx.data ? <WeatherCharts d={wx.data} s={settings} /> : wx.isError ? <ErrorState message="Charts unavailable." /> : <Loading />}
        </Panel>
        <Panel className="col-span-12" title="Hourly forecast · next 48 hours">
          {wx.data ? <HourlyStrip d={wx.data} s={settings} hours={48} /> : <Loading />}
        </Panel>
        <Panel className="col-span-12" title="7-day forecast">
          {wx.data ? <DailyList d={wx.data} s={settings} /> : <Loading />}
        </Panel>
      </div>
    </div>
  );
}
