"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const YearContext = createContext<{ year?: number; setYear: (y?: number) => void }>({ setYear: () => {} });

/** Shares the selected year across Map, Timeline and Stats. */
export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState<number>();
  return <YearContext.Provider value={{ year, setYear }}>{children}</YearContext.Provider>;
}

export const useYear = () => useContext(YearContext);
