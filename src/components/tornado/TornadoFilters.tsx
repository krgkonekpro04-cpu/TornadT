import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Save, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/appState";
import { useAddSearch, useSettings, type FilterParams } from "@/lib/hooks";
import { locationLabel, US_STATES } from "@/lib/meteo";
import type { Tornado } from "@/lib/types";
import { distanceMi, fmtDate, fmtInt, widthYd } from "@/lib/units";
import { cn } from "@/lib/utils";
import { RatingBadge } from "@/components/common/ui";

export const FILTER_KEYS = ["q", "country", "state", "year", "start_date", "end_date", "ratings", "min_fatalities", "min_injuries", "min_length", "max_length"] as const;

const field = "h-9 w-full rounded-lg border border-tt-border bg-tt-bg2 px-2.5 text-sm text-tt-text placeholder:text-tt-muted focus:border-tt-accent/70 focus:outline-none";
const CURRENT_YEAR = new Date().getFullYear();
const JAPAN_PREFECTURES = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

export function TornadoFilters({ value, onChange, compact = false }: { value: FilterParams; onChange: (v: FilterParams) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const addSearch = useAddSearch();
  const set = (k: string, v: string) => {
    const next = { ...value, [k]: v };
    if (!v) delete next[k];
    delete next.page;
    onChange(next);
  };
  const ratings = (value.ratings ?? "").split(",").filter(Boolean);
  const toggleRating = (r: string) => set("ratings", (ratings.includes(r) ? ratings.filter((x) => x !== r) : [...ratings, r]).join(","));
  const active = FILTER_KEYS.filter((k) => value[k]).length;

  return (
    <div data-testid="tornado-filters" className="rounded-2xl border border-tt-border bg-tt-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input data-testid="database-filter-location-input" className={cn(field, "max-w-xs flex-1")} placeholder="Location: country, region, state or event" value={value.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        <button data-testid="filters-toggle-btn" onClick={() => setOpen((o) => !o)} className="flex h-9 items-center gap-1.5 rounded-lg border border-tt-border px-3 text-sm text-tt-muted hover:text-white">
          <SlidersHorizontal className="size-4" /> Filters {active > 0 && <span className="rounded bg-tt-accent2 px-1.5 text-[10px] text-white">{active}</span>}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button data-testid="save-search-btn" variant="outline" size="sm" onClick={() => setSaveOpen(true)} disabled={active === 0}><Save className="size-3.5" /> Save search</Button>
          <a data-testid="database-export-csv-btn" href="/data/1950-2025_actual_tornadoes.csv" className="inline-flex h-7 items-center gap-1 rounded-md border border-tt-border px-2.5 text-xs text-tt-text hover:border-tt-accent" download>
            <Download className="size-3.5" /> NOAA CSV
          </a>
          {active > 0 && (
            <button data-testid="filters-clear-btn" onClick={() => onChange({})} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-tt-muted hover:text-white">
              <X className="size-3.5" /> Clear
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <label className="col-span-2 space-y-1 sm:col-span-3 lg:col-span-6">
            <span className="tt-label !text-[10px]">Rating (F / EF)</span>
            <div className="flex flex-wrap gap-1.5">
              {["0", "1", "2", "3", "4", "5", "U"].map((r) => (
                <button key={r} data-testid={`database-filter-rating-${r}`} onClick={() => toggleRating(r)} className={cn("rounded-md border px-2.5 py-1 tt-mono text-xs transition-colors duration-150", ratings.includes(r) ? "border-tt-accent bg-tt-accent2/30 text-white" : "border-tt-border text-tt-muted hover:text-white")}>
                  {r === "U" ? "Unknown" : `(E)F${r}`}
                </button>
              ))}
            </div>
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">Country</span>
            <select data-testid="database-filter-country-select" className={field} value={value.country ?? ""} onChange={(e) => { const next = { ...value, country: e.target.value }; delete next.state; delete next.page; onChange(next); }}>
              <option value="">All countries</option>
              <option value="United States">United States (SPC)</option>
              <option value="Japan">Japan (JMA)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">State / prefecture</span>
            <select data-testid="database-filter-state-select" className={field} value={value.state ?? ""} onChange={(e) => set("state", e.target.value)}>
              <option value="">All regions</option>
              {value.country === "Japan"
                ? JAPAN_PREFECTURES.map((name) => <option key={name} value={name}>{name}</option>)
                : US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">Year</span>
            <input data-testid="database-filter-year-input" type="number" min={1950} max={CURRENT_YEAR} className={field} placeholder="e.g. 2011" value={value.year ?? ""} onChange={(e) => set("year", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">From date</span>
            <input data-testid="database-filter-start-date" type="date" min="1950-01-01" max={`${CURRENT_YEAR}-12-31`} className={field} value={value.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">To date</span>
            <input data-testid="database-filter-end-date" type="date" min="1950-01-01" max={`${CURRENT_YEAR}-12-31`} className={field} value={value.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">Min fatalities</span>
            <input data-testid="database-filter-min-fatalities" type="number" min={0} className={field} value={value.min_fatalities ?? ""} onChange={(e) => set("min_fatalities", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">Min injuries</span>
            <input data-testid="database-filter-min-injuries" type="number" min={0} className={field} value={value.min_injuries ?? ""} onChange={(e) => set("min_injuries", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">Min path (mi)</span>
            <input data-testid="database-filter-min-length" type="number" min={0} step="0.1" className={field} value={value.min_length ?? ""} onChange={(e) => set("min_length", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="tt-label !text-[10px]">Max path (mi)</span>
            <input data-testid="database-filter-max-length" type="number" min={0} step="0.1" className={field} value={value.max_length ?? ""} onChange={(e) => set("max_length", e.target.value)} />
          </label>
        </div>
      )}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="border-tt-border bg-tt-bg2">
          <DialogTitle>Save this search</DialogTitle>
          <Input data-testid="save-search-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Violent Oklahoma tornadoes" />
          <div className="flex justify-end">
            <Button
              data-testid="save-search-confirm-btn"
              disabled={!name.trim() || addSearch.isPending}
              onClick={() =>
                addSearch.mutate({ name, params: filterOnly }, {
                  onSuccess: () => { toast.success("Search saved to Favorites"); setSaveOpen(false); setName(""); },
                  onError: () => toast.error("Could not save search"),
                })
              }
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SORTABLE: [string, string][] = [["date", "Date"], ["rating", "Rating"], ["fatalities", "Fatalities"], ["injuries", "Injuries"], ["length", "Path length"], ["width", "Width"]];

export function TornadoTable({ items, total, page, pageSize, sort, order, onSort, onPage, loading }: {
  items: Tornado[]; total: number; page: number; pageSize: number; sort: string; order: string;
  onSort: (s: string) => void; onPage: (p: number) => void; loading?: boolean;
}) {
  const settings = useSettings();
  const { openTornado, selectedTornado } = useApp();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="rounded-2xl border border-tt-border bg-tt-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tt-border px-4 py-3">
        <div data-testid="database-result-count" className="text-sm text-tt-muted">
          <span className="tt-mono text-tt-text">{fmtInt(total)}</span> records {loading && <span className="text-tt-cyan">· updating…</span>}
        </div>
        <label className="flex items-center gap-2 text-xs text-tt-muted">
          Sort
          <select data-testid="database-sort-select" value={sort} onChange={(e) => onSort(e.target.value)} className="h-8 rounded-md border border-tt-border bg-tt-bg2 px-2 text-xs text-tt-text">
            {SORTABLE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button data-testid="database-sort-order-btn" onClick={() => onSort(sort)} className="h-8 rounded-md border border-tt-border px-2 tt-mono text-xs text-tt-text">{order === "asc" ? "↑ asc" : "↓ desc"}</button>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left">
            <tr className="tt-label !text-[10px]">
              <th className="px-4 py-2.5 font-semibold">Rating</th>
              <th className="px-2 py-2.5 font-semibold">Date</th>
              <th className="px-2 py-2.5 font-semibold">Location</th>
              <th className="px-2 py-2.5 text-right font-semibold">Fatal.</th>
              <th className="px-2 py-2.5 text-right font-semibold">Inj.</th>
              <th className="px-2 py-2.5 text-right font-semibold">Length</th>
              <th className="px-4 py-2.5 text-right font-semibold">Width</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr
                key={t.id}
                data-testid="database-table-row"
                tabIndex={0}
                onClick={() => openTornado(t.id)}
                onKeyDown={(e) => e.key === "Enter" && openTornado(t.id)}
                className={cn("cursor-pointer border-t border-tt-border/60 transition-colors duration-150 hover:bg-tt-accent2/10 focus-visible:bg-tt-accent2/15 focus-visible:outline-none", selectedTornado === t.id && "bg-tt-accent2/15")}
              >
                <td className="px-4 py-2.5"><RatingBadge rating={t.rating} mag={t.mag} /></td>
                <td className="tt-mono px-2 py-2.5 text-xs">{fmtDate(t.date)}</td>
                <td className="px-2 py-2.5">
                  <div className="max-w-[300px] truncate">{t.wiki_title ?? `${t.year} ${t.state_name} tornado`}</div>
                  {t.wiki_title && <div className="truncate text-[11px] text-tt-muted">{locationLabel(t)}</div>}
                </td>
                <td className={cn("tt-mono px-2 py-2.5 text-right", t.fatalities > 0 && "text-tt-red")}>{t.fatalities}</td>
                <td className={cn("tt-mono px-2 py-2.5 text-right", t.injuries > 0 && "text-tt-orange")}>{t.injuries}</td>
                <td className="tt-mono px-2 py-2.5 text-right text-xs">{distanceMi(t.length_mi, settings).replace("Not available", "—")}</td>
                <td className="tt-mono px-4 py-2.5 text-right text-xs">{widthYd(t.width_yd, settings).replace("Not available", "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <div className="px-4 py-10 text-center text-sm text-tt-muted">No records match these filters.</div>}
      </div>
      <div className="flex items-center justify-between border-t border-tt-border px-4 py-3 text-sm">
        <span className="text-tt-muted">Page <span className="tt-mono text-tt-text" data-testid="database-page-indicator">{page}</span> of <span className="tt-mono">{fmtInt(pages)}</span></span>
        <div className="flex gap-2">
          <Button data-testid="database-prev-page" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="size-4" /> Prev</Button>
          <Button data-testid="database-next-page" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
