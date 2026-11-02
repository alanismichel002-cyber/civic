// FR-12: ballot choices, saved only in this browser (localStorage).
import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage.ts";

export type Choices = Record<string, string[]>;

const keyFor = (electionId: string) => `civic.choices.v1.${electionId}`;

export function loadChoices(electionId: string): Choices {
  const raw = storage.get(keyFor(electionId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Choices = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
    }
    return out;
  } catch {
    return {};
  }
}

/** Toggles `option` in a contest; enforces the "vote for N" limit (single choice replaces). */
export function toggleChoice(current: string[], option: string, limit: number): string[] {
  if (current.includes(option)) return current.filter((o) => o !== option);
  if (limit <= 1) return [option];
  if (current.length >= limit) return current;
  return [...current, option];
}

export function useChoices(electionId: string) {
  const [choices, setChoices] = useState<Choices>(() => loadChoices(electionId));

  useEffect(() => setChoices(loadChoices(electionId)), [electionId]);

  const persist = useCallback(
    (next: Choices) => {
      const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v.length));
      if (Object.keys(cleaned).length) storage.set(keyFor(electionId), JSON.stringify(cleaned));
      else storage.remove(keyFor(electionId));
      return cleaned;
    },
    [electionId],
  );

  const toggle = useCallback(
    (contestId: string, option: string, limit: number) =>
      setChoices((prev) => persist({ ...prev, [contestId]: toggleChoice(prev[contestId] ?? [], option, limit) })),
    [persist],
  );
  const clear = useCallback(
    (contestId: string) => setChoices((prev) => persist({ ...prev, [contestId]: [] })),
    [persist],
  );
  const clearAll = useCallback(() => setChoices(persist({})), [persist]);

  return { choices, toggle, clear, clearAll };
}
