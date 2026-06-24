import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getDefaultCustomRange, resolveDateRange, type DateRangeValue } from '../lib/dateRange';

interface DateRangeContextValue {
  range: DateRangeValue;
  setRange: (next: DateRangeValue) => void;
  resolvedRange: { start: Date; end: Date };
}

const initialCustom = getDefaultCustomRange();
const defaultRange: DateRangeValue = { preset: 'today', ...initialCustom };

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const resolvedRange = useMemo(() => resolveDateRange(range), [range]);
  const value = useMemo(() => ({ range, setRange, resolvedRange }), [range, resolvedRange]);

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) throw new Error('useDateRange must be used within DateRangeProvider');
  return context;
}
