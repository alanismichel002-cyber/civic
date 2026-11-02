import { useId, useMemo, useState } from "react";
import type { Candidate, Contest, ContestLevel, VoterInfo } from "../../shared/types.ts";
import { CONTEST_LEVEL_ORDER } from "../../shared/types.ts";
import type { Choices } from "../lib/choices.ts";
import { softCase } from "../lib/format.ts";
import { useI18n, type MessageKey } from "../lib/i18n.tsx";
import { SourceBadges } from "./SourceBadge.tsx";

interface Props {
  info: VoterInfo;
  choices: Choices;
  onToggle: (contestId: string, option: string, limit: number) => void;
  onClear: (contestId: string) => void;
  onClearAll: () => void;
}

export function groupContests(contests: Contest[]): [ContestLevel, Contest[]][] {
  const groups = new Map<ContestLevel, Contest[]>();
  for (const c of contests) {
    const list = groups.get(c.level) ?? [];
    list.push(c);
    groups.set(c.level, list);
  }
  return CONTEST_LEVEL_ORDER.filter((l) => groups.has(l)).map((l) => [l, groups.get(l)!]);
}

/** FR-6/7/8/12: the full ballot, grouped by level, with optional private choice marking. */
export function SampleBallot({ info, choices, onToggle, onClear, onClearAll }: Props) {
  const { t } = useI18n();
  const groups = useMemo(() => groupContests(info.contests), [info.contests]);
  const marked = info.contests.filter((c) => (choices[c.id] ?? []).length > 0).length;

  if (!info.contests.length) {
    return (
      <section className="card">
        <h2 className="h2">{t("ballot.heading")}</h2>
        <p className="mt-2">{t("ballot.none")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card" aria-labelledby="ballot-title">
        <h2 id="ballot-title" className="h2">
          {t("ballot.heading")}
        </h2>
        <p className="mt-1">{t("ballot.lead")}</p>
        <p className="muted mt-2 text-sm">
          <span aria-hidden="true">🔒 </span>
          {t("ballot.saved")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="font-medium" aria-live="polite">
            {t("ballot.progress", { n: marked, total: info.contests.length })}
          </p>
          <a className="btn-primary" href="#/sheet">
            {t("ballot.toSheet")}
          </a>
          {marked > 0 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (window.confirm(t("ballot.confirmClear"))) onClearAll();
              }}
            >
              {t("ballot.clearAll")}
            </button>
          )}
        </div>
        {groups.length > 1 && (
          <nav className="mt-4" aria-label={t("ballot.jump")}>
            <ul className="flex flex-wrap gap-2">
              {groups.map(([level, list]) => (
                <li key={level}>
                  <a
                    href={`#level-${level}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(`level-${level}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                      el?.focus({ preventScroll: true });
                    }}
                    className="inline-flex min-h-[36px] items-center rounded-full border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    {t(`level.${level}` as MessageKey)} ({list.length})
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      {groups.map(([level, list]) => (
        <section key={level} aria-labelledby={`level-${level}`} className="space-y-4">
          <h3 id={`level-${level}`} tabIndex={-1} className="h2 scroll-mt-24 px-1">
            {t(`level.${level}` as MessageKey)}
          </h3>
          {list.map((c) => (
            <ContestCard
              key={c.id}
              contest={c}
              selected={choices[c.id] ?? []}
              onToggle={(opt, limit) => onToggle(c.id, opt, limit)}
              onClear={() => onClear(c.id)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function ContestCard({
  contest,
  selected,
  onToggle,
  onClear,
}: {
  contest: Contest;
  selected: string[];
  onToggle: (option: string, limit: number) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const groupId = useId();
  const isMeasure = contest.kind === "measure";
  const limit = isMeasure ? 1 : Math.max(1, contest.numberVotingFor ?? 1);
  const options = isMeasure ? (contest.measure?.responses ?? []) : contest.candidates.map((c) => c.name);
  const multi = limit > 1;

  return (
    <article className="card" aria-labelledby={`${groupId}-title`}>
      <header>
        {isMeasure && (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("ballot.measure")}</p>
        )}
        <h4 id={`${groupId}-title`} className="text-lg font-bold sm:text-xl">
          {softCase(contest.title)}
        </h4>
        {contest.subtitle && <p className="muted">{softCase(contest.subtitle)}</p>}
        <p className="muted mt-1 text-sm">
          {contest.district && (
            <span>
              {t("ballot.district")}: {softCase(contest.district)}
            </span>
          )}
          {!isMeasure && (
            <span>
              {contest.district ? " · " : ""}
              {t("ballot.voteFor", { n: limit })}
            </span>
          )}
        </p>
      </header>

      {isMeasure && contest.measure && <MeasureDetails contest={contest} />}

      {!isMeasure && contest.candidates.length === 0 && <p className="mt-3">{t("ballot.noCandidates")}</p>}

      {!isMeasure && contest.candidates.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {contest.candidates.map((c) => (
            <li key={c.name}>
              <CandidateCard candidate={c} />
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 && (
        <fieldset className="no-print mt-4 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
          <legend className="px-1 text-sm font-semibold">
            {t("ballot.choose")}
            {multi && <span className="muted font-normal"> — {t("ballot.limit", { n: limit })}</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              const atLimit = multi && !checked && selected.length >= limit;
              return (
                <label
                  key={opt}
                  className={
                    "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 " +
                    (checked
                      ? "border-brand-700 bg-brand-50 font-semibold dark:border-sky-300 dark:bg-slate-800"
                      : "border-slate-300 dark:border-slate-600") +
                    (atLimit ? " cursor-not-allowed opacity-50" : "")
                  }
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={groupId}
                    className="h-5 w-5 accent-brand-700"
                    checked={checked}
                    disabled={atLimit}
                    onChange={() => onToggle(opt, limit)}
                    onClick={(e) => {
                      // Allow un-selecting a radio by clicking it again.
                      if (!multi && checked) {
                        e.preventDefault();
                        onClear();
                      }
                    }}
                  />
                  {softCase(opt)}
                </label>
              );
            })}
            {selected.length > 0 && (
              <button type="button" className="btn-ghost text-sm" onClick={onClear}>
                {t("ballot.clear")}
              </button>
            )}
          </div>
        </fieldset>
      )}

      <SourceBadges sources={contest.sources} className="mt-3" />
    </article>
  );
}

const CHANNEL_URLS: Record<string, (id: string) => string> = {
  facebook: (id) => `https://www.facebook.com/${id}`,
  twitter: (id) => `https://x.com/${id}`,
  youtube: (id) => `https://www.youtube.com/${id}`,
  instagram: (id) => `https://www.instagram.com/${id}`,
};

export function channelUrl(type: string, id: string): string | undefined {
  if (/^https?:\/\//i.test(id)) return id;
  const make = CHANNEL_URLS[type.toLowerCase()];
  return make ? make(encodeURIComponent(id.replace(/^@/, ""))) : undefined;
}

function CandidateCard({ candidate: c }: { candidate: Candidate }) {
  const { t } = useI18n();
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <div className="flex h-full gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      {c.photoUrl && !photoFailed ? (
        <img
          src={c.photoUrl}
          alt={t("ballot.photo", { name: softCase(c.name) })}
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          {softCase(c.name)
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold">{softCase(c.name)}</p>
        <p className="muted text-sm">{c.party ?? t("ballot.noParty")}</p>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {c.url && (
            <li>
              <a className="link" href={c.url} target="_blank" rel="noopener noreferrer nofollow">
                {t("ballot.website")}
              </a>
            </li>
          )}
          {c.email && (
            <li>
              <a className="link" href={`mailto:${c.email}`}>
                {t("ballot.email")}
              </a>
            </li>
          )}
          {c.phone && (
            <li>
              <a className="link" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>
                {c.phone}
              </a>
            </li>
          )}
          {c.channels.map((ch) => {
            const url = channelUrl(ch.type, ch.id);
            return url ? (
              <li key={`${ch.type}-${ch.id}`}>
                <a className="link" href={url} target="_blank" rel="noopener noreferrer nofollow">
                  {ch.type}
                </a>
              </li>
            ) : null;
          })}
        </ul>
      </div>
    </div>
  );
}

function MeasureDetails({ contest }: { contest: Contest }) {
  const { t } = useI18n();
  const m = contest.measure!;
  const [showFull, setShowFull] = useState(false);
  const textId = useId();
  // Some feeds put the whole measure in referendumText with no summary; show it as the summary
  // when it's short, and behind "Read the full text" when it's long.
  const summary = m.summary ?? (m.fullText && m.fullText.length <= 600 ? m.fullText : undefined);
  const fullText = m.fullText && m.fullText !== summary ? m.fullText : undefined;

  return (
    <div className="mt-3 space-y-3">
      {summary && (
        <div>
          <h5 className="font-semibold">{t("ballot.summary")}</h5>
          <p className="whitespace-pre-line">{summary}</p>
        </div>
      )}
      {(m.pro || m.con) && (
        <div className="grid gap-3 md:grid-cols-2">
          {m.pro && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <h5 className="font-semibold">{t("ballot.pro")}</h5>
              <p className="mt-1 whitespace-pre-line text-sm">{m.pro}</p>
            </div>
          )}
          {m.con && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <h5 className="font-semibold">{t("ballot.con")}</h5>
              <p className="mt-1 whitespace-pre-line text-sm">{m.con}</p>
            </div>
          )}
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {m.passageThreshold && (
          <div>
            <dt className="inline font-semibold">{t("ballot.threshold")}: </dt>
            <dd className="inline">{softCase(m.passageThreshold)}</dd>
          </div>
        )}
        {m.effectOfAbstain && (
          <div>
            <dt className="inline font-semibold">{t("ballot.abstain")}: </dt>
            <dd className="inline">{m.effectOfAbstain}</dd>
          </div>
        )}
      </dl>
      {fullText && (
        <div>
          <button
            type="button"
            className="btn-ghost -ml-4"
            aria-expanded={showFull}
            aria-controls={textId}
            onClick={() => setShowFull((s) => !s)}
          >
            {showFull ? t("ballot.hideFull") : t("ballot.showFull")}
          </button>
          <div id={textId} hidden={!showFull} className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <h5 className="sr-only">{t("ballot.fullText")}</h5>
            <p className="whitespace-pre-line">{fullText}</p>
          </div>
        </div>
      )}
      {m.url && (
        <a className="link text-sm" href={m.url} target="_blank" rel="noopener noreferrer">
          {t("ballot.moreInfo")}
        </a>
      )}
    </div>
  );
}
