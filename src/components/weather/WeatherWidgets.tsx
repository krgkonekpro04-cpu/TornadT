import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Eye, Gauge, Navigation, Sunrise, Sunset, Thermometer, Umbrella, Wind as WindIcon, Cloud } from "lucide-react";
import type { Settings, WeatherResponse } from "@/lib/types";
import { compass, precip, precipValue, temp, tempValue, visibility, wind, windUnit, windValue } from "@/lib/units";
import { wmo } from "@/lib/meteo";
import { cn } from "@/lib/utils";

const hh = (iso: string) => iso.slice(11, 16);
const dayName = (iso: string, i: number) => (i === 0 ? "Today" : new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }));

/** Index of the first hourly entry at/after the current observation time. */
export function nowIndex(d: WeatherResponse): number {
  const i = d.hourly_time.findIndex((t) => t >= d.current_time.slice(0, 13));
  return Math.max(0, i);
}

export function SourceLine({ d }: { d: WeatherResponse }) {
  return (
    <p data-testid="weather-source" className="text-[11px] text-tt-muted">
      Source: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-tt-lilac hover:underline">{d.source}</a> · model current conditions valid {d.current_time.replace("T", " ")} ({d.timezone}) · fetched{" "}
      {new Date(d.fetched_at).toLocaleTimeString()}
    </p>
  );
}

export function CurrentConditions({ d, s, compact = false }: { d: WeatherResponse; s: Settings; compact?: boolean }) {
  const c = d.current;
  const [label, Icon] = wmo(c.weather_code);
  const ni = nowIndex(d);
  const pop = d.hourly.precipitation_probability?.[ni];
  const vis = d.hourly.visibility?.[ni];
  const items = [
    { k: "Wind", v: `${wind(c.wind_speed_10m, s)} ${compass(c.wind_direction_10m)}`, icon: WindIcon, id: "wind" },
    { k: "Direction", v: c.wind_direction_10m != null ? `${Math.round(c.wind_direction_10m)}°` : "—", icon: Navigation, id: "wind-dir", rot: c.wind_direction_10m },
    { k: "Gusts", v: wind(c.wind_gusts_10m, s), icon: WindIcon, id: "gusts", hide: compact },
    { k: "Humidity", v: c.relative_humidity_2m != null ? `${Math.round(c.relative_humidity_2m)}%` : "—", icon: Droplets, id: "humidity" },
    { k: "Precip. chance", v: pop != null ? `${pop}%` : "—", icon: Umbrella, id: "pop" },
    { k: "Precipitation", v: precip(c.precipitation, s), icon: Umbrella, id: "precip", hide: compact },
    { k: "Cloud cover", v: c.cloud_cover != null ? `${Math.round(c.cloud_cover)}%` : "—", icon: Cloud, id: "cloud" },
    { k: "Pressure", v: c.pressure_msl != null ? `${Math.round(c.pressure_msl)} hPa` : "—", icon: Gauge, id: "pressure" },
    { k: "Visibility", v: visibility(vis, s), icon: Eye, id: "visibility", hide: compact },
  ].filter((x) => !x.hide);
  return (
    <div>
      <div className="flex items-center gap-4">
        <Icon className="size-12 text-tt-lilac" strokeWidth={1.4} />
        <div>
          <div data-testid="weather-current-temp" className="tt-mono text-4xl font-semibold tracking-tight">{temp(c.temperature_2m, s)}</div>
          <div data-testid="weather-current-condition" className="text-sm text-tt-text/90">{label}</div>
          <div className="text-xs text-tt-muted">Feels like <span data-testid="weather-feels-like">{temp(c.apparent_temperature, s)}</span></div>
        </div>
      </div>
      <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 rounded-lg border border-tt-border/70 bg-tt-bg2/50 px-2.5 py-2">
            <it.icon className="size-4 shrink-0 text-tt-cyan" style={it.rot != null ? { transform: `rotate(${it.rot + 180}deg)` } : undefined} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-tt-muted">{it.k}</div>
              <div data-testid={`weather-${it.id}`} className="tt-mono text-[12.5px] leading-tight">{it.v}</div>
            </div>
          </div>
        ))}
      </div>
      {!compact && d.sunrise[0] && (
        <div className="mt-3 flex gap-4 text-sm text-tt-muted">
          <span className="flex items-center gap-1.5"><Sunrise className="size-4 text-tt-orange" /> <span data-testid="weather-sunrise" className="tt-mono text-tt-text">{hh(d.sunrise[0])}</span></span>
          <span className="flex items-center gap-1.5"><Sunset className="size-4 text-tt-accent" /> <span data-testid="weather-sunset" className="tt-mono text-tt-text">{hh(d.sunset[0])}</span></span>
          <span className="text-xs">local time ({d.timezone})</span>
        </div>
      )}
    </div>
  );
}

