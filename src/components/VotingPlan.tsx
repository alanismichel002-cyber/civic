import { lazy, Suspense, useMemo, useState } from "react";
import type { VoterInfo } from "../../shared/types.ts";
import { addressOneLine, daysUntil, formatDay, softCase } from "../lib/format.ts";
import { buildIcs, downloadFile, type CalendarEvent } from "../lib/ics.ts";
import { useI18n } from "../lib/i18n.tsx";
import { keyDates, officeLink } from "../lib/plan.ts";
import { planFromVoterInfo, shareUrl } from "../lib/share.ts";
import { LocationList } from "./LocationList.tsx";
import { OfficePanel } from "./OfficePanel.tsx";
import { SourceBadges } from "./SourceBadge.tsx";

const LocationMap = lazy(() => import("./LocationMap.tsx"));

export function ElectionHeader({ info }: { info: VoterInfo }) {
  const { t, lang } = useI18n();
  const days = daysUntil(info.election.day);
  const area = [softCase(info.normalizedArea.city), info.normalizedArea.state].filter(Boolean).join(", ");
  let countdown: string | undefined;
  if (days !== undefined) {
    if (days < 0) countdown = t("plan.past");
    else if (days === 0) countdown = t("plan.today");
    else if (days === 1) countdown = t("plan.tomorrow");
    else countdown = t("plan.daysLeft", { n: days });
  }
  return (
    <div className="card bg-brand-700 text-white dark:bg-slate-900">
      <p className="text-sm font-medium uppercase tracking-wide text-brand-100 dark:text-sky-300">{info.election.name}</p>
      <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatDay(info.election.day, lang)}</p>
      {countdown && <p className="mt-1 text-lg font-medium">{countdown}</p>}
      {area && <p className="mt-2 text-sm text-brand-100 dark:text-slate-300">{t("plan.area", { area })}</p>}
    </div>
  );
}

