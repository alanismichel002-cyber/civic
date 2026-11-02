import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/voterinfo-test-election.json";
import { __resetForTests } from "../shared/server/handlers.ts";
import {
  __resetRepsForTests,
  federalOfficials,
  handleRepresentatives,
  parseCensusGeographies,
  stateOfficials,
} from "../shared/server/representatives.ts";
import { __resetSummaryForTests, handleSummarize, SUMMARY_MODEL } from "../shared/server/summarize.ts";
import {
  __resetRemindersForTests,
  dueReminder,
  handleReminders,
  makeToken,
  normalizeEmail,
  normalizePhone,
  readToken,
  sendDueReminders,
  type Subscription,
} from "../shared/server/reminders.ts";
import { MemoryKV } from "../shared/server/kv.ts";
import { features } from "../shared/server/features.ts";
import { handleHealth } from "../shared/server/health.ts";

const ADDRESS = "340 Main St, Venice, CA 90291";
const jsonRes = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const post = (path: string, body: unknown) =>
  new Request(`https://civic.test${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  __resetForTests();
  __resetRepsForTests();
  __resetSummaryForTests();
  __resetRemindersForTests();
});

// --------------------------------------------------------------------------- representatives
const census = {
  result: {
    addressMatches: [
      {
        coordinates: { x: -118.47, y: 33.99 },
        addressComponents: { state: "CA" },
        geographies: {
          "120th Congressional Districts": [{ BASENAME: "36", NAME: "Congressional District 36" }],
          "2026 State Legislative Districts - Upper": [{ NAME: "State Senate District 24" }],
          "2026 State Legislative Districts - Lower": [{ NAME: "Assembly District 61" }],
          Counties: [{ NAME: "Los Angeles County" }],
        },
      },
    ],
  },
};
const people = [
  { id: { bioguide: "P000145" }, name: { official_full: "Alex Padilla" }, terms: [{ type: "sen", state: "CA", party: "Democrat", url: "https://padilla.senate.gov" }] },
  { id: { bioguide: "S001150" }, name: { official_full: "Adam Schiff" }, terms: [{ type: "sen", state: "CA", party: "Democrat" }] },
  { id: { bioguide: "L000582" }, name: { official_full: "Ted Lieu" }, terms: [{ type: "rep", state: "CA", district: 36, party: "Democrat", phone: "202-225-3976" }] },
  { id: { bioguide: "X000001" }, name: { official_full: "Someone Else" }, terms: [{ type: "rep", state: "CA", district: 12, party: "Republican" }] },
  { id: { bioguide: "N000147" }, name: { official_full: "Eleanor Holmes Norton" }, terms: [{ type: "rep", state: "DC", district: 0, party: "Democrat" }] },
];
const social = [{ id: { bioguide: "L000582" }, social: { twitter: "tedlieu", youtube_id: "UC123" } }];

describe("representatives", () => {
  it("parses Census districts, including at-large seats", () => {
    expect(parseCensusGeographies(census)).toMatchObject({ state: "CA", congressional: "36", stateUpper: "State Senate District 24" });
    const atLarge = JSON.parse(JSON.stringify(census));
    atLarge.result.addressMatches[0].geographies["120th Congressional Districts"][0].BASENAME = "Delegate District (at Large)";
    expect(parseCensusGeographies(atLarge)?.congressional).toBe("0");
    expect(parseCensusGeographies({ result: { addressMatches: [] } })).toBeUndefined();
  });

  it("selects both senators and the right House member", () => {
    const social2 = new Map([["L000582", social[0].social]]);
    const o = federalOfficials(people, social2, "CA", "36");
    expect(o.map((x) => x.name)).toEqual(["Alex Padilla", "Adam Schiff", "Ted Lieu"]);
    const lieu = o[2];
    expect(lieu.party).toBe("Democratic");
    expect(lieu.photoUrl).toContain("L000582");
    expect(lieu.channels.map((c) => c.type)).toEqual(["X", "YouTube"]);
    expect(federalOfficials(people, new Map(), "DC", "0").map((x) => x.office)).toEqual(["Delegate to the U.S. House"]);
  });

  it("maps OpenStates state legislators and drops federal ones", () => {
    const o = stateOfficials({
      results: [
        { id: "a", name: "Ben Allen", party: "Democratic", jurisdiction: { classification: "state" }, current_role: { title: "Senator", org_classification: "upper", district: "24" }, image: "https://x/y.jpg", email: "a@b.gov", offices: [{ voice: "916-555-0100" }] },
        { id: "b", name: "Fed", jurisdiction: { classification: "country" }, current_role: { org_classification: "lower" } },
      ],
    });
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ name: "Ben Allen", chamber: "upper", district: "24", phone: "916-555-0100", email: "a@b.gov" });
  });

  it("end to end: districts + federal members, state fallback without a key", async () => {
    const f = vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      if (url.includes("geocoding.geo.census.gov")) return jsonRes(census);
      if (url.includes("divisionsByAddress")) return jsonRes({ normalizedInput: { state: "CA" }, divisions: { "ocd-division/country:us/state:ca/cd:36": { name: "California's 36th" } } });
      if (url.includes("legislators-current")) return jsonRes(people);
      if (url.includes("legislators-social")) return jsonRes(social);
      throw new Error(url);
    });
    const res = await handleRepresentatives(post("/api/representatives", { address: ADDRESS }), { googleKey: "k", openStatesKey: undefined, ip: "x", fetch: f as never });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.officials).toHaveLength(3);
    expect(body.stateLegislatorsAvailable).toBe(false);
    expect(body.districts.congressional).toBe("36");
    expect(body.divisions[0].name).toBe("California's 36th");
    expect(JSON.stringify(body)).not.toContain("340 Main");
  });

  it("reports unknown addresses", async () => {
    const f = vi.fn(async (u: RequestInfo | URL) =>
      String(u).includes("census") ? jsonRes({ result: { addressMatches: [] } }) : jsonRes({ error: { message: "Failed to parse address" } }, 400),
    );
    const res = await handleRepresentatives(post("/api/representatives", { address: "nowhere at all" }), { googleKey: "k", openStatesKey: undefined, ip: "x", fetch: f as never });
    expect(res.status).toBe(422);
  });
});

// --------------------------------------------------------------------------- summaries
function civicFetch() {
  return vi.fn(async (u: RequestInfo | URL) =>
    String(u).includes("census") ? jsonRes({ result: { addressMatches: [] } }) : jsonRes(fixture),
  ) as unknown as typeof fetch;
}
const hla = "los-angeles-city-municipal-election-measure-hla-city-of-los-angeles";

function fakeAnthropic(reply: { text?: string; stop_reason?: string; throws?: Error }) {
  const create = vi.fn(async (_params: Record<string, unknown>) => {
    if (reply.throws) throw reply.throws;
    return { stop_reason: reply.stop_reason ?? "end_turn", content: [{ type: "text", text: reply.text ?? "" }] };
  });
  return { client: { beta: { messages: { create } } } as never, create };
}

describe("summaries", () => {
  it("summarizes a real measure with the default model, low effort, and server-side fallback", async () => {
    const { client, create } = fakeAnthropic({ text: "This measure would… \n- A YES vote means: …" });
    const store = new MemoryKV();
    const env = { anthropic: client, civicKey: "k", ip: "x", store, fetch: civicFetch() };
    const res = await handleSummarize(post("/api/summarize", { address: ADDRESS, electionId: "2000", contestId: hla, lang: "es" }), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ lang: "es", model: SUMMARY_MODEL });
    const params = create.mock.calls[0][0] as Record<string, unknown>;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.output_config).toEqual({ effort: "low" });
    expect(JSON.stringify(params.messages)).toContain("CITY MOBILITY PLAN");
    expect(JSON.stringify(params.messages)).not.toContain("340 Main");
    // cached (memory + blobs)
    const again = await handleSummarize(post("/api/summarize", { address: ADDRESS, electionId: "2000", contestId: hla, lang: "es" }), env);
    expect(again.headers.get("x-cache")).toBe("HIT");
    expect(create).toHaveBeenCalledTimes(1);
    expect((await store.list("summary/")).length).toBe(1);
  });

  it("only summarizes measures that exist on the voter's ballot", async () => {
    const { client, create } = fakeAnthropic({ text: "x" });
    const res = await handleSummarize(
      post("/api/summarize", { address: ADDRESS, electionId: "2000", contestId: "made-up-measure", lang: "en" }),
      { anthropic: client, civicKey: "k", ip: "x", fetch: civicFetch() },
    );
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("handles refusals and API errors without leaking details", async () => {
    const refused = fakeAnthropic({ stop_reason: "refusal" });
    const r1 = await handleSummarize(post("/api/summarize", { address: ADDRESS, electionId: "2000", contestId: hla }), { anthropic: refused.client, civicKey: "k", ip: "a", fetch: civicFetch() });
    expect((await r1.json()).error.code).toBe("summary_unavailable");
    const broken = fakeAnthropic({ throws: new Error("boom") });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r2 = await handleSummarize(post("/api/summarize", { address: ADDRESS, electionId: "2000", contestId: hla }), { anthropic: broken.client, civicKey: "k", ip: "b", fetch: civicFetch() });
    expect(r2.status).toBe(502);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Main");
    spy.mockRestore();
  });

  it("is disabled without an Anthropic key", async () => {
    const res = await handleSummarize(post("/api/summarize", {}), { anthropic: undefined, civicKey: "k", ip: "x" });
    expect(res.status).toBe(501);
  });
});

// --------------------------------------------------------------------------- reminders
describe("reminders", () => {
  it("validates contacts", () => {
    expect(normalizeEmail(" Voter@Example.COM ")).toBe("voter@example.com");
    expect(normalizeEmail("nope@")).toBeUndefined();
    expect(normalizePhone("(213) 555-0199")).toBe("+12135550199");
    expect(normalizePhone("1-213-555-0199")).toBe("+12135550199");
    expect(normalizePhone("123")).toBeUndefined();
    expect(normalizePhone("(013) 555-0199")).toBeUndefined();
  });

  it("signs tokens and rejects tampering", async () => {
    const tok = await makeToken("s3cret", "unsub", "sub/2000/abc");
    expect(await readToken("s3cret", "unsub", tok)).toBe("sub/2000/abc");
    expect(await readToken("s3cret", "confirm", tok)).toBeUndefined();
    expect(await readToken("other", "unsub", tok)).toBeUndefined();
    expect(await readToken("s3cret", "unsub", tok.slice(0, -2) + "xx")).toBeUndefined();
  });

  it("subscribe -> confirm -> send -> unsubscribe, never storing the home address", async () => {
    const store = new MemoryKV();
    const emails: { to: string; subject: string; text: string }[] = [];
    const sender = { email: async (to: string, subject: string, text: string) => void emails.push({ to, subject, text }) };
    const env = { store, sender, secret: "s3cret", civicKey: "k", siteUrl: "https://civic.test", ip: "x", fetch: civicFetch(), now: () => new Date("2031-11-01T12:00:00Z") };

    const res = await handleReminders(post("/api/reminders/subscribe", { channel: "email", contact: "v@example.com", address: ADDRESS, electionId: "2000", lang: "en", consent: true }), env);
    expect(res.status).toBe(200);
    expect((await res.json()).needsConfirmation).toBe(true);
    expect(emails[0].subject).toBe("Confirm your voting reminders");
    const [key] = await store.list("sub/");
    const stored = (await store.get<Subscription>(key))!;
    expect(JSON.stringify(stored)).not.toMatch(/340 Main/i);
    expect(stored.pollingPlace).toBeTruthy();
    expect(stored.confirmed).toBe(false);

    // Unconfirmed subscriptions get nothing.
    let stats = await sendDueReminders({ ...env, now: () => new Date("2031-12-05T15:00:00Z") });
    expect(stats.sent).toBe(0);

    const confirmUrl = emails[0].text.split("\n").find((l) => l.includes("/confirm?token="))!;
    const confirm = await handleReminders(new Request(confirmUrl), env);
    expect(confirm.status).toBe(200);
    expect((await store.get<Subscription>(key))!.confirmed).toBe(true);

    stats = await sendDueReminders({ ...env, now: () => new Date("2031-12-05T15:00:00Z") });
    expect(stats.sent).toBe(1);
    expect(emails[1].subject).toBe("Election Day is tomorrow");
    expect(emails[1].text).toContain("Unsubscribe: https://civic.test/api/reminders/unsubscribe?token=");
    // Not sent twice.
    expect((await sendDueReminders({ ...env, now: () => new Date("2031-12-05T20:00:00Z") })).sent).toBe(0);

    const unsubUrl = emails[1].text.split("Unsubscribe: ")[1].trim();
    const unsub = await handleReminders(new Request(unsubUrl, { method: "POST" }), env);
    expect(unsub.status).toBe(204);
    expect(await store.list("sub/")).toEqual([]);
  });

  it("requires consent and an enabled channel", async () => {
    const env = { store: new MemoryKV(), sender: {}, secret: "s", civicKey: "k", siteUrl: "x", ip: "y", fetch: civicFetch() };
    const r = await handleReminders(post("/api/reminders/subscribe", { channel: "sms", contact: "2135550199", address: ADDRESS, electionId: "2000", consent: true }), env);
    expect(r.status).toBe(501);
    const env2 = { ...env, sender: { sms: async () => undefined }, ip: "z" };
    const r2 = await handleReminders(post("/api/reminders/subscribe", { channel: "sms", contact: "2135550199", address: ADDRESS, electionId: "2000", consent: false }), env2);
    expect(r2.status).toBe(400);
  });

  it("picks the right reminder for the day", () => {
    const sub = { electionDay: "2030-11-05", earlyStart: "2030-10-20", sent: [] } as unknown as Subscription;
    expect(dueReminder(sub, "2030-10-20")).toBe("early");
    expect(dueReminder(sub, "2030-11-04")).toBe("eve");
    expect(dueReminder(sub, "2030-11-05")).toBe("day");
    expect(dueReminder(sub, "2030-10-25")).toBeUndefined();
    expect(dueReminder({ ...sub, sent: ["day"] }, "2030-11-05")).toBeUndefined();
  });

  it("deletes subscriptions after the election", async () => {
    const store = new MemoryKV();
    await store.set("sub/1/a", { key: "sub/1/a", electionDay: "2030-01-01", confirmed: true, sent: [], createdAt: "2029-12-01T00:00:00Z" });
    const stats = await sendDueReminders({ store, sender: {}, secret: "s", siteUrl: "x", now: () => new Date("2030-01-03T15:00:00Z") });
    expect(stats.deleted).toBe(1);
  });
});

// --------------------------------------------------------------------------- features & health
describe("features & health", () => {
  it("reports configured features as booleans only", () => {
    const env: Record<string, string> = { ANTHROPIC_API_KEY: "sk", REMINDER_SECRET: "s", RESEND_API_KEY: "r", REMINDER_FROM_EMAIL: "a@b.c" };
    const f = features((n) => env[n]);
    expect(f).toEqual({ summaries: true, reminders: { email: true, sms: false }, stateLegislators: false });
    expect(JSON.stringify(f)).not.toContain("sk");
  });

  it("health is degraded without a key", async () => {
    const res = await handleHealth(new Request("https://x/api/health"), { apiKey: undefined });
    expect(res.status).toBe(503);
    expect((await res.json()).checks.apiKey).toBe("missing");
  });
});
