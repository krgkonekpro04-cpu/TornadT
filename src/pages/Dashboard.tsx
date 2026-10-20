import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { ArrowRight, ShieldAlert, Tornado as TornadoIcon } from "lucide-react";
import { useApp } from "@/lib/appState";
import { useAlerts, useNoaaTornadoes, useNotable, useSettings, useStats, useTornadoMap, useTornadoPage, useTornadoMedia, useWeather } from "@/lib/hooks";
import { EF_COLORS, locationLabel } from "@/lib/meteo";
import type { LayerState, Tornado } from "@/lib/types";
import { distanceMi, fmtDate, fmtInt } from "@/lib/units";
import { cn } from "@/lib/utils";
import { MapView, defaultLayers } from "@/components/map/MapView";
import { ErrorState, Loading, Metric, Panel, RatingBadge } from "@/components/common/ui";
import { CurrentConditions, DailyList, HourlyStrip, SourceLine } from "@/components/weather/WeatherWidgets";

export function TornadoListItem({ t, testId }: { t: Tornado; testId: string }) {
  const { openTornado } = useApp();
  const imageRef = useRef<HTMLButtonElement>(null);
  const [imageSearchVisible, setImageSearchVisible] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(() => new Set());
  const { data: media } = useTornadoMedia(t, imageSearchVisible);
  const image = media?.images.find((item) => !brokenImages.has(item.url));
  useEffect(() => {
    const node = imageRef.current;
    if (!node || imageSearchVisible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setImageSearchVisible(true); observer.disconnect(); }
    }, { rootMargin: "150px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [imageSearchVisible]);
  return (
    <button ref={imageRef} data-testid={testId} onClick={() => openTornado(t.id)} className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-colors duration-150 hover:border-tt-border hover:bg-tt-bg2/60">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-tt-bg2">
        {image ? (
          <img src={image.thumb} alt={image.description ?? image.title} loading="lazy" onError={() => setBrokenImages((previous) => new Set(previous).add(image.url))} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: `${EF_COLORS[t.mag == null ? "U" : String(t.mag)]}18` }}>
            <TornadoIcon className="size-5" style={{ color: EF_COLORS[t.mag == null ? "U" : String(t.mag)] }} />
          </div>
        )}
        {!!media?.images.length && <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold text-white" aria-label={`${media.images.length} tornado photos`}>{media.images.length} photo{media.images.length === 1 ? "" : "s"}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <RatingBadge rating={t.rating} mag={t.mag} />
          <span className="tt-mono text-[11px] text-tt-muted">{fmtDate(t.date)}</span>
        </div>
        <div className="mt-0.5 truncate text-sm text-tt-text group-hover:text-tt-lilac">{t.wiki_title ?? locationLabel(t)}</div>
        <div className="text-[11px] text-tt-muted">{t.fatalities > 0 ? <span className="text-tt-red">{t.fatalities} fatalities</span> : "No fatalities documented"} · {t.injuries} injuries</div>
        {media && media.images.length > 1 && <div className="mt-2 flex max-w-full gap-1 overflow-x-auto pb-1" aria-label={`${media.images.length - 1} more tornado photos`}>
          {media.images.filter((item) => item.url !== image?.url && !brokenImages.has(item.url)).map((item) => <img key={item.url} src={item.thumb} alt="" aria-hidden="true" loading="lazy" onError={() => setBrokenImages((previous) => new Set(previous).add(item.url))} className="size-9 shrink-0 rounded-md border border-tt-border object-cover" />)}
        </div>}
      </div>
    </button>
  );
}

const MAP_PARAMS = { ratings: "4,5" };

export default function Dashboard() {
  const settings = useSettings();
  const { location } = useApp();
  const [layers, setLayers] = useState<LayerState>(() => ({ ...defaultLayers(settings.default_basemap), precipitation: true }));
  const [tab, setTab] = useState<"recent" | "notable">("recent");
  const map = useTornadoMap(MAP_PARAMS);
  const wx = useWeather(location.lat, location.lon);
  const recent = useTornadoPage({ sort: "date", order: "desc", page_size: "6" });
  const notable = useNotable();
  const records = useNoaaTornadoes();
  const japanRecords = useMemo(() => (records.data ?? []).filter((t) => t.country === "Japan"), [records.data]);
  const japanStats = useStats({ country: "Japan" });
  const japanRecent = useTornadoPage({ country: "Japan", sort: "date", order: "desc", page_size: "3" });
  const stats = useStats({ country: "United States" });
  const alerts = useAlerts("active");
  const activeWarnings = alerts.data?.items.filter((a) => a.is_active && /warning/i.test(a.event)).length ?? 0;
  const tornadoWarnings = alerts.data?.items.filter((a) => a.is_active && /tornado warning/i.test(a.event)).length ?? 0;
  const notableList = useMemo(() => [...(notable.data ?? [])].reverse().slice(0, 6), [notable.data]);
  const decades = useMemo(() => {
    const m = new Map<number, number>();
    stats.data?.by_year.forEach((y) => m.set(Math.floor(y.year / 10) * 10, (m.get(Math.floor(y.year / 10) * 10) ?? 0) + y.count));
    return [...m.entries()].map(([d, c]) => ({ d: `${d}s`, c }));
  }, [stats.data]);

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tt-label">Storm overview</p>
          <h1 data-testid="page-title" className="text-2xl font-semibold tracking-tight sm:text-[28px]">Track the Storm. <span className="text-tt-lilac">Understand the Science.</span></h1>
        </div>
        <Link to="/alerts" data-testid="dashboard-alerts-chip" className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs", tornadoWarnings ? "tt-pulse border-tt-red/60 bg-[#450A0A] text-[#FCA5A5]" : "border-tt-border bg-tt-card text-tt-muted")}>
          <ShieldAlert className="size-4" />
          {alerts.isLoading ? "Checking NWS alerts…" : alerts.isError ? "NWS alerts unavailable" : `${tornadoWarnings} tornado warnings · ${activeWarnings} active US warnings`}
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <MapView
          id="dashboard"
          className="col-span-12 h-[480px] lg:col-span-8 lg:h-[640px] xl:col-span-9"
          layers={layers}
          onLayersChange={setLayers}
          points={map.data?.items}
          place={location}
          hud={
            <div className="tt-glass pointer-events-none absolute bottom-2.5 right-14 z-[850] hidden rounded-md px-2 py-1 text-[10px] text-tt-muted sm:block">
              {map.data ? `${map.data.items.length} violent (F4–F5) tornadoes in the current NOAA records · radar: RainViewer` : "Loading tornado records…"}
            </div>
          }
        />
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-4 lg:h-[640px] xl:col-span-3 xl:h-[640px]">
          <Panel testId="dashboard-weather-overview" title={<>Weather · <span className="text-tt-lilac">{location.name}</span></>} action={<Link to="/weather" className="text-xs text-tt-lilac hover:underline">Details</Link>}>
            {wx.isLoading && <Loading />}
            {wx.isError && <ErrorState message="Live weather is unavailable right now." onRetry={() => wx.refetch()} />}
            {wx.data && (
              <>
                <CurrentConditions d={wx.data} s={settings} compact />
                <div className="mt-3"><SourceLine d={wx.data} /></div>
              </>
            )}
          </Panel>
          <Panel
            testId="dashboard-recent-events"
            className="min-h-0 flex flex-1 flex-col overflow-hidden"
            title="Tornado records"
            action={
              <div className="flex gap-1 rounded-md border border-tt-border p-0.5 text-[11px]">
                {(["recent", "notable"] as const).map((k) => (
                  <button key={k} data-testid={`dashboard-events-tab-${k}`} onClick={() => setTab(k)} className={cn("rounded px-2 py-0.5 capitalize transition-colors duration-150", tab === k ? "bg-tt-accent2 text-white" : "text-tt-muted hover:text-white")}>
                    {k}
                  </button>
                ))}
              </div>
            }
          >
            <p className="mb-1 text-[11px] text-tt-muted">{tab === "recent" ? "Recent United States and international records." : "Notable records from the available official datasets."}</p>
            {(tab === "recent" ? recent.isLoading : notable.isLoading) && <Loading />}
            {(tab === "recent" ? recent.isError : notable.isError) && <ErrorState message="Could not load tornado records." />}
            <div className="tt-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {(tab === "recent" ? recent.data?.items ?? [] : notableList).map((t, i) => <TornadoListItem key={t.id} t={t} testId={`dashboard-event-${i}`} />)}
            </div>
            <Link to="/database" className="mt-2 inline-flex items-center gap-1 text-xs text-tt-lilac hover:underline">Open the database <ArrowRight className="size-3" /></Link>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Panel testId="dashboard-hourly" className="col-span-12 self-start xl:col-span-7" title="Next 24 hours">
          {wx.data ? <HourlyStrip d={wx.data} s={settings} /> : wx.isError ? <ErrorState message="Forecast unavailable." /> : <Loading />}
        </Panel>
        <Panel testId="dashboard-daily" className="col-span-12 self-start xl:col-span-5" title="7-day forecast">
          {wx.data ? <DailyList d={wx.data} s={settings} /> : wx.isError ? <ErrorState message="Forecast unavailable." /> : <Loading />}
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Panel testId="dashboard-stats" className="col-span-12 lg:col-span-3" title={`US tornado record · 1950–${new Date().getFullYear()}`} action={<Link to="/statistics" className="text-xs text-tt-lilac hover:underline">All statistics</Link>}>
          {stats.data ? (
            <div className="grid grid-cols-2 gap-2">
              <Metric testId="dashboard-stat-total" label="Tornadoes" value={fmtInt(stats.data.total)} />
              <Metric label="Fatalities" value={fmtInt(stats.data.fatalities)} tone="#EF4444" />
              <Metric label="Injuries" value={fmtInt(stats.data.injuries)} tone="#F97316" />
              <Metric label="Avg. path" value={distanceMi(stats.data.avg_length_mi, settings)} />
            </div>
          ) : stats.isError ? <ErrorState message="Statistics unavailable." /> : <Loading />}
          <p className="mt-2 text-[11px] text-tt-muted">Source: NOAA Storm Prediction Center (official US records only).</p>
        </Panel>
        <Panel testId="dashboard-japan-records" className="col-span-12 md:col-span-6 lg:col-span-3" title="Japan tornado record · JMA" action={<Link to="/database?country=Japan" className="text-xs text-tt-lilac hover:underline">Open Japan records</Link>}>
          {japanStats.data ? (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="JMA records" value={fmtInt(japanStats.data.total)} />
              <Metric label="Fatalities" value={fmtInt(japanStats.data.fatalities)} tone="#EF4444" />
            </div>
          ) : japanStats.isError ? <ErrorState message="Japan statistics unavailable." /> : <Loading />}
          <p className="mt-2 text-[11px] text-tt-muted">Japan Meteorological Agency records since 1961.</p>
          <div className="mt-1 max-h-28 overflow-y-auto">
            {japanRecent.data?.items.map((t) => <TornadoListItem key={t.id} t={t} testId={`dashboard-japan-event-${t.id}`} />)}
          </div>
          {!records.isLoading && <p className="mt-1 text-[10px] text-tt-muted">{fmtInt(japanRecords.length)} records loaded from the bundled JMA dataset.</p>}
        </Panel>
        <Panel className="col-span-12 md:col-span-6 lg:col-span-3" title="Tornadoes by rating · F and EF scales grouped">
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={stats.data?.by_rating ?? []}>
                <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ background: "#11182A", border: "1px solid #222B42", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="count" name="Tornadoes" radius={[4, 4, 0, 0]}>
                  {(stats.data?.by_rating ?? []).map((r) => <Cell key={r.label} fill={EF_COLORS[r.label.match(/\d/)?.[0] ?? "U"]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="col-span-12 md:col-span-6 lg:col-span-3" title="Recorded tornadoes per decade">
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={decades}>
                <XAxis dataKey="d" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ background: "#11182A", border: "1px solid #222B42", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="c" name="Tornadoes" stroke="#A855F7" fill="#A855F733" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-tt-muted">Rising counts largely reflect improved detection and reporting, not only climate.</p>
        </Panel>
      </div>
    </div>
  );
}
