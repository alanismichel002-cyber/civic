import { useCallback, useEffect, useRef, useState } from "react";
import type { Election, VoterInfo } from "../shared/types.ts";
import { AddressForm } from "./components/AddressForm.tsx";
import { CheatSheet } from "./components/CheatSheet.tsx";
import { ElectionPicker } from "./components/ElectionPicker.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { ErrorNotice } from "./components/ErrorNotice.tsx";
import { SampleBallot } from "./components/SampleBallot.tsx";
import { SharedPlanView } from "./components/SharedPlanView.tsx";
import { ElectionHeader, PlanChecklist, VotingPlan } from "./components/VotingPlan.tsx";
import { ApiRequestError, fetchElections, fetchVoterInfo } from "./lib/api.ts";
import { useChoices } from "./lib/choices.ts";
import { formatDay } from "./lib/format.ts";
import { useI18n } from "./lib/i18n.tsx";
import { decodePlan } from "./lib/share.ts";
import { session } from "./lib/storage.ts";
import { CandidatePage } from "./components/CandidatePage.tsx";
import { RepresentativesView } from "./components/RepresentativesView.tsx";
import { ReportPage } from "./components/ReportPage.tsx";
import { useFeatures } from "./lib/features.ts";
import { track, trackPage } from "./lib/analytics.ts";

type View = "home" | "plan" | "ballot" | "sheet" | "reps" | "candidate" | "report" | "shared";
type TabView = "plan" | "ballot" | "sheet" | "reps";
const TABS: TabView[] = ["plan", "ballot", "sheet", "reps"];

interface Route {
  view: View;
  shared?: string;
  contestId?: string;
  index?: number;
}

/** Only hashes that start with "#/" are routes; plain "#id" anchors are in-page links. */
export function parseRoute(hash: string): Route | undefined {
  if (!hash.startsWith("#/")) return hash ? undefined : { view: "home" };
  const [, view, a, b] = hash.split("/");
  if ((TABS as string[]).includes(view) || view === "report") return { view: view as View };
  if (view === "shared" && a) return { view: "shared", shared: a };
  if (view === "candidate" && a && b !== undefined && /^\d+$/.test(b)) {
    try {
      return { view: "candidate", contestId: decodeURIComponent(a), index: Number(b) };
    } catch {
      return { view: "home" };
    }
  }
  return { view: "home" };
}

