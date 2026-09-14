import { Fragment, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import {
  GripVertical,
  MapPin,
  Clock3,
  Pencil,
  CalendarPlus,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Plus,
  Check,
  CircleHelp,
  Ban,
} from "lucide-react";
import { useProject } from "@/state/project-context";
import type { Shot, SessionId } from "@/domain/schema";
import {
  cellAssignments,
  evaluateCell,
  evaluatePlacement,
  getRequiredPeople,
  type ScheduleIssue,
} from "@/domain/scheduling";
import { dateLabel, timeLabel } from "@/domain/dates";
import { Button } from "@/components/ui/button";
export const statusSymbols = { fits: "✓", unconfirmed: "?", blocked: "×" };
export const statusNames = {
  fits: "Fits",
  unconfirmed: "Unconfirmed",
  blocked: "Blocked",
};
export function ShotCard({
  shot,
  selected,
  onSelect,
  onEdit,
  onSchedule,
  compact = false,
  issues = [],
  timing,
}: {
  shot: Shot;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  compact?: boolean;
  issues?: ScheduleIssue[];
  timing?: string;
}) {
  const { project } = useProject();
  const { ref, handleRef, isDragging, isDropping } = useDraggable({
    id: `${compact ? "board" : "shelf"}/${shot.id}`,
    data: { shotId: shot.id },
  });
  const people = getRequiredPeople(project, shot);
  const conflict = issues.some((i) => i.severity === "error");
  return (
    <article
      ref={ref}
      className={`shot-card ${shot.color} ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      data-testid={`shot-${shot.code.replace(" ", "-")}`}
      data-dropping={isDropping}
    >
      <div className="shot-card-top">
        <span className="shot-code">{shot.code}</span>
        <span className="shot-scene">{shot.sceneLabel}</span>
        <button
          ref={handleRef}
          className="drag-handle"
          aria-label={`Drag ${shot.code}`}
        >
          <GripVertical size={15} />
        </button>
      </div>
      <button
        className="shot-select"
        data-selected={selected}
        aria-pressed={selected}
        aria-label={`Select ${shot.code} ${shot.title}`}
        onClick={onSelect}
      >
        <h3>{shot.title}</h3>
      </button>
      <div className="shot-location">
        <MapPin size={12} />
        <span>{shot.locationLabel || "No location"}</span>
      </div>
      {!compact && (
        <div className="shot-people">
          {people.map((p) => (
            <span key={p.id} title={p.role}>
              {p.name}
            </span>
          ))}
          {!people.length && <span>No people required</span>}
        </div>
      )}
      <div className="shot-card-bottom">
        <span>
          <Clock3 size={12} />
          {shot.estimatedMinutes} min
        </span>
        {shot.lighting !== "anytime" && (
          <span title={shot.lighting}>
            {shot.lighting === "daylight" ? (
              <Sun size={12} />
            ) : (
              <Moon size={12} />
            )}
          </span>
        )}
        <div className="spacer" />
        <button
          className="card-action"
          aria-label={`Schedule ${shot.code}`}
          onClick={onSchedule}
        >
          <CalendarPlus size={14} />
        </button>
        <button
          className="card-action"
          aria-label={`Edit ${shot.code}`}
          onClick={onEdit}
        >
          <Pencil size={13} />
        </button>
      </div>
      {timing && <div className="shot-timing">{timing}</div>}
      {issues.length > 0 && (
        <div
          className={`shot-issue ${conflict ? "hard" : ""}`}
          title={issues.map((i) => i.message).join("\n")}
        >
          {conflict ? <Ban size={12} /> : <CircleHelp size={12} />}
          <span>
            {conflict ? "Conflict" : "Tentative"} · {issues[0].message}
          </span>
        </div>
      )}
    </article>
  );
}
export function ShelfDrop({
  children,
  active,
  onUnschedule,
}: {
  children: ReactNode;
  active: boolean;
  onUnschedule: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({ id: "shelf" });
  return (
    <div
      ref={ref}
      className={`shelf-drop ${isDropTarget ? "drop-active" : ""}`}
    >
      {children}
      {active && (
        <Button className="shelf-return" onClick={onUnschedule}>
          Return selected shot to shelf
        </Button>
      )}
    </div>
  );
}
function InsertTarget({
  date,
  sessionId,
  index,
  dragging,
  onPlace,
}: {
  date: string;
  sessionId: SessionId;
  index: number;
  dragging: boolean;
  onPlace: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `insert/${date}/${sessionId}/${index}`,
  });
  return (
    <button
      ref={ref}
      className={`insertion-target ${dragging ? "show" : ""} ${isDropTarget ? "drop-active" : ""}`}
      onClick={onPlace}
      aria-label={`Insert selected shot at position ${index + 1} on ${date} ${sessionId}`}
    >
      <Plus size={11} />
      <span>Insert here</span>
    </button>
  );
}
function CalendarCell({
  date,
  sessionId,
  selectedId,
  dragging,
  onSelect,
  onEdit,
  onSchedule,
  onPlace,
}: {
  date: string;
  sessionId: SessionId;
  selectedId: string | null;
  dragging: boolean;
  onSelect: (id: string) => void;
  onEdit: (shot: Shot) => void;
  onSchedule: (id: string) => void;
  onPlace: (date: string, session: SessionId, index?: number) => void;
}) {
  const { project } = useProject();
  const assignments = cellAssignments(project, date, sessionId);
  const session = project.sessions.find((s) => s.id === sessionId)!;
  const actual = evaluateCell(project, date, sessionId);
  const insertionCount = assignments.filter(
    (a) => a.shotId !== selectedId,
  ).length;
  const suitability = selectedId
    ? evaluatePlacement(
        project,
        selectedId,
        { date, sessionId },
        insertionCount,
      )
    : null;
  const { ref, isDropTarget } = useDroppable({
    id: `cell/${date}/${sessionId}`,
  });
  const status = suitability?.status;
  const label = `${dateLabel(date)} · ${session.label}`;
  const reason =
    suitability?.issues.map((i) => i.message).join("; ") ||
    (selectedId
      ? "All required people available. Timing and lighting fit."
      : "Select a shot to check this session.");
  let insertIndex = 0;
  return (
    <div
      ref={ref}
      className={`calendar-cell ${status ? `target-${status}` : ""} ${isDropTarget ? "drop-active" : ""}`}
      data-testid={`cell-${date}-${sessionId}`}
    >
      <div className="occupancy">
        <span>
          {actual.plannedMinutes}
          <span className="capacity">
            {" "}
            / {session.endMinute - session.startMinute} min
          </span>
        </span>
        {actual.issues.length > 0 && (
          <span
            className={
              actual.status === "blocked" ? "text-danger" : "text-warning"
            }
            title={actual.issues.map((i) => i.message).join("; ")}
          >
            {actual.status === "blocked" ? "!" : "?"}
          </span>
        )}
      </div>
      {actual.waitingMinutes > 0 && (
        <div className="waiting">
          +{actual.waitingMinutes} min waiting · {actual.occupiedMinutes}{" "}
          occupied
        </div>
      )}
      <div className="scheduled-stack">
        {assignments.map((a) => {
          const shot = project.shots.find((s) => s.id === a.shotId)!;
          const timing = actual.timings.find((t) => t.shotId === a.shotId);
          const currentIndex = insertIndex;
          if (a.shotId !== selectedId) insertIndex++;
          return (
            <Fragment key={a.shotId}>
              {selectedId && a.shotId !== selectedId && (
                <InsertTarget
                  date={date}
                  sessionId={sessionId}
                  index={currentIndex}
                  dragging={dragging}
                  onPlace={() => onPlace(date, sessionId, currentIndex)}
                />
              )}
              <ShotCard
                shot={shot}
                compact
                selected={selectedId === shot.id}
                onSelect={() => onSelect(shot.id)}
                onEdit={() => onEdit(shot)}
                onSchedule={() => onSchedule(shot.id)}
                issues={actual.issues.filter((i) => i.shotId === shot.id)}
                timing={
                  timing
                    ? `${timeLabel(timing.startMinute)}–${timeLabel(timing.endMinute)}`
                    : undefined
                }
              />
            </Fragment>
          );
        })}
      </div>
      {selectedId ? (
        <button
          className={`target-action ${status}`}
          onClick={() => onPlace(date, sessionId)}
          aria-label={`Place selected shot on ${label}`}
          title={reason}
        >
          <span className="target-symbol">{statusSymbols[status!]}</span>
          <span>{statusNames[status!]}</span>
          {assignments.length === 0 && (
            <span className="target-hint">
              {status === "blocked"
                ? suitability?.issues.find((i) => i.severity === "error")
                    ?.message
                : status === "unconfirmed"
                  ? suitability?.issues[0]?.message
                  : "Place shot here"}
            </span>
          )}
        </button>
      ) : assignments.length === 0 ? (
        <div className="empty-session">—</div>
      ) : null}
    </div>
  );
}
export function Board({
  dates,
  selectedId,
  dragging,
  onSelect,
  onEdit,
  onSchedule,
  onPlace,
}: {
  dates: string[];
  selectedId: string | null;
  dragging: boolean;
  onSelect: (id: string) => void;
  onEdit: (s: Shot) => void;
  onSchedule: (id: string) => void;
  onPlace: (d: string, s: SessionId, i?: number) => void;
}) {
  const { project } = useProject();
  const icons = {
    morning: Sunrise,
    afternoon: Sun,
    evening: Sunset,
    night: Moon,
  };
  return (
    <div className="calendar-scroll">
      <div
        className="calendar-grid"
        style={{
          gridTemplateColumns: `94px repeat(${dates.length}, minmax(142px, 1fr))`,
        }}
      >
        <div className="calendar-corner">SESSION</div>
        {dates.map((date, i) => (
          <div className="date-heading" key={date}>
            <span>{dateLabel(date, { weekday: "short" }).toUpperCase()}</span>
            <strong>{dateLabel(date, { day: "2-digit" })}</strong>
            <small>
              DAY{" "}
              {Math.round(
                (Date.parse(date) - Date.parse(project.startDate)) / 86400000,
              ) + 1}
            </small>
            {i === 0 && <span className="date-marker" />}
          </div>
        ))}
        {project.sessions.map((s) => {
          const Icon = icons[s.id];
          return (
            <Fragment key={s.id}>
              <div className="session-heading">
                <Icon size={20} strokeWidth={1.5} />
                <strong>{s.label}</strong>
                <span>
                  {timeLabel(s.startMinute)}
                  <br />— {timeLabel(s.endMinute)}
                </span>
              </div>
              {dates.map((date) => (
                <CalendarCell
                  key={`${date}/${s.id}`}
                  date={date}
                  sessionId={s.id}
                  selectedId={selectedId}
                  dragging={dragging}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onSchedule={onSchedule}
                  onPlace={onPlace}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
export function Legend() {
  return (
    <div className="legend">
      <span className="fits">
        <Check size={12} />
        Fits
      </span>
      <span className="unconfirmed">
        <CircleHelp size={12} />
        Unconfirmed
      </span>
      <span className="blocked">
        <Ban size={12} />
        Blocked
      </span>
    </div>
  );
}
