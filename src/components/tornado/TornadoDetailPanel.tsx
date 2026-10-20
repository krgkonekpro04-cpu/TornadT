import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  Bookmark, BookmarkCheck, ExternalLink, GitCompareArrows, ImageOff, LocateFixed, Maximize2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/lib/appState";
import { useProfile, useSettings, useToggleFavorite, useTornado, useTornadoMedia, useWiki } from "@/lib/hooks";
import { locationLabel, windRange } from "@/lib/meteo";
import type { Tornado, WikiImage } from "@/lib/types";
import { distanceMi, fmtDate, fmtInt, fmtUsd, mphRange, NA, widthYd } from "@/lib/units";
import { BASEMAPS, SelectedTornadoLayer } from "@/components/map/layers";
import { ErrorState, Loading, Metric, RatingBadge } from "@/components/common/ui";

export function bboxOf(t: Tornado): [[number, number], [number, number]] {
  const lats = [t.start_lat, t.end_lat ?? t.start_lat];
  const lons = [t.start_lon, t.end_lon ?? t.start_lon];
  const pad = 0.08;
  return [[Math.min(...lats) - pad, Math.min(...lons) - pad], [Math.max(...lats) + pad, Math.max(...lons) + pad]];
}

function FitMini({ t }: { t: Tornado }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bboxOf(t), { padding: [20, 20], maxZoom: 12 });
  }, [map, t]);
  return null;
}

export function SmartImage({ img, alt, className, onClick, testId, fixedRatio }: { img: { thumb: string; width: number; height: number }; alt: string; className?: string; onClick?: () => void; testId?: string; fixedRatio?: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const ratio = fixedRatio ? 4 / 3 : img.width && img.height ? img.width / img.height : 4 / 3;
  return (
    <button type="button" onClick={onClick} disabled={!onClick || state === "err"} className={`relative block w-full overflow-hidden rounded-xl bg-tt-bg2 ${className ?? ""}`} style={{ aspectRatio: String(Math.max(0.8, Math.min(ratio, 2))) }} data-testid={testId}>
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-tt-card to-tt-bg2" />}
      {state === "err" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-tt-muted"><ImageOff className="size-5" />Image failed to load</div>
      ) : (
        <img src={img.thumb} alt={alt} loading="lazy" onLoad={() => setState("ok")} onError={() => setState("err")} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]" />
      )}
    </button>
  );
}

export function Attribution({ img }: { img: WikiImage }) {
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-tt-muted">
      {img.description && <span className="text-tt-text/80">{img.description} </span>}
      {img.artist ? `Photo: ${img.artist}` : "Author not stated"} ·{" "}
      {img.license_url ? <a className="text-tt-lilac hover:underline" href={img.license_url} target="_blank" rel="noreferrer">{img.license ?? "License"}</a> : img.license ?? "License not stated"}{" "}
      · <a className="text-tt-lilac hover:underline" href={img.source_page} target="_blank" rel="noreferrer">Wikimedia Commons</a>
    </p>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-tt-border/60 py-2 text-sm last:border-0">
      <span className="text-tt-muted">{k}</span>
      <span className="text-right text-tt-text">{v}</span>
    </div>
  );
}

