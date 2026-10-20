import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useGeocode, useNoaaTornadoes, useSettings, useTornadoMap, useTornadoPage } from "@/lib/hooks";
import type { LayerState } from "@/lib/types";
import { MapView, defaultLayers } from "@/components/map/MapView";
import { ErrorState, PageHeader } from "@/components/common/ui";
import { FILTER_KEYS, TornadoFilters, TornadoTable } from "@/components/tornado/TornadoFilters";

export default function DatabasePage() {
  const settings = useSettings();
  const source = useNoaaTornadoes();
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => Object.fromEntries(sp.entries()), [sp]);
  const [layers, setLayers] = useState<LayerState>(() => ({ ...defaultLayers(settings.default_basemap), alerts: false }));
  const sort = params.sort ?? "date";
  const order = params.order ?? "desc";
  const page = Number(params.page ?? 1);
  const filterParams = useMemo(() => Object.fromEntries(FILTER_KEYS.filter((k) => params[k]).map((k) => [k, params[k]])), [params]);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setGeocodeQuery(filterParams.q ?? ""), 350);
    return () => window.clearTimeout(timer);
  }, [filterParams.q]);
  const placeQuery = geocodeQuery.replace(/\b(?:tornado(?:es)?|ef?\s?\d|19\d{2}|20\d{2})\b/gi, " ").replace(/\s+/g, " ").trim();
  const geocode = useGeocode(placeQuery);
  const searchPlaces = geocode.data ?? [];
  const list = useTornadoPage({ ...filterParams, sort, order, page: String(page), page_size: "25" }, searchPlaces);
  const map = useTornadoMap(filterParams, true, searchPlaces);

  const update = (next: Record<string, string>) => setSp(next, { replace: true });

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader
        title="Tornado Database"
        subtitle={
          <>
            Worldwide records from multiple sources: NOAA SPC United States (1950–2025, 73,458 bundled records), 2026 NOAA NCEI reports, and Japan Meteorological Agency (JMA) confirmed tornadoes from 1961 onward. Choose a country to filter. International coverage is not yet comprehensive; reporting and data availability vary by country. Current-year NOAA records may be revised.
            Source: <a className="text-tt-cyan hover:underline" href="https://www.data.jma.go.jp/stats/data/bosai/tornado/" target="_blank" rel="noreferrer">JMA Japan tornado database</a> (Japanese Government Standard Terms of Use v2.0). Values unavailable in a source are shown as “Not available”.
          </>
        }
      />
      <TornadoFilters value={filterParams} onChange={(f) => update({ ...f, sort, order })} />
      <section className="flex flex-col gap-3 rounded-2xl border border-tt-cyan/30 bg-tt-cyan/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-tt-text">Japan · Japan Meteorological Agency (JMA)</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-tt-muted">
            The same bundled JMA historical tornado records used in Historical Events, from 1961 onward. {source.data ? `${source.data.filter((t) => t.country === "Japan").length.toLocaleString()} records available.` : "Loading record count…"} Select Japan in the country filter to browse, map, and sort these records.
          </p>
        </div>
        <button type="button" onClick={() => update({ ...filterParams, country: "Japan", page: "1", sort, order })} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-tt-cyan/40 px-3 text-sm text-tt-cyan transition-colors hover:bg-tt-cyan/10">
          Show Japan records <ArrowRight className="size-3.5" />
        </button>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-tt-border bg-tt-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-tt-text">Europe · European Severe Weather Database (ESWD)</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-tt-muted">
            ESSL’s quality-controlled European severe-weather reports. Free public accounts can view up to 25 reports at a time; bulk CSV export is not available on public accounts, so ESWD records are not included in TornadT’s local results.
          </p>
        </div>
        <a href="https://www.eswd.eu/?lang=en_0" target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-tt-cyan/40 px-3 text-sm text-tt-cyan transition-colors hover:bg-tt-cyan/10">
          Search ESWD reports <ExternalLink className="size-3.5" />
        </a>
      </section>
      {source.isError && <ErrorState message="Could not load the bundled NOAA SPC tornado file." onRetry={() => source.refetch()} />}
      <MapView
        id="database"
        className="h-[380px]"
        layers={layers}
        onLayersChange={setLayers}
        points={map.data?.items}
        hud={
          map.data && (
            <div className="tt-glass pointer-events-none absolute bottom-2.5 right-14 z-[850] rounded-md px-2 py-1 text-[10px] text-tt-muted">
              Showing {map.data.items.length.toLocaleString()} of {map.data.total.toLocaleString()} matches{map.data.truncated ? " (strongest first — refine filters to see all)" : ""}
            </div>
          )
        }
      />
      {list.isError && <ErrorState message="Could not load tornado records." onRetry={() => list.refetch()} />}
      <TornadoTable
        items={list.data?.items ?? []}
        total={list.data?.total ?? 0}
        page={page}
        pageSize={25}
        sort={sort}
        order={order}
        loading={list.isFetching}
        onSort={(s) => update({ ...filterParams, sort: s, order: s === sort ? (order === "asc" ? "desc" : "asc") : "desc" })}
        onPage={(p) => update({ ...filterParams, sort, order, page: String(p) })}
      />
    </div>
  );
}
