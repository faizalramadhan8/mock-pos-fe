export type DateRange = "today" | "yesterday" | "week" | "month" | "all";

export function getDateRange(range: DateRange): { start: Date; end: Date } | null {
  if (range === "all") return null;
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week": {
      const s = new Date(now);
      s.setDate(s.getDate() - s.getDay());
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
  }
}
