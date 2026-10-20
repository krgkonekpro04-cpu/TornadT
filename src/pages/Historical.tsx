import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend as RLegend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, MapPinned, Tornado as TornadoIcon, Wind } from "lucide-react";
import { useApp } from "@/lib/appState";
import { useNoaaTornadoes, useNotable, useOutbreaks, useSettings, useStats, useTornadoMap, useTornadoMedia, type FilterParams } from "@/lib/hooks";
import { locationLabel, MONTHS, US_STATES } from "@/lib/meteo";
import type { LayerState, Outbreak, Tornado, WikiImage } from "@/lib/types";
import { fmtDate, fmtInt } from "@/lib/units";
import { cn } from "@/lib/utils";
import { MapView, defaultLayers } from "@/components/map/MapView";
import { ErrorState, Loading, Metric, PageHeader, Panel, RatingBadge } from "@/components/common/ui";
import { Attribution, Lightbox, SmartImage } from "@/components/tornado/TornadoDetailPanel";

type Tab = "map" | "outbreaks" | "timeline" | "gallery" | "compare";
const field = "h-9 rounded-lg border border-tt-border bg-tt-bg2 px-2.5 text-sm text-tt-text focus:border-tt-accent/70 focus:outline-none";
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i);

function GalleryCard({ t, onEnlarge, onImageCount }: { t: Tornado; onEnlarge: (i: WikiImage) => void; onImageCount: (id: string, count: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const { data, isLoading, isError, refetch } = useTornadoMedia(t, visible);
  const { openTornado } = useApp();
  const images = data?.images ?? [];
  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (data) onImageCount(t.id, images.length);
  }, [data, images.length, onImageCount, t.id]);
  if (isLoading) return <div ref={ref} className="aspect-[4/3] animate-pulse rounded-xl bg-tt-card" />;
  if (!images.length) return <div ref={ref} className="break-inside-avoid rounded-xl border border-tt-border bg-tt-card p-3 text-xs text-tt-muted">
    {isError ? <><span>Photo sources could not be reached for {t.year} {locationLabel(t)}.</span> <button className="ml-1 text-tt-lilac hover:underline" onClick={() => refetch()}>Retry</button></> : `No verified tornado photograph found for ${t.year} ${locationLabel(t)}.`}
  </div>;
  return (
    <figure ref={ref} className="break-inside-avoid rounded-xl border border-tt-border bg-tt-card p-2.5">
      <div className={cn("grid gap-2", images.length > 1 && "sm:grid-cols-2")}>
        {images.map((img, index) => <div key={img.url}>
          <SmartImage fixedRatio img={img} alt={img.description ?? img.title} onClick={() => onEnlarge(img)} testId={`gallery-img-${t.id}${index ? `-${index}` : ""}`} />
          <Attribution img={img} />
        </div>)}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => openTornado(t.id)} className="flex items-center gap-2 text-left text-sm font-medium hover:text-tt-lilac">
          <RatingBadge rating={t.rating} mag={t.mag} /> {data.article?.title ?? `${t.year} ${data.place || t.state_name} tornado`}
        </button>
        <span className="text-[11px] text-tt-muted">{fmtInt(images.length)} verified photo{images.length === 1 ? "" : "s"}</span>
      </figcaption>
    </figure>
  );
}

