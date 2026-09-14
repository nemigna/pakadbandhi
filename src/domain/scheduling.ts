import type { Project, Shot, SessionId, Assignment } from "./schema";
export interface ScheduleIssue {
  code:
    | "PERSON_UNAVAILABLE"
    | "PERSON_UNCONFIRMED"
    | "SESSION_OVERFLOW"
    | "LIGHTING_WINDOW";
  severity: "error" | "warning";
  shotId: string;
  personId?: string;
  date: string;
  sessionId: SessionId;
  message: string;
}
export interface PlacementResult {
  status: "fits" | "unconfirmed" | "blocked";
  issues: ScheduleIssue[];
  timings: { shotId: string; startMinute: number; endMinute: number }[];
  plannedMinutes: number;
  waitingMinutes: number;
  occupiedMinutes: number;
}
// Derived lookup caches are scoped to immutable collection identities, never exported.
const availabilityCache = new WeakMap<
  Project["availability"],
  Map<string, Project["availability"][number]>
>();
const peopleCache = new WeakMap<
  Project["people"],
  Map<string, Project["people"][number]>
>();
const shotCache = new WeakMap<Project["shots"], Map<string, Shot>>();
function availabilityIndex(p: Project) {
  let index = availabilityCache.get(p.availability);
  if (!index) {
    index = new Map(
      p.availability.map((x) => [`${x.personId}/${x.date}/${x.sessionId}`, x]),
    );
    availabilityCache.set(p.availability, index);
  }
  return index;
}
function peopleIndex(p: Project) {
  let index = peopleCache.get(p.people);
  if (!index) {
    index = new Map(p.people.map((x) => [x.id, x]));
    peopleCache.set(p.people, index);
  }
  return index;
}
function shotsIndex(p: Project) {
  let index = shotCache.get(p.shots);
  if (!index) {
    index = new Map(p.shots.map((x) => [x.id, x]));
    shotCache.set(p.shots, index);
  }
  return index;
}
export const getRequiredPeople = (p: Project, s: Shot) => {
  const ids = new Set([...p.coreCrewPersonIds, ...s.requiredPersonIds]);
  return p.people.filter((x) => ids.has(x.id));
};
export const getAvailability = (
  p: Project,
  personId: string,
  date: string,
  sessionId: SessionId,
) =>
  availabilityIndex(p).get(`${personId}/${date}/${sessionId}`)?.status ??
  peopleIndex(p).get(personId)?.defaultAvailability ??
  "unconfirmed";
const assignmentCache = new WeakMap<
  Project["assignments"],
  Map<string, Assignment[]>
