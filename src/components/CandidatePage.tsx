import { useState } from "react";
import type { Candidate, Contest } from "../../shared/types.ts";
import { softCase } from "../lib/format.ts";
import { useI18n, type MessageKey } from "../lib/i18n.tsx";
import { SourceBadges } from "./SourceBadge.tsx";

const CHANNEL_URLS: Record<string, (id: string) => string> = {
  facebook: (id) => `https://www.facebook.com/${id}`,
  twitter: (id) => `https://x.com/${id}`,
  x: (id) => `https://x.com/${id}`,
  youtube: (id) => `https://www.youtube.com/${id}`,
  instagram: (id) => `https://www.instagram.com/${id}`,
  linkedin: (id) => `https://www.linkedin.com/in/${id}`,
  tiktok: (id) => `https://www.tiktok.com/@${id}`,
};

/** Social channel id -> URL. Only http(s) URLs are ever returned. */
export function channelUrl(type: string, id: string): string | undefined {
  if (/^https?:\/\//i.test(id)) return id;
  if (/^[a-z]+:/i.test(id)) return undefined;
  const make = CHANNEL_URLS[type.toLowerCase()];
  return make ? make(encodeURIComponent(id.replace(/^@/, ""))) : undefined;
}

export function candidateHref(contestId: string, index: number) {
  return `#/candidate/${encodeURIComponent(contestId)}/${index}`;
}

export function initials(name: string) {
  return softCase(name)
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

export function CandidatePhoto({ c, size }: { c: Candidate; size: "sm" | "lg" }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const dims = size === "lg" ? "h-40 w-32 sm:h-48 sm:w-40 text-4xl rounded-[22px]" : "h-[60px] w-[60px] text-lg rounded-2xl";
  if (c.photoUrl && !failed) {
    return (
      <img
        src={c.photoUrl}
        alt={t("ballot.photo", { name: softCase(c.name) })}
        className={`${dims} shrink-0 object-cover`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${dims} flex shrink-0 items-center justify-center bg-white/80 font-bold text-brand-700 shadow-[inset_0_1px_0_#fff] dark:bg-white/10 dark:text-sky-300`}
    >
      {initials(c.name)}
    </div>
  );
}

/** Contact and social links for a candidate. Empty fields are simply skipped. */
export function CandidateLinks({ c, large = false }: { c: Candidate; large?: boolean }) {
  const { t } = useI18n();
  const items: { label: string; href: string; external: boolean }[] = [];
  if (c.url) items.push({ label: t("ballot.website"), href: c.url, external: true });
  if (c.email) items.push({ label: large ? c.email : t("ballot.email"), href: `mailto:${c.email}`, external: false });
  if (c.phone) items.push({ label: c.phone, href: `tel:${c.phone.replace(/[^\d+]/g, "")}`, external: false });
  for (const ch of c.channels) {
    const href = channelUrl(ch.type, ch.id);
    if (href) items.push({ label: ch.type, href, external: true });
  }
  if (!items.length) return large ? <p className="muted">{t("candidate.noContact")}</p> : null;
  return (
    <ul className={large ? "space-y-2" : "mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm"}>
      {items.map((i) => (
        <li key={i.href}>
          <a
            className="link break-all"
            href={i.href}
            {...(i.external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          >
            {i.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  contest: Contest | undefined;
  index: number;
  selected: string[];
  onToggle: (contestId: string, option: string, limit: number) => void;
}

/** Candidate detail page: photo, party, website, contacts, and the rest of the race in ballot order. */
export function CandidatePage({ contest, index, selected, onToggle }: Props) {
  const { t } = useI18n();
  const c = contest?.candidates[index];
  if (!contest || !c) {
    return (
      <div className="card" role="alert">
        <p>{t("candidate.notFound")}</p>
        <a className="btn-primary mt-3" href="#/ballot">
          {t("candidate.back")}
        </a>
      </div>
    );
  }
  const limit = Math.max(1, contest.numberVotingFor ?? 1);
  const isChosen = selected.includes(c.name);
  const full = !isChosen && limit > 1 && selected.length >= limit;

  return (
    <div className="space-y-6">
      <a className="link no-print inline-flex min-h-[44px] items-center" href={`#/ballot`}>
        ← {t("candidate.back")}
      </a>

      <article className="card" aria-labelledby="candidate-name">
        <div className="flex flex-col gap-5 sm:flex-row">
          <CandidatePhoto c={c} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t(`level.${contest.level}` as MessageKey)}
            </p>
            <h2 id="candidate-name" className="text-3xl font-extrabold tracking-tight">
              {softCase(c.name)}
            </h2>
            <p className="mt-1 text-lg">{c.party ? softCase(c.party) : t("ballot.noParty")}</p>
            <p className="muted mt-2">
              {t("candidate.runningFor")} <span className="font-semibold">{softCase(contest.title)}</span>
              {contest.district && <> · {softCase(contest.district)}</>}
            </p>
            {contest.numberVotingFor && contest.numberVotingFor > 1 && (
              <p className="muted text-sm">{t("ballot.voteFor", { n: contest.numberVotingFor })}</p>
            )}
            <button
              type="button"
              className={`${isChosen ? "btn-primary" : "btn-secondary"} no-print mt-4`}
              aria-pressed={isChosen}
              disabled={full}
              onClick={() => onToggle(contest.id, c.name, limit)}
            >
              {isChosen ? `✓ ${t("candidate.marked")}` : t("candidate.mark")}
            </button>
            {full && <p className="muted mt-1 text-sm">{t("ballot.limit", { n: limit })}</p>}
          </div>
        </div>
      </article>

      <section className="card" aria-labelledby="candidate-contact">
        <h3 id="candidate-contact" className="h3">
          {t("candidate.contact")}
        </h3>
        <div className="mt-2">
          <CandidateLinks c={c} large />
        </div>
        <SourceBadges sources={contest.sources} className="mt-4" />
        <p className="muted mt-3 text-sm">{t("candidate.neutral")}</p>
      </section>

      {contest.candidates.length > 1 && (
        <section className="card" aria-labelledby="candidate-others">
          <h3 id="candidate-others" className="h3">
            {t("candidate.others")}
          </h3>
          <p className="muted text-sm">{t("candidate.ballotOrder")}</p>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2">
            {contest.candidates.map((o, i) => (
              <li key={o.name}>
                <a
                  href={candidateHref(contest.id, i)}
                  aria-current={i === index ? "page" : undefined}
                  className={`flex items-center gap-3 p-3 no-underline transition hover:bg-white/80 ${i === index ? "card-selected" : "card-inset"}`}
                >
                  <CandidatePhoto c={o} size="sm" />
                  <span>
                    <span className="block font-semibold">{softCase(o.name)}</span>
                    <span className="muted block text-sm">{o.party ? softCase(o.party) : t("ballot.noParty")}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