function navigate(view: "home" | TabView) {
  const hash = view === "home" ? "#/" : `#/${view}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}

const DEMO = { address: "340 Main St, Venice, CA 90291", electionId: "2000" };

export function App() {
  const { t, lang, setLang } = useI18n();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash) ?? { view: "home" });
  const [address, setAddress] = useState<string>(() => session.get("civic.address") ?? "");
  const [electionId, setElectionId] = useState<string | undefined>(() => session.get("civic.electionId") ?? undefined);
  const [info, setInfo] = useState<VoterInfo | null>(null);
  const features = useFeatures();
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

  useEffect(() => trackPage(route.view), [route.view]);

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
      track("lookup", { result: result.isEmpty ? "empty" : "ok" });
      const r = parseRoute(window.location.hash);
      if (!r || r.view === "home" || r.view === "shared") navigate("plan");
    } catch (e) {
      if (controller.signal.aborted) return;
      setInfo(null);
      setError(e instanceof ApiRequestError ? e.code : "network");
      track("lookup", { result: e instanceof ApiRequestError ? e.code : "network" });
      const r = parseRoute(window.location.hash);
      if (!r || r.view === "home" || r.view === "shared") navigate("plan");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Restore results after a refresh (address is kept in sessionStorage for this tab only).
  useEffect(() => {
    if (needsInfo(route.view) && !info && !loading && !error) {
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

  const inResults = needsInfo(route.view);


  const navTabs = (extra: string, compactLabels = false) => (
    <nav aria-label={t("nav.label")} className={extra}>
      <ul className="seg-track w-full">
        {TABS.map((v) => {
          const current = route.view === v || (v === "ballot" && route.view === "candidate");
          return (
            <li key={v} className="flex-1">
              <a
                href={`#/${v}`}
                aria-current={current ? "page" : undefined}
                className={`seg-item w-full ${compactLabels ? "px-1.5 text-[13px]" : "px-3 lg:px-[18px]"}`}
              >
                {compactLabels && v === "reps" ? (
                  <>
                    <span aria-hidden="true">{t("nav.repsShort")}</span>
                    <span className="sr-only">{t("nav.reps")}</span>
                  </>
                ) : (
                  t(`nav.${v}`)
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="relative isolate flex min-h-screen flex-col">
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

      <div aria-hidden="true" className="bg-blobs pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="blob-a" />
        <span className="blob-b" />
        <span className="blob-c" />
      </div>

      <header className="no-print sticky top-3 z-50 mx-3 mt-3 sm:top-5 sm:mx-8 sm:mt-5">
        <div className="glass-bar mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full pl-4 pr-2">
          <a href="#/" onClick={startOver} className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-[#0b1220] no-underline dark:text-white">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span>{t("app.name")}</span>
          </a>
          {inResults && navTabs("hidden md:block")}
          <button
            type="button"
            className="btn min-h-[40px] shrink-0 border border-white/80 bg-white/60 px-4 text-sm text-slate-800 hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            lang={lang === "en" ? "es" : "en"}
            aria-label={t("lang.switchLabel")}
          >
            {t("lang.switch")}
          </button>
        </div>
      </header>
      {inResults && (
        <div className="no-print fixed inset-x-[18px] bottom-6 z-50 md:hidden">
          <div className="glass-bar rounded-full p-1.5">{navTabs("", true)}</div>
        </div>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className={`mx-auto w-full max-w-5xl flex-1 px-[18px] py-6 outline-none sm:px-6 sm:py-8 ${inResults ? "pb-28 md:pb-8" : ""}`}>
        {route.view === "home" && <Home loading={loading} initialAddress={address} onLookup={lookup} />}

        {route.view === "shared" && <SharedPlanView plan={decodePlan(route.shared ?? "")} onLookup={startOver} />}

        {route.view === "report" && <ReportPage />}

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

            {route.view === "reps" && address && <RepresentativesView address={address} />}

            {route.view !== "reps" && !loading && error === "no_election_data" && <EmptyState />}
            {route.view !== "reps" && !loading && error && error !== "no_election_data" && (
              <ErrorNotice code={error} onRetry={() => lookup(address, electionId)} />
            )}

            {route.view !== "reps" && !loading && info && (
              <>
                <ElectionHeader info={info} aside={route.view === "plan" && !info.isEmpty ? <PlanChecklist info={info} /> : undefined} />
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
                    {route.view === "plan" && (
                      <VotingPlan info={info} address={address} reminders={features?.reminders ?? { email: false, sms: false }} />
                    )}
                    {route.view === "ballot" && (
                      <SampleBallot
                        info={info}
                        choices={choices}
                        onToggle={toggle}
                        onClear={clear}
                        onClearAll={clearAll}
                        summary={{ enabled: !!features?.summaries, address, electionId: info.election.id }}
                      />
                    )}
                    {route.view === "candidate" && (
                      <CandidatePage
                        contest={info.contests.find((c) => c.id === route.contestId)}
                        index={route.index ?? 0}
                        selected={choices[route.contestId ?? ""] ?? []}
                        onToggle={toggle}
                      />
                    )}
                    {route.view === "sheet" && <CheatSheet info={info} choices={choices} />}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className={`no-print py-8 text-center text-[13px] ${inResults ? "pb-28 md:pb-8" : ""}`}>
        <div className="mx-auto max-w-3xl space-y-1 px-4">
          <p className="font-medium text-slate-700 dark:text-slate-300">{t("footer.nonpartisan")}</p>
          <p className="muted">{t("footer.privacy")}</p>
          <p className="muted">{t("footer.data")}</p>
          <p>
            <a className="link" href="#/report">
              {t("footer.report")}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function needsInfo(v: View) {
  return v === "plan" || v === "ballot" || v === "sheet" || v === "reps" || v === "candidate";
}

function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="space-y-4" role="status">
      <p className="font-medium">{t("status.loading")}</p>
      <div className="h-32 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/5" />
      <div className="h-48 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/5" />
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
    <div className="space-y-10">
      <section className="mx-auto max-w-3xl pt-10 text-center sm:pt-24">
        <h1 className="text-[38px] font-bold leading-[1.04] tracking-[-0.045em] text-[#0b1220] [text-wrap:balance] sm:text-[68px] sm:leading-[1.02] dark:text-white">
          {t("home.heading")}
        </h1>
        <p className="mx-auto mt-5 max-w-[640px] text-[17px] text-slate-700 sm:text-[19px] dark:text-slate-300">{t("home.lead")}</p>
      </section>

      <section className="mx-auto max-w-3xl">
        <AddressForm initialValue={initialAddress} loading={loading} onSubmit={(a) => onLookup(a)} />
        <p className="muted mt-3 pl-[22px] text-[13px]">
          <span aria-hidden="true">🔒 </span>
          {t("home.privacy")}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="h3">
            {t("home.upcoming")}
          </h2>
          {upcoming === undefined ? (
            <div className="mt-3 h-14 animate-pulse rounded-[20px] bg-white/40 dark:bg-white/5" />
          ) : upcoming.length === 0 ? (
            <p className="muted mt-2">{t("home.noUpcoming")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.map((e) => (
                <li key={e.id} className="card-inset flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <span className="font-semibold">{e.name}</span>
                  <span className="muted text-sm">{formatDay(e.day, lang, "medium")}</span>
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
