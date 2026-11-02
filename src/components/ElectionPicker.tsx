import { useId, useState } from "react";
import type { Election } from "../../shared/types.ts";
import { formatDay } from "../lib/format.ts";
import { useI18n } from "../lib/i18n.tsx";

/** FR-3: when several elections apply to an address, let the voter pick one. */
export function ElectionPicker({
  current,
  others,
  onPick,
  disabled,
}: {
  current: Election;
  others: Election[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const options = [current, ...others];
  const [selected, setSelected] = useState(current.id);
  if (!others.length) return null;
  return (
    <form
      className="card no-print border-brand-600 dark:border-sky-400"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected !== current.id) onPick(selected);
      }}
    >
      <label htmlFor={id} className="h3 block">
        {t("picker.label")}
      </label>
      <p className="muted mb-2 text-sm">{t("picker.help")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select id={id} className="input flex-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {options.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {formatDay(e.day, lang, "medium")}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary" disabled={disabled || selected === current.id}>
          {t("picker.show")}
        </button>
      </div>
    </form>
  );
}
