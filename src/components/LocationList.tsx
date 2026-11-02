import { useState } from "react";
import type { VotingLocation } from "../../shared/types.ts";
import { useI18n } from "../lib/i18n.tsx";
import { LocationCard } from "./LocationCard.tsx";

const INITIAL = 3;

export function LocationList({ items, total, numbered = true }: { items: VotingLocation[]; total: number; numbered?: boolean }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, INITIAL);
  return (
    <div>
      <ol className="space-y-3">
        {shown.map((l, i) => (
          <li key={l.id}>
            <LocationCard loc={l} index={numbered ? i : undefined} highlight={i === 0 && numbered} />
          </li>
        ))}
      </ol>
      {items.length > INITIAL && (
        <button type="button" className="btn-ghost mt-2" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? t("plan.showLess") : t("plan.showMore", { n: items.length - INITIAL })}
        </button>
      )}
      {expanded && total > items.length && (
        <p className="muted mt-1 text-sm">{t("plan.truncated", { shown: items.length, total })}</p>
      )}
    </div>
  );
}
