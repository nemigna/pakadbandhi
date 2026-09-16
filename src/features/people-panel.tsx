import { Fragment, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  PanelRightClose,
  Pencil,
  Check,
  Minus,
  CircleHelp,
  SlidersHorizontal,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { useProject, useCommands } from "@/state/project-context";
import type { Person, AvailabilityStatus, SessionId } from "@/domain/schema";
import { getAvailability } from "@/domain/scheduling";
import { dateLabel } from "@/domain/dates";
import { Button } from "@/components/ui/button";
export function PeoplePanel({
  resizeHandle,
  onClose,
  dates,
  selectedPerson,
  onSelectPerson,
  onEditPerson,
  onAvailability,
  notify,
}: {
  resizeHandle?: ReactNode;
  onClose: () => void;
  dates: string[];
  selectedPerson: string | null;
  onSelectPerson: (id: string) => void;
  onEditPerson: (person?: Person) => void;
  onAvailability: (person: Person) => void;
  notify: (text: string) => void;
}) {
  const { project } = useProject();
  const { commit } = useCommands();
  const person =
    project.people.find((p) => p.id === selectedPerson) ?? project.people[0];
  const [tool, setTool] = useState<AvailabilityStatus>("unavailable");
  const painting = useRef(false);
  const painted = useRef(new Set<string>());
  const paint = (date: string, sessionIds: SessionId[]) => {
    if (!person) return;
    try {
      commit({
        type: "availability/set",
        cells: sessionIds.map((sessionId) => ({
          personId: person.id,
          date,
          sessionId,
          status: tool,
          note: "",
        })),
      });
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to update availability",
      );
    }
  };
  return (
    <aside className="people-panel">
      {resizeHandle}
      <div className="panel-heading">
        <div>
          <h2>Cast & crew</h2>
          <p>People behind the picture</p>
        </div>
        <div className="pane-actions">
          <Button
            className="pane-toggle"
            size="icon"
            variant="ghost"
            aria-label="Hide availability pane"
            onClick={onClose}
          >
            <PanelRightClose size={17} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Add person"
            onClick={() => onEditPerson()}
          >
            <Plus size={18} />
          </Button>
        </div>
      </div>
      <Tabs.Root defaultValue="all">
        <Tabs.List className="people-tabs" aria-label="People categories">
          <Tabs.Trigger value="all">
            All <small>{project.people.length}</small>
          </Tabs.Trigger>
          <Tabs.Trigger value="cast">Cast</Tabs.Trigger>
          <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
        </Tabs.List>
        {["all", "cast", "crew"].map((category) => (
          <Tabs.Content value={category} key={category}>
            <div className="people-list">
              {project.people
                .filter(
                  (p) =>
                    category === "all" ||
                    p.categories.includes(category as "cast" | "crew"),
                )
                .map((p) => (
                  <div
                    className={`person-row ${p.id === person?.id ? "active" : ""}`}
                    key={p.id}
                  >
                    <button
                      className="person-select"
                      aria-label={`Select ${p.name}`}
                      onClick={() => onSelectPerson(p.id)}
                      aria-pressed={p.id === person?.id}
                    >
                      <span
                        className={`avatar ${p.categories.includes("cast") ? "cast" : "crew"}`}
                      >
                        {p.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.role}</small>
                      </span>
                      {project.coreCrewPersonIds.includes(p.id) && (
                        <span className="core-label">CORE</span>
                      )}
                    </button>
                    <button
                      className="person-edit"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => onEditPerson(p)}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
              {!project.people.length && (
                <p className="empty-copy">
                  Add your first cast or crew member.
                </p>
              )}
            </div>
          </Tabs.Content>
        ))}
      </Tabs.Root>
      {person && (
        <section className="availability-section">
          <div className="availability-heading">
            <div>
              <h3>{person.name}’s availability</h3>
              <p>
                {dateLabel(dates[0])} – {dateLabel(dates[dates.length - 1])}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit availability range"
              onClick={() => onAvailability(person)}
            >
              <SlidersHorizontal size={16} />
            </Button>
          </div>
          <div
            className="status-tools"
            role="group"
            aria-label="Availability paint status"
          >
            {(["available", "unavailable", "unconfirmed"] as const).map(
              (status) => (
                <button
                  key={status}
                  className={`${status} ${tool === status ? "active" : ""}`}
                  aria-pressed={tool === status}
                  title={status}
                  aria-label={`Paint ${status}`}
                  onClick={() => setTool(status)}
                >
                  {status === "available" ? (
                    <Check size={13} />
                  ) : status === "unavailable" ? (
                    <Minus size={13} />
                  ) : (
                    <CircleHelp size={13} />
                  )}
                  <span>
                    {status === "available"
                      ? "Free"
                      : status === "unavailable"
                        ? "Busy"
                        : "Unknown"}
                  </span>
                </button>
              ),
            )}
          </div>
          <div
            className="availability-grid"
            style={{
              gridTemplateColumns: `50px repeat(${dates.length}, minmax(24px, 1fr))`,
            }}
            onPointerUp={() => {
              painting.current = false;
            }}
            onPointerLeave={() => {
              painting.current = false;
            }}
          >
            <div />
            {dates.map((date) => (
              <button
                className="availability-date"
                key={date}
                title={`Set all day ${dateLabel(date)} to ${tool}`}
                aria-label={`Set ${date} all day ${tool}`}
                onClick={() =>
                  paint(
                    date,
                    project.sessions.map((s) => s.id),
                  )
                }
              >
                {dateLabel(date, { day: "2-digit" })}
              </button>
            ))}
            {project.sessions.map((s) => (
              <Fragment key={s.id}>
                <span className="availability-session" title={s.label}>
                  {s.label.slice(0, 4)}.
                </span>
                {dates.map((date) => {
                  const status = getAvailability(
                    project,
                    person.id,
                    date,
                    s.id,
                  );
                  const key = `${date}/${s.id}`;
                  return (
                    <button
                      key={key}
                      className={`availability-cell ${status}`}
                      aria-label={`${person.name} ${date} ${s.label}: ${status}`}
                      title={`${status} · Click to mark ${tool}`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        painting.current = true;
                        painted.current = new Set([key]);
                        paint(date, [s.id]);
                      }}
                      onPointerEnter={(e) => {
                        if (
                          e.buttons === 1 &&
                          painting.current &&
                          !painted.current.has(key)
                        ) {
                          painted.current.add(key);
                          paint(date, [s.id]);
                        }
                      }}
                      onClick={(e) => {
                        if (e.detail === 0) paint(date, [s.id]);
                      }}
                    >
                      {status === "available" ? (
                        <Check size={11} />
                      ) : status === "unavailable" ? (
                        <Minus size={12} />
                      ) : (
                        <span>?</span>
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <p className="matrix-help">
            Choose a status, then click or paint.
            <br />
            Date headings apply it to the whole day.
          </p>
          <Button
            className="full-width"
            size="sm"
            onClick={() => onAvailability(person)}
          >
            Edit range & reasons
          </Button>
          <div className="availability-notes">
            <h4>Availability notes</h4>
            {project.availability
              .filter(
                (a) =>
                  a.personId === person.id &&
                  a.date >= dates[0] &&
                  a.date <= dates[dates.length - 1] &&
                  a.note,
              )
              .filter(
                (a, i, arr) =>
                  arr.findIndex(
                    (x) =>
                      x.date === a.date &&
                      x.note === a.note &&
                      x.status === a.status,
                  ) === i,
              )
              .slice(0, 5)
              .map((a) => (
                <div key={`${a.date}/${a.sessionId}`}>
                  <span className={`note-mark ${a.status}`} />
                  <p>
                    <strong>{dateLabel(a.date)}</strong>
                    <span>{a.note}</span>
                  </p>
                </div>
              ))}
            {!project.availability.some(
              (a) =>
                a.personId === person.id &&
                a.date >= dates[0] &&
                a.date <= dates[dates.length - 1] &&
                a.note,
            ) && <p className="muted">No notes for these dates.</p>}
          </div>
          <p className="availability-footnote">
            Availability is checked for the whole session.
            <br />
            Default: <strong>{person.defaultAvailability}</strong>.
          </p>
        </section>
      )}
    </aside>
  );
}
