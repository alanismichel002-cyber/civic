import { useCallback, useEffect, useRef, useState } from "react";
import type { Election, VoterInfo } from "../shared/types.ts";
import { AddressForm } from "./components/AddressForm.tsx";
import { CheatSheet } from "./components/CheatSheet.tsx";
import { ElectionPicker } from "./components/ElectionPicker.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { ErrorNotice } from "./components/ErrorNotice.tsx";
import { SampleBallot } from "./components/SampleBallot.tsx";
import { SharedPlanView } from "./components/SharedPlanView.tsx";
import { ElectionHeader, VotingPlan } from "./components/VotingPlan.tsx";
import { ApiRequestError, fetchElections, fetchVoterInfo } from "./lib/api.ts";
import { useChoices } from "./lib/choices.ts";
import { formatDay } from "./lib/format.ts";
import { useI18n } from "./lib/i18n.tsx";
import { decodePlan } from "./lib/share.ts";
import { session } from "./lib/storage.ts";

type View = "home" | "plan" | "ballot" | "sheet" | "shared";

interface Route {
  view: View;
  shared?: string;
}

/** Only hashes that start with "#/" are routes; plain "#id" anchors are in-page links. */
function parseRoute(hash: string): Route | undefined {
  if (!hash.startsWith("#/")) return hash ? undefined : { view: "home" };
  const [, view, data] = hash.split("/");
  if (view === "plan" || view === "ballot" || view === "sheet") return { view };
  if (view === "shared" && data) return { view: "shared", shared: data };
  return { view: "home" };
}

