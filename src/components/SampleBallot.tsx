import { useId, useMemo, useState } from "react";
import type { Candidate, Contest, ContestLevel, VoterInfo } from "../../shared/types.ts";
import { CONTEST_LEVEL_ORDER } from "../../shared/types.ts";
import type { Choices } from "../lib/choices.ts";
import { softCase } from "../lib/format.ts";
import { useI18n, type MessageKey } from "../lib/i18n.tsx";
import { SourceBadges } from "./SourceBadge.tsx";
import { CandidateLinks, CandidatePhoto, candidateHref } from "./CandidatePage.tsx";
import { MeasureSummary, type SummaryContext } from "./MeasureSummary.tsx";

const MIN_TEXT_FOR_SUMMARY = 400;

interface Props {
  info: VoterInfo;
  choices: Choices;
  onToggle: (contestId: string, option: string, limit: number) => void;
  onClear: (contestId: string) => void;
  onClearAll: () => void;
  summary?: SummaryContext;
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
export function SampleBallot({ info, choices, onToggle, onClear, onClearAll, summary }: Props) {
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
    <div className="space-y-[18px]">
      <section className="card" aria-labelledby="ballot-title">
        <h2 id="ballot-title" className="text-[28px] font-bold tracking-[-0.035em] text-[#0b1220] sm:text-[36px] dark:text-white">
          {t("ballot.heading")}
        </h2>
        <p className="mt-1">{t("ballot.lead")}</p>
        <p className="muted mt-2 text-sm">
          <span aria-hidden="true">🔒 </span>
          {t("ballot.saved")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="min-w-[180px] flex-1">
            <p className="font-medium" aria-live="polite">
              <span className="text-[30px] font-bold leading-none text-brand-700 dark:text-sky-300">{marked}</span>{" "}
              <span className="muted">{t("ballot.progress", { n: "", total: info.contests.length }).trim()}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/[.08] dark:bg-white/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-[linear-gradient(180deg,#4a7bff,#1e40af)] transition-[width]"
                style={{ width: `${info.contests.length ? (marked / info.contests.length) * 100 : 0}%` }}
              />
            </div>
          </div>
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
                    className="chip"
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
          <h3 id={`level-${level}`} tabIndex={-1} className="scroll-mt-28 px-2 text-2xl font-bold tracking-[-0.025em] text-[#0b1220] dark:text-white">
            {t(`level.${level}` as MessageKey)}
          </h3>
          {list.map((c) => (
            <ContestCard
              key={c.id}
              contest={c}
              selected={choices[c.id] ?? []}
              onToggle={(opt, limit) => onToggle(c.id, opt, limit)}
              onClear={() => onClear(c.id)}
              summary={summary}
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
  summary,
}: {
  contest: Contest;
  selected: string[];
  onToggle: (option: string, limit: number) => void;
  onClear: () => void;
  summary?: SummaryContext;
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
        <h4 id={`${groupId}-title`} className="text-lg font-bold tracking-[-0.02em] sm:text-xl">
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

      {isMeasure && contest.measure && <MeasureDetails contest={contest} summary={summary} />}

      {!isMeasure && contest.candidates.length === 0 && <p className="mt-3">{t("ballot.noCandidates")}</p>}

      {!isMeasure && contest.candidates.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {contest.candidates.map((c, i) => (
            <li key={c.name}>
              <CandidateCard candidate={c} href={candidateHref(contest.id, i)} />
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 && (
        <fieldset className="no-print mt-5">
          <legend className="px-1 text-sm font-semibold">
            {t("ballot.choose")}
            {multi && <span className="muted font-normal"> — {t("ballot.limit", { n: limit })}</span>}
          </legend>
          <div className={`mt-1 flex flex-wrap gap-2 ${isMeasure ? "seg-track w-fit" : ""}`}>
            {options.map((opt) => {
              const checked = selected.includes(opt);
              const atLimit = multi && !checked && selected.length >= limit;
              return (
                <label
                  key={opt}
                  data-active={checked}
                  className={
                    (isMeasure
                      ? "seg-item min-h-[44px] cursor-pointer gap-2 px-5 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 "
                      : "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 py-2 transition " +
                        (checked
                          ? "border-white bg-white/90 font-semibold text-brand-700 shadow-[0_0_0_2px_rgba(29,78,216,.5),0_6px_18px_rgba(30,64,175,.12)] dark:border-sky-300/40 dark:bg-white/15 dark:text-white"
                          : "border-white/80 bg-white/50 hover:bg-white/80 dark:border-white/10 dark:bg-white/5")) +
                    (atLimit ? " cursor-not-allowed opacity-50" : "")
                  }
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={groupId}
                    className={isMeasure ? "sr-only" : "h-5 w-5 accent-brand-700"}
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
              <button type="button" className="btn-ghost btn-sm" onClick={onClear}>
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

function CandidateCard({ candidate: c, href }: { candidate: Candidate; href: string }) {
  const { t } = useI18n();
  return (
    <div className="card-inset flex h-full gap-3 p-3">
      <CandidatePhoto c={c} size="sm" />
      <div className="min-w-0">
        <a className="link font-semibold" href={href}>
          {softCase(c.name)}
          <span className="sr-only"> — {t("candidate.details")}</span>
        </a>
        <p className="muted text-sm">{c.party ? softCase(c.party) : t("ballot.noParty")}</p>
        <CandidateLinks c={c} />
      </div>
    </div>
  );
}

function MeasureDetails({ contest, summary: ai }: { contest: Contest; summary?: SummaryContext }) {
  const { t } = useI18n();
  const m = contest.measure!;
  const [showFull, setShowFull] = useState(false);
  const textId = useId();
  // Some feeds put the whole measure in referendumText with no summary; show it as the summary
  // when it's short, and behind "Read the full text" when it's long.
  const summary = m.summary ?? (m.fullText && m.fullText.length <= 600 ? m.fullText : undefined);
  const fullText = m.fullText && m.fullText !== summary ? m.fullText : undefined;
  const textLength = [m.title, m.summary, m.fullText].join(" ").length;

  return (
    <div className="mt-3 space-y-3">
      {ai && textLength >= MIN_TEXT_FOR_SUMMARY && <MeasureSummary ctx={ai} contestId={contest.id} />}
      {summary && (
        <div>
          <h5 className="font-semibold">{t("ballot.summary")}</h5>
          <p className="whitespace-pre-line">{summary}</p>
        </div>
      )}
      {(m.pro || m.con) && (
        <div className="grid gap-3 md:grid-cols-2">
          {m.pro && (
            <div className="card-inset p-3">
              <h5 className="font-semibold">{t("ballot.pro")}</h5>
              <p className="mt-1 whitespace-pre-line text-sm">{m.pro}</p>
            </div>
          )}
          {m.con && (
            <div className="card-inset p-3">
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
          <div id={textId} hidden={!showFull} className="card-inset max-h-96 overflow-auto text-sm">
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
