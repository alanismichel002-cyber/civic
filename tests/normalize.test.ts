import { describe, expect, it } from "vitest";
import fixture from "./fixtures/voterinfo-test-election.json";
import dc from "./fixtures/voterinfo-dc-no-contests.json";
import electionsFixture from "./fixtures/elections.json";
import {
  MAX_LOCATIONS_PER_KIND,
  classifyContest,
  normalizeElections,
  normalizeVoterInfo,
  safeUrl,
} from "../shared/normalize.ts";
import { CONTEST_LEVEL_ORDER } from "../shared/types.ts";

const venice = { lat: 33.99474, lng: -118.47647 };

describe("normalizeVoterInfo (VIP test election)", () => {
  const info = normalizeVoterInfo(fixture, venice)!;

  it("maps the election and area without the street line", () => {
    expect(info.election).toEqual({ id: "2000", name: "VIP Test Election", day: "2031-12-06" });
    expect(info.normalizedArea).toEqual({ city: "Venice", state: "CA", zip: "90291" });
    expect(JSON.stringify(info)).not.toContain("340 Main");
  });

  it("sorts locations by distance and trims long lists", () => {
    expect(info.pollingLocations.length).toBe(MAX_LOCATIONS_PER_KIND);
    expect(info.totals.polling).toBe(fixture.pollingLocations.length);
    const d = info.pollingLocations.map((l) => l.distanceMiles!);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(d[0]).toBeLessThan(2);
  });

  it("groups contests by level, then ballot order", () => {
    expect(info.contests.length).toBe(fixture.contests.length);
    const levels = info.contests.map((c) => CONTEST_LEVEL_ORDER.indexOf(c.level));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    for (const level of new Set(info.contests.map((c) => c.level))) {
      const placements = info.contests.filter((c) => c.level === level).map((c) => c.ballotPlacement ?? Infinity);
      expect(placements).toEqual([...placements].sort((a, b) => a - b));
    }
    expect(new Set(info.contests.map((c) => c.id)).size).toBe(info.contests.length);
  });

  it("classifies contests that have only a district scope", () => {
    const assembly = info.contests.find((c) => c.title.includes("STATE ASSEMBLY"))!;
    expect(assembly.level).toBe("state");
    const hla = info.contests.find((c) => c.title.includes("MEASURE HLA"))!;
    expect(hla.level).toBe("city");
  });

  it("maps measures", () => {
    const m = info.contests.find((c) => c.title.includes("MEASURE HLA"))!;
    expect(m.kind).toBe("measure");
    expect(m.measure?.fullText).toContain("CITY MOBILITY PLAN");
    expect(m.measure?.passageThreshold).toBe("MAJORITY OF VOTES CAST");
    expect(m.measure?.responses).toEqual(["YES", "NO"]);
  });

  it("keeps candidates in API (ballot) order", () => {
    const assembly = info.contests.find((c) => c.title.includes("STATE ASSEMBLY"))!;
    expect(assembly.candidates.map((c) => c.name)).toEqual(["ALFONSO HERNANDEZ", "TINA SIMONE MCKINNOR"]);
  });

  it("maps state and local election offices with labelled sources", () => {
    expect(info.offices.map((o) => o.scope)).toEqual(["state", "local"]);
    const state = info.offices[0];
    expect(state.links.find((l) => l.key === "registration")?.url).toBe("https://registertovote.ca.gov/?t=s");
    expect(state.sources).toEqual([{ name: "DemocracyWorks", official: false }]);
    expect(info.offices[1].sources[0].official).toBe(true);
    expect(info.sources.some((s) => s.official)).toBe(true);
    expect(info.sources.some((s) => !s.official)).toBe(true);
  });

  it("is not empty", () => expect(info.isEmpty).toBe(false));
});

describe("normalizeVoterInfo (DC, locations but no contests)", () => {
  it("keeps API order without an origin", () => {
    const info = normalizeVoterInfo(dc)!;
    expect(info.contests).toEqual([]);
    expect(info.pollingLocations[0].distanceMiles).toBeUndefined();
    expect(info.pollingLocations[0].notes).toBe("Lobby");
    expect(info.isEmpty).toBe(false);
  });

  it("flags responses with nothing in them as empty", () => {
    const info = normalizeVoterInfo({ election: { id: "1", name: "X", electionDay: "2030-01-01" } })!;
    expect(info.isEmpty).toBe(true);
    expect(info.mailOnly).toBe(false);
  });

  it("returns undefined without an election", () => {
    expect(normalizeVoterInfo({})).toBeUndefined();
  });

  it("excludes the current election from otherElections", () => {
    const info = normalizeVoterInfo({
      election: { id: "1", name: "A", electionDay: "2030-01-01" },
      otherElections: [
        { id: "1", name: "A", electionDay: "2030-01-01" },
        { id: "2", name: "B", electionDay: "2030-01-01" },
      ],
    })!;
    expect(info.otherElections.map((e) => e.id)).toEqual(["2"]);
  });
});

describe("classifyContest", () => {
  it.each([
    [{ level: ["country"], office: "President" }, "federal"],
    [{ level: ["administrativeArea1"], office: "Governor" }, "state"],
    [{ level: ["administrativeArea2"], office: "County Judge" }, "judicial"],
    [{ roles: ["schoolBoard"], level: ["locality"] }, "school"],
    [{ district: { scope: "congressional" }, office: "Representative" }, "federal"],
    [{ district: { scope: "countywide" }, office: "Sheriff" }, "county"],
    [{ office: "Superior Court Judge, Office 12" }, "judicial"],
    [{ ballotTitle: "Unified School District Governing Board" }, "school"],
    [{ ballotTitle: "Mystery" }, "other"],
  ])("%j -> %s", (raw, level) => {
    expect(classifyContest(raw)).toBe(level);
  });
});

describe("safeUrl", () => {
  it("allows http(s) only", () => {
    expect(safeUrl("https://example.gov/a")).toBe("https://example.gov/a");
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,x")).toBeUndefined();
    expect(safeUrl("not a url")).toBeUndefined();
  });
});

describe("normalizeElections", () => {
  it("hides test elections unless asked", () => {
    expect(normalizeElections(electionsFixture).map((e) => e.id)).toEqual(["12000"]);
    expect(normalizeElections(electionsFixture, true).map((e) => e.id)).toEqual(["12000", "2000", "1001"]);
  });
});

describe("classifyContest with a misleading county scope", () => {
  it.each([
    ["UNITED STATES SENATOR - Full Term", "federal"],
    ["PRESIDENTIAL PREFERENCE", "federal"],
    ["STATE MEASURE 1", "state"],
    ["DISTRICT ATTORNEY", "county"],
  ])("%s -> %s", (title, level) => {
    expect(classifyContest({ ballotTitle: title, district: { scope: "countywide" } })).toBe(level);
  });
});
