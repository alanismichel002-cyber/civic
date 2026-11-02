import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AddressSuggestion } from "../../shared/types.ts";
import { fetchSuggestions } from "../lib/api.ts";
import { useI18n } from "../lib/i18n.tsx";

interface Props {
  initialValue?: string;
  loading: boolean;
  onSubmit: (address: string) => void;
  compact?: boolean;
}

/** Same checks as the server, so most mistakes are caught before a request. */
export function isPlausibleAddress(a: string): boolean {
  const s = a.replace(/\s+/g, " ").trim();
  return s.length >= 5 && s.length <= 200 && /[a-z]/i.test(s);
}

/** FR-1: address entry with autocomplete (ARIA 1.2 combobox pattern) and validation. */
export function AddressForm({ initialValue = "", loading, onSubmit, compact = false }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const skipNextFetch = useRef(false);
  // Suggestions are only fetched/shown while the user is typing in the field.
  const focused = useRef(false);
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  useEffect(() => {
    skipNextFetch.current = true;
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 4 || !focused.current) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSuggestions(q, controller.signal)
        .then((s) => {
          setSuggestions(s);
          setActive(-1);
          setOpen(s.length > 0 && focused.current);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function choose(s: AddressSuggestion) {
    skipNextFetch.current = true;
    setValue(s.label);
    setOpen(false);
    setSuggestions([]);
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    if (!isPlausibleAddress(value)) {
      setError(t("form.invalid"));
      return;
    }
    setError(null);
    onSubmit(value.replace(/\s+/g, " ").trim());
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const expanded = open && suggestions.length > 0;

  return (
    <form onSubmit={submit} noValidate role="search" aria-label={t("form.label")}>
      <label htmlFor={`${id}-input`} className={compact ? "sr-only" : "mb-2 block pl-[22px] text-sm font-semibold"}>
        {t("form.label")}
      </label>
      <div
        className={
          compact
            ? "glass flex gap-1.5 rounded-full p-1.5"
            : "flex flex-col gap-2 sm:glass sm:flex-row sm:rounded-full sm:p-2"
        }
      >
        <div className="relative flex-1">
          <input
            id={`${id}-input`}
            type="text"
            inputMode="text"
            autoComplete="street-address"
            spellCheck={false}
            className={
              compact
                ? "input min-h-[44px] border-0 bg-transparent text-[15px] shadow-none backdrop-blur-none dark:bg-transparent"
                : "input sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none sm:dark:bg-transparent"
            }
            placeholder={t("form.placeholder")}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => {
              focused.current = true;
              if (suggestions.length) setOpen(true);
            }}
            onBlur={() => {
              focused.current = false;
              setTimeout(() => setOpen(false), 150);
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={!!error}
            aria-describedby={[compact ? "" : hintId, error ? errorId : ""].filter(Boolean).join(" ") || undefined}
            maxLength={200}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label={t("form.suggestions")}
            hidden={!expanded}
            className="absolute z-[1000] mt-2 max-h-72 w-full overflow-auto rounded-[22px] border border-white/85 bg-white/90 py-1.5 shadow-[0_20px_50px_rgba(30,40,110,.18)] backdrop-blur-[32px] dark:border-white/10 dark:bg-slate-900/95"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.label}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={
                  "mx-1.5 cursor-pointer rounded-2xl px-4 py-3 text-base " +
                  (i === active ? "bg-brand-100 dark:bg-white/15" : "hover:bg-white dark:hover:bg-white/10")
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
              >
                {s.label}
              </li>
            ))}
          </ul>
          <span className="sr-only" aria-live="polite">
            {expanded ? t("form.suggestionsCount", { n: suggestions.length }) : ""}
          </span>
        </div>
        <button
          type="submit"
          className={
            compact
              ? "btn shrink-0 bg-slate-900/90 px-4 text-[15px] text-white hover:bg-slate-900 dark:bg-white/90 dark:text-slate-900"
              : "btn-primary w-full shrink-0 sm:w-auto"
          }
          disabled={loading}
        >
          {loading ? t("form.loading") : t("form.submit")}
        </button>
      </div>
      {!compact && (
        <p id={hintId} className="muted mt-3 pl-[22px] text-[13px]">
          {t("form.hint")}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-2 pl-[22px] font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
