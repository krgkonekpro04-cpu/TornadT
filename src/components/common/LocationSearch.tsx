import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { useGeocode } from "@/lib/hooks";
import type { GeoResult, Place } from "@/lib/types";
import { cn } from "@/lib/utils";

export const placeName = (g: GeoResult) => [g.name, g.admin1, g.country].filter(Boolean).join(", ");

export function LocationSearch({
  onSelect, placeholder = "Search any city worldwide…", testId = "location-search", className,
}: { onSelect: (p: Place, g: GeoResult) => void; placeholder?: string; testId?: string; className?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data, isFetching, isError } = useGeocode(debounced);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const choose = (g: GeoResult) => {
    onSelect({ name: placeName(g), lat: g.latitude, lon: g.longitude }, g);
    setQ("");
    setOpen(false);
  };
  const results = data ?? [];

  return (
    <div ref={box} className={cn("relative", className)}>
      <div className="tt-glass flex items-center gap-2 rounded-lg px-3">
        <Search className="size-4 shrink-0 text-tt-muted" />
        <input
          data-testid={testId}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && results[active]) choose(results[active]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full bg-transparent text-sm text-tt-text placeholder:text-tt-muted focus:outline-none"
        />
        {isFetching && <Loader2 className="size-4 animate-spin text-tt-muted" />}
      </div>
      {open && debounced.trim().length >= 2 && (
        <div className="tt-glass absolute left-0 right-0 top-11 z-[1200] overflow-hidden rounded-lg">
          {isError && <div className="px-3 py-2 text-xs text-tt-orange">Geocoding service unavailable.</div>}
          {!isFetching && !isError && results.length === 0 && <div className="px-3 py-2 text-xs text-tt-muted">No places found.</div>}
          {results.map((g, i) => (
            <button
              key={g.id}
              data-testid={`${testId}-result-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(g)}
              className={cn("flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors duration-150", i === active ? "bg-tt-accent2/25" : "hover:bg-white/5")}
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-tt-lilac" />
              <span>
                <span className="text-tt-text">{g.name}</span>
                <span className="block text-[11px] text-tt-muted">
                  {[g.admin1, g.country].filter(Boolean).join(", ")} · <span className="tt-mono">{g.latitude.toFixed(2)}, {g.longitude.toFixed(2)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
