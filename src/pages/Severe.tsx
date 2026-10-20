import { useMemo, useState } from "react";
import L from "leaflet";
import { ExternalLink, Info, LocateFixed } from "lucide-react";
import { useApp } from "@/lib/appState";
import { useAlerts, useSettings } from "@/lib/hooks";
import { severityTone, TONE_COLOR, US_STATES } from "@/lib/meteo";
import type { Alert, LayerState } from "@/lib/types";
import { fmtDateTime, timeAgo } from "@/lib/units";
import { cn } from "@/lib/utils";
import { MapView, defaultLayers } from "@/components/map/MapView";
import { Empty, ErrorState, Loading, PageHeader } from "@/components/common/ui";

const CATS: [string, string][] = [
  ["tornado", "Tornado"], ["thunderstorm", "Severe thunderstorm"], ["flood", "Flood"], ["wind", "High wind"],
  ["winter", "Winter storm"], ["heat", "Heat"], ["fire", "Fire weather"], ["tropical", "Tropical"], ["other", "Other"],
];
const field = "h-9 rounded-lg border border-tt-border bg-tt-bg2 px-2.5 text-sm text-tt-text focus:border-tt-accent/70 focus:outline-none";

function AlertCard({ a, onFocus }: { a: Alert; onFocus: (a: Alert) => void }) {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const tone = severityTone(a.severity, a.event);
  const c = TONE_COLOR[tone];
  return (
    <article data-testid="alert-card" className="rounded-xl border border-tt-border bg-tt-card p-3.5" style={{ boxShadow: `inset 3px 0 0 ${c}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", tone === "red" && a.is_active && "tt-pulse")} style={{ color: c, background: `${c}22` }}>{a.event}</span>
        <span className="text-[11px] text-tt-muted">{a.severity} · {a.urgency} · {a.certainty}</span>
        <span data-testid="alert-status" className={cn("ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold", a.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-tt-muted")}>
          {a.is_active ? "ACTIVE" : a.message_type === "Cancel" ? "CANCELLED" : "EXPIRED"}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-tt-text">{a.headline ?? a.event}</p>
      <p className="mt-1 line-clamp-2 text-xs text-tt-muted">{a.area_desc}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-tt-muted sm:grid-cols-4">
        <span>Issued <span className="tt-mono text-tt-text">{fmtDateTime(a.sent, s)}</span></span>
        <span>Expires <span className="tt-mono text-tt-text">{fmtDateTime(a.ends ?? a.expires, s)}</span></span>
        <span className="col-span-2 truncate">By {a.sender_name}</span>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-tt-bg2/70 p-2.5 text-xs leading-relaxed text-tt-text/90">
          <p className="whitespace-pre-line">{a.description ?? "No description provided."}</p>
          {a.instruction && <p className="whitespace-pre-line text-[#FDBA74]">{a.instruction}</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button data-testid="alert-toggle-details" onClick={() => setOpen((o) => !o)} className="text-tt-lilac hover:underline">{open ? "Hide description" : "Show description"}</button>
        {a.geometry ? (
          <button data-testid="alert-zoom-btn" onClick={() => onFocus(a)} className="inline-flex items-center gap-1 text-tt-lilac hover:underline"><LocateFixed className="size-3" /> Show area</button>
        ) : (
          <span className="text-tt-muted">Zone-based alert · no polygon</span>
        )}
        <a data-testid="alert-source-link" href={a.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-tt-lilac hover:underline">Source <ExternalLink className="size-3" /></a>
      </div>
    </article>
  );
}

export default function SeverePage() {
  const settings = useSettings();
  const { focusOn } = useApp();
  const [status, setStatus] = useState<"active" | "all">("active");
  const [area, setArea] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [layers, setLayers] = useState<LayerState>(() => ({ ...defaultLayers(settings.default_basemap), tornadoes: false, paths: false }));
  const { data, isLoading, isError, refetch } = useAlerts(status, area || undefined);

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (cats.length) list = list.filter((a) => cats.includes(a.category));
    if (q.trim()) list = list.filter((a) => `${a.event} ${a.area_desc} ${a.headline ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    const rank = (a: Alert) => (a.is_active ? 0 : 10) + ({ red: 0, orange: 1, cyan: 2 } as const)[severityTone(a.severity, a.event)];
    return [...list].sort((x, y) => rank(x) - rank(y) || (y.sent ?? "").localeCompare(x.sent ?? ""));
  }, [data, cats, q]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.items ?? []).forEach((a) => { if (a.is_active) m[a.category] = (m[a.category] ?? 0) + 1; });
    return m;
  }, [data]);

  const focus = (a: Alert) => {
    if (!a.geometry) return;
    const b = L.geoJSON(a.geometry as GeoJSON.GeoJsonObject).getBounds();
    focusOn([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]);
    document.querySelector("[data-testid='alerts-map']")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader title="Severe Weather" subtitle="Official watches, warnings and advisories from the U.S. National Weather Service (api.weather.gov), refreshed every few minutes." />
      <div data-testid="alerts-coverage-note" className="flex items-start gap-2 rounded-xl border border-tt-cyan/30 bg-[#083344]/50 px-3 py-2 text-xs text-[#A5F3FC]">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{data?.coverage_note ?? "Covers the United States and its territories only."} If a region is not listed, TornadT has no official alert feed for it — absence here does not mean there is no danger. Always follow your national meteorological service.</span>
      </div>
      <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-tt-border bg-tt-card p-3">
        <div className="flex rounded-lg border border-tt-border p-0.5">
          {(["active", "all"] as const).map((k) => (
            <button key={k} data-testid={`alerts-status-${k}`} onClick={() => setStatus(k)} className={cn("rounded-md px-3 py-1.5 text-xs", status === k ? "bg-tt-accent2 text-white" : "text-tt-muted hover:text-white")}>
              {k === "active" ? "Active now" : "Recent (incl. expired)"}
            </button>
          ))}
        </div>
        <select data-testid="alerts-area-select" className={field} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All US states</option>
          {US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <input data-testid="alerts-search-input" className={cn(field, "w-56")} placeholder="Search event or area…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {CATS.map(([k, l]) => (
            <button key={k} data-testid={`alerts-cat-${k}`} onClick={() => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))} className={cn("rounded-full border px-2.5 py-1 text-[11px]", cats.includes(k) ? "border-tt-accent bg-tt-accent2/30 text-white" : "border-tt-border text-tt-muted hover:text-white")}>
              {l} {counts[k] ? <span className="tt-mono text-tt-lilac">{counts[k]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <MapView id="alerts" className="col-span-12 h-[420px] lg:sticky lg:top-4 lg:col-span-7 lg:h-[calc(100vh-180px)]" layers={layers} onLayersChange={setLayers} alerts={items} showTornadoLayers={false} />
        <div className="col-span-12 space-y-2.5 lg:col-span-5">
          <div className="flex items-center justify-between text-xs text-tt-muted">
            <span data-testid="alerts-count"><span className="tt-mono text-tt-text">{items.length}</span> alerts {status === "active" ? "in effect" : "issued recently"}</span>
            {data && <span>NWS fetched {timeAgo(data.fetched_at)}</span>}
          </div>
          {isLoading && <Loading label="Contacting the National Weather Service…" />}
          {isError && <ErrorState message="The NWS alert service is unreachable. No alerts are shown rather than outdated ones." onRetry={() => refetch()} />}
          {data && items.length === 0 && <Empty message="No alerts match these filters." />}
          {items.slice(0, 120).map((a) => <AlertCard key={a.id} a={a} onFocus={focus} />)}
          {items.length > 120 && <p className="text-xs text-tt-muted">Showing the 120 highest-priority alerts. Narrow the filters to see more.</p>}
        </div>
      </div>
    </div>
  );
}
