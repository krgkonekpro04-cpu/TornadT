import { useNavigate } from "react-router-dom";
import { Search, Trash2 } from "lucide-react";
import { useApp } from "@/lib/appState";
import { useProfile, useRemoveLocation, useRemoveSearch, useSettings, useToggleFavorite, useTornadoBatch, useWeather } from "@/lib/hooks";
import { wmo } from "@/lib/meteo";
import type { SavedLocation } from "@/lib/types";
import { temp, wind } from "@/lib/units";
import { Empty, ErrorState, Loading, PageHeader, Panel } from "@/components/common/ui";
import { TornadoListItem } from "./Dashboard";

function LocationCard({ l }: { l: SavedLocation }) {
  const s = useSettings();
  const nav = useNavigate();
  const { setLocation } = useApp();
  const wx = useWeather(l.latitude, l.longitude);
  const remove = useRemoveLocation();
  const [label, Icon] = wmo(wx.data?.current.weather_code);
  return (
    <div data-testid={`favorite-location-${l.id}`} className="flex items-center gap-3 rounded-xl border border-tt-border bg-tt-bg2/50 p-3">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { setLocation({ name: l.name, lat: l.latitude, lon: l.longitude }); nav("/weather"); }}>
        <Icon className="size-8 shrink-0 text-tt-lilac" strokeWidth={1.4} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{l.name}</div>
          <div className="text-xs text-tt-muted">
            {wx.isLoading ? "Loading…" : wx.isError ? "Weather unavailable" : `${temp(wx.data?.current.temperature_2m, s)} · ${label} · ${wind(wx.data?.current.wind_speed_10m, s)}`}
          </div>
        </div>
      </button>
      <button aria-label={`Remove ${l.name}`} data-testid={`favorite-location-remove-${l.id}`} onClick={() => remove.mutate(l.id)} className="rounded-md p-2 text-tt-muted hover:text-tt-red"><Trash2 className="size-4" /></button>
    </div>
  );
}

export default function FavoritesPage() {
  const nav = useNavigate();
  const { data: profile, isLoading, isError } = useProfile();
  const ids = profile?.favorite_tornadoes ?? [];
  const batch = useTornadoBatch(ids);
  const fav = useToggleFavorite();
  const removeSearch = useRemoveSearch();
  const tornadoes = ids.map((id) => batch.data?.find((t) => t.id === id)).filter((t) => !!t);

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader title="Favorites" subtitle="Bookmarked tornado records, saved locations and saved searches. Stored on the TornadT server for this shared profile." />
      {isLoading && <Loading />}
      {isError && <ErrorState message="Could not load your favorites." />}
      <div className="grid grid-cols-12 gap-4">
        <Panel testId="favorites-tornadoes" className="col-span-12 lg:col-span-6" title={`Bookmarked tornadoes (${ids.length})`}>
          {ids.length === 0 && <Empty message="No bookmarks yet. Open any tornado record and press the bookmark icon." />}
          {batch.isLoading && <Loading />}
          <div className="space-y-1">
            {tornadoes.map((t, i) => (
              <div key={t!.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1"><TornadoListItem t={t!} testId={`favorite-tornado-${i}`} /></div>
                <button aria-label="Remove bookmark" data-testid={`favorite-tornado-remove-${i}`} onClick={() => fav.mutate({ id: t!.id, on: false })} className="rounded-md p-2 text-tt-muted hover:text-tt-red"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </Panel>
        <div className="col-span-12 space-y-4 lg:col-span-6">
          <Panel testId="favorites-locations" title={`Saved locations (${profile?.locations.length ?? 0})`}>
            {profile && profile.locations.length === 0 && <Empty message="No saved locations. Use “Save location” on the Weather page." />}
            <div className="space-y-2">{profile?.locations.map((l) => <LocationCard key={l.id} l={l} />)}</div>
          </Panel>
          <Panel testId="favorites-searches" title={`Saved searches (${profile?.saved_searches.length ?? 0})`}>
            {profile && profile.saved_searches.length === 0 && <Empty message="No saved searches. Combine filters in the Tornado Database and press “Save search”." />}
            <div className="space-y-2">
              {profile?.saved_searches.map((s) => (
                <div key={s.id} data-testid={`saved-search-${s.id}`} className="flex items-center gap-3 rounded-xl border border-tt-border bg-tt-bg2/50 p-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/database?${new URLSearchParams(s.params).toString()}`)}>
                    <div className="flex items-center gap-2 text-sm font-medium"><Search className="size-3.5 text-tt-accent" /> {s.name}</div>
                    <div className="tt-mono mt-0.5 truncate text-[11px] text-tt-muted">{Object.entries(s.params).map(([k, v]) => `${k}=${v}`).join(" · ")}</div>
                  </button>
                  <button aria-label={`Delete ${s.name}`} data-testid={`saved-search-remove-${s.id}`} onClick={() => removeSearch.mutate(s.id)} className="rounded-md p-2 text-tt-muted hover:text-tt-red"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
