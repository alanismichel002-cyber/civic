import type { Representatives } from "../../shared/server/representatives.ts";
import type { Features } from "../../shared/server/features.ts";
import type { SummaryResult } from "../../shared/server/summarize.ts";
import type { AddressSuggestion, ApiErrorCode, ElectionsResponse, VoterInfo } from "../../shared/types.ts";

export class ApiRequestError extends Error {
  constructor(
    public code: ApiErrorCode | "network",
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiRequestError("network", "Network error");
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiRequestError(res.ok ? "upstream_error" : "network", `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: ApiErrorCode; message?: string } })?.error;
    throw new ApiRequestError(err?.code ?? "upstream_error", err?.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

const postJson = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

/** The address goes in a POST body, not the URL, so it stays out of access logs and history. */
export function fetchVoterInfo(address: string, electionId?: string, signal?: AbortSignal) {
  return request<VoterInfo>("/api/voterinfo", postJson({ address, electionId }, signal));
}

export function fetchElections(includeTest = false) {
  return request<ElectionsResponse>(`/api/elections${includeTest ? "?includeTest=1" : ""}`);
}

export async function fetchSuggestions(q: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const res = await request<{ suggestions: AddressSuggestion[] }>("/api/autocomplete", postJson({ q }, signal));
  return res.suggestions ?? [];
}

// ---- v1.2 features ----

export type { Representatives, Features, SummaryResult };

export function fetchRepresentatives(address: string, signal?: AbortSignal) {
  return request<Representatives>("/api/representatives", postJson({ address }, signal));
}

export function fetchSummary(body: { address: string; electionId?: string; contestId: string; lang: "en" | "es" }) {
  return request<SummaryResult>("/api/summarize", postJson(body));
}

export function subscribeReminders(body: {
  channel: "email" | "sms";
  contact: string;
  address: string;
  electionId: string;
  lang: "en" | "es";
  consent: boolean;
}) {
  return request<{ ok: true; needsConfirmation: boolean }>("/api/reminders/subscribe", postJson(body));
}

const NO_FEATURES: Features = { summaries: false, reminders: { email: false, sms: false }, stateLegislators: false };
let featuresPromise: Promise<Features> | undefined;
export function fetchFeatures(): Promise<Features> {
  featuresPromise ??= request<Features>("/api/features").catch(() => NO_FEATURES);
  return featuresPromise;
}

/** Netlify Forms submission (form "report" is declared in index.html for build-time detection). */
export async function submitReport(fields: Record<string, string>) {
  const res = await fetch("/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ "form-name": "report", ...fields }).toString(),
  });
  if (!res.ok) throw new ApiRequestError("upstream_error", `HTTP ${res.status}`);
}
