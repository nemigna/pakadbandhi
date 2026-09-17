import { createDemoProject } from "../src/data/demo";
import { addDays, SESSION_IDS } from "../src/domain/dates";
import { validateProject, type Project } from "../src/domain/schema";
import { evaluatePlacement } from "../src/domain/scheduling";
export function makeProject(
  shotCount = 100,
  peopleCount = 30,
  days = 30,
): Project {
  const p = createDemoProject();
  p.startDate = "2026-09-20";
  p.endDate = addDays(p.startDate, days - 1);
  p.people = Array.from({ length: peopleCount }, (_, i) => ({
    id: `person-${i}`,
    name: `Person ${i}`,
    categories: ["crew"],
    role: "Crew",
    defaultAvailability: "available",
  }));
  p.coreCrewPersonIds = ["person-0", "person-1"];
  p.shots = Array.from({ length: shotCount }, (_, i) => ({
    id: `shot-${i}`,
    code: `SH ${i}`,
    title: `Shot ${i}`,
    description: "",
    sceneLabel: "",
    locationLabel: "Set",
    estimatedMinutes: 20,
    lighting: "anytime",
    color: "sage",
    propIds: [],
    requiredPersonIds: Array.from(
      { length: 6 },
      (_, j) => `person-${(i + j) % peopleCount}`,
    ),
  }));
  p.availability = p.people.flatMap((person) =>
    Array.from({ length: days }, (_, i) =>
      SESSION_IDS.map((sessionId) => ({
        personId: person.id,
        date: addDays(p.startDate, i),
        sessionId,
        status: "available" as const,
        note: "",
      })),
    ).flat(),
  );
  p.assignments = p.shots
    .slice(0, Math.min(80, shotCount - 1))
    .map((s, i) => ({
      shotId: s.id,
      date: addDays(p.startDate, Math.floor(i / 4)),
      sessionId: SESSION_IDS[i % 4],
      order: 0,
    }));
  return validateProject(p);
}
export function measurePreview() {
  const p = makeProject();
  const times: number[] = [];
  for (let run = 0; run < 30; run++) {
    const start = performance.now();
    for (let day = 0; day < 5; day++)
      for (const sessionId of SESSION_IDS)
        evaluatePlacement(
          p,
          "shot-99",
          { date: addDays(p.startDate, day), sessionId },
          0,
        );
    times.push(performance.now() - start);
  }
  return {
    dataset: {
      shots: 100,
      people: 30,
      days: 30,
      availabilityCells: p.availability.length,
    },
    previewAll20CellsMs: times,
    medianMs: [...times].sort((a, b) => a - b)[15],
    maxMs: Math.max(...times),
  };
}
