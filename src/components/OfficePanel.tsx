import type { ElectionOffice } from "../../shared/types.ts";
import { addressLines } from "../lib/format.ts";
import { useI18n, type MessageKey } from "../lib/i18n.tsx";
import { SourceBadges } from "./SourceBadge.tsx";

/** FR-9: state and local election office links and contact details. */
export function OfficePanel({ offices }: { offices: ElectionOffice[] }) {
  const { t } = useI18n();
  if (!offices.length) return null;
  return (
    <section className="card" aria-labelledby="offices-title">
      <h2 id="offices-title" className="h2">
        {t("office.title")}
      </h2>
      <p className="muted mt-1">{t("office.lead")}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {offices.map((o) => (
          <article key={`${o.scope}-${o.jurisdiction}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {o.scope === "state" ? t("office.state") : t("office.local")}
            </p>
            <h3 className="h3">{o.name ? `${o.jurisdiction} — ${o.name}` : o.jurisdiction}</h3>
            {o.links.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {o.links.map((l) => (
                  <li key={`${l.key}-${l.url}`}>
                    <a className="link" href={l.url} target="_blank" rel="noopener noreferrer">
                      {t(`office.link.${l.key}` as MessageKey)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {o.address && (
              <div className="mt-3 text-sm">
                <p className="font-semibold">{t("office.address")}</p>
                <address className="not-italic">
                  {addressLines(o.address).map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </address>
              </div>
            )}
            {o.hours && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">{t("office.hours")}: </span>
                {o.hours}
              </p>
            )}
            {o.officials.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-semibold">{t("office.contact")}</p>
                <ul className="space-y-1">
                  {o.officials.map((p, i) => (
                    <li key={i}>
                      {[p.name, p.title].filter(Boolean).join(", ")}
                      {p.phone && (
                        <>
                          {" · "}
                          <a className="link" href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>
                            {p.phone}
                          </a>
                        </>
                      )}
                      {p.email && (
                        <>
                          {" · "}
                          <a className="link" href={`mailto:${p.email}`}>
                            {p.email}
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SourceBadges sources={o.sources} className="mt-3" />
          </article>
        ))}
      </div>
    </section>
  );
}
