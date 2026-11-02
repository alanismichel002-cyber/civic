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
