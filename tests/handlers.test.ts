import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/voterinfo-test-election.json";
import electionsFixture from "./fixtures/elections.json";
import {
  __resetForTests,
  handleAutocomplete,
  handleElections,
  handleVoterInfo,
  toSuggestions,
} from "../shared/server/handlers.ts";

const KEY = "test-key";
const ADDRESS = "340 Main St, Venice, CA 90291";

function post(body: unknown, path = "/api/voterinfo") {
  return new Request(`https://civic.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Routes the Google and Census URLs to canned responses. */
function mockFetch(google: () => Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("geocoding.geo.census.gov")) {
      return jsonResponse({ result: { addressMatches: [{ coordinates: { x: -118.47647, y: 33.99474 } }] } });
    }
    if (url.includes("googleapis.com")) return google();
    throw new Error(`unexpected fetch ${url}`);
  });
}

beforeEach(() => __resetForTests());

describe("handleVoterInfo", () => {
  it("returns normalized data, adds the key server-side, and caches", async () => {
    const f = mockFetch(() => jsonResponse(fixture));
    const env = { apiKey: KEY, ip: "1.1.1.1", fetch: f as unknown as typeof fetch };

    const res = await handleVoterInfo(post({ address: ADDRESS, electionId: "2000" }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-cache")).toBe("MISS");
    const body = await res.json();
    expect(body.election.id).toBe("2000");
    expect(body.origin).toEqual({ lat: 33.99474, lng: -118.47647 });
    expect(JSON.stringify(body)).not.toContain(KEY);

    const googleCall = f.mock.calls.map((c) => String(c[0])).find((u) => u.includes("googleapis"))!;
    const u = new URL(googleCall);
    expect(u.searchParams.get("key")).toBe(KEY);
    expect(u.searchParams.get("electionId")).toBe("2000");

    const again = await handleVoterInfo(post({ address: `  ${ADDRESS.toUpperCase()} `, electionId: "2000" }), env);
    expect(again.headers.get("x-cache")).toBe("HIT");
    expect(f.mock.calls.filter((c) => String(c[0]).includes("googleapis")).length).toBe(1);
  });

  it("maps 'Failed to parse address' to address_not_found", async () => {
    const f = mockFetch(() => jsonResponse({ error: { code: 400, message: "Failed to parse address" } }, 400));
    const res = await handleVoterInfo(post({ address: "asdkjh qwe" }), { apiKey: KEY, ip: "x", fetch: f as never });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("address_not_found");
  });

  it("maps 'Election unknown' to no_election_data", async () => {
    const f = mockFetch(() => jsonResponse({ error: { code: 400, message: "Election unknown" } }, 400));
    const res = await handleVoterInfo(post({ address: ADDRESS }), { apiKey: KEY, ip: "x", fetch: f as never });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("no_election_data");
  });

  it("hides upstream key errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const f = mockFetch(() => jsonResponse({ error: { code: 400, message: "API key not valid." } }, 400));
    const res = await handleVoterInfo(post({ address: ADDRESS }), { apiKey: KEY, ip: "x", fetch: f as never });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("upstream_error");
    expect(JSON.stringify(body)).not.toMatch(/key/i);
    // Logs must never contain the address.
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Main");
    spy.mockRestore();
  });

  it("validates input", async () => {
    const env = { apiKey: KEY, ip: "x", fetch: mockFetch(() => jsonResponse(fixture)) as never };
    expect((await handleVoterInfo(post({ address: "12" }), env)).status).toBe(400);
    expect((await handleVoterInfo(post({ address: 12345 }), env)).status).toBe(400);
    expect((await handleVoterInfo(post("not json"), env)).status).toBe(400);
    expect((await handleVoterInfo(post({ address: ADDRESS, electionId: "x;drop" }), env)).status).toBe(400);
    expect((await handleVoterInfo(post({ address: "a".repeat(201) }), env)).status).toBe(400);
    const get = new Request("https://civic.test/api/voterinfo?address=x");
    expect((await handleVoterInfo(get, env)).status).toBe(405);
  });

  it("requires the API key", async () => {
    const res = await handleVoterInfo(post({ address: ADDRESS }), { apiKey: undefined, ip: "x" });
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("not_configured");
  });

  it("rate-limits per IP", async () => {
    const env = { apiKey: KEY, ip: "9.9.9.9", fetch: mockFetch(() => jsonResponse(fixture)) as never };
    let last: Response | undefined;
    for (let i = 0; i < 21; i++) last = await handleVoterInfo(post({ address: ADDRESS }), env);
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    const other = await handleVoterInfo(post({ address: ADDRESS }), { ...env, ip: "8.8.8.8" });
    expect(other.status).toBe(200);
  });

  it("still works when geocoding fails", async () => {
    const f = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("census")) throw new Error("timeout");
      return jsonResponse(fixture);
    });
    const res = await handleVoterInfo(post({ address: ADDRESS }), { apiKey: KEY, ip: "x", fetch: f as never });
    expect(res.status).toBe(200);
    expect((await res.json()).origin).toBeUndefined();
  });
});

describe("handleElections", () => {
  it("lists real elections and caches publicly", async () => {
    const f = vi.fn(async () => jsonResponse(electionsFixture));
    const res = await handleElections(new Request("https://civic.test/api/elections"), { apiKey: KEY, ip: "x", fetch: f as never });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
    expect((await res.json()).elections.map((e: { id: string }) => e.id)).toEqual(["12000"]);
  });
});

describe("autocomplete", () => {
  it("ignores short queries without calling out", async () => {
    const f = vi.fn();
    const res = await handleAutocomplete(post({ q: "34" }, "/api/autocomplete"), { apiKey: KEY, ip: "x", fetch: f as never });
    expect((await res.json()).suggestions).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("builds US address labels", () => {
    const s = toSuggestions({
      features: [
        { properties: { countrycode: "US", housenumber: "340", street: "Main Street", city: "Venice", state: "California", postcode: "90291" }, geometry: { coordinates: [-118.4, 33.9] } },
        { properties: { countrycode: "CA", housenumber: "1", street: "Main", city: "Toronto" }, geometry: { coordinates: [0, 0] } },
      ],
    });
    expect(s).toEqual([{ label: "340 Main Street, Venice, CA 90291", lat: 33.9, lng: -118.4 }]);
  });
});
