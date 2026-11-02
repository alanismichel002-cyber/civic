import { useEffect, useState } from "react";
import { ApiRequestError, fetchRepresentatives, type Representatives } from "../lib/api.ts";
import { useI18n } from "../lib/i18n.tsx";
import type { Official } from "../../shared/server/representatives.ts";
import { CandidateLinks, initials } from "./CandidatePage.tsx";
import { ErrorNotice } from "./ErrorNotice.tsx";
import { SourceBadges } from "./SourceBadge.tsx";

/** FR-18: who represents this address in Congress and the state legislature. */
export function RepresentativesView({ address }: { address: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<Representatives | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    setData(null);
    setError(null);
    fetchRepresentatives(address, controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof ApiRequestError ? e.code : "network");
      });
    return () => controller.abort();
  }, [address, attempt]);

  if (error) return <ErrorNotice code={error} onRetry={() => setAttempt((a) => a + 1)} />;
  if (!data) {
    return (
      <div role="status" className="space-y-4">
        <p className="font-medium">{t("reps.loading")}</p>
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  const federal = data.officials.filter((o) => o.level === "federal");
  const state = data.officials.filter((o) => o.level === "state");
  const d = data.districts;

  return (
    <div className="space-y-6">
      <section className="card" aria-labelledby="reps-title">
        <h2 id="reps-title" className="h2">
          {t("reps.heading")}
        </h2>
        <p className="mt-1">{t("reps.lead")}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {data.state && <DistrictRow label={t("reps.state")} value={data.state} />}
          {d.congressional && <DistrictRow label={t("reps.cd")} value={d.congressional} />}
          {d.stateUpper && <DistrictRow label={t("reps.upper")} value={d.stateUpper} />}
          {d.stateLower && <DistrictRow label={t("reps.lower")} value={d.stateLower} />}
          {d.county && <DistrictRow label={t("reps.county")} value={d.county} />}
        </dl>
      </section>

      <section aria-labelledby="reps-federal" className="space-y-3">
        <h3 id="reps-federal" className="h2 px-1">
          {t("reps.federal")}
        </h3>
        {federal.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {federal.map((o) => (
              <li key={o.id}>
                <OfficialCard o={o} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="card">{t("reps.none")}</p>
        )}
      </section>

      <section aria-labelledby="reps-state" className="space-y-3">
        <h3 id="reps-state" className="h2 px-1">
          {t("reps.stateLeg")}
        </h3>
        {state.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {state.map((o) => (
              <li key={o.id}>
                <OfficialCard o={o} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="card">
            <p>{data.stateLegislatorsAvailable ? t("reps.none") : t("reps.stateFallback")}</p>
            <a className="link mt-2 inline-block" href={data.findStateLegislatorsUrl} target="_blank" rel="noopener noreferrer">
              {t("reps.findState")}
            </a>
          </div>
        )}
      </section>

      {data.divisions.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">{t("reps.divisions")}</summary>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {data.divisions.map((x) => (
              <li key={x.id}>{x.name}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="muted px-1 text-sm">{t("reps.note")}</p>
    </div>
  );
}

function DistrictRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold">{label}: </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}

function OfficialCard({ o }: { o: Official }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return (
    <article className="card flex h-full gap-4">
      {o.photoUrl && !failed ? (
        <img
          src={o.photoUrl}
          alt={t("ballot.photo", { name: o.name })}
          className="h-28 w-24 shrink-0 rounded-xl object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          {initials(o.name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          {o.office}
          {o.district && o.chamber !== "senate" ? ` · ${o.district}` : ""}
        </p>
        <h4 className="text-lg font-bold">{o.name}</h4>
        {o.party && <p className="muted text-sm">{o.party}</p>}
        <CandidateLinks c={{ name: o.name, url: o.url, phone: o.phone, email: o.email, channels: o.channels }} />
        {o.contactForm && (
          <a className="link mt-1 inline-block text-sm" href={o.contactForm} target="_blank" rel="noopener noreferrer">
            {t("reps.contactForm")}
          </a>
        )}
        {o.address && <p className="muted mt-1 text-xs">{o.address}</p>}
        <SourceBadges sources={[o.source]} className="mt-2" />
      </div>
    </article>
  );
}
