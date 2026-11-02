// Builds an iCalendar (.ics) file with all-day events. RFC 5545.

export interface CalendarEvent {
  uid: string;
  /** YYYY-MM-DD */
  day: string;
  title: string;
  description?: string;
  location?: string;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines over 75 octets must be folded. Splits on characters to keep it simple and safe. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > 75) {
      out.push(current);
      current = " " + ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

const compact = (day: string) => day.replace(/-/g, "");

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

export function buildIcs(events: CalendarEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Civic//Voting Plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.day)) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@civic`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.day)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.day))}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    lines.push(
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(e.title)}`,
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadFile(filename: string, content: string | Blob, type = "text/calendar;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
