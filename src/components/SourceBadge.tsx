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
              ? "bg-[rgba(4,120,87,.10)] text-[#065f46] dark:bg-emerald-400/15 dark:text-emerald-300"
              : "bg-[rgba(180,83,9,.10)] text-[#92400e] dark:bg-amber-400/15 dark:text-amber-300")
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