export function HourlyStrip({ d, s, hours = 24 }: { d: WeatherResponse; s: Settings; hours?: number }) {
  const start = nowIndex(d);
  const idx = Array.from({ length: hours }, (_, i) => start + i).filter((i) => i < d.hourly_time.length);
  return (
    <div data-testid="hourly-forecast" className="tt-scroll flex gap-2 overflow-x-auto pb-2">
      {idx.map((i) => {
        const [lbl, Icon] = wmo(d.hourly.weather_code[i]);
        return (
          <div key={i} className="flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-xl border border-tt-border/70 bg-tt-bg2/50 py-2.5" title={lbl}>
            <span className="tt-mono text-[11px] text-tt-muted">{i === start ? "Now" : hh(d.hourly_time[i])}</span>
            <Icon className="size-5 text-tt-lilac" strokeWidth={1.6} />
            <span className="tt-mono text-sm">{temp(d.hourly.temperature_2m[i], s)}</span>
            <span className="tt-mono text-[10px] text-tt-cyan">{d.hourly.precipitation_probability[i] ?? "–"}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function DailyList({ d, s }: { d: WeatherResponse; s: Settings }) {
  const mins = d.daily.temperature_2m_min.filter((x): x is number => x != null);
  const maxs = d.daily.temperature_2m_max.filter((x): x is number => x != null);
  const lo = Math.min(...mins), hi = Math.max(...maxs);
  return (
    <div data-testid="daily-forecast" className="divide-y divide-tt-border/70">
      {d.daily_time.map((day, i) => {
        const [lbl, Icon] = wmo(d.daily.weather_code[i]);
        const mn = d.daily.temperature_2m_min[i] ?? lo, mx = d.daily.temperature_2m_max[i] ?? hi;
        return (
          <div key={day} className="grid grid-cols-[56px_28px_1fr_auto] items-center gap-3 py-2.5 text-sm sm:grid-cols-[64px_28px_120px_1fr_auto]">
            <span className="font-medium">{dayName(day, i)}</span>
            <Icon className="size-5 text-tt-lilac" strokeWidth={1.6} />
            <span className="hidden truncate text-xs text-tt-muted sm:block">{lbl}</span>
            <div className="flex items-center gap-2">
              <span className="tt-mono w-10 text-right text-xs text-tt-muted">{temp(mn, s)}</span>
              <div className="relative h-1.5 flex-1 rounded-full bg-tt-bg2">
                <div className="absolute h-full rounded-full bg-gradient-to-r from-tt-cyan to-tt-orange" style={{ left: `${((mn - lo) / (hi - lo || 1)) * 100}%`, right: `${100 - ((mx - lo) / (hi - lo || 1)) * 100}%` }} />
              </div>
              <span className="tt-mono w-10 text-xs">{temp(mx, s)}</span>
            </div>
            <span className="tt-mono w-24 text-right text-[11px] text-tt-cyan">{d.daily.precipitation_probability_max[i] ?? "–"}% · {precip(d.daily.precipitation_sum[i], s)}</span>
          </div>
        );
      })}
    </div>
  );
}

const axis = { stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "#11182A", border: "1px solid #222B42", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#C4B5FD" } };

export function WeatherCharts({ d, s }: { d: WeatherResponse; s: Settings }) {
  const [tab, setTab] = useState<"temp" | "wind" | "precip">("temp");
  const [range, setRange] = useState<48 | 168>(48);
  const data = useMemo(() => {
    const start = nowIndex(d);
    return d.hourly_time.slice(start, start + range).map((t, j) => {
      const i = start + j;
      return {
        t: range === 48 ? t.slice(11, 16) : `${t.slice(5, 10)} ${t.slice(11, 13)}h`,
        full: t.replace("T", " "),
        temp: tempValue(d.hourly.temperature_2m[i], s),
        feels: tempValue(d.hourly.apparent_temperature[i], s),
        wind: windValue(d.hourly.wind_speed_10m[i], s),
        gust: windValue(d.hourly.wind_gusts_10m[i], s),
        pop: d.hourly.precipitation_probability[i],
        precip: precipValue(d.hourly.precipitation[i], s),
      };
    });
  }, [d, s, range]);
  const tabs = [["temp", "Temperature"], ["wind", "Wind"], ["precip", "Precipitation"]] as const;
  return (
    <div data-testid="weather-charts">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-tt-border bg-tt-bg2 p-1">
          {tabs.map(([k, l]) => (
            <button key={k} data-testid={`chart-tab-${k}`} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1 text-xs transition-colors duration-150", tab === k ? "bg-tt-accent2 text-white" : "text-tt-muted hover:text-white")}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-tt-border bg-tt-bg2 p-1">
          {([48, 168] as const).map((r) => (
            <button key={r} data-testid={`chart-range-${r}`} onClick={() => setRange(r)} className={cn("rounded-md px-3 py-1 text-xs transition-colors duration-150", range === r ? "bg-tt-accent2 text-white" : "text-tt-muted hover:text-white")}>
              {r === 48 ? "48 h" : "7 days"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {tab === "temp" ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A855F7" stopOpacity={0.45} /><stop offset="1" stopColor="#A855F7" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="#222B42" vertical={false} />
              <XAxis dataKey="t" {...axis} minTickGap={24} />
              <YAxis {...axis} unit={`°`} width={40} />
              <Tooltip {...tip} labelFormatter={(_l: string, p) => (p?.[0]?.payload as { full?: string })?.full ?? _l} />
              <Area type="monotone" dataKey="temp" name={`Temperature (°${s.temp_unit})`} stroke="#A855F7" fill="url(#gT)" strokeWidth={2} />
              <Line type="monotone" dataKey="feels" name={`Feels like (°${s.temp_unit})`} stroke="#06B6D4" dot={false} strokeDasharray="4 3" />
            </AreaChart>
          ) : tab === "wind" ? (
            <ComposedChart data={data}>
              <CartesianGrid stroke="#222B42" vertical={false} />
              <XAxis dataKey="t" {...axis} minTickGap={24} />
              <YAxis {...axis} width={40} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey="wind" name={`Wind (${windUnit(s)})`} stroke="#06B6D4" fill="#06B6D433" strokeWidth={2} />
              <Line type="monotone" dataKey="gust" name={`Gusts (${windUnit(s)})`} stroke="#F97316" dot={false} strokeWidth={1.5} />
            </ComposedChart>
          ) : (
            <ComposedChart data={data}>
              <CartesianGrid stroke="#222B42" vertical={false} />
              <XAxis dataKey="t" {...axis} minTickGap={24} />
              <YAxis yAxisId="a" {...axis} width={40} />
              <YAxis yAxisId="p" orientation="right" {...axis} domain={[0, 100]} unit="%" width={40} />
              <Tooltip {...tip} />
              <Bar yAxisId="a" dataKey="precip" name={`Precipitation (${s.precip_unit})`} fill="#7C3AED" radius={[3, 3, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="pop" name="Probability (%)" stroke="#06B6D4" dot={false} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-tt-muted"><Thermometer className="size-3" /> Hourly model forecast, local time of the location.</p>
    </div>
  );
}
