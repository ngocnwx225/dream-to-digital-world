import { createContext, useContext, useState, type ReactNode } from "react";

type Period = { year: number; month: number; setPeriod: (y: number, m: number) => void };
const Ctx = createContext<Period | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [p, setP] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  return (
    <Ctx.Provider value={{ ...p, setPeriod: (year, month) => setP({ year, month }) }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePeriod() {
  const c = useContext(Ctx);
  if (!c) throw new Error("PeriodProvider missing");
  return c;
}
