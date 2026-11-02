import type { PostalAddress } from "../../shared/types.ts";
import type { Lang } from "./i18n.tsx";

/** Parses YYYY-MM-DD as a calendar date (no time-zone shifting). */
export function parseDay(day: string | undefined): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatDay(day: string | undefined, lang: Lang, style: "full" | "medium" = "full"): string {
  const d = parseDay(day);
  if (!d) return day ?? "";
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
    dateStyle: style,
    timeZone: "UTC",
  }).format(d);
}

export function formatDateRange(start: string | undefined, end: string | undefined, lang: Lang): string | undefined {
  if (!start && !end) return undefined;
  if (start && end && start !== end) return `${formatDay(start, lang, "medium")} – ${formatDay(end, lang, "medium")}`;
  return formatDay(start ?? end, lang, "medium");
}

/** Whole days from today (local calendar) until the given YYYY-MM-DD. */
export function daysUntil(day: string, today = new Date()): number | undefined {
  const d = parseDay(day);
  if (!d) return undefined;
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t) / 86_400_000);
}

// Words of 4+ letters only, so acronyms like HLA, USD, NW stay intact.
const titleCaseRe = /\b([A-Z])([A-Z']{3,})\b/g;
/** Many election feeds are ALL CAPS; make them easier to read. */
export function softCase(s: string | undefined): string {
  if (!s) return "";
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return s;
  return s.replace(titleCaseRe, (_, a: string, b: string) => a + b.toLowerCase());
}

export function addressLines(a: PostalAddress): string[] {
  const street = [a.line1, a.line2, a.line3].filter(Boolean).map((l) => softCase(l));
  const cityLine = [softCase(a.city), [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [...street, cityLine].filter(Boolean);
}

export function addressOneLine(a: PostalAddress): string {
  return addressLines(a).join(", ");
}

export function directionsUrl(a: PostalAddress, lat?: number, lng?: number): string {
  const destination = lat !== undefined && lng !== undefined ? `${lat},${lng}` : addressOneLine(a);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
