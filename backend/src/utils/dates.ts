import { env } from "../config/env";
import { AppError } from "./AppError";

export function businessDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: env.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Date inputs represent whole business days; timestamps retain their explicit timezone.
export function parseDateBoundary(value: string, endOfDay = false): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const midnight = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== value) {
      throw AppError.badRequest("Please enter a valid date.", "INVALID_DATE_RANGE");
    }
    const target = midnight + (endOfDay ? 86400000 : 0);
    let instant = target;
    for (let index = 0; index < 3; index++) {
      const offset = new Intl.DateTimeFormat("en-US", { timeZone: env.timeZone, timeZoneName: "longOffset" })
        .formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")!.value;
      const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
      const minutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1) : 0;
      instant = target - minutes * 60000;
    }
    return new Date(instant - (endOfDay ? 1 : 0));
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw AppError.badRequest("Please enter a valid date.", "INVALID_DATE_RANGE");
  return date;
}

export function dateRange(from?: string, to?: string) {
  const start = from ? parseDateBoundary(from) : undefined;
  const end = to ? parseDateBoundary(to, true) : undefined;
  if (start && end && start > end) throw AppError.badRequest("The start date must be before the end date.", "INVALID_DATE_RANGE");
  return { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
}
