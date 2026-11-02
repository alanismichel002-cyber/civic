import { useRef, useState } from "react";
import type { VoterInfo } from "../../shared/types.ts";
import type { Choices } from "../lib/choices.ts";
import { addressOneLine, formatDay, softCase } from "../lib/format.ts";
import { downloadFile } from "../lib/ics.ts";
import { useI18n, type MessageKey } from "../lib/i18n.tsx";
import { groupContests } from "./SampleBallot.tsx";

/** FR-12: printable / saveable summary of the voter's own choices. */
export function CheatSheet({ info, choices }: { info: VoterInfo; choices: Choices }) {
  const { t, lang } = useI18n();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const marked = info.contests.filter((c) => (choices[c.id] ?? []).length > 0);
  const polling = info.pollingLocations[0];

  async function saveImage() {
    if (!sheetRef.current) return;
    setSaving(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(sheetRef.current, { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true });
      if (blob) downloadFile(`cheat-sheet-${info.election.id}.png`, blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card no-print" aria-labelledby="sheet-title">
        <h2 id="sheet-title" className="h2">
          {t("sheet.heading")}
        </h2>
        <p className="mt-1">{t("sheet.lead")}</p>
        {marked.length === 0 ? (
          <p className="mt-3">
            {t("sheet.empty")}{" "}
            <a className="link" href="#/ballot">
              {t("sheet.goBallot")}
            </a>
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              <span aria-hidden="true">🖨</span> {t("sheet.print")}
            </button>
            <button type="button" className="btn-secondary" onClick={saveImage} disabled={saving}>
              {saving ? t("sheet.saving") : t("sheet.image")}
            </button>
          </div>
        )}
      </section>

      {marked.length > 0 && (
        // Always light so the printed page and saved image look the same.
        <div ref={sheetRef} className="rounded-2xl border border-slate-300 bg-white p-5 text-slate-900 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">{info.election.name}</p>
          <p className="text-2xl font-bold">{formatDay(info.election.day, lang)}</p>
          {polling && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-sm font-semibold">{t("sheet.where")}</p>
              <p>{[softCase(polling.name), addressOneLine(polling.address)].filter(Boolean).join(" — ")}</p>
              {polling.hours && <p className="text-sm text-slate-700">{polling.hours.split("\n").slice(-1)[0]}</p>}
            </div>
          )}
          {groupContests(info.contests).map(([level, list]) => (
            <div key={level} className="mt-4 border-t border-slate-200 pt-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t(`level.${level}` as MessageKey)}</h3>
              <ol className="mt-1 divide-y divide-slate-100">
                {list.map((c) => {
                  const picks = choices[c.id] ?? [];
                  return (
                    <li key={c.id} className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:justify-between sm:gap-4">
                      <span className="text-sm">{softCase(c.title)}</span>
                      <span className={picks.length ? "font-bold" : "text-sm italic text-slate-500"}>
                        {picks.length ? picks.map(softCase).join(", ") : t("sheet.notMarked")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          <p className="mt-4 text-xs text-slate-500">{t("sheet.generated")}</p>
        </div>
      )}
    </div>
  );
}
