import { useState, type FormEvent } from "react";
import { Plus, Trash2, CalendarPlus, ArrowLeft } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, ErrorNotice } from "@/components/ui/fields";
import { useProject, useCommands } from "@/state/project-context";
import {
  errorMessage,
  type Shot,
  type Person,
  type AvailabilityStatus,
  type SessionId,
} from "@/domain/schema";
import { personReferences, type Settings } from "@/domain/commands";
import { dateLabel, datesBetween, parseTime, timeLabel } from "@/domain/dates";
import { cellAssignments, evaluatePlacement } from "@/domain/scheduling";

export function ShotEditor({
  shot,
  onClose,
  onSchedule,
}: {
  shot?: Shot;
  onClose: () => void;
  onSchedule: (id: string) => void;
}) {
  const { project } = useProject();
  const { commit } = useCommands();
  const [draft, setDraft] = useState<Shot>(() =>
    shot
      ? structuredClone(shot)
      : {
          id: crypto.randomUUID(),
          code: "",
          title: "",
          sceneLabel: "",
          description: "",
          locationLabel: "",
          requiredPersonIds: [],
          propIds: [],
          estimatedMinutes: 60,
          lighting: "anytime",
          color: "yellow",
        },
  );
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof Shot>(key: K, value: Shot[K]) =>
    setDraft((x) => ({ ...x, [key]: value }));
  const save = (e: FormEvent) => {
    e.preventDefault();
    try {
      commit({ type: shot ? "shot/update" : "shot/create", shot: draft });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog
      title={shot ? `Edit ${shot.code}` : "New shot"}
      description="Plan the shot, the people, and the time it needs."
      onClose={onClose}
    >
      <form onSubmit={save} className="editor-form">
        <ErrorNotice error={error} />
        <div className="form-row">
          <Field label="Shot code">
            <input
              required
              maxLength={30}
              value={draft.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="SH 026"
              autoFocus
            />
          </Field>
          <Field label="Scene label">
            <input
              maxLength={120}
              value={draft.sceneLabel}
              onChange={(e) => set("sceneLabel", e.target.value)}
              placeholder="SCENE 10"
            />
          </Field>
        </div>
        <Field label="Shot title">
          <input
            required
            maxLength={120}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="What happens in this shot?"
          />
        </Field>
        <Field label="Description">
          <textarea
            maxLength={2000}
            rows={3}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            maxLength={120}
            value={draft.locationLabel}
            onChange={(e) => set("locationLabel", e.target.value)}
            placeholder="e.g. Kitchen"
          />
        </Field>
        <div className="form-row">
          <Field
            label="Estimated minutes"
            hint="Includes setup, takes, and reset."
          >
            <input
              type="number"
              min={1}
              max={1440}
              required
              value={draft.estimatedMinutes}
              onChange={(e) => set("estimatedMinutes", Number(e.target.value))}
            />
          </Field>
          <Field label="Lighting">
            <select
              value={draft.lighting}
              onChange={(e) =>
                set("lighting", e.target.value as Shot["lighting"])
              }
            >
              <option value="anytime">Anytime</option>
              <option value="daylight">Daylight</option>
              <option value="nighttime">Nighttime</option>
            </select>
          </Field>
        </div>
        <fieldset>
          <legend>Required people</legend>
          <div className="check-grid">
            {project.people.map((person) => (
              <Checkbox
                key={person.id}
                label={`${person.name} · ${person.role}`}
                checked={draft.requiredPersonIds.includes(person.id)}
                onCheckedChange={(checked) =>
                  set(
                    "requiredPersonIds",
                    checked
                      ? [...draft.requiredPersonIds, person.id]
                      : draft.requiredPersonIds.filter(
                          (id) => id !== person.id,
                        ),
                  )
                }
              />
            ))}
          </div>
          {!project.people.length && (
            <p className="muted">
              No people yet. Add cast or crew from the people panel.
            </p>
          )}
          <p className="field-hint">
            Inherited core crew:{" "}
            {project.people
              .filter((p) => project.coreCrewPersonIds.includes(p.id))
              .map((p) => p.name)
              .join(", ") || "None"}
          </p>
        </fieldset>
        <fieldset>
          <legend>Props</legend>
          <div className="check-grid">
            {project.props.map((prop) => (
              <Checkbox
                key={prop.id}
                label={prop.name}
                checked={draft.propIds.includes(prop.id)}
                onCheckedChange={(checked) =>
                  set(
                    "propIds",
                    checked
                      ? [...draft.propIds, prop.id]
                      : draft.propIds.filter((id) => id !== prop.id),
                  )
                }
              />
            ))}
          </div>
          {!project.props.length && (
            <p className="field-hint">
              Create props from the Props tab, then tag them here.
            </p>
          )}
        </fieldset>
        <Field label="Shot color">
          <select
            value={draft.color}
            onChange={(e) => set("color", e.target.value as Shot["color"])}
          >
            <option value="yellow">Butter yellow</option>
            <option value="sage">Sage green</option>
            <option value="lavender">Soft lavender</option>
          </select>
        </Field>
        {deleting && (
          <div className="error-notice">
            <p>
              Delete {shot?.code} — {shot?.title}? Its schedule assignment will
              also be removed.
            </p>
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  commit({ type: "shot/delete", shotId: draft.id });
                  onClose();
                } catch (err) {
                  setError(errorMessage(err));
                }
              }}
            >
              Confirm delete
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Keep shot
            </Button>
          </div>
        )}
        <div className="dialog-footer">
          {shot && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete shot"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
            </Button>
          )}
          <div className="spacer" />
          {shot && (
            <Button onClick={() => onSchedule(shot.id)}>
              <CalendarPlus size={16} />
              Schedule shot
            </Button>
          )}
          <Button variant="default" type="submit">
            {shot ? "Save changes" : "Create shot"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PersonEditor({
  person,
  onClose,
}: {
  person?: Person;
  onClose: () => void;
}) {
  const { project } = useProject();
  const { commit } = useCommands();
  const [draft, setDraft] = useState<Person>(() =>
    person
      ? { ...person }
      : {
          id: crypto.randomUUID(),
          name: "",
          role: "",
          categories: ["cast"],
          defaultAvailability: "unconfirmed",
        },
  );
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const refs = person ? personReferences(project, person.id) : [];
  return (
    <Dialog
      title={person ? `Edit ${person.name}` : "Add a person"}
      description="Named cast and crew make availability checks meaningful."
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit({
              type: person ? "person/update" : "person/create",
              person: draft,
            });
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <ErrorNotice error={error} />
        <Field label="Display name">
          <input
            autoFocus
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Role">
          <input
            required
            maxLength={120}
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            placeholder="Character name or crew role"
          />
        </Field>
        <fieldset>
          <legend>Classification</legend>
          <div className="check-grid">
            {(["cast", "crew"] as const).map((category) => (
              <Checkbox
                key={category}
                label={category === "cast" ? "Cast" : "Crew"}
                checked={draft.categories.includes(category)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    categories: checked
                      ? [...draft.categories, category]
                      : draft.categories.filter((x) => x !== category),
                  })
                }
              />
            ))}
          </div>
        </fieldset>
        {person ? (
          <Field label="Default availability">
            <select
              value={draft.defaultAvailability}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultAvailability: e.target.value as AvailabilityStatus,
                })
              }
            >
              <option value="unconfirmed">Unconfirmed</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </Field>
        ) : (
          <p className="muted">
            New people start with unconfirmed availability.
          </p>
        )}
        {refs.length > 0 && (
          <p className="field-hint">
            Referenced by: {refs.join(", ")}. Remove these references before
            deleting.
          </p>
        )}
        {deleting && (
          <div className="error-notice">
            Delete {person?.name} and their availability?{" "}
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  commit({ type: "person/delete", personId: draft.id });
                  onClose();
                } catch (err) {
                  setError(errorMessage(err));
                }
              }}
            >
              Confirm delete
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Keep person
            </Button>
          </div>
        )}
        <div className="dialog-footer">
          {person && (
            <Button
              variant="ghost"
              disabled={refs.length > 0}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={16} />
              Delete person
            </Button>
          )}
          <div className="spacer" />
          <Button variant="default" type="submit">
            {person ? "Save changes" : "Add person"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ScheduleEditor({
  shotId,
  initialDate,
  onClose,
  notify,
}: {
  shotId: string;
  initialDate: string;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const { project } = useProject();
  const { commit } = useCommands();
  const shot = project.shots.find((s) => s.id === shotId)!;
  const assignment = project.assignments.find((a) => a.shotId === shotId);
  const [date, setDate] = useState(assignment?.date ?? initialDate);
  const [sessionId, setSession] = useState<SessionId>(
    assignment?.sessionId ?? "morning",
  );
  const [index, setIndex] = useState(assignment?.order ?? 0);
  const [error, setError] = useState("");
  const cell = cellAssignments(project, date, sessionId).filter(
    (a) => a.shotId !== shotId,
  );
  const position = Math.min(index, cell.length);
  const result = evaluatePlacement(
    project,
    shotId,
    { date, sessionId },
    position,
  );
  return (
    <Dialog
      title={`Schedule ${shot.code}`}
      description={shot.title}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit({
              type: "schedule/place",
              shotId,
              date,
              sessionId,
              insertionIndex: position,
            });
            notify(
              result.status === "unconfirmed"
                ? `${shot.code} placed tentatively. Confirm required people.`
                : `${shot.code} scheduled for ${dateLabel(date)} · ${project.sessions.find((s) => s.id === sessionId)?.label}.`,
            );
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <ErrorNotice error={error} />
        <Field label="Shooting date">
          <input
            type="date"
            required
            min={project.startDate}
            max={project.endDate}
            value={date}
            onChange={(e) => {
              if (
                e.target.value >= project.startDate &&
                e.target.value <= project.endDate
              )
                setDate(e.target.value);
            }}
          />
        </Field>
        <Field label="Session">
          <select
            value={sessionId}
            onChange={(e) => setSession(e.target.value as SessionId)}
          >
            {project.sessions.map((s) => (
              <option value={s.id} key={s.id}>
                {s.label} · {timeLabel(s.startMinute)}–{timeLabel(s.endMinute)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filming order">
          <select
            value={position}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {Array.from({ length: cell.length + 1 }, (_, i) => (
              <option value={i} key={i}>
                {i === cell.length
                  ? "At the end"
                  : `Before ${project.shots.find((s) => s.id === cell[i].shotId)?.code}`}
                {i === 0 ? " · First shot" : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className={`placement-summary ${result.status}`}>
          <strong>
            {result.status === "fits"
              ? "✓ This shot fits"
              : result.status === "unconfirmed"
                ? "? Tentative placement"
                : "× Placement blocked"}
          </strong>
          {result.issues.length ? (
            <ul>
              {result.issues.map((i, n) => (
                <li key={n}>{i.message}</li>
              ))}
            </ul>
          ) : (
            <p>All required people are available. Timing and lighting fit.</p>
          )}
          <small>
            {result.plannedMinutes} min planned · {result.waitingMinutes} min
            waiting · {result.occupiedMinutes} min occupied
          </small>
        </div>
        <div className="dialog-footer">
          {assignment && (
            <Button
              onClick={() => {
                commit({ type: "schedule/unschedule", shotId });
                notify(`${shot.code} returned to the shot shelf.`);
                onClose();
              }}
            >
              <ArrowLeft size={16} />
              Unschedule
            </Button>
          )}
          <div className="spacer" />
          <Button
            variant="default"
            type="submit"
            disabled={result.status === "blocked"}
          >
            Place shot
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AvailabilityEditor({
  person,
  initialDate,
  onClose,
}: {
  person: Person;
  initialDate: string;
  onClose: () => void;
}) {
  const { project } = useProject();
  const { commit } = useCommands();
  const [start, setStart] = useState(initialDate);
  const [end, setEnd] = useState(initialDate);
  const [sessions, setSessions] = useState<SessionId[]>(
    project.sessions.map((s) => s.id),
  );
  const [status, setStatus] = useState<AvailabilityStatus | "clear">(
    "unavailable",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const dates = datesBetween(start, end);
  return (
    <Dialog
      title={`${person.name} · Availability`}
      description="Availability applies to the whole shooting session."
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!dates.length || !sessions.length)
              throw new Error(
                "Select a valid date range and at least one session.",
              );
            const keys = dates.flatMap((date) =>
              sessions.map((sessionId) => ({
                personId: person.id,
                date,
                sessionId,
              })),
            );
            if (status === "clear")
              commit({ type: "availability/clear", keys });
            else
              commit({
                type: "availability/set",
                cells: keys.map((key) => ({ ...key, status, note })),
              });
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <ErrorNotice error={error} />
        <div className="form-row">
          <Field label="From">
            <input
              type="date"
              required
              min={project.startDate}
              max={project.endDate}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Through">
            <input
              type="date"
              required
              min={start}
              max={project.endDate}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <fieldset>
          <legend>Sessions</legend>
          <div className="check-grid">
            {project.sessions.map((s) => (
              <Checkbox
                key={s.id}
                label={s.label}
                checked={sessions.includes(s.id)}
                onCheckedChange={(checked) =>
                  setSessions(
                    checked
                      ? [...sessions, s.id]
                      : sessions.filter((x) => x !== s.id),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
        <Field label="Availability status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="unconfirmed">Unconfirmed</option>
            <option value="clear">Remove overrides</option>
          </select>
        </Field>
        <Field label="Reason (optional)">
          <textarea
            rows={2}
            maxLength={2000}
            disabled={status === "clear"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <p className="placement-summary">
          {status === "clear"
            ? `Remove overrides from ${dates.length * sessions.length} cells. Each cell will return to ${person.name}’s default: ${person.defaultAvailability}.`
            : `Set ${dates.length * sessions.length} sessions to ${status}. Existing overrides in these cells will be replaced.`}
        </p>
        <div className="dialog-footer">
          <div className="spacer" />
          <Button variant="default" type="submit">
            Apply availability
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SettingsEditor({ onClose }: { onClose: () => void }) {
  const { project } = useProject();
  const { commit } = useCommands();
  const [draft, setDraft] = useState<Settings>(() => ({
    title: project.title,
    timezone: project.timezone,
    startDate: project.startDate,
    endDate: project.endDate,
    sessions: structuredClone(project.sessions),
    daylightDefault: { ...project.daylightDefault },
    daylightByDate: structuredClone(project.daylightByDate),
    coreCrewPersonIds: [...project.coreCrewPersonIds],
  }));
  const [error, setError] = useState("");
  const [times, setTimes] = useState(() =>
    project.sessions.map((s) => ({
      start: timeLabel(s.startMinute),
      end: timeLabel(s.endMinute),
    })),
  );
  const [daylight, setDaylight] = useState({
    start: timeLabel(project.daylightDefault.startMinute),
    end: timeLabel(project.daylightDefault.endMinute),
  });
  const [overrideTimes, setOverrideTimes] = useState(() =>
    project.daylightByDate.map((s) => ({
      start: timeLabel(s.interval.startMinute),
      end: timeLabel(s.interval.endMinute),
    })),
  );
  return (
    <Dialog
      title="Project settings"
      description="Session times and daylight are production-local planning assumptions."
      onClose={onClose}
      wide
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit({
              type: "project/settings",
              settings: {
                ...draft,
                sessions: draft.sessions.map((s, i) => ({
                  ...s,
                  startMinute: parseTime(times[i].start),
                  endMinute: parseTime(times[i].end),
                })),
                daylightDefault: {
                  startMinute: parseTime(daylight.start),
                  endMinute: parseTime(daylight.end),
                },
                daylightByDate: draft.daylightByDate.map((s, i) => ({
                  date: s.date,
                  interval: {
                    startMinute: parseTime(overrideTimes[i].start),
                    endMinute: parseTime(overrideTimes[i].end),
                  },
                })),
              },
            });
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <ErrorNotice error={error} />
        <Field label="Project title">
          <input
            autoFocus
            required
            maxLength={120}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>
        <div className="form-row">
          <Field label="First shooting day">
            <input
              type="date"
              required
              value={draft.startDate}
              onChange={(e) =>
                setDraft({ ...draft, startDate: e.target.value })
              }
            />
          </Field>
          <Field label="Last shooting day">
            <input
              type="date"
              required
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Production timezone">
          <input
            required
            value={draft.timezone}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            placeholder="Asia/Kolkata"
          />
        </Field>
        <fieldset>
          <legend>Shooting sessions</legend>
          <p className="field-hint">
            24:00 is allowed only as an end time. Sessions cannot overlap.
          </p>
          {draft.sessions.map((s, i) => (
            <div className="session-fields" key={s.id}>
              <Field label={`${s.id} label`}>
                <input
                  required
                  value={s.label}
                  maxLength={120}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sessions: draft.sessions.map((item, n) =>
                        n === i ? { ...item, label: e.target.value } : item,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Start">
                <input
                  required
                  aria-label={`${s.id} start`}
                  value={times[i].start}
                  onChange={(e) =>
                    setTimes(
                      times.map((t, n) =>
                        n === i ? { ...t, start: e.target.value } : t,
                      ),
                    )
                  }
                  placeholder="06:00"
                />
              </Field>
              <Field label="End">
                <input
                  required
                  aria-label={`${s.id} end`}
                  value={times[i].end}
                  onChange={(e) =>
                    setTimes(
                      times.map((t, n) =>
                        n === i ? { ...t, end: e.target.value } : t,
                      ),
                    )
                  }
                  placeholder="11:00"
                />
              </Field>
            </div>
          ))}
        </fieldset>
        <fieldset>
          <legend>Planning daylight window</legend>
          <p className="field-hint">
            Manually configured. No sunrise/sunset lookup.
          </p>
          <div className="form-row">
            <Field label="Daylight starts">
              <input
                value={daylight.start}
                onChange={(e) =>
                  setDaylight({ ...daylight, start: e.target.value })
                }
              />
            </Field>
            <Field label="Daylight ends">
              <input
                value={daylight.end}
                onChange={(e) =>
                  setDaylight({ ...daylight, end: e.target.value })
                }
              />
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Date-specific daylight</legend>
          {draft.daylightByDate.map((d, i) => (
            <div className="override-fields" key={i}>
              <Field label="Date">
                <input
                  type="date"
                  required
                  value={d.date}
                  min={draft.startDate}
                  max={draft.endDate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      daylightByDate: draft.daylightByDate.map((x, n) =>
                        n === i ? { ...x, date: e.target.value } : x,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Start">
                <input
                  value={overrideTimes[i].start}
                  onChange={(e) =>
                    setOverrideTimes(
                      overrideTimes.map((x, n) =>
                        n === i ? { ...x, start: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="End">
                <input
                  value={overrideTimes[i].end}
                  onChange={(e) =>
                    setOverrideTimes(
                      overrideTimes.map((x, n) =>
                        n === i ? { ...x, end: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Button
                aria-label={`Remove daylight override ${d.date}`}
                size="icon"
                onClick={() => {
                  setDraft({
                    ...draft,
                    daylightByDate: draft.daylightByDate.filter(
                      (_, n) => n !== i,
                    ),
                  });
                  setOverrideTimes(overrideTimes.filter((_, n) => n !== i));
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() => {
              setDraft({
                ...draft,
                daylightByDate: [
                  ...draft.daylightByDate,
                  { date: draft.startDate, interval: draft.daylightDefault },
                ],
              });
              setOverrideTimes([...overrideTimes, { ...daylight }]);
            }}
          >
            <Plus size={15} />
            Add daylight override
          </Button>
        </fieldset>
        <fieldset>
          <legend>Core crew · required for every shot</legend>
          <div className="check-grid">
            {project.people.map((p) => (
              <Checkbox
                key={p.id}
                label={`${p.name} · ${p.role}`}
                checked={draft.coreCrewPersonIds.includes(p.id)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    coreCrewPersonIds: checked
                      ? [...draft.coreCrewPersonIds, p.id]
                      : draft.coreCrewPersonIds.filter((id) => id !== p.id),
                  })
                }
              />
            ))}
          </div>
        </fieldset>
        <p className="field-hint">
          Time changes preserve assignments and reveal any new conflicts. To
          shorten the range, first unschedule shots and clear
          availability/daylight overrides outside it.
        </p>
        <div className="dialog-footer">
          <Button onClick={onClose}>Cancel</Button>
          <div className="spacer" />
          <Button variant="default" type="submit">
            Save settings
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
