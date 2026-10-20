import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend as RLegend } from "recharts";
import { useApp } from "@/lib/appState";
import { useSettings, useStats } from "@/lib/hooks";
import { EF_COLORS, locationLabel, MONTHS, US_STATES } from "@/lib/meteo";
import type { Tornado } from "@/lib/types";
import { distanceMi, fmtDate, fmtInt, widthYd } from "@/lib/units";
import { ErrorState, Loading, Metric, PageHeader, Panel, RatingBadge } from "@/components/common/ui";

const field = "h-9 rounded-lg border border-tt-border bg-tt-bg2 px-2.5 text-sm text-tt-text focus:border-tt-accent/70 focus:outline-none";
const tip = { contentStyle: { background: "#11182A", border: "1px solid #222B42", borderRadius: 8, fontSize: 12 }, cursor: { fill: "#ffffff08" } };
const ax = { stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false } as const;

function RecordLink({ t, label, value, testId }: { t: Tornado | null; label: string; value: string; testId: string }) {
  const { openTornado } = useApp();
  if (!t) return <Metric label={label} value="Not available" />;
  return (
    <button data-testid={testId} onClick={() => openTornado(t.id)} className="rounded-xl border border-tt-border bg-tt-bg2/60 p-3 text-left transition-colors duration-150 hover:border-tt-accent/50">
      <div className="tt-label !text-[10px]">{label}</div>
      <div className="tt-mono mt-1 text-lg font-semibold">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-tt-muted"><RatingBadge rating={t.rating} mag={t.mag} /> {fmtDate(t.date)} · {t.state}</div>
    </button>
  );
}

