import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Place } from "./types";
import { useSettings } from "./hooks";

export interface FocusRequest { bounds: [[number, number], [number, number]]; nonce: number }

interface AppState {
  location: Place;
  setLocation: (p: Place) => void;
  selectedTornado: string | null;
  openTornado: (id: string | null) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  compareOpen: boolean;
  setCompareOpen: (v: boolean) => void;
  focus: FocusRequest | null;
  focusOn: (bounds: [[number, number], [number, number]]) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [manualLocation, setLocation] = useState<Place | null>(null);
  const location = manualLocation ?? { name: settings.home_name, lat: settings.home_lat, lon: settings.home_lon };
  const [selectedTornado, openTornado] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);

  const toggleCompare = useCallback((id: string) => {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  }, []);
  const clearCompare = useCallback(() => setCompare([]), []);
  const focusOn = useCallback((bounds: [[number, number], [number, number]]) => setFocus({ bounds, nonce: Date.now() }), []);

  const value = useMemo(
    () => ({ location, setLocation, selectedTornado, openTornado, compare, toggleCompare, clearCompare, compareOpen, setCompareOpen, focus, focusOn }),
    [location, selectedTornado, compare, toggleCompare, clearCompare, compareOpen, focus, focusOn],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
