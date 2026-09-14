import { z } from "zod";
import { dayNumber, isLocalDate, SESSION_IDS } from "./dates";
const id = z.string().trim().min(1).max(120);
const label = z.string().trim().min(1).max(120);
const optionalLabel = z.string().max(120);
export const localDate = z
  .string()
  .refine(isLocalDate, "Expected a real calendar date (YYYY-MM-DD)");
export const sessionId = z.enum(SESSION_IDS);
export const availabilityStatus = z.enum([
  "available",
  "unavailable",
  "unconfirmed",
]);
const intervalFields = {
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
};
export const intervalSchema = z
  .strictObject(intervalFields)
  .refine((x) => x.endMinute > x.startMinute, "End must be after start");
export const personSchema = z.strictObject({
  id,
  name: label,
  categories: z
    .array(z.enum(["cast", "crew"]))
    .min(1)
    .max(2)
    .refine((x) => new Set(x).size === x.length, "Duplicate category"),
  role: label,
  defaultAvailability: availabilityStatus,
});
export const shotSchema = z.strictObject({
  id,
  code: z.string().trim().min(1).max(30),
  title: label,
  sceneLabel: optionalLabel,
  description: z.string().max(2000),
  locationLabel: optionalLabel,
  requiredPersonIds: z.array(id).max(200),
  estimatedMinutes: z.number().int().min(1).max(1440),
  lighting: z.enum(["anytime", "daylight", "nighttime"]),
  color: z.enum(["yellow", "sage", "lavender"]),
});
export const availabilitySchema = z.strictObject({
  personId: id,
  date: localDate,
  sessionId,
  status: availabilityStatus,
  note: z.string().max(2000),
});
export const assignmentSchema = z.strictObject({
  shotId: id,
  date: localDate,
  sessionId,
  order: z.number().int().min(0).max(499),
});
export const projectSchema = z
  .strictObject({
    id,
    title: label,
    timezone: z
      .string()
      .max(120)
      .refine((x) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: x });
          return x.includes("/") || x === "UTC";
        } catch {
          return false;
        }
      }, "Enter a valid IANA timezone"),
    startDate: localDate,
    endDate: localDate,
    sessions: z
      .array(z.strictObject({ id: sessionId, label, ...intervalFields }))
      .length(4),
    daylightDefault: intervalSchema,
    daylightByDate: z
      .array(z.strictObject({ date: localDate, interval: intervalSchema }))
      .max(90),
    coreCrewPersonIds: z.array(id).max(200),
    people: z.array(personSchema).max(200),
    shots: z.array(shotSchema).max(500),
    availability: z.array(availabilitySchema).max(72000),
    assignments: z.array(assignmentSchema).max(500),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const unique = (values: string[], path: (string | number)[]) => {
      const seen = new Set<string>();
      values.forEach((v, i) => {
        if (seen.has(v)) issue([...path, i], `Duplicate: ${v}`);
        seen.add(v);
      });
    };
    const inRange = (date: string, path: (string | number)[]) => {
      if (date < p.startDate || date > p.endDate)
        issue(
          path,
          `${date} is outside the shooting range; remove or move this record first`,
        );
    };
    if (
      p.endDate < p.startDate ||
      dayNumber(p.endDate) - dayNumber(p.startDate) > 89
    )
      issue(["endDate"], "Shooting range must span 1–90 days");
    unique(
      p.people.map((x) => x.id),
      ["people"],
    );
    unique(
      p.shots.map((x) => x.id),
      ["shots"],
    );
    unique(
      p.shots.map((x) => x.code.trim().toLowerCase()),
      ["shots"],
    );
    unique(
      p.sessions.map((x) => x.id),
      ["sessions"],
    );
    unique(p.coreCrewPersonIds, ["coreCrewPersonIds"]);
    const people = new Set(p.people.map((x) => x.id));
    const shots = new Set(p.shots.map((x) => x.id));
    const personRef = (v: string, path: (string | number)[]) => {
      if (!people.has(v)) issue(path, `Unknown person: ${v}`);
    };
    p.coreCrewPersonIds.forEach((v, i) =>
      personRef(v, ["coreCrewPersonIds", i]),
    );
    p.shots.forEach((s, i) => {
      unique(s.requiredPersonIds, ["shots", i, "requiredPersonIds"]);
      s.requiredPersonIds.forEach((v, j) =>
        personRef(v, ["shots", i, "requiredPersonIds", j]),
      );
    });
    p.sessions.forEach((s, i) => {
      if (s.endMinute <= s.startMinute)
        issue(["sessions", i], "Session end must be after start");
      for (let j = i + 1; j < p.sessions.length; j++)
        if (
          s.startMinute < p.sessions[j].endMinute &&
          s.endMinute > p.sessions[j].startMinute
        )
          issue(["sessions", i], `Overlaps ${p.sessions[j].label}`);
    });
    unique(
      p.availability.map((x) => `${x.personId}/${x.date}/${x.sessionId}`),
      ["availability"],
    );
    p.availability.forEach((x, i) => {
      personRef(x.personId, ["availability", i, "personId"]);
      inRange(x.date, ["availability", i, "date"]);
    });
    unique(
      p.daylightByDate.map((x) => x.date),
      ["daylightByDate"],
    );
    p.daylightByDate.forEach((x, i) =>
      inRange(x.date, ["daylightByDate", i, "date"]),
    );
    unique(
      p.assignments.map((x) => x.shotId),
      ["assignments"],
    );
    const cells = new Map<string, number[]>();
    p.assignments.forEach((a, i) => {
      if (!shots.has(a.shotId))
        issue(["assignments", i, "shotId"], `Unknown shot: ${a.shotId}`);
      inRange(a.date, ["assignments", i, "date"]);
      const key = `${a.date}/${a.sessionId}`;
      cells.set(key, [...(cells.get(key) || []), a.order]);
    });
    for (const [key, orders] of cells)
      if (orders.sort((a, b) => a - b).some((n, i) => n !== i))
        issue(["assignments"], `Order must be contiguous from zero in ${key}`);
  });
export const fileSchema = z.strictObject({
  format: z.literal("pakadbandi-project"),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  project: projectSchema,
});
export type Project = z.infer<typeof projectSchema>;
export type Person = z.infer<typeof personSchema>;
export type Shot = z.infer<typeof shotSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type AvailabilityOverride = z.infer<typeof availabilitySchema>;
export type SessionId = z.infer<typeof sessionId>;
export type AvailabilityStatus = z.infer<typeof availabilityStatus>;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const errorMessage = (error: unknown) =>
  error instanceof z.ZodError
    ? error.issues
        .map((x) => `${x.path.join(".") || "Project"}: ${x.message}`)
        .join("\n")
    : error instanceof Error
      ? error.message
      : "Unable to apply this change";
export function serializeProject(
  project: Project,
  exportedAt = new Date().toISOString(),
) {
  const text = JSON.stringify(
    { format: "pakadbandi-project", schemaVersion: 1, exportedAt, project },
    null,
    2,
  );
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error(
      "Project exceeds the 5 MiB JSON limit. Reduce records or note lengths.",
    );
  return text;
}
export function validateProject(project: unknown): Project {
  const result = projectSchema.parse(project);
  serializeProject(result);
  return result;
}
export function parseProjectFile(text: string) {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("JSON file exceeds the 5 MiB limit.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      "Unable to read JSON. Choose a valid Pakadbandi project file.",
    );
  }
  const file = fileSchema.parse(raw);
  serializeProject(file.project);
  return file;
}
