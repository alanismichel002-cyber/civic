import type { VotingLocation } from "../../shared/types.ts";
import { addressLines, directionsUrl, formatDateRange, softCase } from "../lib/format.ts";
import { useI18n } from "../lib/i18n.tsx";
import { SourceBadges } from "./SourceBadge.tsx";

export function LocationCard({ loc, index, highlight = false }: { loc: VotingLocation; index?: number; highlight?: boolean }) {
  const { t, lang } = useI18n();
  const dates = formatDateRange(loc.startDate, loc.endDate, lang);
  return (
    <article className={`h-full ${highlight ? "card-selected" : "card-inset"}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[15px] font-semibold">
          {index !== undefined && (
            <span
              aria-hidden="true"
              className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white dark:bg-sky-300 dark:text-slate-950"
            >
              {index + 1}
            </span>
          )}
          {softCase(loc.name) || t("loc.unnamed")}
        </h4>
        {loc.distanceMiles !== undefined && (
          <span className="muted shrink-0 text-sm font-medium">{t("loc.miles", { n: loc.distanceMiles })}</span>
        )}
      </div>
      <address className="mt-1 text-sm not-italic text-slate-700 dark:text-slate-300">
        {addressLines(loc.address).map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </address>
      <dl className="muted mt-2 space-y-1 text-[13px]">
        {dates && (
          <div>
            <dt className="inline font-semibold">{t("loc.dates")}: </dt>
            <dd className="inline">{dates}</dd>
          </div>
        )}
        {loc.hours && (
          <div>
            <dt className="font-semibold">{t("loc.hours")}:</dt>
            <dd>
              <HoursText text={loc.hours} />
            </dd>
          </div>
        )}
        {loc.notes && (
          <div>
            <dt className="inline font-semibold">{t("loc.notes")}: </dt>
            <dd className="inline">{loc.notes}</dd>
          </div>
        )}
        {loc.voterServices && (
          <div>
            <dt className="inline font-semibold">{t("loc.services")}: </dt>
            <dd className="inline">{loc.voterServices}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          className={`${highlight ? "btn-primary" : "btn-secondary"} btn-sm`}
          href={directionsUrl(loc.address, loc.lat, loc.lng)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("loc.directions")}
          <span className="sr-only"> ({softCase(loc.name)})</span>
        </a>
        <SourceBadges sources={loc.sources} />
      </div>
    </article>
  );
}

/** Some feeds list one line per day for weeks; collapse long schedules. */
function HoursText({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 4) return <>{lines.map((l) => <span key={l} className="block">{l}</span>)}</>;
  return (
    <details>
      <summary className="cursor-pointer">
        {lines[0]} … {lines[lines.length - 1]}
      </summary>
      <ul className="mt-1">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}
