import { useState } from "react";
import { fetchSummary, type SummaryResult } from "../lib/api.ts";
import { track } from "../lib/analytics.ts";
import { useI18n } from "../lib/i18n.tsx";

export interface SummaryContext {
  enabled: boolean;
  address: string;
  electionId?: string;
}

/** FR-16: on-demand, clearly labeled AI summary. The official text stays one tap away. */
export function MeasureSummary({ ctx, contestId }: { ctx: SummaryContext; contestId: string }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<SummaryResult | null>(null);
  if (!ctx.enabled || !ctx.address) return null;

  async function load() {
    setState("loading");
    try {
      const r = await fetchSummary({ address: ctx.address, electionId: ctx.electionId, contestId, lang });
      setResult(r);
      setState("idle");
      track("measure_summary");
    } catch {
      setState("error");
    }
  }

  if (result && result.lang === lang) {
    return (
      <section
        className="rounded-[20px] border border-white/85 bg-violet-50/80 p-4 shadow-[0_0_0_1px_rgba(109,40,217,.25)] dark:border-white/10 dark:bg-violet-950/50"
        aria-labelledby={`ai-${contestId}`}
      >
        <h5 id={`ai-${contestId}`} className="flex flex-wrap items-center gap-2 font-semibold">
          <span className="rounded-full bg-violet-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white dark:bg-violet-300 dark:text-violet-950">
            {t("ai.badge")}
          </span>
          {t("ai.title")}
        </h5>
        <p className="mt-2 whitespace-pre-line text-sm">{result.summary}</p>
        <p className="muted mt-2 text-xs">{t("ai.disclaimer")}</p>
      </section>
    );
  }

  return (
    <div className="no-print">
      <button type="button" className="btn-secondary btn-sm" onClick={load} disabled={state === "loading"} aria-busy={state === "loading"}>
        <span aria-hidden="true">✨</span> {state === "loading" ? t("ai.loading") : t("ai.button")}
      </button>
      <p className="muted mt-1 text-xs">{t("ai.hint")}</p>
      {state === "error" && (
        <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
          {t("ai.error")}
        </p>
      )}
    </div>
  );
}