>();
export function cellAssignments(
  p: Project,
  date: string,
  sessionId: SessionId,
) {
  let index = assignmentCache.get(p.assignments);
  if (!index) {
    index = new Map();
    for (const assignment of p.assignments) {
      const key = `${assignment.date}/${assignment.sessionId}`;
      const cell = index.get(key) ?? [];
      cell.push(assignment);
      index.set(key, cell);
    }
    for (const cell of index.values()) cell.sort((a, b) => a.order - b.order);
    assignmentCache.set(p.assignments, index);
  }
  return index.get(`${date}/${sessionId}`) ?? [];
}
export function evaluateCell(
  p: Project,
  date: string,
  sessionId: SessionId,
  assignments = cellAssignments(p, date, sessionId),
): PlacementResult {
  const session = p.sessions.find((s) => s.id === sessionId)!;
  const daylight =
    p.daylightByDate.find((x) => x.date === date)?.interval ??
    p.daylightDefault;
  const issues: ScheduleIssue[] = [];
  const timings: PlacementResult["timings"] = [];
  let cursor = session.startMinute;
  let plannedMinutes = 0;
  let waitingMinutes = 0;
  for (const a of assignments) {
    const shot = shotsIndex(p).get(a.shotId)!;
    plannedMinutes += shot.estimatedMinutes;
    const issue = (
      code: ScheduleIssue["code"],
      severity: ScheduleIssue["severity"],
      message: string,
      personId?: string,
    ) =>
      issues.push({
        code,
        severity,
        message,
        shotId: shot.id,
        date,
        sessionId,
        ...(personId ? { personId } : {}),
      });
    for (const person of getRequiredPeople(p, shot)) {
      const status = getAvailability(p, person.id, date, sessionId);
      if (status !== "available")
        issue(
          status === "unavailable"
            ? "PERSON_UNAVAILABLE"
            : "PERSON_UNCONFIRMED",
          status === "unavailable" ? "error" : "warning",
          `${person.name} is ${status}`,
          person.id,
        );
    }
    const intervals =
      shot.lighting === "anytime"
        ? [[session.startMinute, session.endMinute]]
        : shot.lighting === "daylight"
          ? [
              [
                Math.max(session.startMinute, daylight.startMinute),
                Math.min(session.endMinute, daylight.endMinute),
              ],
            ]
          : [
              [
                session.startMinute,
                Math.min(session.endMinute, daylight.startMinute),
              ],
              [
                Math.max(session.startMinute, daylight.endMinute),
                session.endMinute,
              ],
            ];
    const fit = intervals
      .map(([start, end]) => [Math.max(start, cursor), end])
      .find(([start, end]) => start + shot.estimatedMinutes <= end);
    if (!fit) {
      issue(
        cursor + shot.estimatedMinutes > session.endMinute
          ? "SESSION_OVERFLOW"
          : "LIGHTING_WINDOW",
        "error",
        cursor + shot.estimatedMinutes > session.endMinute
          ? `${shot.code} exceeds ${session.label} capacity by ${cursor + shot.estimatedMinutes - session.endMinute} min`
          : `${shot.code} cannot fit its ${shot.lighting} requirement in the remaining time`,
      );
      timings.push({
        shotId: shot.id,
        startMinute: cursor,
        endMinute: cursor + shot.estimatedMinutes,
      });
      cursor += shot.estimatedMinutes;
    } else {
      waitingMinutes += fit[0] - cursor;
      timings.push({
        shotId: shot.id,
        startMinute: fit[0],
        endMinute: fit[0] + shot.estimatedMinutes,
      });
      cursor = fit[0] + shot.estimatedMinutes;
    }
  }
  return {
    status: issues.some((x) => x.severity === "error")
      ? "blocked"
      : issues.length
        ? "unconfirmed"
        : "fits",
    issues,
    timings,
    plannedMinutes,
    waitingMinutes,
    occupiedMinutes: cursor - session.startMinute,
  };
}
export function reindex(assignments: Assignment[]) {
  const counts = new Map<string, number>();
  return [...assignments]
    .sort((a, b) => a.order - b.order)
    .map((a) => {
      const key = `${a.date}/${a.sessionId}`;
      const order = counts.get(key) ?? 0;
      counts.set(key, order + 1);
      return { ...a, order };
    });
}
export function candidateAssignments(
  p: Project,
  shotId: string,
  target: { date: string; sessionId: SessionId },
  insertionIndex: number,
) {
  if (!p.shots.some((s) => s.id === shotId))
    throw new Error("Shot no longer exists.");
  if (
    target.date < p.startDate ||
    target.date > p.endDate ||
    !p.sessions.some((x) => x.id === target.sessionId)
  )
    throw new Error("Choose a session within the shooting range.");
  const remaining = reindex(p.assignments.filter((a) => a.shotId !== shotId));
  const cell = remaining
    .filter((a) => a.date === target.date && a.sessionId === target.sessionId)
    .sort((a, b) => a.order - b.order);
  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > cell.length
  )
    throw new Error("Schedule changed. Choose a current position.");
  cell.splice(insertionIndex, 0, {
    shotId,
    date: target.date,
    sessionId: target.sessionId,
    order: insertionIndex,
  });
  return [
    ...remaining.filter(
      (a) => a.date !== target.date || a.sessionId !== target.sessionId,
    ),
    ...cell.map((a, order) => ({ ...a, order })),
  ];
}
export function evaluatePlacement(
  p: Project,
  shotId: string,
  target: { date: string; sessionId: SessionId },
  insertionIndex: number,
) {
  const assignments = candidateAssignments(p, shotId, target, insertionIndex);
  return evaluateCell(
    p,
    target.date,
    target.sessionId,
    assignments
      .filter((a) => a.date === target.date && a.sessionId === target.sessionId)
      .sort((a, b) => a.order - b.order),
  );
}
export function evaluateSchedule(p: Project) {
  const keys = [
    ...new Set(p.assignments.map((a) => `${a.date}/${a.sessionId}`)),
  ];
  return keys.flatMap((key) => {
    const [date, session] = key.split("/");
    return evaluateCell(p, date, session as SessionId).issues;
  });
}
