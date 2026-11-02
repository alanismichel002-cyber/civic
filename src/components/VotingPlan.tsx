import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import type { VoterInfo } from "../../shared/types.ts";
import { addressOneLine, daysUntil, formatDay, softCase } from "../lib/format.ts";
import { buildIcs, downloadFile, type CalendarEvent } from "../lib/ics.ts";
import { useI18n } from "../lib/i18n.tsx";
import { keyDates, officeLink } from "../lib/plan.ts";
import { planFromVoterInfo, shareUrl } from "../lib/share.ts";
import { LocationList } from "./LocationList.tsx";
import { OfficePanel } from "./OfficePanel.tsx";
import { SourceBadges } from "./SourceBadge.tsx";
import { RemindersCard } from "./RemindersCard.tsx";
import { track } from "../lib/analytics.ts";

const LocationMap = lazy(() => import("./LocationMap.tsx"));

export function ElectionHeader({ info, aside }: { info: VoterInfo; aside?: ReactNode }) {
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
  const hero = (
    <div className="rounded-3xl border border-white/40 bg-[linear-gradient(155deg,rgba(74,123,255,.88),rgba(30,64,175,.92))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_24px_50px_rgba(30,64,175,.3)] backdrop-blur-[32px] sm:rounded-[32px] sm:p-8 print:border-slate-400 print:bg-none print:text-black print:shadow-none">
      <p className="eyebrow text-[#dbe6fe] print:text-black">{info.election.name}</p>
      <p className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-[40px] sm:leading-tight">{formatDay(info.election.day, lang)}</p>
      {countdown && <p className="mt-1 text-[19px] font-medium">{countdown}</p>}
      {area && <p className="mt-3 text-sm text-[#dbe6fe] print:text-black">{t("plan.area", { area })}</p>}
    </div>
  );
  if (!aside) return hero;
  return (
    <div className="grid gap-[18px] md:grid-cols-[1.4fr_1fr]">
      {hero}
      {aside}
    </div>
  );
}

/** "Before you vote" checklist, shown beside the election hero. */
export function PlanChecklist({ info }: { info: VoterInfo }) {
  const { t } = useI18n();
  const registrationCheck = officeLink(info.offices, "registrationCheck");
  const rules = officeLink(info.offices, "rules") ?? officeLink(info.offices, "info");
  return (
    <section className="card" aria-labelledby="checklist-title">
      <h3 id="checklist-title" className="h3">
        {t("plan.checklist.title")}
      </h3>
      <ul className="mt-3 space-y-2">
        <ChecklistItem label={t("plan.checklist.registration")} href={registrationCheck} />
        <ChecklistItem label={t("plan.checklist.where")} href="#polling-title" internal />
        <ChecklistItem label={t("plan.checklist.ballot")} href="#/ballot" internal />
        <ChecklistItem label={t("plan.checklist.id")} href={rules} />
      </ul>
    </section>
  );
}

export function VotingPlan({
  info,
  address = "",
  reminders = { email: false, sms: false },
}: {
  info: VoterInfo;
  address?: string;
  reminders?: { email: boolean; sms: boolean };
}) {
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
  return (
    <div className="space-y-[18px]">
      <h2 className="sr-only">{t("plan.heading")}</h2>

      {info.mailOnly && (
        <section className="card bg-amber-50/70 dark:bg-amber-950/40" aria-labelledby="mail-only">
          <h3 id="mail-only" className="h3 flex items-center gap-2">
            <span aria-hidden="true" className="dot bg-[#b45309]" />
            {t("plan.mailOnly.title")}
          </h3>
          <p className="mt-1">{t("plan.mailOnly.body")}</p>
        </section>
      )}

      {mapLocations.some((l) => l.lat !== undefined) && (
        <div className="card no-print p-2.5 sm:p-2.5">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white/40 sm:h-80" />}>
            <LocationMap locations={mapLocations} origin={info.origin} label={t("plan.map")} youLabel={t("plan.mapYou")} />
          </Suspense>
          <div className="px-3 pb-1.5">
            <MapLegend showEarly={hasEarly} showDrop={hasDrop} hasOrigin={!!info.origin} />
          </div>
        </div>
      )}

      {!(info.mailOnly && info.pollingLocations.length === 0) && (
        <section className="card" aria-labelledby="polling-title">
          <h3 id="polling-title" className="h2 flex items-center gap-2">
            <span aria-hidden="true" className="dot bg-[#1d4ed8]" />
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

      <div className="grid gap-[18px] lg:grid-cols-2">
      <section className="card" aria-labelledby="early-title">
        <h3 id="early-title" className="h2 flex items-center gap-2">
          <span aria-hidden="true" className="dot bg-[#047857]" />
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
        <h3 id="dropoff-title" className="h2 flex items-center gap-2">
          <span aria-hidden="true" className="dot bg-[#b45309]" />
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
      </div>

      <div className="grid gap-[18px] md:grid-cols-2">
        <CalendarCard info={info} />
        <ShareCard info={info} />
      </div>

      <RemindersCard info={info} address={address} channels={reminders} />

      <OfficePanel offices={info.offices} />
      <SourcesNote info={info} />
    </div>
  );
}

function ChecklistItem({ label, href, internal }: { label: string; href?: string; internal?: boolean }) {
  return (
    <li className="card-inset flex items-center gap-3 py-3">
      <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-[6px] border-[1.5px] border-brand-700 dark:border-sky-300" />
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
      <span aria-hidden="true" className="dot" style={{ background: color }} />
      {label}
    </li>
  );
  return (
    <ul className="muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-hidden="true">
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
        className="btn-secondary btn-sm mt-3"
        onClick={() => {
          downloadFile(`voting-dates-${info.election.id}.ics`, buildIcs(events));
          track("calendar_add");
        }}
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
      track("share", { method: "copy" });
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
    <aside className="px-2 text-[13px]" aria-labelledby="sources-title">
      <h3 id="sources-title" className="font-semibold">
        {t("sources.title")}
      </h3>
      <p className="muted mt-1">{t("sources.body")}</p>
      {info.sources.length > 0 && <SourceBadges sources={info.sources} className="mt-2" />}
    </aside>
  );
}