export function VotingPlan({ info }: { info: VoterInfo }) {
  const { t } = useI18n();
  const mapLocations = useMemo(
    () => [
      ...info.pollingLocations.slice(0, 5),
      ...info.earlyVoteSites.slice(0, 5),
      ...info.dropOffLocations.slice(0, 5),
    ],
    [info],
  );
  const hasEarly = info.earlyVoteSites.length > 0;
  const hasDrop = info.dropOffLocations.length > 0;
  const registrationCheck = officeLink(info.offices, "registrationCheck");
  const rules = officeLink(info.offices, "rules") ?? officeLink(info.offices, "info");

  return (
    <div className="space-y-6">
      <h2 className="sr-only">{t("plan.heading")}</h2>

      {info.mailOnly && (
        <section className="card border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950" aria-labelledby="mail-only">
          <h3 id="mail-only" className="h3">
            <span aria-hidden="true">✉ </span>
            {t("plan.mailOnly.title")}
          </h3>
          <p className="mt-1">{t("plan.mailOnly.body")}</p>
        </section>
      )}

      {mapLocations.some((l) => l.lat !== undefined) && (
        <div className="no-print">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-200 sm:h-80 dark:bg-slate-800" />}>
            <LocationMap locations={mapLocations} origin={info.origin} label={t("plan.map")} youLabel={t("plan.mapYou")} />
          </Suspense>
          <MapLegend showEarly={hasEarly} showDrop={hasDrop} hasOrigin={!!info.origin} />
        </div>
      )}

      {!(info.mailOnly && info.pollingLocations.length === 0) && (
        <section className="card" aria-labelledby="polling-title">
          <h3 id="polling-title" className="h2">
            {t("plan.polling.title")}
          </h3>
          {info.pollingLocations.length === 0 ? (
            <p className="mt-2">{t("plan.polling.none")}</p>
          ) : (
            <>
              {info.totals.polling > 1 && <p className="muted mt-1">{t("plan.polling.many")}</p>}
              <div className="mt-3">
                <LocationList items={info.pollingLocations} total={info.totals.polling} />
              </div>
            </>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="early-title">
        <h3 id="early-title" className="h2">
          {t("plan.early.title")}
        </h3>
        {hasEarly ? (
          <>
            <p className="muted mt-1">{t("plan.early.lead")}</p>
            <div className="mt-3">
              <LocationList items={info.earlyVoteSites} total={info.totals.early} />
            </div>
          </>
        ) : (
          <p className="mt-2">{t("plan.early.none")}</p>
        )}
      </section>

      <section className="card" aria-labelledby="dropoff-title">
        <h3 id="dropoff-title" className="h2">
          {t("plan.dropoff.title")}
        </h3>
        {hasDrop ? (
          <>
            <p className="muted mt-1">{t("plan.dropoff.lead")}</p>
            <div className="mt-3">
              <LocationList items={info.dropOffLocations} total={info.totals.dropoff} />
            </div>
          </>
        ) : (
          <p className="mt-2">{t("plan.dropoff.none")}</p>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <CalendarCard info={info} />
        <ShareCard info={info} />
      </div>

      <section className="card" aria-labelledby="checklist-title">
        <h3 id="checklist-title" className="h2">
          {t("plan.checklist.title")}
        </h3>
        <ul className="mt-3 space-y-2">
          <ChecklistItem label={t("plan.checklist.registration")} href={registrationCheck} />
          <ChecklistItem label={t("plan.checklist.where")} href="#polling-title" internal />
          <ChecklistItem label={t("plan.checklist.ballot")} href="#/ballot" internal />
          <ChecklistItem label={t("plan.checklist.id")} href={rules} />
        </ul>
      </section>

      <OfficePanel offices={info.offices} />
      <SourcesNote info={info} />
    </div>
  );
}

function ChecklistItem({ label, href, internal }: { label: string; href?: string; internal?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 text-brand-700 dark:text-sky-300">
        ☐
      </span>
      {href ? (
        <a className="link" href={href} {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </li>
  );
}

function MapLegend({ showEarly, showDrop, hasOrigin }: { showEarly: boolean; showDrop: boolean; hasOrigin: boolean }) {
  const { t } = useI18n();
  const item = (color: string, label: string) => (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
      {label}
    </li>
  );
  return (
    <ul className="muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden="true">
      {hasOrigin && item("#111827", t("plan.mapYou"))}
      {item("#1d4ed8", t("plan.polling.title"))}
      {showEarly && item("#047857", t("plan.early.title"))}
      {showDrop && item("#b45309", t("plan.dropoff.title"))}
    </ul>
  );
}

/** FR-13: one .ics file with Election Day, early-vote start and drop-off deadline. */
function CalendarCard({ info }: { info: VoterInfo }) {
  const { t, lang } = useI18n();
  const dates = keyDates(info);
  const polling = info.pollingLocations[0];
  const events: CalendarEvent[] = [];
  if (dates.electionDay) {
    events.push({
      uid: `election-${info.election.id}`,
      day: dates.electionDay,
      title: `${t("cal.electionDay")}: ${info.election.name}`,
      location: polling ? [softCase(polling.name), addressOneLine(polling.address)].filter(Boolean).join(", ") : undefined,
      description: polling?.hours,
    });
  }
  if (dates.earlyStart) {
    events.push({ uid: `early-${info.election.id}`, day: dates.earlyStart, title: `${t("cal.earlyStart")}: ${info.election.name}` });
  }
  if (dates.dropoffDeadline && dates.dropoffDeadline !== dates.electionDay) {
    events.push({
      uid: `dropoff-${info.election.id}`,
      day: dates.dropoffDeadline,
      title: `${t("cal.dropoffDeadline")}: ${info.election.name}`,
    });
  }
  if (!events.length) return null;
  return (
    <section className="card no-print" aria-labelledby="cal-title">
      <h3 id="cal-title" className="h3">
        {t("cal.title")}
      </h3>
      <p className="muted mt-1 text-sm">{t("cal.includes")}</p>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {events.map((e) => (
          <li key={e.uid}>
            {e.title.split(":")[0]} — {formatDay(e.day, lang, "medium")}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-secondary mt-3"
        onClick={() => downloadFile(`voting-dates-${info.election.id}.ics`, buildIcs(events))}
      >
        <span aria-hidden="true">📅</span> {t("cal.button")}
      </button>
    </section>
  );
}

/** FR-14: shareable link without the voter's home address. */
function ShareCard({ info }: { info: VoterInfo }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => shareUrl(planFromVoterInfo(info)), [info]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t("share.copy"), url);
    }
  }

  return (
    <section className="card no-print" aria-labelledby="share-title">
      <h3 id="share-title" className="h3">
        {t("share.title")}
      </h3>
      <p className="muted mt-1 text-sm">{t("share.body")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? t("share.copied") : t("share.copy")}
        </button>
        {canShare && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigator.share({ title: info.election.name, url }).catch(() => undefined)}
          >
            {t("share.native")}
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t("share.copied") : ""}
      </span>
    </section>
  );
}

export function SourcesNote({ info }: { info: VoterInfo }) {
  const { t } = useI18n();
  return (
    <aside className="card text-sm" aria-labelledby="sources-title">
      <h3 id="sources-title" className="font-semibold">
        {t("sources.title")}
      </h3>
      <p className="muted mt-1">{t("sources.body")}</p>
      {info.sources.length > 0 && <SourceBadges sources={info.sources} className="mt-2" />}
    </aside>
  );
}