export default function StatisticsPage() {
  const settings = useSettings();
  const { openTornado } = useApp();
  const [from, setFrom] = useState("1950");
  const currentYear = new Date().getFullYear();
  const [to, setTo] = useState(String(currentYear));
  const [state, setState] = useState("");
  const params = useMemo(() => {
    const p: Record<string, string> = { start_date: `${from}-01-01`, end_date: `${to}-12-31` };
    if (state) p.state = state;
    return p;
  }, [from, to, state]);
  const { data: s, isLoading, isError, isFetching } = useStats(params);
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => String(1950 + i));
  const months = (s?.by_month ?? []).map((m) => ({ m: MONTHS[m.month - 1], c: m.count }));
  const states = (s?.by_state ?? []).slice(0, 15).map((x) => ({ s: x.state, name: x.state_name, c: x.count, f: x.fatalities }));

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <PageHeader
        title="Statistics"
        subtitle="Computed from NOAA SPC actual tracks for 1950–2025 plus the NOAA NCEI Storm Events archive for 2026. Current-year NCEI reports are incomplete and may be revised. Early decades are under-reported; F-scale and EF-scale ratings are grouped by rating number."
      />
      <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-tt-border bg-tt-card p-3">
        <label className="space-y-1"><span className="tt-label block !text-[10px]">From year</span>
          <select data-testid="stats-from-year" className={field} value={from} onChange={(e) => setFrom(e.target.value)}>{years.filter((y) => y <= to).map((y) => <option key={y}>{y}</option>)}</select>
        </label>
        <label className="space-y-1"><span className="tt-label block !text-[10px]">To year</span>
          <select data-testid="stats-to-year" className={field} value={to} onChange={(e) => setTo(e.target.value)}>{years.filter((y) => y >= from).map((y) => <option key={y}>{y}</option>)}</select>
        </label>
        <label className="space-y-1"><span className="tt-label block !text-[10px]">Region (state)</span>
          <select data-testid="stats-state-select" className={field} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All US states</option>
            {US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
        {isFetching && <span className="text-xs text-tt-cyan">Updating…</span>}
      </div>
      {isLoading && <Loading />}
      {isError && <ErrorState message="Statistics are unavailable right now." />}
      {s && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <Metric testId="stats-total" label="Tornadoes" value={fmtInt(s.total)} sub={s.min_date ? `${s.min_date} → ${s.max_date}` : undefined} />
            <Metric testId="stats-fatalities" label="Fatalities" value={fmtInt(s.fatalities)} tone="#EF4444" />
            <Metric testId="stats-injuries" label="Injuries" value={fmtInt(s.injuries)} tone="#F97316" />
            <Metric testId="stats-avg-length" label="Avg. path length" value={distanceMi(s.avg_length_mi, settings)} />
            <Metric label="Avg. path width" value={widthYd(s.avg_width_yd, settings)} />
            <RecordLink testId="stats-longest" t={s.longest} label="Longest path" value={distanceMi(s.longest?.length_mi, settings)} />
            <RecordLink testId="stats-widest" t={s.widest} label="Widest path" value={widthYd(s.widest?.width_yd, settings)} />
          </div>
          <div className="grid grid-cols-12 gap-4">
            <Panel testId="stats-by-year" className="col-span-12" title="Tornadoes and fatalities by year">
              <div className="h-72">
                <ResponsiveContainer>
                  <ComposedChart data={s.by_year}>
                    <CartesianGrid stroke="#222B42" vertical={false} />
                    <XAxis dataKey="year" {...ax} minTickGap={16} />
                    <YAxis yAxisId="c" {...ax} width={44} />
                    <YAxis yAxisId="f" orientation="right" {...ax} width={44} />
                    <Tooltip {...tip} />
                    <RLegend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="c" dataKey="count" name="Tornadoes" fill="#7C3AED" radius={[2, 2, 0, 0]} />
                    <Line yAxisId="f" dataKey="fatalities" name="Fatalities" stroke="#EF4444" dot={false} strokeWidth={1.5} />
                    <Line yAxisId="f" dataKey="injuries" name="Injuries" stroke="#F97316" dot={false} strokeWidth={1} strokeOpacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel testId="stats-by-rating" className="col-span-12 md:col-span-6 xl:col-span-4" title="By rating">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={s.by_rating}>
                    <XAxis dataKey="label" {...ax} />
                    <YAxis {...ax} width={44} />
                    <Tooltip {...tip} />
                    <Bar dataKey="count" name="Tornadoes" radius={[4, 4, 0, 0]}>
                      {s.by_rating.map((r) => <Cell key={r.label} fill={EF_COLORS[r.label.match(/\d/)?.[0] ?? "U"]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel testId="stats-by-month" className="col-span-12 md:col-span-6 xl:col-span-4" title="By month">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={months}>
                    <XAxis dataKey="m" {...ax} />
                    <YAxis {...ax} width={44} />
                    <Tooltip {...tip} />
                    <Bar dataKey="c" name="Tornadoes" fill="#A855F7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel testId="stats-by-state" className="col-span-12 xl:col-span-4" title="Geographic distribution · top 15 states">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={states} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" {...ax} />
                    <YAxis type="category" dataKey="s" {...ax} width={30} />
                    <Tooltip {...tip} labelFormatter={(l: string) => states.find((x) => x.s === l)?.name ?? l} />
                    <Bar dataKey="c" name="Tornadoes" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel testId="stats-deadliest" className="col-span-12 lg:col-span-7" title="Deadliest tornadoes in selection">
              {s.deadliest.length === 0 ? <p className="text-sm text-tt-muted">No fatal tornadoes in this selection.</p> : (
                <div className="divide-y divide-tt-border/60">
                  {s.deadliest.map((t, i) => (
                    <button key={t.id} data-testid={`stats-deadliest-${i}`} onClick={() => openTornado(t.id)} className="flex w-full items-center gap-3 py-2 text-left text-sm transition-colors duration-150 hover:text-tt-lilac">
                      <span className="tt-mono w-5 text-tt-muted">{i + 1}</span>
                      <RatingBadge rating={t.rating} mag={t.mag} />
                      <span className="min-w-0 flex-1 truncate">{t.wiki_title ?? locationLabel(t)}</span>
                      <span className="tt-mono text-xs text-tt-muted">{fmtDate(t.date)}</span>
                      <span className="tt-mono w-12 text-right text-tt-red">{t.fatalities}</span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            <Panel className="col-span-12 lg:col-span-5" title="State comparison">
              <div className="tt-scroll max-h-[340px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="tt-label !text-[10px] text-left"><th className="py-1.5">State</th><th className="text-right">Tornadoes</th><th className="text-right">Fatalities</th><th className="text-right">Share</th></tr></thead>
                  <tbody>
                    {s.by_state.map((x) => (
                      <tr key={x.state} className="border-t border-tt-border/50">
                        <td className="py-1.5">{x.state_name}</td>
                        <td className="tt-mono text-right">{fmtInt(x.count)}</td>
                        <td className="tt-mono text-right text-tt-red">{fmtInt(x.fatalities)}</td>
                        <td className="tt-mono text-right text-tt-muted">{((x.count / s.total) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
          <p className="text-[11px] text-tt-muted">Coverage: NOAA SPC tracks, 1950–2025, plus NOAA NCEI 2026 tornado events. Current-year NCEI reports may be incomplete or revised. Multi-state SPC tracks are counted once, under their start state.</p>
        </>
      )}
    </div>
  );
}
