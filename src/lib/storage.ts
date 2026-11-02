// Browser storage that never throws (private mode, blocked storage, etc.).
function make(kind: "localStorage" | "sessionStorage") {
  const s = (): Storage | undefined => {
    try {
      return typeof window !== "undefined" ? window[kind] : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    get(key: string): string | null {
      try {
        return s()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        s()?.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    remove(key: string): void {
      try {
        s()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Per-device, persistent: language and ballot choices. */
export const storage = make("localStorage");
/** Per-tab: the address being looked up, so a refresh doesn't lose results. Cleared when the tab closes. */
export const session = make("sessionStorage");
