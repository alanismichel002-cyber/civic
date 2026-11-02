// Privacy-friendly, cookieless analytics (Plausible), only when VITE_PLAUSIBLE_DOMAIN is set at build.
// Events carry no addresses, contacts, or ballot choices — just counts for the PRD success metrics.

type Props = Record<string, string | number | boolean>;
declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: Props; u?: string }) => void) & { q?: unknown[] };
  }
}

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ?? "https://plausible.io/js/script.manual.js";

export function initAnalytics() {
  if (!DOMAIN || typeof document === "undefined") return;
  window.plausible =
    window.plausible ||
    Object.assign((...args: unknown[]) => (window.plausible!.q = window.plausible!.q || []).push(args), { q: [] as unknown[] });
  const s = document.createElement("script");
  s.defer = true;
  s.dataset.domain = DOMAIN;
  s.src = SRC;
  document.head.appendChild(s);
}

/** Page views use the route only (e.g. "/plan"); shared-plan payloads are stripped. */
export function trackPage(route: string) {
  if (!DOMAIN) return;
  const path = route.startsWith("shared") ? "/shared" : route.startsWith("candidate") ? "/candidate" : `/${route}`;
  window.plausible?.("pageview", { u: `${location.origin}${path}` });
}

export function track(event: string, props?: Props) {
  if (!DOMAIN) return;
  window.plausible?.(event, props ? { props } : undefined);
}