function YearCompare() {
  const [a, setA] = useState("2011");
  const [b, setB] = useState(String(CURRENT_YEAR));
  const sa = useStats({ year: a });
  const sb = useStats({ year: b });
  const monthly = MONTHS.map((m, i) => ({ m, [a]: sa.data?.by_month[i]?.count ?? 0, [b]: sb.data?.by_month[i]?.count ?? 0 }));
  const ratings = (sa.data?.by_rating ?? []).map((r, i) => ({ r: r.label, [a]: r.count, [b]: sb.data?.by_rating[i]?.count ?? 0 }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select data-testid="compare-year-a" className={field} value={a} onChange={(e) => setA(e.target.value)}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <span className="text-tt-muted">vs</span>
        <select data-testid="compare-year-b" className={field} value={b} onChange={(e) => setB(e.target.value)}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[[a, sa.data], [b, sb.data]].map(([y, s]) => (
          <div key={String(y)} className="contents">
            <Metric testId={`compare-total-${y}`} label={`${y} · tornadoes`} value={s && typeof s !== "string" ? fmtInt(s.total) : "…"} />
            <Metric label={`${y} · fatalities`} value={s && typeof s !== "string" ? fmtInt(s.fatalities) : "…"} tone="#EF4444" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tornadoes by month">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid stroke="#222B42" vertical={false} />
                <XAxis dataKey="m" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: "#11182A", border: "1px solid #222B42", borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} />
                <RLegend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={a} fill="#A855F7" radius={[3, 3, 0, 0]} />
                <Bar dataKey={b} fill="#06B6D4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Tornadoes by rating">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={ratings}>
                <CartesianGrid stroke="#222B42" vertical={false} />
                <XAxis dataKey="r" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: "#11182A", border: "1px solid #222B42", borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} />
                <RLegend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={a} fill="#A855F7" radius={[3, 3, 0, 0]} />
                <Bar dataKey={b} fill="#06B6D4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function HistoricalPage() {
  const settings = useSettings();
  const { openTornado } = useApp();
  const [tab, setTab] = useState<Tab>("map");
  const [filters, setFilters] = useState<FilterParams>({ year: "2011" });
  const [activeOutbreak, setActiveOutbreak] = useState<Outbreak | null>(null);
  const [layers, setLayers] = useState<LayerState>(() => ({ ...defaultLayers(settings.default_basemap), alerts: false }));
  const [lightbox, setLightbox] = useState<WikiImage | null>(null);
  const [galleryRating, setGalleryRating] = useState("all");
  const [gallerySet, setGallerySet] = useState<"top100" | "all">("all");
  const [galleryLimit, setGalleryLimit] = useState(100);
  const [galleryImageCounts, setGalleryImageCounts] = useState<Record<string, number>>({});
  const reportGalleryImages = useCallback((id: string, count: number) => {
    setGalleryImageCounts((previous) => previous[id] === count ? previous : { ...previous, [id]: count });
  }, []);
  const galleryPhotosFound = Object.values(galleryImageCounts).reduce((sum, count) => sum + count, 0);
  const galleryRecordsChecked = Object.keys(galleryImageCounts).length;
  const map = useTornadoMap(filters, tab === "map");
  const outbreaks = useOutbreaks();
  const notable = useNotable();
  const allTornadoes = useNoaaTornadoes();
  const ratings = (filters.ratings ?? "").split(",").filter(Boolean);
  const set = (k: string, v: string) => {
    const n = { ...filters, [k]: v };
    if (!v) delete n[k];
    setFilters(n);
  };

  const showOutbreak = (o: Outbreak) => {
    setActiveOutbreak(o);
    setFilters({ start_date: o.start_date, end_date: o.end_date });
    setTab("map");
  };

  const timeline = useMemo(() => {
    const items: { date: string; kind: "tornado" | "outbreak"; t?: Tornado; o?: Outbreak }[] = [
      ...(notable.data ?? []).map((t) => ({ date: t.date, kind: "tornado" as const, t })),
      ...(outbreaks.data ?? []).map((o) => ({ date: o.start_date, kind: "outbreak" as const, o })),
    ];
    return items.sort((x, y) => x.date.localeCompare(y.date));
  }, [notable.data, outbreaks.data]);

  const galleryTornadoes = useMemo(() => {
    const records = (allTornadoes.data ?? []).filter((t) => galleryRating === "all" ? true : galleryRating === "U" ? t.mag == null : t.mag === Number(galleryRating));
    return records.sort((a, b) => b.fatalities - a.fatalities || (b.mag ?? -1) - (a.mag ?? -1) || b.date.localeCompare(a.date));
  }, [allTornadoes.data, galleryRating]);
  const top100Tornadoes = notable.data ?? [];

  const tabs: [Tab, string][] = [["map", "Map explorer"], ["outbreaks", "Outbreaks"], ["timeline", "Timeline"], ["gallery", "Image gallery"], ["compare", "Compare years"]];

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader title="Historical Events" subtitle="Explore documented US tornadoes on the map, browse major outbreaks and notable events chronologically, and compare activity across years." />
      <div className="flex flex-wrap gap-1 rounded-xl border border-tt-border bg-tt-card p-1">
        {tabs.map(([k, l]) => (
          <button key={k} data-testid={`historical-tab-${k}`} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors duration-150", tab === k ? "bg-tt-accent2 text-white" : "text-tt-muted hover:text-white")}>{l}</button>
        ))}
      </div>

      {tab === "map" && (
        <>
          <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-tt-border bg-tt-card p-3">
            <label className="space-y-1">
              <span className="tt-label block !text-[10px]">Year</span>
              <input data-testid="historical-year-input" type="number" min={1950} max={CURRENT_YEAR} className={cn(field, "w-28")} value={filters.year ?? ""} onChange={(e) => { setActiveOutbreak(null); setFilters({ ...Object.fromEntries(Object.entries(filters).filter(([k]) => !["start_date", "end_date"].includes(k))), ...(e.target.value ? { year: e.target.value } : {}) }); }} placeholder="Any" />
            </label>
            <label className="space-y-1">
              <span className="tt-label block !text-[10px]">From</span>
              <input data-testid="historical-start-date" type="date" className={field} value={filters.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="tt-label block !text-[10px]">To</span>
              <input data-testid="historical-end-date" type="date" className={field} value={filters.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="tt-label block !text-[10px]">State</span>
              <select data-testid="historical-state-select" className={field} value={filters.state ?? ""} onChange={(e) => set("state", e.target.value)}>
                <option value="">All states</option>
                {US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <div className="space-y-1">
              <span className="tt-label block !text-[10px]">Rating</span>
              <div className="flex gap-1">
                {["0", "1", "2", "3", "4", "5"].map((r) => (
                  <button key={r} data-testid={`historical-rating-${r}`} onClick={() => set("ratings", (ratings.includes(r) ? ratings.filter((x) => x !== r) : [...ratings, r]).join(","))} className={cn("h-9 rounded-md border px-2 tt-mono text-xs", ratings.includes(r) ? "border-tt-accent bg-tt-accent2/30 text-white" : "border-tt-border text-tt-muted")}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div data-testid="historical-count" className="ml-auto text-xs text-tt-muted">
              {map.isFetching ? "Loading…" : map.data ? `${fmtInt(map.data.total)} tornadoes${map.data.truncated ? ` · showing strongest ${fmtInt(map.data.items.length)}` : ""}` : ""}
            </div>
          </div>
          {activeOutbreak && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-tt-accent/40 bg-tt-accent2/10 px-3 py-2 text-sm">
              <Wind className="size-4 text-tt-accent" /> Showing SPC records dated {activeOutbreak.start_date} – {activeOutbreak.end_date}: <b>{activeOutbreak.title}</b>
              <button className="ml-auto text-xs text-tt-lilac hover:underline" onClick={() => { setActiveOutbreak(null); setFilters({ year: "2011" }); }}>Clear</button>
            </div>
          )}
          {map.isError && <ErrorState message="Could not load tornado records." />}
          <MapView id="historical" className="h-[620px]" layers={layers} onLayersChange={setLayers} points={map.data?.items} />
        </>
      )}

      {tab === "outbreaks" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {outbreaks.isLoading && <Loading />}
          {(outbreaks.data ?? []).map((o) => (
            <article key={o.id} data-testid={`outbreak-card-${o.id}`} className="flex flex-col rounded-2xl border border-tt-border bg-tt-card p-4 transition-colors duration-150 hover:border-tt-accent/50">
              <div className="tt-mono text-[11px] text-tt-lilac">{fmtDate(o.start_date)}{o.end_date !== o.start_date && ` – ${fmtDate(o.end_date)}`}</div>
              <h3 className="mt-1 font-heading text-base font-semibold leading-snug">{o.title}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><div className="tt-mono text-lg">{o.count}</div><div className="text-[10px] text-tt-muted">SPC records</div></div>
                <div><div className="tt-mono text-lg text-tt-red">{o.fatalities}</div><div className="text-[10px] text-tt-muted">fatalities</div></div>
                <div><div className="tt-mono text-lg text-tt-orange">{o.violent}</div><div className="text-[10px] text-tt-muted">(E)F4+</div></div>
              </div>
              {o.extract && <p className="mt-3 line-clamp-4 text-sm text-tt-text/85">{o.extract}</p>}
              <div className="mt-auto flex items-center gap-3 pt-3">
                <button data-testid={`outbreak-map-btn-${o.id}`} onClick={() => showOutbreak(o)} className="inline-flex items-center gap-1 rounded-md bg-tt-accent2 px-2.5 py-1.5 text-xs text-white hover:bg-tt-accent"><MapPinned className="size-3.5" /> Show on map</button>
                {o.wiki_title && <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(o.wiki_title.replace(/ /g, "_"))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-tt-lilac hover:underline">Wikipedia <ExternalLink className="size-3" /></a>}
              </div>
            </article>
          ))}
          <p className="text-[11px] text-tt-muted md:col-span-2 xl:col-span-3">Outbreak date windows follow the Wikipedia articles. Counts are all SPC tornado records dated inside each window and may include tornadoes not attributed to the outbreak.</p>
        </div>
      )}

      {tab === "timeline" && (
        <Panel testId="historical-timeline" title={`Notable tornadoes and outbreaks, 1950–${CURRENT_YEAR}`}>
          {(notable.isLoading || outbreaks.isLoading) && <Loading />}
          <ol className="relative ml-3 border-l border-tt-border">
            {timeline.map((it, i) => (
              <li key={`${it.kind}-${i}`} className="mb-4 ml-5">
                <span className={cn("absolute -left-[7px] mt-1.5 size-3.5 rounded-full border-2 border-tt-bg", it.kind === "outbreak" ? "bg-tt-cyan" : "bg-tt-accent")} />
                <div className="tt-mono text-[11px] text-tt-muted">{fmtDate(it.date)}</div>
                {it.t && (
                  <button data-testid={`timeline-item-${it.t.id}`} onClick={() => openTornado(it.t!.id)} className="flex items-center gap-2 text-left text-sm hover:text-tt-lilac">
                    <RatingBadge rating={it.t.rating} mag={it.t.mag} /> {it.t.wiki_title ?? `${it.t.year} ${it.t.state_name} tornado`} <span className="text-xs text-tt-muted">· {locationLabel(it.t)} · {it.t.fatalities} fatalities</span>
                  </button>
                )}
                {it.o && (
                  <button onClick={() => showOutbreak(it.o!)} className="flex items-center gap-2 text-left text-sm hover:text-tt-lilac">
                    <TornadoIcon className="size-4 text-tt-cyan" /> {it.o.title} <span className="text-xs text-tt-muted">· {it.o.count} records</span>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {tab === "gallery" && (
        <div>
          <p className="mb-3 text-sm text-tt-muted">Photo searches cover the loaded historical records. Each card shows every verified tornado photograph found; images load as you scroll.</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([["top100", "Top 100 notable"], ["all", "All historical records"]] as const).map(([value, label]) => <button key={value} onClick={() => { setGallerySet(value); setGalleryImageCounts({}); } } className={cn("rounded-lg border px-3 py-1.5 text-sm", gallerySet === value ? "border-tt-accent bg-tt-accent2 text-white" : "border-tt-border text-tt-muted hover:text-white")}>{label}</button>)}
            {gallerySet === "top100" ? <span className="ml-auto text-xs text-tt-muted">{notable.isLoading ? "Ranking notable tornadoes…" : `${fmtInt(top100Tornadoes.length)} tornadoes · ${fmtInt(galleryPhotosFound)} verified photos found in ${fmtInt(galleryRecordsChecked)} checked records`}</span> : <>
              <span className="text-xs text-tt-muted">Rating:</span>
              {[['all', 'All'], ['0', 'EF0'], ['1', 'EF1'], ['2', 'EF2'], ['3', 'EF3'], ['4', 'EF4'], ['5', 'EF5'], ['U', 'Unknown']].map(([value, label]) => (
                <button key={value} onClick={() => { setGalleryRating(value); setGalleryLimit(50); setGalleryImageCounts({}); }} className={cn("rounded-lg border px-2.5 py-1 text-xs", galleryRating === value ? "border-tt-accent bg-tt-accent2 text-white" : "border-tt-border text-tt-muted hover:text-white")}>{label}</button>
              ))}
              <span className="ml-auto text-xs text-tt-muted">{allTornadoes.isLoading ? "Loading historical records…" : `${fmtInt(Math.min(galleryLimit, galleryTornadoes.length))} of ${fmtInt(galleryTornadoes.length)} records · ${fmtInt(galleryPhotosFound)} photos found in ${fmtInt(galleryRecordsChecked)} checked records`}</span>
            </>}
          </div>
          {gallerySet === "top100" ? <div data-testid="famous-tornado-gallery" className="columns-1 gap-3 space-y-3 sm:columns-2 xl:columns-3">
            {top100Tornadoes.map((t) => <GalleryCard key={t.id} t={t} onEnlarge={setLightbox} onImageCount={reportGalleryImages} />)}
          </div> : <>
            {allTornadoes.isError && <ErrorState message="Could not load historical tornado records." />}
            <div data-testid="historical-gallery" className="columns-1 gap-3 space-y-3 sm:columns-2 xl:columns-3">
              {galleryTornadoes.slice(0, galleryLimit).map((t) => <GalleryCard key={t.id} t={t} onEnlarge={setLightbox} onImageCount={reportGalleryImages} />)}
            </div>
            {galleryLimit < galleryTornadoes.length && <button onClick={() => setGalleryLimit((n) => n + 50)} className="mt-4 rounded-lg border border-tt-border bg-tt-card px-4 py-2 text-sm text-tt-text hover:border-tt-accent">Load next 50 tornadoes</button>}
          </>}
          <Lightbox img={lightbox} onClose={() => setLightbox(null)} />
        </div>
      )}

      {tab === "compare" && <YearCompare />}
    </div>
  );
}
