import { describe, it, expect } from "vitest";
import { createTestProject as createDemoProject } from "./fixtures/project";
import { applyCommand } from "../src/domain/commands";
import {
  validateProject,
  parseProjectFile,
  serializeProject,
  MAX_FILE_BYTES,
  type Project,
  type Shot,
} from "../src/domain/schema";
import {
  evaluatePlacement,
  evaluateCell,
  evaluateSchedule,
  getAvailability,
  getRequiredPeople,
  cellAssignments,
} from "../src/domain/scheduling";
import {
  addDays,
  datesBetween,
  isLocalDate,
  timeLabel,
} from "../src/domain/dates";
import { initialState, projectReducer } from "../src/state/project-reducer";
const target = { date: "2026-09-20", sessionId: "afternoon" as const };
const shot = (
  id: string,
  minutes: number,
  lighting: Shot["lighting"] = "anytime",
): Shot => ({
  id,
  code: id,
  title: id,
  sceneLabel: "",
  description: "",
  locationLabel: "",
  requiredPersonIds: [],
  estimatedMinutes: minutes,
  lighting,
  color: "yellow",
});
const empty = (): Project => ({
  ...createDemoProject(),
  assignments: [],
  shots: [],
  coreCrewPersonIds: [],
});
describe("Scheduling rules", () => {
  it("starts with a valid, independently copied demo and valid target for SH 012", () => {
    const p = createDemoProject();
    expect(evaluateSchedule(p).filter((i) => i.severity === "error")).toEqual(
      [],
    );
    expect(p.assignments).toHaveLength(4);
    expect(p.shots).toHaveLength(8);
    expect(
      evaluatePlacement(
        p,
        "shot-012",
        { date: "2026-09-21", sessionId: "morning" },
        0,
      ).status,
    ).toBe("fits");
    p.people[0].name = "Changed";
    expect(createDemoProject().people[0].name).toBe("Ravi");
  });
  it("blocks Ravi on Sep 20 afternoon and Sep 24 all day", () => {
    const p = createDemoProject();
    for (const t of [
      target,
      ...p.sessions.map((s) => ({ date: "2026-09-24", sessionId: s.id })),
    ]) {
      const result = evaluatePlacement(p, "shot-012", t, 0);
      expect(result.status).toBe("blocked");
      expect(
        result.issues.some(
          (i) => i.personId === "ravi" && i.message.includes("Ravi"),
        ),
      ).toBe(true);
    }
  });
  it("allows unconfirmed staffing as tentative and unions core crew", () => {
    const p = createDemoProject();
    const result = evaluatePlacement(p, "shot-021", target, 0);
    expect(result.status).toBe("unconfirmed");
    expect(result.issues[0].personId).toBe("meera");
    expect(
      getRequiredPeople(p, {
        ...p.shots[0],
        requiredPersonIds: ["dev", "ravi"],
      }).map((p) => p.id),
    ).toEqual(["ravi", "dev"]);
  });
  it("preserves assignments but reports newly unavailable people", () => {
    let p = createDemoProject();
    p = applyCommand(p, {
      type: "availability/set",
      cells: [
        {
          personId: "ravi",
          date: "2026-09-21",
          sessionId: "afternoon",
          status: "unavailable",
          note: "",
        },
      ],
    });
    expect(p.assignments).toHaveLength(4);
    expect(
      evaluateSchedule(p).some(
        (i) => i.shotId === "shot-005" && i.severity === "error",
      ),
    ).toBe(true);
  });
  it("rejects overflow without modifying source", () => {
    const p = {
      ...empty(),
      shots: [shot("A", 90), shot("B", 45)],
      assignments: [{ shotId: "A", ...target, order: 0 }],
    };
    const before = JSON.stringify(p);
    expect(() =>
      applyCommand(p, {
        type: "schedule/place",
        shotId: "B",
        ...target,
        insertionIndex: 1,
      }),
    ).toThrow(/capacity/);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("checks ordered daylight and refuses insertions that invalidate later shots", () => {
    const p = { ...empty(), shots: [shot("A", 30), shot("B", 45, "daylight")] };
    const t = { ...target, sessionId: "evening" as const };
    expect(evaluatePlacement(p, "B", t, 0).status).toBe("fits");
    const scheduled = applyCommand(p, {
      type: "schedule/place",
      shotId: "B",
      ...t,
      insertionIndex: 0,
    });
    const result = evaluatePlacement(scheduled, "A", t, 0);
    expect(result.status).toBe("blocked");
    expect(
      result.issues.some(
        (i) => i.shotId === "B" && i.code === "LIGHTING_WINDOW",
      ),
    ).toBe(true);
  });
  it("accounts for nighttime waiting separately from production time", () => {
    const p = { ...empty(), shots: [shot("A", 45, "nighttime")] };
    const result = evaluatePlacement(
      p,
      "A",
      { ...target, sessionId: "evening" },
      0,
    );
    expect(result.waitingMinutes).toBe(60);
    expect(result.occupiedMinutes).toBe(105);
    expect(result.timings[0]).toEqual({
      shotId: "A",
      startMinute: 1080,
      endMinute: 1125,
    });
  });
  it("supports nighttime before dawn and the exclusive 24:00 boundary", () => {
    const p = empty();
    p.sessions[0] = {
      id: "morning",
      label: "Early",
      startMinute: 0,
      endMinute: 360,
    };
    p.shots = [shot("A", 360, "nighttime"), shot("B", 240, "nighttime")];
    expect(
      evaluatePlacement(p, "A", { ...target, sessionId: "morning" }, 0).status,
    ).toBe("fits");
    expect(
      evaluatePlacement(p, "B", { ...target, sessionId: "night" }, 0).timings[0]
        .endMinute,
    ).toBe(1440);
    expect(timeLabel(1440)).toBe("24:00");
  });
  it("removes source during move and reorders without duplication", () => {
    let p = { ...empty(), shots: [shot("A", 60), shot("B", 60)] };
    p = applyCommand(p, {
      type: "schedule/place",
      shotId: "A",
      ...target,
      insertionIndex: 0,
    });
    p = applyCommand(p, {
      type: "schedule/place",
      shotId: "B",
      ...target,
      insertionIndex: 1,
    });
    p = applyCommand(p, {
      type: "schedule/place",
      shotId: "B",
      ...target,
      insertionIndex: 0,
    });
    expect(
      cellAssignments(p, target.date, target.sessionId).map((a) => a.shotId),
    ).toEqual(["B", "A"]);
    expect(evaluateCell(p, target.date, target.sessionId).plannedMinutes).toBe(
      120,
    );
    p = applyCommand(p, {
      type: "schedule/place",
      shotId: "B",
      date: "2026-09-21",
      sessionId: "morning",
      insertionIndex: 0,
    });
    expect(p.assignments).toHaveLength(2);
    expect(p.assignments.every((a) => a.order === 0)).toBe(true);
  });
  it("permits unscheduling from a conflicted cell", () => {
    const p = createDemoProject();
    p.people.find((p) => p.id === "dev")!.defaultAvailability = "unavailable";
    const next = applyCommand(p, {
      type: "schedule/unschedule",
      shotId: "shot-001",
    });
    expect(next.assignments).toHaveLength(3);
  });
  it("permits empty requirements and long unscheduled shots", () => {
    const p = { ...empty(), shots: [shot("A", 1440)] };
    expect(validateProject(p)).toBeDefined();
    expect(evaluatePlacement(p, "A", target, 0).issues[0].code).toBe(
      "SESSION_OVERFLOW",
    );
  });
  it("honors date-specific daylight", () => {
    const p = {
      ...empty(),
      shots: [shot("A", 45, "daylight")],
      daylightByDate: [
        { date: target.date, interval: { startMinute: 360, endMinute: 1110 } },
      ],
    };
    expect(
      evaluatePlacement(p, "A", { ...target, sessionId: "evening" }, 0).status,
    ).toBe("fits");
  });
});
describe("Commands and file invariants", () => {
  it("new people start unconfirmed even if a stale caller requests otherwise", () => {
    const p = applyCommand(createDemoProject(), {
      type: "person/create",
      person: {
        id: "new",
        name: "New",
        role: "Actor",
        categories: ["cast", "crew"],
        defaultAvailability: "available",
      },
    });
    expect(p.people.at(-1)?.defaultAvailability).toBe("unconfirmed");
  });
  it("partial-day edits preserve other overrides and clearing restores default", () => {
    let p = createDemoProject();
    const cell = {
      personId: "ravi",
      date: "2026-09-24",
      sessionId: "afternoon" as const,
    };
    p = applyCommand(p, {
      type: "availability/set",
      cells: [{ ...cell, status: "available", note: "Changed" }],
    });
    expect(getAvailability(p, "ravi", cell.date, "afternoon")).toBe(
      "available",
    );
    expect(getAvailability(p, "ravi", cell.date, "morning")).toBe(
      "unavailable",
    );
    p = applyCommand(p, { type: "availability/clear", keys: [cell] });
    expect(getAvailability(p, "ravi", cell.date, "afternoon")).toBe(
      "available",
    );
    expect(p.availability.filter((a) => a.date === cell.date)).toHaveLength(3);
  });
  it("blocks referenced-person deletion, cleans unreferenced availability, deletes shots atomically", () => {
    const p = createDemoProject();
    expect(() =>
      applyCommand(p, { type: "person/delete", personId: "ravi" }),
    ).toThrow(/SH 012/);
    const next = applyCommand(p, { type: "shot/delete", shotId: "shot-005" });
    expect(next.assignments).toHaveLength(3);
    expect(next.shots).toHaveLength(7);
  });
  it("rejects range reduction that strands records", () => {
    const p = createDemoProject();
    expect(() => validateProject({ ...p, endDate: "2026-09-22" })).toThrow(
      /outside/,
    );
  });
  it("round trips all records and imports semantic conflicts", () => {
    const p = createDemoProject();
    p.people[0].defaultAvailability = "unavailable";
    const next = parseProjectFile(serializeProject(p)).project;
    expect(next).toEqual(p);
    expect(evaluateSchedule(next).length).toBeGreaterThan(0);
  });
  it.each([
    "people",
    "shots",
    "availability",
    "assignments",
    "daylightByDate",
  ] as const)("rejects duplicate %s", (key) => {
    const p = createDemoProject();
    if (key === "daylightByDate")
      p.daylightByDate.push({ date: p.startDate, interval: p.daylightDefault });
    const value = [...p[key], p[key][0]];
    expect(() => validateProject({ ...p, [key]: value })).toThrow(/Duplicate/);
  });
  it("rejects unknown fields, invalid references, duplicate codes, invalid orders and overlapping sessions", () => {
    const p = createDemoProject();
    expect(() => validateProject({ ...p, unknown: 1 })).toThrow();
    expect(() =>
      validateProject({ ...p, coreCrewPersonIds: ["ghost"] }),
    ).toThrow(/Unknown person/);
    const codes = structuredClone(p);
    codes.shots[1].code = " sh 012 ";
    expect(() => validateProject(codes)).toThrow(/Duplicate/);
    const order = structuredClone(p);
    order.assignments[0].order = 1;
    expect(() => validateProject(order)).toThrow(/contiguous/);
    const overlap = structuredClone(p);
    overlap.sessions[1].startMinute = 400;
    expect(() => validateProject(overlap)).toThrow(/Overlaps/);
  });
  it("rejects malformed, oversized, unsupported-version and non-exportable data", () => {
    expect(() => parseProjectFile("{")).toThrow(/valid/);
    expect(() => parseProjectFile(" ".repeat(MAX_FILE_BYTES + 1))).toThrow(
      /5 MiB/,
    );
    const envelope = JSON.parse(serializeProject(createDemoProject()));
    envelope.schemaVersion = 2;
    expect(() => parseProjectFile(JSON.stringify(envelope))).toThrow();
    const p = createDemoProject();
    p.shots[0].description = "é".repeat(MAX_FILE_BYTES);
    expect(() => serializeProject(p)).toThrow(/5 MiB/);
  });
  it("rejects invalid dates, timezone, durations, field lengths and supported bounds", () => {
    const p = createDemoProject();
    for (const patch of [
      { startDate: "2026-02-30" },
      { timezone: "Made/Up" },
      { endDate: "2027-01-01" },
      { title: "x".repeat(121) },
    ])
      expect(() => validateProject({ ...p, ...patch })).toThrow();
    for (const estimatedMinutes of [0, -1, 1.5, Infinity, 1441])
      expect(() =>
        validateProject({
          ...p,
          shots: [{ ...p.shots[0], estimatedMinutes }, ...p.shots.slice(1)],
        }),
      ).toThrow();
  });
  it("rejected and no-op commands preserve revision tracking", () => {
    const state = initialState(createDemoProject());
    const rejected = projectReducer(state, {
      type: "command",
      command: {
        type: "schedule/place",
        shotId: "shot-012",
        ...target,
        insertionIndex: 0,
      },
    });
    expect(rejected.project).toBe(state.project);
    expect(rejected.revision).toBe(0);
    expect(rejected.error).toContain("Ravi");
    const noop = projectReducer(state, {
      type: "command",
      command: { type: "schedule/unschedule", shotId: "shot-012" },
    });
    expect(noop.revision).toBe(0);
  });
  it("rejects stale placement indexes at the command boundary", () => {
    expect(() =>
      applyCommand(createDemoProject(), {
        type: "schedule/place",
        shotId: "shot-012",
        date: "2026-09-21",
        sessionId: "morning",
        insertionIndex: 5,
      }),
    ).toThrow(/position/);
  });
});
describe("Production-local dates", () => {
  it("handles leap days, month/year transitions and inclusive ranges", () => {
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(datesBetween("2026-09-30", "2026-10-02")).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });
});

it("keeps the checked-in version-one fixture compatible with the reader", async () => {
  const fixture = await import("./fixtures/demo-project.v1.json");
  expect(parseProjectFile(JSON.stringify(fixture.default)).project).toEqual(
    createDemoProject(),
  );
});
