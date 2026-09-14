import {
  validateProject,
  type Project,
  type Shot,
  type Person,
  type AvailabilityOverride,
  type SessionId,
} from "./schema";
import { candidateAssignments, evaluatePlacement, reindex } from "./scheduling";
export type Settings = Pick<
  Project,
  | "title"
  | "timezone"
  | "startDate"
  | "endDate"
  | "sessions"
  | "daylightDefault"
  | "daylightByDate"
  | "coreCrewPersonIds"
>;
export type ProjectCommand =
  | { type: "shot/create" | "shot/update"; shot: Shot }
  | { type: "shot/delete"; shotId: string }
  | { type: "person/create" | "person/update"; person: Person }
  | { type: "person/delete"; personId: string }
  | { type: "availability/set"; cells: AvailabilityOverride[] }
  | {
      type: "availability/clear";
      keys: Pick<AvailabilityOverride, "personId" | "date" | "sessionId">[];
    }
  | {
      type: "schedule/place";
      shotId: string;
      date: string;
      sessionId: SessionId;
      insertionIndex: number;
    }
  | { type: "schedule/unschedule"; shotId: string }
  | { type: "project/settings"; settings: Settings };
export const availabilityKey = (
  x: Pick<AvailabilityOverride, "personId" | "date" | "sessionId">,
) => `${x.personId}/${x.date}/${x.sessionId}`;
export function personReferences(p: Project, id: string) {
  return [
    ...(p.coreCrewPersonIds.includes(id) ? ["Core crew"] : []),
    ...p.shots
      .filter((s) => s.requiredPersonIds.includes(id))
      .map((s) => `${s.code} — ${s.title}`),
  ];
}
export function applyCommand(p: Project, c: ProjectCommand): Project {
  let next = p;
  switch (c.type) {
    case "shot/create":
      next = { ...p, shots: [...p.shots, c.shot] };
      break;
    case "shot/update":
      if (!p.shots.some((s) => s.id === c.shot.id))
        throw new Error("Shot no longer exists.");
      next = {
        ...p,
        shots: p.shots.map((s) => (s.id === c.shot.id ? c.shot : s)),
      };
      break;
    case "shot/delete":
      next = {
        ...p,
        shots: p.shots.filter((s) => s.id !== c.shotId),
        assignments: reindex(
          p.assignments.filter((a) => a.shotId !== c.shotId),
        ),
      };
      break;
    case "person/create":
      next = {
        ...p,
        people: [
          ...p.people,
          { ...c.person, defaultAvailability: "unconfirmed" },
        ],
      };
      break;
    case "person/update":
      if (!p.people.some((s) => s.id === c.person.id))
        throw new Error("Person no longer exists.");
      next = {
        ...p,
        people: p.people.map((s) => (s.id === c.person.id ? c.person : s)),
      };
      break;
    case "person/delete": {
      const refs = personReferences(p, c.personId);
      if (refs.length)
        throw new Error(
          `Remove references before deleting: ${refs.join(", ")}`,
        );
      next = {
        ...p,
        people: p.people.filter((s) => s.id !== c.personId),
        availability: p.availability.filter((a) => a.personId !== c.personId),
      };
      break;
    }
    case "availability/set": {
      const map = new Map(p.availability.map((x) => [availabilityKey(x), x]));
      c.cells.forEach((x) => map.set(availabilityKey(x), x));
      next = { ...p, availability: [...map.values()] };
      break;
    }
    case "availability/clear": {
      const keys = new Set(c.keys.map(availabilityKey));
      next = {
        ...p,
        availability: p.availability.filter(
          (x) => !keys.has(availabilityKey(x)),
        ),
      };
      break;
    }
    case "schedule/place": {
      const result = evaluatePlacement(p, c.shotId, c, c.insertionIndex);
      if (result.status === "blocked")
        throw new Error(result.issues.map((i) => i.message).join("; "));
      next = {
        ...p,
        assignments: candidateAssignments(p, c.shotId, c, c.insertionIndex),
      };
      break;
    }
    case "schedule/unschedule":
      next = {
        ...p,
        assignments: reindex(
          p.assignments.filter((a) => a.shotId !== c.shotId),
        ),
      };
      break;
    case "project/settings":
      next = { ...p, ...c.settings };
      break;
  }
  const valid = validateProject(next);
  return JSON.stringify(valid) === JSON.stringify(p) ? p : valid;
}
