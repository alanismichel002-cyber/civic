import type { SharedLocation, SharedPlan } from "../lib/share.ts";
import { addressLines, daysUntil, directionsUrl, formatDateRange, formatDay, softCase } from "../lib/format.ts";
import { useI18n } from "../lib/i18n.tsx";

export function SharedPlanView({ plan, onLookup }: { plan: SharedPlan | undefined; onLookup: () => void }) {
  const { t, lang } = useI18n();
  if (!plan) {
    return (
      <div className="card" role="alert">
        <p>{t("shared.invalid")}</p>
        <button type="button" className="btn-primary mt-3" onClick={onLookup}>
          {t("shared.lookup")}
        </button>
      </div>
    );
  }
  const days = daysUntil(plan.el.day);
  return (
    <div className="space-y-6">
      <h2 className="sr-only">{t("shared.heading")}</h2>
      <div className="card" role="note">
        <span aria-hidden="true" className="dot mr-2 bg-[#b45309]" />
        <p>{t("shared.warning")}</p>
        <button type="button" className="btn-primary mt-3" onClick={onLookup}>
          {t("shared.lookup")}
        </button>
      </div>
      <div className="rounded-3xl border border-white/40 bg-[linear-gradient(155deg,rgba(74,123,255,.88),rgba(30,64,175,.92))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_24px_50px_rgba(30,64,175,.3)] sm:rounded-[32px] sm:p-8">
        <p className="eyebrow text-[#dbe6fe]">{plan.el.name}</p>
        <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatDay(plan.el.day, lang)}</p>
        {days !== undefined && days > 1 && <p className="mt-1 text-lg">{t("plan.daysLeft", { n: days })}</p>}
        {plan.area && <p className="mt-3 text-sm text-[#dbe6fe]">{t("plan.area", { area: softCase(plan.area) })}</p>}
      </div>
      {plan.mo && (
        <section className="card">
          <h3 className="h3">{t("plan.mailOnly.title")}</h3>
          <p className="mt-1">{t("plan.mailOnly.body")}</p>
        </section>
      )}
      {plan.p && <SharedLocationCard title={t("plan.polling.title")} loc={plan.p} />}
      {plan.ev && <SharedLocationCard title={t("shared.earlyNearest")} loc={plan.ev} />}
      {plan.dr && <SharedLocationCard title={t("shared.dropoffNearest")} loc={plan.dr} />}
      {(plan.es || plan.dd) && (
        <section className="card">
          <ul className="space-y-1">
            {plan.es && (
              <li>
                <span className="font-semibold">{t("cal.earlyStart")}:</span> {formatDay(plan.es, lang)}
              </li>
            )}
            {plan.dd && (
              <li>
                <span className="font-semibold">{t("cal.dropoffDeadline")}:</span> {formatDay(plan.dd, lang)}
              </li>
            )}
          </ul>
        </section>
      )}
      {(plan.reg || plan.info) && (
        <section className="card">
          <ul className="space-y-1">
            {plan.reg && (
              <li>
                <a className="link" href={plan.reg} target="_blank" rel="noopener noreferrer">
                  {t("office.link.registrationCheck")}
                </a>
              </li>
            )}
            {plan.info && (
              <li>
                <a className="link" href={plan.info} target="_blank" rel="noopener noreferrer">
                  {t("office.link.info")}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function SharedLocationCard({ title, loc }: { title: string; loc: SharedLocation }) {
  const { t, lang } = useI18n();
  const dates = formatDateRange(loc.s, loc.e, lang);
  return (
    <section className="card">
      <h3 className="h3">{title}</h3>
      {loc.n && <p className="mt-1 font-semibold">{softCase(loc.n)}</p>}
      <address className="not-italic">
        {addressLines(loc.a).map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </address>
      {dates && <p className="mt-1 text-sm">{t("loc.dates")}: {dates}</p>}
      {loc.h && <p className="mt-1 whitespace-pre-line text-sm">{loc.h}</p>}
      <a className="link mt-2 inline-block text-sm" href={directionsUrl(loc.a, loc.la, loc.ln)} target="_blank" rel="noopener noreferrer">
        {t("loc.directions")}
      </a>
    </section>
  );
}
