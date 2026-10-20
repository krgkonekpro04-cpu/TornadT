import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/appState";
import { useSettings, useTornadoBatch } from "@/lib/hooks";
import { locationLabel, windRange } from "@/lib/meteo";
import type { Tornado } from "@/lib/types";
import { distanceMi, fmtDate, fmtInt, fmtUsd, mphRange, NA, widthYd } from "@/lib/units";
import { RatingBadge } from "@/components/common/ui";

export function CompareDialog() {
  const { compare, compareOpen, setCompareOpen, clearCompare, openTornado } = useApp();
  const settings = useSettings();
  const { data } = useTornadoBatch(compare);
  const items = compare.map((id) => data?.find((t) => t.id === id)).filter((t): t is Tornado => !!t);

  const rows: [string, (t: Tornado) => React.ReactNode, ((t: Tornado) => number | null)?][] = [
    ["Rating", (t) => <RatingBadge rating={t.rating} mag={t.mag} />, (t) => t.mag],
    ["Date", (t) => `${fmtDate(t.date)} ${t.time} ${t.tz}`],
    ["Location", (t) => locationLabel(t)],
    ["Fatalities", (t) => fmtInt(t.fatalities), (t) => t.fatalities],
    ["Injuries", (t) => fmtInt(t.injuries), (t) => t.injuries],
    ["Path length", (t) => distanceMi(t.length_mi, settings), (t) => t.length_mi],
    ["Path width", (t) => widthYd(t.width_yd, settings), (t) => t.width_yd],
    ["Scale wind range", (t) => { const w = windRange(t); return w ? mphRange(w[0], w[1], settings) : NA; }],
    ["Damage", (t) => (t.damage_usd != null ? fmtUsd(t.damage_usd) : t.damage_category ?? NA), (t) => t.damage_usd],
    ["Wikipedia", (t) => t.wiki_title ?? "No linked article"],
  ];

  return (
    <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
      <DialogContent data-testid="comparison-modal" className="max-w-3xl border-tt-border bg-tt-bg2 sm:max-w-3xl">
        <DialogTitle>Tornado comparison</DialogTitle>
        {items.length < 2 && <p className="text-sm text-tt-muted">Select two records (use the compare button in a record's details panel). {items.length}/2 selected.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-40" />
                {items.map((t, i) => (
                  <th key={t.id} className="px-3 py-2 text-left font-heading">
                    <button data-testid={`comparison-select-storm-${i === 0 ? "a" : "b"}`} className="text-left text-tt-lilac hover:underline" onClick={() => { setCompareOpen(false); openTornado(t.id); }}>
                      {t.wiki_title ?? locationLabel(t)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, render, num]) => {
                const vals = num && items.length === 2 ? items.map((t) => num(t) ?? -1) : null;
                return (
                  <tr key={label} className="border-t border-tt-border">
                    <td className="py-2 pr-3 text-tt-muted">{label}</td>
                    {items.map((t, i) => (
                      <td key={t.id} className={`px-3 py-2 ${vals && vals[i] > vals[1 - i] ? "font-semibold text-white" : "text-tt-text/85"}`}>
                        {render(t)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <Button data-testid="comparison-clear-btn" variant="outline" onClick={() => { clearCompare(); setCompareOpen(false); }}>Clear comparison</Button>
          <Button data-testid="comparison-close-btn" onClick={() => setCompareOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
