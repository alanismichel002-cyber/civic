import type { ElectionOffice } from "../../shared/types.ts";
import { useI18n } from "../lib/i18n.tsx";
import { OfficePanel } from "./OfficePanel.tsx";

/** FR-11: explains why there's no data and points to official sources. */
export function EmptyState({ offices = [] }: { offices?: ElectionOffice[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <section className="card" aria-labelledby="empty-title">
        <h2 id="empty-title" className="h2">
          {t("empty.title")}
        </h2>
        <p className="mt-2">{t("empty.body")}</p>
        <p className="mt-3">
          <a className="link" href="https://vote.gov/" target="_blank" rel="noopener noreferrer">
            {t("empty.voteGov")}
          </a>
        </p>
      </section>
      {offices.length > 0 && <OfficePanel offices={offices} />}
    </div>
  );
}