export function Lightbox({ img, onClose }: { img: WikiImage | null; onClose: () => void }) {
  return (
    <Dialog open={!!img} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[3000] bg-black/65"
        className="z-[3001] max-h-[92vh] max-w-[min(1100px,95vw)] overflow-y-auto border-tt-border bg-tt-bg2 p-3 sm:max-w-[min(1100px,95vw)]"
      >
        <div className="flex items-start justify-between gap-4 pr-1">
          <DialogTitle className="min-w-0 text-sm">{img?.title}</DialogTitle>
          <button type="button" onClick={onClose} aria-label="Close image preview" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-tt-border px-3 py-2 text-xs text-tt-text transition-colors hover:border-tt-lilac hover:text-tt-lilac focus-visible:outline-2 focus-visible:outline-tt-lilac">
            <X className="size-3.5" /> Close image
          </button>
        </div>
        {img && (
          <>
            <img src={img.url} alt={img.description ?? img.title} decoding="async" className="max-h-[75vh] w-full rounded-lg object-contain" />
            <Attribution img={img} />
            <a href={img.url} target="_blank" rel="noreferrer" className="text-xs text-tt-lilac hover:underline">Open original ({img.width}×{img.height})</a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WikiSection({ title, onEnlarge }: { title: string; onEnlarge: (i: WikiImage) => void }) {
  const { data, isLoading, isError, error } = useWiki(title);
  if (isLoading) return <Loading label="Loading Wikipedia article…" />;
  if (isError) {
    const notFound = (error as { status?: number }).status === 404;
    return <ErrorState message={notFound ? "No Wikipedia article found. The official NOAA record above is shown instead." : "Wikipedia is unreachable right now."} />;
  }
  if (!data) return null;
  return (
    <div data-testid="details-wikipedia" className="space-y-3">
      <div>
        <div className="font-heading text-base font-semibold">{data.title}</div>
        {data.description && <div className="text-xs text-tt-lilac">{data.description}</div>}
      </div>
      {data.extract && <p className="whitespace-pre-line text-sm leading-relaxed text-tt-text/90">{data.extract}</p>}
      <a data-testid="details-wiki-link" href={data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-tt-lilac hover:underline">
        Read the full article on Wikipedia <ExternalLink className="size-3.5" />
      </a>
      {data.images.length > 0 && (
        <div>
          <div className="tt-label mb-2 mt-2">Images from this article ({data.images.length})</div>
          <p className="mb-2 text-[11px] text-tt-muted">Only openly licensed images whose title or description identifies the tornado or funnel cloud are shown here.</p>
          <div data-testid="details-gallery" className="grid grid-cols-2 gap-2">
            {data.images.map((img, i) => (
              <div key={img.url}>
                <SmartImage fixedRatio testId={`details-gallery-img-${i}`} img={img} alt={img.description ?? img.title} onClick={() => onEnlarge(img)} />
                <p className="mt-1 line-clamp-2 text-[10px] text-tt-muted">{img.artist ?? "Author not stated"} · {img.license ?? "License not stated"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadPhoto({ title, onEnlarge }: { title: string; onEnlarge: (i: WikiImage) => void }) {
  const { data, isLoading } = useWiki(title);
  if (isLoading) return <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-tt-bg2" />;
  const img = data?.lead_image;
  if (!img) return null;
  return (
    <div data-testid="details-photo">
      <div className="relative">
        <SmartImage img={img} alt={`Lead image of the Wikipedia article “${data.title}”: ${img.description ?? img.title}`} onClick={() => onEnlarge(img)} />
        <button onClick={() => onEnlarge(img)} className="tt-glass absolute right-2 top-2 rounded-md p-1.5" aria-label="Enlarge image" data-testid="details-photo-enlarge">
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-tt-muted">Lead image of the Wikipedia article “{data.title}”.</p>
      <Attribution img={img} />
    </div>
  );
}

export function TornadoDetailPanel() {
  const { selectedTornado, openTornado, focusOn, compare, toggleCompare } = useApp();
  const { data: t, isLoading, isError } = useTornado(selectedTornado);
  const { data: media, isLoading: mediaLoading, isError: mediaError, refetch: retryMedia } = useTornadoMedia(t);
  const settings = useSettings();
  const { data: profile } = useProfile();
  const fav = useToggleFavorite();
  const [lightbox, setLightbox] = useState<WikiImage | null>(null);
  const isFav = !!t && !!profile?.favorite_tornadoes.includes(t.id);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !lightbox && openTornado(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [openTornado, lightbox]);

  if (!selectedTornado) return null;
  const wr = t ? windRange(t) : null;

  return (
    <aside
      data-testid="tornado-details-panel"
      aria-label="Tornado record details"
      className="tt-slide-in fixed bottom-0 right-0 top-16 z-[1100] flex w-full flex-col border-l border-tt-border bg-tt-bg2/97 shadow-[-12px_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:w-[460px]"
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-tt-border px-4 py-3">
        <div className="min-w-0 flex-1">
          {t ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <RatingBadge testId="details-rating" rating={t.rating} mag={t.mag} className="text-sm" />
                <span className="text-xs text-tt-muted">{t.country}</span>
              </div>
              <h2 data-testid="details-title" className="mt-1 truncate text-lg font-semibold tracking-tight">{media?.event_name ?? `${t.year} ${locationLabel(t)} tornado`}</h2>
              <p className="text-xs text-tt-muted"><span data-testid="details-date">{fmtDate(t.date)}</span> · {t.time} {t.tz} · {t.state_name}</p>
            </>
          ) : (
            <div className="text-sm text-tt-muted">Loading record…</div>
          )}
        </div>
        {t && (
          <>
            <button
              data-testid="storm-details-bookmark-btn"
              onClick={() => fav.mutate({ id: t.id, on: !isFav }, { onSuccess: () => toast.success(isFav ? "Removed from favorites" : "Saved to favorites") })}
              className="rounded-lg border border-tt-border p-2 text-tt-muted transition-colors duration-150 hover:text-white"
              aria-label={isFav ? "Remove bookmark" : "Bookmark tornado"}
              title={isFav ? "Remove bookmark" : "Bookmark tornado"}
            >
              {isFav ? <BookmarkCheck className="size-4 text-tt-accent" /> : <Bookmark className="size-4" />}
            </button>
            <button
              data-testid="details-compare-btn"
              onClick={() => {
                toggleCompare(t.id);
                toast(compare.includes(t.id) ? "Removed from comparison" : "Added to comparison — use Compare in the top bar");
              }}
              className={`rounded-lg border p-2 transition-colors duration-150 ${compare.includes(t.id) ? "border-tt-accent text-tt-accent" : "border-tt-border text-tt-muted hover:text-white"}`}
              aria-label="Add to comparison"
              title="Add to comparison"
            >
              <GitCompareArrows className="size-4" />
            </button>
          </>
        )}
        <button data-testid="storm-details-close-btn" onClick={() => openTornado(null)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-tt-border px-2.5 text-xs text-tt-muted transition-colors duration-150 hover:border-tt-lilac hover:text-white focus-visible:outline-2 focus-visible:outline-tt-lilac" aria-label="Close tornado details" title="Close tornado details">
          <X className="size-4" /> Close
        </button>
      </header>

      <div data-testid="details-scroll" className="tt-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ touchAction: "pan-y" }}>
        {isLoading && <Loading />}
        {isError && <ErrorState message="Could not load this record." />}
        {t && (
          <div className="space-y-5 pb-10">
            {media?.images[0] && <div data-testid="details-photo">
              <div className="relative"><SmartImage img={media.images[0]} alt={media.images[0].description ?? media.images[0].title} onClick={() => setLightbox(media.images[0])} />
                <button onClick={() => setLightbox(media.images[0])} className="tt-glass absolute right-2 top-2 rounded-md p-1.5" aria-label="Enlarge image"><Maximize2 className="size-3.5" /></button>
              </div>
              <p className="mt-1 text-[11px] text-tt-muted">{media.article ? `Lead image from Wikipedia article “${media.article.title}”.` : `Openly licensed image matched to ${media.place || t.state_name} and ${t.year}.`}</p>
              <Attribution img={media.images[0]} />
            </div>}

            <div className="grid grid-cols-2 gap-2">
              <Metric testId="details-fatalities" label="Fatalities" value={fmtInt(t.fatalities)} tone={t.fatalities ? "#EF4444" : undefined} />
              <Metric testId="details-injuries" label="Injuries" value={fmtInt(t.injuries)} tone={t.injuries ? "#F97316" : undefined} />
              <Metric testId="details-length" label="Path length" value={distanceMi(t.length_mi, settings)} />
              <Metric testId="details-width" label="Max path width" value={widthYd(t.width_yd, settings)} />
            </div>

            <section>
              <div className="tt-label mb-1">Official record · NOAA SPC</div>
              <Row k="Event date" v={fmtDate(t.date)} />
              <Row k="Start time" v={`${t.time} ${t.tz}`} />
              <Row k="End time" v={NA} />
              <Row k="Country" v={t.country} />
              <Row k="State" v={`${t.state_name} (${t.state})`} />
              <Row k="County / counties" v={t.counties.length ? t.counties.join(", ") : NA} />
              <Row k="Rating" v={`${t.rating} (${t.scale === "EF" ? "Enhanced Fujita" : "Fujita"} scale)`} />
              <Row k="Est. max wind" v={wr ? <span title="Wind range defined by the rating scale; not a measured value">{mphRange(wr[0], wr[1], settings)}<span className="block text-[10px] text-tt-muted">scale range, not measured</span></span> : NA} />
              <Row k="Damage" v={t.damage_usd != null ? fmtUsd(t.damage_usd) : t.damage_category ? `${t.damage_category} (SPC category)` : NA} />
              <Row k="States crossed" v={t.states_crossed || NA} />
              <Row k="Start location" v={<span className="tt-mono text-xs">{t.start_lat.toFixed(3)}, {t.start_lon.toFixed(3)}</span>} />
              <Row k="End location" v={t.end_lat != null ? <span className="tt-mono text-xs">{t.end_lat.toFixed(3)}, {t.end_lon?.toFixed(3)}</span> : NA} />
              {t.outbreak && <Row k="Outbreak window" v={t.outbreak} />}
              <Row k="SPC record id" v={<span className="tt-mono text-xs">{t.id}</span>} />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <div className="tt-label">Tornado path</div>
                <button
                  data-testid="details-zoom-to-event"
                  onClick={() => focusOn(bboxOf(t))}
                  className="inline-flex items-center gap-1 rounded-md border border-tt-border px-2 py-1 text-xs text-tt-lilac transition-colors duration-150 hover:border-tt-accent"
                >
                  <LocateFixed className="size-3.5" /> Zoom main map to event
                </button>
              </div>
              <div className="h-52 overflow-hidden rounded-xl border border-tt-border" data-testid="details-mini-map">
                <MapContainer key={t.id} center={[t.start_lat, t.start_lon]} zoom={9} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
                  <TileLayer url={BASEMAPS.dark.url} maxZoom={BASEMAPS.dark.maxZoom} maxNativeZoom={BASEMAPS.dark.maxNativeZoom} />
                  <TileLayer url={BASEMAPS.dark.labels!} maxZoom={BASEMAPS.dark.maxZoom} maxNativeZoom={BASEMAPS.dark.maxNativeZoom} />
                  <SelectedTornadoLayer t={t} />
                  <FitMini t={t} />
                </MapContainer>
              </div>
              <p className="mt-1.5 text-[11px] text-tt-muted">
                {t.end_lat != null
                  ? "Line connects the documented start and end points; the actual track may have curved."
                  : "Only a start point is documented for this record."}
              </p>
            </section>

            <section>
              <div className="tt-label mb-2">Event history &amp; photographs</div>
              {mediaLoading && <Loading label="Finding the tornado’s name and open photographs…" />}
              {mediaError && <ErrorState message="Could not reach the open photo sources for this tornado." onRetry={() => retryMedia()} />}
              {media?.article && <>
                {media.article.description && <div className="mb-2 text-sm text-tt-lilac">{media.article.description}</div>}
                {media.article.extract && <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-tt-text/90">{media.article.extract}</p>}
                <a href={media.article.url} target="_blank" rel="noreferrer" className="mb-3 inline-flex items-center gap-1 text-sm text-tt-lilac hover:underline">Read “{media.article.title}” on Wikipedia <ExternalLink className="size-3.5" /></a>
              </>}
              {media && media.images.length > 1 && <>
                <div className="tt-label mb-2 mt-3">More openly licensed photographs ({media.images.length - 1})</div>
                <p className="mb-2 text-[11px] text-tt-muted">Scroll to browse. Each photo links to its source and includes author and license details.</p>
                <div data-testid="details-gallery" className="grid grid-cols-2 gap-2">{media.images.slice(1).map((img, i) => <div key={img.url}>
                  <SmartImage fixedRatio testId={`details-gallery-img-${i}`} img={img} alt={img.description ?? img.title} onClick={() => setLightbox(img)} />
                  <Attribution img={img} />
                </div>)}</div>
              </>}
              {media && !media.images.length && !media.article && !mediaLoading && <p className="text-sm text-tt-muted">No confidently matched open photograph or Wikipedia article was found for this tornado. No unrelated storm images are substituted.</p>}
            </section>

            <section>
              <div className="tt-label mb-2">Sources</div>
              <ul className="space-y-1.5 text-sm">
                <li><a className="text-tt-lilac hover:underline" href="https://www.spc.noaa.gov/wcm/#data" target="_blank" rel="noreferrer">NOAA Storm Prediction Center — Severe Weather Database</a></li>
                <li><a className="text-tt-lilac hover:underline" href={`https://www.ncdc.noaa.gov/stormevents/listevents.jsp?eventType=%28C%29+Tornado&beginDate_mm=${String(t.month).padStart(2, "0")}&beginDate_dd=${String(t.day).padStart(2, "0")}&beginDate_yyyy=${t.year}&endDate_mm=${String(t.month).padStart(2, "0")}&endDate_dd=${String(t.day).padStart(2, "0")}&endDate_yyyy=${t.year}&statefips=-999%2CALL`} target="_blank" rel="noreferrer">NCEI Storm Events Database — tornadoes on this date</a></li>
                {media?.article && <li><a className="text-tt-lilac hover:underline" href={media.article.url} target="_blank" rel="noreferrer">Wikipedia — {media.article.title}</a></li>}
              </ul>
            </section>
          </div>
        )}
      </div>
      <Lightbox img={lightbox} onClose={() => setLightbox(null)} />
    </aside>
  );
}
