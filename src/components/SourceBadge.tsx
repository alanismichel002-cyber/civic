import type { Source } from "../../shared/types.ts";
import { useI18n } from "../lib/i18n.tsx";

/** FR-10: marks every piece of data as coming from an official or unofficial source. */
export function SourceBadges({ sources, className = "" }: { sources: Source[]; className?: string }) {
  const { t } = useI18n();
  if (!sources.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label={t("sources.list")}>
      {sources.map((s) => (
        <li
          key={`${s.name}-${s.official}`}
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
            (s.official
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800"
              : "bg-amber-50 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800")
          }
        >
          <span aria-hidden="true">{s.official ? "✓" : "!"}</span>
          <span>
            {s.official ? t("source.official") : t("source.unofficial")}
            <span className="sr-only">. </span>
            <span className="font-normal"> · {s.name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