function navigate(view: Exclude<View, "shared">) {
  const hash = view === "home" ? "#/" : `#/${view}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}

const DEMO = { address: "340 Main St, Venice, CA 90291", electionId: "2000" };
const REPORT_URL = "https://github.com/alanismichel002-cyber/civic/issues/new";

export function App() {
  const { t, lang, setLang } = useI18n();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash) ?? { view: "home" });
  const [address, setAddress] = useState<string>(() => session.get("civic.address") ?? "");
  const [electionId, setElectionId] = useState<string | undefined>(() => session.get("civic.electionId") ?? undefined);
  const [info, setInfo] = useState<VoterInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onHash = () => {
      const r = parseRoute(window.location.hash);
      if (r) setRoute(r);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Move focus to the main region on view changes so screen readers announce the new content.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [route.view]);

  const lookup = useCallback(async (addr: string, eid?: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setAddress(addr);
    session.set("civic.address", addr);
    if (eid) session.set("civic.electionId", eid);
    else session.remove("civic.electionId");
    setElectionId(eid);
    try {
      const result = await fetchVoterInfo(addr, eid, controller.signal);
      if (controller.signal.aborted) return;
      setInfo(result);
      const r = parseRoute(window.location.hash);
      if (!r || r.view === "home" || r.view === "shared") navigate("plan");
    } catch (e) {
      if (controller.signal.aborted) return;
      setInfo(null);
      setError(e instanceof ApiRequestError ? e.code : "network");
      const r = parseRoute(window.location.hash);
      if (!r || r.view === "home" || r.view === "shared") navigate("plan");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Restore results after a refresh (address is kept in sessionStorage for this tab only).
  useEffect(() => {
    if (route.view !== "home" && route.view !== "shared" && !info && !loading && !error) {
      if (address) void lookup(address, electionId);
      else navigate("home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.view]);

  const { choices, toggle, clear, clearAll } = useChoices(info?.election.id ?? "none");

  const startOver = () => {
    requestRef.current?.abort();
    setInfo(null);
    setError(null);
    setLoading(false);
    navigate("home");
  };

  const inResults = route.view === "plan" || route.view === "ballot" || route.view === "sheet";

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only z-[2000] rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        {t("app.skip")}
      </a>

      <header className="no-print border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/" onClick={startOver} className="flex items-center gap-2 text-xl font-extrabold tracking-tight no-underline">
            <img src="/favicon.svg" alt="" width={32} height={32} />
            <span>{t("app.name")}</span>
          </a>
          <button
            type="button"
            className="btn-ghost min-h-[40px] px-3 text-sm"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            lang={lang === "en" ? "es" : "en"}
            aria-label={t("lang.switchLabel")}
          >
            {t("lang.switch")}
          </button>
        </div>
        {inResults && (
          <nav aria-label={t("nav.label")} className="mx-auto max-w-5xl px-4">
            <ul className="-mb-px flex gap-1 overflow-x-auto">
              {(["plan", "ballot", "sheet"] as const).map((v) => (
                <li key={v}>
                  <a
                    href={`#/${v}`}
                    aria-current={route.view === v ? "page" : undefined}
                    className={
                      "inline-flex min-h-[44px] items-center whitespace-nowrap border-b-[3px] px-3 font-semibold no-underline " +
                      (route.view === v
                        ? "border-brand-700 text-brand-700 dark:border-sky-300 dark:text-sky-300"
                        : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100")
                    }
                  >
                    {t(`nav.${v}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none sm:py-8">
        {route.view === "home" && <Home loading={loading} initialAddress={address} onLookup={lookup} />}

        {route.view === "shared" && <SharedPlanView plan={decodePlan(route.shared ?? "")} onLookup={startOver} />}

        {inResults && (
          <div className="space-y-6">
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <AddressForm compact initialValue={address} loading={loading} onSubmit={(a) => lookup(a)} />
              </div>
            </div>

            <div aria-live="polite" aria-busy={loading}>
              {loading && <LoadingState />}
            </div>

            {!loading && error === "no_election_data" && <EmptyState />}
            {!loading && error && error !== "no_election_data" && (
              <ErrorNotice code={error} onRetry={() => lookup(address, electionId)} />
            )}

            {!loading && info && (
              <>
                <ElectionHeader info={info} />
                <ElectionPicker
                  key={info.election.id}
                  current={info.election}
                  others={info.otherElections}
                  onPick={(id) => lookup(address, id)}
                  disabled={loading}
                />
                {info.isEmpty ? (
                  <EmptyState offices={info.offices} />
                ) : (
                  <>
                    {route.view === "plan" && <VotingPlan info={info} />}
                    {route.view === "ballot" && (
                      <SampleBallot info={info} choices={choices} onToggle={toggle} onClear={clear} onClearAll={clearAll} />
                    )}
                    {route.view === "sheet" && <CheatSheet info={info} choices={choices} />}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white py-6 text-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl space-y-1 px-4">
          <p className="font-medium">{t("footer.nonpartisan")}</p>
          <p className="muted">{t("footer.privacy")}</p>
          <p className="muted">{t("footer.data")}</p>
          <p>
            <a className="link" href={REPORT_URL} target="_blank" rel="noopener noreferrer">
              {t("footer.report")}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="space-y-4" role="status">
      <p className="font-medium">{t("status.loading")}</p>
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function Home({
  loading,
  initialAddress,
  onLookup,
}: {
  loading: boolean;
  initialAddress: string;
  onLookup: (address: string, electionId?: string) => void;
}) {
  const { t, lang } = useI18n();
  const [elections, setElections] = useState<Election[] | null>(null);

  useEffect(() => {
    fetchElections()
      .then((r) => setElections(r.elections))
      .catch(() => setElections([]));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = elections?.filter((e) => e.day >= today);

  return (
    <div className="space-y-8">
      <section className="pt-2 sm:pt-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{t("home.heading")}</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-700 dark:text-slate-300">{t("home.lead")}</p>
      </section>

      <section className="card">
        <AddressForm initialValue={initialAddress} loading={loading} onSubmit={(a) => onLookup(a)} />
        <p className="muted mt-3 text-sm">
          <span aria-hidden="true">🔒 </span>
          {t("home.privacy")}
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="h3">
            {t("home.upcoming")}
          </h2>
          {upcoming === undefined ? (
            <div className="mt-2 h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : upcoming.length === 0 ? (
            <p className="muted mt-2">{t("home.noUpcoming")}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.name}</span>
                  <span className="muted"> — {formatDay(e.day, lang, "medium")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="demo-title">
          <h2 id="demo-title" className="h3">
            {t("home.demo")}
          </h2>
          <p className="muted mt-1 text-sm">{t("home.demoHint")}</p>
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={loading}
            onClick={() => onLookup(DEMO.address, DEMO.electionId)}
          >
            {t("home.demo")}
          </button>
        </section>
      </div>
    </div>
  );
}
