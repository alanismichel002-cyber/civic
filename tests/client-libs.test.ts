import { describe, expect, it } from "vitest";
import fixture from "./fixtures/voterinfo-test-election.json";
import { normalizeVoterInfo } from "../shared/normalize.ts";
import { buildIcs } from "../src/lib/ics.ts";
import { decodePlan, encodePlan, planFromVoterInfo } from "../src/lib/share.ts";
import { toggleChoice } from "../src/lib/choices.ts";
import { daysUntil, formatDay, softCase } from "../src/lib/format.ts";
import { keyDates } from "../src/lib/plan.ts";
import { translate, dictionaries } from "../src/lib/i18n.tsx";
import { distanceMiles } from "../shared/geo.ts";
import { TtlCache } from "../shared/server/cache.ts";
import { RateLimiter } from "../shared/server/rateLimit.ts";

const info = normalizeVoterInfo(fixture, { lat: 33.99474, lng: -118.47647 })!;

describe("ics", () => {
  it("builds valid all-day events with escaping and folding", () => {
    const ics = buildIcs(
      [{ uid: "e1", day: "2026-11-03", title: "Election Day: General, 2026; test", location: "x".repeat(120) }],
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261103");
    expect(ics).toContain("DTEND;VALUE=DATE:20261104");
    expect(ics).toContain("SUMMARY:Election Day: General\\, 2026\; test");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("handles month rollovers", () => {
    expect(buildIcs([{ uid: "a", day: "2026-12-31", title: "x" }])).toContain("DTEND;VALUE=DATE:20270101");
  });
});

describe("share links", () => {
  it("round-trips without the voter's street address", () => {
    const plan = planFromVoterInfo(info);
    const encoded = encodePlan(plan);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePlan(encoded)).toEqual(JSON.parse(JSON.stringify(plan)));
    expect(JSON.stringify(plan)).not.toMatch(/340 Main/i);
  });

  it("rejects tampered or unsafe data", () => {
    expect(decodePlan("garbage!!")).toBeUndefined();
    const bad = encodePlan({ ...planFromVoterInfo(info), reg: "javascript:alert(1)" });
    expect(decodePlan(bad)).toBeUndefined();
  });
});

describe("choices", () => {
  it("single choice replaces, multi choice respects the limit", () => {
    expect(toggleChoice([], "A", 1)).toEqual(["A"]);
    expect(toggleChoice(["A"], "B", 1)).toEqual(["B"]);
    expect(toggleChoice(["A"], "A", 1)).toEqual([]);
    expect(toggleChoice(["A"], "B", 2)).toEqual(["A", "B"]);
    expect(toggleChoice(["A", "B"], "C", 2)).toEqual(["A", "B"]);
  });
});

describe("format", () => {
  it("formats dates without time-zone drift", () => {
    expect(formatDay("2026-11-03", "en")).toBe("Tuesday, November 3, 2026");
    expect(formatDay("2026-11-03", "es")).toMatch(/martes, 3 de noviembre de 2026/);
  });
  it("counts days", () => {
    expect(daysUntil("2026-11-03", new Date(2026, 10, 2, 23, 0))).toBe(1);
    expect(daysUntil("2026-11-03", new Date(2026, 10, 3, 1, 0))).toBe(0);
  });
  it("softens ALL CAPS", () => {
    expect(softCase("WESTMINSTER AVENUE ELEMENTARY SCHOOL")).toBe("Westminster Avenue Elementary School");
    expect(softCase("McKinley Park")).toBe("McKinley Park");
  });
});

describe("keyDates", () => {
  it("finds the earliest early-vote start and latest drop-off end", () => {
    const d = keyDates({
      election: { id: "1", name: "x", day: "2030-11-05" },
      earlyVoteSites: [
        { startDate: "2030-10-20", endDate: "2030-11-02" },
        { startDate: "2030-10-15", endDate: "2030-11-03" },
      ] as never,
      dropOffLocations: [{ endDate: "2030-11-05" }] as never,
    });
    expect(d).toEqual({ electionDay: "2030-11-05", earlyStart: "2030-10-15", earlyEnd: "2030-11-03", dropoffDeadline: "2030-11-05" });
  });
});

describe("i18n", () => {
  it("has a Spanish string for every English key", () => {
    const en = Object.keys(dictionaries.en);
    const es = Object.keys(dictionaries.es);
    expect(es.sort()).toEqual(en.sort());
    for (const k of es) expect(dictionaries.es[k as keyof typeof dictionaries.es]).toBeTruthy();
  });
  it("interpolates", () => {
    expect(translate("en", "plan.daysLeft", { n: 5 })).toBe("5 days until Election Day");
  });
});

describe("server utilities", () => {
  it("distance", () => {
    expect(distanceMiles({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 })).toBeCloseTo(2445, -1);
  });
  it("cache expires", () => {
    let now = 0;
    const c = new TtlCache<number>(1000, 2, () => now);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    now = 1001;
    expect(c.get("a")).toBeUndefined();
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    expect(c.size).toBe(2);
  });
  it("rate limiter windows reset", () => {
    let now = 0;
    const r = new RateLimiter(2, 1000, () => now);
    expect(r.check("ip")).toBe(0);
    expect(r.check("ip")).toBe(0);
    expect(r.check("ip")).toBeGreaterThan(0);
    now = 1000;
    expect(r.check("ip")).toBe(0);
  });
});
