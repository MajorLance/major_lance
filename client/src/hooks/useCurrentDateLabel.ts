import { useEffect, useState } from "react";

export function getCurrentDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getLocalDayKey(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0"))
    .join("-");
}

export function getMillisecondsUntilNextLocalDay(date: Date): number {
  const nextDay = new Date(date);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1000, nextDay.getTime() - date.getTime() + 50);
}

export function useCurrentDateLabel(): string {
  const [dayKey, setDayKey] = useState(() => getLocalDayKey(new Date()));

  useEffect(() => {
    let timeoutId: number;

    const scheduleNextUpdate = () => {
      const now = new Date();
      timeoutId = window.setTimeout(() => {
        setDayKey(getLocalDayKey(new Date()));
        scheduleNextUpdate();
      }, getMillisecondsUntilNextLocalDay(now));
    };

    scheduleNextUpdate();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const [year, month, day] = dayKey.split("-").map(Number);
  return getCurrentDateLabel(new Date(year, month - 1, day));
}
